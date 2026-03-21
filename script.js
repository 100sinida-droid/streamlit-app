// ========================================
// 실시간 주식 데이터 대시보드
// ========================================

// API 설정
const API_KEYS = {
    // Finnhub - 무료로 실시간 주식 데이터 제공
    // https://finnhub.io/register 에서 무료 가입
    finnhub: 'ctbubupr01qncnjv5qd0ctbubupr01qncnjv5qdg', // 데모 키
    
    // Alpha Vantage - 무료 주식 데이터
    // https://www.alphavantage.co/support/#api-key
    alphaVantage: 'demo'
};

// ========================================
// 시간 업데이트
// ========================================
function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

updateTime();
setInterval(updateTime, 1000);

// ========================================
// 1. 실시간 시장 지수 (Finnhub API)
// ========================================
async function fetchMarketIndices() {
    console.log('📊 Fetching market indices...');
    
    const indices = [
        { id: 'kospi', symbol: 'KOSPI', name: '코스피', exchange: 'KO' },
        { id: 'kosdaq', symbol: 'KOSDAQ', name: '코스닥', exchange: 'KO' },
        { id: 'sp500', symbol: 'SPX', name: 'S&P 500', exchange: 'US' },
        { id: 'nasdaq', symbol: 'NDAQ', name: '나스닥', exchange: 'US' }
    ];

    for (const index of indices) {
        try {
            // Finnhub Quote API
            const url = `https://finnhub.io/api/v1/quote?symbol=${index.symbol}&token=${API_KEYS.finnhub}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && data.c) { // current price
                updateIndexCard(index.id, {
                    price: data.c,
                    change: data.d,  // change
                    changePercent: data.dp // change percent
                });
            } else {
                // Fallback to realistic demo data
                updateIndexWithDemoData(index.id);
            }
        } catch (error) {
            console.error(`Error fetching ${index.name}:`, error);
            updateIndexWithDemoData(index.id);
        }
        
        // API rate limit 방지
        await sleep(300);
    }
}

function updateIndexCard(id, data) {
    const priceElement = document.getElementById(id);
    const card = priceElement?.closest('.index-card');
    
    if (!card) return;
    
    // 가격 업데이트
    if (priceElement) {
        const oldPrice = parseFloat(priceElement.textContent.replace(/,/g, '')) || 0;
        animateValue(priceElement, oldPrice, data.price, 1000);
    }
    
    // 변동률 업데이트
    const changeElement = card.querySelector('.index-change');
    if (changeElement && data.change !== undefined) {
        const isPositive = data.change >= 0;
        const arrow = isPositive ? '▲' : '▼';
        const sign = isPositive ? '+' : '';
        
        changeElement.className = `index-change ${isPositive ? 'positive' : 'negative'}`;
        changeElement.innerHTML = `
            <span>${arrow} ${Math.abs(data.change).toFixed(2)}</span>
            <span>(${sign}${data.changePercent.toFixed(2)}%)</span>
        `;
    }
}

function updateIndexWithDemoData(id) {
    const demoData = {
        kospi: { price: 2645.27, change: 15.32, changePercent: 0.58 },
        kosdaq: { price: 785.43, change: -5.21, changePercent: -0.66 },
        sp500: { price: 5234.18, change: 23.45, changePercent: 0.45 },
        nasdaq: { price: 16315.70, change: 87.33, changePercent: 0.54 }
    };
    
    if (demoData[id]) {
        updateIndexCard(id, demoData[id]);
    }
}

// ========================================
// 2. 실시간 주식 종목 (Finnhub)
// ========================================
async function fetchKoreanStocks(type = 'hot') {
    console.log(`📈 Fetching ${type} stocks...`);
    
    // 한국 주요 종목 심볼
    const stockSymbols = {
        hot: [
            { symbol: '005930.KS', name: '삼성전자', code: '005930' },
            { symbol: '000660.KS', name: 'SK하이닉스', code: '000660' },
            { symbol: '373220.KS', name: 'LG에너지솔루션', code: '373220' },
            { symbol: '005380.KS', name: '현대차', code: '005380' },
            { symbol: '005490.KS', name: 'POSCO홀딩스', code: '005490' }
        ],
        recommend: [
            { symbol: '035420.KS', name: 'NAVER', code: '035420' },
            { symbol: '035720.KS', name: '카카오', code: '035720' },
            { symbol: '068270.KS', name: '셀트리온', code: '068270' },
            { symbol: '207940.KS', name: '삼성바이오로직스', code: '207940' },
            { symbol: '000270.KS', name: '기아', code: '000270' }
        ],
        theme: [
            { symbol: '247540.KS', name: '에코프로비엠', code: '247540' },
            { symbol: '003670.KS', name: '포스코퓨처엠', code: '003670' },
            { symbol: '066970.KS', name: '엘앤에프', code: '066970' },
            { symbol: '086520.KS', name: '에코프로', code: '086520' },
            { symbol: '278280.KS', name: '천보', code: '278280' }
        ]
    };
    
    const symbols = stockSymbols[type] || stockSymbols.hot;
    const stockData = [];
    
    for (let i = 0; i < symbols.length; i++) {
        const stock = symbols[i];
        
        try {
            // Alpha Vantage Global Quote API
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stock.symbol}&apikey=${API_KEYS.alphaVantage}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data['Global Quote'] && data['Global Quote']['05. price']) {
                const quote = data['Global Quote'];
                const price = parseFloat(quote['05. price']);
                const change = parseFloat(quote['09. change']);
                const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                
                stockData.push({
                    rank: i + 1,
                    name: stock.name,
                    code: stock.code,
                    price: `${Math.round(price).toLocaleString()}원`,
                    change: `${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
                    isPositive: change >= 0
                });
            } else {
                // Fallback to demo data
                stockData.push(getDemoStockData(type, i));
            }
        } catch (error) {
            console.error(`Error fetching ${stock.name}:`, error);
            stockData.push(getDemoStockData(type, i));
        }
        
        // API rate limit
        await sleep(200);
    }
    
    return stockData;
}

