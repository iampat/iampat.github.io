// Thumbnail set 4, slot C, for "Three Spins and a Line" (1280x720): 1 IN 5 GOALS.
// Tavi volleys a dropping ball (side view, the same drop-and-volley as chapter 3). His ball is the
// lit first ball of a row of five, and the other four are chalk ghosts: the video's dot grid shows
// that about 1 in 5 non-penalty goals at the 2018 + 2022 World Cups and Euro 2020 + 2024 came from
// volleys or half-volleys (96 of 507). The colours match the dot grid: orange for a volley, chalk
// for the other goals. The orange "1" in the headline is the same orange as the lit ball.
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball } from "../../../kit/Ball";
import { Player, solve, type Pose } from "../../../kit/Player";
import { Glow } from "../../../kit/World";
import type { View } from "../../../lib/project";
import { FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

const SIDE: View = { kind: "side", originX: 0, groundY: 0, ppm: 1 };

// Tavi, side view, facing right. A low camera: the stands sit low, so the row of balls floats on the night sky.
const TH = 600; // standing height in px
const HIP_X = 220;
const GROUND = 676;
const HORIZON = 626;

/**
 * Volley contact with the thigh level, so the ball is clearly in the air (ball bottom about 120 px
 * over the grass, shin height: the video says "knee height or lower"). The toes point down and
 * the laces face forward, so the kick reads as a volley and not as a scoop.
 */
const VOLLEY_HIGH: Pose = {
  torso: 18,
  head: 16,
  nearHip: 88,
  nearKnee: 72,
  nearAnkle: 172,
  farHip: -2,
  farKnee: 8,
  farAnkle: 95,
  nearShoulder: -82,
  nearElbow: 26,
  farShoulder: 96,
  farElbow: 12,
};

// Topspin Line: a meridian through the spin axis (y), tilted and bowed a little towards the viewer.
const LINE_N = { x: 0.86, y: -0.28, z: -0.42 };
const TOPSPIN = { x: 0, y: 1, z: 0 };

type P2 = { x: number; y: number };

/** Screen joints of Tavi, the same maths as Player. */
const joints = () => {
  const j = solve(VOLLEY_HIGH, TH);
  const dy = GROUND - j.lowest - (VOLLEY_HIGH.lift ?? 0) * TH;
  const T = (p: P2): P2 => ({ x: HIP_X + p.x, y: p.y + dy });
  const na = T(j.na);
  const toe = T(j.nToe);
  const knee = T(j.nk);
  const laces = { x: na.x + (toe.x - na.x) * 0.45, y: na.y + (toe.y - na.y) * 0.45 };
  const L = Math.hypot(toe.x - na.x, toe.y - na.y) || 1;
  const d = { x: (toe.x - na.x) / L, y: (toe.y - na.y) / L };
  // The laces face away from the sole: (d.y, -d.x) for a forward foot.
  const out = { x: d.y, y: -d.x };
  return { na, toe, knee, laces, out, farAnkle: T(j.fa) };
};

/** Arc of a circle with an arrowhead at its end. Angles in degrees, screen space (0 = right, 90 = down). */
const ArrowArc: React.FC<{ cx: number; cy: number; r: number; from: number; to: number; color: string; width: number }> = ({ cx, cy, r, from, to, color, width }) => {
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
  const s = width * 1.7;
  const head = `${ex + ux * s * 1.3},${ey + uy * s * 1.3} ${ex - uy * s},${ey + ux * s} ${ex + uy * s},${ey - ux * s}`;
  return (
    <g>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={head} fill={color} stroke={color} strokeWidth={width * 0.4} strokeLinejoin="round" />
    </g>
  );
};

/** Big title text with a hard dark shadow under it. */
const Shout: React.FC<{ x: number; y: number; size: number; anchor?: "start" | "middle" | "end"; children: React.ReactNode; fill: string; shadow?: number }> = ({
  x,
  y,
  size,
  anchor = "middle",
  children,
  fill,
  shadow = 0.06,
}) => (
  <g fontFamily={FONTS.title} fontWeight={800} textAnchor={anchor}>
    <text x={x} y={y + size * shadow} fontSize={size} fill="#070920">
      {children}
    </text>
    <text x={x} y={y} fontSize={size} fill={fill}>
      {children}
    </text>
  </g>
);

/** One of the other goals: a chalk ghost ball (the kit's ghost style: dashed chalk, half strength) with a faint Line. */
const GhostBall: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => {
  const c = 2 * Math.PI * r;
  const dash = c / 14;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={PITCH.skyHigh} opacity={0.7} />
      <circle cx={cx} cy={cy} r={r} fill={PITCH.chalk} opacity={0.1} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={PITCH.chalk} strokeWidth={8} strokeDasharray={`${dash * 0.62} ${dash * 0.38}`} strokeLinecap="round" opacity={0.6} />
      <path
        d={`M${cx + r * 0.28},${cy - r * 0.86} Q${cx - r * 0.5},${cy} ${cx - r * 0.02},${cy + r * 0.88}`}
        fill="none"
        stroke={PITCH.chalk}
        strokeWidth={7}
        strokeLinecap="round"
        opacity={0.45}
      />
    </g>
  );
};

