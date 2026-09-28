// Shared pieces for the SHAPE chapter map scenes (b13, b14, b15): one map world (Tavi's mark at a
// fixed world pixel, Sam 12 m behind her, the goal 26 m ahead), the dark half of the pitch behind
// the eyes, grey "blur" blobs with radar pings, chalk stance marks (footprints, chest arrow, arms
// out, half circle), the stopwatch dial, the run-and-turn inset and the thumb inset.
// Owned by the b13-b15 builder. Other scenes must not import this file.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { TopField } from "../Field";
import { GoalTop } from "../Goal";
import { TopPlayer } from "../TopPlayer";
import { Player, POSES, solve, type Pose } from "../Player";
import { Floodlight, Glow, GroundSide, Sky, Stands, Stars } from "../World";
import { popT, trim } from "../ep2/chalk";
import { CHALK_START } from "../../physics/ep2sims";
import { CHASE_SPEED } from "../../physics/touch";
import { EASE, clamp01, idle, pop, progress } from "../../lib/anim";
import type { View } from "../../lib/project";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";

// ---------- The map world ----------

/** World pixels per metre on the map. */
export const MAP_PPM = 30;
/** Tavi's mark (sim origin) in world pixels. */
export const TAVI_PX = { x: 900, y: 560 };
/** The goal line is this far on the goal side of Tavi's mark (metres). */
export const GOAL_M = 26;
const TAVI_PITCH_X = 105 - GOAL_M;
export const MAP_VIEW: View = { kind: "top", originX: TAVI_PX.x - TAVI_PITCH_X * MAP_PPM, originY: TAVI_PX.y, ppm: MAP_PPM };
/** Sim metres (Tavi's mark at the origin, +x towards the goal, +y left) to world pixels. */
export const M = (x: number, y: number) => ({ x: TAVI_PX.x + x * MAP_PPM, y: TAVI_PX.y - y * MAP_PPM });
/** Token shoulder width in world pixels (about 55 px on screen at the widest framing). */
export const TOKEN = 46;
/** The grey of what the side of the eye sees: shapes without colour. */
export const BLUR_GREY = "#9AA0AC";
/** Everything the eyes cover, and the sharp centre, in this episode (verified 214 and 5 degrees). */
export const WIDE_DEG = 200;
export const SHARP_DEG = 5;

export type Cam = { x: number; y: number; zoom: number };
/** Framing at the b13 -> b14 cut and at the b14 -> b15 cut, so the neighbouring frames match. */
export const CAM_B13_END: Cam = { x: 1000, y: 560, zoom: 1.2 };
export const CAM_B14_END: Cam = { x: 1090, y: 552, zoom: 1.35 };
export const camTransform = (c: Cam) => `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${c.zoom}) translate(${-c.x} ${-c.y})`;
/** World pixels to screen pixels under a camera. */
export const toScreen = (c: Cam, p: { x: number; y: number }) => ({ x: WIDTH / 2 + (p.x - c.x) * c.zoom, y: HEIGHT / 2 + (p.y - c.y) * c.zoom });

/** Screen angle (degrees) from a to b. */
export const angleDeg = (a: { x: number; y: number }, b: { x: number; y: number }) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
/** Smallest signed difference between two angles, degrees (-180..180). */
export const angleDiff = (a: number, b: number) => {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};
/**
 * 1 when a target sits inside the sharp wedge pointed at `eyes`, fading to 0 a few degrees outside it.
 * `targetHalfDeg` is half the target's own angular width (a near player fills more of the wedge).
 */
export const sharpness = (eyesDeg: number, targetDeg: number, sharpDeg = SHARP_DEG, soft = 3, targetHalfDeg = 0) => {
  const off = Math.abs(angleDiff(eyesDeg, targetDeg));
  return clamp01(1 - (off - sharpDeg / 2 - targetHalfDeg) / soft);
};
/** Half the angular width (degrees) of a token `radiusPx` wide seen from `distPx` away. */
export const halfAngleDeg = (distPx: number, radiusPx: number) => (Math.atan2(radiusPx, Math.max(1, distPx)) * 180) / Math.PI;
/** 1 inside the wide fan, 0 in the dark behind it, soft over a few degrees at the edge. */
export const fanLit = (eyesDeg: number, targetDeg: number, wideDeg = WIDE_DEG, soft = 8) => clamp01((wideDeg / 2 + 3 - Math.abs(angleDiff(eyesDeg, targetDeg))) / soft);

// ---------- Chalk's hand-off between b13 and b14 (sim metres) ----------

/** b13: Chalk jogs 6 m along the fan's edge, from the dark into the dim fan, and rests here. */
export const CHALK_B13_JOG = { from: { x: 4, y: -6.5 }, metres: 6 };
export const CHALK_B13_REST = { x: CHALK_B13_JOG.from.x - CHALK_B13_JOG.metres, y: CHALK_B13_JOG.from.y };
/** Frames before the b13 cut where he starts jogging on to his mark; b14 continues the same jog. */
export const HANDOFF_TAIL = 12;
/** The radar ping for that last jog starts this many frames after it; b14 draws the same ping at `HANDOFF_PING - HANDOFF_TAIL`. */
export const HANDOFF_PING = 3;
/** Chalk `t` seconds into the jog from his b13 rest to his mark (CHALK_START), at CHASE_SPEED. */
export const chalkHandoff = (t: number) => {
  const dx = CHALK_START.x - CHALK_B13_REST.x;
  const dy = CHALK_START.y - CHALK_B13_REST.y;
  const d = Math.hypot(dx, dy);
  const run = Math.min(d, CHASE_SPEED * Math.max(0, t));
  return { x: CHALK_B13_REST.x + (dx / d) * run, y: CHALK_B13_REST.y + (dy / d) * run, arrived: run >= d - 1e-6 };
};

