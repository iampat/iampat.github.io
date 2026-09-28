// Shared world for b09 and b10: the episode 2 side-view pitch (Sam behind Tavi at x = -12, the goal on the
// right, 50 px per metre) and the x-ray close-up framing that b09 pushes into and b10 opens on. Tavi faces
// LEFT (flip on) all through the touch chapter, so the near leg is drawn with a mirrored XRayLeg.

import React from "react";
import { HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { EASE, keys } from "../../lib/anim";
import type { View } from "../../lib/project";
import { Floodlight, Glow, GroundSide, Sky, Stands, Stars } from "../World";
import { GoalSide } from "../Goal";
import { Player, POSES, solve, type Face, type Pose } from "../Player";
import { XRayLeg, type LegPart } from "../XRay";

// ---------- Side world (world pixels) ----------
export const PPM = 50;
/** World x of Tavi's mark (pitch x = 0). */
export const OX = 1000;
export const GROUND = 820;
export const GOAL_M = 18;
export const SAM_M = -12;
/** Sam's hips sit a stride behind the ball so his inside-foot pass meets it at x = -12. */
export const SAM_HIP_M = -12.3;
export const X = (m: number) => OX + m * PPM;
export const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
export const TAVI_H = 1.62 * PPM;
export const BALL_R = 0.11 * PPM;
/** Inside-foot receive: the boot is turned out (arch towards the ball), so the drawn foot is foreshortened. */
export const FOOT_TURN = 0.75;
/** The frozen pass in b09: one metre before Tavi's foot (metres from her mark). */
export const FREEZE_M = -1.2;

export type SideCam = { x: number; y: number; zoom: number };
export type SideKey = SideCam & { f: number };

export const toScreen = (p: { x: number; y: number }, cam: SideCam) => ({ x: WIDTH / 2 + (p.x - cam.x) * cam.zoom, y: HEIGHT / 2 + (p.y - cam.y) * cam.zoom });
/** Camera that puts world point `w` at screen point `s` with the given zoom. */
export const camFor = (w: { x: number; y: number }, s: { x: number; y: number }, zoom: number): SideCam => ({
  x: w.x - (s.x - WIDTH / 2) / zoom,
  y: w.y - (s.y - HEIGHT / 2) / zoom,
  zoom,
});
/** Camera between keys, zoom eased in log space (even zoom-throughs), easeInOutSine like the kit Camera. */
export const sideCamAt = (frame: number, ks: SideKey[]): SideCam => {
  if (ks.length === 1) return ks[0];
  const fs = ks.map((k) => k.f);
  return {
    x: keys(frame, fs, ks.map((k) => k.x), EASE.camera),
    y: keys(frame, fs, ks.map((k) => k.y), EASE.camera),
    zoom: Math.exp(keys(frame, fs, ks.map((k) => Math.log(k.zoom)), EASE.camera)),
  };
};
export const worldTransform = (cam: SideCam) => `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;

/** Floodlight towers in layer pixels. The fourth one sits right of Tavi's head in the close shots, not behind it. */
const TOWERS = [-500, 100, 700, 1560, 2100, 2700];
const REF_X = X(-4);

/** Night sky, stands and floodlights pinned to the horizon, then the pitch, goal and children in world pixels. */
export const SideWorld: React.FC<{ cam: SideCam; seed: string; children: React.ReactNode; lamps?: number }> = ({ cam, seed, children, lamps = 1 }) => {
  const horizonY = HEIGHT / 2 + (GROUND - cam.y) * cam.zoom;
  const layerT = (pan: number, grow: number) => `translate(${WIDTH / 2} ${horizonY}) scale(${1 + (cam.zoom - 1) * grow}) translate(${-WIDTH / 2 - (cam.x - REF_X) * pan} ${-GROUND})`;
  return (
    <g>
      <Sky id={`sky-${seed}`} />
      <Stars count={90} maxY={Math.max(120, horizonY - 300)} seed={seed} />
      <g transform={layerT(0.2, 0.05)}>
        <g transform={`translate(${WIDTH / 2} 0) scale(2.2 1) translate(${-WIDTH / 2} 0)`}>
          <Stands baseY={GROUND} lit={lamps} />
        </g>
        {TOWERS.map((x) => (
          <Floodlight key={x} x={x} baseY={GROUND - 20} height={470} on={lamps} beam flip={x > 1000} />
        ))}
      </g>
      <g transform={worldTransform(cam)}>
        <GroundSide groundY={GROUND} vanishX={X(2)} />
        <GoalSide view={SIDE} goalX={GOAL_M} />
        {children}
      </g>
    </g>
  );
};

// ---------- Tavi's near leg, facing left ----------
/** Hip y (screen or world px) for a pose whose feet rest on `groundY`. */
export const hipYFor = (pose: Pose, groundY: number, h: number) => groundY - solve(pose, h, FOOT_TURN).lowest - (pose.lift ?? 0) * h;

/** Joints of the near leg for a left-facing (flipped) player with the hip at (hx, hy). */
export const flippedLeg = (pose: Pose, hx: number, hy: number, h: number) => {
  const j = solve(pose, h, FOOT_TURN);
  const T = (p: { x: number; y: number }) => ({ x: hx - p.x, y: hy + p.y });
  return { hip: { x: hx, y: hy }, knee: T(j.nk), ankle: T(j.na), toe: T(j.nToe), farToe: T(j.fToe) };
};

/** Ball centre x when a ball rolling to the right touches the front of the near boot. */
export const contactBallX = (toeX: number, h: number, r: number) => toeX - r - 0.03 * h - 2;

/** XRayLeg mirrored around the hip, for a player facing left. */
export const XRayLegFlipped: React.FC<{ x: number; y: number; h: number; pose: Pose; highlight?: LegPart[]; highlightAmount?: number }> = ({ x, y, h, pose, highlight, highlightAmount }) => (
  <g transform={`translate(${x} 0) scale(-1 1) translate(${-x} 0)`}>
    <XRayLeg x={x} y={y} h={h} pose={pose} highlight={highlight} highlightAmount={highlightAmount} footTurn={FOOT_TURN} />
  </g>
);

// ---------- The x-ray close-up (b10 framing; b09 pushes into it) ----------
export const H10 = 820;
export const PPM10 = H10 / 1.62;
export const HIP10_X = 1040;
export const GROUND10 = 848;
export const BALL_R10 = 0.11 * PPM10;
/** Slow motion of the touch demos. */
export const SLOW10 = 1 / 8;
/** Screen px per m/s for the arrows drawn on the ball and the foot. */
export const PX_PER_MS = 48;
/** The b09 side camera that lands Tavi exactly on the b10 x-ray framing. */
export const XRAY_CAM: SideCam = (() => {
  const zoom = H10 / TAVI_H;
  return { zoom, x: OX - (HIP10_X - WIDTH / 2) / zoom, y: GROUND - (GROUND10 - HEIGHT / 2) / zoom };
})();

export const STIFF: Pose = POSES.receiveStiff;
export const SOFT: Pose = POSES.receiveSoft;
/** The soft leg after it has given way: the foot has moved back with the ball from the knee and hip. */
export const GIVE: Pose = { ...POSES.receiveSoft, nearHip: 15, nearKnee: 26, torso: 12, head: 10 };

type XRayTaviProps = {
  pose: Pose;
  hipX?: number;
  groundY?: number;
  h?: number;
  face?: Face;
  /** Bones to glow pink (the locked leg). */
  highlight?: LegPart[];
  highlightAmount?: number;
  /** Soft teal glow on the hip and knee (the giving leg). */
  teal?: number;
  opacity?: number;
  bodyOpacity?: number;
};

/** Tavi as an x-ray: the ghost body, the mirrored near leg with its bones, and the joint glows. */
export const XRayTavi: React.FC<XRayTaviProps> = ({ pose, hipX = HIP10_X, groundY = GROUND10, h = H10, face = "focus", highlight = [], highlightAmount = 1, teal = 0, opacity = 1, bodyOpacity = 0.62 }) => {
  const hy = hipYFor(pose, groundY, h);
  const L = flippedLeg(pose, hipX, hy, h);
  const pink = highlight.length > 0 ? highlightAmount : 0;
  return (
    <g opacity={opacity}>
      <Player x={hipX} groundY={groundY} h={h} pose={pose} face={face} ghost flip footTurn={FOOT_TURN} opacity={bodyOpacity} />
      {pink > 0.001 ? (
        <g opacity={pink}>
          <Glow cx={L.hip.x} cy={L.hip.y} r={h * 0.1} color={XRAY.pink} intensity={1.1} rings={4} />
          <Glow cx={L.knee.x} cy={L.knee.y} r={h * 0.1} color={XRAY.pink} intensity={1.3} rings={4} />
        </g>
      ) : null}
      {teal > 0.001 ? (
        <g opacity={teal}>
          <line x1={L.hip.x} y1={L.hip.y} x2={L.knee.x} y2={L.knee.y} stroke={PITCH.teal} strokeWidth={h * 0.08} strokeLinecap="round" opacity={0.28} />
          <line x1={L.knee.x} y1={L.knee.y} x2={L.ankle.x} y2={L.ankle.y} stroke={PITCH.teal} strokeWidth={h * 0.065} strokeLinecap="round" opacity={0.22} />
          <Glow cx={L.hip.x} cy={L.hip.y} r={h * 0.11} color={PITCH.teal} intensity={1.2} rings={4} />
          <Glow cx={L.knee.x} cy={L.knee.y} r={h * 0.11} color={PITCH.teal} intensity={1.4} rings={4} />
        </g>
      ) : null}
      <XRayLegFlipped x={hipX} y={hy} h={h} pose={pose} highlight={highlight} highlightAmount={highlightAmount} />
    </g>
  );
};

/** Ground line and half-metre ticks of the x-ray world (teal ink). */
export const XRayGround: React.FC<{ y?: number; fromX?: number; ppm?: number; opacity?: number }> = ({ y = GROUND10, fromX = 40, ppm = PPM10, opacity = 1 }) => (
  <g opacity={opacity}>
    <line x1={-200} y1={y} x2={WIDTH + 200} y2={y} stroke={XRAY.tissue} strokeWidth={5} opacity={0.55} />
    {Array.from({ length: 12 }, (_, i) => {
      const x = fromX + i * 0.5 * ppm;
      return <rect key={i} x={x - 3} y={y + 10} width={6} height={i % 2 ? 16 : 30} rx={3} fill={XRAY.tissue} opacity={0.6} />;
    })}
  </g>
);
