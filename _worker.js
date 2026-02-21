// StockMind _worker.js v9
// 신규: /api/search — 네이버 종목 검색 API (전체 한국 주식 검색 가능)

var H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};

function J(d, s) { return new Response(JSON.stringify(d), { status: s || 200, headers: H }); }
function N(v) { return parseFloat(String(v || 0).replace(/,/g, "")) || 0; }
function isKR(s) { return s.slice(-3) === ".KS" || s.slice(-3) === ".KQ"; }
function code(s) { return s.slice(0, -3); }
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";

// ─── 네이버 종목 검색 (자동완성 전용) ────────────────────────
async function searchNaver(query) {
  var url = "https://ac.stock.naver.com/ac?q=" + encodeURIComponent(query) + "&target=index,stock,etf,fund,futures,option";
  var r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/json", "Referer": "https://finance.naver.com/" }
  });
  if (!r.ok) throw new Error("search " + r.status);
  var d = await r.json();
  // 응답: { items: [[코드, 이름, 시장, ...], ...] } 또는 { result: { items: [...] } }
  var items = [];
  if (Array.isArray(d.items)) {
    items = d.items;
  } else if (d.result && Array.isArray(d.result.items)) {
    items = d.result.items;
  } else if (Array.isArray(d)) {
    items = d;
  }

  var results = [];
  for (var i = 0; i < Math.min(items.length, 10); i++) {
    var it = items[i];
    // it: [심볼코드, 종목명, 거래소타입, ...]
    var rawCode = Array.isArray(it) ? (it[0] || "") : (it.code || it.symbolCode || "");
    var name    = Array.isArray(it) ? (it[1] || "") : (it.name || it.stockName || "");
    var mktType = Array.isArray(it) ? (it[2] || "") : (it.typeCode || "");
    if (!rawCode || !name) continue;

    // 거래소 판별
    var mkt = "KOSPI";
    var sym = rawCode + ".KS";
    if (mktType === "2" || mktType === "NQ" || String(mktType).includes("KOSDAQ")) {
      mkt = "KOSDAQ"; sym = rawCode + ".KQ";
    } else if (mktType === "NX" || mktType === "KONEX") {
      mkt = "KONEX"; sym = rawCode + ".KS";
    }
    // 6자리 숫자가 아니면 스킵 (ETF/인덱스 등)
    if (!/^\d{6}$/.test(rawCode)) continue;

    results.push({ symbol: sym, code: rawCode, name: name, market: mkt });
  }
  return J({ ok: true, results: results });
}

// ─── 네이버 Quote ────────────────────────────────────────────
async function naverQuote(cd, sym) {
  var r = await fetch("https://m.stock.naver.com/api/stock/" + cd + "/basic", {
    headers: { "User-Agent": UA, "Accept": "application/json", "Referer": "https://finance.naver.com/" }
  });
  if (!r.ok) throw new Error("naver quote " + r.status);
  var d = await r.json();
  return J({
    ok: true, symbol: sym,
    name: d.stockName || d.corporateName || cd,
    price: N(d.closePrice || d.currentPrice),
    change: N(d.compareToPreviousClosePrice),
    changePct: N(d.fluctuationsRatio),
    high52: N(d.yearlyHighPrice), low52: N(d.yearlyLowPrice),
    volume: N(d.accumulatedTradingVolume || d.tradingVolume),
    marketCap: N(d.marketValue) * 1e8,
    per: N(d.per), eps: N(d.eps),
    currency: "KRW", exchange: sym.slice(-3) === ".KQ" ? "KOSDAQ" : "KOSPI"
  });
}

