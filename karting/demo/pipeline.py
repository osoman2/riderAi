"""
DriverCoach — Karting Demo Pipeline (Tier 0)
SAM3/SAM2 track segmentation + YOLO11 kart tracking + BEV homography + VLM coaching
"""
from __future__ import annotations

import os
import sys
import json
import base64
import argparse
from pathlib import Path

import cv2
import numpy as np
from scipy.interpolate import splprep, splev
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
ASSETS_DIR = Path(__file__).parent.parent / "assets"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

VEHICLE_CLASSES = {2, 3, 5, 7}   # car, motorcycle, bus, truck — karts match these
TRACK_COLOR = (50, 200, 50)       # green overlay for track mask
TRAIL_COLORS = [
    (0, 100, 255), (0, 220, 100), (255, 120, 0),
    (220, 0, 220), (0, 220, 220), (220, 220, 0),
]
IDEAL_LINE_COLOR = (0, 255, 0)
ACTUAL_LINE_COLOR = (0, 80, 255)


# ---------------------------------------------------------------------------
# Step 1 — Video info
# ---------------------------------------------------------------------------
def get_video_info(path: str) -> dict:
    cap = cv2.VideoCapture(path)
    info = {
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        "fps": cap.get(cv2.CAP_PROP_FPS),
        "total_frames": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
    }
    cap.release()
    return info


