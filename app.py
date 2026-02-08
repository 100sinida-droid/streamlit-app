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

st.title("📈 AI 주가 분석 & 매수 타이밍 추천")

# ======================================================
# 한국 종목 로딩
# ======================================================
@st.cache_data
def load_korea_tickers():
    url = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download"
    df = pd.read_html(url, encoding="cp949")[0]
    df["종목코드"] = df["종목코드"].astype(str).str.zfill(6)
    df["티커"] = df["종목코드"] + ".KS"
    return df[["회사명", "티커"]]

tickers_df = load_korea_tickers()

keyword = st.text_input("🔎 종목 검색")

if keyword:
    filtered = tickers_df[tickers_df["회사명"].str.contains(keyword)]
    if not filtered.empty:
        option = st.selectbox("종목 선택",
                              filtered["회사명"] + " (" + filtered["티커"] + ")")
        ticker = option.split("(")[-1].replace(")", "")

        # ======================================================
        # 데이터 다운로드
        # ======================================================
        df = yf.download(ticker, start="2013-01-01")

        if df.empty:
            st.error("❌ 주가 데이터 없음")
            st.stop()

        # ======================================================
        # 지표 계산
        # ======================================================
        df["MA20"] = df["Close"].rolling(20).mean()
        df["MA60"] = df["Close"].rolling(60).mean()
        df = df.dropna()

        # 🔥 안정성 체크 추가
        if len(df) < 30:
            st.error("❌ 데이터 부족 (상장 기간 짧음)")
            st.stop()

        # ======================================================
        # ML 학습 안정 처리 ⭐⭐⭐
        # ======================================================
        df["Day"] = np.arange(len(df))

        X = df[["Day"]].values.astype(float)
        y = df["Close"].values.astype(float)

        model = LinearRegression()
        model.fit(X, y)

        future_days = 30
        future_X = np.arange(len(df), len(df)+future_days).reshape(-1,1)

        future_pred = model.predict(future_X)

        current_price = float(df["Close"].iloc[-1])
        ma20 = float(df["MA20"].iloc[-1])
        ma60 = float(df["MA60"].iloc[-1])
        pred_price = float(np.ravel(future_pred)[-1])

        # ======================================================
        # 매수 가격
        # ======================================================
        buy_low = ma60
        buy_high = ma20

        # ======================================================
        # 뉴스 감성
        # ======================================================
        try:
            url = f"https://finance.naver.com/search/news_search.nhn?query={keyword}"
            soup = BeautifulSoup(requests.get(url).text, "html.parser")
            news = soup.select(".title")[:5]
            score = np.mean([TextBlob(n.text).sentiment.polarity for n in news]) if news else 0
        except:
            score = 0

        # ======================================================
        # AI 판단
        # ======================================================
        reasons = []

        if current_price < ma60:
            reasons.append("장기 지지선 근처(저평가)")
        if pred_price > current_price:
            reasons.append("머신러닝 상승 예측")
        if score > 0:
            reasons.append("뉴스 긍정적")

        opinion = "👍 분할 매수" if len(reasons) >= 2 else "⚠️ 관망"

        # ======================================================
        # 출력
        # ======================================================
        st.subheader("📊 분석 결과")
        st.write(f"현재가: {current_price:,.0f}원")
        st.write(f"30일 예측가: {pred_price:,.0f}원")

        st.subheader("💰 추천 매수 가격")
        st.success(f"{buy_low:,.0f} ~ {buy_high:,.0f}원")

        st.subheader("🤖 AI 의견")
        st.write(opinion)
        for r in reasons:
            st.write("•", r)

        # ======================================================
        # 그래프
        # ======================================================
        fig, ax = plt.subplots(figsize=(12,6))
        ax.plot(df.index, df["Close"])
        ax.plot(df.index, df["MA20"])
        ax.plot(df.index, df["MA60"])
        ax.axhspan(buy_low, buy_high, alpha=0.2)
        st.pyplot(fig)

