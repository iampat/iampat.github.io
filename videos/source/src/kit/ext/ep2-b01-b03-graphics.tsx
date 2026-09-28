// Graphics for b02 and b03: chalk stick figures (a sprinter and a stroller), the three chapter icons
// that grow out of time coins, a chalk heart, the jogging-Chalk rule card, a ring that draws itself on,
// freeze-frame corner marks, a metre tag on a dotted line and faint pitch lines behind the title.
// Everything takes a 0..1 progress or a frame, never seconds.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { EASE, clamp01, idle, pop, popSoft, progress } from "../../lib/anim";
import { trim } from "../ep2/chalk";
import { TopPlayer } from "../TopPlayer";
import { Glow } from "../World";

const CH = PITCH.chalk;

/**
 * A chalk stick figure seen from the side, facing right. `h` is the height in pixels. `run` 0..1 is how hard
 * it runs (limb swing and lean), `phase` the stride phase (one cycle per 1.0). `trail` draws speed lines behind.
 */
export const ChalkRunner: React.FC<{
  x: number;
  y: number;
  h: number;
  run: number;
  phase: number;
  trail?: number;
  color?: string;
  opacity?: number;
  sw?: number;
  /** A shirt colour: the body is drawn as a thick stroke in this colour (Tavi's teal marks the calm player). */
  accent?: string;
}> = ({ x, y, h, run, phase, trail = 0, color = CH, opacity = 1, sw, accent }) => {
  const w = sw ?? Math.max(5, h * 0.045);
  const headR = h * 0.09;
  const hipY = -h * 0.47;
  const shoulderY = -h * 0.78;
  const thigh = h * 0.24;
  const shin = h * 0.23;
  const upper = h * 0.16;
  const fore = h * 0.15;
  const swing = Math.sin(phase * Math.PI * 2);
  const amp = 8 + 44 * run;
  const lean = 16 * run;
  const bob = run * h * 0.012 * Math.abs(Math.cos(phase * Math.PI * 2));
  const rad = (d: number) => (d * Math.PI) / 180;
  const leg = (sign: number, key: string, o: number) => {
    const hipA = sign * swing * amp;
    const kneeBend = Math.max(0, sign * swing) * (20 + 60 * run) + 6;
    const kx = Math.sin(rad(hipA)) * thigh;
    const ky = hipY + Math.cos(rad(hipA)) * thigh;
    const ax = kx + Math.sin(rad(hipA - kneeBend)) * shin;
    const ay = ky + Math.cos(rad(hipA - kneeBend)) * shin;
    const fx = ax + Math.cos(rad(-(hipA - kneeBend) - 8)) * h * 0.09;
    const fy = ay - Math.sin(rad(-(hipA - kneeBend) - 8)) * h * 0.09 * 0.15;
    return <polyline key={key} points={`0,${hipY} ${kx},${ky} ${ax},${ay} ${fx},${fy}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} />;
  };
  const arm = (sign: number, key: string, o: number) => {
    const a = -sign * swing * amp * 0.8 + 6;
    const ex = Math.sin(rad(a)) * upper;
    const ey = shoulderY + Math.cos(rad(a)) * upper;
    const bend = 30 + 70 * run;
    const hx = ex + Math.sin(rad(a + bend)) * fore;
    const hy = ey + Math.cos(rad(a + bend)) * fore;
    return <polyline key={key} points={`0,${shoulderY} ${ex},${ey} ${hx},${hy}`} fill="none" stroke={color} strokeWidth={w * 0.85} strokeLinecap="round" strokeLinejoin="round" opacity={o} />;
  };
  return (
    <g transform={`translate(${x} ${y - bob})`} opacity={opacity}>
      {trail > 0.01
        ? [0, 1, 2, 3, 4].map((i) => {
            const len = (40 + i * 26) * trail;
            const yy = -h * (0.25 + i * 0.13);
            return <line key={i} x1={-h * 0.22 - i * 14} y1={yy} x2={-h * 0.22 - i * 14 - len} y2={yy} stroke={color} strokeWidth={w * 0.7} strokeLinecap="round" opacity={0.45 * trail * (1 - i * 0.12)} />;
          })
        : null}
      <g transform={`rotate(${lean} 0 ${hipY})`}>
        {leg(-1, "farLeg", 0.55)}
        {arm(-1, "farArm", 0.55)}
        {accent ? (
          <line x1={0} y1={hipY + h * 0.02} x2={0} y2={shoulderY + h * 0.01} stroke={accent} strokeWidth={w * 3.2} strokeLinecap="round" />
        ) : (
          <line x1={0} y1={hipY} x2={0} y2={shoulderY} stroke={color} strokeWidth={w * 1.1} strokeLinecap="round" />
        )}
        <circle cx={h * 0.02} cy={shoulderY - headR * 1.25} r={headR} fill="none" stroke={color} strokeWidth={w} />
        <circle cx={h * 0.02 + headR * 0.45} cy={shoulderY - headR * 1.35} r={w * 0.45} fill={color} />
        {leg(1, "nearLeg", 1)}
        {arm(1, "nearArm", 1)}
      </g>
    </g>
  );
};

/** One chalk stroke drawn to t. */
const S: React.FC<{ d: string; t: number; w?: number; color?: string; o?: number }> = ({ d, t, w = 6, color = CH, o = 0.95 }) =>
  t <= 0.002 ? null : <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} {...trim(t)} />;

export type ChapterIconKind = "look" | "touch" | "shape";

/**
 * A time coin (chalk disc with clock hands) that turns into a chapter icon. `morph` 0 = coin, 1 = icon.
 * `lit` 0..1 adds a lime glow. `gold` 0..1 gives the coin a gold rim and face. Drawn in a circle of radius `r`
 * around (x, y).
 */
export const ChapterIcon: React.FC<{ x: number; y: number; r?: number; kind: ChapterIconKind; appear: number; morph: number; lit?: number; label?: string; gold?: number }> = ({
  x,
  y,
  r = 48,
  kind,
  appear,
  morph,
  lit = 0,
  label,
  gold = 0,
}) => {
  const s = appear <= 0 ? 0 : appear >= 1 ? 1 : EASE.back(appear);
  if (s <= 0.001) return null;
  const k = r / 48;
  const hands = 1 - clamp01(morph * 2.2);
  const draw = clamp01((morph - 0.15) / 0.85);
  const g = clamp01(gold);
  const ringColor = lit > 0.01 ? mix(CH, XRAY.lime, lit) : g > 0.01 ? mix(CH, PITCH.light, g) : CH;
  let icon: React.ReactNode = null;
  if (kind === "look") {
    icon = (
      <g>
        <S d="M-26,2 Q0,-24 26,2 Q0,26 -26,2" t={draw} />
        <circle cx={0} cy={2} r={7 * clamp01(draw * 1.6 - 0.4)} fill={CH} />
        <S d="M-18,-22 A26,26 0 0 1 20,-26" t={clamp01(draw * 1.4 - 0.3)} w={4.5} />
        <S d="M12,-32 L22,-26 L14,-17" t={clamp01(draw * 1.6 - 0.6)} w={4.5} />
      </g>
    );
  } else if (kind === "touch") {
    icon = (
      <g>
        {/* Boot from the side, toe to the right, giving way (a small arrow back). */}
        <S d="M-22,8 L-22,22 L24,22 Q30,22 30,16 L26,12 L4,6 L-2,-6 L-16,-6 L-22,0 Z" t={draw} />
        <S d={`M-6,-24 A10,10 0 1 1 -6,-23.9`} t={clamp01(draw * 1.4 - 0.2)} w={5} />
        <circle cx={-6} cy={-19} r={9.5 * clamp01(draw * 1.4 - 0.3)} fill="none" stroke={CH} strokeWidth={5} />
        <S d="M-34,-2 L-34,14" t={clamp01(draw * 1.6 - 0.6)} w={4} />
        <S d="M-40,8 L-34,15 L-28,8" t={clamp01(draw * 1.8 - 0.8)} w={4} />
      </g>
    );
  } else {
    icon = (
      <g>
        {/* Top-down body, side-on: a shoulder capsule and a head, with a half circle of sight in front. */}
        <path d={`M-4,-30 A30,30 0 0 1 -4,30 Z`} fill={XRAY.lime} opacity={0.32 * clamp01(draw * 1.6 - 0.5)} />
        <S d="M-4,-30 A30,30 0 0 1 -4,30" t={clamp01(draw * 1.5 - 0.4)} w={4.5} color={XRAY.lime} />
        <S d="M-10,-16 L-10,16" t={draw} w={11} />
        <circle cx={-6} cy={0} r={7 * clamp01(draw * 1.5 - 0.3)} fill={CH} />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s * k})`}>
      {lit > 0.01 ? <Glow cx={0} cy={0} r={90} color={XRAY.lime} intensity={lit * 0.9} rings={3} /> : null}
      <circle r={48} fill={PITCH.skyHigh} opacity={0.55 + 0.35 * g} />
      {g > 0.01 ? <circle r={44} fill={PITCH.light} opacity={0.2 * g} /> : null}
      <circle r={48} fill="none" stroke={ringColor} strokeWidth={6 + 4 * g} />
      {g > 0.01 ? <circle r={36} fill="none" stroke={PITCH.light} strokeWidth={2.5} opacity={0.55 * g} /> : null}
      {hands > 0.01 ? (
        <g opacity={hands} transform={`rotate(${(1 - hands) * 90})`}>
          <line x1={0} y1={0} x2={0} y2={-26} stroke={CH} strokeWidth={6} strokeLinecap="round" />
          <line x1={0} y1={0} x2={17} y2={4} stroke={CH} strokeWidth={6} strokeLinecap="round" />
          <circle r={5} fill={CH} />
        </g>
      ) : null}
      {icon}
      {label ? (
        <text y={48 + 48} fill={CH} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} textAnchor="middle" letterSpacing={4} opacity={clamp01(draw * 1.5 - 0.5)}>
          {label}
        </text>
      ) : null}
    </g>
  );
};

