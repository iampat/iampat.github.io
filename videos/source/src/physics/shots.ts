// Every named ball flight in the video, with the launch values from the storyboard
// (research/storyboard-final.json, physics_sim fields). shots.test.ts checks each
// stated outcome (height at the goal line, side position, time) in this sim.
//
// Conventions: kick spot at the origin, x towards goal, y = left, z = up.
// "a degrees right" = azimuthDeg -a. Spin = unit axis x turns per second.

import { revPerSec, v3, type KickParams, type Vec3 } from "./sim";

const spin = (axis: [number, number, number], rps: number): Vec3 => {
  const l = Math.hypot(...axis);
  const w = revPerSec(rps);
  return v3((axis[0] / l) * w, (axis[1] / l) * w, (axis[2] / l) * w);
};

const GROUND = v3(0, 0, 0.11);

export const SHOTS = {
  /** Cold open: the accidental chip-spin shot that clears the bar by about 0.5 m. */
  MISS: { speed: 21, elevationDeg: 18, spin: spin([0, -1, 0], 5), cd: 0.25, cl: "sqrt", start: GROUND },
  /** Control: the same launch with no spin goes under the bar. */
  MISS_NOSPIN: { speed: 21, elevationDeg: 18, cd: 0.25, start: GROUND },
  /** Chapter 1 goal: low and hard, inside the right post. */
  DRIVE_R: { speed: 21.7, elevationDeg: 9, azimuthDeg: -8.5, spin: spin([-0.148, -0.989, 0], 4), cd: 0.25, cl: "sqrt", start: GROUND },
  /** Ending: the same strike, inside the left post. */
  DRIVE_L: { speed: 21.7, elevationDeg: 9, azimuthDeg: 8.5, spin: spin([0.148, -0.989, 0], 4), cd: 0.25, cl: "sqrt", start: GROUND },
  /** Wall drill: from 10 m, under the knee-height tape. */
  DRIVE_WALL: { speed: 20, elevationDeg: 5.5, spin: spin([0, -1, 0], 4), cd: 0.25, cl: "sqrt", start: GROUND },
  /** Hitting with the toes: 15% slower, Chalk reaches it. */
  TOE_HIT: { speed: 18.4, elevationDeg: 14, azimuthDeg: -8.5, spin: spin([-0.148, -0.989, 0], 4), cd: 0.25, cl: "sqrt", start: GROUND },
  /** Right-foot curler: starts 8 deg right, bends back on target. */
  CURLER: { speed: 19, elevationDeg: 20, azimuthDeg: -8, spin: spin([-0.063, -0.45, 0.891], 7), cd: 0.27, cl: "sqrt", start: GROUND },
  /** Curler aimed straight at the corner: bends back into the middle. */
  CURLER_AIM_MISS: { speed: 19, elevationDeg: 20, spin: spin([0, -0.454, 0.891], 7), cd: 0.27, cl: "sqrt", start: GROUND },
  /** Curler with the spin push off (point-of-view ghost). */
  CURLER_NOPUSH: { speed: 19, elevationDeg: 20, azimuthDeg: -8, spin: spin([-0.063, -0.45, 0.891], 7), cd: 0.27, spinPush: false, start: GROUND },
  /** Ball dropping from a thigh lift (2 m) to knee height. */
  DROP: { speed: 0, elevationDeg: -90, start: v3(0, 0, 2.0), stopAtZ: 0.4, ground: false },
  /** Volley with forward spin: dips under the bar. */
  VOLLEY: { speed: 20, elevationDeg: 23, azimuthDeg: -10, spin: spin([0.174, 0.985, 0], 4), cd: 0.27, cl: 0.14, start: v3(0, 0, 0.4) },
  /** The same volley with no spin: over the bar. */
  VOLLEY_GHOST: { speed: 20, elevationDeg: 23, azimuthDeg: -10, cd: 0.27, start: v3(0, 0, 0.4) },
  /** Same angle, easy vs smashed. */
  EASY: { speed: 20, elevationDeg: 18, cd: 0.27, start: v3(0, 0, 0.4) },
  SMASH: { speed: 25, elevationDeg: 18, cd: 0.27, start: v3(0, 0, 0.4) },
  /** Wall drill: drop from 1 m, strike at the top of the bounce. */
  BOUNCE_DRILL: { speed: 0, elevationDeg: -90, start: v3(0, 0, 1.0), restitution: 0.6, duration: 1.2 },
  /** Chip over a rushing keeper (6 m away) from 14 m. */
  CHIP: { speed: 13.9, elevationDeg: 45, spin: spin([0, -1, 0], 6), cd: 0.43, cl: "sqrt", start: GROUND },
  CHIP_GHOST: { speed: 13.9, elevationDeg: 45, cd: 0.43, start: GROUND },
  /** Knuckleball teaser: hardly any spin, a gentle sideways wobble. */
  KNUCKLE: {
    speed: 22,
    elevationDeg: 23,
    spin: spin([0, -1, 0], 0.9),
    spinPush: false,
    cd: 0.25,
    sideForce: { peakN: 2, wavelengthM: 13.5, phase: 0.79 },
    start: GROUND,
  },
} satisfies Record<string, KickParams>;

export type ShotName = keyof typeof SHOTS;

/** Goal-line distance (metres from the kick) used with each shot in the storyboard. */
export const GOAL_DISTANCE: Partial<Record<ShotName, number>> = {
  MISS: 18,
  MISS_NOSPIN: 18,
  DRIVE_R: 18,
  DRIVE_L: 18,
  TOE_HIT: 18,
  CURLER: 20,
  CURLER_AIM_MISS: 20,
  CURLER_NOPUSH: 20,
  VOLLEY: 16,
  VOLLEY_GHOST: 16,
  EASY: 16,
  SMASH: 16,
  CHIP: 14,
  CHIP_GHOST: 14,
  KNUCKLE: 25,
};
