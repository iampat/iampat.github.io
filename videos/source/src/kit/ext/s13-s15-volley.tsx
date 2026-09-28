// Shared pieces for s13-s15 (Chapter 3, the volley): world constants, volley poses,
// the pitch backdrop for close-ups, a time-warp helper, Chalk's glove position and
// small graphics (ghost ball, bracket, clock, racket).
// Owned by the s13-s15 builder. Other scenes must not import this file.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { Floodlight, GroundSide, Sky, Stands, Stars } from "../World";
import { mixPose, solve, type Pose } from "../Player";
import type { KeeperPose } from "../Keeper";
import { EASE, clamp01, lerp, pop, progress, visible } from "../../lib/anim";
import { simulate } from "../../physics/sim";
import { SHOTS } from "../../physics/shots";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import type { View } from "../../lib/project";

// ---------- The side-view pitch world (s13, s14) ----------
export const PPM = 55; // world pixels per metre
export const OX = 500; // world x of the kick spot
export const GROUND = 820; // world y of the grass
export const GOAL_M = 16; // goal line, metres from the kick spot (the volley chapter is 16 m out)
export const X = (m: number) => OX + m * PPM;
export const Z = (m: number) => GROUND - m * PPM;
export const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
export const TAVI_H = 1.62 * PPM;
export const CHALK_H = 2.1 * PPM;
export const BALL_R = 0.11 * PPM;

export type Cam = { x: number; y: number; zoom: number };
export const worldT = (c: Cam) => `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${c.zoom}) translate(${-c.x} ${-c.y})`;
export const toScreen = (c: Cam, p: { x: number; y: number }) => ({ x: WIDTH / 2 + (p.x - c.x) * c.zoom, y: HEIGHT / 2 + (p.y - c.y) * c.zoom });

// ---------- Volley poses (Tavi, side view). The standing (far) leg is the same in
// plant / cock / contact / follow, so the standing foot stays planted while the kicking leg swings.
// The standing leg is nearly straight (no lunge), so the hip sits high and the kicking knee
// can come up over the ball.
const FAR_PLANT = { farHip: 14, farKnee: 8, farAnkle: 102 };
export const VPOSE = {
  /** Waiting for the dropping ball, weight back, looking up. */
  set: { torso: 2, head: -20, nearHip: 8, nearKnee: 14, nearAnkle: 95, farHip: -12, farKnee: 10, farAnkle: 95, nearShoulder: 28, nearElbow: 40, farShoulder: 34, farElbow: 40 },
  /** Standing foot in the air, stepping in. */
  step: { torso: 6, head: -12, nearHip: -6, nearKnee: 16, nearAnkle: 100, farHip: 24, farKnee: 40, farAnkle: 100, nearShoulder: 30, nearElbow: 40, farShoulder: 50, farElbow: 30 },
  /** Standing foot planted, kicking leg back. */
  plant: { torso: 8, head: -8, nearHip: -12, nearKnee: 80, nearAnkle: 150, ...FAR_PLANT, nearShoulder: -34, nearElbow: 35, farShoulder: 22, farElbow: 55 },
  /** Full knee bend: thigh forward, shin folded back. The last whip starts here. */
  cock: { torso: 12, head: 12, nearHip: 58, nearKnee: 118, nearAnkle: 160, ...FAR_PLANT, nearShoulder: -40, nearElbow: 30, farShoulder: 30, farElbow: 50 },
  /** Contact: thigh level, knee over the ball, toes down. Ball centre about 0.39 m up (knee height). */
  contact: { torso: 14, head: 24, nearHip: 92, nearKnee: 102, nearAnkle: 166, ...FAR_PLANT, nearShoulder: -45, nearElbow: 30, farShoulder: 60, farElbow: 40 },
  follow: { torso: 10, head: 12, nearHip: 108, nearKnee: 40, nearAnkle: 160, ...FAR_PLANT, nearShoulder: -45, nearElbow: 30, farShoulder: 80, farElbow: 20 },
  /** Thigh control: thigh level, arms out for balance, eyes on the ball. */
  thigh: { torso: 4, head: 22, nearHip: 90, nearKnee: 95, nearAnkle: 120, farHip: 4, farKnee: 8, farAnkle: 94, nearShoulder: -38, nearElbow: 25, farShoulder: 12, farElbow: 30 },
  thighUp: { torso: 2, head: 4, nearHip: 102, nearKnee: 100, nearAnkle: 122, farHip: 4, farKnee: 8, farAnkle: 94, nearShoulder: -42, nearElbow: 25, farShoulder: 14, farElbow: 30 },
  /** Thigh lift held: standing leg straight, kicking thigh level under the ball, eyes up on the rising ball. */
  thighWatch: { torso: 0, head: -16, nearHip: 88, nearKnee: 96, nearAnkle: 118, farHip: 4, farKnee: 6, farAnkle: 94, nearShoulder: -40, nearElbow: 25, farShoulder: 18, farElbow: 30 },
  /** Watching a high ball. */
  lookUp: { torso: -2, head: -26, nearHip: 3, nearKnee: 4, nearAnkle: 90, farHip: -3, farKnee: 4, farAnkle: 90, nearShoulder: 10, nearElbow: 20, farShoulder: 14, farElbow: 20 },
} satisfies Record<string, Pose>;

