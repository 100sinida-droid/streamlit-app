/* ============================================================
   StockMind AI — app.js (Final)

   데이터 소스:
   ┌─ 한국 주식 → 네이버 금융 (corsproxy.io 경유, 무료·무제한)
   └─ 미국 주식 → FMP API (CORS 허용, 직접 호출)

   AI 분석: /api/analyze (Cloudflare Function) 또는 직접 호출
   ============================================================ */

// ─────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────
const FMP_KEY   = 'dInmlR5CcjKZghop5ePbE95FpacKzcBS';
const FMP_BASE  = 'https://financialmodelingprep.com/api/v3';
const PROXY     = 'https://corsproxy.io/?'; // 한국 주식 CORS 우회
const NAVER_BASE= 'https://m.stock.naver.com/api/stock';

// ─────────────────────────────────────────────
// 종목 내장 DB
// ─────────────────────────────────────────────
const DB = [
  // KOSPI
  {s:'005930.KS', n:'삼성전자',         e:'Samsung Electronics',   m:'KOSPI' },
  {s:'000660.KS', n:'SK하이닉스',        e:'SK Hynix',              m:'KOSPI' },
  {s:'035420.KS', n:'NAVER',             e:'NAVER Corp',            m:'KOSPI' },
  {s:'035720.KS', n:'카카오',            e:'Kakao',                 m:'KOSPI' },
  {s:'005380.KS', n:'현대자동차',        e:'Hyundai Motor',         m:'KOSPI' },
  {s:'000270.KS', n:'기아',              e:'Kia',                   m:'KOSPI' },
  {s:'051910.KS', n:'LG화학',            e:'LG Chem',               m:'KOSPI' },
  {s:'005490.KS', n:'POSCO홀딩스',       e:'POSCO Holdings',        m:'KOSPI' },
  {s:'207940.KS', n:'삼성바이오로직스',  e:'Samsung Biologics',     m:'KOSPI' },
  {s:'068270.KS', n:'셀트리온',          e:'Celltrion',             m:'KOSPI' },
  {s:'323410.KS', n:'카카오뱅크',        e:'KakaoBank',             m:'KOSPI' },
  {s:'259960.KS', n:'크래프톤',          e:'Krafton',               m:'KOSPI' },
  {s:'352820.KS', n:'하이브',            e:'HYBE',                  m:'KOSPI' },
  {s:'036570.KS', n:'엔씨소프트',        e:'NCSoft',                m:'KOSPI' },
  {s:'251270.KS', n:'넷마블',            e:'Netmarble',             m:'KOSPI' },
  {s:'090430.KS', n:'아모레퍼시픽',      e:'AmorePacific',          m:'KOSPI' },
  {s:'030200.KS', n:'KT',               e:'KT Corp',               m:'KOSPI' },
  {s:'017670.KS', n:'SK텔레콤',          e:'SK Telecom',            m:'KOSPI' },
  {s:'066570.KS', n:'LG전자',            e:'LG Electronics',        m:'KOSPI' },
  {s:'055550.KS', n:'신한지주',          e:'Shinhan Financial',     m:'KOSPI' },
  {s:'034020.KS', n:'두산에너빌리티',    e:'Doosan Enerbility',     m:'KOSPI' },
  {s:'015760.KS', n:'한국전력',          e:'Korea Electric Power',  m:'KOSPI' },
  {s:'028260.KS', n:'삼성물산',          e:'Samsung C&T',           m:'KOSPI' },
  {s:'012330.KS', n:'현대모비스',        e:'Hyundai Mobis',         m:'KOSPI' },
  {s:'011170.KS', n:'롯데케미칼',        e:'Lotte Chemical',        m:'KOSPI' },
  {s:'010130.KS', n:'고려아연',          e:'Korea Zinc',            m:'KOSPI' },
  {s:'105560.KS', n:'KB금융',            e:'KB Financial',          m:'KOSPI' },
  {s:'086790.KS', n:'하나금융지주',      e:'Hana Financial',        m:'KOSPI' },
  {s:'096770.KS', n:'SK이노베이션',      e:'SK Innovation',         m:'KOSPI' },
  {s:'003550.KS', n:'LG',               e:'LG Corp',               m:'KOSPI' },
  {s:'032830.KS', n:'삼성생명',          e:'Samsung Life',          m:'KOSPI' },
  {s:'015360.KS', n:'이건홀딩스',        e:'Ikon Holdings',         m:'KOSPI' },
  {s:'000810.KS', n:'삼성화재',          e:'Samsung Fire',          m:'KOSPI' },
  {s:'003490.KS', n:'대한항공',          e:'Korean Air',            m:'KOSPI' },
  {s:'000100.KS', n:'유한양행',          e:'Yuhan Corp',            m:'KOSPI' },
  {s:'009150.KS', n:'삼성전기',          e:'Samsung Electro-Mechanics',m:'KOSPI'},
  // KOSDAQ
  {s:'247540.KQ', n:'에코프로비엠',      e:'EcoPro BM',             m:'KOSDAQ'},
  {s:'086520.KQ', n:'에코프로',          e:'EcoPro',                m:'KOSDAQ'},
  {s:'091990.KQ', n:'셀트리온헬스케어',  e:'Celltrion Healthcare',  m:'KOSDAQ'},
  {s:'293490.KQ', n:'카카오게임즈',      e:'Kakao Games',           m:'KOSDAQ'},
  {s:'086900.KQ', n:'메디톡스',          e:'Medytox',               m:'KOSDAQ'},
  {s:'263750.KQ', n:'펄어비스',          e:'Pearl Abyss',           m:'KOSDAQ'},
  {s:'078340.KQ', n:'컴투스',            e:'Com2uS',                m:'KOSDAQ'},
  {s:'196170.KQ', n:'알테오젠',          e:'Alteogen',              m:'KOSDAQ'},
  {s:'145020.KQ', n:'휴젤',              e:'Hugel',                 m:'KOSDAQ'},
  {s:'357780.KQ', n:'솔브레인',          e:'Soulbrain',             m:'KOSDAQ'},
  {s:'041510.KQ', n:'에스엠',            e:'SM Entertainment',      m:'KOSDAQ'},
  {s:'035900.KQ', n:'JYP Ent.',          e:'JYP Entertainment',     m:'KOSDAQ'},
  // US
  {s:'AAPL',  n:'Apple',             e:'Apple Inc',              m:'NASDAQ'},
  {s:'MSFT',  n:'Microsoft',         e:'Microsoft Corp',         m:'NASDAQ'},
  {s:'GOOGL', n:'Alphabet (Google)', e:'Alphabet Inc',           m:'NASDAQ'},
  {s:'AMZN',  n:'Amazon',            e:'Amazon.com Inc',         m:'NASDAQ'},
  {s:'NVDA',  n:'NVIDIA',            e:'NVIDIA Corp',            m:'NASDAQ'},
  {s:'META',  n:'Meta (Facebook)',   e:'Meta Platforms',         m:'NASDAQ'},
  {s:'TSLA',  n:'Tesla',             e:'Tesla Inc',              m:'NASDAQ'},
  {s:'TSM',   n:'TSMC',             e:'Taiwan Semiconductor',   m:'NYSE'  },
  {s:'AVGO',  n:'Broadcom',          e:'Broadcom Inc',           m:'NASDAQ'},
  {s:'NFLX',  n:'Netflix',           e:'Netflix Inc',            m:'NASDAQ'},
  {s:'AMD',   n:'AMD',              e:'Advanced Micro Devices', m:'NASDAQ'},
  {s:'INTC',  n:'Intel',            e:'Intel Corp',             m:'NASDAQ'},
  {s:'DIS',   n:'Disney',           e:'Walt Disney',            m:'NYSE'  },
  {s:'JPM',   n:'JP Morgan',         e:'JPMorgan Chase',         m:'NYSE'  },
  {s:'V',     n:'Visa',            e:'Visa Inc',               m:'NYSE'  },
  {s:'WMT',   n:'Walmart',           e:'Walmart Inc',            m:'NYSE'  },
  {s:'COIN',  n:'Coinbase',          e:'Coinbase Global',        m:'NASDAQ'},
  {s:'PLTR',  n:'Palantir',          e:'Palantir Technologies',  m:'NASDAQ'},
  {s:'NVDA',  n:'NVIDIA',            e:'NVIDIA Corp',            m:'NASDAQ'},
  {s:'ARM',   n:'Arm Holdings',      e:'Arm Holdings',           m:'NASDAQ'},
  {s:'UBER',  n:'Uber',             e:'Uber Technologies',      m:'NYSE'  },
];

