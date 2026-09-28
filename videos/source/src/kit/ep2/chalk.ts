// Shared helpers for the episode 2 kit: progress-driven draw-on (trim path), sequencing and colour mixing.
// Everything here takes a 0..1 value, not a frame, so scene builders can key it to cues or to sims.

import { EASE, clamp01 } from "../../lib/anim";

/** Normalised path length used with `pathLength` so no path length needs computing. */
export const PATH_LEN = 1000;

/** Dash attributes that draw a path on from its start to `t` (0..1). Pair with `pathLength={PATH_LEN}`. */
export const trim = (t: number) => ({
  pathLength: PATH_LEN,
  strokeDasharray: `${PATH_LEN} ${PATH_LEN}`,
  strokeDashoffset: PATH_LEN * (1 - clamp01(t)),
});

/** Dash attributes that show only the part of a path between `a` and `b` (0..1), for a travelling pulse. */
export const segment = (a: number, b: number) => {
  const a0 = clamp01(Math.min(a, b)) * PATH_LEN;
  const b0 = clamp01(Math.max(a, b)) * PATH_LEN;
  return { pathLength: PATH_LEN, strokeDasharray: `${Math.max(0.01, b0 - a0)} ${PATH_LEN * 2}`, strokeDashoffset: -a0 };
};

/** Split one 0..1 progress into sequential parts by weight. Returns each part's own 0..1. */
export const sequence = (p: number, weights: number[]) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return weights.map((w) => {
    const s = acc / total;
    acc += w;
    const e = acc / total;
    return clamp01((p - s) / Math.max(1e-6, e - s));
  });
};

/** Pop with overshoot from a 0..1 value (no frame needed). */
export const popT = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : EASE.back(t));

/** Smooth step from a 0..1 value. */
export const easeT = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : EASE.standard(t));

/** Mix two hex colours (#rrggbb). */
export const mixHex = (a: string, b: string, t: number) => {
  const k = clamp01(t);
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
};

/** Point on a quadratic curve from p0 through control c to p1 at u (0..1). */
export const quad = (p0: [number, number], c: [number, number], p1: [number, number], u: number): [number, number] => {
  const v = 1 - u;
  return [v * v * p0[0] + 2 * v * u * c[0] + u * u * p1[0], v * v * p0[1] + 2 * v * u * c[1] + u * u * p1[1]];
};

/** Format seconds for a label: 0.5 -> "0.5", 0.25 -> "0.25", 1 -> "1.0". */
export const fmtSeconds = (s: number) => {
  const two = s.toFixed(2);
  return two.endsWith("0") ? two.slice(0, -1) : two;
};

/** A safe id for clipPath/gradient ids (React.useId gives colons, which break url(#...)). */
export const safeId = (raw: string, prefix = "ep2") => `${prefix}-${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