const sub = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: a.x - b.x, y: a.y - b.y });

/** Where the ball centre sits on the laces for a pose, relative to the hip, in pixels (y down). */
export const lacesBall = (pose: Pose, h: number, ballR: number) => {
  const j = solve(pose, h);
  const laces = { x: j.na.x + (j.nToe.x - j.na.x) * 0.45, y: j.na.y + (j.nToe.y - j.na.y) * 0.45 };
  const d = sub(j.nToe, j.na);
  const L = Math.hypot(d.x, d.y) || 1;
  const n = { x: d.y / L, y: -d.x / L }; // laces side of the foot
  const off = ballR + 0.022 * h;
  return { x: laces.x + n.x * off, y: laces.y + n.y * off, lowest: j.lowest };
};

/** Where the ball rests on top of the thigh for a pose, relative to the hip, in pixels (y down). */
export const thighBall = (pose: Pose, h: number, ballR: number, along = 0.62) => {
  const j = solve(pose, h);
  const p = { x: j.hip.x + (j.nk.x - j.hip.x) * along, y: j.hip.y + (j.nk.y - j.hip.y) * along };
  const d = sub(j.nk, j.hip);
  const L = Math.hypot(d.x, d.y) || 1;
  const n = { x: d.y / L, y: -d.x / L }; // top of the thigh
  const off = ballR + 0.0425 * h;
  return { x: p.x + n.x * off, y: p.y + n.y * off, lowest: j.lowest };
};

/** Screen-space hip y for a Player drawn with this pose on this ground. */
export const hipY = (pose: Pose, h: number, groundY: number) => groundY - solve(pose, h).lowest - (pose.lift ?? 0) * h;

// ---------- Positions shared by s13 and s14 (metres) ----------
/** Tavi's hip when he takes the punched ball on his thigh. */
export const THIGH_HIP_M = -0.35;
const TB = thighBall(VPOSE.thigh, TAVI_H, BALL_R);
/** Height of the ball centre on the thigh. */
export const THIGH_BALL_Z = (TB.lowest - TB.y) / PPM;
/** The drop line: the ball goes up from the thigh and falls straight down here. */
export const DROP_X_M = THIGH_HIP_M + TB.x / PPM;
const CB = lacesBall(VPOSE.contact, TAVI_H, BALL_R);
/** Tavi's hip at contact (standing foot planted beside the drop spot). */
export const PLANT_HIP_M = DROP_X_M - CB.x / PPM;
/** Height of the ball centre at contact for the contact pose (about knee height). */
export const CONTACT_Z_POSE = (CB.lowest - CB.y) / PPM;
/** Tavi's hip while he waits, one small step behind the plant. */
export const SET_HIP_M = PLANT_HIP_M - 0.32;