/** The pitch around Tavi's mark, with the goal 26 m on her goal side. */
export const MapField: React.FC<{ goal?: boolean }> = ({ goal = true }) => (
  <g>
    <TopField view={MAP_VIEW} x0={TAVI_PITCH_X - 45} x1={112} y0={-44} y1={44} />
    {goal ? <GoalTop view={MAP_VIEW} goalX={105} /> : null}
  </g>
);

/** A chalk goal icon that draws on over the real goal (b14 "Goal behind you"). */
export const GoalIcon: React.FC<{ t: number; opacity?: number }> = ({ t, opacity = 0.9 }) => {
  if (t <= 0.001) return null;
  const a = M(GOAL_M, 3.66);
  const d = M(GOAL_M + 2, -3.66);
  const w = d.x - a.x;
  const h = d.y - a.y;
  const outline = `M${a.x},${a.y} L${a.x + w},${a.y} L${a.x + w},${a.y + h} L${a.x},${a.y + h}`;
  return (
    <g opacity={opacity} fill="none" stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
      <path d={outline} {...trim(t)} />
      {[0.25, 0.5, 0.75].map((k, i) => (
        <path key={i} d={`M${a.x + 4},${a.y + h * k} L${a.x + w - 4},${a.y + h * k}`} strokeWidth={3} opacity={0.6} {...trim(clamp01(t * 1.6 - 0.6))} />
      ))}
    </g>
  );
};

// ---------- Eyes: the dark behind, the blur grain, the blobs ----------

/** The part of the pitch the eyes do not cover: a dark wedge behind the head, out to the horizon. */
export const DarkHalf: React.FC<{ x: number; y: number; facing: number; wideDeg?: number; opacity?: number }> = ({ x, y, facing, wideDeg = WIDE_DEG, opacity = 0.62 }) => {
  if (opacity <= 0.001) return null;
  const behind = 360 - wideDeg;
  const r = 4000;
  const a = ((behind / 2) * Math.PI) / 180;
  const d = `M0,0 L${r * Math.cos(-a)},${r * Math.sin(-a)} A${r},${r} 0 0 1 ${r * Math.cos(a)},${r * Math.sin(a)} Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing + 180})`}>
      <path d={d} fill={PITCH.skyHigh} opacity={opacity} />
    </g>
  );
};

/** Soft grain inside the wide fan but outside the sharp wedge: the blur. Dots twinkle and spread with the fan. */
export const BlurGrain: React.FC<{ x: number; y: number; facing: number; rMin: number; rMax: number; opacity: number; wideDeg?: number; sharpDeg?: number; count?: number; seed?: string }> = ({
  x,
  y,
  facing,
  rMin,
  rMax,
  opacity,
  wideDeg = WIDE_DEG,
  sharpDeg = SHARP_DEG,
  count = 170,
  seed = "grain",
}) => {
  const frame = useCurrentFrame();
  if (opacity <= 0.001) return null;
  const dots: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const ang = (random(`${seed}a${i}`) - 0.5) * (wideDeg - 6);
    if (Math.abs(ang) < sharpDeg / 2 + 2.5) continue;
    const rr = rMin + Math.sqrt(random(`${seed}r${i}`)) * (rMax - rMin);
    const a = (ang * Math.PI) / 180;
    const tw = 0.45 + 0.55 * Math.sin(frame / (4 + random(`${seed}t${i}`) * 5) + i * 1.3);
    const size = 2.2 + random(`${seed}s${i}`) * 3.4;
    dots.push(<circle key={i} cx={Math.cos(a) * rr} cy={Math.sin(a) * rr} r={size} fill={PITCH.chalk} opacity={0.38 * tw} />);
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing})`} opacity={opacity}>
      {dots}
    </g>
  );
};

/** A grey blob where a player stands in the blurry part of the eye: a shape, no shirt colour. */
export const Blob: React.FC<{ x: number; y: number; size?: number; facing?: number; opacity?: number; wobble?: number }> = ({ x, y, size = TOKEN, facing = 0, opacity = 1, wobble = 0 }) => {
  const frame = useCurrentFrame();
  if (opacity <= 0.001) return null;
  const w = size * (1 + 0.05 * Math.sin(frame / 3.5) * wobble);
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing})`} opacity={opacity}>
      <ellipse rx={w * 0.44} ry={w * 0.7} fill={BLUR_GREY} opacity={0.2} />
      <ellipse rx={w * 0.35} ry={w * 0.58} fill={BLUR_GREY} opacity={0.35} />
      <ellipse rx={w * 0.26} ry={w * 0.46} fill={BLUR_GREY} opacity={0.8} />
    </g>
  );
};

