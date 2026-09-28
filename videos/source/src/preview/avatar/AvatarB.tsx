// Profile avatar concept B, "Shoulders": Chalk carries his son on his shoulders. The son is a Chalk too
// (called Jr. here): same pitch-paint design, rounder, bigger eyes, tiny mittens.
// Jr. holds the orange ball up high with both mittens. Chalk holds his son's ankles.
// 800x800, shown as a circle. Faces and key shapes stay in the inner 70% circle.
import React from "react";
import { AbsoluteFill } from "remotion";
import { CAST, PITCH } from "../../theme";
import { Glow } from "../../kit/World";
import { Ball } from "../../kit/Ball";
import type { View } from "../../lib/project";

const S = 800;
const CH = CAST.keeper;
const SH = CAST.keeperShade;
const EYE = CAST.keeperEye;
const VIEW: View = { kind: "side", originX: 0, groundY: 0, ppm: 1 };

/**
 * Mitten glove, same shapes as the kit Keeper: a rounded palm, a thumb and a cuff.
 * Origin = wrist. Fingers point up at rot 0. `thumb` = side of the thumb (-1 screen left, 1 screen right).
 */
const Mitten: React.FC<{ x: number; y: number; g: number; rot: number; thumb: 1 | -1 }> = ({ x, y, g, rot, thumb }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <rect x={-g * 0.95} y={-g * 1.9} width={g * 1.9} height={g * 2.1} rx={g * 0.9} fill={CH} />
    <ellipse
      cx={thumb * g * 0.95}
      cy={-g * 0.6}
      rx={g * 0.42}
      ry={g * 0.62}
      fill={CH}
      transform={`rotate(${thumb * 25} ${thumb * g * 0.95} ${-g * 0.6})`}
    />
    <rect x={-g * 0.8} y={-g * 0.15} width={g * 1.6} height={g * 0.5} rx={g * 0.25} fill={SH} />
    <rect x={-g * 0.5 - thumb * g * 0.1} y={-g * 0.72} width={g * 1.1} height={g * 0.14} rx={g * 0.07} fill={SH} opacity={0.7} />
  </g>
);

/** Arched "happy" eyebrow: a short dash bowed upwards. */
const Brow: React.FC<{ x: number; y: number; w: number; lift: number; tilt: number; sw: number }> = ({ x, y, w, lift, tilt, sw }) => (
  <path
    d={`M${x - w / 2},${y} Q${x},${y - lift} ${x + w / 2},${y}`}
    fill="none"
    stroke={EYE}
    strokeWidth={sw}
    strokeLinecap="round"
    transform={`rotate(${tilt} ${x} ${y})`}
  />
);

const SIDES = [-1, 1] as const;

/**
 * A dot eye. `smile` 0..1 lifts a lower lid into it, so the dot turns into a happy crescent.
 * `spark` adds a highlight.
 */
const Eye: React.FC<{ id: string; x: number; y: number; r: number; smile?: number; spark?: boolean }> = ({ id, x, y, r, smile = 0, spark = false }) => (
  <g>
    {smile > 0 ? (
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x={x - r * 2} y={y - r * 2} width={r * 4} height={r * 4}>
          <rect x={x - r * 2} y={y - r * 2} width={r * 4} height={r * 4} fill="#fff" />
          <circle cx={x} cy={y + r * (2.2 - smile * 1.25)} r={r * 0.98} fill="#000" />
        </mask>
      </defs>
    ) : null}
    <circle cx={x} cy={y} r={r} fill={EYE} mask={smile > 0 ? `url(#${id})` : undefined} />
    {spark ? <circle cx={x - r * 0.34} cy={y - r * 0.36} r={r * 0.33} fill={CH} /> : null}
  </g>
);

