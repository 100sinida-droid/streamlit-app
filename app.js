let stocks = []

// ================================
// CSV 로드
// ================================
async function loadCSV(){
  const res = await fetch("korea_stocks.csv")
  const text = await res.text()

  const rows = text.split("\n").slice(1)

  stocks = rows.map(r=>{
    const c = r.split(",")
    return {
      name:c[0],
      ticker:c[1],
      search:c[2]
    }
  })

  updateList("")
}

// ================================
// 검색
// ================================
function updateList(q){
  const sel = document.getElementById("tickerList")
  sel.innerHTML=""

  stocks
    .filter(s=>s.search.includes(q.toLowerCase()))
    .slice(0,50)
    .forEach(s=>{
      const o=document.createElement("option")
      o.value=s.ticker
      o.textContent=`${s.name} (${s.ticker})`
      sel.appendChild(o)
    })
}

document.getElementById("search").oninput =
  e=>updateList(e.target.value)


// ================================
// ⭐ CORS 해결 Yahoo 데이터
// ================================
async function getPrice(ticker){

  const proxy = "https://corsproxy.io/?"

  const url =
    proxy +
    encodeURIComponent(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=2y&interval=1d`
    )

  const res = await fetch(url)
  const j = await res.json()

  const r = j.chart.result[0]

  const close = r.indicators.quote[0].close
  const vol = r.indicators.quote[0].volume
  const ts = r.timestamp

  return ts.map((t,i)=>({
    date:new Date(t*1000),
    close:close[i],
    volume:vol[i]
  })).filter(x=>x.close)
}


// ================================
// 전략 계산
// ================================
function MA(arr,n){
  return arr.map((_,i)=>{
    if(i<n) return null
    return arr.slice(i-n,i).reduce((a,b)=>a+b)/n
  })
}

function analyze(){

  const ticker = document.getElementById("tickerList").value

  if(!ticker) return

  getPrice(ticker).then(data=>{

    const close = data.map(d=>d.close)

    const current = close.at(-1)

    const ma20 = MA(close,20).at(-1)
    const ma60 = MA(close,60).at(-1)

    const returns = close.slice(1).map((c,i)=>c/close[i]-1)
    const vol = std(returns)

    const buy = ma20*0.98
    const stop = buy*(1-vol*3)
    const target = buy*1.2

    // ===== metrics
    set("m_current",current)
    set("m_buy",buy)
    set("m_stop",stop)
    set("m_target",target)

    // ===== chart
    drawChart(data,buy,stop,target)

    // ===== comment
    document.getElementById("comment").innerHTML = `
      <h3>🤖 AI 분석</h3>
      매수는 MA20 지지구간<br>
      손절은 변동성 기반 리스크 관리<br>
      목표는 +20% 스윙 수익 전략
    `
  })
}

function set(id,v){
  document.getElementById(id).innerText =
    Math.round(v).toLocaleString()
}

function std(arr){
  const m = arr.reduce((a,b)=>a+b)/arr.length
  return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length)
}


// ================================
// Plotly
// ================================
function drawChart(data,buy,stop,target){

  Plotly.newPlot("chart",[
    {
      x:data.map(d=>d.date),
      y:data.map(d=>d.close),
      name:"Price",
      type:"scatter"
    }
  ],{
    shapes:[
      hline(buy,"green"),
      hline(stop,"red"),
      hline(target,"blue")
    ],
    hovermode:"x unified"
  })
}

function hline(y,color){
  return {
    type:"line",
    x0:0,x1:1,y0:y,y1:y,
    xref:"paper",
    line:{dash:"dot",color}
  }
}


// ================================
document.getElementById("analyzeBtn").onclick = analyze
loadCSV()
