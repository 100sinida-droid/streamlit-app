// functions/api/health.js
// GET /api/health → Function 정상 작동 확인용

export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: true,
    message: 'StockMind Functions 정상 작동',
    timestamp: new Date().toISOString(),
    endpoints: ['/api/stock', '/api/analyze', '/api/health'],
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
