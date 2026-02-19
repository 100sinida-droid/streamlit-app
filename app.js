// ============================================================
//  STOCKMIND AI — app.js v3.0
//
//  데이터 소스:
//  ┌─────────────────────────────────────────────────────┐
//  │ Financial Modeling Prep (FMP) API                   │
//  │ - CORS 허용 → 브라우저 직접 호출 가능               │
//  │ - 무료: 250콜/일 (https://site.financialmodelingprep.com) │
//  │ - 미국주식 + 한국주식(KS/KQ) 모두 지원              │
//  └─────────────────────────────────────────────────────│
//  AI 분석: /api/analyze (Cloudflare Function → Claude)
// ============================================================

// ★★★ FMP 무료 API 키 (회원가입 후 발급: financialmodelingprep.com) ★★★
// 기본값은 "demo" — 일부 종목만 가능. 본인 키로 교체하면 모든 종목 가능.
const FMP_KEY = 'dInmlR5CcjKZghop5ePbE95FpacKzcBS'; // ← 여기에 발급받은 키 입력

const FMP = {
  BASE: 'https://financialmodelingprep.com/api/v3',
  STABLE: 'https://financialmodelingprep.com/stable',
};

// ──────────────────────────────────────────────
// 종목 내장 DB (한글검색 + 자동완성용)
// FMP API 실패 시 폴백으로도 사용
// ──────────────────────────────────────────────
const STOCK_DB = [
  // 코스피
  { sym:'005930.KS', name:'삼성전자',         en:'Samsung Electronics', mkt:'KOSPI'  },
  { sym:'000660.KS', name:'SK하이닉스',        en:'SK Hynix',           mkt:'KOSPI'  },
  { sym:'035420.KS', name:'NAVER',             en:'NAVER',               mkt:'KOSPI'  },
  { sym:'035720.KS', name:'카카오',            en:'Kakao',               mkt:'KOSPI'  },
  { sym:'005380.KS', name:'현대자동차',        en:'Hyundai Motor',       mkt:'KOSPI'  },
  { sym:'000270.KS', name:'기아',              en:'Kia',                 mkt:'KOSPI'  },
  { sym:'051910.KS', name:'LG화학',            en:'LG Chem',             mkt:'KOSPI'  },
  { sym:'005490.KS', name:'POSCO홀딩스',       en:'POSCO Holdings',      mkt:'KOSPI'  },
  { sym:'207940.KS', name:'삼성바이오로직스',  en:'Samsung Biologics',   mkt:'KOSPI'  },
  { sym:'068270.KS', name:'셀트리온',          en:'Celltrion',           mkt:'KOSPI'  },
  { sym:'323410.KS', name:'카카오뱅크',        en:'KakaoBank',           mkt:'KOSPI'  },
  { sym:'259960.KS', name:'크래프톤',          en:'Krafton',             mkt:'KOSPI'  },
  { sym:'352820.KS', name:'하이브',            en:'HYBE',                mkt:'KOSPI'  },
  { sym:'036570.KS', name:'엔씨소프트',        en:'NCSoft',              mkt:'KOSPI'  },
  { sym:'251270.KS', name:'넷마블',            en:'Netmarble',           mkt:'KOSPI'  },
  { sym:'090430.KS', name:'아모레퍼시픽',      en:'AmorePacific',        mkt:'KOSPI'  },
  { sym:'030200.KS', name:'KT',               en:'KT',                  mkt:'KOSPI'  },
  { sym:'017670.KS', name:'SK텔레콤',          en:'SK Telecom',          mkt:'KOSPI'  },
  { sym:'066570.KS', name:'LG전자',            en:'LG Electronics',      mkt:'KOSPI'  },
  { sym:'055550.KS', name:'신한지주',          en:'Shinhan Financial',   mkt:'KOSPI'  },
  { sym:'034020.KS', name:'두산에너빌리티',    en:'Doosan Enerbility',   mkt:'KOSPI'  },
  { sym:'015760.KS', name:'한국전력',          en:'Korea Electric Power',mkt:'KOSPI'  },
  { sym:'028260.KS', name:'삼성물산',          en:'Samsung C&T',         mkt:'KOSPI'  },
  { sym:'012330.KS', name:'현대모비스',        en:'Hyundai Mobis',       mkt:'KOSPI'  },
  { sym:'011170.KS', name:'롯데케미칼',        en:'Lotte Chemical',      mkt:'KOSPI'  },
  { sym:'010130.KS', name:'고려아연',          en:'Korea Zinc',          mkt:'KOSPI'  },
  { sym:'105560.KS', name:'KB금융',            en:'KB Financial',        mkt:'KOSPI'  },
  { sym:'086790.KS', name:'하나금융지주',      en:'Hana Financial',      mkt:'KOSPI'  },
  { sym:'096770.KS', name:'SK이노베이션',      en:'SK Innovation',       mkt:'KOSPI'  },
  { sym:'000810.KS', name:'삼성화재',          en:'Samsung Fire',        mkt:'KOSPI'  },
  { sym:'003550.KS', name:'LG',               en:'LG Corp',             mkt:'KOSPI'  },
  { sym:'032830.KS', name:'삼성생명',          en:'Samsung Life',        mkt:'KOSPI'  },
  // 코스닥
  { sym:'247540.KQ', name:'에코프로비엠',      en:'EcoPro BM',           mkt:'KOSDAQ' },
  { sym:'086520.KQ', name:'에코프로',          en:'EcoPro',              mkt:'KOSDAQ' },
  { sym:'091990.KQ', name:'셀트리온헬스케어',  en:'Celltrion Healthcare', mkt:'KOSDAQ' },
  { sym:'293490.KQ', name:'카카오게임즈',      en:'Kakao Games',         mkt:'KOSDAQ' },
  { sym:'086900.KQ', name:'메디톡스',          en:'Medytox',             mkt:'KOSDAQ' },
  { sym:'263750.KQ', name:'펄어비스',          en:'Pearl Abyss',         mkt:'KOSDAQ' },
  { sym:'078340.KQ', name:'컴투스',            en:'Com2uS',              mkt:'KOSDAQ' },
  { sym:'357780.KQ', name:'솔브레인',          en:'Soulbrain',           mkt:'KOSDAQ' },
  { sym:'196170.KQ', name:'알테오젠',          en:'Alteogen',            mkt:'KOSDAQ' },
  { sym:'145020.KQ', name:'휴젤',              en:'Hugel',               mkt:'KOSDAQ' },
  { sym:'214150.KQ', name:'클래시스',          en:'Classis',             mkt:'KOSDAQ' },
  // 미국
  { sym:'AAPL',  name:'Apple',               en:'Apple Inc',           mkt:'NASDAQ' },
  { sym:'MSFT',  name:'Microsoft',           en:'Microsoft Corp',      mkt:'NASDAQ' },
  { sym:'GOOGL', name:'Alphabet(Google)',    en:'Alphabet Inc',        mkt:'NASDAQ' },
  { sym:'AMZN',  name:'Amazon',             en:'Amazon.com',          mkt:'NASDAQ' },
  { sym:'NVDA',  name:'NVIDIA',             en:'NVIDIA Corp',         mkt:'NASDAQ' },
  { sym:'META',  name:'Meta(Facebook)',      en:'Meta Platforms',      mkt:'NASDAQ' },
  { sym:'TSLA',  name:'Tesla',              en:'Tesla Inc',           mkt:'NASDAQ' },
  { sym:'TSM',   name:'TSMC',              en:'Taiwan Semiconductor', mkt:'NYSE'   },
  { sym:'AVGO',  name:'Broadcom',           en:'Broadcom Inc',        mkt:'NASDAQ' },
  { sym:'ORCL',  name:'Oracle',             en:'Oracle Corp',         mkt:'NYSE'   },
  { sym:'NFLX',  name:'Netflix',            en:'Netflix Inc',         mkt:'NASDAQ' },
  { sym:'AMD',   name:'AMD',               en:'Advanced Micro Devices',mkt:'NASDAQ'},
  { sym:'INTC',  name:'Intel',             en:'Intel Corp',          mkt:'NASDAQ' },
  { sym:'DIS',   name:'Disney',            en:'Walt Disney Co',      mkt:'NYSE'   },
  { sym:'BABA',  name:'Alibaba',           en:'Alibaba Group',       mkt:'NYSE'   },
  { sym:'V',     name:'Visa',             en:'Visa Inc',            mkt:'NYSE'   },
  { sym:'JPM',   name:'JP Morgan',         en:'JPMorgan Chase',      mkt:'NYSE'   },
  { sym:'WMT',   name:'Walmart',           en:'Walmart Inc',         mkt:'NYSE'   },
  { sym:'COIN',  name:'Coinbase',          en:'Coinbase Global',     mkt:'NASDAQ' },
  { sym:'PLTR',  name:'Palantir',          en:'Palantir Technologies',mkt:'NASDAQ'},
  { sym:'SMCI',  name:'Super Micro',       en:'Super Micro Computer',mkt:'NASDAQ' },
  { sym:'ARM',   name:'Arm Holdings',      en:'Arm Holdings',        mkt:'NASDAQ' },
];

