// Thumbnail set 3, slot A, for "Three Spins and a Line" (1280x720): THE MISS.
// The cold open. Side view on the floodlit night pitch: the shot sails over the bar towards the
// car park, Tavi points at it and shouts "DOWN! DOWN!", and Chalk does not even move (arms crossed).
// Words: one giant "WHY?!" plus the bubble. His pointing arm lines up with the start of the trail,
// so the eye goes from Tavi along the trail to the ball.
// The flight is the real MISS path from shots.ts (it clears the bar by about 0.6 m). Tavi stands
// nearer the camera than the goal, and the ball is drawn larger than life so its Line reads.
// The yellow arc shows the MISS spin: backspin (the top of the ball turns back towards Tavi).
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball } from "../../../kit/Ball";
import { Player, POSES, solve, type Pose } from "../../../kit/Player";
import { Keeper, KPOSES, type KeeperPose } from "../../../kit/Keeper";
import { Glow } from "../../../kit/World";
import { SHOTS } from "../../../physics/shots";
import { simulate, type Vec3 } from "../../../physics/sim";
import type { View } from "../../../lib/project";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

// World side view: x to the right, z up. The goal line is at GOAL_M metres from the kick.
const PPM = 140;
const GROUND = 668; // ground line of the flight plane (the goal and Chalk stand here)
const HORIZON = 560; // far edge of the grass
const GOAL_M = 18;
const POST_X = 890; // screen x of the near post
const OX = POST_X - GOAL_M * PPM; // screen x of the kick spot (off screen, left)
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const SX = (m: number) => OX + m * PPM;
const SY = (m: number) => GROUND - m * PPM;
const BAR = 2.44;

// The real flight. The ball is shown just past the goal line, above the sloping net.
const MISS = simulate({ ...SHOTS.MISS, ground: true, duration: 3 }, 60);
const BALL_M = 19.3;
const PATH = MISS.filter((s) => s.bounces === 0 && s.pos.x <= BALL_M).map((s) => s.pos);
const BALL_POS = PATH[PATH.length - 1];
const BALL_R = 50;
const LINE_N: Vec3 = { x: 0.92, y: 0.25, z: 0.3 };
const TRAIL_FROM = 430; // screen x where the trail starts (clear of Tavi and his bubble)

// Tavi, nearer the camera: a lower ground line and a bigger body.
const TAVI_H = 450;
const TAVI_X = 186;
const TAVI_GROUND = 712;

// Chalk stands one step off his line, in the goal mouth.
const KEEPER_X = SX(GOAL_M - 0.72);
const KEEPER_H = 2.35 * PPM;

type SP = { x: number; y: number };

/** A tapered ribbon along screen points: width goes from w0 (start) to w1 (end). */
const ribbon = (pts: SP[], w0: number, w1: number, ease = 0.8) => {
  const n = pts.length;
  const L: string[] = [];
  const R: string[] = [];
  let total = 0;
  const acc = [0];
  for (let i = 1; i < n; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    acc.push(total);
  }
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const t = acc[i] / (total || 1);
    const w = (w0 + (w1 - w0) * Math.pow(t, ease)) / 2;
    L.push(`${(pts[i].x + nx * w).toFixed(1)},${(pts[i].y + ny * w).toFixed(1)}`);
    R.push(`${(pts[i].x - nx * w).toFixed(1)},${(pts[i].y - ny * w).toFixed(1)}`);
  }
  return `M${L.join(" L")} L${R.reverse().join(" L")} Z`;
};

