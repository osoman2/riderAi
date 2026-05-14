from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "streamlit"))
sys.path.insert(0, str(ROOT))

# Load .env from backend/ directory
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from src.config import AppConfig
from src.io.temp_files import ensure_dir
from src.services.pipeline import RiderAIPipeline


def _try_downhill_sam_artifacts(
    *,
    video_path: str,
    session_dir: Path,
    mode: str,
    prompt: str,
    every_n: int,
) -> dict:
    """
    Best-effort DH SAM artifact generation.

    The main DH pipeline remains pose/line based. When SAM is available, this
    creates a sampled trail-mask preview and overlay artifact so Premium is a
    real processing attempt instead of just UI copy.
    """
    meta = {
        "enabled": True,
        "applied": False,
        "engine": "sam3_video",
        "artifact": None,
        "mask_preview": None,
        "frames": 0,
        "error": "",
    }

    if not KARTING_AVAILABLE or _karting_pipeline is None:
        meta["error"] = "SAM helper unavailable"
        return meta

    try:
        import cv2
        import numpy as np

        sample_every = max(1, every_n)
        frames = _karting_pipeline.extract_frames(
            video_path,
            every_n=sample_every,
            max_frames=120,
            skip_seconds=0,
        )
        if not frames:
            meta["error"] = "No frames extracted"
            return meta

        dh_prompt = prompt or {
            "helmet_cam": "mountain bike dirt trail path terrain ahead obstacles",
            "drone_front_overhead": "mountain bike downhill trail corridor dirt path top view",
            "drone_follow": "mountain bike downhill trail corridor dirt path around rider",
        }.get(mode, "mountain bike downhill trail dirt path corridor")

        sam_mode = "action_cam" if mode == "helmet_cam" else "fpv_follow"
        masks = _karting_pipeline.segment_track_sam3_video(
            frames,
            mode=sam_mode,
            prompt=dh_prompt,
            chunk_size=24,
        )
        engine = "sam3_video"
        if not masks:
            h0, w0 = frames[0].shape[:2]
            if sam_mode == "action_cam":
                trail_points = [
                    (w0 // 2, int(h0 * 0.22)),
                    (int(w0 * 0.35), int(h0 * 0.32)),
                    (int(w0 * 0.65), int(h0 * 0.32)),
                    (w0 // 2, int(h0 * 0.14)),
                ]
            else:
                trail_points = [
                    (w0 // 2, int(h0 * 0.62)),
                    (int(w0 * 0.35), int(h0 * 0.72)),
                    (int(w0 * 0.65), int(h0 * 0.72)),
                ]
            masks = _karting_pipeline.segment_track_sam2_video(
                frames,
                trail_points,
                mode=sam_mode,
            )
            engine = "sam2_hsv_fallback"
        if not masks:
            meta["error"] = "SAM returned no masks"
            return meta

        h, w = frames[0].shape[:2]
        overlay_path = session_dir / "sam_trail_overlay.mp4"
        mask_path = session_dir / "sam_trail_mask.png"
        fps = max(6.0, 30.0 / sample_every)
        writer = cv2.VideoWriter(
            str(overlay_path),
            cv2.VideoWriter_fourcc(*"mp4v"),
            fps,
            (w, h),
        )
        for frame, mask in zip(frames, masks):
            out = frame.copy()
            if mask is not None and mask.any():
                tint = np.zeros_like(out)
                tint[:, :] = (0, 170, 255)
                out[mask > 0] = (out[mask > 0] * 0.58 + tint[mask > 0] * 0.42).astype(np.uint8)
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                cv2.drawContours(out, contours, -1, (0, 220, 255), 2)
            writer.write(out)
        writer.release()

        mask_stats = []
        for mask in masks:
            if mask is None or not mask.any():
                mask_stats.append({"coverage": 0.0, "center": None, "width": 0.0})
                continue
            ys, xs = np.where(mask > 0)
            coverage = float(len(xs) / mask.size)
            center = float(xs.mean() / max(1, mask.shape[1]))
            sample_y = int(mask.shape[0] * (0.28 if sam_mode == "action_cam" else 0.62))
            row = mask[min(max(0, sample_y), mask.shape[0] - 1), :]
            width = float(np.count_nonzero(row) / max(1, mask.shape[1]))
            mask_stats.append({"coverage": coverage, "center": center, "width": width})

        valid_centers = [s["center"] for s in mask_stats if s["center"] is not None]
        valid_widths = [s["width"] for s in mask_stats if s["width"] > 0]
        valid_cov = [s["coverage"] for s in mask_stats if s["coverage"] > 0]
        avg_center = float(np.mean(valid_centers)) if valid_centers else None
        center_std = float(np.std(valid_centers)) if len(valid_centers) > 1 else 0.0
        avg_width = float(np.mean(valid_widths)) if valid_widths else 0.0
        avg_coverage = float(np.mean(valid_cov)) if valid_cov else 0.0
        continuity = float(len(valid_cov) / max(1, len(mask_stats)))
        bias = None if avg_center is None else avg_center - 0.5

        line_score = round(max(0.0, min(100.0, 100.0 - abs(bias or 0) * 120 - center_std * 180)), 1)
        visibility_score = round(max(0.0, min(100.0, continuity * 70 + min(avg_coverage * 350, 30))), 1)

        advice = []
        if continuity < 0.7:
            advice.append("- La visibilidad del sendero se corta por sombras, vegetacion o movimiento; usa el overlay para revisar solo los tramos donde el corredor se ve continuo.")
        else:
            advice.append("- El corredor se mantiene visible de forma estable; puedes usar esta toma para revisar decisiones de linea con confianza.")
        if bias is not None and bias > 0.08:
            advice.append("- La zona transitable aparece cargada hacia la derecha de la imagen; anticipa antes la mirada y prepara la salida para no cerrar tarde.")
        elif bias is not None and bias < -0.08:
            advice.append("- La zona transitable aparece cargada hacia la izquierda de la imagen; revisa si estas entrando demasiado pegado a ese borde.")
        else:
            advice.append("- El corredor queda bastante centrado; enfoca la revision en obstaculos y timing de entrada/salida.")
        if avg_width < 0.18:
            advice.append("- El sendero visible se ve estrecho; prioriza una linea limpia y evita correcciones bruscas sobre obstaculos.")
        else:
            advice.append("- Hay ancho visible para elegir linea; compara si conviene abrir antes o cortar mas directo segun el obstaculo.")

        try:
            import imageio_ffmpeg
            import subprocess as _sp

            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            h264_path = session_dir / "sam_trail_overlay_h264.mp4"
            result_enc = _sp.run(
                [
                    ffmpeg_exe, "-y", "-i", str(overlay_path),
                    "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                    "-movflags", "+faststart", "-an", str(h264_path),
                ],
                capture_output=True,
            )
            if result_enc.returncode == 0 and h264_path.exists():
                overlay_path.unlink()
                h264_path.rename(overlay_path)
        except Exception as enc_err:
            print(f"[backend] SAM overlay re-encode skipped: {enc_err}")
        cv2.imwrite(str(mask_path), masks[0])

        meta.update({
            "applied": True,
            "engine": engine,
            "artifact": overlay_path.name,
            "mask_preview": mask_path.name,
            "frames": len(masks),
            "prompt": dh_prompt,
            "metrics": {
                "avg_center": avg_center,
                "center_std": center_std,
                "avg_width": avg_width,
                "avg_coverage": avg_coverage,
                "continuity": continuity,
                "line_score": line_score,
                "visibility_score": visibility_score,
            },
            "coaching_summary": "\n".join(advice),
        })
        return meta
    except Exception as exc:
        meta["error"] = str(exc)
        return meta

# Karting pipeline (optional — graceful fallback if deps unavailable)
try:
    import karting.demo.pipeline as _karting_pipeline
    KARTING_AVAILABLE = True
except Exception as _karting_err:
    _karting_pipeline = None  # type: ignore
    KARTING_AVAILABLE = False
    print(f"[backend] Karting pipeline unavailable: {_karting_err}")

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
    mode: str = Form(""),
    tier: str = Form("premium"),    # "fast" | "basic" | "premium"
    every_n: int = Form(3),         # sample 1 of every N frames (premium default=3)
    min_conf: float = Form(0.35),
    smoothing_window: int = Form(5),
    prompt: str = Form(""),
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

    shutil.copy(temp_path, session_dir / "input.mp4")

    sport_info = SPORT_META[sport]

    # ------------------------------------------------------------------ karting
    if sport == "karting":
        if not KARTING_AVAILABLE:
            shutil.rmtree(str(session_dir), ignore_errors=True)
            raise HTTPException(503, "Karting pipeline dependencies not installed (cv2, ultralytics, etc.)")

        karting_mode = mode if mode in ("fpv_follow", "action_cam") else "fpv_follow"
        groq_key = groq_api_key.strip() or os.getenv("GROQ_API_KEY", "")
        if groq_key:
            os.environ["GROQ_API_KEY"] = groq_key

        try:
            kt_summary = _karting_pipeline.run(
                video_path=temp_path,
                every_n=max(1, every_n),
                max_frames=9999,   # process full video
                coaching=True,
                skip_seconds=0,
                mode=karting_mode,
                tier=tier,
                prompt=prompt.strip() or None,
                out_name="annotated",
                output_dir=str(session_dir),
            )
        except Exception as exc:
            shutil.rmtree(str(session_dir), ignore_errors=True)
            raise HTTPException(500, f"Karting pipeline error: {exc}") from exc

        # Re-encode mp4v → H.264 so browsers can play it
        raw_out = session_dir / "annotated.mp4"
        std_out = session_dir / "annotated_output.mp4"
        if raw_out.exists():
            try:
                import imageio_ffmpeg
                import subprocess as _sp
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                result_enc = _sp.run(
                    [ffmpeg_exe, "-y", "-i", str(raw_out),
                     "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                     "-movflags", "+faststart", "-an", str(std_out)],
                    capture_output=True,
                )
                if result_enc.returncode == 0 and std_out.exists():
                    raw_out.unlink()          # delete the mp4v original
                    print(f"[backend] Re-encoded → {std_out.name}")
                else:
                    # ffmpeg failed — just rename as fallback (may not play in browser)
                    raw_out.rename(std_out)
                    print(f"[backend] ffmpeg failed, using raw mp4v: {result_enc.stderr.decode()[-300:]}")
            except Exception as enc_err:
                raw_out.rename(std_out)
                print(f"[backend] Re-encode skipped ({enc_err}), using raw mp4v")
        elif not std_out.exists():
            print("[backend] Warning: annotated video not found after pipeline")

        meta = {
            "original_filename": video.filename or "upload.mp4",
            "session_id": session_id,
            "sport": sport,
            "sport_label": sport_info["label"],
            "readiness": sport_info["readiness"],
            "capabilities": sport_info["capabilities"],
            "mode": karting_mode,
            # karting-specific summary fields
            "frames_analyzed": kt_summary.get("frames_analyzed", 0),
            "karts_detected": kt_summary.get("karts_detected", 0),
            "top_karts": kt_summary.get("top_karts", []),
            "driver_scores": kt_summary.get("driver_scores", {}),
            "coaching": kt_summary.get("coaching", {}),
        }
        (session_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        # Also save full summary for the karting review endpoint
        (session_dir / "karting_summary.json").write_text(
            json.dumps(kt_summary, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        return {"session_id": session_id, "meta": meta}

    # ---------------------------------------------------------------- downhill
    dh_mode = mode or "drone_follow"
    if dh_mode in {"helmet_cam", "drone_front_overhead"}:
        sam_meta = {"enabled": tier == "premium", "applied": False}
        if tier == "premium":
            sam_meta = _try_downhill_sam_artifacts(
                video_path=temp_path,
                session_dir=session_dir,
                mode=dh_mode,
                prompt=prompt.strip(),
                every_n=every_n,
            )

        sam_metrics = sam_meta.get("metrics", {}) if isinstance(sam_meta, dict) else {}
        meta = {
            "original_filename": video.filename or "upload.mp4",
            "session_id": session_id,
            "sport": sport,
            "sport_label": sport_info["label"],
            "readiness": sport_info["readiness"],
            "capabilities": (
                ["line_review", "obstacle_cues", "session_playback", "trail_isolation"]
                if dh_mode == "helmet_cam"
                else ["trajectory_review", "section_review", "session_playback", "trail_isolation"]
            ),
            "mode": dh_mode,
            "tier": tier,
            "every_n": every_n,
            "prompt": prompt.strip(),
            "sam": sam_meta,
            "no_pose_pipeline": True,
            "avg_balance_score": None,
            "avg_line_efficiency_score": sam_metrics.get("line_score"),
            "avg_speed_proxy": None,
            "trail_visibility_score": sam_metrics.get("visibility_score"),
            "coaching_summary": sam_meta.get("coaching_summary", "") if isinstance(sam_meta, dict) else "",
            "posture_distribution": {},
            "terrain_distribution": {},
        }
        (session_dir / "meta.json").write_text(
            json.dumps(meta, indent=2), encoding="utf-8"
        )
        return {"session_id": session_id, "meta": meta}

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

    summary = artifacts.summary
    sam_meta = {"enabled": False, "applied": False}
    if tier == "premium":
        sam_meta = _try_downhill_sam_artifacts(
            video_path=temp_path,
            session_dir=session_dir,
            mode=dh_mode,
            prompt=prompt.strip(),
            every_n=every_n,
        )

    meta = {
        "original_filename": video.filename or "upload.mp4",
        "session_id": session_id,
        "sport": sport,
        "sport_label": sport_info["label"],
        "readiness": sport_info["readiness"],
        "capabilities": sport_info["capabilities"],
        "mode": dh_mode,
        "tier": tier,
        "every_n": every_n,
        "prompt": prompt.strip(),
        "sam": sam_meta,
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
            meta.setdefault("sport_label", SPORT_META.get(meta["sport"], SPORT_META["downhill"])["label"])
            meta.setdefault("readiness", SPORT_META.get(meta["sport"], SPORT_META["downhill"])["readiness"])
            meta.setdefault("mode", "drone_follow" if meta["sport"] == "downhill" else "fpv_follow")
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
    meta.setdefault("session_id", session_id)
    meta.setdefault("sport", "downhill")
    meta.setdefault("sport_label", SPORT_META.get(meta["sport"], SPORT_META["downhill"])["label"])
    meta.setdefault("readiness", SPORT_META.get(meta["sport"], SPORT_META["downhill"])["readiness"])
    meta.setdefault("capabilities", SPORT_META.get(meta["sport"], SPORT_META["downhill"])["capabilities"])
    meta.setdefault("mode", "drone_follow" if meta["sport"] == "downhill" else "fpv_follow")
    meta["videos"] = {
        "input": (session_dir / "input.mp4").exists(),
        "annotated": (session_dir / "annotated_output.mp4").exists(),
        "sam": (session_dir / "sam_trail_overlay.mp4").exists(),
    }

    csv_path = session_dir / "features.csv"
    if csv_path.exists():
        try:
            import csv

            cols = [
                "timestamp_sec",
                "balance_score",
                "line_efficiency_score",
                "speed_proxy",
                "trunk_angle_deg",
                "posture_label",
                "terrain_label",
            ]
            numeric_cols = {
                "timestamp_sec",
                "balance_score",
                "line_efficiency_score",
                "speed_proxy",
                "trunk_angle_deg",
            }
            rows = []
            with csv_path.open(newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                available = [c for c in cols if c in (reader.fieldnames or [])]
                for row in reader:
                    item = {}
                    for col in available:
                        val = row.get(col)
                        if val in ("", "nan", "NaN", "None", None):
                            item[col] = None
                        elif col in numeric_cols:
                            try:
                                item[col] = float(val)
                            except (TypeError, ValueError):
                                item[col] = None
                        else:
                            item[col] = val
                    rows.append(item)
            if len(rows) > 200:
                step = max(1, len(rows) // 200)
                rows = rows[::step]
            meta["features"] = rows
        except Exception as exc:
            print(f"[backend] Could not load features for {session_id}: {exc}")
            meta["features"] = []
    else:
        meta["features"] = []

    return meta


@app.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    # Safety: session_id must match timestamp pattern, no path traversal
    import re
    if not re.match(r"^\d{8}_\d{6}$", session_id):
        raise HTTPException(400, "Invalid session id")
    session_dir = OUTPUTS / session_id
    if not session_dir.exists():
        raise HTTPException(404, "Session not found")
    shutil.rmtree(str(session_dir))
    return {"deleted": session_id}


@app.post("/sessions/{session_id}/analyze-frame")
async def analyze_frame(session_id: str, timestamp_sec: float = Form(...), mode: str = Form("fpv_follow")):
    """Extract frame at timestamp_sec from annotated video + enrich VLM prompt with historical metrics."""
    import re
    if not re.match(r"^\d{8}_\d{6}$", session_id):
        raise HTTPException(400, "Invalid session id")

    session_dir = OUTPUTS / session_id
    # Prefer annotated video (has overlays), fall back to input
    video_path = session_dir / "annotated_output.mp4"
    if not video_path.exists():
        video_path = session_dir / "input.mp4"
    if not video_path.exists():
        raise HTTPException(404, "Video not found for this session")

    if not KARTING_AVAILABLE:
        raise HTTPException(503, "Karting pipeline not available")

    # Extract frame at timestamp
    import cv2 as _cv2
    cap = _cv2.VideoCapture(str(video_path))
    fps = cap.get(_cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(_cv2.CAP_PROP_FRAME_COUNT))
    target_frame = min(int(timestamp_sec * fps), total_frames - 1)
    cap.set(_cv2.CAP_PROP_POS_FRAMES, target_frame)
    ret, frame = cap.read()
    cap.release()
    if not ret or frame is None:
        raise HTTPException(500, "Could not extract frame at that timestamp")

    # ── Load historical session metrics to enrich VLM context ──────────────
    # The VLM only runs when the user explicitly pins a frame (timestamp_sec is
    # provided). We complement the visual analysis with telemetry from the
    # session's karting_summary.json so the model has quantitative context.
    metrics_ctx = ""
    window_frames = []
    summary_file = session_dir / "karting_summary.json"
    if summary_file.exists():
        try:
            summary = json.loads(summary_file.read_text(encoding="utf-8"))

            # Summary frames are indexed 0…N-1, matching the annotated video frame order.
            # Use fps to find frames within a ±5s window around the requested timestamp.
            window_sec = 5.0
            lo_f = max(0, int((timestamp_sec - window_sec) * fps))
            hi_f = int((timestamp_sec + window_sec) * fps)
            window_frames = [
                fr for fr in summary.get("frames", [])
                if lo_f <= fr.get("f", 0) <= hi_f
            ]

            if window_frames:
                n = len(window_frames)
                kl_pct  = sum(fr.get("kl", 0) for fr in window_frames) / n * 100
                kr_pct  = sum(fr.get("kr", 0) for fr in window_frames) / n * 100
                apex_n  = sum(1 for fr in window_frames if fr.get("ap", 0) > 0)
                gaps    = [fr["gap"] for fr in window_frames if fr.get("gap") is not None]
                avg_gap = round(sum(gaps) / len(gaps), 1) if gaps else None

                window_label = f"±{window_sec:.0f}s alrededor de {timestamp_sec:.1f}s"
                metrics_ctx += (
                    f"\n\nMétricas de telemetría ({window_label}):\n"
                    f"• Contacto kerb izquierdo: {kl_pct:.0f}% de frames analizados\n"
                    f"• Contacto kerb derecho: {kr_pct:.0f}% de frames analizados\n"
                    f"• Frames con ápex marcado: {apex_n}/{n}\n"
                )
                if avg_gap is not None:
                    metrics_ctx += f"• Gap promedio al kart adelante: {avg_gap:.1f}px\n"

            # Session-wide aggregates
            n_karts   = summary.get("karts_detected", "?")
            kerb_ev   = summary.get("kerb_events", 0)
            f_total   = summary.get("frames_analyzed", 1)
            kerb_rate = kerb_ev / f_total * 100 if f_total else 0

            metrics_ctx += (
                f"\nEstadísticas globales de la sesión:\n"
                f"• Karts detectados: {n_karts}\n"
                f"• Tasa de kerb (sesión completa): {kerb_rate:.0f}% de frames con contacto kerb\n"
                f"• Frames analizados: {f_total}\n"
            )

            # Attach the session-level coaching summary if available (first 500 chars)
            session_coaching = summary.get("coaching", {}).get("driver", "")
            if session_coaching:
                metrics_ctx += (
                    f"\nResumen IA de la sesión completa (referencia):\n"
                    f"{session_coaching[:500]}{'…' if len(session_coaching) > 500 else ''}\n"
                )
        except Exception as _me:
            print(f"[analyze-frame] Could not load session metrics: {_me}")

    # ── Build VLM prompt with visual context + telemetry ───────────────────
    ts_fmt = f"{int(timestamp_sec // 60)}:{int(timestamp_sec % 60):02d}"
    if mode == "action_cam":
        situation = (
            f"Vista GoPro desde casco de piloto de karting. "
            f"Momento analizado: {ts_fmt} ({timestamp_sec:.1f}s en el video). "
            f"Analiza: posición en pista, uso del ancho disponible, distancia al kart adelante "
            f"y trayectoria visible en este instante específico."
            f"{metrics_ctx}"
        )
    else:
        situation = (
            f"Vista FPV de drone siguiendo un kart. "
            f"Momento analizado: {ts_fmt} ({timestamp_sec:.1f}s en el video). "
            f"Analiza: posición lateral, uso del ancho de pista y trayectoria en esta curva/recta."
            f"{metrics_ctx}"
        )

    try:
        text = _karting_pipeline.vlm_coaching(frame, 0, situation)
    except Exception as exc:
        raise HTTPException(500, f"VLM error: {exc}") from exc

    return {
        "timestamp_sec": timestamp_sec,
        "frame_index": target_frame,
        "coaching": text,
        "mode": mode,
        "metrics_window_frames": len(window_frames),
    }


@app.get("/sessions/{session_id}/karting")
def get_karting_session(session_id: str):
    session_dir = OUTPUTS / session_id
    if not session_dir.exists():
        raise HTTPException(404, "Session not found")
    summary_file = session_dir / "karting_summary.json"
    if not summary_file.exists():
        raise HTTPException(404, "Karting summary not found for this session")
    summary = json.loads(summary_file.read_text(encoding="utf-8"))
    if not summary.get("mode"):
        meta_file = session_dir / "meta.json"
        if meta_file.exists():
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                summary["mode"] = meta.get("mode") or "fpv_follow"
            except Exception:
                summary["mode"] = "fpv_follow"
        else:
            summary["mode"] = "fpv_follow"
    return summary


@app.get("/sessions/{session_id}/video/{kind}")
def get_video(session_id: str, kind: str):
    session_dir = OUTPUTS / session_id
    file_map = {
        "input": "input.mp4",
        "annotated": "annotated_output.mp4",
        "sam": "sam_trail_overlay.mp4",
        "sam_mask": "sam_trail_mask.png",
    }
    filename = file_map.get(kind)
    if not filename:
        raise HTTPException(400, "Unknown video kind. Use 'input', 'annotated', 'sam' or 'sam_mask'.")

    filepath = session_dir / filename
    if not filepath.exists():
        raise HTTPException(404, "Video not found")

    media_type = "image/png" if filepath.suffix.lower() == ".png" else "video/mp4"
    return FileResponse(
        str(filepath),
        media_type=media_type,
        headers={"Accept-Ranges": "bytes", "Cache-Control": "no-cache"},
    )
