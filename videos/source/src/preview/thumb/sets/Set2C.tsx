// Thumbnail set 2, slot C, for "Three Spins and a Line" (1280x720): DRAWING THE LINE.
// The cold-open moment: nine at night, Tavi kneels on the grass and draws one white chalk
// line around the orange ball. The line crosses the whole front face; the chalk stick sits on its end.
// Side view, close and low. The ball is drawn larger than life so the line reads at 320 px.
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball, linePoint } from "../../../kit/Ball";
import { Player, solve, type Pose } from "../../../kit/Player";
import { Keeper, KPOSES } from "../../../kit/Keeper";
import { GoalSide } from "../../../kit/Goal";
import { Glow } from "../../../kit/World";
import type { View } from "../../../lib/project";
import type { Vec3 } from "../../../physics/sim";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

const GROUND = 700;
const HORIZON = 400;
const TH = 820; // Tavi's standing height in pixels
const HIP_X = 194;

// The ball, larger than life, just in front of Tavi's front boot.
const BALL_R = 146;
const BALL = { x: HIP_X + 442, y: GROUND - BALL_R };
const SIDE: View = { kind: "side", originX: 0, groundY: GROUND, ppm: 60 };
const FAR: View = { kind: "side", originX: 1060, groundY: HORIZON + 40, ppm: 50 };
// The Line's circle runs over the top of the ball like a tilted ring. The spin axis equals
// LINE_N, so START only slides the point where the chalk started: just round the right edge.
const LINE_N: Vec3 = { x: -0.2, y: -0.62, z: -0.76 };
const START = 0.4 * Math.PI * 2;
const DRAW = 0.55;

// The chalk tip sits on the end of the drawn part; the stick leans back up to Tavi's hand.
const TIP0 = linePoint(SIDE, BALL_R, DRAW * Math.PI * 2, LINE_N, LINE_N, START);
const TIP = { x: BALL.x + TIP0.x, y: BALL.y + TIP0.y };
const STICK_LEN = 132;
const STICK_DEG = 56;
const STICK_ELEV = (STICK_DEG * Math.PI) / 180;
const HAND = { x: TIP.x - STICK_LEN * Math.cos(STICK_ELEV), y: TIP.y - STICK_LEN * Math.sin(STICK_ELEV) };

/** Kneeling on the left (far) knee, toes tucked, front thigh flat, head bowed over the ball. */
const BODY: Pose = {
  torso: 30,
  head: 50,
  nearHip: 88,
  nearKnee: 88,
  nearAnkle: 92,
  farHip: 4,
  farKnee: 127, // far shin rises about 33 degrees back to the ankle
  farAnkle: 57, // toes tucked under: the far boot stands on its toe, in the frame
  nearShoulder: 40,
  nearElbow: 40,
  farShoulder: 8,
  farElbow: 24,
};

/** Two-bone reach: near-arm angles that put the hand on `target` (screen px), elbow down. */
const reach = (pose: Pose, target: { x: number; y: number }): Pose => {
  const j = solve(pose, TH);
  const dy = GROUND - j.lowest - (pose.lift ?? 0) * TH;
  const sh = { x: HIP_X + j.sh.x, y: j.sh.y + dy };
  const u = 0.165 * TH;
  const f = 0.155 * TH;
  const dx = target.x - sh.x;
  const dz = target.y - sh.y;
  const L = Math.min(Math.hypot(dx, dz), u + f - 1);
  const phi = Math.atan2(dx, dz); // limb angle convention: 0 = down, positive = forward
  const beta = Math.acos((u * u + L * L - f * f) / (2 * u * L));
  const upper = phi - beta;
  const elbow = { x: sh.x + Math.sin(upper) * u, y: sh.y + Math.cos(upper) * u };
  const fore = Math.atan2(target.x - elbow.x, target.y - elbow.y);
  const deg = (r: number) => (r * 180) / Math.PI;
  return { ...pose, nearShoulder: deg(upper), nearElbow: deg(fore - upper) };
};

const KNEEL = reach(BODY, HAND);

