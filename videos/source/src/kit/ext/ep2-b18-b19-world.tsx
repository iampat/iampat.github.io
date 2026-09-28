// Night world for the episode 2 scenes b18-b19. The side-view floodlit backdrop pinned to the horizon,
// laid out like the cold open (b01): six towers at the same spacing, the stand clock on the roof, dust
// in the beams and low boards along the far touchline, so the ending's "first pass again" cuts back to
// the same pitch. b18 also gets a front view from behind Tavi (so the fake's left and right are left
// and right on screen), a back-view Tavi rig and a brows-up Chalk. Plus small camera and pose helpers.
// Floodlit Pitch palette only.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { CAST, HEIGHT, PITCH, WIDTH } from "../../theme";
import { EASE, idle, keys, lerp } from "../../lib/anim";
import { project, type View } from "../../lib/project";
import { Floodlight, Sky, StandClock, Stands, Stars } from "../World";
import { GoalFront } from "../Goal";
import { Keeper, type KeeperFace, type KeeperPose } from "../Keeper";
import { solve, type Pose } from "../Player";

// ---------- Camera maths (world pixels -> screen) ----------

export type Cam = { x: number; y: number; zoom: number };

export const camT = (c: Cam) => `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${c.zoom}) translate(${-c.x} ${-c.y})`;

export const toScreen = (c: Cam, x: number, y: number) => ({
  x: WIDTH / 2 + (x - c.x) * c.zoom,
  y: HEIGHT / 2 + (y - c.y) * c.zoom,
});

// ---------- Backdrop ----------

/** Tower x in far-layer pixels (layer x = 960 sits on the screen centre when the camera is on `refX`). Same as b01. */
export const TOWERS = [-300, 240, 800, 1360, 1900, 2440];
const TOWER_H = 470;

/** Dust drifting down through the floodlight beams (far layer coordinates). */
const BeamDust: React.FC<{ frame: number; ground: number }> = ({ frame, ground }) => {
  const base = ground - 20;
  const topY = base - TOWER_H + 10;
  const botY = base + 60;
  return (
    <g>
      {TOWERS.map((x, i) => {
        const dir = x > 1000 ? -1 : 1;
        return Array.from({ length: 8 }, (_, k) => {
          const s = `b18d${i}-${k}`;
          const v = (random(`${s}v`) + frame * (0.0012 + random(`${s}s`) * 0.0012)) % 1;
          const left = lerp(x - 35, x + dir * 40, v);
          const right = lerp(x + 35, x + dir * 380, v);
          const cx = lerp(left, right, 0.15 + 0.7 * random(`${s}u`)) + Math.sin(frame / 37 + k) * 10;
          const tw = 0.6 + 0.4 * Math.sin(frame / 11 + random(`${s}p`) * 6.28);
          const fade = Math.sin(Math.PI * v);
          return <circle key={`${i}-${k}`} cx={cx} cy={topY + (botY - topY) * v} r={1.6 + random(`${s}r`) * 2.2} fill={PITCH.lightSoft} opacity={0.6 * tw * fade} />;
        });
      })}
    </g>
  );
};

/** Low boards along the far touchline (mid layer coordinates). */
const Boards: React.FC<{ ground: number }> = ({ ground }) => (
  <g>
    {Array.from({ length: 34 }, (_, i) => {
      const x = -2400 + i * 200;
      return (
        <g key={i}>
          <rect x={x} y={ground - 36} width={184} height={32} rx={8} fill={i % 2 ? PITCH.standsLight : PITCH.stands} />
          <rect x={x + 18} y={ground - 25} width={40 + 60 * random(`b18board-${i}`)} height={9} rx={4.5} fill={i % 3 === 0 ? PITCH.teal : PITCH.chalk} opacity={0.2} />
        </g>
      );
    })}
  </g>
);

/**
 * Sky, stars, the stand with its clock, six floodlights with dust in the beams and the boards, pinned
 * to the horizon so the pitch layer can move under them. `refX` is the camera x where the far layers
 * line up (pass Tavi's mark, as b01 does). `clockHours` in 24 h (21.33 = twenty past nine).
 */
