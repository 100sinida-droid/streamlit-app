// ===============================
// 전역 변수
// ===============================
let stocks = [];

// ===============================
// 1. CSV 로드
// ===============================
async function loadStocks() {
  try {
    const res = await fetch("./korea_stocks.csv");
    if (!res.ok) throw new Error("CSV 로드 실패");

    const text = await res.text();
    const rows = text.split("\n").slice(1);

    stocks = rows
      .map(row => {
        const cols = row.split(",");
        return {
          name: cols[0]?.trim(),
          ticker: cols[1]?.trim()
        };
      })
      .filter(s => s.name && s.ticker);

    populateSelect(stocks);

  } catch (err) {
    console.error("CSV 에러:", err);
    alert("종목 리스트 로드 실패");
  }
}

// ===============================
// 2. 드롭다운 채우기
// ===============================
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

// ===============================
// 3. 검색 기능
// ===============================
document.getElementById("searchInput").addEventListener("input", function () {
  const keyword = this.value.toLowerCase();

  const filtered = stocks.filter(s =>
    s.name.toLowerCase().includes(keyword) ||
    s.ticker.toLowerCase().includes(keyword)
  );

  populateSelect(filtered);
});

// ===============================
// 4. Worker API 호출
// ===============================
async function fetchPrice(ticker) {
  try {
    const res = await fetch(`/price?ticker=${ticker}`);

    if (!res.ok) {
      console.error("API 상태코드:", res.status);
      return null;
    }

    const json = await res.json();

    if (!json.chart || !json.chart.result) {
      console.error("잘못된 JSON 구조:", json);
      return null;
    }

    const result = json.chart.result[0];
    const timestamps = result.timestamp;
    const close = result.indicators.quote[0].close;

    return timestamps.map((t, i) => ({
      date: new Date(t * 1000),
      close: close[i]
    })).filter(d => d.close !== null);

  } catch (err) {
    console.error("API 호출 실패:", err);
    return null;
  }
}

// ===============================
// 5. 이동평균 계산
// ===============================
function rollingMean(arr, n) {
  return arr.map((_, i) => {
    if (i < n - 1) return null;
    const slice = arr.slice(i - n + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / n;
  });
}

// ===============================
// 6. 분석 실행
// ===============================
async function analyze() {

  const ticker = document.getElementById("stockSelect").value;

  if (!ticker) {
    alert("종목을 선택하세요");
    return;
  }

  const data = await fetchPrice(ticker);

  if (!data || data.length < 60) {
    alert("데이터 없음 또는 API 오류");
    return;
  }

  const close = data.map(d => d.close);
  const current = close.at(-1);

  const ma20 = rollingMean(close, 20);
  const ma60 = rollingMean(close, 60);

  const lastMA20 = ma20.at(-1);
  const lastMA60 = ma60.at(-1);

  // 전략 계산
  const buy = lastMA20 * 0.98;
  const target = buy * 1.2;

  // 화면 표시
  document.getElementById("current").innerText =
    Math.round(current).toLocaleString();

  document.getElementById("buy").innerText =
    Math.round(buy).toLocaleString();

  document.getElementById("target").innerText =
    Math.round(target).toLocaleString();

  drawChart(data, ma20, ma60);
}

// ===============================
// 7. 차트
// ===============================
function drawChart(data, ma20, ma60) {

  const dates = data.map(d => d.date);
  const close = data.map(d => d.close);

  const traces = [
    { x: dates, y: close, type: 'scatter', name: 'Price' },
    { x: dates, y: ma20, type: 'scatter', name: 'MA20' },
    { x: dates, y: ma60, type: 'scatter', name: 'MA60' }
  ];

  const layout = {
    height: 600,
    hovermode: 'x unified'
  };

  Plotly.newPlot("chart", traces, layout);
}

// ===============================
// 8. 이벤트 연결
// ===============================
document.getElementById("analyzeBtn")
  .addEventListener("click", analyze);

// ===============================
// 초기 실행
// ===============================
loadStocks();
