// ==================== MOCK DATA ====================
const mockStocks = [
    { name: "삼성전자", code: "005930", price: "72,500", change: "+2.3%", flag: "🇰🇷", positive: true },
    { name: "NVIDIA", code: "NVDA", price: "$875.28", change: "+5.1%", flag: "🇺🇸", positive: true },
    { name: "Tesla", code: "TSLA", price: "$248.50", change: "-1.8%", flag: "🇺🇸", positive: false },
    { name: "SK하이닉스", code: "000660", price: "145,000", change: "+3.7%", flag: "🇰🇷", positive: true },
    { name: "Apple", code: "AAPL", price: "$182.45", change: "+1.2%", flag: "🇺🇸", positive: true },
    { name: "카카오", code: "035720", price: "48,900", change: "-0.5%", flag: "🇰🇷", positive: false },
    { name: "Microsoft", code: "MSFT", price: "$415.20", change: "+2.8%", flag: "🇺🇸", positive: true },
    { name: "LG에너지솔루션", code: "373220", price: "425,000", change: "+4.2%", flag: "🇰🇷", positive: true }
];

const mockVideos = [
    {
        title: "2026년 3월 주식시장 전망 - AI 테마주 집중 분석",
        channel: "슈카월드",
        category: "market",
        duration: "15:32",
        views: "125K",
        uploaded: "1일 전"
    },
    {
        title: "삼성전자 기술적 분석 - 돌파 구간은?",
        channel: "증시각도기",
        category: "chart",
        duration: "22:15",
        views: "89K",
        uploaded: "3시간 전"
    },
    {
        title: "미국 반도체 주식 비교 분석 (NVIDIA vs AMD)",
        channel: "박곰희TV",
        category: "stock",
        duration: "18:47",
        views: "156K",
        uploaded: "12시간 전"
    },
    {
        title: "주식 초보를 위한 차트 보는 법 A to Z",
        channel: "소수몽키",
        category: "beginner",
        duration: "25:08",
        views: "234K",
        uploaded: "2일 전"
    },
    {
        title: "금리 인하 시기와 투자 전략",
        channel: "슈카월드",
        category: "market",
        duration: "19:22",
        views: "198K",
        uploaded: "1일 전"
    },
    {
        title: "2차전지 관련주 총정리 - 투자 포인트는?",
        channel: "증시각도기",
        category: "stock",
        duration: "16:55",
        views: "112K",
        uploaded: "5시간 전"
    }
];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    loadPopularStocks();
    loadYoutubeVideos();
    initializeMarketTabs();
    initializeYoutubeFilters();
    initializeSearch();
});

// ==================== NAVIGATION ====================
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Smooth scroll to section
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const navHeight = document.querySelector('.navbar').offsetHeight;
                const targetPosition = targetSection.offsetTop - navHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Navbar scroll effect
    let lastScroll = 0;
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.boxShadow = 'none';
        }
        
        lastScroll = currentScroll;
    });
}

// ==================== POPULAR STOCKS ====================
function loadPopularStocks() {
    const container = document.getElementById('popularStocks');
    
    mockStocks.forEach((stock, index) => {
        const stockCard = createStockCard(stock);
        stockCard.style.animation = `fadeInUp 0.5s ease-out ${index * 0.1}s both`;
        container.appendChild(stockCard);
    });
}

function createStockCard(stock) {
    const card = document.createElement('div');
    card.className = 'stock-card';
    
    card.innerHTML = `
        <div class="stock-header">
            <div class="stock-info">
                <h3>${stock.name}</h3>
                <span class="stock-code">${stock.code}</span>
            </div>
            <span class="stock-flag">${stock.flag}</span>
        </div>
        <div class="stock-price">${stock.price}</div>
        <div class="stock-change ${stock.positive ? 'positive' : 'negative'}">
            ${stock.change}
        </div>
    `;
    
    card.addEventListener('click', () => {
        showStockDetail(stock);
    });
    
    return card;
}

function showStockDetail(stock) {
    alert(`${stock.name} 상세 페이지로 이동\n(실제 구현 시 stock-detail.html로 연결)`);
}

