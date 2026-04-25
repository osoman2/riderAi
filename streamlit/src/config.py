from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class AppConfig:
    output_dir: str = os.getenv("OUTPUT_DIR", "data/outputs")
    temp_dir: str = os.getenv("TEMP_DIR", "data/inputs")
    model_path: str = os.getenv("MODEL_PATH", "models/yolo26m-pose.pt")
    min_keypoint_conf: float = float(os.getenv("MIN_KEYPOINT_CONF", "0.35"))
    smoothing_window: int = int(os.getenv("SMOOTHING_WINDOW", "5"))

    use_groq_feedback: bool = os.getenv("USE_GROQ_FEEDBACK", "false").lower() == "true"
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")
    groq_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