/** Radar rings that spread from a moving blob: the side of the eye catches movement. */
export const Ping: React.FC<{ x: number; y: number; at: number; size?: number; color?: string; rings?: number }> = ({ x, y, at, size = TOKEN, color = PITCH.chalk, rings = 3 }) => {
  const frame = useCurrentFrame();
  const out: React.ReactNode[] = [];
  for (let i = 0; i < rings; i++) {
    const t = (frame - at - i * 4) / 24;
    if (t < 0 || t > 1) continue;
    out.push(<circle key={i} cx={x} cy={y} r={size * (0.5 + 1.9 * t)} fill="none" stroke={color} strokeWidth={3} opacity={(1 - t) * 0.85} />);
  }
  return <g>{out}</g>;
};

/** A white flash disc that fades over 8 frames: a blob resolving into a player. */
export const Flash: React.FC<{ x: number; y: number; at: number; r?: number }> = ({ x, y, at, r = TOKEN }) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / 8;
  if (t < 0 || t > 1) return null;
  return <circle cx={x} cy={y} r={r * (0.6 + 0.9 * t)} fill="#FFFFFF" opacity={(1 - t) * 0.85} />;
};

/** Chalk's raised eyebrow, drawn over a chalk token's head. */
export const Eyebrow: React.FC<{ x: number; y: number; facing: number; size?: number; opacity?: number }> = ({ x, y, facing, size = TOKEN, opacity = 1 }) => {
  const headR = size * 0.27;
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing})`} opacity={opacity}>
      <line x1={headR * 0.55} y1={-headR * 0.62} x2={headR * 0.98} y2={-headR * 0.5} stroke={CAST.keeperEye} strokeWidth={size * 0.06} strokeLinecap="round" />
    </g>
  );
};

/**
 * Two dot eyes blinking open in the dark (Chalk lives there), with a soft glow so they read from afar. `open` 0..1.
 * `eyeScale` grows the dots (and spreads them) so they read on a wide map.
 */
export const ChalkEyes: React.FC<{ x: number; y: number; facing: number; open: number; size?: number; eyeScale?: number }> = ({ x, y, facing, open, size = TOKEN, eyeScale = 1 }) => {
  if (open <= 0.001) return null;
  const headR = size * 0.27;
  const r = headR * 0.3 * eyeScale;
  const side = headR * 0.42 * Math.max(1, eyeScale * 0.9);
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing})`}>
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${headR * 0.55} ${s * side})`}>
          <ellipse rx={r * 2.4} ry={r * 2.4 * open} fill={PITCH.chalk} opacity={0.18} />
          <ellipse rx={r * 1.5} ry={r * 1.5 * open} fill={PITCH.chalk} opacity={0.3} />
          <ellipse rx={r} ry={r * open} fill={PITCH.chalk} />
        </g>
      ))}
    </g>
  );
};

/** A small t-shirt icon that pops in. */
export const Shirt: React.FC<{ x: number; y: number; size?: number; color: string; at: number; rotate?: number; opacity?: number }> = ({ x, y, size = 40, color, at, rotate = 0, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 220, damping: 16 });
  if (s <= 0.001) return null;
  const d = "M-0.5,-0.3 L-0.24,-0.5 L-0.1,-0.4 Q0,-0.33 0.1,-0.4 L0.24,-0.5 L0.5,-0.3 L0.36,-0.08 L0.28,-0.13 L0.28,0.5 L-0.28,0.5 L-0.28,-0.13 L-0.36,-0.08 Z";
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s * size})`} opacity={opacity}>
      <path d={d} fill={color} />
    </g>
  );
};

/** A chalk eye icon (almond with a pupil) that pops in. */
export const EyeIcon: React.FC<{ x: number; y: number; size?: number; at: number; until?: number; color?: string }> = ({ x, y, size = 40, at, until, color = PITCH.chalk }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 220, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const blink = frame > at + 40 && (frame - at) % 70 < 4 ? 0.15 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * size}) scale(1 ${blink})`}>
      <path d="M-0.5,0 Q0,-0.44 0.5,0 Q0,0.44 -0.5,0 Z" fill={PITCH.sky} opacity={0.6} />
      <path d="M-0.5,0 Q0,-0.44 0.5,0 Q0,0.44 -0.5,0 Z" fill="none" stroke={color} strokeWidth={0.09} strokeLinejoin="round" />
      <circle r={0.16} fill={color} />
    </g>
  );
};

// ---------- Chalk stance marks around a token ----------

/** Two chalk footprints that draw under a token, toes towards `facing`. `t` 0..1. */
export const Footprints: React.FC<{ x: number; y: number; facing: number; size?: number; t: number }> = ({ x, y, facing, size = TOKEN, t }) => {
  if (t <= 0.001) return null;
  const foot = (side: number, p: number) => {
    const s = popT(p);
    if (s <= 0.001) return null;
    return (
      <g key={side} transform={`translate(${size * 0.3} ${side * size * 0.25}) scale(${s})`} opacity={0.72}>
        <ellipse cx={size * 0.07} rx={size * 0.21} ry={size * 0.105} fill={PITCH.chalk} />
        <circle cx={-size * 0.2} r={size * 0.08} fill={PITCH.chalk} />
      </g>
    );
  };
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing})`}>
      {foot(-1, clamp01(t * 2))}
      {foot(1, clamp01(t * 2 - 1))}
    </g>
  );
};

