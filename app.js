let stocks = []

// ===============================
// CSV 로드
// ===============================
async function loadCSV(){
  const res = await fetch("korea_stocks.csv")
  const text = await res.text()

  const rows = text.split("\n").slice(1)

  stocks = rows.map(r=>{
    const [name,ticker,search] = r.split(",")
    return {name,ticker,search}
  })

  updateSelect(stocks)
}

function updateSelect(list){
  const sel = document.getElementById("stockSelect")
  sel.innerHTML=""

  list.forEach(s=>{
    const opt = document.createElement("option")
    opt.value = s.ticker
    opt.textContent = `${s.name} (${s.ticker})`
    sel.appendChild(opt)
  })
}

// ===============================
// 검색 필터
// ===============================
document.getElementById("searchInput").oninput = e=>{
  const v = e.target.value.toLowerCase()
  const f = stocks.filter(s=>s.search.includes(v))
  updateSelect(f)
}

// ===============================
// Yahoo 가격 가져오기
// ===============================
async function getPrice(ticker){

  const url =
  `https://cors.isomorphic-git.org/https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=2y&interval=1d`

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

// ===============================
// 전략 계산 (Streamlit 동일)
// ===============================
function mean(arr,n){
  return arr.map((_,i)=>{
    if(i<n) return null
    return arr.slice(i-n,i).reduce((a,b)=>a+b,0)/n
  })
}

function std(arr){
  const m = arr.reduce((a,b)=>a+b)/arr.length
  return Math.sqrt(arr.map(x=>(x-m)**2).reduce((a,b)=>a+b)/arr.length)
}

function makeStrategy(data){

  const close = data.map(d=>d.close)

  const current = close.at(-1)

  const ma20 = mean(close,20).at(-1)
  const ma60 = mean(close,60).at(-1)

  const pct = close.slice(1).map((v,i)=> (v-close[i])/close[i])
  const volatility = std(pct)

  const buy = ma20 * 0.98
  const stop = buy * (1 - volatility*3)
  const target = buy * 1.20

  return {current,buy,stop,target,ma20,ma60,volatility}
}

// ===============================
// 분석 실행
// ===============================
document.getElementById("analyzeBtn").onclick = analyze

async function analyze(){

  const ticker = document.getElementById("stockSelect").value
  const data = await getPrice(ticker)

  const s = makeStrategy(data)

  document.getElementById("current").innerText = `현재가 ${Math.round(s.current)}`
  document.getElementById("buy").innerText = `매수 ${Math.round(s.buy)}`
  document.getElementById("stop").innerText = `손절 ${Math.round(s.stop)}`
  document.getElementById("target").innerText = `목표 ${Math.round(s.target)}`

  drawChart(data,s)

  document.getElementById("aiBox").innerHTML = `
  <h3>🤖 AI 전략 분석</h3>
  📉 매수 추천가: ${Math.round(s.buy)} (MA20 지지구간)<br>
  🛑 손절: ${Math.round(s.stop)} (변동성 기반 리스크 관리)<br>
  🎯 목표: ${Math.round(s.target)} (+20% 수익 구간)<br><br>
  현재가: ${Math.round(s.current)}<br>
  MA20: ${Math.round(s.ma20)}<br>
  MA60: ${Math.round(s.ma60)}
  `
}

// ===============================
// Plotly 차트
// ===============================
function drawChart(data,s){

  const dates = data.map(d=>d.date)
  const price = data.map(d=>d.close)

  const ma20 = mean(price,20)
  const ma60 = mean(price,60)

  Plotly.newPlot("chart",[
    {x:dates,y:price,name:"Price"},
    {x:dates,y:ma20,name:"MA20"},
    {x:dates,y:ma60,name:"MA60"}
  ],{
    shapes:[
      {type:"line",y0:s.buy,y1:s.buy,x0:0,x1:1,xref:"paper"},
      {type:"line",y0:s.stop,y1:s.stop,x0:0,x1:1,xref:"paper"},
      {type:"line",y0:s.target,y1:s.target,x0:0,x1:1,xref:"paper"}
    ],
    hovermode:"x unified"
  })
}

// 시작
loadCSV()
