# ======================================================
# 설치 필요
# pip install streamlit yfinance pandas numpy matplotlib
# pip install scikit-learn beautifulsoup4 textblob lxml html5lib
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

st.title("📈 AI 주가 분석 & 매수 타이밍 추천 시스템")

# ======================================================
# ✅ 한국 종목 자동 불러오기
# ======================================================
@st.cache_data
def load_korea_tickers():
    url = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download"
    df = pd.read_html(url, encoding="cp949")[0]
    df["종목코드"] = df["종목코드"].astype(str).str.zfill(6)
    df["티커"] = df["종목코드"] + ".KS"
    return df[["회사명", "티커"]]

tickers_df = load_korea_tickers()

# ======================================================
# 🔎 종목 검색
# ======================================================
keyword = st.text_input("🔎 종목명 검색 (예: 삼성, 카카오, 현대차)")

selected_ticker = None

if keyword:
    filtered = tickers_df[tickers_df["회사명"].str.contains(keyword, case=False)]
    if not filtered.empty:
        option = st.selectbox(
            "종목 선택",
            filtered["회사명"] + " (" + filtered["티커"] + ")"
        )
        selected_ticker = option.split("(")[-1].replace(")", "")

# ======================================================
# ✅ AI 분석 함수
# ======================================================
def ai_opinion(current, ma20, ma60, pred, news_score):

    score = 0
    reasons = []

    if current < ma60:
        score += 2
        reasons.append("장기 지지선(MA60) 아래 → 과매도 구간")

    if current < ma20:
        score += 1
        reasons.append("단기 조정 구간")

    if pred > current:
        score += 1
        reasons.append("머신러닝 예측 상승 추세")

    if news_score > 0:
        score += 1
        reasons.append("최근 뉴스 긍정적")

    if score >= 3:
        action = "🔥 강력 매수"
    elif score == 2:
        action = "👍 분할 매수"
    else:
        action = "⚠️ 관망/보류"

    text = "\n".join([f"- {r}" for r in reasons])

    return action, text


# ======================================================
# 분석 시작
# ======================================================
if selected_ticker:

    df = yf.download(selected_ticker, start="2013-01-01")

    df["MA20"] = df["Close"].rolling(20).mean()
    df["MA60"] = df["Close"].rolling(60).mean()
    df = df.dropna()

    # ---------------------
    # ML 예측
    # ---------------------
    df["Day"] = np.arange(len(df))
    X = df[["Day"]]
    y = df["Close"]

    model = LinearRegression()
    model.fit(X, y)

    future_days = 30
    future_X = np.arange(len(df), len(df) + future_days).reshape(-1, 1)
    future_pred = model.predict(future_X)

    current_price = df["Close"].iloc[-1].item()
    ma20 = df["MA20"].iloc[-1].item()
    ma60 = df["MA60"].iloc[-1].item()

    # ======================================================
    # 뉴스 감성 분석
    # ======================================================
    url = f"https://finance.naver.com/search/news_search.nhn?query={keyword}"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    news_items = soup.select(".title")[:5]

    headlines = [n.get_text().strip() for n in news_items]

    news_score = 0
    if headlines:
        news_score = np.mean([TextBlob(h).sentiment.polarity for h in headlines])

    # ======================================================
    # 매수 가격 계산
    # ======================================================
    buy_low = ma60
    buy_high = ma20

    action, reason_text = ai_opinion(
        current_price, ma20, ma60, future_pred[-1], news_score
    )

    # ======================================================
    # 출력
    # ======================================================
    st.subheader("📊 분석 결과")

    st.write(f"현재가: {current_price:,.0f} 원")
    st.write(f"30일 예측가: {float(future_pred[-1]):,.0f} 원")

    st.subheader("💰 추천 매수 가격대")
    st.success(f"{buy_low:,.0f} ~ {buy_high:,.0f} 원")

    st.subheader("🤖 AI 종합 의견")
    st.write(action)
    st.write(reason_text)

    # ======================================================
    # 그래프
    # ======================================================
    st.subheader("📈 차트")

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(df.index, df["Close"], label="Price")
    ax.plot(df.index, df["MA20"], label="MA20")
    ax.plot(df.index, df["MA60"], label="MA60")

    future_index = pd.date_range(start=df.index[-1], periods=future_days)
    ax.plot(future_index, future_pred, linestyle="dashed", label="Prediction")

    ax.axhspan(buy_low, buy_high, alpha=0.15, label="Buy Zone")

    ax.legend()
    st.pyplot(fig)

