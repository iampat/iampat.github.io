// Extra pieces for scenes s08-s10 (owned by the s08-s10 builder).
// Arc arrows, a chalk light bulb, an X-ray foot seen from above, air swirls and puffs,
// an effort bar, a skateboard inset, a world-space grid, the rule card (laces -> inside)
// and the curler summary diagram that s09 and s10 share across their cut.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { EASE, clamp01, pop, progress } from "../../lib/anim";
import { Player, mixPose, POSES, type Pose } from "../Player";
import { Ball } from "../Ball";
import { Arrow } from "../Graphics";
import type { View } from "../../lib/project";

const TOP_VIEW: View = { kind: "topUp", originX: 0, originY: 0, ppm: 1 };

type Pt = [number, number];

/** Smooth path through points (Catmull-Rom converted to cubic Bezier). */
export const smoothPath = (pts: Pt[], closed = true, tension = 1): string => {
  const n = pts.length;
  if (n < 2) return "";
  const get = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return closed ? `${d} Z` : d;
};

/**
 * Curved arrow along a circle around (cx, cy). Angles in degrees on screen
 * (0 = right, 90 = down). a1 < a0 draws anticlockwise as seen on screen.
 */
export const ArcArrow: React.FC<{
  cx: number;
  cy: number;
  r: number;
  a0: number;
  a1: number;
  t?: number;
  color?: string;
  width?: number;
  opacity?: number;
}> = ({ cx, cy, r, a0, a1, t = 1, color = XRAY.lime, width = 12, opacity = 1 }) => {
  const tt = clamp01(t);
  if (tt <= 0.001 || opacity <= 0.001) return null;
  const end = a0 + (a1 - a0) * tt;
  const steps = 28;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((end - a0) * i) / steps) * Math.PI) / 180;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  const ea = (end * Math.PI) / 180;
  const dir = Math.sign(a1 - a0) || 1;
  // Tangent direction of travel at the end.
  const tx = -Math.sin(ea) * dir;
  const ty = Math.cos(ea) * dir;
  const ex = cx + Math.cos(ea) * r;
  const ey = cy + Math.sin(ea) * r;
  const head = width * 2.3;
  const nx = -ty;
  const ny = tx;
  return (
    <g opacity={opacity}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={`M${ex + tx * head * 0.75},${ey + ty * head * 0.75} L${ex - tx * head * 0.45 + nx * head * 0.7},${ey - ty * head * 0.45 + ny * head * 0.7} L${ex - tx * head * 0.45 - nx * head * 0.7},${ey - ty * head * 0.45 - ny * head * 0.7} Z`}
        fill={color}
        stroke={color}
        strokeWidth={width * 0.35}
        strokeLinejoin="round"
      />
    </g>
  );
};

/** Straight arrow with a fixed head (for force arrows). len can grow and shrink. */
export const ForceArrow: React.FC<{
  x: number;
  y: number;
  angle: number; // degrees, 0 = right, 90 = down
  len: number;
  color: string;
  width?: number;
  opacity?: number;
}> = ({ x, y, angle, len, color, width = 18, opacity = 1 }) => {
  if (len <= 1 || opacity <= 0.001) return null;
  const head = width * 2.2;
  const body = Math.max(0, len - head * 0.8);
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      <rect x={0} y={-width / 2} width={body + width * 0.3} height={width} rx={width / 2} fill={color} />
      <path d={`M${len},0 L${len - head},${-head * 0.62} L${len - head},${head * 0.62} Z`} fill={color} stroke={color} strokeWidth={width * 0.3} strokeLinejoin="round" />
    </g>
  );
};

/** A chalk light bulb with rays. `s` = pop scale 0..1+, `glow` 0..1. */
export const LightBulb: React.FC<{ x: number; y: number; size: number; s: number; glow?: number; frame: number }> = ({ x, y, size, s, glow = 1, frame }) => {
  if (s <= 0.001) return null;
  const r = size * 0.5;
  const pulse = 0.85 + 0.15 * Math.sin(frame / 4);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0.95, 0.75, 0.55].map((k, i) => (
        <circle key={i} r={size * 1.3 * k} fill={PITCH.lightSoft} opacity={0.1 * glow * pulse} />
      ))}
      {Array.from({ length: 7 }, (_, i) => {
        const a = ((-90 + (i - 3) * 30) * Math.PI) / 180;
        const r0 = r * 1.35;
        const r1 = r * (1.75 + 0.12 * Math.sin(frame / 3 + i));
        return (
          <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={PITCH.chalk} strokeWidth={size * 0.08} strokeLinecap="round" opacity={glow} />
        );
      })}
      <circle r={r} fill={PITCH.lightSoft} opacity={0.35 + 0.5 * glow} />
      <circle r={r} fill="none" stroke={PITCH.chalk} strokeWidth={size * 0.09} />
      <path d={`M${-r * 0.35},${r * 0.2} L${-r * 0.12},${-r * 0.18} L${r * 0.12},${r * 0.2} L${r * 0.35},${-r * 0.18}`} fill="none" stroke={PITCH.chalk} strokeWidth={size * 0.06} strokeLinecap="round" strokeLinejoin="round" />
      <rect x={-r * 0.45} y={r * 0.88} width={r * 0.9} height={r * 0.5} rx={r * 0.16} fill={PITCH.chalk} />
      <rect x={-r * 0.3} y={r * 1.42} width={r * 0.6} height={r * 0.22} rx={r * 0.11} fill={CAST.keeperShade} />
    </g>
  );
};

