// ==================== 설정 ====================
const STOCK_DATA = {
    KR: [
        { name: '삼성전자', code: '005930', price: 72500, change: 2.3, market: 'kr' },
        { name: 'SK하이닉스', code: '000660', price: 145000, change: 3.7, market: 'kr' },
        { name: '카카오', code: '035720', price: 48900, change: -0.5, market: 'kr' },
        { name: 'LG화학', code: '051910', price: 385000, change: 1.8, market: 'kr' },
        { name: '네이버', code: '035420', price: 195000, change: 2.1, market: 'kr' },
        { name: '삼성바이오', code: '207940', price: 865000, change: 4.2, market: 'kr' }
    ],
    US: [
        { name: 'Apple', code: 'AAPL', price: 182.45, change: 1.2, market: 'us' },
        { name: 'NVIDIA', code: 'NVDA', price: 875.28, change: 5.1, market: 'us' },
        { name: 'Tesla', code: 'TSLA', price: 248.50, change: -1.8, market: 'us' },
        { name: 'Microsoft', code: 'MSFT', price: 415.20, change: 2.8, market: 'us' },
        { name: 'Google', code: 'GOOGL', price: 145.30, change: 1.5, market: 'us' },
        { name: 'Amazon', code: 'AMZN', price: 178.90, change: 2.3, market: 'us' },
        { name: 'Meta', code: 'META', price: 485.60, change: 3.2, market: 'us' },
        { name: 'AMD', code: 'AMD', price: 168.75, change: 4.5, market: 'us' }
    ]
};

const INDEX_DATA = {
    kr: [
        { name: 'KOSPI', value: 2650.45, change: 0.82 },
        { name: 'KOSDAQ', value: 845.20, change: -0.35 },
        { name: 'KOSPI 200', value: 352.80, change: 1.05 }
    ],
    us: [
        { name: 'NASDAQ', value: 16234.52, change: 1.25 },
        { name: 'S&P 500', value: 5189.30, change: 0.95 },
        { name: 'Dow Jones', value: 39512.84, change: -0.12 }
    ]
};

const YOUTUBE_VIDEOS = [
    { title: '2026년 주식시장 전망 - 금리 인하 시대의 투자 전략', channel: '슈카월드', category: 'market', url: 'https://www.youtube.com/@ShukaWorld/videos' },
    { title: '삼성전자 주가 분석 - 반도체 업황 회복 시그널', channel: '증시각도기', category: 'stock', url: 'https://www.youtube.com/results?search_query=증시각도기+삼성전자' },
    { title: 'NVIDIA 주가 전망 - AI 붐은 계속될까?', channel: '박곰희TV', category: 'stock', url: 'https://www.youtube.com/@parkbearTV/videos' },
    { title: '차트 보는 법 완벽 가이드 - 캔들, 이동평균선, RSI', channel: '소수몽키', category: 'chart', url: 'https://www.youtube.com/results?search_query=소수몽키+차트' },
    { title: '주식 초보 필수 강의 - PER, PBR, ROE 완벽 이해', channel: '슈카월드', category: 'beginner', url: 'https://www.youtube.com/@ShukaWorld/videos' },
    { title: '오늘의 시황 분석 - 코스피 2700 돌파 가능할까?', channel: '증시각도기', category: 'market', url: 'https://www.youtube.com/results?search_query=증시각도기+시황' },
    { title: '2차전지 관련주 총정리 - 투자 포인트는?', channel: '박곰희TV', category: 'stock', url: 'https://www.youtube.com/@parkbearTV/videos' },
    { title: '이동평균선 활용 전략 - 골든크로스와 데드크로스', channel: '소수몽키', category: 'chart', url: 'https://www.youtube.com/results?search_query=소수몽키+이동평균선' }
];

const NEWS_DATA = [
    { title: '삼성전자, 3분기 영업이익 예상 상회... HBM 수요 급증', date: '2026-03-27', category: '기업' },
    { title: 'SK하이닉스, AI 메모리 공급 확대로 실적 개선 기대', date: '2026-03-27', category: '기업' },
    { title: 'KOSPI 2700선 돌파... 외국인 순매수 지속', date: '2026-03-27', category: '시황' },
    { title: '미국 연준, 금리 인하 시사... 글로벌 증시 상승', date: '2026-03-26', category: '글로벌' },
    { title: '2차전지 업체들, 유럽 시장 공략 본격화', date: '2026-03-26', category: '산업' }
];