/** A name over a map token (chalk, 34 px), popping in at `at` and leaving at `until`. `pill` draws a dark pill behind it. */
export const TokenName: React.FC<{ x: number; y: number; text: string; at: number; until?: number; size?: number; color?: string; pill?: boolean }> = ({
  x,
  y,
  text,
  at,
  until,
  size = 34,
  color = CH,
  pill = false,
}) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const pw = text.length * size * 0.72 + size * 0.9;
  const ph = size * 1.45;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={Math.min(1, s)}>
      {pill ? <rect x={-pw / 2} y={-size * 1.08} width={pw} height={ph} rx={ph / 2} fill={PITCH.skyHigh} opacity={0.85} /> : null}
      <text fill={color} fontFamily={FONTS.hud} fontWeight={700} fontSize={size} textAnchor="middle" letterSpacing={3}>
        {text}
      </text>
    </g>
  );
};

const mix = (a: string, b: string, t: number) => {
  const k = clamp01(t);
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
};

/** A chalk heart that beats once at `beat` (a frame). */
export const ChalkHeart: React.FC<{ x: number; y: number; at: number; beat: number; until: number; size?: number }> = ({ x, y, at, beat, until, size = 46 }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const b = frame < beat ? 0 : Math.max(0, Math.sin(Math.min(Math.PI, ((frame - beat) / 12) * Math.PI)));
  const k = (size / 46) * s * (1 + 0.3 * b);
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {b > 0.01 ? <Glow cx={0} cy={0} r={90} color={CAST.mistake} intensity={b * 1.2} rings={3} /> : null}
      <path d="M0,34 C-46,4 -40,-30 -14,-30 C-4,-30 0,-22 0,-16 C0,-22 4,-30 14,-30 C40,-30 46,4 0,34 Z" fill={CAST.mistake} opacity={0.35 + 0.35 * b} />
      <path d="M0,34 C-46,4 -40,-30 -14,-30 C-4,-30 0,-22 0,-16 C0,-22 4,-30 14,-30 C40,-30 46,4 0,34 Z" fill="none" stroke={CH} strokeWidth={5} strokeLinejoin="round" />
    </g>
  );
};

