from __future__ import annotations

import os
from uuid import uuid4


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def build_temp_video_path(base_dir: str, suffix: str = ".mp4") -> str:
    ensure_dir(base_dir)
    return os.path.join(base_dir, f"upload_{uuid4().hex}{suffix}")