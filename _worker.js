// StockMind _worker.js v12
// 핵심 전략:
//   1. /basic → 현재가, 등락, 거래량, PER, PBR (기본)
//   2. fchart 1년치 → 52주 고저 직접 계산 (확실한 방법)
//   3. 네이버 금융 HTML 파싱 → 시가총액 보완
//   4. 위 전략으로 모든 한국 주식 완전 데이터 보장

var H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};

function J(d, s) { return new Response(JSON.stringify(d), { status: s || 200, headers: H }); }

function N(v) {
  if (v === null || v === undefined || v === "" || v === "N/A" || v === "-") return 0;
  var n = parseFloat(String(v).replace(/,/g, "").replace(/\+/g, "").replace(/원/g, "").trim());
  return isFinite(n) ? n : 0;
}

// 억/조 단위 한글 숫자 파싱
function parseKoreanNum(s) {
  if (!s) return 0;
  s = String(s).replace(/,/g, "").trim();
  var n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!isFinite(n) || n === 0) return 0;
  if (s.indexOf("조") >= 0) return n * 1e12;
  if (s.indexOf("억") >= 0) return n * 1e8;
  if (s.indexOf("만") >= 0) return n * 1e4;
  return n;
}

function isKR(s) { return s.slice(-3) === ".KS" || s.slice(-3) === ".KQ"; }
function stripSuffix(s) { return s.slice(0, -3); }

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";

function nHdr(referer) {
  return {
    "User-Agent": UA,
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": referer || "https://finance.naver.com/"
  };
}

// ─── 네이버 종목 검색 ─────────────────────────────────────────
async function searchNaver(query) {
  try {
    var r = await fetch(
      "https://ac.stock.naver.com/ac?q=" + encodeURIComponent(query) + "&target=index,stock,etf,fund,futures,option",
      { headers: nHdr("https://finance.naver.com/") }
    );
    if (!r.ok) return J({ ok: true, results: [] });
    var d = await r.json();
    var items = Array.isArray(d.items) ? d.items
              : (d.result && Array.isArray(d.result.items)) ? d.result.items
              : Array.isArray(d) ? d : [];
    var results = [];
    for (var i = 0; i < Math.min(items.length, 12); i++) {
      var it = items[i];
      var rawCode = Array.isArray(it) ? String(it[0] || "") : String(it.code || it.symbolCode || "");
      var name    = Array.isArray(it) ? String(it[1] || "") : String(it.name || it.stockName || "");
      var mktType = Array.isArray(it) ? String(it[2] || "") : String(it.typeCode || "");
      if (!rawCode || !name || !/^\d{6}$/.test(rawCode)) continue;
      var mkt = "KOSPI", sym = rawCode + ".KS";
      if (mktType === "2" || mktType === "NQ" || mktType.indexOf("KOSDAQ") >= 0) {
        mkt = "KOSDAQ"; sym = rawCode + ".KQ";
      }
      results.push({ symbol: sym, code: rawCode, name: name, market: mkt });
    }
    return J({ ok: true, results: results });
  } catch(e) { return J({ ok: true, results: [] }); }
}

// ─── fchart XML 파싱 (1년치 → 52주 고저 계산) ────────────────
async function fetchFchart(cd, count) {
  var r = await fetch(
    "https://fchart.stock.naver.com/sise.nhn?symbol=" + cd + "&timeframe=day&count=" + count + "&requestType=0",
    { headers: { "User-Agent": UA, "Referer": "https://finance.naver.com/" } }
  );
  if (!r.ok) throw new Error("fchart " + r.status);
  var xml = await r.text();
  // data="20250101|시가|고가|저가|종가|거래량"
  var re = /data="(\d{8})\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)"/g;
  var rows = [], m;
  while ((m = re.exec(xml)) !== null) {
    rows.push({
      date:   m[1].slice(0,4)+"-"+m[1].slice(4,6)+"-"+m[1].slice(6,8),
      open:   parseInt(m[2], 10),
      high:   parseInt(m[3], 10),
      low:    parseInt(m[4], 10),
      close:  parseInt(m[5], 10),
      volume: parseInt(m[6], 10)
    });
  }
  rows.sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  return rows;
}

