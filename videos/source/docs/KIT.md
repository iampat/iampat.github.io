# Scene kit guide

How to build a scene for "Three Spins and a Line". Read this before you write a scene.

## Episodes

The project holds several videos. Each episode has its own storyboard (`script/<ep>/storyboard.json`),
narration (`public/vo/<ep>/`), timeline (`src/timeline.<ep>.json`) and scene folder.
Scene ids are unique across episodes (episode 1: `s01`..`s23`; episode 2: `b01`..). Compositions:
`Kicks-<ep>` for the whole video and `S-<id>` for one scene. Tools take `--ep <ep>`
(`tts.mjs`, `timeline.mjs`, `captions.mjs`) or the storyboard path (`lint-script.mjs`);
`tools/render.sh <ep> [--draft]` renders everything into `out/<ep>/`.

## Rules

- **One scene = one file**: `src/scenes/sNN.tsx`, exporting `const SNN: React.FC`. Register it in your own registry file `src/scenes/reg-<your scenes>.ts`. Only edit your own chapter file and your own scene files.
- **Reference scene**: `src/scenes/s01.tsx` shows the patterns: shots switched by frame, a camera in world pixels, a far background pinned to the horizon, flights from `SHOTS`, and SFX at cue frames.
- **Audio is the master clock.** Key every beat to the narration with `useCues(id)`:
  `const cue = useCues("s04"); const f = cue("the whip");` gives the scene frame where that phrase starts.
  A phrase that is not in the narration throws, so a script change fails loudly. Never hard-code seconds.
- **New visual every 3–5 s.** One new element per clause.
- **Cue timing facts.** `cue("phrase")` is the frame where the phrase's FIRST word starts (use `cue.wordEnd` for the last word). `visible(frame, at, until)` fades out from `until` to `until + 8` frames, so two tags scheduled back to back overlap unless the second starts at `until + 8`. `pop()` needs about 15 frames to reach full size, so start a pop a few frames before its word if it must be readable on the word. Kit pieces that call `useCurrentFrame` (TimeBubble, Snapshot, ThoughtBubble) cannot be driven from a frozen or remapped clock; place them by frame.
- **Style**: flat shapes, no outlines, rounded corners, and a limited palette per scene (`src/theme.ts`: `PITCH`, `SKY`, `XRAY`, `CAST`). Glows use `Glow` (concentric circles). Never use CSS `filter: blur` or `drop-shadow`, because they are slow in headless renders.
- **Motion**:
  - `progress` / `keys` with `EASE.standard` for moves, `pop` / `popSoft` for entrances.
  - Exits are faster than entrances (`visible(frame, at, until)`).
  - The camera uses `Camera` keys with `EASE.camera`, at most 5–15% push over 4–8 s. Never snap.
- **Nothing is ever still**: use `idle(frame, seed)` for small loops on idle elements.
- **Ball flight is never eased**: always use `Flight` with a shot from `src/physics/shots.ts`, or `useFlight(params)`. Slow motion uses `speed < 1` and must be visible as slow motion.
- **Text on screen** uses plain words only. The learn-words appear on a `WordCard` at their first use (see `learn_words` in `script/storyboard.json`).
- **No Kurzgesagt assets**: no birds, no logo, no Nexa font.

## Coordinates

- Frame is 1920×1080. `Stage` makes the SVG. `Camera` moves around a world point.
- World metres to screen pixels: `project(pos, view)` from `src/lib/project.ts`.
  - `{kind:"side", originX, groundY, ppm}`: x to the right, z up. The viewer stands on Tavi's right side.
  - `{kind:"top", originX, originY, ppm}`: x to the right, y (left) up the screen.
  - `{kind:"topUp", originX, originY, ppm}`: x up the screen (towards goal), y (left) to the left.
  - `{kind:"persp", cam, yawDeg, focal, cx, cy}`: yaw 0 is behind the kicker, 180 is the keeper's eyes.
- Physics axes: x towards goal, y = left, z = up. The right-footer's curler spins anticlockwise from above (+z) and bends left.

## Components (src/kit)

