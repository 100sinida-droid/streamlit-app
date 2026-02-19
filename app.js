// ============================================================
//  STOCKMIND AI — app.js
//  실시간 주식 데이터: Yahoo Finance (via allorigins proxy)
//  AI 분석: Claude API (Anthropic)
// ============================================================

// ──────────────────────────────────────────────
// ★ CONFIG  — Cloudflare Pages에 배포 시
//   Pages > Settings > Environment Variables에
//   ANTHROPIC_API_KEY 를 추가하세요.
//   이 파일에서는 Cloudflare Function을 통해 키를 숨깁니다.
// ──────────────────────────────────────────────

const CONFIG = {
  // Yahoo Finance는 allorigins.win 프록시를 통해 CORS 우회
  YF_BASE: 'https://api.allorigins.win/raw?url=',
  YF_QUOTE: 'https://query1.finance.yahoo.com/v8/finance/chart/',
  YF_SEARCH: 'https://query1.finance.yahoo.com/v1/finance/search',
  // Claude API는 /api/analyze Cloudflare Function으로 라우팅
  AI_ENDPOINT: '/api/analyze',
  MAX_SUGGEST: 8,
};

// ──────────────────────────────────────────────
// 인기 종목 목록 (티커 + 한국어명)
// ──────────────────────────────────────────────
const POPULAR_STOCKS = [
  { sym: '005930.KS', name: '삼성전자',   market: 'KOSPI'  },
  { sym: '035420.KS', name: 'NAVER',       market: 'KOSPI'  },
  { sym: '035720.KS', name: '카카오',      market: 'KOSPI'  },
  { sym: '000660.KS', name: 'SK하이닉스', market: 'KOSPI'  },
  { sym: 'AAPL',      name: 'Apple',       market: 'NASDAQ' },
  { sym: 'TSLA',      name: 'Tesla',       market: 'NASDAQ' },
  { sym: 'NVDA',      name: 'NVIDIA',      market: 'NASDAQ' },
  { sym: 'MSFT',      name: 'Microsoft',   market: 'NASDAQ' },
  { sym: '247540.KQ', name: '에코프로비엠', market: 'KOSDAQ' },
  { sym: '086900.KQ', name: '메디톡스',    market: 'KOSDAQ' },
  { sym: 'AMZN',      name: 'Amazon',      market: 'NASDAQ' },
  { sym: 'META',      name: 'Meta',        market: 'NASDAQ' },
];

// 한글 → 티커 매핑
const KR_MAP = {
  '삼성전자': '005930.KS', '삼성': '005930.KS',
  '하이닉스': '000660.KS', 'sk하이닉스': '000660.KS', 'sk 하이닉스': '000660.KS',
  '네이버': '035420.KS', 'naver': '035420.KS',
  '카카오': '035720.KS',
  '카카오뱅크': '323410.KS',
  '셀트리온': '068270.KS',
  '현대차': '005380.KS', '현대자동차': '005380.KS',
  '기아': '000270.KS', '기아차': '000270.KS',
  'lg화학': '051910.KS', 'lg 화학': '051910.KS',
  '포스코': '005490.KS', 'posco': '005490.KS',
  '에코프로비엠': '247540.KQ', '에코프로': '086520.KQ',
  '두산에너빌리티': '034020.KS',
  '메디톡스': '086900.KQ',
  '카카오게임즈': '293490.KQ',
  '크래프톤': '259960.KS',
  '하이브': '352820.KS',
  '엔씨소프트': '036570.KS',
  '넷마블': '251270.KS',
  '코스맥스': '192820.KS',
  '아모레퍼시픽': '090430.KS',
  '롯데케미칼': '011170.KS',
  'kt': '030200.KS',
  'skt': '017670.KS', 'sk텔레콤': '017670.KS',
  'lg전자': '066570.KS',
  '신한지주': '055550.KS',
  '삼성바이오로직스': '207940.KS',
};

// ──────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = (n, dec=2) => n == null ? 'N/A' : Number(n).toLocaleString('ko-KR', {maximumFractionDigits: dec});
const fmtPct = n => n == null ? 'N/A' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function resolveSymbol(query) {
  const q = query.trim().toLowerCase();
  if (KR_MAP[q]) return KR_MAP[q];
  // 숫자로만 이루어진 경우 (KS or KQ 판단 필요)
  if (/^\d{6}$/.test(q)) return q + '.KS';
  return query.trim().toUpperCase();
}

