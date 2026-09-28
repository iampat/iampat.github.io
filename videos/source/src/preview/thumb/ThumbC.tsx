// Thumbnail concept C for "Three Spins and a Line" (1280x720): "THE MOMENT".
// Extreme close-up at contact: Tavi's white boot drives into the orange ball, the ball squashes,
// the Line shows its spin, a stopwatch reads a hundredth of a second, floodlights behind.
import React from "react";
import { AbsoluteFill } from "remotion";
import { Ball } from "../../kit/Ball";
import type { View } from "../../lib/project";
import { CAST, FONTS, PITCH } from "../../theme";

const W = 1280;
const H = 720;

type P2 = { x: number; y: number };
const add = (a: P2, b: P2, k = 1): P2 => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const deg = (v: number) => (v * Math.PI) / 180;
const pts = (list: P2[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const polar = (c: P2, r: number, a: number): P2 => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });

const SIDE: View = { kind: "side", originX: 0, groundY: 0, ppm: 1 };
const SOLE = "#A9A294";
const INK = "#0A0D26"; // flat text shadow

// ---- Layout ----
const GROUND_Y = 655;
const B: P2 = { x: 530, y: 428 }; // ball centre
const R = 168; // ball radius
const SQUASH = 0.94; // along the push direction
const PHI = 27; // foot direction: degrees from straight down, towards the goal
const SIGMA = 13; // shin direction (knee to ankle), same convention
const d: P2 = { x: Math.sin(deg(PHI)), y: Math.cos(deg(PHI)) }; // down the foot, towards the toes
const n: P2 = { x: Math.cos(deg(PHI)), y: -Math.sin(deg(PHI)) }; // laces normal = push direction
const m: P2 = { x: -n.x, y: -n.y }; // laces towards the sole
const FACE = 0.7 * R; // flat contact face: distance from the ball centre
const F = add(B, n, -FACE); // centre of the contact face
const HALF_CHORD = Math.sqrt(R * R - FACE * FACE);
const BOOT_L = 320;
const O = add(F, d, -0.45 * BOOT_L); // boot origin (laces line, at the ankle)
/** Boot local coordinates (u along the foot, v from the laces towards the sole) to screen. */
const P = (u: number, v: number): P2 => add(add(O, d, u), m, v);

const shinUp: P2 = { x: -Math.sin(deg(SIGMA)), y: -Math.cos(deg(SIGMA)) };
const shinBack: P2 = { x: -Math.cos(deg(SIGMA)), y: Math.sin(deg(SIGMA)) };
const ANKLE_F = P(-24, 0);
const ANKLE_B = P(-34, 116);
const KNEE = add(add(ANKLE_F, shinUp, 640), shinBack, 70);
/** The focal group (ball, boot, effects) is drawn at this size, then zoomed about the toe's ground point. */
const ZOOM = 1.13;
const PIVOT: P2 = { x: P(BOOT_L - 20, 40).x, y: GROUND_Y };

// ---- Background: night sky, floodlights, soft stands, grass ----
const Lamp: React.FC<{ x: number; y: number; s: number; glow?: number }> = ({ x, y, s, glow = 1 }) => (
  <g>
    {[1, 0.78, 0.56, 0.36].map((k, i) => (
      <circle key={i} cx={x} cy={y} r={170 * s * k} fill={PITCH.lightSoft} opacity={0.07 * glow * (i + 1)} />
    ))}
    <rect x={x - 4 * s} y={y + 36 * s} width={8 * s} height={400} fill={PITCH.stands} />
    <rect x={x - 56 * s} y={y - 36 * s} width={112 * s} height={72 * s} rx={20 * s} fill={PITCH.lightSoft} />
  </g>
);

const Background: React.FC = () => (
  <g>
    <defs>
      <linearGradient id="tc-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={PITCH.skyHigh} />
        <stop offset="1" stopColor={PITCH.sky} />
      </linearGradient>
    </defs>
    <rect width={W} height={H} fill="url(#tc-sky)" />
    <Lamp x={120} y={70} s={1.05} />
    <Lamp x={430} y={52} s={0.8} />
    <Lamp x={760} y={60} s={0.7} glow={0.7} />
    {/* Stands, soft and far. */}
    <path d={`M-40,${GROUND_Y - 40} L0,${GROUND_Y - 250} L${W},${GROUND_Y - 250} L${W + 40},${GROUND_Y - 40} Z`} fill={PITCH.stands} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={-40} y={GROUND_Y - 215 + i * 52} width={W + 80} height={24} rx={12} fill={PITCH.standsLight} opacity={0.25} />
    ))}
    <rect x={-40} y={GROUND_Y - 288} width={W + 80} height={40} rx={20} fill={PITCH.standsLight} />
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