export const Set4C: React.FC = () => {
  const j = joints();
  const R = 70; // hero ball radius
  const gap = 0.036 * TH; // half the boot's thickness at the laces
  const ball = { x: j.laces.x + j.out.x * (gap + R), y: j.laces.y + j.out.y * (gap + R) };

  // Grass stripes fan out from a point high above the horizon (like GroundSide).
  const vx = 640;
  const vy = HORIZON - 700;
  const stripes: React.ReactNode[] = [];
  const n = 18;
  const span = W * 4.2;
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) continue;
    const x0 = vx - span / 2 + (span * i) / n;
    const x1 = vx - span / 2 + (span * (i + 1)) / n;
    const t = (HORIZON - vy) / (H + 40 - vy);
    stripes.push(
      <path key={i} d={`M${vx + (x0 - vx) * t},${HORIZON} L${vx + (x1 - vx) * t},${HORIZON} L${x1},${H + 40} L${x0},${H + 40} Z`} fill={PITCH.grass} />,
    );
  }

  // Swing arcs: the toe's path around the knee as the shin snaps forward.
  const shinLen = Math.hypot(j.toe.x - j.knee.x, j.toe.y - j.knee.y);
  const toeAng = (Math.atan2(j.toe.y - j.knee.y, j.toe.x - j.knee.x) * 180) / Math.PI;
  const arc = (k: number) => {
    const r = shinLen * k;
    const a0 = ((toeAng + 62) * Math.PI) / 180;
    const a1 = ((toeAng + 10) * Math.PI) / 180;
    return `M${j.knee.x + r * Math.cos(a0)},${j.knee.y + r * Math.sin(a0)} A${r},${r} 0 0 0 ${j.knee.x + r * Math.cos(a1)},${j.knee.y + r * Math.sin(a1)}`;
  };

  // The row of five: Tavi's ball first (lit), then four chalk ghosts at the same height.
  const GHOST_R = 54;
  const ROW_END = 1146;
  const ROW_GAP = (ROW_END - ball.x) / 4;

  // The headline sits over the row.
  const TX = 868;

  // Floodlight: one lamp in the top-left corner, clear of Tavi.
  const LAMP_X = 48;

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s4c-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080B24" />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
          <linearGradient id="s4c-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PITCH.lightSoft} stopOpacity={0.16} />
            <stop offset="1" stopColor={PITCH.lightSoft} stopOpacity={0.02} />
          </linearGradient>
          <radialGradient id="s4c-vig" cx={0.4} cy={0.5} r={0.8}>
            <stop offset="0.6" stopColor="#050716" stopOpacity={0} />
            <stop offset="1" stopColor="#050716" stopOpacity={0.55} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#s4c-sky)" />
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={random(`s4c-sx-${i}`) * W} cy={random(`s4c-sy-${i}`) * 300} r={0.8 + random(`s4c-sr-${i}`) * 1.5} fill="#FFFFFF" opacity={0.2 + random(`s4c-so-${i}`) * 0.5} />
        ))}
        {/* Floodlight. */}
        <rect x={LAMP_X - 4} y={50} width={8} height={HORIZON - 150} rx={4} fill={PITCH.stands} />
        <Glow cx={LAMP_X} cy={44} r={210} color={PITCH.lightSoft} intensity={1.1} rings={6} />
        <rect x={LAMP_X - 56} y={18} width={112} height={52} rx={16} fill={PITCH.lightSoft} />
        {/* Stands. */}
        <rect x={0} y={HORIZON - 104} width={W} height={104} fill={PITCH.stands} />
        <rect x={0} y={HORIZON - 118} width={W} height={24} rx={12} fill={PITCH.standsLight} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={0} y={HORIZON - 80 + i * 26} width={W} height={13} rx={6} fill={PITCH.standsLight} opacity={0.55} />
        ))}
        {/* Grass. */}
        <rect x={0} y={HORIZON} width={W} height={H - HORIZON} fill={PITCH.grassDark} />
        {stripes}
        <rect x={0} y={HORIZON - 2} width={W} height={5} fill={PITCH.grassLight} />
        <rect width={W} height={H} fill="url(#s4c-vig)" />
        {/* The floodlight beam on Tavi. */}
        <path d={`M${LAMP_X - 40},60 L${LAMP_X + 40},60 L620,${H} L0,${H} Z`} fill="url(#s4c-beam)" />

        {/* Shadows on the grass. */}
        <ellipse cx={j.farAnkle.x + 20} cy={GROUND - 4} rx={90} ry={14} fill="#08261D" opacity={0.55} />
        <ellipse cx={ball.x} cy={GROUND - 4} rx={R * 0.8} ry={10} fill="#08261D" opacity={0.4} />

        {/* The drop: the ball fell straight down from Tavi's hands. */}
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={i} cx={ball.x} cy={ball.y - R - 44 - i * 30} r={5.5} fill={PITCH.chalk} opacity={0.6 - i * 0.1} />
        ))}

        {/* Swing arcs behind the boot. */}
        {[0.84, 1.0, 1.16].map((k, i) => (
          <path key={i} d={arc(k)} fill="none" stroke={PITCH.chalk} strokeWidth={7 - i * 1.5} strokeLinecap="round" opacity={0.5 - i * 0.12} />
        ))}

        {/* The four other goals: chalk ghosts in a row with Tavi's ball. */}
        {[1, 2, 3, 4].map((i) => (
          <GhostBall key={i} cx={ball.x + i * ROW_GAP} cy={ball.y} r={GHOST_R} />
        ))}

        {/* Glow round the ball. */}
        <Glow cx={ball.x} cy={ball.y} r={R * 2.3} color={PITCH.lightSoft} intensity={1.3} rings={6} />

        {/* Tavi. */}
        <Player x={HIP_X} groundY={GROUND} h={TH} pose={VOLLEY_HIGH} face="focus" />

        {/* The ball, its Line, and its forward spin (topspin: over the top, clockwise). */}
        <Ball cx={ball.x} cy={ball.y} r={R} view={SIDE} axis={TOPSPIN} angle={0} lineNormal={LINE_N} />
        <ArrowArc cx={ball.x} cy={ball.y} r={R + 26} from={200} to={316} color={PITCH.light} width={12} />

        {/* The stat: orange 1 (the lit ball), chalk for the rest (the ghosts). */}
        <Shout x={TX} y={236} size={196} fill={PITCH.chalk}>
          <tspan fill={PITCH.accent}>1</tspan> IN 5
        </Shout>
        <Shout x={TX} y={384} size={148} fill={PITCH.chalk}>
          GOALS!
        </Shout>
      </svg>
    </AbsoluteFill>
  );
};