function getDemoStockData(type, index) {
    const demoStocks = {
        hot: [
            { rank: 1, name: '삼성전자', code: '005930', price: '72,300원', change: '+3.2%', isPositive: true },
            { rank: 2, name: 'SK하이닉스', code: '000660', price: '185,500원', change: '+5.7%', isPositive: true },
            { rank: 3, name: 'LG에너지솔루션', code: '373220', price: '428,000원', change: '+2.1%', isPositive: true },
            { rank: 4, name: '현대차', code: '005380', price: '234,500원', change: '-1.3%', isPositive: false },
            { rank: 5, name: 'POSCO홀딩스', code: '005490', price: '287,000원', change: '+1.8%', isPositive: true }
        ],
        recommend: [
            { rank: 1, name: 'NAVER', code: '035420', price: '215,500원', change: '+2.4%', isPositive: true },
            { rank: 2, name: '카카오', code: '035720', price: '52,800원', change: '+1.9%', isPositive: true },
            { rank: 3, name: '셀트리온', code: '068270', price: '198,700원', change: '+3.5%', isPositive: true },
            { rank: 4, name: '삼성바이오로직스', code: '207940', price: '856,000원', change: '+1.2%', isPositive: true },
            { rank: 5, name: '기아', code: '000270', price: '112,300원', change: '-0.5%', isPositive: false }
        ],
        theme: [
            { rank: 1, name: '에코프로비엠', code: '247540', price: '325,000원', change: '+7.8%', isPositive: true },
            { rank: 2, name: '포스코퓨처엠', code: '003670', price: '287,500원', change: '+6.2%', isPositive: true },
            { rank: 3, name: '엘앤에프', code: '066970', price: '198,500원', change: '+4.9%', isPositive: true },
            { rank: 4, name: '에코프로', code: '086520', price: '124,800원', change: '+5.3%', isPositive: true },
            { rank: 5, name: '천보', code: '278280', price: '78,900원', change: '+3.7%', isPositive: true }
        ]
    };
    
    return demoStocks[type][index];
}

// ========================================
// 3. 실시간 뉴스
// ========================================
async function fetchFinancialNews() {
    console.log('📰 Fetching financial news...');
    
    try {
        // NewsAPI - 한국 경제 뉴스
        const url = 'https://newsapi.org/v2/top-headlines?country=kr&category=business&pageSize=3&apiKey=YOUR_API_KEY';
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.articles && data.articles.length > 0) {
            displayNews(data.articles);
        } else {
            displayDemoNews();
        }
    } catch (error) {
        console.log('Using demo news data');
        displayDemoNews();
    }
}

function displayNews(articles) {
    const newsList = document.querySelector('.news-list');
    if (!newsList) return;
    
    const newsHtml = articles.slice(0, 3).map(article => `
        <article class="news-item">
            <div class="news-category">${categorizeNews(article.title)}</div>
            <h3 class="news-title">${article.title}</h3>
            <p class="news-summary">${article.description || '뉴스 내용을 불러오는 중입니다...'}</p>
            <div class="news-meta">
                <span class="news-time">${getTimeAgo(new Date(article.publishedAt))}</span>
                <span class="news-source">${article.source.name}</span>
            </div>
        </article>
    `).join('');
    
    newsList.innerHTML = newsHtml;
    addNewsClickEvents();
}

function displayDemoNews() {
    const newsList = document.querySelector('.news-list');
    if (!newsList) return;
    
    const demoNews = [
        {
            category: '금리정책',
            title: '미 연준, 금리 동결 결정... 시장 반응은?',
            summary: '연방준비제도가 기준금리를 5.25%~5.50%로 유지하기로 결정하면서 시장은 안도 랠리를 보였습니다.',
            time: '2시간 전',
            source: '경제일보'
        },
        {
            category: '산업동향',
            title: 'AI 반도체 수요 급증, HBM 시장 전망',
            summary: '생성형 AI 붐으로 고대역폭 메모리(HBM) 수요가 급증하면서 관련 기업들의 실적 개선이 예상됩니다.',
            time: '4시간 전',
            source: '테크타임즈'
        },
        {
            category: '환율',
            title: '원/달러 환율 1,320원대, 수출기업 영향은?',
            summary: '원화 강세로 수출 대기업들의 실적 우려가 커지는 가운데, 전문가들은 추가 하락 가능성을 점쳤습니다.',
            time: '6시간 전',
            source: '금융신문'
        }
    ];
    
    const newsHtml = demoNews.map(news => `
        <article class="news-item">
            <div class="news-category">${news.category}</div>
            <h3 class="news-title">${news.title}</h3>
            <p class="news-summary">${news.summary}</p>
            <div class="news-meta">
                <span class="news-time">${news.time}</span>
                <span class="news-source">${news.source}</span>
            </div>
        </article>
    `).join('');
    
    newsList.innerHTML = newsHtml;
    addNewsClickEvents();
}

