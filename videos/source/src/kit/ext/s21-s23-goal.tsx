// Behind-the-kicker goal view for s21 and s22: the stadium plate as the far backdrop,
// a perspective goal whose net ripples where the ball hits, and a lens-zoom helper.

import React from "react";
import { PITCH } from "../../theme";
import { Plate, STADIUM_LAMPS } from "../Plate";
import { Glow, Stars } from "../World";
import { project, type View } from "../../lib/project";
import type { Vec3 } from "../../physics/sim";

export type Persp = Extract<View, { kind: "persp" }>;

/** A behind-the-kicker camera. cy is set so the goal sits in the lower third over the plate's grass. */
export const behindCam = (camX: number, focal: number, opts: { camY?: number; camZ?: number; cx?: number; cy?: number; yaw?: number } = {}): Persp => ({
  kind: "persp",
  cam: { x: camX, y: opts.camY ?? 0, z: opts.camZ ?? 1.25 },
  yawDeg: opts.yaw ?? 0,
  focal,
  cx: opts.cx ?? 960,
  cy: opts.cy ?? 744,
});

/**
 * Lens zoom by factor k that moves world point `p` to screen point (tx, ty) at full zoom.
 * `t` 0..1 blends the target from where p is now to (tx, ty). Returns the new view and
 * the matching 2D transform for flat layers (the plate).
 */
export const lensZoom = (view: Persp, k: number, p: Vec3, tx: number, ty: number, t: number) => {
  const s = project(p, view);
  const gx = s.x + (tx - s.x) * t;
  const gy = s.y + (ty - s.y) * t;
  const cx = gx - (s.x - view.cx) * k;
  const cy = gy - (s.y - view.cy) * k;
  const next: Persp = { ...view, focal: view.focal * k, cx, cy };
  const flat = `translate(${cx} ${cy}) scale(${k}) translate(${-view.cx} ${-view.cy})`;
  return { view: next, flat };
};

/** The stadium plate with SVG lamp glows. `lamps[i]` 0..1. Drawn in plate (screen) space. */
export const StadiumPlate: React.FC<{ lamps: number[]; seed: string; stars?: number }> = ({ lamps, seed, stars = 1 }) => (
  <g>
    <Plate name="stadium-off" />
    <Stars count={40} maxY={250} seed={seed} opacity={stars} />
    {STADIUM_LAMPS.map((l, i) => {
      const on = lamps[i] ?? 1;
      if (on <= 0.001) return null;
      return (
        <g key={i}>
          <rect x={l.x - 70} y={l.y - 46} width={140} height={92} rx={22} fill={PITCH.lightSoft} opacity={on} />
          <Glow cx={l.x} cy={l.y} r={175 * (0.35 + 0.65 * on)} color={PITCH.lightSoft} intensity={1.1 * on} rings={4} />
        </g>
      );
    })}
  </g>
);

export type NetHit = { y: number; z: number; at: number };

const GW = 7.32;
const GH = 2.44;

/**
 * A perspective goal (posts, bar, side nets, roof and back net). The back net bulges and
 * ripples out from `hit` (world y, z on the back plane) starting at frame `hit.at`.
 * `mesh` = spacing of the net lines in metres.
 */
