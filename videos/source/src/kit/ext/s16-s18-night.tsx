// Night pieces for s18: the concrete wall with the knee-height tape, a side-view night backdrop,
// a behind-the-kicker perspective stadium, and a general "put the laces on the ball" placement.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { HEIGHT, PITCH, WIDTH } from "../../theme";
import { Floodlight, Glow, Sky, Stands, Stars } from "../World";
import { Plate, STADIUM_GROUND_Y, STADIUM_LAMPS } from "../Plate";
import { POSES, solve, type Pose } from "../Player";
import { EASE, idle, pop, progress } from "../../lib/anim";
import { project, type View } from "../../lib/project";
import type { Vec3 } from "../../physics/sim";

export type Kick = { pose: Pose; x: number; err: number };

/**
 * Place a side-view kicker so the laces touch a ball at `start` (metres) in a side view.
 * Searches the thigh lift (and optional torso / shin angles). Returns the pose and the hip screen x.
 */
export const placeKicker = (
  view: Extract<View, { kind: "side" }>,
  H: number,
  ballR: number,
  start: Vec3,
  base: Pose = POSES.volley,
  opts: { torso?: number[]; shin?: number[]; hips?: [number, number]; score?: (j: ReturnType<typeof solve>, hipX: number, ball: { x: number; y: number }) => number } = {},
): Kick => {
  const ball = project(start, view);
  const torsos = opts.torso ?? [base.torso];
  const shins = opts.shin ?? [-12];
  const [h0, h1] = opts.hips ?? [20, 110];
  let best: Kick | null = null;
  for (const torso of torsos) {
    for (const shin of shins) {
      for (let hip = h0; hip <= h1; hip += 1) {
        const pose: Pose = { ...base, torso, nearHip: hip, nearKnee: hip - shin };
        const j = solve(pose, H);
        const dy = view.groundY - j.lowest;
        const d = { x: j.nToe.x - j.na.x, y: j.nToe.y - j.na.y };
        const l = Math.hypot(d.x, d.y) || 1;
        const n = { x: d.y / l, y: -d.x / l };
        const lac = { x: j.na.x + d.x * 0.45, y: j.na.y + d.y * 0.45 + dy };
        const off = ballR + H * 0.04;
        const cy = lac.y + n.y * off;
        const hipX = ball.x - (lac.x + n.x * off);
        const err = Math.abs(cy - ball.y) * 4 + (opts.score ? opts.score(j, hipX, ball) : 0);
        if (!best || err < best.err) best = { pose, x: hipX, err };
      }
    }
  }
  return best!;
};

/** Side-view night backdrop pinned to the horizon: sky, stars, the stand and four floodlights. */
export const NightSideBack: React.FC<{ horizonY: number; shiftX?: number; scale?: number; seed?: string; id?: string; cx?: number }> = ({ horizonY, shiftX = 0, scale = 1, seed = "s18n", id = "s18sky", cx = WIDTH / 2 }) => (
  <g>
    <Sky id={id} />
    <Stars count={80} maxY={Math.max(120, horizonY - 320 * scale)} seed={seed} />
    <g transform={`translate(${cx} ${horizonY}) scale(${scale}) translate(${-WIDTH / 2 + shiftX} 0)`}>
      <Stands baseY={0} lit={1} />
      {[180, 720, 1220, 1760].map((x, i) => (
        <Floodlight key={i} x={x} baseY={-20} height={470} on={1} />
      ))}
    </g>
  </g>
);

/** The concrete wall under the stand, with the knee-height tape and ball marks. x = wall face (px). */
export const ConcreteWall: React.FC<{ x: number; groundY: number; ppm: number; tapeZ?: number; hits?: { z: number; at: number }[]; heightM?: number }> = ({
  x,
  groundY,
  ppm,
  tapeZ = 0.5,
  hits = [],
  heightM = 2.9,
}) => {
  const frame = useCurrentFrame();
  const top = groundY - heightM * ppm;
  const w = 900;
  const tapeY = groundY - tapeZ * ppm;
  const tapeH = Math.max(8, 0.06 * ppm);
  const blocks: React.ReactNode[] = [];
  const bh = 0.4 * ppm;
  for (let r = 0; r * bh < heightM * ppm; r++) {
    const y = groundY - (r + 1) * bh;
    blocks.push(<line key={`r${r}`} x1={x} y1={y} x2={x + w} y2={y} />);
    const off = r % 2 ? 0.45 * ppm : 0;
    for (let c = 0; c < 6; c++) {
      const bx = x + off + c * 0.9 * ppm;
      if (bx > x + 4) blocks.push(<line key={`c${r}-${c}`} x1={bx} y1={y} x2={bx} y2={y + bh} />);
    }
  }
  // Old marks from earlier sessions (all under the tape).
  const old = Array.from({ length: 7 }, (_, i) => ({ dx: 20 + random(`wall-x-${i}`) * 90, z: 0.12 + random(`wall-z-${i}`) * 0.3, r: 0.06 + random(`wall-r-${i}`) * 0.04 }));
  return (
    <g>
      <rect x={x} y={top} width={w} height={groundY - top + 6} fill={PITCH.standsLight} />
      <rect x={x} y={top} width={0.1 * ppm} height={groundY - top + 6} fill="#3A4585" />
      <g stroke="#252C66" strokeWidth={3}>{blocks}</g>
      <rect x={x - 6} y={top - 0.12 * ppm} width={w + 12} height={0.14 * ppm} rx={0.05 * ppm} fill="#3A4585" />
      {old.map((m, i) => (
        <circle key={i} cx={x + m.dx} cy={groundY - m.z * ppm} r={m.r * ppm} fill={PITCH.chalk} opacity={0.12} />
      ))}
      {hits.map((h, i) => {
        const s = pop(frame, h.at, { stiffness: 260, damping: 16 });
        if (s <= 0.001) return null;
        const fade = 0.55 - 0.3 * progress(frame, h.at + 10, 30);
        return <ellipse key={`h${i}`} cx={x + 6} cy={groundY - h.z * ppm} rx={0.05 * ppm * s} ry={0.11 * ppm * s} fill={PITCH.chalk} opacity={fade} />;
      })}
      {/* The tape, with a soft glow so it reads at night. */}
      <rect x={x - 4} y={tapeY - tapeH / 2 - 6} width={w} height={tapeH + 12} fill={PITCH.light} opacity={0.18} />
      <rect x={x - 4} y={tapeY - tapeH / 2} width={w} height={tapeH} rx={tapeH / 2} fill={PITCH.light} />
    </g>
  );
};

