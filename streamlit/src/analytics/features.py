from __future__ import annotations

from typing import List

from src.analytics.geometry import angle_3pts, segment_angle_deg
from src.analytics.posture import classify_posture
from src.analytics.terrain import approximate_terrain
from src.schemas import FrameFeatures, FramePose


def _xy(frame_pose: FramePose, name: str):
    kp = frame_pose.keypoints.get(name)
    if kp is None:
        return None
    return (kp.x, kp.y)


def build_frame_features(
    poses: List[FramePose],
    trajectory_deltas: List[tuple[float | None, float | None]],
    fps: float = 30.0,
) -> List[FrameFeatures]:
    """Build per-frame features.

    ``speed_proxy`` is expressed in **pixels per second** (px/s), computed as
    the Euclidean displacement of the rider's bounding-box centre between
    consecutive frames multiplied by *fps*.
    """
    features: List[FrameFeatures] = []

    for pose, (dx, dy) in zip(poses, trajectory_deltas):
        ls = _xy(pose, "left_shoulder")
        rs = _xy(pose, "right_shoulder")
        lh = _xy(pose, "left_hip")
        rh = _xy(pose, "right_hip")
        le = _xy(pose, "left_elbow")
        re = _xy(pose, "right_elbow")
        lw = _xy(pose, "left_wrist")
        rw = _xy(pose, "right_wrist")
        lk = _xy(pose, "left_knee")
        rk = _xy(pose, "right_knee")
        la = _xy(pose, "left_ankle")
        ra = _xy(pose, "right_ankle")

        trunk_angle = None
        hip_height = None

        if ls and rs and lh and rh:
            shoulder_mid = ((ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2)
            hip_mid = ((lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2)
            trunk_angle = segment_angle_deg(hip_mid, shoulder_mid)
            hip_height = hip_mid[1]

        left_knee = angle_3pts(lh, lk, la) if lh and lk and la else None
        right_knee = angle_3pts(rh, rk, ra) if rh and rk and ra else None
        left_elbow = angle_3pts(ls, le, lw) if ls and le and lw else None
        right_elbow = angle_3pts(rs, re, rw) if rs and re and rw else None

        speed_proxy = None
        if dx is not None and dy is not None:
            speed_proxy = (dx**2 + dy**2) ** 0.5 * fps  # px/s

        posture_label = classify_posture(trunk_angle)
        terrain_label = approximate_terrain(speed_proxy, posture_label)

        balance_score = 80.0
        if left_knee is not None and right_knee is not None:
            balance_score = max(0.0, 100.0 - abs(left_knee - right_knee))

        line_efficiency_score = 70.0
        if dx is not None:
            line_efficiency_score = max(0.0, 100.0 - abs(dx) * 0.8)

        features.append(
            FrameFeatures(
                frame_index=pose.frame_index,
                timestamp_sec=pose.timestamp_sec,
                trunk_angle_deg=trunk_angle,
                left_knee_deg=left_knee,
                right_knee_deg=right_knee,
                left_elbow_deg=left_elbow,
                right_elbow_deg=right_elbow,
                hip_height_px=hip_height,
                trajectory_dx=dx,
                trajectory_dy=dy,
                speed_proxy=speed_proxy,
                posture_label=posture_label,
                terrain_label=terrain_label,
                balance_score=round(balance_score, 2) if balance_score is not None else None,
                line_efficiency_score=round(line_efficiency_score, 2) if line_efficiency_score is not None else None,
            )
        )

    return features