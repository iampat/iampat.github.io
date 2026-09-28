// Open Sky side view shared by s16 and s17 (same world, so s17 opens on the s16 launch spot).
// Palette: SKY (gradient #1A4FA3 -> #4A93E6 -> #9FD8F5, clouds #F4FBFF / #C7E3F5, ink #1B2A6B).

import React from "react";
import { useCurrentFrame } from "remotion";
import { HEIGHT, SKY, WIDTH } from "../../theme";
import { Glow, GroundSide } from "../World";
import { GoalSide } from "../Goal";
import { POSES, solve, type Pose } from "../Player";
import { project, type View } from "../../lib/project";
import type { Vec3 } from "../../physics/sim";

export const SKY_PPM = 60;
export const SKY_OX = 300;
export const SKY_GROUND = 860;
export const SKY_GOAL_M = 16;
export const SKY_VIEW: View = { kind: "side", originX: SKY_OX, groundY: SKY_GROUND, ppm: SKY_PPM };
export const SX = (m: number) => SKY_OX + m * SKY_PPM;
export const SZ = (m: number) => SKY_GROUND - m * SKY_PPM;
/** Car park: fence just behind the goal, cars placed so the ghost lands between the first two. */
export const SKY_FENCE_M = 18.6;
export const SKY_CARS_M = [20.9, 26.0, 31.1];

type Cam = { x: number; y: number; zoom: number };

const Cloud: React.FC<{ x: number; y: number; s: number; o?: number }> = ({ x, y, s, o = 1 }) => {
  const shape = (fill: string, dy: number) => (
    <g fill={fill} transform={`translate(0 ${dy})`}>
      <rect x={-170} y={-44} width={340} height={88} rx={44} />
      <circle cx={-70} cy={-54} r={66} />
      <circle cx={30} cy={-78} r={88} />
      <circle cx={118} cy={-34} r={54} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
      {shape(SKY.cloudShade, 12)}
      {shape(SKY.cloud, 0)}
    </g>
  );
};

const CLOUDS = [
  { x: 180, h: 560, s: 0.9, d: 0.08 },
  { x: 760, h: 700, s: 0.6, d: 0.05 },
  { x: 1240, h: 470, s: 1.1, d: 0.12 },
  { x: 1780, h: 640, s: 0.75, d: 0.07 },
  { x: 2300, h: 520, s: 0.95, d: 0.1 },
  { x: -300, h: 760, s: 0.7, d: 0.06 },
];

/** Screen-space sky: gradient pinned to the horizon, sun, drifting clouds and far hills. */
export const SkyBackdrop: React.FC<{ cam: Cam; id?: string }> = ({ cam, id = "s16sky" }) => {
  const frame = useCurrentFrame();
  const horizonY = HEIGHT / 2 + (SKY_GROUND - cam.y) * cam.zoom;
  const pz = 0.55 + 0.45 * Math.min(2, cam.zoom) * 0.5;
  return (
    <g>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={horizonY - 1500} x2="0" y2={horizonY}>
          <stop offset="0" stopColor={SKY.top} />
          <stop offset="0.55" stopColor={SKY.mid} />
          <stop offset="1" stopColor={SKY.horizon} />
        </linearGradient>
      </defs>
      <rect x={-20} y={-20} width={WIDTH + 40} height={HEIGHT + 40} fill={`url(#${id})`} />
      {/* Sun. */}
      <g transform={`translate(${1660 - (cam.x - 960) * 0.02} ${190 + (horizonY - 800) * 0.04})`}>
        <Glow cx={0} cy={0} r={260} color={SKY.sun} intensity={1.3} rings={5} />
        <circle r={78} fill={SKY.sunSoft} />
      </g>
      {/* Clouds drift slowly and sit on the horizon with a little parallax. */}
      {CLOUDS.map((c, i) => {
        const x = ((c.x - (cam.x - 960) * c.d + frame * (0.25 + c.d) + 400) % (WIDTH + 800)) - 400;
        const y = horizonY - c.h * pz;
        return <Cloud key={i} x={x} y={y} s={c.s * (0.8 + 0.2 * cam.zoom)} o={0.95} />;
      })}
      {/* Far hills on the horizon. */}
      <g transform={`translate(${-(cam.x - 960) * 0.05} ${horizonY})`} fill={SKY.cloudShade} opacity={0.75}>
        {Array.from({ length: 9 }, (_, i) => (
          <ellipse key={i} cx={-400 + i * 360} cy={10} rx={260 + (i % 3) * 60} ry={70 + (i % 2) * 30} />
        ))}
      </g>
    </g>
  );
};