/** A soft flash of light behind the contact, with faint rays that pull the eye to it. */
const Flash: React.FC = () => (
  <g>
    {Array.from({ length: 18 }, (_, i) => {
      const a0 = deg(i * 20);
      const a1 = deg(i * 20 + 8);
      const c = add(F, n, 30);
      const q0 = polar(c, 1600, a0);
      const q1 = polar(c, 1600, a1);
      return <polygon key={`r${i}`} points={pts([c, q0, q1])} fill={PITCH.lightSoft} opacity={0.035} />;
    })}
    {[1, 0.75, 0.5].map((k, i) => (
      <circle key={i} cx={F.x + 30} cy={F.y - 10} r={240 * k} fill={PITCH.lightSoft} opacity={0.045 * (i + 1)} />
    ))}
  </g>
);

// ---- Speed lines behind the swinging boot (arcs around the knee) ----
const SpeedLines: React.FC = () => {
  const streaks: { u: number; v: number; len: number; w: number; o: number }[] = [
    { u: -30, v: 150, len: 30, w: 12, o: 0.55 },
    { u: 40, v: 190, len: 40, w: 16, o: 0.75 },
    { u: 130, v: 145, len: 34, w: 13, o: 0.6 },
    { u: 220, v: 120, len: 44, w: 16, o: 0.8 },
    { u: 300, v: 100, len: 30, w: 12, o: 0.55 },
  ];
  return (
    <g stroke={PITCH.chalk} fill="none" strokeLinecap="round">
      {streaks.map((s, i) => {
        const p = P(s.u, s.v);
        const rho = Math.hypot(p.x - KNEE.x, p.y - KNEE.y);
        const a0 = Math.atan2(p.y - KNEE.y, p.x - KNEE.x) + deg(2);
        const q0 = polar(KNEE, rho, a0);
        const q1 = polar(KNEE, rho, a0 + deg(s.len * 0.5));
        return <path key={i} d={`M${q0.x},${q0.y} A${rho},${rho} 0 0 1 ${q1.x},${q1.y}`} strokeWidth={s.w} opacity={s.o} />;
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
  const at = (u: number, v: number) => `${P(u, v).x.toFixed(1)},${P(u, v).y.toFixed(1)}`;
  const boot = [
    `M${at(-24, 0)}`,
    `L${at(BOOT_L - T_TOE / 2, 0)}`,
    `A${T_TOE / 2},${T_TOE / 2} 0 0 1 ${at(BOOT_L - T_TOE / 2, T_TOE)}`,
    `Q${at(170, 128)} ${at(70, 160)}`,
    `Q${at(10, 186)} ${at(-34, 116)}`,
    "Z",
  ].join(" ");
  const sole = `M${at(BOOT_L - 40, T_TOE - 6)} Q${at(170, 124)} ${at(70, 156)}`;
  // Studs sit on the sole edge and point away from the laces.
  const studs = [
    { u: 216, v: 105 },
    { u: 152, v: 131 },
    { u: 30, v: 166 },
  ];
  const laces = [30, 70, 110, 150, 190];
  return (
    <g>
      {/* Sock (teal) with a darker back. */}
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
      {/* Heel counter. */}
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

// ---- The ball, squashed flat against the laces ----
const SquashedBall: React.FC = () => {
  const ang = (Math.atan2(n.y, n.x) * 180) / Math.PI;
  const far = 3000;
  const half = [add(add(F, d, far), n, -1), add(add(F, d, -far), n, -1), add(add(F, d, -far), n, far), add(add(F, d, far), n, far)];
  return (
    <g>
      <defs>
        <clipPath id="tc-flat">
          <polygon points={pts(half)} />
        </clipPath>
      </defs>
      <g clipPath="url(#tc-flat)">
        <g transform={`translate(${B.x} ${B.y}) rotate(${ang}) scale(${SQUASH} ${1 / SQUASH}) rotate(${-ang}) translate(${-B.x} ${-B.y})`}>
          <Ball cx={B.x} cy={B.y} r={R} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={0} lineNormal={{ x: -0.35, y: -0.3, z: 0.88 }} />
        </g>
      </g>
    </g>
  );
};

// ---- Impact: burst lines at the two ends of the contact ----
const Impact: React.FC = () => {
  const top = add(F, d, -HALF_CHORD - 6);
  const bot = add(F, d, HALF_CHORD + 6);
  const ray = (p: P2, dirDeg: number, r0: number, r1: number, key: string) => {
    const a = deg(dirDeg);
    const q0 = polar(p, r0, a);
    const q1 = polar(p, r1, a);
    return <line key={key} x1={q0.x} y1={q0.y} x2={q1.x} y2={q1.y} stroke={PITCH.light} strokeWidth={12} strokeLinecap="round" />;
  };
  return (
    <g>
      {[-100, -70, -40].map((a, i) => ray(top, a, 24, i === 1 ? 88 : 66, `t${i}`))}
      {[35, 70, 105].map((a, i) => ray(bot, a, 24, i === 1 ? 80 : 60, `b${i}`))}
    </g>
  );
};

// ---- Spin arrow: the top of the ball turns backward (a little backspin) ----
const SpinArrow: React.FC = () => {
  const rr = R + 42;
  const a0 = deg(-20);
  const a1 = deg(-110);
  const q0 = polar(B, rr, a0);
  const q1 = polar(B, rr, a1);
  // Travel is towards smaller angles, so the tangent is (sin a, -cos a).
  const t = { x: Math.sin(a1), y: -Math.cos(a1) };
  const nn = { x: -t.y, y: t.x };
  const tip = add(q1, t, 30);
  const w1 = add(add(q1, t, -8), nn, 28);
  const w2 = add(add(q1, t, -8), nn, -28);
  return (
    <g>
      <path d={`M${q0.x},${q0.y} A${rr},${rr} 0 0 0 ${q1.x},${q1.y}`} fill="none" stroke={PITCH.light} strokeWidth={16} strokeLinecap="round" />
      <polygon points={pts([tip, w1, w2])} fill={PITCH.light} stroke={PITCH.light} strokeWidth={8} strokeLinejoin="round" />
    </g>
  );
};

// ---- Stopwatch ----
const Stopwatch: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) => {
  const hand = deg(-90 + 14);
  const top = deg(-90);
  const e0 = polar({ x: 0, y: 0 }, r * 0.58, top);
  const e1 = polar({ x: 0, y: 0 }, r * 0.58, hand);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-r * 0.12} y={-r * 1.28} width={r * 0.24} height={r * 0.3} fill={PITCH.chalk} />
      <rect x={-r * 0.3} y={-r * 1.42} width={r * 0.6} height={r * 0.2} rx={r * 0.1} fill={PITCH.chalk} />
      <g transform="rotate(45)">
        <rect x={-r * 0.1} y={-r * 1.22} width={r * 0.2} height={r * 0.3} rx={r * 0.06} fill={PITCH.chalk} />
      </g>
      <circle r={r} fill={PITCH.chalk} />
      <circle r={r * 0.8} fill={PITCH.skyHigh} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = deg(i * 30);
        const q0 = polar({ x: 0, y: 0 }, r * 0.62, a);
        const q1 = polar({ x: 0, y: 0 }, r * 0.72, a);
        return <line key={i} x1={q0.x} y1={q0.y} x2={q1.x} y2={q1.y} stroke={PITCH.chalk} strokeWidth={r * 0.06} strokeLinecap="round" opacity={0.7} />;
      })}
      <path d={`M0,0 L${e0.x},${e0.y} A${r * 0.58},${r * 0.58} 0 0 1 ${e1.x},${e1.y} Z`} fill={CAST.band} opacity={0.9} />
      <line x1={0} y1={0} x2={Math.cos(hand) * r * 0.66} y2={Math.sin(hand) * r * 0.66} stroke={CAST.band} strokeWidth={r * 0.09} strokeLinecap="round" />
      <circle r={r * 0.1} fill={CAST.band} />
    </g>
  );
};

