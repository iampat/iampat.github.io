#!/bin/bash
# paint.sh <image.jpg> <oil|watercolor|pencil|sketch|crayon> <workdir> [options]
#
#   --max-strokes N   stop after N strokes. 3000 while you iterate on one of the
#                     four painting styles. crayon needs 31600 or more: see below.
#   --seed N          the placer seed (default 7)
#   --skip-target     use a target image already in place, and skip Gemini
#   --no-judge        skip the Gemini judge (the only language-model step)
#   --regions FILE    a regions file for this photo (default: the template's own)
#   --tidy            remove the video frames at the end (1.5 GB, 7.2 GB crayon)
#   --log FILE        send every line of output to FILE instead of the terminal
#
# Paints one image in one style, end to end: style target, direction, stroke
# placer, browser render, video, quality numbers, Gemini judge, and a
# gallery-ready folder. Every path comes from the arguments.
#
# <image.jpg> and <workdir> are separate arguments. The image may sit anywhere,
# in the work dir or outside the repo. <workdir> is where the run writes.
#
# The style word must be one of oil, watercolor, pencil, sketch, crayon. British
# and long spellings (watercolour, graphite, coloured pencil, crayons, wax) map
# to those five.
#
# The first four styles paint a photo: Gemini makes a style target, and the
# placer paints that target. crayon traces a finished crayon drawing instead.
# The input image IS the target, so no model runs: the placer follows the marks
# of the drawing with the crayon tool, and the video shows the crayon tip.
#
# --max-strokes caps the whole run. The placer walks the layer list in order, so
# a low cap drops the late layers. It does not thin each layer. The seven crayon
# layers carry 600 strokes, then three colour layers of at most 9000 each, then
# 1800, 2200 and 2500. The colour layers stop on ink density and often keep
# fewer. So --max-strokes 3000 stops 2400 strokes into light-colors: the outline
# pass and a little pale fill, no mid tones, no darks, no frame. Use 31600 to
# reach the end of the border ring. Use 34000, or no --max-strokes at all, for
# the whole picture. The direction step prints where the cap lands.
#
# A run takes 6 to 12 minutes, and a full crayon run 9 to 10. To run it in the
# background and watch it:
#   paint.sh photo.jpg oil <workdir> --log <workdir>/oil.log &
#   tail -f <workdir>/oil.log
#
# Layout it builds under <workdir>:
#   photo_1440x1920.png              the image in plan space
#   targets/<style>_2k.raw.png|.jpg  the Gemini target, as it came back (not crayon)
#   targets/<style>_1440x1920.png    the target in plan space (crayon: the image again)
#   <style>/                         direction.json, actions.json, report.txt, error.png,
#                                    render/, painting.mp4, poster.jpg, q_target/, q_photo/, judge/
#   gallery/<style>/                 final.jpg, final.png, painting.mp4, poster.jpg,
#                                    scores.json, summary.txt
#
# --skip-target needs a target already in place. Put it at
# <workdir>/targets/<style>_2k.raw.png (or .raw.jpg, or <style>_1440x1920.png).
# crayon ignores --skip-target: it makes the target from the image itself. It
# runs the judge only when GEMINI_API_KEY is set and --no-judge is absent, and
# the judge then sees the drawing as both the photo and the target.
# --tidy removes the video frames at the end. They hold about 1.5 GB per run,
# and 7.2 GB for a full crayon run, because a crayon frame carries more ink. The
# mp4 no longer needs them.
set -euo pipefail

PIPELINE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(dirname "$PIPELINE_DIR")
TOOLS_DIR="$APP_DIR/tools"
PY="${PAINT_PYTHON:-$APP_DIR/work/venv/bin/python}"

PLAN_W=1440
PLAN_H=1920
PRO_MODEL="${GEMINI_IMAGE_MODEL:-gemini-3-pro-image-preview}"
FALLBACK_MODEL="${GEMINI_IMAGE_FALLBACK_MODEL:-gemini-2.5-flash-image}"

usage() {
    sed -n "2,$(($(grep -n '^set -euo pipefail$' "${BASH_SOURCE[0]}" | head -1 | cut -d: -f1) - 1))p" \
        "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 1
}

