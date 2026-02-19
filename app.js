// ═══════════════════════════════════════════════════════════════
//  StockMind AI — app.js v4.0
//
//  모든 주식 데이터 → /api/stock (Cloudflare Function)
//  AI 분석        → /api/analyze (Cloudflare Function)
//  브라우저에서 외부 API 직접 호출 없음 → CORS 완전 해결
// ═══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
//  내장 종목 DB (자동완성 + 심볼 해석용)
// ──────────────────────────────────────────────
const STOCK_DB = [
  // KOSPI
  { sym:'005930.KS', name:'삼성전자',         en:'Samsung Electronics',   mkt:'KOSPI'  },
  { sym:'000660.KS', name:'SK하이닉스',        en:'SK Hynix',              mkt:'KOSPI'  },
  { sym:'035420.KS', name:'NAVER',             en:'NAVER',                 mkt:'KOSPI'  },
  { sym:'035720.KS', name:'카카오',            en:'Kakao',                 mkt:'KOSPI'  },
  { sym:'005380.KS', name:'현대자동차',        en:'Hyundai Motor',         mkt:'KOSPI'  },
  { sym:'000270.KS', name:'기아',              en:'Kia',                   mkt:'KOSPI'  },
  { sym:'051910.KS', name:'LG화학',            en:'LG Chem',               mkt:'KOSPI'  },
  { sym:'005490.KS', name:'POSCO홀딩스',       en:'POSCO Holdings',        mkt:'KOSPI'  },
  { sym:'207940.KS', name:'삼성바이오로직스',  en:'Samsung Biologics',     mkt:'KOSPI'  },
  { sym:'068270.KS', name:'셀트리온',          en:'Celltrion',             mkt:'KOSPI'  },
  { sym:'323410.KS', name:'카카오뱅크',        en:'KakaoBank',             mkt:'KOSPI'  },
  { sym:'259960.KS', name:'크래프톤',          en:'Krafton',               mkt:'KOSPI'  },
  { sym:'352820.KS', name:'하이브',            en:'HYBE',                  mkt:'KOSPI'  },
  { sym:'036570.KS', name:'엔씨소프트',        en:'NCSoft',                mkt:'KOSPI'  },
  { sym:'251270.KS', name:'넷마블',            en:'Netmarble',             mkt:'KOSPI'  },
  { sym:'090430.KS', name:'아모레퍼시픽',      en:'AmorePacific',          mkt:'KOSPI'  },
  { sym:'030200.KS', name:'KT',               en:'KT Corp',               mkt:'KOSPI'  },
  { sym:'017670.KS', name:'SK텔레콤',          en:'SK Telecom',            mkt:'KOSPI'  },
  { sym:'066570.KS', name:'LG전자',            en:'LG Electronics',        mkt:'KOSPI'  },
  { sym:'055550.KS', name:'신한지주',          en:'Shinhan Financial',     mkt:'KOSPI'  },
  { sym:'034020.KS', name:'두산에너빌리티',    en:'Doosan Enerbility',     mkt:'KOSPI'  },
  { sym:'015760.KS', name:'한국전력',          en:'Korea Electric Power',  mkt:'KOSPI'  },
  { sym:'028260.KS', name:'삼성물산',          en:'Samsung C&T',           mkt:'KOSPI'  },
  { sym:'012330.KS', name:'현대모비스',        en:'Hyundai Mobis',         mkt:'KOSPI'  },
  { sym:'011170.KS', name:'롯데케미칼',        en:'Lotte Chemical',        mkt:'KOSPI'  },
  { sym:'010130.KS', name:'고려아연',          en:'Korea Zinc',            mkt:'KOSPI'  },
  { sym:'105560.KS', name:'KB금융',            en:'KB Financial',          mkt:'KOSPI'  },
  { sym:'086790.KS', name:'하나금융지주',      en:'Hana Financial',        mkt:'KOSPI'  },
  { sym:'096770.KS', name:'SK이노베이션',      en:'SK Innovation',         mkt:'KOSPI'  },
  { sym:'003550.KS', name:'LG',               en:'LG Corp',               mkt:'KOSPI'  },
  { sym:'032830.KS', name:'삼성생명',          en:'Samsung Life',          mkt:'KOSPI'  },
  { sym:'015360.KS', name:'이건홀딩스',        en:'Ikon Holdings',         mkt:'KOSPI'  },
  { sym:'000810.KS', name:'삼성화재',          en:'Samsung Fire',          mkt:'KOSPI'  },
  { sym:'009150.KS', name:'삼성전기',          en:'Samsung Electro-Mechanics', mkt:'KOSPI' },
  { sym:'018260.KS', name:'삼성에스디에스',    en:'Samsung SDS',           mkt:'KOSPI'  },
  { sym:'000100.KS', name:'유한양행',          en:'Yuhan Corp',            mkt:'KOSPI'  },
  { sym:'326030.KS', name:'SK바이오팜',        en:'SK Biopharmaceuticals', mkt:'KOSPI'  },
  { sym:'003490.KS', name:'대한항공',          en:'Korean Air',            mkt:'KOSPI'  },
  { sym:'010950.KS', name:'S-Oil',            en:'S-Oil Corp',            mkt:'KOSPI'  },
  // KOSDAQ
  { sym:'247540.KQ', name:'에코프로비엠',      en:'EcoPro BM',             mkt:'KOSDAQ' },
  { sym:'086520.KQ', name:'에코프로',          en:'EcoPro',                mkt:'KOSDAQ' },
  { sym:'091990.KQ', name:'셀트리온헬스케어',  en:'Celltrion Healthcare',  mkt:'KOSDAQ' },
  { sym:'293490.KQ', name:'카카오게임즈',      en:'Kakao Games',           mkt:'KOSDAQ' },
  { sym:'086900.KQ', name:'메디톡스',          en:'Medytox',               mkt:'KOSDAQ' },
  { sym:'263750.KQ', name:'펄어비스',          en:'Pearl Abyss',           mkt:'KOSDAQ' },
  { sym:'078340.KQ', name:'컴투스',            en:'Com2uS',                mkt:'KOSDAQ' },
  { sym:'196170.KQ', name:'알테오젠',          en:'Alteogen',              mkt:'KOSDAQ' },
  { sym:'145020.KQ', name:'휴젤',              en:'Hugel',                 mkt:'KOSDAQ' },
  { sym:'357780.KQ', name:'솔브레인',          en:'Soulbrain',             mkt:'KOSDAQ' },
  { sym:'214150.KQ', name:'클래시스',          en:'Classis',               mkt:'KOSDAQ' },
  { sym:'041510.KQ', name:'에스엠',            en:'SM Entertainment',      mkt:'KOSDAQ' },
  { sym:'035900.KQ', name:'JYP Ent.',          en:'JYP Entertainment',     mkt:'KOSDAQ' },
  { sym:'122870.KQ', name:'와이지엔터테인먼트', en:'YG Entertainment',     mkt:'KOSDAQ' },
  // US
  { sym:'AAPL',  name:'Apple',              en:'Apple Inc',               mkt:'NASDAQ' },
  { sym:'MSFT',  name:'Microsoft',          en:'Microsoft Corp',          mkt:'NASDAQ' },
  { sym:'GOOGL', name:'Alphabet (Google)',  en:'Alphabet Inc',            mkt:'NASDAQ' },
  { sym:'GOOG',  name:'Google C',           en:'Alphabet Inc Class C',    mkt:'NASDAQ' },
  { sym:'AMZN',  name:'Amazon',             en:'Amazon.com Inc',          mkt:'NASDAQ' },
  { sym:'NVDA',  name:'NVIDIA',             en:'NVIDIA Corp',             mkt:'NASDAQ' },
  { sym:'META',  name:'Meta (Facebook)',    en:'Meta Platforms',          mkt:'NASDAQ' },
  { sym:'TSLA',  name:'Tesla',              en:'Tesla Inc',               mkt:'NASDAQ' },
  { sym:'TSM',   name:'TSMC',              en:'Taiwan Semiconductor',    mkt:'NYSE'   },
  { sym:'AVGO',  name:'Broadcom',           en:'Broadcom Inc',            mkt:'NASDAQ' },
  { sym:'ORCL',  name:'Oracle',             en:'Oracle Corp',             mkt:'NYSE'   },
  { sym:'NFLX',  name:'Netflix',            en:'Netflix Inc',             mkt:'NASDAQ' },
  { sym:'AMD',   name:'AMD',               en:'Advanced Micro Devices',  mkt:'NASDAQ' },
  { sym:'INTC',  name:'Intel',             en:'Intel Corp',              mkt:'NASDAQ' },
  { sym:'DIS',   name:'Disney',            en:'Walt Disney Co',          mkt:'NYSE'   },
  { sym:'V',     name:'Visa',             en:'Visa Inc',                mkt:'NYSE'   },
  { sym:'MA',    name:'Mastercard',         en:'Mastercard Inc',          mkt:'NYSE'   },
  { sym:'JPM',   name:'JP Morgan',          en:'JPMorgan Chase',          mkt:'NYSE'   },
  { sym:'WMT',   name:'Walmart',            en:'Walmart Inc',             mkt:'NYSE'   },
  { sym:'COIN',  name:'Coinbase',           en:'Coinbase Global',         mkt:'NASDAQ' },
  { sym:'PLTR',  name:'Palantir',           en:'Palantir Technologies',   mkt:'NASDAQ' },
  { sym:'SMCI',  name:'Super Micro',        en:'Super Micro Computer',    mkt:'NASDAQ' },
  { sym:'ARM',   name:'Arm Holdings',       en:'Arm Holdings',            mkt:'NASDAQ' },
  { sym:'BABA',  name:'Alibaba',            en:'Alibaba Group',           mkt:'NYSE'   },
  { sym:'UBER',  name:'Uber',              en:'Uber Technologies',       mkt:'NYSE'   },
  { sym:'SPOT',  name:'Spotify',            en:'Spotify Technology',      mkt:'NYSE'   },
  { sym:'SHOP',  name:'Shopify',            en:'Shopify Inc',             mkt:'NYSE'   },
  { sym:'SQ',    name:'Block (Square)',      en:'Block Inc',               mkt:'NYSE'   },
  { sym:'PYPL',  name:'PayPal',             en:'PayPal Holdings',         mkt:'NASDAQ' },
];

