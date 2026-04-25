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

SPORTS = {
    "downhill": {
        "label": "Downhill",
        "accent": "#F97316",
        "surface": "terrain / line / body",
        "readiness": "live",
        "badge": "Live now",
        "es": "Revision tecnica de postura, linea y contexto de terreno.",
        "en": "Technical review for posture, line choice, and terrain context.",
        "capabilities": [
            "posture_analysis",
            "line_review",
            "terrain_context",
            "session_playback",
        ],
    },
    "karting": {
        "label": "Karting",
        "accent": "#C9A84C",
        "surface": "track / geometry / decision",
        "readiness": "experimental",
        "badge": "Decision system",
        "es": "Modulo para segmentacion de ruta, scoring de frenado y recomendacion de trazada.",
        "en": "Module for route segmentation, braking scoring, and line recommendation.",
        "capabilities": [
            "route_segmentation",
            "geometry_extraction",
            "decision_scoring",
            "telemetry_sync",
            "line_recommendation",
        ],
    },
    "surf": {
        "label": "Surf",
        "accent": "#4AA7A3",
        "surface": "wave / timing / balance",
        "readiness": "upcoming",
        "badge": "Module shell",
        "es": "Modulo futuro para fase de ola, timing, postura y maniobras.",
        "en": "Future module for wave phase, timing, posture, and maneuver review.",
        "capabilities": [
            "wave_phase",
            "timing_review",
            "balance_review",
            "maneuver_tagging",
        ],
    },
}

SHARED_FLOW = """```text
Upload
  -> choose sport
  -> load capability set
  -> run sport adapter
  -> save session with sport
  -> review evidence
  -> deliver next-step guidance
```"""

KARTING_FLOW = """```text
Video + speed input
  -> perception
     -> track edges
     -> apex markers
     -> kart position
  -> route segmentation
     -> straight
     -> braking zone
     -> turn-in
     -> apex
     -> exit
     -> sector / corner id
  -> geometry
     -> distance to apex
     -> lateral position
     -> curve phase
     -> heading / curvature
  -> scoring
     -> brake_score
     -> turn_score
  -> guidance
     -> brake earlier / later
     -> turn earlier / later
     -> adjust line
     -> improve entry / apex / exit
```"""

SURF_FLOW = """```text
Video
  -> wave context
  -> rider timing
  -> body balance
  -> maneuver tagging
  -> next-step review
```"""


def _b64(path: str) -> str:
    with open(path, "rb") as file_obj:
        return base64.b64encode(file_obj.read()).decode()


