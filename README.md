# EatSure Multilingual Complaint Analyzer

Multilingual and code-mixed complaint classification for English, Hinglish, Hindi, Tamil, Telugu, and Kannada. The model uses character-level TF-IDF features and classical machine learning, with optional English translation and confidence-based review guidance in the Streamlit app.

## Project files

- `EatSure_Multilingual_Complaint_Analyzer.ipynb` — training, held-out evaluation, and deployment package generation.
- `eatsure_complaints_feedback.csv` — project dataset used by the notebook.
- `app.py` and `eat_sure_models.joblib` — Streamlit front end and trained model bundle.
- `dashboard_aggregates.csv`, `dashboard_subcategories.csv`, and `dashboard_marginals.csv` — coarsened grouped counts used by the public insights page.
- `requirements.txt` — Python dependencies.

## Run locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

To retrain/export from the notebook, put the dataset beside the notebook or set `DATA_PATH` in the setup cell. The notebook writes a `deployment/` folder. Translation is optional and needs an internet connection.

## Streamlit Community Cloud

Deploy this repository with `app.py` as the entry point. The deployment app uses the model bundle and the three grouped dashboard CSV files beside it.
