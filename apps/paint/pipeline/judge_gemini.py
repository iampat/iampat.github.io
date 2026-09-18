#!/usr/bin/env python3
"""Judge a painting with the Gemini API (REST, no SDK).

Usage:
    python judge_gemini.py --painting run1/render/final.png --photo photo.png \\
        --target targets/oil_1440x1920.png --out run1/judge

Sends the painting, the photo and the target style image to Gemini with a
fixed prompt and asks for JSON scores. Writes prompt.txt, response.json
(raw) and scores.json (parsed) into --out. Reads the API key from env
GEMINI_API_KEY. The model is gemini-2.5-flash, or env GEMINI_JUDGE_MODEL.
"""
import argparse
import base64
import io
import json
import os
import sys
import urllib.error
import urllib.request

from PIL import Image

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-2.5-flash"
MAX_SIDE = 1024
TIMEOUT_SECONDS = 120

PROMPT = """You are an art critic judging an AI-made oil painting.

You will see three images, in this order:
1. The painting to judge.
2. The reference photo. It is the likeness ground truth: judge how well the painting resembles the person and the scene in it.
3. The target style image, a reference oil painting whose colours, edges and brush marks show the style the painting should match.

Score the painting from 1 (worst) to 10 (best) on:
- likeness_to_photo: how well the painting matches the person and scene in the photo.
- painterly_craft: brushwork quality, mark-making and paint-like handling, apart from the subject.
- faithfulness_to_target_style: how well the painting matches the target's colour, edge and brush-mark style.
- overall: your overall judgement of the painting as a finished piece.

Also list the three biggest problems in the painting, worst first. For each problem give:
- issue: a short description of the problem.
- location: the approximate spot in the painting, as fractions of width (x) and height (y), each 0.0 to 1.0, from the top-left corner.
- fix: a one-line suggestion to fix it.

Reply with JSON only, in this exact shape:
{
  "likeness_to_photo": <int 1-10>,
  "painterly_craft": <int 1-10>,
  "faithfulness_to_target_style": <int 1-10>,
  "overall": <int 1-10>,
  "problems": [
    {"issue": "...", "location": {"x": <float 0-1>, "y": <float 0-1>}, "fix": "..."},
    {"issue": "...", "location": {"x": <float 0-1>, "y": <float 0-1>}, "fix": "..."},
    {"issue": "...", "location": {"x": <float 0-1>, "y": <float 0-1>}, "fix": "..."}
  ]
}
"""


def load_and_downscale(path, max_side=MAX_SIDE):
    """Return (mime_type, base64 str) for path, downscaled to max_side on the long side."""
    with Image.open(path) as im:
        im = im.convert("RGB")
        w, h = im.size
        scale = min(1.0, max_side / max(w, h))
        if scale < 1.0:
            im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        data = base64.b64encode(buf.getvalue()).decode("ascii")
    return "image/png", data


def build_request(prompt, images, model):
    parts = [{"text": prompt}]
    for mime_type, data in images:
        parts.append({"inline_data": {"mime_type": mime_type, "data": data}})
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    url = API_URL.format(model=model)
    return url, body


def call_gemini(url, body, api_key):
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise SystemExit(f"error: Gemini API request failed: HTTP {e.code} {e.reason}\n{detail}")
    except urllib.error.URLError as e:
        raise SystemExit(f"error: could not reach Gemini API: {e.reason}")


def extract_scores(raw_text):
    """Pull the model's JSON answer out of a generateContent response body."""
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise SystemExit(f"error: Gemini response is not valid JSON: {e}")
    candidates = data.get("candidates") or []
    if not candidates:
        feedback = data.get("promptFeedback")
        raise SystemExit(f"error: Gemini returned no candidates (promptFeedback={feedback})")
    parts = candidates[0].get("content", {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts)
    if not text:
        raise SystemExit("error: Gemini candidate has no text part")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise SystemExit(f"error: Gemini's answer is not valid JSON: {e}\n{text}")


def main():
    ap = argparse.ArgumentParser(description="Judge a painting with the Gemini API.")
    ap.add_argument("--painting", required=True, help="path to the painting PNG/JPEG")
    ap.add_argument("--photo", required=True, help="path to the reference photo")
    ap.add_argument("--target", required=True, help="path to the target style image")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--model", default=None, help="Gemini model (default: env GEMINI_JUDGE_MODEL or %s" % DEFAULT_MODEL)
    args = ap.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("error: env GEMINI_API_KEY is not set")
    model = args.model or os.environ.get("GEMINI_JUDGE_MODEL") or DEFAULT_MODEL

    os.makedirs(args.out, exist_ok=True)

    images = [load_and_downscale(args.painting), load_and_downscale(args.photo), load_and_downscale(args.target)]
    url, body = build_request(PROMPT, images, model)

    with open(os.path.join(args.out, "prompt.txt"), "w") as f:
        f.write(PROMPT)

    raw = call_gemini(url, body, api_key)
    with open(os.path.join(args.out, "response.json"), "w") as f:
        f.write(raw)

    scores = extract_scores(raw)
    with open(os.path.join(args.out, "scores.json"), "w") as f:
        json.dump(scores, f, indent=2)

    print(json.dumps(scores, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
