# 🎯 최종 해결책 - 5분 완성

## 현재 상황
- ❌ 브라우저 CORS 차단
- ❌ 모든 CORS 프록시 차단
- ✅ **유일한 해결책: Cloudflare Worker**

---

## 왜 Worker가 필요한가?

```
브라우저 → 네이버 API     ❌ CORS 차단
브라우저 → 프록시 → 네이버  ❌ 프록시도 차단
브라우저 → Worker → 네이버  ✅ 성공!
```

Worker는 **서버**이기 때문에 CORS 제한이 없습니다.

---

## 방법 1: 자동 스크립트 (Mac/Linux) ⭐ 가장 쉬움

### 전제조건
- Node.js 설치 (https://nodejs.org)

### 실행
```bash
chmod +x deploy.sh
./deploy.sh
```

### 결과
- 브라우저가 자동으로 열림
- Cloudflare 로그인
- "Allow" 클릭
- Worker 자동 배포!

---

## 방법 2: 수동 명령어 (Windows/Mac/Linux)

### STEP 1: Wrangler 설치
```bash
npm install -g wrangler
```

### STEP 2: 로그인
```bash
wrangler login
```
→ 브라우저가 열리면 로그인 → "Allow" 클릭

### STEP 3: Worker 배포
```bash
wrangler deploy cloudflare-worker-full.js --name krx-proxy --compatibility-date 2024-01-01
```

### STEP 4: URL 확인
배포 완료 후 출력:
```
Published krx-proxy
  https://krx-proxy.YOUR-ID.workers.dev
```

이 URL을 복사하세요!

---

## 방법 3: 웹 UI (Node.js 없어도 가능)

### STEP 1: Cloudflare 가입
https://dash.cloudflare.com/sign-up

### STEP 2: Worker 생성
1. Workers & Pages → Create application
2. Create Worker
3. 이름: `krx-proxy`
4. Deploy

### STEP 3: 코드 붙여넣기
1. Edit code 클릭
2. 기존 코드 전체 삭제
3. `cloudflare-worker-full.js` 내용 붙여넣기
4. Save and deploy

### STEP 4: URL 복사
상단에 표시된 URL 복사

---

## Worker 배포 후 앱 연결

### 1. realtime_api_full.js 수정
```javascript
// 1번 줄
const WORKER_URL = 'https://krx-proxy.YOUR-ID.workers.dev';

// 본인 Worker URL로 변경
const WORKER_URL = 'https://krx-proxy.abc123.workers.dev';
```

### 2. index.html 수정
```html
<!-- 현재 -->
<script src="app_realtime_only.js"></script>

<!-- 변경 -->
<script src="app.js"></script>
```

그리고 `app.js`가 `realtime_api_full.js`를 사용하도록 이미 설정되어 있습니다.

### 3. GitHub 업로드
```bash
git add realtime_api_full.js index.html app.js
git commit -m "Worker 연동"
git push
```

---

## 완료 후 확인

1. GitHub Pages 접속
2. "이건홀딩스" 검색
3. 선택 후 분석
4. **실제 가격 3,730원** 표시! ✅

---

## 비용

**완전 무료!**
- Cloudflare Workers 무료 플랜
- 하루 100,000건 무료
- 충분함

---

## 문제 해결

### "wrangler: command not found"
```bash
npm install -g wrangler
```

### "Worker URL을 모르겠어요"
https://dash.cloudflare.com → Workers & Pages → krx-proxy 클릭

### "여전히 에러"
F12 콘솔에서 에러 확인 → Worker URL이 올바른지 재확인

---

## 💡 왜 이렇게 복잡한가요?

브라우저 보안 정책(CORS) 때문입니다.
Worker는 이를 우회하는 **유일한 방법**입니다.

한 번만 설정하면 **영구적으로** 사용 가능합니다.

---

✅ **가장 쉬운 방법: deploy.sh 실행 (Mac/Linux)**
✅ **Windows: 수동 명령어 (STEP 1-4)**
✅ **모두 안되면: 웹 UI (방법 3)**

5분이면 완료됩니다!
