// Side-view night world for the episode 2 cold open (b01): the same pitch as s01 (50 px per metre,
// ground at y = 820, goal line 18 m to the right of Tavi's mark), with the far layers pinned to the
// horizon, a stand clock at nine, and the small props the cold open needs: Sam's net bag of balls,
// a ground shadow, the "two seconds" stopwatch and a chalk caption on the grass.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH } from "../../theme";
import { EASE, clamp01, idle, keys, lerp, progress } from "../../lib/anim";
import type { View } from "../../lib/project";
import { CarPark, Floodlight, Glow, GroundSide, Sky, StandClock, Stands, Stars } from "../World";
import { GoalSide } from "../Goal";

export const PPM = 50;
/** World x of Tavi's mark (pitch x = 0). */
export const OX = 800;
export const GROUND = 820;
export const GOAL_M = 18;
export const X = (m: number) => OX + m * PPM;
export const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
export const TAVI_H = 1.62 * PPM;
export const CHALK_H = 2.1 * PPM;
export const BALL_R = 0.11 * PPM;
/** Camera x where the far layers line up with the world. */
const REF_X = X(0);

export type SideCam = { x: number; y: number; zoom: number };
export type SideKey = SideCam & { f: number };

/** Camera between keys; the zoom eases in log space so pushes feel even. */
export const sideCamAt = (frame: number, ks: SideKey[], ease = EASE.camera): SideCam => {
  if (ks.length === 1) return ks[0];
  const fs = ks.map((k) => k.f);
  return {
    x: keys(frame, fs, ks.map((k) => k.x), ease),
    y: keys(frame, fs, ks.map((k) => k.y), ease),
    zoom: Math.exp(keys(frame, fs, ks.map((k) => Math.log(k.zoom)), ease)),
  };
};

/** World pixels -> screen pixels. */
export const toScreen = (p: { x: number; y: number }, cam: SideCam) => ({
  x: WIDTH / 2 + (p.x - cam.x) * cam.zoom,
  y: HEIGHT / 2 + (p.y - cam.y) * cam.zoom,
});

/** Screen pixels -> world pixels. */
export const toWorld = (p: { x: number; y: number }, cam: SideCam) => ({
  x: cam.x + (p.x - WIDTH / 2) / cam.zoom,
  y: cam.y + (p.y - HEIGHT / 2) / cam.zoom,
});

const TOWERS = [-300, 240, 800, 1360, 1900, 2440];
const TOWER_BASE = GROUND - 20;
const TOWER_H = 470;

/** Dust drifting down through the floodlight beams (far layer coordinates). */
const BeamDust: React.FC<{ frame: number; lit: number[] }> = ({ frame, lit }) => {
  const topY = TOWER_BASE - TOWER_H + 10;
  const botY = TOWER_BASE + 60;
  return (
    <g>
      {TOWERS.map((x, i) => {
        if (lit[i] <= 0.01) return null;
        const dir = x > 1000 ? -1 : 1;
        return Array.from({ length: 9 }, (_, k) => {
          const s = `b2d${i}-${k}`;
          const v = (random(`${s}v`) + frame * (0.0012 + random(`${s}s`) * 0.0012)) % 1;
          const left = lerp(x - 35, x + dir * 40, v);
          const right = lerp(x + 35, x + dir * 380, v);
          const cx = lerp(left, right, 0.15 + 0.7 * random(`${s}u`)) + Math.sin(frame / 37 + k) * 10;
          const tw = 0.6 + 0.4 * Math.sin(frame / 11 + random(`${s}p`) * 6.28);
          const fade = Math.sin(Math.PI * v);
          return <circle key={`${i}-${k}`} cx={cx} cy={topY + (botY - topY) * v} r={1.6 + random(`${s}r`) * 2.2} fill={PITCH.lightSoft} opacity={0.6 * tw * fade * lit[i]} />;
        });
      })}
    </g>
  );
};

/** Low boards along the far touchline (mid layer coordinates). */
const Boards: React.FC = () => (
  <g>
    {Array.from({ length: 34 }, (_, i) => {
      const x = -2400 + i * 200;
      return (
        <g key={i}>
          <rect x={x} y={GROUND - 36} width={184} height={32} rx={8} fill={i % 2 ? PITCH.standsLight : PITCH.stands} />
          <rect x={x + 18} y={GROUND - 25} width={40 + 60 * random(`b2board-${i}`)} height={9} rx={4.5} fill={i % 3 === 0 ? PITCH.teal : PITCH.chalk} opacity={0.2} />
        </g>
      );
    })}
  </g>
);

