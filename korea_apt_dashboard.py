"""
🏠 대한민국 아파트 실거래가 대시보드
=====================================
국토교통부 공공데이터포털 API를 활용한
지역별 아파트 거래 현황 실시간(일별) 시각화

필요 라이브러리:
    pip install dash dash-leaflet plotly pandas requests python-dotenv
    
API 키 발급:
    https://www.data.go.kr → 회원가입 → 국토교통부_아파트매매 실거래가 자료 신청
    (자동승인, 보통 1~2시간 내 사용 가능)
"""

import os
import requests
import xml.etree.ElementTree as ET
import pandas as pd
import json
from datetime import datetime, timedelta
from urllib.parse import unquote
import time

import dash
from dash import dcc, html, Input, Output, State, callback_context
import dash_leaflet as dl
import plotly.graph_objects as go
import plotly.express as px

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ⚙️  설정
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 공공데이터포털에서 발급받은 서비스 키를 입력하세요
# 환경변수 MOLIT_API_KEY 또는 아래에 직접 입력
API_KEY = os.environ.get("MOLIT_API_KEY", "여기에_API_키를_입력하세요")

BASE_URL = "http://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🗺️  지역 데이터 (법정동코드 앞 5자리)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGIONS = {
    # 서울특별시 (25개 구)
    "서울 종로구":   {"code": "11110", "lat": 37.5730,  "lng": 126.9794, "city": "서울"},
    "서울 중구":     {"code": "11140", "lat": 37.5641,  "lng": 126.9979, "city": "서울"},
    "서울 용산구":   {"code": "11170", "lat": 37.5324,  "lng": 126.9904, "city": "서울"},
    "서울 성동구":   {"code": "11200", "lat": 37.5634,  "lng": 127.0367, "city": "서울"},
    "서울 광진구":   {"code": "11215", "lat": 37.5385,  "lng": 127.0822, "city": "서울"},
    "서울 동대문구": {"code": "11230", "lat": 37.5744,  "lng": 127.0395, "city": "서울"},
    "서울 중랑구":   {"code": "11260", "lat": 37.6063,  "lng": 127.0927, "city": "서울"},
    "서울 성북구":   {"code": "11290", "lat": 37.5894,  "lng": 127.0167, "city": "서울"},
    "서울 강북구":   {"code": "11305", "lat": 37.6396,  "lng": 127.0253, "city": "서울"},
    "서울 도봉구":   {"code": "11320", "lat": 37.6687,  "lng": 127.0471, "city": "서울"},
    "서울 노원구":   {"code": "11350", "lat": 37.6541,  "lng": 127.0568, "city": "서울"},
    "서울 은평구":   {"code": "11380", "lat": 37.6176,  "lng": 126.9226, "city": "서울"},
    "서울 서대문구": {"code": "11410", "lat": 37.5791,  "lng": 126.9368, "city": "서울"},
    "서울 마포구":   {"code": "11440", "lat": 37.5615,  "lng": 126.9088, "city": "서울"},
    "서울 양천구":   {"code": "11470", "lat": 37.5170,  "lng": 126.8665, "city": "서울"},
    "서울 강서구":   {"code": "11500", "lat": 37.5509,  "lng": 126.8495, "city": "서울"},
    "서울 구로구":   {"code": "11530", "lat": 37.4954,  "lng": 126.8874, "city": "서울"},
    "서울 금천구":   {"code": "11545", "lat": 37.4569,  "lng": 126.8956, "city": "서울"},
    "서울 영등포구": {"code": "11560", "lat": 37.5264,  "lng": 126.8963, "city": "서울"},
    "서울 동작구":   {"code": "11590", "lat": 37.5124,  "lng": 126.9392, "city": "서울"},
    "서울 관악구":   {"code": "11620", "lat": 37.4784,  "lng": 126.9516, "city": "서울"},
    "서울 서초구":   {"code": "11650", "lat": 37.4836,  "lng": 127.0327, "city": "서울"},
    "서울 강남구":   {"code": "11680", "lat": 37.5172,  "lng": 127.0473, "city": "서울"},
    "서울 송파구":   {"code": "11710", "lat": 37.5145,  "lng": 127.1059, "city": "서울"},
    "서울 강동구":   {"code": "11740", "lat": 37.5301,  "lng": 127.1237, "city": "서울"},
    # 경기도 주요 시
    "경기 수원시":   {"code": "41110", "lat": 37.2636,  "lng": 127.0286, "city": "경기"},
    "경기 성남시":   {"code": "41130", "lat": 37.4449,  "lng": 127.1388, "city": "경기"},
    "경기 고양시":   {"code": "41280", "lat": 37.6584,  "lng": 126.8320, "city": "경기"},
    "경기 용인시":   {"code": "41460", "lat": 37.2411,  "lng": 127.1776, "city": "경기"},
    "경기 부천시":   {"code": "41190", "lat": 37.5034,  "lng": 126.7659, "city": "경기"},
    "경기 안산시":   {"code": "41270", "lat": 37.3219,  "lng": 126.8309, "city": "경기"},
    "경기 화성시":   {"code": "41590", "lat": 37.1996,  "lng": 126.8312, "city": "경기"},
    "경기 남양주시": {"code": "41360", "lat": 37.6360,  "lng": 127.2161, "city": "경기"},
    "경기 평택시":   {"code": "41220", "lat": 36.9921,  "lng": 127.1128, "city": "경기"},
    "경기 시흥시":   {"code": "41390", "lat": 37.3800,  "lng": 126.8031, "city": "경기"},
    # 인천광역시
    "인천 남동구":   {"code": "28200", "lat": 37.4469,  "lng": 126.7316, "city": "인천"},
    "인천 부평구":   {"code": "28237", "lat": 37.4913,  "lng": 126.7222, "city": "인천"},
    "인천 서구":     {"code": "28260", "lat": 37.5450,  "lng": 126.6760, "city": "인천"},
    "인천 연수구":   {"code": "28185", "lat": 37.4100,  "lng": 126.6781, "city": "인천"},
    # 부산광역시
    "부산 해운대구": {"code": "26350", "lat": 35.1631,  "lng": 129.1636, "city": "부산"},
    "부산 수영구":   {"code": "26380", "lat": 35.1452,  "lng": 129.1135, "city": "부산"},
    "부산 동래구":   {"code": "26260", "lat": 35.1988,  "lng": 129.0855, "city": "부산"},
    "부산 남구":     {"code": "26290", "lat": 35.1368,  "lng": 129.0840, "city": "부산"},
    "부산 부산진구": {"code": "26230", "lat": 35.1631,  "lng": 129.0533, "city": "부산"},
    # 대구광역시
    "대구 수성구":   {"code": "27290", "lat": 35.8585,  "lng": 128.6300, "city": "대구"},
    "대구 달서구":   {"code": "27290", "lat": 35.8302,  "lng": 128.5332, "city": "대구"},
    # 광주광역시
    "광주 서구":     {"code": "29140", "lat": 35.1529,  "lng": 126.8912, "city": "광주"},
    "광주 북구":     {"code": "29170", "lat": 35.1744,  "lng": 126.9118, "city": "광주"},
    # 대전광역시
    "대전 유성구":   {"code": "30200", "lat": 36.3624,  "lng": 127.3564, "city": "대전"},
    "대전 서구":     {"code": "30170", "lat": 36.3549,  "lng": 127.3835, "city": "대전"},
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📡  API 데이터 수집
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def fetch_apt_data(lawd_cd: str, deal_ymd: str, num_rows: int = 100) -> pd.DataFrame:
    """국토교통부 아파트 매매 실거래가 API 호출"""
    params = {
        "serviceKey": API_KEY,
        "LAWD_CD": lawd_cd,
        "DEAL_YMD": deal_ymd,
        "numOfRows": num_rows,
        "pageNo": 1,
    }
    try:
        resp = requests.get(BASE_URL, params=params, timeout=10)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)

        # 결과 코드 확인
        result_code = root.findtext(".//resultCode", "")
        if result_code not in ("00", "0000", "000"):
            print(f"[API] 응답 코드: {result_code} - {root.findtext('.//resultMsg', '')}")
            return pd.DataFrame()

        items = root.findall(".//item")
        if not items:
            return pd.DataFrame()

        records = []
        for item in items:
            def g(tag): return (item.findtext(tag) or "").strip()
            price_raw = g("dealAmount").replace(",", "")
            try:
                price = int(price_raw)  # 만원 단위
            except ValueError:
                continue

            area_raw = g("excluUseAr")
            try:
                area = float(area_raw)
            except ValueError:
                area = 0.0

            records.append({
                "아파트명":    g("aptNm"),
                "법정동":      g("umdNm"),
                "거래금액(만원)": price,
                "전용면적(㎡)": area,
                "층":          g("floor"),
                "건축년도":    g("buildYear"),
                "거래연도":    int(g("dealYear") or 0),
                "거래월":      int(g("dealMonth") or 0),
                "거래일":      int(g("dealDay") or 0),
            })

        df = pd.DataFrame(records)
        if not df.empty:
            df["㎡당가격(만원)"] = (df["거래금액(만원)"] / df["전용면적(㎡)"]).round(0)
            df["거래일자"] = pd.to_datetime(
                df[["거래연도", "거래월", "거래일"]].rename(
                    columns={"거래연도": "year", "거래월": "month", "거래일": "day"}
                )
            )
        return df

    except Exception as e:
        print(f"[API Error] {e}")
        return pd.DataFrame()


