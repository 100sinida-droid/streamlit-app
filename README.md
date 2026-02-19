# StockMind AI v4.0 — 배포 가이드

## 📌 v4 핵심 변경사항
- **한국 주식**: 네이버 금융 API (무료, 무제한, 실시간)
- **미국 주식**: FMP API (발급받은 키 `dInmlR5CcjKZghop5ePbE95FpacKzcBS` 내장)
- **CORS 완전 해결**: 모든 외부 API는 Cloudflare Function이 서버에서 호출
- 브라우저 → Cloudflare Function → 네이버/FMP 순서로 동작

## 파일 구조
```
stockai/
├── index.html
├── style.css
├── app.js                    ← 프론트엔드 (외부 API 직접 호출 없음)
└── functions/
    └── api/
        ├── stock.js          ← 주식 데이터 프록시 (네이버 + FMP)
        └── analyze.js        ← Claude AI 분석
```

## 배포 방법

### 1. GitHub 레포 업데이트 (기존 레포에 덮어쓰기)
```bash
# 기존 레포 폴더에서 v4 파일로 교체
cp stockai-v4/* . -r
git add .
git commit -m "v4: 네이버금융 + FMP, CORS 완전 해결"
git push
```
Cloudflare Pages가 자동으로 재배포됩니다.

### 2. AI 분석 활성화 (선택)
Cloudflare Pages → Settings → Environment variables:
- `ANTHROPIC_API_KEY` = `sk-ant-...`

## 데이터 소스
| 시장 | API | 제한 |
|------|-----|------|
| 코스피/코스닥 | 네이버 금융 | 무제한 |
| 미국 NYSE/NASDAQ | FMP API | 250콜/일 (무료) |

## ⚠️ 투자 주의사항
본 서비스는 정보 제공 목적이며, 투자 권유가 아닙니다.