/** Chalk's crossed forearms in a darker tone, then the mittens on top (same geometry as Keeper.tsx). */
const FoldedArms: React.FC<{ x: number; groundY: number; h: number; pose: KeeperPose }> = ({ x, groundY, h, pose }) => {
  const Hh = h * pose.stretch;
  const Ww = (h * 0.34) / Math.sqrt(pose.stretch);
  const armLen = h * 0.3;
  const glove = h * 0.11;
  const shoulderY = -Hh * 0.72;
  const seg = (side: 1 | -1, angle: number) => {
    const a = (angle * Math.PI) / 180;
    const sx = side * Ww * 0.42;
    return { sx, ex: sx + side * Math.sin(a) * armLen, ey: shoulderY + Math.cos(a) * armLen };
  };
  const back = seg(1, pose.left);
  const front = seg(-1, pose.right);
  const sw = h * 0.07;
  const forearm = (s: { sx: number; ex: number; ey: number }, key: string) => (
    <g key={key}>
      <line x1={s.sx} y1={shoulderY} x2={s.ex} y2={s.ey} stroke={CAST.keeperShade} strokeWidth={sw} strokeLinecap="round" />
      <line x1={s.sx} y1={shoulderY} x2={s.ex} y2={s.ey} stroke={CAST.keeperEye} strokeWidth={sw} strokeLinecap="round" opacity={0.35} />
    </g>
  );
  const mitten = (side: 1 | -1, s: { ex: number; ey: number }, angle: number) => (
    <g transform={`translate(${s.ex} ${s.ey}) rotate(${-side * angle})`}>
      <rect x={-glove * 0.95} y={-glove * 0.2} width={glove * 1.9} height={glove * 2.1} rx={glove * 0.9} fill={CAST.keeper} />
      <ellipse cx={-side * glove * 0.95} cy={glove * 0.55} rx={glove * 0.42} ry={glove * 0.62} fill={CAST.keeper} transform={`rotate(${-side * 25} ${-side * glove * 0.95} ${glove * 0.55})`} />
      <rect x={-glove * 0.8} y={-glove * 0.35} width={glove * 1.6} height={glove * 0.5} rx={glove * 0.25} fill={CAST.keeperShade} />
      <rect x={-glove * 0.5} y={glove * 0.55} width={glove * 1.1} height={glove * 0.14} rx={glove * 0.07} fill={CAST.keeperShade} opacity={0.7} />
    </g>
  );
  const g0 = { x: front.sx + (front.ex - front.sx) * 0.25, y: shoulderY + (front.ey - shoulderY) * 0.25 };
  return (
    <g transform={`translate(${x + pose.shift * h} ${groundY - pose.lift * h}) rotate(${pose.lean} 0 ${-Hh * 0.45})`}>
      {forearm(back, "back")}
      <line x1={g0.x} y1={g0.y} x2={front.ex} y2={front.ey} stroke={CAST.keeper} strokeWidth={sw + h * 0.035} strokeLinecap="round" />
      {forearm(front, "front")}
      {mitten(1, back, pose.left)}
      {mitten(-1, front, pose.right)}
    </g>
  );
};