def get_months_list(n_months: int = 3) -> list[str]:
    """최근 n개월 YYYYMM 리스트 반환"""
    today = datetime.today()
    months = []
    for i in range(n_months):
        d = today - timedelta(days=30 * i)
        months.append(d.strftime("%Y%m"))
    return months


def get_region_summary(region_name: str, n_months: int = 3) -> dict:
    """지역별 요약 통계 (최근 n개월 합산)"""
    info = REGIONS[region_name]
    code = info["code"]
    all_dfs = []
    for ym in get_months_list(n_months):
        df = fetch_apt_data(code, ym)
        if not df.empty:
            df["조회월"] = ym
            all_dfs.append(df)
        time.sleep(0.1)  # API 과부하 방지

    if not all_dfs:
        return {"region": region_name, "count": 0, "avg_price": 0,
                "max_price": 0, "min_price": 0, "df": pd.DataFrame()}

    combined = pd.concat(all_dfs, ignore_index=True)
    return {
        "region": region_name,
        "count":     len(combined),
        "avg_price": int(combined["거래금액(만원)"].mean()),
        "max_price": int(combined["거래금액(만원)"].max()),
        "min_price": int(combined["거래금액(만원)"].min()),
        "avg_per_m2": int(combined["㎡당가격(만원)"].mean()),
        "df":        combined,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎨  Dash 대시보드
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 컬러 팔레트
COLORS = {
    "bg":       "#0a0e1a",
    "card":     "#111827",
    "border":   "#1f2937",
    "accent":   "#3b82f6",
    "up":       "#10b981",
    "down":     "#ef4444",
    "text":     "#f9fafb",
    "subtext":  "#9ca3af",
    "gold":     "#f59e0b",
    "purple":   "#8b5cf6",
}

app = dash.Dash(
    __name__,
    title="🏠 대한민국 아파트 실거래가 대시보드",
    external_stylesheets=[
        "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap"
    ],
    suppress_callback_exceptions=True,
)

# ── 레이아웃 ─────────────────────────────────

app.layout = html.Div([
    # 헤더
    html.Div([
        html.Div([
            html.Span("🏠", style={"fontSize": "2rem", "marginRight": "12px"}),
            html.H1("대한민국 아파트 실거래가", style={
                "margin": 0, "fontSize": "1.6rem", "fontWeight": "900",
                "color": COLORS["text"], "letterSpacing": "-0.5px",
            }),
        ], style={"display": "flex", "alignItems": "center"}),

        html.Div([
            html.Div([
                html.Span("조회 기간: ", style={"color": COLORS["subtext"], "fontSize": "0.85rem"}),
                dcc.Dropdown(
                    id="month-selector",
                    options=[
                        {"label": "최근 1개월", "value": 1},
                        {"label": "최근 3개월", "value": 3},
                        {"label": "최근 6개월", "value": 6},
                    ],
                    value=3,
                    clearable=False,
                    style={
                        "width": "140px", "backgroundColor": COLORS["card"],
                        "color": COLORS["text"], "border": f"1px solid {COLORS['border']}",
                    },
                ),
            ], style={"display": "flex", "alignItems": "center", "gap": "8px"}),

            html.Button("🔄 새로고침", id="refresh-btn", n_clicks=0, style={
                "backgroundColor": COLORS["accent"], "color": "white",
                "border": "none", "padding": "8px 18px", "borderRadius": "8px",
                "cursor": "pointer", "fontFamily": "Noto Sans KR",
                "fontWeight": "700", "fontSize": "0.85rem",
                "transition": "all 0.2s",
            }),
        ], style={"display": "flex", "alignItems": "center", "gap": "16px"}),

    ], style={
        "display": "flex", "justifyContent": "space-between", "alignItems": "center",
        "padding": "16px 28px", "backgroundColor": COLORS["card"],
        "borderBottom": f"1px solid {COLORS['border']}",
        "position": "sticky", "top": 0, "zIndex": 1000,
    }),

    # 메인 콘텐츠
    html.Div([
        # ── 좌측: 지도 + 요약 카드 ──────────────
        html.Div([
            # 상단 요약 카드 4개
            html.Div(id="summary-cards", style={
                "display": "grid", "gridTemplateColumns": "repeat(4, 1fr)",
                "gap": "12px", "marginBottom": "16px",
            }),

            # 지도
            html.Div([
                html.H3("📍 지역 클릭 → 상세 정보", style={
                    "color": COLORS["subtext"], "fontSize": "0.8rem",
                    "margin": "0 0 10px 0", "fontWeight": "400",
                }),
                dl.Map(
                    id="korea-map",
                    center=[36.5, 127.5],
                    zoom=7,
                    children=[
                        dl.TileLayer(
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
                            attribution='© OpenStreetMap © CARTO',
                        ),
                        dl.LayerGroup(id="map-markers"),
                    ],
                    style={
                        "height": "460px", "borderRadius": "12px",
                        "border": f"1px solid {COLORS['border']}",
                    },
                ),
            ], style={
                "backgroundColor": COLORS["card"], "borderRadius": "12px",
                "padding": "16px", "border": f"1px solid {COLORS['border']}",
            }),

        ], style={"flex": "1.4", "display": "flex", "flexDirection": "column", "gap": "0"}),

        # ── 우측: 상세 차트 ──────────────────────
        html.Div([
            # 지역 선택 드롭다운
            html.Div([
                html.Label("지역 선택", style={
                    "color": COLORS["subtext"], "fontSize": "0.8rem", "marginBottom": "6px",
                }),
                dcc.Dropdown(
                    id="region-dropdown",
                    options=[{"label": k, "value": k} for k in REGIONS],
                    value="서울 강남구",
                    clearable=False,
                    style={
                        "backgroundColor": COLORS["card"],
                        "color": COLORS["text"],
                        "border": f"1px solid {COLORS['accent']}",
                    },
                ),
            ], style={
                "backgroundColor": COLORS["card"], "borderRadius": "12px",
                "padding": "14px 16px", "border": f"1px solid {COLORS['border']}",
                "marginBottom": "12px",
            }),

            # 지역 정보 카드
            html.Div(id="region-info-card", style={"marginBottom": "12px"}),

            # 가격 분포 차트
            html.Div([
                html.H3("💰 거래가 분포", style={
                    "color": COLORS["text"], "fontSize": "0.95rem",
                    "margin": "0 0 12px 0", "fontWeight": "700",
                }),
                dcc.Graph(id="price-histogram", config={"displayModeBar": False},
                          style={"height": "200px"}),
            ], style={
                "backgroundColor": COLORS["card"], "borderRadius": "12px",
                "padding": "16px", "border": f"1px solid {COLORS['border']}",
                "marginBottom": "12px",
            }),

            # 시계열 추이
            html.Div([
                html.H3("📈 월별 평균 거래가 추이", style={
                    "color": COLORS["text"], "fontSize": "0.95rem",
                    "margin": "0 0 12px 0", "fontWeight": "700",
                }),
                dcc.Graph(id="price-trend", config={"displayModeBar": False},
                          style={"height": "200px"}),
            ], style={
                "backgroundColor": COLORS["card"], "borderRadius": "12px",
                "padding": "16px", "border": f"1px solid {COLORS['border']}",
                "marginBottom": "12px",
            }),

            # 최근 거래 목록
            html.Div([
                html.H3("📋 최근 거래 내역", style={
                    "color": COLORS["text"], "fontSize": "0.95rem",
                    "margin": "0 0 12px 0", "fontWeight": "700",
                }),
                html.Div(id="recent-trades"),
            ], style={
                "backgroundColor": COLORS["card"], "borderRadius": "12px",
                "padding": "16px", "border": f"1px solid {COLORS['border']}",
            }),

        ], style={"flex": "1", "display": "flex", "flexDirection": "column"}),

    ], style={
        "display": "flex", "gap": "16px",
        "padding": "16px 24px", "minHeight": "calc(100vh - 72px)",
        "backgroundColor": COLORS["bg"],
    }),

    # 로딩 오버레이
    dcc.Loading(id="loading", type="circle", color=COLORS["accent"],
                children=html.Div(id="loading-trigger")),

    # 데이터 저장소
    dcc.Store(id="selected-region-store", data="서울 강남구"),
    dcc.Store(id="all-regions-data", data={}),
    dcc.Interval(id="auto-refresh", interval=30 * 60 * 1000, n_intervals=0),  # 30분 자동갱신

], style={
    "fontFamily": "Noto Sans KR, sans-serif",
    "backgroundColor": COLORS["bg"],
    "minHeight": "100vh",
    "color": COLORS["text"],
})


# ── 유틸리티 함수 ─────────────────────────────

def format_price(won_man: int) -> str:
    """만원 → 억원/만원 표시"""
    if won_man >= 10000:
        uk = won_man // 10000
        man = won_man % 10000
        if man > 0:
            return f"{uk}억 {man:,}만원"
        return f"{uk}억원"
    return f"{won_man:,}만원"


def price_change_badge(pct: float) -> html.Span:
    """등락률 배지"""
    if pct > 0:
        color, arrow = COLORS["up"], "▲"
    elif pct < 0:
        color, arrow = COLORS["down"], "▼"
    else:
        color, arrow = COLORS["subtext"], "─"
    return html.Span(f"{arrow} {abs(pct):.1f}%", style={
        "color": color, "fontWeight": "700", "fontSize": "0.9rem",
    })


def make_stat_card(title: str, value: str, subtitle: str = "", color: str = None) -> html.Div:
    """통계 카드"""
    return html.Div([
        html.Div(title, style={"color": COLORS["subtext"], "fontSize": "0.72rem", "marginBottom": "6px"}),
        html.Div(value, style={
            "color": color or COLORS["text"], "fontSize": "1.15rem",
            "fontWeight": "700", "letterSpacing": "-0.5px",
        }),
        html.Div(subtitle, style={"color": COLORS["subtext"], "fontSize": "0.7rem", "marginTop": "4px"}),
    ], style={
        "backgroundColor": COLORS["card"], "borderRadius": "10px",
        "padding": "14px 16px", "border": f"1px solid {COLORS['border']}",
        "borderLeft": f"3px solid {color or COLORS['accent']}",
    })


# ── 콜백 ─────────────────────────────────────

@app.callback(
    Output("map-markers", "children"),
    Output("summary-cards", "children"),
    Input("refresh-btn", "n_clicks"),
    Input("auto-refresh", "n_intervals"),
    State("month-selector", "value"),
    prevent_initial_call=False,
)
def update_map_and_summary(n_clicks, n_intervals, n_months):
    """지도 마커 + 상단 요약 카드 업데이트"""
    today = datetime.today()
    current_ym  = today.strftime("%Y%m")
    prev_ym     = (today.replace(day=1) - timedelta(days=1)).strftime("%Y%m")

    # 주요 지역만 샘플링 (API 부하 방지: 전체 지역 순회 대신 주요 구만)
    sample_regions = [
        "서울 강남구", "서울 송파구", "서울 서초구", "서울 마포구",
        "경기 성남시", "경기 수원시", "부산 해운대구",
    ]
    markers = []
    prices = []

    for rname in list(REGIONS.keys()):
        info = REGIONS[rname]
        # 지도 마커 추가 (더미 가격 - 실제 데이터는 클릭 시 로드)
        city_color = {
            "서울": "#3b82f6", "경기": "#10b981", "인천": "#8b5cf6",
            "부산": "#f59e0b", "대구": "#ef4444", "광주": "#ec4899", "대전": "#06b6d4",
        }.get(info["city"], "#9ca3af")

        marker = dl.CircleMarker(
            center=[info["lat"], info["lng"]],
            radius=8,
            color=city_color,
            fillColor=city_color,
            fillOpacity=0.85,
            children=dl.Tooltip(rname),
            id={"type": "region-marker", "index": rname},
        )
        markers.append(marker)

    # 상단 요약 카드 (정적 정보)
    now_str = datetime.now().strftime("%Y.%m.%d %H:%M")
    cards = [
        make_stat_card("📅 마지막 갱신", now_str, "30분마다 자동 새로고침", COLORS["accent"]),
        make_stat_card("🗺️ 조회 지역 수", f"{len(REGIONS)}개 지역", "전국 주요 시·구", COLORS["purple"]),
        make_stat_card("📊 데이터 출처", "국토교통부", "아파트 매매 실거래가", COLORS["gold"]),
        make_stat_card("⏱️ 조회 기간", f"최근 {n_months}개월", "계약일 기준", COLORS["up"]),
    ]
    return markers, cards


@app.callback(
    Output("selected-region-store", "data"),
    Input("region-dropdown", "value"),
    Input({"type": "region-marker", "index": dash.ALL}, "n_clicks"),
    State({"type": "region-marker", "index": dash.ALL}, "id"),
    prevent_initial_call=True,
)
def select_region(dropdown_val, marker_clicks, marker_ids):
    """지역 선택 (드롭다운 또는 지도 마커 클릭)"""
    ctx = callback_context
    if not ctx.triggered:
        return dropdown_val

    trigger_id = ctx.triggered[0]["prop_id"]
    if "region-dropdown" in trigger_id:
        return dropdown_val

    # 마커 클릭
    if marker_clicks and any(c for c in marker_clicks if c):
        for i, clicks in enumerate(marker_clicks):
            if clicks:
                return marker_ids[i]["index"]

    return dropdown_val


@app.callback(
    Output("region-dropdown", "value"),
    Input("selected-region-store", "data"),
)
def sync_dropdown(region):
    return region


@app.callback(
    Output("region-info-card", "children"),
    Output("price-histogram", "figure"),
    Output("price-trend", "figure"),
    Output("recent-trades", "children"),
    Output("loading-trigger", "children"),
    Input("selected-region-store", "data"),
    State("month-selector", "value"),
)
def update_region_detail(region_name, n_months):
    """선택 지역 상세 정보 업데이트"""
    if not region_name:
        return no_data_msg(), empty_fig(), empty_fig(), [], ""

    summary = get_region_summary(region_name, n_months)
    df = summary.get("df", pd.DataFrame())

    # ── 지역 정보 카드 ──────────────────────────
    if df.empty:
        info_card = html.Div([
            html.Div(f"⚠️ {region_name}", style={"color": COLORS["gold"], "fontWeight": "700"}),
            html.Div("데이터가 없거나 API 키를 확인해 주세요.", style={"color": COLORS["subtext"], "fontSize": "0.85rem", "marginTop": "6px"}),
            html.Div("공공데이터포털(data.go.kr)에서 API 키를 발급받아 코드 상단 API_KEY에 입력하세요.",
                     style={"color": COLORS["subtext"], "fontSize": "0.8rem", "marginTop": "4px"}),
        ], style={
            "backgroundColor": "#1c1208", "borderRadius": "10px",
            "padding": "14px 16px", "border": f"1px solid {COLORS['gold']}",
        })
        return info_card, empty_fig("데이터 없음"), empty_fig("데이터 없음"), [], ""

    avg = summary["avg_price"]
    info_card = html.Div([
        html.Div([
            html.Span(region_name, style={
                "color": COLORS["text"], "fontSize": "1.1rem", "fontWeight": "900",
            }),
            html.Span(f"  총 {summary['count']:,}건", style={
                "color": COLORS["subtext"], "fontSize": "0.8rem", "marginLeft": "10px",
            }),
        ], style={"marginBottom": "10px"}),
        html.Div([
            html.Div([
                html.Div("평균 거래가", style={"color": COLORS["subtext"], "fontSize": "0.72rem"}),
                html.Div(format_price(avg), style={"color": COLORS["accent"], "fontWeight": "700", "fontSize": "1.05rem"}),
            ]),
            html.Div([
                html.Div("최고가", style={"color": COLORS["subtext"], "fontSize": "0.72rem"}),
                html.Div(format_price(summary["max_price"]), style={"color": COLORS["down"], "fontWeight": "700"}),
            ]),
            html.Div([
                html.Div("최저가", style={"color": COLORS["subtext"], "fontSize": "0.72rem"}),
                html.Div(format_price(summary["min_price"]), style={"color": COLORS["up"], "fontWeight": "700"}),
            ]),
            html.Div([
                html.Div("㎡당 평균", style={"color": COLORS["subtext"], "fontSize": "0.72rem"}),
                html.Div(format_price(summary["avg_per_m2"]) + "/㎡", style={"color": COLORS["gold"], "fontWeight": "700"}),
            ]),
        ], style={"display": "grid", "gridTemplateColumns": "repeat(4, 1fr)", "gap": "10px"}),
    ], style={
        "backgroundColor": COLORS["card"], "borderRadius": "12px",
        "padding": "16px", "border": f"1px solid {COLORS['accent']}",
    })

    # ── 가격 분포 히스토그램 ───────────────────────
    hist_fig = go.Figure()
    hist_fig.add_trace(go.Histogram(
        x=df["거래금액(만원)"] / 10000,  # 억원 단위
        nbinsx=30,
        marker_color=COLORS["accent"],
        marker_line_color=COLORS["bg"],
        marker_line_width=0.5,
        opacity=0.85,
    ))
    hist_fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=COLORS["text"], family="Noto Sans KR"),
        margin=dict(l=10, r=10, t=10, b=30),
        xaxis=dict(title="거래금액 (억원)", gridcolor=COLORS["border"], color=COLORS["subtext"]),
        yaxis=dict(title="건수", gridcolor=COLORS["border"], color=COLORS["subtext"]),
        bargap=0.05,
        showlegend=False,
    )

    # ── 월별 평균가 추이 ────────────────────────────
    if "조회월" in df.columns:
        monthly = df.groupby("조회월")["거래금액(만원)"].mean().reset_index()
        monthly = monthly.sort_values("조회월")
        monthly["억원"] = monthly["거래금액(만원)"] / 10000

        trend_fig = go.Figure()
        trend_fig.add_trace(go.Scatter(
            x=monthly["조회월"],
            y=monthly["억원"],
            mode="lines+markers",
            line=dict(color=COLORS["accent"], width=2.5),
            marker=dict(size=8, color=COLORS["accent"],
                        line=dict(color=COLORS["bg"], width=2)),
            fill="tozeroy",
            fillcolor=f"rgba(59,130,246,0.1)",
        ))
        trend_fig.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color=COLORS["text"], family="Noto Sans KR"),
            margin=dict(l=10, r=10, t=10, b=30),
            xaxis=dict(gridcolor=COLORS["border"], color=COLORS["subtext"]),
            yaxis=dict(title="평균 (억원)", gridcolor=COLORS["border"], color=COLORS["subtext"]),
            showlegend=False,
        )
    else:
        trend_fig = empty_fig("기간 데이터 없음")

    # ── 최근 거래 목록 ──────────────────────────────
    recent = df.sort_values("거래일자", ascending=False).head(10)
    rows = []
    for _, row in recent.iterrows():
        price_color = COLORS["down"] if row["거래금액(만원)"] >= avg * 1.1 else (
            COLORS["up"] if row["거래금액(만원)"] <= avg * 0.9 else COLORS["text"]
        )
        rows.append(html.Div([
            html.Div([
                html.Div(row["아파트명"], style={
                    "color": COLORS["text"], "fontSize": "0.85rem", "fontWeight": "700",
                }),
                html.Div(f"{row['법정동']} · {row['층']}층 · {row['전용면적(㎡)']}㎡", style={
                    "color": COLORS["subtext"], "fontSize": "0.75rem",
                }),
            ], style={"flex": 1}),
            html.Div([
                html.Div(format_price(int(row["거래금액(만원)"])), style={
                    "color": price_color, "fontWeight": "700", "fontSize": "0.9rem",
                    "textAlign": "right",
                }),
                html.Div(
                    row["거래일자"].strftime("%Y.%m.%d") if pd.notna(row["거래일자"]) else "",
                    style={"color": COLORS["subtext"], "fontSize": "0.72rem", "textAlign": "right"},
                ),
            ]),
        ], style={
            "display": "flex", "justifyContent": "space-between", "alignItems": "center",
            "padding": "8px 10px", "borderRadius": "8px",
            "borderBottom": f"1px solid {COLORS['border']}",
            "marginBottom": "4px",
            "backgroundColor": "#0f172a",
        }))

    return info_card, hist_fig, trend_fig, rows, ""


