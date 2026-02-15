const API_KEY = "Z0VAZW6884QMO6SX";

let stocks = [];

async function loadStocks() {
  const res = await fetch("korea_stocks.csv");
  const text = await res.text();
  const rows = text.split("\n").slice(1);

  stocks = rows.map(row => {
    const cols = row.split(",");
    return {
      name: cols[0],
      ticker: cols[1]
    };
  }).filter(s => s.name && s.ticker);

  populateSelect(stocks);
}

function populateSelect(list) {
  const select = document.getElementById("stockSelect");
  select.innerHTML = "";

  list.slice(0, 300).forEach(stock => {
    const option = document.createElement("option");
    option.value = stock.ticker;
    option.textContent = `${stock.name} (${stock.ticker})`;
    select.appendChild(option);
  });
}

document.getElementById("searchInput").addEventListener("input", function () {
  const keyword = this.value.toLowerCase();
  const filtered = stocks.filter(s =>
    s.name.toLowerCase().includes(keyword) ||
    s.ticker.toLowerCase().includes(keyword)
  );
  populateSelect(filtered);
});

async function fetchPrice(ticker) {

  // .KS / .KQ 제거 (AlphaVantage는 숫자코드만 사용)
  const pureCode = ticker.split(".")[0];

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${pureCode}&apikey=${API_KEY}`;

  const res = await fetch(url);
  const json = await res.json();

  if (!json["Time Series (Daily)"]) return null;

  const series = json["Time Series (Daily)"];
  const dates = Object.keys(series).reverse();

  return dates.map(date => ({
    date: new Date(date),
    close: parseFloat(series[date]["4. close"])
  }));
}

function rollingMean(arr, n) {
  return arr.map((_, i) => {
    if (i < n - 1) return null;
    const slice = arr.slice(i - n + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / n;
  });
}

function std(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

async function analyze() {

  const ticker = document.getElementById("stockSelect").value;
  if (!ticker) return;

  const data = await fetchPrice(ticker);
  if (!data) {
    alert("API 호출 실패 또는 데이터 없음");
    return;
  }

  const close = data.map(d => d.close);
  const current = close.at(-1);

  const ma20 = rollingMean(close, 20);
  const ma60 = rollingMean(close, 60);

  const lastMA20 = ma20.at(-1);

  const returns = close.slice(1).map((c, i) => (c - close[i]) / close[i]);
  const volatility = std(returns);

  const buy = lastMA20 * 0.98;
  const stop = buy * (1 - volatility * 3);
  const target = buy * 1.2;

  document.getElementById("current").innerText = Math.round(current).toLocaleString();
  document.getElementById("buy").innerText = Math.round(buy).toLocaleString();
  document.getElementById("stop").innerText = Math.round(stop).toLocaleString();
  document.getElementById("target").innerText = Math.round(target).toLocaleString();

  drawChart(data, ma20, ma60);
}

document.getElementById("analyzeBtn").addEventListener("click", analyze);

function drawChart(data, ma20, ma60) {

  const dates = data.map(d => d.date);
  const close = data.map(d => d.close);

  const traces = [
    { x: dates, y: close, type: 'scatter', name: 'Price' },
    { x: dates, y: ma20, type: 'scatter', name: 'MA20' },
    { x: dates, y: ma60, type: 'scatter', name: 'MA60' }
  ];

  Plotly.newPlot("chart", traces, {
    height: 600,
    hovermode: 'x unified'
  });
}

loadStocks();
