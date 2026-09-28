// Scene-local graphics for s16-s18 (volley chapter). Owned by the s16-s18 builder.
// Flat shapes, no outlines on bodies, no CSS filters.

import React from "react";
import { useCurrentFrame } from "remotion";
import { CAST, FONTS, PITCH, SKY, XRAY } from "../../theme";
import { EASE, idle, pop, popSoft, progress, visible } from "../../lib/anim";
import type { Cue } from "../../lib/timing";

type Pt = { x: number; y: number };

/** Ghost ball: dashed outline at 40%, no line. */
export const GhostBall: React.FC<{ cx: number; cy: number; r: number; color?: string; opacity?: number }> = ({ cx, cy, r, color = PITCH.chalk, opacity = 1 }) => (
  <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={Math.max(2, r * 0.18)} strokeDasharray={`${Math.max(3, r * 0.5)} ${Math.max(3, r * 0.4)}`} opacity={0.6 * opacity} strokeLinecap="round" />
);

/** Dotted trail through screen points. */
export const DottedTrail: React.FC<{ pts: Pt[]; color?: string; width?: number; opacity?: number; gap?: number }> = ({ pts, color = PITCH.chalk, width = 4, opacity = 0.7, gap = 14 }) =>
  pts.length > 1 ? (
    <path
      d={`M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeDasharray={`0.1 ${gap}`}
      strokeLinecap="round"
      opacity={opacity}
    />
  ) : null;

/** Solid trail through screen points. */
export const SolidTrail: React.FC<{ pts: Pt[]; color?: string; width?: number; opacity?: number; core?: string }> = ({ pts, color = SKY.accent, width = 6, opacity = 0.9, core }) =>
  pts.length > 1 ? (
    <g opacity={opacity}>
      <path d={`M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      {core ? (
        <path d={`M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`} fill="none" stroke={core} strokeWidth={width * 0.35} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </g>
  ) : null;

/** Vertical measuring bracket from y1 (top) to y2 (bottom) at x, drawn out from the middle. */
export const Bracket: React.FC<{
  x: number;
  y1: number;
  y2: number;
  at: number;
  until?: number;
  color?: string;
  width?: number;
  tick?: number;
  /** Which side the ticks point to: -1 = left, 1 = right. */
  side?: -1 | 1;
}> = ({ x, y1, y2, at, until, color = SKY.deep, width = 5, tick = 16, side = 1 }) => {
  const frame = useCurrentFrame();
  const g = progress(frame, at, 14, EASE.enter);
  const o = until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit);
  if (g <= 0.001 || o <= 0.001) return null;
  const mid = (y1 + y2) / 2;
  const a = mid + (y1 - mid) * g;
  const b = mid + (y2 - mid) * g;
  return (
    <g opacity={o} stroke={color} strokeWidth={width} strokeLinecap="round" fill="none">
      <line x1={x} y1={a} x2={x} y2={b} />
      <line x1={x} y1={a} x2={x + side * tick} y2={a} />
      <line x1={x} y1={b} x2={x + side * tick} y2={b} />
    </g>
  );
};

/** Two curved arrows around a ball that turn with it. dir 1 = clockwise on screen. */
export const SpinArrows: React.FC<{ cx: number; cy: number; r: number; angle: number; dir?: 1 | -1; color?: string; opacity?: number; width?: number; scale?: number }> = ({
  cx,
  cy,
  r,
  angle,
  dir = 1,
  color = XRAY.lime,
  opacity = 1,
  width,
  scale = 1,
}) => {
  if (opacity <= 0.001 || scale <= 0.001) return null;
  const R = r * 1.32;
  const w = width ?? Math.max(4, r * 0.09);
  const span = 1.9; // radians per arrow
  const arc = (start: number, key: string) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = start + dir * (i / 20) * span;
      pts.push({ x: Math.cos(t) * R, y: Math.sin(t) * R });
    }
    const end = pts[pts.length - 1];
    const prev = pts[pts.length - 3];
    const ang = Math.atan2(end.y - prev.y, end.x - prev.x);
    const head = w * 2.3;
    return (
      <g key={key}>
        <polyline points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />
        <path
          d={`M${end.x + Math.cos(ang) * head * 0.7},${end.y + Math.sin(ang) * head * 0.7} L${end.x + Math.cos(ang + 2.4) * head},${end.y + Math.sin(ang + 2.4) * head} L${end.x + Math.cos(ang - 2.4) * head},${end.y + Math.sin(ang - 2.4) * head} Z`}
          fill={color}
          stroke={color}
          strokeWidth={w * 0.5}
          strokeLinejoin="round"
        />
      </g>
    );
  };
  // Screen y is down, so increasing angle turns clockwise on screen.
  const base = dir * angle;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`} opacity={opacity}>
      {arc(base - Math.PI / 2 - (dir * span) / 2, "a")}
      {arc(base + Math.PI / 2 - (dir * span) / 2, "b")}
    </g>
  );
};

/** A force arrow: the shaft draws in, the head pops, the label pops a little later. */
export const ForceArrow: React.FC<{
  x: number;
  y: number;
  len: number;
  /** Screen angle in degrees: 90 = straight down. */
  angleDeg?: number;
  color: string;
  at: number;
  until?: number;
  label?: string;
  labelColor?: string;
  labelBg?: string;
  labelSize?: number;
  width?: number;
  /** Where the label sits: after the tip, or to one side of the middle. */
  labelAt?: "tip" | "left" | "right";
  /** Frames for the shaft to draw in (the head and label follow in proportion). */
  dur?: number;
}> = ({ x, y, len, angleDeg = 90, color, at, until, label, labelColor = XRAY.bg, labelBg, labelSize = 36, width = 14, labelAt = "tip", dur = 18 }) => {
  const frame = useCurrentFrame();
  const t = progress(frame, at, dur, EASE.enter);
  const o = until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit);
  if (t <= 0.001 || o <= 0.001) return null;
  const a = (angleDeg * Math.PI) / 180;
  const head = width * 2.2;
  const shaft = Math.max(0, len - head * 0.8) * t;
  const ex = x + Math.cos(a) * shaft;
  const ey = y + Math.sin(a) * shaft;
  const hs = pop(frame, at + Math.round(dur * 0.45), { stiffness: 260, damping: 14 });
  const tipX = x + Math.cos(a) * (len - head * 0.8);
  const tipY = y + Math.sin(a) * (len - head * 0.8);
  const ls = popSoft(frame, at + Math.round(dur * 0.72));
  const bg = labelBg ?? color;
  const lw = (label?.length ?? 0) * labelSize * 0.56 + labelSize * 1.1;
  const lh = labelSize * 1.5;
  let lx = x + Math.cos(a) * (len + lh * 0.7);
  let ly = y + Math.sin(a) * (len + lh * 0.7);
  if (labelAt !== "tip") {
    const mx = x + Math.cos(a) * len * 0.5;
    const my = y + Math.sin(a) * len * 0.5;
    const s = labelAt === "left" ? -1 : 1;
    lx = mx + s * (lw / 2 + width * 1.4);
    ly = my;
  }
  return (
    <g opacity={o}>
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={color} strokeWidth={width} strokeLinecap="round" />
      {hs > 0.001 ? (
        <g transform={`translate(${tipX} ${tipY}) rotate(${angleDeg}) scale(${hs})`}>
          <path d={`M${head * 0.95},0 L${-head * 0.2},${-head * 0.72} L${-head * 0.2},${head * 0.72} Z`} fill={color} stroke={color} strokeWidth={width * 0.45} strokeLinejoin="round" />
        </g>
      ) : null}
      {label && ls > 0.001 ? (
        <g transform={`translate(${lx} ${ly}) scale(${ls})`}>
          <rect x={-lw / 2} y={-lh / 2} width={lw} height={lh} rx={lh / 2} fill={bg} />
          <text y={labelSize * 0.35} fill={labelColor} fontFamily={FONTS.label} fontWeight={800} fontSize={labelSize} textAnchor="middle">
            {label}
          </text>
        </g>
      ) : null}
    </g>
  );
};

/** A small star burst for the grip moment. */
export const Spark: React.FC<{ x: number; y: number; at: number; size?: number; color?: string; core?: string; rays?: number; rot?: number }> = ({
  x,
  y,
  at,
  size = 60,
  color = XRAY.lime,
  core = XRAY.bone,
  rays = 8,
  rot = 0,
}) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / 16;
  if (t < 0 || t > 1) return null;
  const grow = EASE.enter(Math.min(1, t * 1.6));
  const fade = 1 - EASE.exit(t);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} opacity={fade}>
      <circle r={size * 0.28 * (1 - t * 0.6)} fill={core} />
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2;
        const r0 = size * (0.3 + 0.35 * grow);
        const r1 = size * (0.55 + 0.6 * grow) * (i % 2 ? 0.75 : 1);
        return (
          <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={color} strokeWidth={size * 0.09} strokeLinecap="round" />
        );
      })}
    </g>
  );
};

/** Short streaks parallel to a direction: the ball slipping on the boot. */
export const SlipStreaks: React.FC<{ x: number; y: number; dir: Pt; at: number; until: number; len?: number; color?: string; count?: number; spread?: number }> = ({
  x,
  y,
  dir,
  at,
  until,
  len = 70,
  color = XRAY.bone,
  count = 4,
  spread = 26,
}) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 6, 8);
  if (o <= 0.001) return null;
  const n = { x: -dir.y, y: dir.x };
  return (
    <g opacity={o * 0.85} stroke={color} strokeLinecap="round">
      {Array.from({ length: count }, (_, i) => {
        const off = (i - (count - 1) / 2) * spread;
        const phase = ((frame - at) * 5 + i * 23) % (len * 1.6);
        const sx = x + n.x * off - dir.x * phase * 0.5;
        const sy = y + n.y * off - dir.y * phase * 0.5;
        const l = len * (i % 2 ? 0.6 : 1);
        return <line key={i} x1={sx} y1={sy} x2={sx - dir.x * l} y2={sy - dir.y * l} strokeWidth={i % 2 ? 5 : 7} opacity={0.5 + 0.5 * ((i + 1) % 2)} />;
      })}
    </g>
  );
};

/** A round inset card that pops in and out. Children draw in local coordinates centred on (0, 0). */
export const RoundInset: React.FC<{ x: number; y: number; r: number; at: number; until: number; bg: string; ring?: string; children: React.ReactNode; id: string }> = ({
  x,
  y,
  r,
  at,
  until,
  bg,
  ring,
  children,
  id,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 190, damping: 15 }) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y + idle(frame, 4, 3.4, 3)}) scale(${s})`}>
      <defs>
        <clipPath id={id}>
          <circle r={r} />
        </clipPath>
      </defs>
      {ring ? <circle r={r + 10} fill={ring} /> : null}
      <circle r={r} fill={bg} />
      <g clipPath={`url(#${id})`}>{children}</g>
    </g>
  );
};