/** A short chalk arrow from the chest: which way the body faces. `t` 0..1. */
export const ChestArrow: React.FC<{ x: number; y: number; facing: number; size?: number; t: number; color?: string }> = ({ x, y, facing, size = TOKEN, t, color = PITCH.chalk }) => {
  if (t <= 0.001) return null;
  const x0 = size * 0.3;
  const x1 = size * 0.95;
  const head = size * 0.16;
  const hp = popT(clamp01(t * 1.5 - 0.5));
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing})`} fill="none" stroke={color} strokeWidth={size * 0.09} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${x0},0 L${x1},0`} {...trim(clamp01(t * 1.4))} />
      {hp > 0.001 ? <path d={`M${x1 - head},${-head} L${x1},0 L${x1 - head},${head}`} transform={`translate(${x1} 0) scale(${hp}) translate(${-x1} 0)`} /> : null}
    </g>
  );
};

/** Two thin chalk arms held straight out to the sides, growing from the shoulders. `t` 0..1. */
export const ArmsOut: React.FC<{ x: number; y: number; facing: number; size?: number; t: number; color?: string }> = ({ x, y, facing, size = TOKEN, t, color = PITCH.chalk }) => {
  if (t <= 0.001) return null;
  const len = size * 0.85;
  const th = size * 0.15;
  const arm = (side: number) => {
    const s = popT(t);
    return (
      <g key={side} transform={`translate(${-size * 0.02} ${side * size * 0.44}) scale(1 ${s})`}>
        <rect x={-th / 2} y={side > 0 ? 0 : -len} width={th} height={len} rx={th / 2} fill={color} />
        <circle cy={side * len} r={size * 0.11} fill={color} />
      </g>
    );
  };
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing})`} opacity={0.95}>
      {arm(-1)}
      {arm(1)}
    </g>
  );
};

/** A chalk half circle around the head, flat side through the shoulders, drawn on with `t`. */
export const HalfCircle: React.FC<{ x: number; y: number; facing: number; r: number; t: number; opacity?: number; color?: string }> = ({ x, y, facing, r, t, opacity = 1, color = PITCH.chalk }) => {
  if (t <= 0.001 || opacity <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing})`} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" opacity={opacity}>
      <path d={`M0,${-r} A${r},${r} 0 0 1 0,${r}`} {...trim(clamp01(t * 1.25))} />
      <path d={`M0,${-r} L0,${r}`} strokeWidth={3.5} opacity={0.7} {...trim(clamp01(t * 2 - 1))} />
    </g>
  );
};

/** A filled sector around (0,0) from angle a0 to a1 (degrees), radius r. */
const sector = (r: number, a0: number, a1: number) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const big = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M0,0 L${r * Math.cos(rad(a0))},${r * Math.sin(rad(a0))} A${r},${r} 0 ${big} 1 ${r * Math.cos(rad(a1))},${r * Math.sin(rad(a1))} Z`;
};

/**
 * The "bit more" than a half circle: the two slivers of the wide fan behind the shoulder line
 * (from 90 degrees out to wideDeg / 2 on each side), filled lime. `t` 0..1 grows them, `pulse` 0..1 brightens.
 */
export const Overhang: React.FC<{ x: number; y: number; facing: number; r: number; t: number; pulse?: number; wideDeg?: number; opacity?: number }> = ({
  x,
  y,
  facing,
  r,
  t,
  pulse = 0,
  wideDeg = WIDE_DEG,
  opacity = 1,
}) => {
  if (t <= 0.001 || opacity <= 0.001) return null;
  const edge = wideDeg / 2;
  const rr = r * (0.35 + 0.65 * popT(t));
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing})`} opacity={opacity}>
      {[1, -1].map((s) => (
        <g key={s}>
          <path d={s > 0 ? sector(rr * 1.08, 90, edge) : sector(rr * 1.08, -edge, -90)} fill={XRAY.lime} opacity={0.18 + 0.2 * pulse} />
          <path d={s > 0 ? sector(rr, 90, edge) : sector(rr, -edge, -90)} fill={XRAY.lime} opacity={0.5 + 0.35 * pulse} />
        </g>
      ))}
    </g>
  );
};

