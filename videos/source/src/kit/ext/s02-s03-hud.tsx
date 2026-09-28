// On-screen graphics for s02-s03: stopwatch, rewind tag, floodlight icon, kick tags,
// speed bars, chalk marks, the tether that snaps, and the two-line chalk title.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { EASE, idle, pop, popSoft, progress, visible } from "../../lib/anim";
import { Glow } from "../World";

/** Stopwatch HUD: a watch face whose hand sweeps once per 0.01 s, and mono digits. */
export const Stopwatch: React.FC<{ x: number; y: number; value: number; at: number; until?: number; scale?: number }> = ({ x, y, value, at, until, scale = 1 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const hand = (value / 0.01) * 360;
  const r = 58;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * scale})`}>
      <rect x={-r - 36} y={-r - 34} width={2 * r + 72 + 330} height={2 * r + 68} rx={r + 34} fill={PITCH.skyHigh} opacity={0.82} />
      <rect x={-12} y={-r - 22} width={24} height={16} rx={6} fill={PITCH.chalk} />
      <circle r={r + 7} fill={PITCH.chalk} />
      <circle r={r - 3} fill={PITCH.sky} />
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={0} y1={-r + 8} x2={0} y2={-r + 18} stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" opacity={0.6} transform={`rotate(${i * 36})`} />
      ))}
      <path d={`M0,0 L0,${-r + 6} A${r - 6},${r - 6} 0 ${hand % 360 > 180 ? 1 : 0} 1 ${Math.sin((hand * Math.PI) / 180) * (r - 6)},${-Math.cos((hand * Math.PI) / 180) * (r - 6)} Z`} fill={PITCH.accent} opacity={hand > 0.5 ? 0.35 : 0} />
      <line x1={0} y1={0} x2={0} y2={-r + 10} stroke={PITCH.accent} strokeWidth={7} strokeLinecap="round" transform={`rotate(${hand})`} />
      <circle r={8} fill={PITCH.accent} />
      <text x={r + 30} y={30} fill={PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={88}>
        {value.toFixed(3)}
        <tspan fontFamily={FONTS.hud} fontWeight={700} fontSize={48} dx={10}>
          s
        </tspan>
      </text>
    </g>
  );
};

/** Rewind tag: pill with two pulsing triangles and the word REWIND. */
export const RewindTag: React.FC<{ at: number; until: number }> = ({ at, until }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 8, 8);
  if (o <= 0.001) return null;
  const pulse = 0.55 + 0.45 * Math.sin(frame / 3);
  return (
    <g opacity={o} transform={`translate(70 ${70 + (1 - o) * -20})`}>
      <rect width={300} height={72} rx={36} fill={PITCH.skyHigh} opacity={0.8} />
      <g fill={PITCH.accent} opacity={pulse}>
        <path d="M58,20 L30,36 L58,52 Z" />
        <path d="M86,20 L58,36 L86,52 Z" />
      </g>
      <text x={104} y={49} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={4}>
        REWIND
      </text>
    </g>
  );
};

/**
 * Small floodlight icon in a corner that blinks off once at `blink`. Same build as the stadium
 * floodlights: a lamp head (wide rounded box) on top of a tall thin pole, with a glow and a soft beam.
 */
export const FloodIcon: React.FC<{ x: number; y: number; at: number; blink: number; until: number }> = ({ x, y, at, blink, until }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const off = frame >= blink && frame < blink + 7 ? 0 : frame >= blink + 7 && frame < blink + 10 ? 0.5 : 1;
  const sway = idle(frame, 3, 3, 1.5);
  const R = 86;
  // Lamp head: the stadium lamps are 4.4 m x 2.8 m with corner radius 0.7 m.
  const hw = 38;
  const hh = 24;
  const headY = -44;
  return (
    <g transform={`translate(${x} ${y + sway}) scale(${s})`}>
      <defs>
        <clipPath id="flood-icon-disc">
          <circle cx={0} cy={0} r={R} />
        </clipPath>
      </defs>
      <circle cx={0} cy={0} r={R} fill={PITCH.skyHigh} opacity={0.85} />
      <g clipPath="url(#flood-icon-disc)">
        {/* Soft beam down from the lamp head. */}
        <path d={`M${-hw + 6},${headY + hh} L${hw - 6},${headY + hh} L${R},${R} L${-R},${R} Z`} fill={PITCH.lightSoft} opacity={0.13 * off} />
        <Glow cx={0} cy={headY} r={84} color={PITCH.lightSoft} intensity={off * 1.1} rings={4} />
      </g>
      {/* Pole with a small foot. */}
      <rect x={-4.5} y={headY} width={9} height={112} rx={4.5} fill={PITCH.standsLight} />
      <rect x={-20} y={headY + 106} width={40} height={10} rx={5} fill={PITCH.standsLight} />
      {/* Lamp head. */}
      <rect x={-hw} y={headY - hh} width={hw * 2} height={hh * 2} rx={hh * 0.5} fill={PITCH.standsLight} />
      <rect x={-hw} y={headY - hh} width={hw * 2} height={hh * 2} rx={hh * 0.5} fill={PITCH.lightSoft} opacity={off} />
    </g>
  );
};

export type KickIcon = "laces" | "inside" | "volley";

/** Small boot icons: laces, inside of the foot, volley. Drawn in a 90 x 70 box around (0,0). */
const Icon: React.FC<{ kind: KickIcon }> = ({ kind }) => {
  const boot = (
    <g>
      <path d="M-34,-26 L-12,-26 L-8,-2 L22,4 Q36,8 34,20 L-34,20 Q-40,20 -40,12 L-40,-20 Q-40,-26 -34,-26 Z" fill={PITCH.sky} />
      <rect x={-40} y={16} width={74} height={7} rx={3.5} fill={PITCH.stands} />
    </g>
  );
  if (kind === "laces") {
    return (
      <g>
        {boot}
        <g stroke={PITCH.accent} strokeWidth={5} strokeLinecap="round">
          <line x1={-10} y1={-8} x2={-2} y2={-14} />
          <line x1={-2} y1={-1} x2={6} y2={-8} />
          <line x1={7} y1={3} x2={15} y2={-3} />
        </g>
      </g>
    );
  }
  if (kind === "inside") {
    // Boot seen from above, the inner edge glows.
    return (
      <g>
        <path d="M-40,-4 Q-40,-18 -24,-18 L20,-14 Q38,-12 38,0 Q38,12 20,14 L-24,18 Q-40,18 -40,4 Z" fill={PITCH.sky} />
        <path d="M-30,-17 L20,-13 Q34,-11 36,-4" fill="none" stroke={PITCH.accent} strokeWidth={7} strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <g transform="translate(-4 8) rotate(-18)">{boot}</g>
      <circle cx={26} cy={-20} r={13} fill={PITCH.accent} />
      <path d="M16,-26 A13,13 0 0 1 36,-26" fill="none" stroke={PITCH.chalk} strokeWidth={3} />
    </g>
  );
};

/**
 * Pill tag with an icon and a word. Anchor = left-middle.
 * `pin`: a screen point on the thing the tag names. A dot sits on it, and a short leader line runs to the pill.
 */
export const KickTag: React.FC<{ x: number; y: number; kind: KickIcon; text: string; at: number; until?: number; pin?: { x: number; y: number } }> = ({
  x,
  y,
  kind,
  text,
  at,
  until,
  pin,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 7, EASE.exit));
  if (s <= 0.001) return null;
  const w = 128 + text.length * 25;
  const yy = y + idle(frame, x * 0.01, 3, 2);
  // The leader aims at the pill centre. The pill covers its inner end, so it always meets the pill edge.
  const k = Math.min(1, s);
  const centre = { x: x + (w / 2) * s, y: yy };
  return (
    <g>
      {pin ? (
        <g opacity={k}>
          <line x1={pin.x} y1={pin.y} x2={pin.x + (centre.x - pin.x) * k} y2={pin.y + (centre.y - pin.y) * k} stroke={PITCH.chalk} strokeWidth={5} strokeLinecap="round" />
          <circle cx={pin.x} cy={pin.y} r={11 * k} fill={PITCH.chalk} />
          <circle cx={pin.x} cy={pin.y} r={5 * k} fill={PITCH.accent} />
        </g>
      ) : null}
      <KickPill x={x} y={yy} s={s} w={w} kind={kind} text={text} />
    </g>
  );
};

const KickPill: React.FC<{ x: number; y: number; s: number; w: number; kind: KickIcon; text: string }> = ({ x, y, s, w, kind, text }) => {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={0} y={-40} width={w} height={80} rx={40} fill={PITCH.chalk} />
      <g transform="translate(58 0) scale(0.78)">
        <Icon kind={kind} />
      </g>
      <text x={108} y={13} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={36} letterSpacing={1}>
        {text}
      </text>
    </g>
  );
};

/** Two HUD bars: FOOT (teal) and BALL (orange). Values 0..1 of the bar length. No digits. */
export const SpeedBars: React.FC<{ x: number; y: number; foot: number; ball: number; at: number; until: number; ballWin?: number }> = ({ x, y, foot, ball, at, until, ballWin = 0 }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 12, 8);
  if (o <= 0.001) return null;
  const L = 520;
  const row = (yy: number, label: string, v: number, color: string, glow: number) => (
    <g transform={`translate(0 ${yy})`}>
      <text x={0} y={14} fill={color} fontFamily={FONTS.hud} fontWeight={700} fontSize={36} letterSpacing={3}>
        {label}
      </text>
      <rect x={130} y={-16} width={L} height={32} rx={16} fill={PITCH.chalk} opacity={0.14} />
      {v > 0.005 ? <rect x={130} y={-16} width={Math.max(32, L * Math.min(1, v))} height={32} rx={16} fill={color} /> : null}
      {glow > 0.01 ? <Glow cx={130 + L * Math.min(1, v) - 10} cy={0} r={60} color={color} intensity={glow * 1.4} rings={3} /> : null}
    </g>
  );
  return (
    <g opacity={o} transform={`translate(${x} ${y + (1 - o) * 20})`}>
      <rect x={-40} y={-66} width={L + 210} height={200} rx={40} fill={PITCH.skyHigh} opacity={0.88} />
      {row(-8, "FOOT", foot, CAST.shirt, 0)}
      {row(68, "BALL", ball, CAST.ball, ballWin)}
    </g>
  );
};

/** A big chalk mark ("!" or "?") that pops in with overshoot and wobbles a little. */
export const ChalkMark: React.FC<{ x: number; y: number; text: string; at: number; until: number; size?: number; rotate?: number }> = ({ x, y, text, at, until, size = 200, rotate = 8 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 260, damping: 14 }) * (1 - progress(frame, until, 7, EASE.exit));
  if (s <= 0.001) return null;
  const wob = idle(frame, 1, 1.6, 3);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate + wob}) scale(${s})`}>
      <text x={0} y={size * 0.36} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle">
        {text}
      </text>
      {/* Chalk grain: a few dark specks over the letter. */}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={(random(`cm-x-${text}-${i}`) - 0.5) * size * 0.42} cy={(random(`cm-y-${text}-${i}`) - 0.62) * size * 0.8} r={2 + random(`cm-r-${text}-${i}`) * 3} fill={PITCH.sky} opacity={0.25} />
      ))}
    </g>
  );
};

