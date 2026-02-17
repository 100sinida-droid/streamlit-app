// =========================================================
// Cloudflare Worker - 한국 주식 실시간 데이터 프록시
// 배포 방법: https://workers.cloudflare.com
// 무료: 하루 100,000건 요청 가능
// =========================================================

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const type = url.searchParams.get('type') || 'price';

    // CORS 헤더 (모든 도메인 허용)
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json; charset=utf-8'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (!code) {
        return new Response(JSON.stringify({ error: 'code 파라미터 필요' }), {
            headers: corsHeaders, status: 400
        });
    }

    try {
        let data;

        if (type === 'chart') {
            // 차트 데이터 (과거 1년)
            data = await fetchNaverChart(code);
        } else {
            // 현재가
            data = await fetchNaverPrice(code);
        }

        return new Response(JSON.stringify(data), { headers: corsHeaders });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: corsHeaders, status: 500
        });
    }
}

// 네이버 현재가
async function fetchNaverPrice(code) {
    const url = `https://m.stock.naver.com/api/stock/${code}/price`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await res.json();

    return {
        code: code,
        name: json.stockName || '',
        price: parseInt(json.closePrice?.replace(/,/g, '') || 0),
        change: parseFloat(json.compareToPreviousClosePrice || 0),
        changePercent: parseFloat(json.fluctuationsRatio || 0),
        open: parseInt(json.openPrice?.replace(/,/g, '') || 0),
        high: parseInt(json.highPrice?.replace(/,/g, '') || 0),
        low: parseInt(json.lowPrice?.replace(/,/g, '') || 0),
        volume: parseInt(json.accumulatedTradingVolume?.replace(/,/g, '') || 0),
        timestamp: new Date().toISOString()
    };
}

// 네이버 차트 데이터 (과거 1년)
async function fetchNaverChart(code) {
    const url = `https://api.stock.naver.com/chart/domestic/day/${code}?startDateTime=20230101000000&endDateTime=20260101000000`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await res.json();

    // 데이터 변환
    const data = (json.chartDataList || json || []).map(item => ({
        date: String(item.localDate || item.date || '').slice(0, 8),
        open: parseInt(item.openPrice || item.open || 0),
        high: parseInt(item.highPrice || item.high || 0),
        low: parseInt(item.lowPrice || item.low || 0),
        close: parseInt(item.closePrice || item.close || 0),
        volume: parseInt(item.accumulatedTradingVolume || item.volume || 0)
    }));

    return { code, data };
}
