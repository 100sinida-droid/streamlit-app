# =====================================================
# requirements.txt
# =====================================================
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
# =====================================================

import streamlit as st
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
from bs4 import BeautifulSoup
from textblob import TextBlob
import requests
import datetime

plt.rcParams["font.family"] = "Malgun Gothic"

st.title("📈 AI 주식 자동 매수/매도 전략 추천기 (한국 + 미국)")

# =====================================================
# 한국 전체 종목
# =====================================================
@st.cache_data
def load_korea():
    url = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download"
    df = pd.read_html(url, encoding="cp949")[0]

    df["종목코드"] = df["종목코드"].astype(str).str.zfill(6)
    df["티커"] = df["종목코드"] + ".KS"
    df["검색"] = df["회사명"].str.lower()

    return df[["회사명", "티커", "검색"]]

krx = load_korea()

# =====================================================
# 검색
# =====================================================
search = st.text_input("🔎 종목 검색 (삼성, apple, tsla, aapl 등)").lower()

ticker = None

if search:
    f = krx[krx["검색"].str.contains(search)]
    options = list(f["회사명"] + " (" + f["티커"] + ")")
    options.append(f"미국 직접입력 → {search.upper()}")

    choice = st.selectbox("종목 선택", options)

    if "직접입력" in choice:
        ticker = search.upper()
    else:
        ticker = choice.split("(")[-1].replace(")", "")

# =====================================================
# 분석 시작
# =====================================================
if ticker:

    st.info(f"선택 티커: {ticker}")

    df = yf.download(ticker, period="5y")

    if df.empty:
        st.error("데이터 없음")
        st.stop()

    df["MA20"] = df["Close"].rolling(20).mean()
    df["MA60"] = df["Close"].rolling(60).mean()
    df = df.dropna()

    current = float(df["Close"].iloc[-1])
    ma20 = float(df["MA20"].iloc[-1])
    ma60 = float(df["MA60"].iloc[-1])

    # =====================================================
    # 머신러닝 예측
    # =====================================================
    df["Day"] = np.arange(len(df))
    X = df[["Day"]]
    y = df["Close"]

    model = LinearRegression()
    model.fit(X, y)

    future_X = np.arange(len(df), len(df)+30).reshape(-1,1)
    future_pred = model.predict(future_X)
    future_price = float(np.ravel(future_pred)[-1])

    # =====================================================
    # 뉴스 감성
    # =====================================================
    sentiment = 0
    try:
        url = f"https://finance.naver.com/search/news_search.nhn?query={search}"
        soup = BeautifulSoup(requests.get(url).text, "html.parser")
        titles = soup.select(".title")[:5]
        if titles:
            sentiment = np.mean([TextBlob(t.text).sentiment.polarity for t in titles])
    except:
        pass

    # =====================================================
    # 🔥 매매 전략 계산 핵심
    # =====================================================

    buy_low = ma60
    buy_high = ma20

    stop_loss = buy_low * 0.93
    take_profit = current * 1.20

    if future_price > take_profit:
        take_profit = future_price

    stop_pct = (stop_loss/current - 1) * 100
    take_pct = (take_profit/current - 1) * 100

    # 타이밍 예측
    if current > ma20:
        buy_time = "2~4주 조정 후 분할 매수"
    else:
        buy_time = "지금 분할 매수 가능"

    # =====================================================
    # AI 의견 생성
    # =====================================================
    reasons = []

    if current < ma60:
        reasons.append("장기 지지선 근처 저평가")

    if future_price > current:
        reasons.append("AI 상승 예측")

    if sentiment > 0:
        reasons.append("뉴스 분위기 긍정")

    if len(reasons) >= 2:
        final_opinion = "🔥 적극 매수"
    elif len(reasons) == 1:
        final_opinion = "👍 분할 매수"
    else:
        final_opinion = "⚠️ 관망"

    # =====================================================
    # 출력
    # =====================================================
    st.subheader("📊 현재 상태")

    st.write(f"현재가: {current:,.2f}")
    st.write(f"30일 예측가: {future_price:,.2f}")

    st.subheader("💰 매수 추천 가격")
    st.success(f"{buy_low:,.2f} ~ {buy_high:,.2f}")

    st.subheader("🕒 매수 시점")
    st.info(buy_time)

    st.subheader("🛑 손절 / 🎯 목표가")

    col1, col2 = st.columns(2)

    with col1:
        st.error(f"손절가: {stop_loss:,.2f} ({stop_pct:.1f}%)")

    with col2:
        st.success(f"목표가: {take_profit:,.2f} (+{take_pct:.1f}%)")

    st.subheader("🤖 AI 종합 의견")
    st.write(final_opinion)

    for r in reasons:
        st.write("•", r)

    # =====================================================
    # 차트
    # =====================================================
    st.subheader("📈 차트")

    fig, ax = plt.subplots(figsize=(12,6))

    ax.plot(df.index, df["Close"], label="Price")
    ax.plot(df.index, df["MA20"], label="MA20")
    ax.plot(df.index, df["MA60"], label="MA60")

    ax.axhspan(buy_low, buy_high, alpha=0.2, label="Buy Zone")

    ax.axhline(stop_loss, linestyle="--", label="Stop Loss")
    ax.axhline(take_profit, linestyle="--", label="Take Profit")

    ax.legend()

    st.pyplot(fig)
