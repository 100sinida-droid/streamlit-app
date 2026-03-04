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

// ── 네이버 자동완성 (국내 주식) ─────────────────────────────
async function searchKR(q) {
  const d = await safeFetch(
    `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=index,stock,etf,fund,futures,option`,
    { headers: KR_HDR, _timeout: 5000 }
  );
  if (!d) return [];
  const items = Array.isArray(d.items) ? d.items : (d.result?.items ?? []);
  const out = [];
  for (const it of items.slice(0, 10)) {
    const rc = String(Array.isArray(it) ? it[0] : (it.code ?? it.symbolCode ?? ""));
    const nm = String(Array.isArray(it) ? it[1] : (it.name ?? it.stockName ?? ""));
    const mt = String(Array.isArray(it) ? it[2] : (it.typeCode ?? ""));
    if (!rc || !nm || !/^\d{6}$/.test(rc)) continue;
    const isKQ = mt === "2" || mt === "NQ" || mt.includes("KOSDAQ");
    out.push({ symbol: rc + (isKQ ? ".KQ" : ".KS"), code: rc, name: nm, market: isKQ ? "KOSDAQ" : "KOSPI" });
  }
  return out;
}

// ── Yahoo Finance 검색 (미국 주식/ETF) ───────────────────────
async function searchUS(q) {
  const HDR = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com/",
  };

  // Yahoo 결과 파서
  function parseQ(arr) {
    const out = [];
    for (const qt of (arr ?? [])) {
      const sym  = String(qt.symbol ?? qt.Symbol ?? "").trim().toUpperCase();
      const nm   = String(qt.longname ?? qt.shortname ?? qt.name ?? sym).trim();
      const type = String(qt.quoteType ?? "EQUITY").toUpperCase();
      const exch = String(qt.exchange ?? qt.exch ?? "").toUpperCase();
      if (!sym || sym.length > 8 || /^\d{6}$/.test(sym)) continue;
      if (!["EQUITY","ETF","MUTUALFUND","STOCK"].includes(type)) continue;
      const mkt = ["NMS","NGM","NCM"].includes(exch) ? "NASDAQ"
                : ["NYQ","ASE","PCX"].includes(exch) ? "NYSE"
                : ["PNK","OTC","OTCBB","PINK"].includes(exch) ? "OTC"
                : type === "ETF" ? "ETF" : "US";
      out.push({ symbol: sym, code: sym, name: nm, market: mkt });
    }
    return out;
  }

  // [1단계] v6/autocomplete
  for (const host of ["query2", "query1"]) {
    const d = await safeFetch(
      `https://${host}.finance.yahoo.com/v6/finance/autocomplete?query=${encodeURIComponent(q)}&lang=en`,
      { headers: HDR, _timeout: 5000 }
    );
    const items = d?.ResultSet?.Result ?? [];
    if (items.length > 0) {
      const mapped = items.map(it => ({
        symbol: it.symbol, longname: it.name,
        quoteType: it.type ?? "EQUITY", exchange: it.exch ?? "",
      }));
      const out = parseQ(mapped);
      if (out.length > 0) return out;
    }
  }

  // [2단계] v1/finance/search
  for (const host of ["query1", "query2"]) {
    const d = await safeFetch(
      `https://${host}.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&enableFuzzyQuery=true`,
      { headers: HDR, _timeout: 7000 }
    );
    const out = parseQ(d?.quotes);
    if (out.length > 0) return out;
  }

  // [3단계] 회사명에서 티커 후보 생성 → v8/chart 직접 검증
  const STOPWORDS = new Set(["INC","CORP","LTD","LLC","CO","THE","AND","OF","GROUP",
    "HOLDINGS","TECHNOLOGIES","COMPUTING","THERAPEUTICS","SCIENCES","SYSTEMS",
    "SOLUTIONS","INTERNATIONAL","GLOBAL","PHARMA","BIO","BIOTECH"]);
  const words = q.trim().toUpperCase()
    .replace(/[,.()\[\]&+]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOPWORDS.has(w));

  const cands = new Set();
  if (words.length > 0) {
    const w0 = words[0];
    for (let l = 2; l <= Math.min(5, w0.length); l++) cands.add(w0.slice(0, l));
    const initials = words.slice(0, 4).map(w => w[0]).join("");
    if (initials.length >= 2 && initials.length <= 5) cands.add(initials);
    for (const w of words) {
      if (w.length >= 2 && w.length <= 5) cands.add(w);
    }
  }

  const tickerList = [...cands].filter(t => /^[A-Z]{2,5}$/.test(t)).slice(0, 8);
  const checked = await Promise.allSettled(
    tickerList.map(ticker =>
      safeFetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
        { headers: HDR, _timeout: 5000 }
      ).then(d => {
        const meta = d?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return null;
        const exch = String(meta.exchangeName ?? "").toUpperCase();
        const mkt = ["NMS","NGM","NCM"].includes(exch) ? "NASDAQ"
                  : ["NYQ","NYSE","ASE","PCX"].includes(exch) ? "NYSE"
                  : ["PNK","OTC"].includes(exch) ? "OTC" : "US";
        return { symbol: ticker, code: ticker, name: meta.longName ?? meta.shortName ?? ticker, market: mkt };
      })
    )
  );
  return checked.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
}

