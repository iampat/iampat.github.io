// The night pitch: sky, stars, floodlights, stands, grass (side and top views), the stand clock.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { HEIGHT, PITCH, WIDTH } from "../theme";
import { idle } from "../lib/anim";
import type { View } from "../lib/project";
import { project } from "../lib/project";

/** Full-frame sky gradient. */
export const Sky: React.FC<{ top?: string; bottom?: string; id?: string }> = ({
  top = PITCH.skyHigh,
  bottom = PITCH.sky,
  id = "sky",
}) => (
  <>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={top} />
        <stop offset="1" stopColor={bottom} />
      </linearGradient>
    </defs>
    <rect x={-WIDTH} y={-HEIGHT} width={WIDTH * 3} height={HEIGHT * 3} fill={`url(#${id})`} />
  </>
);

/** Three layers of stars that twinkle out of phase. */
export const Stars: React.FC<{ count?: number; seed?: string; maxY?: number; opacity?: number; color?: string }> = ({
  count = 140,
  seed = "stars",
  maxY = HEIGHT * 0.6,
  opacity = 1,
  color = "#FFFFFF",
}) => {
  const frame = useCurrentFrame();
  return (
    <g opacity={opacity}>
      {Array.from({ length: count }, (_, i) => {
        const layer = i % 3;
        const x = random(`${seed}-x-${i}`) * WIDTH * 1.4 - WIDTH * 0.2;
        const y = random(`${seed}-y-${i}`) * maxY;
        const r = [1, 1.6, 2.3][layer] * (0.7 + random(`${seed}-r-${i}`) * 0.6);
        const tw = 0.55 + 0.45 * Math.sin(frame / (18 + layer * 9) + random(`${seed}-p-${i}`) * 6.28);
        return <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={tw * [0.45, 0.65, 0.9][layer]} />;
      })}
    </g>
  );
};

/** Soft glow made of concentric low-opacity circles (no CSS blur: it is slow to render). */
export const Glow: React.FC<{ cx: number; cy: number; r: number; color: string; intensity?: number; rings?: number }> = ({
  cx,
  cy,
  r,
  color,
  intensity = 1,
  rings = 4,
}) => (
  <g>
    {Array.from({ length: rings }, (_, i) => {
      const k = (i + 1) / rings;
      return <circle key={i} cx={cx} cy={cy} r={r * k} fill={color} opacity={(0.16 / rings) * (rings - i) * intensity} />;
    })}
  </g>
);

/** A floodlight tower. `on` is 0..1. The beam cone is a flat gradient triangle. */
export const Floodlight: React.FC<{ x: number; baseY: number; height: number; on: number; flip?: boolean; beam?: boolean }> = ({
  x,
  baseY,
  height,
  on,
  flip = false,
  beam = false,
}) => {
  const topY = baseY - height;
  const headW = 70;
  const dir = flip ? -1 : 1;
  const gid = `beam-${Math.round(x)}-${Math.round(baseY)}`;
  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PITCH.lightSoft} stopOpacity={0.12 * on} />
          <stop offset="1" stopColor={PITCH.lightSoft} stopOpacity={0} />
        </linearGradient>
      </defs>
      {beam && on > 0.01 ? (
        <path
          d={`M${x - headW / 2},${topY + 10} L${x + headW / 2},${topY + 10} L${x + dir * 380},${baseY + 60} L${x + dir * 40},${baseY + 60} Z`}
          fill={`url(#${gid})`}
        />
      ) : null}
      <rect x={x - 5} y={topY} width={10} height={height} rx={5} fill={PITCH.stands} />
      <rect x={x - 70} y={topY - 90} width={140} height={92} rx={22} fill={PITCH.standsLight} />
      <rect x={x - 70} y={topY - 90} width={140} height={92} rx={22} fill={PITCH.lightSoft} opacity={on} />
      <Glow cx={x} cy={topY - 44} r={175} color={PITCH.lightSoft} intensity={on * 1.1} rings={4} />
    </g>
  );
};

