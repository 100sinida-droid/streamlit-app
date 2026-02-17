# 🚀 Cloudflare Worker 설정 가이드

## 왜 필요한가요?
브라우저에서 직접 네이버/KRX API를 호출하면 **CORS 오류**가 발생합니다.
Cloudflare Worker가 **중간에서 대신** API를 호출해줍니다.

## 비용
✅ **완전 무료** (하루 100,000건 요청)
✅ 서버 불필요
✅ 설정 10분이면 완료

---

## 설정 방법 (10분)

### 1단계: Cloudflare 가입
1. https://cloudflare.com 접속
2. "Sign Up" 클릭
3. 이메일/비밀번호 입력

### 2단계: Worker 생성
1. 로그인 후 좌측 메뉴 **"Workers & Pages"** 클릭
2. **"Create application"** 클릭
3. **"Create Worker"** 클릭
4. Worker 이름 입력 (예: `krx-proxy`)
5. **"Deploy"** 클릭

### 3단계: 코드 붙여넣기
1. 생성된 Worker에서 **"Edit code"** 클릭
2. 기존 코드 모두 삭제
3. `cloudflare-worker.js` 파일 내용 전체 복사/붙여넣기
4. **"Save and Deploy"** 클릭

### 4단계: Worker URL 확인
배포 후 URL이 표시됩니다:
```
https://krx-proxy.YOUR-ID.workers.dev
```

### 5단계: realtime_api.js 수정
`realtime_api.js` 파일 첫 번째 줄 수정:
```javascript
// 이 줄을 찾아서
const WORKER_URL = 'https://krx-proxy.YOUR-ID.workers.dev';

// 본인 URL로 변경
const WORKER_URL = 'https://krx-proxy.abc123.workers.dev';
```

### 6단계: GitHub에 업로드
수정된 `realtime_api.js`를 GitHub에 다시 업로드

---

## 테스트 방법

Worker 배포 후 브라우저에서 직접 접속:
```
https://krx-proxy.YOUR-ID.workers.dev?code=005930&type=price
```

결과 예시:
```json
{
  "code": "005930",
  "name": "삼성전자",
  "price": 181200,
  "change": 1200,
  "changePercent": 0.67,
  "open": 180000,
  "high": 182000,
  "low": 179500,
  "volume": 15234567
}
```

---

## 작동 방식

```
[사용자 브라우저]
      ↓ 종목 선택
[realtime_api.js]
      ↓ Worker URL 호출
[Cloudflare Worker] ← 중간 서버 (무료)
      ↓ 네이버 금융 API 호출
[m.stock.naver.com]
      ↓ 실시간 주가 데이터
[Cloudflare Worker]
      ↓ CORS 헤더 추가
[realtime_api.js]
      ↓ 화면 업데이트
[사용자 브라우저]
```

---

## 문제 해결

### Worker 오류 시
- Worker 대시보드 → "Logs" 탭에서 오류 확인

### CORS 오류 지속 시
- Worker URL이 올바른지 확인
- `realtime_api.js`의 WORKER_URL 재확인

---

✅ **완료하면 모든 종목이 실시간 가격으로 업데이트됩니다!**
