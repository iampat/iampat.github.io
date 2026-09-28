// What the eyes cover: a wide dim fan (the whole field of view) and a narrow bright wedge
// (where the eyes see detail). Top-down, centred on a head.

import React, { useId } from "react";
import { useCurrentFrame } from "remotion";
import { PITCH, XRAY } from "../theme";
import { EASE, progress } from "../lib/anim";

type Props = {
  x: number;
  y: number;
  /** Direction the eyes look, degrees (0 = screen right). */
  facing: number;
  /** Whole field of view, degrees. */
  wideDeg?: number;
  /** Detail wedge, degrees. */
  sharpDeg?: number;
  radius?: number;
  at?: number;
  color?: string;
  sharpColor?: string;
  /** Darken everything outside the wide fan (needs a clip box in screen coordinates). */
  darkenOutside?: { x: number; y: number; w: number; h: number };
  labels?: boolean;
};

const wedge = (r: number, deg: number) => {
  const a = (deg / 2) * (Math.PI / 180);
  const big = deg > 180 ? 1 : 0;
  return `M0,0 L${r * Math.cos(-a)},${r * Math.sin(-a)} A${r},${r} 0 ${big} 1 ${r * Math.cos(a)},${r * Math.sin(a)} Z`;
};

export const VisionFan: React.FC<Props> = ({ x, y, facing, wideDeg = 190, sharpDeg = 10, radius = 320, at = 0, color = PITCH.lightSoft, sharpColor = XRAY.lime, darkenOutside, labels = false }) => {
  const frame = useCurrentFrame();
  const maskId = `vision-mask-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const t = progress(frame, at, 14, EASE.enter);
  if (t <= 0.001) return null;
  const r = radius * t;
  return (
    <g>
      {darkenOutside ? (
        <g>
          <defs>
            <mask id={maskId}>
              <rect x={darkenOutside.x} y={darkenOutside.y} width={darkenOutside.w} height={darkenOutside.h} fill="#fff" />
              <g transform={`translate(${x} ${y}) rotate(${facing})`}>
                <path d={wedge(radius * 3, wideDeg)} fill="#000" />
              </g>
            </mask>
          </defs>
          <rect x={darkenOutside.x} y={darkenOutside.y} width={darkenOutside.w} height={darkenOutside.h} fill={PITCH.skyHigh} opacity={0.6 * t} mask={`url(#${maskId})`} />
        </g>
      ) : null}
      <g transform={`translate(${x} ${y}) rotate(${facing})`}>
        <path d={wedge(r, wideDeg)} fill={color} opacity={0.14} />
        <path d={wedge(r, wideDeg)} fill="none" stroke={color} strokeWidth={3} opacity={0.5} strokeDasharray="10 10" />
        <path d={wedge(r * 1.02, sharpDeg)} fill={sharpColor} opacity={0.35} />
        {labels ? (
          <g>
            <text x={r * 0.55} y={-12} fill={sharpColor} fontFamily="Space Grotesk, sans-serif" fontWeight={700} fontSize={26} letterSpacing={2}>
              SHARP
            </text>
            <text x={r * 0.35 * Math.cos((wideDeg / 2 - 20) * (Math.PI / 180))} y={r * 0.35 * Math.sin((wideDeg / 2 - 20) * (Math.PI / 180))} fill={color} fontFamily="Space Grotesk, sans-serif" fontWeight={700} fontSize={26} letterSpacing={2}>
              BLURRY
            </text>
          </g>
        ) : null}
      </g>
    </g>
  );
};
