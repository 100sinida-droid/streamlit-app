// =========================================================
// KRX AI 매매 전략 분석기 - 웹 애플리케이션
// =========================================================

let currentChart = null;
let allStocks = koreaStocks;

// =========================================================
// 초기화
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    loadStockList(allStocks);
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    document.getElementById('analyzeBtn').addEventListener('click', analyzeStock);
}

// =========================================================
// 종목 검색 및 로딩
// =========================================================

function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    if (!searchTerm) {
        loadStockList(allStocks);
        return;
    }

    // 대소문자 구분 없이 검색
    const filtered = allStocks.filter(stock => 
        stock.search.toLowerCase().includes(searchTerm.toLowerCase())
    );

    loadStockList(filtered);
    
    // 검색 결과 표시
    if (filtered.length === 0) {
        showError(`"${searchTerm}"에 대한 검색 결과가 없습니다.`);
    } else {
        hideError();
    }
}

function loadStockList(stocks) {
    const select = document.getElementById('stockSelect');
    select.innerHTML = '<option value="">종목을 선택하세요</option>';
    
    stocks.forEach(stock => {
        const option = document.createElement('option');
        option.value = stock.ticker;
        option.textContent = `${stock.name} (${stock.ticker})`;
        select.appendChild(option);
    });
}

// =========================================================
// 주식 분석 메인 함수
// =========================================================

async function analyzeStock() {
    const ticker = document.getElementById('stockSelect').value;
    
    if (!ticker) {
        showError('종목을 선택해주세요.');
        return;
    }

    showLoading(true);
    hideError();
    hideResults();

    try {
        // 실제 데이터만 가져오기 (샘플 데이터 사용 안 함)
        const data = await fetchStockData(ticker);
        
        if (!data || data.length < 60) {
            showError('데이터가 부족합니다 (최소 60일 필요). 다른 종목을 선택해주세요.');
            return;
        }

        console.log(`✓ 실제 데이터 ${data.length}일 로드 성공`);

        // 전략 계산
        const strategy = calculateStrategy(data);
        
        // 결과 표시
        displayResults(strategy, data);
        
    } catch (error) {
        console.error('분석 오류:', error);
        
        let errorMessage = '❌ 실제 주식 데이터를 가져올 수 없습니다.\n\n';
        errorMessage += '🔍 시도한 방법:\n';
        errorMessage += '1. Yahoo Finance Query API\n';
        errorMessage += '2. Yahoo Finance Chart API\n';
        errorMessage += '3. Yahoo Finance CSV 직접 다운로드\n\n';
        errorMessage += '💡 해결 방법:\n';
        errorMessage += '• 다른 종목을 선택해보세요\n';
        errorMessage += '• 페이지를 새로고침 해보세요\n';
        errorMessage += '• 잠시 후 다시 시도해주세요\n';
        errorMessage += '• 다른 브라우저를 사용해보세요\n\n';
        errorMessage += '⚠️ Yahoo Finance 서버가 일시적으로 접근을 차단했을 수 있습니다.';
        
        showError(errorMessage);
    } finally {
        showLoading(false);
    }
}

// =========================================================
// 실제 주식 데이터 가져오기 (한국 거래소 중심)
// =========================================================

