// Small graphics for s19 (chip mirror) and s20 (the first miss revealed as chip spin).
// Owned by the s19-s20 builder. Flat shapes, no outlines on characters, no CSS filters.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { CAST, FONTS, PITCH, SKY, XRAY } from "../../theme";
import { EASE, pop, popSoft, progress, visible } from "../../lib/anim";
import { Player, type Pose } from "../Player";
import { Glow } from "../World";

/**
 * Two curved arrows around a ball that circle in the spin direction.
 * dir +1 = clockwise on screen, -1 = anticlockwise. `flipT` 0..1 mirrors the pattern
 * (clockwise becomes anticlockwise) through an edge-on turn.
 */
export const SpinArrows: React.FC<{
  cx: number;
  cy: number;
  r: number;
  dir: 1 | -1;
  color: string;
  /** Degrees the pattern has turned (it turns in the direction it points). */
  phase?: number;
  width?: number;
  flipT?: number;
  opacity?: number;
  count?: 1 | 2;
  sweep?: number;
}> = ({ cx, cy, r, dir, color, phase = 0, width = 12, flipT = 0, opacity = 1, count = 2, sweep = 100 }) => {
  const sx = dir * Math.cos(Math.PI * Math.min(1, Math.max(0, flipT)));
  const arcs = [];
  for (let i = 0; i < count; i++) {
    const a0 = ((i * 360) / count - sweep / 2) * (Math.PI / 180);
    const a1 = a0 + (sweep * Math.PI) / 180;
    const p0 = { x: Math.cos(a0) * r, y: Math.sin(a0) * r };
    const p1 = { x: Math.cos(a1) * r, y: Math.sin(a1) * r };
    const t = { x: -Math.sin(a1), y: Math.cos(a1) };
    const n = { x: Math.cos(a1), y: Math.sin(a1) };
    const hl = width * 2.3;
    const hw = width * 1.5;
    const tip = { x: p1.x + t.x * hl * 0.55, y: p1.y + t.y * hl * 0.55 };
    const b1 = { x: p1.x - t.x * hl * 0.45 + n.x * hw, y: p1.y - t.y * hl * 0.45 + n.y * hw };
    const b2 = { x: p1.x - t.x * hl * 0.45 - n.x * hw, y: p1.y - t.y * hl * 0.45 - n.y * hw };
    arcs.push(
      <g key={i}>
        <path d={`M${p0.x.toFixed(1)},${p0.y.toFixed(1)} A${r},${r} 0 0 1 ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
        <path d={`M${tip.x.toFixed(1)},${tip.y.toFixed(1)} L${b1.x.toFixed(1)},${b1.y.toFixed(1)} L${b2.x.toFixed(1)},${b2.y.toFixed(1)} Z`} fill={color} stroke={color} strokeWidth={width * 0.5} strokeLinejoin="round" />
      </g>,
    );
  }
  return (
    <g transform={`translate(${cx} ${cy}) scale(${Math.abs(sx) < 0.02 ? 0.02 * Math.sign(sx || 1) : sx} 1) rotate(${phase})`} opacity={opacity}>
      {arcs}
    </g>
  );
};

/** A spin dial: a round knob with ticks and a pointer. Small spin icons mark both ends. */
export const SpinDial: React.FC<{
  cx: number;
  cy: number;
  r: number;
  /** Pointer angle in degrees (0 = straight up, positive = clockwise). */
  pointer: number;
  /** Colours of the left (clockwise) and right (anticlockwise) end icons. */
  leftColor?: string;
  rightColor?: string;
  opacity?: number;
  scale?: number;
}> = ({ cx, cy, r, pointer, leftColor = XRAY.ball, rightColor = XRAY.air, opacity = 1, scale = 1 }) => {
  const ticks = [];
  for (let i = -5; i <= 5; i++) {
    const a = ((i * 12) * Math.PI) / 180;
    ticks.push(
      <line key={i} x1={Math.sin(a) * r * 1.18} y1={-Math.cos(a) * r * 1.18} x2={Math.sin(a) * r * 1.34} y2={-Math.cos(a) * r * 1.34} stroke={XRAY.bone} strokeWidth={r * 0.06} strokeLinecap="round" opacity={0.55} />,
    );
  }
  const pa = (pointer * Math.PI) / 180;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`} opacity={opacity}>
      {ticks}
      <circle r={r} fill={XRAY.grid} />
      <circle r={r * 0.8} fill="#123F4D" />
      <line x1={0} y1={0} x2={Math.sin(pa) * r * 0.78} y2={-Math.cos(pa) * r * 0.78} stroke={XRAY.bone} strokeWidth={r * 0.16} strokeLinecap="round" />
      <circle r={r * 0.16} fill={XRAY.bone} />
      <SpinArrows cx={-r * 2.05} cy={-r * 0.35} r={r * 0.42} dir={1} color={leftColor} width={r * 0.12} count={1} sweep={250} phase={-35} />
      <SpinArrows cx={r * 2.05} cy={-r * 0.35} r={r * 0.42} dir={-1} color={rightColor} width={r * 0.12} count={1} sweep={250} phase={-35} />
    </g>
  );
};

/** The no-spin ghost ball: a dashed outline at 40%, with no line. */
export const GhostBall: React.FC<{ cx: number; cy: number; r: number; color?: string; opacity?: number }> = ({ cx, cy, r, color = PITCH.chalk, opacity = 1 }) => (
  <g opacity={0.4 * opacity}>
    <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.18} />
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={Math.max(2, r * 0.16)} strokeDasharray={`${Math.max(3, r * 0.45)} ${Math.max(3, r * 0.35)}`} strokeLinecap="round" />
  </g>
);

