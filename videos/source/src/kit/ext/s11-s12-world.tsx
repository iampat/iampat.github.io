// Helpers for s11-s12 (owned by the s11-s12 builder).
// - A free perspective camera with eased keys (position, yaw, pitch, focal).
// - Near-plane clipping, so lines and polygons behind a perspective camera never explode.
// - A pitch around one goal drawn in any view (grass stripes, box lines, the D).
// - A goal frame in 3D (posts, bar, optional net with a ripple).
// - Small props: curve gauge, dimension bracket, top-down boot, cone, flag, mitten, colour mix,
//   push arrow, footprint, kit bag (top-down).

import React from "react";
import { EASE, keys } from "../../lib/anim";
import { basisOf, pathD, project, type View } from "../../lib/project";
import type { Vec3 } from "../../physics/sim";
import { CAST, FONTS, PITCH } from "../../theme";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const sub = (a: Vec3, b: Vec3) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const lerp3 = (a: Vec3, b: Vec3, t: number) => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

// ---------------------------------------------------------------- camera

export type PCam = { x: number; y: number; z: number; yaw: number; pitch: number; focal: number; cy?: number; cx?: number };
export type PKey = PCam & { f: number };

/** Eased perspective camera between keys (easeInOutSine per pair). */
export const pcamAt = (frame: number, ks: PKey[], ease: (t: number) => number = EASE.camera): PCam => {
  if (ks.length === 1) return ks[0];
  const fs = ks.map((k) => k.f);
  const g = (sel: (k: PKey) => number) => keys(frame, fs, ks.map(sel), ease);
  return {
    x: g((k) => k.x),
    y: g((k) => k.y),
    z: g((k) => k.z),
    yaw: g((k) => k.yaw),
    pitch: g((k) => k.pitch),
    focal: g((k) => k.focal),
    cy: g((k) => k.cy ?? 540),
    cx: g((k) => k.cx ?? 960),
  };
};

export const viewOf = (c: PCam): View => ({
  kind: "persp",
  cam: v(c.x, c.y, c.z),
  yawDeg: c.yaw,
  pitchDeg: c.pitch,
  focal: c.focal,
  cx: c.cx ?? 960,
  cy: c.cy ?? 540,
});

/** Screen y of the horizon for a perspective view (ground at infinity). */
export const horizonY = (c: PCam) => (c.cy ?? 540) + Math.tan((c.pitch * Math.PI) / 180) * c.focal;

// ---------------------------------------------------------------- clipping

const NEAR = 0.3;

export const depthOf = (p: Vec3, view: View) => {
  if (view.kind !== "persp") return 1e3;
  return -dot(sub(p, view.cam), basisOf(view).toward);
};

/** SVG path through 3D points, clipped against the near plane of a perspective view. */
export const linePath = (pts: Vec3[], view: View, near = NEAR): string => {
  if (view.kind !== "persp") return pathD(pts.map((p) => project(p, view)));
  let d = "";
  let pen = false;
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i];
    let b = pts[i + 1];
    const da = depthOf(a, view);
    const db = depthOf(b, view);
    if (da < near && db < near) {
      pen = false;
      continue;
    }
    let restart = !pen;
    if (da < near) {
      a = lerp3(a, b, (near - da) / (db - da));
      restart = true;
    } else if (db < near) {
      b = lerp3(a, b, (near - da) / (db - da));
    }
    const pa = project(a, view);
    const pb = project(b, view);
    if (restart) d += `M${pa.x.toFixed(1)},${pa.y.toFixed(1)}`;
    d += ` L${pb.x.toFixed(1)},${pb.y.toFixed(1)}`;
    pen = db >= near;
  }
  return d;
};

/** Closed polygon through 3D points, clipped against the near plane (Sutherland-Hodgman). */
export const polyPath = (pts: Vec3[], view: View, near = NEAR): string => {
  let poly = pts;
  if (view.kind === "persp") {
    const out: Vec3[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = depthOf(a, view);
      const db = depthOf(b, view);
      if (da >= near) out.push(a);
      if (da >= near !== db >= near) out.push(lerp3(a, b, (near - da) / (db - da)));
    }
    poly = out;
  }
  if (poly.length < 3) return "";
  return `${pathD(poly.map((p) => project(p, view)))} Z`;
};

