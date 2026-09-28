// Thumbnail set 4, slot B, for "Three Spins and a Line" (1280x720): "FASTER THAN MY FOOT".
// A race between the boot and the ball. Two big speed bars streak in from the left: the teal
// FOOT bar ends at Tavi's white boot, the orange BALL bar ends at the ball with its Line, and the
// ball is clearly ahead. The orange bar breaks into a trail of shorter dashes, so it reads as the
// ball's path. The ball and boot positions keep the video's honest ratio (about 1.3x, no digits).
// The words are the legend: FASTER is ball orange, FOOT is sock teal, so the bars need no labels.
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Ball } from "../../../kit/Ball";
import { Glow } from "../../../kit/World";
import type { View } from "../../../lib/project";
import { CAST, FONTS, PITCH } from "../../../theme";

const W = 1280;
const H = 720;
const INK = "#070920";
const SOLE = "#A9A294";
const SIDE: View = { kind: "side", originX: 0, groundY: 0, ppm: 1 };

type P2 = { x: number; y: number };
const deg = (v: number) => (v * Math.PI) / 180;

// ---- Layout (before the tilt) ----
const HORIZON = 612;
const TILT = -4; // the race rises a little to the right
const PIVOT: P2 = { x: 640, y: 470 };
const BAR_X0 = -80; // both bars start off the left edge (a common start)
const BAR_H = 104;
const BALL_Y = 404;
const FOOT_Y = 556;
const FOOT_END = 490; // end of the teal bar (the ankle)
const BALL_R = 140;
const BALL_X = 962; // ball centre: the orange bar ends here
const C_FASTER = CAST.ball;
const C_MY = "#FFFFFF";
const C_FOOT = CAST.sock;
const C_MARK = "#FFFFFF";
const BOOT_S = 0.78;
// The ball's trail: the solid bar ends early, then two shorter, thinner dashes lead to the ball.
const TRAIL_GAP = 18; // gap between the pieces
const BALL_GAP = 26; // gap between the last dash and the ball edge
const DASHES = [
  { len: 132, h: 70 },
  { len: 76, h: 44 },
];
const trailPieces = () => {
  let x = BALL_X - BALL_R - BALL_GAP;
  const out: { x0: number; x1: number; h: number }[] = [];
  for (let i = DASHES.length - 1; i >= 0; i--) {
    out.unshift({ x0: x - DASHES[i].len, x1: x, h: DASHES[i].h });
    x -= DASHES[i].len + TRAIL_GAP;
  }
  return { barEnd: x, dashes: out };
};

// ---- Background ----
const Background: React.FC = () => (
  <g>
    <defs>
      <linearGradient id="s4b-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#080B24" />
        <stop offset="1" stopColor={PITCH.sky} />
      </linearGradient>
      <radialGradient id="s4b-vig" cx={0.5} cy={0.5} r={0.75}>
        <stop offset="0.6" stopColor="#050716" stopOpacity={0} />
        <stop offset="1" stopColor="#050716" stopOpacity={0.55} />
      </radialGradient>
    </defs>
    <rect width={W} height={H} fill="url(#s4b-sky)" />
    {Array.from({ length: 46 }, (_, i) => (
      <circle key={i} cx={random(`s4b-sx-${i}`) * W} cy={random(`s4b-sy-${i}`) * 260} r={0.8 + random(`s4b-sr-${i}`) * 1.4} fill="#FFFFFF" opacity={0.18 + random(`s4b-so-${i}`) * 0.4} />
    ))}
    {[
      [940, 70, 1],
      [1130, 60, 0.8],
    ].map(([x, y, s], i) => (
      <g key={i}>
        <Glow cx={x} cy={y} r={200 * s} color={PITCH.lightSoft} intensity={0.6} rings={6} />
        <rect x={x - 52 * s} y={y - 24 * s} width={104 * s} height={48 * s} rx={16 * s} fill={PITCH.lightSoft} />
      </g>
    ))}
    {/* Stands. */}
    <path d={`M-40,${HORIZON} L0,${HORIZON - 190} L${W},${HORIZON - 190} L${W + 40},${HORIZON} Z`} fill={PITCH.stands} />
    <rect x={-40} y={HORIZON - 216} width={W + 80} height={34} rx={17} fill={PITCH.standsLight} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={-40} y={HORIZON - 150 + i * 48} width={W + 80} height={20} rx={10} fill={PITCH.standsLight} opacity={0.35} />
    ))}
    {/* Grass. */}
    <rect x={0} y={HORIZON} width={W} height={H - HORIZON} fill={PITCH.grassDark} />
    {Array.from({ length: 9 }, (_, i) => {
      const x0 = -300 + i * 220;
      const fan = (x0 + 55 - 640) * 0.9;
      return <path key={i} d={`M${x0},${HORIZON} L${x0 + 110},${HORIZON} L${x0 + 110 + fan},${H} L${x0 + fan},${H} Z`} fill={PITCH.grass} />;
    })}
    <rect x={0} y={HORIZON - 3} width={W} height={6} fill={PITCH.grassLight} />
    <rect width={W} height={H} fill="url(#s4b-vig)" />
  </g>
);

// ---- Speed lines: white streaks behind the racers (before the tilt) ----
// Thick, bright streaks ride with the ball. Only thin, dim ones trail the boot.
const STREAKS: { x: number; y: number; len: number; w: number; o: number }[] = [
  { x: 620, y: 300, len: 170, w: 14, o: 0.95 },
  { x: 430, y: 330, len: 230, w: 13, o: 0.85 },
  { x: 700, y: 484, len: 110, w: 12, o: 0.8 },
  { x: 300, y: 636, len: 130, w: 6, o: 0.45 },
];