/** A straight force arrow that pops out from (x, y) along (dx, dy) with a little overshoot, plus an optional label. */
export const PopArrow: React.FC<{
  x: number;
  y: number;
  dx: number;
  dy: number;
  at: number;
  until?: number;
  color: string;
  width?: number;
  label?: string;
  labelColor?: string;
  labelSize?: number;
  /** Label offset from the arrow's middle. */
  lx?: number;
  ly?: number;
  anchor?: "start" | "middle" | "end";
}> = ({ x, y, dx, dy, at, until, color, width = 12, label, labelColor, labelSize = 40, lx = 30, ly = 0, anchor = "start" }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 220, damping: 14 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const head = Math.min(width * 2.6, L * s * 0.7);
  const ex = x + dx * s;
  const ey = y + dy * s;
  const bx = ex - ux * head;
  const by = ey - uy * head;
  const nx = -uy;
  const ny = ux;
  const lo = visible(frame, at + 4, until, 10, 8);
  return (
    <g>
      <line x1={x} y1={y} x2={bx} y2={by} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={`M${ex},${ey} L${bx + nx * head * 0.62},${by + ny * head * 0.62} L${bx - nx * head * 0.62},${by - ny * head * 0.62} Z`} fill={color} stroke={color} strokeWidth={width * 0.4} strokeLinejoin="round" />
      {label ? (
        <text x={x + dx * 0.5 + lx} y={y + dy * 0.5 + ly + labelSize * 0.35} opacity={lo} fill={labelColor ?? color} fontFamily={FONTS.label} fontWeight={800} fontSize={labelSize} textAnchor={anchor}>
          {label}
        </text>
      ) : null}
    </g>
  );
};

