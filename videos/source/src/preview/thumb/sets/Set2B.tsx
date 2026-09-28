// Thumbnail set 2 ("The spin line"), slot B, for "Three Spins and a Line" (1280x720).
// THREE SPINS, CLEAN: three big orange balls in a row, all flying to the right (speed streaks
// on their left), each with its bold white Line and one fat coloured arrow. DRIVE: backspin
// (the arrow turns the top back). CURL: sideways spin (a flat ring). VOLLEY: topspin (the
// mirror arrow turns the top forward). The spin axes and rates are the real ones from shots.ts:
// DRIVE_R and VOLLEY both 4 rev/s (equal smear), CURLER 7 rev/s (7/4 of that smear).
// Faint copies of the Line show how far it turned a moment ago. Words: "3 KICKS. 3 SPINS."
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball } from "../../../kit/Ball";
import { SHOTS } from "../../../physics/shots";
import type { Vec3 } from "../../../physics/sim";
import { basisOf, type View } from "../../../lib/project";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

// Seen from the kicker's right side, a little from above, so a sideways ring shows as an ellipse.
const VIEW: View = { kind: "persp", cam: { x: 0, y: 0, z: 0 }, yawDeg: 90, pitchDeg: -16, focal: 1, cx: 0, cy: 0 };
const B = basisOf(VIEW);

const GRASS_Y = 606;
/** Every ball bottom sits here, just over its label pill. */
const BALL_BOTTOM = 532;
/** Label pills right under the balls. */
const PILL_Y = GRASS_Y - 26;
const STREAK_H = 14;
const STREAK_OPACITY = 0.38;

const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const crossV = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dotV = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const rotate = (p: Vec3, k: Vec3, t: number): Vec3 => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const kxp = crossV(k, p);
  const kdp = dotV(k, p);
  return { x: p.x * c + kxp.x * s + k.x * kdp * (1 - c), y: p.y * c + kxp.y * s + k.y * kdp * (1 - c), z: p.z * c + kxp.z * s + k.z * kdp * (1 - c) };
};

/** Front-half path(s) of the Line (a great circle with normal n) after turning `angle` about `axis`. */
const linePaths = (r: number, n0: Vec3, axis: Vec3, angle: number): string[] => {
  const n = norm(n0);
  const k = norm(axis);
  const helper = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const a1 = norm(crossV(n, helper));
  const a2 = crossV(n, a1);
  const out: string[] = [];
  let seg: string[] = [];
  for (let i = 0; i <= 96; i++) {
    const th = (i / 96) * 2 * Math.PI;
    const local = { x: a1.x * Math.cos(th) + a2.x * Math.sin(th), y: a1.y * Math.cos(th) + a2.y * Math.sin(th), z: a1.z * Math.cos(th) + a2.z * Math.sin(th) };
    const w = rotate(local, k, angle);
    const x = dotV(w, B.right) * r * 0.97;
    const y = -dotV(w, B.up) * r * 0.97;
    if (dotV(w, B.toward) >= 0) seg.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    else if (seg.length) {
      if (seg.length > 1) out.push(`M${seg.join(" L")}`);
      seg = [];
    }
  }
  if (seg.length > 1) out.push(`M${seg.join(" L")}`);
  return out;
};

/** Spin vector of a shot as a direction (right-hand rule). */
const spinAxis = (name: "DRIVE_R" | "CURLER" | "VOLLEY"): Vec3 => norm(SHOTS[name].spin);

type Spin = {
  label: string;
  color: string;
  cx: number;
  axis: Vec3;
  /** Line normal before turning: the Line is a great circle through the spin axis. */
  n: Vec3;
  /** How far the Line turned in the smear, radians (proportional to the spin rate). */
  smear: number;
  ghosts: number;
  r: number;
  /** Speed streaks on the left: [offset from the ball centre as a fraction of r, length px]. */
  streaks: [number, number][];
};

// 4 rev/s gives a smear of 0.5 rad, so the 7 rev/s curler gets 0.875 rad.
const SPINS: Spin[] = [
  { label: "DRIVE", color: PITCH.light, cx: 224, axis: spinAxis("DRIVE_R"), n: { x: 0.7, y: -0.45, z: -0.55 }, smear: 0.5, ghosts: 16, r: 126, streaks: [[-0.55, 62], [0, 76], [0.55, 62]] },
  { label: "CURL", color: PITCH.teal, cx: 594, axis: spinAxis("CURLER"), n: { x: 1, y: 0.42, z: 0.05 }, smear: 0.875, ghosts: 28, r: 146, streaks: [[-0.64, 62], [0.04, 62], [0.66, 62]] },
  { label: "VOLLEY", color: CAST.mistake, cx: 1000, axis: spinAxis("VOLLEY"), n: { x: 0.74, y: -0.26, z: 0.62 }, smear: 0.5, ghosts: 16, r: 126, streaks: [[-0.55, 62], [0, 60], [0.55, 62]] },
];