def sync_video_player(
    path1: str,
    path2: str,
    label1: str = "Input",
    label2: str = "Annotated",
    video_max_height: int = 320,
    df: pd.DataFrame | None = None,
    plot_cols: list[str] | None = None,
) -> None:
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

    chart_json, plot_cols_js, palette_js = "[]", "[]", "[]"
    if has_chart:
        cols = ["timestamp_sec"] + [col for col in plot_cols if col in df.columns]
        safe = df[cols].copy()
        safe = safe.where(safe.notna(), other=None)
        chart_json = safe.to_json(orient="records")
        plot_cols_js = _json.dumps([col for col in plot_cols if col in df.columns])
        palette_js = _json.dumps(
            ["#F97316", "#C9A84C", "#4AA7A3", "#E2E8F0", "#F59E0B"]
        )

    chart_html = ""
    chartjs_tag = ""
    if has_chart:
        chart_html = f"""
  <div style="margin-top:14px;">
    <p class="lbl">Signal trends · click to seek</p>
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
    color: #94A3B8; margin: 0 0 6px 0;
  }}
  #wrap_{uid} video {{
    width: 100%; display: block; border-radius: 12px; background: #000;
    max-height: {video_max_height}px; object-fit: contain;
    border: 1px solid #1E293B;
  }}
  #wrap_{uid} .controls {{
    display: flex; align-items: center; gap: 10px; margin-top: 10px;
  }}
  #wrap_{uid} #pb_{uid} {{
    padding: 6px 18px; font-size: 0.9rem; cursor: pointer;
    border-radius: 999px; border: 1px solid #334155;
    background: #0F172A; color: #E2E8F0; white-space: nowrap; flex-shrink: 0;
  }}
  #wrap_{uid} #sl_{uid} {{ flex: 1; cursor: pointer; accent-color: #F97316; }}
  #wrap_{uid} #tl_{uid} {{
    font-size: 0.78rem; color: #94A3B8; min-width: 90px; text-align: right; flex-shrink: 0;
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
    <button id="pb_{uid}" onclick="togglePlay_{uid}()">Play</button>
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
    playing = false; pb.textContent = 'Play'; v2.pause();
  }});

  window['seek_{uid}'] = function(val) {{
    const d = dur(); if (!d) return;
    seekTo((val / 10000) * d);
  }};
  window['togglePlay_{uid}'] = function() {{
    if (playing) {{ v1.pause(); v2.pause(); pb.textContent = 'Play'; playing = false; }}
    else {{ v1.play(); v2.play(); pb.textContent = 'Pause'; playing = true; }}
  }};

  const chartData = {chart_json};
  const plotCols = {plot_cols_js};
  const palette = {palette_js};

  if (chartData.length && plotCols.length) {{
    const timestamps = chartData.map(r => r.timestamp_sec);
    const datasets = plotCols.map((col, i) => ({{
      label: col.replace(/_/g, ' '),
      data: chartData.map(r => r[col] ?? null),
      borderColor: palette[i % palette.length],
      backgroundColor: palette[i % palette.length] + '22',
      borderWidth: 1.5, pointRadius: 0, tension: 0.3, spanGaps: true,
    }}));

    const seekLinePlugin = {{
      id: 'seekLine',
      afterDraw(chart) {{
        if (!dur() || !v1.readyState) return;
        const x = chart.scales.x.getPixelForValue(v1.currentTime);
        const {{ ctx, chartArea: {{ top, bottom }} }} = chart;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom);
        ctx.strokeStyle = '#F97316'; ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]); ctx.stroke(); ctx.restore();
      }},
    }};

    const ctx = document.getElementById('chart_{uid}').getContext('2d');
    myChart = new Chart(ctx, {{
      type: 'line',
      data: {{ labels: timestamps, datasets }},
      plugins: [seekLinePlugin],
      options: {{
        responsive: true, maintainAspectRatio: true, animation: false,
        interaction: {{ mode: 'index', intersect: false }},
        plugins: {{
          legend: {{ labels: {{ color: '#CBD5E1', font: {{ size: 11 }}, boxWidth: 12 }} }},
        }},
        scales: {{
          x: {{
            type: 'linear',
            title: {{ display: true, text: 'Time (s)', color: '#94A3B8' }},
            ticks: {{ color: '#94A3B8', maxTicksLimit: 10 }},
            grid: {{ color: '#1E293B' }},
          }},
          y: {{ ticks: {{ color: '#94A3B8' }}, grid: {{ color: '#1E293B' }} }},
        }},
        onClick(evt, _elements, chart) {{
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


def build_sport_card(sport_key: str, compact: bool = False) -> str:
    sport = SPORTS[sport_key]
    capabilities = "".join(
        f"<span class='chip'>{capability.replace('_', ' ')}</span>"
        for capability in sport["capabilities"]
    )
    size = "compact-card" if compact else "sport-card"
    return f"""
    <div class="{size}" style="border-color:{sport['accent']}33;">
      <div class="sport-topline">
        <span class="sport-badge" style="background:{sport['accent']}1A;color:{sport['accent']};">
          {sport['badge']}
        </span>
        <span class="sport-surface">{sport['surface']}</span>
      </div>
      <h3>{sport['label']}</h3>
      <p>{sport['es']}</p>
      <p class="muted">{sport['en']}</p>
      <div class="chip-row">{capabilities}</div>
    </div>
    """


def readiness_label(readiness: str) -> str:
    mapping = {
        "live": "Live / En vivo",
        "demo": "Demo / Demo",
        "experimental": "Experimental / Experimental",
        "upcoming": "Upcoming / Proximo",
    }
    return mapping.get(readiness, readiness.title())


def get_session_meta(session_dir: Path) -> dict:
    meta_file = session_dir / "meta.json"
    if meta_file.exists():
        return json.loads(meta_file.read_text())
    return {
        "session_id": session_dir.name,
        "sport": "downhill",
        "readiness": "legacy",
        "capabilities": SPORTS["downhill"]["capabilities"],
    }


def build_plot_cols(df: pd.DataFrame, sport_key: str) -> list[str]:
    candidate_cols = {
        "downhill": [
            "balance_score",
            "line_efficiency_score",
            "speed_proxy",
            "trunk_angle_deg",
        ],
        "karting": ["speed_proxy"],
        "surf": ["balance_score"],
    }
    return [col for col in candidate_cols.get(sport_key, []) if col in df.columns]


st.set_page_config(
    page_title="Sportotimization",
    page_icon="S",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
<style>
:root {
    --bg-0: #080808;
    --bg-1: #121212;
    --bg-2: #171717;
    --text-0: #EDEDE8;
    --text-1: #CFCFC8;
    --line: #262626;
    --orange: #F97316;
    --gold: #C9A84C;
    --teal: #4AA7A3;
}
.stApp {
    background:
        radial-gradient(circle at top right, rgba(201,168,76,0.18), transparent 26%),
        radial-gradient(circle at top left, rgba(249,115,22,0.16), transparent 24%),
        linear-gradient(180deg, #080808 0%, #121212 100%);
    color: var(--text-0);
}
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #0C0C0C 0%, #141414 100%);
    border-right: 1px solid var(--line);
}
.hero-shell {
    border: 1px solid #2A2A2A;
    border-radius: 24px;
    padding: 28px 28px 22px 28px;
    background:
      linear-gradient(140deg, rgba(201,168,76,0.10), rgba(249,115,22,0.05) 40%, rgba(8,8,8,0.92)),
      #101010;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}
.eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.72rem;
    color: #C9A84C;
    margin-bottom: 0.5rem;
}
.hero-title {
    font-size: 3rem;
    font-weight: 800;
    line-height: 0.95;
    margin: 0;
}
.hero-sub {
    margin-top: 0.8rem;
    color: #CFCFC8;
    max-width: 58rem;
}
.signal-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 18px;
}
.signal-card, .sport-card, .compact-card, .method-card {
    border: 1px solid #262626;
    border-radius: 20px;
    padding: 16px 18px;
    background: rgba(18, 18, 18, 0.95);
}
.signal-kicker, .section-kicker {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.72rem;
    color: #9CA3AF;
    margin-bottom: 0.4rem;
}
.signal-value {
    font-size: 1.2rem;
    font-weight: 700;
}
.signal-note, .muted {
    color: #A3A39C;
    font-size: 0.92rem;
}
.sport-topline {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
}
.sport-badge {
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 0.72rem;
    font-weight: 700;
}
.sport-surface {
    color: #9CA3AF;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
}
.sport-card h3, .compact-card h3 {
    margin: 12px 0 8px 0;
    font-size: 1.35rem;
}
.chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}
.chip {
    border-radius: 999px;
    padding: 4px 10px;
    background: #1A1A1A;
    border: 1px solid #2B2B2B;
    color: #D6D3D1;
    font-size: 0.75rem;
}
.state-pill {
    border-radius: 999px;
    padding: 4px 10px;
    border: 1px solid #333333;
    color: #E7E5E4;
    background: #151515;
    display: inline-block;
    margin-right: 8px;
    margin-bottom: 8px;
    font-size: 0.78rem;
}
.section-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
    margin-top: 6px;
}
.section-title {
    margin: 0;
    font-size: 1.55rem;
}
.method-card pre {
    margin: 0;
}
@media (max-width: 900px) {
    .signal-grid {
        grid-template-columns: 1fr;
    }
}
</style>
""",
    unsafe_allow_html=True,
)