/** Side-view goal with a hint of depth: near post, the far post up and back, the bar, the net. */
const Goal: React.FC = () => {
  const base = { x: POST_X, y: GROUND };
  const top = { x: POST_X, y: SY(BAR) };
  const far = { dx: -120, dy: -34 }; // the far post is further away: higher on the grass and shorter
  const farBase = { x: base.x + far.dx, y: base.y + far.dy };
  const farTop = { x: top.x + far.dx, y: top.y + far.dy + 18 };
  const backTop = { x: POST_X + 1.0 * PPM, y: SY(BAR * 0.9) };
  const backBase = { x: POST_X + 1.9 * PPM, y: GROUND };
  const farBackTop = { x: backTop.x + far.dx, y: backTop.y + far.dy + 16 };
  const farBackBase = { x: backBase.x + far.dx, y: backBase.y + far.dy };
  const net: React.ReactNode[] = [];
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    net.push(<line key={`v${i}`} x1={top.x + (backTop.x - top.x) * t} y1={top.y + (backTop.y - top.y) * t} x2={base.x + (backBase.x - base.x) * t} y2={GROUND} />);
  }
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    net.push(<line key={`h${i}`} x1={top.x} y1={top.y + (base.y - top.y) * t} x2={backTop.x + (backBase.x - backTop.x) * t} y2={backTop.y + (backBase.y - backTop.y) * t} />);
  }
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    net.push(<line key={`r${i}`} x1={top.x + (farTop.x - top.x) * t} y1={top.y + (farTop.y - top.y) * t} x2={backTop.x + (farBackTop.x - backTop.x) * t} y2={backTop.y + (farBackTop.y - backTop.y) * t} />);
  }
  const w = 14;
  return (
    <g>
      {/* Far post and the far side of the net. */}
      <path d={`M${farTop.x},${farTop.y} L${farBackTop.x},${farBackTop.y} L${farBackBase.x},${farBackBase.y}`} fill="none" stroke={PITCH.chalk} strokeWidth={3} opacity={0.3} />
      <line x1={farBase.x} y1={farBase.y} x2={farTop.x} y2={farTop.y} stroke={CAST.keeperShade} strokeWidth={w * 0.75} strokeLinecap="round" />
      {/* Net body: the roof and the near side. */}
      <path d={`M${top.x},${top.y} L${farTop.x},${farTop.y} L${farBackTop.x},${farBackTop.y} L${backTop.x},${backTop.y} L${backBase.x},${backBase.y} L${base.x},${base.y} Z`} fill={PITCH.skyHigh} opacity={0.5} />
      <g stroke={PITCH.chalk} strokeWidth={2.2} opacity={0.38}>
        {net}
        <line x1={top.x} y1={top.y} x2={backTop.x} y2={backTop.y} />
        <line x1={backTop.x} y1={backTop.y} x2={backBase.x} y2={backBase.y} />
        <line x1={farTop.x} y1={farTop.y} x2={farBackTop.x} y2={farBackTop.y} />
        <line x1={backTop.x} y1={backTop.y} x2={farBackTop.x} y2={farBackTop.y} />
      </g>
      {/* Crossbar and near post. */}
      <line x1={farTop.x} y1={farTop.y} x2={top.x} y2={top.y} stroke={PITCH.chalk} strokeWidth={w} strokeLinecap="round" />
      <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={PITCH.chalk} strokeWidth={w} strokeLinecap="round" />
    </g>
  );
};

/** A speech bubble: a rounded chalk-white box, a short wide tail towards the speaker's mouth, a dark drop shadow. */
const SpeechBubble: React.FC<{ x: number; y: number; w: number; h: number; tip: SP; text: string; size: number; rot?: number; reach?: number }> = ({ x, y, w, h, tip, text, size, rot = 0, reach = 0.6 }) => {
  // The tail leaves the left end of the bubble and stops part of the way to the mouth.
  const root = { x: x - w * 0.34, y: y + h * 0.05 };
  const end = { x: root.x + (tip.x - root.x) * reach, y: root.y + (tip.y - root.y) * reach };
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  const half = h * 0.24;
  const tail = `M${root.x + nx * half},${root.y + ny * half} Q${root.x + dx * 0.6 + nx * half * 0.2},${root.y + dy * 0.6 + ny * half * 0.2} ${end.x},${end.y} Q${root.x + dx * 0.5 - nx * half * 0.5},${root.y + dy * 0.5 - ny * half * 0.5} ${root.x - nx * half},${root.y - ny * half} Z`;
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <g transform="translate(0 9)" fill="#070920">
        <path d={tail} />
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} />
      </g>
      <path d={tail} fill={PITCH.chalk} />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={PITCH.chalk} />
      <text x={x} y={y + size * 0.36} fill={PITCH.skyHigh} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle">
        {text}
      </text>
    </g>
  );
};

/** Shouting at the ball: leaning back, chin up, the near arm points at the ball (along the start of the trail), the far arm swings back. */
const SHOUT: Pose = { ...POSES.shout, torso: -8, head: -18, nearShoulder: 108, nearElbow: 2, farShoulder: -30, farElbow: 45, nearHip: 6, farHip: -12, farKnee: 14 };

