from pathlib import Path
import re, unicodedata
import numpy as np
import joblib
import pandas as pd
import streamlit as st
import plotly.express as px
import requests

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

/* EatSure's GitHub-inspired, centered account screen. */
.st-key-auth_shell { max-width: 520px; margin: 2.15rem auto 0; }
.auth-mark { display:flex; align-items:center; justify-content:center; margin:0 auto .75rem; width:48px; height:48px; border-radius:50%; background:#21262d; border:1px solid #30363d; font-size:1.55rem; }
.auth-brand { text-align:center; color:#f0f6fc !important; font-size:1.55rem; font-weight:600; letter-spacing:-.025em; margin:0 0 .35rem; }
.auth-subtitle { text-align:center; color:#8b949e !important; margin:0 0 1.25rem; }
.st-key-auth_card { background:#161b22; border:1px solid #30363d; border-radius:8px; box-shadow:0 8px 26px rgba(0,0,0,.24); padding:1.2rem 1.35rem .55rem; }
.auth-caption { text-align:center; color:#8b949e !important; font-size:.85rem; margin:.7rem 0 .8rem; }
.st-key-auth_links { max-width:520px; margin:.65rem auto 0; text-align:center; }
.stApp:has(.st-key-auth_shell), .stApp:has(.st-key-auth_shell) [data-testid="stAppViewContainer"] { background:#0d1117 !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stHeader"] { background:#0d1117 !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stAppViewContainer"] p,
.stApp:has(.st-key-auth_shell) [data-testid="stAppViewContainer"] label,
.stApp:has(.st-key-auth_shell) [data-testid="stAppViewContainer"] span,
.stApp:has(.st-key-auth_shell) [data-testid="stAppViewContainer"] [data-testid="stWidgetLabel"] { color:#c9d1d9 !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stTextInput"] input { background:#0d1117 !important; color:#f0f6fc !important; border:1px solid #30363d !important; border-radius:6px !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stTextInput"] input:focus { border-color:#2f81f7 !important; box-shadow:0 0 0 3px rgba(47,129,247,.25) !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stTextInput"] input::placeholder { color:#6e7681 !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stTabs"] [role="tablist"] { gap:.3rem; border-bottom:1px solid #30363d; }
.stApp:has(.st-key-auth_shell) [data-testid="stTabs"] button[role="tab"] { color:#8b949e !important; background:transparent !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stTabs"] button[role="tab"][aria-selected="true"] { color:#f0f6fc !important; border-bottom:2px solid #f78166 !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stFormSubmitButton"] button { background:#238636 !important; border:1px solid rgba(240,246,252,.1) !important; border-radius:6px !important; color:#fff !important; font-weight:600 !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stFormSubmitButton"] button:hover { background:#2ea043 !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stButton"] button { background:#21262d !important; color:#f0f6fc !important; border:1px solid #30363d !important; border-radius:6px !important; }
.stApp:has(.st-key-auth_shell) [data-testid="stAlert"] { background:#161b22 !important; border:1px solid #30363d !important; }
.stApp:has(.st-key-auth_shell) a { color:#58a6ff !important; }
@media (max-width: 700px) { .st-key-auth_shell { margin-top:.65rem; } .st-key-auth_card { padding:1rem .75rem .4rem; } }

/* Keep form controls and open menus readable even when the viewer prefers dark mode. */
[data-testid="stSelectbox"] [role="group"] { background-color: #ffffff !important; border: 1px solid #b8c9d5 !important; border-radius: .5rem !important; }
[data-testid="stSelectbox"] [role="combobox"] { background: transparent !important; color: #183247 !important; -webkit-text-fill-color: #183247 !important; }
[data-testid="stSelectbox"] [role="group"] svg { color: #52697a !important; }
[data-testid="stCheckbox"] label > div:first-of-type { background-color: #ffffff !important; border: 1px solid #52697a !important; }
[data-testid="stCheckbox"] label:has(input:checked) > div:first-of-type { background-color: #147a58 !important; border-color: #147a58 !important; }

[data-testid="stTextArea"] textarea, [data-testid="stTextInput"] input, [data-testid="stNumberInput"] input, [data-baseweb="select"] > div, [data-baseweb="select"] input { background-color: #ffffff !important; color: #183247 !important; -webkit-text-fill-color: #183247 !important; border-color: #b8c9d5 !important; }
[data-testid="stTextArea"] textarea::placeholder, [data-testid="stTextInput"] input::placeholder { color: #647b8d !important; -webkit-text-fill-color: #647b8d !important; }
[data-baseweb="popover"], [data-baseweb="popover"] > div, [data-baseweb="menu"], [role="listbox"], [role="option"] { background-color: #ffffff !important; color: #183247 !important; }
[role="option"]:hover, [aria-selected="true"][role="option"] { background-color: #e6f3ed !important; color: #123b33 !important; }
[data-testid="stCheckbox"] [role="checkbox"] { background-color: #ffffff !important; border: 1px solid #52697a !important; }
[data-testid="stCheckbox"] [role="checkbox"][aria-checked="true"] { background-color: #147a58 !important; border-color: #147a58 !important; }
[data-testid="stCheckbox"] [role="checkbox"][aria-checked="true"] svg { color: #ffffff !important; fill: #ffffff !important; }
input[type="checkbox"] { accent-color: #147a58 !important; }
button[kind="primary"], [data-testid="stFormSubmitButton"] button { background: #147a58 !important; border-color: #147a58 !important; }
button[kind="primary"] *, [data-testid="stFormSubmitButton"] button * { color: #ffffff !important; }
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

@st.cache_data
def load_marginals():
    p=Path(__file__).parent/"dashboard_marginals.csv"
    return pd.read_csv(p) if p.exists() else pd.DataFrame()

@st.cache_data
def load_customer_activity():
    """Return customer-level aggregates only; never expose complaint text here."""
    path=Path(__file__).parent/"eatsure_complaints_feedback.csv"
    if not path.exists(): return pd.DataFrame()
    columns=["complaint_id","customer_id","complaint_timestamp","category"]
    data=pd.read_csv(path,usecols=lambda name:name in columns)
    if "customer_id" not in data or "complaint_timestamp" not in data: return pd.DataFrame()
    data["customer_id"]=data["customer_id"].fillna("").astype(str).str.strip()
    data=data[data.customer_id.ne("")]
    data["complaint_timestamp"]=pd.to_datetime(data["complaint_timestamp"],errors="coerce",utc=True).dt.tz_convert(None)
    aggregations={"total_complaints":("customer_id","size"),"first_complaint":("complaint_timestamp","min"),"last_complaint":("complaint_timestamp","max")}
    customers=data.groupby("customer_id",as_index=False).agg(**aggregations)
    if "category" in data:
        top=data.dropna(subset=["category"]).groupby(["customer_id","category"]).size().rename("n").reset_index()
        top=top.sort_values(["customer_id","n","category"],ascending=[True,False,True]).drop_duplicates("customer_id")
        customers=customers.merge(top[["customer_id","category"]].rename(columns={"category":"common_category"}),on="customer_id",how="left")
    else: customers["common_category"]="—"
    customers["cohort"]=np.where(customers.total_complaints.gt(1),"Repeat complainant","One recorded complaint")
    return customers

bundle=load_bundle(); vectorizer=bundle["vectorizer"]

def auth_config():
    try:
        return {
            "supabase_url": st.secrets["SUPABASE_URL"].rstrip("/"),
            "supabase_anon_key": st.secrets["SUPABASE_ANON_KEY"],
            "username_login_url": st.secrets["USERNAME_LOGIN_URL"],
            "auth_redirect_url": st.secrets.get("AUTH_REDIRECT_URL", "https://eatsuremultilingualcomplaintanalyzer-tyctof4c6nrp9wrcpwtrrf.streamlit.app/"),
        }
    except Exception:
        return None

def auth_request(path, payload, access_token=None, query_params=None):
    cfg=auth_config()
    if not cfg: raise RuntimeError("Authentication is not configured yet. Add the Supabase values to Streamlit secrets.")
    headers={"apikey":cfg["supabase_anon_key"],"Content-Type":"application/json"}
    if access_token: headers["Authorization"]=f"Bearer {access_token}"
    response=requests.post(f'{cfg["supabase_url"]}/auth/v1/{path}',params=query_params,json=payload,headers=headers,timeout=20)
    if not response.ok:
        try: detail=response.json().get("msg") or response.json().get("message") or "Request failed."
        except Exception: detail="Request failed."
        raise RuntimeError(detail)
    return response.json() if response.content else {}

def gateway_request(payload):
    cfg=auth_config()
    if not cfg: raise RuntimeError("Authentication is not configured yet.")
    response=requests.post(cfg["username_login_url"],json=payload,headers={
        "apikey":cfg["supabase_anon_key"],"Authorization":f'Bearer {cfg["supabase_anon_key"]}',
        "Content-Type":"application/json",
    },timeout=20)
    if not response.ok:
        raise RuntimeError(response.json().get("error","Authentication request failed."))
    return response.json()

def customer_profiles_request(method,params=None,payload=None):
    cfg=auth_config(); token=st.session_state.get("auth_access_token")
    if not cfg or not token: raise RuntimeError("Sign in again to access customer details.")
    headers={"apikey":cfg["supabase_anon_key"],"Authorization":f"Bearer {token}","Content-Type":"application/json"}
    if method.upper()=="POST": headers["Prefer"]="resolution=merge-duplicates,return=representation"
    response=requests.request(method,f'{cfg["supabase_url"]}/rest/v1/customer_profiles',params=params,json=payload,headers=headers,timeout=20)
    if not response.ok:
        try: message=response.json().get("message") or response.json().get("hint") or "Customer details could not be loaded."
        except Exception: message="Customer details could not be loaded."
        if response.status_code==404: message="Customer workspace is not initialized. Apply supabase/customer_profiles.sql in the Supabase SQL Editor, then refresh."
        raise RuntimeError(message)
    return response.json() if response.content else []

def render_auth_page():
    left,center,right=st.columns([1,2,1])
    with center:
        with st.container(key="auth_shell"):
            st.markdown('<div class="auth-mark">🍽️</div><div class="auth-brand">EatSure Intelligence</div><div class="auth-subtitle">Sign in to continue to your account</div>',unsafe_allow_html=True)
            with st.container(key="auth_card"):
                if not auth_config():
                    st.info("Account access is being configured. The app owner must connect Supabase and an email delivery provider before public registration can work.")
                    st.stop()
                tabs=st.tabs(["Log in","Sign up","Forgot password"])
                with tabs[0]:
                    with st.form("login_form"):
                        username=st.text_input("Username or email",placeholder="Username or Gmail address")
                        password=st.text_input("Password",type="password")
                        do_login=st.form_submit_button("Sign in",type="primary",use_container_width=True)
                    if do_login:
                        try:
                            session=gateway_request({"action":"login","username":username.strip(),"password":password})
                            st.session_state["auth_access_token"]=session["access_token"]
                            st.session_state["auth_user"]=session["user"]
                            st.rerun()
                        except Exception as exc: st.error(str(exc))
                    st.markdown('<div class="auth-divider">OR</div>',unsafe_allow_html=True)
                    if st.button("Continue with Google",key="google_oauth_button",use_container_width=True):
                        st.info("Google sign-in is not connected yet. The app owner must enable Google in Supabase Authentication → Sign In / Providers and add the Google OAuth credentials and redirect URL.")
                    st.markdown('<p class="auth-caption">Use your EatSure username or the Gmail address on your account.</p>',unsafe_allow_html=True)
                with tabs[1]:
                    with st.form("signup_form"):
                        email=st.text_input("Gmail address",placeholder="name@gmail.com")
                        username=st.text_input("Create username",max_chars=30)
                        password=st.text_input("Create password",type="password")
                        confirm=st.text_input("Confirm password",type="password")
                        do_signup=st.form_submit_button("Create account",type="primary",use_container_width=True)
                    if do_signup:
                        if not re.fullmatch(r"[A-Za-z0-9_]{3,30}",username.strip()): st.error("Use 3–30 letters, numbers, or underscores for your username.")
                        elif not email.strip().lower().endswith("@gmail.com"): st.error("Enter a Gmail address ending in @gmail.com.")
                        elif len(password)<5: st.error("Use a password with at least 5 characters.")
                        elif password!=confirm: st.error("The passwords do not match.")
                        else:
                            try:
                                cfg=auth_config()
                                signup_result=auth_request("signup",{"email":email.strip().lower(),"password":password,"data":{"username":username.strip()}},query_params={"redirect_to":cfg["auth_redirect_url"]})
                                signup_user=signup_result.get("user") or {}
                                if signup_user.get("identities")==[]:
                                    st.error("An account already exists for this Gmail. Log in with your username or use Forgot password.")
                                else:
                                    st.session_state["pending_signup_email"]=email.strip().lower()
                                    st.success("Account created. Confirm your Gmail to finish signing up.")
                            except Exception as exc:
                                detail=str(exc).lower()
                                if "already registered" in detail or "already exists" in detail:
                                    st.error("An account already exists for this Gmail. Log in with your username or use Forgot password.")
                                elif "rate limit" in detail or "too many" in detail:
                                    st.error("Too many verification emails were requested. Wait a little while, then try Resend code.")
                                else:
                                    st.error(str(exc))
                    if st.session_state.get("pending_signup_email"):
                        with st.container(border=True):
                            st.caption("Gmail confirmation")
                            st.write("Open Gmail and click the confirmation link to activate your account. Then return here and sign in.")
                            open_col,resend_col=st.columns([1,1])
                            with open_col:
                                st.link_button("Open Gmail", "https://mail.google.com/", use_container_width=True)
                            with resend_col:
                                resend_signup=st.button("Resend email",key="resend_signup_email",use_container_width=True)
                        if resend_signup:
                            try:
                                auth_request("resend",{"email":st.session_state["pending_signup_email"],"type":"signup"},query_params={"redirect_to":auth_config()["auth_redirect_url"]})
                                st.success("A fresh confirmation link was sent. Check Gmail and its spam folder.")
                            except Exception as exc:
                                detail=str(exc).lower()
                                if "rate limit" in detail or "too many" in detail:
                                    st.error("Supabase has temporarily limited confirmation emails. Wait a little, then try again.")
                                else:
                                    st.error(str(exc))
                with tabs[2]:
                    st.caption("Request a one-time code using the Gmail address or username on your account.")
                    with st.form("reset_request_form"):
                        account=st.text_input("Gmail address or username")
                        request_code=st.form_submit_button("Send reset code")
                    if request_code:
                        try:
                            gateway_request({"action":"reset_request","account":account.strip()})
                            st.session_state["reset_account"]=account.strip()
                            st.success("If the account exists, a reset code has been sent to its Gmail.")
                        except Exception as exc:
                            detail=str(exc).lower()
                            if "rate limit" in detail or "too many" in detail or "429" in detail:
                                st.error("Email sending is temporarily rate-limited. Wait before requesting another code, or configure custom SMTP for reliable delivery.")
                            else:
                                st.error(str(exc))
                    if st.session_state.get("reset_account"):
                        with st.form("reset_verify_form"):
                            reset_code=st.text_input("Email reset code",max_chars=6,placeholder="Enter 6-digit code")
                            new_password=st.text_input("New password",type="password")
                            confirm_new=st.text_input("Confirm new password",type="password")
                            reset=st.form_submit_button("Reset password",type="primary")
                        if reset:
                            if len(new_password)<5: st.error("Use a password with at least 5 characters.")
                            elif new_password!=confirm_new: st.error("The passwords do not match.")
                            elif not re.fullmatch(r"\d{6}",reset_code.strip()): st.error("Enter the 6-digit code from your email.")
                            else:
                                try:
                                    gateway_request({"action":"reset_complete","account":st.session_state["reset_account"],"token":reset_code.strip(),"password":new_password})
                                    del st.session_state["reset_account"]
                                    st.success("Password reset. You can now log in with your username and new password.")
                                except Exception as exc: st.error(str(exc))
            with st.container(key="auth_links"):
                st.caption("Create an account or use Forgot password to recover access.")
    st.stop()

if not st.session_state.get("auth_access_token"):
    render_auth_page()

auth_user=st.session_state.get("auth_user") or {}
auth_email=auth_user.get("email", "")
auth_username=(auth_user.get("user_metadata") or {}).get("username", "")
st.sidebar.title("EatSure Intelligence")
st.sidebar.caption(f"Signed in as {auth_username or auth_email}")
if st.sidebar.button("Log out",use_container_width=True):
    st.session_state.pop("auth_access_token",None)
    st.session_state.pop("auth_user",None)
    st.rerun()
SUPPORTED={"english / hinglish","english","hinglish","hindi","tamil","telugu","kannada"}
LANG_OPTIONS=["Auto detect","English","Hinglish","Hindi","Tamil","Telugu","Kannada","Malayalam","Bengali","Gujarati","Punjabi","Other / unsure"]

def clean_text(text):
    text=unicodedata.normalize("NFC",str(text)).lower()
    text=re.sub(r"https?://\S+|www\.\S+"," URL ",text)
    text=re.sub(r"\b(?:es|cmp|cust)\d+\b"," ID ",text,flags=re.I)
    text=re.sub(r"(?:₹|rs\.?|inr)\s*\d+(?:\.\d+)?"," AMOUNT ",text,flags=re.I)
    return re.sub(r"\s+"," ",text).strip()

def script_language(text):
    ranges=[("Malayalam",0x0D00,0x0D7F),("Tamil",0x0B80,0x0BFF),("Telugu",0x0C00,0x0C7F),("Kannada",0x0C80,0x0CFF),("Hindi",0x0900,0x097F),("Bengali",0x0980,0x09FF),("Gujarati",0x0A80,0x0AFF),("Punjabi",0x0A00,0x0A7F)]
    counts={name:sum(lo<=ord(ch)<=hi for ch in str(text)) for name,lo,hi in ranges}
    latin=sum(ch.isascii() and ch.isalpha() for ch in str(text))
    name=max(counts,key=counts.get) if counts and max(counts.values(),default=0)>0 else ("English / Hinglish" if latin else "Unknown")
    return name

def analyze(text, chosen="Auto detect", translate=False):
    text=str(text).strip()
    language=script_language(text) if chosen=="Auto detect" else chosen
    if language not in LANG_OPTIONS: language="Other / unsure"
    if language in {"Other / unsure","Malayalam","Bengali","Gujarati","Punjabi"} or (language=="Auto detect"):
        return {"supported":False,"language":language,"category":"Manual review","confidence":None,"subcategory":"—","sentiment":"—","priority":"—","translated":"","note":"This language is outside the classifier's supported languages. Please route it for manual review."}
    raw=vectorizer.transform([clean_text(text)])
    model=bundle["category_model"]
    probs=model.predict_proba(raw)[0] if hasattr(model,"predict_proba") else None
    pred=str(model.classes_[int(probs.argmax())]) if probs is not None else str(model.predict(raw)[0])
    conf=float(probs.max()) if probs is not None else None
    # Explain the predicted label with the strongest positive character n-gram
    # evidence, grouped back into readable words from the original complaint.
    top_features=[]
    if hasattr(model,"coef_"):
        class_index=list(model.classes_).index(pred)
        coef=model.coef_
        if coef.shape[0]==1 and len(model.classes_)==2:
            class_weights=coef[0] if class_index==1 else -coef[0]
        else:
            class_weights=coef[class_index]
    elif hasattr(model,"feature_log_prob_"):
        class_index=list(model.classes_).index(pred)
        other=np.delete(model.feature_log_prob_,class_index,axis=0)
        class_weights=model.feature_log_prob_[class_index]-other.max(axis=0)
    else:
        class_weights=None
    if class_weights is not None:
        feature_names=vectorizer.get_feature_names_out()
        row=raw.tocsr()
        evidence={}
        words=re.findall(r"[^\W_]+",clean_text(text),flags=re.UNICODE)
        unique_words=list(dict.fromkeys(words))
        for feature_index,value in zip(row.indices,row.data):
            contribution=float(value*class_weights[feature_index])
            if contribution<=0:
                continue
            gram=str(feature_names[feature_index])
            owners=[word for word in unique_words if gram in f" {word} "]
            if not owners:
                continue
            share=contribution/len(owners)
            for word in owners:
                evidence[word]=evidence.get(word,0.0)+share
        top_features=[word for word,score in sorted(evidence.items(),key=lambda item:item[1],reverse=True)[:4] if score>0]
    def optional(key):
        m=bundle.get(key+"_model")
        return str(m.predict(raw)[0]) if m is not None else "Not available"
    translated=""; note=""
    if translate:
        try:
            from deep_translator import GoogleTranslator
            code={"English":"en","Hinglish":"en","English / Hinglish":"en","Hindi":"hi","Tamil":"ta","Telugu":"te","Kannada":"kn"}.get(language)
            translated=GoogleTranslator(source=code or "auto",target="en").translate(text) or ""
        except Exception as exc:
            note="Translation could not be completed right now. The original text was still analyzed."
    return {"supported":True,"language":language,"category":pred,"confidence":conf,"top_features":top_features,"subcategory":optional("subcategory"),"sentiment":optional("sentiment"),"priority":optional("priority"),"translated":translated,"note":note}

def confidence_label(conf):
    if conf is None: return "Needs review"
    return "High confidence" if conf>=.75 else "Review recommended" if conf>=.50 else "Manual review recommended"

page=st.sidebar.radio("Navigate",["Overview","Analyze complaint","Batch analysis","Customers","Insights","About the model"])
st.sidebar.caption("Multilingual • code-mixed • character n-gram NLP")

if page=="Overview":
    st.markdown('<div class="hero"><h1>Complaint Intelligence</h1><p>Understand customer issues across English and Indian languages, then prioritize the next action.</p></div>',unsafe_allow_html=True)
    ag=load_aggregates()
    cols=st.columns(4)
    for col,label,value in zip(cols,["Categories","Supported languages","Model test accuracy","Test macro-F1"],[len(bundle["labels"]["category"]),"6",f'{bundle["metadata"].get("test_accuracy",0):.1%}',f'{bundle["metadata"].get("test_macro_f1",0):.1%}']): col.metric(label,value)
    st.subheader("Start with a task")
    a,b,c=st.columns(3)
    a.info("**Analyze one complaint**\n\nDetect language, classify the issue, and see which words most influenced the category.")
    b.info("**Analyze a CSV**\n\nAdd model results to a file and download it for follow-up.")
    c.info("**Explore patterns**\n\nFilter aggregate trends by category, language, priority, and channel.")
    st.caption("Predictions are decision support. Confirm low-confidence or sensitive cases with a human reviewer.")

elif page=="Analyze complaint":
    st.markdown('<div class="hero"><h1>Analyze a complaint</h1><p>Enter the customer complaint. Language detection is script-based; you can override it below.</p></div>',unsafe_allow_html=True)
    with st.form("single"):
        complaint=st.text_area("Customer complaint",height=150,placeholder="Example: मेरा पैसा कट गया लेकिन ऑर्डर नहीं हुआ।")
        c1,c2=st.columns([1,1]); language=c1.selectbox("Language",LANG_OPTIONS); do_translate=c2.checkbox("Also translate to English",value=False)
        submitted=st.form_submit_button("Analyze complaint",type="primary",use_container_width=True)
    if submitted:
        if not complaint.strip(): st.warning("Enter a complaint first.")
        else:
            r=analyze(complaint,language,do_translate)
            if not r["supported"]: st.warning(r["note"])
            else:
                st.markdown(f'<div class="result"><h3>Suggested category: {r["category"]}</h3><p>Detected/selected language: {r["language"]} · {confidence_label(r["confidence"])}</p></div>',unsafe_allow_html=True)
                m1,m2,m3=st.columns(3)
                m1.markdown("**Top category signals**")
                if r["top_features"]:
                    m1.markdown(" ".join(f"`{feature}`" for feature in r["top_features"]))
                else:
                    m1.caption("No clear word-level signals available")
                m2.metric("Suggested sentiment",r["sentiment"]); m3.metric("Suggested priority",r["priority"])
                st.caption("Signals are words from the complaint that most supported the suggested category. They explain this model prediction and are not causal evidence.")
                with st.expander("Analysis details",expanded=True):
                    st.write("**Suggested subcategory:**",r["subcategory"])
                    st.write("**Original complaint:**",complaint)
                    if r["translated"]: st.write("**English translation:**",r["translated"])
                    if r["note"]: st.info(r["note"])
                    st.caption("Translation is an optional reading aid; classification uses the original complaint text.")
                st.subheader("Help improve review quality")
                with st.form("feedback"):
                    corrected=st.selectbox("If the category is wrong, select the correct category",["No correction"]+bundle["labels"]["category"])
                    st.text_area("Reviewer note (optional)")
                    st.form_submit_button("Record feedback locally",help="Feedback is not uploaded or persisted by this demo app.")

elif page=="Batch analysis":
    st.markdown('<div class="hero"><h1>Batch analysis</h1><p>Upload a CSV containing a complaint text column, then download a copy with suggested model outputs.</p></div>',unsafe_allow_html=True)
    upload=st.file_uploader("Upload CSV",type=["csv"])
    if upload:
        try:
            data=pd.read_csv(upload)
            text_col=st.selectbox("Complaint text column",data.columns.tolist(),index=data.columns.tolist().index("complaint_text") if "complaint_text" in data.columns else 0)
            lang_col=st.selectbox("Language column (optional)",["Auto detect"]+data.columns.tolist())
            if st.button("Analyze uploaded complaints",type="primary"):
                with st.spinner("Analyzing rows..."):
                    results=[]
                    for _,row in data.iterrows():
                        selected="Auto detect"
                        if lang_col!="Auto detect" and pd.notna(row[lang_col]):
                            val=str(row[lang_col]).strip().lower()
                            selected=next((x for x in LANG_OPTIONS if x.lower()==val),"Auto detect")
                        r=analyze(row[text_col],selected,False)
                        results.append({"detected_language":r["language"],"suggested_category":r["category"],"top_category_signals":", ".join(r.get("top_features",[])) or "—","review_status":confidence_label(r["confidence"]),"suggested_subcategory":r["subcategory"],"suggested_sentiment":r["sentiment"],"suggested_priority":r["priority"]})
                    result=pd.concat([data.reset_index(drop=True),pd.DataFrame(results)],axis=1)
                    st.session_state["batch_result"]=result
        except Exception as exc: st.error(f"Could not read or analyze this CSV: {exc}")
    result=st.session_state.get("batch_result")
    if result is not None:
        st.success(f"Analyzed {len(result):,} rows")
        st.dataframe(result.head(100),use_container_width=True,hide_index=True)
        st.download_button("Download analyzed CSV",result.to_csv(index=False).encode("utf-8-sig"),"eatsure_analyzed_complaints.csv","text/csv",type="primary")

elif page=="Customers":
    st.markdown('<div class="hero"><h1>Customer workspace</h1><p>Review customer-level complaint patterns and maintain private customer details for your account.</p></div>',unsafe_allow_html=True)
    activity=load_customer_activity()
    if activity.empty:
        st.info("No customer IDs were found in the bundled complaint dataset.")
    else:
        user=st.session_state.get("auth_user") or {}
        owner_id=user.get("id")
        try:
            profiles=customer_profiles_request("GET",{"select":"customer_ref,display_name,email,phone,notes,updated_at","owner_id":f"eq.{owner_id}","order":"updated_at.desc"})
            profile_frame=pd.DataFrame(profiles)
        except Exception as exc:
            profiles=[]; profile_frame=pd.DataFrame()
            st.error(str(exc))
        if profile_frame.empty:
            profile_frame=pd.DataFrame(columns=["customer_ref","display_name","email","phone","notes"])
        customers=activity.merge(profile_frame,left_on="customer_id",right_on="customer_ref",how="left")
        customers=customers.fillna({"display_name":"","email":"","phone":"","notes":"","common_category":"—"})
        one_time=int(customers.total_complaints.eq(1).sum())
        repeat=int(customers.total_complaints.gt(1).sum())
        repeat_complaints=int(customers.loc[customers.total_complaints.gt(1),"total_complaints"].sum())
        k1,k2,k3,k4=st.columns(4)
        k1.metric("Total customers",f"{len(customers):,}")
        k2.metric("One recorded complaint",f"{one_time:,}")
        k3.metric("Repeat complainants",f"{repeat:,}")
        k4.metric("Complaints from repeat customers",f"{repeat_complaints:,}")
        st.caption("“One recorded complaint” means one complaint in the supplied dataset; it may not mean the customer's first complaint ever. Complaint text is not shown or copied into the customer profile table.")
        left,right=st.columns([1,1.35])
        cohort_counts=pd.DataFrame({"Customer group":["One recorded complaint","Repeat complainant"],"Customers":[one_time,repeat]})
        left.plotly_chart(px.bar(cohort_counts,x="Customer group",y="Customers",color="Customer group",color_discrete_sequence=["#43a982","#4679c6"],title="One-time and repeat customers"),use_container_width=True,showlegend=False)
        repeat_table=customers[customers.total_complaints.gt(1)].sort_values(["total_complaints","last_complaint"],ascending=[False,False]).head(10)
        right.subheader("Most frequent complainants")
        if repeat_table.empty: right.info("No repeat complainants in the dataset.")
        else: right.dataframe(repeat_table[["customer_id","total_complaints","common_category","last_complaint"]].rename(columns={"customer_id":"Customer ID","total_complaints":"Complaints","common_category":"Most common category","last_complaint":"Most recent complaint"}),use_container_width=True,hide_index=True)
        st.subheader("Customer details")
        query=st.text_input("Search by customer ID or display name",placeholder="Type a customer ID or name")
        visible=customers.copy()
        if query.strip():
            needle=query.strip().casefold()
            visible=visible[visible.customer_id.str.casefold().str.contains(needle,regex=False)|visible.display_name.astype(str).str.casefold().str.contains(needle,regex=False)]
        st.dataframe(visible[["customer_id","display_name","total_complaints","cohort","common_category","first_complaint","last_complaint"]].rename(columns={"customer_id":"Customer ID","display_name":"Name","total_complaints":"Complaints","cohort":"Complaint group","common_category":"Most common category","first_complaint":"First recorded complaint","last_complaint":"Latest complaint"}),use_container_width=True,hide_index=True,height=360)
        st.subheader("Edit customer")
        customer_ref=st.selectbox("Select customer",customers.customer_id.tolist(),format_func=lambda ref: f"{customers.loc[customers.customer_id.eq(ref),'display_name'].iloc[0] or ref} · {int(customers.loc[customers.customer_id.eq(ref),'total_complaints'].iloc[0])} complaint(s)")
        selected=customers.loc[customers.customer_id.eq(customer_ref)].iloc[0]
        with st.form("edit_customer_details"):
            name=st.text_input("Customer name",value=str(selected.display_name),max_chars=120)
            c1,c2=st.columns(2)
            email=c1.text_input("Email (optional)",value=str(selected.email),max_chars=254)
            phone=c2.text_input("Phone (optional)",value=str(selected.phone),max_chars=40)
            notes=st.text_area("Private notes (optional)",value=str(selected.notes),max_chars=1000)
            save_customer=st.form_submit_button("Save customer details",type="primary")
        if save_customer:
            try:
                customer_profiles_request("POST",{"on_conflict":"owner_id,customer_ref"},{"owner_id":owner_id,"customer_ref":str(customer_ref),"display_name":name.strip() or None,"email":email.strip() or None,"phone":phone.strip() or None,"notes":notes.strip() or None})
                st.success("Customer details saved to your private workspace.")
                st.rerun()
            except Exception as exc: st.error(str(exc))

elif page=="Insights":
    st.markdown('<div class="hero"><h1>Complaint insights</h1><p>Explore coarser grouped patterns. No complaint-level records or customer identifiers are included.</p></div>',unsafe_allow_html=True)
    ag=load_aggregates(); subs=load_subcategories(); marg=load_marginals()
    if ag.empty: st.info("No aggregate dashboard file found.")
    else:
        chosen={}
        with st.expander("Filters",expanded=True):
            grid=st.columns(3)
            for i,col in enumerate(["month","category","language"]):
                opts=sorted(ag[col].dropna().astype(str).unique().tolist())
                chosen[col]=grid[i].multiselect(col.replace("_"," ").title(),opts,default=[])
        view=ag.copy()
        for col,vals in chosen.items():
            if vals: view=view[view[col].astype(str).isin(vals)]
        total=int(view.complaint_count.sum()) if not view.empty else 0
        a,b,c=st.columns(3); a.metric("Complaints in selection",f"{total:,}"); b.metric("Categories represented",view.category.nunique() if total else 0); c.metric("Languages represented",view.language.nunique() if total else 0)
        if not view.empty:
            left,right=st.columns(2)
            category=view.groupby("category",as_index=False).complaint_count.sum().sort_values("complaint_count",ascending=False)
            lang=view.groupby("language",as_index=False).complaint_count.sum().sort_values("complaint_count",ascending=False)
            left.plotly_chart(px.bar(category,x="category",y="complaint_count",color="category",title="Complaints by category",color_discrete_sequence=px.colors.qualitative.Set2),use_container_width=True)
            right.plotly_chart(px.bar(lang,x="language",y="complaint_count",color="language",title="Complaints by language",color_discrete_sequence=px.colors.qualitative.Pastel),use_container_width=True)
            c1,c2=st.columns(2)
            if not subs.empty:
                subview=subs.copy()
                if chosen["category"]: subview=subview[subview.category.astype(str).isin(chosen["category"])]
                c1.plotly_chart(px.sunburst(subview,path=["category","sub_category"],values="complaint_count",title="Category → subcategory (overall counts)"),use_container_width=True)
            if not marg.empty:
                priority=marg[marg.dimension=="priority"].sort_values("complaint_count",ascending=False)
                c2.plotly_chart(px.bar(priority,x="value",y="complaint_count",color="value",title="Priority mix (overall counts)"),use_container_width=True)
            sentiment=marg[marg.dimension=="sentiment"].sort_values("complaint_count",ascending=False)
            st.plotly_chart(px.bar(sentiment,x="value",y="complaint_count",color="value",title="Sentiment mix (overall counts)"),use_container_width=True)
            st.caption("Category and language charts respond to the filters. Subcategory, priority, and sentiment charts show overall grouped counts.")
        else: st.info("No rows match these filters.")

else:
    st.markdown('<div class="hero"><h1>About the model</h1><p>How this project turns multilingual complaint text into reviewable decision support.</p></div>',unsafe_allow_html=True)
    st.subheader("Model pipeline")
    st.markdown("1. Normalize the complaint while preserving its script.\n2. Represent it with character-level TF-IDF n-grams (2–5 characters).\n3. Classify into the learned complaint category.\n4. Show confidence and mark uncertain cases for human review.\n5. Optionally display an English translation as a reading aid.")
    st.subheader("Evaluation")
    st.write(f"Selected model: **{bundle['metadata'].get('selected_model','Unknown')}**")
    a,b=st.columns(2); a.metric("Held-out accuracy",f"{bundle['metadata'].get('test_accuracy',0):.1%}"); b.metric("Held-out macro-F1",f"{bundle['metadata'].get('test_macro_f1',0):.1%}")
    st.write("Category labels:",", ".join(bundle["labels"]["category"]))
    st.caption("Language auto-detection relies mainly on writing script, so Latin-script English and Hinglish can be difficult to distinguish. Confirm or override the language selection. Translation and model outputs can be wrong; use human review for consequential decisions.")
