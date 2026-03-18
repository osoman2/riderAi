from __future__ import annotations

from typing import Dict, List

from ultralytics import YOLO

from src.schemas import FramePose, Keypoint
from src.utils.constants import COCO_KEYPOINTS


class PoseEstimator:
    def __init__(self, model_path: str, conf: float = 0.35):
        self.model = YOLO(model_path)
        self.conf = conf

    def infer_video(self, video_path: str, fps: float) -> List[FramePose]:
        poses: List[FramePose] = []

        results = self.model.track(
            source=video_path,
            conf=self.conf,
            persist=True,
            verbose=False,
        )

        for frame_idx, r in enumerate(results):
            if r.keypoints is None or len(r.keypoints.xy) == 0:
                continue

            xy = r.keypoints.xy[0].cpu().numpy().tolist()
            confs = (
                r.keypoints.conf[0].cpu().numpy().tolist()
                if r.keypoints.conf is not None
                else [1.0] * len(xy)
            )

            keypoints: Dict[str, Keypoint] = {}
            for idx, (pt, c) in enumerate(zip(xy, confs)):
                if idx >= len(COCO_KEYPOINTS):
                    continue
                keypoints[COCO_KEYPOINTS[idx]] = Keypoint(
                    name=COCO_KEYPOINTS[idx],
                    x=float(pt[0]),
                    y=float(pt[1]),
                    confidence=float(c),
                )

            bbox = None
            if r.boxes is not None and len(r.boxes.xyxy) > 0:
                bbox = [float(v) for v in r.boxes.xyxy[0].cpu().numpy().tolist()]

            track_id = None
            if getattr(r.boxes, "id", None) is not None and len(r.boxes.id) > 0:
                track_id = int(r.boxes.id[0].item())

            poses.append(
                FramePose(
                    frame_index=frame_idx,
                    timestamp_sec=frame_idx / fps,
                    keypoints=keypoints,
                    bbox_xyxy=bbox,
                    track_id=track_id,
                )
            )

        return poses