async function fetchStockData(ticker) {
    console.log(`${ticker} 실제 데이터 가져오기 시작...`);
    
    // 방법 1: Yahoo Finance - 조정 안 된 원본 가격 사용
    try {
        console.log('방법 1: Yahoo Finance 원본 가격 시도...');
        const data = await fetchYahooRawPrice(ticker);
        if (data && data.length >= 60) {
            console.log(`✓ Yahoo Finance 실제 가격 성공! (${data.length}일)`);
            return data;
        }
    } catch (error) {
        console.log('✗ Yahoo Finance 실패:', error.message);
    }
    
    // 방법 2: Yahoo Finance Chart API (Close 가격)
    try {
        console.log('방법 2: Yahoo Finance Chart API 시도...');
        const data = await fetchYahooChartRaw(ticker);
        if (data && data.length >= 60) {
            console.log(`✓ Chart API 성공! (${data.length}일)`);
            return data;
        }
    } catch (error) {
        console.log('✗ Chart API 실패:', error.message);
    }
    
    // 방법 3: 네이버 금융 API (한국 전용)
    try {
        console.log('방법 3: 네이버 금융 API 시도...');
        const data = await fetchNaverFinance(ticker);
        if (data && data.length >= 60) {
            console.log(`✓ 네이버 금융 성공! (${data.length}일)`);
            return data;
        }
    } catch (error) {
        console.log('✗ 네이버 금융 실패:', error.message);
    }
    
    throw new Error('실제 데이터를 가져올 수 없습니다.');
}

// Yahoo Finance - 원본 가격 (조정 안 됨)
async function fetchYahooRawPrice(ticker) {
    const period1 = Math.floor(Date.now() / 1000) - (730 * 24 * 60 * 60);
    const period2 = Math.floor(Date.now() / 1000);
    
    // CSV 다운로드 - 원본 Close 가격 사용
    const url = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
    
    const proxies = [
        '',
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://corsproxy.io/?',
    ];
    
    for (const proxy of proxies) {
        try {
            const fetchUrl = proxy ? proxy + encodeURIComponent(url) : url;
            const response = await fetch(fetchUrl);
            
            if (!response.ok) continue;
            
            const text = await response.text();
            
            if (text.includes('<!DOCTYPE') || text.includes('<html') || text.length < 100) {
                continue;
            }
            
            const lines = text.trim().split('\n');
            if (lines.length < 2) continue;
            
            const headers = lines[0].split(',');
            const dateIdx = headers.indexOf('Date');
            const openIdx = headers.indexOf('Open');
            const highIdx = headers.indexOf('High');
            const lowIdx = headers.indexOf('Low');
            const closeIdx = headers.indexOf('Close'); // 조정 안 된 원본 가격
            const volumeIdx = headers.indexOf('Volume');
            
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                
                if (values.length >= 6) {
                    const close = parseFloat(values[closeIdx]);
                    
                    if (!isNaN(close) && close > 0) {
                        data.push({
                            date: values[dateIdx],
                            open: parseFloat(values[openIdx]) || close,
                            high: parseFloat(values[highIdx]) || close,
                            low: parseFloat(values[lowIdx]) || close,
                            close: close, // 원본 Close 가격 사용!
                            volume: parseInt(values[volumeIdx]) || 0
                        });
                    }
                }
            }
            
            if (data.length >= 60) {
                console.log(`실제 종가: ${data[data.length - 1].close.toLocaleString()}원`);
                return data;
            }
        } catch (error) {
            continue;
        }
    }
    
    throw new Error('CSV 다운로드 실패');
}

// Yahoo Finance Chart API - 원본 가격
async function fetchYahooChartRaw(ticker) {
    const period1 = Math.floor(Date.now() / 1000) - (730 * 24 * 60 * 60);
    const period2 = Math.floor(Date.now() / 1000);
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
    
    const proxies = [
        '',
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
    ];
    
    for (const proxy of proxies) {
        try {
            const fetchUrl = proxy ? proxy + encodeURIComponent(url) : url;
            const response = await fetch(fetchUrl);
            
            if (!response.ok) continue;
            
            const json = await response.json();
            
            if (json.chart && json.chart.result && json.chart.result[0]) {
                const result = json.chart.result[0];
                const timestamps = result.timestamp;
                const quotes = result.indicators.quote[0];
                
                if (!timestamps || timestamps.length === 0) continue;
                
                const data = [];
                
                for (let i = 0; i < timestamps.length; i++) {
                    // 원본 close 가격 사용 (adjusted 아님)
                    const close = quotes.close[i];
                    
                    if (close !== null && !isNaN(close) && close > 0) {
                        const date = new Date(timestamps[i] * 1000);
                        data.push({
                            date: date.toISOString().split('T')[0],
                            open: quotes.open[i] || close,
                            high: quotes.high[i] || close,
                            low: quotes.low[i] || close,
                            close: close, // 원본 종가
                            volume: quotes.volume[i] || 0
                        });
                    }
                }
                
                if (data.length >= 60) {
                    console.log(`실제 종가: ${data[data.length - 1].close.toLocaleString()}원`);
                    return data;
                }
            }
        } catch (error) {
            continue;
        }
    }
    
    throw new Error('Chart API 실패');
}

