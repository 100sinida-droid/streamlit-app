// StockMind _worker.js v15
// 수정사항:
//   [1] 한국 주식 시총/PER/PBR/외국인비율: /basic + /finance/summary 병렬 호출로 완전히 채움
//   [2] 해외주식 시가: Yahoo meta 필드 명시 추가
//   [3] AI 의견 다양화: 52주 위치, PER 밸류에이션, 변동성, 추세 종합 판단

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

// 안전한 숫자 변환
function N(v) {
  if (v === null || v === undefined || v === "" || v === "N/A" || v === "-") return 0;
  const n = parseFloat(String(v).replace(/,/g, "").replace(/\+/g, "").replace(/[원%]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

// hasOwnProperty 기반 안전한 필드 추출 (종목코드 오염 방지)
function F(obj, ...keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const val = obj[k];
      if (val !== null && val !== undefined && val !== "") {
        const n = N(val);
        if (n !== 0) return n;
      }
    }
  }
  return 0;
}

function isKR(sym) { return sym.endsWith(".KS") || sym.endsWith(".KQ"); }
function codeOf(sym) { return sym.slice(0, -3); }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const KR_HDR = {
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
      { headers: KR_HDR }
    );
    if (!r.ok) return json({ ok: true, results: [] });
    const d = await r.json();
    const items = Array.isArray(d.items) ? d.items : (d.result?.items ?? []);
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

// ── fchart XML 파싱 (1년치 또는 30일) ────────────────────────
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

// ── 네이버 finance/summary에서 PER/PBR/시총 보완 ─────────────
async function fetchNaverSummary(cd) {
  // /finance/summary: recentQuarter.per, pbr, marketCap 등 포함
  // /invest: 투자지표 (per, pbr, roe, 등)
  const urls = [
    `https://m.stock.naver.com/api/stock/${cd}/finance/summary`,
    `https://m.stock.naver.com/api/stock/${cd}/invest`,
  ];
  const result = { per: 0, pbr: 0, marketCap: 0, foreignRatio: 0 };
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: KR_HDR });
      if (!r.ok) continue;
      const d = await r.json();

      // /finance/summary 구조: { recentQuarter: { per, pbr, ... }, financeSummary: {...} }
      const q = d.recentQuarter ?? d.financeSummary ?? d.investIndicator ?? d;

      if (!result.per)          result.per          = F(q, "per", "PER", "perRatio");
      if (!result.pbr)          result.pbr          = F(q, "pbr", "PBR", "pbrRatio");
      if (!result.foreignRatio) result.foreignRatio = F(q, "foreignRatio", "foreignOwnRatio");

      // 시가총액: marketCap (억원 단위 가능)
      if (!result.marketCap) {
        const mc = F(q, "marketCap", "marketValue", "totalMarketValue");
        if (mc > 0) result.marketCap = mc > 1e10 ? mc : mc * 1e8;
      }

      // /invest 구조 탐색
      if (!result.per && d.indicatorList) {
        for (const item of (d.indicatorList ?? [])) {
          const k = (item.key ?? "").toLowerCase();
          if (k === "per")          result.per          = N(item.value);
          if (k === "pbr")          result.pbr          = N(item.value);
          if (k.includes("foreign")) result.foreignRatio = N(item.value);
        }
      }

      if (result.per && result.pbr) break; // 충분히 얻었으면 중단
    } catch { /* 다음 시도 */ }
  }
  return result;
}

