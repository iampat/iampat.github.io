---
name: paint-portrait
description: Paint a portrait photo stroke by stroke in the paint app, in one of four styles named oil, watercolor, pencil or sketch, with the process video, and package the result for the gallery. Use when the user asks to paint or repaint a photo with the v4 pipeline, to tune a style direction, to add a new photo, or to publish a painting to apps/paint/gallery.
---

# Paint a portrait

The pipeline is `apps/paint/pipeline`. It takes one photo and one style and
gives back a painting, a video of the strokes, quality numbers and a judge
score. No agent paints. A Python placer puts every stroke, and Chrome renders
them with the paint app's own engine.

`apps/paint/pipeline/README.md` has the details, and
`apps/paint/pipeline/PAINTER_SPEC.md` has the contract. Open them when a step
below is not enough.

## 1. Check the machine

```sh
apps/paint/pipeline/setup.sh
```

It makes the venv at `apps/paint/work/venv`, installs
`apps/paint/tools/requirements.txt`, runs `npm install` in `apps/paint/tools`
and checks Google Chrome and ffmpeg. Run it again any time. It is quick when
everything is in place.

The style target and the judge call Gemini. Check `GEMINI_API_KEY` in the
environment. Without it, the run needs `--skip-target` and a target image the
user supplies, and it skips the judge.

## 2. The photo

The photo can sit anywhere the shell can read. Git ignores `apps/paint/work/`,
so that is the easy place:

```sh
mkdir -p apps/paint/work/lake
# the user copies the photo to apps/paint/work/lake/portrait.jpg,
# or names a path outside the repo. Either works.
```

The photo path and the run's `<workdir>` are two separate arguments of
`paint.sh`. They may be the same folder, and they do not have to be. Nothing
reads the photo's folder: step 3 copies the photo into plan space under
`<workdir>` and works from there.

Privacy rule, no exceptions:

- Never copy the photo into a tracked folder.
- Never write its absolute path into a file in the repo.
- Never commit `apps/paint/work/` or anything in it.
- The only pictures of the person that may be committed are the gallery files
  the user picks, in step 6.
- The photo does go to Gemini, twice: once for the style target and once for the
  judge. Say so before the first run if the user has not used the pipeline.

## 3. One run, one command

```sh
apps/paint/pipeline/paint.sh <photo.jpg> <style> <workdir>
```

The style word is `oil`, `watercolor`, `pencil` or `sketch`. Type one of those
four, in American spelling. `paint.sh` also accepts `watercolour`, `graphite`
and `coloured pencil` and maps them to the four, and it prints which one it
used. Any other word stops the run.

Options: `--max-strokes N` (use 3000 while you iterate), `--seed N`, `--tidy`
(removes the 1.5 GB of video frames at the end), `--log FILE`, and
`--skip-target` when a target image is already at
`<workdir>/targets/<style>_2k.raw.png` (or `.raw.jpg`, or a plan-space one at
`<workdir>/targets/<style>_1440x1920.png`).

The script prints each step and its time. It asks Gemini for a 2K target with
`gemini-3-pro-image-preview` and falls back to `gemini-2.5-flash-image` when the
Pro call fails. For all four styles, run it four times. The target step is per
style, so the four runs share only the photo.

Run it in the background with `--log` and watch that file. `--log` sends every
line to the file, so `&` is enough and the terminal stays free:

```sh
apps/paint/pipeline/paint.sh <photo.jpg> oil apps/paint/work/lake \
    --log apps/paint/work/lake/oil.log &
tail -f apps/paint/work/lake/oil.log
```

The log ends with `== done in <N>s`. A run takes 6 to 12 minutes. See step 7.

## 4. Look at the result

Everything lands in `<workdir>/gallery/<style>/` and `<workdir>/<style>/`:

| Look at | Tells you |
| --- | --- |
| `gallery/<style>/summary.txt` | strokes, both Q numbers, the judge, the timings |
| `gallery/<style>/final.jpg` | the painting. Open it. |
| `<style>/error.png` | where the picture is still wrong. Bright is bad. |
| `<style>/report.txt` | strokes and Q per layer and per level, and the seconds |
| `<style>/judge/scores.json` | 1 to 10 on likeness, craft and style, plus three problems |

`Q vs target` is the picture against the style target. `Q vs photo` is the
likeness. Lower is better.

Q depends on the style and on the stroke budget, so compare a run only with a
run of the same style at the same budget. These are the measured numbers for the
published portrait:

| Style | Q vs target, `--max-strokes 3000` | Q vs target, full run |
| --- | --- | --- |
| oil | 0.33 | 0.30 |
| watercolor | 0.32 to 0.34 | 0.20 |
| pencil | - | 0.25 |
| sketch | 0.26 | 0.24 |

A full run is the default 15000 cap. A 3000-stroke run scores worse everywhere,
by 0.03 to 0.14. That is the budget, not a mistake. Another photo shifts the
whole column.

Two runs of the same style at the same budget still differ by about 0.02,
because Gemini paints a new style target each time. Only `--skip-target` holds
the target still. A layer that spends many seconds for a Q change under 0.001 is
wasted work.

Read the judge's problems with the picture open. The judge is opinionated about
craft and blunt about a tiled or repeated background.

## 5. Iterate on the direction

The art direction of a run is `<workdir>/<style>/direction.json`, built from
`apps/paint/pipeline/directions/<style>.json` plus a regions file. Change the
template, not the generated file, or the next run loses the change.