let currentMarket = 'kr';
let allStocks = [];

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('StockMind 초기화...');
    initNav();
    loadMarket();
    loadStocks();
    loadVideos();
    setInterval(() => { updatePrices(); }, 30000);
});

function initNav() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    const navHeight = document.querySelector('.navbar').offsetHeight;
                    window.scrollTo({ top: target.offsetTop - navHeight, behavior: 'smooth' });
                }
            }
        });
    });
    
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        navbar.style.boxShadow = window.pageYOffset > 100 ? '0 2px 10px rgba(0,0,0,0.1)' : 'none';
    });
}

// ==================== 시장 데이터 ====================
function loadMarket() {
    const data = INDEX_DATA[currentMarket];
    const html = `<div class="indices-grid">${data.map(idx => `
        <div class="index-card">
            <div class="index-header">
                <span class="index-name">${idx.name}</span>
                <span class="index-change ${idx.change >= 0 ? 'positive' : 'negative'}">
                    ${idx.change >= 0 ? '▲' : '▼'} ${Math.abs(idx.change)}%
                </span>
            </div>
            <div class="index-value">${formatNum(idx.value)}</div>
            <div class="mini-chart">
                <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                    <polyline points="0,${idx.change >= 0 ? 20 : 10} 25,${idx.change >= 0 ? 18 : 12} 50,15 75,${idx.change >= 0 ? 12 : 18} 100,${idx.change >= 0 ? 8 : 22}" 
                        stroke="${idx.change >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}" stroke-width="2" fill="none"/>
                </svg>
            </div>
        </div>
    `).join('')}</div>`;
    document.getElementById('marketContent').innerHTML = html;
}

function switchMarket(market) {
    currentMarket = market;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.market === market);
    });
    loadMarket();
    loadStocks();
}

// ==================== 주식 데이터 ====================
function loadStocks() {
    allStocks = currentMarket === 'kr' ? STOCK_DATA.KR : STOCK_DATA.US;
    displayStocks(allStocks);
}

function displayStocks(stocks) {
    const container = document.getElementById('popularStocks');
    container.innerHTML = stocks.map((stock, i) => `
        <div class="stock-card" style="animation: fadeInUp 0.5s ease-out ${i * 0.1}s both" onclick="window.open('https://finance.naver.com/item/main.naver?code=${stock.code}', '_blank')">
            <div class="stock-header">
                <div class="stock-info">
                    <h3>${stock.name}</h3>
                    <span class="stock-code">${stock.code}</span>
                </div>
                <span class="stock-flag">${stock.market === 'kr' ? '🇰🇷' : '🇺🇸'}</span>
            </div>
            <div class="stock-price">${stock.market === 'kr' ? formatNum(stock.price) : '$' + stock.price.toFixed(2)}</div>
            <div class="stock-change ${stock.change >= 0 ? 'positive' : 'negative'}">
                ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%
            </div>
        </div>
    `).join('');
}

function updatePrices() {
    allStocks.forEach(s => {
        s.price *= (1 + (Math.random() - 0.5) * 0.02);
        s.change = (Math.random() - 0.5) * 6;
    });
    displayStocks(allStocks);
}

// ==================== 필터 ====================
function toggleFilters() {
    const panel = document.getElementById('filterPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function applyFilters() {
    let filtered = [...STOCK_DATA.KR, ...STOCK_DATA.US];
    const market = document.getElementById('filterMarket').value;
    const change = document.getElementById('filterChange').value;
    const sort = document.getElementById('filterSort').value;
    
    if (market !== 'all') filtered = filtered.filter(s => s.market === market);
    if (change === 'up') filtered = filtered.filter(s => s.change > 0);
    if (change === 'down') filtered = filtered.filter(s => s.change < 0);
    
    if (sort === 'change') filtered.sort((a, b) => b.change - a.change);
    if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'price') filtered.sort((a, b) => b.price - a.price);
    
    displayStocks(filtered);
}

function resetFilters() {
    document.getElementById('filterMarket').value = 'all';
    document.getElementById('filterChange').value = 'all';
    document.getElementById('filterSort').value = 'change';
    displayStocks(allStocks);
}

