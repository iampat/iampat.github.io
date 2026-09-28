// Profile avatar concept A, "TEAM": Chalk and Chalk Jr. side by side (800x800, shown as a circle).
// Big Chalk gives a thumbs-up and rests his other mitten on his son's rounded shoulder.
// Chalk Jr. hugs the orange ball with its white line (the series motif).
// Both are pitch paint: white capsules, dot eyes, eyebrow dashes, no mouths.
import React from "react";
import { AbsoluteFill } from "remotion";
import { CAST, PITCH } from "../../theme";
import { Glow } from "../../kit/World";
import { Ball } from "../../kit/Ball";
import type { View } from "../../lib/project";

const S = 800;
const BALL_VIEW: View = { kind: "side", originX: 0, groundY: 0, ppm: 60 };

const BODY = CAST.keeper;
const SHADE = CAST.keeperShade;
const INK = CAST.keeperEye;
const BLUSH = CAST.ball;

/** Capsule body with the pale shade stripe on its right side. */
const Capsule: React.FC<{ cx: number; top: number; w: number; h: number }> = ({ cx, top, w, h }) => (
  <g>
    <rect x={cx - w / 2} y={top} width={w} height={h} rx={w / 2} fill={BODY} />
    <rect x={cx + w * 0.12} y={top + w * 0.2} width={w * 0.26} height={h} rx={w * 0.13} fill={SHADE} opacity={0.55} />
  </g>
);

/**
 * Mitten glove in the Keeper style. The wrist is at (x, y) and the fingers point along +y before `rot`.
 * `thumb` puts the thumb on the local -x (-1) or +x (1) side.
 */
const Mitten: React.FC<{ x: number; y: number; rot: number; g: number; thumb: 1 | -1; shadow?: boolean }> = ({ x, y, rot, g, thumb, shadow }) => {
  const shape = (fill: string) => (
    <>
      <rect x={-g * 0.95} y={-g * 0.2} width={g * 1.9} height={g * 2.1} rx={g * 0.9} fill={fill} />
      <ellipse
        cx={thumb * g * 0.95}
        cy={g * 0.55}
        rx={g * 0.42}
        ry={g * 0.62}
        fill={fill}
        transform={`rotate(${thumb * 25} ${thumb * g * 0.95} ${g * 0.55})`}
      />
    </>
  );
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      {shadow ? <g transform={`translate(${g * 0.12} ${g * 0.16})`}>{shape(SHADE)}</g> : null}
      {shape(BODY)}
      <rect x={-g * 0.8} y={-g * 0.35} width={g * 1.6} height={g * 0.5} rx={g * 0.25} fill={SHADE} />
      <rect x={-g * 0.5} y={g * 0.75} width={g * 1.1} height={g * 0.14} rx={g * 0.07} fill={SHADE} opacity={0.7} />
    </g>
  );
};

/** Dot eye. `smile` (0..1) cuts the bottom with an upward arch, like a happy squint. */
const SmileEye: React.FC<{ id: string; cx: number; cy: number; r: number; smile: number; shine?: boolean }> = ({ id, cx, cy, r, smile, shine }) => {
  const edge = cy + r * (1.2 - smile * 0.5);
  const mid = cy + r * (1.6 - smile * 2.8);
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <path
            d={`M${cx - r * 1.3},${cy - r * 1.3} L${cx + r * 1.3},${cy - r * 1.3} L${cx + r * 1.3},${edge} Q${cx},${2 * mid - edge} ${cx - r * 1.3},${edge} Z`}
          />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={INK} clipPath={smile > 0 ? `url(#${id})` : undefined} />
      {shine ? <circle cx={cx - r * 0.3} cy={cy - r * 0.32} r={r * 0.32} fill={BODY} /> : null}
    </g>
  );
};

/** Mitten seen from the side, clenched, thumb up. The arm comes in from local -x. */
const ThumbsUp: React.FC<{ x: number; y: number; rot: number; g: number }> = ({ x, y, rot, g }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <rect x={-g * 0.1} y={-g * 1.75} width={g * 0.72} height={g * 1.3} rx={g * 0.36} fill={BODY} transform={`rotate(8 ${g * 0.26} ${-g * 0.6})`} />
    <rect x={-g * 0.2} y={-g * 0.75} width={g * 1.9} height={g * 1.55} rx={g * 0.72} fill={BODY} />
    <rect x={g * 0.95} y={-g * 0.45} width={g * 0.14} height={g * 0.95} rx={g * 0.07} fill={SHADE} opacity={0.7} />
    <rect x={-g * 0.55} y={-g * 0.7} width={g * 0.55} height={g * 1.45} rx={g * 0.27} fill={SHADE} />
  </g>
);

