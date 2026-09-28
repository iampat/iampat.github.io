// Two-panel compare frame (b11, b16, b21): a chalk divider, a label pill at the top of each panel, and
// clip paths so each side's scene stays in its panel. `freezeAt` holds a side at its own frame with
// Remotion's <Freeze>. Children draw in panel-local coordinates: (0,0) is the panel's top-left, or its
// centre with origin="centre". Use `splitPanels()` to get each panel's box for layout.

import React from "react";
import { Freeze } from "remotion";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { clamp01 } from "../../lib/anim";
import { popT, safeId } from "./chalk";

export type PanelBox = { x: number; y: number; w: number; h: number };

type Geometry = { x?: number; y?: number; width?: number; height?: number; gutter?: number; divider?: number };

/** Panel boxes for a given frame geometry, so a scene can place things before rendering. */
export const splitPanels = ({ x = 0, y = 0, width = WIDTH, height = HEIGHT, gutter = 40, divider = 0.5 }: Geometry): { left: PanelBox; right: PanelBox; dividerX: number } => {
  const inner = width - gutter * 2;
  const dividerX = x + gutter + inner * clamp01(divider);
  const top = y + gutter;
  const h = height - gutter * 2;
  return {
    left: { x: x + gutter, y: top, w: Math.max(0, dividerX - gutter / 2 - (x + gutter)), h },
    right: { x: dividerX + gutter / 2, y: top, w: Math.max(0, x + width - gutter - (dividerX + gutter / 2)), h },
    dividerX,
  };
};

type Props = Geometry & {
  left: React.ReactNode;
  right: React.ReactNode;
  labels?: [string, string];
  /** Pill colours per side. Default pink (mistake) on the left, lime (fix) on the right. */
  labelColors?: [string, string];
  /** Hold a side at a frame (undefined = live). */
  freezeAt?: [number | undefined, number | undefined];
  /** Panel background. Default PITCH.skyHigh. Use "none" when the children paint their own. */
  panelBg?: string;
  /** A chalk number or word in the knob on the divider ("1", "2"). */
  dividerLabel?: string;
  /** 0..1: the divider draws down and the labels pop. Default 1. */
  progress?: number;
  origin?: "topLeft" | "centre";
  radius?: number;
  labelSize?: number;
  /** Corner marks on a frozen side. Default true. */
  freezeMarks?: boolean;
};

const CornerMarks: React.FC<{ box: PanelBox; color: string }> = ({ box, color }) => {
  const s = 34;
  const m = 18;
  const corner = (cx: number, cy: number, sx: number, sy: number) => (
    <path d={`M${cx + sx * s},${cy} L${cx},${cy} L${cx},${cy + sy * s}`} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
  );
  return (
    <g>
      {corner(box.x + m, box.y + m, 1, 1)}
      {corner(box.x + box.w - m, box.y + m, -1, 1)}
      {corner(box.x + m, box.y + box.h - m, 1, -1)}
      {corner(box.x + box.w - m, box.y + box.h - m, -1, -1)}
    </g>
  );
};

const Side: React.FC<{ box: PanelBox; clipId: string; freeze?: number; children: React.ReactNode; origin: "topLeft" | "centre" }> = ({ box, clipId, freeze, children, origin }) => {
  const tx = origin === "centre" ? box.x + box.w / 2 : box.x;
  const ty = origin === "centre" ? box.y + box.h / 2 : box.y;
  const inner = <g transform={`translate(${tx} ${ty})`}>{children}</g>;
  return (
    <g clipPath={`url(#${clipId})`}>
      {freeze === undefined ? inner : <Freeze frame={freeze}>{inner}</Freeze>}
    </g>
  );
};

export const SplitCompare: React.FC<Props> = ({
  left,
  right,
  labels,
  labelColors = [CAST.mistake, XRAY.lime],
  freezeAt,
  panelBg = PITCH.skyHigh,
  dividerLabel,
  progress = 1,
  origin = "topLeft",
  radius = 28,
  labelSize = 32,
  freezeMarks = true,
  ...geo
}) => {
  const { left: L, right: R, dividerX } = splitPanels(geo);
  const { y = 0, height = HEIGHT, gutter = 40 } = geo;
  const id = safeId(React.useId(), "split");
  const p = clamp01(progress);
  const top = y + gutter;
  const bottom = y + height - gutter;
  const lineEnd = top + (bottom - top) * p;
  const labelPop = popT(clamp01((p - 0.5) * 2));
  const pill = (text: string, box: PanelBox, color: string) => {
    const w = text.length * labelSize * 0.66 + labelSize * 1.2;
    const h = labelSize * 1.55;
    return (
      <g transform={`translate(${box.x + box.w / 2} ${box.y + h * 0.9}) scale(${labelPop})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={color} />
        <text y={labelSize * 0.36} fill={PITCH.sky} fontFamily={FONTS.hud} fontWeight={700} fontSize={labelSize} textAnchor="middle" letterSpacing={3}>
          {text}
        </text>
      </g>
    );
  };
  return (
    <g>
      <defs>
        <clipPath id={`${id}-l`}>
          <rect x={L.x} y={L.y} width={L.w} height={L.h} rx={radius} />
        </clipPath>
        <clipPath id={`${id}-r`}>
          <rect x={R.x} y={R.y} width={R.w} height={R.h} rx={radius} />
        </clipPath>
      </defs>
      {panelBg !== "none" ? (
        <g>
          <rect x={L.x} y={L.y} width={L.w} height={L.h} rx={radius} fill={panelBg} />
          <rect x={R.x} y={R.y} width={R.w} height={R.h} rx={radius} fill={panelBg} />
        </g>
      ) : null}
      <Side box={L} clipId={`${id}-l`} freeze={freezeAt?.[0]} origin={origin}>
        {left}
      </Side>
      <Side box={R} clipId={`${id}-r`} freeze={freezeAt?.[1]} origin={origin}>
        {right}
      </Side>
      {freezeMarks && freezeAt?.[0] !== undefined ? <CornerMarks box={L} color={PITCH.chalk} /> : null}
      {freezeMarks && freezeAt?.[1] !== undefined ? <CornerMarks box={R} color={PITCH.chalk} /> : null}
      {/* Divider. */}
      {p > 0.001 ? <line x1={dividerX} y1={top} x2={dividerX} y2={lineEnd} stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" opacity={0.9} /> : null}
      {dividerLabel ? (
        <g transform={`translate(${dividerX} ${(top + bottom) / 2}) scale(${labelPop})`}>
          <circle r={labelSize * 1.05} fill={PITCH.chalk} />
          <text y={labelSize * 0.38} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={labelSize * 1.1} textAnchor="middle">
            {dividerLabel}
          </text>
        </g>
      ) : null}
      {labels ? (
        <g>
          {pill(labels[0], L, labelColors[0])}
          {pill(labels[1], R, labelColors[1])}
        </g>
      ) : null}
    </g>
  );
};
