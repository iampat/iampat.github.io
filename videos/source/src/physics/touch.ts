// First-touch physics and ground passes.
//
// The first touch is a collision: along the contact line, the ball leaves with
//   v_out = v_foot - e * (v_ball - v_foot)
// so it only "bounces" off the speed DIFFERENCE between ball and foot. A foot that moves
// back with the ball (v_foot in the ball's direction) kills most of the rebound.
// e (bounciness of a ball on a foot/shin) is about 0.5-0.7 for a firm foot; a relaxed,
// giving foot behaves like a lower e.

import { simulate, v3, type BallState, type KickParams, type Vec3 } from "./sim";

export type TouchInput = {
  /** Ball velocity just before contact (m/s). */
  ballVel: Vec3;
  /** Foot velocity at contact (m/s). Positive along the ball's direction = giving way. */
  footVel: Vec3;
  /** Unit direction the foot surface pushes the ball (the touch direction). */
  normal: Vec3;
  /** Bounciness along the normal, 0..1. */
  e?: number;
  /** Grip across the normal: 0 = ball keeps its sideways speed, 1 = the foot takes it all. */
  grip?: number;
};

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const unit = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return v3(a.x / l, a.y / l, a.z / l);
};

/** Ball velocity just after the touch. */
export const firstTouch = ({ ballVel, footVel, normal, e = 0.6, grip = 0.8 }: TouchInput): Vec3 => {
  const n = unit(normal);
  const rel = sub(ballVel, footVel);
  const relN = dot(rel, n);
  // Only a collision if the ball moves into the foot along the normal.
  if (relN >= 0) return ballVel;
  const outN = -e * relN; // relative speed along the normal after the bounce
  const relT = sub(rel, scale(n, relN)); // sideways part of the relative velocity
  const outT = scale(relT, 1 - grip);
  return add(footVel, add(scale(n, outN), outT));
};

/** Speed of the ball after a straight-on touch, as a fraction of its incoming speed. */
export const reboundFraction = (ballSpeed: number, footSpeedBack: number, e = 0.6) => {
  const out = firstTouch({ ballVel: v3(-ballSpeed, 0, 0), footVel: v3(-footSpeedBack, 0, 0), normal: v3(1, 0, 0), e });
  return Math.abs(out.x) / ballSpeed;
};

/** Rolling deceleration of a ball on grass, m/s^2 (short grass, dry). */
export const ROLL_DECEL_GRASS = 0.8;

/**
 * A ground pass: the ball rolls from `start` at `speed` in the direction `dirDeg`
 * (0 = +x, positive = towards +y / left) and slows on the grass.
 */
export const rollPass = (speed: number, dirDeg: number, start: Vec3 = v3(0, 0, 0.11), duration = 4, decel = ROLL_DECEL_GRASS, fps = 30): BallState[] => {
  const p: KickParams = { speed, elevationDeg: 0, azimuthDeg: dirDeg, start, duration, ground: true, restitution: 0.3, friction: 0.6, rollDecel: decel };
  return simulate(p, fps);
};

/** Distance a rolling ball covers before it stops. */
export const rollDistance = (speed: number, decel = ROLL_DECEL_GRASS) => (speed * speed) / (2 * decel);

/** Position of a rolling ball after t seconds (1D), with slowing. */
export const rollAt = (speed: number, t: number, decel = ROLL_DECEL_GRASS) => {
  const tStop = speed / decel;
  const tt = Math.min(t, tStop);
  return { x: speed * tt - 0.5 * decel * tt * tt, v: Math.max(0, speed - decel * tt) };
};

/** Seconds a defender needs to cover `distanceM` at `speedMps`, plus a reaction delay. */
export const timeToArrive = (distanceM: number, speedMps: number, reactionS = 0.25) => reactionS + distanceM / speedMps;

/** Chalk's closing speed for the whole episode (m/s): a jog-to-run. */
export const CHASE_SPEED = 4;

/**
 * Distance left between a chasing defender and the ball after `t` seconds, if he starts
 * `startDistance` metres away, waits `reaction` seconds, then closes at `speed`.
 * Never negative: 0 means he is there.
 */
export const chaseDistance = (t: number, startDistance: number, speed = CHASE_SPEED, reaction = 0) =>
  Math.max(0, startDistance - Math.max(0, t - reaction) * speed);

/** Seconds on the time bubble for a defender `distance` metres away (distance / CHASE_SPEED). */
export const bubbleSeconds = (distance: number, speed = CHASE_SPEED) => distance / speed;