/** A stamp with free text (the kit Stamp only takes four fixed words). */
export const TextStamp: React.FC<{ text: string; x: number; y: number; at: number; until?: number; color?: string; size?: number; rotate?: number }> = ({
  text,
  x,
  y,
  at,
  until,
  color = CAST.mistake,
  size = 50,
  rotate = -5,
}) => {
  const frame = useCurrentFrame();
  const s = frame < at ? 0 : 1 + 0.6 * (1 - pop(frame, at, { stiffness: 320, damping: 18 }));
  const o = frame < at ? 0 : Math.min(1, (frame - at) / 3) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (o <= 0.001) return null;
  const w = text.length * size * 0.66 + size * 1.3;
  const h = size * 1.7;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`} opacity={o}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={size * 0.3} fill={PITCH.sky} opacity={0.55} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={size * 0.3} fill="none" stroke={color} strokeWidth={size * 0.15} />
      <text y={size * 0.35} fill={color} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle" letterSpacing={size * 0.06}>
        {text}
      </text>
    </g>
  );
};

/** A thumb lying on its side: the tip is at (x, y + h / 2), the thumb reaches left by w, and it is h thick. */
export const Thumb: React.FC<{ x: number; y: number; w: number; h: number; opacity?: number }> = ({ x, y, w, h, opacity = 1 }) => (
  <g opacity={opacity}>
    <rect x={x - w} y={y} width={w} height={h} rx={h / 2} fill={CAST.skin} />
    <rect x={x - w} y={y + h * 0.55} width={w - h * 0.3} height={h * 0.45} rx={h * 0.22} fill={CAST.skinShade} opacity={0.55} />
    <rect x={x - h * 1.25} y={y + h * 0.1} width={h * 1.05} height={h * 0.36} rx={h * 0.18} fill="#E9C3A5" />
    <path d={`M${x - w * 0.52},${y + h * 0.2} Q${x - w * 0.47},${y + h * 0.5} ${x - w * 0.52},${y + h * 0.8}`} fill="none" stroke={CAST.skinShade} strokeWidth={Math.max(1.5, h * 0.07)} strokeLinecap="round" />
  </g>
);

/** Air Crowd particles drifting left across a region at one steady speed: "the same air". */
export const AirDrift: React.FC<{
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  count?: number;
  speed?: number;
  size?: number;
  color?: string;
  at?: number;
  until?: number;
  seed?: string;
  opacity?: number;
}> = ({ x0, x1, y0, y1, count = 40, speed = 4, size = 12, color = XRAY.air, at = 0, until, seed = "drift", opacity = 1 }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 14, 10) * opacity;
  if (o <= 0.001) return null;
  const W = x1 - x0;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const baseX = random(`${seed}-x-${i}`) * W;
    const y = y0 + ((i + 0.5) / count) * (y1 - y0) + (random(`${seed}-y-${i}`) - 0.5) * ((y1 - y0) / count) * 1.6;
    const sp = speed * (0.85 + random(`${seed}-s-${i}`) * 0.3);
    const x = x0 + ((((baseX - sp * (frame - at)) % W) + W) % W);
    const edge = Math.min(1, (x - x0) / 60, (x1 - x) / 60);
    const wob = Math.sin(frame / 11 + i) * size * 0.25;
    const pr = size * (0.8 + random(`${seed}-r-${i}`) * 0.4);
    parts.push(
      <g key={i} transform={`translate(${x.toFixed(1)} ${(y + wob).toFixed(1)}) rotate(180)`} opacity={Math.max(0, edge)}>
        <ellipse rx={pr * 1.25} ry={pr} fill={color} />
        <circle cx={pr * 0.45} cy={-pr * 0.32} r={pr * 0.2} fill={XRAY.bg} />
        <circle cx={pr * 0.45} cy={pr * 0.32} r={pr * 0.2} fill={XRAY.bg} />
      </g>,
    );
  }
  return <g opacity={o}>{parts}</g>;
};

/** Net bulge: a chalk curve behind the goal that pushes out when the ball hits, then settles. */
export const NetBulge: React.FC<{ x: number; y: number; at: number; size: number; color?: string }> = ({ x, y, at, size, color = PITCH.chalk }) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / 30;
  if (t < 0 || t > 1.6) return null;
  const amp = size * Math.exp(-t * 3) * Math.cos(t * 12) * (t < 0.08 ? t / 0.08 : 1);
  const o = t > 1.2 ? 1 - (t - 1.2) / 0.4 : 1;
  return (
    <g opacity={0.8 * o} fill="none" stroke={color} strokeWidth={Math.max(2, size * 0.12)} strokeLinecap="round">
      <path d={`M${x},${y - size * 1.4} Q${x + amp * 2},${y} ${x},${y + size * 1.4}`} />
      <path d={`M${x - size * 0.4},${y - size * 1.1} Q${x - size * 0.4 + amp * 1.3},${y} ${x - size * 0.4},${y + size * 1.1}`} opacity={0.6} />
    </g>
  );
};

/** A dashed straight line that draws on. */
export const DashLine: React.FC<{ x1: number; y1: number; x2: number; y2: number; at: number; until?: number; color?: string; width?: number; dur?: number }> = ({
  x1,
  y1,
  x2,
  y2,
  at,
  until,
  color = PITCH.chalk,
  width = 5,
  dur = 12,
}) => {
  const frame = useCurrentFrame();
  const t = progress(frame, at, dur, EASE.enter);
  const o = until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit);
  if (t <= 0.001 || o <= 0.001) return null;
  return (
    <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * t} y2={y1 + (y2 - y1) * t} stroke={color} strokeWidth={width} strokeDasharray={`${width * 2.2} ${width * 2}`} strokeLinecap="round" opacity={o} />
  );
};

/** A small ring marker that pops on a point. */
export const RingMarker: React.FC<{ x: number; y: number; r: number; at: number; until?: number; color?: string }> = ({ x, y, r, at, until, color = XRAY.lime }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const pulse = 1 + 0.08 * Math.sin((frame - at) / 5);
  return (
    <g transform={`translate(${x} ${y}) scale(${s * pulse})`}>
      <circle r={r} fill="none" stroke={color} strokeWidth={r * 0.22} />
      <circle r={r * 0.28} fill={color} />
    </g>
  );
};

/** X-ray style ground for side views: a dark band, a bright edge and a few rounded grass tufts. */
export const XRayGround: React.FC<{ groundY: number; x0: number; x1: number; seed?: string; tufts?: number }> = ({ groundY, x0, x1, seed = "g", tufts = 16 }) => (
  <g>
    <rect x={x0} y={groundY} width={x1 - x0} height={900} fill="#0A2C36" />
    <rect x={x0} y={groundY - 3} width={x1 - x0} height={8} rx={4} fill={XRAY.tissue} />
    {Array.from({ length: tufts }, (_, i) => {
      const x = x0 + ((i + random(`${seed}-t-${i}`) * 0.7) / tufts) * (x1 - x0);
      const h = 10 + random(`${seed}-h-${i}`) * 12;
      return <path key={i} d={`M${x - 8},${groundY + 1} Q${x - 2},${groundY - h} ${x},${groundY - h * 1.05} Q${x + 3},${groundY - h * 0.6} ${x + 8},${groundY + 1} Z`} fill={XRAY.tissue} opacity={0.8} />;
    })}
  </g>
);

/** A pill label drawn in screen space with an explicit scale (for labels that follow the camera). */
export const Pill: React.FC<{ x: number; y: number; text: string; s: number; color?: string; bg?: string; size?: number; anchor?: "start" | "middle" | "end" }> = ({
  x,
  y,
  text,
  s,
  color = PITCH.sky,
  bg = PITCH.chalk,
  size = 40,
  anchor = "middle",
}) => {
  if (s <= 0.001) return null;
  const w = text.length * size * 0.6 + size * 1.1;
  const h = size * 1.55;
  const ox = anchor === "middle" ? -w / 2 : anchor === "end" ? -w : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={ox} y={-h / 2} width={w} height={h} rx={h / 2} fill={bg} />
      <text x={ox + w / 2} y={size * 0.35} fill={color} fontFamily={FONTS.label} fontWeight={800} fontSize={size} textAnchor="middle">
        {text}
      </text>
    </g>
  );
};

// ---------- Added for the final script ----------

type Pt = { x: number; y: number };

/** Rough advance width of a Rubik 800 string, in em (for centring a write-on). */
const titleWidthEm = (text: string) => {
  let w = 0;
  for (const ch of text) w += ch === " " ? 0.28 : ch === "·" ? 0.34 : /[A-Z]/.test(ch) ? 0.7 : 0.58;
  return w;
};

/**
 * Chalk letters written on from left to right (Rubik 800, pitch-paint white), then an orange
 * underline. A small chalk puff follows the writing edge.
 */
export const ChalkWrite: React.FC<{
  id: string;
  text: string;
  x: number;
  y: number;
  at: number;
  until?: number;
  size?: number;
  dur?: number;
  color?: string;
  underline?: string;
}> = ({ id, text, x, y, at, until, size = 60, dur = 30, color = PITCH.chalk, underline = PITCH.accent }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 3, 8);
  if (o <= 0.001) return null;
  const w = titleWidthEm(text) * size + size * 0.1 * text.length;
  const x0 = x - w / 2;
  const write = progress(frame, at, dur, EASE.soft);
  const edge = x0 + w * write;
  const line = progress(frame, at + dur - 2, 12, EASE.standard);
  const writing = write > 0 && write < 1;
  return (
    <g opacity={o}>
      <defs>
        <clipPath id={id}>
          <rect x={x0 - size * 0.2} y={y - size * 1.2} width={Math.max(0, edge - x0 + size * 0.2)} height={size * 1.6} />
        </clipPath>
      </defs>
      <text clipPath={`url(#${id})`} x={x} y={y} fill={color} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle" letterSpacing={size * 0.1}>
        {text}
      </text>
      {writing
        ? [0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={edge + (random(`${id}-dx-${i}-${frame}`) - 0.3) * size * 0.3}
              cy={y - size * (0.1 + random(`${id}-dy-${i}-${frame}`) * 0.6)}
              r={size * (0.03 + random(`${id}-r-${i}-${frame}`) * 0.03)}
              fill={color}
              opacity={0.7}
            />
          ))
        : null}
      {line > 0 ? <rect x={x0} y={y + size * 0.2} width={w * line} height={size * 0.1} rx={size * 0.05} fill={underline} /> : null}
    </g>
  );
};