The levers, per layer: `levels` (`size`, `count`, `threshold`), `tool` (`flat`,
`knife`, `brush`, `bristle`, `pencil`, `spray`), `alpha`, `length`, `curvature`,
`drift`, `value`, `saturation`, `flow` with `flow_weight`, `angle` with
`angle_weight`, `region` with `overflow`, `jitter`, `candidates`, and
`photo_mix` when the target loses the likeness. The README explains each one.

How to work:

1. Change one layer.
2. Run again with `--max-strokes 3000` into a fresh workdir, or the same one.
3. Compare `summary.txt` and `final.jpg` against the last run.
4. Keep the change when Q drops and the picture looks better. The numbers alone
   do not decide it.

Layers run in order, background to details, coarse to fine. A late layer paints
over an early one. Weak marks usually mean the level size is too small for the
region, or `count` runs out before the region is covered.

## 6. Publish to the gallery

The gallery is `apps/paint/gallery`. `index.html` shows v4, `previous.html`
shows v1 to v3. For each style you publish:

1. Copy the files, with the style as the key:
   ```sh
   cp <workdir>/gallery/oil/final.jpg   apps/paint/gallery/v4/oil.jpg
   cp <workdir>/gallery/oil/painting.mp4 apps/paint/gallery/v4/oil.mp4
   cp <workdir>/gallery/oil/poster.jpg  apps/paint/gallery/v4/oil.poster.jpg
   ```
   `final.jpg` is 1440 x 1920 at q92, and the mp4 is 30 fps with a 3 second
   hold. Do not commit `final.png`: it is 2880 x 3840 and far too big.
2. Add or change the item in `apps/paint/gallery/gallery.json`:
   ```json
   {"version": "v4", "key": "oil", "title": "Oil",
    "note": "one line about how it was made",
    "image": "v4/oil.jpg", "video": "v4/oil.mp4",
    "poster": "v4/oil.poster.jpg", "ready": true}
   ```
3. Copy the whole file into the fallback block of `index.html`, inside
   `<script type="application/json" id="gallery-data">`. The page reads
   `gallery.json` over http and the inline copy over `file://`. The two must
   match, or the page shows different things in the two cases. `previous.html`
   carries the same full copy, and each page picks its versions with the
   `data-versions` attribute. Paste the new `gallery.json` into both pages.
4. Check the page: open `apps/paint/gallery/index.html` in the browser, and
   check it again over http. Every card must show its image, and its video must
   play.

Keep the note short and true. It says what made the picture, not how nice it is.

## 7. Timings on an M-series Mac

Measured, not guessed. The placer owns the run, and its time changes with the
style. A style with many small marks, pencil most of all, takes half again to
twice as long as oil at the same cap.

| Step | 3000 strokes | 15000 strokes (full) |
| --- | --- | --- |
| target from Gemini | 20 to 30 s | same |
| placer, oil | 3 min | 5 to 6 min |
| placer, sketch | 2.5 min | 5 min |
| placer, watercolor | 3.5 to 4 min | 6.5 min |
| placer, pencil | 4 min | 9 min |
| render in Chrome | 60 to 90 s | 90 to 120 s |
| video | 3 to 5 s | 5 to 10 s |
| quality | 2 s | 2 s |
| judge | 10 to 20 s | 10 to 20 s |
| **one run, end to end** | **5.5 to 8 min** | **8 to 12 min** |

The Gemini steps carry the network, so the target and the judge can take longer
than the table on a slow link. Everything else is local and steady.

Four styles at full size take 40 to 50 minutes. Start them one after the other
in the background, each with its own `--log`, and check the logs.

## 8. A new photo

The region shapes belong to one photo. A new photo needs a new regions file in
`apps/paint/pipeline/regions/`. The README has the full steps. In short:

1. Get `photo_1440x1920.png` in the work dir (step 2 of any run makes it).
2. `apps/paint/work/venv/bin/python apps/paint/pipeline/grid_overlay.py --image
   <work>/photo_1440x1920.png --out <work>/grid.png` and read the coordinates
   off the grid. Use the venv python: the script needs opencv.
3. Copy `regions/portrait_at_the_lake.json` and move the points. Keep the names.
   The templates name them: `sky`, `mtn_left`, `mtn_right`, `headland`, `water`,
   `water_visible`, `sky_visible`, `neck`, `sweater`, `hair`, `hair_left`,
   `hair_right`, `hair_core`, `hair_all`, `face`, `face_skin`, `eyes`, `mouth`,
   `sunglasses`, `figure`, `all`.
4. Landmarks that matter: the face oval from the hairline to the chin,
   `face_skin` as the face minus the eyes and the mouth, one hair curtain on each
   side plus `hair_core` for the dark mass, the sweater silhouette with the
   shoulders, and the horizon that splits the sky from the water.
5. Check them: `grid_overlay.py --image ... --regions ... --flows --out
   <work>/regions.png`, with `--crop x0 y0 x1 y1` for the face and
   `--only <names>` for one group. Open the png and look at it.
6. Draw the flow curves: `hair` down the curtains from the crown, `sweater` along
   the folds. Five to eight curves each.
7. Point the templates at the file with `"regions_file"`, or pass `--regions`.

Loose shapes are fine. They are masks for the layer order. Nothing draws them.

## Rules

- Never commit the photo or the work dir.
- Never write an absolute path into a file in the repo.
- Same direction plus same seed gives the same `actions.json`. When a rerun
  differs, something in the inputs changed. The usual cause is the style target:
  Gemini makes a new one on every run. Pass `--skip-target` to reuse the one in
  `<workdir>/targets/`.
- Commit only when the user asks.
