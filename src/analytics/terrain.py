
from __future__ import annotations

from typing import Optional


def approximate_terrain(speed_proxy: Optional[float], posture_label: str) -> str:
    if speed_proxy is None:
        return "unknown"

    if speed_proxy > 20 and posture_label == "attack":
        return "fast_descent"
    if speed_proxy > 10:
        return "flow_section"
    return "technical_or_slow"