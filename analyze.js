// functions/api/analyze.js
// Cloudflare Pages Function — Claude AI 분석 엔드포인트
// API 키는 Cloudflare Dashboard > Pages > Settings > Environment Variables에 저장

export async function onRequestPost(context) {
  const { env, request } = context;

  // CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt required' }), {
        status: 400, headers: corsHeaders
      });
    }

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({
        verdict: '관망',
        verdictReason: 'AI API 키가 설정되지 않았습니다. Cloudflare Pages 환경 변수에 ANTHROPIC_API_KEY를 추가하세요.',
        buyStrategy: { zone: 'N/A', timing: 'API 키 설정 필요', split: [] },
        sellStrategy: { shortTarget: 'N/A', midTarget: 'N/A', stopLoss: 'N/A', exitSignal: 'N/A' },
        risks: ['ANTHROPIC_API_KEY 환경 변수 미설정'],
        riskLevel: '중간',
        riskScore: 50,
        scenarios: {
          bull: { price: 'N/A', desc: 'API 키 설정 후 이용 가능' },
          base: { price: 'N/A', desc: 'API 키 설정 후 이용 가능' },
          bear: { price: 'N/A', desc: 'API 키 설정 후 이용 가능' },
        },
        watchPoints: ['Cloudflare Pages 설정 확인', 'ANTHROPIC_API_KEY 환경변수 추가', 'Pages 재배포'],
        summary: 'Cloudflare Pages > Settings > Environment Variables에 ANTHROPIC_API_KEY를 추가하면 AI 분석이 활성화됩니다.'
      }), { status: 200, headers: corsHeaders });
    }

    // Claude API 호출
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
        system: '당신은 전문 주식 애널리스트입니다. 요청된 JSON 형식으로만 응답하고, 다른 텍스트는 포함하지 마세요.',
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error('Claude API error: ' + errText);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '{}';

    // JSON 파싱 (```json 블록 제거)
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(cleaned);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (err) {
    return new Response(JSON.stringify({
      verdict: '관망',
      verdictReason: '분석 중 오류가 발생했습니다: ' + err.message,
      buyStrategy: { zone: 'N/A', timing: '재시도 필요', split: [] },
      sellStrategy: { shortTarget: 'N/A', midTarget: 'N/A', stopLoss: 'N/A', exitSignal: 'N/A' },
      risks: [err.message],
      riskLevel: '중간',
      riskScore: 50,
      scenarios: {
        bull: { price: 'N/A', desc: '오류로 분석 불가' },
        base: { price: 'N/A', desc: '오류로 분석 불가' },
        bear: { price: 'N/A', desc: '오류로 분석 불가' },
      },
      watchPoints: ['오류 로그 확인', '네트워크 연결 확인', '잠시 후 재시도'],
      summary: '일시적 오류입니다. 잠시 후 다시 시도해주세요.',
    }), { status: 200, headers: corsHeaders });
  }
}

// OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
