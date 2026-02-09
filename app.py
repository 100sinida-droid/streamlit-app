# =========================================
# AI 주식 매수/매도 추천 프로그램 (최종 안정 버전)
# Streamlit Cloud 100% 호환
# =========================================

import streamlit as st
import pandas as pd
import numpy as np
import yfinance as yf
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta

st.set_page_config(page_title="AI 주식 추천", layout="wide")

# =========================================
# 한국 종목 로컬 CSV 로드 (외부 URL 절대 사용 X)
# =========================================
@st.cache_data
def load_korea():
    df = pd.read_csv("korea_stocks.csv")

    df["name"] = df["name"].astype(str)
    df["ticker"] = df["ticker"].astype(str)
    df["search"] = df["search"].astype(str)

    return df


krx = load_korea()


# =========================================
# 자동완성 검색
# =========================================
def search_candidates(keyword):

    if keyword == "":
        return []

    keyword = keyword.lower()

    df = krx[
        krx["search"].str.contains(keyword) |
        krx["ticker"].str.lower().str.contains(keyword)
    ]

    names = df["name"].tolist()

    return names[:20]


# =========================================
# 가격 데이터 다운로드
# =========================================
def get_price(ticker):

    try:
        end = datetime.today()
        start = end - timedelta(days=365)

        df = yf.download(
            ticker,
            start=start,
            end=end,
            progress=False,
            auto_adjust=True
        )

        if df.empty:
            return None

        return df

    except:
        return None


# =========================================
# 거래정지 체크
# =========================================
def is_halted(df):

    if df is None:
        return True

    if "Volume" not in df.columns:
        return True

vol = df["Volume"]

if isinstance(vol, pd.DataFrame):
    vol = vol.iloc[:, 0]

total = float(vol.tail(5).sum())
return total == 0



# =========================================
# AI 예측 + 전략 생성
# =========================================
def make_strategy(df):

    close = df["Close"].values

    X = np.arange(len(close)).reshape(-1, 1)
    y = close

    model = LinearRegression()
    model.fit(X, y)

    future_x = np.arange(len(close) + 5).reshape(-1, 1)
    pred = model.predict(future_x)

    current = float(close[-1])
    future_price = float(pred[-1])

    buy_price = current * 0.97
    stop_loss = -5
    take_profit = 10

    return current, future_price, buy_price, stop_loss, take_profit


# =========================================
# UI
# =========================================

st.title("📈 AI 주식 매수/매도 전략 추천기")

keyword = st.text_input(
    "🔎 종목명/티커 입력 (삼성전자, apple, tsla, 005930.KS 등)"
)

candidates = search_candidates(keyword)

selected_name = None
ticker = None


# =========================================
# 한국 주식 자동완성
# =========================================
if candidates:

    selected_name = st.selectbox("종목 선택", candidates)

    row = krx[krx["name"] == selected_name].iloc[0]
    ticker = row["ticker"]


# =========================================
# 미국 주식 직접 입력
# =========================================
elif keyword:

    ticker = keyword.upper()


# =========================================
# 분석 실행
# =========================================
if ticker:

    st.write(f"📌 선택 티커: **{ticker}**")

    df = get_price(ticker)

    if df is None:
        st.error("🚫 데이터 없음 / 상장폐지 종목")
        st.stop()

    if is_halted(df):
        st.warning("🚫 해당 종목은 거래정지 종목입니다.")
        st.stop()

    current, future_price, buy_price, stop_loss, take_profit = make_strategy(df)

    st.line_chart(df["Close"])

    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("현재가", f"{current:,.2f}")

    with col2:
        st.metric("AI 5일 예측가", f"{future_price:,.2f}")

    with col3:
        change = (future_price/current - 1) * 100
        st.metric("예상 수익률", f"{change:.2f}%")

    st.divider()

    st.subheader("📌 AI 매매 전략")

    st.success(f"""
    👉 매수 추천가: {buy_price:,.2f}
    👉 손절: {stop_loss}%
    👉 목표수익: +{take_profit}%
    """)

else:
    st.info("종목을 입력하세요")