// ─── 네이버 Chart ────────────────────────────────────────────
async function naverChart(cd, days) {
  var cnt = days + 20;

  // 1순위: fchart XML
  try {
    var r = await fetch(
      "https://fchart.stock.naver.com/sise.nhn?symbol=" + cd + "&timeframe=day&count=" + cnt + "&requestType=0",
      { headers: { "User-Agent": UA, "Referer": "https://finance.naver.com/" } }
    );
    if (r.ok) {
      var xml = await r.text();
      var re = /data="(\d{8})\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)"/g;
      var hist = [], m;
      while ((m = re.exec(xml)) !== null) {
        var s = m[1];
        hist.push({ date: s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8), close: parseInt(m[5], 10) });
      }
      if (hist.length > 0) {
        hist.sort(function(a,b){return a.date<b.date?-1:1;});
        return J({ ok: true, history: hist.slice(-days) });
      }
    }
  } catch(e) {}

  // 2순위: 네이버 candle JSON
  var jUrls = [
    "https://m.stock.naver.com/api/stock/" + cd + "/candle/day?count=" + cnt,
    "https://m.stock.naver.com/api/stock/" + cd + "/sise/day?count=" + cnt
  ];
  for (var i = 0; i < jUrls.length; i++) {
    try {
      var rj = await fetch(jUrls[i], { headers: { "User-Agent": UA, "Accept": "application/json", "Referer": "https://m.stock.naver.com/" } });
      if (!rj.ok) continue;
      var data = await rj.json();
      var arr = Array.isArray(data) ? data : (data.candles || data.candleList || []);
      var hist2 = [];
      for (var k = 0; k < arr.length; k++) {
        var c = arr[k];
        var s2 = String(c.localDate || c.date || "");
        var dt = s2.length===8 ? s2.slice(0,4)+"-"+s2.slice(4,6)+"-"+s2.slice(6,8) : s2;
        var cl = N(c.closePrice || c.close);
        if (cl > 0 && dt) hist2.push({ date: dt, close: cl });
      }
      if (hist2.length > 0) {
        hist2.sort(function(a,b){return a.date<b.date?-1:1;});
        return J({ ok: true, history: hist2.slice(-days) });
      }
    } catch(e) {}
  }
  return J({ ok: true, history: [] });
}

// ─── Yahoo Quote ─────────────────────────────────────────────
async function yahooQuote(sym) {
  var hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (var i = 0; i < hosts.length; i++) {
    try {
      var r = await fetch(
        "https://" + hosts[i] + "/v8/finance/chart/" + encodeURIComponent(sym) + "?interval=1d&range=1d",
        { headers: { "User-Agent": UA } }
      );
      if (!r.ok) continue;
      var d = await r.json();
      var res = d.chart && d.chart.result && d.chart.result[0];
      if (!res) continue;
      var meta = res.meta || {};
      var price = meta.regularMarketPrice || 0;
      var prev = meta.chartPreviousClose || meta.previousClose || price;
      var chg = Math.round((price - prev) * 1e4) / 1e4;
      var pct = prev > 0 ? Math.round((chg / prev) * 1e6) / 1e4 : 0;
      return J({
        ok: true, symbol: sym,
        name: meta.longName || meta.shortName || sym,
        price: price, change: chg, changePct: pct,
        high52: meta.fiftyTwoWeekHigh || 0, low52: meta.fiftyTwoWeekLow || 0,
        volume: meta.regularMarketVolume || 0, marketCap: meta.marketCap || 0,
        per: 0, currency: meta.currency || "USD", exchange: meta.exchangeName || "US"
      });
    } catch(e) {}
  }
  throw new Error(sym + " 데이터 없음");
}

// ─── Yahoo Chart ─────────────────────────────────────────────
async function yahooChart(sym, days) {
  var rng = days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
  var path = "/v8/finance/chart/" + encodeURIComponent(sym) + "?interval=1d&range=" + rng;
  var hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (var i = 0; i < hosts.length; i++) {
    try {
      var r = await fetch("https://" + hosts[i] + path, { headers: { "User-Agent": UA } });
      if (!r.ok) continue;
      var d = await r.json();
      var res = d.chart && d.chart.result && d.chart.result[0];
      if (!res) continue;
      var ts = res.timestamp || [];
      var q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
      var closes = q.close || [];
      var hist = [];
      for (var j = 0; j < ts.length; j++) {
        if (closes[j] > 0) hist.push({ date: new Date(ts[j]*1000).toISOString().slice(0,10), close: closes[j] });
      }
      return J({ ok: true, history: hist.slice(-days) });
    } catch(e) {}
  }
  return J({ ok: true, history: [] });
}

// ─── AI 분석 ─────────────────────────────────────────────────
async function doAnalyze(prompt, env) {
  if (env.ANTHROPIC_API_KEY) {
    try {
      var r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-opus-4-6", max_tokens: 2000,
          system: "전문 주식 애널리스트. 순수 JSON만 출력. 마크다운 없음.",
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (r.ok) {
        var cd = await r.json();
        var text = (cd.content && cd.content[0] && cd.content[0].text || "{}").replace(/```json/gi,"").replace(/```/gi,"").trim();
        try { return J(JSON.parse(text)); } catch(e) {
          var m = text.match(/\{[\s\S]*\}/);
          if (m) { try { return J(JSON.parse(m[0])); } catch(e2) {} }
        }
      }
    } catch(e) {}
  }
  return J(autoAnalysis(prompt));
}

