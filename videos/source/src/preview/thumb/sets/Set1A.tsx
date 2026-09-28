// Thumbnail concept A for "Three Spins and a Line" (1280x720): "THE BEND".
// A big orange ball with its white Line in front, a glowing curler path that bends around a
// chalk wall into the top corner, and Chalk diving too late. Night pitch, flat vector style.
// The path is the real CURLER flight from shots.ts, seen from a camera behind and left of the
// kicker. Its sideways bend is widened (BEND) so the curve reads at thumbnail size.
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball } from "../../../kit/Ball";
import { Keeper } from "../../../kit/Keeper";
import { SHOTS } from "../../../physics/shots";
import { simulate, type Vec3 } from "../../../physics/sim";
import { basisOf, project, type View } from "../../../lib/project";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

// World: x towards goal, y = left, z = up. The goal is centred on y = 0.
const KY = -2.82; // kick spot (right of centre)
const GX = 17; // goal line, metres from the kick
const GW = 7.32;
const GH = 2.44;
const BEND = 3; // sideways bend multiplier (for readability only)

const VIEW: View = { kind: "persp", cam: { x: -9, y: KY + 4, z: 3.2 }, yawDeg: -9, pitchDeg: -8, focal: 1450, cx: 270, cy: 285 };
const P = (x: number, y: number, z: number) => project({ x, y, z }, VIEW);

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

type SP = { x: number; y: number; scale: number };

/** The curler path in world metres, from the kick to the goal line. */
const curlerPath = (): Vec3[] => {
  const raw = simulate(SHOTS.CURLER, 60).map((s) => s.pos);
  const out: Vec3[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    if (p.x >= GX) {
      const q = raw[i - 1];
      const t = (GX - q.x) / (p.x - q.x);
      out.push({ x: GX, y: q.y + (p.y - q.y) * t, z: q.z + (p.z - q.z) * t });
      break;
    }
    out.push(p);
  }
  const end = out[out.length - 1];
  // Widen the sideways bend about the chord from the kick to the goal-line crossing.
  return out.map((p) => {
    const chord = (end.y * p.x) / end.x;
    return { x: p.x, y: KY + chord + BEND * (p.y - chord), z: p.z };
  });
};

const PATH = curlerPath();
const CROSS = PATH[PATH.length - 1];

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

const quad = (a: SP, b: SP, c: SP, d: SP) => `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)} L${c.x.toFixed(1)},${c.y.toFixed(1)} L${d.x.toFixed(1)},${d.y.toFixed(1)} Z`;

/** Largest y (left) at distance x that stays well in front of the camera. */
const yMaxAt = (x: number) => {
  let y = 40;
  while (y > 0 && project({ x, y, z: 0 }, VIEW).depth < 1.5) y -= 0.5;
  return y;
};

/** A chalk wall defender, front view: capsule body, dot eyes looking up at the ball. */
const Defender: React.FC<{ x: number; groundY: number; h: number; look: number; seed: number; jump?: number }> = ({ x, groundY, h, look, seed, jump = 0 }) => {
  const w = h * 0.34;
  const tilt = (random(`def-${seed}`) - 0.5) * 6;
  const lift = jump * h * 0.2;
  return (
    <g transform={`translate(${x} ${groundY - lift}) rotate(${tilt} 0 ${-h * 0.4})`}>
      {jump > 0 ? (
        <>
          <ellipse cx={0} cy={lift} rx={w * 0.6} ry={w * 0.14} fill="#08261D" opacity={0.45} />
          <rect x={-w * 0.62} y={-h * 1.12} width={w * 0.26} height={h * 0.46} rx={w * 0.13} fill={CAST.keeperShade} transform={`rotate(-16 ${-w * 0.45} ${-h * 0.7})`} />
          <rect x={w * 0.36} y={-h * 1.12} width={w * 0.26} height={h * 0.46} rx={w * 0.13} fill={CAST.keeperShade} transform={`rotate(16 ${w * 0.45} ${-h * 0.7})`} />
        </>
      ) : null}
      <rect x={-w * 0.36} y={-h * 0.16} width={w * 0.26} height={h * 0.17} rx={w * 0.13} fill={CAST.keeperShade} />
      <rect x={w * 0.1} y={-h * 0.16} width={w * 0.26} height={h * 0.17} rx={w * 0.13} fill={CAST.keeperShade} />
      <rect x={-w / 2} y={-h} width={w} height={h * 0.88} rx={w / 2} fill={CAST.keeper} />
      <rect x={w * 0.14} y={-h * 0.94} width={w * 0.22} height={h * 0.74} rx={w * 0.11} fill={CAST.keeperShade} opacity={0.5} />
      <circle cx={-w * 0.17 + look * w * 0.1} cy={-h * 0.87} r={h * 0.032} fill={CAST.keeperEye} />
      <circle cx={w * 0.17 + look * w * 0.1} cy={-h * 0.87} r={h * 0.032} fill={CAST.keeperEye} />
    </g>
  );
};

