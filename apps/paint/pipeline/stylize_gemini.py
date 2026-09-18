#!/usr/bin/env python3
"""Ask Gemini (Nano Banana) for stylized versions of a photo: the style targets.

    python stylize_gemini.py --photo photo.jpg --out targets [--styles oil sketch]
        [--model gemini-3-pro-image-preview] [--size 2K] [--suffix _2k]

Writes into --out, for every style key:
    <key><suffix>.prompt.txt    the prompt that was sent
    <key><suffix>.raw.png|.jpg  the image that came back
    <key><suffix>.response.json the response without the image data
    <key><suffix>.text.txt      any text the model added
    log.json                    one line per call

The API key comes from env GEMINI_API_KEY. The model and the image size may
also come from env GEMINI_IMAGE_MODEL and GEMINI_IMAGE_SIZE (2K or 4K, Pro
models only). Exits non-zero when a requested style returned no image, so a
caller can fall back to another model.
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-2.5-flash-image"
TIMEOUT_SECONDS = 300

STYLES = {
  "oil": "a traditional oil painting on canvas: confident visible brush strokes, thick paint, soft blended edges in the hair and the haze, crisp edges on the sweater silhouette, a slightly simplified palette, warm sunset light",
  "watercolor": "a watercolour painting on textured paper: transparent washes, soft wet edges, some granulation in the sky and water, light areas left as paper, loose but accurate drawing of the face",
  "pencil": "a coloured pencil drawing on cream paper: visible hatching strokes that follow the forms, layered colour, softly blended skin, precise but hand-drawn features",
  "sketch": "a plain graphite pencil sketch in black and white on white paper: no colour at all, clean confident pencil lines for the contours, light hatching and soft smudged shading for the tones, the background only lightly suggested, the face and hair drawn with care",
}

BASE = ("Turn this photo into {style}. Keep EXACTLY the same composition, framing, pose, head size and position, "
        "facial proportions and expression, the sunglasses on the head, the hair shape, the pink sweater, the lake, the hazy mountains "
        "and the sunset sky. The person must remain clearly recognisable as the same person. Do not add or remove anything. "
        "Do not add text, borders or a signature. Portrait orientation, 3:4 aspect ratio, same crop as the input.")


def mime_of(path):
    ext = os.path.splitext(path)[1].lower()
    return "image/png" if ext == ".png" else "image/jpeg"


def main(argv=None):
    ap = argparse.ArgumentParser(description="make style targets with Gemini")
    ap.add_argument("--photo", required=True, help="the source photo")
    ap.add_argument("--out", required=True, help="output directory for the targets")
    ap.add_argument("--styles", nargs="*", default=None, help="style keys (default: all of %s)" % ", ".join(STYLES))
    ap.add_argument("--model", default=None, help="default: env GEMINI_IMAGE_MODEL or " + DEFAULT_MODEL)
    ap.add_argument("--size", default=None, help="2K or 4K (Pro models only); default: env GEMINI_IMAGE_SIZE")
    ap.add_argument("--suffix", default=None, help="added to every output name; default: env GEMINI_OUT_SUFFIX or empty")
    ap.add_argument("--prompt-extra", default=None, help="one more sentence appended to the prompt")
    a = ap.parse_args(argv)

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise SystemExit("error: env GEMINI_API_KEY is not set")
    model = a.model or os.environ.get("GEMINI_IMAGE_MODEL") or DEFAULT_MODEL
    size = a.size if a.size is not None else os.environ.get("GEMINI_IMAGE_SIZE")
    suffix = a.suffix if a.suffix is not None else os.environ.get("GEMINI_OUT_SUFFIX", "")
    wanted = a.styles or list(STYLES)
    unknown = [k for k in wanted if k not in STYLES]
    if unknown:
        raise SystemExit("error: unknown style(s) %s; known: %s" % (", ".join(unknown), ", ".join(STYLES)))

    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    with open(a.photo, "rb") as fh:
        img_b64 = base64.b64encode(fh.read()).decode()
    photo_mime = mime_of(a.photo)

    log, failed = [], []
    for k in wanted:
        prompt = BASE.format(style=STYLES[k])
        if a.prompt_extra:
            prompt = prompt + " " + a.prompt_extra.strip()
        with open(os.path.join(out, "%s%s.prompt.txt" % (k, suffix)), "w") as fh:
            fh.write(prompt + "\n")
        image_config = {"aspectRatio": "3:4"}
        if size:
            image_config["imageSize"] = size
        body = {"contents": [{"parts": [{"text": prompt},
                                        {"inline_data": {"mime_type": photo_mime, "data": img_b64}}]}],
                "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": image_config}}
        req = urllib.request.Request(API_URL.format(model=model),
                                     data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json", "x-goog-api-key": key})
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as r:
                resp = json.load(r)
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")[:800]
            print("%s: HTTP %s %s" % (k, e.code, err))
            log.append({"style": k + suffix, "model": model, "error": err})
            failed.append(k)
            continue
        except urllib.error.URLError as e:
            print("%s: could not reach the API: %s" % (k, e.reason))
            log.append({"style": k + suffix, "model": model, "error": str(e.reason)})
            failed.append(k)
            continue
        with open(os.path.join(out, "%s%s.response.json" % (k, suffix)), "w") as fh:
            json.dump({x: y for x, y in resp.items() if x != "candidates"}, fh, indent=1)
        n, texts = 0, []
        for cand in resp.get("candidates", []):
            for part in cand.get("content", {}).get("parts", []):
                if "inlineData" in part:
                    data = base64.b64decode(part["inlineData"]["data"])
                    ext = "png" if "png" in part["inlineData"]["mimeType"] else "jpg"
                    with open(os.path.join(out, "%s%s.raw.%s" % (k, suffix, ext)), "wb") as fh:
                        fh.write(data)
                    n += 1
                elif "text" in part:
                    texts.append(part["text"])
        if texts:
            with open(os.path.join(out, "%s%s.text.txt" % (k, suffix)), "w") as fh:
                fh.write("\n".join(texts))
        print("%s: %d image(s), %.1fs, text: %r" % (k, n, time.time() - t0, " ".join(texts)[:120]))
        log.append({"style": k + suffix, "images": n, "seconds": round(time.time() - t0, 1),
                    "model": model, "size": size})
        if n == 0:
            failed.append(k)

    log_path = os.path.join(out, "log.json")
    prev = []
    if os.path.exists(log_path):
        with open(log_path) as fh:
            prev = json.load(fh)
    done = {e["style"] for e in log}
    with open(log_path, "w") as fh:
        json.dump([e for e in prev if e.get("style") not in done] + log, fh, indent=1)

    if failed:
        print("no image for: %s" % ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
