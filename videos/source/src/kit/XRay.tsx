// X-ray views: a teal-ink grid background and a see-through kicking leg with glowing bones.
// The leg uses the same joint solver as Tavi, so x-ray poses match the pitch poses.

import React from "react";
import { HEIGHT, WIDTH, XRAY } from "../theme";
import { solve, type Pose } from "./Player";

export const XRayGrid: React.FC<{ step?: number; opacity?: number }> = ({ step = 60, opacity = 1 }) => {
  const lines = [];
  for (let x = 0; x <= WIDTH; x += step) lines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={HEIGHT} />);
  for (let y = 0; y <= HEIGHT; y += step) lines.push(<line key={`y${y}`} x1={0} y1={y} x2={WIDTH} y2={y} />);
  return (
    <g opacity={opacity}>
      <rect width={WIDTH} height={HEIGHT} fill={XRAY.bg} />
      <g stroke={XRAY.grid} strokeWidth={2}>
        {lines}
      </g>
    </g>
  );
};

export type LegPart = "thigh" | "shin" | "foot" | "ankle";

type Props = {
  /** Screen position of the hip. */
  x: number;
  y: number;
  /** Character height the leg belongs to (pixels). Big values = close-up. */
  h: number;
  pose: Pose;
  /** Glow these parts pink. */
  highlight?: LegPart[];
  highlightAmount?: number;
  /** Show the ankle as a lock (1) or a loose hinge (0). */
  ankleLock?: number;
  /** Draw the standing (far) leg faintly too. */
  showFar?: boolean;
  footTurn?: number;
};

export const XRayLeg: React.FC<Props> = ({ x, y, h, pose, highlight = [], highlightAmount = 1, ankleLock, showFar = false, footTurn = 0 }) => {
  const j = solve(pose, h, footTurn);
  const T = (p: { x: number; y: number }) => ({ x: x + p.x, y: y + p.y });
  const hip = T(j.hip);
  const knee = T(j.nk);
  const ankle = T(j.na);
  const toe = T(j.nToe);
  const tissue = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, key: string) => (
    <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={XRAY.tissue} strokeWidth={w} strokeLinecap="round" opacity={0.55} />
  );
  const glow = (part: LegPart) => (highlight.includes(part) ? highlightAmount : 0);
  const bone = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, part: LegPart, key: string) => {
    const g = glow(part);
    return (
      <g key={key}>
        {g > 0 ? <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={XRAY.pink} strokeWidth={w * 3.2} strokeLinecap="round" opacity={0.25 * g} /> : null}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={g > 0.5 ? "#FFD1E8" : XRAY.bone} strokeWidth={w} strokeLinecap="round" />
      </g>
    );
  };
  const w = h * 0.03;
  const fk = T(j.fk);
  const fa = T(j.fa);
  const ft = T(j.fToe);
  // Foot bones: heel to toe with a gentle arch.
  const mid = { x: (ankle.x + toe.x) / 2, y: (ankle.y + toe.y) / 2 };
  return (
    <g>
      {showFar ? (
        <g opacity={0.35}>
          {tissue(hip, fk, h * 0.1, "ft")}
          {tissue(fk, fa, h * 0.085, "fs")}
          {tissue(fa, ft, h * 0.065, "ff")}
        </g>
      ) : null}
      {tissue(hip, knee, h * 0.11, "t")}
      {tissue(knee, ankle, h * 0.09, "s")}
      {tissue(ankle, toe, h * 0.075, "f")}
      {bone(hip, knee, w * 1.2, "thigh", "b1")}
      {bone(knee, ankle, w, "shin", "b2")}
      {bone(ankle, mid, w * 0.9, "foot", "b3")}
      {bone(mid, toe, w * 0.7, "foot", "b4")}
      <circle cx={hip.x} cy={hip.y} r={w * 1.3} fill={XRAY.bone} />
      <circle cx={knee.x} cy={knee.y} r={w * 1.15} fill={XRAY.bone} />
      <circle cx={ankle.x} cy={ankle.y} r={w * 1.05} fill={glow("ankle") > 0 ? "#FFD1E8" : XRAY.bone} />
      {ankleLock !== undefined ? <AnkleLock x={ankle.x - w * 3.2} y={ankle.y - w * 3.2} size={w * 3} locked={ankleLock} /> : null}
    </g>
  );
};

/** A small padlock icon; locked 0..1 closes the shackle. */
export const AnkleLock: React.FC<{ x: number; y: number; size: number; locked: number }> = ({ x, y, size, locked }) => {
  const lift = (1 - locked) * size * 0.45;
  const color = locked > 0.5 ? XRAY.lime : XRAY.pink;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M${-size * 0.32},${-lift} L${-size * 0.32},${-size * 0.35 - lift} A${size * 0.32},${size * 0.32} 0 0 1 ${size * 0.32},${-size * 0.35 - lift} L${size * 0.32},${locked > 0.5 ? 0 : -size * 0.2 - lift}`} fill="none" stroke={color} strokeWidth={size * 0.14} strokeLinecap="round" />
      <rect x={-size * 0.5} y={0} width={size} height={size * 0.75} rx={size * 0.16} fill={color} />
    </g>
  );
};
