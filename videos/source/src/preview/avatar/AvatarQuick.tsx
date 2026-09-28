// Quick profile avatar: Chalk and his son, Chalk Jr. (800x800, shown as a circle).
import React from "react";
import { AbsoluteFill } from "remotion";
import { Ball } from "../../kit/Ball";
import { Glow } from "../../kit/World";
import { CAST, PITCH } from "../../theme";

const W = CAST.keeper;
const SHADE = CAST.keeperShade;
const EYE = CAST.keeperEye;

/** A chalk capsule body with a shade stripe, cut off at the bottom of the frame. */
const Body: React.FC<{ x: number; top: number; w: number }> = ({ x, top, w }) => (
  <g>
    <rect x={x} y={top} width={w} height={900} rx={w / 2} fill={W} />
    <rect x={x + w * 0.62} y={top + w * 0.18} width={w * 0.22} height={900} rx={w * 0.11} fill={SHADE} opacity={0.6} />
  </g>
);

/** Two dot eyes with happy raised eyebrows (no mouth, like Chalk in the videos). */
const Face: React.FC<{ cx: number; cy: number; gap: number; r: number }> = ({ cx, cy, gap, r }) => (
  <g>
    {[-1, 1].map((s) => (
      <g key={s}>
        <circle cx={cx + (s * gap) / 2} cy={cy} r={r} fill={EYE} />
        <circle cx={cx + (s * gap) / 2 + r * 0.35} cy={cy - r * 0.35} r={r * 0.3} fill="#FFFFFF" />
        <path
          d={`M${cx + (s * gap) / 2 - r * 1.15},${cy - r * 2.0} Q${cx + (s * gap) / 2},${cy - r * 3.3} ${cx + (s * gap) / 2 + r * 1.15},${cy - r * 2.0}`}
          fill="none"
          stroke={EYE}
          strokeWidth={r * 0.42}
          strokeLinecap="round"
        />
      </g>
    ))}
  </g>
);

/** A round mitten glove with a thumb and a cuff. */
const Mitten: React.FC<{ x: number; y: number; r: number; rot?: number; flip?: boolean }> = ({ x, y, r, rot = 0, flip = false }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -1 : 1} 1)`}>
    <ellipse cx={0} cy={0} rx={r} ry={r * 1.12} fill={W} />
    <ellipse cx={-r * 0.85} cy={r * 0.15} rx={r * 0.38} ry={r * 0.55} fill={W} transform={`rotate(-25 ${-r * 0.85} ${r * 0.15})`} />
    <rect x={-r * 0.8} y={r * 0.72} width={r * 1.6} height={r * 0.42} rx={r * 0.21} fill={SHADE} />
  </g>
);

export const AvatarQuick: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: PITCH.sky }}>
    <svg width={800} height={800} viewBox="0 0 800 800">
      {/* Night sky with a floodlight halo behind them. */}
      <rect width={800} height={800} fill={PITCH.sky} />
      <Glow cx={400} cy={330} r={420} color={PITCH.light} intensity={1.2} rings={6} />
      {/* A curve of grass at the bottom. */}
      <ellipse cx={400} cy={900} rx={560} ry={260} fill={PITCH.grass} />
      <ellipse cx={400} cy={930} rx={560} ry={260} fill={PITCH.grassDark} />

      {/* Dad: big Chalk. */}
      <Body x={150} top={120} w={290} />
      <Face cx={288} cy={290} gap={96} r={24} />

      {/* Son: Chalk Jr., smaller and rounder. */}
      <Body x={455} top={318} w={210} />
      <Face cx={556} cy={452} gap={80} r={22} />

      {/* Dad's arm over his son's shoulder. */}
      <path d="M420,540 Q450,478 474,470" fill="none" stroke={SHADE} strokeWidth={30} strokeLinecap="round" />
      <Mitten x={478} y={470} r={36} rot={35} flip />

      {/* The orange ball with its white line, held by Chalk Jr. */}
      <Ball cx={560} cy={636} r={82} view={{ kind: "side", originX: 0, groundY: 0, ppm: 1 }} axis={{ x: 0, y: 0, z: 1 }} angle={0} lineNormal={{ x: 0.6, y: 0.3, z: 0.75 }} />
      <Mitten x={470} y={640} r={40} rot={-12} />
      <Mitten x={650} y={640} r={40} rot={12} flip />
    </svg>
  </AbsoluteFill>
);
