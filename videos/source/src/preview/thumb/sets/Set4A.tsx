// Thumbnail set 4, slot A, for "Three Spins and a Line" (1280x720): "0.01 SECONDS".
// Frozen moment of contact: Tavi's white boot presses into the orange ball. The ball stays round
// except for one clean flat on the laces. Its Line is a spoke through the spin axis, with three
// fading earlier copies behind it (flat motion stripes), so it reads as turning backward with the
// backspin arrow (the cold-open MISS spins about -y: the top of the ball moves back). Short chalk
// streaks behind the heel show a fast foot. A small stopwatch and "ONLY 0.01 SECONDS!" fill the
// right side, with "0.01" as the one big shape. The video says "about a hundredth of a second"
// and flashes a stopwatch at "0.01 s" at the end.
import React from "react";
import { AbsoluteFill } from "remotion";
import { Ball, linePoint } from "../../../kit/Ball";
import { Glow } from "../../../kit/World";
import type { View } from "../../../lib/project";
import type { Vec3 } from "../../../physics/sim";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;

type P2 = { x: number; y: number };
const add = (a: P2, b: P2, k = 1): P2 => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const deg = (v: number) => (v * Math.PI) / 180;
const pts = (list: P2[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const polar = (c: P2, r: number, a: number): P2 => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
const f1 = (p: P2) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

const SIDE: View = { kind: "side", originX: 0, groundY: 0, ppm: 1 };
const SOLE = "#A9A294";
const INK = "#070920"; // flat text shadow

// ---- Layout ----
const GROUND_Y = 668;
const B: P2 = { x: 462, y: 418 }; // ball centre
const R = 204; // ball radius
const PHI = 24; // foot direction: degrees from straight down, towards the goal
const SIGMA = 12; // shin direction (knee to ankle), same convention
const d: P2 = { x: Math.sin(deg(PHI)), y: Math.cos(deg(PHI)) }; // down the foot, towards the toes
const n: P2 = { x: Math.cos(deg(PHI)), y: -Math.sin(deg(PHI)) }; // laces normal = push direction
const m: P2 = { x: -n.x, y: -n.y }; // laces towards the sole
const FACE = 0.84 * R; // the flat: distance from the ball centre
const F = add(B, n, -FACE); // centre of the flat
const HALF_CHORD = Math.sqrt(R * R - FACE * FACE);
const BOOT_L = 330;
const O = add(F, d, -0.47 * BOOT_L); // boot origin (laces line, at the ankle)
/** Boot local coordinates (u along the foot, v from the laces towards the sole) to screen. */
const P = (u: number, v: number): P2 => add(add(O, d, u), m, v);

const shinUp: P2 = { x: -Math.sin(deg(SIGMA)), y: -Math.cos(deg(SIGMA)) };
const shinBack: P2 = { x: -Math.cos(deg(SIGMA)), y: Math.sin(deg(SIGMA)) };
const ANKLE_F = P(-24, 0);
const ANKLE_B = P(-34, 116);

// ---- The Line: a spoke through the spin axis (-y, towards the viewer), bowed a little ----
const SPIN_AXIS: Vec3 = { x: 0, y: -1, z: 0 };
const PSI = deg(-30); // spoke direction: degrees from vertical (negative: top leaning back, away from the goal)
const BOW = deg(14); // tilt towards the viewer, so the spoke bows
const LINE_N: Vec3 = {
  x: Math.cos(BOW) * Math.cos(PSI),
  y: -Math.sin(BOW),
  z: -Math.cos(BOW) * Math.sin(PSI),
};
/** Earlier positions of the Line (backspin turns anticlockwise on screen, so earlier = clockwise).
 * Few copies, far apart: flat stripes of motion, not a soft blur. */
const GHOSTS = [0.35, 0.2, 0.1].map((opacity, i) => ({ angle: -0.16 * (i + 1), opacity }));

// ---- Rim light: the kit Ball draws it from the left edge over the top. It must stop before the Line's
// top end, or the two join into a hook. The Line meets the silhouette at screen angle PSI - 90 deg.
const RIM_R = 0.94 * R;
const RIM_A0 = Math.atan2(-0.2, -0.92); // where the kit's rim starts (left edge)
const RIM_A1 = Math.atan2(-0.93, 0.1); // where the kit's rim ends (just right of the top)
const RIM_STOP = PSI - Math.PI / 2 - deg(15); // my rim ends here, with a clear gap before the Line
const arcPath = (a0: number, a1: number, r: number) => {
  const q0 = polar(B, r, a0);
  const q1 = polar(B, r, a1);
  return `M${f1(q0)} A${r},${r} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} 1 ${f1(q1)}`;
};

// ---- Background: night sky, floodlights, a low stand, grass ----
const Lamp: React.FC<{ x: number; y: number; s: number; glow?: number }> = ({ x, y, s, glow = 1 }) => (
  <g>
    <Glow cx={x} cy={y} r={180 * s} color={PITCH.lightSoft} intensity={1.1 * glow} rings={5} />
    <rect x={x - 50 * s} y={y - 26 * s} width={100 * s} height={52 * s} rx={16 * s} fill={PITCH.lightSoft} opacity={0.9} />
  </g>
);

const Background: React.FC = () => (
  <g>
    <defs>
      <linearGradient id="s4a-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#080B24" />
        <stop offset="1" stopColor={PITCH.sky} />
      </linearGradient>
    </defs>
    <rect width={W} height={H} fill="url(#s4a-sky)" />
    <Lamp x={330} y={58} s={0.9} />
    <Lamp x={680} y={42} s={0.72} glow={0.8} />
    {/* A low, dark stand. */}
    <path d={`M-40,${GROUND_Y} L0,${GROUND_Y - 118} L${W},${GROUND_Y - 118} L${W + 40},${GROUND_Y} Z`} fill="#1B2150" />
    <rect x={-40} y={GROUND_Y - 128} width={W + 80} height={18} rx={9} fill={PITCH.stands} />
    {[0, 1].map((i) => (
      <rect key={i} x={-40} y={GROUND_Y - 86 + i * 40} width={W + 80} height={16} rx={8} fill={PITCH.stands} />
    ))}
    {/* Grass. */}
    <rect x={0} y={GROUND_Y} width={W} height={H - GROUND_Y} fill={PITCH.grassDark} />
    {Array.from({ length: 9 }, (_, i) => {
      const x0 = -300 + i * 220;
      const fan = (x0 + 55 - 640) * 0.9;
      return <path key={i} d={`M${x0},${GROUND_Y} L${x0 + 110},${GROUND_Y} L${x0 + 110 + fan},${H} L${x0 + fan},${H} Z`} fill={PITCH.grass} />;
    })}
    <rect x={0} y={GROUND_Y - 3} width={W} height={6} fill={PITCH.grassLight} />
  </g>
);

/** A flash of light at the contact, with faint rays that pull the eye to it. */
const Flash: React.FC = () => {
  const c = add(F, n, 40);
  return (
    <g>
      {Array.from({ length: 16 }, (_, i) => {
        const a0 = deg(i * 22.5);
        const a1 = deg(i * 22.5 + 9);
        return <polygon key={`r${i}`} points={pts([c, polar(c, 1500, a0), polar(c, 1500, a1)])} fill={PITCH.lightSoft} opacity={0.04} />;
      })}
      <Glow cx={c.x} cy={c.y} r={330} color={PITCH.lightSoft} intensity={1.1} rings={5} />
    </g>
  );
};

// ---- Speed streaks behind the heel: short chalk arcs around the knee (off the top of the frame) ----
const KNEE = add(ANKLE_F, shinUp, 560);
const SpeedStreaks: React.FC = () => {
  // Start point (just behind the boot), length in px, stroke width, opacity.
  const streaks: { x: number; y: number; len: number; w: number; o: number }[] = [
    { x: 88, y: 386, len: 72, w: 14, o: 0.5 },
    { x: 60, y: 450, len: 50, w: 15, o: 0.6 },
    { x: 138, y: 514, len: 104, w: 14, o: 0.42 },
  ];
  return (
    <g stroke={PITCH.chalk} fill="none" strokeLinecap="round">
      {streaks.map((s, i) => {
        const rho = Math.hypot(s.x - KNEE.x, s.y - KNEE.y);
        const a0 = Math.atan2(s.y - KNEE.y, s.x - KNEE.x);
        const q1 = polar(KNEE, rho, a0 + s.len / rho); // the foot swings forward, so the trail is at larger angles
        return <path key={i} d={`M${s.x},${s.y} A${rho.toFixed(1)},${rho.toFixed(1)} 0 0 1 ${f1(q1)}`} strokeWidth={s.w} opacity={s.o} />;
      })}
    </g>
  );
};

// ---- Leg and boot ----
const Leg: React.FC = () => {
  const topF = add(ANKLE_F, shinUp, 700);
  const midB = add(add(ANKLE_B, shinUp, 330), shinBack, 34);
  const topB = add(add(ANKLE_B, shinUp, 700), shinBack, 30);
  const shadeIn = (p: P2, k: number) => add(p, shinBack, -k);
  const T_TOE = 76;
  const at = (u: number, v: number) => f1(P(u, v));
  const boot = [
    `M${at(-24, 0)}`,
    `L${at(BOOT_L - T_TOE / 2, 0)}`,
    `A${T_TOE / 2},${T_TOE / 2} 0 0 1 ${at(BOOT_L - T_TOE / 2, T_TOE)}`,
    `Q${at(170, 128)} ${at(70, 160)}`,
    `Q${at(10, 186)} ${at(-34, 116)}`,
    "Z",
  ].join(" ");
  const sole = `M${at(BOOT_L - 40, T_TOE - 6)} Q${at(170, 124)} ${at(70, 156)}`;
  const studs = [
    { u: 222, v: 105 },
    { u: 156, v: 131 },
    { u: 30, v: 166 },
  ];
  const laces = [20, 58, 96];
  return (
    <g>
      <polygon points={pts([ANKLE_F, topF, topB, midB, ANKLE_B])} fill={CAST.sock} />
      <polygon points={pts([shadeIn(ANKLE_B, 34), shadeIn(midB, 40), shadeIn(topB, 40), topB, midB, ANKLE_B])} fill={CAST.sockShade} />
      {studs.map((st, i) => (
        <polygon
          key={i}
          points={pts([P(st.u - 15, st.v - 4), P(st.u + 15, st.v - 4), P(st.u + 9, st.v + 20), P(st.u - 9, st.v + 20)])}
          fill={SOLE}
          stroke={SOLE}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      ))}
      <path d={boot} fill={CAST.boot} />
      <path d={`M${at(-34, 116)} Q${at(10, 186)} ${at(70, 160)} Q${at(40, 128)} ${at(-26, 84)} Z`} fill={CAST.bootShade} opacity={0.8} />
      <path d={sole} fill="none" stroke={CAST.bootShade} strokeWidth={26} strokeLinecap="round" />
      <path d={sole} fill="none" stroke={SOLE} strokeWidth={10} strokeLinecap="round" transform={`translate(${m.x * 10} ${m.y * 10})`} />
      {laces.map((u, i) => (
        <line key={i} x1={P(u, 10).x} y1={P(u, 10).y} x2={P(u + 16, 34).x} y2={P(u + 16, 34).y} stroke={CAST.bootShade} strokeWidth={9} strokeLinecap="round" />
      ))}
      <line x1={ANKLE_F.x} y1={ANKLE_F.y} x2={ANKLE_B.x} y2={ANKLE_B.y} stroke={CAST.bootShade} strokeWidth={10} strokeLinecap="round" />
    </g>
  );
};

// ---- The ball: a perfect circle with one flat on the laces (rounded corners) ----
const ballShape = (): string => {
  const at = (a: number, r = R): P2 => add(add(B, n, r * Math.cos(a)), d, r * Math.sin(a));
  const alpha = Math.acos(FACE / R);
  const th1 = alpha - Math.PI; // chord end towards the ankle (d < 0)
  const th2 = Math.PI - alpha; // chord end towards the toes (d > 0)
  const eps = deg(9);
  const fil = 22;
  const c1 = add(F, d, -HALF_CHORD);
  const c2 = add(F, d, HALF_CHORD);
  return [
    `M${f1(at(th2 - eps))}`,
    `A${R},${R} 0 1 0 ${f1(at(th1 + eps))}`,
    `Q${f1(c1)} ${f1(add(c1, d, fil))}`,
    `L${f1(add(c2, d, -fil))}`,
    `Q${f1(c2)} ${f1(at(th2 - eps))}`,
    "Z",
  ].join(" ");
};

/** The front part of the Line at a given spin angle, as path segments around the ball centre. */
const linePaths = (angle: number): string[] => {
  const out: string[] = [];
  let seg: P2[] = [];
  for (let i = 0; i <= 96; i++) {
    const p = linePoint(SIDE, R, (i / 96) * 2 * Math.PI, LINE_N, SPIN_AXIS, angle);
    if (p.front) seg.push({ x: B.x + p.x, y: B.y + p.y });
    else if (seg.length) {
      out.push(`M${seg.map(f1).join(" L")}`);
      seg = [];
    }
  }
  if (seg.length > 1) out.push(`M${seg.map(f1).join(" L")}`);
  return out;
};

const SquashedBall: React.FC = () => (
  <g>
    <defs>
      <clipPath id="s4a-flat">
        <path d={ballShape()} />
      </clipPath>
    </defs>
    <g clipPath="url(#s4a-flat)">
      <Ball cx={B.x} cy={B.y} r={R} view={SIDE} axis={SPIN_AXIS} angle={0} lineNormal={LINE_N} showLine={false} />
      {/* Paint out the kit's rim light (it sits on the lit body), then draw a shorter one. */}
      <path d={arcPath(RIM_A0 - deg(4), RIM_A1 + deg(5), RIM_R)} fill="none" stroke={CAST.ball} strokeWidth={R * 0.14} />
      <path d={arcPath(RIM_A0, RIM_STOP, RIM_R)} fill="none" stroke={CAST.ballRim} strokeWidth={R * 0.08} strokeLinecap="round" opacity={0.8} />
      {/* Pressed rubber: a darker band along the flat. */}
      <line x1={add(F, d, -R).x} y1={add(F, d, -R).y} x2={add(F, d, R).x} y2={add(F, d, R).y} stroke={CAST.ballShade} strokeWidth={34} opacity={0.9} />
      {GHOSTS.map((g, i) =>
        linePaths(g.angle).map((p, j) => (
          <path key={`${i}-${j}`} d={p} fill="none" stroke={CAST.ballLine} strokeWidth={R * 0.11} strokeLinecap="round" opacity={g.opacity} />
        )),
      )}
      {linePaths(0).map((p, j) => (
        <path key={`line-${j}`} d={p} fill="none" stroke={CAST.ballLine} strokeWidth={R * 0.11} strokeLinecap="round" />
      ))}
    </g>
  </g>
);

// ---- Impact: short burst lines at the two ends of the flat ----
const Impact: React.FC = () => {
  const top = add(F, d, -HALF_CHORD - 4);
  const bot = add(F, d, HALF_CHORD + 4);
  const baseTop = (Math.atan2(-d.y, -d.x) * 180) / Math.PI;
  const baseBot = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  const ray = (p: P2, dirDeg: number, r0: number, r1: number, key: string) => {
    const q0 = polar(p, r0, deg(dirDeg));
    const q1 = polar(p, r1, deg(dirDeg));
    return <line key={key} x1={q0.x} y1={q0.y} x2={q1.x} y2={q1.y} stroke={PITCH.light} strokeWidth={12} strokeLinecap="round" />;
  };
  return (
    <g>
      {[-40, 0, 40].map((a, i) => ray(top, baseTop + a + 20, 22, i === 1 ? 84 : 62, `t${i}`))}
      {[-40, 0, 40].map((a, i) => ray(bot, baseBot + a - 20, 22, i === 1 ? 78 : 58, `b${i}`))}
    </g>
  );
};

// ---- Backspin arrow: over the top of the ball, from the front round to the back ----
const SpinArrow: React.FC = () => {
  const rr = R + 46;
  const a0 = deg(8);
  const a1 = deg(-112);
  const q0 = polar(B, rr, a0);
  const q1 = polar(B, rr, a1);
  const t = { x: Math.sin(a1), y: -Math.cos(a1) }; // travel towards smaller angles
  const nn = { x: -t.y, y: t.x };
  const tip = add(q1, t, 34);
  const w1 = add(add(q1, t, -8), nn, 30);
  const w2 = add(add(q1, t, -8), nn, -30);
  return (
    <g>
      <path d={`M${f1(q0)} A${rr},${rr} 0 0 0 ${f1(q1)}`} fill="none" stroke={PITCH.light} strokeWidth={17} strokeLinecap="round" />
      <polygon points={pts([tip, w1, w2])} fill={PITCH.light} stroke={PITCH.light} strokeWidth={8} strokeLinejoin="round" />
    </g>
  );
};

// ---- Stopwatch: the hand has only just left twelve ----
const Stopwatch: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) => {
  const top = deg(-90);
  const hand = deg(-90 + 7);
  const o = { x: 0, y: 0 };
  const e0 = polar(o, r * 0.7, top);
  const e1 = polar(o, r * 0.7, hand);
  return (
    <g transform={`translate(${x} ${y})`}>
      <Glow cx={0} cy={0} r={r * 1.45} color={PITCH.lightSoft} intensity={1} rings={4} />
      <rect x={-r * 0.13} y={-r * 1.3} width={r * 0.26} height={r * 0.34} fill={PITCH.chalk} />
      <rect x={-r * 0.32} y={-r * 1.46} width={r * 0.64} height={r * 0.22} rx={r * 0.11} fill={PITCH.chalk} />
      <g transform="rotate(45)">
        <rect x={-r * 0.11} y={-r * 1.24} width={r * 0.22} height={r * 0.32} rx={r * 0.07} fill={PITCH.chalk} />
      </g>
      <circle r={r} fill={PITCH.chalk} />
      <circle r={r * 0.8} fill={PITCH.skyHigh} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = deg(i * 30);
        const q0 = polar(o, r * 0.6, a);
        const q1 = polar(o, r * 0.7, a);
        return <line key={i} x1={q0.x} y1={q0.y} x2={q1.x} y2={q1.y} stroke={PITCH.chalk} strokeWidth={r * 0.065} strokeLinecap="round" opacity={0.75} />;
      })}
      <path d={`M0,0 L${f1(e0)} A${r * 0.7},${r * 0.7} 0 0 1 ${f1(e1)} Z`} fill={CAST.band} />
      <line x1={0} y1={0} x2={Math.cos(hand) * r * 0.72} y2={Math.sin(hand) * r * 0.72} stroke={CAST.band} strokeWidth={r * 0.1} strokeLinecap="round" />
      <circle r={r * 0.12} fill={CAST.band} />
    </g>
  );
};

