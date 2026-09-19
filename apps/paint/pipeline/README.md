# The v4 painting pipeline

One photo goes in. A painting, a process video and a score sheet come out. No
agent runs in the loop. A Python placer puts every stroke with the paint app's
own tools, and the app renders the strokes in Chrome.

The photo never enters this repo. It lives in a work dir that git ignores. Every
path in the pipeline comes from an argument.

Four styles paint a photo. The fifth, `crayon`, traces a finished crayon
drawing and needs no model at all. See "Crayon" below.

## Files

| File | What it is |
| --- | --- |
| `paint.sh` | The runner. One image, one style, one command. |
| `setup.sh` | Makes the venv, installs the requirements, checks Chrome and ffmpeg. |
| `PAINTER_SPEC.md` | The contract: the tools, the placer, the metric Q, the judge, the run order. |
| `make_direction.py` | Builds a runnable `direction.json` from a style template and a regions file. |
| `directions/*.json` | The five style templates: layers, ground colour, metric weights. No shapes. |
| `regions/*.json` | The shapes for one photo: region masks and flow curves. |
| `stylize_gemini.py` | Asks Gemini for the style target of a photo. |
| `judge_gemini.py` | Asks Gemini to score a finished painting 1 to 10. |
| `grid_overlay.py` | Draws a coordinate grid, and your regions, over a photo. |

The tools the runner calls are in `../tools`: `painter2.py` (the placer),
`quality.py` (the metric), `render.mjs` (Chrome), `video.sh` (ffmpeg),
`compare.py` (a colour check by cell).

A style template holds no shapes, and a regions file holds no style. The four
painting styles share one set of shapes per photo. `make_direction.py` joins
them: it reads `"regions_file"` from the template, or the file you pass with
`--regions`.

`crayon` is the fifth template and it works the other way round. Its layers
trace the marks of the target, so it needs no shapes of its own. It sets
`"border_frac"` in place of `"regions_file"`, and `make_direction.py` builds
`all`, `main` and `border` from the canvas. See "Crayon" below.

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

The style is `oil`, `watercolor`, `pencil`, `sketch` or `crayon`, in American
spelling. `paint.sh` also takes `watercolour`, `graphite`, `coloured pencil`,
`crayons` and `wax` and maps them to those five, and says which one it used. Any
other word stops the run. The first four paint a photo. `crayon` traces a
finished crayon drawing, and the section after the timings covers it.

Options: `--max-strokes N` for a quick look, `--seed N`, `--no-judge` to skip
the Gemini judge (then Nano Banana is the only model call), `--skip-target` when
you already have a target image, `--tidy`, and `--log FILE`.
`--max-strokes 3000` suits the four painting styles. crayon needs 18600 or more:
see "The stroke budget" below. With
`--skip-target`, put the target at `<workdir>/targets/<style>_2k.raw.png`
(`.raw.jpg` also works), or a plan-space one at
`<workdir>/targets/<style>_1440x1920.png`. A crayon run with `--no-judge` calls
no model at all.

`--log` sends every line of the run to the file, so one `&` runs it in the
background and the terminal stays free:

```sh
apps/paint/pipeline/paint.sh apps/paint/work/lake/portrait.jpg oil \
    apps/paint/work/lake --log apps/paint/work/lake/oil.log &
tail -f apps/paint/work/lake/oil.log
```

The log ends with `== done in <N>s`.

A run writes 901 video frames at 1440 x 1920, near 1.5 GB. A crayon run paces
its own frames and writes its own number: near 2450 at full size, and 7.2 GB,
because a crayon frame carries more ink than a painting frame. The mp4 does
not need them after the encode. `--tidy` removes them at the end, and a run without it
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

## Crayon: trace a finished drawing

The four painting styles start from a photo and a style target that Gemini
makes. `crayon` starts from a finished crayon drawing, and gives back a
stroke-by-stroke reproduction of it, plus a video with the crayon tip moving
over the paper.

```sh
apps/paint/pipeline/paint.sh apps/paint/work/mah/drawing.jpeg crayon \
    apps/paint/work/mah --log apps/paint/work/mah/crayon.log &
```

The drawing is the target and the reference, so no model runs. `paint.sh` copies
the resized input to `targets/crayon_1440x1920.png` and makes no Gemini call.
`--skip-target` does nothing here. The judge runs only when `GEMINI_API_KEY` is
set and `--no-judge` is absent, and it then sees the drawing as both the photo
and the target. `Q vs target` and `Q vs photo` are the same number, because both
compare the reproduction with the drawing.