/** A flat floodlight head with a concentric glow. */
const Lamp: React.FC<{ x: number; y: number; w: number; glow: number }> = ({ x, y, w, glow }) => (
  <g>
    <Glow cx={x} cy={y} r={glow} color={PITCH.lightSoft} intensity={0.84} rings={16} />
    <rect x={x - w / 2} y={y - w * 0.3} width={w} height={w * 0.6} rx={w * 0.18} fill={PITCH.lightSoft} />
  </g>
);

export const Set2C: React.FC = () => {
  const stickW = 29;
  const stickAng = 180 + STICK_DEG;

  // The drawn part of the Line, front half only, redrawn thicker with a soft chalk glow.
  const segs: string[] = [];
  let cur: string[] = [];
  const steps = 140;
  for (let i = 0; i <= steps; i++) {
    const p = linePoint(SIDE, BALL_R, (DRAW * Math.PI * 2 * i) / steps, LINE_N, LINE_N, START);
    if (p.front) cur.push(`${(BALL.x + p.x).toFixed(1)},${(BALL.y + p.y).toFixed(1)}`);
    else if (cur.length) {
      segs.push(`M${cur.join(" L")}`);
      cur = [];
    }
  }
  if (cur.length > 1) segs.push(`M${cur.join(" L")}`);

  // Grass stripes fan out from a far vanishing point.
  const vx = 700;
  const vy = HORIZON - 700;
  const stripes: React.ReactNode[] = [];
  for (let i = -12; i < 14; i++) {
    if (i % 2 !== 0) continue;
    const b0 = vx + i * 210;
    const b1 = b0 + 210;
    const t = (HORIZON - vy) / (H + 200 - vy);
    stripes.push(
      <path key={i} d={`M${vx + (b0 - vx) * t},${HORIZON} L${vx + (b1 - vx) * t},${HORIZON} L${b1},${H + 200} L${b0},${H + 200} Z`} fill={PITCH.grass} />,
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s2c-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080B24" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <radialGradient id="s2c-vig" cx={0.5} cy={0.55} r={0.75}>
            <stop offset="0.5" stopColor="#040614" stopOpacity={0} />
            <stop offset="1" stopColor="#040614" stopOpacity={0.7} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#s2c-sky)" />
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={random(`s2c-sx-${i}`) * W} cy={random(`s2c-sy-${i}`) * 250} r={0.8 + random(`s2c-sr-${i}`) * 1.5} fill="#FFFFFF" opacity={0.2 + random(`s2c-so-${i}`) * 0.5} />
        ))}
        {/* Stands on the far side. */}
        <path d={`M-40,${HORIZON} L-10,${HORIZON - 110} L${W + 10},${HORIZON - 110} L${W + 40},${HORIZON} Z`} fill={PITCH.stands} />
        <rect x={-20} y={HORIZON - 128} width={W + 40} height={24} rx={12} fill={PITCH.standsLight} />
        {[0, 1].map((i) => (
          <rect key={i} x={-20} y={HORIZON - 80 + i * 34} width={W + 40} height={14} rx={7} fill={PITCH.standsLight} opacity={0.55} />
        ))}
        {/* Floodlights. */}
        <Lamp x={96} y={70} w={124} glow={260} />
        <Lamp x={500} y={44} w={96} glow={200} />
        {/* Grass. */}
        <rect x={0} y={HORIZON} width={W} height={H - HORIZON} fill={PITCH.grassDark} />
        {stripes}
        <rect x={0} y={HORIZON - 3} width={W} height={6} fill={PITCH.grassLight} />
        {/* Far away: the goal, and Chalk waiting in it. */}
        <GoalSide view={FAR} goalX={0} netOpacity={0.3} />
        <Keeper x={FAR.originX - 0.9 * FAR.ppm} groundY={FAR.groundY} h={2.1 * FAR.ppm} pose={KPOSES.crossed} face="thinking" look={-1} />
        {/* Pool of floodlight on the grass. */}
        {Array.from({ length: 16 }, (_, i) => {
          const k = (i + 1) / 16;
          return <ellipse key={i} cx={HIP_X + 426} cy={GROUND + 4} rx={620 * k} ry={110 * k} fill={PITCH.lightSoft} opacity={0.0053 * (16 - i)} />;
        })}
        {/* Warm light behind Tavi and the ball, so his hair stands clear of the stands. */}
        <Glow cx={HIP_X + 310} cy={340} r={330} color={PITCH.lightSoft} intensity={0.65} rings={16} />
        {/* Tavi, kneeling. */}
        <ellipse cx={HIP_X + 60} cy={GROUND + 2} rx={280} ry={24} fill="#07261C" opacity={0.5} />
        <Player x={HIP_X} groundY={GROUND} h={TH} pose={KNEEL} face="smug" />
        {/* The ball and its drawn line. */}
        <ellipse cx={BALL.x + 16} cy={GROUND + 2} rx={BALL_R * 1.05} ry={BALL_R * 0.18} fill="#07261C" opacity={0.6} />
        <Ball cx={BALL.x} cy={BALL.y} r={BALL_R} view={SIDE} axis={LINE_N} angle={START} lineNormal={LINE_N} showLine={false} />
        <clipPath id="s2c-ball">
          <circle cx={BALL.x} cy={BALL.y} r={BALL_R} />
        </clipPath>
        <g clipPath="url(#s2c-ball)" fill="none" stroke={PITCH.chalk} strokeLinecap="round" strokeLinejoin="round">
          {segs.map((d, i) => (
            <g key={i}>
              <path d={d} strokeWidth={BALL_R * 0.42} opacity={0.1} />
              <path d={d} strokeWidth={BALL_R * 0.26} opacity={0.2} />
              <path d={d} strokeWidth={BALL_R * 0.135} stroke="#FFFFFF" />
            </g>
          ))}
        </g>
        {/* The chalk stick: white chalk in an orange holder, gripped in the near hand. */}
        <Glow cx={TIP.x} cy={TIP.y} r={60} color={PITCH.chalk} intensity={1.8} rings={8} />
        <g transform={`translate(${TIP.x} ${TIP.y}) rotate(${stickAng})`}>
          <rect x={6} y={-stickW / 2 + 10} width={STICK_LEN + 20} height={stickW} rx={stickW / 2} fill="#8A3A12" opacity={0.35} />
          <rect x={-stickW * 0.35} y={-stickW / 2} width={STICK_LEN + 34} height={stickW} rx={stickW / 2} fill={PITCH.chalk} />
          <rect x={STICK_LEN * 0.42} y={-stickW / 2 - 3} width={STICK_LEN * 0.58 + 40} height={stickW + 6} rx={(stickW + 6) / 2} fill={PITCH.accent} />
        </g>
        <circle cx={HAND.x} cy={HAND.y} r={0.044 * TH} fill={CAST.skin} />
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={i} cx={TIP.x + (random(`s2c-dx-${i}`) - 0.6) * 60} cy={TIP.y - 8 - random(`s2c-dy-${i}`) * 36} r={2 + random(`s2c-dr-${i}`) * 4} fill={PITCH.chalk} opacity={0.45 + random(`s2c-do-${i}`) * 0.45} />
        ))}
        <rect width={W} height={H} fill="url(#s2c-vig)" />
        {/* Words. */}
        <g fontFamily={FONTS.title} fontWeight={800} textAnchor="end">
          <text x={1110} y={124} fontSize={100} fill="#070920" transform="translate(0 8)">
            I DREW
          </text>
          <text x={1110} y={124} fontSize={100} fill="#FFFFFF">
            I DREW
          </text>
          <text x={1018} y={250} fontSize={110} letterSpacing={-2} fill="#070920" transform="translate(0 10)">
            ONE LINE
          </text>
          <text x={1018} y={250} fontSize={110} letterSpacing={-2} fill={PITCH.light}>
            ONE LINE
          </text>
        </g>
        {/* The "..." is three chalk dots, like the part of the line still to draw. */}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <circle cx={1042 + i * 31} cy={250 - 12 + 10} r={11.5} fill="#070920" />
            <circle cx={1042 + i * 31} cy={250 - 12} r={11.5} fill={PITCH.chalk} />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};
