// Episode 3 world: the bench by the pitch and the concrete the board is drawn on.
//
// Two views:
//  - BenchSide: the floodlit night pitch from episode 2 (NightWorld, side camera), with a low dugout
//    bench and a concrete apron in front of it. Tavi sits on the bench (left, facing right), Chalk sits
//    on the concrete (right, facing her). The board lies on the concrete between them, seen edge-on.
//  - ConcreteTop: a full-frame top-down view of the concrete under one floodlight, where the board scenes
//    play. Dark concrete, a warm pool of light, chalk dust.
// World pixels for the side view are the episode 2 ones: X(m) = OX + m * PPM, GROUND = 820.

import React from "react";
import { useCurrentFrame } from "remotion";
import { HEIGHT, PITCH, WIDTH } from "../../theme";
import { Glow } from "../World";
import { Player, POSES, type Pose, type Face } from "../Player";
import { Keeper, KPOSES, type KeeperPose, type KeeperFace } from "../Keeper";
import { idle } from "../../lib/anim";
import { NightWorld, X, GROUND, PPM, TAVI_H, CHALK_H, type SideCam } from "../ext/ep2-b01-b03-world";

export { X, GROUND, PPM, TAVI_H, CHALK_H, NightWorld };
export type { SideCam };

export const CONCRETE = { base: "#262A40", light: "#2F3450", dark: "#1E2236", edge: "#3A4060" };

/** Where things are, in pitch metres along the touchline (x) for the side view. */
export const BENCH = {
  x0: -4.2, // bench left end
  x1: -0.6, // bench right end
  seatH: 0.46, // seat height, metres
  taviX: -2.2, // Tavi's hips
  chalkX: 1.9, // Chalk's centre, sitting on the concrete
  boardX: 0.0, // board centre on the concrete
  apron: [-5.5, 3.6] as [number, number], // concrete strip
};

/** A default side camera looking at the bench and the concrete. */
export const BENCH_CAM: SideCam = { x: X(-0.2), y: GROUND - 0.95 * PPM, zoom: 2.4 };

/** The concrete apron in front of the bench (side view, world pixels). */
export const ConcreteApron: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <g opacity={opacity}>
    <rect x={X(BENCH.apron[0])} y={GROUND - 6} width={(BENCH.apron[1] - BENCH.apron[0]) * PPM} height={16} rx={6} fill={CONCRETE.light} />
    <rect x={X(BENCH.apron[0])} y={GROUND + 4} width={(BENCH.apron[1] - BENCH.apron[0]) * PPM} height={10} rx={4} fill={CONCRETE.dark} opacity={0.6} />
  </g>
);

/** The dugout bench: two posts, a seat, a low back. */
export const Bench: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const x0 = X(BENCH.x0);
  const x1 = X(BENCH.x1);
  const seatY = GROUND - BENCH.seatH * PPM;
  return (
    <g opacity={opacity}>
      <rect x={x0 + 10} y={seatY} width={16} height={GROUND - seatY} rx={6} fill={PITCH.stands} />
      <rect x={x1 - 26} y={seatY} width={16} height={GROUND - seatY} rx={6} fill={PITCH.stands} />
      <rect x={x0} y={seatY - 10} width={x1 - x0} height={18} rx={8} fill={PITCH.standsLight} />
      <rect x={x0 + 4} y={seatY - 48} width={x1 - x0 - 8} height={14} rx={7} fill={PITCH.standsLight} opacity={0.8} />
      <rect x={x0 + 10} y={seatY - 48} width={10} height={40} rx={5} fill={PITCH.stands} />
      <rect x={x1 - 20} y={seatY - 48} width={10} height={40} rx={5} fill={PITCH.stands} />
    </g>
  );
};

/** The board seen edge-on in the side view: a thin chalk strip on the concrete with 4 dots. */
export const BoardEdge: React.FC<{ x?: number; width?: number; opacity?: number }> = ({ x = X(BENCH.boardX), width = 1.1 * PPM, opacity = 1 }) => (
  <g opacity={opacity}>
    {[0, 1, 2, 3].map((i) => (
      <circle key={i} cx={x - width / 2 + (i * width) / 3} cy={GROUND - 3} r={4} fill={PITCH.chalk} />
    ))}
  </g>
);