export const NightBackdrop: React.FC<{
  cam: Cam;
  ground: number;
  refX: number;
  seed: string;
  clockHours?: number;
  clockX?: number;
}> = ({ cam, ground, refX, seed, clockHours = 21.33, clockX = WIDTH / 2 }) => {
  const frame = useCurrentFrame();
  const horizonY = HEIGHT / 2 + (ground - cam.y) * cam.zoom;
  const layerT = (pan: number, grow: number) =>
    `translate(${WIDTH / 2} ${horizonY}) scale(${1 + (cam.zoom - 1) * grow}) translate(${-WIDTH / 2 - (cam.x - refX) * pan} ${-ground})`;
  return (
    <>
      <Sky id={`sky-${seed}`} />
      <Stars count={90} maxY={Math.max(120, horizonY - 300)} seed={seed} />
      <g transform={layerT(0.2, 0.05)}>
        <g transform={`translate(${WIDTH / 2} 0) scale(2.4 1) translate(${-WIDTH / 2} 0)`}>
          <Stands baseY={ground} lit={1} />
        </g>
        <StandClock x={clockX} y={ground - 352} r={36} hours={clockHours} />
        {TOWERS.map((x) => (
          <Floodlight key={x} x={x} baseY={ground - 20} height={TOWER_H} on={1} beam flip={x > 1000} />
        ))}
        <BeamDust frame={frame} ground={ground} />
      </g>
      <g transform={layerT(0.5, 0.3)}>
        <Boards ground={ground} />
      </g>
    </>
  );
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

/** Head, shoulder and feet of a Player in world pixels, for anchoring HUD pieces. */
export const playerAnchors = (pose: Pose, x: number, groundY: number, H: number, flip = false) => {
  const j = solve(pose, H);
  const dy = groundY - j.lowest - (pose.lift ?? 0) * H;
  const T = (p: { x: number; y: number }) => ({ x: x + (flip ? -p.x : p.x), y: p.y + dy });
  return {
    head: T(j.headC),
    headR: j.headR,
    shoulder: T(j.sh),
    hip: T(j.hip),
    nearToe: T(j.nToe),
    nearAnkle: T(j.na),
    farToe: T(j.fToe),
  };
};

// ---------- b18 front view: from behind Tavi, looking at Chalk and the goal ----------

/** A pinhole camera behind Tavi. x forward (towards the goal), y to her left, z up, in metres. */
export type FrontCam = { x: number; y: number; z: number; yaw: number; pitch: number; focal: number };

export const frontView = (c: FrontCam): View => ({
  kind: "persp",
  cam: { x: c.x, y: c.y, z: c.z },
  yawDeg: c.yaw,
  pitchDeg: c.pitch,
  focal: c.focal,
  cx: WIDTH / 2,
  cy: HEIGHT / 2,
});

/** Eased camera keys for the front view (same easing as `cameraAt`). */
export const frontCamAt = (frame: number, ks: ({ f: number } & FrontCam)[]): FrontCam => {
  if (ks.length === 1) return ks[0];
  const fs = ks.map((k) => k.f);
  const k = (key: keyof FrontCam) => keys(frame, fs, ks.map((q) => q[key]), EASE.camera);
  return { x: k("x"), y: k("y"), z: k("z"), yaw: k("yaw"), pitch: k("pitch"), focal: k("focal") };
};

/** Screen point, pixels per metre and depth of a world point on (or above) the grass. */
export const fp = (view: View, x: number, y: number, z = 0) => project({ x, y, z }, view);

/** Screen line of the grass at pitch x = `x` (a line of constant x), extended across the frame. */
const groundLine = (view: View, x: number) => {
  const a = project({ x, y: 6, z: 0 }, view);
  const b = project({ x, y: -6, z: 0 }, view);
  const k = (b.y - a.y) / (b.x - a.x || 1e-6);
  const L = -400;
  const R = WIDTH + 400;
  return { l: { x: L, y: a.y + (L - a.x) * k }, r: { x: R, y: a.y + (R - a.x) * k } };
};

/** Four floodlight towers along the far end, in metres (x, y). */
const FRONT_TOWERS: [number, number][] = [
  [46, 30],
  [44, 11],
  [44, -13],
  [46, -34],
];

/**
 * The front view's night stadium: sky, stars, the far stand with its clock (off to the right, so it
 * never sits over Chalk's head), four floodlights, mown grass in bands and the goal at `goalX`.
 */
export const FrontPitch: React.FC<{ view: View; cam: FrontCam; goalX: number; clockHours: number; seed: string; clockY?: number; clockZ?: number }> = ({
  view,
  cam,
  goalX,
  clockHours,
  seed,
  clockY = -15,
  clockZ = 13.2,
}) => {
  const frame = useCurrentFrame();
  const far = project({ x: cam.x + 2000, y: cam.y, z: cam.z }, view);
  const horizonY = far.y;
  // Grass bands: 2.5 m wide, from just in front of the camera to the far stand.
  const bands: React.ReactNode[] = [];
  for (let i = 0; i < 24; i++) {
    const x0 = -3 + i * 2.5;
    const x1 = x0 + 2.5;
    if (i % 2 === 1 || x1 < cam.x + 0.6) continue;
    const a = groundLine(view, Math.max(x0, cam.x + 0.6));
    const b = groundLine(view, x1);
    bands.push(<path key={i} d={`M${a.l.x},${a.l.y} L${a.r.x},${a.r.y} L${b.r.x},${b.r.y} L${b.l.x},${b.l.y} Z`} fill={PITCH.grass} />);
  }
  const standBase = project({ x: 50, y: 0, z: 0 }, view);
  const standK = (standBase.scale * 12) / 290;
  const clock = project({ x: 50, y: clockY, z: clockZ }, view);
  const clockPost = project({ x: 50, y: clockY, z: 11.5 }, view);
  return (
    <g>
      <Sky id={`sky-${seed}`} />
      <Stars count={90} maxY={Math.max(100, horizonY - 220)} seed={seed} />
      {/* Far stand, then the towers in front of it. */}
      <g transform={`translate(${standBase.x} ${standBase.y}) scale(${standK}) translate(${-1400} 0)`}>
        <Stands baseY={0} lit={1} width={2800} />
      </g>
      <line x1={clockPost.x} y1={clockPost.y} x2={clock.x} y2={clock.y} stroke={PITCH.stands} strokeWidth={Math.max(4, clock.scale * 0.25)} strokeLinecap="round" />
      <StandClock x={clock.x} y={clock.y} r={Math.max(18, clock.scale * 1.3)} hours={clockHours} />
      {FRONT_TOWERS.map(([tx, ty]) => {
        const b = project({ x: tx, y: ty, z: 0 }, view);
        const k = (b.scale * 24) / 470;
        return (
          <g key={`${tx}-${ty}`} transform={`translate(${b.x} ${b.y}) scale(${k}) translate(${-b.x} ${-b.y})`}>
            <Floodlight x={b.x} baseY={b.y} height={470} on={1} beam flip={ty < 0} />
          </g>
        );
      })}
      {/* Grass. */}
      <rect x={-200} y={horizonY - 2} width={WIDTH + 400} height={HEIGHT - horizonY + 400} fill={PITCH.grassDark} />
      {bands}
      <rect x={-200} y={horizonY - 3} width={WIDTH + 400} height={10} fill={PITCH.grassLight} opacity={0.5} />
      <GoalFront view={view} goalX={goalX} netOpacity={0.35} />
      {/* A few dust motes in the light, so the far end is never still. */}
      {Array.from({ length: 14 }, (_, i) => {
        const v = (random(`fd${seed}${i}`) + frame * (0.0015 + random(`fs${seed}${i}`) * 0.001)) % 1;
        const x = random(`fx${seed}${i}`) * WIDTH;
        return <circle key={i} cx={x + Math.sin(frame / 29 + i) * 12} cy={60 + (horizonY - 40) * v} r={1.5 + random(`fr${seed}${i}`) * 2} fill={PITCH.lightSoft} opacity={0.45 * Math.sin(Math.PI * v)} />;
      })}
    </g>
  );
};

/** A flat shadow on the grass under a figure (front view). */
export const GroundShadow: React.FC<{ x: number; y: number; w: number; opacity?: number }> = ({ x, y, w, opacity = 0.22 }) => (
  <ellipse cx={x} cy={y} rx={w / 2} ry={w * 0.13} fill="#000" opacity={opacity} />
);

// ---------- Tavi from behind ----------

/**
 * A back-view pose for Tavi (the camera stands behind her, so her left is screen left).
 * tilt: torso tilt about the waist, degrees, + = shoulders to her left (the shoulder dip).
 * head: extra head tilt, + = to her left. hipX: hip shift in units of H, + = to her left.
 * crouch: 0..1 knee bend. lx / rx: feet x in units of H (screen x). ll / rl: heel lift 0..1 (running).
 * la / ra: arm angle from straight down, degrees, + = out from the body. le / re: elbow bend, degrees.
 */
export type BackPose = { tilt: number; head: number; hipX: number; crouch: number; lx: number; ll: number; rx: number; rl: number; la: number; le: number; ra: number; re: number; bob?: number };

export const BACK = {
  ready: { tilt: 0, head: 0, hipX: 0, crouch: 0.55, lx: -0.1, ll: 0, rx: 0.1, rl: 0, la: 20, le: 40, ra: 20, re: 40 },
  /** The fake: shoulders dropped to her left, weight over the left foot. */
  dip: { tilt: 17, head: 7, hipX: 0.04, crouch: 0.75, lx: -0.12, ll: 0, rx: 0.09, rl: 0.12, la: 46, le: 20, ra: 10, re: 50 },
  /** The push: the right foot swings out and pushes the ball to her right. */
  push: { tilt: -2, head: -2, hipX: 0.0, crouch: 0.6, lx: -0.1, ll: 0, rx: 0.25, rl: 0.22, la: 34, le: 30, ra: 30, re: 30 },
  /** After the push: the body swings to the right after the ball. */
  follow: { tilt: -15, head: -6, hipX: -0.06, crouch: 0.5, lx: -0.03, ll: 0.35, rx: 0.2, rl: 0, la: 14, le: 60, ra: 46, re: 30 },
  /** Standing with the ball, breathing. */
  stand: { tilt: 0, head: 2, hipX: 0, crouch: 0.15, lx: -0.08, ll: 0, rx: 0.08, rl: 0, la: 12, le: 20, ra: 12, re: 20 },
} satisfies Record<string, BackPose>;

const BACK_KEYS: (keyof BackPose)[] = ["tilt", "head", "hipX", "crouch", "lx", "ll", "rx", "rl", "la", "le", "ra", "re", "bob"];

export const mixBack = (a: BackPose, b: BackPose, t: number): BackPose => {
  const out = {} as BackPose;
  for (const k of BACK_KEYS) (out as Record<string, number>)[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
  return out;
};

/** Back-view run: the heels come up behind in turn, the arms swing, a small bob. `lean` tilts the run. */
export const backRun = (phase: number, lean = 0): BackPose => {
  const s = Math.sin(phase * Math.PI * 2);
  return {
    tilt: lean + 3 * s,
    head: -1.5 * s,
    hipX: -0.012 * s,
    crouch: 0.45,
    lx: -0.065,
    ll: Math.max(0, s) * 0.9,
    rx: 0.065,
    rl: Math.max(0, -s) * 0.9,
    la: 18 + 10 * s,
    le: 70 + 25 * Math.max(0, -s),
    ra: 18 - 10 * s,
    re: 70 + 25 * Math.max(0, s),
    bob: Math.abs(Math.cos(phase * Math.PI * 2)) * 0.025,
  };
};

/** Tavi seen from behind: back of the shirt with its band, curly hair, the soles show when she runs. */
export const TaviBack: React.FC<{ x: number; groundY: number; h: number; pose: BackPose }> = ({ x, groundY, h: H, pose: p }) => {
  const C = CAST;
  const hipY = -(0.5 - 0.07 * p.crouch + (p.bob ?? 0)) * H;
  const hipX = -p.hipX * H;
  const legW = 0.085 * H;
  const limbW = 0.075 * H;
  const leg = (side: -1 | 1, fx: number, lift: number) => {
    const hj = { x: hipX + side * 0.058 * H, y: hipY + 0.03 * H };
    const ank = { x: fx * H, y: -0.04 * H - lift * 0.2 * H };
    const dx = ank.x - hj.x;
    const dy = ank.y - hj.y;
    const d = Math.hypot(dx, dy) || 1;
    const L = 0.47 * H * (1 - 0.3 * lift);
    const off = Math.sqrt(Math.max(0, (L / 2) ** 2 - (d / 2) ** 2)) * 0.28;
    let px = -dy / d;
    let py = dx / d;
    if (px * side < 0) {
      px = -px;
      py = -py;
    }
    const knee = { x: (hj.x + ank.x) / 2 + px * off, y: (hj.y + ank.y) / 2 + py * off };
    const sockTop = { x: knee.x + (ank.x - knee.x) * 0.28, y: knee.y + (ank.y - knee.y) * 0.28 };
    return (
      <g key={side}>
        <polyline points={`${hj.x},${hj.y} ${knee.x},${knee.y} ${sockTop.x},${sockTop.y}`} fill="none" stroke={C.skin} strokeWidth={legW} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={sockTop.x} y1={sockTop.y} x2={ank.x} y2={ank.y} stroke={C.sock} strokeWidth={legW * 0.95} strokeLinecap="round" />
        <line x1={knee.x + side * legW * 0.2} y1={knee.y + 0.02 * H} x2={ank.x + side * legW * 0.2} y2={ank.y - 0.02 * H} stroke={C.sockShade} strokeWidth={legW * 0.3} strokeLinecap="round" opacity={0.6} />
        {lift > 0.15 ? (
          // The sole faces the camera when the heel is up.
          <g>
            <ellipse cx={ank.x} cy={ank.y + 0.01 * H} rx={0.047 * H} ry={0.03 * H + 0.035 * H * lift} fill={C.bootShade} />
            <ellipse cx={ank.x} cy={ank.y - 0.012 * H} rx={0.042 * H} ry={0.022 * H} fill={C.boot} />
          </g>
        ) : (
          <g>
            <ellipse cx={ank.x} cy={ank.y + 0.012 * H} rx={0.052 * H} ry={0.034 * H} fill={C.boot} />
            <rect x={ank.x - 0.046 * H} y={ank.y + 0.03 * H} width={0.092 * H} height={0.012 * H} rx={0.006 * H} fill={C.bootShade} />
          </g>
        )}
      </g>
    );
  };
  const arm = (side: -1 | 1, a: number, e: number) => {
    const sh = { x: side * 0.105 * H, y: -0.31 * H };
    const ar = (a * Math.PI) / 180;
    const el = { x: sh.x + side * Math.sin(ar) * 0.165 * H, y: sh.y + Math.cos(ar) * 0.165 * H };
    const a2 = ((a - e * 0.35) * Math.PI) / 180;
    const fl = 0.155 * H * (1 - 0.45 * Math.sin((Math.min(e, 120) * Math.PI) / 180));
    const hd = { x: el.x + side * Math.sin(a2) * fl, y: el.y + Math.cos(a2) * fl };
    const sl = { x: sh.x + (el.x - sh.x) * 0.45, y: sh.y + (el.y - sh.y) * 0.45 };
    return (
      <g key={`a${side}`}>
        <polyline points={`${sh.x},${sh.y} ${el.x},${el.y} ${hd.x},${hd.y}`} fill="none" stroke={C.skin} strokeWidth={limbW} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={sh.x} y1={sh.y} x2={sl.x} y2={sl.y} stroke={C.shirt} strokeWidth={limbW * 1.3} strokeLinecap="round" />
      </g>
    );
  };
  const hr = 0.095 * H;
  // The lifted foot is nearer the camera, so it draws last.
  const legs = p.ll > p.rl ? [leg(1, p.rx, p.rl), leg(-1, p.lx, p.ll)] : [leg(-1, p.lx, p.ll), leg(1, p.rx, p.rl)];
  return (
    <g transform={`translate(${x} ${groundY})`}>
      {legs}
      {/* Shorts. */}
      <rect x={hipX - 0.122 * H} y={hipY - 0.03 * H} width={0.244 * H} height={0.15 * H} rx={0.05 * H} fill={C.shorts} />
      <g transform={`translate(${hipX} ${hipY}) rotate(${-p.tilt})`}>
        <rect x={-0.035 * H} y={-0.42 * H} width={0.07 * H} height={0.08 * H} rx={0.03 * H} fill={C.skinShade} />
        {arm(-1, p.la, p.le)}
        {arm(1, p.ra, p.re)}
        <rect x={-0.125 * H} y={-0.36 * H} width={0.25 * H} height={0.385 * H} rx={0.085 * H} fill={C.shirt} />
        <rect x={0.035 * H} y={-0.34 * H} width={0.075 * H} height={0.34 * H} rx={0.037 * H} fill={C.shirtShade} opacity={0.5} />
        <rect x={-0.125 * H} y={-0.25 * H} width={0.25 * H} height={0.035 * H} fill={C.band} />
        {/* Sleeves sit over the shirt edge. */}
        {[-1, 1].map((side) => {
          const a = ((side < 0 ? p.la : p.ra) * Math.PI) / 180;
          const sh = { x: side * 0.105 * H, y: -0.31 * H };
          return <line key={side} x1={sh.x} y1={sh.y} x2={sh.x + side * Math.sin(a) * 0.075 * H} y2={sh.y + Math.cos(a) * 0.075 * H} stroke={C.shirt} strokeWidth={limbW * 1.3} strokeLinecap="round" />;
        })}
        <g transform={`translate(0 ${-0.39 * H - hr * 0.9}) rotate(${-p.head})`}>
          <circle cx={-hr * 0.97} cy={hr * 0.08} r={hr * 0.24} fill={C.skin} />
          <circle cx={hr * 0.97} cy={hr * 0.08} r={hr * 0.24} fill={C.skin} />
          <circle r={hr} fill={C.skin} />
          <g fill={C.hair}>
            <circle cx={0} cy={-hr * 0.1} r={hr * 0.95} />
            <circle cx={-hr * 0.5} cy={-hr * 0.7} r={hr * 0.5} />
            <circle cx={hr * 0.45} cy={-hr * 0.72} r={hr * 0.48} />
            <circle cx={0} cy={-hr * 0.95} r={hr * 0.42} />
            <circle cx={-hr * 0.82} cy={-hr * 0.2} r={hr * 0.36} />
            <circle cx={hr * 0.82} cy={-hr * 0.2} r={hr * 0.36} />
          </g>
        </g>
      </g>
    </g>
  );
};

/** Screen anchors of a TaviBack figure: the neck (between the shoulders), the head centre and its radius. */
export const backAnchors = (p: BackPose, x: number, groundY: number, H: number) => {
  const hipY = -(0.5 - 0.07 * p.crouch + (p.bob ?? 0)) * H;
  const hipX = -p.hipX * H;
  const a = (-p.tilt * Math.PI) / 180;
  const rot = (lx: number, ly: number) => ({ x: x + hipX + lx * Math.cos(a) - ly * Math.sin(a), y: groundY + hipY + lx * Math.sin(a) + ly * Math.cos(a) });
  const hr = 0.095 * H;
  return { neck: rot(0, -0.31 * H), head: rot(0, -0.39 * H - hr * 0.9), headR: hr };
};

// ---------- Chalk with both eyebrows up ----------

/**
 * Chalk (front view) with an optional "brows up" face: both eyebrows raised and no mouth. The shared rig's
 * "surprised" face raises the brows but adds an "o" mouth, so this paints the mouth out in body colour.
 * Keep |look| <= 0.5 while brows are up, so the patch stays clear of the shade stripe.
 */
export const ChalkFront: React.FC<{ x: number; groundY: number; h: number; pose: KeeperPose; face?: KeeperFace; browsUp?: boolean; look?: number; flip?: boolean }> = ({
  x,
  groundY,
  h,
  pose,
  face = "flat",
  browsUp = false,
  look = 0,
  flip = false,
}) => {
  const H = h * pose.stretch;
  const W = (h * 0.34) / Math.sqrt(pose.stretch);
  const lx = look * W * 0.08;
  return (
    <g>
      <Keeper x={x} groundY={groundY} h={h} pose={pose} face={browsUp ? "surprised" : face} look={look} flip={flip} />
      {browsUp ? (
        <g transform={`translate(${x + pose.shift * h * (flip ? -1 : 1)} ${groundY - pose.lift * h}) scale(${flip ? -1 : 1} 1) rotate(${pose.lean} 0 ${-H * 0.45})`}>
          <ellipse cx={lx} cy={-H * 0.69} rx={h * 0.022} ry={h * 0.03} fill={CAST.keeper} />
        </g>
      ) : null}
    </g>
  );
};
