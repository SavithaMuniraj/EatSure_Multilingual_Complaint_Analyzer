from pathlib import Path
import re, unicodedata
import joblib
import pandas as pd
import streamlit as st
import plotly.express as px


st.set_page_config(page_title="EatSure Complaint Intelligence", page_icon="🍽️", layout="wide", initial_sidebar_state="expanded")


st.markdown("""
<style>
:root { color-scheme: light !important; }
.stApp { background: #f6f9fc !important; color: #183247 !important; --text-color: #183247; --background-color: #f6f9fc; --secondary-background-color: #ffffff; --primary-color: #147a58; }
[data-testid="stAppViewContainer"] { background: #f6f9fc !important; color: #183247 !important; }
[data-testid="stHeader"] { background: rgba(246,249,252,.96) !important; }
[data-testid="stSidebar"] { background: linear-gradient(180deg,#e9f7f1,#edf5ff) !important; border-right: 1px solid #d9e6e9; }
[data-testid="stSidebar"] * { color: #183247 !important; opacity: 1 !important; }
[data-testid="stAppViewContainer"] p, [data-testid="stAppViewContainer"] label, [data-testid="stAppViewContainer"] span, [data-testid="stAppViewContainer"] [data-testid="stMarkdownContainer"], [data-testid="stAppViewContainer"] [data-testid="stMetricLabel"], [data-testid="stAppViewContainer"] [data-testid="stMetricValue"], [data-testid="stAppViewContainer"] [data-testid="stWidgetLabel"] { color: #183247 !important; opacity: 1 !important; }
[data-testid="stMetric"] { background: #ffffff !important; border: 1px solid #d7e3eb !important; padding: .85rem !important; border-radius: 14px !important; }
[data-testid="stMetricLabel"] p { color: #496174 !important; }
[data-testid="stMetricValue"] { color: #123b33 !important; font-weight: 700 !important; }
[data-testid="stAlert"] * { color: #174a68 !important; opacity: 1 !important; }
[data-testid="stAppViewContainer"] a { color: #075f9b !important; }
[data-testid="stAppViewContainer"] button[kind="primary"] { background: #147a58 !important; border-color: #147a58 !important; }
[data-testid="stAppViewContainer"] button[kind="primary"] *, [data-testid="stAppViewContainer"] button[kind="primary"] p { color: #ffffff !important; }
.hero { background: linear-gradient(110deg,#e7f7ef,#eaf3ff); padding: 1.35rem 1.6rem; border:1px solid #d7e9e1; border-radius:18px; margin-bottom:1rem; }
.hero h1 { color:#123b33 !important; margin:0; }
.hero p { color:#31536a !important; margin:.35rem 0 0; }
.result { background:#ffffff; color:#183247; border:1px solid #dce8ee; border-left:6px solid #15966a; border-radius:14px; padding:1rem 1.2rem; }
.result * { color:#183247 !important; opacity:1 !important; }
.small-note { color:#496174; font-size:.9rem; }
</style>
""", unsafe_allow_html=True)


@st.cache_resource
def load_bundle(): return joblib.load(Path(__file__).parent / "eat_sure_models.joblib")
@st.cache_data
def load_aggregates():
    p=Path(__file__).parent/"dashboard_aggregates.csv"
    return pd.read_csv(p) if p.exists() else pd.DataFrame()


@st.cache_data
def load_subcategories():
    p=Path(__file__).parent/"dashboard_subcategories.csv"
    return pd.read_csv(p) if p.exists() else pd.DataFrame()