| Component | Use |
| --- | --- |
| `Stage`, `Camera`, `Parallax` (Camera.tsx) | SVG root, camera keys `{f,x,y,zoom}`, depth layers |
| `Plate` + `STADIUM_LAMPS`, `STADIUM_GROUND_Y` (Plate.tsx) | Nano Banana backdrops: `stadium-off`, `sky`. Put SVG lamp glows on the lamp centres. |
| `Sky`, `Stars`, `Glow`, `Floodlight`, `Stands`, `StandClock`, `GroundSide`, `PitchTop`, `Dust`, `CarPark` (World.tsx) | Night world in SVG. `StandClock hours={21}` means nine o'clock. `Dust` is a chalk puff. `Stands width={...}` for wide side cameras. |
| `Player` + `POSES`, `poseAt`, `mixPose`, `cyclePose`, `solve` (Player.tsx) | Tavi, side view, facing right. `poseAt(frame, [[f0,"plant"],[f1,"strike"],[f2,"follow"]])`. `cyclePose(frame, "walk"|"run", strideFrames)` gives a smooth cycle. Poses: stand, walk1/2, hold, ready, run1/2, plant, strike, follow, leanBack, inside, volley, chip, celebrate, shout, crouch (kneel), shrug. Faces: neutral, happy, shout, focus, wince, smug. `footTurn` for the inside foot. |
| `Keeper` + `KPOSES`, `keeperPoseAt` (Keeper.tsx) | Chalk, front view. Poses: stand, wide, ready, diveR, diveL, punchUp, shrug, tapHead, slump, crossed. `rise` 0..1 grows him out of the goal line. Faces: flat, smug, surprised, annoyed, thinking. |
| `Ball`, `linePoint` (Ball.tsx) | The orange ball and its Line. `axis` + `angle` show the true spin. `lineDraw` 0..1 animates drawing the line. `squash` for impact. Soft panel patches show in close-ups (r >= 40 px). |
| `Flight`, `useFlight`, `flightPoint` (Flight.tsx) | Simulated flight with a trail and an optional dashed ghost. `at` = kick frame. |
| `GoalSide`, `GoalFront`, `GoalTop` (Goal.tsx) | Goals in each view. |
| `AirFlow`, `spinPushDir` (AirFlow.tsx) | The Air Crowd around a spinning ball (top view). `rotate={90}` means the ball flies up the screen. |
| `XRayGrid`, `XRayLeg`, `AnkleLock` (XRay.tsx) | X-ray views. `XRayLeg` takes the same poses as Tavi. `highlight=["thigh"]` glows pink. |
| `Label`, `Text`, `Arrow`, `Readout`, `ChapterCard`, `WordCard`, `Stamp`, `PracticeBoard`, `Bubble`, `SlowMoTag`, `TitleCard` (Graphics.tsx) | On-screen graphics. `Stamp kind` is one of MISTAKE, FIX, DRILL or CUE. |
| `SHOTS`, `GOAL_DISTANCE` (src/physics/shots.ts) | Episode 1: every named flight from the storyboard, tested in `shots.test.ts`. Use these, do not invent launch values. |
| `PASS_IN`, `passInAt`, `passInPath`, `chalkAt`, `ringSeconds`, `TOUCHES`, `lookStepMeet`, `endingMeet`, `FOOT_E`, `TURN_TIME`, `FEINT`, `DRILLS` (src/physics/ep2sims.ts) | Episode 2: the pass in, Chalk's chase, every touch (with `FOOT_E` = 0.35), the receiver moves and the drills, tested in `ep2sims.test.ts`. Use these, do not invent values. |
| `TopPlayer`, `angleTo` (TopPlayer.tsx) | Top-down tokens for Tavi, Sam and Chalk with `facing`, a head `look` offset (a scan) and an optional vision `cone` `{angleDeg, radius}`. `stride` adds a run sway. |
| `TimeBubble`, `TimeBar`, `secondsToReach`, `bubbleColor`, `CLOSING_SPEED` (TimeBubble.tsx) | The episode 2 motif: a ring with the seconds until the defender arrives (`distance / 4`). Pink under 0.5 s, amber near 1 s, lime from 2 s. `squash` flattens it for side views; `labelPos` puts the readout above (default), below or at the centre. |
| `Snapshot`, `ThoughtBubble`, `UnknownFog` (Snapshot.tsx) | A polaroid frame that pops on each scan; a thought bubble anchored to a head that holds the player's mental map. |
| `VisionFan` (Vision.tsx) | Top-down eyes: a wide dim fan (`wideDeg`, about 190) and a narrow bright wedge (`sharpDeg`, about 10) around a head; `darkenOutside` dims what the player cannot see. |
| `TopField`, `PITCH_L`, `PITCH_W` (Field.tsx) | Any top-down part of the pitch (stripes and lines) in pitch metres: x along the pitch, y across. |
| `firstTouch`, `reboundFraction`, `rollPass`, `rollAt`, `rollDistance`, `timeToArrive`, `CHASE_SPEED`, `chaseDistance`, `bubbleSeconds` (src/physics/touch.ts) | First-touch collision (`v_out = v_foot - e (v_ball - v_foot)`), rolling ground passes with slowing on grass, and the chase: Chalk closes at `CHASE_SPEED` = 4 m/s, the bubble reads `distance / 4`. |
| `Player` extras | `colors={SAM_COLORS}` draws Sam. `headTurn` 0..1 turns the head to look back over the shoulder. New poses: receiveReady, receiveSoft, receiveStiff, lookBack, passInside. |
| `Keeper` extras | `flip` mirrors him. Poses runA/runB (chasing, alternate them with `keeperPoseAt`) and puffed. |
| `Sfx` (Sfx.tsx) | `<Sfx name="thump" at={f} />`. Names: thump, pop, pop-soft, tick, whoosh, whoosh-long, net, clang, light-on, light-off, chalk, stamp, blip, subdrop, bell, air, alarm. |

## Scene template

```tsx
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, Camera } from "../kit/Camera";
import { useCues } from "../lib/timing";
import { BACKGROUND } from "../theme";

export const S04: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s04");
  const whip = cue("the whip");
  return (
    <Stage bg={BACKGROUND["X-ray Physics"]}>
      <Camera keys={[{ f: 0, x: 960, y: 540, zoom: 1 }, { f: cue.frames, x: 980, y: 540, zoom: 1.06 }]}>
        {/* ... */}
      </Camera>
    </Stage>
  );
};
```

## Checking your scene

- `npx tsc --noEmit`
- `npx remotion still src/index.ts S-s04 out/review/s04-a.png --frame=<n>`: check 3–4 frames spread over the scene.
- `npx remotion render src/index.ts S-s04 out/review/s04.mp4 --scale=0.5`: a quick moving check with audio.
