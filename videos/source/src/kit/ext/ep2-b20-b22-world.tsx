// Side-view night world and time helpers for the episode 2 ending scenes b20-b22.
// The world matches b19 (50 px per metre, ground at y = 820, Tavi's mark at x = 960) so the
// run of b19 continues into b20 without a cut. The floodlit backdrop is pinned to the horizon,
// as in s01 and b19, and its lamps can go out one by one for b22. Floodlit Pitch palette only.

import React from "react";
import { Sequence, random, useCurrentFrame } from "remotion";
import { HEIGHT, PITCH, WIDTH } from "../../theme";
import { clamp01, idle, lerp } from "../../lib/anim";
import type { View } from "../../lib/project";
import { CarPark, Floodlight, GroundSide, Sky, StandClock, Stands, Stars } from "../World";
import { GoalSide } from "../Goal";
import { KPOSES, type KeeperPose } from "../Keeper";
import { POSES, mixPose, solve, type Pose } from "../Player";

// ---------- Side-view geometry (the b19 handoff values) ----------

export const PPM = 50;
export const OX = 960;
export const GROUND = 820;
export const GOAL_M = 18;
export const X = (m: number) => OX + m * PPM;
export const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
export const TAVI_H = 1.62 * PPM;
export const CHALK_H = 2.1 * PPM;
export const BALL_R = 0.11 * PPM;
/** The stars of b19, so the sky does not change across the join. */
export const STAR_SEED = "b19";
/** A ball rolling towards +x turns about -y. */
export const ROLL_AXIS = { x: 0, y: -1, z: 0 };

export type Cam = { x: number; y: number; zoom: number };

export const camT = (c: Cam) => `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${c.zoom}) translate(${-c.x} ${-c.y})`;

export const toScreen = (c: Cam, x: number, y: number) => ({
  x: WIDTH / 2 + (x - c.x) * c.zoom,
  y: HEIGHT / 2 + (y - c.y) * c.zoom,
});

/** Depth in the side view: pitch y (metres, +y away from the viewer) lifts a thing a little and shrinks it. */
export const depthHint = (y: number) => ({ dy: -y * PPM * 0.22, scale: 1 - 0.05 * y });

// ---------- Backdrop ----------

/**
 * Tower x in far-layer pixels, as b19 (and b01) lay them out: layer x = 960 sits on the screen centre when
 * the camera is on `refX`. The whole far and mid layer below is the b19 backdrop, so b19 -> b20 has no pop.
 */
export const TOWERS = [-300, 240, 800, 1360, 1900, 2440];
const TOWER_H = 470;

/** Dust drifting down through the floodlight beams (far layer), as b19. Each tower's dust fades with its lamp. */
const BeamDust: React.FC<{ lamps: number[] }> = ({ lamps }) => {
  const frame = useCurrentFrame();
  const base = GROUND - 20;
  const topY = base - TOWER_H + 10;
  const botY = base + 60;
  return (
    <g>
      {TOWERS.map((x, i) => {
        if (lamps[i] <= 0.01) return null;
        const dir = x > 1000 ? -1 : 1;
        return Array.from({ length: 8 }, (_, k) => {
          const s = `b18d${i}-${k}`;
          const v = (random(`${s}v`) + frame * (0.0012 + random(`${s}s`) * 0.0012)) % 1;
          const left = lerp(x - 35, x + dir * 40, v);
          const right = lerp(x + 35, x + dir * 380, v);
          const cx = lerp(left, right, 0.15 + 0.7 * random(`${s}u`)) + Math.sin(frame / 37 + k) * 10;
          const tw = 0.6 + 0.4 * Math.sin(frame / 11 + random(`${s}p`) * 6.28);
          const fade = Math.sin(Math.PI * v);
          return <circle key={`${i}-${k}`} cx={cx} cy={topY + (botY - topY) * v} r={1.6 + random(`${s}r`) * 2.2} fill={PITCH.lightSoft} opacity={0.6 * tw * fade * lamps[i]} />;
        });
      })}
    </g>
  );
};