/** A dashed ghost ball (the preview of a shot). */
export const GhostBall: React.FC<{ x: number; y: number; r: number; opacity?: number; color?: string }> = ({ x, y, r, opacity = 0.8, color = PITCH.chalk }) => (
  <g opacity={opacity}>
    <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={Math.max(2, r * 0.18)} strokeDasharray={`${r * 0.5} ${r * 0.35}`} />
  </g>
);

/** A pink cross that pops in (a blocked path). */
export const Cross: React.FC<{ x: number; y: number; size: number; s: number; color?: string }> = ({ x, y, size, s, color = CAST.mistake }) => {
  if (s <= 0.001) return null;
  const w = size * 0.26;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(45)`}>
      <rect x={-size / 2} y={-w / 2} width={size} height={w} rx={w / 2} fill={color} />
      <rect x={-w / 2} y={-size / 2} width={w} height={size} rx={w / 2} fill={color} />
    </g>
  );
};

/** A small flag on a pole (the aim-off point). */
export const AimFlag: React.FC<{ x: number; y: number; size: number; s: number; frame: number; color?: string }> = ({ x, y, size, s, frame, color = XRAY.lime }) => {
  if (s <= 0.001) return null;
  const wave = Math.sin(frame / 5) * size * 0.06;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-size * 0.04} y={-size} width={size * 0.08} height={size} rx={size * 0.04} fill={XRAY.bone} />
      <path d={`M${size * 0.04},${-size} Q${size * 0.3},${-size * 0.95 + wave} ${size * 0.6},${-size * 0.84} Q${size * 0.3},${-size * 0.72 - wave} ${size * 0.04},${-size * 0.66} Z`} fill={color} />
      <ellipse cx={0} cy={0} rx={size * 0.16} ry={size * 0.06} fill={XRAY.bone} opacity={0.5} />
    </g>
  );
};

// ---------------------------------------------------------------------------
// X-ray right foot seen from above. Local frame (units of foot length L):
// heel at x = 0, toes towards +x, the inside (big-toe side) towards -y (screen up).

const FOOT_OUTLINE: Pt[] = [
  [-0.05, 0.0],
  [-0.02, -0.1],
  [0.08, -0.15],
  [0.24, -0.185],
  [0.4, -0.2],
  [0.56, -0.205],
  [0.7, -0.212],
  [0.82, -0.2],
  [0.93, -0.19],
  [1.0, -0.15],
  [0.98, -0.1],
  [0.95, -0.055],
  [0.93, -0.02],
  [0.9, 0.035],
  [0.86, 0.085],
  [0.8, 0.14],
  [0.72, 0.17],
  [0.58, 0.165],
  [0.42, 0.14],
  [0.26, 0.13],
  [0.12, 0.13],
  [0.0, 0.1],
];

/** Point on the flat inside face (the plate) where the ball is struck, in units of L. */
export const FOOT_CONTACT: Pt = [0.5, -0.225];

const TOES: { base: Pt; tip: Pt; w: number }[] = [
  { base: [0.78, -0.163], tip: [0.975, -0.158], w: 0.052 },
  { base: [0.81, -0.077], tip: [0.935, -0.074], w: 0.029 },
  { base: [0.79, 0.0], tip: [0.9, 0.008], w: 0.027 },
  { base: [0.76, 0.062], tip: [0.855, 0.075], w: 0.025 },
  { base: [0.72, 0.118], tip: [0.8, 0.135], w: 0.025 },
];
const METAS: { a: Pt; b: Pt; w: number }[] = [
  { a: [0.53, -0.14], b: [0.75, -0.16], w: 0.056 },
  { a: [0.535, -0.07], b: [0.78, -0.076], w: 0.033 },
  { a: [0.53, -0.01], b: [0.76, 0.0], w: 0.031 },
  { a: [0.51, 0.045], b: [0.73, 0.06], w: 0.029 },
  { a: [0.48, 0.095], b: [0.69, 0.115], w: 0.031 },
];

export const XRayFootTop: React.FC<{
  /** Heel position (screen). */
  x: number;
  y: number;
  /** Rotation in degrees (SVG, positive = clockwise). */
  angle: number;
  /** Foot length in pixels. */
  L: number;
  /** 0..1: the foot builds (tissue then bones). */
  build?: number;
  /** 0..1: the inner arch contact zone glows. */
  glow?: number;
  /** 0..1: the flat plate on the inside face. */
  plate?: number;
  /** Show the leg's cross-section at the ankle. */
  leg?: boolean;
  /** Show a short shin stub that runs from the ankle towards the kicker (down the screen), fading out. */
  shin?: boolean;
  opacity?: number;
  frame?: number;
}> = ({ x, y, angle, L, build = 1, glow = 0, plate = 0, leg = true, shin = false, opacity = 1, frame = 0 }) => {
  const b = clamp01(build);
  const tissueS = clamp01(b / 0.4);
  const boneT = (i: number, n: number) => clamp01((b - 0.3 - (i / n) * 0.5) / 0.2);
  const outline = smoothPath(FOOT_OUTLINE.map(([u, v]) => [u * L, v * L]));
  const bw = L * 0.03;
  const bones: React.ReactNode[] = [];
  const boneLine = (a: Pt, c: Pt, w: number, key: string, t: number) =>
    t > 0.001 ? (
      <line key={key} x1={a[0] * L} y1={a[1] * L} x2={(a[0] + (c[0] - a[0]) * t) * L} y2={(a[1] + (c[1] - a[1]) * t) * L} stroke={XRAY.bone} strokeWidth={w * L} strokeLinecap="round" />
    ) : null;
  const blob = (cx: number, cy: number, rx: number, ry: number, key: string, t: number, rot = 0) =>
    t > 0.001 ? <ellipse key={key} cx={cx * L} cy={cy * L} rx={rx * L * t} ry={ry * L * t} fill={XRAY.bone} transform={`rotate(${rot} ${cx * L} ${cy * L})`} /> : null;
  // Heel and midfoot bones.
  bones.push(blob(0.13, 0.01, 0.14, 0.092, "calc", boneT(0, 10), 4));
  bones.push(blob(0.3, -0.05, 0.08, 0.07, "talus", boneT(1, 10)));
  bones.push(blob(0.41, -0.1, 0.04, 0.055, "nav", boneT(2, 10)));
  bones.push(blob(0.42, 0.075, 0.055, 0.05, "cub", boneT(2, 10)));
  bones.push(blob(0.49, -0.135, 0.032, 0.032, "cu1", boneT(3, 10)));
  bones.push(blob(0.495, -0.07, 0.027, 0.027, "cu2", boneT(3, 10)));
  bones.push(blob(0.49, -0.012, 0.027, 0.027, "cu3", boneT(3, 10)));
  METAS.forEach((m, i) => bones.push(boneLine(m.a, m.b, m.w, `m${i}`, boneT(4 + i * 0.4, 10))));
  TOES.forEach((t, i) => {
    const tt = boneT(6 + i * 0.5, 10);
    const n = i === 0 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      const a: Pt = [t.base[0] + ((t.tip[0] - t.base[0]) * k) / n, t.base[1] + ((t.tip[1] - t.base[1]) * k) / n];
      const c: Pt = [t.base[0] + ((t.tip[0] - t.base[0]) * (k + 0.82)) / n, t.base[1] + ((t.tip[1] - t.base[1]) * (k + 0.82)) / n];
      bones.push(boneLine(a, c, t.w * (1 - k * 0.12), `t${i}-${k}`, clamp01(tt * n - k)));
    }
  });
  const g = clamp01(glow);
  const pl = clamp01(plate);
  const shimmer = 0.8 + 0.2 * Math.sin(frame / 5);
  // Shin stub (units of L): from the ankle, a little back and down the screen.
  const SA: Pt = [0.27, -0.02];
  const SD: Pt = [-0.119, 0.993];
  const SN: Pt = [SD[1], -SD[0]];
  const SE: Pt = [SA[0] + SD[0] * 0.62, SA[1] + SD[1] * 0.62];
  const sp = (p: Pt, n: number): string => `${((p[0] + SN[0] * n) * L).toFixed(1)},${((p[1] + SN[1] * n) * L).toFixed(1)}`;
  const shinT = `xray-shin-t-${Math.round(L)}`;
  const shinB = `xray-shin-b-${Math.round(L)}`;
  const boneLen = clamp01((b - 0.3) / 0.4);
  const bonePt = (n: number, t: number): Pt => [SA[0] + SN[0] * n + SD[0] * 0.62 * t, SA[1] + SN[1] * n + SD[1] * 0.62 * t];
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      {shin && tissueS > 0.001 ? (
        <g opacity={tissueS}>
          <defs>
            <linearGradient id={shinT} gradientUnits="userSpaceOnUse" x1={SA[0] * L} y1={SA[1] * L} x2={SE[0] * L} y2={SE[1] * L}>
              <stop offset="0" stopColor={XRAY.tissue} stopOpacity={0.5} />
              <stop offset="0.55" stopColor={XRAY.tissue} stopOpacity={0.32} />
              <stop offset="1" stopColor={XRAY.tissue} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={shinB} gradientUnits="userSpaceOnUse" x1={SA[0] * L} y1={SA[1] * L} x2={SE[0] * L} y2={SE[1] * L}>
              <stop offset="0" stopColor={XRAY.bone} stopOpacity={1} />
              <stop offset="0.6" stopColor={XRAY.bone} stopOpacity={0.7} />
              <stop offset="1" stopColor={XRAY.bone} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`M${sp(SA, 0.125)} L${sp(SE, 0.145)} L${sp(SE, -0.145)} L${sp(SA, -0.125)} Z`} fill={`url(#${shinT})`} />
          {boneLen > 0.001 ? (
            <g stroke={`url(#${shinB})`} strokeLinecap="round" fill="none">
              {/* Shin bone (thick) and the thin outer bone. */}
              <line x1={bonePt(0.035, 0)[0] * L} y1={bonePt(0.035, 0)[1] * L} x2={bonePt(0.035, boneLen)[0] * L} y2={bonePt(0.035, boneLen)[1] * L} strokeWidth={0.075 * L} />
              <line x1={bonePt(-0.07, 0.04)[0] * L} y1={bonePt(-0.07, 0.04)[1] * L} x2={bonePt(-0.07, boneLen)[0] * L} y2={bonePt(-0.07, boneLen)[1] * L} strokeWidth={0.036 * L} />
            </g>
          ) : null}
        </g>
      ) : null}
      <g transform={`translate(${L * 0.45} 0) scale(${tissueS}) translate(${-L * 0.45} 0)`} opacity={tissueS}>
        <path d={outline} fill={XRAY.tissue} opacity={0.5} />
        <path d={outline} fill="none" stroke={XRAY.bone} strokeWidth={L * 0.008} opacity={0.35} />
      </g>
      {/* Contact zone along the inner arch. */}
      {g > 0.001 ? (
        <g opacity={g}>
          <line x1={0.26 * L} y1={-0.205 * L} x2={0.74 * L} y2={-0.215 * L} stroke={XRAY.lime} strokeWidth={L * 0.12} strokeLinecap="round" opacity={0.26 * shimmer} />
          <line x1={0.3 * L} y1={-0.205 * L} x2={0.7 * L} y2={-0.215 * L} stroke={XRAY.lime} strokeWidth={L * 0.055} strokeLinecap="round" opacity={0.6 * shimmer} />
        </g>
      ) : null}
      <g>{bones}</g>
      {leg ? (
        <g opacity={tissueS}>
          <circle cx={0.27 * L} cy={-0.02 * L} r={0.13 * L} fill={XRAY.tissue} opacity={0.35} />
          <circle cx={0.27 * L} cy={-0.02 * L} r={0.13 * L} fill="none" stroke={XRAY.bone} strokeWidth={L * 0.006} opacity={0.3} />
          {boneT(1, 10) > 0.01 ? (
            <g>
              <circle cx={0.28 * L} cy={-0.055 * L} r={0.05 * L * boneT(1, 10)} fill="none" stroke={XRAY.bone} strokeWidth={bw * 0.9} />
              <circle cx={0.25 * L} cy={0.06 * L} r={0.024 * L * boneT(1, 10)} fill="none" stroke={XRAY.bone} strokeWidth={bw * 0.6} />
            </g>
          ) : null}
        </g>
      ) : null}
      {/* The firm, flat face: a plate along the inside of the foot. */}
      {pl > 0.001 ? (
        <g transform={`translate(${0.5 * L} ${-0.228 * L}) scale(${pl} 1) translate(${-0.5 * L} ${0.228 * L})`} opacity={clamp01(pl * 2)}>
          <rect x={0.27 * L} y={-0.248 * L} width={0.46 * L} height={0.04 * L} rx={0.02 * L} fill={XRAY.lime} />
        </g>
      ) : null}
    </g>
  );
};