/** Dotted tether between two screen points. At `snap` it breaks: halves recoil, a spark flashes. */
export const Tether: React.FC<{
  a: { x: number; y: number };
  b: { x: number; y: number };
  at: number;
  snap: number;
  width?: number;
  /** Where the spark flashes (screen). Default: the middle of the tether. */
  spark?: { x: number; y: number };
}> = ({ a, b, at, snap, width = 10, spark }) => {
  const frame = useCurrentFrame();
  const o = progress(frame, at, 8, EASE.enter);
  if (o <= 0.001) return null;
  const k = progress(frame, snap, 9, EASE.enter);
  const fade = 1 - progress(frame, snap + 3, 9, EASE.exit);
  if (fade <= 0.001) return null;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const seg = (p: { x: number; y: number }, q: { x: number; y: number }, key: string) => (
    <line key={key} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={PITCH.chalk} strokeWidth={width} strokeDasharray={`0.1 ${width * 2.2}`} strokeLinecap="round" />
  );
  const lerp = (p: { x: number; y: number }, q: { x: number; y: number }, t: number) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const sparkT = (frame - snap) / 14;
  return (
    <g opacity={o * fade}>
      {frame < snap
        ? seg(a, b, "whole")
        : [seg(a, lerp(mid, a, k * 0.9), "l"), seg(b, lerp(mid, b, k * 0.9), "r")]}
      {sparkT >= 0 && sparkT <= 1 ? (
        <g transform={`translate(${(spark ?? mid).x} ${(spark ?? mid).y})`} opacity={1 - sparkT}>
          <Glow cx={0} cy={0} r={90 * (0.5 + sparkT)} color={PITCH.light} intensity={1.6} rings={3} />
          {Array.from({ length: 8 }, (_, i) => {
            const ang = (i / 8) * Math.PI * 2 + 0.3;
            const r0 = 14 + 40 * sparkT;
            const r1 = r0 + 26 * (1 - sparkT);
            return <line key={i} x1={Math.cos(ang) * r0} y1={Math.sin(ang) * r0} x2={Math.cos(ang) * r1} y2={Math.sin(ang) * r1} stroke={PITCH.light} strokeWidth={7} strokeLinecap="round" />;
          })}
        </g>
      ) : null}
    </g>
  );
};