/** Low boards along the far touchline (mid layer), as b19. */
const Boards: React.FC = () => (
  <g>
    {Array.from({ length: 34 }, (_, i) => {
      const x = -2400 + i * 200;
      return (
        <g key={i}>
          <rect x={x} y={GROUND - 36} width={184} height={32} rx={8} fill={i % 2 ? PITCH.standsLight : PITCH.stands} />
          <rect x={x + 18} y={GROUND - 25} width={40 + 60 * random(`b18board-${i}`)} height={9} rx={4.5} fill={i % 3 === 0 ? PITCH.teal : PITCH.chalk} opacity={0.2} />
        </g>
      );
    })}
  </g>
);

const BackdropLayers: React.FC<{ cam: Cam; refX: number; seed: string; clockHours: number; lamps: number[]; starOpacity: number }> = ({ cam, refX, seed, clockHours, lamps, starOpacity }) => {
  const horizonY = HEIGHT / 2 + (GROUND - cam.y) * cam.zoom;
  const layerT = (pan: number, grow: number) =>
    `translate(${WIDTH / 2} ${horizonY}) scale(${1 + (cam.zoom - 1) * grow}) translate(${-WIDTH / 2 - (cam.x - refX) * pan} ${-GROUND})`;
  const lit = lamps.reduce((a, b) => a + b, 0) / lamps.length;
  return (
    <>
      <Sky id={`sky-${seed}`} />
      <Stars count={90} maxY={Math.max(120, horizonY - 300)} seed={seed} opacity={starOpacity} />
      <g transform={layerT(0.2, 0.05)}>
        <g transform={`translate(${WIDTH / 2} 0) scale(2.4 1) translate(${-WIDTH / 2} 0)`}>
          <Stands baseY={GROUND} lit={lit} />
        </g>
        <StandClock x={WIDTH / 2} y={GROUND - 352} r={36} hours={clockHours} />
        {TOWERS.map((x, i) => (
          <Floodlight key={x} x={x} baseY={GROUND - 20} height={TOWER_H} on={lamps[i]} beam flip={x > 1000} />
        ))}
        <BeamDust lamps={lamps} />
      </g>
      <g transform={layerT(0.5, 0.3)}>
        <Boards />
      </g>
    </>
  );
};

/**
 * Sky, stars, the stand with its clock, six floodlights with dust in the beams and the boards: the b19
 * backdrop, pinned to the horizon so the pitch layer can move under them. `lamps` gives each tower's
 * brightness (0..1, left to right); `clockHours` in 24 h. `frameOffset` runs the backdrop's own clock
 * (twinkle, dust) ahead, so a scene that continues another one without a cut picks up where it left off.
 */
export const NightBackdrop: React.FC<{
  cam: Cam;
  refX?: number;
  seed?: string;
  clockHours?: number;
  lamps?: number[];
  starOpacity?: number;
  frameOffset?: number;
}> = ({ cam, refX = X(0), seed = STAR_SEED, clockHours = CLOCK_EARLY, lamps, starOpacity = 1, frameOffset = 0 }) => {
  const on = TOWERS.map((_, i) => (lamps ? clamp01(lamps[i] ?? 1) : 1));
  return (
    <Sequence from={-frameOffset} layout="none">
      <BackdropLayers cam={cam} refX={refX} seed={seed} clockHours={clockHours} lamps={on} starOpacity={starOpacity} />
    </Sequence>
  );
};

/** The pitch layer: grass, the car park and the goal on the right, and the chalk mark where she started. */
export const SideWorld: React.FC<{ cam: Cam; children?: React.ReactNode; mark?: boolean }> = ({ cam, children, mark = true }) => (
  <g transform={camT(cam)}>
    <GroundSide groundY={GROUND} vanishX={X(8)} />
    <CarPark x0={X(GOAL_M + 3)} groundY={GROUND} ppm={PPM} />
    <GoalSide view={SIDE} goalX={GOAL_M} />
    {mark ? <ellipse cx={X(0)} cy={GROUND + 3} rx={11} ry={2.5} fill={PITCH.chalk} opacity={0.3} /> : null}
    {children}
  </g>
);

