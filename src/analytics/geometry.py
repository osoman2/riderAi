from __future__ import annotations

import math
from typing import Optional, Tuple

Point = Tuple[float, float]


def angle_3pts(a: Point, b: Point, c: Point) -> Optional[float]:
    ab = (a[0] - b[0], a[1] - b[1])
    cb = (c[0] - b[0], c[1] - b[1])

    mag_ab = math.hypot(*ab)
    mag_cb = math.hypot(*cb)
    if mag_ab == 0 or mag_cb == 0:
        return None

    dot = ab[0] * cb[0] + ab[1] * cb[1]
    cos_theta = max(-1.0, min(1.0, dot / (mag_ab * mag_cb)))
    return math.degrees(math.acos(cos_theta))


def segment_angle_deg(a: Point, b: Point) -> Optional[float]:
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    if dx == 0 and dy == 0:
        return None
    return math.degrees(math.atan2(dy, dx))