// ---- Words ----
const Words: React.FC<{ cx: number }> = ({ cx }) => (
  <g fontFamily={FONTS.title} fontWeight={800} textAnchor="middle">
    <text x={cx} y={420} fontSize={196} fill={INK}>0.01</text>
    <text x={cx} y={412} fontSize={196} fill={PITCH.light}>0.01</text>
    <text x={cx} y={518} fontSize={80} fill={INK} letterSpacing={1}>SECONDS</text>
    <text x={cx} y={512} fontSize={80} fill={PITCH.chalk} letterSpacing={1}>SECONDS</text>
  </g>
);

export const ThumbC: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Background />
      <ellipse cx={PIVOT.x + (B.x - PIVOT.x) * ZOOM + 20} cy={GROUND_Y + 12} rx={150} ry={11} fill={INK} opacity={0.35} />
      <g transform={`translate(${PIVOT.x} ${PIVOT.y}) scale(${ZOOM}) translate(${-PIVOT.x} ${-PIVOT.y})`}>
        <Flash />
        <SpeedLines />
        <SpinArrow />
        <SquashedBall />
        <Leg />
        <Impact />
      </g>
      <Stopwatch x={1032} y={168} r={76} />
      <Words cx={1032} />
    </svg>
  </AbsoluteFill>
);
