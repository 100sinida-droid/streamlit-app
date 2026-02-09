# =====================================================
# 📈 AI 주식 매수/매도 추천 시스템 (최종 안정 버전)
# =====================================================

import streamlit as st
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
import json, os, datetime, requests

plt.rcParams["font.family"] = "Malgun Gothic"
st.set_page_config(layout="wide")

# =====================================================
# 🔐 로그인 설정
# =====================================================
ALLOWED_USERS = ["sinida", "sinida2"]
MAX_SEARCH = 100
DB_FILE = "usage_db.json"


# =====================================================
# 🔐 사용량 관리
# =====================================================
def current_month():
    return datetime.datetime.now().strftime("%Y-%m")


def load_db():
    if not os.path.exists(DB_FILE):
        return {}
    return json.load(open(DB_FILE))


def save_db(d):
    json.dump(d, open(DB_FILE, "w"))


def get_count(u):
    d = load_db()
    if u not in d or d[u]["m"] != current_month():
        return 0
    return d[u]["c"]


def add_count(u):
    d = load_db()
    if u not in d or d[u]["m"] != current_month():
        d[u] = {"c": 0, "m": current_month()}
    d[u]["c"] += 1
    save_db(d)


# =====================================================
# 🔐 로그인 (아이디만)
# =====================================================
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
# 🔎 Yahoo 종목명 → 티커 자동 검색 (핵심 ⭐⭐⭐)
# =====================================================
def yahoo_search(query):
    try:
        url = f"https://query1.finance.yahoo.com/v1/finance/search?q={query}"
        r = requests.get(url, timeout=5).json()

        for item in r["quotes"]:
            if "symbol" in item:
                return item["symbol"]

        return query.upper()

    except:
        return query.upper()


# =====================================================
# 📈 메인 UI
# =====================================================
st.title("📈 AI 주식 매수/매도 전략 추천 시스템")

used = get_count(user)
st.success(f"👤 {user} | 이번달 {used}/{MAX_SEARCH}")

query = st.text_input(
    "🔎 종목명/티커 입력 (삼성전자, apple, tsla, 005930.KS 등)"
)

# =====================================================
# 🔍 검색 실행
# =====================================================
if query:

    if used >= MAX_SEARCH:
        st.error("🚫 월 100회 초과")
        st.stop()

    # ⭐ 종목명 → 티커 자동 변환
    ticker = yahoo_search(query)

    st.info(f"검색 티커: {ticker}")

    df = yf.download(ticker, period="5y", progress=False)

    # =====================================================
    # ⭐ 실패 시 카운트 차감 안함
    # =====================================================
    if df.empty or len(df) < 30:
        st.error("🚫 데이터 없음 / 상장폐지 종목")
        st.stop()

    if float(np.nansum(df["Volume"].tail(5))) == 0:
        st.error("🚫 해당 종목은 거래정지 종목입니다.")
        st.stop()

    # ⭐⭐⭐ 여기서만 카운트 증가
    add_count(user)
    used = get_count(user)
    st.success(f"👤 {user} | 이번달 {used}/{MAX_SEARCH}")

    # =====================================================
    # 지표 계산
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

    future = model.predict(
        np.arange(len(df), len(df) + 30).reshape(-1, 1)
    )

    pred = float(future[-1])

    # =====================================================
    # 전략 계산
    # =====================================================
    buy_low = ma60
    buy_high = ma20
    stop = buy_low * 0.93
    target = max(pred, cur * 1.2)

    stop_pct = (stop / cur - 1) * 100
    take_pct = (target / cur - 1) * 100

    # =====================================================
    # 결과 출력
    # =====================================================
    col1, col2, col3 = st.columns(3)

    col1.metric("현재가", f"{cur:,.0f}")
    col2.metric("30일 예측가", f"{pred:,.0f}")
    col3.metric("상승여력", f"{take_pct:.1f}%")

    st.divider()

    st.success(f"💰 매수구간: {buy_low:,.0f} ~ {buy_high:,.0f}")
    st.error(f"🛑 손절: {stop:,.0f} ({stop_pct:.1f}%)")
    st.info(f"🎯 목표: {target:,.0f}")

    # =====================================================
    # 차트
    # =====================================================
    fig, ax = plt.subplots(figsize=(12, 6))

    ax.plot(df.index, df["Close"], label="Price")
    ax.plot(df.index, df["MA20"], label="MA20")
    ax.plot(df.index, df["MA60"], label="MA60")
    ax.axhline(stop, linestyle="--")
    ax.axhline(target, linestyle="--")

    ax.legend()
    st.pyplot(fig)