/** Dims the last `edgeDeg` degrees on each side of the wide fan: the corner of the eye is dim and grey. */
export const FanEdgeDim: React.FC<{ x: number; y: number; facing: number; r?: number; edgeDeg?: number; wideDeg?: number; opacity?: number }> = ({
  x,
  y,
  facing,
  r = 4000,
  edgeDeg = 20,
  wideDeg = WIDE_DEG,
  opacity = 0.34,
}) => {
  if (opacity <= 0.001) return null;
  const edge = wideDeg / 2;
  const steps = 4;
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing})`}>
      {Array.from({ length: steps }, (_, i) => {
        // Deeper towards the edge: each band covers the outer part of the one before it.
        const a = edge - (edgeDeg * (steps - i)) / steps;
        return (
          <g key={i}>
            <path d={sector(r, a, edge)} fill={PITCH.skyHigh} opacity={opacity / steps} />
            <path d={sector(r, -edge, -a)} fill={PITCH.skyHigh} opacity={opacity / steps} />
          </g>
        );
      })}
    </g>
  );
};

/** An arc arrow around a point from angle a0 to a1 (degrees, screen), drawn on with `t`. */
export const ArcArrow: React.FC<{ x: number; y: number; r: number; a0: number; a1: number; t: number; color?: string; width?: number; glow?: number; dashed?: boolean }> = ({
  x,
  y,
  r,
  a0,
  a1,
  t,
  color = PITCH.chalk,
  width = 6,
  glow = 0,
  dashed = false,
}) => {
  if (t <= 0.001) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const sweep = a1 - a0;
  const big = Math.abs(sweep) > 180 ? 1 : 0;
  const dir = sweep > 0 ? 1 : 0;
  const p0 = { x: x + r * Math.cos(rad(a0)), y: y + r * Math.sin(rad(a0)) };
  const p1 = { x: x + r * Math.cos(rad(a1)), y: y + r * Math.sin(rad(a1)) };
  const d = `M${p0.x},${p0.y} A${r},${r} 0 ${big} ${dir} ${p1.x},${p1.y}`;
  const hp = popT(clamp01(t * 1.6 - 0.6));
  // Tangent at the end, pointing along the sweep.
  const tang = rad(a1) + (sweep > 0 ? Math.PI / 2 : -Math.PI / 2);
  const head = width * 2.6;
  const hx = p1.x;
  const hy = p1.y;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {glow > 0 ? <path d={d} stroke={color} strokeWidth={width * 3.2} opacity={0.18 * glow} {...trim(t)} /> : null}
      <path d={d} stroke={color} strokeWidth={dashed ? width * 0.8 : width} opacity={dashed ? 0.7 : 0.95} {...trim(t)} />
      {hp > 0.001 ? (
        <path
          d={`M${hx - Math.cos(tang) * head * 0.9 + Math.sin(tang) * head * 0.55},${hy - Math.sin(tang) * head * 0.9 - Math.cos(tang) * head * 0.55} L${hx},${hy} L${hx - Math.cos(tang) * head * 0.9 - Math.sin(tang) * head * 0.55},${hy - Math.sin(tang) * head * 0.9 + Math.cos(tang) * head * 0.55}`}
          stroke={color}
          strokeWidth={width}
          transform={`translate(${hx} ${hy}) scale(${hp}) translate(${-hx} ${-hy})`}
        />
      ) : null}
    </g>
  );
};

// ---------- HUD pieces (screen space) ----------

const DIAL_FS = 34;
/** Offset below a dial's centre where its digits pill ends (a tag can hang from there). */
export const dialPillBottom = (r: number) => r + 24 + DIAL_FS * 1.3;

/** A stopwatch: one turn of the hand per second, the seconds (tenths, like the ring) in a pill under the face. */
export const StopwatchDial: React.FC<{ x: number; y: number; r?: number; seconds: number; at: number; until?: number; caption?: string; color?: string; stopped?: boolean }> = ({
  x,
  y,
  r = 90,
  seconds,
  at,
  until,
  caption = "TURN",
  color = PITCH.chalk,
  stopped = false,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 170, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const hand = seconds * 360; // degrees clockwise from twelve
  const digits = `${seconds.toFixed(1)} s`;
  const stopKick = stopped ? 1 + 0.04 * Math.max(0, 1 - (frame - at) / 6) : 1;
  const pillW = digits.length * DIAL_FS * 0.62 + DIAL_FS;
  const pillH = DIAL_FS * 1.3;
  const pillY = r + 24 + pillH / 2;
  const handColor = stopped ? CAST.mistake : PITCH.light;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * stopKick})`}>
      <text y={-r - 28} fill={color} opacity={0.75} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
        {caption}
      </text>
      <rect x={-12} y={-r - 16} width={24} height={20} rx={6} fill={color} />
      <circle r={r} fill={PITCH.sky} opacity={0.92} />
      <circle r={r} fill="none" stroke={color} strokeWidth={6} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={0} y1={-r + 8} x2={0} y2={-r + (i % 3 === 0 ? 22 : 15)} stroke={color} strokeWidth={i % 3 === 0 ? 4 : 2.5} opacity={0.7} transform={`rotate(${i * 30})`} />
      ))}
      <line x1={0} y1={0} x2={0} y2={-r * 0.76} stroke={handColor} strokeWidth={6} strokeLinecap="round" transform={`rotate(${hand})`} />
      <circle r={7} fill={handColor} />
      <rect x={-pillW / 2} y={pillY - pillH / 2} width={pillW} height={pillH} rx={pillH / 2} fill={PITCH.sky} opacity={0.9} />
      <text y={pillY + DIAL_FS * 0.35} fill={stopped ? CAST.mistake : color} fontFamily={FONTS.mono} fontWeight={500} fontSize={DIAL_FS} textAnchor="middle">
        {digits}
      </text>
    </g>
  );
};

