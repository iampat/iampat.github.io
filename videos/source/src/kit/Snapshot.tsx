// Snapshots and the thought map: each scan takes a small "photo" that pops in a polaroid
// frame, and the photos build a map in a thought bubble (what the player knows).

import React from "react";
import { useCurrentFrame } from "remotion";
import { PITCH } from "../theme";
import { EASE, pop, progress } from "../lib/anim";

/** A polaroid frame that pops in at (x, y), slightly tilted. Children draw the photo (w x h box at 0,0). */
export const Snapshot: React.FC<{ x: number; y: number; w?: number; h?: number; at: number; until?: number; tilt?: number; children?: React.ReactNode; flash?: boolean }> = ({
  x,
  y,
  w = 220,
  h = 150,
  at,
  until,
  tilt = -6,
  children,
  flash = true,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 260, damping: 17 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const fl = flash ? Math.max(0, 1 - (frame - at) / 5) : 0;
  const pad = 12;
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt}) scale(${s})`}>
      <rect x={-w / 2 - pad} y={-h / 2 - pad} width={w + pad * 2} height={h + pad * 2 + 26} rx={10} fill={PITCH.chalk} />
      <g transform={`translate(${-w / 2} ${-h / 2})`}>
        <rect width={w} height={h} fill={PITCH.grassDark} />
        {children}
        <rect width={w} height={h} fill="#FFFFFF" opacity={fl} />
      </g>
    </g>
  );
};

/** A thought bubble (cloud) anchored to a head at (hx, hy), with its body at (x, y). */
export const ThoughtBubble: React.FC<{ x: number; y: number; w: number; h: number; hx: number; hy: number; at: number; until?: number; children?: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  hx,
  hy,
  at,
  until,
  children,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 150, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  // Three small circles leading from the head to the bubble.
  const dots = [0.25, 0.5, 0.75].map((t, i) => ({ x: hx + (x - hx) * t, y: hy + (y - hy) * t, r: 6 + i * 6 }));
  const bumps = 9;
  const bumpR = Math.min(w, h) * 0.22;
  return (
    <g opacity={s}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r * s} fill={PITCH.chalk} />
      ))}
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        {Array.from({ length: bumps }, (_, i) => {
          const a = (i / bumps) * Math.PI * 2;
          return <circle key={i} cx={Math.cos(a) * (w / 2 - bumpR * 0.6)} cy={Math.sin(a) * (h / 2 - bumpR * 0.6)} r={bumpR} fill={PITCH.chalk} />;
        })}
        <rect x={-w / 2 + bumpR * 0.2} y={-h / 2 + bumpR * 0.2} width={w - bumpR * 0.4} height={h - bumpR * 0.4} rx={bumpR} fill={PITCH.chalk} />
        <g transform={`translate(${-w / 2 + bumpR * 0.5} ${-h / 2 + bumpR * 0.5})`}>{children}</g>
      </g>
    </g>
  );
};

/** Question marks or a "?" fog inside a bubble: what the player does not know. */
export const UnknownFog: React.FC<{ w: number; h: number; opacity?: number }> = ({ w, h, opacity = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <g opacity={opacity}>
      <rect width={w} height={h} rx={16} fill={PITCH.stands} opacity={0.35} />
      {[0.2, 0.5, 0.8].map((t, i) => (
        <text key={i} x={w * t} y={h * 0.6 + Math.sin(frame / 9 + i) * 4} fill={PITCH.sky} fontFamily="Rubik, sans-serif" fontWeight={800} fontSize={h * 0.5} textAnchor="middle" opacity={0.7}>
          ?
        </text>
      ))}
    </g>
  );
};
