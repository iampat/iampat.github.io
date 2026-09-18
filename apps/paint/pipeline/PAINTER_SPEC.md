# Painter v4 contract

Goal: a portrait painted stroke by stroke with the paint app's tools, at a quality a person would call a painting,
built cheaply: a Python stroke placer driven by an art-direction json, with NO agent in the loop at run time.

Paths here use three variables, so nothing in this file is tied to one machine:
  $APP   = apps/paint in the repo. This file is $APP/pipeline/PAINTER_SPEC.md.
  $WORK  = a git-ignored work dir you choose, the third argument of paint.sh (for example $APP/work/lake).
  $VENV  = the python venv setup.sh makes, $APP/work/venv by default.
The photo NEVER enters the repo: it lives in $WORK and is referenced by argument only.

  $APP/engine.js, $APP/paint.js, $APP/index.html   the app: tools, actions, the canvas
  $APP/tools/render.mjs        renders an actions.json in Chrome, writes final.png, frames and checkpoints
  $APP/tools/painter2.py       the stroke placer (Part B)
  $APP/tools/quality.py        the metric Q (Part C), importable and CLI
  $APP/tools/compare.py        a per-cell colour comparison, for eyeballing
  $APP/tools/video.sh          frames -> mp4 + poster
  $APP/pipeline/paint.sh       the end-to-end runner: every path below comes from its arguments
  $APP/pipeline/directions/    the four style templates (layers, ground, metric; no shapes)
  $APP/pipeline/regions/       the region and flow shapes, one file per photo
  $APP/pipeline/stylize_gemini.py, judge_gemini.py   the two Gemini calls (Part D)
  $WORK/photo_1440x1920.png    the reference photo (LIKENESS truth only)
  $WORK/targets/<style>_1440x1920.png   the STYLE TARGET. Colours, edges and marks come from here.
  $WORK/<style>/direction.json the art direction paint.sh builds for the run
  $VENV/bin/python             opencv-python-headless, numpy, scikit-image, pillow (setup.sh makes it)
Plan space is 1440 x 1920 (the direction json says so). The final render uses --scale 2 (2880 x 3840).

## Hard rules (from the director)
1. EVERYTHING is painted with tools. No `poly`, no `ellipse`, no `bucket` actions anywhere in the output. Coverage comes
   from wide strokes. Features (eyes, mouth) come from fine strokes like everything else.
2. Stroke quality is judged on the WHOLE PICTURE, never on a patch. The score of a candidate stroke is the change of the
   full-canvas metric Q (below). Because Q is an average of windowed terms, that change is exactly zero outside the
   stroke's bounding box padded by the metric's window, so it may be computed incrementally on the padded box; the
   result must equal the full-canvas recomputation (assert this on a few strokes per layer in a self-test, tolerance 1e-6).
   Plain patch error (mean dE in the stroke box) is NOT an acceptable score.
3. Strokes have orientation and curvature from the image: an edge-tangent flow field (ETF) computed from the target's
   structure tensor at the scale of the current brush. Never "horizontal"/"vertical" presets, except where the director
   asks for a bias (a flow name or an angle is a bias mixed with the ETF, weight in the json).
4. Human order: layers as the director lists them (background to details, big brushes to small). Inside a layer, brushes
   go coarse to fine (a Laplacian pyramid of the target: one brush size per level).
5. One colour per stroke, taken from the target blurred to the level's scale at the stroke's seed, then adjusted by
   the layer's value/saturation options. A stroke STOPS when the blurred target colour under its path drifts from the
   stroke colour by more than the layer's `drift` (Lab dE), or when it leaves the region mask (+overflow), or at max length.
6. Deterministic: numpy Generator seeded from seed + layer + level. Same json -> same actions.json.
7. Budget: at most `max_strokes` total (default 15000) and at most `count` per layer level; no minimum. Speed target:
   15000 strokes at 1440x1920 in under 6 minutes on this machine.

