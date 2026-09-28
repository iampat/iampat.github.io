// Thumbnail set 5, slot C, for "Three Spins and a Line" (1280x720): CAN YOU MAKE IT DIP?
// Side view of the last half of the chapter 3 volley. The two paths are the real VOLLEY (topspin,
// dips under the bar) and VOLLEY_GHOST (the same kick with no spin, clears the bar) from shots.ts.
// The height is stretched (Z_STRETCH) so the dip reads at thumbnail size; the heights at the goal
// line keep their order: real 1.73 m (under the 2.44 m bar), no spin 2.77 m (over it).
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball } from "../../../kit/Ball";
import { Glow } from "../../../kit/World";
import { SHOTS } from "../../../physics/shots";
import { simulate, type Vec3 } from "../../../physics/sim";
import type { View } from "../../../lib/project";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

const GOAL_M = 16; // goal line, metres from the volley
const BAR_M = 2.44;
const PX = 95; // pixels per metre along the pitch
const Z_STRETCH = 1.9; // height stretch (readability only)
const PZ = PX * Z_STRETCH;
const GOAL_X = 930; // screen x of the goal line
const GY = 650; // ground line
const SX = (m: number) => GOAL_X + (m - GOAL_M) * PX;
const SY = (z: number) => GY - z * PZ;
const HERO_M = 14.3; // where the hero ball sits on the real path

type P2 = { x: number; y: number };

const pathTo = (key: "VOLLEY" | "VOLLEY_GHOST", fromX: number, toX: number): P2[] => {
  const raw = simulate({ ...SHOTS[key], duration: 2 }, 240).map((s) => s.pos);
  const out: P2[] = [];
  for (const p of raw) {
    if (p.x < fromX) continue;
    if (p.x > toX) break;
    out.push({ x: SX(p.x), y: SY(p.z) });
  }
  return out;
};

const LEFT_M = GOAL_M - (GOAL_X + 40) / PX; // just off the left edge
const TRAIL = pathTo("VOLLEY", LEFT_M, HERO_M);
const AHEAD = pathTo("VOLLEY", HERO_M, GOAL_M + 1.05);
const GHOST = pathTo("VOLLEY_GHOST", LEFT_M, 19.0);
const HERO = TRAIL[TRAIL.length - 1];

const SIDE: View = { kind: "side", originX: 0, groundY: 0, ppm: 1 };
// Topspin Line: a meridian tilted forward and bowed a little towards the viewer.
const LINE_N: Vec3 = { x: 0.86, y: -0.3, z: -0.42 };

/** A tapered ribbon along screen points: width goes from w0 (start) to w1 (end). */
const ribbon = (pts: P2[], w0: number, w1: number) => {
  const n = pts.length;
  const L: string[] = [];
  const R: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    L.push(`${(pts[i].x + nx * w).toFixed(1)},${(pts[i].y + ny * w).toFixed(1)}`);
    R.push(`${(pts[i].x - nx * w).toFixed(1)},${(pts[i].y - ny * w).toFixed(1)}`);
  }
  return `M${L.join(" L")} L${R.reverse().join(" L")} Z`;
};

const line = (pts: P2[]) => `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`;

/** Arrowhead at the end of a point list. */
const head = (pts: P2[], size: number) => {
  const end = pts[pts.length - 1];
  const prev = pts[Math.max(0, pts.length - 6)];
  const ang = Math.atan2(end.y - prev.y, end.x - prev.x);
  const tip = { x: end.x + Math.cos(ang) * size * 1.1, y: end.y + Math.sin(ang) * size * 1.1 };
  const l = { x: end.x + Math.cos(ang + Math.PI / 2) * size, y: end.y + Math.sin(ang + Math.PI / 2) * size };
  const r = { x: end.x + Math.cos(ang - Math.PI / 2) * size, y: end.y + Math.sin(ang - Math.PI / 2) * size };
  return `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${l.x.toFixed(1)},${l.y.toFixed(1)} ${r.x.toFixed(1)},${r.y.toFixed(1)}`;
};

