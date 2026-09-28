// The orange ball and its Line: the motif of the video.
// The Line is a real great circle on the sphere. It turns about the true spin axis,
// so viewers can read the spin: slow turn (drive), sideways (curler),
// forward (volley), backward (chip), still (knuckleball).

import React from "react";
import { CAST } from "../theme";
import type { Vec3 } from "../physics/sim";
import { basisOf, type View } from "../lib/project";

type Props = {
  cx: number;
  cy: number;
  /** Radius in pixels. */
  r: number;
  view: View;
  /** Spin axis in world coordinates (any length). */
  axis?: Vec3;
  /** Total angle turned, radians. */
  angle?: number;
  /** Normal of the Line's circle in the ball's own frame, before any spin. */
  lineNormal?: Vec3;
  /** Squash along the screen x axis at impact (1 = round). */
  squash?: number;
  /** 0..1: how much of the Line is drawn (for the "draw the line" moment). */
  lineDraw?: number;
  showLine?: boolean;
  /** Fade the hidden back half of the Line in (x-ray views). */
  showBack?: boolean;
  lineColor?: string;
  opacity?: number;
  /** Soft panel patches that turn with the ball. Default: on when r >= 40 px. */
  patches?: boolean;
};

const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Rodrigues rotation of p about unit axis k by angle t. */
const rotate = (p: Vec3, k: Vec3, t: number): Vec3 => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const kxp = cross(k, p);
  const kdp = dot(k, p);
  return {
    x: p.x * c + kxp.x * s + k.x * kdp * (1 - c),
    y: p.y * c + kxp.y * s + k.y * kdp * (1 - c),
    z: p.z * c + kxp.z * s + k.z * kdp * (1 - c),
  };
};

let idCounter = 0;

// Icosahedron vertices (unit length): patch centres on the ball.
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO: Vec3[] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map(([x, y, z]) => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
});

export const Ball: React.FC<Props> = ({
  cx,
  cy,
  r,
  view,
  axis = { x: 0, y: 0, z: 1 },
  angle = 0,
  lineNormal = { x: 0.35, y: 0.55, z: 0.75 },
  squash = 1,
  lineDraw = 1,
  showLine = true,
  showBack = false,
  lineColor = CAST.ballLine,
  opacity = 1,
  patches,
}) => {
  const [clipId] = React.useState(() => `ballclip-${idCounter++}`);
  const b = basisOf(view);
  const k = norm(axis);
  const n = norm(lineNormal);
  // Two unit vectors spanning the circle's plane.
  const helper = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const a1 = norm(cross(n, helper));
  const a2 = cross(n, a1);

  const steps = 72;
  const front: string[] = [];
  const back: string[] = [];
  let curFront: { x: number; y: number }[] = [];
  let curBack: { x: number; y: number }[] = [];
  const flush = (arr: string[], seg: { x: number; y: number }[]) => {
    if (seg.length > 1) arr.push(`M${seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`);
  };
  const drawn = Math.max(0, Math.min(1, lineDraw)) * steps;
  for (let i = 0; i <= drawn; i++) {
    const th = (i / steps) * 2 * Math.PI;
    const local = {
      x: a1.x * Math.cos(th) + a2.x * Math.sin(th),
      y: a1.y * Math.cos(th) + a2.y * Math.sin(th),
      z: a1.z * Math.cos(th) + a2.z * Math.sin(th),
    };
    const w = rotate(local, k, angle);
    const sx = dot(w, b.right) * r * 0.97;
    const sy = -dot(w, b.up) * r * 0.97;
    const depth = dot(w, b.toward);
    const pt = { x: sx, y: sy };
    if (depth >= 0) {
      curFront.push(pt);
      if (curBack.length) {
        curBack.push(pt);
        flush(back, curBack);
        curBack = [];
      }
    } else {
      curBack.push(pt);
      if (curFront.length) {
        curFront.push(pt);
        flush(front, curFront);
        curFront = [];
      }
    }
  }
  flush(front, curFront);
  flush(back, curBack);

  const stroke = Math.max(2, r * 0.11);
  return (
    <g transform={`translate(${cx} ${cy}) scale(${squash} ${1 / squash})`} opacity={opacity}>
      <defs>
        <clipPath id={clipId}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r} fill={CAST.ballShade} />
      <g clipPath={`url(#${clipId})`}>
        {/* Lit body offset towards the light (top-left) leaves a shade crescent bottom-right. */}
        <circle cx={-r * 0.16} cy={-r * 0.16} r={r * 0.98} fill={CAST.ball} />
        {(patches ?? r >= 40)
          ? ICO.map((c, i) => {
              const w = rotate(c, k, angle);
              const depth = dot(w, b.toward);
              if (depth < 0.05) return null;
              const px = dot(w, b.right) * r * 0.9;
              const py = -dot(w, b.up) * r * 0.9;
              const pr = r * 0.2;
              const rot = (Math.atan2(py, px) * 180) / Math.PI;
              return (
                <ellipse key={`p${i}`} cx={px} cy={py} rx={pr * Math.max(0.25, depth)} ry={pr} transform={`rotate(${rot} ${px} ${py})`} fill={CAST.ballShade} opacity={0.22} />
              );
            })
          : null}
        {showLine && showBack
          ? back.map((d, i) => (
              <path key={`b${i}`} d={d} fill="none" stroke={lineColor} strokeWidth={stroke} strokeLinecap="round" opacity={0.25} />
            ))
          : null}
        {showLine
          ? front.map((d, i) => (
              <path key={`f${i}`} d={d} fill="none" stroke={lineColor} strokeWidth={stroke} strokeLinecap="round" />
            ))
          : null}
      </g>
      {/* Rim light on the lit edge. */}
      <path
        d={`M${-r * 0.92},${-r * 0.2} A${r * 0.94},${r * 0.94} 0 0 1 ${r * 0.1},${-r * 0.93}`}
        fill="none"
        stroke={CAST.ballRim}
        strokeWidth={Math.max(1.5, r * 0.08)}
        strokeLinecap="round"
        opacity={0.8}
      />
    </g>
  );
};

/** Screen offset (from the ball centre) of the Line's point at parameter theta, for placing a marker. */
export const linePoint = (view: View, r: number, theta: number, lineNormal: Vec3 = { x: 0.35, y: 0.55, z: 0.75 }, axis: Vec3 = { x: 0, y: 0, z: 1 }, angle = 0) => {
  const b = basisOf(view);
  const n = norm(lineNormal);
  const helper = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const a1 = norm(cross(n, helper));
  const a2 = cross(n, a1);
  const local = {
    x: a1.x * Math.cos(theta) + a2.x * Math.sin(theta),
    y: a1.y * Math.cos(theta) + a2.y * Math.sin(theta),
    z: a1.z * Math.cos(theta) + a2.z * Math.sin(theta),
  };
  const w = rotate(local, norm(axis), angle);
  return { x: dot(w, b.right) * r * 0.97, y: -dot(w, b.up) * r * 0.97, front: dot(w, b.toward) >= 0 };
};
