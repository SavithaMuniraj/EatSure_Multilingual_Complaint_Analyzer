# EatSure Multilingual Complaint Analyzer
[![Open the live Streamlit app](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://eatsuremultilingualcomplaintanalyzer-tyctof4c6nrp9wrcpwtrrf.streamlit.app/)
A multilingual complaint intelligence dashboard for exploring customer issues written in English and Indian languages. It predicts complaint categories and provides review-oriented signals to help a human decide what to inspect next.
## Live demo
**[Launch EatSure Complaint Intelligence on Streamlit](https://eatsuremultilingualcomplaintanalyzer-tyctof4c6nrp9wrcpwtrrf.streamlit.app/)**
## Features
- **Overview:** summary cards for category count, supported languages, test accuracy, and macro-F1.
- **Analyze complaint:** enter one complaint, choose or auto-detect a language, then review the suggested category, subcategory, sentiment, priority, confidence, and review guidance.
- **English translation:** optionally translate a supported non-English complaint to English as a reviewer aid. Translation needs an internet connection and may be imperfect.
- **Batch analysis:** upload a CSV, analyze complaint rows, and download an enriched CSV with suggested outputs.
- **Insights:** filter coarsened complaint counts and explore category, language, priority, sentiment, and subcategory patterns.
- **About the model:** review the workflow, supported language notes, and limitations.
Supported language options include English, Hinglish, Hindi, Tamil, Telugu, and Kannada. Language detection is script-based and can confuse English with Hinglish; users can override the detected language. Other languages are routed to manual review.
## Batch CSV format
Upload a CSV with a complaint-text column. The app allows you to choose which column to analyze, then returns an enriched CSV with detected language, suggested category, confidence and review status, and additional model outputs.
## Repository files
- [`app.py`](app.py) — Streamlit application.
- [`EatSure_Multilingual_Complaint_Analyzer.ipynb`](EatSure_Multilingual_Complaint_Analyzer.ipynb) — training, held-out evaluation, and deployment package generation.
- [`eat_sure_models.joblib`](eat_sure_models.joblib) — trained model bundle required by the app.
- [`eatsure_complaints_feedback.csv`](eatsure_complaint
