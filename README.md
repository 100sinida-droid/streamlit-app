# StockHub - 주식 정보 통합 플랫폼

투자자를 위한 올인원 주식 정보 플랫폼

![StockHub Banner](https://via.placeholder.com/1200x400/028090/FFFFFF?text=StockHub)

## 🚀 프로젝트 소개

StockHub는 한국과 미국 주식 정보를 한 곳에서 제공하는 통합 플랫폼입니다. 실시간 시세, 재무 정보, 차트 분석부터 유튜브 투자 콘텐츠까지 투자에 필요한 모든 정보를 제공합니다.

## ✨ 주요 기능

### 📊 통합 주식 검색
- 한국(코스피/코스닥)과 미국(나스닥/NYSE) 주식 통합 검색
- 종목명, 코드, 키워드로 빠른 검색
- 시가총액, PER, 배당률 등 고급 필터 기능

### 💹 실시간 정보 제공
- **실시간 시세**: 현재가, 변동률, 거래량
- **재무 분석**: PER, PBR, EPS, ROE, 배당수익률
- **차트 분석**: 캔들차트, 이동평균선, 기술적 지표
- **뉴스 & 공시**: 실시간 관련 뉴스 및 공시 정보

### 🎬 유튜브 콘텐츠 통합
- 인기 투자 유튜브 채널 연동 (100+ 채널)
- 자동 카테고리 분류 (시황분석/종목분석/차트분석/초보가이드)
- 종목별 관련 영상 추천

### 🌍 지원 시장
- **한국**: 코스피(800+ 종목), 코스닥(1,500+ 종목)
- **미국**: 나스닥(3,000+ 종목), NYSE(2,400+ 종목)

## 🛠️ 기술 스택

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- 반응형 웹 디자인
- CSS 애니메이션 및 트랜지션

### Fonts
- Outfit (Display Font)
- JetBrains Mono (Monospace Font)

### 배포
- GitHub Pages

## 📦 설치 및 실행

### 로컬 실행

1. 저장소 클론
```bash
git clone https://github.com/yourusername/stockhub.git
cd stockhub
```

2. 로컬 서버 실행 (선택사항)
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server
```

3. 브라우저에서 접속
```
http://localhost:8000
```

### GitHub Pages 배포

1. GitHub 저장소 생성
2. 코드 푸시
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

3. Settings > Pages에서 배포 설정
   - Source: `main` branch
   - Folder: `/ (root)`

4. 배포 완료 후 접속
```
https://yourusername.github.io/stockhub
```

## 📁 프로젝트 구조

```
stockhub/
├── index.html          # 메인 페이지
├── styles.css          # 스타일시트
├── script.js           # JavaScript
└── README.md           # 프로젝트 문서
```

## 🎨 디자인 컨셉

### 컬러 팔레트
- **Primary**: #028090 (청록색)
- **Secondary**: #00A896 (시포엄 그린)
- **Accent**: #02C39A (민트)
- **Success**: #10B981 (초록)
- **Danger**: #EF4444 (빨강)

### 타이포그래피
- **Display Font**: Outfit (800/700/600/400/300 weights)
- **Monospace Font**: JetBrains Mono (600/500/400 weights)

## 🔄 향후 개발 계획

### Phase 1 (1-2개월)
- [ ] 프로토타입 완성
- [ ] 기본 검색 기능 구현
- [ ] 한국 주식 데이터 연동

### Phase 2 (3-4개월)
- [ ] 미국 주식 추가
- [ ] 차트 분석 기능
- [ ] YouTube API 연동

### Phase 3 (5-6개월)
- [ ] 모바일 앱 개발
- [ ] 알림 기능
- [ ] AI 추천 시스템

### Phase 4 (7개월~)
- [ ] 정식 런칭
- [ ] 사용자 피드백 반영
- [ ] 기능 고도화

## 🤝 기여하기

기여를 환영합니다! 다음 단계를 따라주세요:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📧 문의

프로젝트 관련 문의: contact@stockhub.com

---

**StockHub** - 투자자를 위한 원스톱 주식 정보 플랫폼 © 2026
