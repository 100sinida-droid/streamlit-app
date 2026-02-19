#!/bin/bash
# =========================================================
# Cloudflare Worker 자동 배포 스크립트
# 5분 완성!
# =========================================================

echo "🚀 Cloudflare Worker 자동 배포 시작"
echo ""

# 1. Wrangler 설치
echo "📦 1/4 Wrangler CLI 설치 중..."
npm install -g wrangler 2>/dev/null || echo "이미 설치됨"

# 2. 로그인
echo ""
echo "🔐 2/4 Cloudflare 로그인..."
echo "   브라우저가 열리면 로그인하고 'Allow' 클릭하세요"
wrangler login

# 3. Worker 배포
echo ""
echo "🚀 3/4 Worker 배포 중..."
wrangler deploy cloudflare-worker-full.js --name krx-proxy --compatibility-date 2024-01-01

# 4. URL 출력
echo ""
echo "✅ 4/4 완료!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 다음 단계:"
echo ""
echo "1. Worker URL 확인:"
echo "   https://dash.cloudflare.com → Workers & Pages → krx-proxy"
echo ""
echo "2. realtime_api_full.js 파일 열기"
echo ""
echo "3. 첫 번째 줄 수정:"
echo "   const WORKER_URL = 'https://krx-proxy.YOUR-ID.workers.dev';"
echo "   을 본인 Worker URL로 변경"
echo ""
echo "4. GitHub에 업로드:"
echo "   git add realtime_api_full.js"
echo "   git commit -m 'Worker 연동'"
echo "   git push"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
