# DriverCoach

## Project Summary
DriverCoach is a multi-sport performance review shell with a clean frontend and a FastAPI backend that reuses the existing computer-vision pipeline from `streamlit/`.

## Workflow Path
Incremental VRL project.

## Current Operating State
- `streamlit/` contains the full source pipeline logic — source of truth for downhill analytics.
- `backend/` is a FastAPI wrapper exposing REST endpoints; imports karting pipeline directly.
- `frontend/` is a Vite React app with real API wiring and DEMO mode fallback.
- Karting: fully runnable (FPV + action cam) via `karting/demo/pipeline.py`.
- Downhill: runnable via streamlit pipeline (YOLO11n pose model).
- Surf: declared shell, no engine yet.
- Frontend works in DEMO mode when backend is unavailable (health-checked every 30s).

## Source of Truth
- `backend/main.py` — FastAPI app
- `frontend/src/main.jsx` — App root + health check
- `frontend/src/pages.jsx` — Overview, Analyze, Sessions, Method
- `frontend/src/karting.jsx` — Karting demo page (FPV + action cam)
- `frontend/src/review.jsx` — Session review with real videos + data
- `frontend/src/core.jsx` — SPORTS config, Nav, shared UI
- `frontend/public/karting-demo/` — Demo videos + summary JSONs
- `karting/demo/pipeline.py` — Karting CV pipeline (SAM3+HSV + YOLO11n + LLM/VLM)
- `karting/notebooks/` — SAM2 vs SAM3 comparison notebook
- `streamlit/src/services/pipeline.py` — Downhill analysis pipeline

## Stack and Architecture
- Backend: FastAPI + Uvicorn, imports karting pipeline from `karting/demo/` and downhill from `streamlit/src/`
- Frontend: React 18 + Vite, Space Grotesk + Space Mono fonts
- Storage: `data/outputs/<session_id>/` — annotated video, features.csv, features.json, meta.json
- Backend serves videos via `/sessions/{id}/video/{input|annotated}`

## Python Environments

### `backend/.venv` — single environment for API + all pipelines
This is the **canonical runtime environment**. It contains everything needed to run both the FastAPI server and the CV pipelines (SAM3, YOLO11n, Groq, Anthropic).

```
fastapi + uvicorn          # API server
sam3 == 0.1.0              # track segmentation (editable from facebookresearch/sam3)
ultralytics == 8.4.41      # YOLO11n kart / YOLO26m pose detection
torch == 2.11.0            # deep learning runtime
xformers == 0.0.35         # efficient attention for SAM3
triton-windows             # required by SAM3 on Windows
groq == 1.2.0              # Groq LLM API (llama-4-scout)
anthropic == 0.97.0        # Anthropic fallback (claude-haiku)
opencv-python              # video processing
numpy == 1.26.4            # pinned — SAM3 requires numpy 1.x
imageio-ffmpeg             # H.264 re-encode for browser playback
scipy, pandas, polars      # data processing
```

> ⚠️ numpy is pinned to 1.26.4 by SAM3. Do NOT upgrade without testing SAM3 first.

### `conda/sam3` — legacy research environment (do not use for the API)
Used only for running the comparison notebook or isolated SAM3 experiments.
Contains the same packages as `.venv` but with conda Python and CUDA 12.8 torch.
Keep it around for notebook work; do not rely on it for the backend.

### Activation
```bash
# Backend API + pipeline (Windows)
backend\.venv\Scripts\activate

# Research / notebook only
conda activate sam3
```

## Run Commands

### Backend (from project root)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate                        # Windows
# source .venv/bin/activate                  # Linux/Mac
pip install -r requirements.txt
# SAM3 must be installed as editable from local clone:
pip install -e C:\Users\OSMAN\sam3            # Windows — adjust path
# pip install -e /path/to/sam3               # Linux/Mac
uvicorn backend.main:app --reload --port 8000
```
> Set `MODEL_PATH` in `backend/.env` to point to your YOLO weights.
> Set `GROQ_API_KEY` and `ANTHROPIC_API_KEY` in `backend/.env` for LLM coaching.

### Frontend (from project root)
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Streamlit (legacy, still works)
```bash
cd streamlit
streamlit run app/streamlit_app.py
```

## API Endpoints
- `GET  /health` — status + model_exists flag
- `POST /analyze` — multipart: video file + sport + optional inference params
- `GET  /sessions` — list all sessions (newest first)
- `GET  /sessions/{id}` — session meta + downsampled features array
- `GET  /sessions/{id}/video/input` — input video stream
- `GET  /sessions/{id}/video/annotated` — annotated video stream

## Frontend Behaviour
- **DEMO mode**: active when backend is offline. Shows sample data, simulates processing.
- **ONLINE mode**: health check passes. Analyze page POSTs real video; review loads real data + videos.
- Sessions page falls back to demo sessions when API returns empty list.
- Review page shows `SyncVideoPlayer` (side-by-side input + annotated with scrub bar) for real sessions.

## Deployment Notes
- Keep backend and frontend separated.
- Prefer a dedicated backend venv at `backend/.venv/` (gitignored).
- Use `VITE_API_URL` env var in frontend to point to deployed backend URL.
- Backend model path configurable via `MODEL_PATH` env var.

## Constraints
- No fake parity: surf remains a shell until its engine exists.
- Colors: oklch-based, sober (amber DH / blue KT / teal SF) — no neon.
- Do not import Streamlit in the backend; only import from `streamlit/src/`.
- numpy must stay at 1.26.x — SAM3 breaks on numpy 2.x.
- VLM (image inference) is on-demand only, never automatic. LLM (text-only metrics) runs automatically at pipeline end.
- SAM3 local clone path (`C:\Users\OSMAN\sam3`) is machine-specific — document path when moving to a new machine.

## Working Directory Rule
**Always edit files in their actual project paths** — never in `.claude/worktrees/`.
- Frontend edits → `D:\Osman\Trabajo\Personal\DriverCoach\frontend\src\`
- Pipeline edits → `D:\Osman\Trabajo\Personal\DriverCoach\karting\demo\pipeline.py`
- Do NOT create git worktrees for edits. Edit main working tree directly.

## Current Priority
Karting demo live for Saturday pitch. FPV + action cam sessions working end-to-end.
