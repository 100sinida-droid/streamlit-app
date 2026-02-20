// _worker.js — StockMind AI
// GitHub 루트에 이 파일만 올리면 됩니다

var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};

function jsonRes(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: CORS });
}

function toN(v) {
  return parseFloat(String(v || 0).replace(/,/g, "")) || 0;
}

function isKR(sym) {
  return sym.slice(-3) === ".KS" || sym.slice(-3) === ".KQ";
}

function krCode(sym) {
  return sym.slice(0, -3);
}

// 외부 fetch — User-Agent 필수
async function extFetch(url) {
  var r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "application/json, */*",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Referer": "https://finance.naver.com/"
    }
  });
  if (!r.ok) { throw new Error("HTTP " + r.status + " " + url); }
  return r;
}

// ── 네이버 Quote ──────────────────────────────────────────────
async function naverQuote(code, sym) {
  var r = await extFetch("https://m.stock.naver.com/api/stock/" + code + "/basic");
  var d = await r.json();
  return jsonRes({
    ok: true, symbol: sym,
    name: d.stockName || d.corporateName || code,
    price: toN(d.closePrice || d.currentPrice),
    change: toN(d.compareToPreviousClosePrice),
    changePct: toN(d.fluctuationsRatio),
    high52: toN(d.yearlyHighPrice),
    low52: toN(d.yearlyLowPrice),
    volume: toN(d.accumulatedTradingVolume || d.tradingVolume),
    marketCap: toN(d.marketValue) * 100000000,
    per: toN(d.per),
    currency: "KRW",
    exchange: sym.slice(-3) === ".KQ" ? "KOSDAQ" : "KOSPI"
  });
}

// ── 네이버 Chart — 여러 엔드포인트 시도, 실패시 Yahoo 폴백 ────
async function naverChart(code, days) {
  var count = days + 10;
  var urls = [
    "https://m.stock.naver.com/api/stock/" + code + "/candle/day?count=" + count,
    "https://m.stock.naver.com/api/stock/" + code + "/day/price?count=" + count,
    "https://api.stock.naver.com/stock/" + code + "/day?count=" + count
  ];
  var raw = null;
  for (var ui = 0; ui < urls.length; ui++) {
    try {
      var resp = await fetch(urls[ui], {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept": "application/json, */*",
          "Accept-Language": "ko-KR,ko;q=0.9",
          "Referer": "https://m.stock.naver.com/"
        }
      });
      if (resp.ok) { raw = await resp.json(); break; }
    } catch(e) { /* try next */ }
  }

  // 네이버 모두 실패 → Yahoo Finance KRX 폴백
  if (!raw) {
    return yahooChart(code + ".KS", days);
  }

  var arr = Array.isArray(raw) ? raw : (raw.candles || raw.candleList || raw.priceList || []);
  var history = [];
  for (var i = 0; i < arr.length; i++) {
    var c = arr[i];
    var s = String(c.localDate || c.date || c.bizDate || "");
    var date = s.length === 8 ? s.slice(0,4) + "-" + s.slice(4,6) + "-" + s.slice(6,8) : s;
    var close = toN(c.closePrice || c.close || c.endPrice);
    if (close > 0 && date.length >= 8) { history.push({ date: date, close: close }); }
  }
  history.sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  if (!history.length) { return yahooChart(code + ".KS", days); }
  return jsonRes({ ok: true, history: history.slice(-days) });
}

// ── Yahoo Quote ───────────────────────────────────────────────
async function yahooQuote(symbol) {
  var urls = [
    "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=1d&range=1d&includePrePost=false",
    "https://query2.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=1d&range=1d&includePrePost=false"
  ];
  var d = null;
  for (var ui = 0; ui < urls.length; ui++) {
    try { var r = await extFetch(urls[ui]); d = await r.json(); break; } catch(e) { if (ui === urls.length - 1) throw e; }
  }
  var result = d && d.chart && d.chart.result && d.chart.result[0];
  if (!result) { throw new Error(symbol + " 데이터 없음"); }
  var meta = result.meta || {};
  var price = meta.regularMarketPrice || 0;
  var prev = meta.chartPreviousClose || meta.previousClose || price;
  var change = Math.round((price - prev) * 10000) / 10000;
  var changePct = prev > 0 ? Math.round((change / prev) * 1000000) / 10000 : 0;
  return jsonRes({
    ok: true, symbol: symbol,
    name: meta.longName || meta.shortName || symbol,
    price: price, change: change, changePct: changePct,
    high52: meta.fiftyTwoWeekHigh || 0,
    low52: meta.fiftyTwoWeekLow || 0,
    volume: meta.regularMarketVolume || 0,
    marketCap: meta.marketCap || 0,
    per: 0, currency: meta.currency || "USD",
    exchange: meta.exchangeName || "US"
  });
}

// ── Yahoo Chart ───────────────────────────────────────────────
async function yahooChart(symbol, days) {
  var range = days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
  var suffix = "?interval=1d&range=" + range + "&includePrePost=false";
  var base = "/v8/finance/chart/" + encodeURIComponent(symbol) + suffix;
  var urls = [
    "https://query1.finance.yahoo.com" + base,
    "https://query2.finance.yahoo.com" + base
  ];
  var d = null;
  for (var ui = 0; ui < urls.length; ui++) {
    try { var r = await extFetch(urls[ui]); d = await r.json(); break; } catch(e) { if (ui === urls.length - 1) throw e; }
  }
  var result = d && d.chart && d.chart.result && d.chart.result[0];
  if (!result) { throw new Error(symbol + " 차트 없음"); }
  var ts = result.timestamp || [];
  var q = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
  var closes = q.close || [];
  var history = [];
  for (var i = 0; i < ts.length; i++) {
    if (closes[i] && closes[i] > 0) {
      history.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: closes[i] });
    }
  }
  return jsonRes({ ok: true, history: history.slice(-days) });
}