/** Screen point of a foot-local point (units of L) for a foot drawn at (x, y, angle, L). */
export const footPoint = (x: number, y: number, angle: number, L: number, p: Pt) => {
  const a = (angle * Math.PI) / 180;
  const u = p[0] * L;
  const v = p[1] * L;
  return { x: x + u * Math.cos(a) - v * Math.sin(a), y: y + u * Math.sin(a) + v * Math.cos(a) };
};

// ---------------------------------------------------------------------------

/** A small swirl (an eddy in the air). spin > 0 turns clockwise on screen. */
export const Swirl: React.FC<{ x: number; y: number; r: number; angle: number; opacity: number; color?: string }> = ({ x, y, r, angle, opacity, color = XRAY.air }) => {
  if (opacity <= 0.001) return null;
  const pts: Pt[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const a = t * Math.PI * 3.2;
    const rr = r * (0.15 + 0.85 * t);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      <path d={smoothPath(pts, false)} fill="none" stroke={color} strokeWidth={Math.max(3, r * 0.22)} strokeLinecap="round" />
    </g>
  );
};

/** A pink bump puff: a small burst that grows and fades over `life` frames. */
export const Puff: React.FC<{ x: number; y: number; r: number; t: number; seed: string }> = ({ x, y, r, t, seed }) => {
  if (t <= 0 || t >= 1) return null;
  const grow = 0.4 + 0.8 * Math.sin(Math.min(1, t * 1.6) * (Math.PI / 2));
  const o = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
  return (
    <g transform={`translate(${x} ${y})`} opacity={o}>
      <circle r={r * grow * 0.7} fill={XRAY.pink} opacity={0.9} />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 + random(`${seed}-${i}`) * 0.8;
        const d = r * (0.6 + 0.9 * t);
        return <circle key={i} cx={Math.cos(a) * d} cy={Math.sin(a) * d} r={r * 0.28 * (1 - t * 0.6)} fill={XRAY.pink} />;
      })}
    </g>
  );
};