/** One long stand like the stadium plate: flat roof, angled ends, three seat rows. `parallax` shifts it. */
export const Stands: React.FC<{ baseY: number; parallax?: number; lit?: number; width?: number; x?: number }> = ({ baseY, parallax = 0, lit = 0, width = WIDTH, x = 0 }) => (
  <g transform={`translate(${parallax + x} 0)`}>
    <path d={`M-200,${baseY} L-120,${baseY - 250} L${width + 120},${baseY - 250} L${width + 200},${baseY} Z`} fill={PITCH.stands} />
    <path d={`M-160,${baseY - 250} L${width + 160},${baseY - 250} L${width + 120},${baseY - 190} L-120,${baseY - 190} Z`} fill="#1B2150" />
    <rect x={-220} y={baseY - 290} width={width + 440} height={44} rx={22} fill={PITCH.standsLight} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={-40 - i * 26} y={baseY - 160 + i * 50} width={width + 80 + i * 52} height={26} rx={13} fill={PITCH.standsLight} opacity={0.8 + 0.2 * lit} />
    ))}
    <rect x={-400} y={baseY - 16} width={width + 800} height={24} fill="#252C66" />
  </g>
);

/** The clock on the stand. `hours` in 24 h (22 = ten at night), fractional for animation. */
export const StandClock: React.FC<{ x: number; y: number; r?: number; hours: number }> = ({ x, y, r = 46, hours }) => {
  const h = ((hours % 12) / 12) * 360;
  const m = ((hours % 1) * 60 * 6) % 360;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-6} y={r - 4} width={12} height={40} rx={6} fill={PITCH.stands} />
      <circle r={r + 8} fill={PITCH.standsLight} />
      <circle r={r} fill={PITCH.chalk} />
      <line x1={0} y1={0} x2={0} y2={-r * 0.5} stroke={PITCH.sky} strokeWidth={7} strokeLinecap="round" transform={`rotate(${h})`} />
      <line x1={0} y1={0} x2={0} y2={-r * 0.78} stroke={PITCH.sky} strokeWidth={4.5} strokeLinecap="round" transform={`rotate(${m})`} />
      <circle r={5} fill={PITCH.accent} />
    </g>
  );
};

/** Side-view grass seen from pitch level: stripes fan out towards the viewer (matches the stadium plate). */
export const GroundSide: React.FC<{ groundY: number; vanishX?: number; offset?: number }> = ({ groundY, vanishX = WIDTH / 2, offset = 0 }) => {
  const vy = groundY - 900; // vanishing point far above the horizon
  const bottom = HEIGHT + 600;
  const n = 26;
  const span = WIDTH * 5;
  const wedges = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) continue;
    const x0 = vanishX - span / 2 + (span * i) / n + offset;
    const x1 = vanishX - span / 2 + (span * (i + 1)) / n + offset;
    // Intersect the lines from the vanishing point with the ground line.
    const t = (groundY - vy) / (bottom - vy);
    const g0 = vanishX + (x0 - vanishX) * t;
    const g1 = vanishX + (x1 - vanishX) * t;
    wedges.push(<path key={i} d={`M${g0},${groundY} L${g1},${groundY} L${x1},${bottom} L${x0},${bottom} Z`} fill={PITCH.grass} />);
  }
  return (
    <g>
      <rect x={-WIDTH} y={groundY} width={WIDTH * 3} height={bottom - groundY} fill={PITCH.grassDark} />
      {wedges}
      <line x1={-WIDTH * 4} y1={groundY} x2={WIDTH * 5} y2={groundY} stroke={PITCH.grassLight} strokeWidth={8} vectorEffect="non-scaling-stroke" />
    </g>
  );
};

/**
 * Top-down pitch around one goal. The goal line is at x = goalX metres, centred on y = 0.
 * Works with "top" and "topUp" views.
 */
export const PitchTop: React.FC<{ view: View; goalX: number; chalkOpacity?: number }> = ({ view, goalX, chalkOpacity = 0.9 }) => {
  const P = (x: number, y: number) => project({ x, y, z: 0 }, view);
  const poly = (pts: [number, number][]) =>
    pts.map(([x, y], i) => `${i ? "L" : "M"}${P(x, y).x.toFixed(1)},${P(x, y).y.toFixed(1)}`).join(" ");
  const stripes = [];
  for (let s = -8; s < 8; s++) {
    const x0 = goalX - 60 + s * 0 + (s + 8) * 5;
    stripes.push(
      <path key={s} d={`${poly([[x0, -40], [x0 + 5, -40], [x0 + 5, 40], [x0, 40]])} Z`} fill={s % 2 ? PITCH.grass : PITCH.grassDark} />,
    );
  }
  const box = poly([[goalX, -20.16], [goalX - 16.5, -20.16], [goalX - 16.5, 20.16], [goalX, 20.16]]);
  const six = poly([[goalX, -9.16], [goalX - 5.5, -9.16], [goalX - 5.5, 9.16], [goalX, 9.16]]);
  const spot = P(goalX - 11, 0);
  // Penalty arc: the part of the 9.15 m circle around the spot outside the box.
  const arcPts: [number, number][] = [];
  for (let a = -53; a <= 53; a += 4) {
    const t = (a * Math.PI) / 180;
    arcPts.push([goalX - 11 - 9.15 * Math.cos(t), 9.15 * Math.sin(t)]);
  }
  const lw = Math.max(3, view.kind === "persp" ? 3 : view.ppm * 0.12);
  return (
    <g>
      {stripes}
      <g fill="none" stroke={PITCH.chalk} strokeWidth={lw} strokeLinejoin="round" strokeLinecap="round" opacity={chalkOpacity}>
        <path d={poly([[goalX, -40], [goalX, 40]])} />
        <path d={box} />
        <path d={six} />
        <path d={poly(arcPts)} />
      </g>
      <circle cx={spot.x} cy={spot.y} r={lw * 1.4} fill={PITCH.chalk} opacity={chalkOpacity} />
    </g>
  );
};