// ---------- Time warp: slow motion that eases into a near freeze ----------
/** Sum of playback speeds from frame `from` to `frame` (in frames of sim time). */
export const warp = (frame: number, from: number, speedAt: (f: number) => number) => {
  if (frame <= from) return frame - from;
  let t = 0;
  const whole = Math.floor(frame);
  for (let f = from; f < whole; f++) t += speedAt(f + 0.5);
  t += (frame - whole) * speedAt(whole + 0.5);
  return t;
};

// ---------- The drop after the thigh pop (DROP sim), shared by s13 and s14 ----------
/** At rest 2.0 m up, falls with drag to knee height (0.4 m). One sample per frame. */
export const DROP = simulate(SHOTS.DROP, 30);
/** Contact sample (knee height). */
export const DC = DROP.length - 1;
/** Sample (fractional) where the last whip starts: 70 thousandths of a second before contact. */
export const D_WHIP = (() => {
  const tw = DROP[DC].t - 0.07;
  for (let i = 0; i < DC; i++) {
    if (DROP[i + 1].t >= tw) return i + (tw - DROP[i].t) / (DROP[i + 1].t - DROP[i].t);
  }
  return DC - 2;
})();
/** Frames of Tavi's shot from the kick to Chalk's glove. */
export const PUNCH_N = 25;

/**
 * Tavi's volley driven by the ball's DROP time d (samples). `plantT` 0..1 is the step from the
 * set stance onto the standing foot. The knee bends back from d = DC - 6, and the last whip
 * runs from D_WHIP to contact (DC).
 */
export const volleyAt = (d: number, plantT: number): { pose: Pose; hip: number } => {
  const u = clamp01(plantT);
  const s = u * u * (3 - 2 * u);
  let pose: Pose;
  const hip = lerp(SET_HIP_M, PLANT_HIP_M, s);
  if (u < 1) {
    pose = s < 0.5 ? mixPose(VPOSE.set, VPOSE.step, s * 2) : mixPose(VPOSE.step, VPOSE.plant, (s - 0.5) * 2);
  } else if (d < DC - 6) {
    pose = VPOSE.plant;
  } else if (d < D_WHIP) {
    const v = (d - (DC - 6)) / (D_WHIP - (DC - 6));
    pose = mixPose(VPOSE.plant, VPOSE.cock, v * v * (3 - 2 * v));
  } else if (d < DC) {
    pose = mixPose(VPOSE.cock, VPOSE.contact, (d - D_WHIP) / (DC - D_WHIP));
  } else {
    pose = VPOSE.contact;
  }
  return { pose, hip };
};
/** Take 1 (s13 into s14): the plant step happens early in the drop. */
export const take1PlantT = (d: number) => (d - 0.5) / 6;

// ---------- s13 timing, shared with s14 so the freeze carries over ----------
type CueLike = ((phrase: string, offsetFrames?: number) => number) & { frames: number; wordEnd: (phrase: string, offsetFrames?: number) => number };
/** s14 frame where time starts again: the dot grid dissolves and the ball falls on. */
export const S14_RESUME = 12;
/** Slow-motion speed (about 3x slower) while the ball rises off the thigh and starts to fall. */
const S13_SLOW = 0.33;
/**
 * Beat frames of s13 and its time warp. s14 calls this with useCues("s13") to start where s13 ends.
 * Time warp: real time up to the thigh pop, then slow motion (0.33x) so the ball visibly rises
 * off the thigh on "pop it up off your thigh", then a near freeze mid-fall on "Now hit it".
 */
