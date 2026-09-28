// The speed-gap meter (b09, b10): two horizontal arrows from one origin, BALL (orange) and FOOT (teal),
// and a bracket under them that spans the GAP between the tips. The gap is pink and turns lime when it is
// small. No digits: the lengths do the talking. `stacked` shows IN and OUT arrows (both orange) with thirds
// marked on the track, for "maybe a third". In stacked mode `footSpeed` is the OUT speed.

import React from "react";
import { CAST, FONTS, PITCH, XRAY } from "../../theme";
import { clamp01 } from "../../lib/anim";
import { mixHex } from "./chalk";

type Props = {
  /** Left end (origin) of both arrows. */
  x: number;
  /** Centre line of the first arrow. */
  y: number;
  /** Track width in pixels (the meter's full scale). */
  width: number;
  ballSpeed: number;
  footSpeed: number;
  /** Pixels per m/s. */
  scale: number;
  /** IN / OUT mode for the rebound: both arrows orange, thirds marked, no gap by default. */
  stacked?: boolean;
  showGap?: boolean;
  labels?: [string, string];
  /** Gap (m/s) at or under which the bracket is lime. Default 1. */
  smallGap?: number;
  gapLabel?: string;
  barHeight?: number;
  fontSize?: number;
  opacity?: number;
};

const ArrowBar: React.FC<{ x: number; y: number; length: number; h: number; color: string }> = ({ x, y, length, h, color }) => {
  const head = h * 0.9;
  if (length < h * 0.6) {
    // Zero length: a nub, so a still foot still shows.
    return <circle cx={x + Math.max(0, length)} cy={y} r={h / 2} fill={color} />;
  }
  const bodyEnd = x + length - head;
  return (
    <g>
      <rect x={x} y={y - h / 2} width={Math.max(h, bodyEnd - x + h * 0.3)} height={h} rx={h / 2} fill={color} />
      <path d={`M${bodyEnd - h * 0.1},${y - h * 0.95} L${x + length},${y} L${bodyEnd - h * 0.1},${y + h * 0.95} Z`} fill={color} stroke={color} strokeWidth={h * 0.35} strokeLinejoin="round" />
    </g>
  );
};

export const SpeedDiffMeter: React.FC<Props> = ({
  x,
  y,
  width,
  ballSpeed,
  footSpeed,
  scale,
  stacked = false,
  showGap,
  labels,
  smallGap = 1,
  gapLabel = "GAP",
  barHeight = 30,
  fontSize = 32,
  opacity = 1,
}) => {
  const gapOn = showGap ?? !stacked;
  const names = labels ?? (stacked ? ["IN", "OUT"] : ["BALL", "FOOT"]);
  const row = barHeight * 2.2;
  const colors: [string, string] = stacked ? [CAST.ball, CAST.ballRim] : [CAST.ball, CAST.shirt];
  const l1 = Math.max(0, ballSpeed) * scale;
  const l2 = Math.max(0, footSpeed) * scale;
  const gap = Math.abs(ballSpeed - footSpeed);
  const gapT = clamp01((gap - smallGap) / (smallGap * 1.5));
  const gapColor = mixHex(XRAY.lime, CAST.mistake, gapT);
  const gx0 = x + Math.min(l1, l2);
  const gx1 = x + Math.max(l1, l2);
  const gy = y + row * 2;
  const labelX = x - fontSize * 0.6;
  return (
    <g opacity={opacity}>
      {/* Tracks. */}
      {[0, 1].map((i) => (
        <rect key={i} x={x} y={y + row * i - barHeight * 0.25} width={width} height={barHeight * 0.5} rx={barHeight * 0.25} fill={PITCH.chalk} opacity={0.12} />
      ))}
      {/* Thirds of the IN arrow, for "maybe a third". */}
      {stacked
        ? [1 / 3, 2 / 3].map((f, i) => (
            <line key={i} x1={x + l1 * f} y1={y - barHeight * 0.9} x2={x + l1 * f} y2={y + row + barHeight * 0.9} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="6 8" strokeLinecap="round" opacity={0.4} />
          ))
        : null}
      {/* Arrows. */}
      <ArrowBar x={x} y={y} length={l1} h={barHeight} color={colors[0]} />
      <ArrowBar x={x} y={y + row} length={l2} h={barHeight} color={colors[1]} />
      {/* Names. */}
      {names.map((n, i) => (
        <text key={i} x={labelX} y={y + row * i + fontSize * 0.36} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={fontSize} textAnchor="end" letterSpacing={3} opacity={0.9}>
          {n}
        </text>
      ))}
      {gapOn ? (
        <g>
          {/* Guides from each tip down to the bracket. */}
          <line x1={x + l1} y1={y + barHeight * 0.8} x2={x + l1} y2={gy - barHeight * 0.55} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="5 9" strokeLinecap="round" opacity={0.35} />
          <line x1={x + l2} y1={y + row + barHeight * 0.8} x2={x + l2} y2={gy - barHeight * 0.55} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="5 9" strokeLinecap="round" opacity={0.35} />
          {/* Glow behind the gap bar. */}
          <rect x={gx0 - barHeight * 0.9} y={gy - barHeight * 0.9} width={gx1 - gx0 + barHeight * 1.8} height={barHeight * 1.8} rx={barHeight * 0.9} fill={gapColor} opacity={0.14} />
          <rect x={gx0 - barHeight * 0.5} y={gy - barHeight * 0.5} width={gx1 - gx0 + barHeight} height={barHeight} rx={barHeight * 0.5} fill={gapColor} opacity={0.22} />
          {/* The bar itself, with bracket ends. */}
          <rect x={gx0 - barHeight * 0.15} y={gy - barHeight * 0.15} width={gx1 - gx0 + barHeight * 0.3} height={barHeight * 0.3} rx={barHeight * 0.15} fill={gapColor} />
          <rect x={gx0 - barHeight * 0.15} y={gy - barHeight * 0.55} width={barHeight * 0.3} height={barHeight * 1.1} rx={barHeight * 0.15} fill={gapColor} />
          <rect x={gx1 - barHeight * 0.15} y={gy - barHeight * 0.55} width={barHeight * 0.3} height={barHeight * 1.1} rx={barHeight * 0.15} fill={gapColor} />
          <text x={(gx0 + gx1) / 2} y={gy + barHeight * 0.9 + fontSize} fill={gapColor} fontFamily={FONTS.hud} fontWeight={700} fontSize={fontSize} textAnchor="middle" letterSpacing={4}>
            {gapLabel}
          </text>
        </g>
      ) : null}
    </g>
  );
};
