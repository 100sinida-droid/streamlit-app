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
# 🔐 로그인 설정
# =====================================================
ALLOWED_USERS = ["sinida", "sinida2"]
MAX_SEARCH = 100
DB_FILE = "usage_db.json"

# =====================================================
# 사용량 DB
# =====================================================
def load_db():
    if not os.path.exists(DB_FILE):
        return {}
    return json.load(open(DB_FILE))

def save_db(d):
    json.dump(d, open(DB_FILE, "w"))

def month():
    return datetime.datetime.now().strftime("%Y-%m")

def get_count(u):
    d = load_db()
    if u not in d or d[u]["m"] != month():
        return 0
    return d[u]["c"]

def add_count(u):
    d = load_db()
    if u not in d or d[u]["m"] != month():
        d[u] = {"c":0,"m":month()}
    d[u]["c"]+=1
    save_db(d)
    return d[u]["c"]

# =====================================================
# 🔐 로그인
# =====================================================
if "login" not in st.session_state:
    st.session_state.login=False

if not st.session_state.login:
    st.title("🔐 로그인")
    uid = st.text_input("아이디")
    if st.button("접속"):
        if uid in ALLOWED_USERS:
            st.session_state.login=True
            st.session_state.user=uid
            st.rerun()
        else:
            st.error("허용되지 않은 ID")
    st.stop()

user = st.session_state.user

# =====================================================
# 한국 종목 CSV 로드 ⭐⭐⭐
# =====================================================
@st.cache_data
def load_korea():
    df = pd.read_csv("korea_tickers.csv")
    df["검색"] = df["회사명"].str.lower()
    return df

krx = load_korea()

# =====================================================
st.title("📈 AI 주식 매수/매도 전략 추천 시스템")

used = get_count(user)
st.success(f"👤 {user} | 이번달 {used}/{MAX_SEARCH}")

# =====================================================
# 검색
# =====================================================
search = st.text_input("🔎 종목 검색").lower()
ticker=None

if search:

    if used>=MAX_SEARCH:
        st.error("🚫 월 사용량 초과")
        st.stop()

    f=krx[krx["검색"].str.contains(search)]
    opts=list(f["회사명"]+" ("+f["티커"]+")")
    opts.append(f"미국 직접입력 → {search.upper()}")

    choice=st.selectbox("종목",opts)

    ticker = search.upper() if "직접입력" in choice else choice.split("(")[-1].replace(")","")

# =====================================================
# 분석
# =====================================================
if ticker:

    used=add_count(user)
    st.success(f"👤 {user} | 이번달 {used}/{MAX_SEARCH}")

    df=yf.download(ticker,period="5y")

    if df.empty or len(df)<30:
        st.error("🚫 데이터 없음/상폐")
        st.stop()

    if float(np.nansum(df["Volume"].tail(5).values))==0:
        st.error("🚫 해당 종목은 거래정지 종목입니다.")
        st.stop()

    df["MA20"]=df["Close"].rolling(20).mean()
    df["MA60"]=df["Close"].rolling(60).mean()
    df=df.dropna()

    cur=float(df["Close"].iloc[-1])
    ma20=float(df["MA20"].iloc[-1])
    ma60=float(df["MA60"].iloc[-1])

    df["Day"]=np.arange(len(df))
    model=LinearRegression()
    model.fit(df[["Day"]],df["Close"])

    future=model.predict(np.arange(len(df),len(df)+30).reshape(-1,1))
    pred=float(np.ravel(future)[-1])

    buy_low, buy_high = ma60, ma20
    stop=buy_low*0.93
    target=max(pred,cur*1.2)

    st.metric("현재가",f"{cur:,.0f}")
    st.metric("예측가",f"{pred:,.0f}")

    st.success(f"매수 {buy_low:,.0f}~{buy_high:,.0f}")
    st.error(f"손절 {stop:,.0f}")
    st.info(f"목표 {target:,.0f}")

    fig,ax=plt.subplots(figsize=(12,6))
    ax.plot(df.index,df["Close"])
    ax.plot(df.index,df["MA20"])
    ax.plot(df.index,df["MA60"])
    ax.axhline(stop)
    ax.axhline(target)
    st.pyplot(fig)
