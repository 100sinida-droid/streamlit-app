let stocks = [];

async function loadStocks() {
  const res = await fetch("./korea_stocks.csv");
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
    option.value = stock.ticker.trim();
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

  const res = await fetch(`/price?ticker=${ticker}`);
  const json = await res.json();

  if (!json.chart || !json.chart.result) return null;

  const result = json.chart.result[0];
  const timestamps = result.timestamp;
  const close = result.indicators.quote[0].close;

  return timestamps.map((t, i) => ({
    date: new Date(t * 1000),
    close: close[i]
  })).filter(d => d.close !== null);
}

function rollingMean(arr, n) {
  return arr.map((_, i) => {
    if (i < n - 1) return null;
    const slice = arr.slice(i - n + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / n;
  });
}

async function analyze() {

  const ticker = document.getElementById("stockSelect").value;
  if (!ticker) return;

  const data = await fetchPrice(ticker);
  if (!data) {
    alert("데이터 없음");
    return;
  }

  const close = data.map(d => d.close);
  const current = close.at(-1);

  const ma20 = rollingMean(close, 20);
  const ma60 = rollingMean(close, 60);

  const lastMA20 = ma20.at(-1);

  const buy = lastMA20 * 0.98;
  const target = buy * 1.2;

  document.getElementById("current").innerText = Math.round(current).toLocaleString();
  document.getElementById("buy").innerText = Math.round(buy).toLocaleString();
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