/** A fat curved arrow on a circle round (cx, cy). Angles in degrees, SVG sense (y down). */
const ArcArrow: React.FC<{ cx: number; cy: number; r: number; from: number; to: number; color: string; width: number }> = ({ cx, cy, r, from, to, color, width }) => {
  const dir = to > from ? 1 : -1;
  const p = (deg: number) => ({ x: cx + Math.cos((deg * Math.PI) / 180) * r, y: cy + Math.sin((deg * Math.PI) / 180) * r });
  const headL = width * 2.2;
  const headDeg = ((headL / r) * 180) / Math.PI;
  const baseDeg = to - dir * headDeg;
  const pts = Array.from({ length: 41 }, (_, i) => p(from + ((baseDeg + dir * 1.5 - from) * i) / 40));
  const tip = p(to);
  const base = p(baseDeg);
  const a = (baseDeg * Math.PI) / 180;
  const nx = Math.cos(a);
  const ny = Math.sin(a);
  const hw = width * 1.35;
  return (
    <g>
      <path d={`M${pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" L")}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={`M${tip.x},${tip.y} L${base.x + nx * hw},${base.y + ny * hw} L${base.x - nx * hw},${base.y - ny * hw} Z`} fill={color} stroke={color} strokeWidth={width * 0.5} strokeLinejoin="round" />
    </g>
  );
};

/** Sideways spin: a flat ring. The back half goes behind the ball, the front half (with the head) in front. */
const RingArrow: React.FC<{ cx: number; cy: number; rx: number; ry: number; color: string; width: number; part: "back" | "front" }> = ({ cx, cy, rx, ry, color, width, part }) => {
  const pt = (deg: number) => ({ x: cx + Math.cos((deg * Math.PI) / 180) * rx, y: cy + Math.sin((deg * Math.PI) / 180) * ry });
  const arc = (d0: number, d1: number) => `M${Array.from({ length: 49 }, (_, i) => pt(d0 + ((d1 - d0) * i) / 48)).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" L")}`;
  // The ring is open at its left end (150..210 degrees): the middle speed streak goes through the gap.
  if (part === "back") return <path d={arc(-12, -150)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" opacity={0.55} />;
  // Near side moves right (anticlockwise from above, the right-footer's curler).
  const tip = pt(-6);
  const base = pt(22);
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const hw = width * 1.35;
  return (
    <g>
      <path d={arc(150, 26)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={`M${tip.x + (dx / L) * 6},${tip.y + (dy / L) * 6} L${base.x + nx * hw},${base.y + ny * hw} L${base.x - nx * hw},${base.y - ny * hw} Z`} fill={color} stroke={color} strokeWidth={width * 0.5} strokeLinejoin="round" />
    </g>
  );
};

/** Three rounded speed bars on the left of a ball: it flies to the right. */
const Streaks: React.FC<{ s: Spin; cy: number; ringCy: number }> = ({ s, cy, ringCy }) => (
  <g opacity={STREAK_OPACITY}>
    {s.streaks.map(([f, len], k) => {
      const oy = f * s.r;
      const y = s.label === "CURL" && f === s.streaks[1][0] ? ringCy : cy + oy;
      const dy = y - cy;
      const edge = s.cx - Math.sqrt(Math.max(0, s.r * s.r - dy * dy));
      const x1 = edge - 14;
      return <rect key={k} x={x1 - len} y={y - STREAK_H / 2} width={len} height={STREAK_H} rx={STREAK_H / 2} fill={s.color} />;
    })}
  </g>
);

/** One ball: speed streaks, the Line with its fading smear, the bold Line, and the arrow. */
const SpinBall: React.FC<{ s: Spin; i: number }> = ({ s, i }) => {
  const R = s.r;
  const cy = BALL_BOTTOM - R;
  const ringCy = cy + 6;
  const clip = `s2b-clip-${i}`;
  const stroke = R * 0.11;
  // A motion smear: many faint copies of the Line where it was a moment ago, fading out.
  const ghosts = Array.from({ length: s.ghosts }, (_, g) => {
    const t = (g + 1) / s.ghosts;
    return { angle: -s.smear * t, opacity: 0.3 * Math.pow(1 - t, 1.6), width: stroke * (1 - 0.25 * t) };
  }).reverse();
  const aw = 23;
  const arcR = R + 30;
  return (
    <g>
      <Streaks s={s} cy={cy} ringCy={ringCy} />
      {s.label === "CURL" ? <RingArrow cx={s.cx} cy={ringCy} rx={R * 1.26} ry={R * 0.42} color={s.color} width={aw} part="back" /> : null}
      <Ball cx={s.cx} cy={cy} r={R} view={VIEW} axis={s.axis} angle={0} lineNormal={s.n} />
      <defs>
        <clipPath id={clip}>
          <circle cx={s.cx} cy={cy} r={R} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <g transform={`translate(${s.cx} ${cy})`}>
          {ghosts.map((g, gi) =>
            linePaths(R, s.n, s.axis, g.angle).map((d, di) => <path key={`${gi}-${di}`} d={d} fill="none" stroke={CAST.ballLine} strokeWidth={g.width} strokeLinecap="round" opacity={g.opacity} />),
          )}
          {/* The Line now, bold, over its smear. */}
          {linePaths(R, s.n, s.axis, 0).map((d, di) => (
            <path key={`main-${di}`} d={d} fill="none" stroke={CAST.ballLine} strokeWidth={R * 0.13} strokeLinecap="round" />
          ))}
        </g>
      </g>
      {/* Mirror arrows: DRIVE turns the top back (backspin), VOLLEY turns it forward (topspin). */}
      {s.label === "DRIVE" ? <ArcArrow cx={s.cx} cy={cy} r={arcR} from={-40} to={-140} color={s.color} width={aw} /> : null}
      {s.label === "CURL" ? <RingArrow cx={s.cx} cy={ringCy} rx={R * 1.26} ry={R * 0.42} color={s.color} width={aw} part="front" /> : null}
      {s.label === "VOLLEY" ? <ArcArrow cx={s.cx} cy={cy} r={arcR} from={-140} to={-40} color={s.color} width={aw} /> : null}
    </g>
  );
};

/** A dark pool on the grass under a pill, so the pill stands on the ground. */
const PillShadow: React.FC<{ x: number; text: string }> = ({ x, text }) => {
  const w = text.length * 33 + 48;
  return <ellipse cx={x + 6} cy={PILL_Y + 36} rx={w / 2 + 18} ry={17} fill="#06231A" opacity={0.6} />;
};

const Label: React.FC<{ x: number; y: number; text: string; color: string }> = ({ x, y, text, color }) => {
  const w = text.length * 33 + 48;
  return (
    <g>
      <rect x={x - w / 2} y={y - 32} width={w} height={64} rx={32} fill={color} />
      <text x={x} y={y + 15} textAnchor="middle" fontFamily={FONTS.label} fontWeight={800} fontSize={43} fill="#0B0F2C" letterSpacing={1}>
        {text}
      </text>
    </g>
  );
};

export const Set2B: React.FC = () => {
  const stripes: React.ReactNode[] = [];
  for (let i = -6; i < 8; i++) {
    if (i % 2 !== 0) continue;
    const x0 = 640 + i * 150;
    const x1 = x0 + 150;
    stripes.push(<path key={i} d={`M${x0},${GRASS_Y} L${x1},${GRASS_Y} L${640 + (x1 - 640) * 2.2},${H} L${640 + (x0 - 640) * 2.2},${H} Z`} fill={PITCH.grass} />);
  }
  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s2b-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080B24" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <radialGradient id="s2b-pool" cx={0.49} cy={0.56} r={0.55}>
            <stop offset="0" stopColor="#2F3A82" stopOpacity={0.95} />
            <stop offset="1" stopColor="#2F3A82" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="s2b-vig" cx={0.5} cy={0.5} r={0.75}>
            <stop offset="0.6" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.55} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#s2b-sky)" />
        <rect width={W} height={H} fill="url(#s2b-pool)" />
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={random(`s2b-sx-${i}`) * W} cy={random(`s2b-sy-${i}`) * 420} r={0.8 + random(`s2b-sr-${i}`) * 1.3} fill="#FFFFFF" opacity={0.15 + random(`s2b-so-${i}`) * 0.35} />
        ))}
        {/* Stands and grass. */}
        <rect x={0} y={GRASS_Y - 52} width={W} height={54} fill="#1B2150" />
        <rect x={0} y={GRASS_Y - 62} width={W} height={14} rx={7} fill={PITCH.stands} />
        <rect x={0} y={GRASS_Y - 30} width={W} height={10} rx={5} fill={PITCH.stands} />
        <rect x={0} y={GRASS_Y} width={W} height={H - GRASS_Y} fill={PITCH.grassDark} />
        {stripes}
        <rect x={0} y={GRASS_Y} width={W} height={5} fill={PITCH.chalk} opacity={0.5} />
        <rect width={W} height={H} fill="url(#s2b-vig)" />
        {SPINS.map((s) => (
          <PillShadow key={s.label} x={s.cx} text={s.label} />
        ))}
        {SPINS.map((s, i) => (
          <SpinBall key={s.label} s={s} i={i} />
        ))}
        {SPINS.map((s) => (
          <Label key={s.label} x={s.cx} y={PILL_Y} text={s.label} color={s.color} />
        ))}
        {/* Words. */}
        <g fontFamily={FONTS.title} fontWeight={800} textAnchor="middle" fontSize={120}>
          <text x={608} y={146} fill="#050716" transform="translate(0 8)">
            3 KICKS. 3 SPINS.
          </text>
          <text x={608} y={146} fill="#FFFFFF">
            <tspan fill={CAST.ball}>3</tspan> KICKS. <tspan fill={CAST.ball}>3</tspan> SPINS.
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