const ALIAS = {
  '삼성':'005930.KS','삼성전자':'005930.KS','samsung':'005930.KS',
  '하이닉스':'000660.KS','sk하이닉스':'000660.KS',
  '네이버':'035420.KS','naver':'035420.KS',
  '카카오':'035720.KS','kakao':'035720.KS',
  '현대차':'005380.KS','현대자동차':'005380.KS','hyundai':'005380.KS',
  '기아':'000270.KS','기아차':'000270.KS','kia':'000270.KS',
  'lg화학':'051910.KS','포스코':'005490.KS','posco':'005490.KS',
  '셀트리온':'068270.KS','카카오뱅크':'323410.KS',
  '크래프톤':'259960.KS','krafton':'259960.KS',
  '하이브':'352820.KS','hybe':'352820.KS',
  '엔씨':'036570.KS','엔씨소프트':'036570.KS',
  '넷마블':'251270.KS','아모레퍼시픽':'090430.KS',
  'kt':'030200.KS','skt':'017670.KS','sk텔레콤':'017670.KS',
  'lg전자':'066570.KS','lg':'003550.KS',
  '신한':'055550.KS','kb':'105560.KS','kb금융':'105560.KS',
  '하나':'086790.KS','한전':'015760.KS','한국전력':'015760.KS',
  '이건홀딩스':'015360.KS','이건':'015360.KS',
  '에코프로비엠':'247540.KQ','에코프로':'086520.KQ',
  'nvidia':'NVDA','엔비디아':'NVDA',
  'tesla':'TSLA','테슬라':'TSLA',
  'apple':'AAPL','애플':'AAPL',
  'microsoft':'MSFT','마이크로소프트':'MSFT',
  'google':'GOOGL','구글':'GOOGL','alphabet':'GOOGL',
  'amazon':'AMZN','아마존':'AMZN',
  'meta':'META','facebook':'META','메타':'META',
  'netflix':'NFLX','넷플릭스':'NFLX',
  'intel':'INTC','인텔':'INTC',
};

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────
const $  = id => document.getElementById(id);
const isKR = sym => sym.endsWith('.KS') || sym.endsWith('.KQ');
const code = sym => sym.replace(/\.(KS|KQ)$/i,'');