/** A small chalk tag on a string, hanging `drop` pixels under (x, y). */
export const HangTag: React.FC<{ x: number; y: number; text: string; at: number; until?: number; size?: number; drop?: number }> = ({ x, y, text, at, until, size = 32, drop = 34 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 160, damping: 13 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const sway = idle(frame, 3, 2.6, 5) * s;
  const w = text.length * size * 0.62 + size;
  const h = size * 1.5;
  return (
    <g transform={`translate(${x} ${y}) rotate(${sway}) scale(${s})`}>
      <line x1={0} y1={0} x2={0} y2={drop} stroke={PITCH.chalk} strokeWidth={2.5} />
      <g transform={`translate(0 ${drop + h / 2})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={8} fill={PITCH.chalk} />
        <circle cy={-h / 2 + 8} r={3.5} fill={PITCH.sky} />
        <text y={size * 0.4} fill={PITCH.sky} fontFamily={FONTS.label} fontWeight={800} fontSize={size} textAnchor="middle">
          {text}
        </text>
      </g>
    </g>
  );
};

/** The run-and-turn test: one lane out, turn and back, one lane straight for the same distance. `p` 0..1 loops. */
export const RunTurnInset: React.FC<{ x: number; y: number; w?: number; h?: number; at: number; until?: number; p: number }> = ({ x, y, w = 620, h = 330, at, until, p }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 150, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const pad = 36;
  const L = (w - pad * 2 - 40) / 2; // the 5 m leg; the straight lane is two legs
  const x0 = pad + 20;
  const yA = 140;
  const yB = 250;
  const gap = 34; // the two legs of the turn lane
  // Lane A: out (0..0.42), turn (0.42..0.58), back (0.58..1).
  const outT = clamp01(p / 0.42);
  const turnT = clamp01((p - 0.42) / 0.16);
  const backT = clamp01((p - 0.58) / 0.42);
  let ax: number;
  let ay: number;
  if (p < 0.42) {
    ax = x0 + L * outT;
    ay = yA - gap / 2;
  } else if (p < 0.58) {
    const a = Math.PI * turnT;
    ax = x0 + L + Math.sin(a) * (gap / 2);
    ay = yA - Math.cos(a) * (gap / 2);
  } else {
    ax = x0 + L * (1 - backT);
    ay = yA + gap / 2;
  }
  // Lane B: straight, done at p = 0.76 (the straight run is quicker).
  const bT = clamp01(p / 0.76);
  const bx = x0 + 2 * L * bT;
  const dotR = 13;
  const trackStroke = { stroke: PITCH.chalk, strokeWidth: 4, opacity: 0.35, fill: "none" as const, strokeLinecap: "round" as const };
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={Math.min(1, s)}>
      <rect width={w} height={h} rx={26} fill={PITCH.skyHigh} opacity={0.94} />
      <text x={pad} y={54} fill={PITCH.chalk} opacity={0.75} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={3}>
        THE TEST
      </text>
      {/* Lane A: out, turn, back. */}
      <path d={`M${x0},${yA - gap / 2} L${x0 + L},${yA - gap / 2} A${gap / 2},${gap / 2} 0 0 1 ${x0 + L},${yA + gap / 2} L${x0},${yA + gap / 2}`} {...trackStroke} />
      <line x1={x0} y1={yA - gap} x2={x0} y2={yA + gap} stroke={PITCH.chalk} strokeWidth={4} opacity={0.6} strokeLinecap="round" />
      <text x={x0} y={yA - gap - 12} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={32}>
        out, turn, back
      </text>
      <circle cx={ax} cy={ay} r={dotR} fill={CAST.shirt} />
      {/* Lane B: straight. */}
      <path d={`M${x0},${yB} L${x0 + 2 * L},${yB}`} {...trackStroke} />
      <line x1={x0} y1={yB - gap * 0.7} x2={x0} y2={yB + gap * 0.7} stroke={PITCH.chalk} strokeWidth={4} opacity={0.6} strokeLinecap="round" />
      <line x1={x0 + 2 * L} y1={yB - gap * 0.7} x2={x0 + 2 * L} y2={yB + gap * 0.7} stroke={PITCH.chalk} strokeWidth={4} opacity={0.6} strokeLinecap="round" />
      <text x={x0} y={yB - gap - 4} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={32}>
        straight
      </text>
      <circle cx={bx} cy={yB} r={dotR} fill={CAST.shirt} opacity={0.85} />
      <text x={w - pad} y={h - 22} fill={PITCH.light} fontFamily={FONTS.label} fontWeight={800} fontSize={32} textAnchor="end" opacity={0.9}>
        same distance, no ball
      </text>
    </g>
  );
};

/** Side view of Tavi with an arm out and a thumb up: the sharp spot is about a thumbnail at arm's length. */
export const ThumbInset: React.FC<{ x: number; y: number; w?: number; h?: number; at: number; until?: number }> = ({ x, y, w = 700, h = 430, at, until }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 150, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const H = h * 0.56;
  const groundY = h - 118;
  const px = 150;
  // A straight arm, raised so the thumbnail sits at eye level, about 0.38 of her drawn height from the eye
  // (a real arm's length). The rig's own near arm points the same way under it.
  const base: Pose = { ...POSES.stand, torso: 2, head: 0, nearShoulder: 90, nearElbow: 0, farShoulder: 4, farElbow: 10 };
  const j0 = solve(base, H);
  const hipY = groundY - j0.lowest;
  const eye = { x: px + j0.headC.x + j0.headR * 0.5, y: hipY + j0.headC.y - j0.headR * 0.05 };
  const shoulder = { x: px + j0.sh.x, y: hipY + j0.sh.y };
  const thumbLen = H * 0.1;
  const fistR = H * 0.05;
  const thumbTop = { x: eye.x + H * 0.43, y: eye.y };
  const fist = { x: thumbTop.x - fistR * 0.35, y: thumbTop.y + thumbLen + fistR * 0.35 };
  const armDeg = (Math.atan2(fist.x - shoulder.x, fist.y - shoulder.y) * 180) / Math.PI;
  const pose: Pose = { ...base, nearShoulder: armDeg };
  const limbW = 0.075 * H;
  const sleeveEnd = { x: shoulder.x + (fist.x - shoulder.x) * 0.24, y: shoulder.y + (fist.y - shoulder.y) * 0.24 };
  const thumbUp = pop(frame, at + 10, { stiffness: 240, damping: 14 });
  const wedge = progress(frame, at + 16, 12, EASE.enter);
  const dist = Math.hypot(thumbTop.x - eye.x, thumbTop.y - eye.y);
  const ang = Math.atan2(thumbTop.y - eye.y, thumbTop.x - eye.x);
  const half = ((SHARP_DEG / 2) * Math.PI) / 180;
  const far = w - eye.x - 20;
  const wedgePath = `M${eye.x},${eye.y} L${eye.x + Math.cos(ang - half) * far},${eye.y + Math.sin(ang - half) * far} L${eye.x + Math.cos(ang + half) * far},${eye.y + Math.sin(ang + half) * far} Z`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect width={w} height={h} rx={28} fill={PITCH.skyHigh} opacity={0.95} />
      <rect x={0} y={groundY} width={w} height={h - groundY - 96} fill={PITCH.grassDark} opacity={0.6} />
      <Player x={px} groundY={groundY} h={H} pose={pose} face="focus" />
      {/* The straight arm: sleeve, then skin out to the fist. */}
      <line x1={shoulder.x} y1={shoulder.y} x2={fist.x} y2={fist.y} stroke={CAST.skin} strokeWidth={limbW} strokeLinecap="round" />
      <line x1={shoulder.x} y1={shoulder.y} x2={sleeveEnd.x} y2={sleeveEnd.y} stroke={CAST.shirt} strokeWidth={limbW * 1.25} strokeLinecap="round" />
      {/* Fist and thumb up, the thumbnail lit lime. */}
      <circle cx={fist.x} cy={fist.y} r={fistR} fill={CAST.skin} />
      <g transform={`translate(${thumbTop.x} ${fist.y - fistR * 0.4}) scale(1 ${thumbUp})`}>
        <rect x={-H * 0.021} y={-(thumbLen + fistR * 0.1)} width={H * 0.042} height={thumbLen + fistR * 0.1} rx={H * 0.021} fill={CAST.skin} />
      </g>
      {thumbUp > 0.5 ? (
        <g>
          <Glow cx={thumbTop.x} cy={thumbTop.y + H * 0.018} r={15} color={XRAY.lime} intensity={0.9} rings={3} />
          <circle cx={thumbTop.x} cy={thumbTop.y + H * 0.018} r={H * 0.014} fill={XRAY.lime} />
        </g>
      ) : null}
      {wedge > 0.001 ? (
        <g opacity={wedge}>
          <path d={wedgePath} fill={XRAY.lime} opacity={0.22} />
          <line x1={eye.x} y1={eye.y} x2={thumbTop.x} y2={thumbTop.y} stroke={XRAY.lime} strokeWidth={2.5} strokeDasharray="8 8" opacity={0.8} />
          <text x={(eye.x + thumbTop.x) / 2 + 24} y={eye.y - 30 - dist * 0.02} fill={XRAY.lime} fontFamily={FONTS.label} fontWeight={800} fontSize={32} textAnchor="middle">
            arm's length
          </text>
        </g>
      ) : null}
      <text x={w / 2} y={h - 62} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={34} textAnchor="middle">
        sharp spot: about 5 degrees
      </text>
      <text x={w / 2} y={h - 22} fill={PITCH.chalk} opacity={0.8} fontFamily={FONTS.label} fontWeight={700} fontSize={32} textAnchor="middle">
        a thumbnail at arm's length fits inside it
      </text>
    </g>
  );
};

// ---------- Side view for the b15 drop: the same geometry as b16's opening, so the cut holds ----------

export const SIDE_PPM = 100;
export const SIDE_GROUND = 760;
export const SIDE_OX = 1000;
export const sideX = (m: number) => SIDE_OX + m * SIDE_PPM;
export const SIDE_VIEW: View = { kind: "side", originX: SIDE_OX, groundY: SIDE_GROUND, ppm: SIDE_PPM };
const SIDE_TOWERS = [-260, 560, 1380, 2200];
const SIDE_TOWER_H = 430;

/**
 * The floodlit pitch from the side: sky and stars in screen space, the stand and towers pinned to
 * the horizon with a small parallax share, the grass and `children` in world pixels under `cam`.
 */
export const SideWorld: React.FC<{ cam: Cam; lights?: number; refX?: number; seed?: string; children?: React.ReactNode }> = ({ cam, lights = 1, refX = sideX(0), seed = "b1315", children }) => {
  const horizonY = HEIGHT / 2 + (SIDE_GROUND - cam.y) * cam.zoom;
  const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
  const layerT = (pan: number, grow: number) => `translate(${WIDTH / 2} ${horizonY}) scale(${1 + (cam.zoom - 1) * grow}) translate(${-WIDTH / 2 - (cam.x - refX) * pan} ${-SIDE_GROUND})`;
  return (
    <g>
      <Sky id={`sky-${seed}`} />
      <Stars count={80} maxY={Math.max(80, horizonY - 260)} seed={seed} />
      <g transform={layerT(0.2, 0.05)}>
        <g transform={`translate(${WIDTH / 2} 0) scale(2.2 1) translate(${-WIDTH / 2} 0)`}>
          <Stands baseY={SIDE_GROUND} lit={lights} />
        </g>
        {SIDE_TOWERS.map((x) => (
          <Floodlight key={x} x={x} baseY={SIDE_GROUND - 20} height={SIDE_TOWER_H} on={lights} beam flip={x > 1000} />
        ))}
      </g>
      <g transform={worldT}>
        <GroundSide groundY={SIDE_GROUND} vanishX={sideX(6)} />
        {children}
      </g>
    </g>
  );
};

/** Chalk footprints along a path, one per metre, each popping when the runner passes it. */
export const PathSteps: React.FC<{ from: { x: number; y: number }; to: { x: number; y: number }; count: number; t: number; size?: number }> = ({ from, to, count, t, size = TOKEN }) => {
  if (t <= 0.001) return null;
  const ang = angleDeg(from, to);
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const k = (i + 1) / count;
        const s = popT(clamp01((t - k) * 6 + 1));
        if (s <= 0.001) return null;
        const px = from.x + (to.x - from.x) * k;
        const py = from.y + (to.y - from.y) * k;
        const side = i % 2 === 0 ? -1 : 1;
        return (
          <g key={i} transform={`translate(${px} ${py}) rotate(${ang}) translate(0 ${side * size * 0.16}) scale(${s})`} opacity={0.9}>
            <ellipse cx={size * 0.05} rx={size * 0.17} ry={size * 0.085} fill={PITCH.chalk} />
            <circle cx={-size * 0.17} r={size * 0.065} fill={PITCH.chalk} />
          </g>
        );
      })}
    </g>
  );
};

/** A dark card with a title, for a magnified ruler or any small board (screen space). */
export const HudCard: React.FC<{ x: number; y: number; w: number; h: number; title: string; at: number; until?: number; children?: React.ReactNode }> = ({ x, y, w, h, title, at, until, children }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 150, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={Math.min(1, s)}>
      <rect width={w} height={h} rx={26} fill={PITCH.skyHigh} opacity={0.94} />
      <text x={32} y={52} fill={PITCH.chalk} opacity={0.75} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={3}>
        {title}
      </text>
      {children}
    </g>
  );
};

/**
 * The end mark of a SecondsRuler that stops between whole metres: a tick, the metres beside it and the
 * seconds in a pill under it (b14: 2.4 m, 0.6 s, so the ruler agrees with the stopwatch). `t` 0..1 pops it.
 */
export const RulerEnd: React.FC<{ x: number; y: number; t: number; metres: string; seconds: string; color?: string; secondsColor?: string; fontSize?: number }> = ({
  x,
  y,
  t,
  metres,
  seconds,
  color = PITCH.chalk,
  secondsColor = CAST.mistake,
  fontSize = 32,
}) => {
  const s = popT(t);
  if (s <= 0.001) return null;
  const tick = 24;
  const pillW = seconds.length * fontSize * 0.62 + fontSize * 0.8;
  const pillH = fontSize * 1.3;
  const pillY = tick + fontSize * 0.95;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform={`scale(${s})`}>
        <line x1={0} y1={-tick} x2={0} y2={tick} stroke={color} strokeWidth={6} strokeLinecap="round" />
      </g>
      <g transform={`translate(16 0) scale(${s})`}>
        <text y={30 * 0.35} fill={color} fontFamily={FONTS.mono} fontWeight={500} fontSize={30} opacity={0.95}>
          {metres}
        </text>
      </g>
      <g transform={`translate(0 ${pillY}) scale(${s})`}>
        <rect x={-pillW / 2} y={-pillH / 2} width={pillW} height={pillH} rx={pillH / 2} fill={PITCH.sky} opacity={0.85} />
        <text y={fontSize * 0.35} fill={secondsColor} fontFamily={FONTS.mono} fontWeight={500} fontSize={fontSize} textAnchor="middle">
          {seconds}
        </text>
      </g>
    </g>
  );
};

/** A dim, wobbling Chalk token for the dark half: the viewer sees him faintly, Tavi does not. */
export const DimChalk: React.FC<{ x: number; y: number; facing: number; opacity: number; stride?: number; size?: number }> = ({ x, y, facing, opacity, stride, size = TOKEN }) => {
  if (opacity <= 0.001) return null;
  return (
    <g opacity={opacity}>
      <TopPlayer x={x} y={y} kind="chalk" facing={facing} size={size} stride={stride} />
    </g>
  );
};