/**
 * A round magnifier: draws `children` (world content) at `zoom` around the world point (wx, wy),
 * clipped to a circle at (cx, cy). `s` scales the whole loupe (0 = hidden).
 */
export const Loupe: React.FC<{
  id: string;
  cx: number;
  cy: number;
  r: number;
  s: number;
  wx: number;
  wy: number;
  zoom: number;
  ring?: string;
  children: React.ReactNode;
}> = ({ id, cx, cy, r, s, wx, wy, zoom, ring = XRAY.bone, children }) => {
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <defs>
        <clipPath id={id}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r + 14} fill={XRAY.bg} />
      <g clipPath={`url(#${id})`}>
        <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={XRAY.bg} />
        <g transform={`scale(${zoom}) translate(${-wx} ${-wy})`}>{children}</g>
      </g>
      <circle r={r} fill="none" stroke={ring} strokeWidth={8} />
    </g>
  );
};

/**
 * The standing (far) leg in X-ray: two-bone IK from the hip to a planted, flat foot.
 * Drawn faint, because it is on the far side of the ball.
 */
export const XRayStandLeg: React.FC<{ hip: Pt; ankle: Pt; h: number; opacity?: number }> = ({ hip, ankle, h, opacity = 1 }) => {
  const L1 = 0.245 * h;
  const L2 = 0.235 * h;
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.5);
  const a = Math.atan2(dy, dx);
  const k = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  // The knee bends forward (towards +x).
  const knee = { x: hip.x + L1 * Math.cos(a - k), y: hip.y + L1 * Math.sin(a - k) };
  const an = { x: hip.x + d * Math.cos(a), y: hip.y + d * Math.sin(a) };
  const toe = { x: an.x + 0.13 * h, y: an.y };
  const w = h * 0.03;
  const seg = (p: Pt, q: Pt, width: number, color: string, op: number, key: string) => (
    <line key={key} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={color} strokeWidth={width} strokeLinecap="round" opacity={op} />
  );
  return (
    <g opacity={opacity}>
      {seg(hip, knee, h * 0.1, XRAY.tissue, 0.4, "t1")}
      {seg(knee, an, h * 0.085, XRAY.tissue, 0.4, "t2")}
      {seg(an, toe, h * 0.065, XRAY.tissue, 0.4, "t3")}
      {seg(hip, knee, w * 1.1, XRAY.bone, 0.5, "b1")}
      {seg(knee, an, w * 0.95, XRAY.bone, 0.5, "b2")}
      {seg(an, toe, w * 0.8, XRAY.bone, 0.5, "b3")}
      <circle cx={knee.x} cy={knee.y} r={w * 1.05} fill={XRAY.bone} opacity={0.5} />
      <circle cx={an.x} cy={an.y} r={w} fill={XRAY.bone} opacity={0.5} />
    </g>
  );
};

