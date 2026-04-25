from __future__ import annotations

import os

from src.config import AppConfig
from src.inference.pose_estimator import PoseEstimator
from src.inference.smoother import smooth_poses_moving_average
from src.inference.video_annotator import annotate_video
from src.io.exporters import export_features_csv, export_features_json
from src.io.temp_files import ensure_dir
from src.io.video_io import get_video_metadata
from src.analytics.trajectory import compute_trajectory_deltas
from src.analytics.features import build_frame_features
from src.analytics.scoring import build_clip_summary
from src.schemas import PipelineArtifacts
from src.services.llm_feedback import LLMCoach


class RiderAIPipeline:
    def __init__(self, config: AppConfig):
        self.config = config

    def run(self, video_path: str) -> PipelineArtifacts:
        ensure_dir(self.config.output_dir)

        metadata = get_video_metadata(video_path)
        fps = metadata["fps"]

        estimator = PoseEstimator(
            model_path=self.config.model_path,
            conf=self.config.min_keypoint_conf,
        )

        poses = estimator.infer_video(video_path, fps=fps)
        poses = smooth_poses_moving_average(poses, window=self.config.smoothing_window)

        trajectory_deltas = compute_trajectory_deltas(poses)
        features = build_frame_features(poses, trajectory_deltas, fps=fps)
        summary = build_clip_summary(features)

        if self.config.use_groq_feedback and self.config.groq_api_key:
            coach = LLMCoach(
                api_key=self.config.groq_api_key,
                model=self.config.groq_model,
            )
            summary.coaching_summary = coach.generate_feedback(summary)

        annotated_video_path = os.path.join(self.config.output_dir, "annotated_output.mp4")
        csv_path = os.path.join(self.config.output_dir, "features.csv")
        json_path = os.path.join(self.config.output_dir, "features.json")

        annotate_video(video_path, annotated_video_path, poses, features)
        export_features_csv(csv_path, features)
        export_features_json(json_path, features, summary.__dict__)

        return PipelineArtifacts(
            annotated_video_path=annotated_video_path,
            features_csv_path=csv_path,
            features_json_path=json_path,
            summary=summary,
            per_frame_features=features,
        )