/** Happy eyebrow: a short arch, raised in the middle. `tilt` lowers the outer end. */
const Brow: React.FC<{ cx: number; cy: number; len: number; arch: number; width: number; side: 1 | -1; tilt?: number }> = ({
  cx,
  cy,
  len,
  arch,
  width,
  side,
  tilt = 0,
}) => {
  const x1 = cx - len / 2;
  const x2 = cx + len / 2;
  const y1 = cy + (side === -1 ? tilt : -tilt * 0.3);
  const y2 = cy + (side === 1 ? tilt : -tilt * 0.3);
  return <path d={`M${x1},${y1} Q${cx},${cy - arch} ${x2},${y2}`} fill="none" stroke={INK} strokeWidth={width} strokeLinecap="round" />;
};

// Both lean their heads towards each other, pivoting on feet far below the frame.
const PIVOT_Y = 920;
const ZOOM = 1.02;
const STARS: [number, number, number][] = [
  [470, 92, 3],
  [575, 140, 2.5],
  [650, 215, 3],
  [540, 250, 2],
  [700, 330, 2.5],
  [120, 205, 2.5],
];
const rotP = (x: number, y: number, cx: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - PIVOT_Y;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: PIVOT_Y + dx * Math.sin(a) + dy * Math.cos(a) };
};

// Big Chalk. Only the top of his capsule shows.
const F = { cx: 226, top: 124, w: 250, lean: 5 };
const FH = F.w / 0.34; // full height of the character
const F_EYE_Y = F.top + F.w * 0.5;
const F_EYE_DX = F.w * 0.19;
const F_EYE_R = 27;
const F_SHOULDER_Y = F.top + FH * 0.28;

// Chalk Jr.: narrower and lower (about 60 % of his height), eyes big and set low on the face.
// A gap of night sky between the two capsules keeps them two shapes at 24 px.
const J = { cx: 570, w: 206, top: 378, lean: -4 };
const J_EYE_Y = J.top + J.w * 0.62;
const J_FACE_X = J.cx + 6;
const J_EYE_DX = J.w * 0.19;
const J_EYE_R = 21;

// The ball Chalk Jr. holds up in front of him.
const BALL = { x: J.cx - 4, y: J.top + J.w * 1.16, r: 60 };

