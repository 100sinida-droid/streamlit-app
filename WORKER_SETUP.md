# ⚡ Cloudflare Worker 설정 가이드 (10분)

## 왜 필요한가?
브라우저 보안정책(CORS) 때문에 직접 주식 API 호출이 불가합니다.
Worker가 중간에서 대신 호출해줍니다. **완전 무료**입니다.

---

## STEP 1 - Cloudflare 가입 (2분)
1. https://cloudflare.com 접속
2. Sign Up → 이메일/비밀번호 입력 → 가입 완료

---

## STEP 2 - Worker 생성 (3분)
1. 로그인 후 좌측 **Workers & Pages** 클릭
2. **Create application** → **Create Worker** 클릭
3. Worker 이름: `krx-proxy` 입력
4. **Deploy** 클릭

---

## STEP 3 - 코드 붙여넣기 (2분)
1. 생성된 Worker → **Edit code** 클릭
2. 기존 코드 **전체 삭제**
3. `cloudflare-worker.js` 파일 내용 **전체 복사 → 붙여넣기**
4. **Save and Deploy** 클릭

---

## STEP 4 - URL 확인 후 설정 (2분)
배포 완료 후 Worker URL이 표시됩니다:
```
https://krx-proxy.abc123xy.workers.dev
```

`realtime_api.js` 파일 첫 줄 수정:
```javascript
// 이것을
const WORKER_URL = 'https://krx-proxy.YOUR-ID.workers.dev';

// 이렇게 변경 (본인 URL로)
const WORKER_URL = 'https://krx-proxy.abc123xy.workers.dev';
```

---

## STEP 5 - GitHub 재업로드 (1분)
수정된 `realtime_api.js` 파일만 GitHub에 다시 업로드

---

## ✅ 완료!
이제 앱에서 모든 코스피/코스닥 종목을 **실시간 가격**으로 조회합니다.

### 테스트 방법
브라우저에서 직접 접속:
```
https://krx-proxy.abc123xy.workers.dev?action=price&code=005930
```
삼성전자 실시간 가격 JSON이 보이면 성공!

---

## Worker가 없을 때 (자동 폴백)
Worker URL 미설정 시 자동으로 JSON DB 데이터를 사용합니다.
(가격은 부정확하지만 앱은 정상 작동)

