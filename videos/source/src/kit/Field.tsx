// A general top-down pitch area: stripes and the pitch lines that fall inside a view.
// Works anywhere on the pitch, not only around a goal (see PitchTop for that).
//
// Pitch frame: x along the pitch (0 = our goal line, 105 = far goal line), y across
// (0 = centre, +y = left when facing the far goal). Projected with a "top" or "topUp" view.

import React from "react";
import { PITCH } from "../theme";
import { project, type View } from "../lib/project";

export const PITCH_L = 105;
export const PITCH_W = 68;

type Props = {
  view: View;
  /** Which part of the pitch to draw (metres). Defaults to the whole pitch. */
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  stripeM?: number;
  lines?: boolean;
  lineOpacity?: number;
};

export const TopField: React.FC<Props> = ({ view, x0 = -5, x1 = PITCH_L + 5, y0 = -PITCH_W / 2 - 5, y1 = PITCH_W / 2 + 5, stripeM = 5.25, lines = true, lineOpacity = 0.85 }) => {
  const P = (x: number, y: number) => project({ x, y, z: 0 }, view);
  const poly = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${P(x, y).x.toFixed(1)},${P(x, y).y.toFixed(1)}`).join(" ") + " Z";
  const stripes = [];
  for (let s = Math.floor(x0 / stripeM); s * stripeM < x1; s++) {
    const a = Math.max(x0, s * stripeM);
    const b = Math.min(x1, (s + 1) * stripeM);
    if (b <= a) continue;
    stripes.push(<path key={s} d={poly([[a, y0], [b, y0], [b, y1], [a, y1]])} fill={s % 2 ? PITCH.grass : PITCH.grassDark} />);
  }
  const lw = Math.max(2.5, P(0, 0).scale * 0.12);
  const L: React.ReactNode[] = [];
  if (lines) {
    const seg = (pts: [number, number][], key: string) =>
      L.push(<path key={key} d={pts.map(([x, y], i) => `${i ? "L" : "M"}${P(x, y).x.toFixed(1)},${P(x, y).y.toFixed(1)}`).join(" ")} />);
    const hw = PITCH_W / 2;
    seg([[0, -hw], [PITCH_L, -hw]], "t1");
    seg([[0, hw], [PITCH_L, hw]], "t2");
    seg([[0, -hw], [0, hw]], "g1");
    seg([[PITCH_L, -hw], [PITCH_L, hw]], "g2");
    seg([[PITCH_L / 2, -hw], [PITCH_L / 2, hw]], "half");
    for (const gx of [0, PITCH_L]) {
      const d = gx === 0 ? 1 : -1;
      seg([[gx, -20.16], [gx + d * 16.5, -20.16], [gx + d * 16.5, 20.16], [gx, 20.16]], `box${gx}`);
      seg([[gx, -9.16], [gx + d * 5.5, -9.16], [gx + d * 5.5, 9.16], [gx, 9.16]], `six${gx}`);
      const arc: [number, number][] = [];
      for (let a = -53; a <= 53; a += 4) {
        const t = (a * Math.PI) / 180;
        arc.push([gx + d * (11 + 9.15 * Math.cos(t)), 9.15 * Math.sin(t)]);
      }
      seg(arc, `arc${gx}`);
    }
    const circle: [number, number][] = [];
    for (let a = 0; a <= 360; a += 6) circle.push([PITCH_L / 2 + 9.15 * Math.cos((a * Math.PI) / 180), 9.15 * Math.sin((a * Math.PI) / 180)]);
    seg(circle, "circle");
  }
  const c = P(PITCH_L / 2, 0);
  return (
    <g>
      {stripes}
      <g fill="none" stroke={PITCH.chalk} strokeWidth={lw} strokeLinejoin="round" strokeLinecap="round" opacity={lineOpacity}>
        {L}
      </g>
      {lines ? <circle cx={c.x} cy={c.y} r={lw * 1.3} fill={PITCH.chalk} opacity={lineOpacity} /> : null}
    </g>
  );
};