// ---------- Slow-motion time map ----------

export type TimeKey = [frame: number, t: number];

/** Piecewise-linear sim time for a scene frame. Before the first key: its t. After the last: the last speed goes on. */
export const simTime = (frame: number, keys: TimeKey[]) => {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f0, t0] = keys[i - 1];
    const [f1, t1] = keys[i];
    if (frame <= f1) return t0 + ((frame - f0) / (f1 - f0)) * (t1 - t0);
  }
  const [fa, ta] = keys[keys.length - 2];
  const [fb, tb] = keys[keys.length - 1];
  return tb + ((frame - fb) / (fb - fa)) * (tb - ta);
};

/** Scene frame where the time map reaches sim time t (the first time it does). */
export const frameOf = (t: number, keys: TimeKey[]) => {
  for (let i = 1; i < keys.length; i++) {
    const [f0, t0] = keys[i - 1];
    const [f1, t1] = keys[i];
    if (t <= t1) return t1 === t0 ? f0 : f0 + ((t - t0) / (t1 - t0)) * (f1 - f0);
  }
  const [fa, ta] = keys[keys.length - 2];
  const [fb, tb] = keys[keys.length - 1];
  return fb + ((t - tb) / (tb - ta)) * (fb - fa);
};

export const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};

// ---------- Pose helpers ----------

/** Small breathing loop on top of any pose, so a held pose is never fully still. */
export const breathe = (p: Pose, frame: number, seed = 0, amt = 1): Pose => ({
  ...p,
  torso: p.torso + idle(frame, seed, 3, 1.2 * amt),
  head: p.head + idle(frame, seed + 1, 3.4, 1.6 * amt),
  nearShoulder: p.nearShoulder + idle(frame, seed + 2, 3, 2 * amt),
  farShoulder: p.farShoulder + idle(frame, seed + 3, 3.2, 2 * amt),
});

/** Pose at sim time T from [time, pose] keys, smoothstep between keys. */
export const poseAtT = (T: number, track: [number, Pose][]): Pose => {
  if (T <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    if (T <= track[i][0]) {
      const [t0, p0] = track[i - 1];
      const [t1, p1] = track[i];
      return mixPose(p0, p1, smooth((T - t0) / Math.max(1e-6, t1 - t0)));
    }
  }
  return track[track.length - 1][1];
};

/** Head, shoulder and feet of a Player in world pixels, for anchoring HUD pieces. */
export const playerAnchors = (pose: Pose, x: number, groundY: number, H: number, flip = false, footTurn = 0) => {
  const j = solve(pose, H, footTurn);
  const dy = groundY - j.lowest - (pose.lift ?? 0) * H;
  const T = (p: { x: number; y: number }) => ({ x: x + (flip ? -p.x : p.x), y: p.y + dy });
  return {
    head: T(j.headC),
    headR: j.headR,
    shoulder: T(j.sh),
    hip: T(j.hip),
    nearKnee: T(j.nk),
    nearAnkle: T(j.na),
    nearToe: T(j.nToe),
    farKnee: T(j.fk),
    farAnkle: T(j.fa),
    farToe: T(j.fToe),
  };
};

/** Standing with the hands on the hips: the calm pose after the pass. */
export const HANDS_ON_HIPS: Pose = { torso: 0, head: 2, nearHip: 4, nearKnee: 4, nearAnkle: 90, farHip: -6, farKnee: 4, farAnkle: 90, nearShoulder: -32, nearElbow: 100, farShoulder: -30, farElbow: 96 };
/** Side-on receive (drawn with flip on): the near foot planted forward, the far foot back, toes open. */
export const RECEIVE_BACK: Pose = { torso: 8, head: 10, nearHip: 26, nearKnee: 22, nearAnkle: 96, farHip: -14, farKnee: 0, farAnkle: 92, nearShoulder: -20, nearElbow: 50, farShoulder: 24, farElbow: 45 };
/** The far foot has given way with the ball: it slides back along the grass, the near knee bends a little more. */
export const GAVE_BACK: Pose = { ...RECEIVE_BACK, torso: 12, head: 12, nearHip: 30, nearKnee: 30, nearAnkle: 98, farHip: -24, farKnee: 0, farAnkle: 94 };
/** Sam's wave: the far arm up, the hand open. */
export const WAVE: Pose = { ...POSES.stand, farShoulder: 155, farElbow: -30, head: -4 };
/** Sam carrying the net bag over the far shoulder. */
export const CARRY_BAG: Pose = { ...POSES.walk1, farShoulder: 40, farElbow: 110 };