/** Metaphor: a wheel rolling down a ramp (forward roll). Local coords, fits in radius ~140. */
export const WheelRamp: React.FC<{ t: number; color?: string; ramp?: string; spoke?: string }> = ({ t, color = XRAY.bone, ramp = XRAY.tissue, spoke = XRAY.bg }) => {
  // Ramp from top-left to bottom-right.
  const a = { x: -170, y: -30 };
  const b = { x: 170, y: 70 };
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const d = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
  const nrm = { x: d.y, y: -d.x }; // up-right normal (screen)
  const wr = 50;
  const u = 40 + (L - 150) * t;
  const c = { x: a.x + d.x * u + nrm.x * wr, y: a.y + d.y * u + nrm.y * wr };
  const rot = ((u / wr) * 180) / Math.PI; // clockwise while rolling down to the right
  return (
    <g>
      <path d={`M${a.x - 20},${a.y - 10} L${b.x + 40},${b.y + 30} L${b.x + 40},${200} L${a.x - 20},${200} Z`} fill={ramp} />
      <g transform={`translate(${c.x} ${c.y}) rotate(${rot})`}>
        <circle r={wr} fill={color} />
        <circle r={wr * 0.62} fill={spoke} />
        <rect x={-wr * 0.62} y={-4} width={wr * 1.24} height={8} rx={4} fill={color} />
        <rect x={-4} y={-wr * 0.62} width={8} height={wr * 1.24} rx={4} fill={color} />
        <circle r={wr * 0.16} fill={XRAY.ball} />
      </g>
      <SpinArrows cx={c.x} cy={c.y} r={wr} angle={(rot * Math.PI) / 180} dir={1} color={XRAY.lime} width={7} />
    </g>
  );
};