/** An effort bar split between SPEED and SPIN. No digits. spinFrac 0..1. */
export const EffortBar: React.FC<{ x: number; y: number; w: number; spinFrac: number; opacity: number }> = ({ x, y, w, spinFrac, opacity }) => {
  if (opacity <= 0.001) return null;
  const h = 44;
  const gap = 8;
  const speedW = Math.max(h, (w - gap) * (1 - spinFrac));
  const spinW = Math.max(h, w - gap - speedW);
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <rect x={-18} y={-92} width={w + 36} height={h + 118} rx={36} fill={XRAY.bg} opacity={0.88} />
      <rect x={0} y={0} width={speedW} height={h} rx={h / 2} fill={XRAY.bone} />
      <rect x={speedW + gap} y={0} width={spinW} height={h} rx={h / 2} fill={XRAY.lime} />
      <text x={speedW / 2} y={-22} fill={XRAY.bone} fontFamily={FONTS.hud} fontWeight={700} fontSize={36} textAnchor="middle" letterSpacing={3}>
        SPEED
      </text>
      <text x={speedW + gap + spinW / 2} y={-22} fill={XRAY.lime} fontFamily={FONTS.hud} fontWeight={700} fontSize={36} textAnchor="middle" letterSpacing={3}>
        SPIN
      </text>
    </g>
  );
};

