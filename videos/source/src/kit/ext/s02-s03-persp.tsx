// Perspective pitch for s02-s03: an orbiting / craning camera around the kick spot.
// Everything is a real 3D point projected through a pinhole camera, clipped at the
// near plane, so the camera can orbit to a ball close-up and crane up to top-down.
// Axes as in the physics: x towards goal, y = left, z = up. Goal line at x = GOAL_X.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import type { Vec3 } from "../../physics/sim";
import { basisOf, project, type View } from "../../lib/project";
import { EASE } from "../../lib/anim";
import { HEIGHT, PITCH, WIDTH } from "../../theme";
import { Glow } from "../World";

export type PView = Extract<View, { kind: "persp" }>;

/**
 * Camera as an orbit around a target point. yaw 0 = behind the kicker, pitch = degrees looking down.
 * `aimFast` on a key: in the segment that ends at this key, the camera re-aims at the new target
 * early (decelerating ease) while the distance still eases in and out, so a push never loses its subject.
 * `aimSlow` does the opposite for a pull-back: the camera keeps looking at the old target until it is far enough away.
 */
export type Orbit = { f: number; tx: number; ty: number; tz: number; dist: number; yaw: number; pitch: number; focal: number; aimFast?: boolean; aimSlow?: boolean };

const rad = (d: number) => (d * Math.PI) / 180;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

export const orbitView = (o: Omit<Orbit, "f">, cx = WIDTH / 2, cy = HEIGHT / 2): PView => {
  const pitch = Math.min(89.6, o.pitch);
  const y = rad(o.yaw);
  const p = rad(pitch);
  const fwd = { x: Math.cos(y) * Math.cos(p), y: Math.sin(y) * Math.cos(p), z: -Math.sin(p) };
  const cam = { x: o.tx - o.dist * fwd.x, y: o.ty - o.dist * fwd.y, z: o.tz - o.dist * fwd.z };
  return { kind: "persp", cam, yawDeg: o.yaw, pitchDeg: -pitch, focal: o.focal, cx, cy };
};

/** Eased orbit between keys (distance eased in log space, so pushes feel even). */
export const orbitAt = (frame: number, ks: Orbit[], ease = EASE.camera): Omit<Orbit, "f"> => {
  if (ks.length === 1 || frame <= ks[0].f) return ks[0];
  const last = ks[ks.length - 1];
  if (frame >= last.f) return last;
  let i = 0;
  while (i < ks.length - 2 && frame > ks[i + 1].f) i++;
  const a = ks[i];
  const b = ks[i + 1];
  const t = Math.min(1, Math.max(0, (frame - a.f) / Math.max(1, b.f - a.f)));
  const u = ease(t);
  const ua = b.aimFast ? EASE.enter(t) : b.aimSlow ? Math.pow(u, 2.2) : u;
  const m = (x: number, y: number, k: number) => x + (y - x) * k;
  return {
    tx: m(a.tx, b.tx, ua),
    ty: m(a.ty, b.ty, ua),
    tz: m(a.tz, b.tz, ua),
    dist: Math.exp(m(Math.log(a.dist), Math.log(b.dist), u)),
    yaw: m(a.yaw, b.yaw, u),
    pitch: m(a.pitch, b.pitch, u),
    focal: m(a.focal, b.focal, u),
  };
};

const fwdOf = (v: PView): Vec3 => {
  const b = basisOf(v);
  return { x: -b.toward.x, y: -b.toward.y, z: -b.toward.z };
};

export const depthOf = (p: Vec3, v: PView) => dot(sub(p, v.cam), fwdOf(v));

/** Clip a closed polygon to the part in front of the near plane. */
export const clipPoly = (pts: Vec3[], v: PView, near = 0.25): Vec3[] => {
  const out: Vec3[] = [];
  const f = fwdOf(v);
  const d = (p: Vec3) => dot(sub(p, v.cam), f) - near;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const da = d(a);
    const db = d(b);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) out.push(lerp3(a, b, da / (da - db)));
  }
  return out;
};

export const polyD = (pts: Vec3[], v: PView, near = 0.25) => {
  const c = clipPoly(pts, v, near);
  if (c.length < 3) return "";
  return `M${c.map((p) => { const s = project(p, v); return `${s.x.toFixed(1)},${s.y.toFixed(1)}`; }).join(" L")} Z`;
};

