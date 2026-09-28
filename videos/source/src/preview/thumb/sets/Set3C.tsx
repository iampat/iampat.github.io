// Thumbnail set 3, slot C, for "Three Spins and a Line" (1280x720): THE GOAL.
// The ending: the low hard drive is in the back of the net, Chalk lies flat on the goal line
// after his late dive, and Tavi jumps with both arms up under the floodlight.
// The goal, the pitch lines and the ball's streak are the real DRIVE_L flight seen from a
// camera on the kicker's left. Tavi and the ball are drawn larger than life so they read small.
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball } from "../../../kit/Ball";
import { Player, solve, type Pose } from "../../../kit/Player";
import { Keeper, type KeeperPose } from "../../../kit/Keeper";
import { Glow } from "../../../kit/World";
import type { Vec3 } from "../../../physics/sim";
import { basisOf, project, type View } from "../../../lib/project";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

// World: kick spot at the origin, x towards goal, y = left, z = up.
const GX = 18;
const GW = 7.32;
const GH = 2.44;
const NET_TOP = { dx: 1.2, z: 2.3 };
const NET_BOT = 2.0;

// Camera on the kicker's left, level with the grass, looking across at the goal.
const VIEW: View = { kind: "persp", cam: { x: 11, y: 12, z: 1.0 }, yawDeg: -58, pitchDeg: 0, focal: 1330, cx: 470, cy: 467 };
const P = (x: number, y: number, z: number) => project({ x, y, z }, VIEW);
type SP = { x: number; y: number };

// The ball at rest in the back of the net. DRIVE_L crosses the goal line at y = 2.69 m,
// z = 0.42 m (inside the left post, from the kicker), so it ends in that back corner.
const BALL_W: Vec3 = { x: GX + 1.62, y: 2.85, z: 0.24 };
const BALL_R = 56;

// The halo centre: behind Tavi's head.
const HALO = { x: 1010, y: 150 };

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

const poly = (pts: SP[]) => `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")} Z`;

/** Largest y (left) at distance x that stays well in front of the camera. */
const yMaxAt = (x: number) => {
  let y = 40;
  while (y > -40 && project({ x, y, z: 0 }, VIEW).depth < 1.2) y -= 0.25;
  return y;
};

/** Push net points away from the ball on screen: the net bulges round it. */
const bulge = (p: SP, c: SP, R: number, k: number): SP => {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const d = Math.hypot(dx, dy);
  const s = 1 + k * Math.exp(-((d / R) ** 2));
  return { x: c.x + dx * s, y: c.y + dy * s };
};

/** A net panel between four world corners, as a grid of lines. a/b = top edge, d/c = bottom edge. */
const NetPanel: React.FC<{ a: Vec3; b: Vec3; c: Vec3; d: Vec3; nu: number; nv: number; ball?: SP; opacity: number; width: number }> = ({ a, b, c, d, nu, nv, ball, opacity, width }) => {
  const at = (u: number, v: number): SP => {
    const top = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u };
    const bot = { x: d.x + (c.x - d.x) * u, y: d.y + (c.y - d.y) * u, z: d.z + (c.z - d.z) * u };
    const p = P(top.x + (bot.x - top.x) * v, top.y + (bot.y - top.y) * v, top.z + (bot.z - top.z) * v);
    return ball ? bulge(p, ball, BALL_R * 2.2, 0.35) : p;
  };
  const lines: string[] = [];
  const steps = 16;
  const path = (f: (s: number) => SP) => `M${Array.from({ length: steps + 1 }, (_, s) => f(s / steps)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`;
  for (let i = 0; i <= nu; i++) lines.push(path((s) => at(i / nu, s)));
  for (let j = 0; j <= nv; j++) lines.push(path((s) => at(s, j / nv)));
  return (
    <g fill="none" stroke={PITCH.chalk} strokeWidth={width} opacity={opacity} strokeLinecap="round">
      {lines.map((l, i) => (
        <path key={i} d={l} />
      ))}
    </g>
  );
};

/** A jump for joy: both arms thrown up in a V, knees tucked back, chest out, face to the sky. */
const JUMP: Pose = {
  torso: -6,
  head: -14,
  nearHip: 26,
  nearKnee: 84,
  nearAnkle: 118,
  farHip: -6,
  farKnee: 70,
  farAnkle: 112,
  nearShoulder: 150,
  nearElbow: 12,
  farShoulder: 204,
  farElbow: -12,
  lift: 0.13,
};

/** Chalk flat on the grass after the late dive (the pose from the video's ending). */
const LIE: KeeperPose = { left: 168, right: 176, lean: -84, shift: -0.62, lift: -0.3, stretch: 1 };