config = AppConfig()
ensure_dir(config.temp_dir)
ensure_dir(config.output_dir)

for key, value in [
    ("temp_video_path", None),
    ("uploaded_file_id", None),
    ("artifacts", None),
    ("session_dir", None),
    ("selected_sport", "downhill"),
]:
    if key not in st.session_state:
        st.session_state[key] = value

model_exists = Path(config.model_path).exists()
if not model_exists and SPORTS["downhill"]["readiness"] == "live":
    SPORTS["downhill"]["readiness"] = "demo"
    SPORTS["downhill"]["badge"] = "Demo mode"

with st.sidebar:
    st.markdown("## System")
    selected_sport = st.radio(
        "Sport / Deporte",
        options=list(SPORTS.keys()),
        format_func=lambda key: SPORTS[key]["label"],
        index=list(SPORTS.keys()).index(st.session_state.selected_sport),
    )
    st.session_state.selected_sport = selected_sport
    sport = SPORTS[selected_sport]

    st.markdown(
        f"<span class='state-pill'>{readiness_label(sport['readiness'])}</span>",
        unsafe_allow_html=True,
    )
    st.caption(f"{sport['es']} {sport['en']}")

    st.markdown("## Inference")
    if not model_exists:
        st.warning("Model file not found. Downhill stays in demo mode.")
    model_path = st.text_input(
        "Model path",
        value=config.model_path,
        disabled=not model_exists,
    )
    min_conf = st.slider(
        "Min confidence",
        0.05,
        0.95,
        float(config.min_keypoint_conf),
        0.05,
    )
    smoothing_window = st.slider(
        "Smoothing",
        1,
        15,
        int(config.smoothing_window),
        1,
    )
    use_groq = st.toggle("LLM feedback", value=config.use_groq_feedback)
    groq_model = st.text_input("Groq model", value=config.groq_model)

