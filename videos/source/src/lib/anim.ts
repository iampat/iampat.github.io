// Motion helpers. Values from the style guide:
//   standard move: cubic-bezier(0.75, 0, 0.25, 1), about 25 frames at 30 fps
//   pop-in: spring (mass 1, stiffness 200, damping 16), about 12% overshoot
//   enter: decelerate cubic-bezier(0.05, 0.7, 0.1, 1), 12-15 frames
//   exit: accelerate cubic-bezier(0.3, 0, 0.8, 0.15), 6-9 frames (faster than entrances)
//   camera: easeInOutSine
// Ball flight is never eased: it follows the physics sim.

import { Easing, interpolate, spring } from "remotion";

export const FPS = 30;

export const EASE = {
  standard: Easing.bezier(0.75, 0, 0.25, 1),
  soft: Easing.bezier(0.333, 0, 0.667, 1),
  enter: Easing.bezier(0.05, 0.7, 0.1, 1),
  exit: Easing.bezier(0.3, 0, 0.8, 0.15),
  camera: Easing.bezier(0.37, 0, 0.63, 1),
  back: Easing.bezier(0.34, 1.56, 0.64, 1),
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0 -> 1 progress from frame `at` over `dur` frames with an easing. */
export const progress = (frame: number, at: number, dur = 25, ease: (t: number) => number = EASE.standard) =>
  interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** Move between keyframes: frames[i] -> values[i], eased between each pair. */
export const keys = (
  frame: number,
  frames: number[],
  values: number[],
  ease: (t: number) => number = EASE.standard,
) => interpolate(frame, frames, values, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** Spring pop 0 -> 1 (with overshoot) starting at frame `at`. */
export const pop = (frame: number, at: number, cfg: { stiffness?: number; damping?: number } = {}) =>
  frame < at
    ? 0
    : spring({ frame: frame - at, fps: FPS, config: { mass: 1, stiffness: cfg.stiffness ?? 200, damping: cfg.damping ?? 16 } });

/** Softer pop for small labels. */
export const popSoft = (frame: number, at: number) => pop(frame, at, { stiffness: 120, damping: 14 });

/** Appear at `at`, disappear at `until` (if given), with enter/exit easing. Returns 0..1. */
export const visible = (frame: number, at: number, until?: number, inDur = 12, outDur = 8) => {
  const i = progress(frame, at, inDur, EASE.enter);
  if (until === undefined) return i;
  return i * (1 - progress(frame, until, outDur, EASE.exit));
};

/** Idle secondary motion: a smooth loop, so nothing is ever fully still. */
export const idle = (frame: number, seed = 0, periodS = 3, amp = 1) =>
  Math.sin(((frame / FPS) * 2 * Math.PI) / periodS + seed * 1.7) * amp;

/** Draw-on for strokes: returns dash offset for a path of length `len`. */
export const drawOn = (frame: number, at: number, dur: number, len: number, ease = EASE.standard) =>
  len * (1 - progress(frame, at, dur, ease));
