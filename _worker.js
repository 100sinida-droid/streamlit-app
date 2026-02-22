// StockMind _worker.js v14
// 버그 수정:
//   [1] PER=5930, PBR=5930 → b.per 등이 null/undefined일 때 cd 종목코드가 파싱되는 버그 제거
//       → 필드 존재 여부를 hasOwn 방식으로 명시 체크
//   [2] 시가총액 N/A → marketValue 억원 단위 변환 올바르게
//   [3] 시가/외국인비율 N/A → openPrice, foreignRatio 필드 직접 사용
//   [4] 해외주식 원 표시 → prompt에 currency 필드 명시, autoAnalysis isUSD 수정
//   [5] 52주 고저 → fchart 1년치에서 max/min으로 직접 계산 (항상 제공)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

// 안전한 숫자 변환: 쉼표/부호/단위 제거 후 parseFloat
// 중요: undefined, null, "" 는 모두 0 반환 (종목코드 같은 외부 값 오염 방지)
function toNum(v) {
  if (v === null || v === undefined || v === "" || v === "N/A") return 0;
  const s = String(v).replace(/,/g, "").replace(/\+/g, "").replace(/[원%]/g, "").trim();
  if (s === "" || s === "-") return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// 객체에서 안전하게 숫자 꺼내기 (필드가 없거나 null이면 반드시 0)
function field(obj, ...keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== null && obj[k] !== undefined && obj[k] !== "") {
      const n = toNum(obj[k]);
      if (n !== 0) return n;
    }
  }
  return 0;
}

function isKR(sym) { return sym.endsWith(".KS") || sym.endsWith(".KQ"); }
function codeOf(sym) { return sym.slice(0, -3); }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const NAVER_HDR = {
  "User-Agent": UA,
  "Accept": "application/json,*/*",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Referer": "https://m.stock.naver.com/",
};

// ── 네이버 종목 검색 ──────────────────────────────────────────
async function searchNaver(q) {
  try {
    const r = await fetch(
      `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=index,stock,etf,fund,futures,option`,
      { headers: NAVER_HDR }
    );
    if (!r.ok) return json({ ok: true, results: [] });
    const d = await r.json();
    const items = Array.isArray(d.items) ? d.items
                : (d.result?.items ?? []);
    const results = [];
    for (const it of items.slice(0, 12)) {
      const rc = String(Array.isArray(it) ? it[0] : (it.code ?? it.symbolCode ?? ""));
      const nm = String(Array.isArray(it) ? it[1] : (it.name ?? it.stockName ?? ""));
      const mt = String(Array.isArray(it) ? it[2] : (it.typeCode ?? ""));
      if (!rc || !nm || !/^\d{6}$/.test(rc)) continue;
      const isKQ = mt === "2" || mt === "NQ" || mt.includes("KOSDAQ");
      results.push({ symbol: rc + (isKQ ? ".KQ" : ".KS"), code: rc, name: nm, market: isKQ ? "KOSDAQ" : "KOSPI" });
    }
    return json({ ok: true, results });
  } catch { return json({ ok: true, results: [] }); }
}

// ── fchart XML 파싱 ───────────────────────────────────────────
// data="YYYYMMDD|시가|고가|저가|종가|거래량"
async function fetchFchart(cd, count) {
  const r = await fetch(
    `https://fchart.stock.naver.com/sise.nhn?symbol=${cd}&timeframe=day&count=${count}&requestType=0`,
    { headers: { "User-Agent": UA, "Referer": "https://finance.naver.com/" } }
  );
  if (!r.ok) throw new Error(`fchart ${r.status}`);
  const xml = await r.text();
  const re = /data="(\d{8})\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)"/g;
  const rows = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    rows.push({
      date:   `${m[1].slice(0,4)}-${m[1].slice(4,6)}-${m[1].slice(6,8)}`,
      open:   parseInt(m[2], 10),
      high:   parseInt(m[3], 10),
      low:    parseInt(m[4], 10),
      close:  parseInt(m[5], 10),
      volume: parseInt(m[6], 10),
    });
  }
  rows.sort((a, b) => a.date < b.date ? -1 : 1);
  return rows;
}