export const s13Timing = (cue: CueLike) => {
  const punch = cue("punches") + 4; // glove meets the ball just after "punches"
  const kick = punch - PUNCH_N;
  const thighF = cue("pop it up") + 4; // the punched ball meets the thigh on "pop"
  const popV = Math.sqrt(2 * 9.81 * (2.0 - THIGH_BALL_Z)); // thigh pop to 2.0 m, at rest at the top
  /** Warped (sim) frame of the top of the pop. */
  const peakF = thighF + (popV / 9.81) * 30;
  const slowFrom = thighF; // slows right from the pop, so the ball visibly lifts off the thigh
  const freezeFrom = cue("Now hit it") - 4;
  const speedAt = (f: number) => {
    const slow = 1 - (1 - S13_SLOW) * progress(f, slowFrom, 4, EASE.soft);
    const frz = progress(f, freezeFrom, 18, EASE.soft);
    return slow * (1 - frz) + 0.003 * frz;
  };
  const W = (f: number) => (f <= slowFrom ? f : slowFrom + warp(f, slowFrom, speedAt));
  /** DROP sim frames elapsed at the last frame of s13. */
  const dropEnd = W(cue.frames) - peakF;
  // The dot grid (visual only) over the frozen frame, in s13 frames. It starts after "lands"
  // (music only) and runs on into s14, where it dissolves at S14_RESUME. The whole grid is keyed
  // to the end of "lands" and to the scene length, so a longer tail gives a longer hold.
  const panelAt = cue.wordEnd("lands") - 1;
  const dots = {
    panelAt,
    fillStart: panelAt + 1,
    /** Frames per row of grey dots (13 rows, plus 4 frames across a row). */
    rowDur: 0.55,
    /** Orange dots pop in 4 quick groups, `litGap` frames apart. */
    litStart: panelAt + 9,
    litGap: 3,
    labelAt: panelAt + 17,
    /** The hero dot lights with the first group, then grows into the replay bubble. */
    heroAt: panelAt + 13,
    replayAt: panelAt + 19,
    dissolveAt: cue.frames + S14_RESUME,
  };
  return { punch, kick, thighF, popV, peakF, slowFrom, freezeFrom, speedAt, W, dropEnd, dots };
};
export type DotTiming = ReturnType<typeof s13Timing>["dots"];
/** Camera for the frozen frame in s13: Tavi and the ball on the left third, room on the right. */
export const FREEZE_CAM: Cam = { x: X(DROP_X_M + 2.3), y: Z(1.12), zoom: 4.2 };
/** Camera on the last frame of s13 = first frame of s14 (a slow push from FREEZE_CAM). */
export const S13_END_CAM: Cam = { x: X(DROP_X_M + 2.22), y: Z(1.12), zoom: 4.34 };

// ---------- Chalk's punching glove ----------
/** Centre of Chalk's glove (right arm = screen left) relative to his feet, in pixels (y down). */
export const keeperGlove = (pose: KeeperPose, h: number, side: 1 | -1 = -1) => {
  const H = h * pose.stretch;
  const W = (h * 0.34) / Math.sqrt(pose.stretch);
  const armLen = h * 0.3;
  const glove = h * 0.11;
  const angle = side === -1 ? pose.right : pose.left;
  const a = (angle * Math.PI) / 180;
  const sx = side * W * 0.42;
  const sy = -H * 0.72;
  const L = armLen + glove * 0.85;
  const px = sx + side * Math.sin(a) * L;
  const py = sy + Math.cos(a) * L;
  // Lean rotation about (0, -0.45 H), then shift and lift.
  const lr = (pose.lean * Math.PI) / 180;
  const cy = -H * 0.45;
  const rx = px * Math.cos(lr) - (py - cy) * Math.sin(lr);
  const ry = px * Math.sin(lr) + (py - cy) * Math.cos(lr) + cy;
  return { x: rx + pose.shift * h, y: ry - pose.lift * h };
};

// ---------- Backdrop for side-view shots with a world camera ----------
export const PitchBackdrop: React.FC<{ cam: Cam; seed: string; children?: React.ReactNode }> = ({ cam, seed, children }) => {
  const horizonY = HEIGHT / 2 + (GROUND - cam.y) * cam.zoom;
  const bgScale = 1 + (cam.zoom - 1) * 0.05;
  return (
    <g>
      <Sky id={`sky-${seed}`} />
      <Stars count={90} maxY={Math.max(120, horizonY - 320)} seed={seed} />
      <g transform={`translate(${WIDTH / 2} ${horizonY}) scale(${bgScale}) translate(${-WIDTH / 2 - (cam.x - X(4)) * 0.05} ${-GROUND})`}>
        <Stands baseY={GROUND} lit={1} />
        {[180, 720, 1220, 1760].map((x, i) => (
          <Floodlight key={i} x={x} baseY={GROUND - 20} height={470} on={1} />
        ))}
      </g>
      <g transform={worldT(cam)}>
        <GroundSide groundY={GROUND} vanishX={X(6)} />
        {children}
      </g>
    </g>
  );
};

