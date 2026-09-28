// Free-kick layout shared by s11 and s12. It is the same free kick as s08.
// Pitch frame (metres): ball at the origin, X towards the goal line (square to it), Y = left, Z = up.
// The ball is in the left channel: the goal centre is 4.5 m to its right, so the far post is the right post.
// Sim frame: the physics shots fly along +x. `toPitch` turns a sim point onto the pitch, so the
// curler's x axis points at a spot just inside the far post (the same as s08's target line).

import type { BallState, Vec3 } from "../../physics/sim";
import { GOAL_W } from "../Goal";
import type { PCam } from "./s11-s12-world";

/** Goal line, metres from the ball (square to the line). */
export const GL = 18.5;
/** Goal centre (Y). */
export const GC = -4.5;
/** Far post: the right post, away from the ball. */
export const FAR_POST = GC - GOAL_W / 2;
/** Near post: the left post, next to the ball (Chalk and the wall guard it). */
export const NEAR_POST = GC + GOAL_W / 2;
/** Where the curler goes in: just inside the far post. */
export const TARGET = { x: GL, y: FAR_POST + 0.4 };
/** Angle of the target line on the pitch (radians, negative = to the right). */
export const TH = Math.atan2(TARGET.y, TARGET.x);
/** Angle of a line from the ball straight at the far post (the classic mistake). */
export const TH_POST = Math.atan2(FAR_POST, GL);

/** Turn a sim-frame point (or vector) onto the pitch by angle `a` about the ball. */
export const toPitch = (p: Vec3, a = TH): Vec3 => ({
  x: p.x * Math.cos(a) - p.y * Math.sin(a),
  y: p.x * Math.sin(a) + p.y * Math.cos(a),
  z: p.z,
});

/** Turn a pitch point back into the sim frame. */
export const toSim = (p: Vec3, a = TH): Vec3 => toPitch(p, -a);

/** Turn a whole sim path onto the pitch (position, velocity and spin axis). */
export const pathOnPitch = (path: BallState[], a = TH): BallState[] =>
  path.map((s) => ({ ...s, pos: toPitch(s.pos, a), vel: toPitch(s.vel, a), spin: toPitch(s.spin, a) }));

/** Turn a perspective camera about the ball (sim frame -> pitch frame with a = TH). */
export const camOnPitch = (c: PCam, a = TH): PCam => {
  const p = toPitch({ x: c.x, y: c.y, z: c.z }, a);
  return { ...c, x: p.x, y: p.y, yaw: c.yaw + (a * 180) / Math.PI };
};

/** Where a pitch-frame path crosses the plane X = x (linear between samples), with its sample index. */
export const crossPitchX = (path: BallState[], x: number): { f: number; pos: Vec3 } | undefined => {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1].pos;
    const b = path[i].pos;
    if (a.x < x && b.x >= x) {
      const t = (x - a.x) / (b.x - a.x);
      return { f: i - 1 + t, pos: { x, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t } };
    }
  }
  return undefined;
};

/** Y where a line from (x0, y0) at angle `a` meets the plane X = x. */
export const lineYAt = (x0: number, y0: number, a: number, x: number) => y0 + (x - x0) * Math.tan(a);

/** The wall (as in s08): 9.15 m out, square to a line at the near half of the goal. Four defenders, pitch frame. */
export const WALL = (() => {
  const aim = Math.atan2(-3.0, GL);
  const c = { x: 9.15 * Math.cos(aim), y: 9.15 * Math.sin(aim) };
  const perp = { x: -Math.sin(aim), y: Math.cos(aim) };
  return [1.1, 0.37, -0.37, -1.1].map((o) => ({ x: c.x + perp.x * o, y: c.y + perp.y * o }));
})();
