// StockMind _worker.js v16
// 수정사항:
//   [1] 모든 외부 fetch를 try/catch + timeout으로 보호 → 500 에러 원천 차단
//   [2] /finance/summary 실패해도 /basic 데이터만으로 정상 응답
//   [3] 검색 결과 없을 때 ok:true + results:[] (에러 아님)
//   [4] AI 의견 다양화 (52주 위치·PER·변동성·추세 종합 점수제)
//   [5] 모든 라우터 에러를 JSON으로 반환 (Cloudflare HTML 에러 차단)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function J(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

// 안전한 숫자 변환
function N(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(/,/g, "").replace(/\+/g, "").replace(/[원%]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

// hasOwnProperty 기반 필드 추출 (종목코드 오염 방지)
function F(obj, ...keys) {
  if (!obj || typeof obj !== "object") return 0;
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

// timeout 래퍼 (ms 초과 시 AbortError)
function withTimeout(promise, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return Promise.race([
    promise,
    new Promise((_, rej) => ctrl.signal.addEventListener("abort", () => rej(new Error("timeout")))),
  ]).finally(() => clearTimeout(timer));
}

// 안전한 fetch (에러 시 null 반환)
async function safeFetch(url, opts = {}) {
  try {
    const r = await withTimeout(fetch(url, opts), opts._timeout || 8000);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function isKR(sym) { return sym.endsWith(".KS") || sym.endsWith(".KQ"); }
function codeOf(sym) { return sym.slice(0, -3); }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const KR_HDR = { "User-Agent": UA, "Accept": "application/json,*/*", "Accept-Language": "ko-KR,ko;q=0.9", "Referer": "https://m.stock.naver.com/" };
const CH_HDR = { "User-Agent": UA, "Referer": "https://finance.naver.com/" };

// ── 네이버 종목 검색 (항상 ok:true 반환) ─────────────────────
async function searchNaver(q) {
  const d = await safeFetch(
    `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=index,stock,etf,fund,futures,option`,
    { headers: KR_HDR, _timeout: 5000 }
  );
  if (!d) return J({ ok: true, results: [] });

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
  return J({ ok: true, results });
}

// ── fchart XML 파싱 ───────────────────────────────────────────
async function fetchFchart(cd, count) {
  try {
    const r = await withTimeout(
      fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${cd}&timeframe=day&count=${count}&requestType=0`, { headers: CH_HDR }),
      7000
    );
    if (!r.ok) return [];
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
  } catch { return []; }
}

// ── 네이버 /finance/summary 보완 데이터 ───────────────────────
// 실패해도 기본값 반환 → 절대 500 안 냄
async function fetchNaverExtra(cd) {
  const result = { per: 0, pbr: 0, marketCap: 0, foreignRatio: 0 };

  // 여러 endpoint 시도 (첫 번째 성공 시 사용)
  const endpoints = [
    `https://m.stock.naver.com/api/stock/${cd}/finance/summary`,
    `https://m.stock.naver.com/api/stock/${cd}/invest`,
    `https://m.stock.naver.com/api/stock/${cd}/total`,
  ];

  for (const url of endpoints) {
    const d = await safeFetch(url, { headers: KR_HDR, _timeout: 5000 });
    if (!d) continue;

    // 다양한 구조 시도
    const candidates = [
      d.recentQuarter, d.financeSummary, d.investIndicator,
      d.stockInfo, d.totalInfoData, d
    ].filter(Boolean);

    for (const obj of candidates) {
      if (!result.per)          result.per          = F(obj, "per", "PER", "perRatio");
      if (!result.pbr)          result.pbr          = F(obj, "pbr", "PBR", "pbrRatio");
      if (!result.foreignRatio) result.foreignRatio = F(obj, "foreignRatio", "foreignOwnRatio");

      if (!result.marketCap) {
        const mc = F(obj, "marketCap", "marketValue", "totalMarketValue");
        if (mc > 0) result.marketCap = mc > 1e10 ? mc : mc * 1e8;
      }
    }

    // indicatorList 구조
    if (Array.isArray(d.indicatorList)) {
      for (const item of d.indicatorList) {
        const k = (item.key ?? "").toLowerCase();
        if (!result.per && k === "per")                    result.per = N(item.value);
        if (!result.pbr && k === "pbr")                    result.pbr = N(item.value);
        if (!result.foreignRatio && k.includes("foreign")) result.foreignRatio = N(item.value);
      }
    }

    if (result.per > 0 && result.pbr > 0) break; // 충분하면 중단
  }
  return result;
}

// ── 네이버 Quote ─────────────────────────────────────────────
async function naverQuote(cd, sym) {
  // 3개 소스 병렬 (모두 실패해도 ok:true 반환)
  const [rB, rC, rX] = await Promise.allSettled([
    safeFetch(`https://m.stock.naver.com/api/stock/${cd}/basic`, { headers: KR_HDR }),
    fetchFchart(cd, 280),
    fetchNaverExtra(cd),
  ]);

  const b    = (rB.status === "fulfilled" && rB.value) ? rB.value : {};
  const rows = (rC.status === "fulfilled" && Array.isArray(rC.value)) ? rC.value : [];
  const ex   = (rX.status === "fulfilled" && rX.value) ? rX.value : {};
  const last = rows.at(-1) ?? null;

  // 현재가 / 등락
  const price     = F(b, "closePrice", "stockEndPrice", "currentPrice") || (last?.close ?? 0);
  const change    = F(b, "compareToPreviousClosePrice");
  const changePct = F(b, "fluctuationsRatio");
  const name      = (b.stockName ?? b.itemName ?? b.corporateName ?? cd).trim() || cd;

  // 당일 시가/고가/저가
  const open  = F(b, "openPrice")  || (last?.open  ?? 0);
  const high  = F(b, "highPrice")  || (last?.high  ?? 0);
  const low   = F(b, "lowPrice")   || (last?.low   ?? 0);

  // 거래량
  const volume = F(b, "accumulatedTradingVolume", "tradingVolume") || (last?.volume ?? 0);

  // 52주 고저: fchart 1년치에서 max/min 계산 (항상 값 있음)
  let h52 = 0, l52 = 0;
  if (rows.length > 0) {
    const allH = rows.map(r => r.high).filter(v => v > 0);
    const allL = rows.map(r => r.low ).filter(v => v > 0);
    if (allH.length) h52 = Math.max(...allH);
    if (allL.length) l52 = Math.min(...allL);
  }
  // basic의 연고저가 있으면 우선 사용
  const bh = F(b, "yearlyHighPrice", "highPrice52Week");
  const bl = F(b, "yearlyLowPrice",  "lowPrice52Week");
  if (bh > 0) h52 = bh;
  if (bl > 0) l52 = bl;

  // 시가총액: marketValue = 억원 단위
  let marketCap = 0;
  const mcRaw = F(b, "marketValue", "totalMarketValue");
  if (mcRaw > 0) marketCap = mcRaw * 1e8;
  if (!marketCap && ex.marketCap > 0) marketCap = ex.marketCap;

  // PER / PBR / 외국인비율
  const per          = F(b, "per", "PER")          || ex.per          || 0;
  const pbr          = F(b, "pbr", "PBR")          || ex.pbr          || 0;
  const eps          = F(b, "eps", "EPS")           || 0;
  const bps          = F(b, "bps", "BPS")           || 0;
  const foreignRatio = F(b, "foreignRatio")         || ex.foreignRatio || 0;

  return J({
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
  // fchart 우선
  const rows = await fetchFchart(cd, days + 20);
  if (rows.length > 0) {
    return J({ ok: true, history: rows.slice(-days).map(r => ({ date: r.date, close: r.close })) });
  }

  // candle JSON 폴백
  for (const url of [
    `https://m.stock.naver.com/api/stock/${cd}/candle/day?count=${days + 20}`,
    `https://m.stock.naver.com/api/stock/${cd}/sise/day?count=${days + 20}`,
  ]) {
    const data = await safeFetch(url, { headers: KR_HDR });
    if (!data) continue;
    const arr  = Array.isArray(data) ? data : (data.candles ?? data.candleList ?? []);
    const hist = arr.flatMap(c => {
      const s  = String(c.localDate ?? c.date ?? "");
      const dt = s.length === 8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : s;
      const cl = N(c.closePrice ?? c.close);
      return (cl > 0 && dt) ? [{ date: dt, close: cl }] : [];
    }).sort((a, b) => a.date < b.date ? -1 : 1);
    if (hist.length > 0) return J({ ok: true, history: hist.slice(-days) });
  }

  return J({ ok: true, history: [] }); // 항상 ok:true
}

// ── Yahoo Quote ───────────────────────────────────────────────
async function yahooQuote(sym) {
  for (const host of ["query1", "query2"]) {
    const d = await safeFetch(
      `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`,
      { headers: { "User-Agent": UA }, _timeout: 8000 }
    );
    if (!d) continue;
    const res  = d.chart?.result?.[0];
    if (!res) continue;
    const meta = res.meta ?? {};
    const q0   = res.indicators?.quote?.[0] ?? {};

    const price = meta.regularMarketPrice ?? 0;
    const prev  = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const chg   = price - prev;
    const pct   = prev > 0 ? chg / prev * 100 : 0;

    // 당일 시가: meta 우선, 없으면 quote 배열 마지막값
    const openVal = meta.regularMarketOpen    ?? (q0.open  ?? []).filter(Boolean).at(-1) ?? 0;
    const highVal = meta.regularMarketDayHigh ?? (q0.high  ?? []).filter(Boolean).at(-1) ?? 0;
    const lowVal  = meta.regularMarketDayLow  ?? (q0.low   ?? []).filter(Boolean).at(-1) ?? 0;

    return J({
      ok: true, symbol: sym,
      name: meta.longName ?? meta.shortName ?? sym,
      price,
      change:    Math.round(chg * 1e4) / 1e4,
      changePct: Math.round(pct * 1e4) / 1e4,
      open: openVal, high: highVal, low: lowVal,
      high52: meta.fiftyTwoWeekHigh ?? 0,
      low52:  meta.fiftyTwoWeekLow  ?? 0,
      volume: meta.regularMarketVolume ?? 0,
      marketCap: meta.marketCap ?? 0,
      per: 0, pbr: 0, eps: 0, bps: 0, foreignRatio: 0,
      currency: meta.currency ?? "USD",
      exchange: meta.exchangeName ?? "US",
    });
  }
  // Yahoo도 실패 시 ok:false (유일하게 ok:false 가능한 케이스)
  return J({ ok: false, error: `${sym} 데이터를 가져올 수 없습니다` });
}

// ── Yahoo Chart ───────────────────────────────────────────────
async function yahooChart(sym, days) {
  const rng = days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
  for (const host of ["query1", "query2"]) {
    const d = await safeFetch(
      `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${rng}`,
      { headers: { "User-Agent": UA }, _timeout: 8000 }
    );
    if (!d) continue;
    const res    = d.chart?.result?.[0];
    if (!res) continue;
    const ts     = res.timestamp ?? [];
    const closes = res.indicators?.quote?.[0]?.close ?? [];
    const hist   = ts.flatMap((t, i) =>
      closes[i] > 0 ? [{ date: new Date(t * 1000).toISOString().slice(0, 10), close: closes[i] }] : []
    );
    return J({ ok: true, history: hist.slice(-days) });
  }
  return J({ ok: true, history: [] });
}

// ── AI 분석 ──────────────────────────────────────────────────
async function doAnalyze(prompt, env) {
  if (env.ANTHROPIC_API_KEY) {
    try {
      const r = await withTimeout(fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-opus-4-6", max_tokens: 2000,
          system: "전문 주식 애널리스트. 순수 JSON만 출력. 마크다운 없음.",
          messages: [{ role: "user", content: prompt }],
        }),
      }), 25000);
      if (r.ok) {
        const cd   = await r.json();
        const text = (cd.content?.[0]?.text ?? "{}").replace(/```json/gi, "").replace(/```/gi, "").trim();
        try { return J(JSON.parse(text)); } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) try { return J(JSON.parse(m[0])); } catch {}
        }
      }
    } catch {}
  }
  return J(autoAnalysis(prompt));
}

// ── 점수 기반 다양한 투자 의견 엔진 ─────────────────────────
function autoAnalysis(prompt) {
  const get = (re, fb = "") => (prompt.match(re)?.[1] ?? fb);

  const nm       = get(/종목:\s*([^\(（\n]+)[\(（]/, "이 종목").trim();
  const currency = get(/통화:\s*([A-Z]+)/, "KRW");
  const mkt      = get(/시장:\s*([^\s|\n]+)/, "시장");
  const pct      = parseFloat(get(/등락:\s*([-\d.]+)%/, "0"));
  const pStr     = get(/현재가:\s*([^\s|\n]+)/, "0");
  const h52s     = get(/52주고가:\s*([^\s|\n]+)/, "N/A");
  const l52s     = get(/52주저가:\s*([^\s|\n]+)/, "N/A");
  const pers     = get(/PER:\s*([\d.N\/A—]+)/, "N/A");
  const pbrs     = get(/PBR:\s*([\d.N\/A—]+)/, "N/A");
  const caps     = get(/시가총액:\s*([^\s|\n]+)/, "");
  const volPct   = parseFloat(get(/변동성:\s*([\d.]+)%/, "3"));
  const trend    = get(/트렌드:\s*([^\s\n]+)/, "보합");
  const h52raw   = parseFloat(get(/52주고가raw:\s*([\d.]+)/, "0"));
  const l52raw   = parseFloat(get(/52주저가raw:\s*([\d.]+)/, "0"));
  const priceRaw = parseFloat(get(/현재가raw:\s*([\d.]+)/, "0"));

  const isUSD   = currency === "USD";
  const isKo    = mkt === "KOSPI" || mkt === "KOSDAQ";
  const pNum    = parseFloat(pStr.replace(/[^0-9.]/g, "")) || priceRaw || 0;
  const perNum  = parseFloat(pers)  || 0;
  const pbrNum  = parseFloat(pbrs)  || 0;

  // ── 52주 내 현재 위치 (0~100%) ────────────────────────────
  let pos52 = 50;
  if (h52raw > 0 && l52raw > 0 && h52raw > l52raw && priceRaw > 0) {
    pos52 = Math.round(((priceRaw - l52raw) / (h52raw - l52raw)) * 100);
    pos52 = Math.max(0, Math.min(100, pos52));
  }

  // ── 5가지 요소 종합 점수 ─────────────────────────────────
  let score = 0;

  // 1. 추세 (±25)
  if      (trend === "상승") { score += 25; }
  else if (trend === "하락") { score -= 25; }

  // 2. 단기 등락률 (±20)
  if      (pct >  5) score += 20;
  else if (pct >  2) score += 12;
  else if (pct >  0) score +=  5;
  else if (pct < -5) score -= 20;
  else if (pct < -2) score -= 12;
  else               score -=  5;

  // 3. 52주 위치 (±20) — 고점은 매도 신호
  if      (pos52 >= 95) score -= 20;
  else if (pos52 >= 80) score -= 10;
  else if (pos52 >= 50) score +=  5;
  else if (pos52 >= 30) score += 10;
  else if (pos52 >= 10) score += 15;
  else                  score += 18;

  // 4. PER 밸류에이션 (±20, 데이터 있을 때만)
  if (perNum > 0) {
    if      (perNum > 80) score -= 20;
    else if (perNum > 40) score -= 12;
    else if (perNum > 20) score -=  5;
    else if (perNum > 10) score +=  5;
    else                  score += 15;
  }

  // 5. 변동성 (±8) — 낮을수록 매수 유리
  if      (volPct > 20) score -= 8;
  else if (volPct > 10) score -= 4;
  else if (volPct >  5) score -= 1;
  else                  score +=  8;

  // ── 점수 → 7단계 의견 ────────────────────────────────────
  let verdict, vc;
  if      (score >= 45)  { verdict = "적극매수"; vc = "sbuy";  }
  else if (score >= 22)  { verdict = "매수";     vc = "buy";   }
  else if (score >=  8)  { verdict = "주목";     vc = "watch"; }
  else if (score >= -8)  { verdict = "중립";     vc = "hold";  }
  else if (score >= -22) { verdict = "관망";     vc = "hold";  }
  else if (score >= -40) { verdict = "매도";     vc = "sell";  }
  else                   { verdict = "강력매도"; vc = "ssell"; }

  // ── 리스크 4단계 ─────────────────────────────────────────
  let rs = 28;
  rs += Math.min(32, volPct * 1.8);
  rs += pos52 >= 85 ? 15 : pos52 >= 65 ? 7 : 0;
  rs += trend === "하락" ? 12 : 0;
  rs += perNum > 50 ? 10 : perNum > 25 ? 4 : 0;
  rs += pct < -3 ? 5 : 0;
  rs  = Math.min(96, Math.max(6, rs));
  const rl = rs < 28 ? "낮음" : rs < 52 ? "보통" : rs < 74 ? "높음" : "매우높음";

  // ── 가격 포맷 ─────────────────────────────────────────────
  const fmt = n => isUSD ? "$" + n.toFixed(n >= 100 ? 2 : 4) : Math.round(n).toLocaleString("ko-KR") + "원";

  // ── 목표가 계산 ────────────────────────────────────────────
  const isBuy  = vc === "buy"  || vc === "sbuy";
  const isSell = vc === "sell" || vc === "ssell";

  const buyDsc = isBuy ? 0.96 : 0.98;
  const t1m    = isBuy ? 1.08 : isSell ? 0.94 : 1.05;
  const t2m    = isBuy ? 1.18 : isSell ? 0.86 : 1.10;
  const stpm   = isBuy ? 0.93 : isSell ? 1.06 : 0.95;
  const bullm  = isBuy ? 1.25 : isSell ? 0.90 : 1.12;
  const basem  = isBuy ? 1.12 : isSell ? 0.95 : 1.06;
  const bearm  = isBuy ? 0.88 : isSell ? 0.80 : 0.92;

  const p      = pNum;
  const buy1   = p > 0 ? fmt(p * buyDsc)       : "현재가 -4%";
  const buy2   = p > 0 ? fmt(p * (buyDsc-0.03)) : "현재가 -7%";
  const tgt1   = p > 0 ? fmt(p * t1m)           : isSell ? "현재가 -6%"  : "현재가 +8%";
  const tgt2   = p > 0 ? fmt(p * t2m)           : isSell ? "현재가 -14%" : "현재가 +18%";
  const stop   = p > 0 ? fmt(p * stpm)          : isSell ? "현재가 +6%"  : "현재가 -7%";
  const bull   = p > 0 ? fmt(p * bullm)         : "—";
  const base   = p > 0 ? fmt(p * basem)         : "—";
  const bear   = p > 0 ? fmt(p * bearm)         : "—";
  const zone   = p > 0 ? `${fmt(p * buyDsc)} ~ ${fmt(p * (buyDsc+0.02))}` : "현재가 -4~-2%";

  // ── 근거 문장 ─────────────────────────────────────────────
  const capTxt = caps && caps !== "N/A" && caps !== "—" ? `시가총액 ${caps} 규모의 ` : "";
  const perTxt = perNum > 0
    ? `PER ${pers}배${pbrNum > 0 ? ", PBR " + pbrs + "배" : ""}로 ${perNum > 50 ? "심각한 고평가 구간입니다. " : perNum > 20 ? "다소 높은 밸류에이션 수준입니다. " : "적정 밸류에이션 수준입니다. "}`
    : "";
  const pos52Txt = (h52raw > 0 && l52raw > 0)
    ? `현재 52주 가격대 내 ${pos52}% 위치에 있으며${pos52 >= 90 ? " 과열 구간으로 진입했습니다." : pos52 <= 15 ? " 극단적 저점 구간으로 반등 가능성이 있습니다." : "."} `
    : "";

  const signalWords = [];
  if (trend === "상승") signalWords.push("상승 추세");
  else if (trend === "하락") signalWords.push("하락 추세");
  if (pos52 >= 90) signalWords.push("52주 고점 과열");
  else if (pos52 <= 15) signalWords.push("52주 저점 매수 기회");
  if (perNum > 40) signalWords.push(`PER ${pers}배 고평가`);
  else if (perNum > 0 && perNum <= 10) signalWords.push(`PER ${pers}배 저평가`);
  if (volPct < 5) signalWords.push("변동성 안정");
  else if (volPct > 15) signalWords.push(`변동성 ${volPct.toFixed(0)}% 위험`);

  const reason =
    `${nm}은(는) 현재 ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% ${pct >= 0 ? "상승" : "하락"} 중이며, ` +
    `최근 30일 추세는 ${trend} 흐름입니다. ` +
    (isKo
      ? `${capTxt}국내 ${mkt} 시장 종목으로, 외국인·기관 수급 변화에 민감하게 반응합니다. `
      : `${capTxt}글로벌 ${mkt} 시장 종목으로, 달러 환율과 매크로 지표에 주목해야 합니다. `) +
    perTxt + pos52Txt +
    (signalWords.length ? `주요 시그널: ${signalWords.slice(0, 3).join(", ")}. ` : "") +
    (isBuy
      ? `종합 점수 ${score}점으로 분할 매수 전략을 권고합니다.`
      : isSell
        ? `종합 점수 ${score}점으로 보유 비중 축소 또는 매도를 권고합니다.`
        : `종합 점수 ${score}점으로 관망 후 추가 확인이 필요합니다.`);

  const risks = [
    volPct > 10 ? `변동성 ${volPct.toFixed(1)}%로 단기 급등락 위험 상존` : "변동성 안정적이나 돌발 이벤트 주의",
    isKo ? "외국인·기관 수급 이탈 시 추가 하락 위험" : "달러 강세·금리 변동에 따른 밸류에이션 압박",
    pos52 >= 85 ? `52주 고가(${h52s}) 근접 — 차익 실현 매물 출회 가능` : trend === "하락" ? `하락 추세 지속 시 52주 저가(${l52s}) 이탈 위험` : "단기 급등 시 차익 매물로 조정 가능성",
  ];

  return {
    ok: true, verdict, verdictReason: reason, score,
    buyStrategy: {
      zone: isSell ? "매도 권고 — 신규 매수 자제" : zone,
      timing: isBuy
        ? (trend === "상승" ? "눌림목 시 분할 매수" : "하락 안정화 + 거래량 회복 후 진입")
        : isSell ? "반등 시 분할 매도, 비중 단계적 축소"
        : "방향 확인 후 진입",
      split: isSell
        ? [`1차 ${tgt1} 도달 시 50% 매도`, `2차 ${tgt2} 도달 시 전량 청산`]
        : [`1차 ${buy1} (자금 40%)`, `2차 ${buy2} (자금 60%)`],
    },
    sellStrategy: {
      shortTarget: tgt1, midTarget: tgt2, stopLoss: stop,
      exitSignal: isSell
        ? `${tgt1} 이하 유지 시 매도 본격화, ${tgt2} 도달 시 전량 청산`
        : `${tgt1} 돌파+거래량 급증 시 1차 익절, ${tgt2} 도달 시 전량 청산`,
    },
    risks, riskLevel: rl, riskScore: rs,
    scenarios: {
      bull: { price: bull, desc: isBuy ? "수급 개선·실적 호조 시 달성 가능" : "외부 호재 시 반등 상단" },
      base: { price: base, desc: "현 추세 유지 시 예상 가격대" },
      bear: { price: bear, desc: isSell ? "매도 압력 지속 시 하락 목표가" : "매크로 악화 시 하방 위험" },
    },
    watchPoints: [
      `52주 고가 ${h52s} 돌파 여부 — 돌파 시 강력한 상승 신호`,
      `52주 저가 ${l52s} 지지 여부 — 이탈 시 손절 기준`,
      isKo ? "외국인·기관 순매수 전환 확인" : "섹터 ETF 자금 유입 및 기관 포지션 변화",
      "거래량 20일 평균 2배 이상 급증 시 방향성 확정 신호",
    ],
    summary: `${nm} ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% (52주 위치 ${pos52}%). ` +
      `종합 ${score}점 → ${verdict}. 단기 ${tgt1}, 손절 ${stop}.`,
  };
}

// ── 라우터 ───────────────────────────────────────────────────
export default {
  async fetch(req, env) {
    // 모든 요청을 try/catch로 감싸서 절대 500 HTML 에러 안 냄
    try {
      const url    = new URL(req.url);
      const path   = url.pathname;
      const method = req.method;

      if (method === "OPTIONS") return new Response(null, { headers: CORS });

      if (path === "/api/health") return J({ ok: true, v: 16, t: new Date().toISOString() });

      if (path === "/api/search" && method === "GET") {
        const q = (url.searchParams.get("q") ?? "").trim();
        if (!q) return J({ ok: true, results: [] }); // 에러 대신 빈 결과
        return await searchNaver(q);
      }

      if (path === "/api/stock" && method === "GET") {
        const action = (url.searchParams.get("action") ?? "").toLowerCase().trim();
        const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase().trim();
        const days   = Math.min(365, Math.max(7, parseInt(url.searchParams.get("days") ?? "30", 10)));

        if (!symbol) return J({ ok: false, error: "symbol 파라미터가 필요합니다" });
        if (!action) return J({ ok: false, error: "action 파라미터가 필요합니다" });

        if (action === "quote") {
          return isKR(symbol)
            ? await naverQuote(codeOf(symbol), symbol)
            : await yahooQuote(symbol);
        }
        if (action === "chart") {
          return isKR(symbol)
            ? await naverChart(codeOf(symbol), days)
            : await yahooChart(symbol, days);
        }
        return J({ ok: false, error: `알 수 없는 action: ${action}` });
      }

      if (path === "/api/analyze" && method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (!body?.prompt) return J({ ok: false, error: "prompt가 필요합니다" });
        return await doAnalyze(body.prompt, env);
      }

      // 그 외 요청은 정적 파일
      return env.ASSETS.fetch(req);

    } catch (e) {
      // 최종 안전망: 어떤 에러든 JSON으로 반환
      return J({ ok: false, error: e?.message ?? "서버 오류" }, 500);
    }
  },
};
