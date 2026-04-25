from __future__ import annotations

from collections import defaultdict, deque
from typing import Dict, List

from src.schemas import FramePose, Keypoint


def smooth_poses_moving_average(poses: List[FramePose], window: int = 5) -> List[FramePose]:
    if window <= 1 or not poses:
        return poses

    buffers = defaultdict(lambda: {
        "x": deque(maxlen=window),
        "y": deque(maxlen=window),
        "c": deque(maxlen=window),
    })

    smoothed: List[FramePose] = []

    for pose in poses:
        new_keypoints: Dict[str, Keypoint] = {}

        for name, kp in pose.keypoints.items():
            buffers[name]["x"].append(kp.x)
            buffers[name]["y"].append(kp.y)
            buffers[name]["c"].append(kp.confidence)

            new_keypoints[name] = Keypoint(
                name=name,
                x=sum(buffers[name]["x"]) / len(buffers[name]["x"]),
                y=sum(buffers[name]["y"]) / len(buffers[name]["y"]),
                confidence=sum(buffers[name]["c"]) / len(buffers[name]["c"]),
            )

        smoothed.append(
            FramePose(
                frame_index=pose.frame_index,
                timestamp_sec=pose.timestamp_sec,
                keypoints=new_keypoints,
                bbox_xyxy=pose.bbox_xyxy,
                track_id=pose.track_id,
            )
        )

    return smoothed