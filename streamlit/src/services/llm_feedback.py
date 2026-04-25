from __future__ import annotations

from openai import OpenAI

from src.schemas import ClipSummary


class LLMCoach:
    def __init__(self, api_key: str, model: str = "openai/gpt-oss-20b"):
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        self.model = model

    def generate_feedback(self, summary: ClipSummary) -> str:
        prompt = f"""
You are an expert MTB downhill coach.

You are given a ride summary from a computer vision system.
Write a concise but practical coaching summary.

Rules:
- be specific
- sound like a real coach
- mention strengths first
- then weaknesses
- then 2 or 3 practical recommendations
- do not invent metrics not present here

Ride summary:
- posture distribution: {summary.posture_distribution}
- avg balance score: {summary.avg_balance_score}
- avg line efficiency score: {summary.avg_line_efficiency_score}
- avg speed proxy: {summary.avg_speed_proxy}
- terrain distribution: {summary.terrain_distribution}
"""

        response = self.client.chat.completions.create(
            model=self.model,
            temperature=0.3,
            messages=[
                {
                    "role": "system",
                    "content": "You are a concise and practical MTB downhill coach.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        )

        return response.choices[0].message.content.strip()