// ---------- Small graphics ----------

/** Dashed ghost of the ball (40% outline, no line). */
export const GhostBall: React.FC<{ cx: number; cy: number; r: number; opacity?: number; color?: string; width?: number }> = ({
  cx,
  cy,
  r,
  opacity = 1,
  color = PITCH.chalk,
  width,
}) => {
  const w = width ?? Math.max(2, r * 0.14);
  const dash = Math.max(3, r * 0.42);
  return (
    <g opacity={opacity}>
      <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.12} />
      <circle cx={cx} cy={cy} r={r - w / 2} fill="none" stroke={color} strokeWidth={w} strokeDasharray={`${dash} ${dash * 0.7}`} strokeLinecap="round" opacity={0.75} />
    </g>
  );
};

/** A vertical bracket from y1 to y2 at x, with small end ticks; draws on with t (0..1). */
export const VBracket: React.FC<{ x: number; y1: number; y2: number; t: number; color?: string; width?: number; tick?: number; side?: 1 | -1 }> = ({
  x,
  y1,
  y2,
  t,
  color = PITCH.light,
  width = 6,
  tick = 18,
  side = -1,
}) => {
  if (t <= 0.001) return null;
  const mid = (y1 + y2) / 2;
  const half = ((y2 - y1) / 2) * t;
  return (
    <g stroke={color} strokeWidth={width} strokeLinecap="round" fill="none">
      <line x1={x} y1={mid - half} x2={x} y2={mid + half} />
      <line x1={x} y1={mid - half} x2={x + side * tick * t} y2={mid - half} />
      <line x1={x} y1={mid + half} x2={x + side * tick * t} y2={mid + half} />
    </g>
  );
};

/** A small round clock with a moving hand, and a word beside it. Pops in. */
export const ClockIcon: React.FC<{ x: number; y: number; r: number; at: number; until?: number; word?: string; size?: number }> = ({
  x,
  y,
  r,
  at,
  until,
  word,
  size = 40,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const hand = -90 + Math.min(1, Math.max(0, (frame - at) / 30)) * 300 + (frame - at) * 0.6;
  const w = word ? word.length * size * 0.56 + size * 1.1 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {word ? (
        <g>
          <rect x={r * 0.4} y={-size * 0.78} width={w + r * 0.9} height={size * 1.56} rx={size * 0.78} fill={PITCH.chalk} />
          <text x={r * 1.3 + w / 2} y={size * 0.35} fill={PITCH.sky} fontFamily={FONTS.label} fontWeight={800} fontSize={size} textAnchor="middle">
            {word}
          </text>
        </g>
      ) : null}
      <circle r={r + r * 0.16} fill={PITCH.accent} />
      <circle r={r} fill={PITCH.chalk} />
      {[0, 90, 180, 270].map((a) => (
        <line key={a} x1={0} y1={-r * 0.78} x2={0} y2={-r * 0.62} stroke={PITCH.sky} strokeWidth={r * 0.1} strokeLinecap="round" transform={`rotate(${a})`} />
      ))}
      <line x1={0} y1={0} x2={0} y2={-r * 0.62} stroke={PITCH.sky} strokeWidth={r * 0.13} strokeLinecap="round" transform={`rotate(${hand + 90})`} />
      <line x1={0} y1={0} x2={0} y2={-r * 0.4} stroke={PITCH.sky} strokeWidth={r * 0.16} strokeLinecap="round" transform="rotate(-60)" />
      <circle r={r * 0.12} fill={PITCH.accent} />
    </g>
  );
};

