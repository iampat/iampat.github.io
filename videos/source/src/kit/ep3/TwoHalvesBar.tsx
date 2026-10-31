// The two-halves bar: a chalk bar under the board. The quiet half (lime) is the moves while safe lines
// exist, the giving half (orange) is the rest. `gapAt` is the move index where the safe lines run out
// (g1: 14, g5: 16). `progress` 0..1 draws the bar on; `fill` 0..moves lights it up to that move.
import React from "react";
import { PITCH, XRAY } from "../../theme";
import { trim } from "../ep2/chalk";
import { clamp01 } from "../../lib/anim";

export const TwoHalvesBar: React.FC<{
  x: number; // left end
  y: number;
  width: number;
  moves: number; // total moves (24)
  gapAt: number; // first move of the giving half (0-based count of quiet moves)
  progress?: number; // 0..1: the bar is drawn on
  fill?: number; // 0..moves: lit up to this move
  marker?: number; // optional move index to mark with a chalk tick (e.g. the early gift)
  labels?: boolean;
  opacity?: number;
}> = ({ x, y, width, moves, gapAt, progress = 1, fill = 0, marker, labels = true, opacity = 1 }) => {
  const w = 10;
  const gx = x + (width * gapAt) / moves;
  const fx = x + (width * clamp01(fill / moves));
  const t = clamp01(progress);
  return (
    <g opacity={opacity}>
      <path d={`M ${x} ${y} L ${x + width} ${y}`} stroke={PITCH.chalk} strokeWidth={w} strokeLinecap="round" opacity={0.25} {...trim(t)} />
      {fill > 0 ? <path d={`M ${x} ${y} L ${Math.min(fx, gx)} ${y}`} stroke={XRAY.lime} strokeWidth={w} strokeLinecap="round" opacity={0.95} /> : null}
      {fill > gapAt ? <path d={`M ${gx} ${y} L ${fx} ${y}`} stroke={PITCH.accent} strokeWidth={w} strokeLinecap="round" opacity={0.95} /> : null}
      {t > 0.5 ? <path d={`M ${gx} ${y - 22} L ${gx} ${y + 22}`} stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" opacity={0.9} /> : null}
      {marker !== undefined && t > 0.5 ? (
        <path d={`M ${x + (width * marker) / moves} ${y - 16} L ${x + (width * marker) / moves} ${y + 16}`} stroke={XRAY.pink} strokeWidth={6} strokeLinecap="round" />
      ) : null}
      {labels && t > 0.8 ? (
        <>
          <text x={(x + gx) / 2} y={y + 44} textAnchor="middle" fontSize={26} fontWeight={800} fill={XRAY.lime} fontFamily="Nunito, sans-serif" opacity={0.9}>
            THE QUIET HALF
          </text>
          <text x={(gx + x + width) / 2} y={y + 44} textAnchor="middle" fontSize={26} fontWeight={800} fill={PITCH.accent} fontFamily="Nunito, sans-serif" opacity={0.9}>
            THE GIVING HALF
          </text>
        </>
      ) : null}
    </g>
  );
};