/**
 * The rule card (screen pixels, (x, y) is the top-left of the words' row): "4 metres every second" over a small
 * track with a tick every 4 m. A small Chalk token jogs along it at a constant pace, one gap per second, and
 * each tick flashes as he passes it, so the rule moves even while the replay is frozen.
 */
export const JogRule: React.FC<{ x: number; y: number; at: number; until: number }> = ({ x, y, at, until }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const text = "4 metres every second";
  const gaps = 5;
  const gap = 94;
  const x0 = 50;
  const w = x0 * 2 + gap * gaps;
  const trackY = 50;
  const secs = Math.max(0, frame - at - 8) / 30;
  const run = secs % gaps;
  const tx = x0 + run * gap;
  // Fade in at the start of each lap and out at its end, so the wrap never jumps.
  const lapFade = clamp01(run / 0.12) * clamp01((gaps - run) / 0.12);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={0} y={-50} width={w} height={158} rx={40} fill={PITCH.skyHigh} opacity={0.88} />
      <text x={w / 2} y={2} fill={CH} fontFamily={FONTS.label} fontWeight={800} fontSize={36} textAnchor="middle">
        {text}
      </text>
      <line x1={x0} y1={trackY} x2={x0 + gap * gaps} y2={trackY} stroke={CH} strokeWidth={4} strokeLinecap="round" opacity={0.45} />
      {Array.from({ length: gaps + 1 }, (_, i) => {
        // A tick lights up for a moment when the token reaches it.
        const since = secs - i - Math.floor(secs / gaps) * gaps;
        const flash = i > 0 && since >= 0 && since < 0.5 ? 1 - since / 0.5 : 0;
        return (
          <g key={i}>
            <line x1={x0 + i * gap} y1={trackY - 12} x2={x0 + i * gap} y2={trackY + 12} stroke={flash > 0 ? mix(CH, PITCH.light, flash) : CH} strokeWidth={4 + 3 * flash} strokeLinecap="round" opacity={0.7 + 0.3 * flash} />
            <text x={x0 + i * gap} y={trackY + 44} fill={CH} fontFamily={FONTS.hud} fontWeight={700} fontSize={22} textAnchor="middle" opacity={0.75 + 0.25 * flash}>
              {i === 0 ? "0" : `${i * 4} m`}
            </text>
          </g>
        );
      })}
      <TopPlayer x={tx} y={trackY} kind="chalk" size={40} facing={0} stride={(frame / 9) % 1} opacity={lapFade} />
    </g>
  );
};