/** Open polyline split into the pieces in front of the near plane. */
export const lineSegs = (pts: Vec3[], v: PView, near = 0.25): string[] => {
  const segs: string[] = [];
  let cur: { x: number; y: number }[] = [];
  const f = fwdOf(v);
  const d = (p: Vec3) => dot(sub(p, v.cam), f) - near;
  const push = (p: Vec3) => { const s = project(p, v); cur.push({ x: s.x, y: s.y }); };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const da = d(a);
    if (i > 0) {
      const b = pts[i - 1];
      const db = d(b);
      if (da >= 0 !== db >= 0) {
        push(lerp3(b, a, db / (db - da)));
        if (da < 0) {
          if (cur.length > 1) segs.push(`M${cur.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`);
          cur = [];
        }
      }
    }
    if (da >= 0) push(a);
  }
  if (cur.length > 1) segs.push(`M${cur.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`);
  return segs;
};

/** Screen y of the horizon for a view. */
export const horizonY = (v: PView) => v.cy + Math.tan(rad(v.pitchDeg ?? 0)) * v.focal;

const q = (x0: number, y0: number, x1: number, y1: number, z = 0): Vec3[] => [
  { x: x0, y: y0, z },
  { x: x1, y: y0, z },
  { x: x1, y: y1, z },
  { x: x0, y: y1, z },
];

/** A chalk line on the grass as a thin ground quad (so it thins with distance). */
const groundLine = (a: [number, number], b: [number, number], w = 0.12): Vec3[] => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * (w / 2);
  const ny = (dx / L) * (w / 2);
  return [
    { x: a[0] + nx, y: a[1] + ny, z: 0 },
    { x: b[0] + nx, y: b[1] + ny, z: 0 },
    { x: b[0] - nx, y: b[1] - ny, z: 0 },
    { x: a[0] - nx, y: a[1] - ny, z: 0 },
  ];
};

export const GOAL_X = 18;

