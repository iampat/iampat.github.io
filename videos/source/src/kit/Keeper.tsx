// Chalk: the goalkeeper Tavi made up, drawn in pitch paint.
// A tall capsule with huge mitten gloves, dot eyes and eyebrow dashes. Never speaks.
// Front view (facing the kicker). `rise` grows him out of the goal line.

import React from "react";
import { CAST } from "../theme";

export type KeeperPose = {
  /** Arm angles from straight down, degrees. Positive = out to his side. */
  left: number; // his left = screen right
  right: number; // his right = screen left
  /** Whole-body lean, degrees (positive = towards screen right). */
  lean: number;
  /** Sideways shift in units of body height (positive = screen right). */
  shift: number;
  /** Lift off the ground in units of body height. */
  lift: number;
  /** Squash-and-stretch (1 = normal). */
  stretch: number;
};

export const KPOSES = {
  stand: { left: 18, right: 18, lean: 0, shift: 0, lift: 0, stretch: 1 },
  wide: { left: 80, right: 80, lean: 0, shift: 0, lift: 0, stretch: 1.03 },
  ready: { left: 40, right: 40, lean: 0, shift: 0, lift: 0, stretch: 0.94 },
  diveR: { left: 150, right: 120, lean: 72, shift: 0.55, lift: 0.18, stretch: 1.06 },
  diveL: { left: 120, right: 150, lean: -72, shift: -0.55, lift: 0.18, stretch: 1.06 },
  punchUp: { left: 172, right: 20, lean: 4, shift: 0, lift: 0.12, stretch: 1.08 },
  shrug: { left: 60, right: 60, lean: 0, shift: 0, lift: 0, stretch: 0.96 },
  tapHead: { left: 20, right: 160, lean: -3, shift: 0, lift: 0, stretch: 1 },
  slump: { left: 8, right: 8, lean: 0, shift: 0, lift: 0, stretch: 0.9 },
  crossed: { left: -62, right: -58, lean: 0, shift: 0, lift: 0, stretch: 1 },
  /** Chasing: lean into the run, arms pumping. Alternate runA/runB with keeperPoseAt. */
  runA: { left: 55, right: -35, lean: 14, shift: 0, lift: 0.05, stretch: 1.04 },
  runB: { left: -35, right: 55, lean: 14, shift: 0, lift: 0.01, stretch: 1.0 },
  /** Arrived too late: leaning over, gloves on knees. */
  puffed: { left: 30, right: 30, lean: 0, shift: 0, lift: 0, stretch: 0.86 },
} satisfies Record<string, KeeperPose>;

export type KeeperPoseName = keyof typeof KPOSES;

export const keeperPoseAt = (frame: number, track: [number, KeeperPose | KeeperPoseName][]): KeeperPose => {
  const get = (p: KeeperPose | KeeperPoseName) => (typeof p === "string" ? KPOSES[p] : p);
  if (frame <= track[0][0]) return get(track[0][1]);
  for (let i = 1; i < track.length; i++) {
    if (frame <= track[i][0]) {
      const a = get(track[i - 1][1]);
      const b = get(track[i][1]);
      const t = (frame - track[i - 1][0]) / Math.max(1, track[i][0] - track[i - 1][0]);
      const s = t * t * (3 - 2 * t);
      const m = (k: keyof KeeperPose) => a[k] + (b[k] - a[k]) * s;
      return { left: m("left"), right: m("right"), lean: m("lean"), shift: m("shift"), lift: m("lift"), stretch: m("stretch") };
    }
  }
  return get(track[track.length - 1][1]);
};

export type KeeperFace = "flat" | "smug" | "surprised" | "annoyed" | "thinking";

type Props = {
  /** Screen x of his centre and screen y of the ground. */
  x: number;
  groundY: number;
  /** Body height in pixels. */
  h: number;
  pose: KeeperPose;
  face?: KeeperFace;
  /** 0..1: grows out of the goal line. */
  rise?: number;
  /** Where he looks, -1 (screen left) .. 1 (screen right). */
  look?: number;
  opacity?: number;
  /** Mirror left-right (a lean to the right becomes a lean to the left). */
  flip?: boolean;
};

let keeperIds = 0;