/** Grid lines in world space around the camera centre (so camera moves read as motion). */
export const WorldGrid: React.FC<{ cx: number; cy: number; zoom: number; step?: number; opacity?: number }> = ({ cx, cy, zoom, step = 60, opacity = 1 }) => {
  const halfW = WIDTH / 2 / zoom + step * 2;
  const halfH = HEIGHT / 2 / zoom + step * 2;
  const x0 = Math.floor((cx - halfW) / step) * step;
  const x1 = Math.ceil((cx + halfW) / step) * step;
  const y0 = Math.floor((cy - halfH) / step) * step;
  const y1 = Math.ceil((cy + halfH) / step) * step;
  const lines: React.ReactNode[] = [];
  for (let x = x0; x <= x1; x += step) lines.push(<line key={`x${x}`} x1={x} y1={y0} x2={x} y2={y1} />);
  for (let y = y0; y <= y1; y += step) lines.push(<line key={`y${y}`} x1={x0} y1={y} x2={x1} y2={y} />);
  return (
    <g opacity={opacity}>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={XRAY.bg} />
      <g stroke={XRAY.grid} strokeWidth={2 / Math.max(0.5, zoom)}>{lines}</g>
    </g>
  );
};

// ---------------------------------------------------------------------------

const THROW: Pose = { ...POSES.hold, nearShoulder: 95, nearElbow: 0, farShoulder: 88, farElbow: 4, torso: 8 };
const WIND: Pose = { ...POSES.hold, nearShoulder: 30, nearElbow: 70, farShoulder: 25, farElbow: 75, torso: -6 };

/**
 * Inset: Tavi on a skateboard throws a heavy air-blue ball to the right and rolls to the left.
 * Screen-space panel. `throwAt` = release frame.
 */
export const SkateInset: React.FC<{ x: number; y: number; w: number; h: number; at: number; throwAt: number; until: number }> = ({ x, y, w, h, at, throwAt, until }) => {
  const frame = useCurrentFrame();
  const inT = progress(frame, at, 14, EASE.enter);
  const outT = progress(frame, until, 8, EASE.exit);
  const s = pop(frame, at, { stiffness: 180, damping: 15 }) * (1 - outT);
  if (inT <= 0.001 || outT >= 0.999) return null;
  const floorY = h - 70;
  const H = h * 0.55;
  const t = frame - throwAt; // frames since release
  // Rolling: the board starts at rest and rolls left, slowing down (rolling friction).
  const v0 = 6.5; // px per frame just after the throw
  const decel = 0.11;
  const tr = Math.max(0, Math.min(t, v0 / decel));
  const roll = t > 0 ? -(v0 * tr - 0.5 * decel * tr * tr) : 0;
  const px = w * 0.5 + roll;
  const pose =
    t < -14 ? POSES.hold : t < -2 ? mixPose(POSES.hold, WIND, (t + 14) / 12) : t < 6 ? mixPose(WIND, THROW, (t + 2) / 8) : mixPose(THROW, POSES.stand, clamp01((t - 16) / 20));
  // Heavy ball: held, then thrown right on a low parabola (constant speed, gravity down).
  const handX = px + H * 0.32;
  const handY = floorY - H * 0.72;
  const bvx = 13;
  const bvy = -4;
  const g = 0.45;
  const bx = t < 0 ? handX + (t > -14 ? -((t + 14) / 12) * H * 0.2 : 0) : handX + bvx * t;
  const by = t < 0 ? handY : Math.min(floorY - 26, handY + bvy * t + 0.5 * g * t * t);
  const arrowsOn = progress(frame, throwAt + 2, 10, EASE.enter);
  const wheelA = (roll / 12) * (180 / Math.PI);
  return (
    <g transform={`translate(${x + w / 2} ${y + h / 2}) scale(${s}) translate(${-w / 2} ${-h / 2})`}>
      <defs>
        <clipPath id="s10-skate-clip">
          <rect x={0} y={0} width={w} height={h} rx={40} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={w} height={h} rx={40} fill="#0B2E3A" />
      <g clipPath="url(#s10-skate-clip)">
        <rect x={0} y={floorY + 16} width={w} height={h} fill={XRAY.grid} />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={((i * 90 - roll * 0.0) % (w + 90)) - 40} y={floorY + 34} width={46} height={8} rx={4} fill={XRAY.tissue} opacity={0.5} />
        ))}
        {/* Board. */}
        <g transform={`translate(${px} ${floorY})`}>
          <rect x={-H * 0.3} y={-6} width={H * 0.6} height={12} rx={6} fill={CAST.band} />
          {[-H * 0.2, H * 0.2].map((wx, i) => (
            <g key={i} transform={`translate(${wx} 14) rotate(${wheelA})`}>
              <circle r={10} fill={XRAY.bone} />
              <rect x={-2} y={-8} width={4} height={8} fill={XRAY.bg} />
            </g>
          ))}
        </g>
        <Player x={px} groundY={floorY - 7} h={H} pose={pose} face={t > -4 && t < 20 ? "focus" : "neutral"} />
        <circle cx={bx} cy={by} r={26} fill={XRAY.air} />
        <circle cx={bx - 8} cy={by - 5} r={4} fill={XRAY.bg} />
        <circle cx={bx + 8} cy={by - 5} r={4} fill={XRAY.bg} />
        {arrowsOn > 0.01 ? (
          <g opacity={arrowsOn}>
            <ForceArrow x={px - H * 0.34} y={floorY + 50} angle={180} len={110 * arrowsOn} color={XRAY.ball} width={14} />
            {t < 30 ? <ForceArrow x={bx + 34} y={by} angle={0} len={80 * arrowsOn} color={XRAY.air} width={12} opacity={1 - progress(frame, throwAt + 22, 8)} /> : null}
          </g>
        ) : null}
      </g>
    </g>
  );
};