// ---- Words ----
const Words: React.FC<{ cx: number }> = ({ cx }) => (
  <g fontFamily={FONTS.title} fontWeight={800} textAnchor="middle">
    <g transform="translate(796 226) rotate(-9)">
      <text x={0} y={9} fontSize={90} fill={INK}>ONLY</text>
      <text x={0} y={0} fontSize={90} fill={PITCH.chalk}>ONLY</text>
    </g>
    <text x={cx} y={464} fontSize={212} fill={INK}>0.01</text>
    <text x={cx} y={454} fontSize={212} fill={PITCH.light}>0.01</text>
    <text x={cx} y={570} fontSize={90} fill={INK} letterSpacing={1}>SECONDS!</text>
    <text x={cx} y={562} fontSize={90} fill={PITCH.chalk} letterSpacing={1}>SECONDS!</text>
  </g>
);

export const Set4A: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Background />
      <Flash />
      <ellipse cx={B.x + 30} cy={GROUND_Y + 12} rx={170} ry={12} fill={INK} opacity={0.4} />
      <SpinArrow />
      <SquashedBall />
      <SpeedStreaks />
      <Leg />
      <Impact />
      <Stopwatch x={1030} y={160} r={80} />
      <Words cx={990} />
    </svg>
  </AbsoluteFill>
);