export const AvatarA: React.FC = () => {
  const jArmW = 30;
  const jShoulderY = J.top + J.w * 0.9;
  const jg = BALL.r * 0.4;
  const fg = FH * 0.062;
  const fArmW = FH * 0.06;
  // Wrist of the hand on the son's near shoulder (in the son's frame), and the father's shoulder (in his own frame).
  const pat = { x: J.cx - J.w * 0.36, y: J.top + J.w * 0.06 };
  const patS = rotP(pat.x, pat.y, J.cx, J.lean);
  const fShoulderS = rotP(F.cx + F.w * 0.4, F_SHOULDER_Y, F.cx, F.lean);
  const hold = { dx: BALL.r + jg * 0.75, y: BALL.y + BALL.r * 0.18 };
  const thumb = { x: F.cx - F.w * 0.7, y: F_SHOULDER_Y + 56 };
  const fFrame = `rotate(${F.lean} ${F.cx} ${PIVOT_Y})`;
  const jFrame = `rotate(${J.lean} ${J.cx} ${PIVOT_Y})`;
  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.skyHigh }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <defs>
          <linearGradient id="avA-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PITCH.skyHigh} />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
        </defs>
        <rect width={S} height={S} fill="url(#avA-sky)" />
        {/* Floodlight halo behind the heads. */}
        <Glow cx={420} cy={360} r={440} color={PITCH.standsLight} intensity={2.4} rings={7} />
        <Glow cx={420} cy={330} r={300} color={PITCH.lightSoft} intensity={0.22} rings={4} />
        {/* Grass hill at the bottom. */}
        <ellipse cx={400} cy={1060} rx={720} ry={420} fill={PITCH.grassDark} />
        <ellipse cx={400} cy={1090} rx={700} ry={400} fill={PITCH.grass} />
        {/* A painted pitch line on the grass: what both of them are made of. */}
        <ellipse cx={400} cy={1150} rx={720} ry={410} fill="none" stroke={BODY} strokeWidth={9} opacity={0.75} />
        {/* A few faint stars in the open sky. */}
        {STARS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={PITCH.lightSoft} opacity={0.55} />
        ))}

        {/* The pair, zoomed a little so the faces read at small sizes. */}
        <g transform={`translate(400 400) scale(${ZOOM}) translate(-400 -400)`}>
          {/* Big Chalk: thumbs-up arm, body, happy squint. */}
          <g transform={fFrame}>
            <line x1={F.cx - F.w * 0.42} y1={F_SHOULDER_Y} x2={thumb.x + fg * 0.1} y2={thumb.y} stroke={SHADE} strokeWidth={fArmW} strokeLinecap="round" />
            <ThumbsUp x={thumb.x} y={thumb.y} rot={-12 - F.lean} g={fg * 0.95} />
            <Capsule cx={F.cx} top={F.top} w={F.w} h={S} />
            <SmileEye id="avA-fl" cx={F.cx - F_EYE_DX} cy={F_EYE_Y} r={F_EYE_R} smile={0.45} />
            <SmileEye id="avA-fr" cx={F.cx + F_EYE_DX} cy={F_EYE_Y} r={F_EYE_R} smile={0.45} />
            <Brow cx={F.cx - F_EYE_DX} cy={F_EYE_Y - 54} len={52} arch={15} width={15} side={-1} tilt={7} />
            <Brow cx={F.cx + F_EYE_DX} cy={F_EYE_Y - 54} len={52} arch={15} width={15} side={1} tilt={7} />
            <ellipse cx={F.cx - F_EYE_DX - 16} cy={F_EYE_Y + 34} rx={24} ry={12} fill={BLUSH} opacity={0.26} />
            <ellipse cx={F.cx + F_EYE_DX + 16} cy={F_EYE_Y + 34} rx={24} ry={12} fill={BLUSH} opacity={0.26} />
          </g>

          {/* Chalk Jr. */}
          <g transform={jFrame}>
            <Capsule cx={J.cx} top={J.top} w={J.w} h={S} />
            <SmileEye id="avA-jl" cx={J_FACE_X - J_EYE_DX} cy={J_EYE_Y} r={J_EYE_R} smile={0.22} shine />
            <SmileEye id="avA-jr" cx={J_FACE_X + J_EYE_DX} cy={J_EYE_Y} r={J_EYE_R} smile={0.22} shine />
            <Brow cx={J_FACE_X - J_EYE_DX} cy={J_EYE_Y - 44} len={34} arch={12} width={12} side={-1} tilt={5} />
            <Brow cx={J_FACE_X + J_EYE_DX} cy={J_EYE_Y - 44} len={34} arch={12} width={12} side={1} tilt={5} />
            <ellipse cx={J_FACE_X - J_EYE_DX - 10} cy={J_EYE_Y + 32} rx={16} ry={9} fill={BLUSH} opacity={0.28} />
            <ellipse cx={J_FACE_X + J_EYE_DX + 10} cy={J_EYE_Y + 32} rx={16} ry={9} fill={BLUSH} opacity={0.28} />

            {/* Short arms; tiny mittens grip both sides of the ball, thumbs up. */}
            <line x1={J.cx - J.w * 0.4} y1={jShoulderY} x2={BALL.x - hold.dx} y2={hold.y} stroke={SHADE} strokeWidth={jArmW} strokeLinecap="round" />
            <line x1={J.cx + J.w * 0.4} y1={jShoulderY} x2={BALL.x + hold.dx} y2={hold.y} stroke={SHADE} strokeWidth={jArmW} strokeLinecap="round" />
            <Ball cx={BALL.x} cy={BALL.y} r={BALL.r} view={BALL_VIEW} lineNormal={{ x: 0.5, y: -0.55, z: 0.68 }} />
            <Mitten x={BALL.x - hold.dx} y={hold.y} rot={-90} g={jg} thumb={1} />
            <Mitten x={BALL.x + hold.dx} y={hold.y} rot={90} g={jg} thumb={-1} />
          </g>

          {/* Big Chalk's arm crosses the gap. His mitten rests on the rounded top of his son's near shoulder. */}
          <path
            d={`M${fShoulderS.x},${fShoulderS.y} Q${(fShoulderS.x + patS.x) / 2 + 4},${(fShoulderS.y + patS.y) / 2 - 16} ${patS.x},${patS.y}`}
            fill="none"
            stroke={SHADE}
            strokeWidth={fArmW}
            strokeLinecap="round"
          />
          <g transform={jFrame}>
            <Mitten x={pat.x} y={pat.y} rot={-62} g={fg * 0.8} thumb={-1} shadow />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
