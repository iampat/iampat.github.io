# Episode 2 visual language: "Why the Best Players Look Slow"

Read with `docs/KIT.md` and `docs/CONCEPT-2.md`. These are the director's rules for this episode.

## The three views

| View | Use | How |
| --- | --- | --- |
| **Pitch (side)** | Story beats on the floodlit pitch: Sam passes, Tavi receives, Chalk chases. Same look as episode 1 (`Sky`, `Stands`, `Floodlight`, `GroundSide`, or the `stadium-off` plate with SVG lamps). | The goal is on the RIGHT. Sam (the passer) stands LEFT, behind Tavi, so in the cold open Tavi faces Sam with her back to the goal (`flip` on, facing left). Chalk chases in from the right (`flip` on). After the half-turn Tavi stands side-on; the side view can only hint at that, so cut to the map for it. |
| **Map (top-down)** | Anything about seeing, space and time: scans, vision cones, where Chalk is, the touch into space. | `TopField` + `TopPlayer` tokens + `TimeBubble`. Pitch x along screen x, +y up. Keep tokens at least 44 px; zoom the camera in rather than shrinking them. |
| **X-ray (teal ink)** | The first-touch collision close-up, the eye/head for reaction time. | `XRayGrid`, `XRayLeg`, `Ball`, `Arrow`, `Readout`. Same palette rules as episode 1. |

## The motif: the time bubble

- The bubble is honest: `secondsToReach(distance to Chalk)` with `CLOSING_SPEED = 4` m/s (a
  jog-to-run), so the spoken rule holds: every two metres is about half a second. Never use
  top speed. Show the number when it matters.
- Colour carries the feeling: pink is panic, amber is tight, lime is calm. Never fake it.
- Cold open: Tavi's bubble reads about 0.6 s. Ending: the same pass reads about 2.4 s.
- Each chapter ends with the bubble growing on screen as its skill is applied (LOOK: the
  bubble appears before the ball arrives; TOUCH: the touch into space grows it; SHAPE: the
  half-turn keeps it).

## Scans and the mental map

- A scan is a head turn away from the ball: `TopPlayer look` in the map view, `headTurn` in
  the side view. It takes about 8-10 frames and returns.
- Each scan pops a `Snapshot` (polaroid) that flies into Tavi's `ThoughtBubble` map. Before
  scanning the bubble shows `UnknownFog` (question marks). After two scans the map shows
  Chalk and the free space as dots.
- Vision: a wide dim cone (about 180-200 degrees) is what the eyes cover; a narrow bright
  wedge is where detail is. Use `VisionFan` from `src/kit/Vision.tsx`.

## The touch

- The bounce-off-the-shin mistake: `receiveStiff`, the ball rebounds away with the trail.
- The soft touch: `receiveSoft`, the foot moves back with the ball for a few frames, the ball
  stays within a stride. Use `firstTouch` so the outgoing speed is real.
- The touch into space: side by side, the "dead stop" (ball under the feet, Chalk arrives)
  versus the "touch away" (2-3 m into space, bubble grows). Every metre ≈ 0.2 s: show a
  ruler with seconds under it once.

## Shape

- Top-down: Tavi square to Sam (cone covers Sam, Chalk hidden behind) versus half-turned
  (cone covers Sam and the goal). Draw the hidden half of the pitch dark.
- Side view can only hint at the half-turn (a small body twist); prefer the map view.

## Research-driven rules (from research/ep2-result.json)

- Name populations: pro numbers say "pro players" on screen (a small caption is enough).
- Scanning is a small edge that repeats many times a game: never draw it as the cause of a
  goal, draw it as the reason Tavi is early.
- Reaction time for this audience: about a third of a second to see something new, about
  half a second to choose. Show the two-part stopwatch if the script uses it.
- The first touch is a physics demonstration, not a measured soccer result. No percentages on
  screen for the bounce. The stiff foot returns "maybe a third" of the pass speed.
- Staging: Sam is BEHIND Tavi (Tavi's back to the goal). A square receiver needs a full turn
  (about half a second in youth run-and-turn tests). Half-turned, Sam is in the corner of one
  eye and the goal side in the other; the look still does the knowing.
- A scan is a snapshot, not a stare: the head turns away and back in about 0.4 s and the eyes
  do not stop. Animate it that way (about 12 frames out and back).

## Characters

- **Tavi**: as episode 1. Face `focus` when scanning, `wince` on the bounce, `happy` at the end.
- **Sam**: `Player colors={SAM_COLORS}`, calm, always the passer. In the map: `kind="sam"`.
- **Chalk**: chasing all episode. Side view: `runA`/`runB` with `flip`, `puffed` when he
  arrives late. Map: `kind="chalk"`, `stride`. He never speaks. One raised eyebrow when beaten.

## Pacing and sound

- New visual every 3-5 s, eased camera, idle motion, pops with overshoot, exits faster than
  entrances. No hard snaps.
- SFX: `tick` on each scan snapshot, `pop-soft` when a dot lands on the map, `thump` on
  touches, `whoosh` on Chalk's arrival, `blip` for jokes, `bell` on the bubble reveal.
- Music tracks: `look`, `touch`, `shape`, `steal`, plus `open`, `practice`, `ending` from
  episode 1. Chapter names in the storyboard must contain "Look", "Touch", "Shape", "Steal"
  or "Bonus", and practice scenes must contain "practice".