[[ $# -ge 3 ]] || usage
PHOTO=$1; STYLE=$2; WORKDIR=$3; shift 3
MAX_STROKES=""
SEED=""
SKIP_TARGET=0
TIDY=0
LOG=""
NO_JUDGE=0
REGIONS=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --max-strokes) MAX_STROKES="$2"; shift 2 ;;
        --seed) SEED="$2"; shift 2 ;;
        --skip-target) SKIP_TARGET=1; shift ;;
        --no-judge) NO_JUDGE=1; shift ;;
        --regions) REGIONS="$2"; shift 2 ;;
        --tidy) TIDY=1; shift ;;
        --log) LOG="$2"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "unknown option: $1"; usage ;;
    esac
done

# the four style words, and the spellings people reach for
STYLE_IN="$STYLE"
STYLE=$(echo "$STYLE" | tr '[:upper:]' '[:lower:]' | tr ' _' '--')
case "$STYLE" in
    watercolour|water-colour|water-color) STYLE=watercolor ;;
    graphite|graphite-sketch|charcoal) STYLE=sketch ;;
    coloured-pencil|colored-pencil|pencils) STYLE=pencil ;;
    oils|oil-paint|oil-painting) STYLE=oil ;;
    crayons|wax|wax-crayon) STYLE=crayon ;;
esac
case "$STYLE" in
    oil|watercolor|pencil|sketch|crayon) ;;
    *) echo "error: style must be oil, watercolor, pencil, sketch or crayon (got $STYLE_IN)"; exit 1 ;;
esac
[[ -f "$PHOTO" ]] || { echo "error: no photo at $PHOTO"; exit 1; }

if [[ -n "$LOG" ]]; then
    mkdir -p "$(dirname "$LOG")"
    echo "log: $LOG   (watch it with: tail -f $LOG)"
    exec >"$LOG" 2>&1
fi
# after the redirect, so the log keeps the note
[[ "$STYLE" == "$STYLE_IN" ]] || echo "note: style \"$STYLE_IN\" means $STYLE"

mkdir -p "$WORKDIR"
WORKDIR=$(cd "$WORKDIR" && pwd)
PHOTO=$(cd "$(dirname "$PHOTO")" && pwd)/$(basename "$PHOTO")
RUN="$WORKDIR/$STYLE"
TARGETS="$WORKDIR/targets"
GAL="$WORKDIR/gallery/$STYLE"
PHOTO_PLAN="$WORKDIR/photo_${PLAN_W}x${PLAN_H}.png"
TARGET_PLAN="$TARGETS/${STYLE}_${PLAN_W}x${PLAN_H}.png"
mkdir -p "$RUN" "$TARGETS" "$GAL"

TOTAL_START=$SECONDS
STEP_START=$SECONDS
TIMINGS=""
step() {
    STEP_START=$SECONDS
    echo
    echo "== $* ($(date +%H:%M:%S))"
}
done_step() {
    local t=$((SECONDS - STEP_START))
    TIMINGS="${TIMINGS}${1}: ${t}s"$'\n'
    echo "   $1 took ${t}s"
}

# ---------------------------------------------------------------- 1. prerequisites
step "prerequisites"
[[ -x "$PY" ]] || { echo "error: no python at $PY. Run $PIPELINE_DIR/setup.sh"; exit 1; }
"$PY" -c "import cv2, numpy, skimage, PIL" 2>/dev/null || {
    echo "error: the venv misses the requirements. Run $PIPELINE_DIR/setup.sh"; exit 1; }
command -v node >/dev/null || { echo "error: node not found"; exit 1; }
command -v ffmpeg >/dev/null || { echo "error: ffmpeg not found"; exit 1; }
if [[ ! -d "$TOOLS_DIR/node_modules/puppeteer-core" ]]; then
    echo "   npm install in $TOOLS_DIR"
    (cd "$TOOLS_DIR" && npm install --silent)
fi
if [[ ! -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]] && ! command -v google-chrome >/dev/null; then
    echo "error: Google Chrome not found (render.mjs needs it)"; exit 1
fi
echo "   python $("$PY" -V 2>&1 | cut -d' ' -f2), node $(node -v), ffmpeg ok, chrome ok"
echo "   photo   $PHOTO"
echo "   style   $STYLE"
echo "   workdir $WORKDIR"
done_step prerequisites