function categorizeNews(title) {
    if (!title) return '경제일반';
    if (title.includes('금리') || title.includes('연준')) return '금리정책';
    if (title.includes('반도체') || title.includes('AI')) return '산업동향';
    if (title.includes('환율') || title.includes('달러')) return '환율';
    if (title.includes('주가') || title.includes('증시')) return '증시';
    return '경제일반';
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    return `${diffDays}일 전`;
}

function addNewsClickEvents() {
    const newsItems = document.querySelectorAll('.news-item');
    newsItems.forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            item.style.transform = 'translateX(8px) scale(1.02)';
            setTimeout(() => {
                item.style.transform = 'translateX(8px)';
            }, 200);
        });
    });
}

// ========================================
// UI 업데이트 함수
// ========================================
function animateValue(element, start, end, duration) {
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = current.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }, 16);
}

function updateStocksList(stocks) {
    const stocksList = document.getElementById('stocksList');
    if (!stocksList || !stocks) return;
    
    stocksList.innerHTML = stocks.map(stock => `
        <div class="stock-item" onclick="showStockDetail('${stock.code}', '${stock.name}')">
            <div class="stock-rank">${stock.rank}</div>
            <div class="stock-info">
                <div class="stock-name">${stock.name}</div>
                <div class="stock-code">${stock.code}</div>
            </div>
            <div class="stock-price">${stock.price}</div>
            <div class="stock-change ${stock.isPositive ? 'positive' : 'negative'}">${stock.change}</div>
        </div>
    `).join('');
    
    // 애니메이션
    const items = stocksList.querySelectorAll('.stock-item');
    items.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, index * 50);
    });
}

function showStockDetail(code, name) {
    alert(`${name} (${code}) 상세 정보\n\n실시간 차트와 상세 분석은 준비 중입니다.`);
}

// ========================================
// 탭 전환
// ========================================
let currentTab = 'hot';

document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(button => {
        button.addEventListener('click', async () => {
            tabBtns.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            currentTab = button.dataset.tab;
            const stocks = await fetchKoreanStocks(currentTab);
            updateStocksList(stocks);
        });
    });
});

// ========================================
// 새로고침 기능
// ========================================
async function refreshSection(section) {
    if (!window.event) return;
    
    const button = window.event.currentTarget;
    button.style.transform = 'rotate(360deg)';
    
    setTimeout(() => {
        button.style.transform = 'rotate(0deg)';
    }, 500);
    
    console.log(`🔄 Refreshing ${section}...`);
    
    const card = button.closest('.card');
    card.style.opacity = '0.7';
    
    if (section === 'market') {
        await fetchMarketIndices();
    }
    
    setTimeout(() => {
        card.style.opacity = '1';
    }, 300);
}

// ========================================
// 전략 링크 연결
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    const strategyLinks = document.querySelectorAll('.strategy-link');
    
    strategyLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const strategyName = link.closest('.strategy-card').querySelector('h3').textContent;
            openStrategyPage(strategyName);
        });
    });
});

function openStrategyPage(strategyName) {
    const strategyPages = {
        '차트 분석': 'chart-analysis.html',
        '가치투자': 'value-investing.html',
        '손익 관리': 'risk-management.html',
        '배당투자': 'dividend-investing.html'
    };
    
    const pageName = strategyPages[strategyName];
    
    if (pageName) {
        // 새 창에서 열기
        window.open(pageName, '_blank');
    } else {
        alert(`${strategyName} 페이지 준비 중입니다.`);
    }
}

// ========================================
// 유틸리티 함수
// ========================================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// 초기화
// ========================================
async function initializeDashboard() {
    console.log('🚀 Initializing Stock Dashboard...');
    
    try {
        // 지수 로드
        await fetchMarketIndices();
        
        // 주식 데이터 로드
        const stocks = await fetchKoreanStocks('hot');
        updateStocksList(stocks);
        
        // 뉴스 로드
        await fetchFinancialNews();
        
        console.log('✅ Dashboard initialized!');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// 페이지 로드 시 실행
window.addEventListener('load', () => {
    initializeDashboard();
    
    // 정기 업데이트
    setInterval(fetchMarketIndices, 60000); // 1분
    setInterval(fetchFinancialNews, 300000); // 5분
});

console.log('Stock Dashboard Ready! 🎯');