/** Soft glow from concentric circles (no blur filters). */
const Glow: React.FC<{ cx: number; cy: number; r: number; color: string; intensity?: number; rings?: number }> = ({ cx, cy, r, color, intensity = 1, rings = 10 }) => (
  <g>
    {Array.from({ length: rings }, (_, i) => {
      const k = (i + 1) / rings;
      return <circle key={i} cx={cx} cy={cy} r={r * k} fill={color} opacity={(0.2 / rings) * (rings - i) * intensity} />;
    })}
  </g>
);

/** Half of a spin ring round the ball, with an arrowhead at its end. `from`/`to` in degrees (ellipse angle). */
const SpinArc: React.FC<{ cx: number; cy: number; rx: number; ry: number; rot: number; from: number; to: number; color: string; width: number }> = ({ cx, cy, rx, ry, rot, from, to, color, width }) => {
  const pts: string[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    pts.push(`${(rx * Math.cos(a)).toFixed(1)},${(ry * Math.sin(a)).toFixed(1)}`);
  }
  const e = (to * Math.PI) / 180;
  const ex = rx * Math.cos(e);
  const ey = ry * Math.sin(e);
  const dir = Math.sign(to - from);
  const tx = -rx * Math.sin(e) * dir;
  const ty = ry * Math.cos(e) * dir;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const s = width * 1.9;
  const head = `${ex + ux * s * 1.1},${ey + uy * s * 1.1} ${ex - uy * s},${ey + ux * s} ${ex + uy * s},${ey - ux * s}`;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={head} fill={color} strokeLinejoin="round" stroke={color} strokeWidth={width * 0.4} />
    </g>
  );
};

