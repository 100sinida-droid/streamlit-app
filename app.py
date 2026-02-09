import streamlit as st
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
import datetime, json, os, requests

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
        d[u] = {"c":0,"m":month()}
    d[u]["c"] += 1
    save_db(d)


# =====================================================
# 🔐 로그인
# =====================================================
if "login" not in st.session_state:
    st.session_state.login = False

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
# ⭐⭐⭐ 한국 종목 CSV (안정 버전)
# =====================================================
@st.cache_data
def load_korea():
    df = pd.read_csv(
        "https://raw.githubusercontent.com/FinanceData/FinanceDataReader/master/data/krx_stock_list.csv"
    )

    df["ticker"] = df["Symbol"] + ".KS"
    df["name"] = df["Name"]
    df["search"] = df["name"].str.lower()

    return df[["name","ticker","search"]]

krx = load_korea()


# =====================================================
# 미국 검색
# =====================================================
def search_us(q):
    try:
        url=f"https://query1.finance.yahoo.com/v1/finance/search?q={q}"
        r=requests.get(url,timeout=5).json()

        res=[]
        for x in r["quotes"][:10]:
            if "symbol" in x and "shortname" in x:
                res.append(f"{x['shortname']} ({x['symbol']})")
        return res
    except:
        return []


# =====================================================
# UI
# =====================================================
st.title("📈 AI 주식 매수/매도 전략 추천 시스템")

used=get_count(user)
st.success(f"👤 {user} | 이번달 {used}/{MAX_SEARCH}")

query=st.text_input("🔎 종목명/티커 입력 (삼성, sk, apple 등)").lower()


ticker=None

if query:

    k=krx[krx["search"].str.contains(query)]

    options=list(k["name"]+" ("+k["ticker"]+")")
    options+=search_us(query)

    if options:
        choice=st.selectbox("종목 선택",options)
        ticker=choice.split("(")[-1].replace(")","")
    else:
        st.warning("검색 결과 없음")
        st.stop()


# =====================================================
# 분석
# =====================================================
if ticker:

    if used>=MAX_SEARCH:
        st.error("🚫 월 100회 초과")
        st.stop()

    st.info(f"선택 티커: {ticker}")

    df=yf.download(ticker,period="5y",progress=False)

    if df.empty or len(df)<30:
        st.error("🚫 데이터 없음 / 상장폐지")
        st.stop()

    if float(np.nansum(df["Volume"].tail(5)))==0:
        st.error("🚫 거래정지 종목")
        st.stop()

    add_count(user)
    used=get_count(user)
    st.success(f"👤 {user} | 이번달 {used}/{MAX_SEARCH}")

    df["MA20"]=df["Close"].rolling(20).mean()
    df["MA60"]=df["Close"].rolling(60).mean()
    df=df.dropna()

    cur=float(df["Close"].iloc[-1])
    ma20=float(df["MA20"].iloc[-1])
    ma60=float(df["MA60"].iloc[-1])

    df["Day"]=np.arange(len(df))

    model=LinearRegression()
    model.fit(df[["Day"]],df["Close"])

    pred=float(model.predict([[len(df)+30]]))

    buy_low=ma60
    buy_high=ma20
    stop=buy_low*0.93
    target=max(pred,cur*1.2)

    st.metric("현재가",f"{cur:,.0f}")
    st.metric("30일 예측가",f"{pred:,.0f}")

    st.success(f"💰 매수구간 {buy_low:,.0f} ~ {buy_high:,.0f}")
    st.error(f"🛑 손절 {stop:,.0f}")
    st.info(f"🎯 목표 {target:,.0f}")

    fig,ax=plt.subplots(figsize=(12,6))
    ax.plot(df["Close"])
    ax.plot(df["MA20"])
    ax.plot(df["MA60"])
    st.pyplot(fig)