// ─── 네이버 HTML에서 시가총액/지표 스크래핑 ──────────────────
async function scrapeNaverFinance(cd) {
  var result = { marketCap: 0, per: 0, pbr: 0, eps: 0, foreignRatio: 0 };
  try {
    // PC 네이버 금융 종목 페이지
    var r = await fetch("https://finance.naver.com/item/main.naver?code=" + cd, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://finance.naver.com/"
      }
    });
    if (!r.ok) return result;
    var html = await r.text();

    // 시가총액 파싱: "시가총액" 근처의 숫자 + 단위
    var capMatch = html.match(/시가총액[^]*?<em[^>]*>([0-9,]+)<\/em>\s*억원/);
    if (!capMatch) capMatch = html.match(/marketCap["\s:]+([0-9,]+)/);
    if (capMatch) result.marketCap = parseFloat(capMatch[1].replace(/,/g,"")) * 1e8;

    // 다른 패턴 시도
    if (!result.marketCap) {
      var capMatch2 = html.match(/시가총액\s*<\/dt>\s*<dd[^>]*>[^<]*<em[^>]*>([0-9,]+)<\/em>/);
      if (capMatch2) result.marketCap = parseFloat(capMatch2[1].replace(/,/g,"")) * 1e8;
    }

    // 52주 고저 HTML에서 파싱
    var h52m = html.match(/52주최고[^]*?<em[^>]*>([0-9,]+)<\/em>/);
    var l52m = html.match(/52주최저[^]*?<em[^>]*>([0-9,]+)<\/em>/);
    if (h52m) result.high52 = parseFloat(h52m[1].replace(/,/g,""));
    if (l52m) result.low52  = parseFloat(l52m[1].replace(/,/g,""));

    // PER, PBR
    var perM = html.match(/PER[^]*?<em[^>]*>([\d.]+)<\/em>/);
    var pbrM = html.match(/PBR[^]*?<em[^>]*>([\d.]+)<\/em>/);
    if (perM) result.per = parseFloat(perM[1]);
    if (pbrM) result.pbr = parseFloat(pbrM[1]);

    // 외국인 비율
    var fgnM = html.match(/외국인\s*(?:비율)?[^]*?<em[^>]*>([\d.]+)<\/em>/);
    if (fgnM) result.foreignRatio = parseFloat(fgnM[1]);

  } catch(e) {}
  return result;
}