/** Impact flicks from a contact point: short chalk dashes that fan out above and below it. */
export const ImpactLines: React.FC<{ x: number; y: number; at: number; until: number; r?: number; angle?: number }> = ({ x, y, at, until, r = 150, angle = 0 }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 6, 8);
  if (o <= 0.001) return null;
  const grow = progress(frame, at, 10, EASE.enter);
  const angs = [-62, -90, -118, 62, 90, 118];
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={o}>
      {angs.map((a, i) => {
        const t = (a * Math.PI) / 180;
        const r0 = r * (0.55 + 0.04 * Math.sin(frame / 4 + i));
        const r1 = r0 + r * 0.38 * grow;
        return <line key={i} x1={Math.cos(t) * r0} y1={Math.sin(t) * r0} x2={Math.cos(t) * r1} y2={Math.sin(t) * r1} stroke={PITCH.lightSoft} strokeWidth={9} strokeLinecap="round" />;
      })}
    </g>
  );
};

/**
 * The title in chalk letters, two lines, letters popping in one after another, with an orange underline.
 * `out` 0..1 shrinks the letters back (for the slide into the pitch markings).
 */
export const ChalkTitle: React.FC<{
  lines: string[];
  x: number;
  y: number;
  at: number;
  out?: number;
  size?: number;
  stagger?: number;
  lineGap?: number;
  /** Frame to animate on instead of the scene frame (so s03 can continue s02's title without a jump). */
  clock?: number;
}> = ({ lines, x, y, at, out = 0, size = 132, stagger = 1.2, lineGap = 1.12, clock }) => {
  const current = useCurrentFrame();
  const frame = clock ?? current;
  if (frame < at || out >= 0.999) return null;
  const adv = (ch: string) => (ADV[ch] ?? 0.64) * size + size * 0.06;
  let idx = 0;
  const total = lines.reduce((n, l) => n + l.length, 0);
  const rows = lines.map((line, li) => {
    const yy = y + (li - (lines.length - 1) / 2) * size * lineGap + size * 0.35;
    const w = line.split("").reduce((n, ch) => n + adv(ch), 0) - size * 0.06;
    let cursor = x - w / 2;
    const letters = line.split("").map((ch, ci) => {
      const my = idx++;
      const lx = cursor + adv(ch) / 2 - size * 0.03;
      cursor += adv(ch);
      if (ch === " ") return null;
      const s = pop(frame, at + my * stagger, { stiffness: 240, damping: 13 }) * (1 - out);
      if (s <= 0.001) return null;
      const rot = (random(`t-rot-${li}-${ci}`) - 0.5) * 7 + idle(frame, ci + li * 7, 2.6, 1.2);
      const dy = (random(`t-dy-${li}-${ci}`) - 0.5) * size * 0.05;
      return (
        <text
          key={`${li}-${ci}`}
          x={0}
          y={0}
          transform={`translate(${lx} ${yy + dy}) rotate(${rot}) scale(${s})`}
          fill={PITCH.chalk}
          fontFamily={FONTS.title}
          fontWeight={800}
          fontSize={size}
          textAnchor="middle"
        >
          {ch}
        </text>
      );
    });
    return { letters, yy, w };
  });
  const last = rows[rows.length - 1];
  const line = progress(frame, at + total * stagger + 2, 14, EASE.standard) * (1 - out);
  return (
    <g>
      {rows.map((r, i) => (
        <g key={i}>{r.letters}</g>
      ))}
      {line > 0.001 ? (
        <rect x={x - (last.w / 2) * line} y={last.yy + size * 0.2} width={last.w * line} height={size * 0.11} rx={size * 0.055} fill={PITCH.accent} />
      ) : null}
    </g>
  );
};

