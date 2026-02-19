# StockMind AI — 최종 배포 가이드

## 🔧 이번 버전 핵심 변경사항

| 이전 버전 문제 | 최종 해결책 |
|---|---|
| Cloudflare Function → HTML 반환 (JSON 오류) | 주식 데이터는 Function 없이 직접 처리 |
| FMP 한국 주식 403 오류 | 한국 주식은 네이버 금융 + corsproxy.io |
| allorigins.win CORS 차단 | corsproxy.io 사용 (더 안정적) |
| 디자인 깨짐 | CSS 완전 재작성 |

## 📁 파일 목록

```
📦 stockai-final/
├── index.html                  ← 메인 페이지
├── style.css                   ← 스타일 (원본 디자인 복원)
├── app.js                      ← 주식 데이터 + 차트 (Function 불필요)
└── functions/
    └── api/
        └── analyze.js          ← Claude AI (Cloudflare Function)
```

## 🚀 GitHub 배포 (기존 레포 덮어쓰기)

```bash
# 기존 레포 폴더에서 실행
git add .
git commit -m "final: 네이버금융+FMP, CORS 완전 해결"
git push
```

## 📌 Cloudflare Pages 주의사항

**Build settings 모두 비워두기!**
- Framework preset: None
- Build command: (비워두기)
- Build output directory: (비워두기)
- Root directory: (비워두기)

## 🤖 AI 분석 활성화

Cloudflare Pages → Settings → Environment variables:
- Name: `ANTHROPIC_API_KEY`
- Value: `sk-ant-api03-...`

> AI 없어도 실시간 주식 데이터는 정상 작동합니다.

## 🔍 검색 지원

**한국 주식** (네이버 금융 — 무료·무제한)
- 삼성전자, 카카오, 네이버, SK하이닉스 등
- 종목코드: 005930, 035420 등
- 영문: Samsung, Kakao 등

**미국 주식** (FMP API)
- Apple, NVDA, Tesla, Microsoft 등
- 티커: AAPL, NVDA, TSLA, MSFT 등

## ⚠️ 투자 유의사항
본 서비스는 정보 제공 목적이며, 투자 권유가 아닙니다.
