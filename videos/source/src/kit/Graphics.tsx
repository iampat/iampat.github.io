// On-screen graphics: labels, arrows, HUD readouts, chapter cards, word cards, the practice board.

import React from "react";
import { useCurrentFrame } from "remotion";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../theme";
import { EASE, pop, popSoft, progress, visible } from "../lib/anim";

/** A pill label that pops in. */
export const Label: React.FC<{
  x: number;
  y: number;
  text: string;
  at: number;
  until?: number;
  color?: string;
  bg?: string;
  size?: number;
  anchor?: "start" | "middle" | "end";
  font?: string;
}> = ({ x, y, text, at, until, color = PITCH.sky, bg = PITCH.chalk, size = 40, anchor = "middle", font = FONTS.label }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const upper = text.replace(/[^A-Za-z]/g, "").length > 0 && text === text.toUpperCase();
  const w = text.length * size * (upper ? 0.74 : 0.58) + size * 1.2;
  const h = size * 1.55;
  const ox = anchor === "middle" ? -w / 2 : anchor === "end" ? -w : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={ox} y={-h / 2} width={w} height={h} rx={h / 2} fill={bg} />
      <text x={ox + w / 2} y={size * 0.35} fill={color} fontFamily={font} fontWeight={800} fontSize={size} textAnchor="middle">
        {text}
      </text>
    </g>
  );
};

/** Plain text that fades/slides in. */
export const Text: React.FC<{
  x: number;
  y: number;
  text: string;
  at: number;
  until?: number;
  size?: number;
  color?: string;
  anchor?: "start" | "middle" | "end";
  font?: string;
  weight?: number;
}> = ({ x, y, text, at, until, size = 44, color = PITCH.chalk, anchor = "middle", font = FONTS.label, weight = 800 }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until);
  if (o <= 0.001) return null;
  return (
    <text x={x} y={y + (1 - o) * 16} opacity={o} fill={color} fontFamily={font} fontWeight={weight} fontSize={size} textAnchor={anchor}>
      {text}
    </text>
  );
};

/** An arrow that draws itself on from (x1,y1) to (x2,y2). */
export const Arrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  at: number;
  until?: number;
  dur?: number;
  color?: string;
  width?: number;
  curve?: number;
}> = ({ x1, y1, x2, y2, at, until, dur = 14, color = XRAY.lime, width = 10, curve = 0 }) => {
  const frame = useCurrentFrame();
  const t = progress(frame, at, dur, EASE.enter);
  const o = until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit);
  if (t <= 0.001 || o <= 0.001) return null;
  const mx = (x1 + x2) / 2 + (y2 - y1) * curve;
  const my = (y1 + y2) / 2 - (x2 - x1) * curve;
  // Point on the quadratic curve at t, and its direction.
  const q = (u: number) => ({
    x: (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2,
    y: (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2,
  });
  const pts = Array.from({ length: 21 }, (_, i) => q((i / 20) * t));
  const end = pts[pts.length - 1];
  const prev = q(Math.max(0, t - 0.05));
  const ang = Math.atan2(end.y - prev.y, end.x - prev.x);
  const head = width * 2.4;
  return (
    <g opacity={o}>
      <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={`M${end.x + Math.cos(ang) * head * 0.6},${end.y + Math.sin(ang) * head * 0.6} L${end.x + Math.cos(ang + 2.5) * head},${end.y + Math.sin(ang + 2.5) * head} L${end.x + Math.cos(ang - 2.5) * head},${end.y + Math.sin(ang - 2.5) * head} Z`}
        fill={color}
        stroke={color}
        strokeWidth={width * 0.4}
        strokeLinejoin="round"
      />
    </g>
  );
};

/** A HUD readout: small caption over a big number that counts up. */
export const Readout: React.FC<{
  x: number;
  y: number;
  caption: string;
  value: number;
  decimals?: number;
  unit?: string;
  at: number;
  countFrames?: number;
  until?: number;
  color?: string;
  size?: number;
  from?: number;
}> = ({ x, y, caption, value, decimals = 0, unit = "", at, countFrames = 20, until, color = XRAY.bone, size = 72, from = 0 }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until);
  if (o <= 0.001) return null;
  const v = from + (value - from) * progress(frame, at, countFrames, EASE.soft);
  return (
    <g opacity={o} transform={`translate(${x} ${y})`}>
      <text y={-size * 0.95} fill={color} opacity={0.7} fontFamily={FONTS.hud} fontWeight={700} fontSize={size * 0.36} textAnchor="middle" letterSpacing={2}>
        {caption.toUpperCase()}
      </text>
      <text fill={color} fontFamily={FONTS.mono} fontWeight={500} fontSize={size} textAnchor="middle">
        {v.toFixed(decimals)}
        <tspan fontSize={size * 0.45} fontFamily={FONTS.hud}>
          {unit ? ` ${unit}` : ""}
        </tspan>
      </text>
    </g>
  );
};

