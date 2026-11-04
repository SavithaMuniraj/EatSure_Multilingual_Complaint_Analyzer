# EatSure Multilingual Complaint Analyzer

## Public app and account access setup

The Streamlit app remains open to anyone at the current public Streamlit Community Cloud URL. The analyzer itself requires an account: people sign up with a Gmail address, choose a username and password, verify the Gmail address with a code, then sign in with their username and password. Password recovery accepts their username or Gmail and verifies a one-time email code. Passwords are handled by Supabase Auth and are not stored in the app database.

### One-time owner setup

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor. The schema stores the username-to-Gmail mapping in a table protected from public and signed-in client access.
2. Install the Supabase CLI from its official installation guide, authenticate, link this project folder, and deploy [`supabase/functions/auth-gateway/index.ts`](supabase/functions/auth-gateway/index.ts) as `auth-gateway`. The Edge Function uses Supabase's server-side service-role secret; keep that secret in Supabase and never put it in Streamlit secrets, source code, or this public repository.
3. In Supabase Auth, require email confirmation. Set the Confirm signup and Reset password templates to show `{{ .Token }}` codes. Configure a custom SMTP service before public signup: Supabase's built-in sender is best-effort and currently limited to 2 messages per hour. See the [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp) and [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
4. In Streamlit Community Cloud, open the app settings and add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `USERNAME_LOGIN_URL` as secrets, following [`.streamlit/secrets.toml.example`](.streamlit/secrets.toml.example). Never commit actual credentials or email-provider keys.
5. Streamlit redeploys from the connected GitHub branch after the code is published. Verify signup, code confirmation, username login, logout, and password reset using accounts you control before sharing the link.

The Streamlit URL is free to share and does not require a paid domain. Free hosting does not guarantee uninterrupted 24/7 service: Streamlit apps can sleep when idle, and Supabase can pause a free project after a week of low activity. See [Supabase's current pause policy](https://supabase.com/docs/guides/platform/free-project-pausing). The app wakes when requested, but users may see startup delay; a paid tier is needed for stronger availability guarantees.

[![Open the live Streamlit app](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://eatsuremultilingualcomplaintanalyzer-tyctof4c6nrp9wrcpwtrrf.streamlit.app/)

A multilingual complaint intelligence dashboard for exploring customer issues written in English and Indian languages. It predicts complaint categories and provides review-oriented signals to help a human decide what to inspect next.

## Live demo

**[Launch EatSure Complaint Intelligence on Streamlit](https://eatsuremultilingualcomplaintanalyzer-tyctof4c6nrp9wrcpwtrrf.streamlit.app/)**

## Features

- **Overview:** summary cards for category count, supported languages, test accuracy, and macro-F1.
- **Analyze complaint:** enter one complaint, choose or auto-detect a language, then review the suggested category, top category signals, subcategory, sentiment, priority, and review guidance.
- **English translation:** optionally translate a supported non-English complaint to English as a reviewer aid. Translation needs an internet connection and may be imperfect.
- **Batch analysis:** upload a CSV, analyze complaint rows, and download an enriched CSV with suggested outputs.
- **Insights:** filter coarsened complaint counts and explore category, language, priority, sentiment, and subcategory patterns.
- **About the model:** review the workflow, supported language notes, and limitations.

Supported language options include English, Hinglish, Hindi, Tamil, Telugu, and Kannada. Language detection is script-based and can confuse English with Hinglish; users can override the detected language. Other languages are routed to manual review.

## Batch CSV format

Upload a CSV with a complaint-text column. The app allows you to choose which column to analyze, then returns an enriched CSV with detected language, suggested category, top category signals, review status, and additional model outputs.

## Repository files

- [`app.py`](app.py) — Streamlit application.
- [`EatSure_Multilingual_Complaint_Analyzer.ipynb`](EatSure_Multilingual_Complaint_Analyzer.ipynb) — training, held-out evaluation, and deployment package generation.
- [`eat_sure_models.joblib`](eat_sure_models.joblib) — trained model bundle required by the app.
- [`eatsure_complaints_feedback.csv`](eatsure_complaints_feedback.csv) — project dataset used by the notebook.
- [`dashboard_aggregates.csv`](dashboard_aggregates.csv), [`dashboard_subcategories.csv`](dashboard_subcategories.csv), and [`dashboard_marginals.csv`](dashboard_marginals.csv) — grouped, coarsened counts used by Insights.
- [`requirements.txt`](requirements.txt) — Python dependencies.
- [`supabase/schema.sql`](supabase/schema.sql) and [`supabase/functions/auth-gateway/index.ts`](supabase/functions/auth-gateway/index.ts) — protected account mapping and server-side username login/password recovery.

The public Insights page uses grouped aggregate counts rather than individual complaint text.

## Run locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

To retrain and export from the notebook, place the dataset beside it or set `DATA_PATH` in the setup cell. The notebook writes a `deployment/` folder. Translation is optional and needs an internet connection.

## Streamlit deployment

The deployed app runs on [Streamlit Community Cloud](https://eatsuremultilingualcomplaintanalyzer-tyctof4c6nrp9wrcpwtrrf.streamlit.app/) from this repository, with `app.py` as its entry point. Keep the trained model bundle and all three dashboard aggregate CSV files in the app's repository directory.

## Model limitations

Predictions are decision support and may be wrong. Review low-confidence, sensitive, or consequential complaints manually. Translation is a reading aid, not a verified translation. Script-based language detection can be ambiguous, especially for Latin-script Hinglish.