/** A ring that draws itself on (chalk-lime), with tick marks around it. Screen pixels, `draw` 0..1. */
export const DrawnRing: React.FC<{ x: number; y: number; r: number; draw: number; color?: string; opacity?: number }> = ({ x, y, r, draw, color = XRAY.lime, opacity = 1 }) => {
  if (draw <= 0.001) return null;
  const d = `M${x},${y - r} A${r},${r} 0 1 1 ${x},${y + r} A${r},${r} 0 1 1 ${x},${y - r}`;
  return (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={r} fill={color} opacity={0.08 * draw} />
      <path d={d} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.9} {...trim(draw)} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray={`${r * 0.12} ${r * 0.08}`} opacity={0.45 * clamp01(draw * 1.5 - 0.5)} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const show = clamp01(draw * 1.3 - i / 12);
        return <line key={i} x1={x + Math.cos(a) * (r - 14)} y1={y + Math.sin(a) * (r - 14)} x2={x + Math.cos(a) * (r - 14 - 14 * show)} y2={y + Math.sin(a) * (r - 14 - 14 * show)} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.7 * show} />;
      })}
    </g>
  );
};

/** Freeze-frame corner marks that pop at `at` and fade at `until`. */
export const FreezeMarks: React.FC<{ at: number; until?: number; color?: string; inset?: number }> = ({ at, until, color = CH, inset = 60 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 260, damping: 16 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const L = 44 * s;
  const corner = (cx: number, cy: number, sx: number, sy: number) => <path d={`M${cx + sx * L},${cy} L${cx},${cy} L${cx},${cy + sy * L}`} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.85 * s} />;
  return (
    <g>
      {corner(inset, inset, 1, 1)}
      {corner(WIDTH - inset, inset, -1, 1)}
      {corner(inset, HEIGHT - inset, 1, -1)}
      {corner(WIDTH - inset, HEIGHT - inset, -1, -1)}
    </g>
  );
};