// ---- The boot: side view, toes forward and a little down (laces strike) ----
// Local units: u along the foot towards the toe, v from the laces towards the sole.
const Boot: React.FC<{ ankle: P2; angle: number; s: number }> = ({ ankle, angle, s }) => {
  const d: P2 = { x: Math.cos(deg(angle)), y: Math.sin(deg(angle)) };
  const m: P2 = { x: -d.y, y: d.x };
  const P = (u: number, v: number): P2 => ({ x: ankle.x + (d.x * u + m.x * v) * s, y: ankle.y + (d.y * u + m.y * v) * s });
  const at = (u: number, v: number) => `${P(u, v).x.toFixed(1)},${P(u, v).y.toFixed(1)}`;
  const poly = (list: P2[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const L = 320;
  const T = 76;
  const body = [`M${at(-24, 0)}`, `L${at(L - T / 2, 0)}`, `A${(T / 2) * s},${(T / 2) * s} 0 0 1 ${at(L - T / 2, T)}`, `Q${at(170, 128)} ${at(70, 160)}`, `Q${at(10, 186)} ${at(-34, 116)}`, "Z"].join(" ");
  const sole = `M${at(L - 40, T - 6)} Q${at(170, 124)} ${at(70, 156)}`;
  const studs = [
    { u: 216, v: 105 },
    { u: 152, v: 131 },
    { u: 30, v: 166 },
  ];
  return (
    <g>
      {studs.map((st, i) => (
        <polygon key={i} points={poly([P(st.u - 15, st.v - 4), P(st.u + 15, st.v - 4), P(st.u + 9, st.v + 20), P(st.u - 9, st.v + 20)])} fill={SOLE} stroke={SOLE} strokeWidth={6 * s} strokeLinejoin="round" />
      ))}
      <path d={body} fill={CAST.boot} />
      <path d={`M${at(-34, 116)} Q${at(10, 186)} ${at(70, 160)} Q${at(40, 128)} ${at(-26, 84)} Z`} fill={CAST.bootShade} opacity={0.8} />
      <path d={sole} fill="none" stroke={CAST.bootShade} strokeWidth={26 * s} strokeLinecap="round" />
      <path d={sole} fill="none" stroke={SOLE} strokeWidth={10 * s} strokeLinecap="round" transform={`translate(${m.x * 10 * s} ${m.y * 10 * s})`} />
      {[30, 70, 110, 150, 190].map((u, i) => (
        <line key={i} x1={P(u, 10).x} y1={P(u, 10).y} x2={P(u + 16, 34).x} y2={P(u + 16, 34).y} stroke={CAST.bootShade} strokeWidth={9 * s} strokeLinecap="round" />
      ))}
    </g>
  );
};

/** A rounded bar (x0 to x1, height h) with a flat ink shadow under it and a shade band. */
const Bar: React.FC<{ y: number; x0?: number; x1: number; h?: number; color: string; shade: string }> = ({ y, x0 = BAR_X0, x1, h = BAR_H, color, shade }) => (
  <g>
    <rect x={x0} y={y - h / 2 + 12} width={x1 - x0} height={h} rx={h / 2} fill={INK} opacity={0.7} />
    <rect x={x0} y={y - h / 2} width={x1 - x0} height={h} rx={h / 2} fill={color} />
    <rect x={x0 + h * 0.15} y={y + h * 0.2} width={x1 - x0 - h * 0.45} height={h * 0.3} rx={h * 0.15} fill={shade} opacity={0.6} />
  </g>
);

export const Set4B: React.FC = () => {
  const ankle: P2 = { x: FOOT_END - 6, y: FOOT_Y - BAR_H / 2 + 4 };
  const trail = trailPieces();
  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Background />
        <g transform={`rotate(${TILT} ${PIVOT.x} ${PIVOT.y})`}>
          <g stroke={PITCH.chalk} strokeLinecap="round">
            {STREAKS.map((st, i) => (
              <line key={i} x1={st.x} y1={st.y} x2={st.x + st.len} y2={st.y} strokeWidth={st.w} opacity={st.o} />
            ))}
          </g>
          {/* FOOT: teal bar, the boot at its end. */}
          <Bar y={FOOT_Y} x1={FOOT_END} color={CAST.sock} shade={CAST.sockShade} />
          <Boot ankle={ankle} angle={8} s={BOOT_S} />
          {/* BALL: orange bar that breaks into a trail, the ball at its end, clearly ahead. */}
          <Bar y={BALL_Y} x1={trail.barEnd} color={CAST.ball} shade={CAST.ballShade} />
          {trail.dashes.map((d, i) => (
            <Bar key={i} y={BALL_Y} x0={d.x0} x1={d.x1} h={d.h} color={CAST.ball} shade={CAST.ballShade} />
          ))}
          <Glow cx={BALL_X} cy={BALL_Y} r={BALL_R * 1.5} color={PITCH.light} intensity={1.2} rings={6} />
          <Ball cx={BALL_X} cy={BALL_Y} r={BALL_R} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={0} lineNormal={{ x: -0.8, y: -0.2, z: 0.56 }} />
        </g>
        {/* Words. */}
        <g fontFamily={FONTS.title} fontWeight={800}>
          <text x={52} y={137} fontSize={112} fill={INK}>
            FASTER THAN
          </text>
          <text x={52} y={128} fontSize={112}>
            <tspan fill={C_FASTER}>FASTER</tspan>
            <tspan fill="#FFFFFF"> THAN</tspan>
          </text>
          <text x={52} y={273} fontSize={140} fill={INK}>
            MY FOOT?!
          </text>
          <text x={52} y={262} fontSize={140}>
            <tspan fill={C_MY}>MY </tspan>
            <tspan fill={C_FOOT}>FOOT</tspan>
            <tspan fill={C_MARK}>?!</tspan>
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