/** A gentle idle sway for background elements. */
export const useSway = (seed: number, amp = 3) => {
  const frame = useCurrentFrame();
  return idle(frame, seed, 4, amp);
};

/** A puff of chalk dust: small circles that spread and fade. */
export const Dust: React.FC<{ x: number; y: number; at: number; size?: number; seed?: string; color?: string }> = ({
  x,
  y,
  at,
  size = 40,
  seed = "dust",
  color = PITCH.chalk,
}) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / 24;
  if (t < 0 || t > 1) return null;
  return (
    <g>
      {Array.from({ length: 10 }, (_, i) => {
        const a = random(`${seed}-a-${i}`) * Math.PI - Math.PI;
        const d = size * (0.4 + random(`${seed}-d-${i}`)) * (0.3 + t);
        const r = size * 0.18 * (0.6 + random(`${seed}-r-${i}`)) * (1 - t * 0.5);
        return <circle key={i} cx={x + Math.cos(a) * d} cy={y + Math.sin(a) * d * 0.6} r={r} fill={color} opacity={(1 - t) * 0.7} />;
      })}
    </g>
  );
};

/** A low chain-link fence and a dark car park, seen side-on. `x0` = fence position in pixels. */
export const CarPark: React.FC<{ x0: number; groundY: number; ppm: number }> = ({ x0, groundY, ppm }) => {
  const fenceH = 1.4 * ppm;
  const car = (cx: number, color: string, key: number) => (
    <g key={key} transform={`translate(${cx} ${groundY})`}>
      <rect x={-2.1 * ppm} y={-1.05 * ppm} width={4.2 * ppm} height={0.75 * ppm} rx={0.3 * ppm} fill={color} />
      <rect x={-1.2 * ppm} y={-1.55 * ppm} width={2.3 * ppm} height={0.65 * ppm} rx={0.28 * ppm} fill={color} />
      <rect x={-1.0 * ppm} y={-1.45 * ppm} width={0.9 * ppm} height={0.42 * ppm} rx={0.1 * ppm} fill="#3A4C8F" />
      <rect x={0.05 * ppm} y={-1.45 * ppm} width={0.85 * ppm} height={0.42 * ppm} rx={0.1 * ppm} fill="#3A4C8F" />
      <circle cx={-1.3 * ppm} cy={-0.3 * ppm} r={0.32 * ppm} fill="#0E1230" />
      <circle cx={1.3 * ppm} cy={-0.3 * ppm} r={0.32 * ppm} fill="#0E1230" />
    </g>
  );
  return (
    <g>
      <rect x={x0 + 2 * ppm} y={groundY - 2} width={20 * ppm} height={30} fill="#1B2150" />
      {car(x0 + 7 * ppm, "#2E3874", 1)}
      {car(x0 + 12 * ppm, "#3A2E6E", 2)}
      {car(x0 + 17 * ppm, "#2B4270", 3)}
      <g opacity={0.9}>
        <rect x={x0} y={groundY - fenceH} width={8} height={fenceH} rx={4} fill={PITCH.standsLight} />
        <rect x={x0} y={groundY - fenceH} width={14 * ppm} height={6} rx={3} fill={PITCH.standsLight} />
        {Array.from({ length: 28 }, (_, i) => (
          <line key={i} x1={x0 + i * 0.5 * ppm} y1={groundY - fenceH} x2={x0 + i * 0.5 * ppm} y2={groundY} stroke={PITCH.standsLight} strokeWidth={2} opacity={0.45} />
        ))}
      </g>
    </g>
  );
};
