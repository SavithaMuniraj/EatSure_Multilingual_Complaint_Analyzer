from __future__ import annotations

import re
import unicodedata
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import requests
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
WEB = Path(__file__).resolve().parent
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
bearer = HTTPBearer(auto_error=False)
app = FastAPI(title="EatSure Complaint Intelligence API", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=WEB / "static"), name="static")


@lru_cache(maxsize=1)
def model_bundle() -> dict[str, Any]:
    return joblib.load(ROOT / "eat_sure_models.joblib")


@lru_cache(maxsize=1)
def customer_activity() -> list[dict[str, Any]]:
    path = ROOT / "eatsure_complaints_feedback.csv"
    if not path.exists():
        return []
    data = pd.read_csv(path, usecols=lambda col: col in {"customer_id", "complaint_timestamp", "category"})
    if not {"customer_id", "complaint_timestamp"}.issubset(data.columns):
        return []
    data["customer_id"] = data["customer_id"].fillna("").astype(str).str.strip()
    data = data[data.customer_id.ne("")].copy()
    data["complaint_timestamp"] = pd.to_datetime(data["complaint_timestamp"], errors="coerce", utc=True)
    result = data.groupby("customer_id", as_index=False).agg(
        total_complaints=("customer_id", "size"),
        first_complaint=("complaint_timestamp", "min"),
        last_complaint=("complaint_timestamp", "max"),
    )
    if "category" in data:
        top = data.dropna(subset=["category"]).groupby(["customer_id", "category"]).size().rename("n").reset_index()
        top = top.sort_values(["customer_id", "n", "category"], ascending=[True, False, True]).drop_duplicates("customer_id")
        result = result.merge(top[["customer_id", "category"]].rename(columns={"category": "common_category"}), on="customer_id", how="left")
    else:
        result["common_category"] = "—"
    result["cohort"] = np.where(result.total_complaints.gt(1), "Repeat complainant", "One recorded complaint")
    result = result.sort_values(["total_complaints", "last_complaint"], ascending=[False, False])
    for col in ("first_complaint", "last_complaint"):
        result[col] = result[col].map(lambda value: value.isoformat() if pd.notna(value) else None)
    records = result.to_dict(orient="records")
    for record in records:
        for key, value in record.items():
            if pd.isna(value):
                record[key] = None
    return records


def require_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    if credentials is None or not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=401, detail="Sign in to use this feature.")
    try:
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {credentials.credentials}"},
            timeout=12,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=503, detail="Could not verify your session.") from exc
    if not response.ok:
        raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.")
    return response.json()


@app.get("/api/config")
def client_config():
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="The app owner needs to add the Supabase URL and publishable key.")
    # A Supabase publishable/anon key is public by design. The service-role key is never sent.
    return {"supabaseUrl": SUPABASE_URL, "supabaseAnonKey": SUPABASE_ANON_KEY}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/customers")
def customers(_user: dict[str, Any] = Depends(require_user)):
    return {"customers": customer_activity()}


class ComplaintRequest(BaseModel):
    text: str = Field(min_length=2, max_length=5000)
    language: str = "Auto detect"
    translate: bool = False