// 네이버 금융 API (한국 전용)
async function fetchNaverFinance(ticker) {
    // 티커에서 종목 코드 추출
    const stockCode = ticker.replace('.KS', '').replace('.KQ', '');
    
    // 네이버 금융 API
    const url = `https://api.finance.naver.com/siseJson.naver?symbol=${stockCode}&requestType=1&startTime=20220101&endTime=20251231&timeframe=day`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('네이버 API 오류');
        
        const text = await response.text();
        
        // JSON 파싱
        const jsonText = text.replace(/'/g, '"');
        const jsonData = JSON.parse(jsonText);
        
        const data = [];
        
        // 첫 번째 행은 헤더
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            if (row && row.length >= 6) {
                const date = row[0]; // 날짜
                const close = parseFloat(row[4]); // 종가
                
                if (!isNaN(close) && close > 0) {
                    data.push({
                        date: date,
                        open: parseFloat(row[1]) || close,
                        high: parseFloat(row[2]) || close,
                        low: parseFloat(row[3]) || close,
                        close: close,
                        volume: parseInt(row[5]) || 0
                    });
                }
            }
        }
        
        if (data.length >= 60) {
            return data;
        }
    } catch (error) {
        throw error;
    }
    
    throw new Error('네이버 금융 데이터 없음');
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');
    
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        
        if (values.length >= 6) {
            const close = parseFloat(values[4]); // Adj Close
            const volume = parseFloat(values[5]);
            
            if (!isNaN(close) && close > 0) {
                data.push({
                    date: values[0],
                    open: parseFloat(values[1]),
                    high: parseFloat(values[2]),
                    low: parseFloat(values[3]),
                    close: close,
                    volume: volume
                });
            }
        }
    }
    
    return data;
}

// =========================================================
// 전략 계산 (AI 로직)
// =========================================================

function calculateStrategy(data) {
    const closePrices = data.map(d => d.close);
    const current = closePrices[closePrices.length - 1];
    
    // 이동평균 계산
    const ma20 = calculateMA(closePrices, 20);
    const ma60 = calculateMA(closePrices, 60);
    
    // 변동성 계산
    const returns = [];
    for (let i = 1; i < closePrices.length; i++) {
        returns.push((closePrices[i] - closePrices[i-1]) / closePrices[i-1]);
    }
    const volatility = calculateStdDev(returns);
    
    // 전략 가격 계산
    const buy = ma20 * 0.98;
    const stop = buy * (1 - volatility * 3);
    const target = buy * 1.20;
    const future = ma60 * 1.10;
    
    return {
        current,
        buy,
        stop,
        target,
        future,
        ma20,
        ma60,
        volatility
    };
}

function calculateMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    
    const slice = prices.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

function calculateStdDev(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
}

// =========================================================
// 결과 표시
// =========================================================

