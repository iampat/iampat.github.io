// World (metres, x forward / y left / z up) -> screen (pixels, y down).

import type { Vec3 } from "../physics/sim";

export type View =
  /** Side-on: x to the right, z up. Viewer stands on the kicker's right. */
  | { kind: "side"; originX: number; groundY: number; ppm: number }
  /** From above, x to the right, y (left) up the screen. */
  | { kind: "top"; originX: number; originY: number; ppm: number }
  /** From above, x up the screen (towards the goal), y (left) to the left. */
  | { kind: "topUp"; originX: number; originY: number; ppm: number }
  /** Pinhole camera. yawDeg 0 looks along +x (behind the kicker), 180 looks back (keeper's eyes). */
  | { kind: "persp"; cam: Vec3; yawDeg: number; pitchDeg?: number; focal: number; cx: number; cy: number };

export type Basis = { right: Vec3; up: Vec3; toward: Vec3 };

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Screen axes in world coordinates for a view (toward = pointing at the viewer). */
export const basisOf = (view: View): Basis => {
  switch (view.kind) {
    case "side":
      return { right: v(1, 0, 0), up: v(0, 0, 1), toward: v(0, -1, 0) };
    case "top":
      return { right: v(1, 0, 0), up: v(0, 1, 0), toward: v(0, 0, 1) };
    case "topUp":
      return { right: v(0, -1, 0), up: v(1, 0, 0), toward: v(0, 0, 1) };
    case "persp": {
      const yaw = (view.yawDeg * Math.PI) / 180;
      const pitch = ((view.pitchDeg ?? 0) * Math.PI) / 180;
      const fwd = v(Math.cos(yaw) * Math.cos(pitch), Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch));
      const right = v(Math.sin(yaw), -Math.cos(yaw), 0);
      const up = v(
        fwd.y * right.z - fwd.z * right.y,
        fwd.z * right.x - fwd.x * right.z,
        fwd.x * right.y - fwd.y * right.x,
      );
      return { right, up: v(-up.x, -up.y, -up.z).z < 0 ? up : v(-up.x, -up.y, -up.z), toward: v(-fwd.x, -fwd.y, -fwd.z) };
    }
  }
};

export type ScreenPoint = { x: number; y: number; scale: number; depth: number };

/** Project a world point. `scale` is pixels per metre at that point (for sizing the ball). */
export const project = (p: Vec3, view: View): ScreenPoint => {
  switch (view.kind) {
    case "side":
      return { x: view.originX + p.x * view.ppm, y: view.groundY - p.z * view.ppm, scale: view.ppm, depth: p.y };
    case "top":
      return { x: view.originX + p.x * view.ppm, y: view.originY - p.y * view.ppm, scale: view.ppm, depth: p.z };
    case "topUp":
      return { x: view.originX - p.y * view.ppm, y: view.originY - p.x * view.ppm, scale: view.ppm, depth: p.z };
    case "persp": {
      const b = basisOf(view);
      const d = v(p.x - view.cam.x, p.y - view.cam.y, p.z - view.cam.z);
      const depth = -dot(d, b.toward);
      const safe = Math.max(depth, 0.05);
      const s = view.focal / safe;
      return { x: view.cx + dot(d, b.right) * s, y: view.cy - dot(d, b.up) * s, scale: s, depth };
    }
  }
};

/** SVG path through projected points. */
export const pathD = (pts: { x: number; y: number }[]) =>
  pts.length === 0 ? "" : `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`;
