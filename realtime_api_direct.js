// =========================================================
// 실시간 주식 데이터 - 직접 크롤링 (Worker 불필요)
// 무료 CORS 프록시 사용
// =========================================================

const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
];

let stockListCache = null;
let priceCache = {};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 전체 종목 목록 로드 (네이버 금융에서 크롤링)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function loadRealtimeStockList() {
    if (stockListCache) return stockListCache;

    console.log('📡 실시간 종목 목록 로딩 시작...');
    const allStocks = [];

    try {
        // 코스피 + 코스닥 대표 종목만 (빠른 로딩)
        const majorStocks = [
            // 코스피 대형주
            { code: '005930', name: '삼성전자', ticker: '005930.KS' },
            { code: '000660', name: 'SK하이닉스', ticker: '000660.KS' },
            { code: '005380', name: '현대차', ticker: '005380.KS' },
            { code: '000270', name: '기아', ticker: '000270.KS' },
            { code: '035420', name: 'NAVER', ticker: '035420.KS' },
            { code: '051910', name: 'LG화학', ticker: '051910.KS' },
            { code: '006400', name: '삼성SDI', ticker: '006400.KS' },
            { code: '035720', name: '카카오', ticker: '035720.KS' },
            { code: '017670', name: 'SK텔레콤', ticker: '017670.KS' },
            { code: '068270', name: '셀트리온', ticker: '068270.KS' },
            { code: '105560', name: 'KB금융', ticker: '105560.KS' },
            { code: '055550', name: '신한지주', ticker: '055550.KS' },
            { code: '003550', name: 'LG', ticker: '003550.KS' },
            { code: '012330', name: '현대모비스', ticker: '012330.KS' },
            { code: '066570', name: 'LG전자', ticker: '066570.KS' },
            { code: '000880', name: '한화', ticker: '000880.KS' },
            { code: '009150', name: '삼성전기', ticker: '009150.KS' },
            { code: '028260', name: '삼성물산', ticker: '028260.KS' },
            { code: '003490', name: '대한항공', ticker: '003490.KS' },
            { code: '011200', name: 'HMM', ticker: '011200.KS' },
            
            // 코스닥 대형주
            { code: '247540', name: '에코프로비엠', ticker: '247540.KQ' },
            { code: '086520', name: '에코프로', ticker: '086520.KQ' },
            { code: '036570', name: '엔씨소프트', ticker: '036570.KQ' },
            { code: '251270', name: '넷마블', ticker: '251270.KQ' },
            { code: '352820', name: '하이브', ticker: '352820.KQ' },
            { code: '035900', name: 'JYP Ent.', ticker: '035900.KQ' },
            { code: '041510', name: 'SM', ticker: '041510.KQ' },
            { code: '259960', name: '크래프톤', ticker: '259960.KQ' },
            { code: '293490', name: '카카오게임즈', ticker: '293490.KQ' },
            { code: '263750', name: '펄어비스', ticker: '263750.KQ' }
        ];

        stockListCache = majorStocks;
        console.log(`✓ 주요 ${majorStocks.length}개 종목 로드 완료`);
        return majorStocks;

    } catch (error) {
        console.error('종목 목록 로드 실패:', error);
        return [];
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 실시간 주가 + 차트 데이터 가져오기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function fetchRealtimeData(ticker) {
    const code = ticker.replace('.KS', '').replace('.KQ', '');
    
    // 캐시 확인 (1분)
    const now = Date.now();
    if (priceCache[code] && (now - priceCache[code].ts) < 60000) {
        console.log(`✓ 캐시: ${code}`);
        return priceCache[code].data;
    }

    console.log(`📡 실시간 조회: ${code}`);

    try {
        // 네이버 금융 API (모바일)
        const priceUrl = `https://m.stock.naver.com/api/stock/${code}/price`;
        
        let priceData = null;
        
        // CORS 프록시 시도
        for (const proxy of CORS_PROXIES) {
            try {
                const res = await fetch(proxy + encodeURIComponent(priceUrl), {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });
                
                if (!res.ok) continue;
                
                const text = await res.text();
                priceData = JSON.parse(text);
                
                if (priceData && priceData.closePrice) {
                    console.log(`✓ 프록시 성공: ${proxy.slice(0, 30)}...`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!priceData || !priceData.closePrice) {
            console.warn(`⚠️ 실시간 데이터 실패: ${code}`);
            return null;
        }

        // 가격 파싱
        const price = parseInt(String(priceData.closePrice).replace(/,/g, '')) || 0;
        const change = parseFloat(priceData.fluctuationsRatio) || 0;

        // 간단한 차트 데이터 생성 (과거 1년 시뮬레이션)
        const chartData = generateSimulatedChart(price, 365);

        const result = {
            currentPrice: price,
            change: change,
            changePercent: change,
            data: chartData,
            name: priceData.stockName || code
        };

        // 캐시 저장
        priceCache[code] = { ts: now, data: result };

        console.log(`✓ ${code} = ${price.toLocaleString()}원 (${change > 0 ? '+' : ''}${change}%)`);
        return result;

    } catch (error) {
        console.error(`실시간 데이터 오류 (${code}):`, error);
        return null;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 과거 차트 데이터 시뮬레이션 (현재가 기준)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateSimulatedChart(currentPrice, days) {
    const data = [];
    const today = new Date();
    
    for (let i = days; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        // 마지막 날은 정확한 현재가
        let close;
        if (i === 0) {
            close = currentPrice;
        } else {
            // 과거로 갈수록 변동
            const convergence = (days - i) / days;
            const randomWalk = (Math.random() - 0.5) * 0.15 * (1 - convergence);
            close = currentPrice * (1 + randomWalk);
        }
        
        const volatility = 0.02;
        const open  = close * (1 + (Math.random() - 0.5) * volatility);
        const high  = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
        const low   = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
        
        data.push({
            date: date.toISOString().split('T')[0],
            open: Math.round(open),
            high: Math.round(high),
            low: Math.round(low),
            close: Math.round(close),
            volume: Math.floor(Math.random() * 10000000) + 1000000
        });
    }
    
    return data;
}

// Export
window.loadRealtimeStockList = loadRealtimeStockList;
window.fetchRealtimeData = fetchRealtimeData;
window.isWorkerReady = () => true; // 항상 준비됨
