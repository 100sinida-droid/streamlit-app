# GitHub Pages 배포 가이드

## 📝 준비사항
- GitHub 계정
- Git 설치

## 🚀 배포 단계

### 1️⃣ GitHub 저장소 생성

1. GitHub.com 접속 후 로그인
2. 우측 상단 **+** 버튼 클릭 → **New repository** 선택
3. 저장소 정보 입력:
   - **Repository name**: `stockhub` (원하는 이름)
   - **Description**: "주식 정보 통합 플랫폼"
   - **Public** 선택
   - **Initialize this repository with a README** 체크 해제
4. **Create repository** 클릭

### 2️⃣ 로컬에서 Git 초기화 및 푸시

터미널에서 stockhub 폴더로 이동 후 다음 명령어 실행:

```bash
# Git 초기화
git init

# 파일 스테이징
git add .

# 커밋
git commit -m "Initial commit: StockHub 웹사이트"

# 원격 저장소 연결 (YOUR-USERNAME을 본인 GitHub 사용자명으로 변경)
git remote add origin https://github.com/YOUR-USERNAME/stockhub.git

# 메인 브랜치로 변경
git branch -M main

# 푸시
git push -u origin main
```

### 3️⃣ GitHub Pages 활성화

1. GitHub 저장소 페이지에서 **Settings** 탭 클릭
2. 좌측 메뉴에서 **Pages** 선택
3. **Source** 섹션:
   - Branch: `main` 선택
   - Folder: `/ (root)` 선택
4. **Save** 버튼 클릭
5. 잠시 기다리면 상단에 배포 URL이 표시됩니다
   - 예: `https://YOUR-USERNAME.github.io/stockhub`

### 4️⃣ 배포 완료 확인

- 3-5분 정도 기다린 후 배포 URL로 접속
- 웹사이트가 정상적으로 표시되는지 확인

## 🔄 업데이트 방법

파일을 수정한 후 다시 배포하려면:

```bash
# 변경사항 스테이징
git add .

# 커밋
git commit -m "업데이트 내용 설명"

# 푸시
git push
```

푸시 후 3-5분 내에 웹사이트가 자동으로 업데이트됩니다.

## ⚠️ 주의사항

1. **파일명 대소문자**: 파일명은 정확히 맞춰야 합니다
   - `index.html` (O)
   - `Index.html` (X)

2. **파일 구조**: 모든 파일이 같은 폴더에 있어야 합니다
   ```
   stockhub/
   ├── index.html
   ├── styles.css
   ├── script.js
   └── README.md
   ```

3. **캐시 문제**: 업데이트 후 변경사항이 보이지 않으면
   - 브라우저 강력 새로고침: `Ctrl + Shift + R` (Windows) 또는 `Cmd + Shift + R` (Mac)

## 🎯 커스텀 도메인 연결 (선택사항)

자신만의 도메인을 사용하려면:

1. 도메인 구매 (예: stockhub.com)
2. DNS 설정에서 CNAME 레코드 추가
   - Name: `www`
   - Value: `YOUR-USERNAME.github.io`
3. GitHub Pages 설정에서 Custom domain 입력
4. Enforce HTTPS 체크

## 📞 문제 해결

### 페이지가 표시되지 않을 때
1. Settings > Pages에서 배포 상태 확인
2. Actions 탭에서 빌드 로그 확인
3. 파일명과 경로가 정확한지 확인

### CSS나 JS가 로드되지 않을 때
1. 브라우저 개발자 도구 (F12) → Console 탭에서 오류 확인
2. 파일명 대소문자 확인
3. 경로가 올바른지 확인 (상대경로 사용)

---

## 📚 추가 자료

- [GitHub Pages 공식 문서](https://docs.github.com/en/pages)
- [Git 기초 명령어](https://git-scm.com/docs)
- [Markdown 가이드](https://www.markdownguide.org/)

궁금한 점이 있으면 GitHub Issues에 문의해주세요!
