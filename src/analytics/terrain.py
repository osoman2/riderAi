
from __future__ import annotations

from typing import Optional


def approximate_terrain(speed_proxy: Optional[float], posture_label: str) -> str:
    """Classify terrain based on speed (px/s) and posture.

    Thresholds assume ``speed_proxy`` is in **pixels per second**:
      * >600 px/s + attack posture → fast descent
      * >300 px/s                  → flow section
      * otherwise                  → technical or slow
    """
    if speed_proxy is None:
        return "unknown"

    if speed_proxy > 600 and posture_label == "attack":
        return "fast_descent"
    if speed_proxy > 300:
        return "flow_section"
    return "technical_or_slow"