st.markdown(
    """
<div class="hero-shell">
  <div class="eyebrow">Vector Ridge Labs x Aurum PR</div>
  <h1 class="hero-title">Sportotimization</h1>
  <p class="hero-sub">
    One multi-sport review shell. Different sports. Different capability sets.
    Same product language: upload a session, inspect evidence, get the next step.
  </p>
  <div class="signal-grid">
    <div class="signal-card">
      <div class="signal-kicker">Live Module</div>
      <div class="signal-value">Downhill</div>
      <div class="signal-note">Current working pipeline preserved inside the new shell.</div>
    </div>
    <div class="signal-card">
      <div class="signal-kicker">Next System</div>
      <div class="signal-value">Karting</div>
      <div class="signal-note">Route segmentation, geometry, and decision scoring.</div>
    </div>
    <div class="signal-card">
      <div class="signal-kicker">Platform Rule</div>
      <div class="signal-value">Capability-aware</div>
      <div class="signal-note">Each sport declares its own functions, review logic, and readiness state.</div>
    </div>
  </div>
</div>
""",
    unsafe_allow_html=True,
)

overview_tab, analyze_tab, sessions_tab, method_tab = st.tabs(
    ["Overview", "Analyze", "Sessions", "Method"]
)

with overview_tab:
    st.markdown(
        """
<div class="section-head">
  <div>
    <div class="section-kicker">Portfolio Surface</div>
    <h2 class="section-title">System before sports-specific depth</h2>
  </div>
</div>
""",
        unsafe_allow_html=True,
    )
    cols = st.columns(3)
    for column, sport_key in zip(cols, SPORTS.keys()):
        with column:
            st.markdown(build_sport_card(sport_key), unsafe_allow_html=True)

    left, right = st.columns([1.15, 0.85])
    with left:
        st.markdown("### Shared flow")
        st.markdown(SHARED_FLOW)
    with right:
        st.markdown("### Active rules")
        st.markdown(
            "- ES + EN product copy\n"
            "- Honest readiness states\n"
            "- Shared session model with `sport` + `capabilities`\n"
            "- No fake parity across sports"
        )