/** Sky, stars fixed at infinity, stands and floodlights around the pitch. */
export const PerspSky: React.FC<{ view: PView; seed?: string; lampsOn?: number }> = ({ view, seed = "psky", lampsOn = 1 }) => {
  const frame = useCurrentFrame();
  const hy = horizonY(view);
  const b = basisOf(view);
  const f = fwdOf(view);
  const stars = [];
  for (let i = 0; i < 170; i++) {
    const az = random(`${seed}-az-${i}`) * Math.PI * 2;
    const el = rad(4 + Math.pow(random(`${seed}-el-${i}`), 0.8) * 60);
    const u = { x: Math.cos(az) * Math.cos(el), y: Math.sin(az) * Math.cos(el), z: Math.sin(el) };
    const dz = dot(u, f);
    if (dz < 0.05) continue;
    const sx = view.cx + (dot(u, b.right) / dz) * view.focal;
    const sy = view.cy - (dot(u, b.up) / dz) * view.focal;
    if (sx < -10 || sx > WIDTH + 10 || sy < -10 || sy > HEIGHT) continue;
    const layer = i % 3;
    const r = [1.1, 1.7, 2.5][layer] * (0.7 + random(`${seed}-r-${i}`) * 0.6);
    const tw = 0.55 + 0.45 * Math.sin(frame / (18 + layer * 9) + random(`${seed}-p-${i}`) * 6.28);
    stars.push(<circle key={i} cx={sx} cy={sy} r={r} fill="#FFFFFF" opacity={tw * [0.45, 0.65, 0.9][layer]} />);
  }
  return (
    <g>
      <defs>
        <linearGradient id={`${seed}-grad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PITCH.skyHigh} />
          <stop offset="1" stopColor={PITCH.sky} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} />
      {hy > 0 ? <rect x={0} y={hy - 700} width={WIDTH} height={700} fill={`url(#${seed}-grad)`} /> : null}
      {stars}
      <PerspStands view={view} lampsOn={lampsOn} />
    </g>
  );
};

/** Stands along the left touchline (y = +46) and behind the goal (x = 46), with floodlight towers. */
export const PerspStands: React.FC<{ view: PView; lampsOn?: number }> = ({ view, lampsOn = 1 }) => {
  const standSide = (x0: number, x1: number, y: number, h: number) => (
    <g>
      <path d={polyD([{ x: x0, y, z: 0 }, { x: x1, y, z: 0 }, { x: x1, y: y + 6, z: h }, { x: x0, y: y + 6, z: h }], view)} fill={PITCH.stands} />
      {[0.25, 0.5, 0.75].map((t, i) => (
        <path key={i} d={polyD([{ x: x0 + 1, y: y + 6 * t, z: h * t }, { x: x1 - 1, y: y + 6 * t, z: h * t }, { x: x1 - 1, y: y + 6 * t + 0.6, z: h * t + 0.8 }, { x: x0 + 1, y: y + 6 * t + 0.6, z: h * t + 0.8 }], view)} fill={PITCH.standsLight} opacity={0.9} />
      ))}
      <path d={polyD([{ x: x0 - 1, y: y + 5, z: h + 0.4 }, { x: x1 + 1, y: y + 5, z: h + 0.4 }, { x: x1 + 1, y: y + 7, z: h + 1.6 }, { x: x0 - 1, y: y + 7, z: h + 1.6 }], view)} fill={PITCH.standsLight} />
    </g>
  );
  const standEnd = (y0: number, y1: number, x: number, h: number) => (
    <g>
      <path d={polyD([{ x, y: y0, z: 0 }, { x, y: y1, z: 0 }, { x: x + 6, y: y1, z: h }, { x: x + 6, y: y0, z: h }], view)} fill={PITCH.stands} />
      {[0.25, 0.5, 0.75].map((t, i) => (
        <path key={i} d={polyD([{ x: x + 6 * t, y: y0 + 1, z: h * t }, { x: x + 6 * t, y: y1 - 1, z: h * t }, { x: x + 6 * t + 0.6, y: y1 - 1, z: h * t + 0.8 }, { x: x + 6 * t + 0.6, y: y0 + 1, z: h * t + 0.8 }], view)} fill={PITCH.standsLight} opacity={0.9} />
      ))}
      <path d={polyD([{ x: x + 5, y: y0 - 1, z: h + 0.4 }, { x: x + 5, y: y1 + 1, z: h + 0.4 }, { x: x + 7, y: y1 + 1, z: h + 1.6 }, { x: x + 7, y: y0 - 1, z: h + 1.6 }], view)} fill={PITCH.standsLight} />
    </g>
  );
  const towers: Vec3[] = [
    { x: -30, y: 50, z: 22 },
    { x: 0, y: 50, z: 22 },
    { x: 30, y: 50, z: 22 },
    { x: 52, y: 30, z: 22 },
    { x: 52, y: -30, z: 22 },
  ];
  return (
    <g>
      {standEnd(-40, 54, 46, 8)}
      {standSide(-60, 54, 46, 8)}
      {towers.map((t, i) => {
        if (depthOf(t, view) < 1) return null;
        const top = project(t, view);
        const base = project({ ...t, z: 0 }, view);
        const s = top.scale;
        const hw = Math.max(10, 2.2 * s);
        const hh = Math.max(7, 1.4 * s);
        return (
          <g key={i}>
            <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={PITCH.stands} strokeWidth={Math.max(2, 0.45 * s)} strokeLinecap="round" />
            <rect x={top.x - hw} y={top.y - hh} width={hw * 2} height={hh * 2} rx={hh * 0.5} fill={PITCH.standsLight} />
            <rect x={top.x - hw} y={top.y - hh} width={hw * 2} height={hh * 2} rx={hh * 0.5} fill={PITCH.lightSoft} opacity={lampsOn} />
            <Glow cx={top.x} cy={top.y} r={Math.max(60, hw * 4.2)} color={PITCH.lightSoft} intensity={lampsOn * 1.1} rings={4} />
          </g>
        );
      })}
    </g>
  );
};

/** Grass with mowing stripes and chalk markings around one goal. */
export const PerspPitch: React.FC<{
  view: PView;
  chalk?: number;
  /** 0..1: the six-yard box, spot and arc shrink towards (sx, sy) world metres and fade (title morph). */
  slide?: number;
  slideTo?: [number, number];
}> = ({ view, chalk = 0.9, slide = 0, slideTo = [9.75, 0] }) => {
  const stripes = [];
  const W = 5.5;
  for (let i = 0; i < 20; i++) {
    const x1 = GOAL_X - i * W;
    const x0 = x1 - W;
    if (i % 2 === 1) stripes.push(<path key={i} d={polyD(q(x0, -34, x1, 34), view)} fill={PITCH.grass} />);
  }
  const lines: Vec3[][] = [];
  const L = (a: [number, number], b: [number, number]) => lines.push(groundLine(a, b));
  // Goal line and touchlines.
  L([GOAL_X, -34], [GOAL_X, 34]);
  L([GOAL_X, 34], [GOAL_X - 110, 34]);
  L([GOAL_X, -34], [GOAL_X - 110, -34]);
  // Penalty box.
  L([GOAL_X, 20.16], [GOAL_X - 16.5, 20.16]);
  L([GOAL_X - 16.5, 20.16], [GOAL_X - 16.5, -20.16]);
  L([GOAL_X - 16.5, -20.16], [GOAL_X, -20.16]);
  // Parts that slide into the title.
  const mv = (p: [number, number]): [number, number] => [p[0] + (slideTo[0] - p[0]) * slide, p[1] + (slideTo[1] - p[1]) * slide];
  const slid: Vec3[][] = [];
  const S = (a: [number, number], b: [number, number]) => slid.push(groundLine(mv(a), mv(b), 0.12 * (1 - 0.5 * slide)));
  S([GOAL_X, 9.16], [GOAL_X - 5.5, 9.16]);
  S([GOAL_X - 5.5, 9.16], [GOAL_X - 5.5, -9.16]);
  S([GOAL_X - 5.5, -9.16], [GOAL_X, -9.16]);
  for (let a = -53; a < 53; a += 6) {
    const t0 = rad(a);
    const t1 = rad(a + 6);
    S([GOAL_X - 11 - 9.15 * Math.cos(t0), 9.15 * Math.sin(t0)], [GOAL_X - 11 - 9.15 * Math.cos(t1), 9.15 * Math.sin(t1)]);
  }
  const spot = (cx: number, cy: number, r: number) =>
    Array.from({ length: 14 }, (_, i) => ({ x: cx + Math.cos((i / 14) * Math.PI * 2) * r, y: cy + Math.sin((i / 14) * Math.PI * 2) * r, z: 0 }));
  const ps = mv([GOAL_X - 11, 0]);
  return (
    <g>
      <path d={polyD(q(-400, -400, 600, 400), view, 0.2)} fill={PITCH.grassDark} />
      {stripes}
      <g fill={PITCH.chalk} opacity={chalk}>
        {lines.map((l, i) => (
          <path key={i} d={polyD(l, view)} />
        ))}
        <g opacity={1 - slide}>
          {slid.map((l, i) => (
            <path key={`s${i}`} d={polyD(l, view)} />
          ))}
          <path d={polyD(spot(ps[0], ps[1], 0.16), view)} />
        </g>
      </g>
    </g>
  );
};

/** A flat disc on the grass (a soft contact shadow under the ball). */
export const GroundDisc: React.FC<{ view: PView; x: number; y: number; r: number; color?: string; opacity?: number }> = ({ view, x, y, r, color = "#0B3F31", opacity = 0.55 }) => {
  const pts = Array.from({ length: 24 }, (_, i) => ({ x: x + Math.cos((i / 24) * Math.PI * 2) * r, y: y + Math.sin((i / 24) * Math.PI * 2) * r, z: 0.002 }));
  return <path d={polyD(pts, view)} fill={color} opacity={opacity} />;
};

/** A path (world points) with draw-on (0..1 of the points), optional dash. */
export const PerspPath: React.FC<{
  view: PView;
  pts: Vec3[];
  upto?: number;
  color?: string;
  width?: number;
  opacity?: number;
  dash?: string;
}> = ({ view, pts, upto = 1, color = PITCH.accent, width = 6, opacity = 1, dash }) => {
  if (upto <= 0 || opacity <= 0.001) return null;
  const n = pts.length;
  const endF = Math.max(1, (n - 1) * Math.min(1, upto));
  const i = Math.floor(endF);
  const shown = pts.slice(0, i + 1);
  if (i < n - 1) shown.push(lerp3(pts[i], pts[i + 1], endF - i));
  const segs = lineSegs(shown, view);
  return (
    <g opacity={opacity}>
      {segs.map((d, k) => (
        <path key={k} d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
      ))}
    </g>
  );
};

/** Unit-vector helpers for the spin ring. */
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/**
 * A 3D ring arrow around a ball that shows its spin: the arc turns about `axis`
 * (right-hand rule), with an arrowhead pointing the way the surface moves.
 * Draw part="back" before the ball and part="front" after it.
 */
export const SpinRing: React.FC<{
  view: PView;
  center: Vec3;
  radius: number;
  axis: Vec3;
  phase: number;
  part: "back" | "front";
  color?: string;
  width?: number;
  sweep?: number;
  opacity?: number;
}> = ({ view, center, radius, axis, phase, part, color = "#B6F24A", width = 14, sweep = 1, opacity = 1 }) => {
  if (opacity <= 0.001 || sweep <= 0.001) return null;
  const k = norm(axis);
  const helper = Math.abs(k.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const a1 = norm(cross(k, helper));
  const a2 = cross(k, a1);
  const cd = depthOf(center, view);
  const arc = rad(290) * sweep;
  const N = 64;
  const P = (th: number): Vec3 => ({
    x: center.x + radius * (a1.x * Math.cos(th) + a2.x * Math.sin(th)),
    y: center.y + radius * (a1.y * Math.cos(th) + a2.y * Math.sin(th)),
    z: center.z + radius * (a1.z * Math.cos(th) + a2.z * Math.sin(th)),
  });
  const segs: string[] = [];
  let cur: string[] = [];
  let curFront = false;
  for (let i = 0; i <= N; i++) {
    const th = phase + (arc * i) / N;
    const p = P(th);
    const front = depthOf(p, view) < cd;
    const s = project(p, view);
    const pt = `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
    if (i > 0 && front !== curFront) {
      cur.push(pt);
      if (curFront === (part === "front") && cur.length > 1) segs.push(`M${cur.join(" L")}`);
      cur = [];
    }
    curFront = front;
    cur.push(pt);
  }
  if (curFront === (part === "front") && cur.length > 1) segs.push(`M${cur.join(" L")}`);
  // Arrowhead at the leading end.
  const thEnd = phase + arc;
  const tip = P(thEnd + 0.18);
  const base = P(thEnd);
  const headFront = depthOf(base, view) < cd;
  const sTip = project(tip, view);
  const sBase = project(base, view);
  const ang = Math.atan2(sTip.y - sBase.y, sTip.x - sBase.x);
  const hl = width * 2.3;
  const head =
    headFront === (part === "front") ? (
      <path
        d={`M${sBase.x + Math.cos(ang) * hl},${sBase.y + Math.sin(ang) * hl} L${sBase.x + Math.cos(ang + 2.3) * hl * 0.8},${sBase.y + Math.sin(ang + 2.3) * hl * 0.8} L${sBase.x + Math.cos(ang - 2.3) * hl * 0.8},${sBase.y + Math.sin(ang - 2.3) * hl * 0.8} Z`}
        fill={color}
        stroke={color}
        strokeWidth={width * 0.5}
        strokeLinejoin="round"
      />
    ) : null;
  return (
    <g opacity={opacity * (part === "back" ? 0.45 : 1)}>
      {segs.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {head}
    </g>
  );
};

/** Quaternion helpers: accumulate a ball orientation through changing spin axes. */
export type Quat = [number, number, number, number]; // w, x, y, z
export const qMul = (a: Quat, b: Quat): Quat => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
export const qAxis = (axis: Vec3, angle: number): Quat => {
  const k = norm(axis);
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), k.x * s, k.y * s, k.z * s];
};
/** Axis-angle of a unit quaternion (for the Ball's axis + angle props). */
export const qToAxisAngle = (qq: Quat): { axis: Vec3; angle: number } => {
  const w = Math.max(-1, Math.min(1, qq[0]));
  const angle = 2 * Math.acos(w);
  const s = Math.sqrt(Math.max(0, 1 - w * w));
  if (s < 1e-6) return { axis: { x: 0, y: 0, z: 1 }, angle: 0 };
  return { axis: { x: qq[1] / s, y: qq[2] / s, z: qq[3] / s }, angle };
};