def _find_footage_start(video_path: str, max_search_sec: float = 12.0,
                        brightness_threshold: float = 40.0,
                        min_bright_frames: int = 8) -> float:
    """
    Auto-detect where real footage starts by scanning brightness.
    GoPro intros / title cards are dark (near-black) while real outdoor
    karting footage is bright (sky, track, surroundings).
    Returns skip_seconds to reach the first bright sequence.
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    max_frames = int(max_search_sec * fps)
    consecutive_bright = 0
    start_frame = 0

    for i in range(max_frames):
        ret, frame = cap.read()
        if not ret:
            break
        # Downsample heavily — just need mean brightness
        small = cv2.resize(frame, (64, 36))
        brightness = float(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).mean())
        if brightness >= brightness_threshold:
            consecutive_bright += 1
            if consecutive_bright >= min_bright_frames:
                # Found the start — go back to the first bright frame of this run
                start_frame = i - min_bright_frames + 1
                break
        else:
            consecutive_bright = 0

    cap.release()
    skip_sec = max(0.0, start_frame / fps)
    print(f"      Auto-skip: footage starts at frame {start_frame} ({skip_sec:.1f}s)")
    return skip_sec


def extract_frames(video_path: str, every_n: int = 1, max_frames: int = 900, skip_seconds: float = 0) -> list[np.ndarray]:
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    skip_frames = int(skip_seconds * fps)
    for _ in range(skip_frames):
        cap.read()
    frames = []
    i = 0
    while len(frames) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if i % every_n == 0:
            frames.append(frame)
        i += 1
    cap.release()
    print(f"      Skipped {skip_seconds}s ({skip_frames} frames)")
    return frames


# ---------------------------------------------------------------------------
# Step 2 — SAM2 Video: propagate track mask through all frames
# ---------------------------------------------------------------------------
def _sam2_cfg_and_ckpt():
    import sam2 as _sam2_pkg
    cfg = str(Path(_sam2_pkg.__file__).parent / "configs" / "sam2.1" / "sam2.1_hiera_l.yaml")
    ckpt = str(Path.home() / ".sam2" / "sam2_hiera_large.pt")
    return cfg, ckpt


def segment_track_sam3_video(frames: list[np.ndarray], mode: str = "fpv_follow", prompt: str | None = None) -> list[np.ndarray] | None:
    """
    SAM3-calibrated HSV hybrid — best of both worlds:
      1. SAM3 text prompt on ONE carefully-chosen frame → precise semantic mask
      2. Sample HSV from that mask → calibrated color model
      3. Apply HSV to all frames (fast, same as SAM2 hybrid)

    This is 10-50× faster than full SAM3 video propagation, keeps the key advantage
    (text prompt = no coordinate fragility), and handles dark frames / pit lanes.

    Returns list of masks or None if SAM3 unavailable (falls back to SAM2).

    Install:
        conda create -n sam3 python=3.12
        pip install torch==2.10.0 torchvision xformers --index-url https://download.pytorch.org/whl/cu128
        git clone https://github.com/facebookresearch/sam3 && cd sam3 && pip install -e .
        hf auth login
        huggingface-cli download facebook/sam3.1 --local-dir ~/.sam3
    """
    try:
        import torch
        from sam3.model_builder import build_sam3_predictor
        from PIL import Image as _PILImage
    except ImportError as _ie:
        print(f"[SAM3] Not available in this Python env ({_ie}) — falling back to SAM2")
        return None

    h, w = frames[0].shape[:2]
    road_y2 = int(h * 0.45) if mode == "action_cam" else h
    sky_clip = max(0, int(h * 0.05))

    # Use custom prompt if provided, otherwise fall back to sensible defaults per mode
    if prompt:
        text_prompt = prompt
    elif mode == "action_cam":
        text_prompt = "asphalt road karting track surface"
    else:
        text_prompt = "asphalt racing circuit track road surface"
    print(f"      SAM3 text prompt: \"{text_prompt}\"")

    try:
        ckpt_path = Path.home() / ".sam3" / "sam3.1_multiplex.pt"
        if not ckpt_path.exists():
            print("[SAM3] ~/.sam3/sam3.1_multiplex.pt not found — falling back to SAM2")
            return None

        # ── Step 1: pick best calibration frame (moderately bright, not dark/overexposed)
        road_y_top = int(h * 0.08)
        prompt_idx = 0
        best_score = -1.0
        for fi, f in enumerate(frames[: min(len(frames), 20)]):
            gm = float(cv2.cvtColor(f[road_y_top:road_y2, :], cv2.COLOR_BGR2GRAY).mean())
            score = gm if 40 < gm < 200 else 0.0
            if score > best_score:
                best_score, prompt_idx = score, fi
        print(f"      SAM3 calibration frame: {prompt_idx} (road brightness={best_score:.0f})")

        # ── Step 2: SAM3 image-mode on that single frame (fast, no video propagation)
        print(f"      Loading SAM3.1 ...")
        predictor = build_sam3_predictor(
            checkpoint_path=str(ckpt_path),
            version="sam3.1",
            use_fa3=False,
            use_rope_real=True,
            async_loading_frames=False,
        )
        pil_ref = _PILImage.fromarray(cv2.cvtColor(frames[prompt_idx], cv2.COLOR_BGR2RGB))

        with torch.inference_mode():
            resp = predictor.handle_request(
                {"type": "start_session", "resource_path": [pil_ref]}
            )
            sid = resp["session_id"]
            add_resp = predictor.handle_request({
                "type": "add_prompt",
                "session_id": sid,
                "frame_index": 0,
                "text": text_prompt,
            })
            predictor.handle_request({"type": "close_session", "session_id": sid})

        # Extract mask from add_prompt response
        outputs = add_resp.get("outputs", add_resp) if isinstance(add_resp, dict) else {}
        ref_mask_raw = outputs.get("out_binary_masks")
        if ref_mask_raw is None or not np.array(ref_mask_raw).any():
            print("[SAM3] No mask on calibration frame — falling back to SAM2")
            return None

        ref_mask = (np.array(ref_mask_raw).any(axis=0)).astype(np.uint8) * 255
        ref_mask[road_y2:, :] = 0   # clip cockpit area

        # ── Step 3: calibrate HSV from mask pixels (same logic as SAM2 hybrid)
        road_mask = ref_mask.copy()
        hsv0 = cv2.cvtColor(frames[prompt_idx], cv2.COLOR_BGR2HSV)
        track_pixels = hsv0[road_mask > 0]
        if len(track_pixels) < 100:
            print(f"[SAM3] Calibration mask too small ({len(track_pixels)} px) — falling back")
            return None

        hue = track_pixels[:, 0].astype(int)
        sat = track_pixels[:, 1].astype(int)
        green_ratio = float(np.mean((hue >= 28) & (hue <= 92) & (sat >= 40)))
        if green_ratio > 0.25:
            print(f"[SAM3] Mask landed on grass ({green_ratio:.0%}) — falling back to SAM2")
            return None
        mean_sat = float(np.mean(sat))
        if mode == "action_cam" and mean_sat > 60:
            print(f"[SAM3] Mask saturation too high ({mean_sat:.0f}) — falling back")
            return None

        lo = np.clip(np.percentile(track_pixels, 5, axis=0).astype(int)  - [8, 12, 20], 0, 255).astype(np.uint8)
        hi = np.clip(np.percentile(track_pixels, 95, axis=0).astype(int) + [8, 12, 20], 0, 255).astype(np.uint8)
        if mode == "action_cam":
            hi[1] = min(int(hi[1]), 70)
        print(f"      SAM3 HSV [{mode}]: {lo} → {hi}  (green={green_ratio:.0%}, sat={mean_sat:.0f})")

        # ── Step 4: apply calibrated HSV to all frames (fast)
        masks = []
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (18, 18))
        min_comp_area = int(road_y2 * w * 0.01)
        for frame in frames:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            m = cv2.inRange(hsv, lo, hi)
            m[road_y2:, :] = 0
            m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, kernel)
            m = cv2.morphologyEx(m, cv2.MORPH_OPEN,  kernel)
            clean = np.zeros_like(m)
            if m.any():
                num_l, lbls = cv2.connectedComponents(m)
                bottom = lbls[int(road_y2 * 0.92):road_y2, :]
                vals = bottom[bottom > 0]
                if len(vals) == 0:
                    best_lbls = {max(range(1, num_l), key=lambda l: int((lbls == l).sum()), default=0)}
                else:
                    counts = np.bincount(vals)
                    best_lbls = {int(lbl) for lbl in range(1, len(counts)) if counts[lbl] >= 5}
                rl = np.zeros(m.shape, dtype=np.uint8)
                for lbl in best_lbls:
                    if lbl == 0: continue
                    comp = (lbls == lbl).astype(np.uint8)
                    if comp.sum() >= min_comp_area:
                        rl = cv2.bitwise_or(rl, comp)
                if rl.any():
                    ctrs, _ = cv2.findContours(rl, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    cv2.drawContours(clean, ctrs, -1, 255, -1)
                    clean[:sky_clip, :] = 0
            masks.append(clean)

        print(f"      SAM3-calibrated HSV: {len(masks)} masks")
        return masks

    except Exception as e:
        print(f"[SAM3] {e} — falling back to SAM2")
        return None


def segment_track_sam2_video(frames: list[np.ndarray], track_points: list[tuple[int, int]],
                              mode: str = "fpv_follow") -> list[np.ndarray]:
    """
    Hybrid approach: SAM2 Image prompts frame 0 precisely, then calibrates an HSV
    color model from that mask and applies it to all frames. Fast + accurate per circuit.
    Falls back to generic HSV if SAM2 unavailable.

    For action_cam: only calibrates on the road region (y < 45% of frame) and clips
    the output mask to that region — the cockpit fills the lower half of the frame.
    """
    h, w = frames[0].shape[:2]
    # For action_cam the road occupies the upper ~45% of the frame.
    road_y2 = int(h * 0.45) if mode == "action_cam" else h

    try:
        # Step 1: SAM2 Image on frame 0 — precise mask from prompt points
        ref_mask = segment_track_sam2(frames[0], track_points)
        if ref_mask is None or not ref_mask.any():
            raise ValueError("SAM2 returned empty mask on frame 0")

        # Step 2: Sample HSV statistics from road region only
        road_mask = ref_mask.copy()
        road_mask[road_y2:, :] = 0  # ignore cockpit area when calibrating
        hsv0 = cv2.cvtColor(frames[0], cv2.COLOR_BGR2HSV)
        track_pixels = hsv0[road_mask > 0]
        if len(track_pixels) < 100:
            raise ValueError(f"SAM2 mask missed road region (< 100 px in y < {road_y2})")

        # Sanity check: reject calibration if mask landed on grass (hue 28-92, sat > 40).
        # This happens when prompt points fall on vegetation/sky instead of asphalt.
        hue = track_pixels[:, 0].astype(int)
        sat = track_pixels[:, 1].astype(int)
        green_ratio = float(np.mean((hue >= 28) & (hue <= 92) & (sat >= 40)))
        if green_ratio > 0.25:
            raise ValueError(f"SAM2 calibrated on vegetation ({green_ratio:.0%} green px) — using asphalt fallback")

        # Asphalt sanity check: mean saturation should be low (grey road)
        mean_sat = float(np.mean(sat))
        if mode == "action_cam" and mean_sat > 60:
            raise ValueError(f"Calibration saturation too high ({mean_sat:.0f}) — not asphalt, using fallback")

        # Robust bounds: 5th–95th percentile per channel
        lo = np.percentile(track_pixels, 5, axis=0).astype(np.uint8)
        hi = np.percentile(track_pixels, 95, axis=0).astype(np.uint8)
        # Tight delta for action_cam — asphalt is grey, don't drift into grass range
        sat_delta = 12 if mode == "action_cam" else 30
        val_delta = 20 if mode == "action_cam" else 30
        lo = np.clip(lo.astype(int) - [8, sat_delta, val_delta], 0, 255).astype(np.uint8)
        hi = np.clip(hi.astype(int) + [8, sat_delta, val_delta], 0, 255).astype(np.uint8)
        # Hard cap: never let saturation ceiling exceed 70 for action_cam (keeps out grass)
        if mode == "action_cam":
            hi[1] = min(int(hi[1]), 70)
        print(f"      SAM2 calibrated track HSV [{mode}]: [{lo}] → [{hi}]  (green_ratio={green_ratio:.0%}, sat={mean_sat:.0f})")

        # Step 3: Apply calibrated HSV mask to all frames, restricted to road region
        masks = []
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (18, 18))
        for frame in frames:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            m = cv2.inRange(hsv, lo, hi)
            m[road_y2:, :] = 0  # zero out cockpit / driver body area
            m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, kernel)
            m = cv2.morphologyEx(m, cv2.MORPH_OPEN, kernel)
            # Keep ALL components connected to the bottom of the road region.
            # Asphalt always touches road_y2 edge — sky/barriers/mountains do not.
            clean = np.zeros_like(m)
            if m.any():
                num_l, lbls = cv2.connectedComponents(m)
                min_comp_area = int(road_y2 * m.shape[1] * 0.01)
                sky_clip = max(0, int(m.shape[0] * 0.05))

                bottom = lbls[int(road_y2 * 0.92):road_y2, :]
                vals = bottom[bottom > 0]
                if len(vals) == 0:
                    best_labels = {max(range(1, num_l),
                                       key=lambda l: int((lbls == l).sum()), default=0)}
                else:
                    counts = np.bincount(vals)
                    best_labels = {int(lbl) for lbl in range(1, len(counts))
                                   if counts[lbl] >= 5}

                road_layer = np.zeros(m.shape, dtype=np.uint8)
                for lbl in best_labels:
                    if lbl == 0:
                        continue
                    comp = (lbls == lbl).astype(np.uint8)
                    if comp.sum() < min_comp_area:
                        continue
                    road_layer = cv2.bitwise_or(road_layer, comp)

                if road_layer.any():
                    ctrs, _ = cv2.findContours(road_layer, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    cv2.drawContours(clean, ctrs, -1, 255, -1)
                    clean[:sky_clip, :] = 0  # hard-clip top stripe (always sky)

            masks.append(clean)

        print(f"      SAM2-calibrated HSV: {len(masks)} masks")
        return masks

    except Exception as e:
        print(f"[SAM2 hybrid] {e} — falling back to asphalt HSV")
        if mode == "action_cam":
            return [_segment_asphalt_action(f, road_y2) for f in frames]
        return [_color_segment_track(f) for f in frames]


def segment_track_sam2(frame: np.ndarray, track_points: list[tuple[int, int]]) -> np.ndarray:
    """Single-frame SAM2 image predictor (used for first-frame preview/mask save)."""
    try:
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        import torch
        cfg, ckpt = _sam2_cfg_and_ckpt()
        if not Path(ckpt).exists():
            return _color_segment_track(frame)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        predictor = SAM2ImagePredictor(build_sam2(cfg, ckpt, device=device))
        predictor.set_image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        pts = np.array(track_points, dtype=np.float32)
        lbls = np.ones(len(pts), dtype=np.int32)
        with torch.inference_mode():
            masks, scores, _ = predictor.predict(point_coords=pts, point_labels=lbls, multimask_output=True)
        return masks[np.argmax(scores)].astype(np.uint8) * 255
    except Exception as e:
        print(f"[SAM2] {e} — falling back to color segmentation")
        return _color_segment_track(frame)


def _segment_asphalt_action(frame: np.ndarray, road_y2: int) -> np.ndarray:
    """
    Asphalt-specific fallback for action_cam.
    Finds dark-grey road surface in the road region only (y < road_y2).
    Asphalt: low saturation (grey), medium value (not black, not white).
    Excludes green grass and bright sky.
    """
    h, w = frame.shape[:2]
    roi = frame[:road_y2, :]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # Asphalt: low-to-medium saturation (grey tones), not too dark (shadow) or too bright
    # Wet asphalt can have sat up to 70; dry grey asphalt is sat < 40
    asphalt = cv2.inRange(hsv, np.array([0, 0, 35]), np.array([180, 75, 210]))
    # Exclude grass (vivid green)
    grass = cv2.inRange(hsv, np.array([25, 50, 40]), np.array([90, 255, 255]))
    # Exclude sky: bright, low-sat (overcast) or blue-sat (clear)
    sky_bright = cv2.inRange(hsv, np.array([0,   0,  190]), np.array([180, 50, 255]))
    sky_blue   = cv2.inRange(hsv, np.array([95, 50,  100]), np.array([135, 255, 255]))
    # Exclude vivid colored objects (kart parts, sponsors — high saturation non-green)
    vivid = cv2.inRange(hsv, np.array([0, 120, 80]), np.array([180, 255, 255]))
    exclusions = cv2.bitwise_or(cv2.bitwise_or(grass, sky_bright), cv2.bitwise_or(sky_blue, vivid))
    asphalt = cv2.bitwise_and(asphalt, cv2.bitwise_not(exclusions))

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (14, 14))
    asphalt = cv2.morphologyEx(asphalt, cv2.MORPH_CLOSE, kernel)
    asphalt = cv2.morphologyEx(asphalt, cv2.MORPH_OPEN, kernel)

    # KEY: keep only components connected to the bottom of the road region.
    # Asphalt always touches road_y2 bottom edge — mountains/sky/barriers do not.
    full_mask = np.zeros((h, w), dtype=np.uint8)
    if not asphalt.any():
        return full_mask

    # Hard-clip: the top 5% of the full frame is always sky/background, never road
    sky_clip = max(0, int(h * 0.05))

    num_labels, labels = cv2.connectedComponents(asphalt)
    min_area = int(road_y2 * w * 0.01)   # component must be ≥ 1% of road region

    # Find ALL component labels that appear in the bottom 8% of the road region
    bottom_band = labels[int(road_y2 * 0.92):road_y2, :]
    vals = bottom_band[bottom_band > 0]
    if len(vals) == 0:
        # Fallback: just use the largest component (road is likely a strip)
        best_labels = {max(range(1, num_labels),
                          key=lambda l: int((labels == l).sum()), default=0)}
    else:
        # Keep every label that has ≥ 5 px in the bottom band (filters noise labels)
        counts = np.bincount(vals)
        best_labels = {int(lbl) for lbl in range(1, len(counts))
                       if counts[lbl] >= 5}

    road_layer = np.zeros_like(asphalt)
    for lbl in best_labels:
        if lbl == 0:
            continue
        comp = (labels == lbl).astype(np.uint8)
        if comp.sum() < min_area:
            continue
        road_layer = cv2.bitwise_or(road_layer, comp)

    if road_layer.any():
        contours, _ = cv2.findContours(road_layer, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(full_mask[:road_y2, :], contours, -1, 255, -1)
        full_mask[:sky_clip, :] = 0   # hard-clip top stripe (always sky)

    return full_mask


def _color_segment_track(frame: np.ndarray) -> np.ndarray:
    """
    Segment track (asphalt) by removing grass (green) and sky (blue).
    Works well for outdoor karting circuits in daylight.
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Grass: green range in HSV
    grass = cv2.inRange(hsv, np.array([30, 40, 40]), np.array([90, 255, 255]))

    # Sky: light blue (high up, low saturation)
    sky = cv2.inRange(hsv, np.array([95, 40, 160]), np.array([135, 200, 255]))

    # Track = everything that is NOT grass and NOT sky
    non_track = cv2.bitwise_or(grass, sky)
    track = cv2.bitwise_not(non_track)

    # Clean up
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (20, 20))
    track = cv2.morphologyEx(track, cv2.MORPH_CLOSE, kernel)
    track = cv2.morphologyEx(track, cv2.MORPH_OPEN, kernel)

    # Keep only the largest connected region (the track surface)
    contours, _ = cv2.findContours(track, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        mask = np.zeros_like(track)
        largest = max(contours, key=cv2.contourArea)
        cv2.drawContours(mask, [largest], -1, 255, -1)
        return mask

    return track


def detect_track_edges(frame: np.ndarray) -> np.ndarray:
    """
    Detect kerb edges for annotation (FPV chase / video overlay).
    Returns edge mask (red OR white pixels).
    For annotation use only — kerb contact analysis uses detect_kerb_contact().
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    red1 = cv2.inRange(hsv, np.array([0,   80, 80]), np.array([12,  255, 255]))
    red2 = cv2.inRange(hsv, np.array([168, 80, 80]), np.array([180, 255, 255]))
    red_mask = cv2.bitwise_or(red1, red2)
    white_mask = cv2.inRange(hsv, np.array([0, 0, 200]), np.array([180, 40, 255]))
    kerb = cv2.bitwise_or(red_mask, white_mask)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    kerb = cv2.dilate(kerb, kernel, iterations=2)
    return kerb


def detect_kerb_contact(frame: np.ndarray, road_y2: int) -> tuple[bool, bool]:
    """
    Reliable kerb contact detection for action_cam.
    Looks for RED kerb pixels (the distinctive color of karting kerbs)
    in the road region only, and classifies left/right by horizontal position.
    White is excluded — too common (road markings, barriers, sky reflections).
    Returns (kerb_left, kerb_right).
    """
    h, w = frame.shape[:2]
    roi = frame[:road_y2, :]                          # road region only
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # Tight red-only range — karting kerbs are vivid red
    red1 = cv2.inRange(hsv, np.array([0,   120, 80]), np.array([10,  255, 255]))
    red2 = cv2.inRange(hsv, np.array([170, 120, 80]), np.array([180, 255, 255]))
    red = cv2.bitwise_or(red1, red2)

    # Minimum 40 red pixels in either half to call it a kerb hit
    min_px = 40
    left_px  = int(red[:, :w // 2].sum() // 255)
    right_px = int(red[:, w // 2:].sum() // 255)
    return left_px >= min_px, right_px >= min_px


# ---------------------------------------------------------------------------
# Step 3 — YOLO + ByteTrack kart detection & tracking
# ---------------------------------------------------------------------------
_KART_YOLO_MODEL = os.environ.get("KART_YOLO_MODEL", "yolo11n.pt")


def track_karts(frames: list[np.ndarray], conf: float = 0.25, mode: str = "action_cam") -> list[dict]:
    """
    Returns per-frame list of {track_id: (cx, cy, x1,y1,x2,y2)}.
    Uses YOLO11n + ByteTrack — works zero-shot on vehicles.
    Override model via KART_YOLO_MODEL env var.

    mode='fpv_follow'  → single dominant kart (FPV drone chasing one kart).
                         Keeps only the largest detection per frame.
    mode='action_cam'  → multiple karts ahead visible (GoPro helmet cam).
                         Keeps all detections above min area.
    """
    model = YOLO(_KART_YOLO_MODEL)
    tracker_cfg = str(Path(__file__).parent / "bytetrack_stable.yaml")
    results_per_frame = []

    for frame in frames:
        h, w = frame.shape[:2]
        min_area = (w * h) * 0.002  # ignore tiny blips < 0.2% of frame

        results = model.track(
            frame,
            persist=True,
            conf=conf,
            classes=list(VEHICLE_CLASSES),
            tracker=tracker_cfg,
            verbose=False,
        )
        detections = {}
        if results[0].boxes.id is not None:
            for box, tid in zip(results[0].boxes.xyxy, results[0].boxes.id):
                x1, y1, x2, y2 = box.cpu().numpy()
                area = (x2 - x1) * (y2 - y1)
                if area < min_area:
                    continue
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                detections[int(tid)] = (cx, cy, x1, y1, x2, y2, area)

        if mode == "fpv_follow" and detections:
            # Keep only largest box — that's the kart being followed
            best = max(detections, key=lambda t: detections[t][6])
            detections = {best: detections[best]}

        elif mode == "action_cam" and detections:
            frame_area = h * w
            filtered = {}
            for tid, det in detections.items():
                cx, cy, x1, y1, x2, y2, area = det
                box_w = x2 - x1
                # Remove own kart body: bbox bottom edge near bottom of frame AND very wide
                # (steering wheel / dashboard seen from inside — large + at bottom)
                if y2 > h * 0.90 and box_w > w * 0.50:
                    continue
                # Remove extremely large boxes (>40% frame) — definitely own vehicle
                if area > frame_area * 0.40:
                    continue
                filtered[tid] = det
            detections = filtered

        # Strip internal area field
        results_per_frame.append({
            tid: det[:6] for tid, det in detections.items()
        })

    return results_per_frame


# ---------------------------------------------------------------------------
# Step 4 — BEV homography (manual 4-point or automatic from track mask)
# ---------------------------------------------------------------------------
def compute_homography_from_mask(mask: np.ndarray, frame_shape: tuple) -> np.ndarray | None:
    """
    Estimate homography using track mask contour bounding box.
    For demo: maps image corners to a top-down square canvas.
    """
    h, w = frame_shape[:2]
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    largest = max(contours, key=cv2.contourArea)
    rect = cv2.minAreaRect(largest)
    box = cv2.boxPoints(rect)
    box = np.array(sorted(box, key=lambda p: (p[1], p[0])), dtype=np.float32)

    # Destination: flat square (600x600 BEV canvas)
    BEV_SIZE = 600
    dst = np.array([
        [0, 0], [BEV_SIZE, 0],
        [0, BEV_SIZE], [BEV_SIZE, BEV_SIZE]
    ], dtype=np.float32)

    H, _ = cv2.findHomography(box[:4], dst)
    return H


def project_to_bev(points: list[tuple[float, float]], H: np.ndarray) -> list[tuple[int, int]]:
    if not points or H is None:
        return []
    pts = np.array([[p[0], p[1]] for p in points], dtype=np.float32).reshape(-1, 1, 2)
    projected = cv2.perspectiveTransform(pts, H)
    return [(int(p[0][0]), int(p[0][1])) for p in projected]


# ---------------------------------------------------------------------------
# Step 5 — Ideal racing line (track centerline from mask)
# ---------------------------------------------------------------------------
def compute_ideal_line(mask: np.ndarray, n_strips: int = 40) -> list[tuple[int, int]]:
    """
    Computes local track centerline for FPV footage.
    Samples horizontal strips of the mask and finds the midpoint of the track
    in each strip — gives a meaningful center line in perspective view.
    """
    h, w = mask.shape[:2]
    pts = []

    # Sample from bottom 80% to top 30% of frame (skip sky and hood)
    y_start = int(h * 0.30)
    y_end   = int(h * 0.92)

    for y in np.linspace(y_start, y_end, n_strips):
        y = int(y)
        row = mask[y, :]
        track_cols = np.where(row > 0)[0]
        if len(track_cols) < 20:
            continue
        # Use distance transform peak in this row for robustness
        left  = int(track_cols[int(len(track_cols) * 0.1)])
        right = int(track_cols[int(len(track_cols) * 0.9)])
        cx = (left + right) // 2
        pts.append((cx, y))

    if len(pts) < 6:
        return []

    # Smooth with spline
    try:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        tck, u = splprep([xs, ys], s=500, per=False)
        u_new = np.linspace(0, 1, n_strips * 2)
        x_new, y_new = splev(u_new, tck)
        x_new = np.clip(x_new, 5, w - 5)
        y_new = np.clip(y_new, 5, h - 5)
        return [(int(x), int(y)) for x, y in zip(x_new, y_new)]
    except Exception:
        return pts


# ---------------------------------------------------------------------------
# Step 6 — Annotate frames  (mode-aware)
# ---------------------------------------------------------------------------
def _draw_karts(out, detections, track_history, draw_trail):
    for tid, det in detections.items():
        cx, cy, x1, y1, x2, y2 = det
        color = TRAIL_COLORS[tid % len(TRAIL_COLORS)]
        if tid not in track_history:
            track_history[tid] = []
        track_history[tid].append((int(cx), int(cy)))
        if len(track_history[tid]) > 60:
            track_history[tid].pop(0)
        if draw_trail:
            trail = track_history[tid]
            for i in range(1, len(trail)):
                alpha = i / len(trail)
                c = tuple(int(v * alpha) for v in color)
                cv2.line(out, trail[i - 1], trail[i], c, 2, cv2.LINE_AA)
        cv2.rectangle(out, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
        cv2.circle(out, (int(cx), int(cy)), 5, color, -1)
        cv2.putText(out, f"K{tid}", (int(x1), int(y1) - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2, cv2.LINE_AA)


def annotate_frame_fpv(frame, detections, track_history, mask, frame_idx):
    """FPV drone follow: track mask overlay + LAT POS bar. No trails."""
    out = frame.copy()
    h, w = out.shape[:2]

    if mask is not None and mask.any():
        overlay = out.copy()
        overlay[mask > 0] = (30, 80, 30)
        cv2.addWeighted(overlay, 0.25, out, 0.75, 0, out)

    kerb_mask = detect_track_edges(frame)
    if kerb_mask.any():
        out[kerb_mask > 0] = (out[kerb_mask > 0] * 0.4 + np.array([200, 200, 0]) * 0.6).astype(np.uint8)

    _draw_karts(out, detections, track_history, draw_trail=False)

    # LAT POS bar
    if mask is not None and detections:
        sample_y = int(h * 0.65)
        row = mask[sample_y, :]
        track_cols = np.where(row > 0)[0]
        if len(track_cols) > 40:
            t_left, t_right = int(track_cols[0]), int(track_cols[-1])
            t_width = t_right - t_left
            bx, by, bw, bh = 12, h - 52, 200, 10
            cv2.rectangle(out, (bx, by), (bx + bw, by + bh), (40, 40, 40), -1)
            cv2.rectangle(out, (bx, by), (bx + bw, by + bh), (80, 80, 80), 1)
            cv2.line(out, (bx + bw // 2, by - 3), (bx + bw // 2, by + bh + 3), (180, 180, 180), 1)
            for tid, det in detections.items():
                if t_width > 0:
                    rel = np.clip((det[0] - t_left) / t_width, 0, 1)
                    dot_x = bx + int(rel * bw)
                    cv2.circle(out, (dot_x, by + bh // 2), 6, TRAIL_COLORS[tid % len(TRAIL_COLORS)], -1)
            cv2.putText(out, "LAT POS", (bx, by - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (150, 150, 150), 1)

    cv2.putText(out, f"F{frame_idx}", (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
    cv2.putText(out, "DriverCoach | FPV Follow", (12, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (140, 140, 140), 1)
    return out


def _vanishing_point(mask, h, w):
    """Estimate vanishing point (apex direction) from track mask centerline.
    For action_cam, the road is in the upper ~55% of frame; cockpit fills the rest."""
    pts = []
    # Road region for action_cam: y=8%–42% (above driver body)
    y_bottom = int(h * 0.42)
    for y in np.linspace(int(h * 0.08), y_bottom, 20):
        y = int(y)
        row = mask[y, :]
        cols = np.where(row > 0)[0]
        if len(cols) > 20:
            pts.append((int(cols[len(cols)//2]), y))
    if len(pts) < 4:
        return None
    # Fit line through centerline points → vanishing point = top of line
    xs = np.array([p[0] for p in pts], dtype=np.float32)
    ys = np.array([p[1] for p in pts], dtype=np.float32)
    try:
        coeffs = np.polyfit(ys, xs, 1)   # x = a*y + b
        vp_y = int(h * 0.25)
        vp_x = int(np.polyval(coeffs, vp_y))
        vp_x = int(np.clip(vp_x, w * 0.1, w * 0.9))
        return (vp_x, vp_y)
    except Exception:
        return None


def _detect_front_tires(frame, h, w):
    """
    Detect front tire positions in the lower portion of the GoPro frame.
    Tires appear as dark ellipses near bottom corners in helmet-cam footage.
    Returns (left_x, right_x) normalized [0,1] or None.
    """
    # Search region: bottom 35% of frame, avoid center (steering wheel)
    roi_top = int(h * 0.65)
    roi = frame[roi_top:, :]
    roi_h, roi_w = roi.shape[:2]

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    # Tires are very dark — threshold for dark regions
    _, dark = cv2.threshold(gray, 60, 255, cv2.THRESH_BINARY_INV)
    # Remove very small blobs
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Keep contours that look like tires: wide enough, in left or right half
    candidates = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < roi_w * roi_h * 0.01:   # at least 1% of search region
            continue
        x, y, cw, ch = cv2.boundingRect(c)
        cx = x + cw // 2
        candidates.append((cx, y + roi_top, cw, ch, area))

    if not candidates:
        return None

    # Split into left half and right half
    left_cands  = [c for c in candidates if c[0] < roi_w * 0.45]
    right_cands = [c for c in candidates if c[0] > roi_w * 0.55]

    left_x  = max(left_cands,  key=lambda c: c[4])[0] / roi_w if left_cands  else None
    right_x = min(right_cands, key=lambda c: c[4])[0] / roi_w if right_cands else None

    if left_x is not None and right_x is not None:
        return (left_x, right_x)
    return None


def annotate_frame_action(frame, detections, track_history, mask, frame_idx,
                           prev_gray=None):
    """
    Action cam (GoPro helmet/kart): focus on track mapping, racing line, tires.
    No kart bboxes — they add noise from this POV.
    Adds: vanishing point (apex direction), track centerline, tire markers,
    kerb detection, GAP bar (from bbox area, drawn minimally), optical flow speed.
    """
    out = frame.copy()
    h, w = out.shape[:2]

    # ── 1. Track mask: paint road surface visibly ─────────────────────────────
    if mask is not None and mask.any():
        # 40% tinted green blend — road surface clearly visible
        green_tint = np.array([15, 170, 60], dtype=np.float32)
        road_pixels = out[mask > 0].astype(np.float32)
        out[mask > 0] = np.clip(road_pixels * 0.60 + green_tint * 0.40, 0, 255).astype(np.uint8)

        # Track boundary contour (only largest, 2px bright green)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            if cv2.contourArea(largest) > h * w * 0.08:
                cv2.drawContours(out, [largest], -1, (40, 220, 80), 2)

    # ── 2. Vanishing point + racing line direction ──────────────────────────────
    vp = None
    if mask is not None and mask.any():
        vp = _vanishing_point(mask, h, w)
    if vp is not None:
        # Draw racing line from road/cockpit boundary to vanishing point
        line_start_y = int(h * 0.42)   # bottom of road region (above driver body)
        line_start_x = w // 2
        cv2.line(out, (line_start_x, line_start_y), vp, (0, 200, 100), 1, cv2.LINE_AA)
        cv2.circle(out, vp, 6, (0, 220, 100), -1)
        cv2.circle(out, vp, 10, (0, 220, 100), 1)
        # Label: left/center/right of center
        offset = vp[0] - w // 2
        if abs(offset) < w * 0.06:
            apex_label = "APEX: CENTER"
        elif offset < 0:
            apex_label = "APEX: LEFT"
        else:
            apex_label = "APEX: RIGHT"
        cv2.putText(out, apex_label, (vp[0] - 50, vp[1] - 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 220, 100), 1, cv2.LINE_AA)

    # ── 3. Front tire markers — disabled (helmet-mount cameras don't show tires)
    # tires = _detect_front_tires(frame, h, w)  # enable when using front-bodywork mount

    # ── 4. Kerb detection — red-only, classified by horizontal position ─────────
    road_h = int(h * 0.42)
    kerb_left, kerb_right = detect_kerb_contact(frame, road_h)
    if kerb_left:
        cv2.putText(out, "KERB L", (8, h // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 220, 180), 2, cv2.LINE_AA)
    if kerb_right:
        cv2.putText(out, "KERB R", (w - 88, h // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 220, 180), 2, cv2.LINE_AA)

    # ── 5. GAP bar (kart ahead proximity — bbox area only, no box drawn) ───────
    if detections:
        closest = max(detections.values(), key=lambda d: (d[3] - d[1]) * (d[2] - d[0]))
        _, _, x1c, y1c, x2c, y2c = closest[:6]
        box_h = y2c - y1c
        proximity = float(np.clip(box_h / (h * 0.45), 0, 1))
        bar_w, bar_h_px = 90, 6
        bx, by = w - bar_w - 10, h - 22
        cv2.rectangle(out, (bx, by), (bx + bar_w, by + bar_h_px), (40, 40, 40), -1)
        fill_col = (0, int(255 * (1 - proximity)), int(255 * proximity))
        cv2.rectangle(out, (bx, by), (bx + int(proximity * bar_w), by + bar_h_px), fill_col, -1)
        cv2.putText(out, "GAP", (bx, by - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.28, (100, 100, 100), 1)

    # ── 6. HUD ─────────────────────────────────────────────────────────────────
    cv2.putText(out, f"F{frame_idx}", (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)
    cv2.putText(out, "DriverCoach | Action Cam", (10, h - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, (120, 120, 120), 1)
    return out


def annotate_frame(frame, detections, track_history, mask, ideal_line, frame_idx,
                   draw_trail=True, mode="fpv_follow"):
    if mode == "action_cam":
        return annotate_frame_action(frame, detections, track_history, mask, frame_idx)
    return annotate_frame_fpv(frame, detections, track_history, mask, frame_idx)


# ---------------------------------------------------------------------------
# Step 7 — VLM coaching (Claude Vision)
# ---------------------------------------------------------------------------
def llm_summary(metrics: dict) -> str:
    """
    Pure LLM call (NO image) — general session coaching from metrics alone.
    Called once automatically at end of pipeline.
    """
    mode       = metrics.get("mode", "fpv_follow")
    n_frames   = metrics.get("frames_analyzed", 0)
    n_karts    = metrics.get("karts_detected", 0)
    kerb_ev    = metrics.get("kerb_events") or 0
    apex_fr    = metrics.get("apex_frames") or 0
    scores     = metrics.get("driver_scores", {})
    top_karts  = metrics.get("top_karts", [])

    # Build a compact telemetry block for the prompt
    tel_lines = [f"- Frames analizados: {n_frames}", f"- Karts detectados: {n_karts}"]
    if mode == "action_cam":
        kerb_rate = round(kerb_ev / n_frames * 100, 1) if n_frames else 0
        tel_lines += [
            f"- Eventos de kerb: {kerb_ev} ({kerb_rate}% de frames)",
            f"- Frames con marcador de ápex: {apex_fr}",
        ]
    for kid in top_karts:
        s = scores.get(str(kid), {})
        tel_lines.append(
            f"- Kart #{kid}: consistencia={s.get('consistency', '?')}, "
            f"uso_pista={s.get('edge_use', '?')}, lat_mean={s.get('lat_mean', '?')}"
        )

    prompt = (
        "Eres un coach experto de karting. "
        "Analiza el rendimiento de la sesión ÚNICAMENTE basándote en las métricas que te doy — "
        "NO tienes imagen. Da una opinión general concisa (3–5 bullets) sobre:\n"
        "• Uso del ancho de pista\n"
        "• Consistencia de la línea\n"
        "• Uso de kerbs (si aplica)\n"
        "• Qué mejorar y qué va bien\n\n"
        f"Modo de cámara: {mode}\n"
        "Métricas de la sesión:\n" + "\n".join(tel_lines) + "\n\n"
        "Responde en español. No menciones que no tienes imagen."
    )

    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            import requests
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                    "max_tokens": 400,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[Groq LLM] {e} — trying Anthropic")

    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=anthropic_key)
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text
        except Exception as e:
            return f"LLM error: {e}"

    return "⚠️ Set GROQ_API_KEY o ANTHROPIC_API_KEY para habilitar el resumen LLM"


def vlm_coaching(frame: np.ndarray, kart_id: int, situation: str) -> str:
    """
    VLM call (image + metrics context) — only invoked when the user explicitly
    pins a frame in the review player. Never called automatically.
    Returns coaching text in Spanish.
    """
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    img_b64 = base64.standard_b64encode(buf).decode("utf-8")

    prompt = (
        "Eres un coach experto de karting. Esta imagen es el frame anotado exacto "
        "que el piloto ha marcado para análisis.\n"
        "La zona VERDE semitransparente es la pista detectada por SAM3.\n"
        "Los bordes CYAN son los kerbs/límites de pista.\n"
        "La barra 'LAT POS' muestra la posición lateral (izquierda=0, derecha=1).\n\n"
        f"Contexto del instante analizado:\n{situation}\n\n"
        "Analiza la técnica del piloto EN ESTE INSTANTE ESPECÍFICO en 3 bullets cortos. "
        "Enfócate en lo que ves en la imagen + el contexto de telemetría. "
        "No inventes datos que no ves. Responde en español."
    )

    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            import requests
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                    "max_tokens": 300,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
                            {"type": "text", "text": prompt},
                        ],
                    }],
                },
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[Groq VLM] {e} — trying Anthropic")

    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=anthropic_key)
            msg = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=300,
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}},
                    {"type": "text", "text": prompt},
                ]}],
            )
            return msg.content[0].text
        except Exception as e:
            return f"VLM error: {e}"

    return "⚠️ Set GROQ_API_KEY o ANTHROPIC_API_KEY para habilitar análisis VLM"


# ---------------------------------------------------------------------------
# Step 8 — Per-lap sector scoring (simplified)
# ---------------------------------------------------------------------------
def score_driver(track_history: dict[int, list], ideal_line: list[tuple[int, int]]) -> dict:
    """
    Computes average deviation from ideal line per driver.
    Returns {kart_id: {score, avg_deviation_px, consistency}}.
    """
    if not ideal_line:
        return {}

    ideal_arr = np.array(ideal_line, dtype=np.float32)
    scores = {}

    for tid, history in track_history.items():
        if len(history) < 5:
            continue
        deviations = []
        for px, py in history:
            dists = np.linalg.norm(ideal_arr - np.array([px, py]), axis=1)
            deviations.append(float(dists.min()))

        avg_dev = float(np.mean(deviations))
        std_dev = float(np.std(deviations))
        # Score 0-100: lower deviation = higher score
        score = max(0, 100 - avg_dev * 0.5)
        scores[tid] = {
            "score": round(score, 1),
            "avg_deviation_px": round(avg_dev, 1),
            "consistency": round(max(0, 100 - std_dev), 1),
        }

    return scores


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _downsample(data: list, max_pts: int) -> list:
    """Keep at most max_pts evenly-spaced items from data list."""
    if len(data) <= max_pts:
        return data
    step = len(data) / max_pts
    return [data[int(i * step)] for i in range(max_pts)]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run(video_path: str, every_n: int = 2, max_frames: int = 300, coaching: bool = True,
        skip_seconds: float = 0, mode: str = "fpv_follow", prompt: str | None = None,
        out_name: str = "karting_demo", output_dir: str | None = None):
    """
    mode: 'fpv_follow'  — drone chasing one kart. Keeps single dominant detection per frame.
          'action_cam'  — GoPro/helmet cam. Keeps all karts visible ahead.
    out_name: stem of output files (karting_demo → karting_demo.mp4, session_summary.json)
    output_dir: override OUTPUT_DIR (used by FastAPI backend to write into session folder)
    """
    out_root = Path(output_dir) if output_dir else OUTPUT_DIR
    out_root.mkdir(parents=True, exist_ok=True)
    print(f"\n🏎️  DriverCoach Karting Demo — Tier 0  [{mode}]")
    print(f"   Video: {video_path}")

    info = get_video_info(video_path)
    print(f"   {info['width']}x{info['height']} @ {info['fps']:.1f}fps  |  {info['total_frames']} frames total")

    # Auto-detect footage start for action_cam (skips GoPro/camera intros/title cards)
    effective_skip = skip_seconds
    if mode == "action_cam" and skip_seconds == 0:
        print("\n[1/6] Auto-detecting footage start (skipping dark intros)...")
        effective_skip = _find_footage_start(video_path, max_search_sec=15.0)
    else:
        print("\n[1/6] Extracting frames...")

    frames = extract_frames(video_path, every_n=every_n, max_frames=max_frames, skip_seconds=effective_skip)
    print(f"      {len(frames)} frames extracted (skip={effective_skip:.1f}s)")

    # SAM2 Video: propagate track mask through all frames
    print("[2/6] Segmenting track — SAM2 Video (GPU propagation)...")
    h, w = frames[0].shape[:2]
    # Prompt points differ by mode:
    # action_cam: road ahead is visible in UPPER portion of frame (above driver/wheel).
    #   Bottom ~40% is the kart cockpit (steering wheel, driver body) — avoid it.
    # fpv_follow: track visible in mid-lower portion
    if mode == "action_cam":
        # Road is visible in UPPER portion of frame (y=10-40%).
        # Below that is driver body / steering wheel — avoid it.
        track_pts = [
            (w // 2,          int(h * 0.20)),   # road center, far ahead
            (int(w * 0.35),   int(h * 0.30)),   # road, left lane
            (int(w * 0.65),   int(h * 0.30)),   # road, right lane
            (w // 2,          int(h * 0.12)),   # road, very far ahead
        ]
    else:
        track_pts = [
            (w // 2, int(h * 0.65)),
            (int(w * 0.35), int(h * 0.75)),
            (int(w * 0.65), int(h * 0.75)),
        ]
    # Try SAM3 (text-prompt, no coordinate fragility) → fall back to SAM2 if unavailable
    print("[2/6] Segmenting track — trying SAM3 text-prompt first...")
    all_masks = segment_track_sam3_video(frames, mode=mode, prompt=prompt)
    if all_masks is None:
        print("      SAM3 unavailable — using SAM2 Video (GPU propagation)...")
        all_masks = segment_track_sam2_video(frames, track_pts, mode=mode)
    cv2.imwrite(str(out_root / "track_mask.png"), all_masks[0])
    print(f"      Mask saved → {out_root}/track_mask.png")


    # FPV mode: no global racing line (needs GPS/map)
    ideal_line = []
    print("[3/6] FPV mode — lateral position indicator active (no global racing line)")

    # YOLO + ByteTrack
    print(f"[4/6] Tracking karts (YOLO11n + ByteTrack [{_KART_YOLO_MODEL}], mode={mode})...")
    all_detections = track_karts(frames, conf=0.20, mode=mode)
    n_karts = len({tid for dets in all_detections for tid in dets})
    print(f"      {n_karts} unique kart IDs detected")

    # fpv_follow: all detections are the same physical kart — collapse to ID=1
    if mode == "fpv_follow":
        all_detections = [{1: list(d.values())[0]} if d else {} for d in all_detections]
        n_karts = 1
        print(f"      fpv_follow: remapped to single kart ID=1")

    # Annotate + write output video
    print("[5/6] Annotating video...")
    out_path = str(out_root / f"{out_name}.mp4")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    fps_out = info["fps"] / every_n
    writer = cv2.VideoWriter(out_path, fourcc, fps_out, (w, h))

    track_history: dict[int, list] = {}
    lateral_history: dict[int, list] = {}  # tid -> [0..1] lateral position per frame
    coaching_frames = {}
    kerb_events = 0      # frames where any kerb was touched (left or right edge)
    apex_frames = 0      # frames where vanishing point was computable
    frame_telemetry: list[dict] = []  # per-frame data for timeline charts

    for i, (frame, dets, frame_mask) in enumerate(zip(frames, all_detections, all_masks)):
        annotated = annotate_frame(frame, dets, track_history, frame_mask, [], i, mode=mode)
        writer.write(annotated)

        # Collect per-frame telemetry (cheap ops — HSV + numpy only)
        fstats: dict = {"f": i}
        h_f2, w_f2 = frame.shape[:2]

        if mode == "action_cam":
            road_h2 = int(h_f2 * 0.42)
            kl, kr = detect_kerb_contact(frame, road_h2)
            fstats["kl"] = int(kl)
            fstats["kr"] = int(kr)
            if kl or kr:
                kerb_events += 1

            vp = None
            if frame_mask is not None and frame_mask.any():
                vp = _vanishing_point(frame_mask, h_f2, w_f2)
            if vp is not None:
                apex_frames += 1
                offset = vp[0] - w_f2 // 2
                fstats["ap"] = 0 if abs(offset) < w_f2 * 0.06 else (-1 if offset < 0 else 1)
            else:
                fstats["ap"] = None

            # Gap proximity from closest bbox ahead
            if dets:
                closest = max(dets.values(), key=lambda d: (d[5] - d[3]))
                gap_val = float(np.clip((closest[5] - closest[3]) / (h_f2 * 0.45), 0, 1))
                fstats["gap"] = round(gap_val, 2)
            else:
                fstats["gap"] = None

        elif mode == "fpv_follow" and frame_mask is not None:
            sample_y = int(h_f2 * 0.65)
            row = frame_mask[sample_y, :]
            tc = np.where(row > 0)[0]
            if len(tc) > 40 and 1 in dets:
                tw = int(tc[-1]) - int(tc[0])
                if tw > 0:
                    fstats["lat"] = round(float(np.clip((dets[1][0] - tc[0]) / tw, 0, 1)), 2)

        frame_telemetry.append(fstats)

        # Track lateral position per kart
        h_f, w_f = frame_mask.shape[:2]
        sample_y = int(h_f * 0.65)
        row = frame_mask[sample_y, :]
        track_cols = np.where(row > 0)[0]
        if len(track_cols) > 40:
            t_left, t_right = int(track_cols[0]), int(track_cols[-1])
            t_width = t_right - t_left
            for tid, det in dets.items():
                if t_width > 0:
                    lat = float(np.clip((det[0] - t_left) / t_width, 0, 1))
                    lateral_history.setdefault(tid, []).append(lat)

        # Capture coaching frame per kart: first clear detection after frame 30
        if coaching and i > 30:
            for tid, det in dets.items():
                if tid not in coaching_frames:
                    coaching_frames[tid] = (annotated.copy(), det)

    writer.release()
    print(f"      Annotated video → outputs/{out_name}.mp4")

    # Scoring — based on lateral consistency and track coverage
    frame_counts = {}
    for dets in all_detections:
        for tid in dets:
            frame_counts[tid] = frame_counts.get(tid, 0) + 1

    scores = {}
    for tid, lat_list in lateral_history.items():
        if len(lat_list) < 5:
            continue
        lat_arr = np.array(lat_list)
        # Filter out karts always at edge (lat_mean ~0 or ~1 with tiny std = boundary noise)
        lat_mean = float(np.mean(lat_arr))
        lat_std  = float(np.std(lat_arr))
        if (lat_mean < 0.05 or lat_mean > 0.95) and lat_std < 0.05:
            continue  # noise at track boundary
        consistency = max(0.0, 100.0 - lat_std * 300)
        edge_use = float(np.mean(np.abs(lat_arr - 0.5)) * 2) * 100
        overall = round(consistency * 0.6 + edge_use * 0.4, 1)
        scores[tid] = {
            "score": overall,
            "consistency": round(consistency, 1),
            "edge_use": round(edge_use, 1),
            "frames_detected": frame_counts.get(tid, 0),
            "lat_mean": round(lat_mean, 3),
        }

    # Top karts: most frames, minimum 8 to filter out single-frame ghosts
    top_karts = sorted(
        [t for t in scores if scores[t]["frames_detected"] >= 8],
        key=lambda t: scores[t]["frames_detected"], reverse=True
    )[:4]
    if not top_karts:  # fallback if nothing passes threshold
        top_karts = sorted(scores.keys(), key=lambda t: scores[t]["frames_detected"], reverse=True)[:4]

    # LLM Summary — text-only, based entirely on metrics (no image).
    # VLM (image + time-window metrics) is only called on-demand when the user
    # pins a specific frame in the review player (backend /analyze-frame endpoint).
    coaching_results = {}
    if coaching:
        print("\n🧠 LLM Summary (metrics only, no image)...")
        # Build partial summary dict to pass as metrics context
        partial_metrics = {
            "mode": mode,
            "frames_analyzed": len(frames),
            "karts_detected": n_karts,
            "kerb_events": kerb_events if mode == "action_cam" else None,
            "apex_frames": apex_frames if mode == "action_cam" else None,
            "driver_scores": {str(k): scores[k] for k in top_karts},
            "top_karts": top_karts,
        }
        text = llm_summary(partial_metrics)
        coaching_results["driver"] = text
        print(f"   {text[:200]}...")

    summary = {
        "video": video_path,
        "date": __import__("datetime").date.today().isoformat(),
        "mode": mode,
        "skip_seconds": round(effective_skip, 2),
        "frames_analyzed": len(frames),
        "karts_detected": n_karts,
        "kerb_events": kerb_events if mode == "action_cam" else None,
        "apex_frames": apex_frames if mode == "action_cam" else None,
        "frames": _downsample(frame_telemetry, 500),
        "segmentation": "SAM2 Video" if any("SAM2" not in str(m) for m in []) else "SAM2 Video / HSV fallback",
        "tracker": f"{_KART_YOLO_MODEL} + ByteTrack",
        "llm": "Groq llama-4-scout-17b-16e-instruct (text-only summary)",
        "vlm": "Groq llama-4-scout-17b-16e-instruct (on-demand frame analysis)",
        "top_karts": top_karts,
        "driver_scores": {str(k): scores[k] for k in top_karts},
        "coaching": {str(k): v for k, v in coaching_results.items()},
    }
    summary_path = out_root / f"{out_name}_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding='utf-8')

    print(f"\n✅ Summary → {summary_path}")
    print(f"✅ Done! Outputs in: {out_root}")

    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DriverCoach Karting Demo")
    parser.add_argument("--video", default=str(ASSETS_DIR / "kart_circuit.mp4"))
    parser.add_argument("--every-n", type=int, default=2, help="Process every N frames")
    parser.add_argument("--max-frames", type=int, default=300)
    parser.add_argument("--no-coaching", action="store_true")
    parser.add_argument("--skip-seconds", type=float, default=0, help="Skip N seconds at start")
    parser.add_argument("--mode", choices=["fpv_follow", "action_cam"], default="fpv_follow",
                        help="fpv_follow=drone chasing 1 kart | action_cam=GoPro/helmet cam")
    parser.add_argument("--out-name", default="karting_demo", help="Output file stem")
    args = parser.parse_args()

    run(args.video, every_n=args.every_n, max_frames=args.max_frames,
        coaching=not args.no_coaching, skip_seconds=args.skip_seconds,
        mode=args.mode, out_name=args.out_name)
