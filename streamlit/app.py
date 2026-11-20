import html
import os
import re
from datetime import datetime
from typing import Literal

import pandas as pd
import streamlit as st
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

st.set_page_config(
    page_title="ToxicShield AI — Content Moderation & Detoxification",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-4-hydrogen")

POLICY_PRESETS = {
    "Strict Community": {
        "description": "Low tolerance for profanity, sarcasm, or personal friction.",
        "flag_threshold": 20,
        "block_threshold": 50,
        "custom_rules": "Flag even mild profanity, dismissive sarcasm, or condescending phrasing.",
    },
    "Workplace & PR Review": {
        "description": "Allows candid technical critique while flagging personal attacks and hostility.",
        "flag_threshold": 30,
        "block_threshold": 65,
        "custom_rules": "Allow direct technical feedback on code, metrics, or bugs, but flag ad-hominem remarks or blame.",
    },
    "Open Forum": {
        "description": "Permissive threshold suited for open discussions. Blocks severe harassment and threats.",
        "flag_threshold": 45,
        "block_threshold": 75,
        "custom_rules": "Focus primarily on targeted harassment, identity-based attacks, and credible threats.",
    },
    "Custom Policy": {
        "description": "Tailored sensitivity thresholds and custom community rules.",
        "flag_threshold": 30,
        "block_threshold": 65,
        "custom_rules": "Flag any insults about competence, aggressive demands, or discriminatory language.",
    },
}

SAMPLE_INPUTS = {
    "Hostile PR Review": (
        "Honestly, whoever pushed this garbage commit clearly has no clue how async state works. "
        "Fix this mess immediately instead of wasting everyone's time."
    ),
    "Passive-Aggressive Slack": (
        "Per my last three emails, maybe try actually reading the spec before asking obvious questions. "
        "It is not that hard."
    ),
    "Constructive Feedback": (
        "This query currently performs an N+1 lookup inside the loop, which will bottleneck under load. "
        "Could we batch these IDs into a single fetch?"
    ),
    "User Harassment": (
        "You are completely pathetic and nobody wants people like you posting here. "
        "Delete your account before we make you regret it."
    ),
}

SAMPLE_BATCH = [
    "Great breakdown of the quarterly metrics — the churn chart makes the root cause obvious.",
    "Are you seriously dumb enough to ship this to production without testing it?",
    "Per my previous message, I already explained this twice. Please pay attention.",
    "Could we schedule a quick 15-minute sync to align on the API schema changes?",
    "Shut up and stop spamming the thread with your useless opinions.",
    "I disagree with the caching strategy here because stale reads could break billing invariants.",
    "Nobody asked you, loser. Stay out of this channel or else.",
    "Thanks for jumping on the incident call so quickly — the rollback resolved the spike.",
]

TONE_GUIDES = {
    "Professional": "constructive, calm, workplace-appropriate, and solution-oriented while preserving legitimate feedback",
    "Empathetic": "warm, respectful, supportive, and mindful of the recipient while keeping the core point clear",
    "Neutral": "objective, matter-of-fact, stripped of emotional hostility or sarcasm, and concise",
    "Concise": "direct, polite, and minimal without unnecessary filler or aggression",
}


class DimensionScore(BaseModel):
    key: Literal[
        "toxicity",
        "severeToxicity",
        "insult",
        "profanity",
        "identityAttack",
        "threat",
    ]
    label: str
    score: int = Field(ge=0, le=100)
    explanation: str


class TriggerSpan(BaseModel):
    phrase: str
    category: str
    severity: Literal["low", "medium", "high"]
    reason: str


class SingleAnalysisSchema(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    primary_category: str
    summary: str
    dimensions: list[DimensionScore]
    trigger_spans: list[TriggerSpan]
    rewritten_text: str
    rewrite_notes: str


class RewriteSchema(BaseModel):
    rewritten_text: str
    rewrite_notes: str


class BatchItemSchema(BaseModel):
    index: int
    overall_score: int = Field(ge=0, le=100)
    primary_category: str
    reason: str
    rewritten_text: str


class BatchResponseSchema(BaseModel):
    items: list[BatchItemSchema]


def get_gemini_client() -> genai.Client:
    api_key = None
    try:
        api_key = st.secrets.get("GEMINI_API_KEY")
    except Exception:
        api_key = None

    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key or api_key in ("MY_GEMINI_API_KEY", "YOUR_GEMINI_API_KEY"):
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Add `GEMINI_API_KEY = \"...\"` in "
            "Streamlit Cloud App Settings → Secrets (or `.streamlit/secrets.toml` locally)."
        )

    return genai.Client(api_key=api_key)


def compute_verdict(score: int) -> str:
    if score >= 80:
        return "Severe"
    if score >= 55:
        return "Toxic"
    if score >= 25:
        return "Borderline"
    return "Safe"


def compute_action(score: int, flag_threshold: int, block_threshold: int) -> str:
    if score >= block_threshold:
        return "Block"
    if score >= flag_threshold:
        return "Hold for Review"
    return "Approve"


def highlight_spans_html(text: str, spans: list[TriggerSpan]) -> str:
    escaped = html.escape(text)
    if not spans:
        return f"<div style='line-height:1.6;font-size:0.95rem;'>{escaped}</div>"

    highlighted = escaped
    for span in spans:
        phrase = span.phrase.strip()
        if not phrase:
            continue
        escaped_phrase = html.escape(phrase)
        bg = (
            "#ffe4e6"
            if span.severity == "high"
            else "#ffedd5"
            if span.severity == "medium"
            else "#fef3c7"
        )
        fg = (
            "#881337"
            if span.severity == "high"
            else "#7c2d12"
            if span.severity == "medium"
            else "#78350f"
        )
        pattern = re.compile(re.escape(escaped_phrase), re.IGNORECASE)
        highlighted = pattern.sub(
            lambda m: (
                f"<mark style='background:{bg};color:{fg};padding:1px 4px;"
                f"border-radius:4px;font-weight:600;'>{m.group(0)}</mark>"
            ),
            highlighted,
            count=1,
        )

    return f"<div style='line-height:1.6;font-size:0.95rem;background:#f8fafc;border:1px solid #e2e8f0;padding:12px 14px;border-radius:8px;'>{highlighted}</div>"


def init_state() -> None:
    if "policy_preset" not in st.session_state:
        st.session_state.policy_preset = "Workplace & PR Review"
    if "flag_threshold" not in st.session_state:
        st.session_state.flag_threshold = POLICY_PRESETS["Workplace & PR Review"]["flag_threshold"]
    if "block_threshold" not in st.session_state:
        st.session_state.block_threshold = POLICY_PRESETS["Workplace & PR Review"]["block_threshold"]
    if "custom_rules" not in st.session_state:
        st.session_state.custom_rules = POLICY_PRESETS["Workplace & PR Review"]["custom_rules"]
    if "analyzer_input" not in st.session_state:
        st.session_state.analyzer_input = SAMPLE_INPUTS["Hostile PR Review"]
    if "latest_result" not in st.session_state:
        st.session_state.latest_result = None
    if "history" not in st.session_state:
        st.session_state.history = []
    if "batch_results" not in st.session_state:
        st.session_state.batch_results = []


init_state()

# Sidebar: Policy Guardrail Summary & Navigation Info
with st.sidebar:
    st.title("ToxicShield AI")
    st.caption("Content Moderation & Detoxification")
    st.divider()

    selected_preset = st.selectbox(
        "Active Policy Preset",
        list(POLICY_PRESETS.keys()),
        index=list(POLICY_PRESETS.keys()).index(st.session_state.policy_preset),
    )
    if selected_preset != st.session_state.policy_preset:
        st.session_state.policy_preset = selected_preset
        preset_cfg = POLICY_PRESETS[selected_preset]
        st.session_state.flag_threshold = preset_cfg["flag_threshold"]
        st.session_state.block_threshold = preset_cfg["block_threshold"]
        st.session_state.custom_rules = preset_cfg["custom_rules"]

    st.metric("Hold Threshold", f"{st.session_state.flag_threshold}%")
    st.metric("Block Threshold", f"{st.session_state.block_threshold}%")
    st.metric("Session Scans", len(st.session_state.history))

    st.divider()
    st.caption(f"Model: `{MODEL_NAME}`")

tab_analyzer, tab_batch, tab_policy, tab_history = st.tabs(
    ["Live Analyzer", "Batch Queue", "Policy Rules", "Moderation Log"]
)

# 1. Live Analyzer Tab
with tab_analyzer:
    col_in, col_out = st.columns([5, 7], gap="large")

    with col_in:
        st.subheader("Content Inspection Input")
        st.write("Choose a sample test case or paste any message to evaluate.")

        sample_cols = st.columns(2)
        for idx, (label, sample_text) in enumerate(SAMPLE_INPUTS.items()):
            with sample_cols[idx % 2]:
                if st.button(label, use_container_width=True, key=f"sample_{label}"):
                    st.session_state.analyzer_input = sample_text

        user_text = st.text_area(
            "Message to Moderate",
            value=st.session_state.analyzer_input,
            height=190,
            max_chars=8000,
            key="analyzer_textarea",
        )
        st.session_state.analyzer_input = user_text

        target_tone = st.segmented_control(
            "Target Detoxification Tone",
            options=list(TONE_GUIDES.keys()),
            default="Professional",
        )
        if not target_tone:
            target_tone = "Professional"

        analyze_clicked = st.button(
            "Analyze Content",
            type="primary",
            use_container_width=True,
        )

    with col_out:
        st.subheader("Moderation Evaluation")

        if analyze_clicked:
            if not user_text.strip():
                st.warning("Please enter a comment or message to analyze.")
            else:
                with st.spinner("Evaluating toxicity across six dimensions..."):
                    try:
                        client = get_gemini_client()
                        tone_guide = TONE_GUIDES[target_tone]
                        sys_prompt = (
                            "You are ToxicShield AI, a calibrated trust-and-safety content moderation "
                            "and constructive detoxification engine.\n"
                            f"Policy Preset: {st.session_state.policy_preset}\n"
                            f"Flag Threshold: {st.session_state.flag_threshold}/100\n"
                            f"Block Threshold: {st.session_state.block_threshold}/100\n"
                            f"Community Guidelines: {st.session_state.custom_rules}\n\n"
                            "Scoring Rules (0-100): 0-24 Safe, 25-54 Borderline, 55-79 Toxic, 80-100 Severe.\n"
                            "Distinguish valid technical/factual critique (score 0-20) from personal insults.\n"
                            "Provide exact 6 dimensions with keys: toxicity, severeToxicity, insult, profanity, identityAttack, threat.\n"
                            "Each trigger_spans.phrase MUST be an exact substring from the input text.\n"
                            f"Rewrite the message in a {tone_guide} tone."
                        )

                        response = client.models.generate_content(
                            model=MODEL_NAME,
                            contents=f'Analyze the following text:\n\n"""\n{user_text.strip()}\n"""',
                            config=types.GenerateContentConfig(
                                system_instruction=sys_prompt,
                                response_mime_type="application/json",
                                response_schema=SingleAnalysisSchema,
                            ),
                        )
                        parsed: SingleAnalysisSchema = response.parsed
                        score = max(0, min(100, int(parsed.overall_score)))
                        verdict = compute_verdict(score)
                        action = compute_action(
                            score,
                            st.session_state.flag_threshold,
                            st.session_state.block_threshold,
                        )
                        record = {
                            "timestamp": datetime.now().strftime("%H:%M:%S"),
                            "text": user_text.strip(),
                            "overall_score": score,
                            "verdict": verdict,
                            "action": action,
                            "primary_category": parsed.primary_category,
                            "summary": parsed.summary,
                            "dimensions": parsed.dimensions,
                            "trigger_spans": parsed.trigger_spans,
                            "rewritten_text": parsed.rewritten_text,
                            "rewrite_notes": parsed.rewrite_notes,
                            "tone": target_tone,
                        }
                        st.session_state.latest_result = record
                        st.session_state.history.insert(0, record)
                    except Exception as exc:
                        st.error(f"Analysis failed: {exc}")

        res = st.session_state.latest_result
        if res is None:
            st.info(
                "Click **Analyze Content** to inspect six-dimension toxicity scores, "
                "highlighted trigger phrases, and a constructive AI rewrite."
            )
        else:
            m1, m2, m3 = st.columns(3)
            m1.metric("Overall Risk", f"{res['overall_score']}%")
            m2.metric("Verdict", f"{res['verdict']} · {res['primary_category']}")
            m3.metric("Recommended Action", res["action"])

            st.write(res["summary"])

            st.markdown("**Inspected Text & Flagged Phrases**")
            st.markdown(
                highlight_spans_html(res["text"], res["trigger_spans"]),
                unsafe_allow_html=True,
            )

            if res["trigger_spans"]:
                for span in res["trigger_spans"]:
                    st.caption(
                        f'• "{span.phrase}" — {span.category} ({span.severity}): {span.reason}'
                    )

            st.divider()
            st.markdown("**Six-Dimension Breakdown**")
            dim_cols = st.columns(2)
            for i, dim in enumerate(res["dimensions"]):
                with dim_cols[i % 2]:
                    st.write(f"**{dim.label}** — `{dim.score}%`")
                    st.progress(dim.score / 100)
                    st.caption(dim.explanation)

            st.divider()
            st.markdown(f"**Constructive Detoxification Rewrite ({res['tone']})**")
            st.code(res["rewritten_text"], language=None)
            st.caption(res["rewrite_notes"])

            regen_tone = st.selectbox(
                "Regenerate in another tone",
                list(TONE_GUIDES.keys()),
                index=list(TONE_GUIDES.keys()).index(res["tone"]),
                key="regen_tone_select",
            )
            if st.button("Regenerate Rewrite", key="regen_btn"):
                with st.spinner(f"Generating {regen_tone} rewrite..."):
                    try:
                        client = get_gemini_client()
                        rw_resp = client.models.generate_content(
                            model=MODEL_NAME,
                            contents=(
                                f'Original message:\n"""\n{res["text"]}\n"""\n'
                                f"Target tone: {regen_tone} ({TONE_GUIDES[regen_tone]})"
                            ),
                            config=types.GenerateContentConfig(
                                system_instruction=(
                                    "Remove hostility, insults, profanity, or sarcasm while preserving "
                                    "any legitimate technical or constructive feedback."
                                ),
                                response_mime_type="application/json",
                                response_schema=RewriteSchema,
                            ),
                        )
                        rw_parsed: RewriteSchema = rw_resp.parsed
                        res["rewritten_text"] = rw_parsed.rewritten_text
                        res["rewrite_notes"] = rw_parsed.rewrite_notes
                        res["tone"] = regen_tone
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Rewrite failed: {exc}")

# 2. Batch Queue Tab
with tab_batch:
    st.subheader("Batch Comment Queue")
    st.write(
        "Paste up to 25 comments (one per line) or upload a `.txt` / `.csv` file to moderate in one pass."
    )

    uploaded = st.file_uploader("Import .txt or .csv file", type=["txt", "csv"])
    default_batch_text = "\n".join(SAMPLE_BATCH)
    if uploaded is not None:
        raw_bytes = uploaded.read().decode("utf-8", errors="ignore")
        imported_lines = [
            line.strip().strip('"')
            for line in raw_bytes.splitlines()
            if line.strip() and line.strip().lower() not in ("text", "comment")
        ]
        default_batch_text = "\n".join(imported_lines[:25])

    batch_input = st.text_area(
        "Queued Messages (one per line, max 25)",
        value=default_batch_text,
        height=180,
    )

    if st.button("Run Batch Moderation", type="primary"):
        lines = [line.strip() for line in batch_input.splitlines() if line.strip()][:25]
        if not lines:
            st.warning("Provide at least one message line to moderate.")
        else:
            with st.spinner(f"Moderating {len(lines)} messages with Gemini..."):
                try:
                    client = get_gemini_client()
                    numbered = "\n".join(f"[{i}] {line}" for i, line in enumerate(lines))
                    batch_sys = (
                        "You are ToxicShield AI batch moderator. Evaluate every numbered message independently.\n"
                        f"Policy: {st.session_state.policy_preset} | "
                        f"Flag >= {st.session_state.flag_threshold} | Block >= {st.session_state.block_threshold}\n"
                        f"Guidelines: {st.session_state.custom_rules}\n"
                        "Provide a concise detoxified rewrite for any item scoring >= 25."
                    )
                    resp = client.models.generate_content(
                        model=MODEL_NAME,
                        contents=f"Moderate each numbered message below:\n\n{numbered}",
                        config=types.GenerateContentConfig(
                            system_instruction=batch_sys,
                            response_mime_type="application/json",
                            response_schema=BatchResponseSchema,
                        ),
                    )
                    batch_parsed: BatchResponseSchema = resp.parsed
                    by_idx = {item.index: item for item in batch_parsed.items}
                    rows = []
                    for i, orig in enumerate(lines):
                        item = by_idx.get(i)
                        score = max(0, min(100, int(item.overall_score))) if item else 0
                        rows.append(
                            {
                                "Index": i + 1,
                                "Message": orig,
                                "Risk (%)": score,
                                "Verdict": compute_verdict(score),
                                "Action": compute_action(
                                    score,
                                    st.session_state.flag_threshold,
                                    st.session_state.block_threshold,
                                ),
                                "Category": item.primary_category if item else "Evaluated",
                                "Reason": item.reason if item else "",
                                "Suggested Rewrite": item.rewritten_text if item else orig,
                            }
                        )
                    st.session_state.batch_results = rows
                except Exception as exc:
                    st.error(f"Batch moderation failed: {exc}")

    if st.session_state.batch_results:
        df = pd.DataFrame(st.session_state.batch_results)
        filter_mode = st.segmented_control(
            "Filter Queue",
            options=["All", "Flagged", "Safe"],
            default="All",
        )
        if filter_mode == "Flagged":
            df_view = df[df["Action"] != "Approve"]
        elif filter_mode == "Safe":
            df_view = df[df["Action"] == "Approve"]
        else:
            df_view = df

        st.dataframe(df_view, use_container_width=True, hide_index=True)

        csv_data = df.to_csv(index=False).encode("utf-8")
        st.download_button(
            "Export Moderated CSV",
            data=csv_data,
            file_name=f"toxicshield-batch-{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv",
        )

# 3. Policy Rules Tab
with tab_policy:
    st.subheader("Moderation Policy & Threshold Calibration")
    st.write(
        "Customize the sensitivity thresholds and community guidelines passed to Gemini."
    )

    new_flag = st.slider(
        "Hold for Review Threshold (%)",
        min_value=5,
        max_value=85,
        step=5,
        value=st.session_state.flag_threshold,
    )
    new_block = st.slider(
        "Auto-Block Threshold (%)",
        min_value=max(15, new_flag + 5),
        max_value=95,
        step=5,
        value=max(st.session_state.block_threshold, new_flag + 5),
    )
    new_rules = st.text_area(
        "Custom Community Guidelines",
        value=st.session_state.custom_rules,
        height=130,
    )

    if st.button("Apply Policy Settings", type="primary"):
        st.session_state.flag_threshold = new_flag
        st.session_state.block_threshold = new_block
        st.session_state.custom_rules = new_rules
        st.session_state.policy_preset = "Custom Policy"
        st.success("Policy settings updated for upcoming scans.")

# 4. Moderation Log Tab
with tab_history:
    st.subheader("Session Moderation Log")
    hist = st.session_state.history
    if not hist:
        st.info("No scans recorded yet. Analyze a message in the Live Analyzer tab.")
    else:
        total = len(hist)
        flagged = sum(1 for h in hist if h["action"] != "Approve")
        mean_risk = round(sum(h["overall_score"] for h in hist) / total)

        c1, c2, c3 = st.columns(3)
        c1.metric("Total Analyzed", total)
        c2.metric("Flagged Rate", f"{round((flagged / total) * 100)}%")
        c3.metric("Mean Risk Score", f"{mean_risk}%")

        hist_df = pd.DataFrame(
            [
                {
                    "Time": h["timestamp"],
                    "Message": h["text"],
                    "Verdict": h["verdict"],
                    "Category": h["primary_category"],
                    "Action": h["action"],
                    "Risk (%)": h["overall_score"],
                }
                for h in hist
            ]
        )
        st.dataframe(hist_df, use_container_width=True, hide_index=True)

        if st.button("Clear Session Log"):
            st.session_state.history = []
            st.rerun()