# ---------------------------------------------------------------- 2. photo in plan space
step "resize the photo to ${PLAN_W}x${PLAN_H}"
"$PY" - "$PHOTO" "$PHOTO_PLAN" "$PLAN_W" "$PLAN_H" <<'PY'
import sys
from PIL import Image
src, dst, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert("RGB")
sw, sh = im.size
# centre crop to the plan aspect, then resize
want = w / h
have = sw / sh
if abs(have - want) > 1e-3:
    if have > want:
        nw = int(round(sh * want)); box = ((sw - nw) // 2, 0, (sw - nw) // 2 + nw, sh)
    else:
        nh = int(round(sw / want)); box = (0, (sh - nh) // 2, sw, (sh - nh) // 2 + nh)
    im = im.crop(box)
    print("   centre-cropped %dx%d -> %dx%d" % (sw, sh, im.size[0], im.size[1]))
im.resize((w, h), Image.LANCZOS).save(dst)
print("   %s (%dx%d)" % (dst, w, h))
PY
done_step photo-resize

# ---------------------------------------------------------------- 3. style target
# the newest target image for this style, whatever name it came under
find_raw_target() {
    local newest="" f
    for f in "$TARGETS/${STYLE}_2k.raw.png" "$TARGETS/${STYLE}_2k.raw.jpg" \
             "$TARGETS/${STYLE}_2k.png" "$TARGETS/${STYLE}_2k.jpg" \
             "$TARGETS/${STYLE}.raw.png" "$TARGETS/${STYLE}.raw.jpg"; do
        [[ -f "$f" ]] || continue
        if [[ -z "$newest" || "$f" -nt "$newest" ]]; then newest="$f"; fi
    done
    [[ -n "$newest" ]] || return 1
    echo "$newest"
}

step "style target ($STYLE)"
RAW_TARGET=""
TARGET_MODEL="supplied"
if [[ "$STYLE" == crayon ]]; then
    # crayon traces a finished drawing: the input image is the target, and no
    # model runs. --skip-target has nothing to skip here.
    cp "$PHOTO_PLAN" "$TARGET_PLAN"
    TARGET_MODEL="none (the drawing is the target)"
    echo "   the drawing is the target: $TARGET_PLAN"
    [[ $SKIP_TARGET -eq 0 ]] || echo "   --skip-target: crayon never asks for a target anyway"
elif [[ $SKIP_TARGET -eq 1 ]]; then
    if [[ -f "$TARGET_PLAN" ]]; then
        echo "   --skip-target: using $TARGET_PLAN"
    elif RAW_TARGET=$(find_raw_target); then
        echo "   --skip-target: using $RAW_TARGET"
    else
        echo "error: --skip-target but no target found."
        echo "       Put the 2K target at $TARGETS/${STYLE}_2k.raw.png (or .raw.jpg),"
        echo "       or a plan-space one at $TARGET_PLAN."
        exit 1
    fi
else
    [[ -n "${GEMINI_API_KEY:-}" ]] || { echo "error: GEMINI_API_KEY is not set (or pass --skip-target)"; exit 1; }
    echo "   asking $PRO_MODEL for a 2K $STYLE target"
    if "$PY" "$PIPELINE_DIR/stylize_gemini.py" --photo "$PHOTO" --out "$TARGETS" \
            --styles "$STYLE" --model "$PRO_MODEL" --size 2K --suffix _2k; then
        TARGET_MODEL="$PRO_MODEL"
    else
        echo "   the Pro call failed, falling back to $FALLBACK_MODEL"
        "$PY" "$PIPELINE_DIR/stylize_gemini.py" --photo "$PHOTO" --out "$TARGETS" \
            --styles "$STYLE" --model "$FALLBACK_MODEL" --suffix _2k
        TARGET_MODEL="$FALLBACK_MODEL"
    fi
    RAW_TARGET=$(find_raw_target) || { echo "error: Gemini returned no image"; exit 1; }
    echo "   target $RAW_TARGET"
fi
if [[ -n "$RAW_TARGET" ]]; then
    "$PY" - "$RAW_TARGET" "$TARGET_PLAN" "$PLAN_W" "$PLAN_H" <<'PY'
import sys
from PIL import Image
src, dst, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert("RGB")
print("   %s %dx%d -> %dx%d" % (src.rsplit("/", 1)[-1], im.size[0], im.size[1], w, h))
im.resize((w, h), Image.LANCZOS).save(dst)
PY
fi
done_step style-target

# ---------------------------------------------------------------- 4. direction
step "direction json"
DIRECTION="$RUN/direction.json"
"$PY" "$PIPELINE_DIR/make_direction.py" --style "$STYLE" --target "$TARGET_PLAN" \
    --reference "$PHOTO_PLAN" --out "$DIRECTION" \
    ${MAX_STROKES:+--max-strokes "$MAX_STROKES"} ${SEED:+--seed "$SEED"} \
    ${REGIONS:+--regions "$REGIONS"}
done_step direction

# ---------------------------------------------------------------- 5. the strokes
step "painter2 (the stroke placer)"
"$PY" "$TOOLS_DIR/painter2.py" --direction "$DIRECTION" --out "$RUN"
done_step painter2

# ---------------------------------------------------------------- 6. render
step "render.mjs (Chrome, scale 2, progressive video frames)"
if [[ "$STYLE" == crayon ]]; then
    # the hand's own pace, sped up 10 times, with the crayon tip in every frame
    node "$TOOLS_DIR/render.mjs" --actions "$RUN/actions.json" --out "$RUN/render" \
        --width "$PLAN_W" --height "$PLAN_H" --ref "$PHOTO_PLAN" \
        --scale 2 --frame-scale 1 --video progressive \
        --pace travel --lapse 10 --cursor crayon --seconds 150 --fps 30
else
    node "$TOOLS_DIR/render.mjs" --actions "$RUN/actions.json" --out "$RUN/render" \
        --width "$PLAN_W" --height "$PLAN_H" --ref "$PHOTO_PLAN" \
        --scale 2 --frame-scale 1 --video progressive --seconds 90 --fps 10 --pace size
fi
done_step render

# ---------------------------------------------------------------- 7. video
step "video (30 fps, 3 s hold)"
bash "$TOOLS_DIR/video.sh" "$RUN/render" "$RUN/painting.mp4" 30 3
done_step video

# ---------------------------------------------------------------- 8. quality
step "quality vs the target and vs the photo"
mkdir -p "$RUN/q_target" "$RUN/q_photo"
"$PY" "$TOOLS_DIR/quality.py" --ref "$TARGET_PLAN" --img "$RUN/render/final.png" \
    --regions "$DIRECTION" --out "$RUN/q_target" > "$RUN/q_target/quality.txt"
echo "   vs the target:"; sed -n '1,5p' "$RUN/q_target/quality.txt" | sed 's/^/   /'
"$PY" "$TOOLS_DIR/quality.py" --ref "$PHOTO_PLAN" --img "$RUN/render/final.png" \
    --out "$RUN/q_photo" > "$RUN/q_photo/quality.txt"
echo "   vs the photo:"; sed -n '1,5p' "$RUN/q_photo/quality.txt" | sed 's/^/   /'
done_step quality

# ---------------------------------------------------------------- 9. judge
step "Gemini judge"
if [[ "$NO_JUDGE" == 1 ]]; then
    echo "   --no-judge: skipping the judge"
elif [[ -n "${GEMINI_API_KEY:-}" ]]; then
    [[ "$STYLE" != crayon ]] || echo "   crayon: the drawing goes in as both the photo and the target"
    if "$PY" "$PIPELINE_DIR/judge_gemini.py" --painting "$RUN/render/final.png" \
            --photo "$PHOTO_PLAN" --target "$TARGET_PLAN" --out "$RUN/judge" >/dev/null; then
        "$PY" -c "import json,sys; j=json.load(open(sys.argv[1])); print('   ', {k:v for k,v in j.items() if k!='problems'})" "$RUN/judge/scores.json"
    else
        echo "   the judge failed; going on without it"
    fi
else
    echo "   GEMINI_API_KEY is not set; skipping the judge"
fi
done_step judge

# ---------------------------------------------------------------- 10. gallery folder
step "gallery folder"
"$PY" - "$RUN/render/final.png" "$GAL/final.jpg" "$PLAN_W" "$PLAN_H" <<'PY'
import sys
from PIL import Image
src, dst, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
Image.open(src).convert("RGB").resize((w, h), Image.LANCZOS).save(dst, quality=92, subsampling=0)
print("   final.jpg %dx%d q92" % (w, h))
PY
cp "$RUN/render/final.png" "$GAL/final.png"
cp "$RUN/painting.mp4" "$GAL/painting.mp4"
cp "$RUN/poster.jpg" "$GAL/poster.jpg"   # video.sh writes it beside the mp4

TOTAL=$((SECONDS - TOTAL_START))
printf '%s' "$TIMINGS" > "$RUN/timings.txt"
STYLE="$STYLE" TARGET_MODEL="$TARGET_MODEL" TOTAL="$TOTAL" \
"$PY" - "$RUN" "$GAL" "$PHOTO" "$TARGET_PLAN" <<'PY'
import json, os, sys, time
run, gal, photo, target = sys.argv[1:5]
style = os.environ["STYLE"]


def read(path, default=None):
    try:
        with open(path) as fh:
            return json.load(fh)
    except Exception:
        return default


report = read(os.path.join(run, "report.json"), {})
qt = read(os.path.join(run, "q_target", "metrics.json"), {})
qp = read(os.path.join(run, "q_photo", "metrics.json"), {})
judge = read(os.path.join(run, "judge", "scores.json"))
timings = ""
try:
    with open(os.path.join(run, "timings.txt")) as fh:
        timings = fh.read()
except Exception:
    pass

scores = {
    "style": style,
    "made": time.strftime("%Y-%m-%d %H:%M:%S"),
    "photo": os.path.basename(photo),
    "target": os.path.basename(target),
    "target_model": os.environ.get("TARGET_MODEL"),
    "canvas": report.get("canvas"),
    "seed": report.get("seed"),
    "actions": report.get("actions"),
    "strokes": report.get("strokes"),
    "tools": report.get("tools"),
    "painter_seconds": round(report.get("seconds", 0), 1),
    "total_seconds": int(os.environ["TOTAL"]),
    "q_vs_target": {k: qt.get(k) for k in ("q", "ms_ssim", "gms", "delta_e_mean")},
    "q_vs_photo": {k: qp.get(k) for k in ("q", "ms_ssim", "gms", "delta_e_mean")},
    "judge": judge,
}
with open(os.path.join(gal, "scores.json"), "w") as fh:
    json.dump(scores, fh, indent=2)


def num(x, fmt="%.6f"):
    return fmt % x if isinstance(x, (int, float)) else "-"


lines = [
    "%s painting  (%s)" % (style, scores["made"]),
    "photo        %s" % scores["photo"],
    "target       %s   (%s)" % (scores["target"], scores["target_model"]),
    "canvas       %s   seed %s" % (scores["canvas"], scores["seed"]),
    "strokes      %s kept of %s actions   tools: %s" % (
        scores["strokes"], scores["actions"], ", ".join(report.get("tools", []) or [])),
    "",
    "Q vs target  %s   (MS-SSIM %s, GMS %s, Lab dE %s)" % (
        num(qt.get("q")), num(qt.get("ms_ssim"), "%.4f"), num(qt.get("gms"), "%.4f"), num(qt.get("delta_e_mean"), "%.2f")),
    "Q vs photo   %s   (MS-SSIM %s, GMS %s, Lab dE %s)" % (
        num(qp.get("q")), num(qp.get("ms_ssim"), "%.4f"), num(qp.get("gms"), "%.4f"), num(qp.get("delta_e_mean"), "%.2f")),
    "             lower Q is better",
    "",
]
if judge:
    lines.append("judge (Gemini, 1-10)")
    for k in ("likeness_to_photo", "painterly_craft", "faithfulness_to_target_style", "overall"):
        if k in judge:
            lines.append("  %-30s %s" % (k, judge[k]))
    for i, p in enumerate(judge.get("problems", []), 1):
        loc = p.get("location", {})
        lines.append("  problem %d at (%.2f, %.2f): %s" % (i, loc.get("x", 0), loc.get("y", 0), p.get("issue", "")))
        lines.append("            fix: %s" % p.get("fix", ""))
else:
    lines.append("judge        not run")
lines += ["", "timings", "  " + timings.strip().replace("\n", "\n  "),
          "  total: %ss" % scores["total_seconds"], ""]
with open(os.path.join(gal, "summary.txt"), "w") as fh:
    fh.write("\n".join(lines) + "\n")
print("   %s" % os.path.join(gal, "summary.txt"))
PY
ls -la "$GAL"
done_step gallery

FRAMES_SIZE=$(du -sh "$RUN/render/frames" 2>/dev/null | cut -f1 || true)
if [[ $TIDY -eq 1 ]]; then
    rm -rf "$RUN/render/frames"
    echo "   removed the video frames (${FRAMES_SIZE:-0})"
elif [[ -n "$FRAMES_SIZE" ]]; then
    echo "   the video frames take $FRAMES_SIZE. Remove them with: rm -rf $RUN/render/frames"
fi

echo
echo "== done in $((SECONDS - TOTAL_START))s"
printf '%s' "$TIMINGS"
echo "gallery folder: $GAL"
echo "look at:  $GAL/final.jpg   $RUN/error.png   $RUN/report.txt   $GAL/summary.txt"