LANG_OPTIONS = ["Auto detect", "English", "Hinglish", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Punjabi", "Other / unsure"]
SCRIPT_RANGES = [("Malayalam", 0x0D00, 0x0D7F), ("Tamil", 0x0B80, 0x0BFF), ("Telugu", 0x0C00, 0x0C7F), ("Kannada", 0x0C80, 0x0CFF), ("Hindi", 0x0900, 0x097F), ("Bengali", 0x0980, 0x09FF), ("Gujarati", 0x0A80, 0x0AFF), ("Punjabi", 0x0A00, 0x0A7F)]


def script_language(text: str) -> str:
    counts = {name: sum(low <= ord(char) <= high for char in text) for name, low, high in SCRIPT_RANGES}
    latin = sum(char.isascii() and char.isalpha() for char in text)
    return max(counts, key=counts.get) if max(counts.values(), default=0) else ("English / Hinglish" if latin else "Unknown")


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFC", str(text)).lower()
    text = re.sub(r"https?://\S+|www\.\S+", " URL ", text)
    text = re.sub(r"\b(?:es|cmp|cust)\d+\b", " ID ", text, flags=re.I)
    text = re.sub(r"(?:₹|rs\.?|inr)\s*\d+(?:\.\d+)?", " AMOUNT ", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def analyze(text: str, selected_language: str, translate: bool) -> dict[str, Any]:
    language = script_language(text) if selected_language == "Auto detect" else selected_language
    if language not in LANG_OPTIONS:
        language = "Other / unsure"
    if language in {"Other / unsure", "Malayalam", "Bengali", "Gujarati", "Punjabi", "Unknown"}:
        return {"supported": False, "language": language, "category": "Manual review", "top_features": [], "subcategory": "—", "sentiment": "—", "priority": "—", "translated": "", "note": "This language is outside the classifier's supported languages. Route it for manual review."}
    bundle = model_bundle()
    vectorizer = bundle["vectorizer"]
    row = vectorizer.transform([clean_text(text)])
    model = bundle["category_model"]
    probs = model.predict_proba(row)[0] if hasattr(model, "predict_proba") else None
    category = str(model.classes_[int(probs.argmax())]) if probs is not None else str(model.predict(row)[0])
    confidence = float(probs.max()) if probs is not None else None
    class_index = list(model.classes_).index(category)
    if hasattr(model, "coef_"):
        coef = model.coef_
        weights = coef[0] if coef.shape[0] == 1 and len(model.classes_) == 2 and class_index == 1 else (-coef[0] if coef.shape[0] == 1 and len(model.classes_) == 2 else coef[class_index])
    elif hasattr(model, "feature_log_prob_"):
        weights = model.feature_log_prob_[class_index] - np.delete(model.feature_log_prob_, class_index, axis=0).max(axis=0)
    else:
        weights = None
    evidence: dict[str, float] = {}
    if weights is not None:
        names = vectorizer.get_feature_names_out()
        normalized = clean_text(text)
        for feature_idx, value in zip(row.tocsr().indices, row.tocsr().data):
            contribution = float(value * weights[feature_idx])
            if contribution <= 0:
                continue
            gram = str(names[feature_idx])
            owners = [word for word in dict.fromkeys(re.findall(r"[^\W_]+", normalized, flags=re.UNICODE)) if gram in f" {word} "]
            for word in owners:
                evidence[word] = evidence.get(word, 0.0) + contribution / len(owners)
    features = [word for word, _ in sorted(evidence.items(), key=lambda item: item[1], reverse=True)[:4]]
    def optional(key: str) -> str:
        submodel = bundle.get(key + "_model")
        return str(submodel.predict(row)[0]) if submodel is not None else "Not available"
    translated = ""
    note = ""
    if translate:
        try:
            from deep_translator import GoogleTranslator
            code = {"English": "en", "English / Hinglish": "en", "Hinglish": "en", "Hindi": "hi", "Tamil": "ta", "Telugu": "te", "Kannada": "kn"}.get(language)
            translated = GoogleTranslator(source=code or "auto", target="en").translate(text) or ""
        except Exception:
            note = "Translation was unavailable; the original complaint was analyzed."
    return {"supported": True, "language": language, "category": category, "confidence": confidence, "top_features": features, "subcategory": optional("subcategory"), "sentiment": optional("sentiment"), "priority": optional("priority"), "translated": translated, "note": note}


@app.post("/api/analyze")
def analyze_complaint(payload: ComplaintRequest, _user: dict[str, Any] = Depends(require_user)):
    try:
        return analyze(payload.text, payload.language, payload.translate)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="The classifier could not process this complaint.") from exc


@app.get("/")
def index():
    return FileResponse(WEB / "static" / "index.html")
