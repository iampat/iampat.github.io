// Thumbnail set 1 ("The bend"), slot B, for "Three Spins and a Line" (1280x720).
// A TOP-DOWN view of the free-kick curler from s11/s12: the ball starts along a dashed chalk line
// that goes wide of the far post, then the real curved path (the CURLER sim, turned onto the pitch)
// bends back inside it. A bracket at the goal shows the gap (about 3 m over 20 m).
// The camera turns so the launch line lies level: the real path lifts clearly off it.
// Chalk dives too late. Words: "IT STARTS WIDE...".
import React from "react";
import { AbsoluteFill } from "remotion";
import { Ball } from "../../../kit/Ball";
import { TopPlayer } from "../../../kit/TopPlayer";
import { GOAL_W } from "../../../kit/Goal";
import { SHOTS } from "../../../physics/shots";
import { simulate } from "../../../physics/sim";
import { FAR_POST, GC, GL, NEAR_POST, TH, crossPitchX, lineYAt, pathOnPitch } from "../../../kit/ext/s11-s12-layout";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

// Screen layout: a top-down camera turned so the target line rises gently to the right.
const PPM = 42;
// Screen angle of the target line, degrees (up to the right). It equals the launch offset,
// so the dashed launch line lies level and the bend shows as a lift off it.
const RISE = -SHOTS.CURLER.azimuthDeg;
const PHI = (RISE * Math.PI) / 180 - TH; // screen turn (anticlockwise) applied to the pitch
const KICK = { x: 210, y: 522 }; // the ball's spot on screen

/** Pitch metres (X to goal, Y left) to screen pixels. */
const P = (x: number, y: number) => {
  const u = x * PPM;
  const v = -y * PPM;
  return { x: KICK.x + u * Math.cos(PHI) + v * Math.sin(PHI), y: KICK.y - u * Math.sin(PHI) + v * Math.cos(PHI) };
};

// The real curler and the straight line it starts along (8 degrees right of the target line).
const REAL = pathOnPitch(simulate({ ...SHOTS.CURLER, ground: false, duration: 1.6 }, 60));
const CROSS = crossPitchX(REAL, GL)!;
const LAUNCH = TH + (SHOTS.CURLER.azimuthDeg * Math.PI) / 180;
const AIM_Y = lineYAt(0, 0, LAUNCH, GL); // where the straight line meets the goal line
const PATH = (() => {
  const out: { x: number; y: number }[] = [];
  for (const s of REAL) {
    if (s.pos.x > GL + 0.9) break;
    out.push({ x: s.pos.x, y: s.pos.y });
  }
  return out;
})();