// ---------------------------------------------------------------- colour

const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Mix two #rrggbb colours (t = 0 gives a, 1 gives b). */
export const mixHex = (a: string, b: string, t: number) => {
  const A = hex(a);
  const B = hex(b);
  const k = Math.min(1, Math.max(0, t));
  const c = A.map((x, i) => Math.round(x + (B[i] - x) * k));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

// ---------------------------------------------------------------- pitch

export type PitchColors = { a: string; b: string; line: string; lineOpacity?: number };

/**
 * Grass and chalk lines around one goal, in any view. Goal line at x = goalX, goal centre at y = gc.
 * Stripes are bands of x (like a mown pitch).
 */
export const WorldPitch: React.FC<{ view: View; goalX: number; gc: number; colors: PitchColors; lineW?: number; box?: boolean; spotOpacity?: number }> = ({
  view,
  goalX,
  gc,
  colors,
  lineW,
  box = true,
  spotOpacity = 1,
}) => {
  const bands = [];
  const bw = 4;
  for (let i = 0; i < 16; i++) {
    const x0 = goalX + 12 - (i + 1) * bw;
    const x1 = x0 + bw;
    const d = polyPath([v(x0, gc - 45, 0), v(x1, gc - 45, 0), v(x1, gc + 45, 0), v(x0, gc + 45, 0)], view);
    if (d) bands.push(<path key={i} d={d} fill={i % 2 ? colors.b : colors.a} />);
  }
  const seg = (pts: [number, number][]) => linePath(pts.map(([x, y]) => v(x, y, 0)), view);
  const arc: [number, number][] = [];
  const spotX = goalX - 11;
  for (let a = -53; a <= 53; a += 3) {
    const t = (a * Math.PI) / 180;
    arc.push([spotX - 9.15 * Math.cos(t), gc + 9.15 * Math.sin(t)]);
  }
  const w = lineW ?? (view.kind === "persp" ? 4 : Math.max(3, view.ppm * 0.1));
  const spot = project(v(spotX, gc, 0), view);
  const spotOk = depthOf(v(spotX, gc, 0), view) > NEAR;
  return (
    <g>
      {bands}
      <g fill="none" stroke={colors.line} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={colors.lineOpacity ?? 0.85}>
        <path d={seg([[goalX, gc - 40], [goalX, gc + 40]])} />
        {box ? (
          <>
            <path d={seg([[goalX, gc - 9.16], [goalX - 5.5, gc - 9.16], [goalX - 5.5, gc + 9.16], [goalX, gc + 9.16]])} />
            <path d={seg([[goalX, gc - 20.16], [goalX - 16.5, gc - 20.16], [goalX - 16.5, gc + 20.16], [goalX, gc + 20.16]])} />
            <path d={seg(arc)} />
          </>
        ) : null}
      </g>
      {box && spotOk && spotOpacity > 0.01 ? (
        <circle cx={spot.x} cy={spot.y} r={Math.max(3, 0.16 * spot.scale)} fill={colors.line} opacity={(colors.lineOpacity ?? 0.85) * spotOpacity} />
      ) : null}
    </g>
  );
};

// ---------------------------------------------------------------- goal

/** Goal frame in 3D on the line x = goalX between y = y0 (far post) and y1. Optional net with a ripple. */
export const Goal3D: React.FC<{
  view: View;
  goalX: number;
  y0: number;
  y1: number;
  h?: number;
  color?: string;
  net?: boolean;
  netOpacity?: number;
  /** Ripple: centre on the back of the net (y, z) and amplitude in metres. */
  ripple?: { y: number; z: number; amp: number; phase: number };
  postW?: number;
  /** 0..1: squash heights to the ground (for a flat top-down map). */
  flat?: number;
}> = ({ view, goalX, y0, y1, h = 2.44, color = PITCH.chalk, net = false, netOpacity = 0.35, ripple, postW = 0.12, flat = 0 }) => {
  const P = (x: number, y: number, z: number) => v(x, y, z * (1 - flat));
  const mid = project(P(goalX, (y0 + y1) / 2, h / 2), view);
  const sw = (p: Vec3) => Math.max(3, postW * project(p, view).scale);
  const depthBack = 1.8;
  const bump = (y: number, z: number) => {
    if (!ripple) return 0;
    const d = Math.hypot(y - ripple.y, (z - ripple.z) * 1.4);
    return ripple.amp * Math.exp(-d * d * 0.5) * Math.cos(ripple.phase - d * 2.2);
  };
  const netLines: React.ReactNode[] = [];
  if (net) {
    // Back wall: a grid of lines in the plane x = goalX + depth (roof slopes back from the bar).
    // Back wall point; a ripple pushes it back and also spreads it out from the impact point (visible from the front).
    const back = (y: number, z: number) => {
      const b = bump(y, z);
      const dy = ripple ? y - ripple.y : 0;
      const dz = ripple ? z - ripple.z : 0;
      const L = Math.hypot(dy, dz) || 1;
      const zz = Math.max(0, Math.min(h, z + (dz / L) * Math.abs(b) * 0.9));
      return P(goalX + depthBack * (z < h ? 1 - 0.25 * (z / h) : 0.75) + b, y + (dy / L) * Math.abs(b) * 0.9, zz);
    };
    const ny = 14;
    const nz = 6;
    for (let i = 0; i <= ny; i++) {
      const y = y0 + ((y1 - y0) * i) / ny;
      const pts = Array.from({ length: nz + 1 }, (_, k) => back(y, (h * k) / nz));
      netLines.push(<path key={`nv${i}`} d={linePath(pts, view)} />);
    }
    for (let k = 1; k <= nz; k++) {
      const z = (h * k) / nz;
      const pts = Array.from({ length: ny + 1 }, (_, i) => back(y0 + ((y1 - y0) * i) / ny, z));
      netLines.push(<path key={`nh${k}`} d={linePath(pts, view)} />);
    }
    // Side walls and roof edges.
    for (const y of [y0, y1]) {
      netLines.push(<path key={`s${y}`} d={linePath([P(goalX, y, h), back(y, h), back(y, 0)], view)} />);
    }
    netLines.push(<path key="roof" d={linePath([back(y0, h), back(y1, h)], view)} />);
  }
  const frame = linePath([P(goalX, y0, 0), P(goalX, y0, h), P(goalX, y1, h), P(goalX, y1, 0)], view);
  return (
    <g>
      {net ? (
        <g fill="none" stroke={color} strokeWidth={Math.max(1.5, 0.02 * mid.scale)} opacity={netOpacity} strokeLinecap="round">
          {netLines}
        </g>
      ) : null}
      <path d={frame} fill="none" stroke={color} strokeWidth={sw(P(goalX, y0, h))} strokeLinecap="round" strokeLinejoin="round" />
      {flat > 0.5
        ? [y0, y1].map((y) => {
            const q = project(P(goalX, y, 0), view);
            return depthOf(P(goalX, y, 0), view) > NEAR ? <circle key={y} cx={q.x} cy={q.y} r={Math.max(5, 0.16 * q.scale)} fill={color} opacity={(flat - 0.5) * 2} /> : null;
          })
        : null}
    </g>
  );
};

// ---------------------------------------------------------------- props

/** A dimension bracket from (x1,y1) to (x2,y2) with end caps. `grow` 0..1 draws it from the start. */
export const Bracket: React.FC<{ x1: number; y1: number; x2: number; y2: number; grow?: number; color?: string; width?: number; cap?: number; opacity?: number }> = ({
  x1,
  y1,
  x2,
  y2,
  grow = 1,
  color = "#FFE08A",
  width = 7,
  cap = 16,
  opacity = 1,
}) => {
  if (grow <= 0.001) return null;
  const ex = x1 + (x2 - x1) * grow;
  const ey = y1 + (y2 - y1) * grow;
  const L = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / L) * cap;
  const ny = ((x2 - x1) / L) * cap;
  return (
    <g stroke={color} strokeWidth={width} strokeLinecap="round" opacity={opacity}>
      <line x1={x1} y1={y1} x2={ex} y2={ey} />
      <line x1={x1 - nx} y1={y1 - ny} x2={x1 + nx} y2={y1 + ny} />
      <line x1={ex - nx} y1={ey - ny} x2={ex + nx} y2={ey + ny} />
    </g>
  );
};