// ── 통합 검색 (KR + US 병행) ─────────────────────────────────
async function searchAll(q) {
  const lq = q.trim();
  // 숫자만 → 국내 종목코드
  if (/^\d+$/.test(lq)) {
    return J({ ok: true, results: await searchKR(lq) });
  }
  // 알파벳 포함 (영문 회사명·티커 모두) → US 우선 + KR 병행
  if (/[A-Za-z]/.test(lq)) {
    const [krRes, usRes] = await Promise.allSettled([searchKR(lq), searchUS(lq)]);
    const kr = krRes.status === "fulfilled" ? krRes.value : [];
    const us = usRes.status === "fulfilled" ? usRes.value : [];
    // US 결과 앞에, KR 뒤에 (중복 제거)
    const seen = new Set();
    const merged = [];
    for (const r of [...us, ...kr]) {
      if (!seen.has(r.symbol)) { seen.add(r.symbol); merged.push(r); }
    }
    return J({ ok: true, results: merged.slice(0, 12) });
  }
  // 한국어 → 네이버만
  return J({ ok: true, results: await searchKR(lq) });
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


// ── 네이버 polling API (PER/PBR/시총/외국인비율 핵심 소스) ────
async function fetchPolling(cd) {
  const d = await safeFetch(
    'https://polling.finance.naver.com/api/realtime/domestic/stock/' + cd,
    { headers: KR_HDR, _timeout: 6000 }
  );
  if (!d) return {};
  const raw = Array.isArray(d.datas) ? (d.datas[0] ?? {}) : (d.datas ?? d.data ?? d);
  return raw;
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
  // 4개 소스 병렬 (모두 실패해도 ok:true 반환)
  const [rB, rC, rP, rX] = await Promise.allSettled([
    safeFetch(`https://m.stock.naver.com/api/stock/${cd}/basic`, { headers: KR_HDR }),
    fetchFchart(cd, 280),
    fetchPolling(cd),          // polling: PER/PBR/시총/외국인비율 핵심
    fetchNaverExtra(cd),
  ]);

  const b    = (rB.status === "fulfilled" && rB.value) ? rB.value : {};
  const rows = (rC.status === "fulfilled" && Array.isArray(rC.value)) ? rC.value : [];
  const p    = (rP.status === "fulfilled" && rP.value) ? rP.value : {};  // polling
  const ex   = (rX.status === "fulfilled" && rX.value) ? rX.value : {};
  const last = rows.at(-1) ?? null;

  // 현재가 / 등락 (basic 우선, polling 보완)
  const price     = F(b, "closePrice", "stockEndPrice", "currentPrice") || N(p.closePrice) || (last?.close ?? 0);
  const change    = F(b, "compareToPreviousClosePrice") || N(p.compareToPreviousPrice) || 0;
  const changePct = F(b, "fluctuationsRatio")           || N(p.fluctuationsRatio)       || 0;
  const name      = (b.stockName ?? b.itemName ?? b.corporateName ?? p.stockName ?? cd).trim() || cd;

  // 당일 시가/고가/저가
  const open  = F(b, "openPrice")  || N(p.openPrice)  || (last?.open  ?? 0);
  const high  = F(b, "highPrice")  || N(p.highPrice)  || (last?.high  ?? 0);
  const low   = F(b, "lowPrice")   || N(p.lowPrice)   || (last?.low   ?? 0);

  // 거래량
  const volume = F(b, "accumulatedTradingVolume", "tradingVolume") || N(p.accumulatedTradingVolume) || (last?.volume ?? 0);

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

  // 시가총액: basic.marketValue(억원) → polling → extra 순서
  let marketCap = 0;
  const mcRaw = F(b, "marketValue", "totalMarketValue");
  if (mcRaw > 0) marketCap = mcRaw * 1e8;  // 억원 → 원

  if (!marketCap) {
    // polling에서 marketCap 시도 (단위 불명확 → 크기로 판단)
    const mcPraw = p.marketCap ?? p.marketValue ?? "";
    if (mcPraw) {
      const mcP = N(String(mcPraw));
      if (mcP > 0) marketCap = mcP > 1e10 ? mcP : mcP * 1e8;
    }
  }
  if (!marketCap && ex.marketCap > 0) marketCap = ex.marketCap;

  // PER / PBR / 외국인비율
  const per          = F(b, "per", "PER")          || N(p.per)  || ex.per  || 0;
  const pbr          = F(b, "pbr", "PBR")          || N(p.pbr)  || ex.pbr  || 0;
  const eps          = F(b, "eps", "EPS")           || 0;
  const bps          = F(b, "bps", "BPS")           || 0;
  const foreignRatio = F(b, "foreignRatio") || N(p.frgn ?? p.foreignRatio ?? p.frgnRatio ?? 0) || ex.foreignRatio || 0;

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
// [소스 1] v7/finance/quote  : 프리마켓·정규장·애프터마켓 실시간가격 + 핵심 펀더멘털
// [소스 2] v11/quoteSummary  : PBR, ROE, 상세 배당 등 보완
// 병렬 호출 → 통합 → marketState 기준으로 표시 가격 선택
async function yahooQuote(sym) {
  // ── 헤더: 브라우저 완전 모방 (datacenter IP 차단 우회 시도) ──
  const YHD = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://finance.yahoo.com/quote/" + sym,
    "Origin": "https://finance.yahoo.com",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Cache-Control": "no-cache",
  };

  // ── [소스 1] Yahoo v8/chart (가장 안정적, PER 없음) ──────
  async function tryYahooChart() {
    for (const host of ["query1", "query2"]) {
      const d = await safeFetch(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}` +
        `?interval=1d&range=1d&includePrePost=true`,
        { headers: YHD, _timeout: 8000 }
      );
      const res = d?.chart?.result?.[0];
      if (res?.meta?.regularMarketPrice) return res;
    }
    return null;
  }

  // ── [소스 2] Yahoo v7/quote (프리/정규/애프터 + PER) ─────
  async function tryYahooV7() {
    const fields = [
      "regularMarketPrice","regularMarketChange","regularMarketChangePercent",
      "regularMarketPreviousClose","regularMarketOpen","regularMarketDayHigh",
      "regularMarketDayLow","regularMarketVolume","preMarketPrice","preMarketChange",
      "preMarketChangePercent","postMarketPrice","postMarketChange","postMarketChangePercent",
      "marketState","fiftyTwoWeekHigh","fiftyTwoWeekLow","marketCap",
      "trailingPE","forwardPE","epsTrailingTwelveMonths","priceToBook",
      "trailingAnnualDividendYield","longName","shortName","exchangeName","currency",
    ].join(",");
    for (const host of ["query1", "query2"]) {
      const d = await safeFetch(
        `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}&fields=${fields}`,
        { headers: YHD, _timeout: 8000 }
      );
      const qt = d?.quoteResponse?.result?.[0];
      if (qt?.regularMarketPrice) return qt;
    }
    return null;
  }

  // ── [소스 3] stooq.com (Yahoo 완전 차단 시 폴백) ─────────
  // stooq는 미국 주식을 SYM.US 형식으로 조회
  // 응답: {"symbols":[{"Symbol":"IBM","Date":"...","Open":...,"High":...,"Low":...,"Close":...,"Volume":...}]}
  async function tryStooq() {
    const stooqSym = sym.includes(".") ? sym : sym + ".US";
    const d = await safeFetch(
      `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcv&h&e=json`,
      { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }, _timeout: 8000 }
    );
    const row = d?.symbols?.[0];
    if (!row || !row.Close || row.Close === 0) return null;
    return row;
  }

  // ── 병렬 호출: v8 chart + v7 quote ──────────────────────
  const [chartRes, v7Res] = await Promise.allSettled([tryYahooChart(), tryYahooV7()]);
  const chart = chartRes.status === "fulfilled" ? chartRes.value : null;
  const v7    = v7Res.status   === "fulfilled" ? v7Res.value   : null;

  // ── Yahoo 완전 차단 시 stooq 폴백 ────────────────────────
  if (!chart && !v7) {
    const stooq = await tryStooq();
    if (!stooq) return J({ ok: false, error: `${sym} 데이터를 가져올 수 없습니다. 티커를 확인해 주세요.` });

    const prev  = stooq.Open || stooq.Close;
    const price = stooq.Close;
    const chg   = price - prev;
    const pct   = prev > 0 ? chg / prev * 100 : 0;
    return J({
      ok: true, symbol: sym,
      name: stooq.Symbol ?? sym,
      price, change: Math.round(chg * 1e4)/1e4, changePct: Math.round(pct * 1e4)/1e4,
      open: stooq.Open ?? 0, high: stooq.High ?? 0, low: stooq.Low ?? 0,
      high52: 0, low52: 0, volume: stooq.Volume ?? 0, marketCap: 0,
      per: 0, fwdPer: 0, pbr: 0, eps: 0, roe: 0, divYield: 0,
      bps: 0, foreignRatio: 0,
      currency: "USD", exchange: "US",
      marketState: "CLOSED", prevClose: prev,
      regularPrice: price, regularChange: chg, regularChangePct: pct,
      preMarketPrice: 0, postMarketPrice: 0,
      _src: "stooq",
    });
  }

  // ── nz 헬퍼 ─────────────────────────────────────────────
  const nz = v => (typeof v === "number" && Number.isFinite(v) && v !== 0) ? v : 0;
  const yv = obj => {
    if (!obj) return 0;
    if (typeof obj === "number") return Number.isFinite(obj) ? obj : 0;
    const r = obj?.raw;
    if (r !== undefined && r !== null) { const n = parseFloat(r); return Number.isFinite(n) ? n : 0; }
    return 0;
  };

  // ── 가격 데이터: v7 우선 → v8 meta 보완 ──────────────────
  const meta = chart?.meta ?? {};
  const q0   = chart?.indicators?.quote?.[0] ?? {};
  const last  = n => (Array.isArray(n) ? n : []).filter(x => x != null && x > 0).at(-1) ?? 0;

  // v7가 있으면 v7 우선 (프리/정규/애프터 정확)
  // v7 없으면 v8 chart meta 사용
  const qt = v7 ?? {};

  // ── 장 상태 ─────────────────────────────────────────────
  const marketState = String(qt.marketState ?? meta.marketState ?? "CLOSED").toUpperCase();
  const isPre  = marketState === "PRE"  || marketState === "PREPRE";
  const isPost = marketState === "POST" || marketState === "POSTPOST";

  // ── 현재가 (장 상태 기반 선택) ───────────────────────────
  const regularPrice  = nz(qt.regularMarketPrice)  || nz(meta.regularMarketPrice) || 0;
  const prevClose     = nz(qt.regularMarketPreviousClose) || nz(meta.chartPreviousClose) || regularPrice;
  const regularChg    = nz(qt.regularMarketChange)  || (regularPrice - prevClose);
  const regularChgPct = nz(qt.regularMarketChangePercent) ||
                        (prevClose > 0 ? regularChg / prevClose * 100 : 0);

  let displayPrice, displayChg, displayChgPct, displayLabel;
  if (isPre && nz(qt.preMarketPrice)) {
    displayPrice  = qt.preMarketPrice;
    displayChg    = nz(qt.preMarketChange) || (displayPrice - prevClose);
    displayChgPct = nz(qt.preMarketChangePercent) || (prevClose > 0 ? (displayPrice-prevClose)/prevClose*100 : 0);
    displayLabel  = "PRE";
  } else if (isPost && nz(qt.postMarketPrice)) {
    displayPrice  = qt.postMarketPrice;
    displayChg    = nz(qt.postMarketChange) || (displayPrice - prevClose);
    displayChgPct = nz(qt.postMarketChangePercent) || (prevClose > 0 ? (displayPrice-prevClose)/prevClose*100 : 0);
    displayLabel  = "POST";
  } else {
    displayPrice  = regularPrice;
    displayChg    = regularChg;
    displayChgPct = regularChgPct;
    displayLabel  = marketState === "REGULAR" ? "LIVE" : "CLOSED";
  }

  // ── OHLCV ────────────────────────────────────────────────
  const openV = nz(qt.regularMarketOpen)    || nz(meta.regularMarketOpen)    || last(q0.open);
  const highV = nz(qt.regularMarketDayHigh) || nz(meta.regularMarketDayHigh) || last(q0.high);
  const lowV  = nz(qt.regularMarketDayLow)  || nz(meta.regularMarketDayLow)  || last(q0.low);
  const volV  = nz(qt.regularMarketVolume)  || nz(meta.regularMarketVolume)  || last(q0.volume);

  // ── 52주 고저 ────────────────────────────────────────────
  const h52 = nz(qt.fiftyTwoWeekHigh) || nz(meta.fiftyTwoWeekHigh) || 0;
  const l52 = nz(qt.fiftyTwoWeekLow)  || nz(meta.fiftyTwoWeekLow)  || 0;

  // ── 펀더멘털 (v7 있을 때만) ───────────────────────────────
  const per    = nz(qt.trailingPE)                   || 0;
  const fwdPer = nz(qt.forwardPE)                    || 0;
  const pbr    = nz(qt.priceToBook)                  || 0;
  const eps    = nz(qt.epsTrailingTwelveMonths)       || 0;
  const mcap   = nz(qt.marketCap)   || nz(meta.marketCap) || 0;
  const divRaw = nz(qt.trailingAnnualDividendYield)   || 0;
  const divYield = divRaw > 0 ? Math.round(divRaw * 10000) / 100 : 0;

  const name = String(qt.longName ?? qt.shortName ?? meta.longName ?? meta.shortName ?? sym);
  const exch = String(qt.exchangeName ?? meta.exchangeName ?? "US");
  const currency = String(qt.currency ?? meta.currency ?? "USD");

  return J({
    ok: true, symbol: sym, name,
    price:      Math.round(displayPrice  * 1e4) / 1e4,
    change:     Math.round(displayChg    * 1e4) / 1e4,
    changePct:  Math.round(displayChgPct * 1e4) / 1e4,
    marketState: displayLabel,
    regularPrice:     Math.round(regularPrice   * 1e4) / 1e4,
    regularChange:    Math.round(regularChg     * 1e4) / 1e4,
    regularChangePct: Math.round(regularChgPct  * 1e4) / 1e4,
    prevClose,
    preMarketPrice:  nz(qt.preMarketPrice)  || 0,
    postMarketPrice: nz(qt.postMarketPrice) || 0,
    open: openV, high: highV, low: lowV, volume: volV,
    high52: h52, low52: l52,
    marketCap: mcap,
    per, fwdPer, pbr, eps, roe: 0, divYield,
    bps: 0, foreignRatio: 0,
    currency, exchange: exch,
    _src: v7 ? "yahoo_v7" : "yahoo_v8",
  });
}

// ── Yahoo Chart ───────────────────────────────────────────────
async function yahooChart(sym, days) {
  const rng = days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
  const YHD = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://finance.yahoo.com/",
  };

  // [1] Yahoo v8 chart
  for (const host of ["query1", "query2"]) {
    const d = await safeFetch(
      `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${rng}`,
      { headers: YHD, _timeout: 8000 }
    );
    const res = d?.chart?.result?.[0];
    if (res) {
      const ts     = res.timestamp ?? [];
      const closes = res.indicators?.quote?.[0]?.close ?? [];
      const hist   = ts.flatMap((t, i) =>
        closes[i] > 0 ? [{ date: new Date(t * 1000).toISOString().slice(0, 10), close: closes[i] }] : []
      );
      if (hist.length > 0) return J({ ok: true, history: hist.slice(-days) });
    }
  }

  // [2] stooq.com CSV 폴백
  try {
    const stooqSym = sym.includes(".") ? sym : sym + ".US";
    const r = await withTimeout(
      fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=d`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      }), 8000
    );
    if (r.ok) {
      const csv = await r.text();
      const lines = csv.trim().split("\n").slice(1); // 헤더 제거
      const hist = lines.flatMap(line => {
        const cols = line.split(",");
        // Date,Open,High,Low,Close,Volume
        if (cols.length < 5) return [];
        const dt   = (cols[0] ?? "").trim();
        const cl   = parseFloat(cols[4]);
        return (dt && cl > 0) ? [{ date: dt, close: cl }] : [];
      }).sort((a, b) => a.date < b.date ? -1 : 1);
      if (hist.length > 0) return J({ ok: true, history: hist.slice(-days) });
    }
  } catch {}

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



