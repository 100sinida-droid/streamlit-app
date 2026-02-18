// =========================================================
// realtime_api.js  ─  Cloudflare Worker 연동
// ★ WORKER_URL 을 본인 Worker 주소로 변경하세요!
// =========================================================

const WORKER_URL = 'https://krx-proxy.YOUR-ID.workers.dev';
// 예) 'https://krx-proxy.abc123xy.workers.dev'

const CACHE = {};           // 메모리 캐시
const CACHE_TTL = 60_000;  // 1분

// ── Worker 준비됐는지 확인 ────────────────────────────────
function isWorkerReady() {
    return WORKER_URL && !WORKER_URL.includes('YOUR-ID');
}

// ── GET 요청 헬퍼 ────────────────────────────────────────
async function get(params) {
    const url = WORKER_URL + '?' + new URLSearchParams(params);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Worker ${res.status}`);
    return res.json();
}

// ──────────────────────────────────────────────────────────
// 전체 종목 목록 로드 (앱 초기화 시 1번만 호출)
// ──────────────────────────────────────────────────────────
async function loadRealtimeStockList() {
    if (!isWorkerReady()) return null;

    const key = '__stockList__';
    const now = Date.now();
    if (CACHE[key] && now - CACHE[key].ts < 3_600_000) { // 1시간 캐시
        return CACHE[key].data;
    }

    try {
        console.log('📡 전체 종목 목록 로딩 중...');
        const data = await get({ action: 'list', market: 'ALL' });
        CACHE[key] = { ts: now, data: data.stocks };
        console.log(`✓ 실시간 종목 목록: ${data.total}개`);
        return data.stocks;
    } catch (e) {
        console.warn('종목 목록 로드 실패:', e.message);
        return null;
    }
}

// ──────────────────────────────────────────────────────────
// 현재가 + 차트 전체 데이터 조회
// ──────────────────────────────────────────────────────────
async function fetchRealtimeData(ticker) {
    if (!isWorkerReady()) return null;

    const code = ticker.replace('.KS', '').replace('.KQ', '');
    const now  = Date.now();

    if (CACHE[code] && now - CACHE[code].ts < CACHE_TTL) {
        return CACHE[code].data;
    }

    try {
        const data = await get({ action: 'full', code });
        if (!data.price || data.price === 0) return null;

        CACHE[code] = { ts: now, data };
        console.log(`✓ 실시간: ${code} = ${data.price.toLocaleString()}원`);
        return data;
    } catch (e) {
        console.warn(`실시간 데이터 실패 (${code}):`, e.message);
        return null;
    }
}

// ──────────────────────────────────────────────────────────
// 현재가만 빠르게 조회
// ──────────────────────────────────────────────────────────
async function fetchRealtimePrice(ticker) {
    return fetchRealtimeData(ticker);
}

window.isWorkerReady       = isWorkerReady;
window.loadRealtimeStockList = loadRealtimeStockList;
window.fetchRealtimeData   = fetchRealtimeData;
window.fetchRealtimePrice  = fetchRealtimePrice;