/** A small curve gauge: a dial with a needle. `value` 0..1 across the dial. */
export const CurveGauge: React.FC<{ x: number; y: number; r?: number; value: number; label?: string; bg: string; track: string; needle: string; text: string; scale?: number }> = ({
  x,
  y,
  r = 58,
  value,
  label = "BEND",
  bg,
  track,
  needle,
  text,
  scale = 1,
}) => {
  if (scale <= 0.001) return null;
  const a = Math.PI * (1 - Math.min(1, Math.max(0, value)));
  const ticks = Array.from({ length: 9 }, (_, i) => {
    const t = Math.PI * (1 - i / 8);
    return <line key={i} x1={Math.cos(t) * r * 0.72} y1={-Math.sin(t) * r * 0.72} x2={Math.cos(t) * r * 0.86} y2={-Math.sin(t) * r * 0.86} stroke={track} strokeWidth={4} strokeLinecap="round" />;
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x={-r * 1.25} y={-r * 1.18} width={r * 2.5} height={r * 1.18 + 52} rx={r * 0.5} fill={bg} />
      <path d={`M${-r},0 A${r},${r} 0 0 1 ${r},0`} fill="none" stroke={track} strokeWidth={6} strokeLinecap="round" opacity={0.5} />
      {ticks}
      <line x1={0} y1={0} x2={Math.cos(a) * r * 0.8} y2={-Math.sin(a) * r * 0.8} stroke={needle} strokeWidth={8} strokeLinecap="round" />
      <circle r={10} fill={needle} />
      <text y={42} fill={text} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
        {label}
      </text>
    </g>
  );
};

/** Boot seen from above, toe pointing along `angle` (degrees, 0 = up the screen, positive = clockwise). */
export const TopBoot: React.FC<{ x: number; y: number; angle: number; len?: number; opacity?: number }> = ({ x, y, angle, len = 70, opacity = 1 }) => {
  const w = len * 0.42;
  const L = len;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      {/* Heel at the bottom, toe at the top. */}
      <path
        d={`M0,${-L * 0.55} C${w * 0.62},${-L * 0.55} ${w * 0.6},${-L * 0.1} ${w * 0.48},${L * 0.18} C${w * 0.4},${L * 0.42} ${w * 0.3},${L * 0.45} 0,${L * 0.45} C${-w * 0.3},${L * 0.45} ${-w * 0.4},${L * 0.42} ${-w * 0.48},${L * 0.18} C${-w * 0.6},${-L * 0.1} ${-w * 0.62},${-L * 0.55} 0,${-L * 0.55} Z`}
        fill={CAST.boot}
      />
      <rect x={-w * 0.2} y={-L * 0.3} width={w * 0.4} height={L * 0.4} rx={w * 0.2} fill={CAST.bootShade} />
      <circle cx={0} cy={L * 0.24} r={w * 0.34} fill={CAST.sock} />
      <circle cx={0} cy={L * 0.24} r={w * 0.2} fill={CAST.sockShade} />
    </g>
  );
};