/** A curved arrow on a circle round (cx, cy), from angle a0 to a1 (degrees, clockwise on screen when a1 > a0). */
const CurlArrow: React.FC<{ cx: number; cy: number; r: number; a0: number; a1: number; color: string; width: number }> = ({ cx, cy, r, a0, a1, color, width }) => {
  const pts: P2[] = [];
  for (let i = 0; i <= 30; i++) {
    const a = ((a0 + ((a1 - a0) * i) / 30) * Math.PI) / 180;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return (
    <g>
      <path d={line(pts)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={head(pts, width * 1.6)} fill={color} stroke={color} strokeWidth={width * 0.35} strokeLinejoin="round" />
    </g>
  );
};

/** Big headline text with a dark outline and a drop shadow, so it reads on any background. */
const Headline: React.FC<{ x: number; y: number; size: number; fill: string; children: React.ReactNode; anchor?: "start" | "middle" | "end" }> = ({ x, y, size, fill, children, anchor = "start" }) => (
  <g fontFamily={FONTS.title} fontWeight={800} textAnchor={anchor} fontSize={size}>
    <text x={x} y={y + size * 0.07} fill="#060818" stroke="#060818" strokeWidth={size * 0.1} strokeLinejoin="round">
      {children}
    </text>
    <text x={x} y={y} fill="#060818" stroke="#060818" strokeWidth={size * 0.08} strokeLinejoin="round">
      {children}
    </text>
    <text x={x} y={y} fill={fill}>
      {children}
    </text>
  </g>
);

export const Set5C: React.FC = () => {
  const goalX = GOAL_X;
  const barY = SY(BAR_M);
  const netTop = { x: goalX + 1.0 * PX, y: SY(BAR_M * 0.94) };
  const netBase = { x: goalX + 2.0 * PX, y: GY };
  const net: React.ReactNode[] = [];
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    net.push(<line key={`v${i}`} x1={goalX + (netTop.x - goalX) * t} y1={barY + (netTop.y - barY) * t} x2={goalX + (netBase.x - goalX) * t} y2={GY} />);
  }
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    net.push(<line key={`h${i}`} x1={goalX} y1={barY + (GY - barY) * t} x2={netTop.x + (netBase.x - netTop.x) * t} y2={netTop.y + (netBase.y - netTop.y) * t} />);
  }
  // Far post: 7.32 m behind the near post, drawn as a small oblique offset.
  const far = { x: goalX + 70, y: barY - 34 };
  const R = 86; // hero ball radius
  const gEnd = GHOST[GHOST.length - 1];

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s5c-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080B24" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <radialGradient id="s5c-vig" cx={0.55} cy={0.45} r={0.8}>
            <stop offset="0.6" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.55} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#s5c-sky)" />
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={random(`s5c-sx-${i}`) * W} cy={random(`s5c-sy-${i}`) * 380} r={0.8 + random(`s5c-sr-${i}`) * 1.5} fill="#FFFFFF" opacity={0.2 + random(`s5c-so-${i}`) * 0.5} />
        ))}
        {/* Floodlights. */}
        {[
          [120, 44],
          [420, 36],
        ].map(([x, y], i) => (
          <g key={i}>
            <Glow cx={x} cy={y} r={180} color={PITCH.lightSoft} intensity={0.9} rings={10} />
            <rect x={x - 50} y={y - 20} width={100} height={40} rx={14} fill={PITCH.lightSoft} />
          </g>
        ))}
        {/* Stands behind the pitch. */}
        <rect x={0} y={GY - 120} width={W} height={120} fill={PITCH.stands} />
        <rect x={0} y={GY - 136} width={W} height={24} fill={PITCH.standsLight} opacity={0.7} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={0} y={GY - 100 + i * 32} width={W} height={14} rx={7} fill={PITCH.standsLight} opacity={0.45} />
        ))}
        {/* Grass with stripes fanning towards the viewer. */}
        <rect x={0} y={GY} width={W} height={H - GY} fill={PITCH.grassDark} />
        {Array.from({ length: 16 }, (_, i) => {
          const x0 = -300 + i * 130;
          return i % 2 ? <path key={i} d={`M${x0},${GY} L${x0 + 65},${GY} L${x0 + 65 + (x0 + 65 - 640) * 0.9},${H} L${x0 + (x0 - 640) * 0.9},${H} Z`} fill={PITCH.grass} /> : null;
        })}
        <rect x={0} y={GY - 3} width={W} height={6} fill={PITCH.grassLight} />
        {/* Goal, seen almost side-on: the far post sits a little right and up, so the crossbar shows. */}
        <path d={`M${goalX},${barY} L${netTop.x},${netTop.y} L${netBase.x},${netBase.y} L${goalX},${GY} Z`} fill={PITCH.skyHigh} opacity={0.5} />
        <g stroke={PITCH.chalk} strokeWidth={2.4} opacity={0.45}>
          {net}
          <line x1={goalX} y1={barY} x2={netTop.x} y2={netTop.y} />
          <line x1={netTop.x} y1={netTop.y} x2={netBase.x} y2={netBase.y} />
        </g>
        <line x1={far.x} y1={far.y} x2={far.x} y2={GY - 26} stroke={CAST.keeperShade} strokeWidth={12} strokeLinecap="round" opacity={0.75} />
        {/* The no-spin path: dashed, over the bar. */}
        <path d={line(GHOST)} fill="none" stroke={PITCH.chalk} strokeWidth={10} strokeDasharray="18 18" strokeLinecap="round" opacity={0.7} />
        <circle cx={gEnd.x} cy={gEnd.y} r={24} fill="none" stroke={PITCH.chalk} strokeWidth={6} strokeDasharray="11 8" opacity={0.75} />
        {/* The real path: a glowing trail up to the hero ball, then a bold arrow diving under the bar. */}
        <path d={ribbon(TRAIL, 30, 150)} fill={PITCH.light} opacity={0.1} />
        <path d={ribbon(TRAIL, 20, 100)} fill={PITCH.light} opacity={0.2} />
        <path d={ribbon(TRAIL, 10, 52)} fill={PITCH.lightSoft} />
        <path d={ribbon(TRAIL, 4, 24)} fill="#FFFFFF" />
        <path d={line(AHEAD)} fill="none" stroke={PITCH.light} strokeWidth={44} strokeLinecap="round" opacity={0.18} />
        <path d={line(AHEAD)} fill="none" stroke={PITCH.light} strokeWidth={20} strokeLinecap="round" />
        <polygon points={head(AHEAD, 32)} fill={PITCH.light} stroke={PITCH.light} strokeWidth={8} strokeLinejoin="round" />
        {/* Crossbar and near post, drawn over the paths so the ball clearly passes under the bar. */}
        <line x1={goalX} y1={barY} x2={far.x} y2={far.y} stroke={PITCH.chalk} strokeWidth={16} strokeLinecap="round" />
        <line x1={goalX} y1={GY} x2={goalX} y2={barY} stroke={PITCH.chalk} strokeWidth={18} strokeLinecap="round" />
        <rect width={W} height={H} fill="url(#s5c-vig)" />
        {/* The hero ball, diving, with its forward spin (topspin: clockwise here). */}
        <Glow cx={HERO.x} cy={HERO.y} r={R * 2} color={PITCH.lightSoft} intensity={0.9} rings={10} />
        <Ball cx={HERO.x} cy={HERO.y} r={R} view={SIDE} axis={{ x: 0, y: 1, z: 0 }} angle={0} lineNormal={LINE_N} />
        <CurlArrow cx={HERO.x} cy={HERO.y} r={R * 1.32} a0={-150} a1={-40} color={PITCH.light} width={14} />
        <CurlArrow cx={HERO.x} cy={HERO.y} r={R * 1.32} a0={30} a1={140} color={PITCH.light} width={14} />
        {/* Words. */}
        <Headline x={44} y={398} size={72} fill="#FFFFFF">
          CAN YOU MAKE IT
        </Headline>
        <path id="s5c-dip" d="M40,590 C240,590 380,612 520,662" fill="none" />
        <g fontFamily={FONTS.title} fontWeight={800} fontSize={200}>
          <text fill="#060818" stroke="#060818" strokeWidth={20} strokeLinejoin="round" transform="translate(0 14)">
            <textPath href="#s5c-dip">DIP?</textPath>
          </text>
          <text fill="#060818" stroke="#060818" strokeWidth={16} strokeLinejoin="round">
            <textPath href="#s5c-dip">DIP?</textPath>
          </text>
          <text fill={PITCH.light}>
            <textPath href="#s5c-dip">DIP?</textPath>
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
