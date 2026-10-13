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

/* Keep form controls and open menus readable even when the viewer prefers dark mode. */
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

bundle=load_bundle(); vectorizer=bundle["vectorizer"]
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
    return {"supported":True,"language":language,"category":pred,"confidence":conf,"subcategory":optional("subcategory"),"sentiment":optional("sentiment"),"priority":optional("priority"),"translated":translated,"note":note}

def confidence_label(conf):
    if conf is None: return "Needs review"
    return "High confidence" if conf>=.75 else "Review recommended" if conf>=.50 else "Manual review recommended"

st.sidebar.title("EatSure Intelligence")
page=st.sidebar.radio("Navigate",["Overview","Analyze complaint","Batch analysis","Insights","About the model"])
st.sidebar.caption("Multilingual • code-mixed • character n-gram NLP")

if page=="Overview":
    st.markdown('<div class="hero"><h1>Complaint Intelligence</h1><p>Understand customer issues across English and Indian languages, then prioritize the next action.</p></div>',unsafe_allow_html=True)
    ag=load_aggregates()
    cols=st.columns(4)
    for col,label,value in zip(cols,["Categories","Supported languages","Model test accuracy","Test macro-F1"],[len(bundle["labels"]["category"]),"6",f'{bundle["metadata"].get("test_accuracy",0):.1%}',f'{bundle["metadata"].get("test_macro_f1",0):.1%}']): col.metric(label,value)
    st.subheader("Start with a task")
    a,b,c=st.columns(3)
    a.info("**Analyze one complaint**\n\nDetect language, classify the issue, and review confidence.")
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
                st.markdown(f'<div class="result"><h3>Suggested category: {r["category"]}</h3><p>{confidence_label(r["confidence"])} · Detected/selected language: {r["language"]}</p></div>',unsafe_allow_html=True)
                m1,m2,m3=st.columns(3); m1.metric("Confidence",f'{r["confidence"]:.1%}' if r["confidence"] is not None else "N/A"); m2.metric("Suggested sentiment",r["sentiment"]); m3.metric("Suggested priority",r["priority"])
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
                        results.append({"detected_language":r["language"],"suggested_category":r["category"],"confidence":r["confidence"],"review_status":confidence_label(r["confidence"]),"suggested_subcategory":r["subcategory"],"suggested_sentiment":r["sentiment"],"suggested_priority":r["priority"]})
                    result=pd.concat([data.reset_index(drop=True),pd.DataFrame(results)],axis=1)
                    st.session_state["batch_result"]=result
        except Exception as exc: st.error(f"Could not read or analyze this CSV: {exc}")
    result=st.session_state.get("batch_result")
    if result is not None:
        st.success(f"Analyzed {len(result):,} rows")
        st.dataframe(result.head(100),use_container_width=True,hide_index=True)
        st.download_button("Download analyzed CSV",result.to_csv(index=False).encode("utf-8-sig"),"eatsure_analyzed_complaints.csv","text/csv",type="primary")

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