/** Tall training cone seen from above: square base, stacked rings, a white band, the tip. */
export const TopCone: React.FC<{ x: number; y: number; r?: number; color?: string; opacity?: number }> = ({ x, y, r = 22, color = PITCH.light, opacity = 1 }) => (
  <g opacity={opacity} transform={`translate(${x} ${y})`}>
    <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.35} fill={PITCH.accent} />
    <circle r={r * 0.82} fill={color} />
    <circle r={r * 0.6} fill={PITCH.chalk} />
    <circle r={r * 0.42} fill={color} />
    <circle r={r * 0.16} fill={PITCH.accent} />
  </g>
);

/** A slim chalk defender for a wall (front view): capsule body, dot eyes, arms down. `sink` 0..1 melts him. */
export const ChalkDefender: React.FC<{ x: number; groundY: number; h: number; surprised?: boolean; sink?: number; sway?: number }> = ({ x, groundY, h, surprised = false, sink = 0, sway = 0 }) => {
  if (sink >= 0.999) return null;
  const W = h * 0.27;
  const H = h * (1 - sink);
  const eyeR = h * (surprised ? 0.028 : 0.021);
  return (
    <g transform={`translate(${x} ${groundY}) rotate(${sway} 0 ${-H * 0.4})`} opacity={1 - sink * 0.6}>
      <rect x={-W * 0.36} y={-H * 0.14} width={W * 0.24} height={H * 0.15} rx={W * 0.12} fill={CAST.keeperShade} />
      <rect x={W * 0.12} y={-H * 0.14} width={W * 0.24} height={H * 0.15} rx={W * 0.12} fill={CAST.keeperShade} />
      <rect x={-W * 0.72} y={-H * 0.74} width={W * 0.26} height={H * 0.42} rx={W * 0.13} fill={CAST.keeperShade} />
      <rect x={W * 0.46} y={-H * 0.74} width={W * 0.26} height={H * 0.42} rx={W * 0.13} fill={CAST.keeperShade} />
      <rect x={-W / 2} y={-H} width={W} height={H * 0.88} rx={W / 2} fill={CAST.keeper} />
      <rect x={W * 0.14} y={-H * 0.94} width={W * 0.22} height={H * 0.74} rx={W * 0.11} fill={CAST.keeperShade} opacity={0.5} />
      {sink < 0.5 ? (
        <>
          <circle cx={-W * 0.18} cy={-H * 0.82} r={eyeR} fill={CAST.keeperEye} />
          <circle cx={W * 0.18} cy={-H * 0.82} r={eyeR} fill={CAST.keeperEye} />
        </>
      ) : null}
    </g>
  );
};

