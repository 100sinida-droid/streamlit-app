/**
 * StockMind AI — _worker.js
 * ═══════════════════════════════════════════════════════════════
 *  Cloudflare Pages Worker (단일 파일, 루트에 배치)
 *
 *  이 파일 하나로 모든 API 라우팅을 처리합니다:
 *  GET  /api/stock?action=quote&symbol=005930.KS
 *  GET  /api/stock?action=quote&symbol=AAPL
 *  GET  /api/stock?action=chart&symbol=005930.KS&days=30
 *  GET  /api/health
 *  POST /api/analyze
 *
 *  배포: GitHub 루트에 index.html + _worker.js 2개만 올리면 됩니다.
 * ═══════════════════════════════════════════════════════════════
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    const url      = new URL(request.url);
    const pathname = url.pathname;
    const method   = request.method;

    // OPTIONS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // ── API 라우팅 ──────────────────────────────────────────
    if (pathname === '/api/health') {
      return json({ ok: true, message: 'StockMind Worker 정상 작동', time: new Date().toISOString() });
    }

    if (pathname === '/api/stock' && method === 'GET') {
      const action = url.searchParams.get('action') || '';
      const symbol = (url.searchParams.get('symbol') || '').toUpperCase();
      const days   = parseInt(url.searchParams.get('days') || '30');
      try {
        if (!symbol) return json({ ok: false, error: 'symbol 필요' }, 400);
        if (action === 'quote') return await handleQuote(symbol);
        if (action === 'chart') return await handleChart(symbol, days);
        return json({ ok: false, error: 'action은 quote 또는 chart' }, 400);
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    if (pathname === '/api/analyze' && method === 'POST') {
      try {
        const body   = await request.json().catch(() => ({}));
        const prompt = body.prompt || '';
        if (!prompt) return json({ ok: false, error: 'prompt 필요' }, 400);
        return await handleAnalyze(prompt, env);
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // ── 정적 파일 (index.html 등) → Pages가 자동 서빙 ────────
    // Worker가 없는 경로는 Pages 정적 자산으로 폴백
    return env.ASSETS.fetch(request);
  },
};

// ═══════════════════════════════════════════════════════════════
//  주식 데이터
// ═══════════════════════════════════════════════════════════════

function isKR(sym) { return sym.endsWith('.KS') || sym.endsWith('.KQ'); }
function krCode(sym) { return sym.replace(/\.(KS|KQ)$/i, ''); }

async function handleQuote(symbol) {
  return isKR(symbol)
    ? await naverQuote(krCode(symbol), symbol)
    : await yahooQuote(symbol);
}

async function handleChart(symbol, days) {
  return isKR(symbol)
    ? await naverChart(krCode(symbol), days)
    : await yahooChart(symbol, days);
}

// ── 네이버 금융 ─────────────────────────────────────────────────
async function naverQuote(code, origSym) {
  const r = await go(`https://m.stock.naver.com/api/stock/${code}/basic`);
  const d = await r.json();
  const n = v => parseFloat(String(v || 0).replace(/,/g, '')) || 0;
  return json({
    ok: true,
    symbol:    origSym,
    name:      d.stockName || d.corporateName || code,
    price:     n(d.closePrice   || d.currentPrice),
    change:    n(d.compareToPreviousClosePrice),
    changePct: n(d.fluctuationsRatio),
    open:      n(d.openPrice),
    high:      n(d.highPrice),
    low:       n(d.lowPrice),
    high52:    n(d.yearlyHighPrice),
    low52:     n(d.yearlyLowPrice),
    volume:    n(d.accumulatedTradingVolume || d.tradingVolume),
    marketCap: n(d.marketValue) * 1e8,
    per:       n(d.per),
    eps:       n(d.eps),
    currency:  'KRW',
    exchange:  origSym.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI',
  });
}

async function naverChart(code, days) {
  const r   = await go(`https://m.stock.naver.com/api/stock/${code}/candle/day?count=${days + 10}`);
  const raw = await r.json();
  const arr = Array.isArray(raw) ? raw : (raw.candles || raw.candleList || []);
  const n   = v => parseFloat(String(v || 0).replace(/,/g, '')) || 0;
  const history = arr
    .map(c => {
      const s = String(c.localDate || c.date || '');
      const date = s.length === 8
        ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
        : s;
      return { date, close: n(c.closePrice || c.close), volume: n(c.accumulatedTradingVolume || c.volume) };
    })
    .filter(c => c.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
  return json({ ok: true, history });
}

// ── Yahoo Finance ───────────────────────────────────────────────
async function yahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;
  const r   = await go(url);
  const d   = await r.json();
  const res = d?.chart?.result?.[0];
  if (!res) throw new Error(`"${symbol}" 데이터 없음 — 심볼을 확인해주세요`);
  const meta = res.meta || {};
  const price    = meta.regularMarketPrice || 0;
  const prev     = meta.chartPreviousClose || meta.previousClose || price;
  const change   = +(price - prev).toFixed(4);
  const changePct= prev > 0 ? +((change / prev) * 100).toFixed(4) : 0;
  return json({
    ok: true,
    symbol,
    name:      meta.longName || meta.shortName || symbol,
    price, change, changePct,
    open:      meta.regularMarketOpen     || 0,
    high:      meta.regularMarketDayHigh  || 0,
    low:       meta.regularMarketDayLow   || 0,
    high52:    meta.fiftyTwoWeekHigh      || 0,
    low52:     meta.fiftyTwoWeekLow       || 0,
    volume:    meta.regularMarketVolume   || 0,
    marketCap: meta.marketCap             || 0,
    per:       0, eps: 0,
    currency:  meta.currency || 'USD',
    exchange:  meta.exchangeName || 'US',
  });
}

async function yahooChart(symbol, days) {
  const range = days <= 7 ? '5d' : days <= 30 ? '1mo' : days <= 90 ? '3mo' : '6mo';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}&includePrePost=false`;
  const r   = await go(url);
  const d   = await r.json();
  const res = d?.chart?.result?.[0];
  if (!res) throw new Error(`"${symbol}" 차트 없음`);
  const ts      = res.timestamp    || [];
  const q       = res.indicators?.quote?.[0] || {};
  const closes  = q.close   || [];
  const volumes = q.volume  || [];
  const history = ts
    .map((t, i) => ({
      date:   new Date(t * 1000).toISOString().slice(0, 10),
      close:  closes[i]  || 0,
      volume: volumes[i] || 0,
    }))
    .filter(h => h.close > 0)
    .slice(-days);
  return json({ ok: true, history });
}

// ── Claude AI ───────────────────────────────────────────────────
async function handleAnalyze(prompt, env) {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return json(stub('ANTHROPIC_API_KEY 환경변수 미설정'));

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-opus-4-6',
      max_tokens: 2000,
      system:     '전문 주식 애널리스트. 반드시 순수 JSON만 출력. 마크다운 없음.',
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (!r.ok) return json(stub(`Claude API 오류 ${r.status}`));

  const cd  = await r.json();
  let   raw = (cd.content?.[0]?.text || '{}')
    .replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  try   { return json(JSON.parse(raw)); }
  catch { const m = raw.match(/\{[\s\S]*\}/); return json(m ? JSON.parse(m[0]) : stub('파싱 오류')); }
}

// ── 유틸 ────────────────────────────────────────────────────────
async function go(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept':          'application/json, text/plain, */*',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      'Referer':         'https://finance.naver.com/',
    },
  });
  if (!r.ok) throw new Error(`외부 API 오류: ${r.status}`);
  return r;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function stub(msg) {
  return {
    ok: true, verdict: '관망', verdictReason: msg,
    buyStrategy:  { zone: '-', timing: '-', split: [] },
    sellStrategy: { shortTarget: '-', midTarget: '-', stopLoss: '-', exitSignal: '-' },
    risks: [msg], riskLevel: '중간', riskScore: 50,
    scenarios: { bull: { price: '-', desc: '-' }, base: { price: '-', desc: '-' }, bear: { price: '-', desc: '-' } },
    watchPoints: ['환경변수 확인', '재배포 후 재시도'], summary: msg,
  };
}
