from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "streamlit"))

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from src.config import AppConfig
from src.io.temp_files import ensure_dir
from src.services.pipeline import RiderAIPipeline

DATA_ROOT = ROOT / "data"
OUTPUTS = DATA_ROOT / "outputs"
INPUTS = DATA_ROOT / "inputs"

ensure_dir(str(OUTPUTS))
ensure_dir(str(INPUTS))

_DEFAULT_MODEL = str(ROOT / "models" / "yolo26m-pose.pt")

SPORT_META = {
    "downhill": {
        "label": "Downhill",
        "readiness": "live",
        "capabilities": ["posture_analysis", "line_review", "terrain_context", "session_playback"],
    },
    "karting": {
        "label": "Karting",
        "readiness": "experimental",
        "capabilities": ["route_segmentation", "geometry_extraction", "decision_scoring", "telemetry_sync"],
    },
    "surf": {
        "label": "Surf",
        "readiness": "upcoming",
        "capabilities": ["wave_phase", "timing_review", "balance_review", "maneuver_tagging"],
    },
}

app = FastAPI(title="DriverCoach API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )


@app.get("/health")
def health():
    model_path = os.getenv("MODEL_PATH", _DEFAULT_MODEL)
    return {
        "status": "ok",
        "version": "1.0.0",
        "model_exists": Path(model_path).exists(),
    }


@app.post("/analyze")
async def analyze(
    video: UploadFile = File(...),
    sport: str = Form("downhill"),
    min_conf: float = Form(0.35),
    smoothing_window: int = Form(5),
    use_groq: bool = Form(False),
    groq_api_key: str = Form(""),
    groq_model: str = Form("openai/gpt-oss-20b"),
):
    if sport not in SPORT_META:
        raise HTTPException(400, f"Unknown sport: {sport}")

    session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    session_dir = OUTPUTS / session_id
    ensure_dir(str(session_dir))

    suffix = Path(video.filename or "upload.mp4").suffix or ".mp4"
    temp_path = str(INPUTS / f"{session_id}{suffix}")

    with open(temp_path, "wb") as f:
        shutil.copyfileobj(video.file, f)

    model_path = os.getenv("MODEL_PATH", _DEFAULT_MODEL)

    run_config = AppConfig(
        output_dir=str(session_dir),
        temp_dir=str(INPUTS),
        model_path=model_path,
        min_keypoint_conf=min_conf,
        smoothing_window=smoothing_window,
        use_groq_feedback=use_groq and bool(groq_api_key),
        groq_api_key=groq_api_key or None,
        groq_model=groq_model,
    )

    try:
        artifacts = RiderAIPipeline(run_config).run(temp_path)
    except Exception as exc:
        shutil.rmtree(str(session_dir), ignore_errors=True)
        raise HTTPException(500, f"Pipeline error: {exc}") from exc

    shutil.copy(temp_path, session_dir / "input.mp4")

    summary = artifacts.summary
    sport_info = SPORT_META[sport]

    meta = {
        "original_filename": video.filename or "upload.mp4",
        "session_id": session_id,
        "sport": sport,
        "sport_label": sport_info["label"],
        "readiness": sport_info["readiness"],
        "capabilities": sport_info["capabilities"],
        "avg_balance_score": summary.avg_balance_score,
        "avg_line_efficiency_score": summary.avg_line_efficiency_score,
        "avg_speed_proxy": summary.avg_speed_proxy,
        "coaching_summary": summary.coaching_summary or "",
        "posture_distribution": summary.posture_distribution,
        "terrain_distribution": summary.terrain_distribution,
    }

    (session_dir / "meta.json").write_text(
        json.dumps(meta, indent=2), encoding="utf-8"
    )

    return {"session_id": session_id, "meta": meta}


@app.get("/sessions")
def list_sessions():
    sessions = []
    if not OUTPUTS.exists():
        return sessions
    for d in sorted(OUTPUTS.iterdir(), reverse=True):
        if not d.is_dir():
            continue
        meta_file = d / "meta.json"
        if not meta_file.exists():
            continue
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            meta.setdefault("sport", "downhill")
            meta.setdefault("session_id", d.name)
            sessions.append(meta)
        except Exception:
            continue
    return sessions


@app.get("/sessions/{session_id}")
def get_session(session_id: str):
    session_dir = OUTPUTS / session_id
    if not session_dir.exists():
        raise HTTPException(404, "Session not found")

    meta_file = session_dir / "meta.json"
    if not meta_file.exists():
        raise HTTPException(404, "Session metadata not found")

    meta = json.loads(meta_file.read_text(encoding="utf-8"))

    csv_path = session_dir / "features.csv"
    if csv_path.exists():
        try:
            import pandas as pd

            df = pd.read_csv(csv_path)
            cols = [
                "timestamp_sec",
                "balance_score",
                "line_efficiency_score",
                "speed_proxy",
                "trunk_angle_deg",
                "posture_label",
                "terrain_label",
            ]
            available = [c for c in cols if c in df.columns]
            safe = df[available].where(df[available].notna(), other=None)
            # Downsample to max 200 rows for performance
            if len(safe) > 200:
                step = max(1, len(safe) // 200)
                safe = safe.iloc[::step]
            # Use to_json to handle numpy types (float64, int64, NaN) correctly
            meta["features"] = json.loads(safe.to_json(orient="records"))
        except Exception:
            meta["features"] = []
    else:
        meta["features"] = []

    return meta


@app.get("/sessions/{session_id}/video/{kind}")
def get_video(session_id: str, kind: str):
    session_dir = OUTPUTS / session_id
    file_map = {
        "input": "input.mp4",
        "annotated": "annotated_output.mp4",
    }
    filename = file_map.get(kind)
    if not filename:
        raise HTTPException(400, "Unknown video kind. Use 'input' or 'annotated'.")

    filepath = session_dir / filename
    if not filepath.exists():
        raise HTTPException(404, "Video not found")

    return FileResponse(
        str(filepath),
        media_type="video/mp4",
        headers={"Accept-Ranges": "bytes", "Cache-Control": "no-cache"},
    )
