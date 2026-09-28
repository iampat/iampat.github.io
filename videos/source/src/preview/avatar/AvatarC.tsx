// Profile avatar concept C, "READY": Chalk and his son Chalk Jr., both made of chalk,
// side by side in the same goalkeeper ready pose (knees bent, mittens up), mirrored.
// Their inner mittens bump together right above the orange ball, so the pair reads as one
// linked silhouette. Dad looks down at his son, the son looks up at dad (eyes and brows only).
// A floodlight halo glows behind the bump. 800x800, shown as a circle. Faces stay in the inner 70%.

import React from "react";
import { AbsoluteFill } from "remotion";
import { Ball } from "../../kit/Ball";
import { Glow } from "../../kit/World";
import { CAST, PITCH } from "../../theme";

const S = 800;
const C = S / 2;

type GuyProps = {
  /** Screen x of his centre and screen y of the ground. */
  x: number;
  groundY: number;
  /** Full height, feet to top of head, px. */
  h: number;
  /** Body width as a share of h. */
  bodyW: number;
  /** Eye centre height as a share of h (from the ground). */
  eyeY: number;
  /** Eye radius as a share of h. */
  eyeR: number;
  /** Half the eye spacing as a share of body width. */
  eyeGap: number;
  /** Glove size as a share of h. */
  glove: number;
  /** Arm reach out from the body side as a share of h. */
  reach: number;
  /** Glove height as a share of h (from the ground). */
  gloveY: number;
  /** Eye offset in px (where he looks). */
  lookX?: number;
  lookY?: number;
  /** Brow tilt in degrees: positive = inner ends down (determined). */
  brow: number;
  /** Small white shine in each eye. */
  shine?: boolean;
  /** Leg height as a share of h. */
  legs?: number;
  /** Whole-body lean about the feet, degrees (positive = top towards screen right). */
  lean?: number;
  /** The side that faces the partner (1 = screen right, -1 = screen left). That arm uses innerReach and innerGloveY. */
  innerSide?: 1 | -1;
  /** Arm reach on the inner side as a share of h. */
  innerReach?: number;
  /** Glove height on the inner side as a share of h (from the ground). */
  innerGloveY?: number;
  /** Offset in px of a pale shade copy behind the inner mitten. It marks the mitten edge where it overlaps white. */
  innerShadow?: [number, number];
};

