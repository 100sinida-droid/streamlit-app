// functions/api/analyze.js
// Claude AI 분석 엔드포인트
// 환경변수: ANTHROPIC_API_KEY (Cloudflare Pages > Settings > Environment variables)

const H = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json().catch(()=>({}));
    const { prompt } = body;
    if (!prompt) return res({error:'prompt required'},400);

    const key = env.ANTHROPIC_API_KEY;
    if (!key) return res(stub('ANTHROPIC_API_KEY 환경변수를 설정해주세요'));

    const r = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key': key,
        'anthropic-version':'2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        system: '전문 주식 애널리스트입니다. 반드시 순수 JSON만 응답하세요. 마크다운 블록이나 설명 없이 JSON 객체만 출력하세요.',
        messages:[{role:'user',content:prompt}],
      }),
    });

    if (!r.ok) return res(stub('Claude API 오류: '+r.status));

    const cd  = await r.json();
    const raw = (cd.content?.[0]?.text||'{}')
                  .replace(/```json\s*/gi,'').replace(/```\s*/gi,'').trim();

    let result;
    try { result = JSON.parse(raw); }
    catch { const m=raw.match(/\{[\s\S]*\}/); result=m?JSON.parse(m[0]):stub('파싱 오류'); }

    return res(result);
  } catch(e) {
    return res(stub(e.message));
  }
}

export async function onRequestOptions() {
  return new Response(null,{headers:H});
}

function stub(msg) {
  return {
    verdict:'관망', verdictReason:msg,
    buyStrategy:{zone:'-',timing:'-',split:[]},
    sellStrategy:{shortTarget:'-',midTarget:'-',stopLoss:'-',exitSignal:'-'},
    risks:[msg], riskLevel:'중간', riskScore:50,
    scenarios:{
      bull:{price:'-',desc:'-'}, base:{price:'-',desc:'-'}, bear:{price:'-',desc:'-'},
    },
    watchPoints:['API 키 설정 확인','잠시 후 재시도','종목 재검색'],
    summary:msg,
  };
}

function res(data,status=200) {
  return new Response(JSON.stringify(data),{status,headers:H});
}