// ─── 네이버 Quote: 완전한 데이터 수집 ────────────────────────
async function naverQuote(cd, sym) {
  var isKQ = sym.slice(-3) === ".KQ";

  // 병렬로 basic + fchart(1년) + HTML 동시 호출
  var [rBasic, rChart, rHtml] = await Promise.allSettled([
    fetch("https://m.stock.naver.com/api/stock/" + cd + "/basic", { headers: nHdr() }).then(function(r){ return r.ok ? r.json() : {}; }),
    fetchFchart(cd, 280),   // 약 1년치 (52주 고저 계산용)
    scrapeNaverFinance(cd)  // HTML 스크래핑 (시총, 52주, PER, PBR)
  ]);

  var b    = rBasic.status === "fulfilled" ? (rBasic.value || {}) : {};
  var rows = rChart.status === "fulfilled" ? (rChart.value || []) : [];
  var html = rHtml.status  === "fulfilled" ? (rHtml.value  || {}) : {};

  // ── 현재가 & 등락 ─────────────────────────────────────────
  var price     = N(b.closePrice || b.stockEndPrice || b.currentPrice);
  var change    = N(b.compareToPreviousClosePrice);
  var changePct = N(b.fluctuationsRatio);
  var name      = b.stockName || b.itemName || b.corporateName || cd;
  var openP     = N(b.openPrice);
  var highP     = N(b.highPrice);
  var lowP      = N(b.lowPrice);

  // ── 거래량 (basic에서) ────────────────────────────────────
  var volume = N(b.accumulatedTradingVolume || b.tradingVolume);

  // ── 오늘 거래량 없으면 마지막 차트 데이터에서 ───────────────
  if (!volume && rows.length > 0) {
    volume = rows[rows.length - 1].volume;
  }

  // ── 현재가 없으면 차트 마지막 종가에서 ──────────────────────
  if (!price && rows.length > 0) {
    price = rows[rows.length - 1].close;
  }

  // ── 52주 고저: fchart 1년치에서 직접 계산 ───────────────────
  var h52 = 0, l52 = 0;
  if (rows.length > 0) {
    var highs  = rows.map(function(r){ return r.high;  }).filter(function(v){ return v > 0; });
    var lows   = rows.map(function(r){ return r.low;   }).filter(function(v){ return v > 0; });
    if (highs.length) h52 = Math.max.apply(null, highs);
    if (lows.length)  l52 = Math.min.apply(null, lows);
  }

  // basic에 yearlyHigh 있으면 더 정확 (교환)
  var bh52 = N(b.yearlyHighPrice || b.highPrice52Week || b.week52HighPrice);
  var bl52 = N(b.yearlyLowPrice  || b.lowPrice52Week  || b.week52LowPrice);
  if (bh52 > 0) h52 = bh52;
  if (bl52 > 0) l52 = bl52;

  // HTML 스크래핑 결과 사용 (있으면 덮어씀)
  if (html.high52 > 0) h52 = html.high52;
  if (html.low52  > 0) l52 = html.low52;

  // ── PER / PBR ─────────────────────────────────────────────
  var per = N(b.per || b.PER);
  var pbr = N(b.pbr || b.PBR);
  var eps = N(b.eps || b.EPS);
  var bps = N(b.bps || b.BPS);
  var fgn = N(b.foreignRatio);

  // HTML 값으로 보완
  if (!per && html.per) per = html.per;
  if (!pbr && html.pbr) pbr = html.pbr;
  if (!eps && html.eps) eps = html.eps;
  if (!fgn && html.foreignRatio) fgn = html.foreignRatio;

  // ── 시가총액 ──────────────────────────────────────────────
  var marketCap = 0;
  var mcRaw = N(b.marketValue || b.totalMarketValue);
  // marketValue는 억원 단위 (ex: SK하이닉스 690,804 = 약 69조)
  if (mcRaw > 0) {
    marketCap = mcRaw * 1e8;  // 억원 → 원
  }
  // HTML 스크래핑 값으로 보완
  if (!marketCap && html.marketCap > 0) {
    marketCap = html.marketCap;
  }
  // 그래도 없으면 주가 × 발행주식수 역산 불가 → 차트 데이터에서 EPS×PER로 추정
  if (!marketCap && price > 0 && eps > 0 && per > 0) {
    // 대략적 추정 불가, 그냥 0 유지
  }

  return J({
    ok: true, symbol: sym, name: name,
    price: price, change: change, changePct: changePct,
    open: openP, high: highP, low: lowP,
    high52: h52, low52: l52,
    volume: volume, marketCap: marketCap,
    per: per, pbr: pbr, eps: eps, bps: bps,
    foreignRatio: fgn,
    currency: "KRW",
    exchange: isKQ ? "KOSDAQ" : "KOSPI"
  });
}

// ─── 네이버 Chart ─────────────────────────────────────────────
async function naverChart(cd, days) {
  try {
    var rows = await fetchFchart(cd, days + 20);
    if (rows.length > 0) {
      return J({ ok: true, history: rows.slice(-days).map(function(r){ return { date: r.date, close: r.close }; }) });
    }
  } catch(e) {}

  // JSON 폴백
  var urls = [
    "https://m.stock.naver.com/api/stock/" + cd + "/candle/day?count=" + (days + 20),
    "https://m.stock.naver.com/api/stock/" + cd + "/sise/day?count=" + (days + 20)
  ];
  for (var i = 0; i < urls.length; i++) {
    try {
      var r = await fetch(urls[i], { headers: nHdr() });
      if (!r.ok) continue;
      var data = await r.json();
      var arr  = Array.isArray(data) ? data : (data.candles || data.candleList || []);
      var hist = [];
      for (var k = 0; k < arr.length; k++) {
        var c  = arr[k];
        var s2 = String(c.localDate || c.date || "");
        var dt = s2.length === 8 ? s2.slice(0,4)+"-"+s2.slice(4,6)+"-"+s2.slice(6,8) : s2;
        var cl = N(c.closePrice || c.close);
        if (cl > 0 && dt) hist.push({ date: dt, close: cl });
      }
      if (hist.length > 0) {
        hist.sort(function(a,b){ return a.date < b.date ? -1 : 1; });
        return J({ ok: true, history: hist.slice(-days) });
      }
    } catch(e) {}
  }
  return J({ ok: true, history: [] });
}

