// =========================================================
// Cloudflare Worker - 전체 종목 + 실시간 데이터
// =========================================================

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
};

async function handleRequest(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const code = url.searchParams.get('code');

    try {
        let result;

        if (action === 'list') {
            // 전체 종목 목록
            result = await fetchAllStocks();
        } else if (action === 'price' && code) {
            // 개별 종목 현재가
            result = await fetchPrice(code);
        } else if (action === 'chart' && code) {
            // 차트 데이터
            result = await fetchChart(code);
        } else if (action === 'full' && code) {
            // 현재가 + 차트
            const [price, chart] = await Promise.all([
                fetchPrice(code),
                fetchChart(code)
            ]);
            result = { ...price, chartData: chart.data };
        } else {
            return new Response(JSON.stringify({ error: 'Invalid action' }), {
                headers: CORS, status: 400
            });
        }

        return new Response(JSON.stringify(result), { headers: CORS });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: CORS, status: 500
        });
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 전체 종목 목록 크롤링 (코스피 + 코스닥)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function fetchAllStocks() {
    const allStocks = [];
    
    // 코스피 (sosok=0) + 코스닥 (sosok=1)
    for (const market of [0, 1]) {
        const marketName = market === 0 ? 'KOSPI' : 'KOSDAQ';
        
        for (let page = 1; page <= 40; page++) {
            const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${market}&page=${page}`;
            
            try {
                const res = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://finance.naver.com/'
                    }
                });
                
                if (!res.ok) break;
                
                const html = await res.text();
                
                // HTML 파싱 (정규식)
                const regex = /href="\/item\/main\.naver\?code=([0-9]+)"[^>]*>\s*([^<]+)\s*<\/a>/g;
                let match;
                let foundInPage = 0;
                
                while ((match = regex.exec(html)) !== null) {
                    const code = match[1];
                    const name = match[2].trim();
                    
                    if (code && name && name.length > 0) {
                        allStocks.push({
                            code: code,
                            name: name,
                            ticker: `${code}.${market === 0 ? 'KS' : 'KQ'}`,
                            market: marketName
                        });
                        foundInPage++;
                    }
                }
                
                // 더 이상 종목이 없으면 중단
                if (foundInPage === 0) break;
                
            } catch (e) {
                console.error(`Page ${page} error:`, e);
                break;
            }
        }
    }
    
    return {
        total: allStocks.length,
        updated: new Date().toISOString(),
        stocks: allStocks
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 개별 종목 현재가
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function fetchPrice(code) {
    const url = `https://m.stock.naver.com/api/stock/${code}/price`;
    
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!res.ok) throw new Error(`Price API error: ${res.status}`);
    
    const data = await res.json();
    
    return {
        code: code,
        name: data.stockName || '',
        price: parseNum(data.closePrice),
        change: parseNum(data.compareToPreviousClosePrice),
        changePercent: parseFloat(data.fluctuationsRatio || 0),
        open: parseNum(data.openPrice),
        high: parseNum(data.highPrice),
        low: parseNum(data.lowPrice),
        volume: parseNum(data.accumulatedTradingVolume),
        time: new Date().toISOString()
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 차트 데이터 (일봉 2년)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function fetchChart(code) {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 2);
    
    const fmt = d => d.toISOString().slice(0,10).replace(/-/g,'') + '000000';
    
    const url = `https://api.stock.naver.com/chart/domestic/day/${code}?startDateTime=${fmt(start)}&endDateTime=${fmt(end)}`;
    
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!res.ok) throw new Error(`Chart API error: ${res.status}`);
    
    const json = await res.json();
    const list = json.chartDataList || json || [];
    
    const data = list.map(d => ({
        date: formatDate(d.localDate || d.date),
        open: parseInt(d.openPrice || d.open || 0),
        high: parseInt(d.highPrice || d.high || 0),
        low: parseInt(d.lowPrice || d.low || 0),
        close: parseInt(d.closePrice || d.close || 0),
        volume: parseInt(d.accumulatedTradingVolume || d.volume || 0)
    })).filter(d => d.close > 0);
    
    return { code, count: data.length, data };
}

function parseNum(str) {
    return parseInt(String(str || '0').replace(/,/g, '')) || 0;
}

function formatDate(str) {
    const s = String(str || '');
    if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    return s.slice(0, 10);
}