/**
 * The night pitch around a side camera: sky, stars, the stand with its clock, floodlights with dust in the
 * beams, boards, grass, goal and car park. Children draw in world pixels. `lamps` 0..1 per tower lights them
 * (towers left to right). `clockOpacity` dims the stand clock while another clock face is on screen.
 */
export const NightWorld: React.FC<{ cam: SideCam; seed: string; lamps?: number[]; children: React.ReactNode; clockHours?: number; clockOpacity?: number }> = ({
  cam,
  seed,
  lamps,
  children,
  clockHours = 21,
  clockOpacity = 1,
}) => {
  const frame = useCurrentFrame();
  const horizonY = HEIGHT / 2 + (GROUND - cam.y) * cam.zoom;
  const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
  const layerT = (pan: number, grow: number) =>
    `translate(${WIDTH / 2} ${horizonY}) scale(${1 + (cam.zoom - 1) * grow}) translate(${-WIDTH / 2 - (cam.x - REF_X) * pan} ${-GROUND})`;
  const lit = TOWERS.map((_, i) => (lamps ? lamps[i % lamps.length] : 1));
  return (
    <g>
      <Sky id={`sky-${seed}`} />
      <Stars count={90} maxY={Math.max(120, horizonY - 300)} seed={seed} />
      <g transform={layerT(0.2, 0.05)}>
        <g transform={`translate(${WIDTH / 2} 0) scale(2.4 1) translate(${-WIDTH / 2} 0)`}>
          <Stands baseY={GROUND} lit={1} />
        </g>
        {clockOpacity > 0.01 ? (
          <g opacity={clockOpacity}>
            <StandClock x={WIDTH / 2} y={GROUND - 352} r={36} hours={clockHours} />
          </g>
        ) : null}
        {TOWERS.map((x, i) => (
          <Floodlight key={x} x={x} baseY={TOWER_BASE} height={TOWER_H} on={lit[i]} beam flip={x > 1000} />
        ))}
        <BeamDust frame={frame} lit={lit} />
      </g>
      <g transform={layerT(0.5, 0.3)}>
        <Boards />
      </g>
      <g transform={worldT}>
        <GroundSide groundY={GROUND} vanishX={X(2)} />
        {/* The car park stops at the grass line: its tarmac strip would otherwise hang over the grass. */}
        <defs>
          <clipPath id={`carpark-${seed}`}>
            <rect x={X(GOAL_M)} y={GROUND - 20 * PPM} width={60 * PPM} height={20 * PPM} />
          </clipPath>
        </defs>
        <g clipPath={`url(#carpark-${seed})`}>
          <CarPark x0={X(GOAL_M + 3)} groundY={GROUND} ppm={PPM} />
        </g>
        <GoalSide view={SIDE} goalX={GOAL_M} />
        {children}
      </g>
    </g>
  );
};

/** A soft ground shadow under a character (world pixels). */
export const GroundShadow: React.FC<{ x: number; y: number; w: number; opacity?: number }> = ({ x, y, w, opacity = 0.22 }) => (
  <ellipse cx={x} cy={y + 2} rx={w / 2} ry={w * 0.12} fill={PITCH.skyHigh} opacity={opacity} />
);

/**
 * Sam's net bag of balls, hanging from a hand at (x, y) (world pixels). `tilt` 0..1 lays it down and opens
 * the mouth; `balls` is how many are still inside.
 */