export const Keeper: React.FC<Props> = ({ x, groundY, h, pose, face = "flat", rise = 1, look = 0, opacity = 1, flip = false }) => {
  const [clipId] = React.useState(() => `keeper-rise-${keeperIds++}`);
  const H = h * pose.stretch;
  const W = h * 0.34 / Math.sqrt(pose.stretch);
  const armLen = h * 0.3;
  const glove = h * 0.11;
  const shoulderY = -H * 0.72;
  const arm = (side: 1 | -1, angle: number) => {
    const a = (angle * Math.PI) / 180;
    const sx = side * W * 0.42;
    const ex = sx + side * Math.sin(a) * armLen;
    const ey = shoulderY + Math.cos(a) * armLen;
    return (
      <g key={side}>
        <line x1={sx} y1={shoulderY} x2={ex} y2={ey} stroke={CAST.keeperShade} strokeWidth={h * 0.07} strokeLinecap="round" />
        {/* Mitten glove: a rounded palm, a thumb on the inner side and a cuff. */}
        <g transform={`translate(${ex} ${ey}) rotate(${-side * angle + 180 * 0})`}>
          <rect x={-glove * 0.95} y={-glove * 0.2} width={glove * 1.9} height={glove * 2.1} rx={glove * 0.9} fill={CAST.keeper} transform={`rotate(${0})`} />
          <ellipse cx={-side * glove * 0.95} cy={glove * 0.55} rx={glove * 0.42} ry={glove * 0.62} fill={CAST.keeper} transform={`rotate(${-side * 25} ${-side * glove * 0.95} ${glove * 0.55})`} />
          <rect x={-glove * 0.8} y={-glove * 0.35} width={glove * 1.6} height={glove * 0.5} rx={glove * 0.25} fill={CAST.keeperShade} />
          <rect x={-glove * 0.5} y={glove * 0.55} width={glove * 1.1} height={glove * 0.14} rx={glove * 0.07} fill={CAST.keeperShade} opacity={0.7} />
        </g>
      </g>
    );
  };
  const eyeX = W * 0.18;
  const eyeY = -H * 0.8;
  const lx = look * W * 0.08;
  const brow = (side: 1 | -1) => {
    const tilt = face === "annoyed" ? side * 12 : face === "smug" ? side * -8 : face === "surprised" ? 0 : face === "thinking" ? (side === 1 ? -14 : 6) : 0;
    const by = eyeY - H * (face === "surprised" ? 0.085 : 0.06);
    return (
      <line
        key={`b${side}`}
        x1={side * eyeX - W * 0.07 + lx}
        y1={by}
        x2={side * eyeX + W * 0.07 + lx}
        y2={by}
        stroke={CAST.keeperEye}
        strokeWidth={h * 0.018}
        strokeLinecap="round"
        transform={`rotate(${tilt} ${side * eyeX + lx} ${by})`}
      />
    );
  };
  const eyeR = h * (face === "surprised" ? 0.022 : 0.02);
  return (
    <g opacity={opacity}>
      <defs>
        <clipPath id={clipId}>
          <rect x={x - h * 2} y={groundY - h * 2 * rise} width={h * 4} height={h * 2 * rise + 4} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(${x + pose.shift * h * (flip ? -1 : 1)} ${groundY - pose.lift * h}) scale(${flip ? -1 : 1} 1) rotate(${pose.lean} 0 ${-H * 0.45}) translate(0 ${(1 - rise) * h})`}>
          {/* Legs. */}
          <rect x={-W * 0.32} y={-H * 0.16} width={W * 0.22} height={H * 0.17} rx={W * 0.11} fill={CAST.keeperShade} />
          <rect x={W * 0.1} y={-H * 0.16} width={W * 0.22} height={H * 0.17} rx={W * 0.11} fill={CAST.keeperShade} />
          {pose.right >= 0 ? arm(-1, pose.right) : null}
          {/* Body capsule with a pale shade stripe. */}
          <rect x={-W / 2} y={-H} width={W} height={H * 0.86} rx={W / 2} fill={CAST.keeper} />
          <rect x={W * 0.12} y={-H * 0.93} width={W * 0.26} height={H * 0.72} rx={W * 0.13} fill={CAST.keeperShade} opacity={0.55} />
          {arm(1, pose.left)}
          {pose.right < 0 ? arm(-1, pose.right) : null}
          {/* Face. */}
          <circle cx={-eyeX + lx} cy={eyeY} r={eyeR} fill={CAST.keeperEye} />
          <circle cx={eyeX + lx} cy={eyeY} r={eyeR} fill={CAST.keeperEye} />
          {brow(-1)}
          {brow(1)}
          {face === "smug" ? (
            <path d={`M${-W * 0.1 + lx},${-H * 0.7} Q${lx},${-H * 0.68} ${W * 0.12 + lx},${-H * 0.715}`} fill="none" stroke={CAST.keeperEye} strokeWidth={h * 0.012} strokeLinecap="round" />
          ) : face === "surprised" ? (
            <ellipse cx={lx} cy={-H * 0.69} rx={h * 0.018} ry={h * 0.024} fill={CAST.keeperEye} />
          ) : null}
        </g>
      </g>
    </g>
  );
};