/** Chapter card: Chalk writes "1 · THE DRIVE" on the grass, with a subtitle. Full-frame overlay. */
export const ChapterCard: React.FC<{ number: number; title: string; subtitle: string; at: number; until: number }> = ({
  number,
  title,
  subtitle,
  at,
  until,
}) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 10, 10);
  if (o <= 0.001) return null;
  const write = progress(frame, at, 18, EASE.soft);
  const full = `${number} · ${title}`;
  const shown = full.slice(0, Math.ceil(full.length * write));
  return (
    <g opacity={o}>
      <rect x={0} y={HEIGHT * 0.34} width={WIDTH} height={HEIGHT * 0.32} fill={PITCH.sky} opacity={0.55} />
      <text x={WIDTH / 2} y={HEIGHT / 2 + 20} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={120} textAnchor="middle" letterSpacing={6}>
        {shown}
      </text>
      <text x={WIDTH / 2} y={HEIGHT / 2 + 100} fill={PITCH.light} opacity={progress(frame, at + 14, 10)} fontFamily={FONTS.label} fontWeight={800} fontSize={48} textAnchor="middle">
        {subtitle}
      </text>
    </g>
  );
};

/** Word card for a learn-word: a small card that pops in with the term and a one-line meaning. */
export const WordCard: React.FC<{ term: string; meaning: string; at: number; until: number; x?: number; y?: number }> = ({
  term,
  meaning,
  at,
  until,
  x = WIDTH - 60,
  y = 90,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  // Wrap the meaning onto two lines at about 44 characters.
  const lines: string[] = [];
  if (meaning.length <= 44) lines.push(meaning);
  else {
    const words = meaning.split(" ");
    let cur = "";
    for (const wd of words) {
      if ((cur + " " + wd).trim().length > 44 && cur) {
        lines.push(cur);
        cur = wd;
      } else cur = (cur + " " + wd).trim();
    }
    if (cur) lines.push(cur);
  }
  const longest = Math.max(...lines.map((l) => l.length));
  const w = Math.max(term.length * 36, longest * 19, 260) + 90;
  const h = 196 + (lines.length - 1) * 40;
  // Scale around the card's top-right corner.
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(${-w} 0)`}>
      <rect width={w} height={h} rx={28} fill={PITCH.chalk} />
      <rect x={24} y={22} width={210} height={42} rx={21} fill={PITCH.accent} />
      <text x={129} y={52} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={26} textAnchor="middle" letterSpacing={3}>
        NEW WORD
      </text>
      <text x={24} y={124} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={56}>
        {term}
      </text>
      {lines.map((l, i) => (
        <text key={i} x={24} y={172 + i * 40} fill={PITCH.stands} fontFamily={FONTS.label} fontWeight={700} fontSize={34}>
          {l}
        </text>
      ))}
    </g>
  );
};

export type StampKind = "MISTAKE" | "FIX" | "DRILL" | "CUE";
const STAMP_COLOR: Record<StampKind, string> = { MISTAKE: CAST.mistake, FIX: CAST.fix, DRILL: PITCH.light, CUE: PITCH.accent };

/** A stamp that thumps onto the practice board. */
export const Stamp: React.FC<{ kind: StampKind; x: number; y: number; at: number; until?: number; rotate?: number }> = ({
  kind,
  x,
  y,
  at,
  until,
  rotate = -6,
}) => {
  const frame = useCurrentFrame();
  const s = frame < at ? 0 : 1 + 0.6 * (1 - pop(frame, at, { stiffness: 320, damping: 18 }));
  const o = frame < at ? 0 : Math.min(1, (frame - at) / 3) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (o <= 0.001) return null;
  const w = kind.length * 30 + 60;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`} opacity={o}>
      <rect x={-w / 2} y={-38} width={w} height={76} rx={14} fill="none" stroke={STAMP_COLOR[kind]} strokeWidth={7} />
      <text y={16} fill={STAMP_COLOR[kind]} fontFamily={FONTS.title} fontWeight={800} fontSize={46} textAnchor="middle" letterSpacing={4}>
        {kind}
      </text>
    </g>
  );
};

