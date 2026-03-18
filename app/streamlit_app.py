from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from src.config import AppConfig
from src.io.temp_files import build_temp_video_path, ensure_dir
from src.services.pipeline import RiderAIPipeline

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Rider AI · MTB Analysis",
    page_icon="🏔️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
.hero-title {
    font-size: 2.6rem; font-weight: 800; letter-spacing: -1.5px; margin-bottom: 0;
}
.hero-sub {
    font-size: 1rem; color: #888; margin-top: 0.1rem; margin-bottom: 0;
}
.badge {
    display: inline-block; background: #1e3a5f; color: #7eb8f7;
    border-radius: 6px; padding: 2px 10px; font-size: 0.76rem;
    font-weight: 600; margin: 2px 2px 2px 0;
}
.section-label {
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 2px;
    color: #666; margin-bottom: 4px; margin-top: 0;
}
.demo-banner {
    background: #2d1b00; border-left: 4px solid #f0a500;
    padding: 0.8rem 1.2rem; border-radius: 0 8px 8px 0; margin-bottom: 1rem;
}
</style>
""", unsafe_allow_html=True)

# ── Config & session state ────────────────────────────────────────────────────
config = AppConfig()
ensure_dir(config.temp_dir)
ensure_dir(config.output_dir)

for _k, _v in [("temp_video_path", None), ("uploaded_file_id", None),
               ("artifacts", None), ("session_dir", None)]:
    if _k not in st.session_state:
        st.session_state[_k] = _v

model_exists = Path(config.model_path).exists()

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## ⚙️ Settings")
    if not model_exists:
        st.warning("⚠️ Model file not found. Gallery-only mode.")
    model_path = st.text_input("Model path", value=config.model_path, disabled=not model_exists)
    min_conf = st.slider(
        "Min keypoint confidence", 0.05, 0.95, float(config.min_keypoint_conf), 0.05,
        help="Minimum YOLO confidence to accept a detection",
    )
    smoothing_window = st.slider(
        "Smoothing window", 1, 15, int(config.smoothing_window), 1,
        help="Moving-average window for keypoint stabilization",
    )
    use_groq = st.toggle("Enable Groq coaching feedback", value=config.use_groq_feedback)
    groq_model = st.text_input("Groq model", value=config.groq_model)

# ── Hero ──────────────────────────────────────────────────────────────────────
st.markdown('<p class="hero-title">🏔️ Rider AI</p>', unsafe_allow_html=True)
st.markdown(
    '<p class="hero-sub">MTB downhill performance analysis · pose estimation · AI coaching</p>',
    unsafe_allow_html=True,
)
st.divider()

# ── Tabs ──────────────────────────────────────────────────────────────────────
tab_analyze, tab_gallery, tab_about = st.tabs(["🎬 Analyze", "📂 Gallery", "ℹ️ About"])

# ══════════════════════════════════════════════════════════════════════════════
# TAB · ANALYZE
# ══════════════════════════════════════════════════════════════════════════════
with tab_analyze:
    if not model_exists:
        st.markdown("""
        <div class="demo-banner">
        ⚠️ <strong>Portfolio / demo mode</strong> — the model file is not included
        in the public repo due to file-size constraints.<br>
        Check the <strong>Gallery</strong> tab to see pre-computed results.
        </div>""", unsafe_allow_html=True)

    uploaded_file = st.file_uploader(
        "Upload a downhill MTB video", type=["mp4", "mov", "avi", "mkv"],
        disabled=not model_exists,
    )

    if uploaded_file is not None:
        file_id = (uploaded_file.name, uploaded_file.size)
        if file_id != st.session_state.uploaded_file_id:
            suffix = Path(uploaded_file.name).suffix or ".mp4"
            tmp = build_temp_video_path(config.temp_dir, suffix=suffix)
            with open(tmp, "wb") as f:
                f.write(uploaded_file.read())
            st.session_state.temp_video_path = tmp
            st.session_state.uploaded_file_id = file_id
            st.session_state.artifacts = None
            st.session_state.session_dir = None

        # ── Input / annotated side-by-side ────────────────────────────────
        col_in, col_out = st.columns(2)
        with col_in:
            st.markdown('<p class="section-label">Input video</p>', unsafe_allow_html=True)
            st.video(st.session_state.temp_video_path, width=640)
        with col_out:
            if st.session_state.artifacts is not None:
                st.markdown('<p class="section-label">Annotated output</p>', unsafe_allow_html=True)
                st.video(st.session_state.artifacts.annotated_video_path, width=640)

        # ── Process button ────────────────────────────────────────────────
        if st.button("⚡ Process video", type="primary", use_container_width=True):
            session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
            session_dir = os.path.join(config.output_dir, session_id)
            ensure_dir(session_dir)
            run_config = AppConfig(
                output_dir=session_dir, temp_dir=config.temp_dir,
                model_path=model_path, min_keypoint_conf=min_conf,
                smoothing_window=smoothing_window, use_groq_feedback=use_groq,
                groq_api_key=config.groq_api_key, groq_model=groq_model,
            )
            with st.spinner("Analyzing video…"):
                st.session_state.artifacts = RiderAIPipeline(run_config).run(
                    st.session_state.temp_video_path
                )
            st.session_state.session_dir = session_dir
            # Save input copy + session metadata for Gallery
            shutil.copy(st.session_state.temp_video_path, os.path.join(session_dir, "input.mp4"))
            s = st.session_state.artifacts.summary
            with open(os.path.join(session_dir, "meta.json"), "w") as mf:
                json.dump({
                    "original_filename": uploaded_file.name,
                    "session_id": session_id,
                    "avg_balance_score": s.avg_balance_score,
                    "avg_line_efficiency_score": s.avg_line_efficiency_score,
                    "avg_speed_proxy": s.avg_speed_proxy,
                    "coaching_summary": s.coaching_summary or "",
                }, mf)
            st.rerun()

        # ── Results ───────────────────────────────────────────────────────
        if st.session_state.artifacts is not None:
            artifacts = st.session_state.artifacts
            st.success("✅ Analysis complete")

            m1, m2, m3 = st.columns(3)
            m1.metric("Avg balance", artifacts.summary.avg_balance_score)
            m2.metric("Avg line efficiency", artifacts.summary.avg_line_efficiency_score)
            m3.metric("Avg speed proxy", artifacts.summary.avg_speed_proxy)

            df = pd.read_csv(artifacts.features_csv_path)
            plot_cols = [c for c in [
                "balance_score", "line_efficiency_score", "speed_proxy", "trunk_angle_deg",
            ] if c in df.columns]
            if plot_cols:
                st.markdown("#### Metric trends")
                st.line_chart(df[plot_cols])

            with st.expander("Per-frame data"):
                st.dataframe(df, width="stretch")

            with st.expander("Full summary JSON"):
                st.json(artifacts.summary.__dict__)

            if artifacts.summary.coaching_summary:
                st.markdown("#### AI Coaching feedback")
                st.info(artifacts.summary.coaching_summary)

            dl1, dl2 = st.columns(2)
            with open(artifacts.features_csv_path, "rb") as f:
                dl1.download_button("Download CSV", data=f, file_name="features.csv", mime="text/csv")
            with open(artifacts.features_json_path, "rb") as f:
                dl2.download_button("Download JSON", data=f, file_name="features.json", mime="application/json")


# ══════════════════════════════════════════════════════════════════════════════
# TAB · GALLERY
# ══════════════════════════════════════════════════════════════════════════════
with tab_gallery:
    st.markdown("### Saved sessions")
    st.caption("Every processed clip is saved locally with its annotated output and metrics.")

    output_root = Path(config.output_dir)

    # Timestamp-based sessions (new structure)
    sessions = sorted(
        [d for d in output_root.iterdir()
         if d.is_dir() and (d / "annotated_output.mp4").exists()],
        reverse=True,
    )

    # Legacy flat outputs: annotated_output.mp4 directly inside output_root
    legacy_annotated = output_root / "annotated_output.mp4"
    has_legacy = legacy_annotated.exists()

    if not sessions and not has_legacy:
        st.info("No saved sessions yet. Analyze a video in the **Analyze** tab to see results here.")
    else:
        if has_legacy:
            with st.expander("legacy  ·  (pre-session output)"):
                vc1, vc2 = st.columns(2)
                with vc2:
                    st.markdown('<p class="section-label">Annotated</p>', unsafe_allow_html=True)
                    st.video(str(legacy_annotated), width=480)
                csv_p = output_root / "features.csv"
                if csv_p.exists():
                    df_g = pd.read_csv(csv_p)
                    pcols = [c for c in [
                        "balance_score", "line_efficiency_score", "speed_proxy",
                    ] if c in df_g.columns]
                    if pcols:
                        st.markdown("##### Metric trends")
                        st.line_chart(df_g[pcols])

        for sdir in sessions:
            meta_file = sdir / "meta.json"
            meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
            label = meta.get("original_filename", sdir.name)
            sid = meta.get("session_id", sdir.name)

            with st.expander(f"{label}  ·  {sid}"):
                mc1, mc2, mc3 = st.columns(3)
                mc1.metric("Balance", meta.get("avg_balance_score", "—"))
                mc2.metric("Line efficiency", meta.get("avg_line_efficiency_score", "—"))
                mc3.metric("Speed proxy", meta.get("avg_speed_proxy", "—"))

                vc1, vc2 = st.columns(2)
                with vc1:
                    if (sdir / "input.mp4").exists():
                        st.markdown('<p class="section-label">Input</p>', unsafe_allow_html=True)
                        st.video(str(sdir / "input.mp4"), width=480)
                with vc2:
                    st.markdown('<p class="section-label">Annotated</p>', unsafe_allow_html=True)
                    st.video(str(sdir / "annotated_output.mp4"), width=480)

                csv_p = sdir / "features.csv"
                if csv_p.exists():
                    df_g = pd.read_csv(csv_p)
                    pcols = [c for c in [
                        "balance_score", "line_efficiency_score", "speed_proxy",
                    ] if c in df_g.columns]
                    if pcols:
                        st.markdown("##### Metric trends")
                        st.line_chart(df_g[pcols])

                coaching = meta.get("coaching_summary", "")
                if coaching:
                    st.markdown("##### AI Coaching feedback")
                    st.info(coaching)

# ══════════════════════════════════════════════════════════════════════════════
# TAB · ABOUT
# ══════════════════════════════════════════════════════════════════════════════
with tab_about:
    st.markdown("### About Rider AI")
    st.markdown("""
**Rider AI** is a computer-vision pipeline that analyzes MTB downhill riding technique
using pose estimation and biomechanical feature extraction — built as a portfolio project.

#### What it does
- Detects rider pose frame-by-frame with **YOLO26 Pose**
- Computes biomechanical metrics: balance score, trunk angle, knee & elbow flexion
- Classifies riding posture (attack vs. defensive) and terrain type
- Tracks rider trajectory to score line efficiency
- Generates personalized coaching feedback via **Groq LLM**
- Produces a fully annotated video with overlaid skeleton and real-time stats
""")

    st.divider()
    st.markdown(
        "Built as a portfolio project · "
        "[GitHub](https://github.com) · "
        "[LinkedIn](https://linkedin.com)"
    )