function num(v, dec=2) {
  const n = parseFloat(String(v||0).replace(/,/g,''));
  if (!isFinite(n) || n === 0) return 'N/A';
  return n.toLocaleString('ko-KR',{maximumFractionDigits:dec});
}
function pct(v) {
  const n = parseFloat(v||0);
  if (!isFinite(n)) return '';
  return (n>=0?'+':'')+n.toFixed(2)+'%';
}
function priceStr(v, kr) {
  const n = parseFloat(String(v||0).replace(/,/g,''));
  if (!isFinite(n)||n===0) return 'N/A';
  return kr ? num(n,0)+'원' : '$'+num(n, n>=100?2:4);
}

function resolveSymbol(raw) {
  const q  = raw.trim();
  const lq = q.toLowerCase().replace(/\s+/g,'');
  if (ALIAS[lq]) return ALIAS[lq];
  const hit = DB.find(d =>
    d.n.replace(/\s/g,'').toLowerCase()===lq ||
    d.e.replace(/\s/g,'').toLowerCase()===lq ||
    d.s.toLowerCase()===lq
  );
  if (hit) return hit.s;
  if (/^\d{6}$/.test(q))              return q+'.KS';
  if (/^\d{6}\.(ks|kq)$/i.test(q))   return q.toUpperCase();
  return q.toUpperCase();
}

// ─────────────────────────────────────────────
// 한국 주식 — 네이버 금융 (corsproxy.io 경유)
// ─────────────────────────────────────────────
async function krQuote(sym) {
  const c = code(sym);
  const url = `${NAVER_BASE}/${c}/basic`;
  const res = await fetch(PROXY + encodeURIComponent(url));
  if (!res.ok) throw new Error(`네이버 API 오류: ${res.status}`);
  const d = await res.json();

  const close   = parseFloat(String(d.closePrice||d.currentPrice||0).replace(/,/g,''));
  const change  = parseFloat(String(d.compareToPreviousClosePrice||0).replace(/,/g,''));
  const pctVal  = parseFloat(String(d.fluctuationsRatio||0).replace(/,/g,''));
  const high52  = parseFloat(String(d.yearlyHighPrice||0).replace(/,/g,''));
  const low52   = parseFloat(String(d.yearlyLowPrice||0).replace(/,/g,''));
  const vol     = parseFloat(String(d.accumulatedTradingVolume||d.tradingVolume||0).replace(/,/g,''));
  const mkCap   = parseFloat(String(d.marketValue||0).replace(/,/g,''))*1e8;

  return { sym, name: d.stockName||d.corporateName||sym, price:close, change, changePct:pctVal,
           high52, low52, volume:vol, marketCap:mkCap,
           pe: parseFloat(d.per||0), eps: parseFloat(d.eps||0),
           sector:'', industry:'', currency:'KRW' };
}