// ══════════════════════════════════════════════════════════════
// 뉴스 수집 + 감성분석 + 주가 예측 엔진
// ══════════════════════════════════════════════════════════════

// ── 차등 가중치 감성 사전 ──────────────────────────────────────
// [가중치, 키워드] 형식 — 이벤트 임팩트에 따라 가중치 차별화
const POS_KW_W = [
  // ★★★ 강한 긍정 (+28)
  [28,"급등"],[28,"신고가"],[28,"52주신고가"],[28,"역대최고"],[28,"사상최고"],
  [28,"어닝서프라이즈"],[28,"깜짝실적"],[28,"대규모수주"],[28,"폭등"],
  // ★★ 중강 긍정 (+18)
  [18,"목표가상향"],[18,"목표주가상향"],[18,"투자의견상향"],[18,"비중확대"],
  [18,"매수추천"],[18,"아웃퍼폼"],[18,"호실적"],[18,"실적개선"],[18,"예상상회"],
  [18,"어닝비트"],[18,"컨센서스상회"],[18,"턴어라운드"],[18,"깜짝흑자"],
  [18,"자사주매입"],[18,"자사주소각"],[18,"배당증가"],[18,"배당확대"],[18,"주주환원"],
  [18,"대규모계약"],[18,"수주성공"],[18,"임상성공"],[18,"FDA승인"],
  // ★ 일반 긍정 (+12)
  [12,"상승"],[12,"호재"],[12,"흑자"],[12,"증가"],[12,"성장"],[12,"돌파"],[12,"강세"],
  [12,"반등"],[12,"회복"],[12,"개선"],[12,"증익"],[12,"상향"],[12,"확대"],[12,"호조"],
  [12,"수주"],[12,"계약"],[12,"인수"],[12,"협력"],[12,"출시"],[12,"신제품"],[12,"허가"],
  [12,"승인"],[12,"매수"],[12,"긍정"],[12,"투자유치"],[12,"파트너십"],[12,"공동개발"],
  [12,"MOU"],[12,"기술이전"],[12,"상장"],[12,"공모"],[12,"IPO"],[12,"증설"],[12,"수혜"],
  // ◎ 약한 긍정 (+6)
  [6,"기대"],[6,"관심"],[6,"주목"],[6,"모멘텀"],[6,"저평가"],[6,"호평"],[6,"양호"],
];
const NEG_KW_W = [
  // ★★★ 강한 부정 (-28)
  [-28,"급락"],[-28,"폭락"],[-28,"신저가"],[-28,"52주신저가"],[-28,"상장폐지"],
  [-28,"파산"],[-28,"부도"],[-28,"횡령"],[-28,"배임"],[-28,"분식회계"],
  [-28,"어닝쇼크"],[-28,"어닝미스"],[-28,"대규모손실"],[-28,"충격실적"],
  // ★★ 중강 부정 (-18)
  [-18,"목표가하향"],[-18,"목표주가하향"],[-18,"투자의견하향"],[-18,"비중축소"],
  [-18,"언더퍼폼"],[-18,"매도의견"],[-18,"실적부진"],[-18,"예상하회"],
  [-18,"컨센서스하회"],[-18,"적자전환"],[-18,"영업손실"],[-18,"대규모적자"],
  [-18,"감원"],[-18,"구조조정"],[-18,"해고"],[-18,"영업정지"],[-18,"과징금"],
  [-18,"검찰수사"],[-18,"금감원"],[-18,"불공정거래"],[-18,"임상실패"],[-18,"허가취소"],
  // ★ 일반 부정 (-12)
  [-12,"하락"],[-12,"악재"],[-12,"하향"],[-12,"적자"],[-12,"감소"],[-12,"부진"],
  [-12,"약세"],[-12,"손실"],[-12,"취소"],[-12,"소송"],[-12,"조사"],[-12,"벌금"],
  [-12,"리콜"],[-12,"부채"],[-12,"위기"],[-12,"규제"],[-12,"제재"],[-12,"매각"],
  [-12,"이탈"],[-12,"악화"],[-12,"감익"],[-12,"매도"],[-12,"우려"],[-12,"리스크"],
  // ◎ 약한 부정 (-6)
  [-6,"부정"],[-6,"위험"],[-6,"불확실"],[-6,"논란"],[-6,"갈등"],[-6,"지연"],[-6,"압박"],
];
// 중립화 — 양방향 상쇄 시 0점 처리
const NEUTRAL_KW = ["보합","혼조","관망","횡보","제자리","소폭변동"];