/** Chalk dust that falls (for the dots dissolving). Deterministic per seed. */
export const FallingDust: React.FC<{ x: number; y: number; at: number; seed: string; color?: string; size?: number }> = ({ x, y, at, seed, color = PITCH.chalk, size = 10 }) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / 30;
  if (t < 0 || t > 1) return null;
  return (
    <g>
      {Array.from({ length: 3 }, (_, i) => {
        const vx = (random(`${seed}-vx-${i}`) - 0.5) * 40;
        const vy = 40 + random(`${seed}-vy-${i}`) * 60;
        return (
          <circle key={i} cx={x + vx * t} cy={y + vy * t + 200 * t * t} r={size * (0.3 + 0.3 * random(`${seed}-r-${i}`)) * (1 - 0.5 * t)} fill={color} opacity={(1 - t) * 0.8} />
        );
      })}
    </g>
  );
};

// ---------- s15: the racket (X-ray palette) ----------

/**
 * A tennis racket that replaces the foot. `ankle` is the throat end, `dir` the unit
 * direction from the ankle towards the toes (the racket's long axis), `h` the character
 * height (pixels) for sizing, `grow` 0..1 morph from a foot to a full racket.
 * The face is turned a little towards the viewer so the strings read.
 */
export const Racket: React.FC<{
  ankle: { x: number; y: number };
  knee: { x: number; y: number };
  dir: { x: number; y: number };
  h: number;
  grow: number;
  strings: number;
  handle: number;
  id: string;
}> = ({ ankle, knee, dir, h, grow, strings, handle, id }) => {
  if (grow <= 0.001 && strings <= 0.001) return null;
  const n = { x: dir.y, y: -dir.x }; // face normal (laces side)
  const a = h * (0.065 + 0.05 * grow); // half length along the axis (matches s15's contact maths)
  const b = a * 0.62; // half width (face turned towards the viewer)
  const cx = ankle.x + dir.x * (h * 0.03 + a);
  const cy = ankle.y + dir.y * (h * 0.03 + a);
  const ang = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  const rim = h * 0.018;
  const sw = h * 0.0055;
  const rows = 7;
  const cols = 5;
  const shin = { x: knee.x - ankle.x, y: knee.y - ankle.y };
  const hl = handle * 0.62;
  const hEnd = { x: ankle.x + shin.x * hl, y: ankle.y + shin.y * hl };
  const gStart = { x: ankle.x + shin.x * hl * 0.55, y: ankle.y + shin.y * hl * 0.55 };
  const throat = { x: ankle.x + dir.x * h * 0.03, y: ankle.y + dir.y * h * 0.03 };
  return (
    <g>
      {handle > 0.001 ? (
        <g strokeLinecap="round">
          <line x1={throat.x} y1={throat.y} x2={hEnd.x} y2={hEnd.y} stroke={XRAY.bone} strokeWidth={h * 0.028} />
          <line x1={gStart.x} y1={gStart.y} x2={hEnd.x} y2={hEnd.y} stroke={XRAY.pink} strokeWidth={h * 0.034} />
        </g>
      ) : null}
      <g transform={`translate(${cx} ${cy}) rotate(${ang})`}>
        <defs>
          <clipPath id={`rk-${id}`}>
            <ellipse rx={a} ry={b} />
          </clipPath>
        </defs>
        <ellipse rx={a} ry={b} fill={XRAY.bg} opacity={0.55 * grow} />
        <g clipPath={`url(#rk-${id})`} stroke={XRAY.lime} strokeWidth={sw} strokeLinecap="round" opacity={strings}>
          {Array.from({ length: rows }, (_, i) => {
            const u = -a + ((i + 1) * 2 * a) / (rows + 1);
            return <line key={`c${i}`} x1={u} y1={-b} x2={u} y2={b} />;
          })}
          {Array.from({ length: cols }, (_, i) => {
            const v = -b + ((i + 1) * 2 * b) / (cols + 1);
            return <line key={`r${i}`} x1={-a} y1={v} x2={a} y2={v} opacity={grow} />;
          })}
        </g>
        <ellipse rx={a} ry={b} fill="none" stroke={XRAY.bone} strokeWidth={rim} opacity={Math.min(1, grow * 1.4)} />
      </g>
      {/* Face normal marker for debugging is not drawn. */}
      <g opacity={0}>
        <line x1={cx} y1={cy} x2={cx + n.x * 10} y2={cy + n.y * 10} />
      </g>
    </g>
  );
};