async function krHistory(sym, days=30) {
  const c   = code(sym);
  const cnt = Math.max(days+5, 35);
  const url = `${NAVER_BASE}/${c}/candle/day?count=${cnt}`;
  const res = await fetch(PROXY + encodeURIComponent(url));
  if (!res.ok) throw new Error(`네이버 차트 오류: ${res.status}`);
  const raw = await res.json();
  const arr = Array.isArray(raw) ? raw : (raw.candles||raw.candleList||[]);
  return arr
    .map(c=>({
      date:  String(c.localDate||c.date||'').replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3'),
      close: parseFloat(String(c.closePrice||c.close||0).replace(/,/g,'')),
    }))
    .filter(c=>c.close>0)
    .sort((a,b)=>a.date.localeCompare(b.date))
    .slice(-days);
}

// ─────────────────────────────────────────────
// 미국 주식 — FMP (직접 호출, CORS OK)
// ─────────────────────────────────────────────
async function usQuote(sym) {
  const [qRes, pRes] = await Promise.allSettled([
    fetch(`${FMP_BASE}/quote/${sym}?apikey=${FMP_KEY}`).then(r=>r.json()),
    fetch(`${FMP_BASE}/profile/${sym}?apikey=${FMP_KEY}`).then(r=>r.json()),
  ]);

  const q = (qRes.status==='fulfilled' && Array.isArray(qRes.value)) ? qRes.value[0]||{} : {};
  const p = (pRes.status==='fulfilled' && Array.isArray(pRes.value)) ? pRes.value[0]||{} : {};

  if (!q.price && !p.price) throw new Error(`"${sym}" 데이터를 찾을 수 없습니다`);

  return {
    sym, name: q.name||p.companyName||sym,
    price:     q.price||0,
    change:    q.change||0,
    changePct: q.changesPercentage||0,
    high52:    q.yearHigh||0,
    low52:     q.yearLow||0,
    volume:    q.volume||0,
    marketCap: q.marketCap||p.mktCap||0,
    pe:        q.pe||0,
    eps:       q.eps||0,
    sector:    p.sector||'',
    industry:  p.industry||'',
    currency:  'USD',
  };
}

async function usHistory(sym, days=30) {
  const r = await fetch(`${FMP_BASE}/historical-price-full/${sym}?serietype=line&timeseries=${days}&apikey=${FMP_KEY}`);
  const d = await r.json();
  return (d.historical||[]).reverse().map(h=>({ date:h.date, close:h.close }));
}

// ─────────────────────────────────────────────
// 차트
// ─────────────────────────────────────────────
let chartInst = null;

function drawChart(history, kr) {
  const labels = history.map(d=>{
    const p = d.date.split('-');
    return p.length===3 ? `${+p[1]}/${+p[2]}` : d.date;
  });
  const prices = history.map(d=>d.close);
  if (!prices.length) return;

  const ctx = $('priceChart').getContext('2d');
  if (chartInst) chartInst.destroy();

  const up    = prices[prices.length-1] >= prices[0];
  const color = up ? '#26d968' : '#f85149';

  chartInst = new Chart(ctx,{
    type:'line',
    data:{
      labels,
      datasets:[{
        data: prices,
        borderColor: color, borderWidth:2.5,
        pointRadius:0, pointHoverRadius:5, pointHoverBackgroundColor:color,
        fill:true,
        backgroundColor: c=>{
          const g = c.chart.ctx.createLinearGradient(0,0,0,240);
          g.addColorStop(0, up?'rgba(38,217,104,0.28)':'rgba(248,81,73,0.28)');
          g.addColorStop(1,'rgba(0,0,0,0)');
          return g;
        },
        tension:0.35,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'#0d1117', borderColor:'#21262d', borderWidth:1,
          titleColor:'#8b949e', bodyColor:'#e6edf3',
          bodyFont:{family:'JetBrains Mono',size:12}, padding:10,
          callbacks:{ label: c=>' '+(kr ? num(c.parsed.y,0)+'원' : '$'+num(c.parsed.y,2)) }
        }
      },
      scales:{
        x:{ grid:{color:'rgba(33,38,45,0.8)'}, ticks:{color:'#484f58',maxTicksLimit:8,font:{family:'JetBrains Mono',size:11}} },
        y:{ grid:{color:'rgba(33,38,45,0.8)'}, ticks:{color:'#484f58',font:{family:'JetBrains Mono',size:11},
              callback: v=> kr ? num(v,0) : '$'+num(v,0) } }
      }
    }
  });
}