type SP = { x: number; y: number };
const d = (pts: SP[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

/** A tapered ribbon along screen points: width goes from w0 (start) to w1 (end). */
const ribbon = (pts: SP[], w0: number, w1: number, ease = 1.4) => {
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

/** Soft glow from concentric circles (no blur filters). */
const Glow: React.FC<{ cx: number; cy: number; r: number; color: string; intensity?: number; rings?: number }> = ({ cx, cy, r, color, intensity = 1, rings = 10 }) => (
  <g>
    {Array.from({ length: rings }, (_, i) => {
      const k = (i + 1) / rings;
      return <circle key={i} cx={cx} cy={cy} r={r * k} fill={color} opacity={(0.2 / rings) * (rings - i) * intensity} />;
    })}
  </g>
);

/** Chalk from above, diving: body along the dive direction, arms and mittens reaching ahead. */
const TopChalkDive: React.FC<{ x: number; y: number; angle: number; s: number }> = ({ x, y, angle, s }) => (
  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${s})`}>
    <ellipse cx={-6} cy={10} rx={78} ry={30} fill="#04140F" opacity={0.35} />
    {/* Legs and body. */}
    <rect x={-92} y={-12} width={52} height={11} rx={5.5} fill={CAST.keeperShade} transform="rotate(-8 -40 -6)" />
    <rect x={-92} y={2} width={52} height={11} rx={5.5} fill={CAST.keeperShade} transform="rotate(6 -40 8)" />
    <rect x={-58} y={-19} width={78} height={38} rx={19} fill={CAST.keeper} />
    <rect x={-58} y={4} width={78} height={15} rx={7.5} fill={CAST.keeperShade} opacity={0.5} />
    {/* Arms reaching. */}
    <rect x={8} y={-22} width={62} height={12} rx={6} fill={CAST.keeperShade} transform="rotate(-6 8 -16)" />
    <rect x={8} y={10} width={62} height={12} rx={6} fill={CAST.keeperShade} transform="rotate(6 8 16)" />
    {/* Head. */}
    <circle cx={30} cy={0} r={17} fill={CAST.keeper} />
    <circle cx={36} cy={10} r={3.4} fill={CAST.keeperEye} />
    <circle cx={26} cy={12} r={3.4} fill={CAST.keeperEye} />
    {/* Mittens. */}
    <ellipse cx={80} cy={-24} rx={17} ry={14} fill={CAST.keeper} />
    <ellipse cx={80} cy={24} rx={17} ry={14} fill={CAST.keeper} />
  </g>
);

/** Part of a spin ring round the ball, with an arrowhead at its end (degrees, screen). */
const SpinRing: React.FC<{ cx: number; cy: number; r: number; from: number; to: number; color: string; width: number }> = ({ cx, cy, r, from, to, color, width }) => {
  const pts: string[] = [];
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    pts.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
  }
  const e = (to * Math.PI) / 180;
  const ex = r * Math.cos(e);
  const ey = r * Math.sin(e);
  const dir = Math.sign(to - from);
  const ux = -Math.sin(e) * dir;
  const uy = Math.cos(e) * dir;
  const s = width * 1.8;
  const head = `${ex + ux * s * 1.2},${ey + uy * s * 1.2} ${ex - uy * s},${ey + ux * s} ${ex + uy * s},${ey - ux * s}`;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={head} fill={color} stroke={color} strokeWidth={width * 0.4} strokeLinejoin="round" />
    </g>
  );
};

/** Screen angle (SVG degrees) of a pitch direction given in radians. */
const screenDeg = (pitchRad: number) => -((pitchRad + PHI) * 180) / Math.PI;

export const Set1B: React.FC = () => {
  const poly = (pts: [number, number][], close = true) => d(pts.map(([x, y]) => P(x, y))) + (close ? " Z" : "");

  // Grass stripes parallel to the goal line (every 4 m), over a wide area so turns never show edges.
  const stripes: React.ReactNode[] = [];
  for (let i = -12; i < 12; i++) {
    if (i % 2 !== 0) continue;
    const x0 = GL - i * 4 - 4;
    const x1 = x0 + 4;
    stripes.push(<path key={i} d={poly([[x0, -60], [x1, -60], [x1, 60], [x0, 60]])} fill={PITCH.grass} />);
  }
  // The D at the top of the box.
  const arc: [number, number][] = [];
  for (let a = -53; a <= 53; a += 3) {
    const t = (a * Math.PI) / 180;
    arc.push([GL - 11 - 9.15 * Math.cos(t), GC + 9.15 * Math.sin(t)]);
  }

  // The goal from above: posts, bar over the goal line, the net behind it.
  const near = P(GL, NEAR_POST);
  const far = P(GL, FAR_POST);
  const netPts: [number, number][] = [
    [GL, NEAR_POST],
    [GL + 2, NEAR_POST],
    [GL + 2, FAR_POST],
    [GL, FAR_POST],
  ];
  const net: React.ReactNode[] = [];
  for (let i = 1; i < 12; i++) {
    const y = NEAR_POST - (GOAL_W * i) / 12;
    net.push(<path key={`a${i}`} d={poly([[GL, y], [GL + 2, y]], false)} />);
  }
  for (let i = 1; i < 4; i++) {
    const x = GL + (2 * i) / 4;
    net.push(<path key={`b${i}`} d={poly([[x, NEAR_POST], [x, FAR_POST]], false)} />);
  }

  // The paths on screen. The hero ball is caught 10 m out, still on its way wide.
  const HERO_X = 11.5;
  const heroIdx = PATH.findIndex((p) => p.x >= HERO_X);
  const pts = PATH.map((p) => P(p.x, p.y));
  const behind = pts.slice(0, heroIdx + 1);
  const ahead = pts.slice(heroIdx);
  const hero = pts[heroIdx];
  const kick = P(0, 0);
  const aim = P(GL, AIM_Y);
  const cross = P(GL, CROSS.pos.y);
  // The gap between the straight line and the real path (a soft wedge that grows).
  const straight: SP[] = [];
  for (const p of PATH) {
    if (p.x > GL) break;
    straight.push(P(p.x, lineYAt(0, 0, LAUNCH, p.x)));
  }
  const wedge: SP[] = [...pts.slice(0, straight.length), cross, aim, ...straight.slice().reverse()];

  // Glowing dots along the path ahead of the ball (where it is going), evenly spaced on screen.
  const dots: SP[] = [];
  {
    let acc = 0;
    const step = 33;
    let next = 74;
    for (let i = 1; i < ahead.length; i++) {
      const a = ahead[i - 1];
      const b = ahead[i];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      while (acc + l >= next) {
        const t = (next - acc) / l;
        dots.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        next += step;
      }
      acc += l;
    }
  }
  const tipA = ahead[ahead.length - 4];
  const tipB = ahead[ahead.length - 1];
  const tipAng = (Math.atan2(tipB.y - tipA.y, tipB.x - tipA.x) * 180) / Math.PI;

  // The gap bracket, just in front of the goal line, from the straight line to the real path.
  const BRX = 1.1;
  const bA = P(GL - BRX, lineYAt(0, 0, LAUNCH, GL - BRX));
  const bB = P(GL - BRX, crossPitchX(REAL, GL - BRX)!.pos.y);
  const bLen = Math.hypot(bB.x - bA.x, bB.y - bA.y);
  const bN = { x: -(bB.y - bA.y) / bLen, y: (bB.x - bA.x) / bLen };
  const cap = 20;
  // The tag is too tall to fit in the gap, so it hangs just under the bracket's foot (clear of the X).
  const PW = 184;
  const PH = 76;
  const tag = { x: bA.x - 44, y: bA.y + 26 + PH / 2 };

  // Chalk dives towards the far post, too late.
  const chalk = P(GL - 0.7, GC + 0.6);
  const diveAngle = screenDeg(-Math.PI / 2);
  const taviAt = P(-1.2, 0.9);

  const R = 72; // hero ball radius

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.grassDark }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <radialGradient id="s1b-vig" cx={0.6} cy={0.56} r={0.78}>
            <stop offset="0.38" stopColor="#03100C" stopOpacity={0} />
            <stop offset="1" stopColor="#03100C" stopOpacity={0.9} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill={PITCH.grassDark} />
        {stripes}
        {/* Floodlight pools on the grass. */}
        <Glow cx={(near.x + far.x) / 2 - 20} cy={(near.y + far.y) / 2 + 20} r={460} color={PITCH.lightSoft} intensity={0.5} rings={18} />
        <Glow cx={hero.x} cy={hero.y} r={300} color={PITCH.lightSoft} intensity={0.35} rings={16} />
        <g fill="none" stroke={PITCH.chalk} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.5}>
          <path d={poly([[GL, GC - 40], [GL, GC + 40]], false)} />
          <path d={poly([[GL, GC - 9.16], [GL - 5.5, GC - 9.16], [GL - 5.5, GC + 9.16], [GL, GC + 9.16]], false)} />
          <path d={poly([[GL, GC - 20.16], [GL - 16.5, GC - 20.16], [GL - 16.5, GC + 20.16], [GL, GC + 20.16]], false)} />
          <path d={poly(arc, false)} />
        </g>
        {/* Net and goal frame. */}
        <path d={poly(netPts)} fill={PITCH.skyHigh} opacity={0.6} />
        <g stroke={PITCH.chalk} strokeWidth={2} opacity={0.35} fill="none">
          {net}
        </g>
        <path d={poly(netPts.slice(1, 3), false)} stroke={PITCH.chalk} strokeWidth={3} opacity={0.5} fill="none" />
        <line x1={near.x} y1={near.y} x2={far.x} y2={far.y} stroke={PITCH.chalk} strokeWidth={12} strokeLinecap="round" />
        <circle cx={near.x} cy={near.y} r={12} fill={PITCH.chalk} />
        <circle cx={far.x} cy={far.y} r={13} fill={PITCH.chalk} />

        {/* Chalk. */}
        <TopChalkDive x={chalk.x} y={chalk.y} angle={diveAngle} s={0.95} />

        {/* The gap between where it would go and where it goes. */}
        <path d={d(wedge) + " Z"} fill={PITCH.light} opacity={0.35} />
        {/* Dashed straight chalk line: where it would go without the spin. */}
        <line x1={kick.x} y1={kick.y} x2={aim.x} y2={aim.y} stroke={PITCH.chalk} strokeWidth={9} strokeDasharray="22 18" strokeLinecap="round" opacity={0.9} />
        <g transform={`translate(${aim.x} ${aim.y}) rotate(${screenDeg(LAUNCH)})`} stroke={PITCH.chalk} strokeWidth={10} strokeLinecap="round">
          <line x1={-15} y1={-15} x2={15} y2={15} />
          <line x1={-15} y1={15} x2={15} y2={-15} />
        </g>

        {/* The real path: the trail behind the ball, glowing dots where it is going. */}
        <path d={ribbon(ahead, 34, 34)} fill={PITCH.light} opacity={0.14} />
        <Glow cx={tipB.x} cy={tipB.y} r={80} color={PITCH.lightSoft} intensity={1.3} />
        {dots.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={9} fill={PITCH.light} />
        ))}
        <g transform={`translate(${tipB.x} ${tipB.y}) rotate(${tipAng})`}>
          <path d="M19,0 L-16,-20 L-8,0 L-16,20 Z" fill={PITCH.light} stroke={PITCH.light} strokeWidth={5} strokeLinejoin="round" />
        </g>
        <path d={ribbon(behind, 8, 90)} fill={PITCH.light} opacity={0.12} />
        <path d={ribbon(behind, 5, 60)} fill={PITCH.light} opacity={0.26} />
        <path d={ribbon(behind, 3, 32)} fill={PITCH.lightSoft} />
        <path d={ribbon(behind, 2, 14)} fill="#FFFFFF" />

        {/* The bracket and its tag. */}
        <g stroke={PITCH.light} strokeWidth={10} strokeLinecap="round">
          <line x1={bA.x} y1={bA.y} x2={bB.x} y2={bB.y} />
          <line x1={bA.x - bN.x * cap} y1={bA.y - bN.y * cap} x2={bA.x + bN.x * cap} y2={bA.y + bN.y * cap} />
          <line x1={bB.x - bN.x * cap} y1={bB.y - bN.y * cap} x2={bB.x + bN.x * cap} y2={bB.y + bN.y * cap} />
        </g>
        <g transform={`translate(${tag.x} ${tag.y})`}>
          <rect x={-PW / 2} y={-PH / 2} width={PW} height={PH} rx={PH / 2} fill={PITCH.light} stroke="#04140F" strokeOpacity={0.35} strokeWidth={5} />
          <text x={0} y={20} textAnchor="middle" fontFamily={FONTS.title} fontWeight={800} fontSize={58} fill={PITCH.sky}>
            ≈ 3 m
          </text>
        </g>

        {/* The hero ball in flight, with its shadow on the grass, its Line and its sideways spin. */}
        <ellipse cx={hero.x + 34} cy={hero.y + 46} rx={R * 0.9} ry={R * 0.8} fill="#04140F" opacity={0.4} />
        <Glow cx={hero.x} cy={hero.y} r={170} color={PITCH.lightSoft} intensity={1.2} />
        <SpinRing cx={hero.x} cy={hero.y} r={R + 26} from={-20} to={-160} color={PITCH.light} width={10} />
        <SpinRing cx={hero.x} cy={hero.y} r={R + 26} from={160} to={20} color={PITCH.light} width={10} />
        <Ball cx={hero.x} cy={hero.y} r={R} view={{ kind: "top", originX: 0, originY: 0, ppm: 1 }} axis={{ x: 0, y: 0, z: 1 }} angle={0.6} lineNormal={{ x: 0.9, y: 0.1, z: 0.15 }} />

        <rect width={W} height={H} fill="url(#s1b-vig)" />

        {/* Tavi at the kick spot, in his own floodlight pool so he reads in the dark corner. */}
        <Glow cx={taviAt.x + 10} cy={taviAt.y} r={190} color={PITCH.lightSoft} intensity={0.55} rings={14} />
        <circle cx={kick.x} cy={kick.y} r={8} fill={PITCH.chalk} opacity={0.8} />
        <TopPlayer x={taviAt.x} y={taviAt.y} size={100} kind="tavi" facing={screenDeg(LAUNCH) - 10} look={0} />

        {/* Words. */}
        <g fontFamily={FONTS.title} fontWeight={800}>
          <text x={50} y={138} fontSize={120} fill="#04140F" transform="translate(0 9)">
            IT STARTS
          </text>
          <text x={50} y={138} fontSize={120} fill="#FFFFFF">
            IT STARTS
          </text>
          <text x={50} y={282} fontSize={156} fill="#04140F" transform="translate(0 11)">
            WIDE...
          </text>
          <text x={50} y={282} fontSize={156} fill={PITCH.light}>
            WIDE...
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
