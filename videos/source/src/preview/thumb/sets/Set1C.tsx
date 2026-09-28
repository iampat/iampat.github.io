// Thumbnail set 1, slot C, for "Three Spins and a Line" (1280x720): THE KEEPER'S VIEW.
// We stand in the goal just behind Chalk. The curler comes at us: it swings out past the
// near post ("it's going wide!") and then bends back inside it, late, into the corner.
// Chalk lunges and his big mitten reaches for it, but the ball is already past his fingers.
// The pitch is a true perspective view from the goal. The path is drawn in screen space:
// a keeper-eye camera flattens the real bend, so the swing is widened to read at thumbnail size.
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball } from "../../../kit/Ball";
import { Player, POSES } from "../../../kit/Player";
import { Glow } from "../../../kit/World";
import { basisOf, project, type View } from "../../../lib/project";
import type { Vec3 } from "../../../physics/sim";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

/** Chalk's back, turned away from the light: a dark grey-blue, so the ball stays the brightest shape. */
const SHADOW = { body: "#7D8198", arm: "#8A8EA5", deep: "#5F6380" };

// World: x towards goal, y = left, z = up. Goal line at GX, centred on y = 0. Kick spot at the origin side.
const GX = 17;
const HORIZON = 344;
const VIEW: View = { kind: "persp", cam: { x: GX + 2, y: 3, z: 2.0 }, yawDeg: 180, pitchDeg: 0, focal: 560, cx: 640, cy: HORIZON };
const P = (x: number, y: number, z = 0) => project({ x, y, z }, VIEW);

type SP = { x: number; y: number };

/** Points along a cubic Bezier. */
const cubic = (a: SP, b: SP, c: SP, d: SP, n: number): SP[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return {
      x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
      y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
    };
  });

