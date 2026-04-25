from __future__ import annotations

import csv
import json
from dataclasses import asdict
from typing import List

from src.schemas import FrameFeatures


def export_features_csv(path: str, features: List[FrameFeatures]) -> str:
    rows = [asdict(f) for f in features]
    if not rows:
        with open(path, "w", encoding="utf-8") as file:
            file.write("")
        return path

    with open(path, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    return path


def export_features_json(path: str, features: List[FrameFeatures], summary: dict) -> str:
    payload = {
        "summary": summary,
        "frames": [asdict(f) for f in features],
    }
    with open(path, "w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)

    return path