/** The practice board: a rounded dark board that slides up from the bottom. Children draw inside it. */
export const PracticeBoard: React.FC<{ at: number; until: number; children?: React.ReactNode; title?: string }> = ({ at, until, children, title = "USE IT AT PRACTICE" }) => {
  const frame = useCurrentFrame();
  const inT = progress(frame, at, 14, EASE.enter);
  const outT = progress(frame, until, 9, EASE.exit);
  const y = (1 - inT) * HEIGHT + outT * HEIGHT;
  if (inT <= 0.001 || outT >= 0.999) return null;
  return (
    <g transform={`translate(0 ${y})`}>
      <rect x={80} y={70} width={WIDTH - 160} height={HEIGHT - 140} rx={48} fill="#10263A" />
      <rect x={80} y={70} width={WIDTH - 160} height={90} rx={45} fill="#16324B" />
      <text x={WIDTH / 2} y={130} fill={PITCH.lightSoft} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} textAnchor="middle" letterSpacing={6}>
        {title}
      </text>
      {children}
    </g>
  );
};

/** Speech bubble with a tail pointing at (tx, ty). */
export const Bubble: React.FC<{ x: number; y: number; tx: number; ty: number; text: string; at: number; until?: number; size?: number }> = ({
  x,
  y,
  tx,
  ty,
  text,
  at,
  until,
  size = 52,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 300, damping: 18 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const w = text.length * size * 0.6 + size * 1.2;
  const h = size * 1.8;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {ty - y < 0 ? (
        <path d={`M${-w * 0.12},${-h / 2 + 4} L${tx - x},${ty - y} L${w * 0.08},${-h / 2 + 4} Z`} fill={PITCH.chalk} />
      ) : (
        <path d={`M${-w * 0.12},${h / 2 - 4} L${tx - x},${ty - y} L${w * 0.08},${h / 2 - 4} Z`} fill={PITCH.chalk} />
      )}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={PITCH.chalk} />
      <text y={size * 0.36} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle">
        {text}
      </text>
    </g>
  );
};

/** "SLOW MOTION" tag in the top-left corner, with a small pulsing dot. */
export const SlowMoTag: React.FC<{ at: number; until: number; label?: string }> = ({ at, until, label = "SLOW MOTION" }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until);
  if (o <= 0.001) return null;
  const pulse = 0.6 + 0.4 * Math.sin(frame / 5);
  return (
    <g opacity={o} transform="translate(70 70)">
      <rect width={label.length * 25 + 86} height={66} rx={33} fill={PITCH.sky} opacity={0.75} />
      <circle cx={34} cy={33} r={11} fill={CAST.mistake} opacity={pulse} />
      <text x={60} y={45} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={4}>
        {label}
      </text>
    </g>
  );
};

/** The title: chalk letters with an orange underline, drawn on. */
export const TitleCard: React.FC<{ text: string; at: number; until: number; y?: number; size?: number }> = ({ text, at, until, y = HEIGHT / 2, size = 130 }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 10, 10);
  if (o <= 0.001) return null;
  const write = progress(frame, at, 24, EASE.soft);
  const shown = text.slice(0, Math.ceil(text.length * write));
  const w = text.length * size * 0.62;
  const line = progress(frame, at + 18, 16, EASE.standard);
  return (
    <g opacity={o}>
      <text x={WIDTH / 2} y={y} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle" letterSpacing={4}>
        {shown}
      </text>
      <rect x={WIDTH / 2 - (w / 2) * line} y={y + size * 0.28} width={w * line} height={size * 0.1} rx={size * 0.05} fill={PITCH.accent} />
    </g>
  );
};
