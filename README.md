# 📈 KRX AI 매매 전략 분석기

한국 주식시장 AI 기반 매매 전략 분석 도구

## 🎉 v2.0 - 한국 거래소 전체 상장 종목 지원!

### ✅ 주요 기능

- **1,824개 상장 종목** 검색 및 분석
- KOSPI 287개 + KOSDAQ 1,537개
- 실제 시장 가격 반영
- AI 기반 매매 전략 (MA20/MA60)
- 인터랙티브 차트

## 📊 데이터베이스 구조

### 분할 파일 시스템
GitHub 파일 크기 제한(20MB)으로 인해 데이터베이스를 4개로 분할:

```
stock_database_part1.json (12.1 MB) - 456개 종목
stock_database_part2.json ( 9.8 MB) - 456개 종목
stock_database_part3.json ( 9.8 MB) - 456개 종목
stock_database_part4.json ( 9.8 MB) - 456개 종목
─────────────────────────────────────────────
총 41.5 MB - 1,824개 종목
```

앱 실행 시 4개 파일을 자동으로 병합하여 사용합니다.

## 🚀 GitHub Pages 배포 방법

### 1. 저장소 생성
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/[username]/[repo].git
git push -u origin main
```

### 2. 필수 파일 확인
```
✓ index.html
✓ style.css
✓ app.js
✓ stock_database_part1.json (필수!)
✓ stock_database_part2.json (필수!)
✓ stock_database_part3.json (필수!)
✓ stock_database_part4.json (필수!)
✓ korea_stocks.js (선택)
```

### 3. GitHub Pages 활성화
1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: main / (root)
4. Save

### 4. 접속
`https://[username].github.io/[repo]/`

## 🔍 검색 가능한 종목

### 전체 1,824개 종목!

#### KOSPI (287개)
- 삼성전자, SK하이닉스, LG에너지솔루션
- 현대차, 기아, NAVER, 카카오
- 셀트리온, POSCO홀딩스, 삼성SDI
- KB금융, 신한지주, 하나금융지주
- **이건홀딩스, 이건산업** 등

#### KOSDAQ (1,537개)
- 에코프로비엠, 에코프로, 엘앤에프
- 알테오젠, 리노공업, 클래시스
- 엔씨소프트, 크래프톤, 펄어비스
- 하이브, JYP Ent., SM
- 카카오뱅크, 카카오페이 등

## 💰 가격대별 분포

```
저가주 (1만원 미만):    543개
중가주 (1만~10만원):  1,236개
고가주 (10만원 이상):    45개
```

## 📈 데이터 상세

- **주요 100개 종목**: 501일 (약 1.5년)
- **나머지 종목**: 251일 (약 8개월)
- **실제 현재가 반영**: 2025년 2월 기준
- **총 데이터 포인트**: 482,824개

## 🎯 AI 매매 전략

### 매수 추천가
- 20일 이동평균선의 98% 수준
- 단기 과매도 구간에서 반등 포착

### 손절가
- 변동성 기반 리스크 관리
- 매수가 대비 변동성의 3배 하락 시

### 목표가
- 매수가 대비 약 20% 상승
- 평균 회귀 + 기술적 저항선

## 🛠 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Chart**: Chart.js
- **Database**: JSON (분할 파일)
- **Analytics**: Google Tag Manager
- **Ads**: Google AdSense

## 📱 반응형 디자인

- 데스크톱, 태블릿, 모바일 최적화
- 터치 스크린 지원
- 크로스 브라우저 호환

## ⚙️ 로컬 테스트

```bash
# Python 서버
python -m http.server 8000

# Node.js 서버
npx http-server

# 접속
http://localhost:8000
```

## 🔧 문제 해결

### DB 로드 실패
```
⚠️ 증상: "데이터베이스를 로드할 수 없습니다"
✓ 해결: 4개 파일 모두 확인
  - stock_database_part1.json
  - stock_database_part2.json
  - stock_database_part3.json
  - stock_database_part4.json
```

### 종목이 검색되지 않음
```
⚠️ 증상: 검색 결과가 비어있음
✓ 해결: 브라우저 콘솔(F12)에서 DB 로드 확인
```

### GitHub Pages 404 오류
```
⚠️ 증상: 페이지를 찾을 수 없음
✓ 해결: 파일명 대소문자 확인 (index.html)
```

## 📊 성능 최적화

- **지연 로딩**: 사용자가 검색할 때만 데이터 로드
- **캐싱**: 한 번 로드된 DB는 메모리에 저장
- **압축**: JSON 파일 minify로 크기 최적화
- **분할**: 25MB 이하로 파일 분할

## ⚠️ 면책 조항

본 도구는 **교육 및 학습 목적**입니다.

- 제공되는 데이터는 샘플 데이터입니다
- 실제 투자 판단 자료로 사용하지 마세요
- 투자 책임은 투자자 본인에게 있습니다
- 실제 투자 시 증권사 공식 데이터 확인 필수

## 🔐 라이선스

MIT License

## 🙏 기여

Pull Request와 Issue는 언제나 환영합니다!

## 📞 문의

GitHub Issues를 통해 문의해주세요.

---

**Made with ❤️ for Korean Stock Traders**

**v2.0** - 전체 상장 종목 지원 (2025.02)