def empty_fig(msg: str = "") -> go.Figure:
    fig = go.Figure()
    if msg:
        fig.add_annotation(text=msg, x=0.5, y=0.5, showarrow=False,
                           font=dict(color=COLORS["subtext"], size=13))
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=0, r=0, t=0, b=0),
        xaxis=dict(visible=False), yaxis=dict(visible=False),
    )
    return fig


def no_data_msg():
    return html.Div("지역을 선택하세요", style={
        "color": COLORS["subtext"], "padding": "16px", "textAlign": "center",
    })


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀  실행
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    print("=" * 60)
    print("🏠 대한민국 아파트 실거래가 대시보드")
    print("=" * 60)
    print()
    if API_KEY == "여기에_API_키를_입력하세요":
        print("⚠️  [주의] API 키가 설정되지 않았습니다!")
        print("   1. https://www.data.go.kr 에서 회원가입")
        print("   2. '국토교통부_아파트 매매 실거래가 자료' 검색 후 활용신청")
        print("   3. 발급된 서비스 키를 아래 방법으로 설정:")
        print()
        print("   방법 1: 환경변수 설정")
        print("     export MOLIT_API_KEY='발급받은키'")
        print()
        print("   방법 2: 코드 직접 수정")
        print("     API_KEY = '발급받은키'  (코드 상단)")
        print()
    else:
        print(f"✅ API 키 확인: {API_KEY[:10]}...")

    print("🌐 대시보드 접속: http://localhost:8050")
    print("   Ctrl+C 로 종료")
    print()
    app.run(debug=True, port=8050)