// ─────────────────────────────────────────────
// Claude AI 분석
// ─────────────────────────────────────────────
function buildPrompt(sd) {
  const vals  = sd.prices.filter(Boolean);
  const max   = vals.length ? Math.max(...vals) : 0;
  const min   = vals.length ? Math.min(...vals) : 0;
  const vol   = min>0 ? (((max-min)/min)*100).toFixed(1) : 0;
  const trend = vals.length>=2 ? (vals[vals.length-1]>vals[0]?'상승':'하락') : '보합';
  const recent= vals.slice(-10).map((v,i)=>`D${i+1}:${v}`).join(', ');

  return `당신은 세계 최고 수준의 주식 애널리스트입니다. 반드시 순수 JSON만 출력하세요.

종목: ${sd.name} (${sd.sym})
시장: ${sd.market} | 현재가: ${sd.rawPrice} | 등락: ${sd.changePct}%
52주고가: ${sd.rawHigh52} | 52주저가: ${sd.rawLow52}
거래량: ${sd.rawVol} | 시가총액: ${sd.mkCapStr}
PER: ${sd.pe} | EPS: ${sd.eps}
섹터: ${sd.sector||'N/A'} | 업종: ${sd.industry||'N/A'}
최근 10일: ${recent}
트렌드: ${trend} | 변동성: ${vol}%

아래 JSON 구조로 정확히 응답 (다른 텍스트 없이):
{"verdict":"매수|매도|관망|주목","verdictReason":"3~4문장 종합 의견","buyStrategy":{"zone":"구체적 매수 구간 (단위 명시)","timing":"매수 타이밍 설명","split":["1차 매수가","2차 매수가"]},"sellStrategy":{"shortTarget":"단기 목표가","midTarget":"중기 목표가","stopLoss":"손절가","exitSignal":"익절 신호"},"risks":["리스크1","리스크2","리스크3"],"riskLevel":"낮음|중간|높음","riskScore":40,"scenarios":{"bull":{"price":"낙관 목표가","desc":"낙관 시나리오"},"base":{"price":"중립 목표가","desc":"중립 시나리오"},"bear":{"price":"비관 목표가","desc":"비관 시나리오"}},"watchPoints":["포인트1","포인트2","포인트3"],"summary":"핵심 요약 2문장"}`;
}

async function callAI(sd) {
  // Cloudflare Function 시도 → 실패 시 안내
  const res = await fetch('/api/analyze',{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ prompt: buildPrompt(sd) }),
  });
  if (!res.ok) throw new Error('AI 서버 응답 오류: '+res.status);
  const text = await res.text();
  // HTML이 반환되면 Function 미설정 상태
  if (text.trim().startsWith('<')) throw new Error('Cloudflare Function 미설정');
  return JSON.parse(text);
}

