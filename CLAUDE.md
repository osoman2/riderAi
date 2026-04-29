# DriverCoach

## Project Summary
DriverCoach is a multi-sport performance review shell with a clean frontend and a FastAPI backend that reuses the existing computer-vision pipeline from `streamlit/`.

## Workflow Path
Incremental VRL project.

## Current Operating State
- `streamlit/` contains the full source pipeline logic — source of truth for analytics.
- `backend/` is a FastAPI wrapper that imports from `streamlit/src/` and exposes REST endpoints.
- `frontend/` is a Vite React app converted from `Referencia_front/` with real API wiring.
- Downhill is the only runnable analysis path; karting and surf are declared shells.
- Frontend works in DEMO mode when backend is unavailable (health-checked every 30s).

## Source of Truth
- `backend/main.py` — FastAPI app
- `frontend/src/main.jsx` — App root + health check
- `frontend/src/pages.jsx` — Overview, Analyze, Sessions, Method
- `frontend/src/karting.jsx` — Karting demo page (FPV + action cam)
- `frontend/src/review.jsx` — Session review with real videos + data
- `frontend/src/core.jsx` — SPORTS config, Nav, shared UI
- `frontend/public/karting-demo/` — Demo videos + summary JSONs
- `karting/demo/pipeline.py` — Karting CV pipeline (SAM2 + YOLO + VLM)
- `streamlit/src/services/pipeline.py` — Downhill analysis pipeline

## Stack and Architecture
- Backend: FastAPI + Uvicorn, imports pipeline from `streamlit/src/`
- Frontend: React 18 + Vite, Space Grotesk + Space Mono fonts
- Storage: `data/outputs/<session_id>/` — annotated video, features.csv, features.json, meta.json
- Backend serves videos via `/sessions/{id}/video/{input|annotated}`

## Run Commands

### Backend (from project root)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```
> Set `MODEL_PATH` in `backend/.env` to point to your YOLO weights.

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
- No fake parity: karting and surf remain shells until their engines exist.
- Colors: oklch-based, sober (amber DH / blue KT / teal SF) — no neon.
- Do not import Streamlit in the backend; only import from `streamlit/src/`.

## Working Directory Rule
**Always edit files in their actual project paths** — never in `.claude/worktrees/`.
- Frontend edits → `D:\Osman\Trabajo\Personal\DriverCoach\frontend\src\`
- Pipeline edits → `D:\Osman\Trabajo\Personal\DriverCoach\karting\demo\pipeline.py`
- Do NOT create git worktrees for edits. Edit main working tree directly.

## Current Priority
Karting demo live for Saturday pitch. FPV + action cam sessions working end-to-end.
