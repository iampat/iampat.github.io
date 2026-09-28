// Goals in three views. Sizes in metres: full goal 7.32 x 2.44 (youth U11-U14 bar: 2.13).

import React from "react";
import { PITCH } from "../theme";
import { project, type View } from "../lib/project";

export const GOAL_W = 7.32;
export const GOAL_H = 2.44;

/** Side view: the near post and crossbar seen edge-on, with the net sloping back. */
export const GoalSide: React.FC<{ view: View; goalX: number; height?: number; depth?: number; netOpacity?: number }> = ({
  view,
  goalX,
  height = GOAL_H,
  depth = 1.8,
  netOpacity = 0.35,
}) => {
  const P = (x: number, z: number) => project({ x, y: 0, z }, view);
  const top = P(goalX, height);
  const base = P(goalX, 0);
  const backTop = P(goalX + depth * 0.5, height * 0.95);
  const backBase = P(goalX + depth, 0);
  const w = Math.max(6, (view.kind === "side" ? view.ppm : 60) * 0.12);
  const netLines = [];
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    const a = { x: top.x + (backTop.x - top.x) * t, y: top.y + (backTop.y - top.y) * t };
    const b = { x: base.x + (backBase.x - base.x) * t, y: base.y };
    netLines.push(<line key={`v${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
  }
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const a = { x: top.x, y: top.y + (base.y - top.y) * t };
    const b = { x: backTop.x + (backBase.x - backTop.x) * t, y: backTop.y + (backBase.y - backTop.y) * t };
    netLines.push(<line key={`h${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
  }
  return (
    <g>
      <g stroke={PITCH.chalk} strokeWidth={2} opacity={netOpacity}>
        {netLines}
        <line x1={backTop.x} y1={backTop.y} x2={backBase.x} y2={backBase.y} />
        <line x1={top.x} y1={top.y} x2={backTop.x} y2={backTop.y} />
      </g>
      <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={PITCH.chalk} strokeWidth={w} strokeLinecap="round" />
    </g>
  );
};

/** Front view (from the kicker, or any perspective view): posts, bar and a net grid. */
export const GoalFront: React.FC<{ view: View; goalX: number; width?: number; height?: number; netOpacity?: number }> = ({
  view,
  goalX,
  width = GOAL_W,
  height = GOAL_H,
  netOpacity = 0.3,
}) => {
  const P = (y: number, z: number, dx = 0) => project({ x: goalX + dx, y, z }, view);
  const bl = P(width / 2, 0);
  const br = P(-width / 2, 0);
  const tl = P(width / 2, height);
  const tr = P(-width / 2, height);
  const w = Math.max(5, bl.scale * 0.12);
  const grid = [];
  const nb = { tl: P(width / 2, height * 0.9, 1.5), tr: P(-width / 2, height * 0.9, 1.5), bl: P(width / 2, 0, 2), br: P(-width / 2, 0, 2) };
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    grid.push(
      <line key={`c${i}`} x1={nb.tl.x + (nb.tr.x - nb.tl.x) * t} y1={nb.tl.y + (nb.tr.y - nb.tl.y) * t} x2={nb.bl.x + (nb.br.x - nb.bl.x) * t} y2={nb.bl.y + (nb.br.y - nb.bl.y) * t} />,
    );
  }
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    grid.push(
      <line key={`r${i}`} x1={nb.tl.x + (nb.bl.x - nb.tl.x) * t} y1={nb.tl.y + (nb.bl.y - nb.tl.y) * t} x2={nb.tr.x + (nb.br.x - nb.tr.x) * t} y2={nb.tr.y + (nb.br.y - nb.tr.y) * t} />,
    );
  }
  return (
    <g>
      <path d={`M${nb.bl.x},${nb.bl.y} L${nb.tl.x},${nb.tl.y} L${nb.tr.x},${nb.tr.y} L${nb.br.x},${nb.br.y} Z`} fill={PITCH.sky} opacity={0.35} />
      <g stroke={PITCH.chalk} strokeWidth={Math.max(1.5, w * 0.25)} opacity={netOpacity}>
        {grid}
      </g>
      <path
        d={`M${bl.x},${bl.y} L${tl.x},${tl.y} L${tr.x},${tr.y} L${br.x},${br.y}`}
        fill="none"
        stroke={PITCH.chalk}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
};

/** Top view: two posts and the back of the net on the goal line at x = goalX. */
export const GoalTop: React.FC<{ view: View; goalX: number; width?: number; depth?: number }> = ({ view, goalX, width = GOAL_W, depth = 2 }) => {
  const P = (x: number, y: number) => project({ x, y, z: 0 }, view);
  const a = P(goalX, width / 2);
  const b = P(goalX + depth, width / 2);
  const c = P(goalX + depth, -width / 2);
  const d = P(goalX, -width / 2);
  const w = Math.max(5, a.scale * 0.14);
  return (
    <g>
      <path d={`M${a.x},${a.y} L${b.x},${b.y} L${c.x},${c.y} L${d.x},${d.y}`} fill={PITCH.sky} fillOpacity={0.25} stroke={PITCH.chalk} strokeOpacity={0.5} strokeWidth={w * 0.4} strokeLinejoin="round" />
      <circle cx={a.x} cy={a.y} r={w * 0.9} fill={PITCH.chalk} />
      <circle cx={d.x} cy={d.y} r={w * 0.9} fill={PITCH.chalk} />
    </g>
  );
};