/** Car park behind the goal, in the sky palette, with hazard lights that blink from `hazardAt`. */
export const SkyCarPark: React.FC<{ hazardAt?: number }> = ({ hazardAt }) => {
  const frame = useCurrentFrame();
  const ppm = SKY_PPM;
  const g = SKY_GROUND;
  const blink = hazardAt !== undefined && frame >= hazardAt ? Math.max(0, Math.min(1, Math.sin(((frame - hazardAt) / 9) * Math.PI) * 3 + 0.5)) : 0;
  const car = (m: number, key: number) => {
    const cx = SX(m);
    return (
      <g key={key} transform={`translate(${cx} ${g})`}>
        <rect x={-2.1 * ppm} y={-1.05 * ppm} width={4.2 * ppm} height={0.75 * ppm} rx={0.3 * ppm} fill={SKY.deep} />
        <rect x={-1.2 * ppm} y={-1.55 * ppm} width={2.3 * ppm} height={0.65 * ppm} rx={0.28 * ppm} fill={SKY.deep} />
        <rect x={-1.0 * ppm} y={-1.45 * ppm} width={0.9 * ppm} height={0.42 * ppm} rx={0.1 * ppm} fill={SKY.horizon} opacity={0.8} />
        <rect x={0.05 * ppm} y={-1.45 * ppm} width={0.85 * ppm} height={0.42 * ppm} rx={0.1 * ppm} fill={SKY.horizon} opacity={0.8} />
        <circle cx={-1.3 * ppm} cy={-0.3 * ppm} r={0.32 * ppm} fill="#0E1230" />
        <circle cx={1.3 * ppm} cy={-0.3 * ppm} r={0.32 * ppm} fill="#0E1230" />
        {[-2.05, 1.85].map((lx, i) => (
          <g key={i}>
            <rect x={lx * ppm} y={-0.95 * ppm} width={0.22 * ppm} height={0.22 * ppm} rx={0.08 * ppm} fill={blink > 0.5 ? SKY.sun : SKY.accent} />
            {blink > 0.01 ? <Glow cx={(lx + 0.11) * ppm} cy={-0.84 * ppm} r={0.9 * ppm} color={SKY.sun} intensity={blink * 1.6} rings={3} /> : null}
          </g>
        ))}
      </g>
    );
  };
  const fx = SX(SKY_FENCE_M);
  const fenceH = 1.4 * ppm;
  return (
    <g>
      {SKY_CARS_M.map((m, i) => car(m, i))}
      <g opacity={0.85}>
        <rect x={fx} y={g - fenceH} width={8} height={fenceH} rx={4} fill={SKY.deep} />
        <rect x={fx} y={g - fenceH} width={16 * ppm} height={6} rx={3} fill={SKY.deep} />
        {Array.from({ length: 32 }, (_, i) => (
          <line key={i} x1={fx + i * 0.5 * ppm} y1={g - fenceH} x2={fx + i * 0.5 * ppm} y2={g} stroke={SKY.deep} strokeWidth={2} opacity={0.4} />
        ))}
      </g>
    </g>
  );
};

/** The world layer of the sky view: grass, goal and car park (draw inside the camera transform). */
export const SkyWorld: React.FC<{ hazardAt?: number; netOpacity?: number }> = ({ hazardAt, netOpacity = 0.45 }) => (
  <g>
    <GroundSide groundY={SKY_GROUND} vanishX={SX(8)} />
    <SkyCarPark hazardAt={hazardAt} />
    <GoalSide view={SKY_VIEW} goalX={SKY_GOAL_M} netOpacity={netOpacity} />
  </g>
);

export const worldTransform = (cam: Cam) => `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;

/** Screen position of a world pixel point under a camera. */
export const toScreen = (cam: Cam, p: { x: number; y: number }) => ({ x: WIDTH / 2 + (p.x - cam.x) * cam.zoom, y: HEIGHT / 2 + (p.y - cam.y) * cam.zoom });


/** Tavi's height and the drawn ball radius in the sky world (about 1.4x true size, so the Line reads). */
export const SKY_TAVI_H = 1.62 * SKY_PPM;
export const SKY_BALL_R = 9;

export type Placement = { pose: Pose; x: number; err: number };

/**
 * Place Tavi so his laces touch a ball at `start` (world metres): search the thigh lift (and optional
 * torso lean / shin angle) until the laces sit at the ball's height, then shift him along x.
 * `score` adds extra terms (for example "knee over the ball").
 */
export const placeForBall = (
  start: Vec3,
  base: Pose = POSES.volley,
  opts: { torso?: number[]; shin?: number[]; score?: (j: ReturnType<typeof solve>, hipX: number, ball: { x: number; y: number }, dy: number) => number } = {},
): Placement => {
  const H = SKY_TAVI_H;
  const ball = project(start, SKY_VIEW);
  const torsos = opts.torso ?? [base.torso];
  const shins = opts.shin ?? [-12];
  let best: Placement | null = null;
  for (const torso of torsos) {
    for (const shin of shins) {
      for (let hip = 40; hip <= 110; hip += 1) {
        const pose: Pose = { ...base, torso, nearHip: hip, nearKnee: hip - shin };
        const j = solve(pose, H);
        const dy = SKY_GROUND - j.lowest;
        const d = { x: j.nToe.x - j.na.x, y: j.nToe.y - j.na.y };
        const l = Math.hypot(d.x, d.y) || 1;
        const n = { x: d.y / l, y: -d.x / l };
        const lac = { x: j.na.x + d.x * 0.45, y: j.na.y + d.y * 0.45 + dy };
        const off = SKY_BALL_R + H * 0.04;
        const cy = lac.y + n.y * off;
        const hipX = ball.x - (lac.x + n.x * off);
        const err = Math.abs(cy - ball.y) * 4 + (opts.score ? opts.score(j, hipX, ball, dy) : 0);
        if (!best || err < best.err) best = { pose, x: hipX, err };
      }
    }
  }
  return best!;
};