// ──────────────────────────────────────────────
// Yahoo Finance API
// ──────────────────────────────────────────────
async function yfFetch(url) {
  const proxy = CONFIG.YF_BASE + encodeURIComponent(url);
  const res = await fetch(proxy);
  if (!res.ok) throw new Error('Fetch failed: ' + res.status);
  const text = await res.text();
  return JSON.parse(text);
}

async function searchSymbols(query) {
  const url = `${CONFIG.YF_SEARCH}?q=${encodeURIComponent(query)}&quotesCount=${CONFIG.MAX_SUGGEST}&newsCount=0&listsCount=0&lang=ko-KR`;
  const data = await yfFetch(url);
  return (data.quotes || []).filter(q => q.quoteType !== 'NONE');
}

async function fetchQuote(symbol) {
  const url = `${CONFIG.YF_QUOTE}${symbol}?interval=1d&range=1mo&events=history&includePrePost=false`;
  const data = await yfFetch(url);
  const chart = data.chart?.result?.[0];
  if (!chart) throw new Error('종목을 찾을 수 없습니다: ' + symbol);
  return chart;
}

async function fetchSimpleQuote(symbol) {
  const url = `${CONFIG.YF_SEARCH}?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=0`;
  const data = await yfFetch(url);
  return data.quotes?.[0];
}

// ──────────────────────────────────────────────
// 차트
// ──────────────────────────────────────────────
let priceChartInst = null;

function drawChart(labels, prices) {
  const ctx = document.getElementById('priceChart').getContext('2d');
  if (priceChartInst) priceChartInst.destroy();

  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? '#26d968' : '#f85149';

  priceChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220);
          g.addColorStop(0, isUp ? 'rgba(38,217,104,0.25)' : 'rgba(248,81,73,0.25)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          return g;
        },
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        mode: 'index', intersect: false,
        backgroundColor: '#0d1117',
        borderColor: '#21262d',
        borderWidth: 1,
        titleColor: '#8b949e',
        bodyColor: '#e6edf3',
        bodyFont: { family: 'JetBrains Mono', size: 12 },
      }},
      scales: {
        x: { grid: { color: '#21262d' }, ticks: { color: '#484f58', maxTicksLimit: 6, font: { family: 'JetBrains Mono', size: 11 } } },
        y: { grid: { color: '#21262d' }, ticks: { color: '#484f58', font: { family: 'JetBrains Mono', size: 11 } } }
      }
    }
  });
}