function renderAI(r) {
  const vc = {매수:'buy',매도:'sell',관망:'hold',주목:'watch'}[r.verdict]||'hold';
  const sc = Math.min(100,Math.max(0,r.riskScore||50));
  const rc = sc<35?'low':sc<65?'mid':'high';

  $('aiContent').innerHTML = `
    <div class="ai-section">
      <div class="ai-section-title">종합 투자 의견</div>
      <div class="verdict-chips">
        <span class="verdict-chip ${vc}">${r.verdict||'관망'}</span>
        <span class="verdict-chip ${rc}">리스크 ${r.riskLevel||'중간'}</span>
      </div>
      <p style="color:#c9d1d9;line-height:1.9;margin-top:14px">${r.verdictReason||r.summary||''}</p>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">매수 / 매도 전략</div>
      <div class="target-row">
        <div class="target-item buy-target">
          <div class="t-label">매수 구간</div>
          <div class="t-val" style="font-size:.82rem">${r.buyStrategy?.zone||'N/A'}</div>
        </div>
        <div class="target-item sell-target">
          <div class="t-label">단기 목표가</div>
          <div class="t-val">${r.sellStrategy?.shortTarget||'N/A'}</div>
        </div>
        <div class="target-item target-target">
          <div class="t-label">중기 목표가</div>
          <div class="t-val">${r.sellStrategy?.midTarget||'N/A'}</div>
        </div>
        <div class="target-item stop-target">
          <div class="t-label">손절가</div>
          <div class="t-val">${r.sellStrategy?.stopLoss||'N/A'}</div>
        </div>
      </div>
      ${r.buyStrategy?.split?.length?`<p style="margin-top:10px;color:#8b949e;font-size:.88rem">분할매수: ${r.buyStrategy.split.join(' → ')}</p>`:''}
      ${r.buyStrategy?.timing?`<p style="margin-top:6px;color:#8b949e;font-size:.88rem">타이밍: ${r.buyStrategy.timing}</p>`:''}
      ${r.sellStrategy?.exitSignal?`<p style="margin-top:6px;color:#8b949e;font-size:.88rem">익절 신호: ${r.sellStrategy.exitSignal}</p>`:''}
    </div>

    <div class="ai-section">
      <div class="ai-section-title">3개월 시나리오</div>
      <div class="target-row">
        <div class="target-item buy-target">
          <div class="t-label">🟢 낙관</div>
          <div class="t-val">${r.scenarios?.bull?.price||'N/A'}</div>
          <p style="font-size:.78rem;color:#8b949e;margin-top:6px;line-height:1.6">${r.scenarios?.bull?.desc||''}</p>
        </div>
        <div class="target-item target-target">
          <div class="t-label">🔵 중립</div>
          <div class="t-val">${r.scenarios?.base?.price||'N/A'}</div>
          <p style="font-size:.78rem;color:#8b949e;margin-top:6px;line-height:1.6">${r.scenarios?.base?.desc||''}</p>
        </div>
        <div class="target-item stop-target">
          <div class="t-label">🔴 비관</div>
          <div class="t-val">${r.scenarios?.bear?.price||'N/A'}</div>
          <p style="font-size:.78rem;color:#8b949e;margin-top:6px;line-height:1.6">${r.scenarios?.bear?.desc||''}</p>
        </div>
      </div>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">리스크 분석</div>
      <div class="risk-bar">
        <span class="risk-label">리스크</span>
        <div class="risk-track"><div class="risk-fill ${rc}" id="rBar" style="width:0%;transition:width 1.2s ease"></div></div>
        <span class="risk-pct">${sc}%</span>
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
  $('aiContent').style.display='block';
  $('aiLoading').style.display='none';
  setTimeout(()=>{ const b=$('rBar'); if(b) b.style.width=sc+'%'; },150);
}

// ─────────────────────────────────────────────
// 에러 토스트
// ─────────────────────────────────────────────
function toast(msg) {
  document.querySelectorAll('.err-toast').forEach(e=>e.remove());
  const el=document.createElement('div');
  el.className='err-toast'; el.textContent='⚠ '+msg;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),5000);
}

// ─────────────────────────────────────────────
// 메인 검색
// ─────────────────────────────────────────────
async function doSearch(raw) {
  const q = raw.trim();
  if (!q) return;

  $('resultSection').style.display='none';
  $('searchBtn').disabled=true;
  $('searchBtn').textContent='로딩 중...';

  try {
    const sym = resolveSymbol(q);
    const kr  = isKR(sym);
    const mkt = sym.endsWith('.KS')?'KOSPI': sym.endsWith('.KQ')?'KOSDAQ':'US MARKET';

    $('searchBtn').textContent='데이터 수집 중...';

    // 시세 + 차트 병렬
    let quote, history;
    try {
      [quote, history] = await Promise.all([
        kr ? krQuote(sym) : usQuote(sym),
        kr ? krHistory(sym,30) : usHistory(sym,30),
      ]);
    } catch(e) {
      throw new Error(`데이터를 가져오지 못했습니다: ${e.message}`);
    }

    const p   = quote.price||0;
    const chg = quote.change||0;
    const cp  = quote.changePct||0;
    const up  = chg>=0;

    const ps  = priceStr(p, kr);
    const cs  = (up?'+':'') + (kr?num(chg,0)+'원':(chg>=0?'+$':'-$')+num(Math.abs(chg),2)) + ` (${pct(cp)})`;

    const mc  = quote.marketCap||0;
    const mcs = mc<=0?'N/A': kr
      ? (mc>=1e12?num(mc/1e12,1)+'조원':num(mc/1e8,0)+'억원')
      : '$'+num(mc/1e9,1)+'B';

    const sd = {
      sym, name: quote.name||DB.find(d=>d.s===sym)?.n||sym,
      market:mkt, rawPrice:p, changePct:cp,
      rawHigh52:quote.high52, rawLow52:quote.low52,
      rawVol:quote.volume, mkCapStr:mcs,
      pe:quote.pe, eps:quote.eps,
      sector:quote.sector, industry:quote.industry,
      prices: history.map(h=>h.close),
    };

    // UI
    $('resultMarket').textContent = mkt;
    $('resultTime').textContent   = '실시간 · '+new Date().toLocaleTimeString('ko-KR');
    $('resultName').textContent   = sd.name;
    $('resultTicker').textContent = sym;
    $('resultPrice').textContent  = ps;
    $('resultChange').textContent = cs;
    $('resultChange').className   = 'price-change '+(up?'up':'down');

    $('statsGrid').innerHTML=[
      {l:'52주 고가', v:priceStr(quote.high52,kr)},
      {l:'52주 저가', v:priceStr(quote.low52,kr)},
      {l:'거래량',    v:num(quote.volume,0)},
      {l:'시가총액',  v:mcs},
      {l:'PER',       v:num(quote.pe,1)},
      {l:'EPS',       v:num(quote.eps,2)},
    ].map(s=>`<div class="stat-item"><div class="stat-label">${s.l}</div><div class="stat-value">${s.v}</div></div>`).join('');

    if (history.length) drawChart(history,kr);

    $('resultSection').style.display='block';
    $('resultSection').scrollIntoView({behavior:'smooth',block:'start'});

    // AI
    $('aiLoading').style.display='flex';
    $('aiContent').style.display='none';
    $('searchBtn').textContent='AI 분석 중...';

    callAI(sd).then(renderAI).catch(err=>{
      $('aiLoading').style.display='none';
      $('aiContent').innerHTML=`
        <p style="color:#f85149;font-weight:700;margin-bottom:10px">⚠ AI 분석 연결 오류</p>
        <p style="color:#8b949e;font-size:.88rem;line-height:1.8">${err.message}</p>
        <p style="color:#484f58;font-size:.82rem;margin-top:12px">
          Cloudflare Pages › Settings › Environment variables 에<br>
          <code style="color:#00d4aa">ANTHROPIC_API_KEY</code> = <code style="color:#00d4aa">sk-ant-...</code><br>
          을 추가하면 AI 분석이 활성화됩니다.
        </p>`;
      $('aiContent').style.display='block';
    });

  } catch(e) {
    console.error(e);
    toast(e.message);
  } finally {
    $('searchBtn').disabled=false;
    $('searchBtn').textContent='분석하기';
  }
}

// ─────────────────────────────────────────────
// 자동완성
// ─────────────────────────────────────────────
let sugTimer;

function showSug(query) {
  const q = query.trim().toLowerCase().replace(/\s+/g,'');
  if (!q) { hideSug(); return; }

  const hits = DB.filter(d=>
    d.n.replace(/\s/g,'').toLowerCase().includes(q)||
    d.e.replace(/\s/g,'').toLowerCase().includes(q)||
    d.s.toLowerCase().replace(/\.(ks|kq)$/i,'').includes(q)
  );

  // 중복 제거
  const seen=new Set(); const uniq=[];
  for (const h of hits) { if(!seen.has(h.s)){seen.add(h.s);uniq.push(h);} }
  const list = uniq.slice(0,8);

  if (!list.length) { hideSug(); return; }

  const mc={KOSPI:'kospi',KOSDAQ:'kosdaq',NASDAQ:'us',NYSE:'us'};
  $('suggestions').innerHTML=list.map(d=>`
    <div class="sug-item" data-sym="${d.s}">
      <div>
        <div class="sug-name">${d.n} <span style="color:#484f58;font-size:.78rem">${d.e}</span></div>
        <div class="sug-meta">${d.s}</div>
      </div>
      <span class="sug-market ${mc[d.m]||'us'}">${d.m}</span>
    </div>`).join('');

  $('suggestions').classList.add('open');
  $('suggestions').querySelectorAll('.sug-item').forEach(el=>
    el.addEventListener('click',()=>{
      const info=DB.find(d=>d.s===el.dataset.sym);
      $('searchInput').value=info?info.n:el.dataset.sym;
      hideSug(); doSearch(el.dataset.sym);
    })
  );
}
function hideSug() { $('suggestions').classList.remove('open'); }

// ─────────────────────────────────────────────
// 인기 종목
// ─────────────────────────────────────────────
const POPULAR=[
  {s:'005930.KS',n:'삼성전자',  m:'KOSPI' },
  {s:'000660.KS',n:'SK하이닉스',m:'KOSPI' },
  {s:'035420.KS',n:'NAVER',     m:'KOSPI' },
  {s:'NVDA',     n:'NVIDIA',    m:'NASDAQ'},
  {s:'AAPL',     n:'Apple',     m:'NASDAQ'},
  {s:'TSLA',     n:'Tesla',     m:'NASDAQ'},
];

async function loadPopular() {
  const grid=$('popularGrid');
  grid.innerHTML=POPULAR.map(()=>'<div class="pop-skeleton"></div>').join('');

  const res=await Promise.allSettled(POPULAR.map(s=>
    isKR(s.s)?krQuote(s.s):usQuote(s.s)
  ));

  grid.innerHTML=POPULAR.map((s,i)=>{
    const kr=isKR(s.s);
    const r=res[i];
    if(r.status==='rejected'){
      return `<div class="pop-card" data-sym="${s.s}">
        <div class="pop-sym">${s.s} · ${s.m}</div>
        <div class="pop-name">${s.n}</div>
        <div class="pop-price" style="color:#484f58">—</div>
        <div class="pop-change flat">${r.reason?.message||'로딩 실패'}</div>
      </div>`;
    }
    const q=r.value;
    const up=(q.changePct||0)>=0;
    return `<div class="pop-card" data-sym="${s.s}">
      <div class="pop-sym">${s.s} · ${s.m}</div>
      <div class="pop-name">${q.name||s.n}</div>
      <div class="pop-price">${priceStr(q.price,kr)}</div>
      <div class="pop-change ${up?'up':'down'}">${pct(q.changePct)}</div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.pop-card').forEach(el=>
    el.addEventListener('click',()=>doSearch(el.dataset.sym))
  );
}

