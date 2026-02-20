// functions/api/stock.js
// ══════════════════════════════════════════════════════════════
//  StockMind AI — 주식 데이터 프록시
//  모든 외부 API(네이버, Yahoo Finance)를 서버에서 호출
//  브라우저는 같은 도메인만 호출 → CORS 완전 해결
//
//  GET /api/stock?action=quote&symbol=005930.KS
//  GET /api/stock?action=quote&symbol=AAPL
//  GET /api/stock?action=chart&symbol=005930.KS&days=30
//  GET /api/stock?action=chart&symbol=AAPL&days=30
// ══════════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function onRequestGet(ctx) {
  const url    = new URL(ctx.request.url);
  const action = url.searchParams.get('action') || '';
  const symbol = (url.searchParams.get('symbol') || '').toUpperCase();
  const days   = parseInt(url.searchParams.get('days') || '30');

  try {
    if (!symbol) return fail('symbol 파라미터 필요');

    switch (action) {
      case 'quote': return await handleQuote(symbol);
      case 'chart': return await handleChart(symbol, days);
      default:      return fail('action은 quote 또는 chart');
    }
  } catch (e) {
    return fail(e.message);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// ─────────────────────────────────────────────────────────────
//  심볼 분류
// ─────────────────────────────────────────────────────────────
function isKR(sym) {
  return sym.endsWith('.KS') || sym.endsWith('.KQ');
}

function krCode(sym) {
  return sym.replace(/\.(KS|KQ)$/i, '');
}

// ─────────────────────────────────────────────────────────────
//  Quote 핸들러
// ─────────────────────────────────────────────────────────────
async function handleQuote(symbol) {
  if (isKR(symbol)) {
    return await naverQuote(krCode(symbol), symbol);
  } else {
    return await yahooQuote(symbol);
  }
}

// ─────────────────────────────────────────────────────────────
//  Chart 핸들러
// ─────────────────────────────────────────────────────────────
async function handleChart(symbol, days) {
  if (isKR(symbol)) {
    return await naverChart(krCode(symbol), days);
  } else {
    return await yahooChart(symbol, days);
  }
}

// ─────────────────────────────────────────────────────────────
//  네이버 금융 — 한국 주식
// ─────────────────────────────────────────────────────────────
async function naverQuote(code, origSymbol) {
  const res = await serverFetch(
    `https://m.stock.naver.com/api/stock/${code}/basic`
  );
  const d = await res.json();

  const n = v => parseFloat(String(v || 0).replace(/,/g, '')) || 0;

  return ok({
    symbol:    origSymbol,
    name:      d.stockName || d.corporateName || code,
    price:     n(d.closePrice || d.currentPrice),
    change:    n(d.compareToPreviousClosePrice),
    changePct: n(d.fluctuationsRatio),
    open:      n(d.openPrice),
    high:      n(d.highPrice),
    low:       n(d.lowPrice),
    high52:    n(d.yearlyHighPrice),
    low52:     n(d.yearlyLowPrice),
    volume:    n(d.accumulatedTradingVolume || d.tradingVolume),
    marketCap: n(d.marketValue) * 100000000, // 억 → 원
    per:       n(d.per),
    eps:       n(d.eps),
    currency:  'KRW',
    exchange:  origSymbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI',
  });
}

async function naverChart(code, days) {
  const cnt = Math.min(days + 10, 100);
  const res = await serverFetch(
    `https://m.stock.naver.com/api/stock/${code}/candle/day?count=${cnt}`
  );
  const raw = await res.json();
  const arr = Array.isArray(raw) ? raw : (raw.candles || raw.candleList || []);

  const history = arr
    .map(c => {
      const raw = String(c.localDate || c.date || '');
      const date = raw.length === 8
        ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`
        : raw;
      return {
        date,
        open:   parseFloat(String(c.openPrice  || 0).replace(/,/g, '')),
        high:   parseFloat(String(c.highPrice  || 0).replace(/,/g, '')),
        low:    parseFloat(String(c.lowPrice   || 0).replace(/,/g, '')),
        close:  parseFloat(String(c.closePrice || c.close || 0).replace(/,/g, '')),
        volume: parseFloat(String(c.accumulatedTradingVolume || c.volume || 0).replace(/,/g, '')),
      };
    })
    .filter(c => c.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);

  return ok({ history });
}

// ─────────────────────────────────────────────────────────────
//  Yahoo Finance — 미국 주식 (무료, CORS 없음)
// ─────────────────────────────────────────────────────────────
async function yahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;
  const res = await serverFetch(url);
  const d   = await res.json();

  const result = d?.chart?.result?.[0];
  if (!result) throw new Error(`"${symbol}" 데이터 없음`);

  const meta    = result.meta || {};
  const price   = meta.regularMarketPrice || 0;
  const prev    = meta.chartPreviousClose || meta.previousClose || price;
  const change  = price - prev;
  const changePct = prev > 0 ? (change / prev) * 100 : 0;

  return ok({
    symbol,
    name:      meta.longName || meta.shortName || symbol,
    price,
    change,
    changePct,
    open:      meta.regularMarketOpen || 0,
    high:      meta.regularMarketDayHigh || 0,
    low:       meta.regularMarketDayLow  || 0,
    high52:    meta.fiftyTwoWeekHigh || 0,
    low52:     meta.fiftyTwoWeekLow  || 0,
    volume:    meta.regularMarketVolume || 0,
    marketCap: meta.marketCap || 0,
    per:       0,
    eps:       0,
    currency:  meta.currency || 'USD',
    exchange:  meta.exchangeName || meta.exchange || 'US',
  });
}

async function yahooChart(symbol, days) {
  const range = days <= 7 ? '5d' : days <= 30 ? '1mo' : days <= 90 ? '3mo' : '6mo';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}&includePrePost=false`;
  const res = await serverFetch(url);
  const d   = await res.json();

  const result = d?.chart?.result?.[0];
  if (!result) throw new Error(`"${symbol}" 차트 없음`);

  const timestamps = result.timestamp || [];
  const closes     = result.indicators?.quote?.[0]?.close || [];
  const opens      = result.indicators?.quote?.[0]?.open  || [];
  const highs      = result.indicators?.quote?.[0]?.high  || [];
  const lows       = result.indicators?.quote?.[0]?.low   || [];
  const volumes    = result.indicators?.quote?.[0]?.volume|| [];

  const history = timestamps
    .map((ts, i) => ({
      date:   new Date(ts * 1000).toISOString().slice(0, 10),
      open:   opens[i]   || 0,
      high:   highs[i]   || 0,
      low:    lows[i]    || 0,
      close:  closes[i]  || 0,
      volume: volumes[i] || 0,
    }))
    .filter(h => h.close > 0)
    .slice(-days);

  return ok({ history });
}

// ─────────────────────────────────────────────────────────────
//  서버 fetch 헬퍼 (User-Agent 포함)
// ─────────────────────────────────────────────────────────────
async function serverFetch(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      'Referer': 'https://finance.naver.com/',
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok) throw new Error(`외부 API 오류: ${res.status} (${url})`);
  return res;
}

// ─────────────────────────────────────────────────────────────
//  응답 헬퍼
// ─────────────────────────────────────────────────────────────
function ok(data) {
  return new Response(JSON.stringify({ ok: true, ...data }), { headers: CORS });
}

function fail(msg, status = 500) {
  return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: CORS });
}