with analyze_tab:
    sport = SPORTS[selected_sport]
    st.markdown(
        f"""
<div class="section-head">
  <div>
    <div class="section-kicker">Analyze / Analizar</div>
    <h2 class="section-title">{sport['label']} module</h2>
  </div>
  <div>
    <span class="state-pill">{readiness_label(sport['readiness'])}</span>
  </div>
</div>
""",
        unsafe_allow_html=True,
    )
    st.markdown(build_sport_card(selected_sport, compact=True), unsafe_allow_html=True)

    if selected_sport == "downhill":
        if not model_exists:
            st.info(
                "Downhill stays available in demo mode. Use Sessions to inspect saved runs while the shell is already multi-sport."
            )

        uploaded_file = st.file_uploader(
            "Upload downhill video / Sube un video downhill",
            type=["mp4", "mov", "avi", "mkv"],
            disabled=not model_exists,
        )

        if uploaded_file is not None:
            file_id = (selected_sport, uploaded_file.name, uploaded_file.size)
            if file_id != st.session_state.uploaded_file_id:
                suffix = Path(uploaded_file.name).suffix or ".mp4"
                temp_path = build_temp_video_path(config.temp_dir, suffix=suffix)
                with open(temp_path, "wb") as file_obj:
                    file_obj.write(uploaded_file.read())
                st.session_state.temp_video_path = temp_path
                st.session_state.uploaded_file_id = file_id
                st.session_state.artifacts = None
                st.session_state.session_dir = None

            if st.session_state.artifacts is not None:
                df_sync = pd.read_csv(st.session_state.artifacts.features_csv_path)
                sync_video_player(
                    st.session_state.temp_video_path,
                    st.session_state.artifacts.annotated_video_path,
                    label1="Input",
                    label2="Annotated",
                    df=df_sync,
                    plot_cols=build_plot_cols(df_sync, selected_sport),
                )
            else:
                st.video(st.session_state.temp_video_path)
                st.caption("Annotated output appears after processing.")

            if st.button("Process downhill session", type="primary", use_container_width=True):
                session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
                session_dir = Path(config.output_dir) / session_id
                ensure_dir(str(session_dir))
                run_config = AppConfig(
                    output_dir=str(session_dir),
                    temp_dir=config.temp_dir,
                    model_path=model_path,
                    min_keypoint_conf=min_conf,
                    smoothing_window=smoothing_window,
                    use_groq_feedback=use_groq,
                    groq_api_key=config.groq_api_key,
                    groq_model=groq_model,
                )
                with st.spinner("Running downhill pipeline..."):
                    st.session_state.artifacts = RiderAIPipeline(run_config).run(
                        st.session_state.temp_video_path
                    )
                st.session_state.session_dir = str(session_dir)
                shutil.copy(st.session_state.temp_video_path, session_dir / "input.mp4")

                summary = st.session_state.artifacts.summary
                meta = {
                    "original_filename": uploaded_file.name,
                    "session_id": session_id,
                    "sport": selected_sport,
                    "sport_label": sport["label"],
                    "readiness": sport["readiness"],
                    "capabilities": sport["capabilities"],
                    "avg_balance_score": summary.avg_balance_score,
                    "avg_line_efficiency_score": summary.avg_line_efficiency_score,
                    "avg_speed_proxy": summary.avg_speed_proxy,
                    "coaching_summary": summary.coaching_summary or "",
                }
                (session_dir / "meta.json").write_text(
                    json.dumps(meta, indent=2),
                    encoding="utf-8",
                )
                st.rerun()

            if st.session_state.artifacts is not None:
                artifacts = st.session_state.artifacts
                st.success("Downhill analysis complete.")
                m1, m2, m3 = st.columns(3)
                m1.metric("Balance", artifacts.summary.avg_balance_score)
                m2.metric("Line efficiency", artifacts.summary.avg_line_efficiency_score)
                m3.metric("Speed proxy", artifacts.summary.avg_speed_proxy)

                df = pd.read_csv(artifacts.features_csv_path)
                with st.expander("Per-frame data"):
                    st.dataframe(df, width="stretch")
                with st.expander("Summary JSON"):
                    st.json(artifacts.summary.__dict__)
                if artifacts.summary.coaching_summary:
                    st.info(artifacts.summary.coaching_summary)
        else:
            st.markdown(
                "- Live processing path stays here.\n"
                "- Sessions now save with `sport=downhill`.\n"
                "- This module acts as the reference adapter for future sports."
            )

    elif selected_sport == "karting":
        st.markdown("### Method signal")
        st.markdown(KARTING_FLOW)
        info_col, plan_col = st.columns([1.2, 0.8])
        with info_col:
            st.markdown(
                "- Core difference: this is not only detection.\n"
                "- Required layer: route segmentation + geometry + decision scoring.\n"
                "- MVP target: `brake_score` and `turn_score` with phase-aware guidance."
            )
        with plan_col:
            st.markdown(
                "### Readiness\n"
                "- UI shell: active now\n"
                "- Session model: active now\n"
                "- Analytics engine: next slice\n"
                "- Telemetry sync: planned"
            )
        st.warning(
            "Karting is intentionally shown as an active module shell. Processing is not wired yet because the route-segmentation layer is the real MVP, not a fake recycled downhill run."
        )

    else:
        st.markdown(SURF_FLOW)
        st.info(
            "Surf ships as a first-class module shell from day one. The next technical step is defining wave-phase and maneuver logic before live processing is enabled."
        )