export const LIME = XRAY.lime;

/** Rough advance widths (em) of Rubik 800 capitals, so per-letter titles space like real text. */
const ADV: Record<string, number> = {
  A: 0.7, B: 0.66, C: 0.66, D: 0.7, E: 0.58, F: 0.56, G: 0.7, H: 0.72, I: 0.3, J: 0.54, K: 0.68, L: 0.55, M: 0.86,
  N: 0.74, O: 0.74, P: 0.64, Q: 0.74, R: 0.66, S: 0.62, T: 0.6, U: 0.7, V: 0.68, W: 0.95, X: 0.68, Y: 0.66, Z: 0.6,
  " ": 0.26, "·": 0.3, "1": 0.5, "2": 0.6, "3": 0.6,
};

/** "SLOW MOTION" tag, top-left, with a pulsing dot. Same look as the kit tag, text at 34 px. */
export const SlowTag: React.FC<{ at: number; until: number; label?: string }> = ({ at, until, label = "SLOW MOTION" }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until);
  if (o <= 0.001) return null;
  const pulse = 0.6 + 0.4 * Math.sin(frame / 5);
  return (
    <g opacity={o} transform={`translate(70 ${64 + (1 - o) * -16})`}>
      <rect width={label.length * 25 + 96} height={72} rx={36} fill={PITCH.skyHigh} opacity={0.82} />
      <circle cx={38} cy={36} r={12} fill={CAST.mistake} opacity={pulse} />
      <text x={66} y={48} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={4}>
        {label}
      </text>
    </g>
  );
};