// ── 네이버 Quote ─────────────────────────────────────────────
async function naverQuote(cd, sym) {
  // basic API + 1년치 fchart 병렬 호출
  const [rB, rC] = await Promise.allSettled([
    fetch(`https://m.stock.naver.com/api/stock/${cd}/basic`, { headers: NAVER_HDR })
      .then(r => r.ok ? r.json() : {}),
    fetchFchart(cd, 280),
  ]);

  const b    = rB.status === "fulfilled" ? (rB.value ?? {}) : {};
  const rows = rC.status === "fulfilled" ? (rC.value ?? []) : [];
  const last = rows.at(-1) ?? null;

  // ── 현재가 / 등락 ─────────────────────────────────────────
  // field() 함수는 hasOwnProperty 체크 → cd 오염 없음
  const price     = field(b, "closePrice", "stockEndPrice", "currentPrice") || (last?.close ?? 0);
  const change    = field(b, "compareToPreviousClosePrice");
  const changePct = field(b, "fluctuationsRatio");
  const name      = (b.stockName ?? b.itemName ?? b.corporateName ?? cd).trim();

  // ── 시가 / 고가 / 저가 ────────────────────────────────────
  const open  = field(b, "openPrice")  || (last?.open  ?? 0);
  const high  = field(b, "highPrice")  || (last?.high  ?? 0);
  const low   = field(b, "lowPrice")   || (last?.low   ?? 0);

  // ── 거래량 ───────────────────────────────────────────────
  const volume = field(b, "accumulatedTradingVolume", "tradingVolume") || (last?.volume ?? 0);

  // ── 52주 고저: fchart 1년치에서 직접 계산 ─────────────────
  // → 어떤 종목이든 차트 데이터만 있으면 반드시 값이 나옴
  let h52 = 0, l52 = 0;
  if (rows.length > 0) {
    h52 = Math.max(...rows.map(r => r.high).filter(v => v > 0));
    l52 = Math.min(...rows.map(r => r.low ).filter(v => v > 0));
  }
  // basic에 연고저가 있으면 우선 사용
  const bh = field(b, "yearlyHighPrice", "highPrice52Week", "week52HighPrice");
  const bl = field(b, "yearlyLowPrice",  "lowPrice52Week",  "week52LowPrice");
  if (bh > 0) h52 = bh;
  if (bl > 0) l52 = bl;

  // ── 시가총액 ─────────────────────────────────────────────
  // marketValue: 억원 단위 문자열 ("1,133,890" = 약 113조)
  const mcRaw = field(b, "marketValue", "totalMarketValue");
  const marketCap = mcRaw > 0 ? mcRaw * 1e8 : 0;

  // ── PER / PBR / EPS / BPS / 외국인비율 ──────────────────
  // hasOwnProperty + null 체크 → 종목코드 cd 오염 절대 불가
  const per = field(b, "per", "PER");
  const pbr = field(b, "pbr", "PBR");
  const eps = field(b, "eps", "EPS");
  const bps = field(b, "bps", "BPS");
  const foreignRatio = field(b, "foreignRatio");

  return json({
    ok: true, symbol: sym, name,
    price, change, changePct,
    open, high, low,
    high52: h52, low52: l52,
    volume, marketCap,
    per, pbr, eps, bps, foreignRatio,
    currency: "KRW",
    exchange: sym.endsWith(".KQ") ? "KOSDAQ" : "KOSPI",
  });
}

// ── 네이버 Chart ─────────────────────────────────────────────
async function naverChart(cd, days) {
  try {
    const rows = await fetchFchart(cd, days + 20);
    if (rows.length > 0) {
      return json({ ok: true, history: rows.slice(-days).map(r => ({ date: r.date, close: r.close })) });
    }
  } catch {}

  // JSON 폴백
  for (const url of [
    `https://m.stock.naver.com/api/stock/${cd}/candle/day?count=${days + 20}`,
    `https://m.stock.naver.com/api/stock/${cd}/sise/day?count=${days + 20}`,
  ]) {
    try {
      const r = await fetch(url, { headers: NAVER_HDR });
      if (!r.ok) continue;
      const data = await r.json();
      const arr  = Array.isArray(data) ? data : (data.candles ?? data.candleList ?? []);
      const hist = arr.flatMap(c => {
        const s = String(c.localDate ?? c.date ?? "");
        const dt = s.length === 8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : s;
        const cl = toNum(c.closePrice ?? c.close);
        return cl > 0 && dt ? [{ date: dt, close: cl }] : [];
      }).sort((a, b) => a.date < b.date ? -1 : 1);
      if (hist.length > 0) return json({ ok: true, history: hist.slice(-days) });
    } catch {}
  }
  return json({ ok: true, history: [] });
}

