// functions/api/stock.js
// ═══════════════════════════════════════════════════════════════
//  StockMind AI — 통합 주식 데이터 Function
//
//  한국 주식: 네이버 금융 (무료, 무제한, CORS 없음 → 서버에서 호출)
//  미국 주식: Financial Modeling Prep (FMP) API
//
//  엔드포인트:
//    GET /api/stock?action=quote&symbol=005930.KS
//    GET /api/stock?action=history&symbol=AAPL&days=30
//    GET /api/stock?action=search&q=삼성전자
// ═══════════════════════════════════════════════════════════════

const FMP_KEY = 'dInmlR5CcjKZghop5ePbE95FpacKzcBS';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

// ── 라우터 ──────────────────────────────────────────────────────
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const symbol = url.searchParams.get('symbol') || '';
  const q      = url.searchParams.get('q') || '';
  const days   = parseInt(url.searchParams.get('days') || '30');

  try {
    const isKR = symbol.endsWith('.KS') || symbol.endsWith('.KQ');

    if (action === 'quote') {
      return isKR ? await krQuote(symbol) : await usQuote(symbol);
    }
    if (action === 'history') {
      return isKR ? await krHistory(symbol, days) : await usHistory(symbol, days);
    }
    if (action === 'search') {
      return await searchStocks(q);
    }
    return err('Unknown action', 400);
  } catch (e) {
    console.error(e);
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// ════════════════════════════════════════════════════════════════
//  🇰🇷 한국 주식 — 네이버 금융
// ════════════════════════════════════════════════════════════════
function krCode(symbol) {
  // "005930.KS" → "005930"
  return symbol.replace(/\.(KS|KQ)$/i, '');
}

async function krQuote(symbol) {
  const code = krCode(symbol);

  // 네이버 금융 종목 기본 정보 API
  const url = `https://m.stock.naver.com/api/stock/${code}/basic`;
  const res = await serverFetch(url, {
    'Referer': 'https://m.stock.naver.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });

  const raw = await res.json();

  // 네이버 모바일 API 응답 파싱
  const price        = parseNum(raw.closePrice       || raw.currentPrice);
  const change       = parseNum(raw.compareToPreviousClosePrice);
  const changePct    = parseNum(raw.fluctuationsRatio);
  const prevClose    = price - change;
  const high         = parseNum(raw.highPrice);
  const low          = parseNum(raw.lowPrice);
  const open         = parseNum(raw.openPrice);
  const volume       = parseNum(raw.accumulatedTradingVolume || raw.tradingVolume);
  const marketCap    = parseNum(raw.marketValue);
  const high52       = parseNum(raw.yearlyHighPrice);
  const low52        = parseNum(raw.yearlyLowPrice);
  const name         = raw.stockName || raw.corporateName || '';
  const per          = parseNum(raw.per);
  const eps          = parseNum(raw.eps);

  return ok({
    symbol,
    name,
    price,
    change,
    changePct,
    prevClose,
    open,
    high,
    low,
    volume,
    marketCap,
    high52,
    low52,
    pe: per,
    eps,
    currency: 'KRW',
    market: symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI',
  });
}

async function krHistory(symbol, days = 30) {
  const code = krCode(symbol);
  const count = Math.max(days, 30);

  // 네이버 금융 일봉 차트 데이터
  const url = `https://m.stock.naver.com/api/stock/${code}/candle/day?count=${count}`;
  const res = await serverFetch(url, {
    'Referer': 'https://m.stock.naver.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });

  const raw = await res.json();

  // 응답 형식: 배열 or { candles: [] }
  const candles = Array.isArray(raw) ? raw : (raw.candles || raw.candleList || []);

  const history = candles
    .map(c => ({
      date:   c.localDate || c.date || '',
      open:   parseNum(c.openPrice  || c.open),
      high:   parseNum(c.highPrice  || c.high),
      low:    parseNum(c.lowPrice   || c.low),
      close:  parseNum(c.closePrice || c.close),
      volume: parseNum(c.accumulatedTradingVolume || c.volume),
    }))
    .filter(c => c.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date)); // 오래된 날짜 순

  return ok({ symbol, history });
}

// ════════════════════════════════════════════════════════════════
//  🇺🇸 미국 주식 — FMP API
// ════════════════════════════════════════════════════════════════
async function usQuote(symbol) {
  const [quoteRes, profileRes] = await Promise.allSettled([
    serverFetch(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_KEY}`),
    serverFetch(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`),
  ]);

  let q = {};
  let p = {};

  if (quoteRes.status === 'fulfilled') {
    const data = await quoteRes.value.json();
    q = Array.isArray(data) ? (data[0] || {}) : {};
  }
  if (profileRes.status === 'fulfilled') {
    const data = await profileRes.value.json();
    p = Array.isArray(data) ? (data[0] || {}) : {};
  }

  if (!q.symbol && !p.symbol) throw new Error(`미국 주식 데이터 없음: ${symbol}`);

  return ok({
    symbol,
    name:       q.name       || p.companyName || symbol,
    price:      q.price      || 0,
    change:     q.change     || 0,
    changePct:  q.changesPercentage || 0,
    prevClose:  q.previousClose || 0,
    open:       q.open       || 0,
    high:       q.dayHigh    || 0,
    low:        q.dayLow     || 0,
    volume:     q.volume     || 0,
    avgVolume:  q.avgVolume  || 0,
    marketCap:  q.marketCap  || p.mktCap || 0,
    high52:     q.yearHigh   || 0,
    low52:      q.yearLow    || 0,
    pe:         q.pe         || 0,
    eps:        q.eps        || 0,
    sector:     p.sector     || '',
    industry:   p.industry   || '',
    currency: 'USD',
    market: p.exchangeShortName || 'US',
  });
}

async function usHistory(symbol, days = 30) {
  const res = await serverFetch(
    `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?serietype=line&timeseries=${days}&apikey=${FMP_KEY}`
  );
  const data = await res.json();
  const hist  = (data.historical || []).reverse();

  return ok({
    symbol,
    history: hist.map(h => ({
      date:   h.date,
      open:   h.open,
      high:   h.high,
      low:    h.low,
      close:  h.close,
      volume: h.volume,
    })),
  });
}

// ════════════════════════════════════════════════════════════════
//  검색 (FMP + 한국 종목 내장 DB)
// ════════════════════════════════════════════════════════════════
const KR_DB = [
  ['005930.KS','삼성전자','Samsung Electronics','KOSPI'],
  ['000660.KS','SK하이닉스','SK Hynix','KOSPI'],
  ['035420.KS','NAVER','NAVER','KOSPI'],
  ['035720.KS','카카오','Kakao','KOSPI'],
  ['005380.KS','현대자동차','Hyundai Motor','KOSPI'],
  ['000270.KS','기아','Kia','KOSPI'],
  ['051910.KS','LG화학','LG Chem','KOSPI'],
  ['005490.KS','POSCO홀딩스','POSCO Holdings','KOSPI'],
  ['207940.KS','삼성바이오로직스','Samsung Biologics','KOSPI'],
  ['068270.KS','셀트리온','Celltrion','KOSPI'],
  ['323410.KS','카카오뱅크','KakaoBank','KOSPI'],
  ['259960.KS','크래프톤','Krafton','KOSPI'],
  ['352820.KS','하이브','HYBE','KOSPI'],
  ['036570.KS','엔씨소프트','NCSoft','KOSPI'],
  ['251270.KS','넷마블','Netmarble','KOSPI'],
  ['090430.KS','아모레퍼시픽','AmorePacific','KOSPI'],
  ['030200.KS','KT','KT Corp','KOSPI'],
  ['017670.KS','SK텔레콤','SK Telecom','KOSPI'],
  ['066570.KS','LG전자','LG Electronics','KOSPI'],
  ['055550.KS','신한지주','Shinhan Financial','KOSPI'],
  ['034020.KS','두산에너빌리티','Doosan Enerbility','KOSPI'],
  ['015760.KS','한국전력','Korea Electric Power','KOSPI'],
  ['028260.KS','삼성물산','Samsung C&T','KOSPI'],
  ['012330.KS','현대모비스','Hyundai Mobis','KOSPI'],
  ['011170.KS','롯데케미칼','Lotte Chemical','KOSPI'],
  ['010130.KS','고려아연','Korea Zinc','KOSPI'],
  ['105560.KS','KB금융','KB Financial','KOSPI'],
  ['086790.KS','하나금융지주','Hana Financial','KOSPI'],
  ['096770.KS','SK이노베이션','SK Innovation','KOSPI'],
  ['003550.KS','LG','LG Corp','KOSPI'],
  ['032830.KS','삼성생명','Samsung Life','KOSPI'],
  ['015360.KS','이건홀딩스','Ikon Holdings','KOSPI'],
  ['000810.KS','삼성화재','Samsung Fire','KOSPI'],
  ['247540.KQ','에코프로비엠','EcoPro BM','KOSDAQ'],
  ['086520.KQ','에코프로','EcoPro','KOSDAQ'],
  ['091990.KQ','셀트리온헬스케어','Celltrion Healthcare','KOSDAQ'],
  ['293490.KQ','카카오게임즈','Kakao Games','KOSDAQ'],
  ['086900.KQ','메디톡스','Medytox','KOSDAQ'],
  ['263750.KQ','펄어비스','Pearl Abyss','KOSDAQ'],
  ['078340.KQ','컴투스','Com2uS','KOSDAQ'],
  ['196170.KQ','알테오젠','Alteogen','KOSDAQ'],
  ['145020.KQ','휴젤','Hugel','KOSDAQ'],
  ['357780.KQ','솔브레인','Soulbrain','KOSDAQ'],
];

async function searchStocks(query) {
  if (!query) return ok([]);

  const q = query.toLowerCase().replace(/\s+/g, '');

  // 한국 종목 검색 (내장 DB)
  const krMatches = KR_DB
    .filter(([sym, name, en]) =>
      name.replace(/\s/g,'').toLowerCase().includes(q) ||
      en.replace(/\s/g,'').toLowerCase().includes(q) ||
      sym.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map(([sym, name, en, mkt]) => ({ symbol: sym, name, en, market: mkt }));

  // 미국 종목 검색 (FMP)
  let usMatches = [];
  try {
    const res = await serverFetch(
      `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(query)}&limit=5&apikey=${FMP_KEY}`
    );
    const data = await res.json();
    usMatches = (Array.isArray(data) ? data : [])
      .filter(s => !s.symbol?.includes('.KS') && !s.symbol?.includes('.KQ'))
      .slice(0, 5)
      .map(s => ({ symbol: s.symbol, name: s.name, en: s.name, market: s.stockExchange || 'US' }));
  } catch {}

  return ok([...krMatches, ...usMatches].slice(0, 8));
}

// ════════════════════════════════════════════════════════════════
//  공통 헬퍼
// ════════════════════════════════════════════════════════════════
async function serverFetch(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/html, */*',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      ...extraHeaders,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url.split('?')[0]}`);
  return res;
}

function parseNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/,/g, '')) || 0;
}

function ok(data) {
  return new Response(JSON.stringify({ ok: true, data }), { headers: CORS });
}

function err(msg, status = 500) {
  return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: CORS });
}
