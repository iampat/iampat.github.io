// Parts for episode 3 scenes c16 (the one-sentence rule) and c19 (the computer played every game).
// Teal-ink view: chalk-white handwriting and doodles on the X-ray grid. Everything is flat SVG, round caps,
// no filters. Draw-on uses `trim` (0..1) so scenes can key it to cues.
//
//   ChalkWrite      hand-lettered text that writes on char by char (t 0..1), with a per-char wobble
//   ChalkStub       the piece of chalk (a rounded rectangle), used as the writing cursor
//   ChalkRing / ChalkCross / ChalkBox   marks and a rounded box, drawn on with trim
//   Crown           a chalk crown doodle
//   Calendar        a chalk calendar whose pages flip up (flip = continuous page count)
//   ChalkEyes       Chalk's dome and eyes in chalk outline; tiny chain shapes drift inside the pupils
//   MiniBoard       a very cheap 16-dot board with a seeded set of lines (three paths), for the wall
//   PositionsReadout  the big mono count on a dark pill
//   BigGrid         the X-ray grid three frames wide, so camera moves never show an edge

import React from "react";
import { FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { clamp01, idle } from "../../lib/anim";
import { popT, trim } from "../ep2/chalk";
import { allLines, type Line } from "../ep3/dots";

export const CHALK = PITCH.chalk;

/** Deterministic 0..1 noise. */
export const noise = (seed: number, k: number) => {
  const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** A small seeded generator (mulberry32). */
export const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ---- Handwriting ----

const WIDE: Record<string, number> = { M: 0.9, W: 1.0, O: 0.78, Q: 0.78, G: 0.74, D: 0.74, H: 0.74, N: 0.74, U: 0.72, C: 0.7, A: 0.7, "→": 1.0, "?": 0.58, "+": 0.64, "–": 0.64, "=": 0.64, "-": 0.42, " ": 0.34, I: 0.32, J: 0.52, L: 0.58, F: 0.6, E: 0.62, T: 0.62, S: 0.62, P: 0.64, R: 0.66, B: 0.66, K: 0.68, X: 0.66, Y: 0.66, Z: 0.64, V: 0.68, ".": 0.3, ",": 0.3 };
/** Advance width of one hand-lettered character (Nunito 800, uppercase and digits), in pixels. */
export const charW = (ch: string, size: number) => {
  if (WIDE[ch] !== undefined) return WIDE[ch] * size;
  if (/[0-9]/.test(ch)) return 0.62 * size;
  if (/[a-z]/.test(ch)) return 0.56 * size;
  return 0.66 * size;
};
export const textW = (text: string, size: number) => [...text].reduce((a, ch) => a + charW(ch, size), 0);
/** Width written so far at progress t (continuous), for placing the chalk stub. */
export const writtenW = (text: string, size: number, t: number) => {
  const chars = [...text];
  const p = clamp01(t) * chars.length;
  let w = 0;
  for (let k = 0; k < chars.length; k++) {
    const f = clamp01(p - k);
    if (f <= 0) break;
    w += charW(chars[k], size) * f;
  }
  return w;
};

type WriteProps = {
  x: number;
  y: number; // baseline
  text: string;
  size: number;
  t: number; // 0..1 written
  color?: string;
  opacity?: number;
  seed?: number;
  anchor?: "start" | "middle" | "end";
  font?: string;
};

/** Hand-lettered text that writes on. Each char pops in with a small wobble so it reads as chalk. */
export const ChalkWrite: React.FC<WriteProps> = ({ x, y, text, size, t, color = CHALK, opacity = 0.95, seed = 1, anchor = "start", font = FONTS.label }) => {
  if (t <= 0.001) return null;
  const chars = [...text];
  const total = textW(text, size);
  const x0 = anchor === "middle" ? x - total / 2 : anchor === "end" ? x - total : x;
  const p = clamp01(t) * chars.length;
  let cx = x0;
  const out: React.ReactNode[] = [];
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k];
    const w = charW(ch, size);
    const f = clamp01(p - k);
    if (f > 0 && ch === "→") {
      const ay = y - size * 0.3;
      const aw = w * 0.8;
      const sw = Math.max(4, size * 0.085);
      out.push(
        <g key={k} opacity={opacity}>
          <path d={`M ${cx + w * 0.1} ${ay} H ${cx + w * 0.1 + aw}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" {...trim(clamp01(f * 1.5))} />
          <path d={`M ${cx + w * 0.1 + aw - size * 0.2} ${ay - size * 0.2} L ${cx + w * 0.1 + aw} ${ay} L ${cx + w * 0.1 + aw - size * 0.2} ${ay + size * 0.2}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...trim(clamp01(f * 1.5 - 0.5))} />
        </g>,
      );
    } else if (f > 0 && ch !== " ") {
      const s = 0.7 + 0.3 * popT(f);
      const dy = (noise(seed, k) - 0.5) * size * 0.08;
      const rot = (noise(seed + 7, k) - 0.5) * 7;
      out.push(
        <text key={k} transform={`translate(${cx + w / 2} ${y + dy}) rotate(${rot}) scale(${s})`} fill={color} fontFamily={font} fontWeight={800} fontSize={size} textAnchor="middle" opacity={opacity * Math.min(1, f * 3)}>
          {ch}
        </text>,
      );
    }
    cx += w;
  }
  return <g>{out}</g>;
};