/** Small grass tufts and a soft floodlight pool, so flat grass has texture. World-space rect. */
export const GrassDetail: React.FC<{ x: number; y: number; w: number; h: number; count?: number; seed?: string; pool?: { cx: number; cy: number; r: number } }> = ({
  x,
  y,
  w,
  h,
  count = 140,
  seed = "grass",
  pool,
}) => {
  const gid = `pool-${seed}`;
  return (
    <g>
      {pool ? (
        <>
          <defs>
            <radialGradient id={gid}>
              <stop offset="0" stopColor={PITCH.lightSoft} stopOpacity={0.13} />
              <stop offset="0.6" stopColor={PITCH.lightSoft} stopOpacity={0.05} />
              <stop offset="1" stopColor={PITCH.lightSoft} stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle cx={pool.cx} cy={pool.cy} r={pool.r} fill={`url(#${gid})`} />
        </>
      ) : null}
      {Array.from({ length: count }, (_, i) => {
        const tx = x + random(`${seed}-x-${i}`) * w;
        const ty = y + random(`${seed}-y-${i}`) * h;
        const s = 6 + random(`${seed}-s-${i}`) * 8;
        const light = random(`${seed}-c-${i}`) > 0.5;
        return (
          <path
            key={i}
            d={`M${tx - s * 0.6},${ty} L${tx - s * 0.2},${ty - s} M${tx},${ty} L${tx + s * 0.1},${ty - s * 1.2} M${tx + s * 0.5},${ty} L${tx + s * 0.7},${ty - s * 0.9}`}
            stroke={light ? PITCH.grassLight : "#0B4A38"}
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={0.55}
          />
        );
      })}
    </g>
  );
};

// ---------------------------------------------------------------------------
// Rule card (s08 end -> s09 start): a slate card that flips from the chapter 1
// laces icon to the inside-of-foot icon. Flat shapes only.

const SLATE = "#0E3542";
const rotP = (p: Pt, deg: number, o: Pt = [0, 0]): Pt => {
  const a = (deg * Math.PI) / 180;
  const x = p[0] - o[0];
  const y = p[1] - o[1];
  return [o[0] + x * Math.cos(a) - y * Math.sin(a), o[1] + x * Math.sin(a) + y * Math.cos(a)];
};

// Boot, side view, toes to the right, sole on y = 0.
const BOOT: Pt[] = [
  [-150, 0],
  [-152, -44],
  [-142, -96],
  [-120, -128],
  [-64, -128],
  [-42, -102],
  [10, -74],
  [70, -54],
  [122, -42],
  [152, -24],
  [160, 0],
];
const BOOT_TILT = 28; // toes pointing down (laces drive)
const BOOT_PIVOT: Pt = [0, -60];

const LacesIcon: React.FC = () => {
  const pts = BOOT.map((p) => rotP(p, BOOT_TILT, BOOT_PIVOT));
  const sole = [rotP([-150, 0], BOOT_TILT, BOOT_PIVOT), rotP([160, 0], BOOT_TILT, BOOT_PIVOT)];
  // The laces strip along the top of the foot.
  const lace: Pt[] = [
    [-40, -98],
    [12, -71],
    [70, -51],
  ].map((p) => rotP(p as Pt, BOOT_TILT, BOOT_PIVOT));
  const d0 = rotP([110, 48], BOOT_TILT); // direction of the laces slope
  const dl = Math.hypot(d0[0], d0[1]);
  const n: Pt = [d0[1] / dl, -d0[0] / dl]; // outward normal (up and to the right)
  const contact = rotP([28, -66], BOOT_TILT, BOOT_PIVOT);
  const br = 54;
  const ball: Pt = [contact[0] + n[0] * (br + 12), contact[1] + n[1] * (br + 12)];
  return (
    <g transform="translate(-40 -10)">
      <path d={smoothPath(pts, true, 0.9)} fill={PITCH.chalk} />
      <line x1={sole[0][0]} y1={sole[0][1] + 8} x2={sole[1][0]} y2={sole[1][1] + 8} stroke={CAST.bootShade} strokeWidth={16} strokeLinecap="round" />
      <polyline points={lace.map((p) => p.join(",")).join(" ")} fill="none" stroke={CAST.band} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" />
      {[0.15, 0.4, 0.65, 0.9].map((t, i) => {
        const a = lace[0];
        const b = lace[2];
        const cx = a[0] + (b[0] - a[0]) * t;
        const cy = a[1] + (b[1] - a[1]) * t + (i === 1 || i === 2 ? -4 : 0);
        return <line key={i} x1={cx - n[0] * 12} y1={cy - n[1] * 12} x2={cx + n[0] * 12} y2={cy + n[1] * 12} stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" />;
      })}
      <circle cx={ball[0]} cy={ball[1]} r={br} fill={CAST.ball} />
      <circle cx={ball[0] + br * 0.2} cy={ball[1] + br * 0.2} r={br * 0.8} fill={CAST.ballShade} opacity={0.35} />
    </g>
  );
};