// ─────────────────────────────────────────────
// 티커 바
// ─────────────────────────────────────────────
async function loadTicker() {
  const TICKERS=[
    {s:'005930.KS',n:'삼성전자', kr:true },
    {s:'000660.KS',n:'SK하이닉스',kr:true },
    {s:'035420.KS',n:'NAVER',    kr:true },
    {s:'NVDA',     n:'NVIDIA',   kr:false},
    {s:'AAPL',     n:'Apple',    kr:false},
    {s:'TSLA',     n:'Tesla',    kr:false},
    {s:'MSFT',     n:'Microsoft',kr:false},
    {s:'035720.KS',n:'카카오',   kr:true },
  ];

  const res=await Promise.allSettled(TICKERS.map(t=>
    t.kr?krQuote(t.s):usQuote(t.s)
  ));

  const items=TICKERS.map((t,i)=>{
    const r=res[i];
    if(r.status==='rejected') return null;
    return {...t, price:r.value.price, cp:r.value.changePct};
  }).filter(Boolean);

  if(!items.length){
    $('tickerTrack').innerHTML='<span class="tick-item tick-loading">데이터 로딩 중...</span>';
    return;
  }

  const html=()=>items.map(t=>{
    const up=(t.cp||0)>=0;
    const ps=t.kr?num(t.price,0)+'원':'$'+num(t.price,2);
    return `<span class="tick-item" data-sym="${t.s}">
      <span class="t-sym">${t.n}</span>${ps}
      <span class="${up?'t-up':'t-down'}">${pct(t.cp)}</span>
    </span>`;
  }).join('');

  const track=$('tickerTrack');
  track.innerHTML=html()+html();
  track.querySelectorAll('.tick-item').forEach(el=>
    el.addEventListener('click',()=>doSearch(el.dataset.sym))
  );
}

// ─────────────────────────────────────────────
// 이벤트
// ─────────────────────────────────────────────
$('searchBtn').addEventListener('click',()=>doSearch($('searchInput').value));
$('searchInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'){ hideSug(); doSearch($('searchInput').value); }
  if(e.key==='Escape') hideSug();
});
$('searchInput').addEventListener('input',e=>{
  clearTimeout(sugTimer);
  sugTimer=setTimeout(()=>showSug(e.target.value),150);
});
document.addEventListener('click',e=>{
  if(!e.target.closest('.search-wrap')) hideSug();
});
document.querySelectorAll('.chip').forEach(c=>
  c.addEventListener('click',()=>{
    document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
    c.classList.add('active');
  })
);

// ─────────────────────────────────────────────
// 초기 로드
// ─────────────────────────────────────────────
(async()=>{
  await Promise.allSettled([loadTicker(), loadPopular()]);
})();