/** The piece of chalk: a rounded stick, tip at (x, y), leaning back-right like a hand holds it. */
export const ChalkStub: React.FC<{ x: number; y: number; size?: number; color?: string; opacity?: number; angle?: number }> = ({ x, y, size = 1, color = CHALK, opacity = 1, angle = 34 }) =>
  opacity <= 0.001 ? null : (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`} opacity={opacity}>
      <rect x={-7} y={-62} width={14} height={66} rx={6} fill={color} />
      <rect x={-7} y={-62} width={14} height={12} rx={5} fill="#D9D3C3" opacity={0.6} />
    </g>
  );

// ---- Marks ----

const S: React.FC<{ d: string; t: number; w: number; color: string; o?: number; dash?: string }> = ({ d, t, w, color, o = 0.95, dash }) =>
  t <= 0.002 ? null : <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} {...trim(t)} strokeDasharray={dash ?? trim(t).strokeDasharray} />;

export const ChalkRing: React.FC<{ cx: number; cy: number; r: number; t: number; color?: string; w?: number; opacity?: number }> = ({ cx, cy, r, t, color = PITCH.teal, w = 7, opacity = 0.95 }) => (
  <S d={`M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`} t={t} w={w} color={color} o={opacity} />
);

export const ChalkCross: React.FC<{ cx: number; cy: number; r: number; t: number; color?: string; w?: number; opacity?: number }> = ({ cx, cy, r, t, color = CHALK, w = 7, opacity = 0.95 }) => (
  <g>
    <S d={`M ${cx - r} ${cy - r} L ${cx + r} ${cy + r}`} t={clamp01(t * 2)} w={w} color={color} o={opacity} />
    <S d={`M ${cx + r} ${cy - r} L ${cx - r} ${cy + r}`} t={clamp01(t * 2 - 1)} w={w} color={color} o={opacity} />
  </g>
);

/** A chalk rounded box drawn on from the top-left corner, clockwise. */
export const ChalkBox: React.FC<{ x: number; y: number; w: number; h: number; t: number; r?: number; color?: string; width?: number; opacity?: number }> = ({ x, y, w, h, t, r = 28, color = CHALK, width = 6, opacity = 0.9 }) => {
  const d = `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y}`;
  return <S d={d} t={t} w={width} color={color} o={opacity} />;
};

/** A chalk crown doodle in a `size` x 0.8*size box centred on (x, y). */
export const Crown: React.FC<{ x: number; y: number; size?: number; t: number; color?: string; opacity?: number }> = ({ x, y, size = 100, t, color = CHALK, opacity = 0.9 }) => {
  const k = size / 100;
  const w = 6 * k;
  const body = `M -46 30 L -40 -10 L -18 12 L 0 -34 L 18 12 L 40 -10 L 46 30 Z`;
  const base = `M -44 42 H 44`;
  const t1 = clamp01(t * 1.4);
  const t2 = clamp01(t * 1.4 - 0.4);
  const gems = popT(clamp01(t * 1.6 - 0.6));
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} opacity={opacity}>
      <S d={body} t={t1} w={w} color={color} />
      <S d={base} t={t2} w={w} color={color} />
      {gems > 0.01
        ? [
            [-40, -10],
            [0, -34],
            [40, -10],
          ].map(([gx, gy], i) => <circle key={i} cx={gx} cy={gy - 9} r={5.5 * gems} fill={XRAY.lime} opacity={0.9} />)
        : null}
    </g>
  );
};

// ---- Calendar ----

/**
 * A chalk calendar card in a 240 x 270 box centred on (x, y). `flip` counts pages flipped (continuous: 0..3);
 * the top page tips up around its top edge and the next page shows under it. `draw` 0..1 draws the frame on.
 */
export const Calendar: React.FC<{ x: number; y: number; scale?: number; draw: number; flip: number; pages?: string[]; color?: string; opacity?: number }> = ({ x, y, scale = 1, draw, flip, pages = ["YEAR 1", "YEAR 2", "YEAR 3", "..."], color = CHALK, opacity = 1 }) => {
  if (draw <= 0.001 || opacity <= 0.001) return null;
  const W = 240;
  const H = 230;
  const top = -H / 2;
  const cur = Math.min(pages.length - 1, Math.floor(flip));
  const frac = cur >= pages.length - 1 ? 0 : clamp01(flip - cur);
  const page = (label: string, k: number) => (
    <g key={k}>
      <rect x={-W / 2} y={top} width={W} height={H} rx={18} fill={XRAY.bg} opacity={0.96} />
      <rect x={-W / 2} y={top} width={W} height={H} rx={18} fill="none" stroke={color} strokeWidth={6} opacity={0.9} />
      <path d={`M ${-W / 2 + 4} ${top + 48} H ${W / 2 - 4}`} stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.75} />
      {/* day grid: 5 rows of 7 chalk dashes */}
      {Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 7 }, (_, c) => (
          <rect key={`${r}${c}`} x={-W / 2 + 24 + c * 28} y={top + 70 + r * 22} width={14} height={5} rx={2.5} fill={color} opacity={r * 7 + c < 31 ? 0.45 : 0.12} />
        )),
      )}
      <text y={top + H - 28} fill={color} fontFamily={FONTS.label} fontWeight={800} fontSize={40} textAnchor="middle">
        {label}
      </text>
    </g>
  );
  const lift = 1 - frac;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      {/* two rings at the top */}
      {[-50, 50].map((rx, i) => (
        <path key={i} d={`M ${rx - 10} ${top + 2} A 12 12 0 1 1 ${rx + 10} ${top + 2}`} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.9 * clamp01(draw * 3 - 2)} />
      ))}
      <g opacity={clamp01(draw * 1.5)} transform={`scale(${0.85 + 0.15 * popT(draw)})`}>
        {/* the page under the one flipping */}
        {page(pages[Math.min(pages.length - 1, cur + (frac > 0 ? 1 : 0))], 1)}
        {/* the flipping page tips up around the top edge */}
        {frac > 0 && frac < 1 ? <g transform={`translate(0 ${top}) scale(1 ${Math.max(0.02, lift)}) translate(0 ${-top})`}>{page(pages[cur], 0)}</g> : null}
      </g>
    </g>
  );
};

// ---- Chalk's eyes ----

/** One tiny chain: `n` boxes in a row, chalk strokes, cell `c` px, centred on (0,0). */
const chainD = (n: number, c: number) => {
  const w = n * c;
  let d = `M ${-w / 2} ${-c / 2} H ${w / 2} V ${c / 2} H ${-w / 2} Z`;
  for (let i = 1; i < n; i++) d += ` M ${-w / 2 + i * c} ${-c / 2} V ${c / 2}`;
  return d;
};

/**
 * Chalk's head seen through the X-ray: the dome of his capsule in chalk outline, two big eyes, the smug
 * eyebrows. `draw` 0..1 draws the outline on, `eyes` 0..1 pops the eyes, `chains` 0..1 fades the drifting
 * chain shapes inside the pupils. R is the dome radius.
 */
export const ChalkEyes: React.FC<{ x: number; y: number; R?: number; draw: number; eyes: number; chains: number; frame: number; brow?: number; color?: string; opacity?: number; id?: string }> = ({ x, y, R = 250, draw, eyes, chains, frame, brow = 0, color = CHALK, opacity = 1, id = "c16eyes" }) => {
  if (draw <= 0.001 || opacity <= 0.001) return null;
  const w = R * 0.03;
  // Dome: the top of the capsule, sides running off the bottom of the frame.
  const dome = `M ${-R} ${R * 1.6} V 0 A ${R} ${R} 0 0 1 ${R} 0 V ${R * 1.6}`;
  const stripe = `M ${R * 0.42} ${R * 1.6} V ${R * 0.05} Q ${R * 0.42} ${-R * 0.45} ${R * 0.1} ${-R * 0.75}`;
  const eyeX = R * 0.38;
  const eyeY = R * 0.16;
  const er = R * 0.25;
  const es = popT(eyes);
  const chainSpecs: { n: number; c: number; sx: number; sy: number; seed: number; speed: number }[] = [
    { n: 3, c: 1, sx: -0.35, sy: -0.25, seed: 1, speed: 1 },
    { n: 4, c: 0.8, sx: 0.3, sy: 0.2, seed: 2, speed: 0.7 },
    { n: 3, c: 0.9, sx: -0.1, sy: 0.5, seed: 3, speed: 1.3 },
    { n: 5, c: 0.6, sx: 0.4, sy: -0.5, seed: 4, speed: 0.9 },
  ];
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <defs>
        {[-1, 1].map((side) => (
          <clipPath key={side} id={`${id}-${side > 0 ? "r" : "l"}`}>
            <circle cx={side * eyeX} cy={eyeY} r={er * 0.86} />
          </clipPath>
        ))}
      </defs>
      {/* faint fill so the head reads as a shape on the grid */}
      <path d={`${dome} Z`} fill={XRAY.tissue} opacity={0.1 * clamp01(draw * 2)} />
      <S d={dome} t={draw} w={w} color={color} />
      <S d={stripe} t={clamp01(draw * 1.5 - 0.5)} w={w * 0.6} color={color} o={0.35} dash={`${w * 1.2} ${w * 1.6}`} />
      {es > 0.01
        ? [-1, 1].map((side) => {
            const ex = side * eyeX;
            const tilt = (side * -8 + brow * (side === 1 ? -8 : 0)) as number;
            const by = eyeY - er - R * 0.14 - brow * R * 0.06;
            return (
              <g key={side}>
                {/* eye: dark pupil (the x-ray sees in), chalk rim */}
                <g transform={`translate(${ex} ${eyeY}) scale(${es}) translate(${-ex} ${-eyeY})`}>
                  <circle cx={ex} cy={eyeY} r={er} fill={XRAY.bg} />
                  <circle cx={ex} cy={eyeY} r={er} fill="none" stroke={color} strokeWidth={w} />
                  <circle cx={ex} cy={eyeY} r={er * 0.86} fill="none" stroke={XRAY.tissue} strokeWidth={w * 0.5} opacity={0.6} />
                  {/* chains drifting inside the pupil */}
                  <g clipPath={`url(#${id}-${side > 0 ? "r" : "l"})`} opacity={clamp01(chains)}>
                    {chainSpecs.map((cs, i) => {
                      const c = er * 0.22 * cs.c;
                      const dx = ex + er * cs.sx + idle(frame, cs.seed + side, 4.2 / cs.speed, er * 0.16);
                      const dy = eyeY + er * cs.sy + idle(frame, cs.seed * 3 + side, 5.1 / cs.speed, er * 0.14);
                      const rot = idle(frame, cs.seed * 5, 7 / cs.speed, 9) + cs.seed * 11;
                      return <path key={i} d={chainD(cs.n, c)} transform={`translate(${dx} ${dy}) rotate(${rot})`} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.4} strokeLinejoin="round" opacity={0.75} />;
                    })}
                  </g>
                  {/* a chalk glint */}
                  <circle cx={ex - er * 0.4} cy={eyeY - er * 0.45} r={er * 0.09} fill={color} opacity={0.7} />
                </g>
                {/* eyebrow dash */}
                <line x1={ex - er * 0.95} y1={by} x2={ex + er * 0.95} y2={by} stroke={color} strokeWidth={w * 1.1} strokeLinecap="round" transform={`rotate(${tilt} ${ex} ${by})`} opacity={clamp01(eyes * 2 - 1)} />
              </g>
            );
          })
        : null}
    </g>
  );
};

