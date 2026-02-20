// functions/api/analyze.js
// Claude AI 분석 엔드포인트
// 설정: Cloudflare Pages → Settings → Environment variables
//       ANTHROPIC_API_KEY = sk-ant-...

const H = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const { prompt } = body;
    if (!prompt) return j({ error: 'prompt 필요' }, 400);

    const key = env.ANTHROPIC_API_KEY;
    if (!key) return j(stub('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다'));

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        system: '당신은 전문 주식 애널리스트입니다. 반드시 순수 JSON만 출력하세요. ```json 같은 마크다운 블록 없이 JSON 객체만.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return j(stub(`Claude API 오류 (${r.status}): ${err.slice(0, 100)}`));
    }

    const cd  = await r.json();
    const raw = (cd.content?.[0]?.text || '{}')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      result = m ? JSON.parse(m[0]) : stub('JSON 파싱 오류');
    }

    return j(result);
  } catch (e) {
    return j(stub(e.message));
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: H });
}

function stub(msg) {
  return {
    verdict: '관망',
    verdictReason: msg,
    buyStrategy:  { zone: '-', timing: '-', split: [] },
    sellStrategy: { shortTarget: '-', midTarget: '-', stopLoss: '-', exitSignal: '-' },
    risks:        [msg],
    riskLevel:    '중간',
    riskScore:    50,
    scenarios: {
      bull: { price: '-', desc: '-' },
      base: { price: '-', desc: '-' },
      bear: { price: '-', desc: '-' },
    },
    watchPoints: ['환경변수 확인', '재배포 후 재시도', '종목 재검색'],
    summary: msg,
  };
}

function j(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: H });
}