/** A small flag on a pole (a board token). Base at (x, y). */
export const FlagToken: React.FC<{ x: number; y: number; h?: number; color?: string; wave?: number }> = ({ x, y, h = 70, color = PITCH.light, wave = 0 }) => (
  <g transform={`translate(${x} ${y})`}>
    <ellipse cx={0} cy={0} rx={12} ry={5} fill={PITCH.sky} opacity={0.5} />
    <rect x={-3} y={-h} width={6} height={h} rx={3} fill={PITCH.chalk} />
    <path d={`M3,${-h} Q${22},${-h + 6 + wave} ${40},${-h + 12} Q${22},${-h + 20 - wave} 3,${-h + 26} Z`} fill={color} />
  </g>
);

/** Chalk's big mitten (for point-of-view shots). */
export const Mitten: React.FC<{ x: number; y: number; s?: number; angle?: number; flip?: boolean }> = ({ x, y, s = 1, angle = 0, flip = false }) => (
  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${flip ? -s : s} ${s})`}>
    <rect x={-40} y={60} width={80} height={200} rx={40} fill={CAST.keeperShade} />
    <rect x={-95} y={-110} width={190} height={210} rx={90} fill={CAST.keeper} />
    <ellipse cx={-105} cy={-10} rx={40} ry={62} fill={CAST.keeper} transform="rotate(-25 -105 -10)" />
    <rect x={-80} y={70} width={160} height={50} rx={25} fill={CAST.keeperShade} />
    <rect x={-50} y={-10} width={110} height={14} rx={7} fill={CAST.keeperShade} opacity={0.7} />
  </g>
);

/** A flat force arrow (shaft + head) from (x, y) along the unit direction (dx, dy). `len` is the full length in px. */
export const PushArrow: React.FC<{ x: number; y: number; dx: number; dy: number; len: number; width?: number; color: string; opacity?: number }> = ({
  x,
  y,
  dx,
  dy,
  len,
  width = 12,
  color,
  opacity = 1,
}) => {
  if (len <= 1) return null;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const head = Math.min(len * 0.55, width * 2.6);
  const ex = x + ux * (len - head);
  const ey = y + uy * (len - head);
  const hw = width * 1.35;
  return (
    <g opacity={opacity}>
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path
        d={`M${x + ux * len},${y + uy * len} L${ex - uy * hw},${ey + ux * hw} L${ex + uy * hw},${ey - ux * hw} Z`}
        fill={color}
        stroke={color}
        strokeWidth={width * 0.35}
        strokeLinejoin="round"
      />
    </g>
  );
};

/** A chalk footprint seen from above. Toe points along `angle` (degrees, 0 = up the screen, positive = clockwise). */
export const Footprint: React.FC<{ x: number; y: number; angle: number; len?: number; color?: string; opacity?: number; mirror?: boolean }> = ({
  x,
  y,
  angle,
  len = 34,
  color = PITCH.chalk,
  opacity = 0.9,
  mirror = false,
}) => {
  const w = len * 0.4;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${mirror ? -1 : 1} 1)`} opacity={opacity}>
      {/* Sole (toe at the top), then a separate heel pad. */}
      <path
        d={`M${w * 0.05},${-len * 0.5} C${w * 0.6},${-len * 0.5} ${w * 0.62},${-len * 0.12} ${w * 0.42},${len * 0.08} C${w * 0.3},${len * 0.14} ${-w * 0.36},${len * 0.14} ${-w * 0.44},${len * 0.06} C${-w * 0.56},${-len * 0.1} ${-w * 0.5},${-len * 0.5} ${w * 0.05},${-len * 0.5} Z`}
        fill={color}
      />
      <ellipse cx={0} cy={len * 0.33} rx={w * 0.36} ry={len * 0.16} fill={color} />
    </g>
  );
};

