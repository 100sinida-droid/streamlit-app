// =========================================================
// realtime_api_full.js - 전체 종목 실시간
// ★ WORKER_URL을 본인 Cloudflare Worker 주소로 변경하세요!
// =========================================================

const WORKER_URL = 'https://krx-proxy.YOUR-ID.workers.dev';
// 예시: 'https://krx-proxy.abc123.workers.dev'

const CACHE = {};
const CACHE_TTL = 60000; // 1분

function isWorkerReady() {
    return WORKER_URL && !WORKER_URL.includes('YOUR-ID');
}

async function callWorker(params) {
    if (!isWorkerReady()) return null;
    
    const url = WORKER_URL + '?' + new URLSearchParams(params);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Worker ${res.status}`);
    return res.json();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 전체 종목 목록 로드 (2,500개+)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function loadRealtimeStockList() {
    const key = '__allStocks__';
    const now = Date.now();
    
    // 1시간 캐시
    if (CACHE[key] && now - CACHE[key].ts < 3600000) {
        console.log(`✓ 캐시: ${CACHE[key].data.length}개 종목`);
        return CACHE[key].data;
    }

    if (!isWorkerReady()) {
        console.warn('⚠️ Worker 미설정 - DB 사용');
        return null;
    }

    try {
        console.log('📡 전체 종목 목록 로딩 중...');
        
        const result = await callWorker({ action: 'list' });
        
        if (!result || !result.stocks) {
            console.warn('종목 목록 로드 실패');
            return null;
        }
        
        CACHE[key] = { ts: now, data: result.stocks };
        
        console.log(`✅ 전체 ${result.total}개 종목 로드 완료`);
        console.log(`   코스피: ${result.stocks.filter(s => s.market === 'KOSPI').length}개`);
        console.log(`   코스닥: ${result.stocks.filter(s => s.market === 'KOSDAQ').length}개`);
        
        return result.stocks;
        
    } catch (error) {
        console.error('종목 목록 로드 실패:', error);
        return null;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 개별 종목 실시간 데이터 (현재가 + 차트)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function fetchRealtimeData(ticker) {
    const code = ticker.replace('.KS', '').replace('.KQ', '');
    const now = Date.now();
    
    // 1분 캐시
    if (CACHE[code] && now - CACHE[code].ts < CACHE_TTL) {
        console.log(`✓ 캐시: ${code}`);
        return CACHE[code].data;
    }

    if (!isWorkerReady()) {
        console.warn('⚠️ Worker 미설정 - DB 사용');
        return null;
    }

    try {
        console.log(`📡 실시간 조회: ${code}`);
        
        const data = await callWorker({ action: 'full', code });
        
        if (!data || !data.price || data.price === 0) {
            console.warn(`데이터 없음: ${code}`);
            return null;
        }
        
        const result = {
            currentPrice: data.price,
            change: data.changePercent,
            changePercent: data.changePercent,
            name: data.name,
            data: data.chartData || []
        };
        
        CACHE[code] = { ts: now, data: result };
        
        console.log(`✅ ${code} = ${data.price.toLocaleString()}원 (${data.changePercent > 0 ? '+' : ''}${data.changePercent}%)`);
        
        return result;
        
    } catch (error) {
        console.error(`실시간 데이터 오류 (${code}):`, error);
        return null;
    }
}

async function fetchRealtimePrice(ticker) {
    return fetchRealtimeData(ticker);
}

// Export
window.isWorkerReady = isWorkerReady;
window.loadRealtimeStockList = loadRealtimeStockList;
window.fetchRealtimeData = fetchRealtimeData;
window.fetchRealtimePrice = fetchRealtimePrice;
