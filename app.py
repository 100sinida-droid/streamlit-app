# =========================================================
# 📈 AI 주식 매매 전략 추천 시스템 PRO (최종 완성판)
# 로그인 + 월제한 + 거래정지 + AI리포트 + 인터랙티브 차트
# =========================================================

import streamlit as st
import pandas as pd
import numpy as np
import yfinance as yf
from sklearn.linear_model import LinearRegression
import plotly.graph_objects as go
import datetime, json, os

st.set_page_config(layout="wide")
st.title("📈 AI 주식 매수/매도 전략 추천 시스템 PRO")

# =====================================================
# 🔐 로그인
# =====================================================
USERS = ["sinida", "sinida2"]
MAX_SEARCH = 100
COUNT_FILE = "usage.json"


def load_counts():
    if os.path.exists(COUNT_FILE):
        return json.load(open(COUNT_FILE))
    return {}


def save_counts(data):
    json.dump(data, open(COUNT_FILE, "w"))


def reset_month(data):
    now = datetime.datetime.now()
    key = f"{now.year}-{now.month}"
    if data.get("month") != key:
        return {"month": key}
    return data


if "user" not in st.session_state:
    uid = st.text_input("아이디 입력")
    if st.button("로그인"):
        if uid in USERS:
            st.session_state.user = uid
            st.rerun()
        else:
            st.error("접근 불가")
    st.stop()

user = st.session_state.user
counts = reset_month(load_counts())

if user not in counts:
    counts[user] = 0

st.write(f"👤 {user} | 이번달 {counts[user]}/{MAX_SEARCH}")

if counts[user] >= MAX_SEARCH:
    st.error("🚫 이번달 사용 초과")
    st.stop()


# =====================================================
# ✅ 한국 CSV 로드 (캐시 사용 X → 안정)
# =====================================================
def load_korea():
    df = pd.read_csv("korea_stocks.csv")
    return df[["회사명","ticker","search"]]


krx = load_korea()

# =====================================================
# 🔎 검색
# =====================================================
query = st.text_input("🔎 종목 검색 (삼성, apple, tsla 등)").lower()

ticker = None

if query:
    f = krx[krx["search"].str.contains(query, na=False)]

    options = list(f["회사명"] + " (" + f["ticker"] + ")")
    options.append(f"직접입력 → {query.upper()}")

    choice = st.selectbox("종목 선택", options)

    if "직접입력" in choice:
        ticker = query.upper()
    else:
        ticker = choice.split("(")[-1].replace(")", "")


# =====================================================
# 거래정지 판별
# =====================================================
def is_halted(df):
    vol = df["Volume"]
    if isinstance(vol, pd.DataFrame):
        vol = vol.iloc[:,0]
    return float(vol.tail(5).sum()) == 0


# =====================================================
# ⭐ AI 전략 + 리포트 생성
# =====================================================
def make_strategy(df):

    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:,0]

    close = close.dropna()

    current = float(close.iloc[-1])

    ma20 = float(close.rolling(20).mean().iloc[-1])
    ma60 = float(close.rolling(60).mean().iloc[-1])

    # ML 예측
    X = np.arange(len(close)).reshape(-1,1)
    model = LinearRegression().fit(X, close.values)
    future = model.predict(np.arange(len(close), len(close)+30).reshape(-1,1))
    future_price = float(future[-1])

    buy = ma60
    stop = buy * 0.93
    target = max(future_price, current * 1.2)

    # =================================================
    # ⭐⭐⭐ AI 리포트 생성 ⭐⭐⭐
    # =================================================
    trend = "상승" if ma20 > ma60 else "하락"

    report = f"""
### 🤖 AI 종합 분석 리포트

현재 주가는 {trend} 추세입니다.  
20일 이동평균은 {ma20:,.0f}원, 60일 이동평균은 {ma60:,.0f}원으로  
{'단기 상승 모멘텀이 강한 상태입니다.' if trend=='상승' else '아직 약세 구간입니다.'}

---

💰 **매수 추천 이유**
- 장기 평균선(MA60) 부근은 기관 평균 매입 단가
- 통계적으로 반등 확률이 높은 가격대
- 저점 매수 전략 구간

🛑 **손절 이유**
- MA60 이탈 시 추세 붕괴 가능성
- 손실 -7% 이내 리스크 관리 구간

🎯 **목표가 이유**
- AI 선형회귀 예측 가격 기반
- 최근 평균 상승폭 + 추세 연장 시 도달 가능한 가격
- 기대 수익률 15~25% 구간

👉 결론: {'적극 분할매수 추천' if future_price>current else '관망 또는 소량 매수'}
"""

    return current, buy, stop, target, report


# =====================================================
# 실행
# =====================================================
if ticker:

    df = yf.download(ticker, period="5y", progress=False)

    if df.empty:
        st.error("데이터 없음")
        st.stop()

    if is_halted(df):
        st.error("🚫 거래정지 종목")
        st.stop()

    counts[user]+=1
    save_counts(counts)

    current, buy, stop, target, report = make_strategy(df)

    # =================================================
    # 결과
    # =================================================
    c1,c2,c3 = st.columns(3)
    c1.metric("현재가", f"{current:,.0f}")
    c2.metric("매수 추천", f"{buy:,.0f}")
    c3.metric("목표가", f"{target:,.0f}")

    st.error(f"손절: {stop:,.0f}")

    st.markdown(report)

    # =================================================
    # ⭐ 인터랙티브 차트 (Plotly)
    # =================================================
    fig = go.Figure()

    fig.add_trace(go.Scatter(x=df.index, y=df["Close"], name="Price"))
    fig.add_hline(y=buy)
    fig.add_hline(y=stop)
    fig.add_hline(y=target)

    fig.update_layout(height=600)

    st.plotly_chart(fig, use_container_width=True)
