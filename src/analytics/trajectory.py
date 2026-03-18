from __future__ import annotations

from typing import List, Optional, Tuple

from src.schemas import FramePose


def get_rider_center(frame_pose: FramePose) -> Optional[Tuple[float, float]]:
    if frame_pose.bbox_xyxy:
        x1, y1, x2, y2 = frame_pose.bbox_xyxy
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

    left_hip = frame_pose.keypoints.get("left_hip")
    right_hip = frame_pose.keypoints.get("right_hip")
    if left_hip and right_hip:
        return ((left_hip.x + right_hip.x) / 2.0, (left_hip.y + right_hip.y) / 2.0)

    return None


def compute_trajectory_deltas(poses: List[FramePose]) -> List[tuple[Optional[float], Optional[float]]]:
    deltas: List[tuple[Optional[float], Optional[float]]] = []
    prev = None

    for pose in poses:
        curr = get_rider_center(pose)
        if prev is None or curr is None:
            deltas.append((None, None))
        else:
            deltas.append((curr[0] - prev[0], curr[1] - prev[1]))
        prev = curr

    return deltas