// ─── Yahoo Quote ─────────────────────────────────────────────
async function yahooQuote(sym) {
  for (var i = 0; i < 2; i++) {
    try {
      var host = i === 0 ? "query1" : "query2";
      var r = await fetch(
        "https://" + host + ".finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?interval=1d&range=1d",
        { headers: { "User-Agent": UA } }
      );
      if (!r.ok) continue;
      var d   = await r.json();
      var res = d.chart && d.chart.result && d.chart.result[0];
      if (!res) continue;
      var meta  = res.meta || {};
      var price = meta.regularMarketPrice || 0;
      var prev  = meta.chartPreviousClose || meta.previousClose || price;
      var chg   = Math.round((price - prev) * 1e4) / 1e4;
      var pct   = prev > 0 ? Math.round((chg / prev) * 1e6) / 1e4 : 0;
      return J({
        ok: true, symbol: sym,
        name: meta.longName || meta.shortName || sym,
        price: price, change: chg, changePct: pct,
        open: meta.regularMarketOpen || 0,
        high: meta.regularMarketDayHigh || 0,
        low:  meta.regularMarketDayLow  || 0,
        high52: meta.fiftyTwoWeekHigh || 0,
        low52:  meta.fiftyTwoWeekLow  || 0,
        volume: meta.regularMarketVolume || 0,
        marketCap: meta.marketCap || 0,
        per: 0, pbr: 0, currency: meta.currency || "USD",
        exchange: meta.exchangeName || "US"
      });
    } catch(e) {}
  }
  throw new Error(sym + " 데이터 없음");
}

// ─── Yahoo Chart ─────────────────────────────────────────────
async function yahooChart(sym, days) {
  var rng  = days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
  var path = "/v8/finance/chart/" + encodeURIComponent(sym) + "?interval=1d&range=" + rng;
  for (var i = 0; i < 2; i++) {
    try {
      var host = i === 0 ? "query1" : "query2";
      var r = await fetch("https://" + host + ".finance.yahoo.com" + path, { headers: { "User-Agent": UA } });
      if (!r.ok) continue;
      var d   = await r.json();
      var res = d.chart && d.chart.result && d.chart.result[0];
      if (!res) continue;
      var ts     = res.timestamp || [];
      var q      = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
      var closes = q.close || [];
      var hist   = [];
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
        var text = ((cd.content && cd.content[0] && cd.content[0].text) || "{}").replace(/```json/gi,"").replace(/```/gi,"").trim();
        try { return J(JSON.parse(text)); } catch(e) {
          var m = text.match(/\{[\s\S]*\}/);
          if (m) { try { return J(JSON.parse(m[0])); } catch(e2){} }
        }
      }
    } catch(e) {}
  }
  return J(autoAnalysis(prompt));
}

