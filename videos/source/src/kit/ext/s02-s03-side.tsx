// Side-view pitch for s02-s03 (same world as s01: 50 px per metre, kick spot at x = 400,
// ground at y = 820, goal line at 18 m) and a solver that puts Tavi's boot on the ball.

import React from "react";
import { HEIGHT, WIDTH } from "../../theme";
import { EASE, keys } from "../../lib/anim";
import type { View } from "../../lib/project";
import { CarPark, Floodlight, GroundSide, Sky, Stands, Stars } from "../World";
import { GoalSide } from "../Goal";
import { solve, type Pose } from "../Player";

export const PPM = 50;
export const OX = 400;
export const GROUND = 820;
export const GOAL_M = 18;
export const X = (m: number) => OX + m * PPM;
export const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
export const TAVI_H = 1.62 * PPM;
export const BALL_R = 0.11 * PPM;

export type SideCam = { x: number; y: number; zoom: number };
export type SideKey = SideCam & { f: number };

/** Camera between keys, zoom eased in log space (even zoom-throughs). */
export const sideCamAt = (frame: number, ks: SideKey[], ease = EASE.camera): SideCam => {
  if (ks.length === 1) return ks[0];
  const fs = ks.map((k) => k.f);
  return {
    x: keys(frame, fs, ks.map((k) => k.x), ease),
    y: keys(frame, fs, ks.map((k) => k.y), ease),
    zoom: Math.exp(keys(frame, fs, ks.map((k) => Math.log(k.zoom)), ease)),
  };
};

/** Far background pinned to the horizon plus the ground, goal and car park; children draw in world pixels. */
export const SideWorld: React.FC<{ cam: SideCam; seed: string; children: React.ReactNode; lamps?: number }> = ({ cam, seed, children, lamps = 1 }) => {
  const hY = HEIGHT / 2 + (GROUND - cam.y) * cam.zoom;
  const bgScale = 1 + (cam.zoom - 1) * 0.05;
  return (
    <g>
      <Sky id={`sky-${seed}`} />
      <Stars count={90} maxY={Math.max(120, hY - 300)} seed={seed} />
      <g transform={`translate(${WIDTH / 2} ${hY}) scale(${bgScale}) translate(${-WIDTH / 2 - (cam.x - X(4)) * 0.04} ${-GROUND})`}>
        <Stands baseY={GROUND} lit={lamps} />
        {[180, 720, 1220, 1760].map((x, i) => (
          <Floodlight key={i} x={x} baseY={GROUND - 20} height={470} on={lamps} />
        ))}
      </g>
      <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`}>
        <GroundSide groundY={GROUND} vanishX={X(8)} />
        <CarPark x0={X(GOAL_M + 3)} groundY={GROUND} ppm={PPM} />
        <GoalSide view={SIDE} goalX={GOAL_M} />
        {children}
      </g>
    </g>
  );
};

/** World pixels -> screen pixels for a side camera. */
export const toScreen = (p: { x: number; y: number }, cam: SideCam) => ({
  x: WIDTH / 2 + (p.x - cam.x) * cam.zoom,
  y: HEIGHT / 2 + (p.y - cam.y) * cam.zoom,
});

/**
 * Hip x for Tavi so that the front (laces side) of the near boot touches a ball
 * whose centre is at (ballX, ballY) world pixels. Returns the hip x and the contact point.
 */
export const hipForContact = (pose: Pose, ballX: number, ballY: number, H = TAVI_H, groundY = GROUND, r = BALL_R) => {
  const j = solve(pose, H);
  const dy = groundY - j.lowest - (pose.lift ?? 0) * H;
  const ax = j.na.x;
  const ay = j.na.y + dy;
  const tx = j.nToe.x - j.na.x;
  const ty = j.nToe.y - j.na.y;
  const L = Math.hypot(tx, ty) || 1;
  const n = { x: -ty / L, y: tx / L }; // sole side; laces side is -n
  const rh = 0.047 * H;
  const rt = 0.03 * H;
  // Centre y of a touching ball, linear in t: y(t) = ay + t*ty - n.y*(rh + (rt - rh)*t + r)
  const y0 = ay - n.y * (rh + r);
  const y1 = ty - n.y * (rt - rh);
  let t = Math.abs(y1) > 1e-6 ? (ballY - y0) / y1 : 0.5;
  t = Math.min(1, Math.max(0.15, t));
  const th = rh + (rt - rh) * t;
  const cx = ax + t * tx - n.x * (th + r);
  const contact = { x: ax + t * tx - n.x * th, y: ay + t * ty - n.y * th };
  return { hipX: ballX - cx, contact: { x: contact.x + ballX - cx, y: contact.y }, t };
};

/** Laces-side surface point of the near boot at fraction t from ankle to toe (world pixels). */
export const lacesAt = (pose: Pose, hipX: number, t: number, H = TAVI_H, groundY = GROUND) => {
  const j = solve(pose, H);
  const dy = groundY - j.lowest - (pose.lift ?? 0) * H;
  const tx = j.nToe.x - j.na.x;
  const ty = j.nToe.y - j.na.y;
  const L = Math.hypot(tx, ty) || 1;
  const n = { x: -ty / L, y: tx / L };
  const th = 0.047 * H + (0.03 * H - 0.047 * H) * t;
  return { x: hipX + j.na.x + t * tx - n.x * th, y: j.na.y + dy + t * ty - n.y * th, normal: { x: -n.x, y: -n.y } };
};

/**
 * Audio sync fix. The word timing puts the first word after a pause too early (at the start of the pause),
 * by up to about 20 frames. `snapCue` returns the audible onset measured from the voice file, but only while
 * the cue is still near it (same audio); otherwise it falls back to the cue.
 */
export const snapCue = (cueFrame: number, measured: number, tol = 24) => (Math.abs(measured - cueFrame) <= tol ? measured : cueFrame);
