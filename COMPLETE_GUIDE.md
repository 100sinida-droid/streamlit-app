# 🎯 완전한 실제 데이터 시스템 - 전체 가이드

## 최종 결과 미리보기

```
✅ "이건" 검색 → 이건홀딩스, 이건산업 나옴 (2,500개 중)
✅ 종목 선택 → 실제 가격 3,675원 표시
✅ 차트 → 실제 500일 데이터
✅ AI 분석 → 실시간 가격 기반 매매 전략
```

---

## 📋 전체 흐름

```
1. Python 스크립트 실행 (로컬)
   ↓
2. 실제 데이터 생성 (2개 JSON 파일)
   - stock_list.json (2,500개 종목 목록)
   - stock_database_real.json (100개 실시간 데이터)
   ↓
3. GitHub에 업로드
   ↓
4. 웹페이지가 JSON 파일 읽음
   ↓
5. 실제 데이터로 분석/차트 표시!
```

---

## STEP 1: Python으로 실제 데이터 생성 (5분)

### 1-1. Python 설치 (없으면)
```bash
# Mac
brew install python3

# Windows
https://python.org 다운로드

# Linux
sudo apt install python3
```

### 1-2. 필수 패키지 설치
```bash
pip install requests
```

### 1-3. 스크립트 실행
```bash
python3 fetch_real_data.py
```

### 1-4. 결과 확인
실행 완료 후 2개 파일 생성됨:
```
✅ stock_list.json (2,500개+ 종목 목록)
✅ stock_database_real.json (100개 실시간 데이터)
```

**예시 출력:**
```
📡 전체 종목 목록 크롤링 시작...

KOSPI 크롤링 중...
  페이지 1: 30개 종목
  페이지 2: 30개 종목
  ...
  
KOSDAQ 크롤링 중...
  페이지 1: 30개 종목
  ...

✅ 총 2,547개 종목 수집 완료

📊 주요 100개 종목 실시간 데이터 수집 중...

[1/100] 삼성전자 (005930)... ✅ 181,200원 (501일)
[2/100] 이건홀딩스 (003010)... ✅ 3,675원 (501일)
[3/100] SK하이닉스 (000660)... ✅ 887,000원 (501일)
...

✅ stock_database_real.json 저장 완료 (100개 종목)
```

---

## STEP 2: GitHub에 파일 업로드 (2분)

### 2-1. 생성된 파일 확인
```bash
ls -lh *.json
```

다음 파일들이 있어야 함:
- stock_list.json (~300KB)
- stock_database_real.json (~20MB)

### 2-2. Git에 추가
```bash
git add stock_list.json
git add stock_database_real.json
git add app_with_real_data.js
git add index.html
```

### 2-3. 커밋 & 푸시
```bash
git commit -m "실제 주식 데이터 추가"
git push origin main
```

---

## STEP 3: index.html 수정 (1분)

`index.html`에서 스크립트를 새 파일로 변경:

```html
<!-- 기존 -->
<script src="app.js"></script>

<!-- 변경 -->
<script src="app_with_real_data.js"></script>
```

저장 후:
```bash
git add index.html
git commit -m "실제 데이터 연동"
git push
```

---

## STEP 4: GitHub Pages 확인 (1분)

1. GitHub Pages 사이트 접속
2. "이건" 검색
3. **이건홀딩스, 이건산업** 나타남 ✅
4. 이건홀딩스 선택 후 분석
5. **실제 가격 3,675원** 표시 ✅
6. **실제 차트 데이터** 표시 ✅

---

## 🎯 전체 파일 구조

```
your-repo/
├── index.html                      (수정: app_with_real_data.js 사용)
├── style.css                       (그대로)
├── app_with_real_data.js          (신규: 실제 데이터 읽는 코드)
├── stock_list.json                (신규: Python으로 생성)
├── stock_database_real.json       (신규: Python으로 생성)
├── fetch_real_data.py             (참고: 로컬에서만 실행)
└── .github/
    └── workflows/
        └── update-stock-data.yml  (선택: 자동 업데이트)
```

---

## 🔄 매일 자동 업데이트 (선택)

### GitHub Actions 설정

`.github/workflows/update-stock-data.yml` 생성:

```yaml
name: Update Stock Data

on:
  schedule:
    - cron: '0 0 * * *'  # 매일 자정 KST
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: pip install requests
      
      - name: Fetch real stock data
        run: python3 fetch_real_data.py
      
      - name: Commit and push
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add stock_list.json stock_database_real.json
          git commit -m "자동 업데이트: $(date +'%Y-%m-%d')" || exit 0
          git push
```

이제 **매일 자정에 자동으로 실제 데이터가 업데이트**됩니다!

---

## ✅ 최종 확인 체크리스트

### 로컬 (Python 실행)
- [ ] Python 설치됨
- [ ] `pip install requests` 완료
- [ ] `python3 fetch_real_data.py` 실행
- [ ] `stock_list.json` 생성됨
- [ ] `stock_database_real.json` 생성됨

### GitHub
- [ ] `stock_list.json` 업로드됨
- [ ] `stock_database_real.json` 업로드됨
- [ ] `app_with_real_data.js` 업로드됨
- [ ] `index.html`이 `app_with_real_data.js` 사용

### 웹페이지
- [ ] "이건" 검색 시 이건홀딩스 나옴
- [ ] 이건홀딩스 선택 시 실제 가격 표시
- [ ] 차트에 실제 데이터 표시
- [ ] AI 분석 결과 표시

---

## 💡 주요 특징

### ✅ 장점
- **완전 실제 데이터** (네이버 금융 API)
- **Worker 불필요** (Python만)
- **CORS 문제 없음** (서버 사이드)
- **무료** (API 키 불필요)
- **자동화 가능** (GitHub Actions)
- **2,500개+ 전체 종목**

### ⚠️ 제한사항
- Python 스크립트를 주기적으로 실행해야 함
- GitHub Actions 설정 시 매일 자동 가능
- 100개 종목만 실시간 데이터 (더 필요하면 스크립트 수정)

---

## 🔧 문제 해결

### "데이터를 불러올 수 없습니다"
→ `stock_list.json`, `stock_database_real.json` 파일이 GitHub에 있는지 확인

### "Python 스크립트 오류"
→ `pip install requests` 실행했는지 확인

### "종목이 안 나옴"
→ F12 콘솔에서 에러 확인, JSON 파일 경로 확인

### "가격이 0원"
→ Python 스크립트 재실행, 네트워크 확인

---

## 📊 더 많은 종목 추가

`fetch_real_data.py` 수정:

```python
# 100개 → 500개
for i, stock in enumerate(stock_list[:500], 1):
```

---

✅ **이제 완전한 실제 데이터 시스템입니다!**

Python 스크립트만 실행하면 바로 사용 가능합니다.
