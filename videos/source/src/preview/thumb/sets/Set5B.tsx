// Thumbnail set 5, slot B, for "Three Spins and a Line" (1280x720): "WHY DOES MY SHOT GO OVER?".
// Front view, from the kicker's side. The goal fills the frame and the question sits in the goal
// mouth, where the ball must go. The ball sails over the bar into the night sky on a glowing trail.
// Tavi stands in the bottom-left corner, head tipped back, pointing at it, with a small "?!".
// Honest to the video: the cold-open shot clears the bar and flies on, still rising, towards the
// car park. The trail rises all the way to the ball (no dip). The ball is drawn larger than life
// so its white Line reads at thumbnail size. The trail tail fades so it does not double the post.
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball } from "../../../kit/Ball";
import { Player, type Pose } from "../../../kit/Player";
import { Glow } from "../../../kit/World";
import type { Vec3 } from "../../../physics/sim";
import { basisOf, type View } from "../../../lib/project";
import { FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

// The camera looks at the goal from the kicker's side (for the ball's shading and Line).
const VIEW: View = { kind: "persp", cam: { x: -4, y: 0, z: 1.2 }, yawDeg: 0, pitchDeg: 4, focal: 1400, cx: 640, cy: 360 };

// Goal frame on screen.
const GL = 344; // left post x
const GR = 1172; // right post x
const BAR = 290; // crossbar centre y
const BASE = 636; // goal line y
const POST = 26; // post and bar thickness
const HORIZON = 470;

// The ball, over the bar.
const BALL = { x: 892, y: 136, r: 72 };

/** A Line normal that draws the Line across the ball's face: screen direction alpha, bowed by phi. */
const faceLineNormal = (alphaDeg: number, phiDeg: number): Vec3 => {
  const b = basisOf(VIEW);
  const a = (alphaDeg * Math.PI) / 180;
  const f = (phiDeg * Math.PI) / 180;
  const u = {
    x: -Math.sin(a) * b.right.x + Math.cos(a) * b.up.x,
    y: -Math.sin(a) * b.right.y + Math.cos(a) * b.up.y,
    z: -Math.sin(a) * b.right.z + Math.cos(a) * b.up.z,
  };
  return { x: Math.cos(f) * u.x + Math.sin(f) * b.toward.x, y: Math.cos(f) * u.y + Math.sin(f) * b.toward.y, z: Math.cos(f) * u.z + Math.sin(f) * b.toward.z };
};

type SP = { x: number; y: number };

/** Points on a cubic Bezier. */
const bezier = (a: SP, c1: SP, c2: SP, b: SP, n = 80): SP[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return { x: k[0] * a.x + k[1] * c1.x + k[2] * c2.x + k[3] * b.x, y: k[0] * a.y + k[1] * c1.y + k[2] * c2.y + k[3] * b.y };
  });