// ── Yahoo Quote ───────────────────────────────────────────────
async function yahooQuote(sym) {
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`,
        { headers: { "User-Agent": UA } }
      );
      if (!r.ok) continue;
      const d    = await r.json();
      const res  = d.chart?.result?.[0];
      if (!res) continue;
      const meta  = res.meta ?? {};
      const price = meta.regularMarketPrice ?? 0;
      const prev  = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const chg   = price - prev;
      const pct   = prev > 0 ? (chg / prev * 100) : 0;
      return json({
        ok: true, symbol: sym,
        name: meta.longName ?? meta.shortName ?? sym,
        price,
        change:    Math.round(chg   * 1e4) / 1e4,
        changePct: Math.round(pct   * 1e4) / 1e4,
        open:    meta.regularMarketOpen    ?? 0,
        high:    meta.regularMarketDayHigh ?? 0,
        low:     meta.regularMarketDayLow  ?? 0,
        high52:  meta.fiftyTwoWeekHigh     ?? 0,
        low52:   meta.fiftyTwoWeekLow      ?? 0,
        volume:  meta.regularMarketVolume  ?? 0,
        marketCap: meta.marketCap          ?? 0,
        per: 0, pbr: 0, eps: 0, bps: 0, foreignRatio: 0,
        currency: meta.currency ?? "USD",
        exchange: meta.exchangeName ?? "US",
      });
    } catch {}
  }
  throw new Error(`${sym} 데이터 없음`);
}

// ── Yahoo Chart ───────────────────────────────────────────────
async function yahooChart(sym, days) {
  const rng  = days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
  const path = `/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${rng}`;
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com${path}`, { headers: { "User-Agent": UA } });
      if (!r.ok) continue;
      const d    = await r.json();
      const res  = d.chart?.result?.[0];
      if (!res) continue;
      const ts     = res.timestamp ?? [];
      const closes = res.indicators?.quote?.[0]?.close ?? [];
      const hist   = ts.flatMap((t, i) =>
        closes[i] > 0 ? [{ date: new Date(t * 1000).toISOString().slice(0, 10), close: closes[i] }] : []
      );
      return json({ ok: true, history: hist.slice(-days) });
    } catch {}
  }
  return json({ ok: true, history: [] });
}

// ── AI 분석 ──────────────────────────────────────────────────
async function doAnalyze(prompt, env) {
  if (env.ANTHROPIC_API_KEY) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 2000,
          system: "전문 주식 애널리스트. 순수 JSON만 출력. 마크다운 없음.",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (r.ok) {
        const cd   = await r.json();
        const text = (cd.content?.[0]?.text ?? "{}").replace(/```json/gi, "").replace(/```/gi, "").trim();
        try { return json(JSON.parse(text)); } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) try { return json(JSON.parse(m[0])); } catch {}
        }
      }
    } catch {}
  }
  return json(autoAnalysis(prompt));
}