/** Stopwatch with no digits. The hand sweeps from `start` and freezes at `stop`. */
export const Stopwatch: React.FC<{ x: number; y: number; r: number; start: number; stop: number; at: number; until: number; face?: string; ink?: string; flash?: string }> = ({
  x,
  y,
  r,
  start,
  stop,
  at,
  until,
  face = SKY.cloud,
  ink = SKY.deep,
  flash = SKY.accent,
}) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const run = Math.max(0, Math.min(frame, stop) - start);
  const ang = run * 14; // degrees per frame
  const fl = frame >= stop ? 1 - progress(frame, stop, 14, EASE.soft) : 0;
  const stopped = frame >= stop;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {fl > 0 ? <circle r={r * (1.2 + 0.5 * (1 - fl))} fill="none" stroke={flash} strokeWidth={r * 0.14} opacity={fl} /> : null}
      <rect x={-r * 0.18} y={-r * 1.32} width={r * 0.36} height={r * 0.3} rx={r * 0.08} fill={ink} />
      <rect x={-r * 0.34} y={-r * 1.42} width={r * 0.68} height={r * 0.16} rx={r * 0.08} fill={stopped ? flash : ink} />
      <circle r={r} fill={ink} />
      <circle r={r * 0.84} fill={face} />
      {[0, 90, 180, 270].map((d) => (
        <rect key={d} x={-r * 0.04} y={-r * 0.78} width={r * 0.08} height={r * 0.16} rx={r * 0.04} fill={ink} transform={`rotate(${d})`} />
      ))}
      <g transform={`rotate(${ang})`}>
        <rect x={-r * 0.05} y={-r * 0.7} width={r * 0.1} height={r * 0.78} rx={r * 0.05} fill={stopped ? flash : ink} />
      </g>
      <circle r={r * 0.1} fill={ink} />
    </g>
  );
};