/**
 * A take-off angle: a dashed level line, the launch ray and an arc between them, drawn on,
 * with a label outside the arc. `deg` is measured up from level, towards +x.
 */
export const AngleArc: React.FC<{
  x: number;
  y: number;
  deg: number;
  r: number;
  at: number;
  until?: number;
  color?: string;
  label?: string;
  labelSize?: number;
  width?: number;
  ray?: number;
}> = ({ x, y, deg, r, at, until, color = XRAY.lime, label, labelSize = 40, width = 6, ray = 1.7 }) => {
  const frame = useCurrentFrame();
  const t = progress(frame, at, 16, EASE.enter);
  const o = until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit);
  if (t <= 0.001 || o <= 0.001) return null;
  const th = (deg * t * Math.PI) / 180;
  const full = (deg * Math.PI) / 180;
  const L = r * ray;
  const mid = full / 2;
  const lr = r + labelSize * 0.9;
  return (
    <g opacity={o}>
      <line x1={x} y1={y} x2={x + L * t} y2={y} stroke={color} strokeWidth={width * 0.7} strokeDasharray={`${width * 1.6} ${width * 1.8}`} strokeLinecap="round" opacity={0.75} />
      <line x1={x} y1={y} x2={x + Math.cos(th) * L * t} y2={y - Math.sin(th) * L * t} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={`M${x + r},${y} A${r},${r} 0 0 0 ${x + Math.cos(th) * r},${y - Math.sin(th) * r}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      {label ? (
        <text
          x={x + Math.cos(mid) * lr}
          y={y - Math.sin(mid) * lr + labelSize * 0.35}
          opacity={progress(frame, at + 8, 10)}
          fill={color}
          fontFamily={FONTS.label}
          fontWeight={800}
          fontSize={labelSize}
          textAnchor="start"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
};

/** Board colours: fully opaque, so nothing behind the board glows through its text. */
export const BOARD_BG = "#10233A";
export const BOARD_HEAD = "#16324B";

/** A small practice board that slides in from the left edge. Children draw in board-local units. */
export const CornerBoard: React.FC<{ x: number; y: number; w: number; h: number; at: number; until?: number; title: string; children?: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  at,
  until,
  title,
  children,
}) => {
  const frame = useCurrentFrame();
  const inT = progress(frame, at, 14, EASE.enter);
  const outT = until === undefined ? 0 : progress(frame, until, 9, EASE.exit);
  if (inT <= 0.001 || outT >= 0.999) return null;
  const dx = -(x + w + 40) * (1 - inT) - (x + w + 40) * outT;
  return (
    <g transform={`translate(${x + dx} ${y})`}>
      <rect width={w} height={h} rx={32} fill={BOARD_BG} />
      <rect width={w} height={66} rx={32} fill={BOARD_HEAD} />
      <rect y={34} width={w} height={32} fill={BOARD_HEAD} />
      <text x={w / 2} y={46} fill={PITCH.lightSoft} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} textAnchor="middle" letterSpacing={4}>
        {title}
      </text>
      {children}
    </g>
  );
};

/** Board text lines that fade up one after another. */
export const BoardLines: React.FC<{ x: number; y: number; lines: string[]; at: number; step?: number; size?: number; gap?: number; color?: string; weight?: number }> = ({
  x,
  y,
  lines,
  at,
  step = 3,
  size = 38,
  gap = 48,
  color = PITCH.chalk,
  weight = 700,
}) => {
  const frame = useCurrentFrame();
  return (
    <g>
      {lines.map((l, i) => {
        const o = progress(frame, at + i * step, 10, EASE.enter);
        if (o <= 0.001) return null;
        return (
          <text key={i} x={x} y={y + i * gap + (1 - o) * 10} opacity={o} fill={color} fontFamily={FONTS.label} fontWeight={weight} fontSize={size}>
            {l}
          </text>
        );
      })}
    </g>
  );
};

// ---------- Added for the fresh-eyes review ----------

/**
 * A see-through ghost of Tavi with a light rim, so his pose reads on a dark, busy background.
 * The rim is the silhouette grown by `rim` (world px) minus the silhouette itself (SVG masks, no filters).
 */
export const GhostPlayer: React.FC<{
  id: string;
  x: number;
  groundY: number;
  h: number;
  pose: Pose;
  /** Rim width in the units of the parent transform. */
  rim: number;
  rimColor?: string;
  rimOpacity?: number;
  /** Opacity passed to the kit ghost (the kit multiplies it by 0.55). */
  fill?: number;
}> = ({ id, x, groundY, h, pose, rim, rimColor = XRAY.bone, rimOpacity = 1, fill = 1 }) => {
  const bx = x - 2 * h;
  const by = groundY - 2.2 * h;
  const bw = 4 * h;
  const bh = 2.6 * h;
  const box = { x: bx, y: by, width: bw, height: bh };
  const dirs = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)]);
  return (
    <g>
      <defs>
        <mask id={`${id}-grow`} maskUnits="userSpaceOnUse" {...box} style={{ maskType: "alpha" }}>
          {dirs.map(([dx, dy], i) => (
            <Player key={i} x={x + dx * rim} groundY={groundY + dy * rim} h={h} pose={pose} />
          ))}
        </mask>
        <mask id={`${id}-body`} maskUnits="userSpaceOnUse" {...box} style={{ maskType: "alpha" }}>
          <Player x={x} groundY={groundY} h={h} pose={pose} />
        </mask>
        <mask id={`${id}-rim`} maskUnits="userSpaceOnUse" {...box}>
          <rect {...box} fill="#FFFFFF" mask={`url(#${id}-grow)`} />
          <rect {...box} fill="#000000" mask={`url(#${id}-body)`} />
        </mask>
      </defs>
      <rect {...box} fill={rimColor} opacity={rimOpacity} mask={`url(#${id}-rim)`} />
      <Player x={x} groundY={groundY} h={h} pose={pose} ghost opacity={fill} />
    </g>
  );
};

const PanelCloud: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => {
  const shape = (fill: string, dy: number) => (
    <g fill={fill} transform={`translate(0 ${dy})`}>
      <rect x={-170} y={-44} width={340} height={88} rx={44} />
      <circle cx={-70} cy={-54} r={66} />
      <circle cx={30} cy={-78} r={88} />
      <circle cx={118} cy={-34} r={54} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {shape(SKY.cloudShade, 12)}
      {shape(SKY.cloud, 0)}
    </g>
  );
};

/**
 * Open Sky backdrop for one half of the split screen (screen space, 960 px wide): a gradient pinned
 * to the horizon, far hills, two high clouds that drift slowly, and an optional sun.
 */
export const PanelSky: React.FC<{ id: string; horizonY: number; camX: number; sun?: boolean; seed?: number; w?: number }> = ({
  id,
  horizonY,
  camX,
  sun = false,
  seed = 0,
  w = 960,
}) => {
  const frame = useCurrentFrame();
  const clouds = [
    { x: 150 + seed * 90, y: 250, s: 0.42 },
    { x: 640 - seed * 60, y: 190, s: 0.32 },
  ];
  return (
    <g>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={horizonY - 1300} x2="0" y2={horizonY}>
          <stop offset="0" stopColor={SKY.top} />
          <stop offset="0.55" stopColor={SKY.mid} />
          <stop offset="1" stopColor={SKY.horizon} />
        </linearGradient>
      </defs>
      <rect x={-20} y={-20} width={w + 40} height={1120} fill={`url(#${id})`} />
      {sun ? (
        <g transform={`translate(${w - 150} 250)`}>
          <Glow cx={0} cy={0} r={190} color={SKY.sun} intensity={1.2} rings={5} />
          <circle r={56} fill={SKY.sunSoft} />
        </g>
      ) : null}
      {clouds.map((c, i) => {
        const x = ((c.x - camX * 0.06 + frame * (0.3 + 0.1 * i) + 300) % (w + 600)) - 300;
        return <PanelCloud key={i} x={x} y={c.y} s={c.s} />;
      })}
      <g transform={`translate(${-camX * 0.04} ${horizonY})`} fill={SKY.cloudShade} opacity={0.75}>
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse key={i} cx={-300 + i * 330} cy={8} rx={230 + (i % 3) * 50} ry={60 + (i % 2) * 26} />
        ))}
      </g>
    </g>
  );
};

