// =========================================================
// 실시간 주식 데이터 - Cloudflare Worker 연동
// =========================================================

// ★ 여기에 본인의 Cloudflare Worker URL을 넣으세요
// 배포 후 예시: https://krx-proxy.YOUR-ID.workers.dev
const WORKER_URL = 'https://krx-proxy.YOUR-ID.workers.dev';

// 캐시 (같은 종목 반복 조회 방지)
const priceCache = {};
const CACHE_TTL = 60 * 1000; // 1분 캐시

// ─────────────────────────────────────────────
// 현재가 + 차트 데이터 한번에 가져오기
// ─────────────────────────────────────────────
async function fetchRealtimeData(ticker) {
    const code = ticker.replace('.KS', '').replace('.KQ', '');
    const now = Date.now();

    // 캐시 확인
    if (priceCache[code] && (now - priceCache[code].ts) < CACHE_TTL) {
        console.log(`✓ 캐시에서 로드: ${code}`);
        return priceCache[code].data;
    }

    // Worker URL이 설정되지 않으면 null 반환 → DB 사용
    if (!WORKER_URL || WORKER_URL.includes('YOUR-ID')) {
        return null;
    }

    try {
        // 현재가 + 차트 병렬 요청
        const [priceRes, chartRes] = await Promise.all([
            fetch(`${WORKER_URL}?code=${code}&type=price`),
            fetch(`${WORKER_URL}?code=${code}&type=chart`)
        ]);

        if (!priceRes.ok || !chartRes.ok) return null;

        const priceData = await priceRes.json();
        const chartData = await chartRes.json();

        if (!priceData.price || priceData.price === 0) return null;

        // 날짜 포맷 변환 (20240101 → 2024-01-01)
        const formattedChart = (chartData.data || []).map(d => ({
            date: `${String(d.date).slice(0,4)}-${String(d.date).slice(4,6)}-${String(d.date).slice(6,8)}`,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume
        })).filter(d => d.close > 0);

        const result = {
            currentPrice: priceData.price,
            change: priceData.change,
            changePercent: priceData.changePercent,
            open: priceData.open,
            high: priceData.high,
            low: priceData.low,
            volume: priceData.volume,
            chartData: formattedChart
        };

        // 캐시 저장
        priceCache[code] = { ts: now, data: result };

        console.log(`✓ 실시간 데이터: ${code} = ${priceData.price.toLocaleString()}원`);
        return result;

    } catch (e) {
        console.warn('실시간 API 오류:', e.message);
        return null;
    }
}

// 현재가만 빠르게
async function fetchRealtimePrice(ticker) {
    return await fetchRealtimeData(ticker);
}

window.fetchRealtimeData = fetchRealtimeData;
window.fetchRealtimePrice = fetchRealtimePrice;