export const NetGoal: React.FC<{
  view: View;
  goalX: number;
  frame: number;
  hit?: NetHit;
  mesh?: number;
  depthTop?: number;
  depthBottom?: number;
  netOpacity?: number;
  /** A slow, long sway of the back net after the hit (metres), so a long hold is never still. */
  sway?: number;
  swayDecay?: number;
}> = ({ view, goalX, frame, hit, mesh = 0.45, depthTop = 1.2, depthBottom = 2.0, netOpacity = 0.4, sway = 0, swayDecay = 4 }) => {
  const tau = hit ? (frame - hit.at) / 30 : -1;
  // Depth of the back plane at height z (it slopes from the roof to the ground).
  const backX = (z: number) => goalX + depthBottom + (depthTop - depthBottom) * (z / GH);
  const disp = (y: number, z: number) => {
    if (!hit || tau < 0) return { dx: 0, dy: 0, dz: 0 };
    const ry = y - hit.y;
    const rz = z - hit.z;
    const r = Math.hypot(ry, rz);
    const bulge = 0.55 * Math.exp(-(r * r) / 0.45) * Math.exp(-tau / 0.45) * Math.min(1, tau * 12);
    const front = tau * 3.2;
    const ring = r < front + 0.2 ? 0.16 * Math.sin((r - front) * 6) * Math.exp(-tau / 0.8) * Math.exp(-r / 2.8) : 0;
    const ux = r > 1e-3 ? ry / r : 0;
    const uz = r > 1e-3 ? rz / r : 0;
    const sw = sway > 0 ? sway * Math.exp(-tau / swayDecay) * Math.min(1, tau * 1.5) * Math.sin(r * 2.6 - tau * 3.4) * (1 - Math.exp(-r * 1.5)) : 0;
    return { dx: bulge + Math.abs(ring) * 1.5 + Math.abs(sw) * 0.8, dy: ux * (ring + sw), dz: uz * (ring + sw) };
  };
  const P = (x: number, y: number, z: number) => project({ x, y, z }, view);
  const back = (y: number, z: number) => {
    const d = disp(y, z);
    return P(backX(z) + d.dx, y + d.dy, Math.max(0, z + d.dz));
  };
  const poly = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const lines: React.ReactNode[] = [];
  // Back net: verticals and horizontals, sampled so they can bend.
  const nCols = Math.round(GW / mesh);
  const nRows = Math.round(GH / mesh);
  for (let i = 0; i <= nCols; i++) {
    const y = GW / 2 - (GW * i) / nCols;
    const pts = Array.from({ length: 13 }, (_, k) => back(y, (GH * k) / 12));
    lines.push(<polyline key={`bv${i}`} points={poly(pts)} />);
  }
  for (let j = 0; j <= nRows; j++) {
    const z = (GH * j) / nRows;
    const pts = Array.from({ length: 25 }, (_, k) => back(GW / 2 - (GW * k) / 24, z));
    lines.push(<polyline key={`bh${j}`} points={poly(pts)} />);
  }
  // Side nets and roof: lines from the frame back to the back plane.
  for (const side of [1, -1]) {
    const y = (side * GW) / 2;
    for (let j = 0; j <= nRows; j++) {
      const z = (GH * j) / nRows;
      const a = P(goalX, y, z);
      const b = back(y, z);
      lines.push(<line key={`s${side}${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    }
  }
  for (let i = 0; i <= nCols; i += 2) {
    const y = GW / 2 - (GW * i) / nCols;
    const a = P(goalX, y, GH);
    const b = back(y, GH);
    lines.push(<line key={`r${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
  }
  const bl = P(goalX, GW / 2, 0);
  const br = P(goalX, -GW / 2, 0);
  const tl = P(goalX, GW / 2, GH);
  const tr = P(goalX, -GW / 2, GH);
  const scale = P(goalX, 0, 0).scale;
  const post = Math.max(5, scale * 0.12);
  const backPts = [back(GW / 2, 0), back(GW / 2, GH), back(-GW / 2, GH), back(-GW / 2, 0)];
  // Ripple rings: faint chalk circles that spread over the back net from the hit.
  const rings: React.ReactNode[] = [];
  if (hit && tau >= 0 && tau < 1.4) {
    for (let k = 0; k < 3; k++) {
      const rr = tau * 3.2 - k * 0.45;
      if (rr <= 0.05) continue;
      const pts: { x: number; y: number }[] = [];
      for (let a = 0; a <= 48; a++) {
        const th = (a / 48) * Math.PI * 2;
        const y = hit.y + Math.cos(th) * rr;
        const z = hit.z + Math.sin(th) * rr;
        if (z < 0 || z > GH || Math.abs(y) > GW / 2) {
          if (pts.length > 1) rings.push(<polyline key={`rg${k}-${a}`} points={poly(pts)} />);
          pts.length = 0;
          continue;
        }
        pts.push(back(y, z));
      }
      if (pts.length > 1) rings.push(<polyline key={`rg${k}-end`} points={poly(pts)} />);
    }
  }
  const ringO = hit && tau >= 0 ? 0.7 * Math.exp(-tau / 0.5) : 0;
  return (
    <g>
      <path d={`M${poly(backPts).split(" ").join(" L")} Z`} fill={PITCH.sky} opacity={0.4} />
      <path d={`M${bl.x},${bl.y} L${backPts[0].x},${backPts[0].y} L${backPts[3].x},${backPts[3].y} L${br.x},${br.y} Z`} fill={PITCH.grassDark} opacity={0.35} />
      <g stroke={PITCH.chalk} strokeWidth={Math.max(1.5, post * 0.22)} opacity={netOpacity} fill="none" strokeLinecap="round">
        {lines}
      </g>
      {ringO > 0.01 ? (
        <g stroke={PITCH.lightSoft} strokeWidth={Math.max(2, post * 0.35)} opacity={ringO} fill="none" strokeLinecap="round">
          {rings}
        </g>
      ) : null}
      <path
        d={`M${bl.x},${bl.y} L${tl.x},${tl.y} L${tr.x},${tr.y} L${br.x},${br.y}`}
        fill="none"
        stroke={PITCH.chalk}
        strokeWidth={post}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
};

/** A chalk goal line and penalty-box lines on the ground in a perspective view. */
export const GroundLines: React.FC<{ view: View; goalX: number; opacity?: number }> = ({ view, goalX, opacity = 0.75 }) => {
  const P = (x: number, y: number) => project({ x, y, z: 0 }, view);
  const seg = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${P(x, y).x.toFixed(1)},${P(x, y).y.toFixed(1)}`).join(" ");
  const w = Math.max(2, P(goalX, 0).scale * 0.1);
  return (
    <g fill="none" stroke={PITCH.chalk} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={opacity}>
      <path d={seg([[goalX, 30], [goalX, -30]])} />
      <path d={seg([[goalX, 9.16], [goalX - 5.5, 9.16], [goalX - 5.5, -9.16], [goalX, -9.16]])} />
      <path d={seg([[goalX, 20.16], [goalX - 16.5, 20.16], [goalX - 16.5, -20.16], [goalX, -20.16]])} />
    </g>
  );
};
