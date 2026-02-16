// =========================================================
// 클라이언트 사이드 실시간 주식 데이터 로드
// =========================================================

// CORS 프록시 서버들
const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest='
];

// 네이버 금융 크롤링 (가장 안정적)
async function fetchNaverFinance(ticker) {
    const stockCode = ticker.replace('.KS', '').replace('.KQ', '');
    
    try {
        console.log(`네이버 금융에서 ${stockCode} 데이터 가져오는 중...`);
        
        // 네이버 금융 API (비공식)
        const naverUrl = `https://m.stock.naver.com/api/stock/${stockCode}/price`;
        
        // 첫 번째 프록시만 빠르게 시도 (타임아웃 3초)
        const proxy = CORS_PROXIES[0];
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃
        
        try {
            const response = await fetch(proxy + encodeURIComponent(naverUrl), {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data && data.closePrice) {
                    console.log(`✓ 네이버 금융 성공: ${data.closePrice}원`);
                    return {
                        currentPrice: parseInt(data.closePrice),
                        change: parseFloat(data.compareToPreviousClosePrice),
                        changePercent: parseFloat(data.fluctuationsRatio)
                    };
                }
            }
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') {
                console.log('⏱️ 타임아웃 (3초 초과)');
            }
        }
    } catch (error) {
        console.log('네이버 금융 실패:', error.message);
    }
    
    return null;
}

// Alpha Vantage API (무료, 하루 500회 제한)
async function fetchAlphaVantage(ticker) {
    const API_KEYS = [
        'demo',  // 데모 키
        // 사용자가 발급받은 키 추가 가능
    ];
    
    const symbol = ticker.replace('.KS', '.KRX').replace('.KQ', '.KRX');
    
    for (const apiKey of API_KEYS) {
        try {
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data['Global Quote'] && data['Global Quote']['05. price']) {
                const price = parseFloat(data['Global Quote']['05. price']);
                const change = parseFloat(data['Global Quote']['09. change']);
                const changePercent = parseFloat(data['Global Quote']['10. change percent'].replace('%', ''));
                
                return {
                    currentPrice: Math.round(price),
                    change: Math.round(change),
                    changePercent: changePercent
                };
            }
        } catch (error) {
            continue;
        }
    }
    
    return null;
}

// 한국거래소 KRX 공개 데이터 (CORS 프록시 사용)
async function fetchKRXData(ticker) {
    const stockCode = ticker.replace('.KS', '').replace('.KQ', '');
    
    try {
        // KRX 시세 조회 URL
        const krxUrl = `http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd`;
        
        const formData = new FormData();
        formData.append('bld', 'dbms/MDC/STAT/standard/MDCSTAT01501');
        formData.append('isuCd', stockCode);
        formData.append('locale', 'ko_KR');
        
        for (const proxy of CORS_PROXIES) {
            try {
                const response = await fetch(proxy + encodeURIComponent(krxUrl), {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) continue;
                
                const data = await response.json();
                
                if (data && data.TDD_CLSPRC) {
                    return {
                        currentPrice: parseInt(data.TDD_CLSPRC),
                        change: parseInt(data.CMPPREVDD_PRC),
                        changePercent: parseFloat(data.FLUC_RT)
                    };
                }
            } catch (e) {
                continue;
            }
        }
    } catch (error) {
        console.log('KRX 데이터 실패:', error.message);
    }
    
    return null;
}

// 메인: 실시간 데이터 가져오기 (선택적)
async function fetchRealtimePrice(ticker) {
    // 실시간 API 사용 여부 (성능 최적화를 위해 기본 OFF)
    const USE_REALTIME_API = false;  // true로 변경하면 실시간 가격 조회
    
    if (!USE_REALTIME_API) {
        console.log('⚡ 빠른 분석 모드 (DB 데이터 사용)');
        return null;
    }
    
    console.log(`\n${ticker} 실시간 가격 조회 시작...`);
    
    // 방법 1: 네이버 금융 (3초 타임아웃)
    let result = await fetchNaverFinance(ticker);
    if (result) return result;
    
    console.log('⚠️ 실시간 API 실패, DB 데이터 사용');
    return null;  // null이면 기존 DB 데이터 사용
}

// Export
window.fetchRealtimePrice = fetchRealtimePrice;