/** A tapered ribbon along screen points: width goes from w0 (start) to w1 (end). */
const ribbon = (pts: SP[], w0: number, w1: number, ease = 1) => {
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

// Head tipped back, one arm pointing at the ball as it flies away, the other hand on his head.
const WHAT: Pose = { torso: -6, head: -18, nearHip: 5, nearKnee: 6, nearAnkle: 92, farHip: -6, farKnee: 6, farAnkle: 92, nearShoulder: 118, nearElbow: 8, farShoulder: 172, farElbow: 128 };
const TAVI = { x: 142, ground: 770, h: 400 };

export const Set5B: React.FC = () => {
  // Grass stripes fan out from a far vanishing point.
  const stripes: React.ReactNode[] = [];
  const vx = 700;
  const vy = HORIZON - 700;
  for (let i = -12; i < 14; i++) {
    if (i % 2 === 0) continue;
    const x0 = vx + i * 150;
    const x1 = x0 + 150;
    const t = (HORIZON - vy) / (H + 80 - vy);
    const g0 = vx + (x0 - vx) * t;
    const g1 = vx + (x1 - vx) * t;
    stripes.push(<path key={i} d={`M${g0},${HORIZON} L${g1},${HORIZON} L${x1},${H + 80} L${x0},${H + 80} Z`} fill={PITCH.grass} />);
  }

  // Net: the back of the net sits a little inside the frame (depth).
  const inset = { l: GL + 34, r: GR - 34, t: BAR + 26, b: BASE - 14 };
  const net: React.ReactNode[] = [];
  for (let i = 1; i < 16; i++) {
    const x = inset.l + ((inset.r - inset.l) * i) / 16;
    net.push(<line key={`c${i}`} x1={x} y1={inset.t} x2={x} y2={inset.b} />);
  }
  for (let i = 1; i < 6; i++) {
    const y = inset.t + ((inset.b - inset.t) * i) / 6;
    net.push(<line key={`r${i}`} x1={inset.l} y1={y} x2={inset.r} y2={y} />);
  }

  // The trail: from Tavi's boot, up outside the left post, then still rising over the bar to the ball.
  const trail = bezier({ x: 268, y: 742 }, { x: 236, y: 170 }, { x: 420, y: 168 }, { x: BALL.x - 44, y: BALL.y + 4 });

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s5b-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#070A22" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          {/* The trail fades out behind the ball, like a comet tail. */}
          <linearGradient id="s5b-trail" gradientUnits="userSpaceOnUse" x1={268} y1={742} x2={640} y2={130}>
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0.35} />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity={1} />
          </linearGradient>
          <mask id="s5b-fade">
            <rect width={W} height={H} fill="url(#s5b-trail)" />
          </mask>
          <radialGradient id="s5b-vig" cx={0.5} cy={0.45} r={0.8}>
            <stop offset="0.6" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.55} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#s5b-sky)" />
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={random(`s5b-sx-${i}`) * W} cy={random(`s5b-sy-${i}`) * 300} r={0.8 + random(`s5b-sr-${i}`) * 1.5} fill="#FFFFFF" opacity={0.2 + random(`s5b-so-${i}`) * 0.5} />
        ))}
        {/* Floodlights. */}
        {[
          [90, 46],
          [352, 30],
        ].map(([x, y], i) => (
          <g key={i}>
            <Glow cx={x} cy={y} r={150} color={PITCH.lightSoft} intensity={0.8} rings={7} />
            <rect x={x - 44} y={y - 18} width={88} height={36} rx={13} fill={PITCH.lightSoft} />
          </g>
        ))}
        {/* Stands behind the goal. */}
        <rect x={0} y={HORIZON - 110} width={W} height={112} fill={PITCH.stands} />
        <rect x={0} y={HORIZON - 126} width={W} height={24} rx={0} fill={PITCH.standsLight} opacity={0.7} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={0} y={HORIZON - 88 + i * 30} width={W} height={13} rx={6} fill={PITCH.standsLight} opacity={0.45} />
        ))}
        {/* Grass. */}
        <rect x={0} y={HORIZON} width={W} height={H - HORIZON} fill={PITCH.grassDark} />
        {stripes}
        <line x1={0} y1={BASE} x2={W} y2={BASE} stroke={PITCH.chalk} strokeWidth={5} opacity={0.55} />
        {/* Net (dark, so the words read) and the goal frame. */}
        <path d={`M${GL},${BAR} L${GR},${BAR} L${inset.r},${inset.t} L${inset.r},${inset.b} L${GR},${BASE} L${GL},${BASE} L${inset.l},${inset.b} L${inset.l},${inset.t} Z`} fill="#0B0F2C" opacity={0.55} />
        <rect x={inset.l} y={inset.t} width={inset.r - inset.l} height={inset.b - inset.t} fill="#0B0F2C" opacity={0.78} />
        <g stroke={PITCH.chalk} strokeWidth={2} opacity={0.14}>
          {net}
          <line x1={GL} y1={BAR} x2={inset.l} y2={inset.t} />
          <line x1={GR} y1={BAR} x2={inset.r} y2={inset.t} />
          <line x1={GL} y1={BASE} x2={inset.l} y2={inset.b} />
          <line x1={GR} y1={BASE} x2={inset.r} y2={inset.b} />
        </g>
        <path d={`M${GL},${BASE} L${GL},${BAR} L${GR},${BAR} L${GR},${BASE}`} fill="none" stroke={PITCH.chalk} strokeWidth={POST} strokeLinecap="round" strokeLinejoin="round" />
        {/* The words, in the goal mouth. */}
        <g fontFamily={FONTS.title} fontWeight={800} textAnchor="middle">
          <text x={(GL + GR) / 2} y={400} fontSize={70} fill="#04061A" transform="translate(0 6)">
            WHY DOES MY SHOT
          </text>
          <text x={(GL + GR) / 2} y={400} fontSize={70} fill="#FFFFFF">
            WHY DOES MY SHOT
          </text>
          <text x={(GL + GR) / 2} y={562} fontSize={150} fill="#04061A" transform="translate(0 10)">
            GO OVER?
          </text>
          <text x={(GL + GR) / 2} y={562} fontSize={150} fill={PITCH.light}>
            GO OVER?
          </text>
        </g>
        {/* The glowing trail and the ball over the bar. */}
        <g mask="url(#s5b-fade)">
          <path d={ribbon(trail, 70, 116)} fill={PITCH.light} opacity={0.12} />
          <path d={ribbon(trail, 44, 76)} fill={PITCH.light} opacity={0.22} />
          <path d={ribbon(trail, 20, 38)} fill={PITCH.lightSoft} />
          <path d={ribbon(trail, 8, 16)} fill="#FFFFFF" />
        </g>
        <Glow cx={BALL.x} cy={BALL.y} r={170} color={PITCH.lightSoft} intensity={1.4} rings={8} />
        <Ball cx={BALL.x} cy={BALL.y} r={BALL.r} view={VIEW} lineNormal={faceLineNormal(-40, 9)} />
        {/* Tavi in the corner, and his "?!". */}
        <Player x={TAVI.x} groundY={TAVI.ground} h={TAVI.h} pose={WHAT} face="shout" />
        <g transform="translate(118 262) rotate(-5)">
          <path d="M-62,-44 H62 A26,26 0 0 1 88,-18 V18 A26,26 0 0 1 62,44 H22 L2,74 L-8,44 H-62 A26,26 0 0 1 -88,18 V-18 A26,26 0 0 1 -62,-44 Z" fill="#04061A" opacity={0.5} transform="translate(0 6)" />
          <path d="M-62,-44 H62 A26,26 0 0 1 88,-18 V18 A26,26 0 0 1 62,44 H22 L2,74 L-8,44 H-62 A26,26 0 0 1 -88,18 V-18 A26,26 0 0 1 -62,-44 Z" fill={PITCH.chalk} />
          <text x={0} y={27} fontFamily={FONTS.title} fontWeight={800} fontSize={76} textAnchor="middle" fill={PITCH.sky}>
            ?!
          </text>
        </g>
        <rect width={W} height={H} fill="url(#s5b-vig)" />
      </svg>
    </AbsoluteFill>
  );
};
