# 🚀 전체 종목 실시간 시스템 설정 가이드

## 📋 개요
코스피 + 코스닥 **전체 2,500개+ 종목**을 실시간으로 검색하고 분석할 수 있습니다.

**Cloudflare Worker 설정 필수** (10분 소요, 완전 무료)

---

## STEP 1: Cloudflare 가입 (2분)

1. https://cloudflare.com 접속
2. **Sign Up** 클릭
3. 이메일/비밀번호 입력하여 가입

---

## STEP 2: Worker 생성 (3분)

1. 로그인 후 왼쪽 메뉴에서 **Workers & Pages** 클릭
2. **Create application** 버튼 클릭
3. **Create Worker** 선택
4. Worker 이름 입력: `krx-proxy` (원하는 이름)
5. **Deploy** 클릭

---

## STEP 3: 코드 배포 (3분)

1. 생성된 Worker 페이지에서 **Edit code** 클릭
2. 왼쪽 에디터의 **기존 코드 전체 삭제**
3. `cloudflare-worker-full.js` 파일 내용 **전체 복사**
4. 에디터에 **붙여넣기**
5. 오른쪽 상단 **Save and Deploy** 클릭

---

## STEP 4: Worker URL 확인 (1분)

배포가 완료되면 다음과 같은 URL이 표시됩니다:

```
https://krx-proxy.abc123xyz.workers.dev
```

이 URL을 복사하세요!

---

## STEP 5: realtime_api_full.js 수정 (1분)

`realtime_api_full.js` 파일을 열고 **첫 번째 줄**을 수정:

```javascript
// 이것을
const WORKER_URL = 'https://krx-proxy.YOUR-ID.workers.dev';

// 본인의 Worker URL로 변경
const WORKER_URL = 'https://krx-proxy.abc123xyz.workers.dev';
```

---

## STEP 6: GitHub 업로드

수정된 파일들을 GitHub에 업로드:

```bash
git add realtime_api_full.js
git add index.html
git commit -m "전체 종목 실시간 연동"
git push
```

---

## ✅ 완료! 테스트 방법

### 1. Worker 테스트
브라우저에서 직접 접속:
```
https://krx-proxy.abc123xyz.workers.dev?action=list
```

**성공 시 결과:**
```json
{
  "total": 2547,
  "stocks": [
    {"code": "005930", "name": "삼성전자", "ticker": "005930.KS", "market": "KOSPI"},
    {"code": "003010", "name": "이건홀딩스", "ticker": "003010.KS", "market": "KOSPI"},
    ...
  ]
}
```

### 2. 앱에서 테스트
1. GitHub Pages 사이트 접속
2. "이건" 검색
3. **이건홀딩스, 이건산업** 나타남 ✅
4. 종목 선택 후 분석
5. **실시간 가격 표시** ✅

---

## 🎯 결과

```
✅ 전체 2,500개+ 종목 검색 가능
✅ 코스피 ~900개 + 코스닥 ~1,600개
✅ 실시간 가격 (네이버 금융 API)
✅ 실시간 차트 (최대 2년)
✅ 이건홀딩스, 이건산업 등 모든 종목
```

---

## ⚠️ Worker 미설정 시

Worker URL을 설정하지 않으면:
- ❌ 종목 목록 30개로 제한
- ❌ 가격이 DB 데이터 (부정확)
- ✅ 앱은 작동 (오프라인 모드)

**반드시 Worker를 설정해야 전체 기능 사용 가능!**

---

## 💰 비용

**완전 무료!**
- Cloudflare Workers 무료 플랜
- 하루 100,000건 요청 가능
- 충분히 사용 가능

---

## 🔧 문제 해결

### Worker 오류
→ Cloudflare 대시보드 → Workers → 해당 Worker → Logs 확인

### 종목 목록이 안 나옴
→ Worker URL이 올바른지 확인
→ `realtime_api_full.js` 첫 줄 재확인

### 가격이 이상함
→ F12 콘솔에서 "실시간 조회" 메시지 확인
→ Worker가 정상 작동하는지 확인

---

✅ **설정 완료 후 모든 한국 주식을 실시간으로 검색/분석 가능!**