// ── 네이버 Quote ─────────────────────────────────────────────
async function naverQuote(cd, sym) {
  // 3개 소스 병렬 호출
  const [rB, rC, rS] = await Promise.allSettled([
    fetch(`https://m.stock.naver.com/api/stock/${cd}/basic`, { headers: KR_HDR })
      .then(r => r.ok ? r.json() : {}),
    fetchFchart(cd, 280),        // 1년치 → 52주 고저 직접 계산
    fetchNaverSummary(cd),       // PER/PBR/시총 보완
  ]);

  const b    = rB.status === "fulfilled" ? (rB.value ?? {}) : {};
  const rows = rC.status === "fulfilled" ? (rC.value ?? []) : [];
  const sum  = rS.status === "fulfilled" ? (rS.value ?? {}) : {};
  const last = rows.at(-1) ?? null;

  // ── 현재가 / 등락 ─────────────────────────────────────────
  const price     = F(b, "closePrice", "stockEndPrice", "currentPrice") || (last?.close ?? 0);
  const change    = F(b, "compareToPreviousClosePrice");
  const changePct = F(b, "fluctuationsRatio");
  const name      = (b.stockName ?? b.itemName ?? b.corporateName ?? cd).trim();

  // ── 당일 시가/고가/저가 ───────────────────────────────────
  const open  = F(b, "openPrice")  || (last?.open  ?? 0);
  const high  = F(b, "highPrice")  || (last?.high  ?? 0);
  const low   = F(b, "lowPrice")   || (last?.low   ?? 0);

  // ── 거래량 ───────────────────────────────────────────────
  const volume = F(b, "accumulatedTradingVolume", "tradingVolume") || (last?.volume ?? 0);

  // ── 52주 고저: fchart 1년치에서 직접 계산 (항상 제공) ────
  let h52 = 0, l52 = 0;
  if (rows.length > 0) {
    const highs = rows.map(r => r.high).filter(v => v > 0);
    const lows  = rows.map(r => r.low ).filter(v => v > 0);
    if (highs.length) h52 = Math.max(...highs);
    if (lows.length)  l52 = Math.min(...lows);
  }
  // basic의 연고저가 더 정확하면 우선
  const bh = F(b, "yearlyHighPrice", "highPrice52Week");
  const bl = F(b, "yearlyLowPrice",  "lowPrice52Week");
  if (bh > 0) h52 = bh;
  if (bl > 0) l52 = bl;

  // ── 시가총액 ─────────────────────────────────────────────
  // basic.marketValue = 억원 단위 문자열
  let marketCap = 0;
  const mcRaw = F(b, "marketValue", "totalMarketValue");
  if (mcRaw > 0) marketCap = mcRaw * 1e8;           // 억원 → 원
  if (!marketCap && sum.marketCap > 0) marketCap = sum.marketCap;

  // ── PER / PBR / 외국인비율 ────────────────────────────────
  // basic 우선, 없으면 summary 보완
  const per = F(b, "per", "PER") || sum.per || 0;
  const pbr = F(b, "pbr", "PBR") || sum.pbr || 0;
  const eps = F(b, "eps", "EPS");
  const bps = F(b, "bps", "BPS");
  const foreignRatio = F(b, "foreignRatio") || sum.foreignRatio || 0;

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
      const r = await fetch(url, { headers: KR_HDR });
      if (!r.ok) continue;
      const data = await r.json();
      const arr  = Array.isArray(data) ? data : (data.candles ?? data.candleList ?? []);
      const hist = arr.flatMap(c => {
        const s = String(c.localDate ?? c.date ?? "");
        const dt = s.length === 8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : s;
        const cl = N(c.closePrice ?? c.close);
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

      // quotes 배열에서 당일 시가/고가/저가 보완
      const q0 = res.indicators?.quote?.[0] ?? {};
      const lastOpen  = (q0.open  ?? []).filter(v => v).at(-1) ?? 0;
      const lastHigh  = (q0.high  ?? []).filter(v => v).at(-1) ?? 0;
      const lastLow   = (q0.low   ?? []).filter(v => v).at(-1) ?? 0;

      return json({
        ok: true, symbol: sym,
        name: meta.longName ?? meta.shortName ?? sym,
        price,
        change:    Math.round(chg * 1e4) / 1e4,
        changePct: Math.round(pct * 1e4) / 1e4,
        open:   meta.regularMarketOpen    ?? lastOpen  ?? 0,
        high:   meta.regularMarketDayHigh ?? lastHigh  ?? 0,
        low:    meta.regularMarketDayLow  ?? lastLow   ?? 0,
        high52: meta.fiftyTwoWeekHigh     ?? 0,
        low52:  meta.fiftyTwoWeekLow      ?? 0,
        volume: meta.regularMarketVolume  ?? 0,
        marketCap: meta.marketCap         ?? 0,
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
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${rng}`,
        { headers: { "User-Agent": UA } }
      );
      if (!r.ok) continue;
      const d   = await r.json();
      const res = d.chart?.result?.[0];
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

// ── 다양한 투자 의견 생성 엔진 ───────────────────────────────
function autoAnalysis(prompt) {
  const get = (re, fb = "") => (prompt.match(re)?.[1] ?? fb);

  const nm       = get(/종목:\s*([^\(（\n]+)[\(（]/, "이 종목").trim();
  const currency = get(/통화:\s*([A-Z]+)/, "KRW");
  const mkt      = get(/시장:\s*([^\s|\n]+)/, "시장");
  const pct      = parseFloat(get(/등락:\s*([-\d.]+)%/, "0"));
  const pStr     = get(/현재가:\s*([^\s|\n]+)/, "0");
  const h52s     = get(/52주고가:\s*([^\s|\n]+)/, "N/A");
  const l52s     = get(/52주저가:\s*([^\s|\n]+)/, "N/A");
  const pers     = get(/PER:\s*([\d.N\/A]+)/, "N/A");
  const pbrs     = get(/PBR:\s*([\d.N\/A]+)/, "N/A");
  const caps     = get(/시가총액:\s*([^\s|\n]+)/, "");
  const volPct   = parseFloat(get(/변동성:\s*([\d.]+)%/, "3"));
  const trend    = get(/트렌드:\s*([^\s\n]+)/, "보합");
  const h52raw   = get(/52주고가raw:\s*([\d.]+)/, "0");
  const l52raw   = get(/52주저가raw:\s*([\d.]+)/, "0");
  const priceRaw = get(/현재가raw:\s*([\d.]+)/, "0");

  const isUSD = currency === "USD";
  const isKo  = mkt === "KOSPI" || mkt === "KOSDAQ";
  const pNum  = parseFloat(pStr.replace(/[^0-9.]/g, "")) || 0;
  const perNum = parseFloat(pers) || 0;
  const pbrNum = parseFloat(pbrs) || 0;

  // ── 52주 내 현재 위치 계산 (0~100%) ──────────────────────
  const h52n = parseFloat(h52raw) || 0;
  const l52n = parseFloat(l52raw) || 0;
  const pn   = parseFloat(priceRaw) || pNum;
  let pos52 = 50; // 기본값 중간
  if (h52n > 0 && l52n > 0 && h52n > l52n) {
    pos52 = Math.round(((pn - l52n) / (h52n - l52n)) * 100);
    pos52 = Math.max(0, Math.min(100, pos52));
  }

  // ── 종합 점수 기반 투자 의견 결정 ─────────────────────────
  // scoreBoard: +는 매수 신호, -는 매도/관망 신호
  let score = 0;
  const signals = [];

  // 1. 추세 (최대 ±30)
  if (trend === "상승") { score += 25; signals.push("상승 추세"); }
  else if (trend === "하락") { score -= 25; signals.push("하락 추세"); }

  // 2. 단기 등락률 (최대 ±20)
  if      (pct > 5)  { score += 20; signals.push("강한 상승 모멘텀"); }
  else if (pct > 2)  { score += 12; signals.push("상승 모멘텀"); }
  else if (pct > 0)  { score +=  5; signals.push("소폭 상승"); }
  else if (pct < -5) { score -= 20; signals.push("강한 하락 압력"); }
  else if (pct < -2) { score -= 12; signals.push("하락 압력"); }
  else if (pct < 0)  { score -=  5; signals.push("소폭 하락"); }

  // 3. 52주 위치 (최대 ±20)
  if      (pos52 >= 95) { score -= 20; signals.push("52주 신고가 근접 (과열)"); }
  else if (pos52 >= 80) { score -= 10; signals.push("52주 고점 부근"); }
  else if (pos52 >= 50) { score +=  5; signals.push("52주 중상단"); }
  else if (pos52 >= 30) { score += 10; signals.push("52주 중하단 (매수 기회)"); }
  else if (pos52 >= 10) { score += 15; signals.push("52주 저점 부근 (저가 메리트)"); }
  else                   { score += 20; signals.push("52주 신저가 근접 (바닥권 매수)"); }

  // 4. PER 밸류에이션 (있을 때만)
  if (perNum > 0) {
    if      (perNum > 80)  { score -= 20; signals.push("PER " + pers + "배 심각한 고평가"); }
    else if (perNum > 40)  { score -= 12; signals.push("PER " + pers + "배 고평가"); }
    else if (perNum > 20)  { score -=  5; signals.push("PER " + pers + "배 다소 고평가"); }
    else if (perNum > 10)  { score +=  5; signals.push("PER " + pers + "배 적정"); }
    else if (perNum > 0)   { score += 15; signals.push("PER " + pers + "배 저평가 매력"); }
  }

  // 5. 변동성 (리스크 조정)
  if      (volPct > 20) { score -= 15; signals.push("변동성 " + volPct.toFixed(1) + "% 매우 높음"); }
  else if (volPct > 10) { score -=  8; signals.push("변동성 " + volPct.toFixed(1) + "% 높음"); }
  else if (volPct > 5)  { score -=  3; signals.push("변동성 " + volPct.toFixed(1) + "% 보통"); }
  else                   { score +=  8; signals.push("변동성 " + volPct.toFixed(1) + "% 안정적"); }

  // ── 점수 → 투자 의견 결정 ─────────────────────────────────
  let verdict, vc;
  if      (score >= 40)  { verdict = "적극매수"; vc = "buy";   }
  else if (score >= 20)  { verdict = "매수";     vc = "buy";   }
  else if (score >= 5)   { verdict = "주목";     vc = "watch"; }
  else if (score >= -10) { verdict = "중립";     vc = "hold";  }
  else if (score >= -25) { verdict = "관망";     vc = "hold";  }
  else if (score >= -40) { verdict = "매도";     vc = "sell";  }
  else                   { verdict = "강력매도";  vc = "sell";  }

  // ── 리스크 점수 (변동성 + 52주 위치 + PER + 추세 종합) ────
  let rs = 30; // 기본 30 (낮음)
  rs += Math.min(30, volPct * 2);                    // 변동성 기여 최대 30
  rs += pos52 >= 80 ? 15 : pos52 >= 60 ? 8 : 0;     // 고점 리스크
  rs += trend === "하락" ? 15 : 0;                   // 하락 추세 리스크
  rs += perNum > 40 ? 10 : perNum > 20 ? 5 : 0;     // 고PER 리스크
  rs += pct < -3 ? 5 : 0;                            // 급락 리스크
  rs  = Math.min(95, Math.max(8, rs));
  const rl = rs < 30 ? "낮음" : rs < 55 ? "보통" : rs < 75 ? "높음" : "매우높음";

  // ── 가격 포맷 ─────────────────────────────────────────────
  const fmt = n => isUSD
    ? "$" + n.toFixed(n >= 100 ? 2 : 4)
    : Math.round(n).toLocaleString("ko-KR") + "원";

  // ── 목표가 계산 (의견별 차등) ─────────────────────────────
  // 매수 시나리오: 적극적 목표가 / 매도 시나리오: 보수적 목표가
  const isBuy  = vc === "buy";
  const isSell = vc === "sell";
  const buyDiscount  = isBuy  ? 0.96 : 0.97;   // 매수 구간
  const tgt1Mult     = isBuy  ? 1.08 : isSell ? 0.94 : 1.05;  // 단기목표
  const tgt2Mult     = isBuy  ? 1.18 : isSell ? 0.88 : 1.10;  // 중기목표
  const stopMult     = isBuy  ? 0.93 : isSell ? 1.05 : 0.95;  // 손절/청산
  const bullMult     = isBuy  ? 1.25 : isSell ? 0.92 : 1.12;
  const baseMult     = isBuy  ? 1.12 : isSell ? 0.96 : 1.06;
  const bearMult     = isBuy  ? 0.90 : isSell ? 0.82 : 0.92;

  const buy1 = pNum > 0 ? fmt(pNum * buyDiscount)      : "현재가 -4%";
  const buy2 = pNum > 0 ? fmt(pNum * (buyDiscount - 0.03)) : "현재가 -7%";
  const tgt1 = pNum > 0 ? fmt(pNum * tgt1Mult)         : isSell ? "현재가 -6%" : "현재가 +8%";
  const tgt2 = pNum > 0 ? fmt(pNum * tgt2Mult)         : isSell ? "현재가 -12%" : "현재가 +18%";
  const stop = pNum > 0 ? fmt(pNum * stopMult)         : isSell ? "현재가 +5%" : "현재가 -7%";
  const bull = pNum > 0 ? fmt(pNum * bullMult)         : "—";
  const base = pNum > 0 ? fmt(pNum * baseMult)         : "—";
  const bear = pNum > 0 ? fmt(pNum * bearMult)         : "—";
  const zone = pNum > 0 ? `${fmt(pNum * buyDiscount)} ~ ${fmt(pNum * (buyDiscount + 0.02))}` : "현재가 -4~-2%";

  // ── 의견 근거 문장 ────────────────────────────────────────
  const capTxt = caps && caps !== "N/A" && caps !== "—" ? `시가총액 ${caps} 규모의 ` : "";
  const perTxt = perNum > 0
    ? `PER ${pers}배${pbrNum > 0 ? ", PBR " + pbrs + "배" : ""}로 ${perNum > 40 ? "고평가 영역에 있어 주의가 필요합니다" : perNum > 20 ? "다소 높은 밸류에이션입니다" : "적정 밸류에이션 수준입니다"}. `
    : "";
  const pos52Txt = h52n > 0
    ? `현재 52주 고저가 대비 ${pos52}% 위치에 있으며${pos52 >= 85 ? " 과열권에 진입했습니다." : pos52 <= 20 ? " 극단적 저점권으로 반등 가능성이 있습니다." : "."} `
    : "";

  const reason = `${nm}은(는) 현재 ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% ${pct >= 0 ? "상승" : "하락"} 중이며, 최근 30일 추세는 ${trend} 흐름입니다. ` +
    (isKo
      ? `${capTxt}국내 ${mkt} 시장 종목으로, 외국인·기관 수급과 거시경제 영향을 받습니다. `
      : `${capTxt}글로벌 ${mkt} 시장 종목으로, 달러 환율과 매크로 지표에 주목해야 합니다. `) +
    perTxt + pos52Txt +
    `주요 판단 요인: ${signals.slice(0, 3).join(", ")}. ` +
    (isBuy
      ? `종합 점수 ${score}점으로 분할 매수 전략을 권고합니다.`
      : isSell
        ? `종합 점수 ${score}점으로 보유 비중 축소 또는 매도를 권고합니다.`
        : `종합 점수 ${score}점으로 추가 관찰 후 진입 여부를 결정하시기 바랍니다.`);

  // ── 리스크 항목 ───────────────────────────────────────────
  const risks = [];
  if (volPct > 10) risks.push(`변동성 ${volPct.toFixed(1)}%로 단기 급등락 위험 상존`);
  else risks.push("변동성 안정적이나 돌발 이벤트에 의한 급락 가능성 존재");
  if (isKo) risks.push("외국인·기관 수급 이탈 시 추가 하락 위험");
  else risks.push("달러 강세 및 금리 변동에 따른 밸류에이션 압박 가능");
  if (pos52 >= 85) risks.push(`52주 고가(${h52s}) 근접 — 차익 실현 매물 출회 가능`);
  else if (trend === "하락") risks.push(`하락 추세 지속 시 52주 저가(${l52s}) 이탈 위험`);
  else risks.push("단기 급등 시 차익 실현 매물로 조정 가능성");

  // ── 관전 포인트 ───────────────────────────────────────────
  const wp = [
    `52주 고가 ${h52s} 돌파 여부 — 돌파 시 강력한 추세 전환 신호`,
    `52주 저가 ${l52s} 지지 여부 — 이탈 시 손절 기준`,
    isKo ? "외국인·기관 순매수 전환 시점 확인" : "섹터 ETF 자금 유입 및 기관 포지션 변화",
    "거래량 20일 평균 대비 2배 이상 급증 시 방향성 확정 신호",
  ];

  return {
    ok: true, verdict, verdictReason: reason,
    score,  // 프론트에서 참고 가능
    buyStrategy: {
      zone: isSell ? "매도 권고 — 신규 매수 자제" : zone,
      timing: isBuy
        ? (trend === "상승" ? "눌림목 발생 시 분할 매수 진입" : "하락 안정화 + 거래량 회복 확인 후 진입")
        : isSell
          ? "반등 시마다 분할 매도, 보유 비중 단계적 축소"
          : "추가 관찰 후 방향 확인 시 진입",
      split: isSell
        ? [`1차 ${tgt1} 도달 시 50% 매도`, `2차 ${tgt2} 도달 시 전량 청산`]
        : [`1차 ${buy1} (자금의 40%)`, `2차 ${buy2} (자금의 60%)`],
    },
    sellStrategy: {
      shortTarget: tgt1,
      midTarget:   tgt2,
      stopLoss:    stop,
      exitSignal:  isSell
        ? `${tgt1} 이하 유지 시 매도 본격화, ${tgt2} 도달 시 전량 청산`
        : `${tgt1} 돌파+거래량 급증 시 1차 익절, ${tgt2} 도달 시 전량 청산`,
    },
    risks, riskLevel: rl, riskScore: rs,
    scenarios: {
      bull: { price: bull, desc: isBuy ? "수급 개선·실적 호조·섹터 모멘텀 시 달성" : "매크로 개선 시 반등 가능한 상단" },
      base: { price: base, desc: "현 추세 유지 시 예상 가격대" },
      bear: { price: bear, desc: isSell ? "매도 압력 지속 시 하락 목표가" : "매크로 악화 시 하방 위험" },
    },
    watchPoints: wp,
    summary: `${nm} ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% (52주 위치 ${pos52}%). ` +
      `종합점수 ${score}점 → ${verdict}. 단기 ${tgt1}, 손절 ${stop}.`,
  };
}

// ── 라우터 ───────────────────────────────────────────────────
export default {
  async fetch(req, env) {
    const url    = new URL(req.url);
    const path   = url.pathname;
    const method = req.method;

    if (method === "OPTIONS") return new Response(null, { headers: CORS });
    if (path === "/api/health") return json({ ok: true, v: 15, t: new Date().toISOString() });

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