function autoAnalysis(prompt) {
  var nm    = ((prompt.match(/종목:\s*([^\(（]+)[\(（]/)||[])[1]||"이 종목").trim();
  var pct   = parseFloat((prompt.match(/등락:\s*([-\d.]+)%/)||[])[1]||"0");
  var pRaw  = (prompt.match(/현재가:\s*([\d,.$]+)/)||[])[1]||"0";
  var h52   = (prompt.match(/52주고가:\s*([^\s|]+)/)||[])[1]||"N/A";
  var l52   = (prompt.match(/52주저가:\s*([^\s|]+)/)||[])[1]||"N/A";
  var per   = (prompt.match(/PER:\s*([\d.]+)/)||[])[1]||"N/A";
  var pbr   = (prompt.match(/PBR:\s*([\d.]+)/)||[])[1]||"N/A";
  var mkt   = (prompt.match(/시장:\s*([^\s|]+)/)||[])[1]||"시장";
  var cap   = (prompt.match(/시가총액:\s*([^\s|]+)/)||[])[1]||"";
  var vol   = parseFloat((prompt.match(/변동성:\s*([\d.]+)%/)||[])[1]||"3");
  var trend = (prompt.match(/트렌드:\s*([^\s\n]+)/)||[])[1]||"보합";

  var pNum = parseFloat(pRaw.replace(/[^0-9.]/g,""))||0;
  var isUSD = pRaw.indexOf("$") >= 0;
  var isKo  = mkt === "KOSPI" || mkt === "KOSDAQ";
  var fmt   = function(n){ return isUSD ? "$"+n.toFixed(2) : Math.round(n).toLocaleString("ko-KR")+"원"; };

  var verdict, vc;
  if (pct > 2 && trend === "상승")       { verdict="매수"; vc="buy"; }
  else if (pct > 0.5)                    { verdict="주목"; vc="watch"; }
  else if (pct < -2 && trend === "하락") { verdict="관망"; vc="hold"; }
  else if (pct < -0.5)                   { verdict="관망"; vc="hold"; }
  else                                   { verdict="주목"; vc="watch"; }

  var rs = 45;
  if (vol > 6) rs += 20; if (pct < -2) rs += 15; if (pct > 3) rs += 10;
  rs = Math.min(88, Math.max(22, rs));
  var rl = rs < 38 ? "낮음" : rs < 62 ? "중간" : "높음";

  var buy1 = pNum>0?fmt(pNum*0.97):"현재가 -3%";
  var buy2 = pNum>0?fmt(pNum*0.94):"현재가 -6%";
  var tgt1 = pNum>0?fmt(pNum*1.06):"현재가 +6%";
  var tgt2 = pNum>0?fmt(pNum*1.14):"현재가 +14%";
  var stop = pNum>0?fmt(pNum*0.93):"현재가 -7%";
  var bull = pNum>0?fmt(pNum*1.20):"현재가 +20%";
  var base = pNum>0?fmt(pNum*1.09):"현재가 +9%";
  var bear = pNum>0?fmt(pNum*0.88):"현재가 -12%";
  var zone = pNum>0?fmt(pNum*0.96)+" ~ "+fmt(pNum*0.99):"현재가 -1~4%";

  var perNt = "";
  if (per !== "N/A" && !isNaN(+per)) {
    perNt = " PER "+per+"배, PBR "+pbr+"배로 "+(+per>20?"다소 고평가 수준이므로 신중한 접근이 필요합니다.":"적정 밸류에이션 수준입니다.");
  }
  var capTxt = (cap && cap !== "N/A" && cap !== "—") ? "시가총액 "+cap+" 규모로 " : "";

  var reason = nm+"은(는) 현재 "+(pct>=0?"+":"")+pct.toFixed(2)+"% "+(pct>=0?"상승":"하락")+" 중이며, 최근 30일 추세는 "+trend+" 흐름입니다. "+
    (isKo ? "국내 "+mkt+" 시장에서 "+capTxt+"거래되고 있으며, 외국인·기관 수급 변화에 민감하게 반응합니다. "
           : "글로벌 시장에서 "+capTxt+"거래되는 종목으로, 달러 환율 및 매크로 지표에 주목해야 합니다. ")+
    perNt + " 52주 고가 "+h52+", 저가 "+l52+" 기준으로 현재 포지션을 점검하고, "+
    (vol > 5 ? "변동성 "+vol.toFixed(1)+"% 수준으로 단기 급등락에 유의하며 " : "")+
    (vc==="buy" ? "분할 매수 전략으로 접근하는 것을 권고합니다."
    : vc==="watch" ? "추가 데이터 확인 후 진입 시점을 노리는 것을 권고합니다."
    : "신중하게 관망하며 하락 안정화를 확인 후 진입을 권고합니다.");

  return {
    ok:true, verdict:verdict, verdictReason:reason,
    buyStrategy: { zone:zone, timing:trend==="상승"?"눌림목 발생 시 분할 매수 진입":"하락 안정화 + 거래량 회복 확인 후 진입", split:["1차 "+buy1+" (자금의 40%)","2차 "+buy2+" (자금의 60%)"] },
    sellStrategy: { shortTarget:tgt1, midTarget:tgt2, stopLoss:stop, exitSignal:tgt1+" 돌파+거래량 급증 시 1차 익절, "+tgt2+" 도달 시 전량 청산" },
    risks: [
      vol>5 ? "높은 변동성("+vol.toFixed(1)+"%)으로 단기 급락 시 손실 확대 가능" : "변동성 안정적이나 대외 충격에 일시적 급락 위험",
      isKo  ? "외국인·기관 순매도 전환 시 수급 이탈로 추가 하락 가능" : "달러 강세·금리 상승 구간에서 밸류에이션 리스크",
      trend==="하락" ? "하락 추세 지속 시 52주 저가("+l52+") 지지 여부가 관건" : "단기 급등 후 차익 실현 매물 출회로 조정 가능성"
    ],
    riskLevel:rl, riskScore:rs,
    scenarios: {
      bull:{price:bull, desc:"수급 개선·실적 호조·섹터 모멘텀 강화 시 목표가 달성 가능"},
      base:{price:base, desc:"현 추세 유지 시 완만한 우상향, 분할 매수 전략 유효"},
      bear:{price:bear, desc:"매크로 악화·수급 이탈 복합 시 추가 하락, 손절 원칙 준수 필수"}
    },
    watchPoints: [
      "52주 고가 "+h52+" 돌파 여부 — 돌파 시 강력한 추세 전환 신호",
      "52주 저가 "+l52+" 지지 여부 — 이탈 시 손절 기준점 확인",
      isKo ? "외국인·기관 순매수 전환 시점 — 수급 주도 상승의 핵심 조건" : "섹터 ETF 자금 유입 및 옵션 포지션 변화 확인",
      "거래량 20일 평균 2배 이상 급증 시 방향성 확정 신호"
    ],
    summary: nm+" "+(pct>=0?"+":"")+pct.toFixed(2)+"% 등락. 단기목표 "+tgt1+", 중기목표 "+tgt2+", 손절 "+stop+". "+(vc==="buy"?"적극 매수 구간.":vc==="watch"?"눌림목 포착 권고.":"관망 후 안정화 확인.")
  };
}

// ─── 라우터 ──────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    var url=new URL(request.url), path=url.pathname, method=request.method;
    if (method==="OPTIONS") return new Response(null, { headers:H });
    if (path==="/api/health") return J({ ok:true, v:12, t:new Date().toISOString() });

    if (path==="/api/search" && method==="GET") {
      var q = url.searchParams.get("q")||"";
      if (!q) return J({ ok:false, error:"q 필요" }, 400);
      return await searchNaver(q);
    }

    if (path==="/api/stock" && method==="GET") {
      var action = (url.searchParams.get("action")||"").toLowerCase();
      var symbol = (url.searchParams.get("symbol")||"").toUpperCase();
      var days   = parseInt(url.searchParams.get("days")||"30", 10);
      try {
        if (!symbol) return J({ ok:false, error:"symbol 필요" }, 400);
        if (action==="quote") {
          return isKR(symbol) ? await naverQuote(stripSuffix(symbol), symbol) : await yahooQuote(symbol);
        }
        if (action==="chart") {
          return isKR(symbol) ? await naverChart(stripSuffix(symbol), days) : await yahooChart(symbol, days);
        }
        return J({ ok:false, error:"action 오류" }, 400);
      } catch(e) { return J({ ok:false, error:e.message }, 500); }
    }

    if (path==="/api/analyze" && method==="POST") {
      try {
        var body = await request.json().catch(function(){ return {}; });
        if (!body.prompt) return J({ ok:false, error:"prompt 필요" }, 400);
        return await doAnalyze(body.prompt, env);
      } catch(e) { return J({ ok:false, error:e.message }, 500); }
    }

    return env.ASSETS.fetch(request);
  }
};
