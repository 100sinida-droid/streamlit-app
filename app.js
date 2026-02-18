// =========================================================
// KRX AI 매매 전략 분석기
// 실시간 모드: Cloudflare Worker 설정 시 실제 데이터 사용
// 오프라인 모드: JSON DB 사용 (Worker 미설정 시 자동 전환)
// =========================================================

let currentChart = null;
let allStocks    = [];
let stockDatabase = null;

// =========================================================
// 초기화
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
    showStatus('데이터 로딩 중...', 'loading');

    // 1. Worker 준비됐으면 실시간 종목 목록 먼저 시도
    if (window.isWorkerReady && window.isWorkerReady()) {
        console.log('🌐 실시간 모드 활성화');
        const rtList = await window.loadRealtimeStockList();
        if (rtList && rtList.length > 0) {
            allStocks = rtList.map(s => ({
                name:   s.name,
                ticker: s.ticker,
                search: `${s.name} ${s.code}`.toLowerCase()
            }));
            loadStockList(allStocks);
            showStatus(`실시간: ${allStocks.length}개 종목 로드 완료`, 'done');
            setupEventListeners();
            return;
        }
    }

    // 2. Worker 없거나 실패 → JSON DB 사용
    console.log('📂 오프라인 DB 모드');
    await loadStockDatabase();
    createStockListFromDB();
    setupEventListeners();
    showStatus('', 'done');
});

function showStatus(msg, type) {
    const el = document.getElementById('statusMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

// =========================================================
// JSON DB 로드 (오프라인 폴백)
// =========================================================
async function loadStockDatabase() {
    if (stockDatabase) return stockDatabase;
    try {
        const parts = await Promise.all(
            [1,2,3,4,5,6,7,8].map(i =>
                fetch(`stock_database_part${i}.json`).then(r => r.json()).catch(() => ({}))
            )
        );
        stockDatabase = Object.assign({}, ...parts);
        console.log(`✓ DB 로드 완료: ${Object.keys(stockDatabase).length}개`);
    } catch (e) {
        console.error('DB 로드 실패:', e);
        stockDatabase = {};
    }
    return stockDatabase;
}

function createStockListFromDB() {
    allStocks = Object.entries(stockDatabase).map(([ticker, info]) => ({
        name:   info.name,
        ticker,
        search: `${info.name} ${ticker.replace('.KS','').replace('.KQ','')}`.toLowerCase()
    }));
    console.log(`✓ 종목 리스트 생성: ${allStocks.length}개`);
    loadStockList(allStocks);
}

// =========================================================
// 이벤트
// =========================================================
function setupEventListeners() {
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('searchInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSearch();
    });
    document.getElementById('analyzeBtn').addEventListener('click', analyzeStock);
}

// =========================================================
// 종목 검색
// =========================================================
function handleSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!query) {
        loadStockList(allStocks);
        return;
    }
    const filtered = allStocks.filter(s => s.search.includes(query));
    loadStockList(filtered);

    if (filtered.length === 0) {
        const msgEl = document.getElementById('searchMessage');
        if (msgEl) msgEl.innerHTML = `<div class="no-result">"${query}"에 대한 검색 결과가 없습니다.</div>`;
    }
}

function loadStockList(stocks) {
    const select = document.getElementById('stockSelect');
    const msg    = document.getElementById('searchMessage');

    if (!select) return;

    select.innerHTML = '<option value="">종목을 선택하세요</option>';

    if (stocks.length === 0) {
        if (msg) msg.style.display = 'block';
        return;
    }
    if (msg) msg.style.display = 'none';

    stocks.slice(0, 300).forEach(s => {
        const opt = document.createElement('option');
        opt.value       = s.ticker;
        opt.textContent = `${s.name} (${s.ticker.replace('.KS','').replace('.KQ','')})`;
        select.appendChild(opt);
    });
}