function autoAnalysis(prompt) {
  // prompt 파싱 — currency 필드로 USD/KRW 판별
  const get = (re, fb = "") => (prompt.match(re)?.[1] ?? fb);

  const nm       = get(/종목:\s*([^\(（\n]+)[\(（]/, "이 종목").trim();
  const currency = get(/통화:\s*([A-Z]+)/, "KRW");          // ★ 핵심
  const mkt      = get(/시장:\s*([^\s|\n]+)/, "시장");
  const pct      = parseFloat(get(/등락:\s*([-\d.]+)%/, "0"));
  const pStr     = get(/현재가:\s*([^\s|\n]+)/, "0");       // 포맷된 문자열
  const h52s     = get(/52주고가:\s*([^\s|\n]+)/, "N/A");
  const l52s     = get(/52주저가:\s*([^\s|\n]+)/, "N/A");
  const pers     = get(/PER:\s*([\d.N\/A]+)/, "N/A");
  const pbrs     = get(/PBR:\s*([\d.N\/A]+)/, "N/A");
  const caps     = get(/시가총액:\s*([^\s|\n]+)/, "");
  const volPct   = parseFloat(get(/변동성:\s*([\d.]+)%/, "3"));
  const trend    = get(/트렌드:\s*([^\s\n]+)/, "보합");

  const isUSD = currency === "USD";                          // ★ $ 여부 통화로 판별
  const isKo  = mkt === "KOSPI" || mkt === "KOSDAQ";
  const pNum  = parseFloat(pStr.replace(/[^0-9.]/g, "")) || 0;

  // 통화 기반 포맷 함수
  const fmt = n => isUSD
    ? "$" + n.toFixed(n >= 100 ? 2 : 4)
    : Math.round(n).toLocaleString("ko-KR") + "원";

  // 투자 의견
  let verdict, vc;
  if      (pct > 2  && trend === "상승") { verdict = "매수"; vc = "buy"; }
  else if (pct > 0.5)                    { verdict = "주목"; vc = "watch"; }
  else if (pct < -2 && trend === "하락") { verdict = "관망"; vc = "hold"; }
  else if (pct < -0.5)                   { verdict = "관망"; vc = "hold"; }
  else                                   { verdict = "주목"; vc = "watch"; }

  // 리스크 점수
  let rs = 45;
  if (volPct > 6) rs += 20;
  if (pct < -2)   rs += 15;
  if (pct > 3)    rs += 10;
  rs = Math.min(88, Math.max(22, rs));
  const rl = rs < 38 ? "낮음" : rs < 62 ? "중간" : "높음";

  // 가격 목표
  const buy1 = pNum > 0 ? fmt(pNum * 0.97) : "현재가 -3%";
  const buy2 = pNum > 0 ? fmt(pNum * 0.94) : "현재가 -6%";
  const tgt1 = pNum > 0 ? fmt(pNum * 1.06) : "현재가 +6%";
  const tgt2 = pNum > 0 ? fmt(pNum * 1.14) : "현재가 +14%";
  const stop = pNum > 0 ? fmt(pNum * 0.93) : "현재가 -7%";
  const bull = pNum > 0 ? fmt(pNum * 1.20) : "현재가 +20%";
  const base = pNum > 0 ? fmt(pNum * 1.09) : "현재가 +9%";
  const bear = pNum > 0 ? fmt(pNum * 0.88) : "현재가 -12%";
  const zone = pNum > 0 ? `${fmt(pNum * 0.96)} ~ ${fmt(pNum * 0.99)}` : "현재가 -1~4%";

  const perNote = (pers !== "N/A" && !isNaN(+pers))
    ? ` PER ${pers}배, PBR ${pbrs}배로 ${+pers > 20 ? "다소 고평가 수준이므로 신중한 접근이 필요합니다." : "적정 밸류에이션 수준입니다."}`
    : "";
  const capTxt = caps && caps !== "N/A" && caps !== "—" ? `시가총액 ${caps} 규모로 ` : "";

  const reason =
    `${nm}은(는) 현재 ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% ${pct >= 0 ? "상승" : "하락"} 중이며, 최근 30일 추세는 ${trend} 흐름입니다. ` +
    (isKo
      ? `국내 ${mkt} 시장에서 ${capTxt}거래되고 있으며, 외국인·기관 수급 변화에 민감하게 반응합니다. `
      : `글로벌 ${mkt} 시장에서 ${capTxt}거래되는 종목으로, 달러 환율 및 매크로 지표에 주목해야 합니다. `) +
    perNote +
    ` 52주 고가 ${h52s}, 저가 ${l52s} 기준으로 현재 포지션을 점검하고, ` +
    (volPct > 5 ? `변동성 ${volPct.toFixed(1)}% 수준으로 단기 급등락에 유의하며 ` : "") +
    (vc === "buy"   ? "분할 매수 전략으로 접근하는 것을 권고합니다."
    : vc === "watch" ? "추가 데이터 확인 후 진입 시점을 노리는 것을 권고합니다."
    :                  "신중하게 관망하며 하락 안정화를 확인 후 진입을 권고합니다.");

  return {
    ok: true, verdict, verdictReason: reason,
    buyStrategy: {
      zone,
      timing: trend === "상승" ? "눌림목 발생 시 분할 매수 진입" : "하락 안정화 + 거래량 회복 확인 후 진입",
      split: [`1차 ${buy1} (자금의 40%)`, `2차 ${buy2} (자금의 60%)`],
    },
    sellStrategy: { shortTarget: tgt1, midTarget: tgt2, stopLoss: stop, exitSignal: `${tgt1} 돌파 + 거래량 급증 시 1차 익절, ${tgt2} 도달 시 전량 청산` },
    risks: [
      volPct > 5 ? `높은 변동성(${volPct.toFixed(1)}%)으로 단기 급락 시 손실 확대 가능` : "변동성 안정적이나 대외 충격에 일시적 급락 위험",
      isKo       ? "외국인·기관 순매도 전환 시 수급 이탈로 추가 하락 가능" : "달러 강세·금리 상승 구간에서 밸류에이션 리스크",
      trend === "하락" ? `하락 추세 지속 시 52주 저가(${l52s}) 지지 여부가 관건` : "단기 급등 후 차익 실현 매물 출회로 조정 가능성",
    ],
    riskLevel: rl, riskScore: rs,
    scenarios: {
      bull: { price: bull, desc: "수급 개선·실적 호조·섹터 모멘텀 강화 시 목표가 달성 가능" },
      base: { price: base, desc: "현 추세 유지 시 완만한 우상향, 분할 매수 전략 유효" },
      bear: { price: bear, desc: "매크로 악화·수급 이탈 복합 시 추가 하락, 손절 원칙 준수 필수" },
    },
    watchPoints: [
      `52주 고가 ${h52s} 돌파 여부 — 돌파 시 강력한 추세 전환 신호`,
      `52주 저가 ${l52s} 지지 여부 — 이탈 시 손절 기준점 확인`,
      isKo ? "외국인·기관 순매수 전환 시점 — 수급 주도 상승의 핵심 조건" : "섹터 ETF 자금 유입 및 옵션 포지션 변화 확인",
      "거래량 20일 평균 2배 이상 급증 시 방향성 확정 신호",
    ],
    summary: `${nm} ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% 등락. 단기목표 ${tgt1}, 중기목표 ${tgt2}, 손절 ${stop}. ` +
      (vc === "buy" ? "적극 매수 구간." : vc === "watch" ? "눌림목 포착 권고." : "관망 후 안정화 확인."),
  };
}

// ── 라우터 ───────────────────────────────────────────────────
export default {
  async fetch(req, env) {
    const url    = new URL(req.url);
    const path   = url.pathname;
    const method = req.method;

    if (method === "OPTIONS") return new Response(null, { headers: CORS });
    if (path === "/api/health") return json({ ok: true, v: 14, t: new Date().toISOString() });

    if (path === "/api/search" && method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      if (!q) return json({ ok: false, error: "q 필요" }, 400);
      return searchNaver(q);
    }

    if (path === "/api/stock" && method === "GET") {
      const action = url.searchParams.get("action") ?? "";
      const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase();
      const days   = parseInt(url.searchParams.get("days") ?? "30", 10);
      try {
        if (!symbol) return json({ ok: false, error: "symbol 필요" }, 400);
        if (action === "quote") return isKR(symbol) ? naverQuote(codeOf(symbol), symbol) : yahooQuote(symbol);
        if (action === "chart") return isKR(symbol) ? naverChart(codeOf(symbol), days)  : yahooChart(symbol, days);
        return json({ ok: false, error: "action 오류" }, 400);
      } catch (e) { return json({ ok: false, error: e.message }, 500); }
    }

    if (path === "/api/analyze" && method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        if (!body.prompt) return json({ ok: false, error: "prompt 필요" }, 400);
        return doAnalyze(body.prompt, env);
      } catch (e) { return json({ ok: false, error: e.message }, 500); }
    }

    return env.ASSETS.fetch(req);
  },
};