// ---------- Keeper helpers ----------

export const mixKeeper = (a: KeeperPose, b: KeeperPose, u: number): KeeperPose => {
  const k = smooth(u);
  return { left: lerp(a.left, b.left, k), right: lerp(a.right, b.right, k), lean: lerp(a.lean, b.lean, k), shift: lerp(a.shift, b.shift, k), lift: lerp(a.lift, b.lift, k), stretch: lerp(a.stretch, b.stretch, k) };
};

/** Chalk's jog: runA and runB blended on a stride phase (one cycle per 1.0). */
export const runCycle = (phase: number): KeeperPose => mixKeeper(KPOSES.runA, KPOSES.runB, 0.5 + 0.5 * Math.sin(phase * Math.PI * 2));

/** Braking after the chase, drawn with flip on: leaning back, the front glove out. */
export const SKID: KeeperPose = { left: 22, right: 96, lean: -22, shift: 0, lift: 0, stretch: 1.05 };

/** Chalk's jog stride in sim seconds. */
export const STRIDE_S = 0.32;

// ---------- Where everyone stands after the ending pass ----------

/**
 * The stage after the ending pass (pitch metres): b20's last shot, b21's last frames and the start of b22
 * all draw it. Tavi has jogged 2 m towards Sam after her pass back, so she stands about 1.8 m left of the
 * empty receiving spot (x = -4.0, a chalk X) and well clear of Chalk. Sam has the ball at his foot. Chalk
 * brakes hard and skids to a stop just short of the X, so the X stays in view between him and Tavi.
 */
export const ENDING_STAGE = {
  tavi: { x: -5.8, y: 0.6 },
  sam: { x: -13, y: 0.4 },
  samFoot: { x: -12.7, y: 0.4 },
  chalkStop: -3.4,
  spot: { x: -4.0, y: -0.3 },
};
/** Chalk's closing speed (CHASE_SPEED) and where the chase ends: he brakes over the last 0.6 m. */
const CHASE_V = 4;
const BRAKE_M = 0.6;
const BRAKE_S = (2 * BRAKE_M) / CHASE_V;

/**
 * Chalk at sim time t in the ending (pitch metres): CHALK_CHASE towards the receiving spot, then a hard
 * brake over the last 0.6 m, so he stops just short of the empty X at the time he would have reached it.
 * `chase(t)` is chalkAt(t, spot) from the sims; `tArrive` the time the chase reaches the spot.
 */
export const chalkBraking = (t: number, chase: (t: number) => { x: number; y: number }, tArrive: number) => {
  const tb = tArrive - BRAKE_S;
  if (t < tb) return { ...chase(t), stopped: false };
  const p0 = chase(tb);
  const p1 = chase(tArrive);
  const L = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
  const dir = { x: (p1.x - p0.x) / L, y: (p1.y - p0.y) / L };
  const dt = Math.min(BRAKE_S, t - tb);
  const d = CHASE_V * dt - (CHASE_V / (2 * BRAKE_S)) * dt * dt;
  return { x: p0.x + dir.x * d, y: p0.y + dir.y * d, stopped: dt >= BRAKE_S };
};

/** The wide side camera that ends b21 and opens b22. */
export const WIDE_END_CAM: Cam = { x: X(-7.6), y: GROUND - 150, zoom: 1.4 };
/** The stand clock from b19 until "Lights out": about twenty past nine. */
export const CLOCK_EARLY = 21.33;
/** The stand clock on "Lights out" in b22: half past nine. */
export const END_CLOCK = 21.5;
