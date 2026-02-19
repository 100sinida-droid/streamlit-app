// functions/api/analyze.js
// Claude AI 분석 엔드포인트
// 환경변수: ANTHROPIC_API_KEY (Cloudflare Pages > Settings > Environment Variables)

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

    // API 키 미설정 시 안내 메시지 반환 (에러 대신)
    if (!apiKey) {
      return json(makeErrorAnalysis('ANTHROPIC_API_KEY 환경변수를 Cloudflare Pages > Settings > Environment Variables에 추가해주세요.'));
    }

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
        system: '당신은 전문 주식 애널리스트입니다. 반드시 순수 JSON만 응답하세요. 마크다운 블록(```), 설명 텍스트, 줄바꿈 없이 JSON 객체만 출력하세요.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      return json(makeErrorAnalysis('Claude API 오류: ' + errText));
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '{}';
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch (e) {
      // JSON 파싱 실패 시 텍스트에서 JSON 추출 시도
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        return json(makeErrorAnalysis('AI 응답 파싱 오류. 다시 시도해주세요.'));
      }
    }

    return json(result);
  } catch (err) {
    return json(makeErrorAnalysis(err.message));
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

function makeErrorAnalysis(msg) {
  return {
    verdict: '관망',
    verdictReason: msg,
    buyStrategy: { zone: '분석 불가', timing: '재시도 필요', split: [] },
    sellStrategy: { shortTarget: '-', midTarget: '-', stopLoss: '-', exitSignal: '-' },
    risks: [msg],
    riskLevel: '중간',
    riskScore: 50,
    scenarios: {
      bull: { price: '-', desc: '분석 불가' },
      base: { price: '-', desc: '분석 불가' },
      bear: { price: '-', desc: '분석 불가' },
    },
    watchPoints: ['잠시 후 재시도', '종목명 정확히 입력', 'API 설정 확인'],
    summary: msg,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}