// ---- The wall of tiny boards ----

type MiniGeo = { dots: string; white: string; teal: string };
const miniCache = new Map<number, MiniGeo>();
/** Geometry for one tiny 16-dot board of side `size` centred on (0,0): a seeded subset of the 24 lines. */
const miniGeo = (seed: number, size: number): MiniGeo => {
  const key = seed * 10007 + size;
  const hit = miniCache.get(key);
  if (hit) return hit;
  const rng = seeded(seed);
  const n = 3;
  const cell = size / n;
  const P = (r: number, c: number) => `${(-size / 2 + c * cell).toFixed(1)} ${(-size / 2 + r * cell).toFixed(1)}`;
  let dots = "";
  for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) dots += `M ${P(r, c)} h 0.01 `;
  const count = 5 + Math.floor(rng() * 12);
  const lines: Line[] = allLines(n);
  const pick = lines.filter(() => rng() < count / 24);
  let white = "";
  let teal = "";
  for (const l of pick) {
    const d = l.kind === "h" ? `M ${P(l.r, l.c)} L ${P(l.r, l.c + 1)} ` : `M ${P(l.r, l.c)} L ${P(l.r + 1, l.c)} `;
    if (rng() < 0.5) white += d;
    else teal += d;
  }
  const geo = { dots, white, teal };
  miniCache.set(key, geo);
  return geo;
};