// 빠른 검색용 별칭 맵
const ALIAS = {
  '삼성':'005930.KS','삼성전자':'005930.KS',
  '하이닉스':'000660.KS','sk하이닉스':'000660.KS',
  '네이버':'035420.KS','카카오':'035720.KS',
  '현대차':'005380.KS','현대자동차':'005380.KS',
  '기아':'000270.KS','기아차':'000270.KS',
  'lg화학':'051910.KS','포스코':'005490.KS','posco':'005490.KS',
  '셀트리온':'068270.KS','카카오뱅크':'323410.KS',
  '크래프톤':'259960.KS','하이브':'352820.KS',
  '엔씨':'036570.KS','엔씨소프트':'036570.KS',
  '넷마블':'251270.KS','아모레퍼시픽':'090430.KS',
  'kt':'030200.KS','skt':'017670.KS','sk텔레콤':'017670.KS',
  'lg전자':'066570.KS','lg':'003550.KS',
  '신한':'055550.KS','kb':'105560.KS','kb금융':'105560.KS',
  '하나':'086790.KS','한전':'015760.KS','한국전력':'015760.KS',
  '이건홀딩스':'015360.KS','이건':'015360.KS',
  '에코프로비엠':'247540.KQ','에코프로':'086520.KQ',
  '엔비디아':'NVDA','테슬라':'TSLA','애플':'AAPL',
  '마이크로소프트':'MSFT','구글':'GOOGL','아마존':'AMZN',
  '메타':'META','넷플릭스':'NFLX','인텔':'INTC',
  'apple':'AAPL','nvidia':'NVDA','tesla':'TSLA',
  'microsoft':'MSFT','google':'GOOGL','amazon':'AMZN',
  'meta':'META','netflix':'NFLX','samsung':'005930.KS',
};