// ---- Layout (all in 800 px space, before the final fit scale). ----
const CX = 400;
/** Fit: scale the whole pair about the centre, then nudge it up. */
const FIT = 0.95;
const NUDGE = -6;
/** Dad's smile (0 = round dots, 1 = happy crescents). */
const DAD_SMILE = 0.6;
// Dad: origin at the top of his dome.
const DW = 330;
const DT = 430;
const D_EY = DW * 0.58;
const D_EX = DW * 0.17;
const D_ER = DW * 0.078;
// Jr.: origin at the middle of his bottom. He sits on top of his dad's dome and leans a little.
const JW = 206;
const JH = 222;
const JB = DT + 22;
const J_LEAN = -5;
// Ball, in Jr.'s frame (before his lean).
const BR = 56;
const BX = CX;
const BY = JB - JH - 44;

/** A few faint stars, well away from the pair: [x, y, r, opacity]. */
const STARS: [number, number, number, number][] = [
  [150, 190, 4, 0.8],
  [118, 300, 2.5, 0.55],
  [225, 105, 3, 0.6],
  [610, 110, 3.5, 0.75],
  [680, 225, 2.5, 0.55],
  [700, 330, 3.5, 0.7],
  [96, 420, 3, 0.5],
];

/** Turn a point about Jr.'s seat by his lean. */
const lean = (p: { x: number; y: number }) => {
  const a = (J_LEAN * Math.PI) / 180;
  const dx = p.x - CX;
  const dy = p.y - JB;
  return { x: CX + dx * Math.cos(a) - dy * Math.sin(a), y: JB + dx * Math.sin(a) + dy * Math.cos(a) };
};

/** Big Chalk from the dome down, in local space (0,0 = top of the dome). */
const Dad: React.FC = () => (
  <g>
    <defs>
      <clipPath id="avb-dad">
        <rect x={-DW / 2} y={0} width={DW} height={900} rx={DW / 2} />
      </clipPath>
    </defs>
    <rect x={-DW / 2} y={0} width={DW} height={900} rx={DW / 2} fill={CH} />
    <rect x={DW * 0.12} y={DW * 0.2} width={DW * 0.26} height={700} rx={DW * 0.13} fill={SH} opacity={0.55} />
    {/* Jr.'s shadow on his dad's head. */}
    <g clipPath="url(#avb-dad)">
      <ellipse cx={-10} cy={JB - DT + 2} rx={JW * 0.3} ry={20} fill={SH} />
    </g>
    {SIDES.map((s) => (
      <g key={s}>
        <Eye id={`avb-de${s}`} x={s * D_EX} y={D_EY} r={D_ER * (1 + DAD_SMILE * 0.12)} smile={DAD_SMILE} />
        <Brow x={s * D_EX} y={D_EY - DW * 0.18} w={DW * 0.15} lift={DW * 0.055} tilt={-s * 6} sw={DW * 0.042} />
      </g>
    ))}
  </g>
);

/** Chalk Jr.: a short round capsule, big eyes with a sparkle. Local (0,0) = middle of his bottom. */
const Jr: React.FC = () => {
  const ey = -JH + JW * 0.56;
  const ex = JW * 0.22;
  const r = JW * 0.105;
  return (
    <g>
      <rect x={-JW / 2} y={-JH} width={JW} height={JH} rx={JW / 2} fill={CH} />
      <rect x={JW * 0.13} y={-JH + JW * 0.18} width={JW * 0.24} height={JH - JW * 0.36} rx={JW * 0.12} fill={SH} opacity={0.55} />
      {SIDES.map((s) => (
        <g key={s}>
          <Eye id={`avb-je${s}`} x={s * ex} y={ey} r={r} spark />
          <Brow x={s * ex} y={ey - JW * 0.24} w={JW * 0.16} lift={JW * 0.07} tilt={-s * 6} sw={JW * 0.05} />
        </g>
      ))}
    </g>
  );
};