/** Horizontal meter with a label above. */
export const Meter: React.FC<{ x: number; y: number; w: number; h?: number; value: number; label: string; color: string; track?: string; at: number; until?: number; labelColor?: string; size?: number }> = ({
  x,
  y,
  w,
  h = 34,
  value,
  label,
  color,
  track = "#1B3A55",
  at,
  until,
  labelColor = PITCH.chalk,
  size = 34,
}) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until);
  if (o <= 0.001) return null;
  const v = Math.max(0, Math.min(1, value));
  return (
    <g opacity={o} transform={`translate(${x} ${y + (1 - o) * 14})`}>
      <text x={0} y={-18} fill={labelColor} fontFamily={FONTS.hud} fontWeight={700} fontSize={size} letterSpacing={3}>
        {label}
      </text>
      <rect x={0} y={0} width={w} height={h} rx={h / 2} fill={track} />
      {v > 0.001 ? <rect x={0} y={0} width={Math.max(h, w * v)} height={h} rx={h / 2} fill={color} /> : null}
    </g>
  );
};

/**
 * Hover meter: a ring around the ball at the top of its bounce that fills while the ball barely moves.
 * `value` 0..1. The label sits above the ring.
 */
export const HangRing: React.FC<{
  cx: number;
  cy: number;
  r: number;
  value: number;
  at: number;
  until?: number;
  label?: string;
  color?: string;
  size?: number;
  labelDx?: number;
  /** Label centre y from the ring centre. Default: just above the ring. A short leader joins a label set further out. */
  labelDy?: number;
}> = ({
  cx,
  cy,
  r,
  value,
  at,
  until,
  label = "HANG TIME",
  color = PITCH.teal,
  size = 32,
  labelDx = 0,
  labelDy,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 170, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const v = Math.max(0, Math.min(1, value));
  const w = r * 0.26;
  const a = -Math.PI / 2 + v * Math.PI * 2 * 0.999;
  const large = v > 0.5 ? 1 : 0;
  const full = v >= 0.999;
  const lw = label.length * size * 0.72 + size * 1.2;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <circle r={r} fill="none" stroke="#1B3A55" strokeWidth={w} opacity={0.9} />
      {v > 0.001 ? (
        full ? (
          <circle r={r} fill="none" stroke={color} strokeWidth={w} />
        ) : (
          <path d={`M0,${-r} A${r},${r} 0 ${large} 1 ${Math.cos(a) * r},${Math.sin(a) * r}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />
        )
      ) : null}
      {labelDy !== undefined ? (
        <line
          x1={Math.cos(Math.atan2(labelDy, labelDx)) * (r + w * 0.8)}
          y1={Math.sin(Math.atan2(labelDy, labelDx)) * (r + w * 0.8)}
          x2={labelDx - lw * 0.28}
          y2={labelDy + size * 0.7}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray="2 9"
        />
      ) : null}
      <g transform={`translate(${labelDx} ${labelDy ?? -r - w - size * 0.95})`}>
        <rect x={-lw / 2} y={-size * 0.78} width={lw} height={size * 1.56} rx={size * 0.78} fill={color} />
        <text y={size * 0.35} fill={PITCH.sky} fontFamily={FONTS.hud} fontWeight={700} fontSize={size} textAnchor="middle" letterSpacing={2}>
          {label}
        </text>
      </g>
    </g>
  );
};

/** Damped ripple rings on a net at a point (any view). */
export const NetRipple: React.FC<{ cx: number; cy: number; at: number; size?: number; color?: string; squashY?: number }> = ({ cx, cy, at, size = 80, color = PITCH.chalk, squashY = 0.7 }) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / 34;
  if (t < 0 || t > 1) return null;
  return (
    <g transform={`translate(${cx} ${cy})`} fill="none" stroke={color} strokeLinecap="round">
      {[0, 0.22, 0.44].map((d, i) => {
        const u = t - d;
        if (u <= 0) return null;
        const rr = size * (0.2 + u * 1.2);
        return <ellipse key={i} rx={rr} ry={rr * squashY} strokeWidth={Math.max(2, size * 0.06) * (1 - u)} opacity={(1 - u) * 0.8} />;
      })}
    </g>
  );
};

/** A word card icon overlay drawn with the same pop and width as the kit WordCard (top-right anchored at x, y). */
export const WordCardIcon: React.FC<{ term: string; meaning: string; at: number; until: number; x: number; y: number }> = ({ term, meaning, at, until, x, y }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const w = Math.max(term.length * 36, meaning.length * 19, 260) + 90;
  // Icon sits to the right of the term, inside the card.
  const ix = 24 + term.length * 31 + 56;
  const iy = 98;
  const loop = ((frame - at) % 45) / 45;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(${-w} 0)`}>
      <g transform={`translate(${ix} ${iy})`}>
        <circle r={24} fill={CAST.ball} />
        <g transform={`rotate(${loop * 360})`}>
          <path d="M-24,0 L24,0" stroke={CAST.ballLine} strokeWidth={4} strokeLinecap="round" />
        </g>
        {/* Arrow over the top of the ball, curling forward (towards the goal, clockwise). */}
        <path d="M-34,-6 A36,36 0 0 1 26,-26" fill="none" stroke={PITCH.accent} strokeWidth={7} strokeLinecap="round" />
        <path d="M40,-14 L18,-36 L14,-10 Z" fill={PITCH.accent} stroke={PITCH.accent} strokeWidth={3} strokeLinejoin="round" />
      </g>
    </g>
  );
};

/** A chalk plate behind a stamp, so it reads on bright or busy backgrounds. */
export const StampPlate: React.FC<{ x: number; y: number; w: number; h: number; at: number; until?: number; color?: string; rotate?: number }> = ({ x, y, w, h, at, until, color = PITCH.chalk, rotate = -6 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 320, damping: 18 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={24} fill={color} />
    </g>
  );
};

/** Count-up tally: a label and a big number that bumps when it changes. */
export const Tally: React.FC<{ x: number; y: number; label: string; value: number; bumpAt: number[]; at: number; until?: number; color?: string; size?: number }> = ({
  x,
  y,
  label,
  value,
  bumpAt,
  at,
  until,
  color = PITCH.chalk,
  size = 96,
}) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until);
  if (o <= 0.001) return null;
  const bump = bumpAt.reduce((m, f) => Math.max(m, frame >= f ? 1 - progress(frame, f, 12, EASE.soft) : 0), 0);
  return (
    <g opacity={o} transform={`translate(${x} ${y})`}>
      <text x={0} y={-size * 0.92} fill={color} opacity={0.8} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={3}>
        {label}
      </text>
      <g transform={`scale(${1 + 0.25 * bump})`}>
        <text x={0} y={0} fill={bump > 0.05 ? PITCH.light : color} fontFamily={FONTS.mono} fontWeight={500} fontSize={size}>
          {value}
        </text>
      </g>
    </g>
  );
};

/** See-through boot around the x-ray foot bones, with lace dashes on the instep (the contact zone). */
export const XRayBoot: React.FC<{ ankle: Pt; toe: Pt; h: number; laces?: number; color?: string }> = ({ ankle, toe, h, laces = 0, color = XRAY.tissue }) => {
  const dx = toe.x - ankle.x;
  const dy = toe.y - ankle.y;
  const L = Math.hypot(dx, dy) || 1;
  const d = { x: dx / L, y: dy / L };
  const n = { x: -d.y, y: d.x }; // sole side
  const rh = 0.052 * h;
  const rt = 0.032 * h;
  const heel = { x: ankle.x - d.x * 0.02 * h, y: ankle.y - d.y * 0.02 * h };
  const pts = [
    { x: heel.x - n.x * rh, y: heel.y - n.y * rh },
    { x: toe.x - n.x * rt, y: toe.y - n.y * rt },
    { x: toe.x + n.x * rt, y: toe.y + n.y * rt },
    { x: heel.x + n.x * rh, y: heel.y + n.y * rh },
  ];
  const lace = (t: number) => {
    const c = { x: ankle.x + dx * t, y: ankle.y + dy * t };
    const w = rh + (rt - rh) * t;
    return { a: { x: c.x - n.x * w * 0.95, y: c.y - n.y * w * 0.95 }, b: { x: c.x - n.x * w * 0.45 + d.x * 6, y: c.y - n.y * w * 0.45 + d.y * 6 } };
  };
  return (
    <g>
      <g fill={color} opacity={0.45}>
        <polygon points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} />
        <circle cx={heel.x} cy={heel.y} r={rh} />
        <circle cx={toe.x} cy={toe.y} r={rt} />
      </g>
      {laces > 0.001 ? (
        <g stroke={XRAY.lime} strokeWidth={0.008 * h} strokeLinecap="round" opacity={laces}>
          {[0.18, 0.3, 0.42, 0.54, 0.66].map((t) => {
            const l = lace(t);
            return <line key={t} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} />;
          })}
        </g>
      ) : null}
    </g>
  );
};