// ── Claude AI ─────────────────────────────────────────────────
async function doAnalyze(prompt, env) {
  var key = env.ANTHROPIC_API_KEY;
  if (!key) {
    return jsonRes({
      ok: true, verdict: "관망",
      verdictReason: "AI 분석을 사용하려면 Cloudflare Pages → Settings → Environment variables 에 ANTHROPIC_API_KEY 를 추가하세요.",
      buyStrategy: { zone: "-", timing: "-", split: [] },
      sellStrategy: { shortTarget: "-", midTarget: "-", stopLoss: "-", exitSignal: "-" },
      risks: ["API 키 미설정"], riskLevel: "중간", riskScore: 50,
      scenarios: { bull: { price: "-", desc: "-" }, base: { price: "-", desc: "-" }, bear: { price: "-", desc: "-" } },
      watchPoints: ["Cloudflare Pages 환경변수에 ANTHROPIC_API_KEY 추가 후 재배포"],
      summary: "ANTHROPIC_API_KEY 환경변수를 설정해주세요."
    });
  }
  var r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      system: "전문 주식 애널리스트. 순수 JSON만 출력. 마크다운 없음.",
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!r.ok) {
    return jsonRes({ ok: true, verdict: "관망", verdictReason: "Claude API 오류 " + r.status,
      buyStrategy: { zone: "-", timing: "-", split: [] }, sellStrategy: { shortTarget: "-", midTarget: "-", stopLoss: "-", exitSignal: "-" },
      risks: ["API 오류"], riskLevel: "중간", riskScore: 50,
      scenarios: { bull: { price: "-", desc: "-" }, base: { price: "-", desc: "-" }, bear: { price: "-", desc: "-" } },
      watchPoints: [], summary: "오류" });
  }
  var cd = await r.json();
  var text = (cd.content && cd.content[0] && cd.content[0].text) || "{}";
  text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
  try { return jsonRes(JSON.parse(text)); }
  catch(e) {
    var m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return jsonRes(JSON.parse(m[0])); } catch(e2) {} }
    return jsonRes({ ok: true, verdict: "관망", verdictReason: "파싱 오류",
      buyStrategy: { zone: "-", timing: "-", split: [] }, sellStrategy: { shortTarget: "-", midTarget: "-", stopLoss: "-", exitSignal: "-" },
      risks: ["파싱 오류"], riskLevel: "중간", riskScore: 50,
      scenarios: { bull: { price: "-", desc: "-" }, base: { price: "-", desc: "-" }, bear: { price: "-", desc: "-" } },
      watchPoints: [], summary: "파싱 오류" });
  }
}

// ── 라우터 ────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var path = url.pathname;
    var method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (path === "/api/health") {
      return jsonRes({ ok: true, msg: "Worker OK", t: new Date().toISOString() });
    }

    if (path === "/api/stock" && method === "GET") {
      var action = url.searchParams.get("action") || "";
      var symbol = (url.searchParams.get("symbol") || "").toUpperCase();
      var days = parseInt(url.searchParams.get("days") || "30", 10);
      try {
        if (!symbol) { return jsonRes({ ok: false, error: "symbol 필요" }, 400); }
        if (action === "quote") {
          if (isKR(symbol)) { return await naverQuote(krCode(symbol), symbol); }
          return await yahooQuote(symbol);
        }
        if (action === "chart") {
          if (isKR(symbol)) { return await naverChart(krCode(symbol), days); }
          return await yahooChart(symbol, days);
        }
        return jsonRes({ ok: false, error: "action 오류" }, 400);
      } catch(e) {
        return jsonRes({ ok: false, error: e.message }, 500);
      }
    }

    if (path === "/api/analyze" && method === "POST") {
      try {
        var body = await request.json().catch(function() { return {}; });
        if (!body.prompt) { return jsonRes({ ok: false, error: "prompt 필요" }, 400); }
        return await doAnalyze(body.prompt, env);
      } catch(e) {
        return jsonRes({ ok: false, error: e.message }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
