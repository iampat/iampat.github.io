// A chalk ruler laid on the pitch (b05, b11, b14): from a point along a direction, a tick every metre
// and a seconds label under every second metre at Chalk's jog (4 m/s, so 2 m = 0.5 s). `progress` unrolls
// it. `steps` adds a chalk footprint per metre ("two of Chalk's steps"). All 0..1 driven, no frames.

import React from "react";
import { FONTS, PITCH } from "../../theme";
import { clamp01 } from "../../lib/anim";
import { CLOSING_SPEED } from "../TimeBubble";
import { fmtSeconds, popT } from "./chalk";

type Props = {
  /** Start point in screen pixels. */
  from: [number, number];
  /** Direction in screen pixels (normalised inside). */
  dir: [number, number];
  pxPerMetre: number;
  metres: number;
  /** 0..1: the ruler draws on from `from`. */
  progress: number;
  /** Chalk footprints, one per metre, alternating sides of the line. */
  steps?: boolean;
  color?: string;
  /** Colour of the seconds labels. Default PITCH.light. */
  secondsColor?: string;
  /** Closing speed used for the seconds labels. Default CLOSING_SPEED (4 m/s). */
  speed?: number;
  /** Put a seconds label under every N metres. Default 2. Use 1 for "0.25 s, 0.5 s". */
  secondsEvery?: number;
  /** Metre mark to glow (for "2 m and 0.5 s glow together"). */
  highlight?: number;
  /** Font size of the seconds labels (metre labels are 30 px). Default 34. */
  fontSize?: number;
  opacity?: number;
};

export const SecondsRuler: React.FC<Props> = ({
  from,
  dir,
  pxPerMetre,
  metres,
  progress,
  steps = false,
  color = PITCH.chalk,
  secondsColor = PITCH.light,
  speed = CLOSING_SPEED,
  secondsEvery = 2,
  highlight,
  fontSize = 34,
  opacity = 1,
}) => {
  const p = clamp01(progress);
  if (p <= 0.001) return null;
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / len;
  const uy = dir[1] / len;
  // Perpendicular that points up the screen (so metre labels sit above, seconds below).
  let nx = -uy;
  let ny = ux;
  if (ny > 0 || (ny === 0 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  const total = metres * pxPerMetre;
  const drawn = total * p;
  const at = (m: number, side = 0): [number, number] => [from[0] + ux * m * pxPerMetre + nx * side, from[1] + uy * m * pxPerMetre + ny * side];
  const stroke = 6;
  const metreSize = 30;
  const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
  const marks = Array.from({ length: metres + 1 }, (_, i) => i);
  return (
    <g opacity={opacity}>
      {/* Baseline. */}
      <line x1={from[0]} y1={from[1]} x2={from[0] + ux * drawn} y2={from[1] + uy * drawn} stroke={color} strokeWidth={stroke} strokeLinecap="round" opacity={0.9} />
      <circle cx={from[0]} cy={from[1]} r={stroke * 1.3} fill={color} />
      {marks.map((i) => {
        const reach = p * metres - i;
        // A mark pops over the last third of a metre before the baseline reaches it, so the
        // end mark is complete at progress 1.
        const s = popT(clamp01(i === 0 ? (p > 0 ? 1 : 0) : (reach + 0.34) * 3));
        if (s <= 0.001) return null;
        const [cx, cy] = at(i);
        const even = i % 2 === 0;
        const tick = even ? 24 : 15;
        const isHi = highlight === i;
        const secs = i / speed;
        const showSec = i > 0 && i % secondsEvery === 0;
        const secText = `${fmtSeconds(secs)} s`;
        const pillW = secText.length * fontSize * 0.62 + fontSize * 0.8;
        const pillH = fontSize * 1.3;
        const [mx, my] = at(i, tick + metreSize * 0.75);
        const [sx, sy] = at(i, -(tick + fontSize * 0.95));
        return (
          <g key={i}>
            {isHi ? (
              <g opacity={0.9}>
                <circle cx={cx} cy={cy} r={tick * 2.2} fill={secondsColor} opacity={0.14} />
                <circle cx={cx} cy={cy} r={tick * 1.4} fill={secondsColor} opacity={0.22} />
              </g>
            ) : null}
            <g transform={`translate(${cx} ${cy}) scale(${s})`}>
              <line x1={-nx * tick} y1={-ny * tick} x2={nx * tick} y2={ny * tick} stroke={isHi ? secondsColor : color} strokeWidth={even ? stroke : stroke * 0.75} strokeLinecap="round" />
            </g>
            <g transform={`translate(${mx} ${my}) scale(${s * (isHi ? 1.15 : 1)})`}>
              <text y={metreSize * 0.35} fill={isHi ? secondsColor : color} fontFamily={FONTS.mono} fontWeight={500} fontSize={metreSize} textAnchor="middle" opacity={0.95}>
                {i} m
              </text>
            </g>
            {showSec ? (
              <g transform={`translate(${sx} ${sy}) scale(${s * (isHi ? 1.15 : 1)})`}>
                <rect x={-pillW / 2} y={-pillH / 2} width={pillW} height={pillH} rx={pillH / 2} fill={PITCH.sky} opacity={0.85} />
                <text y={fontSize * 0.35} fill={secondsColor} fontFamily={FONTS.mono} fontWeight={500} fontSize={fontSize} textAnchor="middle">
                  {secText}
                </text>
              </g>
            ) : null}
            {steps && i > 0 ? (
              <g transform={`translate(${cx} ${cy}) rotate(${angle}) translate(${-pxPerMetre * 0.3} ${(i % 2 === 0 ? 1 : -1) * stroke * 2.4}) scale(${s})`}>
                {/* A chalk footprint: sole and heel, toes pointing along the ruler. Scales with the metre. */}
                <ellipse cx={pxPerMetre * 0.035} cy={0} rx={Math.max(9, pxPerMetre * 0.11)} ry={Math.max(5, pxPerMetre * 0.065)} fill={color} opacity={0.85} />
                <circle cx={-Math.max(9, pxPerMetre * 0.1)} cy={0} r={Math.max(4, pxPerMetre * 0.047)} fill={color} opacity={0.85} />
              </g>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};