/** A bent limb: shoulder, elbow, wrist. */
const Limb: React.FC<{ a: { x: number; y: number }; e: { x: number; y: number }; b: { x: number; y: number }; w: number }> = ({ a, e, b, w }) => (
  <path d={`M${a.x},${a.y} L${e.x},${e.y} L${b.x},${b.y}`} fill="none" stroke={SH} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
);

export const AvatarB: React.FC = () => {
  // Jr.'s legs dangle down on each side of his dad's face.
  const legW = 40;
  const legTop = (s: 1 | -1) => lean({ x: CX + s * 80, y: JB - 18 });
  const legEnd = (s: 1 | -1) => ({ x: CX + s * 126, y: DT + D_EY + 6 });
  // Dad's arms: elbows out, mittens hold Jr.'s ankles by his cheeks.
  const dG = 42;
  const dShoulder = (s: 1 | -1) => ({ x: CX + s * DW * 0.36, y: DT + DW * 0.84 });
  const dElbow = (s: 1 | -1) => ({ x: CX + s * 226, y: DT + D_EY + 104 });
  const dWrist = (s: 1 | -1) => ({ x: CX + s * 170, y: DT + D_EY + 48 });
  // Jr.'s arms: elbows out too, mittens on the sides of the ball (in his own leaning frame).
  const jG = 30;
  const jShoulder = (s: 1 | -1) => ({ x: CX + s * JW * 0.4, y: JB - JH * 0.52 });
  const jElbow = (s: 1 | -1) => ({ x: CX + s * 142, y: BY + 70 });
  const jWrist = (s: 1 | -1) => ({ x: BX + s * (BR + 14), y: BY + BR * 0.62 });

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        {/* Background: night navy with an indigo halo behind the pair. */}
        <rect width={S} height={S} fill={PITCH.skyHigh} />
        <Glow cx={CX} cy={400} r={430} color={PITCH.standsLight} intensity={2.2} rings={6} />
        {STARS.map(([x, y, r, o], i) => (
          <circle key={`st${i}`} cx={x} cy={y} r={r} fill={PITCH.lightSoft} opacity={o} />
        ))}

        <g transform={`translate(${CX} ${S / 2 + NUDGE}) scale(${FIT}) translate(${-CX} ${-S / 2})`}>
          {/* Dad: arms behind, body, face. */}
          {SIDES.map((s) => (
            <Limb key={`da${s}`} a={dShoulder(s)} e={dElbow(s)} b={dWrist(s)} w={DW * 0.135} />
          ))}
          <g transform={`translate(${CX} ${DT})`}>
            <Dad />
          </g>

          {/* Jr.'s legs. */}
          {SIDES.map((s) => {
            const a = legTop(s);
            const b = legEnd(s);
            return <line key={`jl${s}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={SH} strokeWidth={legW} strokeLinecap="round" />;
          })}

          {/* Jr., leaning a little, with the ball held up high in his tiny mittens. */}
          <g transform={`rotate(${J_LEAN} ${CX} ${JB})`}>
            <Glow cx={BX} cy={BY} r={BR * 2} color={PITCH.light} intensity={0.9} rings={3} />
            {SIDES.map((s) => (
              <Limb key={`ja${s}`} a={jShoulder(s)} e={jElbow(s)} b={jWrist(s)} w={JW * 0.15} />
            ))}
            <g transform={`translate(${CX} ${JB})`}>
              <Jr />
            </g>
            <Ball cx={BX} cy={BY} r={BR} view={VIEW} patches={false} />
            {SIDES.map((s) => (
              <Mitten key={`jm${s}`} x={jWrist(s).x} y={jWrist(s).y} g={jG} rot={-s * 30} thumb={s === 1 ? -1 : 1} />
            ))}
          </g>

          {/* Dad's mittens round Jr.'s ankles. */}
          {SIDES.map((s) => (
            <Mitten key={`dm${s}`} x={dWrist(s).x} y={dWrist(s).y} g={dG} rot={-s * 28} thumb={s === 1 ? -1 : 1} />
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