## Part A: engine tools  ($APP/engine.js, $APP/paint.js, $APP/index.html)
Two stroke tools, deterministic, on top of brush, bristle, pencil and spray:
- "flat": a flat brush. Stamps a rounded rectangle (width = size, length = size*0.35, rotated to the path tangent)
  every size*0.2 px along the path, hard edge with 1 px anti-aliased softness; the colour varies along the stroke by a
  small deterministic ripple (+-4% value, PRNG per action index) so the mark reads as paint; slight edge darkening
  (2% at the two long edges). Composited once with alpha like every stroke.
- "knife": a palette-knife mark: a wide, short, straight-ish smear: the path is followed but the stamp is a
  parallelogram of width size and length size*0.6 with a hard leading edge and a gradient across (lighter by 6% on one
  side, darker by 6% on the other), one stamp every size*0.5 px.
The UI gets both tools in the toolbar. render.mjs validation accepts them. Old tools unchanged (byte-identical renders
of any plan that does not use them, before and after: verify with cmp).
render.mjs: new flags `--width W --height H` for the plan size (default 720 x 960); the page canvas becomes W*scale x
H*scale; h.W/h.H follow; frames are (W*frameScale) x (H*frameScale). Progressive pacing: new flag `--pace size` makes a
stroke's time share = path length * sqrt(size) so big marks are slow and fine marks fast (default: `--pace length`, the
current rule). compare.py: compare at the reference image's own size (resize the painting to it), so 1440x1920 works.

## Part B: $APP/tools/painter2.py  (the placer)
  $VENV/bin/python $APP/tools/painter2.py --direction <json> --out <run dir> [--seed 7] [--max-strokes N]
Outputs in <run>: actions.json, preview.png (numpy render, plan size), report.json + report.txt (per layer and per
level: tried, kept, Q before/after, seconds; totals; Q vs target and vs photo), error.png (per-pixel contribution to Q).

Direction json
{
  "canvas": [1440, 1920], "target": "...png", "reference": "...png", "seed": 7, "max_strokes": 15000,
  "ground": "#hex" | "auto",                       (one wide flat-brush pass in this colour over the whole canvas, no clear except white)
  "metric": {"ms_ssim": 0.5, "gradient": 0.3, "color": 0.2},   weights of Q (see Part C)
  "regions": { name: {"poly": [[x,y],...]} | {"polys": [...]} | {"rect": [x0,y0,x1,y1]} | {..., "minus": [names]} },
     loose shapes by the director, ONLY used as masks for layer order; never drawn.
  "flows": { name: {"curves": [[[x,y],...], ...]} },   optional bias fields
  "layers": [ {
     "name": "...", "region": "...", "overflow": px,
     "tool": "flat" | "knife" | "brush" | "bristle" | "pencil" | "spray",
     "levels": [ {"size": 48, "count": 400, "threshold": 0.004}, {"size": 24, "count": 800, ...}, ... ]
         one entry per pyramid level, coarse to fine. threshold = min improvement of Q for a stroke to be kept
         (0 = keep any improvement). count = max strokes at that level.
     "alpha": [min,max], "length": [min,max] as multiples of size (default [2, 6]), "curvature": 0..1,
     "drift": dE (default 12), "flow": name, "flow_weight": 0..1 (default 0.3 when a flow is named), "angle": deg, "angle_weight",
     "value": -0.2..0.2, "saturation": -0.3..0.3, "candidates": 12 (per stroke), "jitter": 0..1
  } ]
}
Algorithm per layer, per level:
  1. Level target T_l = target blurred with sigma = size/2 (Gaussian), Lab. ETF_l from the structure tensor of T_l
     (sigma = size/2, then smoothed); a per-pixel unit tangent.
  2. Error map E = per-pixel contribution to Q between the current canvas and the target (see Part C), blurred with
     sigma = size/2, masked by the region. Seeds are drawn from E with probability proportional to E (importance sampling,
     deterministic rng), at least size*0.4 apart from seeds already used at this level (a spacing mask).
  3. For each seed: build `candidates` strokes: seed +- size*0.3, angle = ETF tangent +- 12 deg (mixed with the bias),
     length in the range, size * (0.85..1.15), colour = T_l at the seed (Lab) +- 3 L, alpha in range; the path is a
     streamline of ETF (Catmull-Rom smoothed, 6..14 points) that stops on drift, mask, or length.
  4. Render each candidate on a copy of the padded box, compute delta Q exactly (Part C), keep the best; accept only if
     delta Q >= threshold. Emit the action. Every 500 strokes, log Q recomputed on the full canvas.
  5. Stop the level at `count` kept strokes, or when 50 consecutive seeds fail.