crayon needs no regions file. `directions/crayon.json` sets `"border_frac"`,
and `make_direction.py` builds `all`, `main` and `border` from the canvas.
`"border_frac"` is the width of the border ring, as a fraction of the shorter
canvas side. 0.095 fits a drawing with a drawn frame around the picture. Set it
to 0 for a drawing with no frame: `main` is then the whole sheet, and the border
layer places nothing.

The video comes from `--pace travel --lapse 10 --cursor crayon --seconds 150
--fps 30`. Each stroke takes the time a hand needs to draw it, sped up 10 times,
and the crayon tip rides the live end of the stroke. `--seconds` only caps the
result. The frame count follows the length of the stroke paths, so it lands
under the nominal 4500 (150 s at 30 fps). The full run writes 2453 frames, a
4000-stroke run 525 and a 3000-stroke run 392. `paint.sh` passes these flags for
crayon and the size pacing for the other four.

### The stroke budget

`--max-strokes` caps the whole run. The placer walks the layer list in order and
stops there, so a low cap drops the late layers. It does not thin each layer.
A trace layer keeps exactly its `count`, so the cumulative column says where any
cap lands. Q is the value at the end of that layer, read from `report.txt`.
Every number here is measured, on the published drawing.

| Layer | `count` | Cumulative | Q after | What it adds |
| --- | --- | --- | --- | --- |
| sketch-lines | 600 | 600 | 0.61 | the construction lines |
| light-colors | 3000 | 3600 | 0.56 | the pale fills |
| mid-colors | 6000 | 9600 | 0.45 | the colour starts to read |
| dark-colors | 5000 | 14600 | 0.37 | the darks |
| outlines | 1800 | 16400 | 0.34 | the second outline pass |
| border | 2200 | 18600 | 0.26 | the frame |
| details | 2500 | 21100 | 0.25 | the small marks |

The four painting styles iterate at `--max-strokes 3000`. For crayon that cap
stops 2400 strokes into `light-colors`. It gives the outline pass and part of
the pale fill: no mid tones, no darks, no second outline pass, no frame, no
details. Q is 0.57 and the judge scores it 2 of 10. That is not a fast look at
the drawing. It is a different, unfinished picture.

- 9600 is the smallest cap that shows the colour. It still has no darks and no
  frame.
- 18600 is the first honest look, because it ends with the border ring.
- 21100, or no `--max-strokes` at all, is the result.

`make_direction.py` prints where the cap lands, with this same cumulative list,
in the `direction json` step of every crayon run. Change a `count` in
`directions/crayon.json` and the printed numbers follow it.

Timings on an idle M-series Mac, measured:

| Step | `--max-strokes 3000` | `--max-strokes 18600` | 21100 strokes (full) |
| --- | --- | --- | --- |
| placer | 28 s | 3 min | 4 to 6 min |
| render in Chrome | 38 s | 3.75 min | about 4 min |
| video | 2 s | 9 s | 10 to 15 s |
| quality | 1 s | 1 s | 4 s |
| one run, end to end | 70 s | 7 min | 8 to 11 min |

A busy machine adds half again to the placer. The spread in the table is the
load, not the direction.

The frames are the disk cost, and they grow with the ink on the sheet. The full
run writes about 2450 frames and 7.2 GB. An 18600-stroke run writes 2315 frames
and 6.8 GB, a 4000-stroke run 525 frames and 800 MB, and a 3000-stroke run 392
frames and 525 MB. `--tidy` removes them after the encode.

The levers, per layer:

- `count`: the strokes that colour group may keep. The seven layers carry
  21100 strokes in all. `--max-strokes` cuts the run at that total, so a small
  cap stops in the middle of the list and the late layers place nothing.
- `pressure`: 0.4 for the first construction lines, 1.0 for the outlines. It
  scales the darkness rule, so a low value leaves a pale line.
- `size`: `[min, max]` in plan pixels. The distance transform of the pigment
  picks the size inside that range, mark by mark.
- `paper_tol`: the Lab dE that separates pigment from paper, for the whole
  direction. Raise it when the paper grain of the input becomes strokes. Lower
  it when a faint mark is missed.

Every key a trace layer uses, all in `PAINTER_SPEC.md`. The first two rows sit
on the direction, the rest on the layer:

