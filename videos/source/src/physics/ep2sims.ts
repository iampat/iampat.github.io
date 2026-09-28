// Every named movement in episode 2 ("Why the Best Players Look Slow"), from the storyboard
// sims list (script/ep2/storyboard.json). ep2sims.test.ts checks the stated outcomes, so
// scenes and narration numbers share one source.
//
// Pitch frame: Tavi's mark is the origin, +x towards the goal (Chalk's side), Sam is behind
// Tavi at x = -12, +y = Tavi's left when facing the goal. Metres, seconds, m/s.

import { v3, type Vec3 } from "./sim";
import { CHASE_SPEED, firstTouch, rollAt, rollDistance, rollPass } from "./touch";

/** A real foot's limited mass: use this e for every touch demo, not the kit default 0.6. */
export const FOOT_E = 0.35;

export const SAM = v3(-12, 0, 0.11);
export const TAVI_MARK = v3(0, 0, 0);
export const CHALK_START = v3(10.9, -1.5, 0);

// ---- The pass in (used in the cold open, the look chapter and the ending) ----
export const PASS_IN = { speed: 6.5, from: SAM, decel: 0.8 };

/** Ball state on the PASS_IN line at time t: x position (pitch) and speed. */
export const passInAt = (t: number) => {
  const r = rollAt(PASS_IN.speed, t, PASS_IN.decel);
  return { x: SAM.x + r.x, y: 0, speed: r.v };
};

/** Time for the pass to reach pitch x (bisection on the closed form). */
export const passInTimeToX = (x: number) => {
  let lo = 0;
  let hi = PASS_IN.speed / PASS_IN.decel;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (passInAt(mid).x < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/** Sampled path of the pass in for a Flight/ball component (30 fps). */
export const passInPath = () => rollPass(PASS_IN.speed, 0, SAM, 5, PASS_IN.decel);

// ---- Chalk's chase: from CHALK_START towards a target at CHASE_SPEED, from t = 0 ----
export const chalkAt = (t: number, target: Vec3 = TAVI_MARK) => {
  const dx = target.x - CHALK_START.x;
  const dy = target.y - CHALK_START.y;
  const d = Math.hypot(dx, dy);
  const run = Math.min(d, CHASE_SPEED * t);
  return { x: CHALK_START.x + (dx / d) * run, y: CHALK_START.y + (dy / d) * run, remaining: d - run };
};

/** Seconds on the ring for a defender at (cx, cy) and a ball at (bx, by). */
export const ringSeconds = (cx: number, cy: number, bx: number, by: number) => Math.hypot(cx - bx, cy - by) / CHASE_SPEED;

// ---- Touches (all with FOOT_E) ----
const T = (ballVel: Vec3, footVel: Vec3, normal: Vec3, grip: number) => firstTouch({ ballVel, footVel, normal, e: FOOT_E, grip });

export const TOUCHES = {
  /** Cold open: locked ankle, the ball glances off the shin and away. */
  STIFF_BOUNCE: () => T(v3(4.8, 0, 0), v3(0, 0, 0), v3(-0.95, 0.31, 0), 0.8),
  /** Demo: still foot, straight on. */
  TOUCH_STIFF: () => T(v3(4.8, 0, 0), v3(0, 0, 0), v3(-1, 0, 0), 0.8),
  /** Demo: the foot gives way at about a quarter of the ball's speed: a dead stop. */
  TOUCH_CUSHION: (footSpeed = 1.25) => T(v3(4.8, 0, 0), v3(footSpeed, 0, 0), v3(-1, 0, 0), 0.8),
  /** Touch into space, away from Chalk, after the LOOK_STEP receive. */
  TOUCH_AWAY: () => T(v3(4.95, 0, 0), v3(-0.87, 1.16, 0), v3(-0.6, 0.8, 0), 1.0),
  /** Back-foot receive, side-on: forward and across, no turn needed. */
  BACK_FOOT: () => T(v3(4.95, 0, 0), v3(0.8, 0.4, 0), v3(-0.5, 0.87, 0), 0.9),
  /** Ending: soft touch across to the open side. */
  ENDING_TOUCH: () => T(v3(5.43, 0, 0), v3(1.0, 1.0, 0), v3(-0.75, 0.66, 0), 0.8),
  /** Wall drill: the rebound comes back at about 3.2 m/s; the foot gives at 0.8 m/s. */
  WALL_CUSHION: () => T(v3(-3.15, 0, 0), v3(-0.8, 0, 0), v3(1, 0, 0), 0.8),
};

// ---- Receiver moves ----
/** LOOK chapter: Tavi steps to meet the ball at 2 m/s from t = 1.5 s. */
export const LOOK_STEP = { leaveAt: 1.5, speed: 2.0 };
export const lookStepMeet = () => {
  // Tavi at x = -(t - 1.5) * 2 for t >= 1.5, meeting the pass where positions match.
  let lo = LOOK_STEP.leaveAt;
  let hi = 3;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const tavi = -(mid - LOOK_STEP.leaveAt) * LOOK_STEP.speed;
    if (passInAt(mid).x < tavi) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return { t, x: -(t - LOOK_STEP.leaveAt) * LOOK_STEP.speed, speed: passInAt(t).speed };
};

/** Ending: Tavi leaves at 0.2 s and jogs to the ball at 3.5 m/s, drifting to y = -0.3. */
export const ENDING_RUN = { leaveAt: 0.2, speed: 3.5, y: -0.3 };
export const endingMeet = () => {
  let lo = ENDING_RUN.leaveAt;
  let hi = 3;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const tavi = -(mid - ENDING_RUN.leaveAt) * ENDING_RUN.speed;
    if (passInAt(mid).x < tavi) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return { t, x: -(t - ENDING_RUN.leaveAt) * ENDING_RUN.speed, y: ENDING_RUN.y, speed: passInAt(t).speed };
};

/** A full turn with the ball, from the youth run-and-turn tests. */
export const TURN_TIME = 0.6;

/** Teaser: the ball pushed 3 m/s to the side; the defender leans the wrong way for 0.5 s. */
export const FEINT = { pushSpeed: 3.0, wrongWay: 0.5, chalkDistance: 3 };
export const feintBallAfter = (t: number) => rollAt(FEINT.pushSpeed, t).x;

/** Drill passes: [distance m, speed m/s]. */
export const DRILLS = {
  b04: { distance: 8, speed: 5 },
  b08: { distance: 10, speed: 5.5 },
  b17: { distance: 10, speed: 5 },
  wall: { distance: 5, speed: 6, wallKeeps: 0.8 },
  boxTouch: 2.0,
  gateTouch: 2.5,
};

export { rollDistance };
