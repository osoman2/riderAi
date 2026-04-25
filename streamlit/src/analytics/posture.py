from __future__ import annotations

from typing import Optional


def classify_posture(trunk_angle_deg: Optional[float]) -> str:
    if trunk_angle_deg is None:
        return "unknown"

    if trunk_angle_deg < -110:
        return "defensive"
    if trunk_angle_deg < -85:
        return "attack"
    return "neutral"