function scoreSentiment(title) {
  const t = title.toLowerCase();
  for (const w of NEUTRAL_KW) if (t.includes(w)) return 0;
  let score = 0;
  for (const [w, kw] of POS_KW_W) if (t.includes(kw.toLowerCase())) score += w;
  for (const [w, kw] of NEG_KW_W) if (t.includes(kw.toLowerCase())) score += w; // w가 음수
  // 목표가 화살표 보너스: "85,000원→100,000원" 패턴
  const arr = title.match(/([\d,]+)원?\s*[→↑]\s*([\d,]+)원/);
  if (arr) {
    const fr = parseInt(arr[1].replace(/,/g,'')), to = parseInt(arr[2].replace(/,/g,''));
    if (fr>0 && to>fr) score += 15;
  }
  const arr2 = title.match(/([\d,]+)원?\s*[↓]\s*([\d,]+)원/);
  if (arr2) {
    const fr = parseInt(arr2[1].replace(/,/g,'')), to = parseInt(arr2[2].replace(/,/g,''));
    if (fr>0 && to<fr) score -= 15;
  }
  return Math.max(-100, Math.min(100, score));
}

// ── 네이버 금융 뉴스 (국내 주식 전용, 4단계 폭포식) ─────────
async function fetchNaverNews(code, name) {
  const results = [];
  const seen    = new Set();

  // HTML 태그·엔티티 제거, 깨진 문자 필터
  function clean(raw) {
    const t = String(raw ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
      .replace(/&quot;/g,'"').replace(/&apos;/g,"'")
      .replace(/&#(\d+);/g, (_,n) => String.fromCharCode(+n))
      .replace(/&[a-z]+;/g," ").replace(/\s+/g," ").trim();
    // EUC-KR 깨진 문자 감지 → 버림
    if (/[ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(t)) return "";
    return t;
  }

  function push(title, link, time, press) {
    const t = clean(title);
    if (t.length < 4) return;
    const key = t.slice(0, 20);
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      title: t,
      url:   String(link  ?? "").trim(),
      time:  String(time  ?? "").slice(0,16).replace("T"," "),
      press: clean(press).slice(0,25) || "언론사",
      score: scoreSentiment(t),
    });
  }

  // RSS XML 파싱 헬퍼
  function parseRSS(xml) {
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml)) !== null && results.length < 15) {
      const b = m[1];
      const t  = (b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>/) ?? b.match(/<title>([\s\S]*?)<\/title>/))?.[1] ?? "";
      const l  = (b.match(/<link>([\s\S]*?)<\/link>/) ?? b.match(/<originallink>([\s\S]*?)<\/originallink>/))?.[1] ?? "";
      const p  = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/))?.[1] ?? "";
      const s  = (b.match(/<source[^>]*>([\s\S]*?)<\/source>/) ?? b.match(/<press>([\s\S]*?)<\/press>/))?.[1] ?? "";
      push(t.trim(), l.trim(), p.trim(), s.trim());
    }
  }

  const RSS_HDR = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  };

  // ── [1] Google News RSS - 한국어 (가장 안정적) ─────────────
  // Google은 Cloudflare Worker IP 차단 안 함
  const googleQueries = [
    name,                                    // "삼성전자"
    name + " 주가",                          // "삼성전자 주가"
    name + " 실적",                          // "삼성전자 실적"
  ];

  for (const q of googleQueries) {
    if (results.length >= 10) break;
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
      const r = await withTimeout(fetch(url, { headers: RSS_HDR }), 8000);
      if (r.ok) {
        const xml = await r.text();
        parseRSS(xml);
      }
    } catch {}
  }

  // ── [2] 네이버 뉴스 검색 RSS (다른 도메인) ────────────────
  // newssearch.naver.com은 API와 다른 서버 → 차단 덜함
  if (results.length < 6) {
    try {
      const url = `https://newssearch.naver.com/search.naver?where=rss&query=${encodeURIComponent(name)}&sort=0`;
      const r = await withTimeout(fetch(url, { headers: RSS_HDR }), 7000);
      if (r.ok) {
        const xml = await r.text();
        parseRSS(xml);
      }
    } catch {}
  }

  // ── [3] 네이버 뉴스 RSS - 종목명+"주식" ───────────────────
  if (results.length < 5) {
    try {
      const url = `https://newssearch.naver.com/search.naver?where=rss&query=${encodeURIComponent(name + " 주식")}&sort=0`;
      const r = await withTimeout(fetch(url, { headers: RSS_HDR }), 7000);
      if (r.ok) {
        const xml = await r.text();
        parseRSS(xml);
      }
    } catch {}
  }

  // ── [4] m.stock.naver.com JSON API (혹시 열려있을 때 보너스) ─
  if (results.length < 5) {
    try {
      const r = await withTimeout(
        fetch(`https://m.stock.naver.com/api/news/stock/${code}?pageSize=20&page=0`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 Chrome/121 Mobile Safari/537.36",
            "Accept": "application/json",
            "Accept-Language": "ko-KR,ko;q=0.9",
            "Referer": `https://m.stock.naver.com/domestic/stock/${code}/news`,
            "Origin": "https://m.stock.naver.com",
          }
        }), 8000
      );
      if (r.ok) {
        const d = await r.json();
        const items = d?.items ?? d?.newsList ?? d?.list ?? [];
        for (const it of items.slice(0, 20)) {
          push(
            it.title ?? it.headline ?? "",
            it.url ?? it.link ?? it.originalUrl ?? "",
            it.wdate ?? it.pubDate ?? it.date ?? "",
            it.officeName ?? it.press ?? it.source ?? "",
          );
        }
      }
    } catch {}
  }

  // 중복 제거 후 최신순 정렬
  return results.sort((a, b) => b.time > a.time ? 1 : b.time < a.time ? -1 : 0).slice(0, 15);
}