/**
 * A short upward "float" arrow with a label pill, drawn in screen pixels around a ball of screen
 * radius `r` (put it inside a transform that undoes the camera zoom). `s` 0..1 scales it in.
 */
export const FloatTag: React.FC<{ s: number; r: number; len?: number; color?: string; casing?: string; label?: string; size?: number }> = ({
  s,
  r,
  len = 62,
  color = XRAY.lime,
  casing = SKY.deep,
  label = "float",
  size = 38,
}) => {
  if (s <= 0.001) return null;
  const y0 = -(r + 8);
  const y1 = y0 - len * s;
  const hw = 15;
  const hl = 20;
  const arrow = (c: string, width: number, grow: number) => (
    <g>
      <line x1={0} y1={y0} x2={0} y2={y1 + hl} stroke={c} strokeWidth={width} strokeLinecap="round" />
      <path d={`M0,${y1 - grow} L${hw + grow},${y1 + hl + grow * 0.6} L${-hw - grow},${y1 + hl + grow * 0.6} Z`} fill={c} stroke={c} strokeWidth={4} strokeLinejoin="round" />
    </g>
  );
  const pw = label.length * size * 0.58 + size * 0.9;
  const ph = size * 1.45;
  return (
    <g opacity={Math.min(1, s * 1.5)}>
      {arrow(casing, 18, 4)}
      {arrow(color, 10, 0)}
      <g transform={`translate(${hw + 12} ${y0 - len * 0.55}) scale(${s})`}>
        <rect x={0} y={-ph / 2} width={pw} height={ph} rx={ph / 2} fill={casing} />
        <text x={pw / 2} y={size * 0.35} fill={color} fontFamily={FONTS.label} fontWeight={800} fontSize={size} textAnchor="middle">
          {label}
        </text>
      </g>
    </g>
  );
};