/** Tavi sitting on the bench: hips on the seat, feet on the concrete. `pose` defaults to sitBench. */
export const TaviOnBench: React.FC<{ pose?: Pose; face?: Face; bootOff?: boolean; ice?: boolean; opacity?: number; chalkStub?: boolean }> = ({
  pose = POSES.sitBench, face = "neutral", bootOff = true, ice = true, opacity = 1, chalkStub = false,
}) => {
  const frame = useCurrentFrame();
  const x = X(BENCH.taviX);
  // The pose solver puts the lowest foot point on groundY; seated poses keep the feet on the floor.
  const breathe = idle(frame, 3, 3.2, 1.5);
  return (
    <g opacity={opacity}>
      <Player x={x} groundY={GROUND + breathe * 0} h={TAVI_H} pose={{ ...pose, torso: pose.torso + breathe * 0.6 }} face={face} />
      {bootOff ? (
        <g>
          {/* her left boot standing beside the bench */}
          <rect x={x - 1.05 * PPM} y={GROUND - 0.12 * PPM} width={0.26 * PPM} height={0.12 * PPM} rx={5} fill={PITCH.chalk} />
          <rect x={x - 1.05 * PPM} y={GROUND - 0.2 * PPM} width={0.16 * PPM} height={0.1 * PPM} rx={4} fill={PITCH.chalk} />
        </g>
      ) : null}
      {ice ? <rect x={x + 0.34 * PPM} y={GROUND - 0.26 * PPM} width={0.2 * PPM} height={0.16 * PPM} rx={6} fill={PITCH.chalk} opacity={0.95} /> : null}
      {chalkStub ? <rect x={x + 0.42 * PPM} y={GROUND - 0.62 * PPM} width={0.05 * PPM} height={0.14 * PPM} rx={3} fill={PITCH.chalk} /> : null}
    </g>
  );
};

/** Chalk sitting on the concrete, facing Tavi (flip on). */
export const ChalkOnFloor: React.FC<{ pose?: KeeperPose; face?: KeeperFace; x?: number; opacity?: number; look?: number }> = ({
  pose = KPOSES.sitFloor, face = "flat", x = X(BENCH.chalkX), opacity = 1, look = 0,
}) => {
  const frame = useCurrentFrame();
  const sway = idle(frame, 7, 4, 0.4);
  return (
    <g opacity={opacity}>
      {/* crossed legs: a low chalk capsule under the body */}
      <rect x={x - 0.42 * PPM} y={GROUND - 0.2 * PPM} width={0.84 * PPM} height={0.2 * PPM} rx={0.1 * PPM} fill={PITCH.chalk} opacity={0.95} />
      <rect x={x - 0.3 * PPM} y={GROUND - 0.22 * PPM} width={0.24 * PPM} height={0.1 * PPM} rx={0.05 * PPM} fill="#D9D3C3" />
      <Keeper x={x} groundY={GROUND - 0.14 * PPM} h={CHALK_H} pose={{ ...pose, lean: pose.lean + sway }} face={face} flip look={look} />
    </g>
  );
};

/** The whole bench scene in the side view: night world + apron + bench, with children in world pixels. */
export const BenchSide: React.FC<{ cam?: SideCam; seed: string; lamps?: number[]; clockHours?: number; children?: React.ReactNode }> = ({
  cam = BENCH_CAM, seed, lamps, clockHours = 21, children,
}) => (
  <NightWorld cam={cam} seed={seed} lamps={lamps} clockHours={clockHours}>
    <ConcreteApron />
    <Bench />
    {children}
  </NightWorld>
);

/** Full-frame top-down concrete under a floodlight: the stage for every board scene. */
export const ConcreteTop: React.FC<{ poolX?: number; poolY?: number; light?: number; seed?: number; children?: React.ReactNode }> = ({
  poolX = WIDTH / 2, poolY = HEIGHT / 2, light = 1, seed = 3, children,
}) => {
  const specks: [number, number, number][] = [];
  let s = seed * 1000 + 17;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < 140; i++) specks.push([rnd() * WIDTH, rnd() * HEIGHT, 1 + rnd() * 2.2]);
  return (
    <g>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={CONCRETE.base} />
      {/* a few long expansion-joint lines */}
      <path d={`M 0 ${HEIGHT * 0.78} L ${WIDTH} ${HEIGHT * 0.74}`} stroke={CONCRETE.dark} strokeWidth={6} opacity={0.8} />
      <path d={`M ${WIDTH * 0.18} 0 L ${WIDTH * 0.2} ${HEIGHT}`} stroke={CONCRETE.dark} strokeWidth={6} opacity={0.8} />
      <path d={`M ${WIDTH * 0.84} 0 L ${WIDTH * 0.82} ${HEIGHT}`} stroke={CONCRETE.dark} strokeWidth={6} opacity={0.8} />
      <Glow cx={poolX} cy={poolY} r={820} color={PITCH.lightSoft} intensity={0.16 * light} rings={5} />
      {specks.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 3 === 0 ? CONCRETE.light : CONCRETE.edge} opacity={0.5} />
      ))}
      {children}
    </g>
  );
};