/** Tavi's kit bag seen from above (a duffel): long axis along `angle` (degrees, 0 = to the right). */
export const KitBag: React.FC<{ x: number; y: number; len?: number; angle?: number; opacity?: number }> = ({ x, y, len = 60, angle = 0, opacity = 1 }) => {
  const h = len * 0.48;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      <rect x={-len / 2} y={-h / 2 + h * 0.1} width={len} height={h} rx={h * 0.45} fill={CAST.shirtShade} />
      <rect x={-len / 2} y={-h / 2} width={len} height={h} rx={h * 0.45} fill={CAST.shirt} />
      <rect x={-len / 2} y={-h / 2} width={len * 0.2} height={h} rx={h * 0.3} fill={CAST.shorts} />
      <rect x={len * 0.3} y={-h / 2} width={len * 0.2} height={h} rx={h * 0.3} fill={CAST.shorts} />
      <line x1={-len * 0.26} y1={0} x2={len * 0.26} y2={0} stroke={CAST.shirtShade} strokeWidth={Math.max(2, h * 0.1)} strokeLinecap="round" />
      <path d={`M${-len * 0.16},${-h * 0.08} Q0,${-h * 0.62} ${len * 0.16},${-h * 0.08}`} fill="none" stroke={PITCH.chalk} strokeWidth={Math.max(3, h * 0.13)} strokeLinecap="round" />
    </g>
  );
};

/** "SLOW MOTION" tag (34 px text) with a pulsing dot, top-left. */
export const SlowTag: React.FC<{ frame: number; at: number; until: number; bg: string; text: string; dot: string }> = ({ frame, at, until, bg, text, dot }) => {
  const i = Math.min(1, Math.max(0, (frame - at) / 12));
  const o = i * (1 - Math.min(1, Math.max(0, (frame - until) / 8)));
  if (o <= 0.001) return null;
  const pulse = 0.6 + 0.4 * Math.sin(frame / 5);
  return (
    <g opacity={o} transform="translate(64 64)">
      <rect width={362} height={70} rx={35} fill={bg} opacity={0.8} />
      <circle cx={37} cy={35} r={12} fill={dot} opacity={pulse} />
      <text x={64} y={47} fill={text} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={3}>
        SLOW MOTION
      </text>
    </g>
  );
};

/** Soft haze band just under the horizon (depth cue), drawn as a gradient rect. */
export const Haze: React.FC<{ y: number; color: string; opacity?: number; height?: number; id: string }> = ({ y, color, opacity = 0.35, height = 220, id }) => {
  if (y > 1100 || y + height < -20) return null;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={opacity} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={-50} y={y} width={2020} height={height} fill={`url(#${id})`} />
    </g>
  );
};
