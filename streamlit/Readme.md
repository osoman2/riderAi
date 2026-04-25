# Rider AI

Computer-vision pipeline for MTB downhill performance analysis. Detects rider pose frame-by-frame, extracts biomechanical metrics, and generates AI coaching feedback — with a Streamlit interface for uploading, processing, and reviewing saved sessions.

---

## Features

- **Pose estimation** — YOLO26 Pose detects 17 COCO keypoints per frame
- **Biomechanical metrics** — balance score, trunk angle, knee/elbow flexion, speed proxy, line efficiency
- **Posture classification** — attack vs. defensive position per frame
- **AI coaching feedback** — personalized text summary via Groq LLM
- **Annotated video output** — skeleton overlay + real-time stats, H.264 encoded
- **Gallery** — browse all past sessions with videos, charts, and coaching notes
- **Demo mode** — runs without the model file, showing pre-computed results from the Gallery

---

## Tech Stack

| Layer | Library |
|---|---|
| Pose estimation | [YOLO26](https://platform.ultralytics.com/ultralytics/yolo26) (Ultralytics) |
| Video processing | OpenCV + `imageio-ffmpeg` (H.264 re-encoding) |
| Analytics | NumPy, Pandas |
| Coaching LLM | Groq API (OpenAI-compatible) |
| Interface | Streamlit |

---

## Project Structure

```
rider-ai/
├── app/
│   └── streamlit_app.py        # Streamlit UI (Analyze / Gallery / About tabs)
├── src/
│   ├── config.py               # AppConfig dataclass, env var loading
│   ├── schemas.py              # Pydantic/dataclass schemas (FramePose, FrameFeatures, …)
│   ├── services/
│   │   ├── pipeline.py         # RiderAIPipeline orchestrator
│   │   └── llm_feedback.py     # Groq LLM coaching integration
│   ├── inference/
│   │   ├── pose_estimator.py   # YOLO26 wrapper, per-frame keypoint extraction
│   │   ├── smoother.py         # Moving-average keypoint stabilization
│   │   └── video_annotator.py  # Frame annotation + ffmpeg H.264 re-encoding
│   ├── analytics/
│   │   ├── geometry.py         # Angle/distance helpers
│   │   ├── trajectory.py       # Frame-to-frame displacement deltas
│   │   ├── terrain.py          # Terrain type classification
│   │   ├── features.py         # Per-frame feature builder
│   │   ├── scoring.py          # Clip-level summary and scores
│   │   └── posture.py          # Attack vs. defensive posture classifier
│   ├── io/
│   │   ├── video_io.py         # Video metadata + frame iterator
│   │   ├── exporters.py        # CSV / JSON exporters
│   │   └── temp_files.py       # Temp path helpers
│   └── utils/
│       └── constants.py        # COCO keypoint names, skeleton edges
├── data/
│   ├── inputs/                 # Temporary uploads (git-ignored)
│   └── outputs/                # Session folders: videos, CSVs, meta.json (git-ignored)
├── models/
│   └── yolo26m-pose.pt         # Model weights (git-ignored, download separately)
├── .env.example
├── requirements.txt
└── README.md
```

---

## Setup

### 1. Clone and create environment

```bash
git clone <repo-url>
cd rider-ai
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
pip install imageio-ffmpeg   # H.264 video encoding
```

### 3. Download the model

Download `yolo26m-pose.pt` from [Ultralytics YOLO26](https://platform.ultralytics.com/ultralytics/yolo26) and place it at:

```
models/yolo26m-pose.pt
```

The app runs in **Gallery-only / demo mode** if the model file is absent.

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
MODEL_PATH=models/yolo26m-pose.pt
MIN_KEYPOINT_CONF=0.35
SMOOTHING_WINDOW=5

# Optional — enables AI coaching feedback
USE_GROQ_FEEDBACK=true
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

### 5. Run

```bash
streamlit run app/streamlit_app.py
```

---

## Usage

1. Open the **Analyze** tab and upload an MTB downhill video (`.mp4`, `.mov`, `.avi`, `.mkv`)
2. Adjust confidence threshold and smoothing window in the sidebar if needed
3. Click **Process video** — the pipeline runs pose estimation, analytics, and (optionally) LLM coaching
4. Review the annotated video, metric charts, and coaching feedback
5. All sessions are saved automatically — browse them anytime in the **Gallery** tab

---

## Output per session

Each processed video is stored under `data/outputs/<timestamp>/`:

| File | Contents |
|---|---|
| `annotated_output.mp4` | H.264 video with skeleton overlay and stats |
| `input.mp4` | Copy of the original uploaded video |
| `features.csv` | Per-frame biomechanical metrics |
| `features.json` | Same data + clip-level summary in JSON |
| `meta.json` | Session metadata + coaching summary (used by Gallery) |