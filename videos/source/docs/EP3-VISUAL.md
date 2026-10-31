# Episode 3 visual language: "The Player Who Gives Boxes Away"

Read with `docs/KIT.md` and `docs/CONCEPT-3.md`. The storyboard is `script/ep3/storyboard.json`.
Scene ids are `c01`..`c20`; scenes live in `src/scenes/ep3/`, one file each, exported as `C01` etc.,
and registered in your own `src/scenes/ep3/reg-<range>.ts`. Shared parts you need and nobody else
has go in `src/kit/ext/ep3-<range>-*.tsx`. Never edit `src/kit/**` shared files; ask the lead.

## The three views

| View | Use | How |
| --- | --- | --- |
| **Bench (side)** | Story beats: Tavi on the bench, Chalk sitting on the concrete, faces, the eyebrow, lights on and off. | `BenchSide` (src/kit/ep3/World.tsx) wraps the episode 2 `NightWorld` with a concrete apron and the dugout bench. Children are in world pixels: `X(metres)`, `GROUND`. `TaviOnBench` (sitBench / sitLean poses, boot off, ice pack, chalk stub), `ChalkOnFloor` (sitFloor / drawFloor poses, flip on so he faces her), `BoardEdge` (the board edge-on). Default camera `BENCH_CAM` (zoom 2.4 on the bench); push in to 3-3.5 for faces. |
| **Concrete (top)** | Every board scene. | `ConcreteTop` (dark concrete, a warm light pool, specks) and the `DotsBoard` centred at about (960, 560), size 560-640 px. `ScoreTags` top left. Word cards, stamps and readouts around the board, never over it. |
| **Teal ink (X-ray)** | c16 (the one-sentence rule) and c19 (the computer). | `XRayGrid` background with the board drawn in chalk on it, as the episode 1 and 2 physics views. |

## The board

- `DotsBoard` draws itself from a game and cue frames: `moveFrames[k]` is the frame where move k
  (0-based) starts, each line takes `drawFrames` (9) to draw, box marks pop when the line lands.
  Compute `moveFrames` from cues (`cue("phrase")`) and spread moves evenly between cues.
- Games: `GAMES.g1` (Tavi first, greedy, 3-6), `GAMES.g5` (Chalk first, both perfect, 6-3),
  `GAMES.g3` (the eat-all branch from g5 after move 18; pass `start={boardAfter(GAMES.g5, 18)}`).
  Helpers in `src/kit/ep3/dots.ts`: `boardAfter`, `safeLines`, `captureLines`, `chains`, `score`,
  `chainSummary`, `lineId`. Every line on screen must come from these games. Never invent a move.
- Colours: Tavi's lines and rings teal (`PITCH.teal`), Chalk's lines and crosses chalk white. Safe
  lines as dashed lime ghosts (`highlights: [{ lines, color: XRAY.lime, dashed: true }]`). A chain
  that is a gift fills soft orange (`PITCH.accent`, opacity 0.22) with a small chalk bow drawn on
  it (3 strokes). A box about to be given away blinks pink (`XRAY.pink`).
- Chalk digits in boxes: `boxText={{ "01": "3" }}` (key is row+column).
- A line is drawn by a hand: in the top view a small chalk stub (teal for Tavi, white for Chalk)
  slides along the line as it draws, then lifts away. Keep it simple: a rounded rectangle.
- The safe-line `Readout` (top right): the number of safe lines left, lime; pink at 0.

## Motifs

- **The two-halves bar** (`TwoHalvesBar`, src/kit/ep3): under the board, lime then orange,
  the gap mark where the safe lines run out (g1: 14 moves, g5: 16). Draw it on with `progress`,
  light it with `fill`.
- **The present**: a chalk box with a bow, drawn as a `ChalkSketch`-style stroke set. It slides
  between the players: whoever holds it has to give. Appears in c03, c10, c12.
- **The turn arrow**: a small chalk arrow between the two chalk stubs showing whose turn it is.
- **The eyebrow**: Chalk's face `smug` (first eyebrow, c02), `thinking` (c18 'And you stop'),
  `surprised` with the eyebrow high and held (c18 'It stays up').

## Staging

- Bench view: Tavi LEFT on the bench facing right, Chalk RIGHT on the concrete facing left (flip).
  The board lies between them on the concrete, seen edge-on. Goal far right as in episode 2.
- Top view: Tavi's side is the bottom of the frame, Chalk's side is the top. Her chalk stub enters
  from the bottom, his finger from the top.
- Chalk never speaks. He looks up at the floodlights (`look` and a tilt) when he is not looking at
  the board. He draws with one mitten finger (drawFloor pose in the side view).

## Pacing and sound

- New visual every 3-5 s, eased camera (never more than 10% push), idle motion, pops with
  overshoot, exits faster than entrances. No hard snaps except the one in c02 'Then he draws one
  line' (a hold, then the crosses).
- SFX names: `chalk` on every drawn line, `thump` on every box mark, `tick` on counts and dots,
  `pop-soft` on small labels, `blip` on jokes and the eyebrow, `bell` on reveals, `subdrop` on
  'None' and the strike-through, `stamp` on stamps, `light-on` / `light-off` on the floodlights.
- Music is chosen by chapter name in `src/Main.tsx` (third, twos, count, steal, practice, open,
  ending). Nothing to do in scenes.

## Checking a scene

- `npx tsc --noEmit`
- `npx remotion still src/index.ts S-c05 out/review/c05-a.png --frame=<n> --browser-executable=/opt/pw-browsers/chromium`
  Check 3-4 frames spread over the scene, and look at them.
- Timings are estimated until the narration is recorded (`src/timeline.ep3.json` has
  `estimated: true` on every scene). Key everything to `useCues`, never to seconds, so the real
  audio drops in later with no scene changes.