/** Ball radius of the merged ball at the end of s19, which is also the first frame of s20. */
export const MERGE_R = 100;

/**
 * The spin dial around the merged ball (s19 end, s20 start): glow, a ring with ticks and two
 * backspin arrows. Draw the Ball itself on top at radius MERGE_R * s.
 */
export const MergeDial: React.FC<{ cx: number; cy: number; s: number; ringO?: number; phase: number; opacity?: number }> = ({
  cx,
  cy,
  s,
  ringO = 1,
  phase,
  opacity = 1,
}) => {
  if (s <= 0.001 || opacity <= 0.001) return null;
  const R = MERGE_R;
  const ring = R * 1.55;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`} opacity={opacity}>
      <Glow cx={0} cy={0} r={R * 2.6} color={XRAY.air} intensity={0.55} />
      <circle r={ring} fill="none" stroke={XRAY.bone} strokeWidth={6} opacity={0.45 * ringO} />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r0 = ring + 14;
        const r1 = ring + (i % 6 === 0 ? 42 : 28);
        return <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={XRAY.bone} strokeWidth={6} strokeLinecap="round" opacity={0.5 * ringO} />;
      })}
      <SpinArrows cx={0} cy={0} r={ring} dir={-1} color={XRAY.air} width={15} count={2} sweep={110} phase={phase} opacity={ringO} />
    </g>
  );
};

export type SafetyKind = "goal" | "cars" | "warmup" | "half" | "turf";

/** Flat 64 px safety icons for the practice board (centred on 0,0). */
export const SafetyIcon: React.FC<{ kind: SafetyKind; x: number; y: number; s?: number }> = ({ kind, x, y, s = 1 }) => {
  const ink = PITCH.chalk;
  const no = CAST.mistake;
  const slash = (
    <g>
      <circle r={30} fill="none" stroke={no} strokeWidth={6} />
      <line x1={-21} y1={-21} x2={21} y2={21} stroke={no} strokeWidth={6} strokeLinecap="round" />
    </g>
  );
  let body: React.ReactNode = null;
  if (kind === "goal") {
    body = (
      <g>
        <path d="M-28,22 L-28,-18 L28,-18 L28,22" fill="none" stroke={ink} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
        <g stroke={ink} strokeWidth={2} opacity={0.5}>
          {[-14, 0, 14].map((gx) => (
            <line key={gx} x1={gx} y1={-14} x2={gx} y2={22} />
          ))}
          {[-4, 10].map((gy) => (
            <line key={gy} x1={-25} y1={gy} x2={25} y2={gy} />
          ))}
        </g>
        <circle cx={22} cy={18} r={13} fill={CAST.fix} />
        <path d="M15,18 L20,23 L29,13" fill="none" stroke={BOARD_BG} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  } else if (kind === "cars") {
    body = (
      <g>
        <rect x={-24} y={-2} width={48} height={16} rx={6} fill={ink} />
        <rect x={-13} y={-14} width={26} height={14} rx={6} fill={ink} />
        <circle cx={-13} cy={15} r={6} fill={BOARD_BG} />
        <circle cx={13} cy={15} r={6} fill={BOARD_BG} />
        {slash}
      </g>
    );
  } else if (kind === "warmup") {
    body = (
      <g>
        <circle r={26} fill="none" stroke={ink} strokeWidth={6} />
        <path d="M0,0 L0,-20 A20,20 0 0 1 17.3,-10 Z" fill={PITCH.light} />
        <line x1={0} y1={0} x2={0} y2={-18} stroke={ink} strokeWidth={5} strokeLinecap="round" />
        <line x1={0} y1={0} x2={12} y2={6} stroke={ink} strokeWidth={5} strokeLinecap="round" />
      </g>
    );
  } else if (kind === "half") {
    body = (
      <g>
        <rect x={-28} y={-15} width={50} height={30} rx={8} fill="none" stroke={ink} strokeWidth={5} />
        <rect x={24} y={-7} width={6} height={14} rx={3} fill={ink} />
        <rect x={-22} y={-9} width={20} height={18} rx={4} fill={PITCH.light} />
      </g>
    );
  } else {
    body = (
      <g>
        <rect x={-28} y={10} width={56} height={14} rx={6} fill={PITCH.grass} />
        {[-18, -4, 10, 22].map((gx, i) => (
          <path key={i} d={`M${gx - 4},${11} Q${gx},${1} ${gx + 1},${-1} Q${gx + 2},${5} ${gx + 5},${11} Z`} fill={PITCH.grassLight} />
        ))}
        <circle cx={0} cy={-8} r={11} fill={CAST.ball} />
        <path d="M-24,-22 Q-18,-28 -12,-22" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <path d="M12,-22 Q18,-28 24,-22" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
      </g>
    );
  }
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{body}</g>;
};