/** Small idle breathing on a side-view pose (torso, head and arms), so a standing figure is never still. */
export const breathe = <P extends { torso: number; head: number; nearShoulder: number; farShoulder: number }>(pose: P, frame: number, amount = 1, seed = 0): P => ({
  ...pose,
  torso: pose.torso + idle(frame, seed, 3.2, 1.2 * amount),
  head: pose.head + idle(frame, seed + 0.7, 3.2, 1.6 * amount),
  nearShoulder: pose.nearShoulder + idle(frame, seed + 1.3, 3.2, 1.5 * amount),
  farShoulder: pose.farShoulder + idle(frame, seed + 1.9, 3.2, 1.5 * amount),
});

/**
 * Word cues with a fix for whisper drift. `measured` maps a phrase to its onset in seconds, measured on the
 * final VO clip (ffmpeg silencedetect at -35 dB, 70 ms, plus the loudness envelope). After a pause, whisper
 * can place a word up to about 1.2 s early or late. The phrase still goes through useCues, so a script
 * change fails loudly. If the measured onset is more than 45 frames from the whisper cue, the audio has
 * changed, and the whisper cue wins.
 */
export const voCues = (cue: Cue, measured: Record<string, number>) => (phrase: string, offset = 0) => {
  const w = cue(phrase);
  const m = measured[phrase];
  if (m === undefined) return w + offset;
  const f = Math.round(cue.lead + m * 30);
  return (Math.abs(f - w) <= 45 ? f : w) + offset;
};
