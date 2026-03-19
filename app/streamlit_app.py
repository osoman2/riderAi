from __future__ import annotations

import base64
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

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

# ── Sync video player helper ──────────────────────────────────────────────────
def _b64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def sync_video_player(
    path1: str,
    path2: str,
    label1: str = "Input",
    label2: str = "Annotated",
    video_max_height: int = 320,
    df=None,
    plot_cols=None,
) -> None:
    """Two videos side-by-side · shared slider · optional clickable metrics chart."""
    import json as _json

    b64_1 = _b64(path1)
    b64_2 = _b64(path2)
    uid = abs(hash((path1, path2))) % 10**8

    has_chart = (
        df is not None
        and plot_cols
        and len(plot_cols) > 0
        and "timestamp_sec" in df.columns
    )
    chart_h = 215 if has_chart else 0
    component_height = video_max_height + 95 + chart_h

    # Serialize chart data: only timestamp_sec + requested metric columns
    chart_json, plot_cols_js, palette_js = "[]", "[]", "[]"
    if has_chart:
        cols = ["timestamp_sec"] + [c for c in plot_cols if c in df.columns]
        safe = df[cols].copy()
        safe = safe.where(safe.notna(), other=None)
        chart_json = safe.to_json(orient="records")
        plot_cols_js = _json.dumps([c for c in plot_cols if c in df.columns])
        palette_js = _json.dumps(
            ["#7eb8f7", "#7ef7a2", "#f7a27e", "#f7e27e", "#c87ef7"]
        )

    chart_html = ""
    chartjs_tag = ""
    if has_chart:
        chart_html = f"""
  <div style="margin-top:14px;">
    <p class="lbl">📊 Metric trends &nbsp;·&nbsp; click to seek</p>
    <canvas id="chart_{uid}" style="max-height:180px; cursor:crosshair;"></canvas>
  </div>"""
        chartjs_tag = (
            '<script src="https://cdn.jsdelivr.net/npm/'
            'chart.js@4.4.0/dist/chart.umd.min.js"></script>'
        )

    html = f"""
<style>
  #wrap_{uid} {{ font-family: sans-serif; box-sizing: border-box; }}
  #wrap_{uid} .lbl {{
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 2px;
    color: #888; margin: 0 0 6px 0;
  }}
  #wrap_{uid} video {{
    width: 100%; display: block; border-radius: 8px; background: #000;
    max-height: {video_max_height}px; object-fit: contain;
  }}
  #wrap_{uid} .controls {{
    display: flex; align-items: center; gap: 10px; margin-top: 10px;
  }}
  #wrap_{uid} #pb_{uid} {{
    padding: 6px 18px; font-size: 0.9rem; cursor: pointer;
    border-radius: 6px; border: 1px solid #555;
    background: #1e3a5f; color: #7eb8f7; white-space: nowrap; flex-shrink: 0;
  }}
  #wrap_{uid} #sl_{uid} {{ flex: 1; cursor: pointer; accent-color: #7eb8f7; }}
  #wrap_{uid} #tl_{uid} {{
    font-size: 0.78rem; color: #888; min-width: 90px; text-align: right; flex-shrink: 0;
  }}
</style>
<div id="wrap_{uid}">
  <div style="display:flex; gap:16px;">
    <div style="flex:1;">
      <p class="lbl">{label1}</p>
      <video id="v1_{uid}" preload="auto" muted style="cursor:pointer"
             onclick="togglePlay_{uid}()">
        <source src="data:video/mp4;base64,{b64_1}" type="video/mp4">
      </video>
    </div>
    <div style="flex:1;">
      <p class="lbl">{label2}</p>
      <video id="v2_{uid}" preload="auto" muted style="cursor:pointer"
             onclick="togglePlay_{uid}()">
        <source src="data:video/mp4;base64,{b64_2}" type="video/mp4">
      </video>
    </div>
  </div>
  <div class="controls">
    <button id="pb_{uid}" onclick="togglePlay_{uid}()">▶ Play</button>
    <input type="range" id="sl_{uid}" min="0" max="10000" value="0"
           oninput="seek_{uid}(this.value)">
    <span id="tl_{uid}">0.0 s / 0.0 s</span>
  </div>{chart_html}
</div>
{chartjs_tag}
<script>
(function() {{
  const v1 = document.getElementById('v1_{uid}');
  const v2 = document.getElementById('v2_{uid}');
  const sl = document.getElementById('sl_{uid}');
  const pb = document.getElementById('pb_{uid}');
  const tl = document.getElementById('tl_{uid}');
  let playing = false, seeking = false, myChart = null;

  function fmt(t) {{ return t.toFixed(1) + ' s'; }}
  function dur()  {{ return (v1.duration && isFinite(v1.duration)) ? v1.duration : 0; }}

  function seekTo(t) {{
    const d = dur(); if (!d) return;
    seeking = true;
    t = Math.max(0, Math.min(t, d));
    v1.currentTime = t; v2.currentTime = t;
    sl.value = Math.round((t / d) * 10000);
    tl.textContent = fmt(t) + ' / ' + fmt(d);
    setTimeout(() => {{ seeking = false; }}, 150);
  }}

  v1.addEventListener('loadedmetadata', () => {{
    tl.textContent = fmt(0) + ' / ' + fmt(dur());
  }});

  v1.addEventListener('timeupdate', () => {{
    if (seeking) return;
    const d = dur();
    if (d > 0) {{
      sl.value = Math.round((v1.currentTime / d) * 10000);
      tl.textContent = fmt(v1.currentTime) + ' / ' + fmt(d);
      if (Math.abs(v1.currentTime - v2.currentTime) > 0.15)
        v2.currentTime = v1.currentTime;
    }}
    if (myChart) myChart.update('none');
  }});

  v1.addEventListener('ended', () => {{
    playing = false; pb.textContent = '▶ Play'; v2.pause();
  }});

  window['seek_{uid}'] = function(val) {{
    const d = dur(); if (!d) return;
    seekTo((val / 10000) * d);
  }};
  window['togglePlay_{uid}'] = function() {{
    if (playing) {{ v1.pause(); v2.pause(); pb.textContent = '▶ Play'; playing = false; }}
    else {{ v1.play(); v2.play(); pb.textContent = '⏸ Pause'; playing = true; }}
  }};

  // ── Chart ─────────────────────────────────────────────────────────────────
  const chartData = {chart_json};
  const plotCols  = {plot_cols_js};
  const palette   = {palette_js};

  if (chartData.length && plotCols.length) {{
    const timestamps = chartData.map(r => r.timestamp_sec);

    const seekLinePlugin = {{
      id: 'seekLine',
      afterDraw(chart) {{
        if (!dur() || !v1.readyState) return;
        const x = chart.scales.x.getPixelForValue(v1.currentTime);
        const {{ ctx, chartArea: {{ top, bottom }} }} = chart;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom);
        ctx.strokeStyle = '#7eb8f7'; ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]); ctx.stroke(); ctx.restore();
      }},
    }};

    const colLabels = {{
      'speed_proxy': 'Speed (px/s)',
      'balance_score': 'Balance (0-100)',
      'line_efficiency_score': 'Line Eff. (0-100)',
      'trunk_angle_deg': 'Trunk Angle (°)',
    }};
    const datasets = plotCols.map((col, i) => ({{
      label: colLabels[col] || col.replace(/_/g, ' '),
      data: chartData.map(r => r[col] ?? null),
      borderColor: palette[i % palette.length],
      backgroundColor: palette[i % palette.length] + '22',
      borderWidth: 1.5, pointRadius: 0, tension: 0.3, spanGaps: true,
    }}));

    const ctx = document.getElementById('chart_{uid}').getContext('2d');
    myChart = new Chart(ctx, {{
      type: 'line',
      data: {{ labels: timestamps, datasets }},
      plugins: [seekLinePlugin],
      options: {{
        responsive: true, maintainAspectRatio: true, animation: false,
        interaction: {{ mode: 'index', intersect: false }},
        plugins: {{
          legend: {{ labels: {{ color: '#aaa', font: {{ size: 11 }}, boxWidth: 12 }} }},
          tooltip: {{ callbacks: {{ title: (items) => fmt(items[0].parsed.x) }} }},
        }},
        scales: {{
          x: {{
            type: 'linear',
            title: {{ display: true, text: 'Time (s)', color: '#666' }},
            ticks: {{ color: '#666', maxTicksLimit: 10 }},
            grid: {{ color: '#2a2a2a' }},
          }},
          y: {{ ticks: {{ color: '#666' }}, grid: {{ color: '#2a2a2a' }} }},
        }},
        onClick(evt, _elements, chart) {{
          // evt.x is viewport-relative; convert to canvas-relative first
          const pos = Chart.helpers.getRelativePosition(evt, chart);
          const xVal = chart.scales.x.getValueForPixel(pos.x);
          if (xVal != null) seekTo(xVal);
        }},
      }},
    }});
  }}
}})();
</script>
"""
    components.html(html, height=component_height)


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
        if st.session_state.artifacts is not None:
            _df_sync = pd.read_csv(st.session_state.artifacts.features_csv_path)
            _pcols_sync = [c for c in [
                "balance_score", "line_efficiency_score", "speed_proxy", "trunk_angle_deg",
            ] if c in _df_sync.columns]
            sync_video_player(
                st.session_state.temp_video_path,
                st.session_state.artifacts.annotated_video_path,
                label1="Input video",
                label2="Annotated output",
                df=_df_sync,
                plot_cols=_pcols_sync,
            )
        else:
            st.markdown('<p class="section-label">Input video</p>', unsafe_allow_html=True)
            st.video(st.session_state.temp_video_path, width=640)
            st.caption("Annotated output will appear here after processing.")

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
                legacy_input = output_root / "input.mp4"
                legacy_csv = output_root / "features.csv"
                _df_leg = pd.read_csv(legacy_csv) if legacy_csv.exists() else None
                _pcols_leg = [c for c in [
                    "balance_score", "line_efficiency_score", "speed_proxy",
                ] if _df_leg is not None and c in _df_leg.columns] or None
                if legacy_input.exists():
                    sync_video_player(
                        str(legacy_input), str(legacy_annotated),
                        label1="Input", label2="Annotated",
                        df=_df_leg, plot_cols=_pcols_leg,
                    )
                else:
                    st.markdown('<p class="section-label">Annotated</p>', unsafe_allow_html=True)
                    st.video(str(legacy_annotated), width=480)

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

                input_vid = sdir / "input.mp4"
                annotated_vid = sdir / "annotated_output.mp4"
                csv_p = sdir / "features.csv"
                _df_s = pd.read_csv(csv_p) if csv_p.exists() else None
                _pcols_s = [c for c in [
                    "balance_score", "line_efficiency_score", "speed_proxy",
                ] if _df_s is not None and c in _df_s.columns] or None
                if input_vid.exists():
                    sync_video_player(
                        str(input_vid), str(annotated_vid),
                        label1="Input", label2="Annotated",
                        df=_df_s, plot_cols=_pcols_s,
                    )
                else:
                    st.markdown('<p class="section-label">Annotated</p>', unsafe_allow_html=True)
                    st.video(str(annotated_vid), width=480)

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
