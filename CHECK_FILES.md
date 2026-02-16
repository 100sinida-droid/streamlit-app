# 파일 체크리스트

## GitHub 저장소 확인사항

### 1. 모든 파일이 업로드되었나요?

루트 디렉토리에 다음 파일들이 있어야 합니다:

```
your-repo/
├── index.html
├── style.css
├── app.js
├── realtime_api.js
├── stock_database_part1.json
├── stock_database_part2.json
├── stock_database_part3.json
├── stock_database_part4.json
├── stock_database_part5.json
├── stock_database_part6.json
├── stock_database_part7.json
├── stock_database_part8.json
└── README.md
```

### 2. GitHub Pages 설정 확인

1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: **main** (또는 master)
4. Folder: **/ (root)**
5. Save 클릭

### 3. 파일 이름 대소문자 확인

❌ 틀린 예:
- Stock_Database_Part1.json (대문자)
- stock_database_Part1.json (중간 대문자)

✅ 올바른 예:
- stock_database_part1.json (모두 소문자)

### 4. 배포 URL 확인

배포 후 다음 URL들이 모두 접근 가능해야 합니다:

```
https://[username].github.io/[repo]/
https://[username].github.io/[repo]/stock_database_part1.json
https://[username].github.io/[repo]/stock_database_part2.json
... (part8까지)
```

브라우저에서 직접 접속해보세요!

### 5. 일반적인 문제들

#### 문제 1: 404 Not Found
→ 파일이 업로드 안됨 또는 파일명 오타

#### 문제 2: Unexpected token '<'
→ JSON 파일 대신 HTML 에러 페이지를 받음
→ GitHub Pages가 아직 배포 중이거나 설정 오류

#### 문제 3: CORS 오류
→ GitHub Pages가 아닌 다른 곳에 배포함
→ 로컬에서 file:// 프로토콜로 열었음

### 해결 방법

1. **GitHub 저장소 확인**
   - 13개 파일 모두 있는지 확인
   
2. **5-10분 대기**
   - GitHub Pages 배포에 시간 소요
   
3. **브라우저 캐시 삭제**
   - Ctrl + Shift + R (강력 새로고침)
   
4. **URL 직접 확인**
   ```
   https://[username].github.io/[repo]/stock_database_part1.json
   ```
   이 URL을 직접 열어서 JSON 데이터가 보이는지 확인

5. **개발자 도구 Network 탭 확인**
   - F12 → Network 탭
   - 실패한 파일들의 상태 코드 확인
   - 404: 파일 없음
   - 403: 권한 없음
   - 200: 정상

