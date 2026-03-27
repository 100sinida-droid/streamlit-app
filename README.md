# StockMind - 주식 정보 통합 플랫폼

## 🚀 프로젝트 소개

한국과 미국 주식 정보를 한 곳에서 제공하는 통합 플랫폼입니다.

**사이트**: http://stockmind.kr

## ⚠️ 중요: 실시간 데이터 연동 한계

브라우저 기반 정적 웹사이트는 CORS 제한으로 인해 **실시간 API를 직접 호출할 수 없습니다**.

현재 구현:
- ✅ 전체 UI/UX 완성
- ✅ 검색/필터 기능 작동
- ✅ 네이버 금융 연동
- ⚠️ 데이터는 시뮬레이션 (실제 데이터 기반)

## 💡 실제 데이터 연동 방법

### 방법 1: 백엔드 서버 추가 (권장)
Node.js/Python 서버로 API를 중계하세요.

### 방법 2: Chrome Extension
CORS 없이 API 호출 가능

### 방법 3: 브라우저 Extension 설치
[CORS Unblock](https://chrome.google.com/webstore)

## 📦 파일 구조

- `index.html` - 메인 페이지
- `styles.css` - 스타일시트  
- `script.js` - JavaScript
- `README.md` - 문서

## 🎯 기능

1. **검색** - 한국/미국 주식 검색
2. **필터** - 시장/등락/정렬
3. **유튜브** - 투자 콘텐츠
4. **뉴스** - 최신 정보
5. **정보 페이지** - 4가지 정보 유형

## 📝 라이선스

MIT License
