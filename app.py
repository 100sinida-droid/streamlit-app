import streamlit as st
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
import json, os, datetime

plt.rcParams["font.family"] = "Malgun Gothic"
st.set_page_config(layout="wide")

# =====================================================
# 🔐 로그인 (아이디만)
# =====================================================
ALLOWED_USERS = ["sinida", "sinida2"]
MAX_SEARCH = 100
DB_FILE = "usage_db.json"


def month():
    return datetime.datetime.now().strftime("%Y-%m")


def load_db():
    if not os.path.exists(DB_FILE):
        return {}
    return json.load(open(DB_FILE))


def save_db(d):
    json.dump(d, open(DB_FILE, "w"))


def get_count(u):
    d = load_db()
    if u not in d or d[u]["m"] != month():
        return 0
    return d[u]["c"]


def add_count(u):
    d = load_db()
    if u not in d or d[u]["m"] != month():
        d[u] = {"c": 0, "m": month()}
    d[u]["c"] += 1
    save_db(d)
    return d[u]["c"]


# 로그인
if "login" not in st.session_state:
    st.session_state.login = False

if not st.session_state.login:
    st.title("🔐 로그인")
    uid = st.text_input("아이디")
    if st.button("접속"):
        if uid in ALLOWED_USERS:
            st.session_state.login = True
            st.session_state.user = uid
            st.rerun()
        else:
            st.error("허용되지 않은 ID")
    st.stop()

user = st.session_state.user

# =====================================================
st.title("📈 AI 주식 매수/매도 전략 추천 시스템")

used = get_count(user)
st.success(f"👤 {user} | 이번달 {used}/{MAX_SEARCH}")

# =====================================================
# 🔍 검색 (한국/미국 통합, 직접입력 방식 ⭐⭐⭐)
# =====================================================
ticker = st.text_input(
    "🔎 티커 또는 종목코드 직접 입력\n예: 005930.KS / AAPL / TSLA / 035720.KS"
).upper()

if ticker:

    if used >= MAX_SEARCH:
        st.error("🚫 월 100회 초과")
        st.stop()

    used = add_count(user)
    st.success(f"👤 {user} | 이번달 {used}/{MAX_SEARCH}")

    df = yf.download(ticker, period="5y")

    if df.empty or len(df) < 30:
        st.error("🚫 데이터 없음 / 상장폐지 종목")
        st.stop()

    # 거래정지 체크
    if float(np.nansum(df["Volume"].tail(5).values)) == 0:
        st.error("🚫 해당 종목은 거래정지 종목입니다.")
        st.stop()

    # =====================================================
    # 지표
    # =====================================================
    df["MA20"] = df["Close"].rolling(20).mean()
    df["MA60"] = df["Close"].rolling(60).mean()
    df = df.dropna()

    cur = float(df["Close"].iloc[-1])
    ma20 = float(df["MA20"].iloc[-1])
    ma60 = float(df["MA60"].iloc[-1])

    # =====================================================
    # AI 예측
    # =====================================================
    df["Day"] = np.arange(len(df))
    model = LinearRegression()
    model.fit(df[["Day"]], df["Close"])

    future = model.predict(np.arange(len(df), len(df) + 30).reshape(-1, 1))
    pred = float(np.ravel(future)[-1])

    # 전략 계산
    buy_low = ma60
    buy_high = ma20
    stop = buy_low * 0.93
    target = max(pred, cur * 1.2)

    stop_pct = (stop / cur - 1) * 100
    take_pct = (target / cur - 1) * 100

    # =====================================================
    # 출력
    # =====================================================
    st.metric("현재가", f"{cur:,.0f}")
    st.metric("예측가(30일)", f"{pred:,.0f}")

    st.success(f"💰 매수: {buy_low:,.0f} ~ {buy_high:,.0f}")
    st.error(f"🛑 손절: {stop:,.0f} ({stop_pct:.1f}%)")
    st.info(f"🎯 목표: {target:,.0f} (+{take_pct:.1f}%)")

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(df.index, df["Close"])
    ax.plot(df.index, df["MA20"])
    ax.plot(df.index, df["MA60"])
    ax.axhline(stop)
    ax.axhline(target)
    st.pyplot(fig)
