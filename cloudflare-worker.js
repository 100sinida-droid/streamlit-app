// =========================================================
// Cloudflare Worker - KRX 실시간 주식 데이터 프록시
// 배포: https://workers.cloudflare.com (무료)
// =========================================================

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
};

async function handleRequest(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const code   = searchParams.get('code');

    try {
        let result;

        // ── 1. 종목 전체 목록 ──────────────────────────────
        if (action === 'list') {
            const market = searchParams.get('market') || 'ALL'; // KOSPI / KOSDAQ / ALL
            result = await fetchStockList(market);

        // ── 2. 현재가 ──────────────────────────────────────
        } else if (action === 'price') {
            if (!code) return err('code 필요');
            result = await fetchPrice(code);

        // ── 3. 차트(일봉) ──────────────────────────────────
        } else if (action === 'chart') {
            if (!code) return err('code 필요');
            const period = searchParams.get('period') || '1y'; // 1y / 2y
            result = await fetchChart(code, period);

        // ── 4. 전체 데이터(현재가+차트) ────────────────────
        } else if (action === 'full') {
            if (!code) return err('code 필요');
            const [price, chart] = await Promise.all([
                fetchPrice(code),
                fetchChart(code, '2y')
            ]);
            result = { ...price, chartData: chart.data };

        } else {
            return err('action 파라미터 필요 (list / price / chart / full)');
        }

        return new Response(JSON.stringify(result), { headers: CORS });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            headers: CORS, status: 500
        });
    }
}

function err(msg) {
    return new Response(JSON.stringify({ error: msg }), { headers: CORS, status: 400 });
}

// ── 네이버 전 종목 목록 ──────────────────────────────────
async function fetchStockList(market) {
    const markets = market === 'ALL' ? ['KOSPI', 'KOSDAQ'] : [market];
    const all = [];

    for (const mkt of markets) {
        let page = 1;
        while (true) {
            const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${mkt === 'KOSPI' ? 0 : 1}&page=${page}`;
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.naver.com/' } });
            const html = await res.text();

            // 종목 파싱 (정규식)
            const rows = [...html.matchAll(/item_main.*?code=([A-Z0-9]+).*?class="name"[^>]*>([^<]+)</gs)];
            if (rows.length === 0) break;

            for (const row of rows) {
                all.push({
                    code: row[1],
                    name: row[2].trim(),
                    ticker: `${row[1]}.${mkt === 'KOSPI' ? 'KS' : 'KQ'}`,
                    market: mkt
                });
            }
            page++;
            if (page > 30) break; // 최대 30페이지 (약 900종목)
        }
    }
    return { total: all.length, stocks: all };
}

// ── 네이버 현재가 ────────────────────────────────────────
async function fetchPrice(code) {
    const url = `https://m.stock.naver.com/api/stock/${code}/price`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`네이버 API 오류: ${res.status}`);
    const d = await res.json();

    return {
        code,
        name:          d.stockName || '',
        price:         num(d.closePrice),
        change:        num(d.compareToPreviousClosePrice),
        changePercent: parseFloat(d.fluctuationsRatio || 0),
        open:          num(d.openPrice),
        high:          num(d.highPrice),
        low:           num(d.lowPrice),
        volume:        num(d.accumulatedTradingVolume),
        marketCap:     num(d.marketValue),
        time:          new Date().toISOString()
    };
}

// ── 네이버 차트(일봉) ────────────────────────────────────
async function fetchChart(code, period) {
    const end   = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - (period === '2y' ? 2 : 1));

    const fmt = d => d.toISOString().slice(0,10).replace(/-/g,'') + '000000';
    const url = `https://api.stock.naver.com/chart/domestic/day/${code}?startDateTime=${fmt(start)}&endDateTime=${fmt(end)}`;

    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`차트 API 오류: ${res.status}`);
    const json = await res.json();

    const list = json.chartDataList || json || [];
    const data = list.map(d => ({
        date:   fmtDate(d.localDate || d.date),
        open:   parseInt(d.openPrice   || d.open   || 0),
        high:   parseInt(d.highPrice   || d.high   || 0),
        low:    parseInt(d.lowPrice    || d.low    || 0),
        close:  parseInt(d.closePrice  || d.close  || 0),
        volume: parseInt(d.accumulatedTradingVolume || d.volume || 0)
    })).filter(d => d.close > 0);

    return { code, count: data.length, data };
}

function num(s) { return parseInt(String(s || '0').replace(/,/g, '')) || 0; }
function fmtDate(s) {
    const str = String(s || '');
    if (str.length === 8) return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
    return str.slice(0, 10);
}