// ──────────────────────────────────────────────
//  유틸리티
// ──────────────────────────────────────────────
const $ = id => document.getElementById(id);

const fmt = (n, dec = 2) =>
  n == null || isNaN(n) || n === 0 ? 'N/A'
  : Number(n).toLocaleString('ko-KR', { maximumFractionDigits: dec });

const fmtPct = n =>
  n == null || isNaN(n) ? ''
  : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';

function resolveSymbol(raw) {
  const q = raw.trim();
  const lq = q.toLowerCase().replace(/\s+/g, '');

  if (ALIAS[lq]) return ALIAS[lq];

  const dbHit = STOCK_DB.find(s =>
    s.name.replace(/\s/g,'').toLowerCase() === lq ||
    s.en.replace(/\s/g,'').toLowerCase() === lq ||
    s.sym.toLowerCase() === lq
  );
  if (dbHit) return dbHit.sym;

  if (/^\d{6}$/.test(q)) return q + '.KS';
  if (/^\d{6}\.(ks|kq)$/i.test(q)) return q.toUpperCase();

  return q.toUpperCase();
}

// ──────────────────────────────────────────────
//  Cloudflare Function API 호출
// ──────────────────────────────────────────────
async function apiCall(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/stock?${qs}`);
  if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || '데이터 없음');
  return json.data;
}

const getQuote   = sym => apiCall({ action: 'quote',   symbol: sym });
const getHistory = (sym, days = 30) => apiCall({ action: 'history', symbol: sym, days });
const searchAPI  = q  => apiCall({ action: 'search',  q });

// ──────────────────────────────────────────────
//  차트
// ──────────────────────────────────────────────
let chartInst = null;

function drawChart(history, isKR) {
  const labels = history.map(d => {
    const parts = String(d.date).split('-');
    return parts.length === 3 ? `${+parts[1]}/${+parts[2]}` : d.date;
  });
  const prices = history.map(d => d.close);

  const ctx = document.getElementById('priceChart').getContext('2d');
  if (chartInst) chartInst.destroy();

  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? '#26d968' : '#f85149';

  chartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: color,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        fill: true,
        backgroundColor: c => {
          const g = c.chart.ctx.createLinearGradient(0, 0, 0, 240);
          g.addColorStop(0, isUp ? 'rgba(38,217,104,0.28)' : 'rgba(248,81,73,0.28)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          return g;
        },
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1117',
          borderColor: '#21262d',
          borderWidth: 1,
          titleColor: '#8b949e',
          bodyColor: '#e6edf3',
          bodyFont: { family: 'JetBrains Mono', size: 12 },
          padding: 10,
          callbacks: {
            label: c => ' ' + (isKR
              ? fmt(c.parsed.y, 0) + '원'
              : '$' + fmt(c.parsed.y, 2))
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(33,38,45,0.8)' }, ticks: { color: '#484f58', maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 11 } } },
        y: { grid: { color: 'rgba(33,38,45,0.8)' }, ticks: { color: '#484f58', font: { family: 'JetBrains Mono', size: 11 }, callback: v => isKR ? fmt(v,0) : '$'+fmt(v,0) } }
      }
    }
  });
}

// ──────────────────────────────────────────────
//  AI 분석
// ──────────────────────────────────────────────
function buildPrompt(sd) {
  const recent = (sd.histPrices || []).slice(-10).map((p,i) => `D${i+1}:${p}`).join(', ');
  const vals = (sd.histPrices || []).filter(Boolean);
  const maxP = vals.length ? Math.max(...vals) : 0;
  const minP = vals.length ? Math.min(...vals) : 0;
  const vol  = minP > 0 ? (((maxP-minP)/minP)*100).toFixed(1) : 0;
  const trend = vals.length >= 2 ? (vals[vals.length-1] > vals[0] ? '상승' : '하락') : '보합';

  return `당신은 세계 최고 수준의 주식 애널리스트입니다. 아래 실시간 주식 데이터를 분석하여 반드시 순수 JSON만 출력하세요.

종목: ${sd.name} (${sd.symbol})
시장: ${sd.market} | 현재가: ${sd.priceRaw} | 등락: ${sd.changePct}%
52주고가: ${sd.high52Raw} | 52주저가: ${sd.low52Raw}
거래량: ${sd.volumeRaw} | 시가총액: ${sd.marketCap}
PER: ${sd.pe} | EPS: ${sd.eps}
섹터: ${sd.sector || 'N/A'} | 업종: ${sd.industry || 'N/A'}
최근10일 종가: ${recent}
30일 트렌드: ${trend} | 변동성: ${vol}%

JSON (값은 한국어로, 가격은 원화 또는 달러 단위 명시):
{"verdict":"매수|매도|관망|주목","verdictReason":"3~4문장","buyStrategy":{"zone":"구체적 매수 구간","timing":"매수 타이밍","split":["1차 매수가","2차 매수가"]},"sellStrategy":{"shortTarget":"단기목표가","midTarget":"중기목표가","stopLoss":"손절가","exitSignal":"익절신호"},"risks":["리스크1","리스크2","리스크3"],"riskLevel":"낮음|중간|높음","riskScore":40,"scenarios":{"bull":{"price":"낙관목표가","desc":"낙관시나리오"},"base":{"price":"중립목표가","desc":"중립시나리오"},"bear":{"price":"비관목표가","desc":"비관시나리오"}},"watchPoints":["포인트1","포인트2","포인트3"],"summary":"핵심 2문장"}`;
}

async function callAI(stockData) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildPrompt(stockData) }),
  });
  if (!res.ok) throw new Error('AI 서버 오류');
  return res.json();
}

function renderAI(r) {
  const vMap = { '매수':'buy', '매도':'sell', '관망':'hold', '주목':'watch' };
  const vClass = vMap[r.verdict] || 'hold';
  const score = Math.min(100, Math.max(0, r.riskScore || 50));
  const rClass = score < 35 ? 'low' : score < 65 ? 'mid' : 'high';

  $('aiContent').innerHTML = `
    <div class="ai-section">
      <div class="ai-section-title">종합 투자 의견</div>
      <div class="verdict-chips">
        <span class="verdict-chip ${vClass}">${r.verdict || '관망'}</span>
        <span class="verdict-chip ${rClass === 'low' ? 'buy' : rClass === 'high' ? 'sell' : 'hold'}">리스크 ${r.riskLevel || '중간'}</span>
      </div>
      <p style="color:#c9d1d9;line-height:1.9;margin-top:14px">${r.verdictReason || r.summary || ''}</p>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">매수 / 매도 전략</div>
      <div class="target-row">
        <div class="target-item buy-target">
          <div class="t-label">매수 구간</div>
          <div class="t-val" style="font-size:.82rem;word-break:keep-all">${r.buyStrategy?.zone || 'N/A'}</div>
        </div>
        <div class="target-item sell-target">
          <div class="t-label">단기 목표가</div>
          <div class="t-val">${r.sellStrategy?.shortTarget || 'N/A'}</div>
        </div>
        <div class="target-item target-target">
          <div class="t-label">중기 목표가</div>
          <div class="t-val">${r.sellStrategy?.midTarget || 'N/A'}</div>
        </div>
        <div class="target-item stop-target">
          <div class="t-label">손절가</div>
          <div class="t-val">${r.sellStrategy?.stopLoss || 'N/A'}</div>
        </div>
      </div>
      ${r.buyStrategy?.split?.length ? `<p style="margin-top:10px;color:#8b949e;font-size:.88rem">분할매수: ${r.buyStrategy.split.join(' → ')}</p>` : ''}
      ${r.buyStrategy?.timing ? `<p style="margin-top:6px;color:#8b949e;font-size:.88rem">타이밍: ${r.buyStrategy.timing}</p>` : ''}
      ${r.sellStrategy?.exitSignal ? `<p style="margin-top:6px;color:#8b949e;font-size:.88rem">익절 신호: ${r.sellStrategy.exitSignal}</p>` : ''}
    </div>

    <div class="ai-section">
      <div class="ai-section-title">3개월 시나리오</div>
      <div class="target-row">
        <div class="target-item buy-target">
          <div class="t-label">🟢 낙관</div>
          <div class="t-val">${r.scenarios?.bull?.price || 'N/A'}</div>
          <p style="font-size:.78rem;color:#8b949e;margin-top:6px;line-height:1.6">${r.scenarios?.bull?.desc || ''}</p>
        </div>
        <div class="target-item target-target">
          <div class="t-label">🔵 중립</div>
          <div class="t-val">${r.scenarios?.base?.price || 'N/A'}</div>
          <p style="font-size:.78rem;color:#8b949e;margin-top:6px;line-height:1.6">${r.scenarios?.base?.desc || ''}</p>
        </div>
        <div class="target-item stop-target">
          <div class="t-label">🔴 비관</div>
          <div class="t-val">${r.scenarios?.bear?.price || 'N/A'}</div>
          <p style="font-size:.78rem;color:#8b949e;margin-top:6px;line-height:1.6">${r.scenarios?.bear?.desc || ''}</p>
        </div>
      </div>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">리스크 분석</div>
      <div class="risk-bar">
        <span class="risk-label">리스크</span>
        <div class="risk-track">
          <div class="risk-fill ${rClass}" id="riskBar" style="width:0%;transition:width 1.2s ease"></div>
        </div>
        <span class="risk-pct">${score}%</span>
      </div>
      <ul style="padding-left:20px;margin-top:14px;color:#8b949e;font-size:.9rem;line-height:2.2">
        ${(r.risks||[]).map(x=>`<li><span style="color:#e6edf3">${x}</span></li>`).join('')}
      </ul>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">핵심 관전 포인트</div>
      <ol style="padding-left:22px;font-size:.9rem;line-height:2.4">
        ${(r.watchPoints||[]).map(x=>`<li><span style="color:#e6edf3">${x}</span></li>`).join('')}
      </ol>
    </div>
  `;
  $('aiContent').style.display = 'block';
  $('aiLoading').style.display = 'none';
  setTimeout(() => { const b = $('riskBar'); if(b) b.style.width = score+'%'; }, 150);
}

// ──────────────────────────────────────────────
//  에러 토스트
// ──────────────────────────────────────────────
function toast(msg) {
  document.querySelectorAll('.err-toast').forEach(e=>e.remove());
  const el = document.createElement('div');
  el.className = 'err-toast';
  el.innerHTML = `⚠ ${msg}`;
  Object.assign(el.style, {
    position:'fixed', bottom:'32px', left:'50%', transform:'translateX(-50%)',
    background:'#0d1117', border:'1px solid #f85149', color:'#f85149',
    padding:'14px 28px', borderRadius:'12px', fontSize:'.9rem',
    zIndex:'9999', boxShadow:'0 8px 32px rgba(0,0,0,.6)', maxWidth:'90vw',
    textAlign:'center', lineHeight:'1.6',
  });
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 5000);
}

// ──────────────────────────────────────────────
//  메인 검색 플로우
// ──────────────────────────────────────────────
async function doSearch(raw) {
  const q = raw.trim();
  if (!q) return;

  $('resultSection').style.display = 'none';
  $('searchBtn').disabled = true;
  $('searchBtn').textContent = '로딩 중...';

  try {
    const symbol = resolveSymbol(q);
    const isKR   = symbol.endsWith('.KS') || symbol.endsWith('.KQ');
    const mkt    = symbol.endsWith('.KS') ? 'KOSPI' : symbol.endsWith('.KQ') ? 'KOSDAQ' : 'US MARKET';

    $('searchBtn').textContent = '데이터 수집 중...';

    // 병렬로 시세 + 히스토리 요청
    const [quote, histData] = await Promise.all([
      getQuote(symbol),
      getHistory(symbol, 30).catch(() => ({ history: [] })),
    ]);

    const history = histData.history || [];
    const prices  = history.map(d => d.close).filter(Boolean);

    // 가격 포맷
    const p    = quote.price || 0;
    const chg  = quote.change || 0;
    const pct  = quote.changePct || 0;
    const isUp = chg >= 0;

    const priceStr  = isKR ? fmt(p, 0) + '원' : '$' + (p >= 100 ? fmt(p,2) : fmt(p,4));
    const changeStr = (isUp?'+':'') + (isKR ? fmt(chg,0)+'원' : (chg>=0?'+$':'-$')+fmt(Math.abs(chg),2)) + ` (${fmtPct(pct)})`;

    const mkCap = quote.marketCap || 0;
    const mkCapStr = mkCap <= 0 ? 'N/A'
      : isKR
        ? (mkCap >= 1e12 ? fmt(mkCap/1e12,1)+'조원' : fmt(mkCap/1e8,0)+'억원')
        : '$'+fmt(mkCap/1e9,1)+'B';

    const stockData = {
      name:      quote.name || STOCK_DB.find(s=>s.sym===symbol)?.name || symbol,
      symbol,
      price:     priceStr,
      priceRaw:  p,
      changeStr,
      changePct: pct,
      market:    mkt,
      high52:    isKR ? fmt(quote.high52,0)+'원'  : '$'+fmt(quote.high52,2),
      low52:     isKR ? fmt(quote.low52,0)+'원'   : '$'+fmt(quote.low52,2),
      high52Raw: quote.high52,
      low52Raw:  quote.low52,
      volume:    fmt(quote.volume, 0),
      volumeRaw: quote.volume,
      marketCap: mkCapStr,
      pe:        fmt(quote.pe, 1),
      eps:       fmt(quote.eps, 2),
      sector:    quote.sector   || '',
      industry:  quote.industry || '',
      histPrices: prices,
    };

    // UI 업데이트
    $('resultMarket').textContent  = mkt;
    $('resultTime').textContent    = '실시간 · ' + new Date().toLocaleTimeString('ko-KR');
    $('resultName').textContent    = stockData.name;
    $('resultTicker').textContent  = symbol;
    $('resultPrice').textContent   = priceStr;
    $('resultChange').textContent  = changeStr;
    $('resultChange').className    = 'price-change ' + (isUp ? 'up' : 'down');

    $('statsGrid').innerHTML = [
      { label:'52주 고가', val: stockData.high52 },
      { label:'52주 저가', val: stockData.low52  },
      { label:'거래량',    val: stockData.volume },
      { label:'시가총액',  val: stockData.marketCap },
      { label:'PER',       val: stockData.pe },
      { label:'EPS',       val: stockData.eps },
    ].map(s=>`<div class="stat-item"><div class="stat-label">${s.label}</div><div class="stat-value">${s.val}</div></div>`).join('');

    if (history.length) drawChart(history, isKR);

    $('resultSection').style.display = 'block';
    $('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // AI 분석
    $('aiLoading').style.display = 'flex';
    $('aiContent').style.display = 'none';
    $('searchBtn').textContent = 'AI 분석 중...';

    callAI(stockData).then(renderAI).catch(e => {
      $('aiLoading').style.display = 'none';
      $('aiContent').innerHTML = `
        <p style="color:#f85149;font-weight:700;margin-bottom:8px">⚠ AI 분석 오류</p>
        <p style="color:#8b949e;font-size:.88rem">${e.message}</p>
        <p style="color:#484f58;font-size:.82rem;margin-top:10px">
          Cloudflare Pages › Settings › Environment variables 에<br>
          <code style="color:#00d4aa">ANTHROPIC_API_KEY</code> 를 추가하면 AI 분석이 활성화됩니다.
        </p>`;
      $('aiContent').style.display = 'block';
    });

  } catch (e) {
    console.error(e);
    toast(e.message);
  } finally {
    $('searchBtn').disabled = false;
    $('searchBtn').textContent = '분석하기';
  }
}

// ──────────────────────────────────────────────
//  자동완성 (로컬 DB — 즉각 반응)
// ──────────────────────────────────────────────
let sugTimer;

function showSug(query) {
  const q = query.trim().toLowerCase().replace(/\s+/g,'');
  if (!q) { hideSug(); return; }

  const hits = STOCK_DB.filter(s =>
    s.name.replace(/\s/g,'').toLowerCase().includes(q) ||
    s.en.replace(/\s/g,'').toLowerCase().includes(q)   ||
    s.sym.toLowerCase().replace(/\.(ks|kq)$/i,'').includes(q)
  ).slice(0, 8);

  if (!hits.length) { hideSug(); return; }

  const mktCls = { KOSPI:'kospi', KOSDAQ:'kosdaq', NASDAQ:'us', NYSE:'us' };

  $('suggestions').innerHTML = hits.map(s => `
    <div class="sug-item" data-sym="${s.sym}">
      <div>
        <div class="sug-name">${s.name} <span style="color:#484f58;font-size:.78rem">${s.en}</span></div>
        <div class="sug-meta">${s.sym}</div>
      </div>
      <span class="sug-market ${mktCls[s.mkt]||'us'}">${s.mkt}</span>
    </div>`).join('');

  $('suggestions').classList.add('open');

  $('suggestions').querySelectorAll('.sug-item').forEach(el =>
    el.addEventListener('click', () => {
      const info = STOCK_DB.find(s => s.sym === el.dataset.sym);
      $('searchInput').value = info ? info.name : el.dataset.sym;
      hideSug();
      doSearch(el.dataset.sym);
    })
  );
}

function hideSug() { $('suggestions').classList.remove('open'); }

// ──────────────────────────────────────────────
//  인기 종목 카드
// ──────────────────────────────────────────────
const POPULAR = [
  { sym:'005930.KS', name:'삼성전자',    mkt:'KOSPI'  },
  { sym:'000660.KS', name:'SK하이닉스', mkt:'KOSPI'  },
  { sym:'035420.KS', name:'NAVER',       mkt:'KOSPI'  },
  { sym:'NVDA',      name:'NVIDIA',      mkt:'NASDAQ' },
  { sym:'AAPL',      name:'Apple',       mkt:'NASDAQ' },
  { sym:'TSLA',      name:'Tesla',       mkt:'NASDAQ' },
];

async function loadPopular() {
  const grid = $('popularGrid');
  grid.innerHTML = POPULAR.map(() => '<div class="pop-skeleton"></div>').join('');

  const results = await Promise.allSettled(POPULAR.map(s => getQuote(s.sym)));

  grid.innerHTML = POPULAR.map((s, i) => {
    const isKR = s.sym.endsWith('.KS') || s.sym.endsWith('.KQ');
    const res = results[i];

    if (res.status === 'rejected') {
      return `<div class="pop-card" data-sym="${s.sym}">
        <div class="pop-sym">${s.sym} · ${s.mkt}</div>
        <div class="pop-name">${s.name}</div>
        <div class="pop-price" style="color:#484f58">데이터 없음</div>
        <div class="pop-change" style="color:#484f58;font-size:.75rem">${res.reason?.message || ''}</div>
      </div>`;
    }

    const q = res.value;
    const p = q.price || 0;
    const pct = q.changePct || 0;
    const isUp = pct >= 0;
    const priceStr = isKR ? fmt(p, 0)+'원' : '$'+fmt(p, 2);

    return `<div class="pop-card" data-sym="${s.sym}">
      <div class="pop-sym">${s.sym} · ${s.mkt}</div>
      <div class="pop-name">${q.name || s.name}</div>
      <div class="pop-price">${priceStr}</div>
      <div class="pop-change ${isUp?'up':'down'}">${fmtPct(pct)}</div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.pop-card').forEach(el =>
    el.addEventListener('click', () => doSearch(el.dataset.sym))
  );
}

