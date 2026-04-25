from __future__ import annotations

from collections import Counter
from statistics import mean
from typing import List, Optional

from src.schemas import ClipSummary, FrameFeatures


def _safe_mean(values: List[Optional[float]]) -> Optional[float]:
    valid = [v for v in values if v is not None]
    if not valid:
        return None
    return round(mean(valid), 2)


def build_clip_summary(features: List[FrameFeatures]) -> ClipSummary:
    posture_distribution = Counter(f.posture_label for f in features if f.posture_label)
    terrain_distribution = Counter(f.terrain_label for f in features if f.terrain_label)

    return ClipSummary(
        posture_distribution=dict(posture_distribution),
        avg_balance_score=_safe_mean([f.balance_score for f in features]),
        avg_line_efficiency_score=_safe_mean([f.line_efficiency_score for f in features]),
        avg_speed_proxy=_safe_mean([f.speed_proxy for f in features]),
        terrain_distribution=dict(terrain_distribution),
    )