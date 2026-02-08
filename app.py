# ======================================================
# 필요 설치
# streamlit
# yfinance
# pandas
# numpy
# matplotlib
# scikit-learn
# beautifulsoup4
# textblob
# lxml
# html5lib
# ======================================================

import streamlit as st
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
import requests
from bs4 import BeautifulSoup
from textblob import TextBlob
import matplotlib

matplotlib.rcParams['font.family'] = 'Malgun Gothic'
matplotlib.rcParams['axes.unicode_minus'] = False

st.title("📈 AI 주식 분석 & 매수 타이밍 추천 (한국 + 미국)")

# ======================================================
# ✅ 한국 전체 종목 로딩
# ======================================================
@st.cache_data
def load_korea_tickers():
    url = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download"
    df = pd.read_html(url, encoding="cp949")[0]

    df["종목코드"] = df["종목코드"].astype(str).str.zfill(6)
    df["티커"] = df["종목코드"] + ".KS"

    df["검색용"] = df["회사명"].str.lower()

    return df[["회사명", "티커", "검색용"]]


tickers_df = load_korea_tickers()

# ======================================================
# 🔎 검색 UI (한국 + 미국)
# ======================================================
search = st.text_input(
    "🔎 종목 검색 (삼성, 카카오, apple, tesla, AAPL, TSLA 등)"
).lower()

ticker = None

if search:

    # 한국 검색
    filtered = tickers_df[tickers_df["검색용"].str.contains(search)]

    options = list(filtered["회사명"] + " (" + filtered["티커"] + ")")

    # 미국 티커 직접 입력 허용
    options.append(f"미국 직접 입력 → {search.upper()}")

    choice = st.selectbox("종목 선택", options)

    if "직접 입력" in choice:
        ticker = search.upper()
    else:
        ticker = choice.split("(")[-1].replace(")", "")

# ======================================================
# 분석 시작
# ======================================================
if ticker:

    st.info(f"선택 티커: {ticker}")

    # -------------------------
    # 데이터 다운로드
    # -------------------------
    df = yf.download(ticker, start="2015-01-01")

    if df.empty:
        st.error("❌ 데이터를 찾을 수 없습니다")
        st.stop()

    # -------------------------
    # 기술지표
    # -------------------------
    df["MA20"] = df["Close"].rolling(20).mean()
    df["MA60"] = df["Close"].rolling(60).mean()
    df = df.dropna()

    if len(df) < 30:
        st.error("❌ 데이터 부족")
        st.stop()

    # -------------------------
    # 머신러닝 예측
    # -------------------------
    df["Day"] = np.arange(len(df))

    X = df[["Day"]].values.astype(float)
    y = df["Close"].values.astype(float)

    model = LinearRegression()
    model.fit(X, y)

    future_days = 30
    future_X = np.arange(len(df), len(df)+future_days).reshape(-1,1)

    future_pred = model.predict(future_X)

    # ⭐⭐⭐ 항상 안전 변환
    pred_price = float(np.ravel(future_pred)[-1])

    current = float(df["Close"].iloc[-1])
    ma20 = float(df["MA20"].iloc[-1])
    ma60 = float(df["MA60"].iloc[-1])

    # -------------------------
    # 뉴스 감성 분석
    # -------------------------
    sentiment = 0

    try:
        url = f"https://finance.naver.com/search/news_search.nhn?query={search}"
        soup = BeautifulSoup(requests.get(url).text, "html.parser")
        news = soup.select(".title")[:5]
        if news:
            sentiment = np.mean([TextBlob(n.text).sentiment.polarity for n in news])
    except:
        sentiment = 0

    # -------------------------
    # 매수 가격 계산
    # -------------------------
    buy_low = ma60
    buy_high = ma20

    # -------------------------
    # AI 판단
    # -------------------------
    reasons = []

    if current < ma60:
        reasons.append("장기 지지선 근처 → 저평가")

    if pred_price > current:
        reasons.append("머신러닝 상승 예측")

    if sentiment > 0:
        reasons.append("뉴스 분위기 긍정")

    score = len(reasons)

    if score >= 2:
        opinion = "🔥 매수 추천"
    elif score == 1:
        opinion = "👍 분할 매수"
    else:
        opinion = "⚠️ 관망"

    # ======================================================
    # 결과 출력
    # ======================================================
    st.subheader("📊 분석 결과")

    st.write(f"현재가: {current:,.2f}")
    st.write(f"30일 예측가: {pred_price:,.2f}")

    st.subheader("💰 추천 매수 가격대")
    st.success(f"{buy_low:,.2f} ~ {buy_high:,.2f}")

    st.subheader("🤖 AI 의견")
    st.write(opinion)

    for r in reasons:
        st.write("•", r)

    # -------------------------
    # 그래프
    # -------------------------
    st.subheader("📈 차트")

    fig, ax = plt.subplots(figsize=(12,6))
    ax.plot(df.index, df["Close"], label="Price")
    ax.plot(df.index, df["MA20"], label="MA20")
    ax.plot(df.index, df["MA60"], label="MA60")
    ax.axhspan(buy_low, buy_high, alpha=0.2, label="Buy Zone")
    ax.legend()

    st.pyplot(fig)