/** Goal seen side-on in X-ray colours: the near post, the bar end and the net sloping back. */
export const XGoalSide: React.FC<{ view: View; goalX: number; height?: number; depth?: number }> = ({ view, goalX, height = 2.44, depth = 1.8 }) => {
  if (view.kind !== "side") return null;
  const P = (x: number, z: number) => ({ x: view.originX + x * view.ppm, y: view.groundY - z * view.ppm });
  const top = P(goalX, height);
  const base = P(goalX, 0);
  const backTop = P(goalX + depth * 0.5, height * 0.95);
  const backBase = P(goalX + depth, 0);
  const w = Math.max(6, view.ppm * 0.12);
  const net = [];
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    net.push(<line key={`v${i}`} x1={top.x + (backTop.x - top.x) * t} y1={top.y + (backTop.y - top.y) * t} x2={base.x + (backBase.x - base.x) * t} y2={base.y} />);
  }
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    net.push(<line key={`h${i}`} x1={top.x} y1={top.y + (base.y - top.y) * t} x2={backTop.x + (backBase.x - backTop.x) * t} y2={backTop.y + (backBase.y - backTop.y) * t} />);
  }
  return (
    <g>
      <g stroke={XRAY.bone} strokeWidth={2} opacity={0.3}>
        {net}
        <line x1={backTop.x} y1={backTop.y} x2={backBase.x} y2={backBase.y} />
        <line x1={top.x} y1={top.y} x2={backTop.x} y2={backTop.y} />
      </g>
      <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={XRAY.bone} strokeWidth={w} strokeLinecap="round" />
      <circle cx={top.x} cy={top.y} r={w * 0.9} fill={XRAY.bone} />
    </g>
  );
};

// ---------- HUD tag with a hard text swap (s13, s14) ----------

const tagW = (label: string) => label.length * 25 + 86;
/**
 * One HUD pill (same look as SlowMoTag) whose word changes at each step with a hard swap:
 * the old word goes at once and the new word fades in over 4 frames.
 * Two words never share the pill. Before steps[0].at it is hidden; it fades out at `until`.
 */
export const SwapTag: React.FC<{ steps: { at: number; label: string }[]; until: number }> = ({ steps, until }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, steps[0].at, until);
  if (o <= 0.001) return null;
  let i = 0;
  for (let k = 0; k < steps.length; k++) if (frame >= steps[k].at) i = k;
  const cur = steps[i];
  const prev = steps[Math.max(0, i - 1)];
  const slide = i === 0 ? 1 : progress(frame, cur.at, 6, EASE.standard);
  // A longer word gets its full pill at once (text never spills out); a shorter one slides in.
  const w = tagW(cur.label) >= tagW(prev.label) ? tagW(cur.label) : lerp(tagW(prev.label), tagW(cur.label), slide);
  const textO = i === 0 ? 1 : 0.45 + 0.55 * progress(frame, cur.at, 4, EASE.enter);
  const bump = i === 0 ? 1 : 1 + 0.07 * (1 - progress(frame, cur.at, 8, EASE.soft));
  const pulse = 0.6 + 0.4 * Math.sin(frame / 5);
  const rewind = cur.label === "REWIND";
  return (
    <g opacity={o} transform={`translate(70 70) translate(0 33) scale(${bump}) translate(0 -33)`}>
      <rect width={w} height={66} rx={33} fill={PITCH.sky} opacity={0.75} />
      {rewind ? (
        <g fill={CAST.mistake} opacity={0.6 + 0.4 * pulse}>
          <path d="M34 22 L20 33 L34 44 Z" />
          <path d="M48 22 L34 33 L48 44 Z" />
        </g>
      ) : (
        <circle cx={34} cy={33} r={11} fill={CAST.mistake} opacity={pulse} />
      )}
      <text x={60} y={45} fill={PITCH.chalk} opacity={textO} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={4}>
        {cur.label}
      </text>
    </g>
  );
};

export const COLORS = { chalk: PITCH.chalk, accent: PITCH.accent, light: PITCH.light, sky: PITCH.sky, mistake: CAST.mistake };
