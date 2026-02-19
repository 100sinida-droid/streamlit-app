# 🚀 StockMind AI v3.0 — 완전 작동 가이드

## ❗ 왜 v3인가?
- v1, v2: `allorigins.win` CORS 프록시 → Cloudflare Pages에서 차단
- v3: **Financial Modeling Prep (FMP) API** 사용 → CORS 완전 허용, 브라우저 직접 호출

---

## 📋 파일 구조
```
stockai/
├── index.html
├── style.css
├── app.js                  ← FMP API (브라우저 직접 호출)
└── functions/
    └── api/
        └── analyze.js      ← Claude AI (Cloudflare Function)
```

---

## ⚡ 1단계: FMP API 키 발급 (필수 — 5분)

1. https://site.financialmodelingprep.com/register 접속
2. 무료 회원가입
3. 대시보드 → **API Key** 복사
4. `app.js` 파일 3번째 줄 수정:
   ```js
   const FMP_KEY = 'YOUR_KEY_HERE'; // ← 여기에 붙여넣기
   ```

> **무료 플랜**: 250 API콜/일, 실시간 미국+한국 주식 지원  
> **유료 플랜**: 제한 없음 (월 $19~)

---

## ⚡ 2단계: GitHub 배포

```bash
git init
git add .
git commit -m "StockMind AI v3 - FMP API"
git remote add origin https://github.com/YOUR_ID/stockmind.git
git push -u origin main
```

---

## ⚡ 3단계: Cloudflare Pages 설정

1. https://dash.cloudflare.com → **Pages** → Create a project
2. Connect to Git → 레포 선택
3. Build settings: **모두 비워두기**
4. Save and Deploy

---

## ⚡ 4단계: AI 기능 활성화 (선택)

1. Pages 프로젝트 → **Settings** → **Environment variables**
2. **Add variable**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (https://console.anthropic.com 에서 발급)
3. Save → **Redeploy**

> AI 없이도 실시간 주식 데이터 조회는 정상 작동

---

## 🔍 검색 방법

| 입력 | 결과 |
|------|------|
| 삼성전자 | 005930.KS |
| 삼성 | 005930.KS |
| 하이닉스 | 000660.KS |
| 카카오 | 035720.KS |
| 005930 | 005930.KS |
| AAPL | Apple Inc |
| Tesla | TSLA |
| 엔비디아 | NVDA |
| 이건홀딩스 | 015360.KS |

---

## ✅ 지원 시장
- 🇰🇷 KOSPI (코스피) — .KS 티커
- 🇰🇷 KOSDAQ (코스닥) — .KQ 티커  
- 🇺🇸 NYSE, NASDAQ (미국 전체)

## ⚠️ 투자 주의사항
본 서비스는 정보 제공 목적이며, 투자 권유가 아닙니다.
모든 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
