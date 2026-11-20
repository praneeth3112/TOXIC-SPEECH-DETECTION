# Deploying ToxicShield AI to Streamlit Community Cloud

## 1. Push the `streamlit/` folder to GitHub
Make sure your GitHub repository contains:
- `streamlit/app.py`
- `streamlit/requirements.txt`

*(Or move `app.py` and `requirements.txt` to the root of your Streamlit repository.)*

## 2. Configure Streamlit Community Cloud
1. Open [share.streamlit.io](https://share.streamlit.io/) and click **Create app** (or open your existing `toxicsheild-ai` app settings).
2. Select your GitHub repository and branch.
3. Set **Main file path** to `streamlit/app.py` (or `app.py` if placed at the repo root).

## 3. Add Your Gemini API Key in Secrets
1. In Streamlit Community Cloud, open **App Settings → Secrets**.
2. Paste the following TOML snippet with your real Gemini API key:
   ```toml
   GEMINI_API_KEY = "AIza..."
   ```
3. Save and reboot the app.

## 4. Run Locally (Optional)
```bash
cd streamlit
pip install -r requirements.txt
mkdir -p .streamlit
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# Edit .streamlit/secrets.toml with your GEMINI_API_KEY
streamlit run app.py
```