/** A wide-open shouting mouth and a hard brow, drawn over Tavi's small default face. */
const ShoutFace: React.FC<{ head: SP; r: number }> = ({ head, r }) => (
  <g>
    <ellipse cx={head.x + r * 0.6} cy={head.y + r * 0.44} rx={r * 0.2} ry={r * 0.27} fill="#5A1F2E" />
    <ellipse cx={head.x + r * 0.6} cy={head.y + r * 0.56} rx={r * 0.12} ry={r * 0.09} fill="#C8506A" />
    <path d={`M${head.x + r * 0.32},${head.y - r * 0.3} L${head.x + r * 0.72},${head.y - r * 0.18}`} stroke={CAST.hair} strokeWidth={r * 0.1} strokeLinecap="round" />
  </g>
);

/** A spin arc round the ball with an arrowhead at its end. Angles in degrees, screen space (0 = right, 90 = down). */
const SpinArc: React.FC<{ cx: number; cy: number; r: number; from: number; to: number; color: string; width: number }> = ({ cx, cy, r, from, to, color, width }) => {
  const pts: string[] = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  const e = (to * Math.PI) / 180;
  const ex = cx + r * Math.cos(e);
  const ey = cy + r * Math.sin(e);
  const dir = Math.sign(to - from);
  const ux = -Math.sin(e) * dir;
  const uy = Math.cos(e) * dir;
  const sz = width * 1.7;
  const head = `${ex + ux * sz * 1.3},${ey + uy * sz * 1.3} ${ex - uy * sz},${ey + ux * sz} ${ex + uy * sz},${ey - ux * sz}`;
  return (
    <g>
      <g transform="translate(0 5)" opacity={0.6}>
        <polyline points={pts.join(" ")} fill="none" stroke="#070920" strokeWidth={width} strokeLinecap="round" />
        <polygon points={head} fill="#070920" stroke="#070920" strokeWidth={width * 0.4} strokeLinejoin="round" />
      </g>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={head} fill={color} stroke={color} strokeWidth={width * 0.4} strokeLinejoin="round" />
    </g>
  );
};