function displayResults(strategy, data) {
    // 메트릭 표시
    document.getElementById('currentPrice').textContent = formatPrice(strategy.current);
    document.getElementById('buyPrice').textContent = formatPrice(strategy.buy);
    document.getElementById('stopPrice').textContent = formatPrice(strategy.stop);
    document.getElementById('targetPrice').textContent = formatPrice(strategy.target);
    
    // 차트 그리기
    drawChart(data, strategy);
    
    // AI 분석 표시
    displayAIAnalysis(strategy);
    
    // 결과 섹션 표시
    document.getElementById('resultsSection').style.display = 'block';
    
    // 스크롤
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

function formatPrice(price) {
    return new Intl.NumberFormat('ko-KR', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price) + '원';
}

// =========================================================
// 차트 그리기
// =========================================================

function drawChart(data, strategy) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    // 기존 차트 제거
    if (currentChart) {
        currentChart.destroy();
    }
    
    // MA 계산
    const ma20Data = calculateMAArray(data.map(d => d.close), 20);
    const ma60Data = calculateMAArray(data.map(d => d.close), 60);
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [
                {
                    label: '종가',
                    data: data.map(d => d.close),
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'MA20',
                    data: ma20Data,
                    borderColor: 'rgb(72, 187, 120)',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'MA60',
                    data: ma60Data,
                    borderColor: 'rgb(237, 137, 54)',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatPrice(context.parsed.y);
                            return label;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        buyLine: {
                            type: 'line',
                            yMin: strategy.buy,
                            yMax: strategy.buy,
                            borderColor: 'rgb(72, 187, 120)',
                            borderWidth: 2,
                            borderDash: [10, 5],
                            label: {
                                content: 'BUY',
                                enabled: true,
                                position: 'end'
                            }
                        },
                        stopLine: {
                            type: 'line',
                            yMin: strategy.stop,
                            yMax: strategy.stop,
                            borderColor: 'rgb(245, 101, 101)',
                            borderWidth: 2,
                            borderDash: [2, 2],
                            label: {
                                content: 'STOP',
                                enabled: true,
                                position: 'end'
                            }
                        },
                        targetLine: {
                            type: 'line',
                            yMin: strategy.target,
                            yMax: strategy.target,
                            borderColor: 'rgb(237, 137, 54)',
                            borderWidth: 2,
                            borderDash: [10, 5],
                            label: {
                                content: 'TARGET',
                                enabled: true,
                                position: 'end'
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return formatPrice(value);
                        }
                    }
                }
            }
        }
    });
    
    ctx.canvas.style.height = '500px';
}

function calculateMAArray(prices, period) {
    const result = [];
    
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const slice = prices.slice(i - period + 1, i + 1);
            const avg = slice.reduce((a, b) => a + b, 0) / period;
            result.push(avg);
        }
    }
    
    return result;
}

// =========================================================
// AI 분석 텍스트 생성
// =========================================================

function displayAIAnalysis(strategy) {
    const html = `
        <h3>📉 매수 추천가 (${formatPrice(strategy.buy)})</h3>
        <p>→ 20일 이동평균선 근처 지지구간.</p>
        <p>→ 단기 과매도 반등 확률 높은 위치.</p>
        
        <h3>🛑 손절가 (${formatPrice(strategy.stop)})</h3>
        <p>→ 변동성(${(strategy.volatility * 100).toFixed(2)}%) 기반 리스크 관리 가격.</p>
        <p>→ 추세 붕괴 시 자동 방어 구간.</p>
        
        <h3>🎯 목표가 (${formatPrice(strategy.target)})</h3>
        <p>→ 평균 회귀 + 기술적 저항선 예상 구간.</p>
        <p>→ 약 +20% 수익 실현 전략.</p>
        
        <h3>📊 현재 상태</h3>
        <p><strong>현재가:</strong> ${formatPrice(strategy.current)}</p>
        <p><strong>MA20:</strong> ${formatPrice(strategy.ma20)}</p>
        <p><strong>MA60:</strong> ${formatPrice(strategy.ma60)}</p>
        
        <p style="margin-top: 20px;">👉 단기 눌림목 매수 전략</p>
        <p>👉 스윙 트레이딩 적합</p>
    `;
    
    document.getElementById('aiComment').innerHTML = html;
}

// =========================================================
// UI 헬퍼 함수
// =========================================================

function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
    document.getElementById('analyzeBtn').disabled = show;
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

function hideResults() {
    document.getElementById('resultsSection').style.display = 'none';
}