export const Set3C: React.FC = () => {
  // Pitch stripes across the pitch (constant x bands).
  const stripes: React.ReactNode[] = [];
  for (let i = -2; i < 16; i++) {
    if (i % 2 !== 0) continue;
    const x0 = i * 2.5;
    const x1 = x0 + 2.5;
    const y0 = Math.min(yMaxAt(x0), yMaxAt(x1));
    stripes.push(<path key={i} d={poly([P(x0, y0, 0), P(x1, y0, 0), P(x1, -60, 0), P(x0, -60, 0)])} fill={PITCH.grass} />);
  }
  const lineD = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${P(x, y, 0).x.toFixed(1)},${P(x, y, 0).y.toFixed(1)}`).join(" ");

  // Goal corners (L = left post from the kicker = near the camera).
  const L0 = P(GX, GW / 2, 0);
  const LT = P(GX, GW / 2, GH);
  const R0 = P(GX, -GW / 2, 0);
  const RT = P(GX, -GW / 2, GH);
  const postW = Math.max(8, L0.scale * 0.13);
  const ball = P(BALL_W.x, BALL_W.y, BALL_W.z);

  // Tavi, larger than life, in front on the right, facing the goal (mirrored to face left).
  const TH = 500;
  const tavi = { x: 985, ground: 690 };
  const tj = solve(JUMP, TH);
  const tdy = tavi.ground - tj.lowest - (JUMP.lift ?? 0) * TH;
  const head = { x: tavi.x - tj.headC.x, y: tj.headC.y + tdy };
  const hr = tj.headR;

  // Chalk, flat on the goal line, one mitten stretched towards the ball: too late.
  const kp = P(GX - 0.4, -2.3, 0);
  const kh = 2.1 * kp.scale * 1.3;

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s3c-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080B24" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <linearGradient id="s3c-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PITCH.lightSoft} stopOpacity={0.2} />
            <stop offset="1" stopColor={PITCH.lightSoft} stopOpacity={0} />
          </linearGradient>
          <radialGradient id="s3c-vig" cx={0.55} cy={0.45} r={0.8}>
            <stop offset="0.6" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.55} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#s3c-sky)" />
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={random(`s3c-sx-${i}`) * W} cy={random(`s3c-sy-${i}`) * 300} r={0.8 + random(`s3c-sr-${i}`) * 1.5} fill="#FFFFFF" opacity={0.2 + random(`s3c-so-${i}`) * 0.5} />
        ))}
        {/* The floodlight is above the frame. Its glow sits behind Tavi's head as a halo. */}
        <Glow cx={HALO.x} cy={HALO.y} r={300} color={PITCH.lightSoft} intensity={0.8} rings={7} />
        <Glow cx={HALO.x} cy={HALO.y} r={190} color={PITCH.lightSoft} intensity={1.8} rings={5} />
        {/* Far stands. */}
        <rect x={0} y={378} width={W} height={100} fill={PITCH.stands} />
        <rect x={0} y={364} width={W} height={20} rx={10} fill={PITCH.standsLight} />
        {[0, 1].map((i) => (
          <rect key={i} x={0} y={400 + i * 28} width={W} height={13} rx={6.5} fill={PITCH.standsLight} opacity={0.55} />
        ))}
        {/* Grass and lines. */}
        <rect x={0} y={P(80, -40, 0).y} width={W} height={H} fill={PITCH.grassDark} />
        {stripes}
        <g fill="none" stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.55}>
          <path d={lineD([[GX, -40], [GX, yMaxAt(GX)]])} />
          <path d={lineD([[GX, -9.16], [GX - 5.5, -9.16], [GX - 5.5, 9.16], [GX, 9.16]])} />
        </g>
        {/* The floodlight beam and its pool of light on the grass under Tavi. */}
        <path d="M940,-10 L1080,-10 L1250,720 L740,720 Z" fill="url(#s3c-beam)" />
        <ellipse cx={985} cy={690} rx={195} ry={30} fill={PITCH.lightSoft} opacity={0.07} />
        <ellipse cx={985} cy={690} rx={130} ry={20} fill={PITCH.lightSoft} opacity={0.07} />
        {/* Net: far side, back and top panels behind the ball. */}
        <path d={poly([RT, P(GX + NET_TOP.dx, -GW / 2, NET_TOP.z), P(GX + NET_BOT, -GW / 2, 0), R0])} fill={PITCH.skyHigh} opacity={0.35} />
        <path d={poly([P(GX + NET_TOP.dx, GW / 2, NET_TOP.z), P(GX + NET_TOP.dx, -GW / 2, NET_TOP.z), P(GX + NET_BOT, -GW / 2, 0), P(GX + NET_BOT, GW / 2, 0)])} fill={PITCH.skyHigh} opacity={0.35} />
        <NetPanel a={{ x: GX, y: -GW / 2, z: GH }} b={{ x: GX + NET_TOP.dx, y: -GW / 2, z: NET_TOP.z }} c={{ x: GX + NET_BOT, y: -GW / 2, z: 0 }} d={{ x: GX, y: -GW / 2, z: 0 }} nu={5} nv={8} opacity={0.3} width={1.5} />
        <NetPanel a={{ x: GX + NET_TOP.dx, y: GW / 2, z: NET_TOP.z }} b={{ x: GX + NET_TOP.dx, y: -GW / 2, z: NET_TOP.z }} c={{ x: GX + NET_BOT, y: -GW / 2, z: 0 }} d={{ x: GX + NET_BOT, y: GW / 2, z: 0 }} nu={18} nv={7} ball={ball} opacity={0.32} width={1.6} />
        <NetPanel a={{ x: GX, y: GW / 2, z: GH }} b={{ x: GX, y: -GW / 2, z: GH }} c={{ x: GX + NET_TOP.dx, y: -GW / 2, z: NET_TOP.z }} d={{ x: GX + NET_TOP.dx, y: GW / 2, z: NET_TOP.z }} nu={18} nv={3} opacity={0.24} width={1.4} />
        {/* The ball in the net. */}
        <Glow cx={ball.x} cy={ball.y} r={BALL_R * 4} color={PITCH.light} intensity={1.8} rings={6} />
        <Ball cx={ball.x} cy={ball.y} r={BALL_R} view={VIEW} lineNormal={faceLineNormal(-40, 10)} />
        {/* Net: near side panel, in front of the ball. */}
        <NetPanel a={{ x: GX, y: GW / 2, z: GH }} b={{ x: GX + NET_TOP.dx, y: GW / 2, z: NET_TOP.z }} c={{ x: GX + NET_BOT, y: GW / 2, z: 0 }} d={{ x: GX, y: GW / 2, z: 0 }} nu={5} nv={8} ball={ball} opacity={0.45} width={1.8} />
        {/* Impact dashes round the ball. */}
        <g stroke={PITCH.light} strokeWidth={BALL_R * 0.175} strokeLinecap="round">
          {[-160, -125, -90, -55, 165].map((a, i) => {
            const t = (a * Math.PI) / 180;
            const r0 = BALL_R * 1.45;
            const r1 = BALL_R * 2.05;
            return <line key={i} x1={ball.x + Math.cos(t) * r0} y1={ball.y + Math.sin(t) * r0} x2={ball.x + Math.cos(t) * r1} y2={ball.y + Math.sin(t) * r1} />;
          })}
        </g>
        {/* Goal frame. */}
        <path d={`M${L0.x},${L0.y} L${LT.x},${LT.y} L${RT.x},${RT.y} L${R0.x},${R0.y}`} fill="none" stroke={PITCH.chalk} strokeWidth={postW} strokeLinecap="round" strokeLinejoin="round" />
        {/* Chalk, flat on the grass. */}
        <ellipse cx={kp.x - kh * 0.55} cy={kp.y + 2} rx={kh * 0.6} ry={12} fill="#08261D" opacity={0.45} />
        <Keeper x={kp.x} groundY={kp.y} h={kh} pose={LIE} face="annoyed" look={-1} />
        <rect width={W} height={H} fill="url(#s3c-vig)" />
        {/* Tavi. */}
        <ellipse cx={tavi.x} cy={tavi.ground - 2} rx={110} ry={14} fill="#08261D" opacity={0.5} />
        <Player x={tavi.x} groundY={tavi.ground} h={TH} pose={JUMP} face="happy" flip />
        {/* His head again, on top of the raised near arm, so the arm passes behind the face.
            Same shapes as the kit's head (mirrored), with an open, laughing mouth. */}
        <g transform={`translate(${head.x} ${head.y})`}>
          <circle r={hr} fill={CAST.skin} />
          <g fill={CAST.hair}>
            <circle cx={hr * 0.45} cy={-hr * 0.62} r={hr * 0.5} />
            <circle cx={-hr * 0.12} cy={-hr * 0.82} r={hr * 0.45} />
            <circle cx={hr * 0.85} cy={-hr * 0.12} r={hr * 0.38} />
            <circle cx={-hr * 0.55} cy={-hr * 0.62} r={hr * 0.3} />
          </g>
          <ellipse cx={-hr * 0.52} cy={-hr * 0.05} rx={hr * 0.075} ry={hr * 0.11} fill={CAST.keeperEye} />
          <path
            d={`M${-hr * 0.4},${hr * 0.3} L${-hr * 0.8},${hr * 0.34} Q${-hr * 0.76},${hr * 0.7} ${-hr * 0.48},${hr * 0.58} Z`}
            fill="#5A1F2E"
            stroke="#5A1F2E"
            strokeWidth={hr * 0.05}
            strokeLinejoin="round"
          />
          <ellipse cx={-hr * 0.6} cy={hr * 0.54} rx={hr * 0.09} ry={hr * 0.05} fill="#E0707A" />
        </g>
        {/* Words. */}
        <g fontFamily={FONTS.title} fontWeight={800} textAnchor="start" transform="rotate(-3 40 250)">
          <text x={52} y={112} fontSize={88} fill="#070920" transform="translate(0 8)">
            I FINALLY
          </text>
          <text x={52} y={112} fontSize={88} fill="#FFFFFF">
            I FINALLY
          </text>
          <text x={44} y={250} fontSize={152} fill="#070920" transform="translate(0 11)">
            SCORED!
          </text>
          <text x={44} y={250} fontSize={152} fill={PITCH.light}>
            SCORED!
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
