# 🚀 StockMind AI — 배포 가이드

실시간 주식 데이터 + Claude AI 분석 웹사이트

## 파일 구조

```
stockai/
├── index.html          — 메인 페이지
├── style.css           — 스타일시트
├── app.js              — 프론트엔드 로직 (Yahoo Finance API)
└── functions/
    └── api/
        └── analyze.js  — Cloudflare Function (Claude AI 호출)
```

## 배포 방법 (Cloudflare Pages)

### 1단계: GitHub 레포 생성
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/stockmind-ai.git
git push -u origin main
```

### 2단계: Cloudflare Pages 연결
1. [Cloudflare Dashboard](https://dash.cloudflare.com) 접속
2. **Pages** → **Create a project** → **Connect to Git**
3. GitHub 레포 선택
4. Build settings: 모두 비워두기 (정적 사이트)
5. **Save and Deploy**

### 3단계: API 키 설정
1. Pages 프로젝트 → **Settings** → **Environment variables**
2. **Add variable**:
   - Variable name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-xxxxx...` (Anthropic Console에서 발급)
3. **Save** 후 **Redeploy**

## 사용하는 API

| API | 용도 | 비용 |
|-----|------|------|
| Yahoo Finance | 실시간 주가, 차트 | 무료 |
| allorigins.win | CORS 프록시 | 무료 |
| Anthropic Claude | AI 분석 | 유료 (사용량 기반) |

## 검색 방법

- **한국어**: 삼성전자, 카카오, 현대차, SK하이닉스...
- **영문**: Samsung, Kakao, Apple, Tesla...
- **티커**: 005930.KS, 035420.KS, AAPL, TSLA, NVDA...
- **숫자**: 005930, 035420 (자동으로 .KS 추가)

## 지원 시장

- 🇰🇷 **KOSPI** (코스피) — .KS 티커
- 🇰🇷 **KOSDAQ** (코스닥) — .KQ 티커
- 🇺🇸 **NASDAQ / NYSE** (미국 주식)

## 주의사항

> 본 서비스는 정보 제공 목적이며, 투자 권유가 아닙니다.
> 모든 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