/** A very cheap tiny board (three paths). */
export const MiniBoard: React.FC<{ x: number; y: number; size: number; seed: number; scale?: number; opacity?: number }> = ({ x, y, size, seed, scale = 1, opacity = 1 }) => {
  if (scale <= 0.01 || opacity <= 0.001) return null;
  const g = miniGeo(seed, size);
  const w = Math.max(1.5, size / 60);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      {g.teal ? <path d={g.teal} stroke={PITCH.teal} strokeWidth={w} strokeLinecap="round" fill="none" opacity={0.85} /> : null}
      {g.white ? <path d={g.white} stroke={CHALK} strokeWidth={w} strokeLinecap="round" fill="none" opacity={0.85} /> : null}
      <path d={g.dots} stroke={CHALK} strokeWidth={w * 2.2} strokeLinecap="round" fill="none" />
    </g>
  );
};

/** Digits grouped in threes with thin spaces: 16777216 -> "16 777 216". */
export const groupDigits = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** The positions count: caption over a big mono number on a dark pill. */
export const PositionsReadout: React.FC<{ x: number; y: number; value: number; caption?: string; opacity: number; size?: number; color?: string }> = ({ x, y, value, caption = "POSITIONS", opacity, size = 84, color = XRAY.bone }) => {
  if (opacity <= 0.001) return null;
  const txt = groupDigits(value);
  const w = txt.length * size * 0.6 + size * 1.4;
  const h = size * 2.1;
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <rect x={-w / 2} y={-h * 0.62} width={w} height={h} rx={size * 0.5} fill={XRAY.bg} opacity={0.92} />
      <rect x={-w / 2} y={-h * 0.62} width={w} height={h} rx={size * 0.5} fill="none" stroke={color} strokeWidth={3} opacity={0.35} />
      <text y={-size * 0.62} fill={color} opacity={0.7} fontFamily={FONTS.hud} fontWeight={700} fontSize={size * 0.34} textAnchor="middle" letterSpacing={3}>
        {caption}
      </text>
      <text y={size * 0.62} fill={color} fontFamily={FONTS.mono} fontWeight={500} fontSize={size} textAnchor="middle">
        {txt}
      </text>
    </g>
  );
};

