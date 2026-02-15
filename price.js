export async function onRequest(context) {

  const url = new URL(context.request.url);
  const ticker = url.searchParams.get("ticker");

  if (!ticker) {
    return new Response(JSON.stringify({ error: "No ticker" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const yahooUrl =
    `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?range=2y&interval=1d`;

  const response = await fetch(yahooUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Connection": "keep-alive"
    }
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: "Yahoo fetch failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await response.text();

  return new Response(data, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