| Key | What it does |
| --- | --- |
| `"paper"` | the paper hex. Left out, the placer measures it. |
| `"paper_tol"` | Lab dE from the paper that counts as pigment (default 8) |
| `"mode": "trace"` | follow the marks of the target, not its tones |
| `"tool"` | the stroke tool. Every crayon layer uses `"crayon"`. |
| `"region"` | where the layer may draw: `main` inside the frame, `border` the ring, `all` the sheet. `make_direction.py` builds the three from `border_frac`. |
| `"size"` | `[min, max]` in plan pixels. The distance transform of the pigment picks the size inside that range, mark by mark. |
| `"count"` | the strokes the layer may keep. A trace layer keeps all of them. |
| `"threshold"` | the smallest gain in Q that keeps a stroke. 0 keeps every stroke, which is what the colour layers want. |
| `"color_group"` | `{"lightness": [lo, hi]}`, `{"hue": [lo, hi]}` or `{"outline": true}` |
| `"group_slack"` | how far a stroke colour may sit outside its group, in L (default 8). Raise it when a layer drops many strokes, lower it to keep the groups apart. |
| `"pressure"` | one number scales the darkness rule by p / 0.7. A `[lo, hi]` pair maps the darkness into that range instead. |
| `"alpha"` | `[min, max]` opacity |
| `"length"` | `[min, max]` path length, in multiples of `size` |
| `"curvature"` | 0 to 1, how far the path may bend away from the flow |
| `"drift"` | how far the target colour may move along the path, in Lab dE, before the stroke stops. Small drift keeps the marks short and clean. |
| `"candidates"` | strokes tried per seed. More is slower and slightly better. |
| `"order": "sweep"` | reorder the layer so the crayon travels a short way |

`value`, `saturation` and `jitter` work in a trace layer too, the same way as in
a painting layer.

The crayon tool has two constants that live in two files:
`CRAYON_DEPOSIT` (0.28, the wax one pass lays) and `CRAYON_SOFT` (0.30, the
smoothstep half width against the paper tooth). They sit in
`../engine.js` and in `../tools/crayon_np.py`. They must stay equal. Change one
alone and the placer plans one picture while Chrome draws another.

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
| crayon | 0.57, an unfinished picture | 0.25 |

A full run is the default 15000 cap for the four painting styles, and 21100
strokes for crayon. A 3000-stroke run of a painting style scores 0.03 to 0.14
worse. That is the budget, not a fault in the direction. Another photo moves the
whole column.

crayon is the odd row. 3000 strokes buy it two of its seven layers, so 0.57
measures a different picture, not a rougher one. Compare a crayon run only with
another at 18600 or more. "The stroke budget" above has the numbers.

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

A crayon layer takes a different set, because it traces instead of paints. The
main levers are `count`, `pressure`, `size`, `color_group` and `order`, plus
`paper_tol` for the whole direction. The key table under "Crayon" above lists
every key a trace layer uses, `region`, `threshold`, `group_slack`, `length`,
`drift` and `candidates` included.

Order matters. The list runs from the background to the details, and coarse to
fine inside a layer. A late layer paints over an early one.

Run with `--max-strokes 3000` while you iterate. It shows the same shape of the
picture in about half the time, and the Q numbers land higher. Judge the change,
not the number: compare the new 3000-stroke run with the last 3000-stroke run.

That holds for the four painting styles. crayon is the exception: 3000 strokes
stop in the second of its seven layers, so the run shows no mid tones, no darks
and no frame at all. Iterate a crayon layer at 18600 and read "The stroke
budget" above.

## A new photo

The shapes belong to one photo. A new photo needs a new regions file, for the
four painting styles. Run one of them with the lake portrait's shapes and the
sky layer paints over the new face. `crayon` is the exception: its layers follow
the marks of the drawing, so it needs no regions file and no work here.

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
6. Point the templates at the new file: set `"regions_file"` in the four
   painting templates in `directions/`, or pass `--regions` through
   `make_direction.py`. `directions/crayon.json` has no `"regions_file"`.

Loose shapes are fine. They are masks for the layer order, and the placer never
draws them.

## Rules

- Never commit the photo, the work dir or anything made from the photo, except
  the gallery files you choose to publish.
- Never put an absolute path in a file in this repo.
- The same direction and the same seed give the same `actions.json`. A new
  Gemini target changes the direction, so use `--skip-target` to repeat a run.
  A crayon run repeats by itself: its target is the input, so nothing moves
  between two runs of the same drawing.
