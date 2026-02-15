let stocks = [];

async function loadStocks() {
    const res = await fetch("korea_stocks.csv");
    const text = await res.text();
    const rows = text.split("\n").slice(1);

    stocks = rows.map(row => {
        const cols = row.split(",");
        return {
            name: cols[0],
            ticker: cols[1],
            search: cols[2]
        };
    });

    populateSelect(stocks);
}

function populateSelect(list){
    const select = document.getElementById("stockSelect");
    select.innerHTML = "";

    list.forEach(stock=>{
        const option = document.createElement("option");
        option.value = stock.ticker;
        option.textContent = `${stock.name} (${stock.ticker})`;
        select.appendChild(option);
    });
}

document.getElementById("searchInput").addEventListener("input",function(){
    const keyword = this.value.toLowerCase().trim();

    const filtered = stocks.filter(s =>
        s.name.toLowerCase().includes(keyword) ||
        s.ticker.toLowerCase().includes(keyword)
    );

    populateSelect(filtered);
});

async function fetchPrice(ticker){
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=2y&interval=1d`;

    const res = await fetch(url);
    const json = await res.json();

    if(!json.chart.result) return null;

    const result = json.chart.result[0];
    const timestamps = result.timestamp;
    const close = result.indicators.quote[0].close;
    const volume = result.indicators.quote[0].volume;

    return timestamps.map((t,i)=>({
        date:new Date(t*1000),
        close:close[i],
        volume:volume[i]
    })).filter(d=>d.close!==null);
}

function rollingMean(arr, n){
    return arr.map((_,i)=>{
        if(i<n-1) return null;
        const slice = arr.slice(i-n+1,i+1);
        return slice.reduce((a,b)=>a+b,0)/n;
    });
}

function std(arr){
    const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
    const variance = arr.reduce((a,b)=>a+Math.pow(b-mean,2),0)/arr.length;
    return Math.sqrt(variance);
}

async function analyze(){
    const ticker = document.getElementById("stockSelect").value;
    const data = await fetchPrice(ticker);

    if(!data){
        alert("데이터 없음");
        return;
    }

    const close = data.map(d=>d.close);
    const current = close.at(-1);

    const ma20 = rollingMean(close,20);
    const ma60 = rollingMean(close,60);

    const lastMA20 = ma20.at(-1);
    const lastMA60 = ma60.at(-1);

    const returns = close.slice(1).map((c,i)=>(c-close[i])/close[i]);
    const volatility = std(returns);

    const buy = lastMA20*0.98;
    const stop = buy*(1-volatility*3);
    const target = buy*1.2;

    document.getElementById("current").innerText=Math.round(current).toLocaleString();
    document.getElementById("buy").innerText=Math.round(buy).toLocaleString();
    document.getElementById("stop").innerText=Math.round(stop).toLocaleString();
    document.getElementById("target").innerText=Math.round(target).toLocaleString();

    drawChart(data,ma20,ma60,buy,stop,target);
    makeComment(current,buy,stop,target,lastMA20,lastMA60,volatility);
}

function drawChart(data,ma20,ma60,buy,stop,target){
    const dates=data.map(d=>d.date);
    const close=data.map(d=>d.close);

    const traces=[
        {x:dates,y:close,type:'scatter',name:'Price'},
        {x:dates,y:ma20,type:'scatter',name:'MA20'},
        {x:dates,y:ma60,type:'scatter',name:'MA60'}
    ];

    const layout={
        height:650,
        hovermode:'x unified',
        shapes:[
            {type:'line',y0:buy,y1:buy,x0:0,x1:1,xref:'paper',line:{dash:'dash'}},
            {type:'line',y0:stop,y1:stop,x0:0,x1:1,xref:'paper',line:{dash:'dot'}},
            {type:'line',y0:target,y1:target,x0:0,x1:1,xref:'paper',line:{dash:'dash'}}
        ]
    };

    Plotly.newPlot("chart",traces,layout);
}

function makeComment(current,buy,stop,target,ma20,ma60,vol){
    document.getElementById("comment").innerHTML=`
    <h3>🤖 AI 전략 분석</h3>
    <p>📉 매수 추천가: ${Math.round(buy).toLocaleString()}원</p>
    <p>🛑 손절가: ${Math.round(stop).toLocaleString()}원</p>
    <p>🎯 목표가: ${Math.round(target).toLocaleString()}원</p>
    <hr>
    <p>현재가: ${Math.round(current).toLocaleString()}원</p>
    <p>MA20: ${Math.round(ma20).toLocaleString()}</p>
    <p>MA60: ${Math.round(ma60).toLocaleString()}</p>
    <p>변동성: ${(vol*100).toFixed(2)}%</p>
    <p>👉 단기 눌림목 매수 전략</p>
    `;
}

loadStocks();
