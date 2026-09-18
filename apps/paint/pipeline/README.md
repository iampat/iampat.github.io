# The v4 painting pipeline

One photo goes in. A painting, a process video and a score sheet come out. No
agent runs in the loop. A Python placer puts every stroke with the paint app's
own tools, and the app renders the strokes in Chrome.

The photo never enters this repo. It lives in a work dir that git ignores. Every
path in the pipeline comes from an argument.

## Files

| File | What it is |
| --- | --- |
| `paint.sh` | The runner. One photo, one style, one command. |
| `setup.sh` | Makes the venv, installs the requirements, checks Chrome and ffmpeg. |
| `PAINTER_SPEC.md` | The contract: the tools, the placer, the metric Q, the judge, the run order. |
| `make_direction.py` | Builds a runnable `direction.json` from a style template and a regions file. |
| `directions/*.json` | The four style templates: layers, ground colour, metric weights. No shapes. |
| `regions/*.json` | The shapes for one photo: region masks and flow curves. |
| `stylize_gemini.py` | Asks Gemini for the style target of a photo. |
| `judge_gemini.py` | Asks Gemini to score a finished painting 1 to 10. |
| `grid_overlay.py` | Draws a coordinate grid, and your regions, over a photo. |

The tools the runner calls are in `../tools`: `painter2.py` (the placer),
`quality.py` (the metric), `render.mjs` (Chrome), `video.sh` (ffmpeg),
`compare.py` (a colour check by cell).

A style template holds no shapes, and a regions file holds no style. The four
styles share one set of shapes per photo. `make_direction.py` joins them: it
reads `"regions_file"` from the template, or the file you pass with `--regions`.

## Setup

```sh
apps/paint/pipeline/setup.sh            # venv at apps/paint/work/venv
apps/paint/pipeline/setup.sh /path/venv # or your own venv
```

It needs python3, node, npm, Google Chrome and ffmpeg. It is safe to run again.
For the style target and the judge, set `GEMINI_API_KEY` in your shell.

## Run

```sh
mkdir -p apps/paint/work/lake
cp ~/Pictures/portrait.jpg apps/paint/work/lake/     # git ignores work/
apps/paint/pipeline/paint.sh apps/paint/work/lake/portrait.jpg oil apps/paint/work/lake
```

The three arguments are the photo, the style and the work dir, in that order.
The photo and the work dir are independent: the photo may sit anywhere the shell
can read, inside the work dir or outside the repo. The run writes only under the
work dir.

The style is `oil`, `watercolor`, `pencil` or `sketch`, in American spelling.
`paint.sh` also takes `watercolour`, `graphite` and `coloured pencil` and maps
them to those four, and says which one it used. Any other word stops the run.

Options: `--max-strokes N` for a quick look, `--seed N`, `--no-judge` to skip the Gemini judge (then Nano Banana is the only model call), `--skip-target`
when you already have a target image, `--tidy`, and `--log FILE`. With
`--skip-target`, put the target at `<workdir>/targets/<style>_2k.raw.png`
(`.raw.jpg` also works), or a plan-space one at
`<workdir>/targets/<style>_1440x1920.png`.

`--log` sends every line of the run to the file, so one `&` runs it in the
background and the terminal stays free:

```sh
apps/paint/pipeline/paint.sh apps/paint/work/lake/portrait.jpg oil \
    apps/paint/work/lake --log apps/paint/work/lake/oil.log &
tail -f apps/paint/work/lake/oil.log
```

The log ends with `== done in <N>s`.

A run writes 901 video frames at 1440 x 1920, near 1.5 GB. The mp4 does not need
them after the encode. `--tidy` removes them at the end, and a run without it
prints the command that removes them.

What comes out, under the work dir:

```
photo_1440x1920.png            the photo in plan space
targets/oil_2k.raw.png         what Gemini sent back
targets/oil_1440x1920.png      the target the placer copies
oil/direction.json             the art direction of this run
oil/actions.json               every stroke, in the app's action format
oil/report.txt                 strokes and Q per layer and per level
oil/report.json                the same report as json
oil/timings.txt                the seconds each step took
oil/preview.png                the placer's own render, before Chrome
oil/error.png                  where the picture is still wrong
oil/render/final.png           2880 x 3840
oil/painting.mp4, poster.jpg
oil/q_target/, oil/q_photo/    the metric against the target and the photo
oil/judge/scores.json          the Gemini judge
gallery/oil/                   final.jpg, final.png, painting.mp4, poster.jpg,
                               scores.json, summary.txt
```

`gallery/<style>/scores.json` holds the whole run in one file: the photo and
target names, the model that made the target, the stroke counts, both Q blocks
and the judge. `summary.txt` says the same in plain text.

Timings on an M-series Mac, measured. The placer owns the run, and its time
changes with the style: small marks and many `candidates` cost more search per
stroke, so pencil takes almost twice as long as oil at the same cap.

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
| one run, end to end | 5.5 to 8 min | 8 to 12 min |