const InsideIcon: React.FC = () => {
  const L = 340;
  const hx = -170;
  const hy = 44;
  const outline = smoothPath(FOOT_OUTLINE.map(([u, v]) => [hx + u * L, hy + v * L]));
  const br = 54;
  const c = { x: hx + FOOT_CONTACT[0] * L, y: hy + FOOT_CONTACT[1] * L };
  return (
    <g>
      <path d={outline} fill={PITCH.chalk} />
      {/* The same boot seen from above: sock at the ankle, laces down the middle (not lit this time). */}
      <ellipse cx={hx + 0.19 * L} cy={hy - 0.01 * L} rx={0.1 * L} ry={0.08 * L} fill={CAST.sock} />
      <line x1={hx + 0.33 * L} y1={hy - 0.01 * L} x2={hx + 0.64 * L} y2={hy - 0.02 * L} stroke={CAST.bootShade} strokeWidth={0.07 * L} strokeLinecap="round" />
      {[0.38, 0.46, 0.54, 0.62].map((u, i) => (
        <line key={i} x1={hx + u * L} y1={hy - 0.05 * L} x2={hx + u * L} y2={hy + 0.02 * L} stroke={PITCH.chalk} strokeWidth={5} strokeLinecap="round" />
      ))}
      <line x1={hx + 0.3 * L} y1={hy - 0.208 * L} x2={hx + 0.72 * L} y2={hy - 0.216 * L} stroke={XRAY.lime} strokeWidth={24} strokeLinecap="round" />
      <circle cx={c.x} cy={c.y - br - 12} r={br} fill={CAST.ball} />
      <circle cx={c.x + br * 0.2} cy={c.y - br - 12 + br * 0.2} r={br * 0.8} fill={CAST.ballShade} opacity={0.35} />
    </g>
  );
};

/**
 * Slate card that flips from "laces" (chapter 1) to "inside" (chapter 2).
 * flip 0 = laces side, 1 = inside side. `t` = a frame count that runs across scenes (for the idle bob).
 */