/** A dotted chalk line between two points with a metre tag in the middle (screen pixels). */
export const MetreLine: React.FC<{ a: { x: number; y: number }; b: { x: number; y: number }; metres: number; at: number; until?: number; color?: string; big?: boolean; below?: boolean }> = ({
  a,
  b,
  metres,
  at,
  until,
  color = CH,
  big = false,
  below = false,
}) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const size = big ? 46 : 34;
  const text = `${metres.toFixed(1)} m`;
  const w = text.length * size * 0.62 + size * 1.1;
  const h = size * 1.5;
  return (
    <g opacity={Math.min(1, s)}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={4} strokeDasharray="2 14" strokeLinecap="round" opacity={0.85} />
      <g transform={`translate(${mx} ${my + (below ? 44 : -40)}) scale(${s})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={PITCH.skyHigh} opacity={0.88} />
        <text y={size * 0.35} fill={color} fontFamily={FONTS.mono} fontWeight={500} fontSize={size} textAnchor="middle">
          {text}
        </text>
      </g>
    </g>
  );
};

/** Faint pitch lines that slide in behind the title: the halfway line and the centre circle. */
export const TitlePitchLines: React.FC<{ at: number; opacity?: number }> = ({ at, opacity = 0.22 }) => {
  const frame = useCurrentFrame();
  const t = progress(frame, at, 22, EASE.standard);
  if (t <= 0.001) return null;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const r = 300;
  return (
    <g opacity={opacity} stroke={CH} fill="none" strokeWidth={8} strokeLinecap="round">
      <line x1={cx} y1={cy - (HEIGHT / 2 + 60) * t} x2={cx} y2={cy + (HEIGHT / 2 + 60) * t} />
      <path d={`M${cx},${cy - r} A${r},${r} 0 1 1 ${cx},${cy + r} A${r},${r} 0 1 1 ${cx},${cy - r}`} {...trim(t)} />
      <line x1={-40} y1={HEIGHT - 90} x2={WIDTH + 40} y2={HEIGHT - 90} opacity={t} />
      <line x1={-40} y1={90} x2={WIDTH + 40} y2={90} opacity={t} />
      <circle cx={cx} cy={cy} r={10 * t} fill={CH} stroke="none" />
    </g>
  );
};

/** A big chalk "?" written on with a little wobble (screen or world pixels). */
export const ChalkQuestion: React.FC<{ x: number; y: number; at: number; size?: number; opacity?: number }> = ({ x, y, at, size = 120, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 220, damping: 13 });
  if (s <= 0.001) return null;
  const wob = idle(frame, 2, 1.8, 3);
  return (
    <g transform={`translate(${x} ${y}) rotate(${6 + wob}) scale(${s})`} opacity={opacity}>
      <text y={size * 0.36} fill={CH} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle">
        ?
      </text>
      {Array.from({ length: 10 }, (_, i) => (
        <circle key={i} cx={(random(`cq-x-${i}`) - 0.5) * size * 0.4} cy={(random(`cq-y-${i}`) - 0.62) * size * 0.8} r={2 + random(`cq-r-${i}`) * 3} fill={PITCH.sky} opacity={0.25} />
      ))}
    </g>
  );
};
