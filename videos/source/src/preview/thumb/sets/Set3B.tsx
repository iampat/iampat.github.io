// Thumbnail set 3, slot B, for "Three Spins and a Line" (1280x720): "TOO LATE".
// A low chase camera just behind the ending drive (DRIVE_L from shots.ts): the ball skims into
// the bottom-left corner, Chalk dives low with his head up-left and his top arm flung back, and
// a big gap stays between his mitten and the ball. Night pitch, flat vector style. The ball is
// drawn larger than true scale so it reads at thumbnail size.
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball } from "../../../kit/Ball";
import { Keeper, type KeeperFace, type KeeperPose } from "../../../kit/Keeper";
import { Glow } from "../../../kit/World";
import { SHOTS } from "../../../physics/shots";
import { simulate, type Vec3 } from "../../../physics/sim";
import { basisOf, project, type View } from "../../../lib/project";
import { FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

// World: x towards goal, y = left, z = up. The goal is centred on y = 0.
const GX = 18; // goal line (GOAL_DISTANCE for DRIVE_L)
const GW = 7.32;
const GH = 2.44;
const BALL_X = 17.7; // where the ball is drawn: just before the goal line

const VIEW: View = { kind: "persp", cam: { x: 9, y: 1.5, z: 1.45 }, yawDeg: 8.4, pitchDeg: -3, focal: 1580, cx: 400, cy: 340 };
const P = (x: number, y: number, z: number) => project({ x, y, z }, VIEW);

// The one floodlight: in the sky left of the post, clear of the words and of the top-right corner.
const LAMP = { x: 110, y: 22, r: 170 };

type SP = { x: number; y: number; scale: number };

const PATH_START = 11; // the streak starts 2 m in front of the camera, not at the bottom edge

/** The real ending drive, from just in front of the camera to BALL_X. */
const drivePath = (): Vec3[] => {
  const raw = simulate({ ...SHOTS.DRIVE_L, duration: 1.2 }, 120).map((s) => s.pos);
  const out: Vec3[] = [];
  for (let i = 1; i < raw.length; i++) {
    const p = raw[i];
    if (p.x < PATH_START) continue;
    if (p.x >= BALL_X) {
      const q = raw[i - 1];
      const t = (BALL_X - q.x) / (p.x - q.x);
      out.push({ x: BALL_X, y: q.y + (p.y - q.y) * t, z: q.z + (p.z - q.z) * t });
      break;
    }
    out.push(p);
  }
  return out;
};

const PATH = drivePath();
const END = PATH[PATH.length - 1];

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

/** A tapered ribbon along screen points: width goes from w0 (start) to w1 (end). */
const ribbon = (pts: SP[], w0: number, w1: number, ease = 0.55) => {
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

const quad = (a: SP, b: SP, c: SP, d: SP) =>
  `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)} L${c.x.toFixed(1)},${c.y.toFixed(1)} L${d.x.toFixed(1)},${d.y.toFixed(1)} Z`;

const lerp = (a: SP, b: SP, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Net lines between two edges of a panel. */
const netLines = (a0: SP, a1: SP, b0: SP, b1: SP, n: number, key: string) =>
  Array.from({ length: n - 1 }, (_, i) => {
    const t = (i + 1) / n;
    const p = lerp(a0, a1, t);
    const q = lerp(b0, b1, t);
    return <line key={`${key}${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
  });

// Chalk: started from the middle of the goal, too late. A low dive, head up-left and feet
// down-right (like the dive frame in the video, never past horizontal). His bottom mitten
// reaches at ball height and stops about 115 px short of the ball. His top arm is flung back,
// clear of the words. The dive stays below the words, so he floats only about 27 px over the grass.
const TOO_LATE: KeeperPose = { left: 40, right: 175, lean: -78, shift: 0, lift: -0.18, stretch: 1 };
// "annoyed" has brows and no mouth. On a tilted body, the mouth dot of "surprised" reads as a third eye.
const FACE: KeeperFace = "annoyed";

/** Screen geometry of Chalk's body for a pose (the same transform as Keeper). */
const bodyFrame = (x: number, groundY: number, h: number, pose: KeeperPose) => {
  const Hs = h * pose.stretch;
  const Ws = (h * 0.34) / Math.sqrt(pose.stretch);
  const a = (pose.lean * Math.PI) / 180;
  const pivot = { x: x + pose.shift * h, y: groundY - pose.lift * h - Hs * 0.45 };
  // u: from feet to head. v: the body's own x axis (his left side).
  const u = { x: Math.sin(a), y: -Math.cos(a) };
  const v = { x: Math.cos(a), y: Math.sin(a) };
  const at = (along: number, side: number) => ({ x: pivot.x + u.x * along * Hs + v.x * side * Ws, y: pivot.y + u.y * along * Hs + v.y * side * Ws });
  return { Hs, Ws, pivot, u, v, at };
};

export const Set3B: React.FC = () => {
  // Goal frame (front) and net (back and left side).
  const lb = P(GX, GW / 2, 0);
  const lt = P(GX, GW / 2, GH);
  const rb = P(GX, -GW / 2, 0);
  const rt = P(GX, -GW / 2, GH);
  const blb = P(GX + 2, GW / 2, 0);
  const blt = P(GX + 1.3, GW / 2, GH * 0.92);
  const brb = P(GX + 2, -GW / 2, 0);
  const brt = P(GX + 1.3, -GW / 2, GH * 0.92);
  const postW = Math.max(10, lb.scale * 0.12);

  // Horizon and the far pitch behind the goal.
  const horizon = P(200, 0, 0).y;

  // Grass stripes in front of the goal line (across the camera's view).
  const stripes: React.ReactNode[] = [];
  for (let i = 0; i < 8; i++) {
    const x0 = GX - i * 1.5;
    const x1 = x0 - 1.5;
    if (i % 2 === 0) continue;
    stripes.push(<path key={i} d={quad(P(x0, 12, 0), P(x1, 12, 0), P(x1, -12, 0), P(x0, -12, 0))} fill={PITCH.grass} />);
  }
  const farStripes: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    if (i % 2 === 0) continue;
    const x0 = GX + i * 4;
    const x1 = x0 + 4;
    farStripes.push(<path key={i} d={quad(P(x0, 40, 0), P(x1, 40, 0), P(x1, -40, 0), P(x0, -40, 0))} fill={PITCH.grass} />);
  }

  // Chalk on his goal line, in the middle of the goal.
  const kp = P(GX - 0.3, 0, 0);
  const kh = 2.1 * kp.scale;
  const body = bodyFrame(kp.x, kp.y, kh, TOO_LATE);

  // The drive on screen and the hero ball (drawn 3.1 times true size).
  const pts: SP[] = PATH.map((p) => P(p.x, p.y, p.z));
  const bs = P(END.x, END.y, END.z);
  const R = 0.11 * bs.scale * 3.1;
  const shadow = P(END.x, END.y, 0);

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s3b-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080B24" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <radialGradient id="s3b-vig" cx={0.45} cy={0.55} r={0.8}>
            <stop offset="0.55" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.65} />
          </radialGradient>
          {/* The streak fades in from its first point, so it has no hard cut end in the grass. */}
          <linearGradient id="s3b-tail-g" gradientUnits="userSpaceOnUse" x1={pts[0].x} y1={pts[0].y} x2={bs.x} y2={bs.y}>
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <stop offset="0.45" stopColor="#FFFFFF" stopOpacity={1} />
          </linearGradient>
          <mask id="s3b-tail" maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect width={W} height={H} fill="url(#s3b-tail-g)" />
          </mask>
        </defs>
        <rect width={W} height={H} fill="url(#s3b-sky)" />
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={random(`s3b-sx-${i}`) * W} cy={random(`s3b-sy-${i}`) * 150} r={0.8 + random(`s3b-sr-${i}`) * 1.4} fill="#FFFFFF" opacity={0.2 + random(`s3b-so-${i}`) * 0.4} />
        ))}
        {/* One floodlight, in the sky left of the post (the top-right stays dark for the hover icons). */}
        <Glow cx={LAMP.x} cy={LAMP.y} r={LAMP.r} color={PITCH.lightSoft} intensity={1.4} rings={8} />
        <rect x={LAMP.x - 56} y={LAMP.y - 24} width={112} height={46} rx={16} fill={PITCH.lightSoft} />
        {/* Stands behind the goal. */}
        <rect x={0} y={horizon - 120} width={W} height={122} fill={PITCH.stands} />
        <rect x={0} y={horizon - 140} width={W} height={26} fill={PITCH.standsLight} opacity={0.7} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={0} y={horizon - 96 + i * 32} width={W} height={14} rx={7} fill={PITCH.standsLight} opacity={0.45} />
        ))}
        {/* Far grass behind the goal. */}
        <rect x={0} y={horizon} width={W} height={H - horizon} fill={PITCH.grassDark} />
        {farStripes}
        {/* Net: back panel, left side panel, roof. */}
        <path d={quad(blb, blt, brt, brb)} fill={PITCH.skyHigh} opacity={0.68} />
        <path d={quad(lb, lt, blt, blb)} fill={PITCH.skyHigh} opacity={0.5} />
        <g stroke={PITCH.chalk} strokeWidth={2} opacity={0.3}>
          {netLines(blt, brt, blb, brb, 18, "bc")}
          {netLines(blt, blb, brt, brb, 6, "br")}
          {netLines(lt, blt, lb, blb, 4, "sc")}
          {netLines(lt, lb, blt, blb, 6, "sr")}
          {netLines(lt, rt, blt, brt, 18, "rc")}
          <line x1={blt.x} y1={blt.y} x2={blb.x} y2={blb.y} />
          <line x1={lt.x} y1={lt.y} x2={blt.x} y2={blt.y} />
          <line x1={lb.x} y1={lb.y} x2={blb.x} y2={blb.y} />
        </g>
        {/* Grass in front of the goal line. */}
        <path d={quad(P(GX, 12, 0), P(GX - 14, 12, 0), P(GX - 14, -12, 0), P(GX, -12, 0))} fill={PITCH.grassDark} />
        {stripes}
        <path d={`M${P(GX, 12, 0).x},${P(GX, 12, 0).y} L${P(GX, -12, 0).x},${P(GX, -12, 0).y}`} stroke={PITCH.chalk} strokeWidth={6} opacity={0.8} />
        {/* Goal frame. */}
        <path d={`M${lb.x},${lb.y} L${lt.x},${lt.y} L${rt.x},${rt.y} L${rb.x},${rb.y}`} fill="none" stroke={PITCH.chalk} strokeWidth={postW} strokeLinecap="round" strokeLinejoin="round" />
        {/* Chalk: too late. */}
        <ellipse cx={body.pivot.x - kh * 0.05} cy={kp.y + 4} rx={kh * 0.55} ry={kh * 0.045} fill="#062018" opacity={0.5} />
        {/* Speed strokes behind his feet. */}
        <g stroke={PITCH.chalk} strokeLinecap="round" fill="none">
          {[-0.28, 0.05, 0.36].map((side, i) => {
            const a = body.at(-0.5 - 0.02 * i, side);
            const len = [50, 84, 60][i];
            return <line key={i} x1={a.x} y1={a.y} x2={a.x - body.u.x * len} y2={a.y - body.u.y * len} strokeWidth={7} opacity={0.55} />;
          })}
        </g>
        <Keeper x={kp.x} groundY={kp.y} h={kh} pose={TOO_LATE} face={FACE} look={-0.8} />
        {/* The drive: a glowing streak into the corner. */}
        <g mask="url(#s3b-tail)">
          <path d={ribbon(pts, 80, R * 1.6)} fill={PITCH.light} opacity={0.1} />
          <path d={ribbon(pts, 50, R * 1.2)} fill={PITCH.light} opacity={0.22} />
          <path d={ribbon(pts, 26, R * 0.7)} fill={PITCH.lightSoft} />
          <path d={ribbon(pts, 11, R * 0.3)} fill="#FFFFFF" />
        </g>
        <ellipse cx={shadow.x} cy={shadow.y + 2} rx={R * 1.1} ry={R * 0.22} fill="#062018" opacity={0.5} />
        <Glow cx={bs.x} cy={bs.y} r={R * 2.6} color={PITCH.lightSoft} intensity={1.8} rings={6} />
        <Ball cx={bs.x} cy={bs.y} r={R} view={VIEW} axis={{ x: 0, y: 0, z: 1 }} angle={0} lineNormal={faceLineNormal(50, 8)} />
        <rect width={W} height={H} fill="url(#s3b-vig)" />
        {/* Words. */}
        <g fontFamily={FONTS.title} fontWeight={800} textAnchor="start">
          <text x={300} y={180} fontSize={118} fill="#070920" transform="translate(0 9)">
            TOO LATE,
          </text>
          <text x={300} y={180} fontSize={118} fill="#FFFFFF">
            TOO LATE,
          </text>
          <text x={300} y={304} fontSize={138} fill="#070920" transform="translate(0 10)">
            CHALK!
          </text>
          <text x={300} y={304} fontSize={138} fill={PITCH.light}>
            CHALK!
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
