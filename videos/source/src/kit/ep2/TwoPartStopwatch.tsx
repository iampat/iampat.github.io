// Two-part stopwatch for reaction time (b05): two dials side by side, NOTICE then CHOOSE, that fill in
// sequence. Both dials share one scale (a full circle = `fullSeconds`), so half a second reads bigger than a
// third, and the two are never summed. Readouts and the caption are in FONTS.mono like the s02 stopwatch.

import React from "react";
import { CAST, FONTS, PITCH } from "../../theme";
import { clamp01 } from "../../lib/anim";
import { popT } from "./chalk";

type Props = {
  x: number;
  y: number;
  /** Radius of each dial. Keep it 80 or more so the readout stays at 32 px or larger. */
  r: number;
  /** Seconds for part one (about 0.3). */
  notice: number;
  /** Seconds for part two (about 0.5). */
  choose: number;
  /** 0..1 over both parts in sequence: notice fills first, then choose. */
  progress: number;
  caption?: string;
  /** Seconds for a full circle on both dials. Default 0.6 (so 0.3 s is half a dial). */
  fullSeconds?: number;
  labels?: [string, string];
  /** Distance between the two dial centres. Default 2.7 r. */
  gap?: number;
  opacity?: number;
};

const arcPath = (cx: number, cy: number, rad: number, a0: number, a1: number) => {
  // Degrees clockwise from 12 o'clock.
  const at = (a: number): [number, number] => {
    const t = ((a - 90) * Math.PI) / 180;
    return [cx + rad * Math.cos(t), cy + rad * Math.sin(t)];
  };
  const sweep = Math.min(359.9, Math.max(0, a1 - a0));
  const [x0, y0] = at(a0);
  const [x1, y1] = at(a0 + sweep);
  return { d: `M${x0},${y0} A${rad},${rad} 0 ${sweep > 180 ? 1 : 0} 1 ${x1},${y1}`, end: [x1, y1] as [number, number] };
};

const Dial: React.FC<{
  cx: number;
  cy: number;
  r: number;
  seconds: number;
  target: number;
  fullSeconds: number;
  color: string;
  title: string;
  active: boolean;
  wake: number;
}> = ({ cx, cy, r, seconds, target, fullSeconds, color, title, active, wake }) => {
  const sweep = (seconds / fullSeconds) * 360;
  const { d, end } = arcPath(cx, cy, r, 0, sweep);
  const ring = r * 0.16;
  const font = Math.max(32, r * 0.46);
  const ticks = Math.round(fullSeconds / 0.1);
  const dim = 0.35 + 0.65 * wake;
  const bump = 1 + 0.08 * (popT(wake) - wake);
  return (
    <g transform={`translate(${cx} ${cy}) scale(${bump})`} opacity={dim}>
      {/* Crown and side button: a stopwatch, not a clock. */}
      <rect x={-r * 0.1} y={-r - r * 0.22} width={r * 0.2} height={r * 0.16} rx={r * 0.05} fill={PITCH.chalk} opacity={0.55} />
      <rect x={-r * 0.16} y={-r - r * 0.3} width={r * 0.32} height={r * 0.1} rx={r * 0.05} fill={PITCH.chalk} opacity={0.55} />
      <g transform="rotate(38)">
        <rect x={-r * 0.07} y={-r - r * 0.16} width={r * 0.14} height={r * 0.14} rx={r * 0.04} fill={PITCH.chalk} opacity={0.4} />
      </g>
      {/* Base ring. */}
      <circle r={r} fill={PITCH.sky} opacity={0.35} />
      <circle r={r} fill="none" stroke={PITCH.chalk} strokeWidth={ring} opacity={0.14} />
      {/* Ticks every 0.1 s. */}
      {Array.from({ length: ticks }, (_, i) => {
        const a = ((i / ticks) * 360 - 90) * (Math.PI / 180);
        const r0 = r * 0.72;
        const r1 = r * 0.8;
        return <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={PITCH.chalk} strokeWidth={r * 0.03} strokeLinecap="round" opacity={0.35} />;
      })}
      {/* Target mark: where this part ends. */}
      {(() => {
        const a = ((target / fullSeconds) * 360 - 90) * (Math.PI / 180);
        return <circle cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={ring * 0.55} fill={color} opacity={0.45} />;
      })()}
      {/* The filled arc with a soft glow. */}
      {sweep > 0.2 ? (
        <g>
          <path d={d} transform={`translate(${-cx} ${-cy})`} fill="none" stroke={color} strokeWidth={ring * 2.1} strokeLinecap="round" opacity={0.16} />
          <path d={d} transform={`translate(${-cx} ${-cy})`} fill="none" stroke={color} strokeWidth={ring} strokeLinecap="round" />
          {active ? (
            <g transform={`translate(${end[0] - cx} ${end[1] - cy})`}>
              <circle r={ring * 1.6} fill={color} opacity={0.25} />
              <circle r={ring * 1.1} fill={color} opacity={0.45} />
              <circle r={ring * 0.65} fill={PITCH.chalk} />
            </g>
          ) : null}
        </g>
      ) : null}
      {/* Readout. */}
      <text y={font * 0.36} fill={seconds > 0.001 ? color : PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={font} textAnchor="middle">
        {seconds.toFixed(2)}
        <tspan fontSize={font * 0.55} fontFamily={FONTS.hud} fontWeight={700}>
          {" s"}
        </tspan>
      </text>
      {/* Title. */}
      <text y={-r - r * 0.42} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={Math.max(32, r * 0.3)} textAnchor="middle" letterSpacing={4}>
        {title}
      </text>
    </g>
  );
};

export const TwoPartStopwatch: React.FC<Props> = ({
  x,
  y,
  r,
  notice,
  choose,
  progress,
  caption,
  fullSeconds = 0.6,
  labels = ["NOTICE", "CHOOSE"],
  gap,
  opacity = 1,
}) => {
  const total = notice + choose;
  const t = clamp01(progress) * total;
  const s1 = Math.min(t, notice);
  const s2 = clamp01((t - notice) / Math.max(1e-6, choose)) * choose;
  const g = gap ?? r * 2.7;
  const wake2 = clamp01((t - notice * 0.85) / (notice * 0.15 + 1e-6));
  const captionSize = Math.max(32, r * 0.3);
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <Dial cx={-g / 2} cy={0} r={r} seconds={s1} target={notice} fullSeconds={fullSeconds} color={PITCH.light} title={labels[0]} active={t < notice} wake={1} />
      <Dial cx={g / 2} cy={0} r={r} seconds={s2} target={choose} fullSeconds={fullSeconds} color={CAST.mistake} title={labels[1]} active={t >= notice && t < total} wake={wake2} />
      {/* "then" arrow between the dials: part two starts when part one ends. */}
      <g opacity={0.5}>
        <line x1={-r * 0.22} y1={0} x2={r * 0.14} y2={0} stroke={PITCH.chalk} strokeWidth={Math.max(4, r * 0.04)} strokeLinecap="round" />
        <path d={`M${r * 0.02},${-r * 0.1} L${r * 0.18},0 L${r * 0.02},${r * 0.1}`} fill="none" stroke={PITCH.chalk} strokeWidth={Math.max(4, r * 0.04)} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {caption ? (
        <text y={r + r * 0.62} fill={PITCH.chalk} opacity={0.75} fontFamily={FONTS.mono} fontWeight={500} fontSize={captionSize} textAnchor="middle">
          {caption}
        </text>
      ) : null}
    </g>
  );
};