async function analyzeNews(sym, name, newsItems, priceCtx, env) {
  const total    = newsItems.length;
  const scores   = newsItems.map(n => n.score);
  const avgScore = total > 0 ? Math.round(scores.reduce((a,b)=>a+b,0)/total) : 0;
  const posCount = newsItems.filter(n => n.score >  10).length;
  const negCount = newsItems.filter(n => n.score < -10).length;
  const neuCount = total - posCount - negCount;
  const maxScore = total > 0 ? Math.max(...scores) : 0;
  const minScore = total > 0 ? Math.min(...scores) : 0;
  // 최근 3건 vs 전체 비교 (최근 흐름)
  const recentAvg = newsItems.slice(0,3).length > 0
    ? Math.round(newsItems.slice(0,3).reduce((a,n)=>a+n.score,0)/newsItems.slice(0,3).length) : avgScore;

  if (env?.ANTHROPIC_API_KEY) {
    // 임팩트 순 정렬 후 상위 10건
    const sorted = [...newsItems].sort((a,b) => Math.abs(b.score)-Math.abs(a.score));
    const newsList = sorted.slice(0,10).map((n,i) => {
      const tag = n.score>=25?"🔴매우긍정":n.score>=10?"🟢긍정":n.score<=-25?"🔴매우부정":n.score<=-10?"🔴부정":"⚪중립";
      return `${i+1}. [${tag} ${n.score>=0?"+":""}${n.score}점] ${n.title}`;
    }).join("\n");

    const prompt = `당신은 10년 이상 경력의 한국 주식 전문 애널리스트입니다. 아래 정보를 종합적으로 분석하여 정밀한 주가 예측을 제공하세요.

## 종목 정보
- 종목명: ${name} (${sym})
- 현재가: ${priceCtx.priceStr} | 당일 등락: ${priceCtx.chgPct>0?"+":""}${priceCtx.chgPct}%
- 시장: ${priceCtx.mkt}

## 최근 뉴스 ${total}건 (임팩트순)
${newsList}

## 감성 통계
- 평균: ${avgScore}점 | 최고: +${maxScore}점 | 최저: ${minScore}점
- 긍정 ${posCount}건 / 중립 ${neuCount}건 / 부정 ${negCount}건
- 최근 3건 평균: ${recentAvg}점 (${recentAvg>avgScore?"개선추세":"악화추세"})

## 분석 기준
- 뉴스 영향력과 신선도 가중 반영
- 단기(내일): 당일 뉴스 모멘텀, 수급 심리
- 중기(주간): 실적/이벤트 지속성, 섹터 흐름
- 신뢰도: 뉴스 수, 방향 일관성, 이벤트 명확성 반영
- 등락폭: 감성 강도와 종목 변동성 기반 추정

아래 JSON만 출력 (마크다운/추가설명 절대금지):
{
  "sentimentScore": 정수(-100~100),
  "sentimentLabel": "매우긍정|긍정|중립|부정|매우부정",
  "sentimentDetail": "감성 분석 핵심 한 문장",
  "tomorrowPrediction": "상승|보합|하락",
  "tomorrowConfidence": 정수(0~100),
  "tomorrowRange": "예상 등락폭 예: +1~3% 또는 -2~0%",
  "weekPrediction": "상승|보합|하락",
  "weekConfidence": 정수(0~100),
  "weekRange": "예상 등락폭 예: +3~7% 또는 -5~-1%",
  "keyPositives": ["구체적 긍정요인1","긍정요인2"],
  "keyNegatives": ["구체적 부정요인1","부정요인2"],
  "riskFactors": ["단기리스크1","리스크2"],
  "catalysts": ["상승촉매1","촉매2"],
  "newsSummary": "뉴스 흐름 전체 요약 2~3문장",
  "predictionReason": "예측 근거 구체적 2~3문장",
  "investmentNote": "투자자 주의사항 한 문장"
}`;

    try {
      const r = await withTimeout(fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type":"application/json","x-api-key":env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          system: "한국 주식 전문 애널리스트. 반드시 순수 JSON만 출력. 마크다운 코드블록 절대 금지.",
          messages: [{ role:"user", content:prompt }],
        }),
      }), 25000);
      if (r.ok) {
        const cd = await r.json();
        const raw = (cd.content?.[0]?.text ?? "{}").replace(/```[\s\S]*?```/g,"").trim();
        try { return JSON.parse(raw); }
        catch { const mm = raw.match(/\{[\s\S]*\}/); if (mm) try { return JSON.parse(mm[0]); } catch {} }
      }
    } catch {}
  }

  // ── 키워드 기반 자동 분석 폴백 ─────────────────────────────
  const label  = avgScore>=35?"매우긍정":avgScore>=12?"긍정":avgScore<=-35?"매우부정":avgScore<=-12?"부정":"중립";
  const tmr    = avgScore>=20?"상승":avgScore<=-20?"하락":"보합";
  const wk     = avgScore>=12?"상승":avgScore<=-12?"하락":"보합";
  const conf   = Math.min(80, 35 + Math.abs(avgScore));
  const tmrRng = avgScore>=35?"+3~6%":avgScore>=20?"+1~3%":avgScore<=-35?"-3~6%":avgScore<=-20?"-1~3%":"±0.5%";
  const wkRng  = avgScore>=30?"+5~10%":avgScore>=12?"+1~4%":avgScore<=-30?"-5~10%":avgScore<=-12?"-1~4%":"±2%";
  const posTop = newsItems.filter(n=>n.score>10).sort((a,b)=>b.score-a.score).slice(0,2).map(n=>n.title.slice(0,60));
  const negTop = newsItems.filter(n=>n.score<-10).sort((a,b)=>a.score-b.score).slice(0,2).map(n=>n.title.slice(0,60));
  const trend  = recentAvg > avgScore ? "최근 긍정 흐름 강화" : recentAvg < avgScore ? "최근 부정 흐름 강화" : "방향성 유지";
  return {
    sentimentScore: avgScore, sentimentLabel: label,
    sentimentDetail: `${total}건 분석, 평균 ${avgScore}점(${label}). ${trend}.`,
    tomorrowPrediction: tmr, tomorrowConfidence: conf, tomorrowRange: tmrRng,
    weekPrediction: wk, weekConfidence: Math.max(28,conf-15), weekRange: wkRng,
    keyPositives: posTop.length ? posTop : ["긍정 뉴스 없음"],
    keyNegatives: negTop.length ? negTop : ["부정 뉴스 없음"],
    riskFactors: negCount>posCount ? ["부정 뉴스 우세","추가 하락 주의"] : ["불확실성 상존","급변동 가능"],
    catalysts: posCount>negCount ? ["긍정 뉴스 모멘텀","수급 개선 기대"] : ["반등 모멘텀 탐색 중"],
    newsSummary: `최근 ${total}건 뉴스 중 긍정 ${posCount}건, 부정 ${negCount}건. 평균 감성 ${avgScore}점(${label}) 흐름. ${trend}.`,
    predictionReason: `뉴스 감성 ${avgScore}점 기반 내일 ${tmr}(${tmrRng}), 주간 ${wk}(${wkRng}) 예측. 신뢰도 ${conf}%.`,
    investmentNote: "뉴스 감성 예측은 참고 자료입니다. 실제 투자 시 추가 분석과 전문가 상담을 권장합니다.",
  };
}

