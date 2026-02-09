# =====================================================
# 📈 AI 주식 매수/매도 전략 추천 시스템 (최종 안정 버전)
# =====================================================

import streamlit as st
import pandas as pd
import numpy as np
import yfinance as yf
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
import json, os, datetime

plt.rcParams["font.family"] = "Malgun Gothic"

st.set_page_config(layout="wide")
st.title("📈 AI 주식 매매 전략 추천 시스템")

# =====================================================
# 🔐 로그인 설정
# =====================================================
ALLOWED_USERS = ["sinida", "sinida2"]
MAX_SEARCH = 100
COUNT_FILE = "usage_counts.json"


def load_counts():
    if os.path.exists(COUNT_FILE):
        return json.load(open(COUNT_FILE))
    return {}


def save_counts(data):
    json.dump(data, open(COUNT_FILE, "w"))


def reset_if_new_month(data):
    now = datetime.datetime.now()
    key = f"{now.year}-{now.month}"
    if data.get("month") != key:
        return {"month": key}
    return data


# =====================================================
# 🔐 로그인
# =====================================================
if "user" not in st.session_state:
    uid = st.text_input("아이디 입력")
    if st.button("로그인"):
        if uid in ALLOWED_USERS:
            st.session_state.user = uid
            st.rerun()
        else:
            st.error("접근 권한 없음")
    st.stop()

user = st.session_state.user

counts = load_counts()
counts = reset_if_new_month(counts)

if user not in counts:
    counts[user] = 0

st.write(f"👤 {user} | 이번달 {counts[user]}/{MAX_SEARCH}")

if counts[user] >= MAX_SEARCH:
    st.error("🚫 이번달 사용 횟수 초과")
    st.stop()

# =====================================================
# ✅ 한국 종목 CSV 로드 (로컬 파일)
# =====================================================

def load_korea():
    df = pd.read_csv("korea_stocks.csv")
    return df[["회사명","ticker","search"]]



krx = load_korea()

# =====================================================
# 🔎 검색 (자동완성)
# =====================================================
query = st.text_input("🔎 종목명/티커 입력 (삼성전자, apple, tsla, 005930.KS 등)").lower()

ticker = None

if query:

    filt = krx[krx["search"].str.contains(query, na=False)]

    options = list(filt["회사명"] + " (" + filt["ticker"] + ")")

    options.append(f"직접입력 → {query.upper()}")

    choice = st.selectbox("종목 선택", options)

    if "직접입력" in choice:
        ticker = query.upper()
    else:
        ticker = choice.split("(")[-1].replace(")", "")

# =====================================================
# 거래정지 판별 함수
# =====================================================
def is_halted(df):

    if df is None or df.empty:
        return True

    vol = df["Volume"]

    if isinstance(vol, pd.DataFrame):
        vol = vol.iloc[:, 0]

    return float(vol.tail(5).sum()) == 0


# =====================================================
# 전략 계산
# =====================================================
def make_strategy(df):

    close = df["Close"]

    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]

    close = close.dropna()

    if len(close) < 60:
        return None

    current = float(close.iloc[-1])

    ma20 = float(close.rolling(20).mean().iloc[-1])
    ma60 = float(close.rolling(60).mean().iloc[-1])

    X = np.arange(len(close)).reshape(-1, 1)
    y = close.values

    model = LinearRegression()
    model.fit(X, y)

    future = model.predict(np.arange(len(close), len(close)+30).reshape(-1, 1))
    future_price = float(future[-1])

    buy = ma60
    stop = buy * 0.93
    target = max(future_price, current * 1.2)

    return current, future_price, buy, stop, target, ma20, ma60


# =====================================================
# 분석 실행
# =====================================================
if ticker:

    st.info(f"선택 티커: {ticker}")

    df = yf.download(ticker, period="5y", progress=False)

    if df.empty:
        st.error("🚫 데이터 없음 / 상장폐지 종목")
        st.stop()

    if is_halted(df):
        st.error("🚫 해당 종목은 거래정지 종목입니다.")
        st.stop()

    result = make_strategy(df)

    if result is None:
        st.error("🚫 데이터 부족")
        st.stop()

    # ⭐ 정상 분석 시에만 카운트 증가
    counts[user] += 1
    save_counts(counts)

    current, future_price, buy, stop, target, ma20, ma60 = result

    stop_pct = (stop/current-1)*100
    target_pct = (target/current-1)*100

    # =====================================================
    # 결과 표시
    # =====================================================
    c1, c2, c3 = st.columns(3)

    c1.metric("현재가", f"{current:,.0f}")
    c2.metric("30일 예측가", f"{future_price:,.0f}")
    c3.metric("목표가", f"{target:,.0f}")

    st.success(f"💰 매수 추천가: {buy:,.0f}")
    st.error(f"🛑 손절: {stop:,.0f} ({stop_pct:.1f}%)")
    st.info(f"🎯 목표: {target:,.0f} (+{target_pct:.1f}%)")

    # =====================================================
    # 차트
    # =====================================================
    fig, ax = plt.subplots(figsize=(12,6))

    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:,0]

    ax.plot(close, label="Price")
    ax.plot(close.rolling(20).mean(), label="MA20")
    ax.plot(close.rolling(60).mean(), label="MA60")

    ax.axhline(buy)
    ax.axhline(stop)
    ax.axhline(target)

    ax.legend()
    st.pyplot(fig)

