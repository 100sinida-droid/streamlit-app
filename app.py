# =========================================================
# 📈 AI 주식 매수/매도 전략 추천 시스템 (완전체 최종버전)
# =========================================================

import streamlit as st
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
from pykrx import stock
import datetime, json, os, requests

plt.rcParams["font.family"] = "Malgun Gothic"
st.set_page_config(layout="wide")


# =========================================================
# 🔐 로그인 설정
# =========================================================
ALLOWED_USERS = ["sinida", "sinida2"]
MAX_SEARCH = 100
DB_FILE = "usage_db.json"


# =========================================================
# 🔐 사용량 관리
# =========================================================
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


# =========================================================
# 🔐 로그인
# =========================================================
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


# =========================================================
# ⭐⭐⭐ 한국 전체 종목 로드 (pykrx → 정확 100%)
# =========================================================
@st.cache_data(ttl=86400)
def load_korea():

    today = datetime.datetime.today().strftime("%Y%m%d")

    tickers = stock.get_market_ticker_list(today)

    names = [stock.get_market_ticker_name(t) for t in tickers]

    df = pd.DataFrame({
        "name": names,
        "ticker": [t + ".KS" for t in tickers]
    })

    df["search"] = df["name"].str.lower()

    return df


krx = load_korea()


# =========================================================
# ⭐ 미국 Yahoo 검색
# =========================================================
def search_us(query):
    try:
        url = f"https://query1.finance.yahoo.com/v1/finance/search?q={query}"
        r = requests.get(url, timeout=5).json()

        result = []
        for q in r["quotes"][:10]:
            if "symbol" in q and "shortname" in q:
                result.append(f"{q['shortname']} ({q['symbol']})")

        return result
    except:
        return []


# =========================================================
# UI
# =========================================================
st.title("📈 AI 주식 매수/매도 전략 추천 시스템")

used = get_count(user)
st.success(f"👤 {user} | 이번달 {used}/{MAX_SEARCH}")

query = st.text_input("🔎 종목 검색 (삼성, sk, apple 등)").lower()


# =========================================================
# ⭐⭐⭐ 자동 펼침 검색
# =========================================================
ticker = None

if query:

    # 한국 필터
    k = krx[krx["search"].str.contains(query)]

    options = list(k["name"] + " (" + k["ticker"] + ")")

    # 미국 추가
    options += search_us(query)

    if options:
        choice = st.selectbox("종목 선택", options)
        ticker = choice.split("(")[-1].replace(")", "")
    else:
        st.warning("검색 결과 없음")
        st.stop()


# =========================================================
# 분석 시작
# =========================================================
if ticker:

    if used >= MAX_SEARCH:
        st.error("🚫 월 100회 초과")
        st.stop()

    st.info(f"선택 티커: {ticker}")

    df = yf.download(ticker, period="5y", progress=False)

    # 실패시 카운트 차감 안함
    if df.empty or len(df) < 30:
        st.error("🚫 데이터 없음 / 상장폐지")
        st.stop()

    # 거래정지
    if float(np.nansum(df["Volume"].tail(5))) == 0:
        st.error("🚫 해당 종목은 거래정지 종목입니다.")
        st.stop()

    # ⭐ 성공시에만 카운트 증가
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
        np.arange(len(df), len(df)+30).reshape(-1,1)
    )

    pred = float(future[-1])

    # =====================================================
    # 전략 계산
    # =====================================================
    buy_low = ma60
    buy_high = ma20
    stop = buy_low * 0.93
    target = max(pred, cur * 1.2)

    stop_pct = (stop/cur - 1) * 100
    take_pct = (target/cur - 1) * 100

    # =====================================================
    # 결과
    # =====================================================
    col1, col2, col3 = st.columns(3)

    col1.metric("현재가", f"{cur:,.0f}")
    col2.metric("30일 예측가", f"{pred:,.0f}")
    col3.metric("상승여력", f"{take_pct:.1f}%")

    st.success(f"💰 매수구간: {buy_low:,.0f} ~ {buy_high:,.0f}")
    st.error(f"🛑 손절: {stop:,.0f} ({stop_pct:.1f}%)")
    st.info(f"🎯 목표: {target:,.0f}")

    # =====================================================
    # 차트
    # =====================================================
    fig, ax = plt.subplots(figsize=(12,6))

    ax.plot(df.index, df["Close"], label="Price")
    ax.plot(df.index, df["MA20"], label="MA20")
    ax.plot(df.index, df["MA60"], label="MA60")
    ax.axhline(stop, linestyle="--")
    ax.axhline(target, linestyle="--")

    ax.legend()
    st.pyplot(fig)