The target and the judge go over the network, so a slow link makes those two
longer than the table. Every other step is local and steady. Each run writes its
own numbers to `<style>/timings.txt`.

## Iterate on a direction

Open `gallery/<style>/summary.txt` first. `Q vs target` is the picture against
the style target, and `Q vs photo` is the likeness. Lower is better. Then look at
`final.jpg`, at `error.png` (bright means wrong) and at the judge's three
problems.

Q has no absolute pass mark. It moves with the style and with the stroke budget,
so a run compares only with a run of the same style at the same budget. The
measured numbers for the published portrait:

| Style | Q vs target, `--max-strokes 3000` | Q vs target, full run |
| --- | --- | --- |
| oil | 0.33 | 0.30 |
| watercolor | 0.32 to 0.34 | 0.20 |
| pencil | - | 0.25 |
| sketch | 0.26 | 0.24 |

A full run is the default 15000 cap. A 3000-stroke run of the same direction
scores 0.03 to 0.14 worse. That is the budget, not a fault in the direction.
Another photo moves the whole column.

Two runs of one style at one budget still differ by about 0.02, because Gemini
makes a new style target every run. `--skip-target` reuses the target already in
`<workdir>/targets/` and holds that variable still.

To change the painting, change the layer in `directions/<style>.json` and run
again. The levers, per layer:

- `levels`: `size` is the brush width in plan pixels, `count` is the stroke
  budget at that size, `threshold` is the smallest gain in Q that keeps a stroke.
  More levels make the layer finer. Cut `count` to make it faster.
- `tool`: `flat` and `knife` are paint, `brush` is soft, `bristle` is dry,
  `pencil` is a line, `spray` is grain.
- `alpha`: `[min, max]` opacity. Low alpha builds the colour in layers.
- `length` and `curvature`: the mark shape, as multiples of `size`.
- `drift`: how far the target colour can move under a stroke, in Lab dE, before
  the stroke stops. Small drift keeps edges. Large drift makes long marks.
- `value` and `saturation`: push the layer lighter, darker or stronger.
- `flow` plus `flow_weight`, or `angle` plus `angle_weight`: bias the stroke
  direction away from the image flow. The hair and the sweater use this.
- `region` and `overflow`: where the layer may paint, and how far past the edge.
- `jitter` and `candidates`: how much the seeds move, and how many strokes the
  placer tries per seed. More candidates is slower and slightly better.
- `photo_mix` on a layer takes the colour from the photo, not the target, when
  the target loses the likeness.

Order matters. The list runs from the background to the details, and coarse to
fine inside a layer. A late layer paints over an early one.

Run with `--max-strokes 3000` while you iterate. It shows the same shape of the
picture in about half the time, and the Q numbers land higher. Judge the change,
not the number: compare the new 3000-stroke run with the last 3000-stroke run.

## A new photo

The shapes belong to one photo. A new photo needs a new regions file.

1. Put the photo in the work dir and run once with `--skip-target` and a target
   you supply, or let step 3 make one. You only need `photo_1440x1920.png` from
   the run, so you can stop it after step 2.
2. Draw the grid: `$VENV/bin/python grid_overlay.py --image
   <work>/photo_1440x1920.png --out <work>/grid.png`. Every label is a
   plan-space coordinate. `$VENV` is the venv setup.sh made, because the script
   needs opencv.
3. Copy `regions/portrait_at_the_lake.json` to `regions/<your_photo>.json` and
   move the points. Read the coordinates off the grid. Keep the names: the
   templates name them. The set is `sky`, `mtn_left`, `mtn_right`, `headland`,
   `water`, `water_visible`, `sky_visible`, `neck`, `sweater`, `hair`,
   `hair_left`, `hair_right`, `hair_core`, `hair_all`, `face`, `face_skin`,
   `eyes`, `mouth`, `sunglasses`, `figure`, `all`.
4. Check the shapes: `$VENV/bin/python grid_overlay.py --image <work>/photo_1440x1920.png
   --regions regions/<your_photo>.json --flows --out <work>/regions.png`. Use
   `--crop x0 y0 x1 y1` to work on the face, and `--only face eyes mouth` to see
   one group.
5. Draw the flows: `hair` follows the curtains of hair from the crown down,
   `sweater` follows the folds. Five to eight curves each is enough.
6. Point the templates at the new file: set `"regions_file"` in each
   `directions/*.json`, or pass `--regions` through `make_direction.py`.

Loose shapes are fine. They are masks for the layer order, and the placer never
draws them.

## Rules

- Never commit the photo, the work dir or anything made from the photo, except
  the gallery files you choose to publish.
- Never put an absolute path in a file in this repo.
- The same direction and the same seed give the same `actions.json`. A new
  Gemini target changes the direction, so use `--skip-target` to repeat a run.