export const BallBag: React.FC<{ x: number; y: number; tilt?: number; balls?: number; swing?: number }> = ({ x, y, tilt = 0, balls = 3, swing = 0 }) => {
  const w = 0.6 * PPM;
  const h = 0.82 * PPM;
  const rot = swing + tilt * 78;
  const r = BALL_R * 1.05;
  const slots = [
    { x: -w * 0.2, y: h * 0.8 },
    { x: w * 0.22, y: h * 0.76 },
    { x: 0, y: h * 0.52 },
  ];
  const outline = `M0,0 L${-w * 0.12},${h * 0.18} Q${-w * 0.62},${h * 0.42} ${-w * 0.5},${h * 0.84} Q${-w * 0.36},${h * 1.06} 0,${h * 1.03} Q${w * 0.36},${h * 1.06} ${w * 0.5},${h * 0.84} Q${w * 0.62},${h * 0.42} ${w * 0.12},${h * 0.18} Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={outline} fill={PITCH.skyHigh} opacity={0.55} />
      {slots.slice(0, balls).map((s, i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y} r={r} fill={CAST.ballShade} />
          <circle cx={s.x - r * 0.18} cy={s.y - r * 0.18} r={r * 0.82} fill={CAST.ball} />
        </g>
      ))}
      <g stroke={PITCH.chalk} strokeWidth={1.4} opacity={0.75} fill="none">
        <path d={outline} strokeWidth={2.2} />
        {[-0.3, -0.1, 0.1, 0.3].map((k) => (
          <path key={`v${k}`} d={`M${k * w * 0.4},${h * 0.2} Q${k * w * 1.7},${h * 0.6} ${k * w * 1.3},${h * 1.0}`} />
        ))}
        {[0.35, 0.55, 0.75, 0.92].map((k) => (
          <path key={`h${k}`} d={`M${-w * 0.5 * (0.45 + k * 0.6)},${h * k} Q0,${h * (k + 0.06)} ${w * 0.5 * (0.45 + k * 0.6)},${h * k}`} />
        ))}
      </g>
      <rect x={-w * 0.16} y={h * 0.14} width={w * 0.32} height={h * 0.08} rx={h * 0.04} fill={PITCH.accent} />
    </g>
  );
};

/** A chalk caption written on the grass (world pixels), flattened a little so it lies on the ground. */
export const GrassCaption: React.FC<{ x: number; y: number; text: string; at: number; until: number; size?: number }> = ({ x, y, text, at, until, size = 60 }) => {
  const frame = useCurrentFrame();
  const write = progress(frame, at, 16, EASE.soft);
  const out = progress(frame, until, 8, EASE.exit);
  if (write <= 0.001 || out >= 0.999) return null;
  const shown = text.slice(0, Math.ceil(text.length * write));
  return (
    <g transform={`translate(${x} ${y}) scale(1 0.62)`} opacity={0.85 * (1 - out)}>
      <text fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle" letterSpacing={6}>
        {shown}
      </text>
      {Array.from({ length: 10 }, (_, i) => (
        <circle key={i} cx={(random(`gc-x-${text}-${i}`) - 0.5) * text.length * size * 0.6} cy={(random(`gc-y-${text}-${i}`) - 0.6) * size * 0.8} r={1.5 + random(`gc-r-${text}-${i}`) * 2.5} fill={PITCH.grassDark} opacity={0.5 * write} />
      ))}
    </g>
  );
};

/**
 * The "two seconds" stopwatch (screen pixels): a chalk face whose amber fill sweeps one full turn for two
 * seconds while mono digits count up. `slump` 0..1 turns the face and fill pink and spins the fill away.
 */
export const TwoSecondWatch: React.FC<{ x: number; y: number; value: number; at: number; until?: number; slump?: number; full?: number }> = ({
  x,
  y,
  value,
  at,
  until,
  slump = 0,
  full = 2,
}) => {
  const frame = useCurrentFrame();
  const pop = progress(frame, at, 14, EASE.back);
  const out = until === undefined ? 0 : progress(frame, until, 8, EASE.exit);
  if (pop <= 0.001 || out >= 0.999) return null;
  const r = 64;
  const shown = value * (1 - clamp01(slump * 1.6));
  const sweep = (shown / full) * 360;
  const hand = sweep + slump * 1080;
  const face = slump > 0.01 ? mixColor(PITCH.chalk, CAST.mistake, clamp01(slump * 1.4)) : PITCH.chalk;
  const fillColor = slump > 0.01 ? mixColor(PITCH.light, CAST.mistake, clamp01(slump * 1.4)) : PITCH.light;
  const big = sweep % 360 > 180 ? 1 : 0;
  const ex = Math.sin((sweep * Math.PI) / 180) * (r - 6);
  const ey = -Math.cos((sweep * Math.PI) / 180) * (r - 6);
  const wob = idle(frame, 4, 2.4, 1.2);
  return (
    <g transform={`translate(${x} ${y + wob}) scale(${pop * (1 - out)})`} opacity={1 - out}>
      <rect x={-r - 36} y={-r - 34} width={2 * r + 72 + 250} height={2 * r + 68} rx={r + 34} fill={PITCH.skyHigh} opacity={0.82} />
      <rect x={-12} y={-r - 24} width={24} height={16} rx={6} fill={face} />
      <circle r={r + 7} fill={face} />
      <circle r={r - 3} fill={PITCH.sky} />
      {sweep > 0.5 && sweep < 359.5 ? <path d={`M0,0 L0,${-r + 6} A${r - 6},${r - 6} 0 ${big} 1 ${ex},${ey} Z`} fill={fillColor} /> : null}
      {sweep >= 359.5 ? <circle r={r - 6} fill={fillColor} /> : null}
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1={0} y1={-r + 8} x2={0} y2={-r + 18} stroke={PITCH.sky} strokeWidth={4} strokeLinecap="round" opacity={0.45} transform={`rotate(${i * 45})`} />
      ))}
      <line x1={0} y1={0} x2={0} y2={-r + 10} stroke={PITCH.sky} strokeWidth={10} strokeLinecap="round" transform={`rotate(${hand})`} />
      <line x1={0} y1={0} x2={0} y2={-r + 10} stroke={face} strokeWidth={6} strokeLinecap="round" transform={`rotate(${hand})`} />
      <circle r={9} fill={face} />
      <text x={r + 30} y={26} fill={face} fontFamily={FONTS.mono} fontWeight={500} fontSize={76} opacity={1 - clamp01(slump * 1.3)}>
        {shown.toFixed(1)}
        <tspan fontFamily={FONTS.hud} fontWeight={700} fontSize={42} dx={10}>
          s
        </tspan>
      </text>
    </g>
  );
};

const mixColor = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};

/** Small chalk footprints Chalk leaves as he runs (world pixels): they fade over a second. */
export const ChalkSteps: React.FC<{ steps: { x: number; f: number }[]; frame: number }> = ({ steps, frame }) => (
  <g>
    {steps.map((s, i) => {
      const age = frame - s.f;
      if (age < 0 || age > 40) return null;
      const o = 0.5 * (1 - age / 40);
      return <ellipse key={i} cx={s.x + (i % 2 ? 6 : -6)} cy={GROUND - 1} rx={7} ry={2.6} fill={PITCH.chalk} opacity={o} />;
    })}
  </g>
);

/** A lamp glow that flickers on (far layer helper used by the open). */
export const LampBloom: React.FC<{ x: number; y: number; on: number }> = ({ x, y, on }) => (on > 0.01 ? <Glow cx={x} cy={y} r={200} color={PITCH.lightSoft} intensity={on} rings={4} /> : null);

/**
 * A small chalk padlock that pops at the ankle on a stiff touch (screen pixels): the shackle snaps shut
 * at `at`, it shakes once with the impact and leaves at `until`. `size` is the body width.
 */
export const AnkleLockIcon: React.FC<{ x: number; y: number; at: number; until: number; size?: number; color?: string }> = ({ x, y, at, until, size = 44, color = PITCH.chalk }) => {
  const frame = useCurrentFrame();
  const s = progress(frame, at - 4, 12, EASE.back) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const shut = progress(frame, at - 2, 5, EASE.standard);
  const shake = frame >= at && frame < at + 10 ? Math.sin((frame - at) * 2.4) * 7 * (1 - (frame - at) / 10) : 0;
  const w = size;
  const h = size * 0.82;
  const sr = w * 0.3;
  return (
    <g transform={`translate(${x} ${y}) rotate(${shake}) scale(${s})`}>
      <circle r={w * 0.95} fill={PITCH.skyHigh} opacity={0.72} />
      {/* Shackle: open (lifted) until the touch, then shut. */}
      <path d={`M${-sr},${-h * 0.1} L${-sr},${-h * 0.42} A${sr},${sr} 0 0 1 ${sr},${-h * 0.42} L${sr},${-h * 0.1}`} fill="none" stroke={color} strokeWidth={w * 0.14} strokeLinecap="round" transform={`translate(0 ${-(1 - shut) * h * 0.28})`} />
      <rect x={-w / 2} y={-h * 0.12} width={w} height={h * 0.7} rx={w * 0.16} fill={color} />
      <circle cx={0} cy={h * 0.16} r={w * 0.1} fill={PITCH.skyHigh} />
      <rect x={-w * 0.04} y={h * 0.18} width={w * 0.08} height={h * 0.2} rx={w * 0.04} fill={PITCH.skyHigh} />
    </g>
  );
};