numpy renderer: implement brush, pencil, bristle, spray (as in v3, close to engine.js) plus flat and knife exactly as
Part A defines them (share constants).

## Part C: quality metric  ($APP/tools/quality.py, importable and CLI)
  $VENV/bin/python $APP/tools/quality.py --ref <png> --img <png> [--regions direction.json] --out <dir>
Q = w1 * (1 - MS-SSIM(gray, 3 scales)) + w2 * GMS (gradient magnitude dissimilarity, 1 - mean similarity of Sobel
magnitudes, on gray) + w3 * (mean Lab dE / 100).  Lower is better. All three terms are averages of per-pixel windowed
terms, so the per-pixel contribution map exists (used as error.png and as the seed map) and a change confined to a box
changes Q only inside the box padded by (window radius * 2^scales + 2). quality.py prints the three terms and Q, writes
metrics.json, and with --regions also prints per-region colour histogram distance (Lab, 16 bins, chi-square) and per-region Q.
painter2.py imports the same functions so the placer and the report agree.

## Part D: Gemini judge  ($APP/pipeline/judge_gemini.py, uses env GEMINI_API_KEY, model gemini-2.5-flash or newer text+vision model)
  python judge_gemini.py --painting <png> --photo <png> --target <png> --out <dir>
Sends the three images with a fixed prompt (saved to <out>/prompt.txt) asking for scores 1-10 on likeness to the photo,
painterly craft, and overall, plus the three biggest problems with approximate locations; saves the raw response and
a parsed scores.json. Never send anything but these images.

## Part E: the run (what paint.sh does, in order)
  $APP/pipeline/paint.sh <photo.jpg> <style> $WORK [--max-strokes N] [--seed N] [--skip-target] [--tidy] [--log FILE]
  <style> is oil, watercolor, pencil or sketch. <photo.jpg> and $WORK are independent paths.
  R = $WORK/<style>
  1  check node, Chrome, ffmpeg, the venv and the node modules
  2  resize the photo (centre crop to 3:4) -> $WORK/photo_1440x1920.png
  3  stylize_gemini.py --photo <photo.jpg> --out $WORK/targets --styles <style> --size 2K   (skipped by --skip-target)
     and resize the answer -> $WORK/targets/<style>_1440x1920.png
  4  make_direction.py --style <style> --target <target> --reference <photo> --out R/direction.json
  5  $VENV/bin/python $APP/tools/painter2.py --direction R/direction.json --out R
  6  node $APP/tools/render.mjs --actions R/actions.json --out R/render --width 1440 --height 1920 --ref $WORK/photo_1440x1920.png --video progressive --seconds 90 --fps 10 --pace size --scale 2 --frame-scale 1
  7  bash $APP/tools/video.sh R/render R/painting.mp4 30 3
  8  $VENV/bin/python $APP/tools/quality.py --ref <target> --img R/render/final.png --regions R/direction.json --out R/q_target
     $VENV/bin/python $APP/tools/quality.py --ref $WORK/photo_1440x1920.png --img R/render/final.png --out R/q_photo
  9  $VENV/bin/python $APP/pipeline/judge_gemini.py --painting R/render/final.png --photo $WORK/photo_1440x1920.png --target <target> --out R/judge
  10 $WORK/gallery/<style>/ : final.jpg (1440x1920 q92), final.png, painting.mp4, poster.jpg, scores.json, summary.txt
  optional, for eyeballing colour: $VENV/bin/python $APP/tools/compare.py --ref <target> --img R/render/final.png --out R/cmp
Checks: no poly/ellipse/bucket in actions.json; preview.png and render/final.png (downscaled) agree; the Q assert
self-test passes; the video shows strokes growing; report.txt readable; painter2 under 10 minutes at the 15000 cap
(measured on an M-series Mac: oil 5-6 min, sketch 5 min, watercolor 6.5 min, pencil 9 min).
