# 📈 KRX AI 매매 전략 분석기

한국 주식시장 AI 기반 매매 전략 분석 도구

## 🚀 GitHub Pages 배포 방법

### 1. GitHub 저장소 생성
1. GitHub에서 새로운 저장소를 생성합니다
2. 저장소 이름은 원하는 대로 설정 (예: `krx-ai-analyzer`)

### 2. 파일 업로드
다음 파일들을 저장소에 업로드합니다:
- `index.html` - 메인 HTML 파일
- `style.css` - 스타일시트
- `app.js` - 메인 JavaScript 로직
- `korea_stocks.js` - 한국 주식 데이터 (300개 이상)
- `README.md` - 이 파일

### 3. GitHub Pages 활성화
1. 저장소 설정(Settings)으로 이동
2. 왼쪽 메뉴에서 "Pages" 선택
3. Source를 "Deploy from a branch"로 설정
4. Branch를 "main"으로 선택하고 폴더는 "/ (root)" 선택
5. Save 버튼 클릭

### 4. 배포 완료 ✅
- 몇 분 후 **`https://[your-username].github.io/[repository-name]/`** 주소로 접속 가능합니다

**예시:**
- GitHub 사용자명이 `john-doe`이고
- 저장소 이름이 `krx-ai-analyzer`라면
- 웹사이트 주소는: `https://john-doe.github.io/krx-ai-analyzer/`

### 5. 주소 확인 방법
Settings → Pages 페이지 상단에 **"Your site is live at ..."** 메시지와 함께 실제 주소가 표시됩니다.

## 📋 주요 기능

- ✅ **한국 거래소 전체 종목 300개 이상 지원** (KOSPI + KOSDAQ)
- ✅ **대소문자 구분 없는 스마트 검색** (한글/영문 모두 가능)
- ✅ 실시간 주가 데이터 분석 (Yahoo Finance API)
- ✅ AI 기반 매수/손절/목표가 자동 계산
- ✅ 이동평균선(MA20, MA60) 기반 전략
- ✅ 변동성 분석을 통한 리스크 관리
- ✅ 인터랙티브 차트 (Chart.js)
- ✅ 반응형 디자인 (모바일 완벽 지원)

## 🛠 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Chart Library**: Chart.js
- **Data Source**: Yahoo Finance API (CORS 프록시를 통한 안전한 접근)
- **Hosting**: GitHub Pages

## ⚙️ 기술적 특징

### 3단계 데이터 수집 시스템
1. **Yahoo Finance CSV 다운로드** (1순위)
   - 가장 안정적이고 빠른 방법
   - 3개 CORS 프록시 순차 시도
   
2. **Yahoo Finance API v8** (2순위)
   - JSON 기반 실시간 데이터
   - CSV 실패 시 자동 전환

3. **대체 금융 API** (3순위)
   - Twelve Data 등 무료 API
   - 최종 백업 데이터 소스

### CORS 문제 해결
- AllOrigins, CodeTabs, CorsProxy 등 다중 프록시
- 브라우저 보안 정책(CORS) 우회
- **실제 데이터만 사용** (샘플 데이터 없음)

### 스마트 검색
- 대소문자 구분 없음 (Samsung = SAMSUNG = samsung)
- 한글/영문/숫자 혼합 검색 가능
- 실시간 필터링

## 📊 분석 전략

### 매수 추천가
- 20일 이동평균선의 98% 수준
- 단기 과매도 반등 확률이 높은 지지구간

### 손절가
- 변동성 기반 리스크 관리
- 매수가 대비 변동성의 3배 하락 시 손절

### 목표가
- 매수가 대비 약 20% 상승 지점
- 평균 회귀 + 기술적 저항선 고려

## ⚠️ 주의사항

본 도구는 투자 참고용이며, 실제 투자 판단의 책임은 투자자 본인에게 있습니다.

- 과거 데이터 기반 분석으로 미래 수익을 보장하지 않습니다
- 실전 투자 전 충분한 검토가 필요합니다
- 손실 위험이 있으니 신중하게 투자하세요

## 🔧 커스터마이징

### 종목 추가
`korea_stocks.js` 파일에서 종목을 추가할 수 있습니다:

```javascript
{
    name: "종목명",
    ticker: "종목코드.KS", // KOSPI는 .KS, KOSDAQ는 .KQ
    search: "검색키워드 english korean"
}
```

### 전략 수정
`app.js` 파일의 `calculateStrategy()` 함수에서 전략 로직을 수정할 수 있습니다.

## 🐛 문제 해결 (Troubleshooting)

### "데이터를 가져오는 중 오류가 발생했습니다" 오류
**원인**: CORS (Cross-Origin Resource Sharing) 정책 또는 Yahoo Finance 서버 문제

**해결 방법**: 
이 애플리케이션은 **3단계 데이터 수집 시스템**을 사용합니다:

**1단계: Yahoo Finance CSV (가장 안정적)**
- 3개의 CORS 프록시를 순차 시도
- api.codetabs.com → corsproxy.io → allorigins.win

**2단계: Yahoo Finance API v8 (JSON 방식)**
- CSV가 실패하면 JSON API로 시도
- 더 빠르고 안정적인 응답

**3단계: 대체 금융 데이터 API**
- Twelve Data API 등 무료 금융 API
- 백업 데이터 소스

### 추가 해결 방법
1. **페이지 새로고침**: 브라우저 캐시 문제 해결
2. **다른 종목 시도**: 일부 종목은 데이터가 없을 수 있음
3. **잠시 후 재시도**: Yahoo Finance 서버 과부하 시
4. **브라우저 변경**: Chrome, Firefox, Edge 등
5. **GitHub Pages 사용**: 로컬보다 안정적

### 실제 데이터 확인 방법
브라우저 콘솔(F12)을 열어 다음 로그 확인:
```
✓ Yahoo Finance CSV 성공!
✓ 500일 데이터 로드 성공
```

### 특정 종목이 검색되지 않을 때
1. `korea_stocks.js` 파일에 해당 종목이 있는지 확인
2. 없다면 위의 "종목 추가" 방법으로 추가
3. Yahoo Finance에서 정확한 티커 코드 확인 (예: 이건홀딩스는 003010.KS)

### 차트가 표시되지 않을 때
- Chart.js CDN 로딩 확인
- 브라우저 콘솔에서 에러 메시지 확인
- 페이지 새로고침 시도

### 로컬에서 제대로 테스트하기
로컬 파일로는 CORS 문제가 발생합니다. 다음 방법 중 하나를 사용하세요:

**방법 1: Python 간단한 서버**
```bash
# Python 3
python -m http.server 8000

# 브라우저에서 http://localhost:8000 접속
```

**방법 2: VS Code Live Server**
- VS Code Extension "Live Server" 설치
- HTML 파일 우클릭 → "Open with Live Server"

**방법 3: GitHub Pages** (권장)
- GitHub에 업로드하면 CORS 문제 없이 작동

## 📝 라이선스

이 프로젝트는 개인 및 비상업적 용도로 자유롭게 사용 가능합니다.

## 🤝 기여

버그 리포트 및 기능 제안은 GitHub Issues를 통해 제출해주세요.

---

Made with ❤️ for Korean Stock Traders
