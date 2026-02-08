# ==============================
# 설치 필요
# pip install streamlit yfinance pandas numpy scikit-learn matplotlib requests beautifulsoup4 textblob
# ==============================

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

st.title("📈 국내/해외 주가 분석 & 뉴스 영향 예측")

# =========================================
# ✅ 한국 전체 종목 자동 다운로드 (KRX 공식)
# =========================================
@st.cache_data
def load_korea_tickers():
    url = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download"
    df = pd.read_html(url, encoding="cp949")[0]

    df["종목코드"] = df["종목코드"].astype(str).str.zfill(6)

    kospi = df.copy()
    kospi["티커"] = kospi["종목코드"] + ".KS"

    kosdaq = df.copy()
    kosdaq["티커"] = kosdaq["종목코드"] + ".KQ"

    result = pd.concat([kospi, kosdaq])[["회사명", "티커"]]
    return result

tickers_df = load_korea_tickers()

# =========================================
# ✅ 한글 검색 UI
# =========================================
keyword = st.text_input("🔎 종목명 검색 (예: 삼성, 카카오, 현대차)")

selected_ticker = None

if keyword:
    filtered = tickers_df[tickers_df["회사명"].str.contains(keyword, case=False)]

    if len(filtered) > 0:
        option = st.selectbox(
            "종목 선택",
            filtered["회사명"] + " (" + filtered["티커"] + ")"
        )

        selected_ticker = option.split("(")[-1].replace(")", "")

if selected_ticker:
    stock_input = selected_ticker

    try:
        df = yf.download(stock_input, start="2013-01-01")

        if df.empty:
            st.error("데이터 없음")
            st.stop()

        # ========================
        # 이동평균
        # ========================
        df["MA20"] = df["Close"].rolling(20).mean()
        df["MA60"] = df["Close"].rolling(60).mean()
        df = df.dropna()

        # ========================
        # 머신러닝 예측
        # ========================
        df["Day"] = np.arange(len(df))
        X = df[["Day"]]
        y = df["Close"]

        model = LinearRegression()
        model.fit(X, y)

        future_days = 30
        future_X = np.arange(len(df), len(df) + future_days).reshape(-1, 1)
        future_pred = model.predict(future_X)

        current_price = df["Close"].iloc[-1].item()
        support = df["MA60"].iloc[-1].item()
        resistance = df["MA20"].iloc[-1].item()

        # ========================
        # 결과 출력
        # ========================
        st.subheader("📊 분석 결과")
        st.write(f"현재 가격: {current_price:.2f} 원")
        st.write(f"30일 예상 가격: {future_pred[-1].item():.2f} 원")

        if current_price < support:
            st.success("🔥 강력 매수 구간")
        elif current_price < resistance:
            st.info("👍 분할 매수 구간")
        else:
            st.warning("⚠️ 고점 가능성")

        # ========================
        # 그래프
        # ========================
        st.subheader("📈 주가 그래프")

        fig, ax = plt.subplots(figsize=(12, 6))
        ax.plot(df.index, df["Close"], label="Price")
        ax.plot(df.index, df["MA20"], label="MA20")
        ax.plot(df.index, df["MA60"], label="MA60")

        future_index = pd.date_range(start=df.index[-1], periods=future_days)
        ax.plot(future_index, future_pred, linestyle="dashed", label="Prediction")

        ax.legend()
        st.pyplot(fig)

    except Exception as e:
        st.error(e)
