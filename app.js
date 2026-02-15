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
        // Yahoo Finance API를 통해 데이터 가져오기
        let data = null;
        
        try {
            data = await fetchStockData(ticker);
        } catch (fetchError) {
            console.warn('실제 데이터 가져오기 실패, 샘플 데이터 사용:', fetchError);
            // 샘플 데이터 생성 (데모용)
            data = generateSampleData(ticker);
            showError('⚠️ 데모 모드: 실제 데이터를 가져올 수 없어 샘플 데이터로 표시합니다. (Yahoo Finance 접속 제한)');
        }
        
        if (!data || data.length < 60) {
            showError('데이터가 부족합니다 (최소 60일 필요). 다른 종목을 선택해주세요.');
            return;
        }

        // 전략 계산
        const strategy = calculateStrategy(data);
        
        // 결과 표시
        displayResults(strategy, data);
        
    } catch (error) {
        console.error('분석 오류:', error);
        
        let errorMessage = '분석 중 오류가 발생했습니다. ';
        errorMessage += '다른 종목을 선택하거나 잠시 후 다시 시도해주세요.';
        
        showError(errorMessage);
    } finally {
        showLoading(false);
    }
}

// =========================================================
// 샘플 데이터 생성 (데모용)
// =========================================================

function generateSampleData(ticker) {
    const data = [];
    const today = new Date();
    const basePrice = 50000 + Math.random() * 100000; // 5만원 ~ 15만원
    
    for (let i = 500; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        // 랜덤 가격 변동 (현실적인 패턴)
        const trend = Math.sin(i / 50) * 0.1; // 장기 추세
        const noise = (Math.random() - 0.5) * 0.05; // 단기 변동
        const priceChange = 1 + trend + noise;
        
        const close = basePrice * priceChange * (1 + (500 - i) * 0.0002);
        const open = close * (1 + (Math.random() - 0.5) * 0.02);
        const high = Math.max(open, close) * (1 + Math.random() * 0.02);
        const low = Math.min(open, close) * (1 - Math.random() * 0.02);
        const volume = Math.floor(1000000 + Math.random() * 5000000);
        
        data.push({
            date: date.toISOString().split('T')[0],
            open: open,
            high: high,
            low: low,
            close: close,
            volume: volume
        });
    }
    
    return data;
}

// =========================================================
// Yahoo Finance 데이터 가져오기 (여러 프록시 시도)
// =========================================================

async function fetchStockData(ticker) {
    // Yahoo Finance API를 사용하여 주식 데이터 가져오기
    const period1 = Math.floor(Date.now() / 1000) - (730 * 24 * 60 * 60); // 2년 전
    const period2 = Math.floor(Date.now() / 1000); // 현재
    
    const targetUrl = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
    
    // 여러 프록시 서버 시도
    const proxies = [
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://cors-anywhere.herokuapp.com/${targetUrl}`
    ];
    
    // 각 프록시를 순차적으로 시도
    for (let i = 0; i < proxies.length; i++) {
        try {
            console.log(`시도 중: 프록시 ${i + 1}/${proxies.length}`);
            
            const response = await fetch(proxies[i], {
                method: 'GET',
                headers: {
                    'Accept': 'text/csv'
                }
            });
            
            if (!response.ok) {
                console.log(`프록시 ${i + 1} 실패: ${response.status}`);
                continue;
            }
            
            const text = await response.text();
            
            // 응답 데이터 검증
            if (!text || text.length < 100 || text.includes('<!DOCTYPE') || text.includes('error')) {
                console.log(`프록시 ${i + 1} 데이터 오류`);
                continue;
            }
            
            console.log(`프록시 ${i + 1} 성공!`);
            return parseCSV(text);
            
        } catch (error) {
            console.error(`프록시 ${i + 1} 오류:`, error);
            // 마지막 프록시가 아니면 다음 프록시 시도
            if (i < proxies.length - 1) {
                continue;
            }
        }
    }
    
    // 모든 프록시 실패 시 대체 방법 시도
    throw new Error('모든 데이터 소스에서 데이터를 가져오는데 실패했습니다.');
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
