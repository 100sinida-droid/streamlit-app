// functions/api/analyze.js
// Claude AI 분석 엔드포인트
// 필요 환경변수: ANTHROPIC_API_KEY

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function onRequestPost({ env, request }) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return json({ error: 'prompt required' }, 400);

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) return json(noKeyResponse());

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        system: '당신은 전문 주식 애널리스트입니다. 반드시 순수 JSON만 응답하세요. 마크다운 코드블록(```), 설명 텍스트 없이 JSON 객체만 출력하세요.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const e = await claudeRes.text();
      return json(errorResponse('Claude API 오류: ' + e));
    }

    const cd = await claudeRes.json();
    const raw = cd.content?.[0]?.text || '{}';

    // JSON 추출
    const cleaned = raw.replace(/```json\s*/gi,'').replace(/```\s*/gi,'').trim();
    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      result = m ? JSON.parse(m[0]) : errorResponse('응답 파싱 실패');
    }

    return json(result);
  } catch (err) {
    return json(errorResponse(err.message));
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

function noKeyResponse() {
  return {
    verdict: '관망',
    verdictReason: 'ANTHROPIC_API_KEY가 설정되지 않았습니다. Cloudflare Pages › Settings › Environment variables에 키를 추가하면 AI 분석이 활성화됩니다.',
    buyStrategy: { zone: 'API 키 설정 필요', timing: '-', split: [] },
    sellStrategy: { shortTarget: '-', midTarget: '-', stopLoss: '-', exitSignal: '-' },
    risks: ['ANTHROPIC_API_KEY 환경변수 미설정'],
    riskLevel: '중간', riskScore: 50,
    scenarios: {
      bull: { price: '-', desc: 'API 키 설정 후 이용 가능' },
      base: { price: '-', desc: 'API 키 설정 후 이용 가능' },
      bear: { price: '-', desc: 'API 키 설정 후 이용 가능' },
    },
    watchPoints: ['Cloudflare Pages 환경변수 설정', 'ANTHROPIC_API_KEY 추가', '재배포 후 AI 분석 활성화'],
    summary: 'AI 분석은 API 키 설정 후 사용 가능합니다.',
  };
}

function errorResponse(msg) {
  return {
    verdict: '관망', verdictReason: msg,
    buyStrategy: { zone: '-', timing: '-', split: [] },
    sellStrategy: { shortTarget: '-', midTarget: '-', stopLoss: '-', exitSignal: '-' },
    risks: [msg], riskLevel: '중간', riskScore: 50,
    scenarios: {
      bull: { price: '-', desc: '분석 불가' },
      base: { price: '-', desc: '분석 불가' },
      bear: { price: '-', desc: '분석 불가' },
    },
    watchPoints: ['잠시 후 재시도', '종목명 다시 확인', '네트워크 연결 확인'],
    summary: msg,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}