// ──────────────────────────────────────────────
// Claude AI 분석
// ──────────────────────────────────────────────
async function analyzeWithAI(stockData) {
  const { name, symbol, price, changeStr, market,
          high52, low52, volume, marketCap, pe, prices } = stockData;

  const recentPrices = prices.slice(-10).map((p,i) => `Day${i+1}: ${fmt(p)}`).join(', ');
  const trend = prices[prices.length-1] > prices[0] ? '상승' : '하락';
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const volatility = (((maxP - minP) / minP) * 100).toFixed(1);

  const prompt = `당신은 세계 최고 수준의 주식 애널리스트입니다. 아래 실시간 주식 데이터를 기반으로 매우 구체적이고 실용적인 투자 분석을 제공하세요.

## 종목 정보
- 종목명: ${name}
- 티커: ${symbol}
- 시장: ${market}
- 현재가: ${price}
- 등락률: ${changeStr}
- 52주 고가: ${high52}
- 52주 저가: ${low52}
- 거래량: ${volume}
- 시가총액: ${marketCap}
- PER: ${pe}
- 최근 10거래일 가격 추이: ${recentPrices}
- 30일 트렌드: ${trend}
- 30일 변동성: ${volatility}%

## 분석 요청
다음 6개 섹션으로 나누어 한국어로 상세히 분석해주세요:

### 1. 종합 투자 의견 [매수/매도/관망/주목]
현재 이 주식에 대한 종합 판단과 그 근거를 3~4문장으로 설명하세요.

### 2. 매수 전략
- 구체적인 매수 진입 가격대 (현재가 기준 ±%)
- 언제 매수하는 것이 좋은지 (가격 조건 또는 시장 조건)
- 분할매수 전략 (1차, 2차 매수 가격)

### 3. 매도 전략
- 목표 수익 실현 가격 (단기/중기)
- 손절 기준선 (리스크 관리)
- 익절 타이밍 시그널

### 4. 리스크 요인
- 이 종목의 주요 하락 리스크 2~3가지
- 리스크 레벨: 낮음/중간/높음

### 5. 3개월 시나리오
- 낙관 시나리오 (목표가)
- 중립 시나리오 (목표가)
- 비관 시나리오 (목표가)

### 6. 핵심 관전 포인트
투자자가 앞으로 모니터링해야 할 3가지 핵심 포인트를 나열하세요.

JSON 형식으로 응답해주세요 (다른 텍스트 없이 순수 JSON만):
{
  "verdict": "매수|매도|관망|주목",
  "verdictReason": "...",
  "buyStrategy": {
    "zone": "X,XXX ~ X,XXX원 (또는 달러)",
    "timing": "...",
    "split": ["1차: X,XXX원", "2차: X,XXX원"]
  },
  "sellStrategy": {
    "shortTarget": "X,XXX",
    "midTarget": "X,XXX",
    "stopLoss": "X,XXX",
    "exitSignal": "..."
  },
  "risks": ["리스크1", "리스크2", "리스크3"],
  "riskLevel": "낮음|중간|높음",
  "riskScore": 40,
  "scenarios": {
    "bull": {"price": "X,XXX", "desc": "..."},
    "base": {"price": "X,XXX", "desc": "..."},
    "bear": {"price": "X,XXX", "desc": "..."}
  },
  "watchPoints": ["포인트1", "포인트2", "포인트3"],
  "summary": "3문장 이내 핵심 요약"
}`;

  const response = await fetch(CONFIG.AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('AI 분석 실패: ' + err);
  }

  const data = await response.json();
  return data;
}

function renderAIResult(result, stockData) {
  const { price } = stockData;

  const verdictClass = {
    '매수': 'buy', '매도': 'sell', '관망': 'hold', '주목': 'watch'
  }[result.verdict] || 'hold';

  const riskFillClass = {
    '낮음': 'low', '중간': 'mid', '높음': 'high'
  }[result.riskLevel] || 'mid';

  const html = `
    <div class="ai-section">
      <div class="ai-section-title">종합 의견</div>
      <div class="verdict-chips">
        <span class="verdict-chip ${verdictClass}">${result.verdict}</span>
        <span class="verdict-chip watch">리스크 ${result.riskLevel}</span>
      </div>
      <p>${result.verdictReason || result.summary}</p>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">매수 / 매도 전략</div>
      <div class="target-row">
        <div class="target-item buy-target">
          <div class="t-label">매수 구간</div>
          <div class="t-val">${result.buyStrategy?.zone || 'N/A'}</div>
        </div>
        <div class="target-item sell-target">
          <div class="t-label">단기 목표가</div>
          <div class="t-val">${result.sellStrategy?.shortTarget || 'N/A'}</div>
        </div>
        <div class="target-item target-target">
          <div class="t-label">중기 목표가</div>
          <div class="t-val">${result.sellStrategy?.midTarget || 'N/A'}</div>
        </div>
        <div class="target-item stop-target">
          <div class="t-label">손절가</div>
          <div class="t-val">${result.sellStrategy?.stopLoss || 'N/A'}</div>
        </div>
      </div>
      ${result.buyStrategy?.split ? `<p style="margin-top:10px;color:#8b949e;font-size:0.9rem;">분할 매수: ${result.buyStrategy.split.join(' → ')}</p>` : ''}
      ${result.sellStrategy?.exitSignal ? `<p style="margin-top:8px;color:#8b949e;font-size:0.9rem;">익절 신호: ${result.sellStrategy.exitSignal}</p>` : ''}
    </div>

    <div class="ai-section">
      <div class="ai-section-title">3개월 시나리오</div>
      <div class="target-row">
        <div class="target-item buy-target">
          <div class="t-label">낙관 🟢</div>
          <div class="t-val">${result.scenarios?.bull?.price || 'N/A'}</div>
          <p style="font-size:0.78rem;color:#8b949e;margin-top:6px">${result.scenarios?.bull?.desc || ''}</p>
        </div>
        <div class="target-item target-target">
          <div class="t-label">중립 🔵</div>
          <div class="t-val">${result.scenarios?.base?.price || 'N/A'}</div>
          <p style="font-size:0.78rem;color:#8b949e;margin-top:6px">${result.scenarios?.base?.desc || ''}</p>
        </div>
        <div class="target-item stop-target">
          <div class="t-label">비관 🔴</div>
          <div class="t-val">${result.scenarios?.bear?.price || 'N/A'}</div>
          <p style="font-size:0.78rem;color:#8b949e;margin-top:6px">${result.scenarios?.bear?.desc || ''}</p>
        </div>
      </div>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">리스크 분석</div>
      <div class="risk-bar">
        <span class="risk-label">리스크</span>
        <div class="risk-track"><div class="risk-fill ${riskFillClass}" style="width:${result.riskScore || 50}%"></div></div>
        <span class="risk-pct">${result.riskScore || 50}%</span>
      </div>
      <ul style="padding-left:20px;margin-top:12px;color:#8b949e;font-size:0.9rem;line-height:2">
        ${(result.risks || []).map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">핵심 관전 포인트</div>
      <ol style="padding-left:20px;color:#8b949e;font-size:0.9rem;line-height:2.2">
        ${(result.watchPoints || []).map(w => `<li><span style="color:#e6edf3">${w}</span></li>`).join('')}
      </ol>
    </div>
  `;

  $('aiContent').innerHTML = html;
  $('aiContent').style.display = 'block';
  $('aiLoading').style.display = 'none';
}