/** Chalk footprint mark with a step number. */
export const StepMark: React.FC<{ x: number; y: number; n: number; at: number; until: number; size?: number }> = ({ x, y, n, at, until, size = 44 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 240, damping: 15 }) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={size * 0.7} ry={size * 0.16} fill={PITCH.chalk} opacity={0.75} />
      <circle cx={0} cy={-size * 1.05} r={size * 0.62} fill={PITCH.chalk} />
      <text x={0} y={-size * 0.83} fill={PITCH.sky} fontFamily="Rubik, sans-serif" fontWeight={800} fontSize={size * 0.72} textAnchor="middle">
        {n}
      </text>
    </g>
  );
};

/** Behind-the-kicker perspective stadium: the stadium plate with lamps on, persp grass bands and chalk lines. */
export const PerspStadium: React.FC<{ view: Extract<View, { kind: "persp" }>; goalX: number; standX: number }> = ({ view, goalX, standX }) => {
  const frame = useCurrentFrame();
  const P = (x: number, y: number, z = 0) => project({ x, y, z }, view);
  const standY = P(standX, 0).y;
  const plateDy = standY - STADIUM_GROUND_Y;
  // Grass bands parallel to the goal line (horizontal on screen).
  const bands: React.ReactNode[] = [];
  const edges: number[] = [];
  for (let x = view.cam.x + 1.2; x < standX; x += 0) {
    edges.push(x);
    x += Math.max(1.5, (x - view.cam.x) * 0.35);
  }
  edges.push(standX);
  for (let i = 0; i < edges.length - 1; i++) {
    const y0 = P(edges[i + 1], 0).y;
    const y1 = i === 0 ? HEIGHT + 10 : P(edges[i], 0).y;
    bands.push(<rect key={i} x={-10} y={y0} width={WIDTH + 20} height={Math.max(0, y1 - y0)} fill={i % 2 ? PITCH.grass : PITCH.grassDark} />);
  }
  const line = (pts: [number, number][], key: string) => (
    <path key={key} d={pts.map(([x, y], i) => `${i ? "L" : "M"}${P(x, y).x.toFixed(1)},${P(x, y).y.toFixed(1)}`).join(" ")} fill="none" stroke={PITCH.chalk} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
  );
  const spot = P(goalX - 11, 0);
  return (
    <g>
      <g transform={`translate(0 ${plateDy})`}>
        <Plate name="stadium-off" />
        {STADIUM_LAMPS.map((l, i) => (
          <g key={i}>
            <rect x={l.x - 70} y={l.y - 46} width={140} height={92} rx={22} fill={PITCH.lightSoft} />
            <Glow cx={l.x} cy={l.y} r={175 + idle(frame, i, 3, 4)} color={PITCH.lightSoft} intensity={1.1} rings={4} />
          </g>
        ))}
      </g>
      <rect x={-10} y={standY - 4} width={WIDTH + 20} height={10} fill={PITCH.grassLight} />
      {bands}
      {line([[goalX, -30], [goalX, 30]], "goal")}
      {line([[goalX, 9.16], [goalX - 5.5, 9.16], [goalX - 5.5, -9.16], [goalX, -9.16]], "six")}
      {line([[goalX, 20.16], [goalX - 16.5, 20.16], [goalX - 16.5, -20.16], [goalX, -20.16]], "box")}
      <ellipse cx={spot.x} cy={spot.y} rx={spot.scale * 0.14} ry={spot.scale * 0.05} fill={PITCH.chalk} opacity={0.8} />
    </g>
  );
};