// 한글/영문 → 심볼 빠른 매핑
const NAME_MAP = {};
STOCK_DB.forEach(s => {
  NAME_MAP[s.name.toLowerCase().replace(/\s/g,'')] = s.sym;
  NAME_MAP[s.en.toLowerCase().replace(/\s/g,'')]   = s.sym;
  if (s.sym.includes('.')) NAME_MAP[s.sym.split('.')[0]] = s.sym;
});

// 특별 한글 별칭
const ALIASES = {
  '삼성': '005930.KS', '하이닉스': '000660.KS', '네이버': '035420.KS',
  '카카오': '035720.KS', '현대차': '005380.KS', '기아차': '000270.KS',
  '기아': '000270.KS', '포스코': '005490.KS', '셀트리온': '068270.KS',
  '에코프로비엠': '247540.KQ', '에코프로': '086520.KQ',
  '하이브': '352820.KS', '크래프톤': '259960.KS',
  '엔씨': '036570.KS', '넷마블': '251270.KS',
  '엔비디아': 'NVDA', '테슬라': 'TSLA', '애플': 'AAPL',
  '마이크로소프트': 'MSFT', '구글': 'GOOGL', '아마존': 'AMZN',
  '메타': 'META', '넷플릭스': 'NFLX', '인텔': 'INTC',
  'skt': '017670.KS', 'kt': '030200.KS',
  'lg화학': '051910.KS', 'lg전자': '066570.KS', 'lg': '003550.KS',
  '신한': '055550.KS', 'kb금융': '105560.KS', 'kb': '105560.KS',
  '하나금융': '086790.KS', '한전': '015760.KS', '한국전력': '015760.KS',
  '이건홀딩스': '015360.KS',
};