/** A tapered ribbon along screen points: width goes from w0 (start) to w1 (end). */
const ribbon = (pts: SP[], w0: number, w1: number, ease = 1.6) => {
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

const quad = (a: SP, b: SP, c: SP, d: SP) => `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)} L${c.x.toFixed(1)},${c.y.toFixed(1)} L${d.x.toFixed(1)},${d.y.toFixed(1)} Z`;

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

/** One mitten glove (kit shape): palm, thumb on the inner side, cuff. Drawn pointing along -y. */
const Mitten: React.FC<{ g: number; side: 1 | -1 }> = ({ g, side }) => (
  <g transform="rotate(180)">
    <rect x={-g * 0.95} y={-g * 0.2} width={g * 1.9} height={g * 2.1} rx={g * 0.9} fill={CAST.keeper} />
    <ellipse cx={-side * g * 0.95} cy={g * 0.55} rx={g * 0.42} ry={g * 0.62} fill={CAST.keeper} transform={`rotate(${-side * 25} ${-side * g * 0.95} ${g * 0.55})`} />
    <rect x={-g * 0.8} y={-g * 0.35} width={g * 1.6} height={g * 0.5} rx={g * 0.25} fill={CAST.keeperShade} />
    <rect x={-g * 0.5} y={g * 0.55} width={g * 1.1} height={g * 0.14} rx={g * 0.07} fill={CAST.keeperShade} opacity={0.7} />
  </g>
);

/**
 * Chalk from just behind his head: the top of his capsule body (cropped by the frame), leaning left,
 * and his left arm stretched out with the mitten reaching for the ball. The mitten is in screen space.
 */
const ChalkPOV: React.FC<{ top: SP; bw: number; tilt: number; glove: SP }> = ({ top, bw, tilt, glove }) => {
  const h = bw / 0.34;
  const rad = (tilt * Math.PI) / 180;
  // Local body frame: origin at the top of the capsule, +y down the body.
  const toScreen = (lx: number, ly: number): SP => ({ x: top.x + lx * Math.cos(rad) - ly * Math.sin(rad), y: top.y + lx * Math.sin(rad) + ly * Math.cos(rad) });
  const S = toScreen(-bw * 0.28, h * 0.17);
  const dx = glove.x - S.x;
  const dy = glove.y - S.y;
  const l = Math.hypot(dx, dy);
  const ux = dx / l;
  const uy = dy / l;
  const g = h * 0.11;
  // The wrist stops short of the glove centre so the cuff sits on the arm.
  const wrist = { x: glove.x - ux * g * 0.2, y: glove.y - uy * g * 0.2 };
  const rot = (Math.atan2(dx, -dy) * 180) / Math.PI;
  // His back faces away from the floodlit haze, so it is in shadow. Only a thin rim on the
  // ball side catches the light, and only the mitten is bright.
  const aw = h * 0.11;
  const rim = 7;
  // The arm's rim is on its left edge (the side near the ball): shift the dark core to the right.
  const nx = -uy * rim;
  const ny = ux * rim;
  return (
    <g>
      <line x1={S.x} y1={S.y} x2={wrist.x} y2={wrist.y} stroke={CAST.keeper} strokeWidth={aw} strokeLinecap="round" />
      <line x1={S.x + nx} y1={S.y + ny} x2={wrist.x + nx} y2={wrist.y + ny} stroke={SHADOW.arm} strokeWidth={aw} strokeLinecap="round" />
      <g transform={`translate(${top.x} ${top.y}) rotate(${tilt})`}>
        <defs>
          <clipPath id="s1c-chalk-body">
            <rect x={-bw / 2} y={0} width={bw} height={h * 0.86} rx={bw / 2} />
          </clipPath>
        </defs>
        <rect x={-bw / 2} y={0} width={bw} height={h * 0.86} rx={bw / 2} fill={CAST.keeper} />
        <g clipPath="url(#s1c-chalk-body)">
          {/* The dark body, shifted away from the ball, leaves a lit rim on the top-left edge. */}
          <rect x={-bw / 2 + rim * 1.3} y={rim * 1.1} width={bw} height={h * 0.86} rx={bw / 2} fill={SHADOW.body} />
          <rect x={bw * 0.12} y={h * 0.06} width={bw * 0.26} height={h * 0.72} rx={bw * 0.13} fill={SHADOW.deep} opacity={0.7} />
        </g>
      </g>
      <g transform={`translate(${wrist.x} ${wrist.y}) rotate(${rot})`}>
        <Mitten g={g} side={1} />
      </g>
    </g>
  );
};

export const Set1C: React.FC = () => {
  // Grass stripes across the view (bands of constant distance from the goal).
  const stripes: React.ReactNode[] = [];
  for (let k = 0; k < 14; k++) {
    const x0 = GX - k * 5;
    const x1 = x0 - 2.5;
    stripes.push(<path key={k} d={quad(P(x0, -60), P(x0, 60), P(x1, 60), P(x1, -60))} fill={PITCH.grass} />);
  }
  const line = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${P(x, y).x.toFixed(1)},${P(x, y).y.toFixed(1)}`).join(" ");
  const arc: [number, number][] = [];
  for (let a = -53; a <= 53; a += 4) {
    const t = (a * Math.PI) / 180;
    arc.push([GX - 11 - 9.15 * Math.cos(t), 9.15 * Math.sin(t)]);
  }
  const spot = P(GX - 11, 0);

  // Tavi at the kick spot, just outside the box and wide of the near post.
  const kick = P(0, -5.4);
  const taviH = 1.55 * kick.scale;

  // The path, from Tavi's boot out past the post and back in.
  const post = { x: 200, w: 30, top: 52 };
  const bar = { y: 52, w: 28 };
  const A: SP = { x: kick.x - 4, y: kick.y - 3 };
  const C1: SP = { x: 130, y: 376 };
  const C2: SP = { x: 40, y: 262 };
  const BALL: SP = { x: 314, y: 164 };
  const pts = cubic(A, C1, C2, BALL, 120);
  const R = 82;

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s1c-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080B25" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <linearGradient id="s1c-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="s1c-haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PITCH.lightSoft} stopOpacity={0} />
            <stop offset="1" stopColor={PITCH.lightSoft} stopOpacity={0.14} />
          </linearGradient>
          <radialGradient id="s1c-vig" cx={0.4} cy={0.4} r={0.8}>
            <stop offset="0.55" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.55} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#s1c-sky)" />
        {Array.from({ length: 46 }, (_, i) => (
          <circle key={i} cx={random(`s1c-sx-${i}`) * W} cy={random(`s1c-sy-${i}`) * 170} r={0.8 + random(`s1c-sr-${i}`) * 1.4} fill="#FFFFFF" opacity={0.2 + random(`s1c-so-${i}`) * 0.45} />
        ))}
        {/* Floodlit haze over the far stand: no lamp heads, so the ball is the only bright disc. */}
        <rect x={0} y={HORIZON - 190} width={W} height={100} fill="url(#s1c-haze)" />
        {/* Far stand. */}
        <rect x={0} y={HORIZON - 78} width={W} height={80} fill={PITCH.stands} />
        <rect x={0} y={HORIZON - 92} width={W} height={20} fill={PITCH.standsLight} opacity={0.7} />
        {[0, 1].map((i) => (
          <rect key={i} x={0} y={HORIZON - 58 + i * 26} width={W} height={12} rx={6} fill={PITCH.standsLight} opacity={0.5} />
        ))}
        {/* Grass and lines. */}
        <rect x={0} y={HORIZON} width={W} height={H - HORIZON} fill={PITCH.grassDark} />
        {stripes}
        <g fill="none" stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.6}>
          <path d={line([[GX - 16.5, -30], [GX - 16.5, 30]])} />
          <path d={line([[GX, -9.16], [GX - 5.5, -9.16], [GX - 5.5, 9.16], [GX, 9.16]])} />
          <path d={line([[GX, -20.16], [GX - 16.5, -20.16]])} />
          <path d={line([[GX, 20.16], [GX - 16.5, 20.16]])} />
          <path d={line(arc)} />
        </g>
        <ellipse cx={spot.x} cy={spot.y} rx={7} ry={3} fill={PITCH.chalk} opacity={0.6} />
        {/* Tavi, just after the kick. */}
        <Player x={kick.x + taviH * 0.05} groundY={kick.y} h={taviH} pose={POSES.follow} face="focus" flip />
        {/* The glowing path. */}
        <path d={ribbon(pts, 20, 150, 2.2)} fill={PITCH.light} opacity={0.1} />
        <path d={ribbon(pts, 12, 100, 2)} fill={PITCH.light} opacity={0.22} />
        <path d={ribbon(pts, 8, 56, 1.3)} fill={PITCH.lightSoft} />
        <path d={ribbon(pts, 3, 26, 1.3)} fill="#FFFFFF" />
        <rect width={W} height={H} fill="url(#s1c-vig)" />
        {/* The near post and the crossbar: we are standing in the goal. */}
        <rect x={post.x - post.w / 2} y={post.top} width={post.w} height={H} fill={PITCH.chalk} />
        <rect x={post.x - post.w / 2} y={bar.y - bar.w / 2} width={W} height={bar.w} rx={bar.w / 2} fill={PITCH.chalk} />
        {/* The ball. */}
        <Glow cx={BALL.x} cy={BALL.y} r={R * 2.3} color={PITCH.lightSoft} intensity={1.6} rings={8} />
        <Ball cx={BALL.x} cy={BALL.y} r={R} view={VIEW} axis={{ x: -0.063, y: -0.45, z: 0.891 }} angle={0} lineNormal={faceLineNormal(-40, 16)} />
        {/* Chalk reaches, too late. */}
        <ChalkPOV top={{ x: 720, y: 560 }} bw={230} tilt={-32} glove={{ x: 515, y: 368 }} />
        {/* The foreground falls into shadow, so the eye goes up to the ball. */}
        <rect x={0} y={440} width={W} height={H - 440} fill="url(#s1c-floor)" />
        {/* Words. */}
        <g fontFamily={FONTS.title} fontWeight={800} transform="translate(-16 26) rotate(-4 900 260)">
          <text x={684} y={196} fontSize={84} fill="#070920" transform="translate(0 7)">
            WHERE IS IT
          </text>
          <text x={684} y={196} fontSize={84} fill="#FFFFFF">
            WHERE IS IT
          </text>
          <text x={666} y={340} fontSize={140} fill="#070920" transform="translate(0 10)">
            GOING?!
          </text>
          <text x={666} y={340} fontSize={140} fill={PITCH.light}>
            GOING?!
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
