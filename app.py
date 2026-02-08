# 설치 필요
# pip install streamlit yfinance pandas numpy scikit-learn matplotlib requests beautifulsoup4 textblob

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

st.title("📈 주가 분석 & 뉴스 영향 예측")

# ---------------------------
# 종목 입력
# ---------------------------
stock_input = st.text_input("분석할 종목 입력 (예: 삼성전자 / Apple / TSLA): ")

if stock_input:
    # 종목 데이터 다운로드
    try:
        df = yf.download(stock_input, start="2013-01-01")
        if df.empty:
            st.error(f"종목 {stock_input}을(를) 찾을 수 없습니다. 티커를 확인하세요.")
        else:
            # 이동평균
            df["MA20"] = df["Close"].rolling(20).mean()
            df["MA60"] = df["Close"].rolling(60).mean()
            df = df.dropna()

            # 머신러닝 예측
            df["Day"] = np.arange(len(df))
            X = df[["Day"]]
            y = df["Close"]
            model = LinearRegression()
            model.fit(X, y)

            future_days = 30
            future_X = np.arange(len(df), len(df) + future_days).reshape(-1, 1)
            future_pred = model.predict(future_X)

            # 매수 구간 계산
            current_price = df["Close"].iloc[-1].item()
            support = df["MA60"].iloc[-1].item()
            resistance = df["MA20"].iloc[-1].item()

            # 결과 출력
            st.subheader("📊 분석 결과")
            st.write(f"현재 가격: {current_price:.2f} 원")
            st.write(f"30일 예상 가격: {future_pred[-1].item():.2f} 원")

            if current_price < support:
                st.write("🔥 강력 매수 구간 (과매도)")
            elif current_price < resistance:
                st.write("👍 분할 매수 구간")
            else:
                st.write("⚠️ 고점 가능성")

            st.write(f"추천 매수 가격대: {support:.2f} ~ {resistance:.2f} 원")

            # ---------------------------
            # 뉴스 분석
            # ---------------------------
            st.subheader("📰 최근 뉴스 영향 분석")
            url = f"https://finance.naver.com/search/news_search.nhn?query={stock_input}"
            response = requests.get(url)
            soup = BeautifulSoup(response.text, "html.parser")
            news_items = soup.select(".title")[:5]
            headlines = [item.get_text().strip() for item in news_items]

            if headlines:
                for i, h in enumerate(headlines, 1):
                    st.write(f"{i}. {h}")

                # 감성 분석
                impact_score = sum([TextBlob(h).sentiment.polarity for h in headlines]) / len(headlines)
                if impact_score > 0.05:
                    st.success("최근 뉴스가 주가에 긍정적 영향을 줄 수 있음 👍")
                elif impact_score < -0.05:
                    st.error("최근 뉴스가 주가에 부정적 영향을 줄 수 있음 👎")
                else:
                    st.info("최근 뉴스가 주가에 큰 영향은 없어 보임 😐")
            else:
                st.info("최근 뉴스가 없습니다.")

            # ---------------------------
            # 그래프
            # ---------------------------
            st.subheader("📈 주가 그래프")
            df_recent = df[df.index >= "2013-01-01"]
            fig, ax = plt.subplots(figsize=(12,6))
            ax.plot(df_recent.index, df_recent["Close"], label="Price")
            ax.plot(df_recent.index, df_recent["MA20"], label="MA20")
            ax.plot(df_recent.index, df_recent["MA60"], label="MA60")
            future_index = pd.date_range(start=df.index[-1]+pd.Timedelta(days=1), periods=future_days)
            ax.plot(future_index, future_pred, linestyle="dashed", label="Prediction")
            ax.set_xlabel("Date")
            ax.set_ylabel("Price")
            ax.set_title(f"{stock_input} Stock Prediction")
            ax.legend()
            st.pyplot(fig)

    except Exception as e:
        st.error(f"오류 발생: {e}")
