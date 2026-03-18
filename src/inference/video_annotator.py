from __future__ import annotations

import os
import subprocess
import tempfile

import cv2
import imageio_ffmpeg

from src.io.video_io import get_video_metadata, iter_video_frames
from src.schemas import FrameFeatures, FramePose
from src.utils.constants import SKELETON_EDGES


def annotate_video(
    input_video_path: str,
    output_video_path: str,
    poses: list[FramePose],
    features: list[FrameFeatures],
) -> str:
    metadata = get_video_metadata(input_video_path)
    fps = metadata["fps"]
    width = metadata["width"]
    height = metadata["height"]

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".mp4")
    os.close(tmp_fd)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(tmp_path, fourcc, fps, (width, height))

    pose_map = {p.frame_index: p for p in poses}
    feature_map = {f.frame_index: f for f in features}

    trail = []

    for frame_idx, frame in iter_video_frames(input_video_path):
        pose = pose_map.get(frame_idx)
        feat = feature_map.get(frame_idx)

        if pose:
            if pose.bbox_xyxy:
                x1, y1, x2, y2 = map(int, pose.bbox_xyxy)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 2)
                center = (int((x1 + x2) / 2), int((y1 + y2) / 2))
                trail.append(center)

            for edge in SKELETON_EDGES:
                a = pose.keypoints.get(edge[0])
                b = pose.keypoints.get(edge[1])
                if a and b:
                    cv2.line(frame, (int(a.x), int(a.y)), (int(b.x), int(b.y)), (0, 255, 0), 2)

            for kp in pose.keypoints.values():
                cv2.circle(frame, (int(kp.x), int(kp.y)), 4, (0, 0, 255), -1)

        for i in range(1, len(trail)):
            cv2.line(frame, trail[i - 1], trail[i], (255, 0, 0), 2)

        if feat:
            text_lines = [
                f"Posture: {feat.posture_label}",
                f"Terrain: {feat.terrain_label}",
                f"Balance: {feat.balance_score}",
                f"Line efficiency: {feat.line_efficiency_score}",
                f"Speed proxy: {feat.speed_proxy}",
            ]
            y = 30
            for line in text_lines:
                cv2.putText(
                    frame,
                    line,
                    (20, y),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2,
                )
                y += 28

        writer.write(frame)

    writer.release()

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run(
        [ffmpeg_exe, "-y", "-i", tmp_path, "-vcodec", "libx264", "-crf", "23", "-preset", "fast", output_video_path],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    os.remove(tmp_path)

    return output_video_path