/** The X-ray grid, three frames wide, so a camera move never shows its edge. Lines sit on multiples of 60. */
export const BigGrid: React.FC = () => {
  const lines: React.ReactNode[] = [];
  for (let x = -WIDTH; x <= 2 * WIDTH; x += 60) lines.push(<line key={`x${x}`} x1={x} y1={-HEIGHT} x2={x} y2={2 * HEIGHT} />);
  for (let y = -HEIGHT; y <= 2 * HEIGHT; y += 60) lines.push(<line key={`y${y}`} x1={-WIDTH} y1={y} x2={2 * WIDTH} y2={y} />);
  return (
    <g>
      <rect x={-WIDTH} y={-HEIGHT} width={3 * WIDTH} height={3 * HEIGHT} fill={XRAY.bg} />
      <g stroke={XRAY.grid} strokeWidth={2}>
        {lines}
      </g>
    </g>
  );
};

/** Soft glow: concentric circles (no filters). */
export const SoftGlow: React.FC<{ x: number; y: number; r: number; color?: string; opacity?: number }> = ({ x, y, r, color = XRAY.lime, opacity = 1 }) =>
  opacity <= 0.001 ? null : (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={r} fill={color} opacity={0.08} />
      <circle cx={x} cy={y} r={r * 0.7} fill={color} opacity={0.1} />
      <circle cx={x} cy={y} r={r * 0.42} fill={color} opacity={0.14} />
    </g>
  );