/**
 * Chapter card with the same look as the kit ChapterCard, but the title is written left to right
 * behind a growing clip, so the letters never shift sideways while they appear.
 */
export const ChapterWrite: React.FC<{ number: number; title: string; subtitle: string; at: number; until: number; id?: string }> = ({
  number,
  title,
  subtitle,
  at,
  until,
  id = "chapter-write",
}) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 10, 10);
  if (o <= 0.001) return null;
  const write = progress(frame, at, 18, EASE.soft);
  const full = `${number} · ${title}`;
  const size = 120;
  const spacing = 6;
  const w = full.split("").reduce((n, ch) => n + (ADV[ch] ?? 0.64) * size + spacing, 0);
  const x0 = WIDTH / 2 - w / 2 - 24;
  const reveal = (w + 48) * write;
  return (
    <g opacity={o}>
      <defs>
        <clipPath id={id}>
          <rect x={x0} y={HEIGHT / 2 - 110} width={reveal} height={170} />
        </clipPath>
      </defs>
      <rect x={0} y={HEIGHT * 0.34} width={WIDTH} height={HEIGHT * 0.32} fill={PITCH.sky} opacity={0.55} />
      <g clipPath={`url(#${id})`}>
        <text x={WIDTH / 2} y={HEIGHT / 2 + 20} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle" letterSpacing={spacing}>
          {full}
        </text>
      </g>
      {write > 0.02 && write < 0.99 ? <circle cx={x0 + reveal} cy={HEIGHT / 2 - 20 + 26 * Math.sin(frame * 1.7)} r={9} fill={PITCH.chalk} opacity={0.8} /> : null}
      <text x={WIDTH / 2} y={HEIGHT / 2 + 100} fill={PITCH.light} opacity={progress(frame, at + 14, 10)} fontFamily={FONTS.label} fontWeight={800} fontSize={48} textAnchor="middle">
        {subtitle}
      </text>
    </g>
  );
};