/** A front-view chalk keeper in the ready crouch. Origin: centre of his feet on the ground. */
const ChalkGuy: React.FC<GuyProps> = ({
  x,
  groundY,
  h,
  bodyW,
  eyeY,
  eyeR,
  eyeGap,
  glove,
  reach,
  gloveY,
  lookX = 0,
  lookY = 0,
  brow,
  shine = false,
  legs = 0.14,
  lean = 0,
  innerSide,
  innerReach,
  innerGloveY,
  innerShadow,
}) => {
  const W = h * bodyW;
  const g = h * glove;
  const bodyBottom = -h * legs;
  const legW = W * 0.24;
  const shoulderY = -h * 0.6;
  const shoulderX = W * 0.36;
  const armW = h * 0.07;

  const leg = (side: 1 | -1) => (
    <path
      key={`leg${side}`}
      d={`M${side * W * 0.16},${bodyBottom - legW * 0.6} L${side * W * 0.38},${-h * legs * 0.54} L${side * W * 0.32},${-legW * 0.5}`}
      fill="none"
      stroke={CAST.keeperShade}
      strokeWidth={legW}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  const isInner = (side: 1 | -1) => side === innerSide;
  const reachOf = (side: 1 | -1) => (isInner(side) && innerReach !== undefined ? innerReach : reach);
  const gx = (side: 1 | -1) => side * (W / 2 + h * reachOf(side));
  const gy = (side: 1 | -1) => -h * (isInner(side) && innerGloveY !== undefined ? innerGloveY : gloveY);

  const arm = (side: 1 | -1) => {
    const ex = side * (W / 2 + h * reachOf(side) * 0.55);
    const ey = shoulderY + h * 0.1;
    return (
      <path
        key={`arm${side}`}
        d={`M${side * shoulderX},${shoulderY} L${ex},${ey} L${gx(side)},${gy(side) + g * 0.9}`}
        fill="none"
        stroke={CAST.keeperShade}
        strokeWidth={armW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  };

  /** Mitten, palm to the viewer, fingers up, thumb on the inner side (the bump mitten turns its thumb out). */
  const mitten = (side: 1 | -1) => {
    const cx = gx(side);
    const cy = gy(side);
    const inner = -side;
    const rot = side * 12;
    const shape = (fill: string) => (
      <>
        <ellipse cx={inner * g * 0.92} cy={g * 0.15} rx={g * 0.42} ry={g * 0.62} fill={fill} transform={`rotate(${inner * 28} ${inner * g * 0.92} ${g * 0.15})`} />
        <rect x={-g * 0.95} y={-g * 1.15} width={g * 1.9} height={g * 2.15} rx={g * 0.92} fill={fill} />
      </>
    );
    const shadow = isInner(side) ? innerShadow : undefined;
    // The bump mitten turns its thumb to the partner, so the two thumbs meet and neither touches its own head.
    const flip = isInner(side) ? " scale(-1 1)" : "";
    return (
      <g key={`glove${side}`}>
        {shadow ? <g transform={`translate(${cx + shadow[0]} ${cy + shadow[1]}) rotate(${rot})${flip}`}>{shape(CAST.keeperShade)}</g> : null}
        <g transform={`translate(${cx} ${cy}) rotate(${rot})${flip}`}>
          {shape(CAST.keeper)}
          <rect x={side * g * 0.28 - g * 0.08} y={-g * 0.85} width={g * 0.16} height={g * 0.8} rx={g * 0.08} fill={CAST.keeperShade} opacity={0.8} />
          <rect x={-g * 0.82} y={g * 0.72} width={g * 1.64} height={g * 0.55} rx={g * 0.27} fill={CAST.keeperShade} />
        </g>
      </g>
    );
  };

  const ex = W * eyeGap;
  const ey = -h * eyeY;
  const r = h * eyeR;
  const browLen = r * 1.6;
  const browY = ey - r * 2.35;
  const browW = Math.max(3, r * 0.62);

  return (
    <g transform={`translate(${x} ${groundY}) rotate(${lean})`}>
      {leg(-1)}
      {leg(1)}
      {arm(-1)}
      {arm(1)}
      {/* Body capsule and its pale shade stripe. */}
      <rect x={-W / 2} y={-h} width={W} height={h + bodyBottom} rx={W / 2} fill={CAST.keeper} />
      <rect x={W * 0.14} y={-h + W * 0.2} width={W * 0.22} height={(h + bodyBottom) - W * 0.55} rx={W * 0.11} fill={CAST.keeperShade} opacity={0.55} />
      {mitten(-1)}
      {mitten(1)}
      {/* Face: two dot eyes and two eyebrow dashes. No mouth. */}
      {[-1, 1].map((side) => (
        <g key={`eye${side}`}>
          <circle cx={side * ex + lookX} cy={ey + lookY} r={r} fill={CAST.keeperEye} />
          {shine ? <circle cx={side * ex + lookX - r * 0.32} cy={ey + lookY - r * 0.34} r={r * 0.3} fill={CAST.keeper} /> : null}
          <line
            x1={side * ex + lookX * 0.5 - browLen / 2}
            y1={browY}
            x2={side * ex + lookX * 0.5 + browLen / 2}
            y2={browY}
            stroke={CAST.keeperEye}
            strokeWidth={browW}
            strokeLinecap="round"
            transform={`rotate(${-side * brow - lean} ${side * ex + lookX * 0.5} ${browY})`}
          />
        </g>
      ))}
    </g>
  );
};

export const AvatarC: React.FC = () => {
  const ground = 676;
  const dadH = 520;
  const kidH = dadH * 0.6;
  const dadX = 276;
  const kidX = 559;
  const ballX = 420;
  const ballR = 50;
  const view = { kind: "side" as const, originX: 0, groundY: 0, ppm: 60 };
  return (
    <AbsoluteFill style={{ backgroundColor: PITCH.sky }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <defs>
          <linearGradient id="avc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PITCH.skyHigh} />
            <stop offset="1" stopColor={PITCH.sky} />
          </linearGradient>
        </defs>
        <rect width={S} height={S} fill="url(#avc-sky)" />
        {/* Floodlight halo: a badge disc with soft concentric rings, brightest behind the glove bump and the ball. */}
        <circle cx={C} cy={C - 10} r={340} fill="#1C2350" />
        <Glow cx={C} cy={C + 20} r={330} color={PITCH.lightSoft} intensity={0.38} rings={5} />
        <Glow cx={C} cy={C + 20} r={200} color={PITCH.light} intensity={0.2} rings={3} />
        {/* Grass with a gentle dome and the goal line they stand on. */}
        <circle cx={C} cy={ground + 1500} r={1560} fill={PITCH.grassDark} />
        <circle cx={C} cy={ground + 1500} r={1530} fill={PITCH.grass} />
        <path d={`M-20,${ground + 8} Q${C},${ground - 26} ${S + 20},${ground + 8}`} fill="none" stroke={CAST.keeper} strokeWidth={10} strokeLinecap="round" opacity={0.85} />
        {/* Shadows. */}
        <ellipse cx={dadX} cy={ground + 6} rx={126} ry={16} fill="#0B3F31" opacity={0.7} />
        <ellipse cx={kidX} cy={ground + 4} rx={94} ry={13} fill="#0B3F31" opacity={0.7} />
        <ellipse cx={ballX} cy={ground + 2} rx={ballR} ry={8} fill="#0B3F31" opacity={0.7} />
        {/* Chalk (dad) on the left, Chalk Jr. on the right, both made of chalk. Mirrored ready poses, leaning in,
            inner mittens bumped together above the ball. Dad looks down at his son, the son looks up at dad. */}
        <ChalkGuy
          x={dadX}
          groundY={ground}
          h={dadH}
          bodyW={0.36}
          eyeY={0.8}
          eyeR={0.04}
          eyeGap={0.2}
          glove={0.1}
          reach={0.065}
          gloveY={0.66}
          innerSide={1}
          innerReach={0.01}
          innerGloveY={0.349}
          innerShadow={[-5, 4]}
          lookX={12}
          lookY={10}
          brow={-6}
          lean={4}
          shine
        />
        <ChalkGuy
          x={kidX}
          groundY={ground}
          h={kidH}
          bodyW={0.54}
          eyeY={0.65}
          eyeR={0.075}
          eyeGap={0.21}
          glove={0.1}
          reach={0.04}
          gloveY={0.55}
          innerSide={-1}
          innerReach={0.118}
          innerGloveY={0.627}
          innerShadow={[-6, 3]}
          lookX={-8}
          lookY={-8}
          brow={-4}
          legs={0.12}
          lean={-3}
          shine
        />
        {/* The ball on the goal line between them. */}
        <Ball cx={ballX} cy={ground - ballR + 4} r={ballR} view={view} lineNormal={{ x: 0.5, y: 0.3, z: 0.8 }} />
      </svg>
    </AbsoluteFill>
  );
};