// ──────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = (n, dec = 2) =>
  n == null || isNaN(n) ? 'N/A' : Number(n).toLocaleString('ko-KR', { maximumFractionDigits: dec });
const fmtPct = n =>
  n == null || isNaN(n) ? '' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';

function resolveSymbol(raw) {
  const q = raw.trim();
  const lq = q.toLowerCase().replace(/\s+/g, '');

  // 1. 별칭 우선
  if (ALIASES[lq]) return ALIASES[lq];
  if (ALIASES[q.toLowerCase()]) return ALIASES[q.toLowerCase()];

  // 2. NAME_MAP
  if (NAME_MAP[lq]) return NAME_MAP[lq];

  // 3. 6자리 숫자
  if (/^\d{6}$/.test(q)) return q + '.KS';
  if (/^\d{6}\.(ks|kq)$/i.test(q)) return q.toUpperCase();

  // 4. 종목 DB 부분 검색
  const found = STOCK_DB.find(s =>
    s.name.replace(/\s/g,'').toLowerCase().includes(lq) ||
    s.en.replace(/\s/g,'').toLowerCase().includes(lq)
  );
  if (found) return found.sym;

  return q.toUpperCase();
}

function getStockInfo(sym) {
  return STOCK_DB.find(s => s.sym.toUpperCase() === sym.toUpperCase());
}