// ==================== 검색 ====================
function performSearch() {
    const query = document.getElementById('mainSearch').value.trim().toLowerCase();
    if (!query) { alert('검색어를 입력하세요'); return; }
    
    const results = [...STOCK_DATA.KR, ...STOCK_DATA.US].filter(s => 
        s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query)
    );
    
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('searchResults').style.display = 'block';
    document.getElementById('searchQuery').textContent = `"${query}" 검색 결과 (${results.length}개)`;
    
    const container = document.getElementById('searchResultsContent');
    container.innerHTML = results.length === 0 ? '<div class="loading">검색 결과가 없습니다</div>' : 
        results.map((s, i) => `
            <div class="stock-card" style="animation: fadeInUp 0.5s ease-out ${i * 0.1}s both" onclick="window.open('https://finance.naver.com/item/main.naver?code=${s.code}', '_blank')">
                <div class="stock-header">
                    <div class="stock-info">
                        <h3>${s.name}</h3>
                        <span class="stock-code">${s.code}</span>
                    </div>
                    <span class="stock-flag">${s.market === 'kr' ? '🇰🇷' : '🇺🇸'}</span>
                </div>
                <div class="stock-price">${s.market === 'kr' ? formatNum(s.price) : '$' + s.price.toFixed(2)}</div>
                <div class="stock-change ${s.change >= 0 ? 'positive' : 'negative'}">${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%</div>
            </div>
        `).join('');
}

function hideSearchResults() {
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mainSearch')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') performSearch();
    });
});

// ==================== 유튜브 ====================
function loadVideos() {
    filterVideos('all');
}

function filterVideos(category) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    const filtered = category === 'all' ? YOUTUBE_VIDEOS : YOUTUBE_VIDEOS.filter(v => v.category === category);
    const labels = { market: '시황분석', stock: '종목분석', chart: '차트분석', beginner: '초보가이드' };
    
    document.getElementById('youtubeVideos').innerHTML = filtered.map((v, i) => `
        <div class="video-card" style="animation: fadeInUp 0.5s ease-out ${i * 0.1}s both" onclick="window.open('${v.url}', '_blank')">
            <div class="video-thumbnail">
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;">▶</div>
                <div class="video-duration">15:30</div>
            </div>
            <div class="video-info">
                <span class="video-category">${labels[v.category]}</span>
                <h3 class="video-title">${v.title}</h3>
                <p class="video-channel">${v.channel}</p>
                <div class="video-meta"><span>최근 영상</span></div>
            </div>
        </div>
    `).join('');
}

// ==================== 정보 페이지 ====================
function showInfoPage(type = 'news') {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('infoPage').style.display = 'block';
    
    const titles = { realtime: '실시간 시세 정보', financial: '재무 분석 정보', chart: '차트 분석 정보', news: '뉴스 & 공시 정보' };
    const contents = {
        realtime: '<div class="info-section"><h3>📊 실시간 시세</h3><p>네이버 금융과 연동하여 실시간 주식 시세를 제공합니다.</p><ul><li>현재가 및 변동률</li><li>고가/저가</li><li>거래량</li></ul></div>',
        financial: '<div class="info-section"><h3>💰 재무 분석</h3><p>기업의 재무 건전성 분석</p><ul><li>PER, PBR, EPS, ROE</li><li>매출액, 영업이익</li><li>배당수익률</li></ul></div>',
        chart: '<div class="info-section"><h3>📈 차트 분석</h3><p>기술적 분석 도구</p><ul><li>캔들차트</li><li>이동평균선</li><li>RSI, MACD</li></ul></div>',
        news: `<div class="info-section"><h3>📰 최신 뉴스</h3>${NEWS_DATA.map(n => `
            <div style="border-bottom: 1px solid var(--gray-lighter); padding: 1rem 0; cursor: pointer;" onclick="alert('뉴스 상세페이지로 이동')">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="background: var(--primary); color: white; padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.75rem;">${n.category}</span>
                    <span style="color: var(--gray); font-size: 0.875rem;">${n.date}</span>
                </div>
                <h4 style="color: var(--dark); font-size: 1rem; font-weight: 600;">${n.title}</h4>
            </div>
        `).join('')}</div>`
    };
    
    document.getElementById('infoPageTitle').textContent = titles[type];
    document.getElementById('infoPageContent').innerHTML = contents[type];
}

function hideInfoPage() {
    document.getElementById('infoPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

// ==================== 유틸리티 ====================
function formatNum(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

console.log('✅ StockMind 로드 완료');
