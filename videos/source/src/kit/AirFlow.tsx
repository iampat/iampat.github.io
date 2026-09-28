// The Air Crowd: tiny air particles streaming past a ball, seen from above.
// The flow is a simple physical model: a steady stream around a round ball, plus a
// swirl from the spin (faster on the side that turns with the stream), plus a trail
// behind the ball that the spin throws to one side. The ball is pushed the other way.
//
// Local maths frame: stream flows along +x, y up. `rotate` turns the whole picture
// (90 = stream flows down the screen, so the ball flies up the screen).
// spin > 0 = anticlockwise seen from above (a right-footer's inside-foot curler).

import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { XRAY } from "../theme";

type Props = {
  cx: number;
  cy: number;
  /** Ball radius in pixels. */
  R: number;
  /** -1..1 spin strength (anticlockwise positive). */
  spin: number;
  /** 0..1 how much the trail behind the ball is thrown sideways. Defaults to follow spin. */
  wake?: number;
  rotate?: number;
  count?: number;
  /** Stream speed in pixels per frame far from the ball. */
  speed?: number;
  /** Half-width of the stream (pixels). */
  spread?: number;
  length?: number;
  faces?: boolean;
  color?: string;
  opacity?: number;
  /** Frame at which particles start flowing (they fade in). */
  at?: number;
  /** Highlight the hug side and the early-leave side with soft tints. */
  showSides?: boolean;
  seed?: string;
  /** Draw faint streamlines behind the particles. */
  lines?: boolean;
};

type Stream = { pts: { x: number; y: number; s: number }[] };

const field = (x: number, y: number, R: number, U: number, gamma: number, wake: number) => {
  const r2 = x * x + y * y;
  const r4 = r2 * r2;
  let u = U * (1 - (R * R * (x * x - y * y)) / r4) - (gamma * y) / (2 * Math.PI * r2);
  let v = (-U * 2 * R * R * x * y) / r4 + (gamma * x) / (2 * Math.PI * r2);
  if (x > 0) {
    // Trail thrown sideways behind the ball, strongest just behind it.
    const along = Math.exp(-Math.max(0, x - R * 0.6) / (R * 3.2));
    const across = Math.exp(-(y * y) / (2 * (R * 1.3) ** 2));
    v += wake * U * 1.0 * along * across;
  }
  return { u, v };
};

export const AirFlow: React.FC<Props> = ({
  cx,
  cy,
  R,
  spin,
  wake,
  rotate = 0,
  count = 110,
  speed = 9,
  spread,
  length,
  faces = true,
  color = XRAY.air,
  opacity = 1,
  at = 0,
  showSides = false,
  seed = "air",
  lines = true,
}) => {
  const frame = useCurrentFrame();
  const half = spread ?? R * 3.4;
  const L = length ?? R * 9;
  const gamma = spin * 2 * Math.PI * R * speed * 1.1;
  const wk = wake ?? spin;

  // Integrate streamlines once.
  const streams = useMemo<Stream[]>(() => {
    const out: Stream[] = [];
    const rows = 17;
    for (let i = 0; i < rows; i++) {
      let y = -half + (2 * half * (i + 0.5)) / rows;
      if (Math.abs(y) < R * 0.18) y = y < 0 ? -R * 0.18 : R * 0.18;
      let x = -L * 0.55;
      const pts: { x: number; y: number; s: number }[] = [];
      let s = 0;
      for (let k = 0; k < 900 && x < L * 0.6; k++) {
        const f = field(x, y, R, speed, gamma, wk);
        const sp = Math.hypot(f.u, f.v);
        pts.push({ x, y, s });
        const step = 0.5; // frames per sample
        x += f.u * step;
        y += f.v * step;
        s += step;
        // Keep particles off the ball surface.
        const r = Math.hypot(x, y);
        if (r < R * 1.06) {
          x *= (R * 1.06) / r;
          y *= (R * 1.06) / r;
        }
        if (sp < 0.05) break;
      }
      out.push({ pts });
    }
    return out;
  }, [R, half, L, speed, gamma, wk]);

  const fade = Math.min(1, Math.max(0, (frame - at) / 12));
  if (fade <= 0) return null;
  const t = (frame - at) * 1;

  // Particles march in even rows along each streamline, so the flow shape is readable.
  const particles = [];
  const perRow = Math.max(1, Math.round(count / streams.length));
  for (let r = 0; r < streams.length; r++) {
    const st = streams[r];
    const total = st.pts[st.pts.length - 1].s;
    for (let k = 0; k < perRow; k++) {
      const jitter = (random(`${seed}-j-${r}-${k}`) - 0.5) * (total / perRow) * 0.5;
      const s = (((k * total) / perRow + jitter + t) % total + total) % total;
      const idx = Math.min(st.pts.length - 1, Math.floor(s / 0.5));
      const p = st.pts[idx];
      const q = st.pts[Math.min(st.pts.length - 1, idx + 1)];
      const edge = Math.min(1, s / 12, (total - s) / 12);
      particles.push({ x: p.x, y: -p.y, a: (Math.atan2(-(q.y - p.y), q.x - p.x) * 180) / Math.PI, o: edge, key: `${r}-${k}` });
    }
  }

  const pr = Math.max(5, R * 0.11);
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotate})`} opacity={opacity * fade}>
      {showSides ? (
        <g>
          <path d={`M${-R * 1.3},0 A${R * 1.3},${R * 1.3} 0 0 0 ${R * 1.3},0`} fill={XRAY.lime} opacity={0.12} transform={`scale(1 ${spin >= 0 ? 1 : -1})`} />
          <path d={`M${-R * 1.3},0 A${R * 1.3},${R * 1.3} 0 0 1 ${R * 1.3},0`} fill={XRAY.pink} opacity={0.1} transform={`scale(1 ${spin >= 0 ? 1 : -1})`} />
        </g>
      ) : null}
      {lines
        ? streams.map((st, i) => (
            <polyline
              key={`l${i}`}
              points={st.pts.filter((_, k) => k % 4 === 0).map((p) => `${p.x.toFixed(1)},${(-p.y).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={color}
              strokeWidth={3}
              opacity={0.26}
            />
          ))
        : null}
      {particles.map((p) => (
        <g key={p.key} transform={`translate(${p.x} ${p.y}) rotate(${p.a})`} opacity={p.o}>
          <ellipse rx={pr * 1.25} ry={pr} fill={color} />
          {faces ? (
            <g>
              <circle cx={pr * 0.45} cy={-pr * 0.32} r={pr * 0.2} fill={XRAY.bg} />
              <circle cx={pr * 0.45} cy={pr * 0.32} r={pr * 0.2} fill={XRAY.bg} />
            </g>
          ) : null}
        </g>
      ))}
    </g>
  );
};

/** Screen direction (unit vector) of the spin push for an AirFlow with this spin and rotation. */
export const spinPushDir = (spin: number, rotate = 0) => {
  // Local push is along -y (maths) for spin > 0, which is +y on screen before rotation.
  const a = (rotate * Math.PI) / 180;
  const lx = 0;
  const ly = spin >= 0 ? 1 : -1;
  return { x: lx * Math.cos(a) - ly * Math.sin(a), y: lx * Math.sin(a) + ly * Math.cos(a) };
};
