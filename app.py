# =====================================================
# requirements.txt
# =====================================================
# streamlit
# yfinance
# pandas
# numpy
# matplotlib
# scikit-learn
# lxml
# html5lib
# =====================================================

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
# 🔐 1. 로그인 시스템
# =====================================================

ALLOWED_USERS = {
    "sinida": "1234",
    "sinida2": "1234"
}

MAX_SEARCH = 100
DB_FILE = "usage_db.json"


def load_usage():
    if not os.path.exists(DB_FILE):
        return {}
    with open(DB_FILE, "r") as f:
        return json.load(f)


def save_usage(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f)


def get_month():
    return datetime.datetime.now().strftime("%Y-%m")


def update_count(user):
    data = load_usage()
    month = get_month()

    if user not in data or data[user]["month"] != month:
        data[user] = {"count": 0, "month": month}

    data[user]["count"] += 1
    save_usage(data)
    return data[user]["count"]


def get_count(user):
    data = load_usage()
    month = get_month()

    if user not in data or data[user]["month"] != month:
        return 0
    return data[user]["count"]


# 로그인 UI
if "login" not in st.session_state:
    st.session_state.login = False

if not st.session_state.login:

    st.title("🔐 로그인")

    uid = st.text_input("아이디")
    pw = st.text_input("비밀번호", type="password")

    if st.button("로그인"):
        if uid in ALLOWED_USERS and ALLOWED_USERS[uid] == pw:
            st.session_state.login = True
            st.session_state.user = uid
            st.rerun()
        else:
            st.error("접근 불가")

    st.stop()

user = st.session_state.user

# =====================================================
# 📊 사용량 표시
# =====================================================

used = get_count(user)

st.sidebar.success(f"👤 {user}")
st.sidebar.info(f"📊 이번달 사용량: {used} / {MAX_SEARCH}")

# =====================================================
# 앱 시작
# =====================================================
st.title("📈 AI 주식 매수/매도 전략 추천 시스템")

# =====================================================
# 한국 종목
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
search = st.text_input("🔎 종목 검색").lower()
ticker = None

if search:

    if used >= MAX_SEARCH:
        st.error("🚫 월 100회 사용량 초과")
        st.stop()

    f = krx[krx["검색"].str.contains(search)]
    options = list(f["회사명"] + " (" + f["티커"] + ")")
    options.append(f"미국 직접입력 → {search.upper()}")

    choice = st.selectbox("종목 선택", options)

    if "직접입력" in choice:
        ticker = search.upper()
    else:
        ticker = choice.split("(")[-1].replace(")", "")

# =====================================================
# 분석
# =====================================================
if ticker:

    # ⭐ 사용량 증가
    used = update_count(user)

    st.sidebar.info(f"📊 이번달 사용량: {used} / {MAX_SEARCH}")

    df = yf.download(ticker, period="5y")

    if df.empty or len(df) < 30:
        st.error("🚫 데이터 없음/상폐")
        st.stop()

    recent_volume = float(np.nansum(df["Volume"].tail(5).values))

    if recent_volume == 0:
        st.error("🚫 해당 종목은 거래정지 종목입니다.")
        st.stop()

    # =====================================================
    # 지표
    # =====================================================
    df["MA20"] = df["Close"].rolling(20).mean()
    df["MA60"] = df["Close"].rolling(60).mean()
    df = df.dropna()

    current = float(df["Close"].iloc[-1])
    ma20 = float(df["MA20"].iloc[-1])
    ma60 = float(df["MA60"].iloc[-1])

    # =====================================================
    # 예측
    # =====================================================
    df["Day"] = np.arange(len(df))
    model = LinearRegression()
    model.fit(df[["Day"]], df["Close"])

    future = model.predict(np.arange(len(df), len(df)+30).reshape(-1,1))
    future_price = float(np.ravel(future)[-1])

    # 전략
    buy_low = ma60
    buy_high = ma20
    stop_loss = buy_low * 0.93
    take_profit = max(future_price, current*1.2)

    stop_pct = (stop_loss/current-1)*100
    take_pct = (take_profit/current-1)*100

    st.metric("현재가", f"{current:,.0f}")
    st.metric("예측가(30일)", f"{future_price:,.0f}")

    st.success(f"💰 매수: {buy_low:,.0f} ~ {buy_high:,.0f}")
    st.error(f"🛑 손절: {stop_loss:,.0f} ({stop_pct:.1f}%)")
    st.info(f"🎯 목표: {take_profit:,.0f} (+{take_pct:.1f}%)")

    # 차트
    fig, ax = plt.subplots(figsize=(12,6))
    ax.plot(df.index, df["Close"])
    ax.plot(df.index, df["MA20"])
    ax.plot(df.index, df["MA60"])
    ax.axhline(stop_loss)
    ax.axhline(take_profit)
    st.pyplot(fig)