export const RuleCard: React.FC<{ x: number; y: number; s: number; flip: number; t: number }> = ({ x, y, s, flip, t }) => {
  if (s <= 0.001) return null;
  const f = clamp01(flip);
  const sx = Math.cos(Math.PI * f);
  const back = sx < 0;
  const lift = 1 + 0.07 * Math.sin(Math.PI * f);
  const bob = Math.sin(((t / 30) * 2 * Math.PI) / 3.2) * 6;
  const tilt = Math.sin(((t / 30) * 2 * Math.PI) / 4.1 + 1) * 1.2;
  const W = 600;
  const H = 540;
  const num = back ? "2" : "1";
  const word = back ? "inside" : "laces";
  const badge = back ? XRAY.lime : CAST.band;
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s}) rotate(${tilt}) scale(${Math.max(0.002, Math.abs(sx)) * lift} ${lift})`}>
      <rect x={-W / 2 + 12} y={-H / 2 + 18} width={W} height={H} rx={48} fill="#021016" opacity={0.45} />
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={48} fill={SLATE} />
      <circle cx={-W / 2 + 70} cy={-H / 2 + 70} r={38} fill={badge} />
      <text x={-W / 2 + 70} y={-H / 2 + 86} fill={XRAY.bg} fontFamily={FONTS.title} fontWeight={800} fontSize={46} textAnchor="middle">
        {num}
      </text>
      <g transform={back ? "translate(0 -20) scale(1.08)" : "translate(12 -4) scale(1.12)"}>{back ? <InsideIcon /> : <LacesIcon />}</g>
      <text x={0} y={H / 2 - 56} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={66} textAnchor="middle">
        {word}
      </text>
    </g>
  );
};

// ---------------------------------------------------------------------------
// The curler summary diagram (s09 end -> s10 start). World pixels, the goal is up the screen.

export const CURL_D = {
  C: { x: 900, y: 470 }, // ball centre
  R: 170, // ball radius (22 cm)
  FL: 430, // foot length (about 26 cm at the same scale)
  PHI0: 15, // contact angle from the back of the ball towards the right: "just right of centre"
  PHI1: 36, // contact slid further out: more spin, less speed
  LAUNCH: { x: Math.sin((8 * Math.PI) / 180), y: -Math.cos((8 * Math.PI) / 180) }, // starts 8 deg right (aim-off)
  FLAG_D: 330,
  /** s09 summary camera (world px). */
  CAM: { x: 950, y: 470, zoom: 1.02 },
  LINE_N: { x: 0.92, y: 0.25, z: 0.3 },
};

export type FootPlace = { x: number; y: number; angle: number; P: { x: number; y: number }; n: { x: number; y: number }; w: { x: number; y: number } };

/** Foot placement for a contact angle phi (deg): the flat inside face touches the ball at P. */
export const placeFoot = (phi: number, slide = 0): FootPlace => {
  const { C, R, FL } = CURL_D;
  const f = (phi * Math.PI) / 180;
  const P = { x: C.x + R * Math.sin(f), y: C.y + R * Math.cos(f) };
  const n = { x: -Math.sin(f), y: -Math.cos(f) }; // from P towards the ball centre
  const angle = -phi;
  const a = (angle * Math.PI) / 180;
  const u = FOOT_CONTACT[0] * FL;
  const v = FOOT_CONTACT[1] * FL;
  const x = P.x - (u * Math.cos(a) - v * Math.sin(a));
  const y = P.y - (u * Math.sin(a) + v * Math.cos(a));
  // The sweep path: forward and to the right, 45 deg to the face of the foot.
  const wa = a - Math.PI / 4;
  const w = { x: Math.cos(wa), y: Math.sin(wa) };
  return { x: x + w.x * slide, y: y + w.y * slide, angle, P, n, w };
};

type CueLike = ((phrase: string, offsetFrames?: number) => number) & { frames: number };

/** A frame that never comes (keeps `progress` finite when a beat is skipped). */
const NEVER = 1e6;

/**
 * s09 end beats, shared with s10 so that the cut between them matches frame for frame.
 * The diagram mirrors on "Left-footed?" and flips back on "Flip it". Then it clears
 * (outAt), so s10 opens on the ball alone. The short hold (the dot slides out, the
 * SPEED/SPIN bar and its label) plays only when the scene has a tail long enough for it.
 */
export const s09Beats = (cue: CueLike) => {
  const tLeft = cue("Left-footed");
  const tFlip = cue("Flip it");
  const end = cue.frames;
  const mirrorAt = tLeft + 4;
  const unmirrorAt = tFlip - 2;
  const settled = unmirrorAt + 12;
  const outAt = end - 9; // clear by the second-last frame
  // About 0.8 s of hold is the least a viewer needs to read the label (needs a tail of 30+ frames).
  const coda = outAt - settled >= 24;
  const codaAt = coda ? settled - 2 : NEVER;
  return {
    tLeft,
    tFlip,
    sumIn: tLeft - 4,
    mirrorAt,
    unmirrorAt,
    coda,
    codaAt,
    labelAt: codaAt + 4,
    outAt,
    end,
  };
};
export type S09Beats = ReturnType<typeof s09Beats>;

const spinKAt = (frame: number, b: S09Beats) => progress(frame, b.codaAt, 16, EASE.standard);

/** Ball spin angle of the summary diagram (continues into s10 at 0.06 rad per frame). */
export const summarySpin = (frame: number, b: S09Beats) => {
  let a = 0;
  for (let f = b.sumIn; f < frame; f++) a += 0.03 * (1 + spinKAt(f, b));
  return a;
};

export type SummaryState = { phi: number; spinK: number; m: number; flagO: number; speedO: number; barO: number; outO: number; spin: number };

export const summaryState = (frame: number, b: S09Beats): SummaryState => {
  const flipT = progress(frame, b.mirrorAt, 12, EASE.standard) - progress(frame, b.unmirrorAt, 12, EASE.standard);
  const spinK = spinKAt(frame, b);
  const outO = 1 - progress(frame, b.outAt, 7, EASE.exit);
  return {
    phi: CURL_D.PHI0 + (CURL_D.PHI1 - CURL_D.PHI0) * spinK,
    spinK,
    m: Math.cos(Math.PI * flipT),
    flagO: 1 - progress(frame, b.codaAt - 2, 8, EASE.exit),
    speedO: progress(frame, b.codaAt - 2, 8, EASE.enter),
    barO: progress(frame, b.codaAt, 10, EASE.enter) * outO,
    outO,
    spin: summarySpin(frame, b),
  };
};

/**
 * The summary diagram in world pixels: flag, speed arrow, ball, sweep arrow, contact dot, foot, spin arc.
 * `out` fades everything but the ball. `ballS` scales the ball (a pop), so the ball stays full orange.
 */
export const CurlerDiagram: React.FC<{ st: SummaryState; frame: number; showBall?: boolean; out?: number; ballS?: number }> = ({
  st,
  frame,
  showBall = true,
  out = 1,
  ballS = 1,
}) => {
  const { C, R, FL, LAUNCH, FLAG_D, LINE_N } = CURL_D;
  const foot = placeFoot(st.phi);
  const flag = { x: C.x + LAUNCH.x * FLAG_D, y: C.y + LAUNCH.y * FLAG_D };
  const a0 = { x: foot.P.x - foot.w.x * 60, y: foot.P.y - foot.w.y * 60 };
  const a1 = { x: foot.P.x + foot.w.x * 250, y: foot.P.y + foot.w.y * 250 };
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  const speedLen = 230 - 110 * st.spinK;
  return (
    <g transform={`translate(${C.x} 0) scale(${st.m} 1) translate(${-C.x} 0)`}>
      <AimFlag x={flag.x} y={flag.y} size={120} s={st.flagO * out} frame={frame} />
      <ForceArrow
        x={C.x + LAUNCH.x * (R + 24)}
        y={C.y + LAUNCH.y * (R + 24)}
        angle={(Math.atan2(LAUNCH.y, LAUNCH.x) * 180) / Math.PI}
        len={speedLen}
        color={XRAY.bone}
        width={18}
        opacity={st.speedO * out}
      />
      {showBall && ballS > 0.001 ? (
        <g transform={`translate(${C.x} ${C.y}) scale(${ballS}) translate(${-C.x} ${-C.y})`}>
          <Ball cx={C.x} cy={C.y} r={R} view={TOP_VIEW} axis={{ x: 0, y: 0, z: 1 }} angle={st.spin} lineNormal={LINE_N} showBack />
        </g>
      ) : null}
      {out > 0.001 ? (
        <g opacity={out}>
          <Arrow x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} at={-1000} dur={1} color={XRAY.lime} width={12} curve={-0.12} />
          <circle cx={foot.P.x} cy={foot.P.y} r={30 + 6 * pulse} fill="none" stroke={XRAY.lime} strokeWidth={6} />
          <circle cx={foot.P.x} cy={foot.P.y} r={13} fill={XRAY.bone} />
          <XRayFootTop x={foot.x} y={foot.y} angle={foot.angle} L={FL} glow={0.5} plate={1} frame={frame} shin />
          <ArcArrow cx={C.x} cy={C.y} r={R + 52} a0={-5} a1={-175 - 30 * st.spinK} width={14 + 8 * st.spinK} />
        </g>
      ) : null}
    </g>
  );
};

/** Screen placement of the effort bar and its label (shared by s09 and s10). */
export const CODA_UI = { barX: 1290, barY: 880, barW: 520, labelX: 1550, labelY: 732 };