export const Set1A: React.FC = () => {
  // Pitch stripes across the kick direction.
  const stripes: React.ReactNode[] = [];
  for (let i = -1; i < 14; i++) {
    if (i % 2 !== 0) continue;
    const x0 = i * 3;
    const x1 = x0 + 3;
    const ym = yMaxAt(x0);
    stripes.push(<path key={i} d={quad(P(x0, ym, 0), P(x1, ym, 0), P(x1, -70, 0), P(x0, -70, 0))} fill={PITCH.grass} />);
  }
  const far = P(45, 0, 0);
  const line = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${P(x, y, 0).x.toFixed(1)},${P(x, y, 0).y.toFixed(1)}`).join(" ");
  const arc: [number, number][] = [];
  for (let a = -53; a <= 53; a += 4) {
    const t = (a * Math.PI) / 180;
    arc.push([GX - 11 - 9.15 * Math.cos(t), 9.15 * Math.sin(t)]);
  }

  // Goal frame and net.
  const gl = P(GX, GW / 2, 0);
  const gr = P(GX, -GW / 2, 0);
  const tl = P(GX, GW / 2, GH);
  const tr = P(GX, -GW / 2, GH);
  const nbl = P(GX + 2, GW / 2, 0);
  const nbr = P(GX + 2, -GW / 2, 0);
  const ntl = P(GX + 1.4, GW / 2, GH * 0.92);
  const ntr = P(GX + 1.4, -GW / 2, GH * 0.92);
  const postW = Math.max(8, gl.scale * 0.16);
  const net: React.ReactNode[] = [];
  for (let i = 1; i < 14; i++) {
    const t = i / 14;
    net.push(<line key={`c${i}`} x1={ntl.x + (ntr.x - ntl.x) * t} y1={ntl.y + (ntr.y - ntl.y) * t} x2={nbl.x + (nbr.x - nbl.x) * t} y2={nbl.y + (nbr.y - nbl.y) * t} />);
  }
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    net.push(<line key={`r${i}`} x1={ntl.x + (nbl.x - ntl.x) * t} y1={ntl.y + (nbl.y - ntl.y) * t} x2={ntr.x + (nbr.x - ntr.x) * t} y2={ntr.y + (nbr.y - ntr.y) * t} />);
  }

  // The path on screen.
  const pts: SP[] = PATH.map((p) => P(p.x, p.y, p.z));
  const kick = pts[0];
  const cross = P(CROSS.x, CROSS.y, CROSS.z);

  // Keeper: stands left of centre, dives right, too late.
  const kp = P(GX - 0.3, 0.9, 0);
  // Full stretch towards the top corner: both gloves past his head, body angled up.
  const dive = { left: 168, right: 176, lean: 66, shift: 0.82, lift: 0.22, stretch: 1.08 };
  // Wall: four defenders 9.15 m out, covering the right half of the goal.
  const wallY = [-1.5, -2.2, -2.9, -3.6];
  const defs = wallY.map((y) => ({ p: P(9.15, y, 0), y }));

  const R = 155; // hero ball radius
  const ball = { x: kick.x, y: kick.y };
  const ring = { rx: R * 1.34, ry: R * 0.34, rot: -8 };

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="ta-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#090C27" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <radialGradient id="ta-vig" cx={0.55} cy={0.5} r={0.75}>
            <stop offset="0.55" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.6} />
          </radialGradient>
          <path id="ta-bend" d="M640,346 Q940,262 1236,338" fill="none" />
        </defs>
        <rect width={W} height={H} fill="url(#ta-sky)" />
        {Array.from({ length: 50 }, (_, i) => (
          <circle key={i} cx={random(`ta-sx-${i}`) * W} cy={random(`ta-sy-${i}`) * 120} r={0.8 + random(`ta-sr-${i}`) * 1.4} fill="#FFFFFF" opacity={0.2 + random(`ta-so-${i}`) * 0.45} />
        ))}
        {/* Floodlights over the goal. */}
        {[
          [110, 36],
          [470, 30],
        ].map(([x, y], i) => (
          <g key={i}>
            <Glow cx={x} cy={y} r={170} color={PITCH.lightSoft} intensity={0.8} />
            <rect x={x - 48} y={y - 20} width={96} height={40} rx={14} fill={PITCH.lightSoft} />
          </g>
        ))}
        {/* Stands behind the goal. */}
        <rect x={0} y={far.y - 86} width={W} height={88} fill={PITCH.stands} />
        <rect x={0} y={far.y - 100} width={W} height={22} fill={PITCH.standsLight} opacity={0.7} />
        {[0, 1].map((i) => (
          <rect key={i} x={0} y={far.y - 62 + i * 30} width={W} height={14} rx={7} fill={PITCH.standsLight} opacity={0.5} />
        ))}
        {/* Grass. */}
        <rect x={0} y={far.y} width={W} height={H - far.y} fill={PITCH.grassDark} />
        {stripes}
        <g fill="none" stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.6}>
          <path d={line([[GX, -40], [GX, 30]])} />
          <path d={line([[GX, -9.16], [GX - 5.5, -9.16], [GX - 5.5, 9.16], [GX, 9.16]])} />
          <path d={line([[GX, -20.16], [GX - 16.5, -20.16], [GX - 16.5, 20.16], [GX, 20.16]])} />
          <path d={line(arc)} />
        </g>
        {/* Net and goal frame. */}
        <path d={quad(nbl, ntl, ntr, nbr)} fill={PITCH.skyHigh} opacity={0.6} />
        <g stroke={PITCH.chalk} strokeWidth={1.6} opacity={0.4}>
          {net}
        </g>
        <path d={`M${gl.x},${gl.y} L${tl.x},${tl.y} L${tr.x},${tr.y} L${gr.x},${gr.y}`} fill="none" stroke={PITCH.chalk} strokeWidth={postW} strokeLinecap="round" strokeLinejoin="round" />
        {/* Chalk, diving too late. */}
        <Keeper x={kp.x} groundY={kp.y} h={1.9 * kp.scale} pose={dive} face="surprised" look={1} />
        {/* The wall. */}
        {defs.map(({ p, y }, i) => (
          <Defender key={i} x={p.x} groundY={p.y} h={1.62 * p.scale} look={0.8} seed={Math.round(y * 10)} jump={i === defs.length - 1 ? 1 : 0} />
        ))}
        {/* The glowing curler path. */}
        <path d={ribbon(pts, 170, 54)} fill={PITCH.light} opacity={0.1} />
        <path d={ribbon(pts, 110, 34)} fill={PITCH.light} opacity={0.22} />
        <path d={ribbon(pts, 56, 17)} fill={PITCH.lightSoft} />
        <path d={ribbon(pts, 26, 8)} fill="#FFFFFF" />
        <Glow cx={cross.x} cy={cross.y} r={86} color={PITCH.lightSoft} intensity={1.6} />
        <Ball cx={cross.x} cy={cross.y} r={18} view={VIEW} />
        <rect width={W} height={H} fill="url(#ta-vig)" />
        {/* The hero ball, its Line and its sideways spin. */}
        <ellipse cx={ball.x + 10} cy={ball.y + R * 0.92} rx={R * 1.05} ry={R * 0.22} fill="#08261D" opacity={0.55} />
        <SpinArc cx={ball.x} cy={ball.y} rx={ring.rx} ry={ring.ry} rot={ring.rot} from={340} to={200} color={PITCH.light} width={12} />
        <Ball cx={ball.x} cy={ball.y} r={R} view={VIEW} axis={{ x: 0, y: 0, z: 1 }} angle={0} lineNormal={faceLineNormal(62, 28)} />
        <SpinArc cx={ball.x} cy={ball.y} rx={ring.rx} ry={ring.ry} rot={ring.rot} from={160} to={20} color={PITCH.light} width={12} />
        {/* Words. */}
        <g fontFamily={FONTS.title} fontWeight={800} textAnchor="end">
          <text x={1230} y={148} fontSize={116} fill="#070920" transform="translate(0 9)">
            WHY IT
          </text>
          <text x={1230} y={148} fontSize={116} fill="#FFFFFF">
            WHY IT
          </text>
          <text fontSize={164} fill="#070920" transform="translate(0 11)">
            <textPath href="#ta-bend" startOffset="100%">
              BENDS
            </textPath>
          </text>
          <text fontSize={164} fill={PITCH.light}>
            <textPath href="#ta-bend" startOffset="100%">
              BENDS
            </textPath>
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
