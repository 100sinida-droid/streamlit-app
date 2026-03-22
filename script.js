// ========================================
// 주식 대시보드 - 에러 없는 버전
// ========================================

console.log('🚀 Stock Dashboard Loading...');

// 시간 업데이트
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

// 주식 데이터 (네이버 금융 링크)
const stockData = {
    hot: [
        { rank: 1, name: '삼성전자', code: '005930', price: '73,500원', change: '+2.1%', isPositive: true },
        { rank: 2, name: 'SK하이닉스', code: '000660', price: '187,000원', change: '+3.8%', isPositive: true },
        { rank: 3, name: 'LG에너지솔루션', code: '373220', price: '432,000원', change: '+1.5%', isPositive: true },
        { rank: 4, name: '현대차', code: '005380', price: '236,000원', change: '-0.5%', isPositive: false },
        { rank: 5, name: 'POSCO홀딩스', code: '005490', price: '289,000원', change: '+1.2%', isPositive: true }
    ],
    recommend: [
        { rank: 1, name: 'NAVER', code: '035420', price: '217,000원', change: '+1.8%', isPositive: true },
        { rank: 2, name: '카카오', code: '035720', price: '53,500원', change: '+1.5%', isPositive: true },
        { rank: 3, name: '셀트리온', code: '068270', price: '200,000원', change: '+2.8%', isPositive: true },
        { rank: 4, name: '삼성바이오로직스', code: '207940', price: '860,000원', change: '+0.7%', isPositive: true },
        { rank: 5, name: '기아', code: '000270', price: '114,000원', change: '-0.2%', isPositive: false }
    ],
    theme: [
        { rank: 1, name: '에코프로비엠', code: '247540', price: '328,000원', change: '+5.5%', isPositive: true },
        { rank: 2, name: '포스코퓨처엠', code: '003670', price: '290,000원', change: '+4.2%', isPositive: true },
        { rank: 3, name: '엘앤에프', code: '066970', price: '201,000원', change: '+3.8%', isPositive: true },
        { rank: 4, name: '에코프로', code: '086520', price: '126,000원', change: '+4.5%', isPositive: true },
        { rank: 5, name: '천보', code: '278280', price: '80,000원', change: '+3.2%', isPositive: true }
    ]
};

// 주식 목록 업데이트
function updateStocksList(stocks) {
    const stocksList = document.getElementById('stocksList');
    if (!stocksList || !stocks) return;
    
    stocksList.innerHTML = stocks.map(stock => `
        <div class="stock-item" onclick="window.open('https://finance.naver.com/item/main.naver?code=${stock.code}', '_blank')" style="cursor: pointer;">
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

// 탭 버튼
let currentTab = 'hot';

function initTabButtons() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            currentTab = button.dataset.tab;
            updateStocksList(stockData[currentTab]);
        });
    });
}

// 새로고침 버튼
function refreshSection(section) {
    if (!window.event) return;
    
    const button = window.event.currentTarget;
    button.style.transform = 'rotate(360deg)';
    button.style.transition = 'transform 0.5s ease';
    
    setTimeout(() => {
        button.style.transform = 'rotate(0deg)';
    }, 500);
    
    console.log(`🔄 Refreshing ${section}...`);
}

// 전략 페이지 링크
function initStrategyLinks() {
    const links = document.querySelectorAll('.strategy-link');
    
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const name = link.closest('.strategy-card').querySelector('h3').textContent;
            const pages = {
                '차트 분석': 'chart-analysis.html',
                '가치투자': 'value-investing.html',
                '손익 관리': 'risk-management.html',
                '배당투자': 'dividend-investing.html'
            };
            if (pages[name]) {
                window.open(pages[name], '_blank');
            }
        });
    });
}

// 학습 태그
function initLearningTags() {
    const tags = document.querySelectorAll('.tag');
    
    tags.forEach(tag => {
        tag.addEventListener('click', () => {
            alert(`${tag.textContent.trim()} 학습 자료\n\n투자 전략 섹션의 관련 페이지를 참고하세요!`);
        });
    });
}

// 초기화
function initializeDashboard() {
    console.log('✅ Dashboard Initialized!');
    
    // 초기 주식 목록 표시
    updateStocksList(stockData.hot);
    
    // 이벤트 리스너
    initTabButtons();
    initStrategyLinks();
    initLearningTags();
    
    console.log('📊 TradingView 위젯으로 실시간 시장 데이터를 확인하세요!');
    console.log('💡 종목 클릭 시 네이버 금융으로 실시간 정보 확인 가능');
}

// 페이지 로드 시 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    initializeDashboard();
}

console.log('Stock Dashboard Ready! 🎯');
console.log('');
console.log('📌 실시간 데이터 확인 방법:');
console.log('1. 화면의 TradingView 차트 위젯 - 실시간 시장 데이터');
console.log('2. 종목 클릭 - 네이버 금융으로 실시간 정보 확인');
console.log('3. 전략 링크 클릭 - 투자 전략 상세 페이지');