// =========================================================
// 주식 데이터 가져오기 (실시간 우선 → DB 폴백)
// =========================================================
async function fetchStockData(ticker) {
    console.log(`\n📊 ${ticker} 조회...`);

    // ── 실시간 (Worker 연동) ──────────────────────────────
    if (window.isWorkerReady && window.isWorkerReady() && window.fetchRealtimeData) {
        const rt = await window.fetchRealtimeData(ticker);
        if (rt && rt.price > 0 && rt.chartData && rt.chartData.length > 10) {
            console.log(`✅ 실시간: ${rt.price.toLocaleString()}원, 차트 ${rt.chartData.length}일`);
            return {
                currentPrice:  rt.price,
                change:        rt.changePercent,
                data:          rt.chartData
            };
        }
    }

    // ── DB 폴백 ──────────────────────────────────────────
    const db = await loadStockDatabase();
    if (db[ticker]) {
        const info = db[ticker];
        console.log(`📂 DB: ${info.name} = ${info.currentPrice.toLocaleString()}원`);
        return {
            currentPrice: info.currentPrice,
            change:       info.change,
            data:         info.data
        };
    }

    throw new Error(`${ticker} 데이터 없음`);
}

// =========================================================
// 이동평균 계산
// =========================================================
function calculateMA(data, period) {
    return data.map((_, i) => {
        if (i < period - 1) return null;
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0);
        return sum / period;
    });
}

// =========================================================
// 매매 전략 계산 (AI)
// =========================================================
function calculateStrategy(data, currentPrice) {
    if (!data || data.length < 60) return null;

    const ma20 = calculateMA(data, 20);
    const ma60 = calculateMA(data, 60);
    const lastMA20 = ma20[ma20.length - 1];
    const lastMA60 = ma60[ma60.length - 1];

    const closes = data.map(d => d.close);
    const recent = closes.slice(-20);
    const volatility = Math.sqrt(
        recent.reduce((sum, v) => sum + Math.pow(v - lastMA20, 2), 0) / recent.length
    ) / lastMA20;

    const buyPrice   = Math.round(lastMA20 * 0.98);
    const stopLoss   = Math.round(buyPrice  * (1 - volatility * 3));
    const targetPrice = Math.round(buyPrice * (1 + volatility * 6));

    return { buyPrice, stopLoss, targetPrice, ma20: lastMA20, ma60: lastMA60, volatility };
}

// =========================================================
// 분석 실행
// =========================================================
async function analyzeStock() {
    const ticker = document.getElementById('stockSelect').value;
    if (!ticker) { alert('종목을 선택해주세요.'); return; }

    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '⏳ 분석 중...';

    try {
        const { currentPrice, change, data } = await fetchStockData(ticker);

        displayPrices(currentPrice, change, data);
        displayChart(data, ticker);

    } catch (err) {
        console.error(err);
        alert(`데이터 조회 실패: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '📊 분석하기';
    }
}

// =========================================================
// 가격 + 전략 표시
// =========================================================
function displayPrices(currentPrice, change, data) {
    const strategy = calculateStrategy(data, currentPrice);
    if (!strategy) return;

    document.getElementById('currentPrice').textContent  = currentPrice.toLocaleString() + '원';
    document.getElementById('buyPrice').textContent      = strategy.buyPrice.toLocaleString() + '원';
    document.getElementById('stopLoss').textContent      = strategy.stopLoss.toLocaleString() + '원';
    document.getElementById('targetPrice').textContent   = strategy.targetPrice.toLocaleString() + '원';

    // 변동률 색상
    const changeEl = document.getElementById('changePercent');
    if (changeEl) {
        changeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
        changeEl.style.color = change > 0 ? '#e74c3c' : change < 0 ? '#3498db' : '#fff';
    }
}

// =========================================================
// 차트 렌더링
// =========================================================
function displayChart(data, ticker) {
    const ctx = document.getElementById('stockChart');
    if (!ctx) return;

    const labels  = data.map(d => d.date);
    const closes  = data.map(d => d.close);
    const ma20    = calculateMA(data, 20);
    const ma60    = calculateMA(data, 60);

    if (currentChart) currentChart.destroy();

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '종가',
                    data: closes,
                    borderColor: '#4a9eff',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.1
                },
                {
                    label: 'MA20',
                    data: ma20,
                    borderColor: '#f39c12',
                    borderWidth: 1.2,
                    pointRadius: 0,
                    borderDash: [3, 3]
                },
                {
                    label: 'MA60',
                    data: ma60,
                    borderColor: '#e74c3c',
                    borderWidth: 1.2,
                    pointRadius: 0,
                    borderDash: [3, 3]
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { labels: { color: '#ccc', boxWidth: 20 } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString()}원`
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#aaa', maxTicksLimit: 8 },
                    grid:  { color: '#333' }
                },
                y: {
                    ticks: { color: '#aaa', callback: v => v.toLocaleString() },
                    grid:  { color: '#333' }
                }
            }
        }
    });
}
