# =====================================================
# 📦 requirements.txt
# =====================================================
# streamlit
# yfinance
# pandas
# numpy
# matplotlib
# scikit-learn
# beautifulsoup4
# lxml
# html5lib
# =====================================================

import streamlit as st
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression

plt.rcParams["font.family"] = "Malgun Gothic"

st.set_page_config(layout="wide")
st.title("📈 AI 주식 매수/매도 전략 추천 시스템")

# =====================================================
# ✅ 한국 전체 종목 로드
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
# ✅ 검색 (소문자/영문 모두 가능)
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
# ✅ 분석 시작
# =====================================================
if ticker:

    st.info(f"선택 티커: {ticker}")

    df = yf.download(ticker, period="5y")

    # =====================================================
    # ⭐⭐⭐ 거래 가능 여부 체크 (핵심 기능)
    # =====================================================
    if df.empty:
        st.error("🚫 해당 종목은 데이터가 없거나 상장폐지 종목입니다.")
        st.stop()

    if len(df) < 30:
        st.error("🚫 데이터 부족 종목입니다.")
        st.stop()

    # ⭐ 거래정지 판별 (최근 5일 거래량 0)
    recent_volume = float(np.nansum(df["Volume"].tail(5).values))

    if recent_volume == 0:

        st.error("🚫 해당 종목은 거래정지 종목입니다.")
        st.stop()

    # =====================================================
    # 지표 계산
    # =====================================================
    df["MA20"] = df["Close"].rolling(20).mean()
    df["MA60"] = df["Close"].rolling(60).mean()
    df = df.dropna()

    current = float(df["Close"].iloc[-1])
    ma20 = float(df["MA20"].iloc[-1])
    ma60 = float(df["MA60"].iloc[-1])

    # =====================================================
    # ⭐ 머신러닝 가격 예측
    # =====================================================
    df["Day"] = np.arange(len(df))

    X = df[["Day"]]
    y = df["Close"]

    model = LinearRegression()
    model.fit(X, y)

    future_X = np.arange(len(df), len(df) + 30).reshape(-1, 1)
    future_pred = model.predict(future_X)

    future_price = float(np.ravel(future_pred)[-1])

    # =====================================================
    # ⭐ 매매 전략 계산
    # =====================================================
    buy_low = ma60
    buy_high = ma20

    stop_loss = buy_low * 0.93
    take_profit = max(future_price, current * 1.2)

    stop_pct = (stop_loss / current - 1) * 100
    take_pct = (take_profit / current - 1) * 100

    if current > ma20:
        buy_time = "2~4주 조정 후 분할 매수 추천"
    else:
        buy_time = "지금 분할 매수 가능 구간"

    # =====================================================
    # ⭐ AI 의견 생성
    # =====================================================
    reasons = []

    if current < ma60:
        reasons.append("장기 이동평균선 아래 저평가 상태")

    if future_price > current:
        reasons.append("AI 예측 가격 상승 전망")

    if ma20 > ma60:
        reasons.append("상승 추세 유지")

    if len(reasons) >= 2:
        opinion = "🔥 적극 매수"
    elif len(reasons) == 1:
        opinion = "👍 분할 매수"
    else:
        opinion = "⚠️ 관망"

    # =====================================================
    # ⭐ 결과 출력
    # =====================================================
    col1, col2, col3 = st.columns(3)

    col1.metric("현재가", f"{current:,.2f}")
    col2.metric("30일 예측가", f"{future_price:,.2f}")
    col3.metric("AI 의견", opinion)

    st.divider()

    st.subheader("💰 매수 추천 가격")
    st.success(f"{buy_low:,.2f} ~ {buy_high:,.2f}")

    st.subheader("🕒 매수 시점")
    st.info(buy_time)

    c1, c2 = st.columns(2)

    c1.error(f"🛑 손절가: {stop_loss:,.2f} ({stop_pct:.1f}%)")
    c2.success(f"🎯 목표가: {take_profit:,.2f} (+{take_pct:.1f}%)")

    st.subheader("🤖 AI 판단 근거")

    for r in reasons:
        st.write("•", r)

    # =====================================================
    # ⭐ 차트
    # =====================================================
    st.subheader("📈 가격 차트")

    fig, ax = plt.subplots(figsize=(12, 6))

    ax.plot(df.index, df["Close"], label="Price")
    ax.plot(df.index, df["MA20"], label="MA20")
    ax.plot(df.index, df["MA60"], label="MA60")

    ax.axhspan(buy_low, buy_high, alpha=0.2, label="Buy Zone")
    ax.axhline(stop_loss, linestyle="--", label="Stop Loss")
    ax.axhline(take_profit, linestyle="--", label="Take Profit")

    ax.legend()

    st.pyplot(fig)

