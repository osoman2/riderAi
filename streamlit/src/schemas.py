from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class Keypoint:
    name: str
    x: float
    y: float
    confidence: float


@dataclass
class FramePose:
    frame_index: int
    timestamp_sec: float
    keypoints: Dict[str, Keypoint]
    bbox_xyxy: Optional[List[float]] = None
    track_id: Optional[int] = None


@dataclass
class FrameFeatures:
    frame_index: int
    timestamp_sec: float
    trunk_angle_deg: Optional[float] = None
    left_knee_deg: Optional[float] = None
    right_knee_deg: Optional[float] = None
    left_elbow_deg: Optional[float] = None
    right_elbow_deg: Optional[float] = None
    hip_height_px: Optional[float] = None
    trajectory_dx: Optional[float] = None
    trajectory_dy: Optional[float] = None
    speed_proxy: Optional[float] = None
    posture_label: Optional[str] = None
    terrain_label: Optional[str] = None
    balance_score: Optional[float] = None
    line_efficiency_score: Optional[float] = None


@dataclass
class ClipSummary:
    posture_distribution: Dict[str, int] = field(default_factory=dict)
    avg_balance_score: Optional[float] = None
    avg_line_efficiency_score: Optional[float] = None
    avg_speed_proxy: Optional[float] = None
    terrain_distribution: Dict[str, int] = field(default_factory=dict)
    coaching_summary: Optional[str] = None


@dataclass
class PipelineArtifacts:
    annotated_video_path: str
    features_csv_path: str
    features_json_path: str
    summary: ClipSummary
    per_frame_features: List[FrameFeatures] = field(default_factory=list)