// ==================== YOUTUBE VIDEOS ====================
function loadYoutubeVideos(category = 'all') {
    const container = document.getElementById('youtubeVideos');
    container.innerHTML = '';
    
    const filteredVideos = category === 'all' 
        ? mockVideos 
        : mockVideos.filter(video => video.category === category);
    
    filteredVideos.forEach((video, index) => {
        const videoCard = createVideoCard(video);
        videoCard.style.animation = `fadeInUp 0.5s ease-out ${index * 0.1}s both`;
        container.appendChild(videoCard);
    });
    
    if (filteredVideos.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">해당 카테고리의 영상이 없습니다.</p>';
    }
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    
    const categoryLabels = {
        'market': '시황분석',
        'stock': '종목분석',
        'chart': '차트분석',
        'beginner': '초보가이드'
    };
    
    card.innerHTML = `
        <div class="video-thumbnail">
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;">
                ▶
            </div>
            <div class="video-duration">${video.duration}</div>
        </div>
        <div class="video-info">
            <span class="video-category">${categoryLabels[video.category]}</span>
            <h3 class="video-title">${video.title}</h3>
            <p class="video-channel">${video.channel}</p>
            <div class="video-meta">
                <span>조회수 ${video.views}</span>
                <span>•</span>
                <span>${video.uploaded}</span>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        alert(`유튜브 영상 재생\n제목: ${video.title}\n채널: ${video.channel}`);
    });
    
    return card;
}

// ==================== MARKET TABS ====================
function initializeMarketTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active to clicked tab
            this.classList.add('active');
            
            // Update market data
            const market = this.dataset.market;
            updateMarketData(market);
        });
    });
}

function updateMarketData(market) {
    const container = document.getElementById('marketContent');
    
    if (market === 'us') {
        container.innerHTML = `
            <div class="indices-grid">
                <div class="index-card">
                    <div class="index-header">
                        <span class="index-name">NASDAQ</span>
                        <span class="index-change positive">▲ 1.25%</span>
                    </div>
                    <div class="index-value">16,234.52</div>
                    <div class="mini-chart" data-trend="up">
                        <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                            <polyline points="0,25 20,20 40,22 60,15 80,12 100,8" 
                                stroke="var(--accent-green)" stroke-width="2" fill="none"/>
                        </svg>
                    </div>
                </div>
                
                <div class="index-card">
                    <div class="index-header">
                        <span class="index-name">S&P 500</span>
                        <span class="index-change positive">▲ 0.95%</span>
                    </div>
                    <div class="index-value">5,189.30</div>
                    <div class="mini-chart" data-trend="up">
                        <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                            <polyline points="0,28 20,24 40,25 60,18 80,14 100,10" 
                                stroke="var(--accent-green)" stroke-width="2" fill="none"/>
                        </svg>
                    </div>
                </div>
                
                <div class="index-card">
                    <div class="index-header">
                        <span class="index-name">Dow Jones</span>
                        <span class="index-change negative">▼ 0.12%</span>
                    </div>
                    <div class="index-value">39,512.84</div>
                    <div class="mini-chart" data-trend="down">
                        <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                            <polyline points="0,8 20,12 40,10 60,18 80,20 100,25" 
                                stroke="var(--accent-red)" stroke-width="2" fill="none"/>
                        </svg>
                    </div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="indices-grid">
                <div class="index-card">
                    <div class="index-header">
                        <span class="index-name">KOSPI</span>
                        <span class="index-change positive">▲ 0.82%</span>
                    </div>
                    <div class="index-value">2,650.45</div>
                    <div class="mini-chart" data-trend="up">
                        <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                            <polyline points="0,25 20,20 40,22 60,15 80,12 100,8" 
                                stroke="var(--accent-green)" stroke-width="2" fill="none"/>
                        </svg>
                    </div>
                </div>
                
                <div class="index-card">
                    <div class="index-header">
                        <span class="index-name">KOSDAQ</span>
                        <span class="index-change negative">▼ 0.35%</span>
                    </div>
                    <div class="index-value">845.20</div>
                    <div class="mini-chart" data-trend="down">
                        <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                            <polyline points="0,8 20,12 40,10 60,18 80,20 100,25" 
                                stroke="var(--accent-red)" stroke-width="2" fill="none"/>
                        </svg>
                    </div>
                </div>
                
                <div class="index-card">
                    <div class="index-header">
                        <span class="index-name">KOSPI 200</span>
                        <span class="index-change positive">▲ 1.05%</span>
                    </div>
                    <div class="index-value">352.80</div>
                    <div class="mini-chart" data-trend="up">
                        <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                            <polyline points="0,28 20,24 40,25 60,18 80,14 100,10" 
                                stroke="var(--accent-green)" stroke-width="2" fill="none"/>
                        </svg>
                    </div>
                </div>
            </div>
        `;
    }
}

// ==================== YOUTUBE FILTERS ====================
function initializeYoutubeFilters() {
    const filters = document.querySelectorAll('.filter-btn');
    
    filters.forEach(filter => {
        filter.addEventListener('click', function() {
            // Remove active from all filters
            filters.forEach(f => f.classList.remove('active'));
            
            // Add active to clicked filter
            this.classList.add('active');
            
            // Load filtered videos
            const category = this.dataset.category;
            loadYoutubeVideos(category);
        });
    });
}

// ==================== SEARCH ====================
function initializeSearch() {
    const searchInput = document.getElementById('mainSearch');
    const searchBtn = document.querySelector('.search-btn');
    
    function performSearch() {
        const query = searchInput.value.trim();
        if (query) {
            alert(`검색: "${query}"\n\n실제 구현 시 검색 결과 페이지로 이동하거나\n검색 결과를 동적으로 표시합니다.`);
        }
    }
    
    searchBtn.addEventListener('click', performSearch);
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Search suggestions (simple implementation)
    const suggestions = ['삼성전자', 'NVIDIA', 'Apple', 'Tesla', 'SK하이닉스', 'Microsoft'];
    
    searchInput.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        if (value.length > 0) {
            // In a real implementation, show autocomplete suggestions
            console.log('Search suggestions for:', value);
        }
    });
}

// ==================== UTILITY FUNCTIONS ====================
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
}

// ==================== ANIMATIONS ====================
// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all sections
document.addEventListener('DOMContentLoaded', function() {
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(section);
    });
});
