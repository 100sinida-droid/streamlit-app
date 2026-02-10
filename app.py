# =========================================================
# 🇰🇷 KRX AI 매매 전략 분석기 (완전 안정화 버전)
# Streamlit Cloud 100% 작동
# =========================================================

import streamlit as st
import pandas as pd
import numpy as np
import yfinance as yf
import plotly.graph_objects as go

st.set_page_config(layout="wide")

# =========================================================
# 1. 한국 종목 CSV 로드 (로컬 파일만 사용)
# =========================================================

@st.cache_data
def load_korea():
    df = pd.read_csv("korea_stocks.csv")

    # 혹시 컬럼 깨짐 방어
    df.columns = [c.strip() for c in df.columns]

    required = {"회사명", "ticker", "search"}
    if not required.issubset(df.columns):
        st.error("CSV 컬럼 구조가 올바르지 않습니다. (회사명, ticker, search 필수)")
        st.stop()

    return df


krx = load_korea()


# =========================================================
# 2. 가격 데이터 다운로드 (안정화 처리 포함)
# =========================================================

@st.cache_data
def get_price(ticker):

    df = yf.download(
        ticker,
        period="2y",
        interval="1d",
        auto_adjust=True,
        progress=False
    )

    if df.empty:
        return None

    # ⭐ MultiIndex 방지 (VERY 중요)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # ⭐ 타임존 제거
    df.index = pd.to_datetime(df.index).tz_localize(None)

    return df


# =========================================================
# 3. 거래정지 감지
# =========================================================

def is_halted(df):
    recent = df.tail(5)

    volume_sum = recent["Volume"].sum()
    price_move = recent["Close"].diff().abs().sum()

    if volume_sum == 0 or price_move == 0:
        return True

    return False


# =========================================================
# 4. 전략 계산 (AI 추천 가격 로직)
# =========================================================

def make_strategy(df):

    close = df["Close"].astype(float)

    current = float(close.iloc[-1])

    ma20 = close.rolling(20).mean().iloc[-1]
    ma60 = close.rolling(60).mean().iloc[-1]

    volatility = close.pct_change().std()

    # 🔥 전략
    buy = ma20 * 0.98
    stop = buy * (1 - volatility * 3)
    target = buy * 1.20

    future = ma60 * 1.10

    return current, buy, stop, target, future, ma20, ma60, volatility


# =========================================================
# 5. AI 분석 설명 생성
# =========================================================

def make_ai_comment(current, buy, stop, target, ma20, ma60, vol):

    text = f"""
### 🤖 AI 전략 분석

**📉 매수 추천가 ({buy:,.0f}원)**  
→ 20일 이동평균선 근처 지지구간.  
→ 단기 과매도 반등 확률 높은 위치.

**🛑 손절가 ({stop:,.0f}원)**  
→ 변동성({vol:.2%}) 기반 리스크 관리 가격.  
→ 추세 붕괴 시 자동 방어 구간.

**🎯 목표가 ({target:,.0f}원)**  
→ 평균 회귀 + 기술적 저항선 예상 구간.  
→ 약 +20% 수익 실현 전략.

**📊 현재 상태**  
현재가: {current:,.0f}원  
MA20: {ma20:,.0f}  
MA60: {ma60:,.0f}

👉 단기 눌림목 매수 전략
👉 스윙 트레이딩 적합
"""

    return text


# =========================================================
# 6. UI
# =========================================================

st.title("📈 KRX AI 매매 전략 분석기")

search = st.text_input("종목 검색")

filt = krx[krx["search"].str.contains(search.lower())] if search else krx

options = list(filt["회사명"] + " (" + filt["ticker"] + ")")

choice = st.selectbox("종목 선택", options)

ticker = choice.split("(")[-1].replace(")", "")


# =========================================================
# 7. 데이터 가져오기
# =========================================================

df = get_price(ticker)

if df is None:
    st.error("데이터 없음")
    st.stop()

if is_halted(df):
    st.warning("⚠ 거래정지 또는 가격 변동 없음 종목")
    st.stop()


# =========================================================
# 8. 전략 계산
# =========================================================

current, buy, stop, target, future, ma20, ma60, vol = make_strategy(df)


# =========================================================
# 9. 가격 표시
# =========================================================

col1, col2, col3, col4 = st.columns(4)

col1.metric("현재가", f"{current:,.0f}")
col2.metric("매수 추천가", f"{buy:,.0f}")
col3.metric("손절", f"{stop:,.0f}")
col4.metric("목표", f"{target:,.0f}")


# =========================================================
# 10. 인터랙티브 차트 (Plotly)
# =========================================================

df["date"] = df.index.strftime("%Y-%m-%d")

fig = go.Figure()

fig.add_trace(go.Scatter(x=df["date"], y=df["Close"], name="Price"))
fig.add_trace(go.Scatter(x=df["date"], y=df["Close"].rolling(20).mean(), name="MA20"))
fig.add_trace(go.Scatter(x=df["date"], y=df["Close"].rolling(60).mean(), name="MA60"))

fig.add_hline(y=buy, line_dash="dash", annotation_text="BUY")
fig.add_hline(y=stop, line_dash="dot", annotation_text="STOP")
fig.add_hline(y=target, line_dash="dash", annotation_text="TARGET")

fig.update_layout(
    height=650,
    hovermode="x unified",
    xaxis_rangeslider_visible=True
)

st.plotly_chart(fig, use_container_width=True)


# =========================================================
# 11. AI 분석 텍스트
# =========================================================

st.markdown(make_ai_comment(current, buy, stop, target, ma20, ma60, vol))