export const Set3A: React.FC = () => {
  const pts = PATH.map((p) => ({ x: SX(p.x), y: SY(p.z) })).filter((p) => p.x >= TRAIL_FROM);
  const ball = { x: SX(BALL_POS.x), y: SY(BALL_POS.z) };
  const kPose: KeeperPose = { ...KPOSES.crossed, left: -76, right: -71 };

  // Tavi's head, for the bubble tail and the bigger mouth.
  const j = solve(SHOUT, TAVI_H);
  const dy = TAVI_GROUND - j.lowest - (SHOUT.lift ?? 0) * TAVI_H;
  const head = { x: TAVI_X + j.headC.x, y: j.headC.y + dy };
  const mouth = { x: head.x + j.headR * 0.75, y: head.y + j.headR * 0.45 };

  // Grass stripes fanning towards the viewer.
  const stripes: React.ReactNode[] = [];
  const vy = HORIZON - 700;
  for (let i = -12; i < 14; i++) {
    if (i % 2 === 0) continue;
    const x0 = 640 + i * 200;
    const x1 = x0 + 200;
    const t = (HORIZON - vy) / (H + 200 - vy);
    const g0 = 640 + (x0 - 640) * t;
    const g1 = 640 + (x1 - 640) * t;
    stripes.push(<path key={i} d={`M${g0},${HORIZON} L${g1},${HORIZON} L${x1},${H + 200} L${x0},${H + 200} Z`} fill={PITCH.grass} />);
  }

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s3a-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080B24" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <radialGradient id="s3a-vig" cx={0.5} cy={0.45} r={0.78}>
            <stop offset="0.6" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.55} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#s3a-sky)" />
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={random(`s3a-sx-${i}`) * W} cy={random(`s3a-sy-${i}`) * 320} r={0.8 + random(`s3a-sr-${i}`) * 1.5} fill="#FFFFFF" opacity={0.2 + random(`s3a-so-${i}`) * 0.45} />
        ))}
        {/* No floodlight lamp: the ball glow is the one bright light, and the sky above the words stays clear. */}
        {/* Stands behind the pitch. */}
        <path d={`M-40,${HORIZON} L0,${HORIZON - 120} L${W},${HORIZON - 120} L${W + 40},${HORIZON} Z`} fill={PITCH.stands} />
        <rect x={-20} y={HORIZON - 140} width={W + 40} height={26} rx={13} fill={PITCH.standsLight} />
        {[0, 1].map((i) => (
          <rect key={i} x={-20} y={HORIZON - 92 + i * 38} width={W + 40} height={16} rx={8} fill={PITCH.standsLight} opacity={0.75} />
        ))}
        {/* Grass. */}
        <rect x={0} y={HORIZON} width={W} height={H - HORIZON} fill={PITCH.grassDark} />
        {stripes}
        <rect x={0} y={HORIZON - 4} width={W} height={8} fill={PITCH.grassLight} />
        <Goal />
        {/* Chalk: arms folded, not moving, eyes on Tavi. */}
        <ellipse cx={KEEPER_X} cy={GROUND + 4} rx={KEEPER_H * 0.26} ry={KEEPER_H * 0.05} fill="#08261D" opacity={0.5} />
        <Keeper x={KEEPER_X} groundY={GROUND} h={KEEPER_H} pose={kPose} face="thinking" look={-0.7} />
        <FoldedArms x={KEEPER_X} groundY={GROUND} h={KEEPER_H} pose={kPose} />
        {/* The flight: a glowing comet trail, then the ball over the net. */}
        <path d={ribbon(pts, 0, 130, 1.3)} fill={PITCH.light} opacity={0.12} />
        <path d={ribbon(pts, 0, 84, 1.3)} fill={PITCH.light} opacity={0.25} />
        <path d={ribbon(pts, 0, 44, 1.2)} fill={PITCH.lightSoft} />
        <path d={ribbon(pts, 0, 18, 1.1)} fill="#FFFFFF" />
        <Glow cx={ball.x} cy={ball.y} r={150} color={PITCH.lightSoft} intensity={1.7} rings={7} />
        <Ball cx={ball.x} cy={ball.y} r={BALL_R} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={0.6} lineNormal={LINE_N} />
        {/* Backspin: the top of the ball turns back towards Tavi (anticlockwise on screen). */}
        <SpinArc cx={ball.x} cy={ball.y} r={BALL_R + 20} from={55} to={-118} color={PITCH.light} width={10} />
        <rect width={W} height={H} fill="url(#s3a-vig)" />
        {/* Tavi, near the camera, shouting at the ball. */}
        <ellipse cx={TAVI_X + 20} cy={TAVI_GROUND + 2} rx={TAVI_H * 0.22} ry={TAVI_H * 0.04} fill="#08261D" opacity={0.55} />
        <Player x={TAVI_X} groundY={TAVI_GROUND} h={TAVI_H} pose={SHOUT} face="shout" />
        <ShoutFace head={head} r={j.headR} />
        <SpeechBubble x={470} y={366} w={462} h={106} tip={{ x: mouth.x + 4, y: mouth.y + 30 }} text="DOWN! DOWN!" size={62} rot={-4} reach={0.72} />
        {/* Words. */}
        <g fontFamily={FONTS.title} fontWeight={800}>
          <text x={40} y={190} fontSize={190} fill="#070920" transform="translate(0 12)">
            WHY?!
          </text>
          <text x={40} y={190} fontSize={190} fill={PITCH.light}>
            WHY?!
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