// ── 네이버 종목토론실 ──────────────────────────────────────────
async function fetchDiscuss(cd, pageSize = 15) {
  // 시도 1: m.stock.naver.com 모바일 API
  for (const url of [
    `https://m.stock.naver.com/api/discuss/stock/${cd}/topics?pageSize=${pageSize}&page=0`,
    `https://m.stock.naver.com/api/discuss/stock/${cd}/discussions?pageSize=${pageSize}&page=0`,
    `https://m.stock.naver.com/api/discuss/stock/${cd}/board?pageSize=${pageSize}&page=0`,
  ]) {
    const d = await safeFetch(url, { headers: KR_HDR, _timeout: 6000 });
    if (!d) continue;
    // 응답 구조 파악
    const list = d.items ?? d.list ?? d.discussions ?? d.topics ?? d.data?.items ?? [];
    if (!Array.isArray(list) || list.length === 0) continue;
    return list.slice(0, pageSize).map(it => ({
      title:   String(it.title ?? it.subject ?? it.topicTitle ?? "").trim(),
      content: String(it.content ?? it.body ?? it.summary ?? it.contentSummary ?? "").slice(0, 100).trim(),
      writer:  String(it.writer ?? it.userId ?? it.nickname ?? "익명").trim(),
      date:    String(it.writeDate ?? it.createdAt ?? it.date ?? "").slice(0, 10),
      views:   Number(it.viewCount ?? it.readCount ?? it.views ?? 0),
      replies: Number(it.replyCount ?? it.commentCount ?? 0),
      upVote:  Number(it.upVoteCount ?? it.likeCount ?? it.goodCount ?? 0),
      url:     it.url ?? it.link ?? `https://finance.naver.com/item/board_read.nhn?code=${cd}`,
    })).filter(it => it.title.length > 0);
  }

  // 시도 2: finance.naver.com 구형 API (JSON 형태)
  const d2 = await safeFetch(
    `https://finance.naver.com/item/board_reader.nhn?code=${cd}&page=1`,
    { headers: { ...KR_HDR, "Referer": "https://finance.naver.com/" }, _timeout: 6000 }
  );
  if (d2) {
    const list2 = d2.result?.articleList ?? d2.articleList ?? d2.list ?? [];
    if (Array.isArray(list2) && list2.length > 0) {
      return list2.slice(0, pageSize).map(it => ({
        title:   String(it.title ?? "").trim(),
        content: String(it.body ?? it.content ?? "").slice(0, 100).trim(),
        writer:  String(it.userId ?? it.writer ?? "익명").trim(),
        date:    String(it.writeDate ?? "").slice(0, 10),
        views:   Number(it.viewCount ?? 0),
        replies: Number(it.replyCount ?? 0),
        upVote:  Number(it.goodCount ?? 0),
        url:     `https://finance.naver.com/item/board_read.nhn?code=${cd}&article_id=${it.articleId ?? ""}`,
      })).filter(it => it.title.length > 0);
    }
  }
  return [];
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

      if (path === "/api/health") return J({ ok: true, v: 17, t: new Date().toISOString() });

      if (path === "/api/search" && method === "GET") {
        const q = (url.searchParams.get("q") ?? "").trim();
        if (!q) return J({ ok: true, results: [] }); // 에러 대신 빈 결과
        return await searchAll(q);
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

      // 뉴스 + 감성분석 + 예측
      if (path === "/api/news" && method === "GET") {
        const sym2  = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
        const name2 = decodeURIComponent(url.searchParams.get("name") ?? sym2).trim();
        if (!sym2) return J({ ok: false, error: "symbol 필요" });

        const isKRf = isKR(sym2) || /^\d{6}$/.test(sym2);

        // 해외 주식은 뉴스 미지원 (Naver는 국내 전용)
        if (!isKRf) {
          return J({ ok: true, news: [], analysis: null, message: "해외주식 뉴스는 준비 중입니다" });
        }

        // 6자리 코드 추출: "005930.KS" → "005930"
        const code2 = sym2.replace(/\.(KS|KQ)$/i, "").replace(/[^0-9]/g,"").slice(0,6);
        if (code2.length !== 6) {
          return J({ ok: false, error: `유효하지 않은 종목 코드: ${sym2}` });
        }

        // name2 전처리: URL 인코딩 잔재 제거
        const cleanName = name2.replace(/[+%]/g, " ").replace(/\s+/g," ").trim() || code2;

        const priceCtx = {
          priceStr: decodeURIComponent(url.searchParams.get("price") ?? "—"),
          chgPct:   parseFloat(url.searchParams.get("chgPct") ?? "0") || 0,
          mkt:      url.searchParams.get("mkt") ?? "KOSPI",
        };

        const news = await fetchNaverNews(code2, cleanName);
        const analysis = news.length > 0
          ? await analyzeNews(sym2, cleanName, news, priceCtx, env)
          : null;
        return J({
          ok: true, news, analysis,
          _meta: { code: code2, name: cleanName, count: news.length, sym: sym2 }
        });
      }

      // 종목토론실
      if (path === "/api/discuss" && method === "GET") {
        const code = (url.searchParams.get("code") ?? "").trim().replace(/[^0-9]/g, "");
        const size = Math.min(30, Math.max(5, parseInt(url.searchParams.get("size") ?? "15", 10)));
        if (!code || !/^\d{6}$/.test(code)) return J({ ok: false, error: "6자리 종목코드 필요" });
        const posts = await fetchDiscuss(code, size);
        return J({ ok: true, code, count: posts.length, posts });
      }

      // 그 외 요청은 정적 파일
      return env.ASSETS.fetch(req);

    } catch (e) {
      // 최종 안전망: 어떤 에러든 JSON으로 반환
      return J({ ok: false, error: e?.message ?? "서버 오류" }, 500);
    }
  },
};