// ──────────────────────────────────────────────
//  티커 바
// ──────────────────────────────────────────────
async function loadTicker() {
  const TICKERS = [
    { sym:'005930.KS', name:'삼성전자', isKR:true  },
    { sym:'000660.KS', name:'SK하이닉스',isKR:true  },
    { sym:'035420.KS', name:'NAVER',    isKR:true  },
    { sym:'NVDA',      name:'NVIDIA',   isKR:false },
    { sym:'AAPL',      name:'Apple',    isKR:false },
    { sym:'TSLA',      name:'Tesla',    isKR:false },
    { sym:'MSFT',      name:'Microsoft',isKR:false },
    { sym:'035720.KS', name:'카카오',   isKR:true  },
  ];

  const results = await Promise.allSettled(TICKERS.map(t => getQuote(t.sym)));

  const items = TICKERS.map((t, i) => {
    const r = results[i];
    if (r.status === 'rejected') return null;
    return { ...t, price: r.value.price, pct: r.value.changePct };
  }).filter(Boolean);

  if (!items.length) {
    $('tickerTrack').innerHTML = '<span class="tick-item loading">실시간 데이터 로딩 중...</span>';
    return;
  }

  const html = () => items.map(it => {
    const isUp = (it.pct ?? 0) >= 0;
    const ps = it.isKR ? fmt(it.price,0)+'원' : '$'+fmt(it.price,2);
    return `<span class="tick-item" data-sym="${it.sym}">
      <span class="t-sym">${it.name}</span>
      ${ps}
      <span class="${isUp?'t-up':'t-down'}">${fmtPct(it.pct)}</span>
    </span>`;
  }).join('');

  const track = $('tickerTrack');
  track.innerHTML = html() + html();
  track.querySelectorAll('.tick-item').forEach(el =>
    el.addEventListener('click', () => doSearch(el.dataset.sym))
  );
}

// ──────────────────────────────────────────────
//  이벤트 바인딩
// ──────────────────────────────────────────────
$('searchBtn').addEventListener('click', () => doSearch($('searchInput').value));

$('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter')  { hideSug(); doSearch($('searchInput').value); }
  if (e.key === 'Escape') hideSug();
});

$('searchInput').addEventListener('input', e => {
  clearTimeout(sugTimer);
  sugTimer = setTimeout(() => showSug(e.target.value), 150);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) hideSug();
});

document.querySelectorAll('.chip').forEach(chip =>
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  })
);

// ──────────────────────────────────────────────
//  초기 로드
// ──────────────────────────────────────────────
(async () => {
  await Promise.allSettled([loadTicker(), loadPopular()]);
})();