with sessions_tab:
    st.markdown("### Sessions / Sesiones")
    output_root = Path(config.output_dir)
    sessions = sorted(
        [directory for directory in output_root.iterdir() if directory.is_dir()],
        reverse=True,
    )

    if not sessions:
        st.info("No saved sessions yet.")
    else:
        filter_options = ["all"] + list(SPORTS.keys())
        selected_filter = st.selectbox(
            "Filter by sport",
            filter_options,
            format_func=lambda key: "All sports" if key == "all" else SPORTS[key]["label"],
        )
        for session_dir in sessions:
            annotated_exists = (session_dir / "annotated_output.mp4").exists()
            if not annotated_exists:
                continue
            meta = get_session_meta(session_dir)
            sport_key = meta.get("sport", "downhill")
            if selected_filter != "all" and sport_key != selected_filter:
                continue

            title = f"{meta.get('sport_label', SPORTS.get(sport_key, SPORTS['downhill'])['label'])} · {meta.get('original_filename', session_dir.name)}"
            with st.expander(title):
                pill_cols = st.columns([1.1, 1.1, 1.2, 2.6])
                pill_cols[0].markdown(
                    f"<span class='state-pill'>{meta.get('sport', 'downhill')}</span>",
                    unsafe_allow_html=True,
                )
                pill_cols[1].markdown(
                    f"<span class='state-pill'>{readiness_label(meta.get('readiness', 'legacy'))}</span>",
                    unsafe_allow_html=True,
                )
                pill_cols[2].markdown(
                    f"<span class='state-pill'>{meta.get('session_id', session_dir.name)}</span>",
                    unsafe_allow_html=True,
                )

                metric_cols = st.columns(3)
                metric_cols[0].metric("Balance", meta.get("avg_balance_score", "-"))
                metric_cols[1].metric("Line efficiency", meta.get("avg_line_efficiency_score", "-"))
                metric_cols[2].metric("Speed proxy", meta.get("avg_speed_proxy", "-"))

                input_vid = session_dir / "input.mp4"
                annotated_vid = session_dir / "annotated_output.mp4"
                csv_path = session_dir / "features.csv"
                df_session = pd.read_csv(csv_path) if csv_path.exists() else None

                if input_vid.exists():
                    sync_video_player(
                        str(input_vid),
                        str(annotated_vid),
                        label1="Input",
                        label2="Annotated",
                        df=df_session,
                        plot_cols=build_plot_cols(df_session, sport_key) if df_session is not None else None,
                    )
                else:
                    st.video(str(annotated_vid))

                capabilities = meta.get("capabilities", [])
                if capabilities:
                    st.caption("Capabilities: " + ", ".join(capabilities))
                coaching = meta.get("coaching_summary", "")
                if coaching:
                    st.info(coaching)

with method_tab:
    st.markdown("### Method / Metodo")
    left, right = st.columns([1.0, 1.0])
    with left:
        st.markdown("#### Shared engine")
        st.markdown(SHARED_FLOW)
        st.markdown(
            "- One shell\n"
            "- One session model\n"
            "- Sport-specific capability sets\n"
            "- Honest readiness labels"
        )
    with right:
        st.markdown(f"#### {SPORTS[selected_sport]['label']} focus")
        if selected_sport == "karting":
            st.markdown(KARTING_FLOW)
        elif selected_sport == "surf":
            st.markdown(SURF_FLOW)
        else:
            st.markdown(
                """```text
Video
  -> pose estimation
  -> frame features
  -> line + balance review
  -> annotated playback
  -> coaching summary
```"""
            )

    st.markdown("#### Capability matrix")
    matrix_rows = []
    capability_order = [
        "posture_analysis",
        "line_review",
        "terrain_context",
        "route_segmentation",
        "geometry_extraction",
        "decision_scoring",
        "telemetry_sync",
        "wave_phase",
        "maneuver_tagging",
    ]
    for capability in capability_order:
        row = {"capability": capability.replace("_", " ")}
        for sport_key, sport_meta in SPORTS.items():
            row[sport_meta["label"]] = "yes" if capability in sport_meta["capabilities"] else "-"
        matrix_rows.append(row)
    st.dataframe(pd.DataFrame(matrix_rows), width="stretch", hide_index=True)