function autoAnalysis(prompt) {
  var nm  = ((prompt.match(/종목:\s*([^\(（]+)[\(（]/) || [])[1] || "이 종목").trim();
  var sym = (prompt.match(/\(([^)）]+)[\)）]/) || [])[1] || "";
  var pct = parseFloat((prompt.match(/등락:\s*([-\d.]+)%/) || [])[1] || "0");
  var pRaw= (prompt.match(/현재가:\s*([\d,.$]+)/) || [])[1] || "0";
  var h52 = (prompt.match(/52주고가:\s*([^\s|]+)/) || [])[1] || "N/A";
  var l52 = (prompt.match(/52주저가:\s*([^\s|]+)/) || [])[1] || "N/A";
  var per = (prompt.match(/PER:\s*([\d.N\/A]+)/) || [])[1] || "N/A";
  var mkt = (prompt.match(/시장:\s*([^\s|]+)/) || [])[1] || "시장";
  var vol = parseFloat((prompt.match(/변동성:\s*([\d.]+)%/) || [])[1] || "3");
  var trend = (prompt.match(/트렌드:\s*([^\s\n]+)/) || [])[1] || "보합";
  var cap = (prompt.match(/시가총액:\s*([^\s|]+)/) || [])[1] || "N/A";

  var pNum = parseFloat(pRaw.replace(/[^0-9.]/g,"")) || 0;
  var isUSD = pRaw.indexOf("$") >= 0;
  var isKospi = mkt==="KOSPI" || mkt==="KOSDAQ";
  var fmt = function(n) { return isUSD ? "$"+n.toFixed(2) : Math.round(n).toLocaleString("ko-KR")+"원"; };

  var verdict, vc;
  if (pct > 2 && trend === "상승") { verdict = "매수"; vc = "buy"; }
  else if (pct > 0.5) { verdict = "주목"; vc = "watch"; }
  else if (pct < -2) { verdict = "관망"; vc = "hold"; }
  else if (pct < -0.5) { verdict = "관망"; vc = "hold"; }
  else { verdict = "주목"; vc = "watch"; }

  var rs = 45;
  if (vol > 6) rs += 20; if (pct < -2) rs += 15; if (pct > 3) rs += 10;
  rs = Math.min(88, Math.max(22, rs));
  var rl = rs < 38 ? "낮음" : rs < 62 ? "중간" : "높음";

  var buy1 = pNum > 0 ? fmt(pNum*0.97) : "현재가 -3%";
  var buy2 = pNum > 0 ? fmt(pNum*0.94) : "현재가 -6%";
  var tgt1 = pNum > 0 ? fmt(pNum*1.06) : "현재가 +6%";
  var tgt2 = pNum > 0 ? fmt(pNum*1.14) : "현재가 +14%";
  var stop = pNum > 0 ? fmt(pNum*0.93) : "현재가 -7%";
  var bull = pNum > 0 ? fmt(pNum*1.20) : "현재가 +20%";
  var base = pNum > 0 ? fmt(pNum*1.09) : "현재가 +9%";
  var bear = pNum > 0 ? fmt(pNum*0.88) : "현재가 -12%";
  var zone = pNum > 0 ? fmt(pNum*0.96)+" ~ "+fmt(pNum*0.99) : "현재가 -1~4%";
  var perNote = (per !== "N/A" && !isNaN(parseFloat(per))) ? " PER "+per+"배로 "+(parseFloat(per)>20?"다소 고평가 수준이므로 신중한 접근이 필요합니다.":"적정 밸류에이션 수준입니다.") : "";

  var reason = nm+"은(는) 현재 "+(pct>=0?"+":"")+pct.toFixed(2)+"% "+(pct>=0?"상승":"하락")+" 중이며, "+
    "최근 30일 추세는 "+trend+" 흐름입니다. "+
    (isKospi ? "국내 "+mkt+" 시장에서 시가총액 "+cap+" 규모로 거래되고 있으며, 외국인·기관 수급 변화에 민감하게 반응합니다. "
             : "글로벌 시장에서 "+cap+" 규모의 종목으로 달러 환율 및 매크로 지표에 주목해야 합니다. ")+
    perNote+" 52주 고가 "+h52+", 저가 "+l52+" 기준으로 현재 포지션을 점검하고, "+
    (vol > 5 ? "변동성 "+vol.toFixed(1)+"% 수준으로 단기 급등락에 유의하며 " : "")+
    (vc==="buy" ? "분할 매수 전략으로 접근하는 것을 권고합니다."
    : vc==="watch" ? "추가 데이터 확인 후 진입 시점을 노리는 것을 권고합니다."
    : "신중하게 관망하며 하락 안정화를 확인 후 진입을 권고합니다.");

  return {
    ok: true, verdict: verdict, verdictReason: reason,
    buyStrategy: {
      zone: zone,
      timing: trend==="상승" ? "눌림목 발생 시 분할 매수 진입" : "하락 안정화 + 거래량 회복 확인 후 진입",
      split: ["1차 "+buy1+" (자금의 40%)", "2차 "+buy2+" (자금의 60%)"]
    },
    sellStrategy: {
      shortTarget: tgt1, midTarget: tgt2, stopLoss: stop,
      exitSignal: tgt1+" 돌파 + 거래량 급증 시 1차 익절, "+tgt2+" 도달 시 전량 청산 고려"
    },
    risks: [
      vol > 5 ? "높은 변동성("+vol.toFixed(1)+"%)으로 단기 급락 시 손실 확대 가능" : "변동성 안정적이나 대외 충격에 일시적 급락 위험",
      isKospi ? "외국인·기관 순매도 전환 시 수급 이탈로 추가 하락 가능" : "달러 강세·금리 상승 구간에서 밸류에이션 리스크",
      trend === "하락" ? "하락 추세 지속 시 52주 저가("+l52+") 지지 여부가 관건" : "단기 급등 후 차익 실현 매물 출회로 조정 가능성"
    ],
    riskLevel: rl, riskScore: rs,
    scenarios: {
      bull: { price: bull, desc: "수급 개선·실적 호조·섹터 모멘텀 강화 시 목표가 달성 가능" },
      base: { price: base, desc: "현 추세 유지 시 완만한 우상향, 분할 매수 전략 유효" },
      bear: { price: bear, desc: "매크로 악화·수급 이탈 복합 시 추가 하락, 손절 원칙 준수 필수" }
    },
    watchPoints: [
      "52주 고가 "+h52+" 돌파 여부 — 돌파 시 강력한 추세 전환 신호",
      "52주 저가 "+l52+" 지지 여부 — 이탈 시 손절 기준점 확인",
      isKospi ? "외국인·기관 순매수 전환 시점 — 수급 주도 상승의 핵심 조건" : "섹터 ETF 자금 유입 및 옵션 시장 포지션 변화 확인",
      "거래량이 20일 평균 2배 이상 급증 시 방향성 확정 신호로 해석"
    ],
    summary: nm+" "+(pct>=0?"+":"")+pct.toFixed(2)+"% 등락. 단기목표 "+tgt1+", 중기목표 "+tgt2+", 손절 "+stop+". "+
      (vc==="buy" ? "적극 매수 구간." : vc==="watch" ? "눌림목 포착 권고." : "관망 후 안정화 확인 필요.")
  };
}

// ─── 라우터 ──────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var path = url.pathname;
    if (request.method === "OPTIONS") return new Response(null, { headers: H });

    if (path === "/api/health") return J({ ok: true, v: 9, t: new Date().toISOString() });

    // 종목 검색 (자동완성)
    if (path === "/api/search" && request.method === "GET") {
      var q = url.searchParams.get("q") || "";
      if (!q) return J({ ok: false, error: "q 필요" }, 400);
      try { return await searchNaver(q); }
      catch(e) { return J({ ok: false, error: e.message }, 500); }
    }

    if (path === "/api/stock" && request.method === "GET") {
      var action = url.searchParams.get("action") || "";
      var symbol = (url.searchParams.get("symbol") || "").toUpperCase();
      var days = parseInt(url.searchParams.get("days") || "30", 10);
      try {
        if (!symbol) return J({ ok: false, error: "symbol 필요" }, 400);
        if (action === "quote") return isKR(symbol) ? await naverQuote(code(symbol), symbol) : await yahooQuote(symbol);
        if (action === "chart") return isKR(symbol) ? await naverChart(code(symbol), days) : await yahooChart(symbol, days);
        return J({ ok: false, error: "action 오류" }, 400);
      } catch(e) { return J({ ok: false, error: e.message }, 500); }
    }

    if (path === "/api/analyze" && request.method === "POST") {
      try {
        var body = await request.json().catch(function() { return {}; });
        if (!body.prompt) return J({ ok: false, error: "prompt 필요" }, 400);
        return await doAnalyze(body.prompt, env);
      } catch(e) { return J({ ok: false, error: e.message }, 500); }
    }

    return env.ASSETS.fetch(request);
  }
};