// ──────────────────────────────────────────────
// FMP API 호출 (브라우저 직접 — CORS 허용)
// ──────────────────────────────────────────────
async function fmpFetch(path, params = {}) {
  params.apikey = FMP_KEY;
  const qs = new URLSearchParams(params).toString();
  const url = `${FMP.BASE}${path}?${qs}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) throw new Error(`FMP API 오류: ${res.status}`);
  const data = await res.json();

  // FMP demo 키 제한 에러
  if (data?.['Error Message']) throw new Error(data['Error Message']);
  return data;
}

// 현재 시세
async function fetchQuote(symbol) {
  // KS/KQ 심볼 → FMP 형식으로 변환 (005930.KS → 005930.KS 그대로 지원)
  const data = await fmpFetch(`/quote/${encodeURIComponent(symbol)}`);
  if (!Array.isArray(data) || !data.length) throw new Error(`데이터 없음: ${symbol}`);
  return data[0];
}

// 히스토리 차트
async function fetchHistory(symbol, days = 30) {
  const data = await fmpFetch(`/historical-price-full/${encodeURIComponent(symbol)}`, {
    serietype: 'line',
    timeseries: days,
  });
  if (!data?.historical?.length) throw new Error(`차트 데이터 없음: ${symbol}`);
  return data.historical.reverse(); // 오래된 날짜 순
}

// 회사 프로필
async function fetchProfile(symbol) {
  try {
    const data = await fmpFetch(`/profile/${encodeURIComponent(symbol)}`);
    return Array.isArray(data) ? data[0] : data;
  } catch { return {}; }
}

// ──────────────────────────────────────────────
// 자동완성 검색 (로컬 DB — API 불필요)
// ──────────────────────────────────────────────
function searchLocal(query) {
  const q = query.trim().toLowerCase().replace(/\s+/g, '');
  if (!q) return [];

  return STOCK_DB.filter(s =>
    s.name.replace(/\s/g,'').toLowerCase().includes(q) ||
    s.en.replace(/\s/g,'').toLowerCase().includes(q) ||
    s.sym.toLowerCase().includes(q)
  ).slice(0, 8);
}

// ──────────────────────────────────────────────
// 차트 렌더링
// ──────────────────────────────────────────────
let priceChartInst = null;

function drawChart(histData) {
  const labels = histData.map(d => {
    const dt = new Date(d.date);
    return `${dt.getMonth()+1}/${dt.getDate()}`;
  });
  const prices = histData.map(d => d.close ?? d.price);

  const ctx = document.getElementById('priceChart').getContext('2d');
  if (priceChartInst) priceChartInst.destroy();

  const isUp = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? '#26d968' : '#f85149';

  priceChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: lineColor,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: lineColor,
        fill: true,
        backgroundColor: ctx2 => {
          const g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, 240);
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
            label: ctx2 => {
              const v = ctx2.parsed.y;
              return ' ' + (v >= 1000 ? fmt(v, 0) : fmt(v, 2));
            }
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(33,38,45,0.8)' }, ticks: { color: '#484f58', maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 11 } } },
        y: { grid: { color: 'rgba(33,38,45,0.8)' }, ticks: { color: '#484f58', font: { family: 'JetBrains Mono', size: 11 } } }
      }
    }
  });
}

// ──────────────────────────────────────────────
// Claude AI 분석
// ──────────────────────────────────────────────
function buildPrompt(sd) {
  const recentPrices = (sd.histPrices || []).slice(-10)
    .map((p, i) => `D${i+1}:${p != null ? Number(p).toFixed(2) : '-'}`)
    .join(', ');
  const valid = (sd.histPrices || []).filter(Boolean);
  const maxP = valid.length ? Math.max(...valid) : 0;
  const minP = valid.length ? Math.min(...valid) : 0;
  const vol = minP > 0 ? (((maxP - minP) / minP) * 100).toFixed(1) : '0';
  const trend = valid.length >= 2 ? (valid[valid.length-1] > valid[0] ? '상승' : '하락') : '보합';

  return `당신은 세계 최고 수준의 주식 애널리스트입니다. 아래 실시간 주식 데이터를 분석하여 반드시 순수 JSON만 출력하세요. 마크다운, 설명 없이 JSON 객체만.

종목: ${sd.name} (${sd.symbol})
시장: ${sd.market} | 현재가: ${sd.price} | 등락: ${sd.changeStr}
52주고가: ${sd.high52} | 52주저가: ${sd.low52}
거래량: ${sd.volume} | 시가총액: ${sd.marketCap} | PER: ${sd.pe} | EPS: ${sd.eps}
섹터: ${sd.sector} | 업종: ${sd.industry}
최근10일: ${recentPrices}
30일트렌드: ${trend} | 변동성: ${vol}%

JSON 구조 (값만 한국어로):
{"verdict":"매수|매도|관망|주목","verdictReason":"3~4문장 종합의견","buyStrategy":{"zone":"매수 구간 (예: 75,000~78,000원 또는 $140~$145)","timing":"매수 타이밍 설명","split":["1차 매수가","2차 매수가"]},"sellStrategy":{"shortTarget":"단기목표가","midTarget":"중기목표가","stopLoss":"손절가","exitSignal":"익절 신호 설명"},"risks":["리스크1","리스크2","리스크3"],"riskLevel":"낮음|중간|높음","riskScore":30,"scenarios":{"bull":{"price":"낙관목표가","desc":"낙관 시나리오"},"base":{"price":"중립목표가","desc":"중립 시나리오"},"bear":{"price":"비관목표가","desc":"비관 시나리오"}},"watchPoints":["포인트1","포인트2","포인트3"],"summary":"핵심 요약 2문장"}`;
}

async function analyzeWithAI(stockData) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildPrompt(stockData) }),
  });
  if (!res.ok) throw new Error('AI 서버 오류: ' + res.status);
  return res.json();
}

// ──────────────────────────────────────────────
// AI 결과 렌더링
// ──────────────────────────────────────────────
function renderAIResult(r) {
  const vMap = { '매수':'buy','매도':'sell','관망':'hold','주목':'watch' };
  const vClass = vMap[r.verdict] || 'hold';
  const rScore = Math.min(100, Math.max(0, r.riskScore || 50));
  const rClass = rScore < 35 ? 'low' : rScore < 65 ? 'mid' : 'high';
  const rLabel = rScore < 35 ? '낮음' : rScore < 65 ? '중간' : '높음';

  $('aiContent').innerHTML = `
    <div class="ai-section">
      <div class="ai-section-title">종합 투자 의견</div>
      <div class="verdict-chips">
        <span class="verdict-chip ${vClass}">${r.verdict || '관망'}</span>
        <span class="verdict-chip ${vClass === 'buy' ? 'watch' : vClass === 'sell' ? 'sell' : 'hold'}">리스크 ${r.riskLevel || rLabel}</span>
      </div>
      <p style="color:#c9d1d9;line-height:1.9;margin-top:14px">${r.verdictReason || r.summary || ''}</p>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">매수 / 매도 전략</div>
      <div class="target-row">
        <div class="target-item buy-target">
          <div class="t-label">매수 구간</div>
          <div class="t-val" style="font-size:0.82rem;word-break:keep-all">${r.buyStrategy?.zone || 'N/A'}</div>
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
      ${r.buyStrategy?.split?.length ? `<p style="margin-top:10px;color:#8b949e;font-size:0.88rem">분할매수: ${r.buyStrategy.split.join(' → ')}</p>` : ''}
      ${r.buyStrategy?.timing ? `<p style="margin-top:6px;color:#8b949e;font-size:0.88rem">타이밍: ${r.buyStrategy.timing}</p>` : ''}
      ${r.sellStrategy?.exitSignal ? `<p style="margin-top:6px;color:#8b949e;font-size:0.88rem">익절 신호: ${r.sellStrategy.exitSignal}</p>` : ''}
    </div>

    <div class="ai-section">
      <div class="ai-section-title">3개월 시나리오</div>
      <div class="target-row">
        <div class="target-item buy-target">
          <div class="t-label">🟢 낙관</div>
          <div class="t-val">${r.scenarios?.bull?.price || 'N/A'}</div>
          <p style="font-size:0.78rem;color:#8b949e;margin-top:6px;line-height:1.6">${r.scenarios?.bull?.desc || ''}</p>
        </div>
        <div class="target-item target-target">
          <div class="t-label">🔵 중립</div>
          <div class="t-val">${r.scenarios?.base?.price || 'N/A'}</div>
          <p style="font-size:0.78rem;color:#8b949e;margin-top:6px;line-height:1.6">${r.scenarios?.base?.desc || ''}</p>
        </div>
        <div class="target-item stop-target">
          <div class="t-label">🔴 비관</div>
          <div class="t-val">${r.scenarios?.bear?.price || 'N/A'}</div>
          <p style="font-size:0.78rem;color:#8b949e;margin-top:6px;line-height:1.6">${r.scenarios?.bear?.desc || ''}</p>
        </div>
      </div>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">리스크 분석</div>
      <div class="risk-bar">
        <span class="risk-label">리스크</span>
        <div class="risk-track">
          <div class="risk-fill ${rClass}" id="riskFillBar" style="width:0%;transition:width 1.2s ease"></div>
        </div>
        <span class="risk-pct">${rScore}%</span>
      </div>
      <ul style="padding-left:20px;margin-top:14px;color:#8b949e;font-size:0.9rem;line-height:2.2">
        ${(r.risks || []).map(x => `<li><span style="color:#e6edf3">${x}</span></li>`).join('')}
      </ul>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">핵심 관전 포인트</div>
      <ol style="padding-left:22px;color:#8b949e;font-size:0.9rem;line-height:2.4">
        ${(r.watchPoints || []).map(x => `<li><span style="color:#e6edf3">${x}</span></li>`).join('')}
      </ol>
    </div>
  `;

  $('aiContent').style.display = 'block';
  $('aiLoading').style.display = 'none';

  // 리스크 바 애니메이션
  setTimeout(() => {
    const bar = document.getElementById('riskFillBar');
    if (bar) bar.style.width = rScore + '%';
  }, 150);
}

// ──────────────────────────────────────────────
// 에러 토스트
// ──────────────────────────────────────────────
function showError(msg) {
  document.querySelectorAll('.error-toast').forEach(e => e.remove());
  const t = document.createElement('div');
  t.className = 'error-toast';
  t.innerHTML = `<span style="color:#f85149">⚠ ${msg}</span>`;
  Object.assign(t.style, {
    position:'fixed', bottom:'32px', left:'50%', transform:'translateX(-50%)',
    background:'#0d1117', border:'1px solid #f85149',
    padding:'14px 28px', borderRadius:'12px', fontSize:'0.9rem',
    zIndex:'9999', boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
    animation:'fadeUp .3s ease', whiteSpace:'nowrap',
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// ──────────────────────────────────────────────
// 메인 검색
// ──────────────────────────────────────────────
async function doSearch(rawQuery) {
  const q = rawQuery.trim();
  if (!q) return;

  $('resultSection').style.display = 'none';
  $('searchBtn').disabled = true;
  $('searchBtn').textContent = '로딩 중...';

  try {
    const symbol = resolveSymbol(q);
    const isKR = symbol.endsWith('.KS') || symbol.endsWith('.KQ');
    const mktLabel = symbol.endsWith('.KS') ? 'KOSPI' : symbol.endsWith('.KQ') ? 'KOSDAQ' : 'US MARKET';

    // ── 1. 시세 + 히스토리 병렬 호출 ──
    $('searchBtn').textContent = '데이터 수집 중...';
    let quote, hist, profile;

    try {
      [quote, hist, profile] = await Promise.all([
        fetchQuote(symbol),
        fetchHistory(symbol, 30),
        fetchProfile(symbol),
      ]);
    } catch (e) {
      throw new Error(`"${q}" 데이터를 가져올 수 없습니다.\n• FMP API 키를 확인하세요 (app.js의 FMP_KEY)\n• ${e.message}`);
    }

    // ── 2. 데이터 정리 ──
    const price = quote.price ?? quote.previousClose ?? 0;
    const change = quote.change ?? 0;
    const changePct = quote.changesPercentage ?? 0;
    const isUp = change >= 0;
    const currency = isKR ? 'KRW' : 'USD';

    const priceStr = isKR
      ? fmt(price, 0) + '원'
      : '$' + (price >= 1000 ? fmt(price, 0) : fmt(price, 2));

    const changeStr = (isUp ? '+' : '') +
      (isKR ? fmt(change, 0) + '원' : (change >= 0 ? '+$' : '-$') + fmt(Math.abs(change), 2)) +
      ` (${fmtPct(changePct)})`;

    const mktCap = quote.marketCap;
    const mktCapStr = mktCap
      ? isKR
        ? (mktCap >= 1e12 ? fmt(mktCap/1e12,1)+'조원' : fmt(mktCap/1e8,0)+'억원')
        : '$'+fmt(mktCap/1e9,1)+'B'
      : (profile?.mktCap ? '$'+fmt(profile.mktCap/1e9,1)+'B' : 'N/A');

    const stockData = {
      name: quote.name || profile?.companyName || getStockInfo(symbol)?.name || symbol,
      symbol,
      price: priceStr,
      changeStr,
      market: mktLabel,
      high52: isKR ? fmt(quote.yearHigh,0)+'원' : '$'+fmt(quote.yearHigh,2),
      low52:  isKR ? fmt(quote.yearLow,0)+'원'  : '$'+fmt(quote.yearLow,2),
      volume: fmt(quote.volume, 0),
      avgVol: fmt(quote.avgVolume, 0),
      marketCap: mktCapStr,
      pe:   fmt(quote.pe, 1) || 'N/A',
      eps:  fmt(quote.eps, 2) || 'N/A',
      sector:   profile?.sector   || 'N/A',
      industry: profile?.industry || 'N/A',
      histPrices: hist.map(d => d.close ?? d.price),
    };

    // ── 3. UI 업데이트 ──
    $('resultMarket').textContent = mktLabel;
    $('resultTime').textContent = '실시간 · ' + new Date().toLocaleTimeString('ko-KR');
    $('resultName').textContent = stockData.name;
    $('resultTicker').textContent = symbol.toUpperCase();
    $('resultPrice').textContent = priceStr;
    $('resultChange').textContent = changeStr;
    $('resultChange').className = 'price-change ' + (isUp ? 'up' : 'down');

    $('statsGrid').innerHTML = [
      { label: '52주 고가',  val: stockData.high52 },
      { label: '52주 저가',  val: stockData.low52  },
      { label: '거래량',     val: stockData.volume },
      { label: '시가총액',   val: stockData.marketCap },
      { label: 'PER',        val: stockData.pe },
      { label: 'EPS',        val: stockData.eps },
    ].map(s => `
      <div class="stat-item">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.val}</div>
      </div>`).join('');

    // ── 4. 차트 ──
    drawChart(hist);

    // ── 5. 결과 표시 ──
    $('resultSection').style.display = 'block';
    $('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // ── 6. AI 분석 ──
    $('aiLoading').style.display = 'flex';
    $('aiContent').style.display = 'none';
    $('searchBtn').textContent = 'AI 분석 중...';

    analyzeWithAI(stockData)
      .then(r => renderAIResult(r))
      .catch(err => {
        $('aiLoading').style.display = 'none';
        $('aiContent').innerHTML = `
          <p style="color:#f85149;margin-bottom:10px;font-weight:700">⚠ AI 분석 오류</p>
          <p style="color:#8b949e;font-size:0.88rem;line-height:1.8">${err.message}</p>
          <p style="color:#484f58;font-size:0.82rem;margin-top:12px">
            Cloudflare Pages › Settings › Environment variables 에<br>
            <code style="color:#00d4aa;font-family:'JetBrains Mono'">ANTHROPIC_API_KEY</code> 를 추가하면 AI 분석이 작동합니다.
          </p>`;
        $('aiContent').style.display = 'block';
      });

  } catch (err) {
    console.error(err);
    showError(err.message.split('\n')[0]);
  } finally {
    $('searchBtn').disabled = false;
    $('searchBtn').textContent = '분석하기';
  }
}

// ──────────────────────────────────────────────
// 자동완성
// ──────────────────────────────────────────────
let suggestTimer;

function showSuggestions(query) {
  const results = searchLocal(query);
  if (!results.length) { hideSuggestions(); return; }

  const mktClassMap = { KOSPI:'kospi', KOSDAQ:'kosdaq', NASDAQ:'us', NYSE:'us', 'US MARKET':'us' };

  $('suggestions').innerHTML = results.map(s => `
    <div class="sug-item" data-sym="${s.sym}">
      <div>
        <div class="sug-name">${s.name}${s.en !== s.name ? ' <span style="color:#484f58;font-size:0.8rem">'+s.en+'</span>' : ''}</div>
        <div class="sug-meta">${s.sym}</div>
      </div>
      <span class="sug-market ${mktClassMap[s.mkt]||'us'}">${s.mkt}</span>
    </div>`).join('');

  $('suggestions').classList.add('open');

  $('suggestions').querySelectorAll('.sug-item').forEach(el =>
    el.addEventListener('click', () => {
      const info = STOCK_DB.find(s => s.sym === el.dataset.sym);
      $('searchInput').value = info ? info.name : el.dataset.sym;
      hideSuggestions();
      doSearch(el.dataset.sym);
    })
  );
}

function hideSuggestions() {
  $('suggestions').classList.remove('open');
}

// ──────────────────────────────────────────────
// 인기 종목 카드
// ──────────────────────────────────────────────
const POPULAR = [
  { sym:'005930.KS', name:'삼성전자',    mkt:'KOSPI'  },
  { sym:'000660.KS', name:'SK하이닉스', mkt:'KOSPI'  },
  { sym:'035420.KS', name:'NAVER',       mkt:'KOSPI'  },
  { sym:'NVDA',      name:'NVIDIA',      mkt:'NASDAQ' },
  { sym:'AAPL',      name:'Apple',       mkt:'NASDAQ' },
  { sym:'TSLA',      name:'Tesla',       mkt:'NASDAQ' },
];

async function loadPopularStocks() {
  const grid = $('popularGrid');
  grid.innerHTML = POPULAR.map(() => '<div class="pop-skeleton"></div>').join('');

  const results = await Promise.allSettled(POPULAR.map(s => fetchQuote(s.sym)));

  grid.innerHTML = POPULAR.map((s, i) => {
    const res = results[i];
    const isKR = s.sym.endsWith('.KS') || s.sym.endsWith('.KQ');

    if (res.status === 'rejected') {
      return `<div class="pop-card" data-sym="${s.sym}">
        <div class="pop-sym">${s.sym} · ${s.mkt}</div>
        <div class="pop-name">${s.name}</div>
        <div class="pop-price" style="color:#484f58">데이터 없음</div>
        <div class="pop-change" style="color:#484f58;font-size:0.75rem">FMP 키 필요</div>
      </div>`;
    }

    const q = res.value;
    const price = q.price ?? 0;
    const pct = q.changesPercentage ?? 0;
    const isUp = pct >= 0;
    const priceStr = isKR ? fmt(price, 0) + '원' : '$' + fmt(price, 2);

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
// 티커 바
// ──────────────────────────────────────────────
async function loadTickerBar() {
  const TICKERS = [
    { sym:'005930.KS', name:'삼성전자', isKR:true  },
    { sym:'000660.KS', name:'SK하이닉스',isKR:true  },
    { sym:'NVDA',      name:'NVIDIA',   isKR:false },
    { sym:'AAPL',      name:'Apple',    isKR:false },
    { sym:'TSLA',      name:'Tesla',    isKR:false },
    { sym:'035420.KS', name:'NAVER',    isKR:true  },
  ];

  const results = await Promise.allSettled(TICKERS.map(t => fetchQuote(t.sym)));

  const items = TICKERS.map((t, i) => {
    const res = results[i];
    if (res.status === 'rejected') return null;
    const q = res.value;
    return { ...t, price: q.price, pct: q.changesPercentage };
  }).filter(Boolean);

  if (!items.length) {
    $('tickerTrack').innerHTML = '<span class="tick-item loading">FMP API 키를 설정하면 실시간 데이터가 표시됩니다</span>';
    return;
  }

  const makeHTML = () => items.map(it => {
    const isUp = (it.pct ?? 0) >= 0;
    const priceStr = it.isKR ? fmt(it.price, 0) + '원' : '$' + fmt(it.price, 2);
    return `<span class="tick-item" data-sym="${it.sym}">
      <span class="t-sym">${it.name}</span>
      ${priceStr}
      <span class="${isUp?'t-up':'t-down'}">${fmtPct(it.pct)}</span>
    </span>`;
  }).join('');

  const track = $('tickerTrack');
  track.innerHTML = makeHTML() + makeHTML();
  track.querySelectorAll('.tick-item').forEach(el =>
    el.addEventListener('click', () => doSearch(el.dataset.sym))
  );
}

// ──────────────────────────────────────────────
// 이벤트
// ──────────────────────────────────────────────
$('searchBtn').addEventListener('click', () => doSearch($('searchInput').value));

$('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { hideSuggestions(); doSearch($('searchInput').value); }
  if (e.key === 'Escape') hideSuggestions();
});

$('searchInput').addEventListener('input', e => {
  clearTimeout(suggestTimer);
  const v = e.target.value;
  if (v.trim().length < 1) { hideSuggestions(); return; }
  suggestTimer = setTimeout(() => showSuggestions(v), 200);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) hideSuggestions();
});

document.querySelectorAll('.chip').forEach(chip =>
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  })
);

// ──────────────────────────────────────────────
// 초기 로드
// ──────────────────────────────────────────────
(async () => {
  await Promise.allSettled([loadTickerBar(), loadPopularStocks()]);
})();
