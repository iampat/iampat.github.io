// Top-down player tokens with facing, a head that can look around, and a vision cone.
// Used for the scanning and body-shape scenes (LOOK and SHAPE).
//
// Screen angles: `facing` is the body direction in degrees, 0 = screen right, 90 = screen down
// (SVG rotation). `look` is the head's extra turn relative to the body (a scan).

import React from "react";
import { CAST, FONTS, PITCH } from "../theme";

export type TopKind = "tavi" | "sam" | "chalk";

const COLORS: Record<TopKind, { shirt: string; shade: string; head: string; hair?: string }> = {
  tavi: { shirt: CAST.shirt, shade: CAST.shirtShade, head: CAST.skin, hair: CAST.hair },
  sam: { shirt: "#FF7A3D", shade: "#D95A22", head: "#E8B48B", hair: "#7A3B1F" },
  chalk: { shirt: CAST.keeper, shade: CAST.keeperShade, head: CAST.keeper },
};

type Props = {
  x: number;
  y: number;
  /** Body size in pixels (shoulder width). */
  size?: number;
  kind?: TopKind;
  facing?: number;
  /** Head turn relative to the body, degrees (positive = clockwise on screen). */
  look?: number;
  /** Vision cone: total angle in degrees and radius in pixels. Omit for none. */
  cone?: { angleDeg: number; radius: number; color?: string; opacity?: number };
  label?: string;
  opacity?: number;
  /** Small motion for running: 0..1 stride phase, adds a shoulder sway. */
  stride?: number;
};

export const TopPlayer: React.FC<Props> = ({ x, y, size = 44, kind = "tavi", facing = 0, look = 0, cone, label, opacity = 1, stride }) => {
  const c = COLORS[kind];
  const w = size;
  const h = size * 0.45;
  const headR = size * 0.27;
  const sway = stride === undefined ? 0 : Math.sin(stride * Math.PI * 2) * 6;
  const headAngle = facing + look;
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      {cone ? (
        <g transform={`rotate(${headAngle})`}>
          <path
            d={`M0,0 L${cone.radius * Math.cos((-cone.angleDeg / 2) * (Math.PI / 180))},${cone.radius * Math.sin((-cone.angleDeg / 2) * (Math.PI / 180))} A${cone.radius},${cone.radius} 0 ${cone.angleDeg > 180 ? 1 : 0} 1 ${cone.radius * Math.cos((cone.angleDeg / 2) * (Math.PI / 180))},${cone.radius * Math.sin((cone.angleDeg / 2) * (Math.PI / 180))} Z`}
            fill={cone.color ?? PITCH.lightSoft}
            opacity={cone.opacity ?? 0.16}
          />
        </g>
      ) : null}
      <ellipse cx={size * 0.08} cy={size * 0.1} rx={w * 0.55} ry={h * 0.7} fill="#000" opacity={0.18} />
      {/* Shoulders (a capsule across the facing direction). */}
      <g transform={`rotate(${facing + sway})`}>
        <rect x={-h / 2} y={-w / 2} width={h} height={w} rx={h / 2} fill={c.shirt} />
        <rect x={-h / 2} y={-w / 2} width={h * 0.45} height={w} rx={h / 2} fill={c.shade} opacity={0.5} />
        {kind !== "chalk" ? <rect x={-h * 0.12} y={-w / 2} width={h * 0.24} height={w} fill={CAST.band} opacity={kind === "tavi" ? 1 : 0} /> : null}
      </g>
      {/* Head, with the face side towards the head direction. */}
      <g transform={`rotate(${headAngle})`}>
        <circle r={headR} fill={c.head} />
        {c.hair ? <path d={`M${-headR * 0.95},${-headR * 0.3} A${headR},${headR} 0 0 0 ${-headR * 0.95},${headR * 0.3} L${headR * 0.15},${headR * 0.5} A${headR * 0.7},${headR * 0.7} 0 0 0 ${headR * 0.15},${-headR * 0.5} Z`} fill={c.hair} /> : null}
        {kind === "chalk" ? (
          <g>
            <circle cx={headR * 0.55} cy={-headR * 0.3} r={headR * 0.12} fill={CAST.keeperEye} />
            <circle cx={headR * 0.55} cy={headR * 0.3} r={headR * 0.12} fill={CAST.keeperEye} />
          </g>
        ) : (
          <g>
            <circle cx={headR * 0.6} cy={-headR * 0.32} r={headR * 0.11} fill={CAST.keeperEye} />
            <circle cx={headR * 0.6} cy={headR * 0.32} r={headR * 0.11} fill={CAST.keeperEye} />
          </g>
        )}
        {/* Nose tick: makes the facing readable at small sizes. */}
        <path d={`M${headR * 0.9},${-headR * 0.18} L${headR * 1.2},0 L${headR * 0.9},${headR * 0.18} Z`} fill={c.head} />
      </g>
      {label ? (
        <text y={-size * 0.85} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={Math.max(32, size * 0.5)} textAnchor="middle">
          {label}
        </text>
      ) : null}
    </g>
  );
};

/** Angle (degrees, screen) from (x1,y1) towards (x2,y2). */
export const angleTo = (x1: number, y1: number, x2: number, y2: number) => (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