// ──────────────────────────────────────────────
// 메인 검색 플로우
// ──────────────────────────────────────────────
async function doSearch(rawQuery) {
  if (!rawQuery.trim()) return;

  $('resultSection').style.display = 'none';
  $('searchBtn').disabled = true;
  $('searchBtn').textContent = '분석 중...';

  try {
    const symbol = resolveSymbol(rawQuery);

    // 1. 시세 데이터 가져오기
    let chart;
    try {
      chart = await fetchQuote(symbol);
    } catch (e) {
      // 심볼 검색 후 재시도
      const results = await searchSymbols(rawQuery);
      if (!results.length) throw new Error('종목을 찾을 수 없습니다. 정확한 종목명 또는 티커를 입력해주세요.');
      chart = await fetchQuote(results[0].symbol);
    }

    const meta = chart.meta;
    const timestamps = chart.timestamp || [];
    const closes = chart.indicators?.quote?.[0]?.close || [];

    // 유효한 가격 데이터 필터링
    const validData = timestamps.map((t, i) => ({
      date: new Date(t * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      price: closes[i]
    })).filter(d => d.price != null && !isNaN(d.price));

    const labels = validData.map(d => d.date);
    const prices = validData.map(d => d.price);
    const lastPrice = meta.regularMarketPrice || prices[prices.length - 1];
    const prevClose = meta.previousClose || meta.chartPreviousClose;
    const change = lastPrice - prevClose;
    const changePct = (change / prevClose) * 100;
    const isUp = change >= 0;

    const currency = meta.currency || 'USD';
    const isKR = ['KRW', 'KRW=X'].includes(currency) || symbol.endsWith('.KS') || symbol.endsWith('.KQ');
    const priceStr = isKR
      ? fmt(lastPrice, 0) + '원'
      : '$' + fmt(lastPrice);
    const changeStr = (isUp ? '+' : '') + fmt(change, isKR ? 0 : 2) + (isKR ? '원' : '') + ' (' + fmtPct(changePct) + ')';
    const mktLabel = symbol.endsWith('.KS') ? 'KOSPI' : symbol.endsWith('.KQ') ? 'KOSDAQ' : 'US MARKET';

    const stockData = {
      name: meta.longName || meta.shortName || symbol,
      symbol: symbol.toUpperCase(),
      price: priceStr,
      changeStr,
      market: mktLabel,
      high52: isKR ? fmt(meta.fiftyTwoWeekHigh, 0) + '원' : '$' + fmt(meta.fiftyTwoWeekHigh),
      low52: isKR ? fmt(meta.fiftyTwoWeekLow, 0) + '원' : '$' + fmt(meta.fiftyTwoWeekLow),
      volume: fmt(meta.regularMarketVolume, 0),
      marketCap: meta.marketCap ? (meta.marketCap > 1e12 ? fmt(meta.marketCap / 1e12, 1) + '조원' : fmt(meta.marketCap / 1e8, 0) + '억원') : 'N/A',
      pe: fmt(meta.trailingPE) || 'N/A',
      prices,
    };

    // 2. 결과 섹션 표시
    $('resultMarket').textContent = mktLabel;
    $('resultTime').textContent = '실시간 · ' + new Date().toLocaleTimeString('ko-KR');
    $('resultName').textContent = stockData.name;
    $('resultTicker').textContent = symbol.toUpperCase();
    $('resultPrice').textContent = priceStr;
    $('resultChange').textContent = changeStr;
    $('resultChange').className = 'price-change ' + (isUp ? 'up' : 'down');

    // 3. 핵심 지표
    $('statsGrid').innerHTML = [
      { label: '52주 고가', val: stockData.high52 },
      { label: '52주 저가', val: stockData.low52 },
      { label: '거래량', val: stockData.volume },
      { label: '시가총액', val: stockData.marketCap },
      { label: 'PER', val: stockData.pe },
      { label: '통화', val: currency },
    ].map(s => `<div class="stat-item"><div class="stat-label">${s.label}</div><div class="stat-value">${s.val}</div></div>`).join('');

    // 4. 차트
    drawChart(labels, prices);

    // 5. 결과 섹션 표시
    $('resultSection').style.display = 'block';
    $('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 6. AI 분석 (비동기)
    $('aiLoading').style.display = 'flex';
    $('aiContent').style.display = 'none';

    try {
      const aiResult = await analyzeWithAI(stockData);
      renderAIResult(aiResult, stockData);
    } catch (aiErr) {
      console.error('AI Error:', aiErr);
      $('aiLoading').style.display = 'none';
      $('aiContent').innerHTML = `<p style="color:#f85149">AI 분석 오류: ${aiErr.message}</p><p style="color:#8b949e;margin-top:8px">Cloudflare Function 설정을 확인하거나 잠시 후 다시 시도하세요.</p>`;
      $('aiContent').style.display = 'block';
    }

  } catch (err) {
    alert('오류: ' + err.message);
    console.error(err);
  } finally {
    $('searchBtn').disabled = false;
    $('searchBtn').textContent = '분석하기';
  }
}

// ──────────────────────────────────────────────
// 자동완성
// ──────────────────────────────────────────────
let suggestTimeout;

async function updateSuggestions(query) {
  if (query.length < 1) {
    hideSuggestions();
    return;
  }

  // 한글 매핑 먼저 체크
  const lq = query.toLowerCase();
  const localMatches = Object.entries(KR_MAP)
    .filter(([k]) => k.includes(lq))
    .slice(0, 4)
    .map(([k, v]) => ({ displayName: k, symbol: v, isKR: true }));

  // Yahoo Search
  try {
    const remotes = await searchSymbols(query);
    const items = [
      ...localMatches.map(m => ({
        symbol: m.symbol,
        shortname: m.displayName,
        exchange: m.symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI',
        isKR: true,
      })),
      ...remotes.filter(r => !localMatches.find(lm => lm.symbol === r.symbol)),
    ].slice(0, CONFIG.MAX_SUGGEST);

    if (!items.length) { hideSuggestions(); return; }

    $('suggestions').innerHTML = items.map(item => {
      const mkt = item.exchange || item.market || '';
      const mktClass = mkt.includes('KS') || mkt === 'KOSPI' ? 'kospi'
        : mkt.includes('KQ') || mkt === 'KOSDAQ' ? 'kosdaq' : 'us';
      const mktLabel = mkt.includes('KS') || mkt === 'KOSPI' ? 'KOSPI'
        : mkt.includes('KQ') || mkt === 'KOSDAQ' ? 'KOSDAQ' : mkt || 'US';
      return `<div class="sug-item" data-sym="${item.symbol}">
        <div>
          <div class="sug-name">${item.shortname || item.longname || item.symbol}</div>
          <div class="sug-meta">${item.symbol}</div>
        </div>
        <span class="sug-market ${mktClass}">${mktLabel}</span>
      </div>`;
    }).join('');

    $('suggestions').classList.add('open');

    $('suggestions').querySelectorAll('.sug-item').forEach(el => {
      el.addEventListener('click', () => {
        $('searchInput').value = el.dataset.sym;
        hideSuggestions();
        doSearch(el.dataset.sym);
      });
    });
  } catch (e) {
    hideSuggestions();
  }
}

function hideSuggestions() {
  $('suggestions').classList.remove('open');
  $('suggestions').innerHTML = '';
}

// ──────────────────────────────────────────────
// 인기 종목 로드
// ──────────────────────────────────────────────
async function loadPopularStocks() {
  const grid = $('popularGrid');
  grid.innerHTML = POPULAR_STOCKS.slice(0, 6).map(() => '<div class="pop-skeleton"></div>').join('');

  const loaded = [];
  for (const stock of POPULAR_STOCKS.slice(0, 6)) {
    try {
      const data = await yfFetch(`${CONFIG.YF_SEARCH}?q=${encodeURIComponent(stock.sym)}&quotesCount=1&newsCount=0`);
      const q = data.quotes?.[0];
      if (q) {
        loaded.push({ ...stock, price: q.regularMarketPrice, change: q.regularMarketChange, changePct: q.regularMarketChangePercent });
      }
    } catch (e) {
      loaded.push({ ...stock, price: null, change: null, changePct: null });
    }
  }

  grid.innerHTML = loaded.map(s => {
    const isUp = s.changePct >= 0;
    const isKR = s.sym.endsWith('.KS') || s.sym.endsWith('.KQ');
    const priceStr = s.price == null ? '—' : isKR ? fmt(s.price, 0) + '원' : '$' + fmt(s.price);
    const changeStr = s.changePct == null ? '' : fmtPct(s.changePct);
    return `<div class="pop-card" data-sym="${s.sym}">
      <div class="pop-sym">${s.sym} · ${s.market}</div>
      <div class="pop-name">${s.name}</div>
      <div class="pop-price">${priceStr}</div>
      <div class="pop-change ${isUp ? 'up' : 'down'}">${changeStr}</div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.pop-card').forEach(card => {
    card.addEventListener('click', () => doSearch(card.dataset.sym));
  });
}

// ──────────────────────────────────────────────
// 티커 바
// ──────────────────────────────────────────────
async function loadTickerBar() {
  const tickerStocks = POPULAR_STOCKS.slice(0, 8);
  const items = [];

  for (const s of tickerStocks) {
    try {
      const data = await yfFetch(`${CONFIG.YF_SEARCH}?q=${encodeURIComponent(s.sym)}&quotesCount=1&newsCount=0`);
      const q = data.quotes?.[0];
      if (q) items.push({ name: s.name, sym: s.sym, price: q.regularMarketPrice, pct: q.regularMarketChangePercent, isKR: s.sym.includes('.K') });
    } catch (e) {}
  }

  if (!items.length) return;

  const track = $('tickerTrack');
  const makeItems = () => items.map(it => {
    const isUp = it.pct >= 0;
    const priceStr = it.isKR ? fmt(it.price, 0) + '원' : '$' + fmt(it.price);
    return `<span class="tick-item" data-sym="${it.sym}">
      <span class="t-sym">${it.name}</span>
      ${priceStr}
      <span class="${isUp ? 't-up' : 't-down'}">${fmtPct(it.pct)}</span>
    </span>`;
  }).join('');

  // 두 번 반복으로 무한 스크롤
  track.innerHTML = makeItems() + makeItems();

  track.querySelectorAll('.tick-item').forEach(el => {
    el.addEventListener('click', () => doSearch(el.dataset.sym));
  });
}

// ──────────────────────────────────────────────
// 이벤트 리스너
// ──────────────────────────────────────────────
$('searchBtn').addEventListener('click', () => doSearch($('searchInput').value));

$('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    hideSuggestions();
    doSearch($('searchInput').value);
  }
});

$('searchInput').addEventListener('input', e => {
  clearTimeout(suggestTimeout);
  suggestTimeout = setTimeout(() => updateSuggestions(e.target.value), 300);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) hideSuggestions();
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

// ──────────────────────────────────────────────
// 초기 로드
// ──────────────────────────────────────────────
(async () => {
  await Promise.allSettled([
    loadTickerBar(),
    loadPopularStocks(),
  ]);
})();
