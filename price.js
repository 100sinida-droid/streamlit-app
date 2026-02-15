export async function onRequest(context) {

  const url = new URL(context.request.url);
  const ticker = url.searchParams.get("ticker");

  if (!ticker) {
    return new Response(JSON.stringify({ error: "No ticker" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=2y&interval=1d`;

  const response = await fetch(yahooUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const data = await response.text();

  return new Response(data, {
    headers: {
      "Content-Type": "application/json"
    }
  });
}
