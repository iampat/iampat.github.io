// Helpers for the ending scenes s21-s23: camera maths, the side-view night backdrop,
// cue badges, small speech bubble, the Line halo, HUD bits, the flag inset, the kick
// checklist, the run-up inset, the next-level card and the stopwatch. Floodlit Pitch palette only.

import React from "react";
import { useCurrentFrame } from "remotion";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH } from "../../theme";
import { EASE, clamp01, idle, pop, popSoft, progress, visible } from "../../lib/anim";
import { Floodlight, Glow, Sky, Stands, Stars } from "../World";
import { solve, type Pose } from "../Player";
import { basisOf, type View } from "../../lib/project";
import type { Vec3 } from "../../physics/sim";

// ---------- Camera maths ----------

export type Cam = { x: number; y: number; zoom: number };

export const camT = (c: Cam) => `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${c.zoom}) translate(${-c.x} ${-c.y})`;

export const toScreen = (c: Cam, x: number, y: number) => ({
  x: WIDTH / 2 + (x - c.x) * c.zoom,
  y: HEIGHT / 2 + (y - c.y) * c.zoom,
});

/** Blend two cameras (t = 0 -> a, 1 -> b). Zoom blends in log space so it feels even. */
export const mixCam = (a: Cam, b: Cam, t: number): Cam => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  zoom: Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * t),
});

// ---------- Recap row (s21) and its hand-over to s22 ----------

/** The s21 row of chalk boxes, in world pixels. s22 opens on the whole row, then pushes into box 5 to `endZoom`. */
export const RECAP = {
  slotX: [260, 610, 960, 1310, 1660],
  boxW: 320,
  boxH: 520,
  boxY: 280,
  endZoom: 1.9,
  starSeed: "s21f",
  starCount: 70,
  starOpacity: 0.5,
};

// ---------- Tavi helpers ----------

/** Small breathing loop on top of any pose, so a held pose is never fully still. */
export const breathe = (p: Pose, frame: number, seed = 0, amt = 1): Pose => ({
  ...p,
  torso: p.torso + idle(frame, seed, 3, 1.2 * amt),
  head: p.head + idle(frame, seed + 1, 3.4, 1.6 * amt),
  nearShoulder: p.nearShoulder + idle(frame, seed + 2, 3, 2 * amt),
  farShoulder: p.farShoulder + idle(frame, seed + 3, 3.2, 2 * amt),
});

/** Joint and hand positions for Tavi, in the same space as the Player component draws him. */
export const taviJoints = (pose: Pose, x: number, groundY: number, H: number, flip = false, footTurn = 0) => {
  const j = solve(pose, H, footTurn);
  const dy = groundY - j.lowest - (pose.lift ?? 0) * H;
  const T = (p: { x: number; y: number }) => ({ x: x + (flip ? -p.x : p.x), y: p.y + dy });
  return {
    hip: T(j.hip),
    knee: T(j.nk),
    ankle: T(j.na),
    toe: T(j.nToe),
    laces: T({ x: j.na.x + (j.nToe.x - j.na.x) * 0.45, y: j.na.y + (j.nToe.y - j.na.y) * 0.45 }),
    farAnkle: T(j.fa),
    farToe: T(j.fToe),
    head: T(j.headC),
    headR: j.headR,
    nearHand: T(j.nh),
    farHand: T(j.fh),
    shoulder: T(j.sh),
    neck: T(j.neck),
    nearElbow: T(j.ne),
    farElbow: T(j.fe),
  };
};

// ---------- Side-view night backdrop (matches s01) ----------

export const FLOOD_X = [180, 720, 1220, 1760];

/**
 * Sky, stars, stands and four floodlights pinned to the horizon, like s01.
 * `lamps` = how much each floodlight is on (0..1), `glowScale` shrinks the glow rings as they turn off.
 */
export const SideBackdrop: React.FC<{
  cam: Cam;
  ground: number;
  refX: number;
  lamps?: number[];
  seed: string;
  starOpacity?: number;
}> = ({ cam, ground, refX, lamps = [1, 1, 1, 1], seed, starOpacity = 1 }) => {
  const horizonY = HEIGHT / 2 + (ground - cam.y) * cam.zoom;
  const bgScale = 1 + (cam.zoom - 1) * 0.05;
  const lit = lamps.reduce((a, b) => a + b, 0) / lamps.length;
  return (
    <>
      <Sky id={`sky-${seed}`} />
      <Stars count={90} maxY={Math.max(200, horizonY - 300)} seed={seed} opacity={starOpacity} />
      <g transform={`translate(${WIDTH / 2} ${horizonY}) scale(${bgScale}) translate(${-WIDTH / 2 - (cam.x - refX) * 0.04} ${-ground})`}>
        <Stands baseY={ground} lit={lit} />
        {FLOOD_X.map((x, i) => (
          <Floodlight key={i} x={x} baseY={ground - 20} height={470} on={lamps[i] ?? 1} />
        ))}
      </g>
    </>
  );
};

// ---------- Cue badges ----------

type BadgeKind = "disc" | "lock";

/** Icon drawn inside a badge, centred on (0,0), fits a circle of radius r. */
const BadgeIcon: React.FC<{ kind: BadgeKind; r: number; lock: number }> = ({ kind, r, lock }) => {
  if (kind === "disc") {
    // Standing foot beside the ball: a boot print beside the ball, on a ground line.
    return (
      <g>
        <rect x={-r * 0.62} y={r * 0.34} width={r * 1.24} height={r * 0.1} rx={r * 0.05} fill={PITCH.stands} opacity={0.35} />
        <rect x={-r * 0.56} y={-r * 0.12} width={r * 0.62} height={r * 0.44} rx={r * 0.2} fill={PITCH.stands} />
        <rect x={-r * 0.56} y={r * 0.22} width={r * 0.62} height={r * 0.1} rx={r * 0.05} fill={PITCH.sky} />
        <circle cx={r * 0.3} cy={r * 0.04} r={r * 0.28} fill={CAST.ball} />
        <circle cx={r * 0.26} cy={0} r={r * 0.22} fill="#FF9A66" opacity={0.5} />
      </g>
    );
  }
  const lift = (1 - lock) * r * 0.22;
  return (
    <g>
      <path
        d={`M${-r * 0.26},${-r * 0.02 - lift} L${-r * 0.26},${-r * 0.26 - lift} A${r * 0.26},${r * 0.26} 0 0 1 ${r * 0.26},${-r * 0.26 - lift} L${r * 0.26},${-r * 0.02 - (lock > 0.5 ? 0 : lift + r * 0.1)}`}
        fill="none"
        stroke={PITCH.stands}
        strokeWidth={r * 0.13}
        strokeLinecap="round"
      />
      <rect x={-r * 0.42} y={-r * 0.06} width={r * 0.84} height={r * 0.62} rx={r * 0.14} fill={CAST.fix} />
      <circle cx={0} cy={r * 0.2} r={r * 0.08} fill={PITCH.stands} />
      <rect x={-r * 0.035} y={r * 0.22} width={r * 0.07} height={r * 0.16} rx={r * 0.03} fill={PITCH.stands} />
    </g>
  );
};

/** A round chalk badge that pops in, with a leader line drawn to a target point. Screen space. */
export const CueBadge: React.FC<{
  x: number;
  y: number;
  tx: number;
  ty: number;
  kind: BadgeKind;
  at: number;
  until?: number;
  r?: number;
}> = ({ x, y, tx, ty, kind, at, until, r = 58 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const lead = progress(frame, at + 4, 12, EASE.enter);
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy) || 1;
  const sx = x + (dx / d) * r * s;
  const sy = y + (dy / d) * r * s;
  const ex = sx + (tx - sx) * lead;
  const ey = sy + (ty - sy) * lead;
  const lock = progress(frame, at + 8, 8, EASE.standard);
  const o = until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit);
  return (
    <g opacity={o}>
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" />
      {lead > 0.95 ? <circle cx={tx} cy={ty} r={9} fill={PITCH.chalk} /> : null}
      <g transform={`translate(${x} ${y + idle(frame, 3, 2.6, 3)}) scale(${s})`}>
        <circle r={r + 8} fill={PITCH.sky} opacity={0.35} />
        <circle r={r} fill={PITCH.chalk} />
        <BadgeIcon kind={kind} r={r} lock={lock} />
      </g>
    </g>
  );
};

/** An arrow from the knee straight down to the ball: "knee over the ball". Screen space. */
export const KneeArrow: React.FC<{ x: number; y1: number; y2: number; at: number; until?: number; color?: string }> = ({
  x,
  y1,
  y2,
  at,
  until,
  color = CAST.fix,
}) => {
  const frame = useCurrentFrame();
  const t = progress(frame, at, 12, EASE.enter);
  const o = until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit);
  if (t <= 0.001 || o <= 0.001) return null;
  const end = y1 + (y2 - y1) * t;
  const bob = idle(frame, 5, 1.6, 3);
  return (
    <g opacity={o} transform={`translate(0 ${bob})`}>
      <circle cx={x} cy={y1} r={12} fill={color} />
      <line x1={x} y1={y1} x2={x} y2={end - 14} stroke={color} strokeWidth={9} strokeDasharray="3 16" strokeLinecap="round" />
      <path d={`M${x - 20},${end - 26} L${x},${end} L${x + 20},${end - 26} Z`} fill={color} stroke={color} strokeWidth={5} strokeLinejoin="round" />
    </g>
  );
};

/** A tiny, empty speech bubble (nothing to shout). Screen space. */
export const EmptyBubble: React.FC<{ x: number; y: number; tx: number; ty: number; at: number; until: number; w?: number }> = ({
  x,
  y,
  tx,
  ty,
  at,
  until,
  w = 96,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 320, damping: 15 }) * (1 - progress(frame, until, 7, EASE.exit));
  if (s <= 0.001) return null;
  const h = w * 0.66;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={`M${-w * 0.14},${h * 0.3} L${tx - x},${ty - y} L${w * 0.1},${h * 0.36} Z`} fill={PITCH.chalk} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={PITCH.chalk} />
    </g>
  );
};

// ---------- The Line: a halo stroke on top of a Ball ----------

const nrm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const crs = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dt3 = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const rot = (p: Vec3, k: Vec3, t: number): Vec3 => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const kxp = crs(k, p);
  const kdp = dt3(k, p);
  return {
    x: p.x * c + kxp.x * s + k.x * kdp * (1 - c),
    y: p.y * c + kxp.y * s + k.y * kdp * (1 - c),
    z: p.z * c + kxp.z * s + k.z * kdp * (1 - c),
  };
};

/** The front half of the Line as SVG paths (same maths as Ball), relative to the ball centre. */
export const linePaths = (view: View, r: number, axis: Vec3, angle: number, lineNormal: Vec3): string[] => {
  const b = basisOf(view);
  const k = nrm(axis);
  const n = nrm(lineNormal);
  const helper = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const a1 = nrm(crs(n, helper));
  const a2 = crs(n, a1);
  const out: string[] = [];
  let seg: string[] = [];
  for (let i = 0; i <= 72; i++) {
    const th = (i / 72) * 2 * Math.PI;
    const local = {
      x: a1.x * Math.cos(th) + a2.x * Math.sin(th),
      y: a1.y * Math.cos(th) + a2.y * Math.sin(th),
      z: a1.z * Math.cos(th) + a2.z * Math.sin(th),
    };
    const w = rot(local, k, angle);
    const front = dt3(w, b.toward) >= 0;
    if (front) seg.push(`${(dt3(w, b.right) * r * 0.97).toFixed(1)},${(-dt3(w, b.up) * r * 0.97).toFixed(1)}`);
    else if (seg.length) {
      if (seg.length > 1) out.push(`M${seg.join(" L")}`);
      seg = [];
    }
  }
  if (seg.length > 1) out.push(`M${seg.join(" L")}`);
  return out;
};

/** A soft glowing halo over the Line (drawn after the Ball). `amount` 0..1. */
export const LineHalo: React.FC<{ cx: number; cy: number; r: number; view: View; axis: Vec3; angle: number; lineNormal: Vec3; amount: number }> = ({
  cx,
  cy,
  r,
  view,
  axis,
  angle,
  lineNormal,
  amount,
}) => {
  if (amount <= 0.001) return null;
  const paths = linePaths(view, r, axis, angle, lineNormal);
  const w = Math.max(2, r * 0.11);
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {[3.6, 2.4, 1.5].map((k, i) => (
        <g key={i}>
          {paths.map((d, j) => (
            <path key={j} d={d} fill="none" stroke={PITCH.lightSoft} strokeWidth={w * k} strokeLinecap="round" opacity={0.16 * amount} />
          ))}
        </g>
      ))}
      {paths.map((d, j) => (
        <path key={`c${j}`} d={d} fill="none" stroke="#FFFFFF" strokeWidth={w * 0.9} strokeLinecap="round" opacity={amount} />
      ))}
    </g>
  );
};

// ---------- Curved spin arrow around a ball ----------

/** An arc arrow around a ball showing which way it turns on screen (ccw = anticlockwise). */
export const SpinArrow: React.FC<{ cx: number; cy: number; r: number; ccw: boolean; from?: number; sweep?: number; color?: string; width?: number; t?: number; offset?: number }> = ({
  cx,
  cy,
  r,
  ccw,
  from = -150,
  sweep = 110,
  color = PITCH.chalk,
  width = 7,
  t = 1,
  offset = 0,
}) => {
  if (t <= 0.001) return null;
  const dir = ccw ? -1 : 1;
  const a0 = ((from + offset) * Math.PI) / 180;
  const a1 = a0 + ((dir * sweep * t) * Math.PI) / 180;
  const p = (a: number) => ({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  const s = p(a0);
  const e = p(a1);
  const large = sweep * t > 180 ? 1 : 0;
  const sweepFlag = dir > 0 ? 1 : 0;
  // Tangent direction at the end.
  const tx = -Math.sin(a1) * dir;
  const ty = Math.cos(a1) * dir;
  const nx = -ty;
  const ny = tx;
  const hl = width * 2.4;
  return (
    <g>
      <path d={`M${s.x},${s.y} A${r},${r} 0 ${large} ${sweepFlag} ${e.x},${e.y}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path
        d={`M${e.x + tx * hl},${e.y + ty * hl} L${e.x + nx * hl * 0.7},${e.y + ny * hl * 0.7} L${e.x - nx * hl * 0.7},${e.y - ny * hl * 0.7} Z`}
        fill={color}
        stroke={color}
        strokeWidth={width * 0.5}
        strokeLinejoin="round"
      />
    </g>
  );
};

// ---------- Chalk box (recap row) ----------

/** A rounded chalk box that draws itself on. `k` scales the corner, stroke and dashes (to match a zoomed view). */
export const ChalkBox: React.FC<{ x: number; y: number; w: number; h: number; at: number; dashed?: boolean; fill?: string; stroke?: string; width?: number; until?: number; k?: number }> = ({
  x,
  y,
  w,
  h,
  at,
  dashed = false,
  fill = "#1B2150",
  stroke = PITCH.chalk,
  width = 6,
  until,
  k = 1,
}) => {
  const frame = useCurrentFrame();
  const t = progress(frame, at, 18, EASE.enter);
  const o = until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit);
  if (t <= 0.001 || o <= 0.001) return null;
  const rx = 34 * k;
  const per = 2 * (w + h) - (8 - 2 * Math.PI) * rx;
  return (
    <g opacity={o}>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} opacity={0.85 * t} />
      {dashed ? (
        <rect x={x} y={y} width={w} height={h} rx={rx} fill="none" stroke={stroke} strokeWidth={width * k} strokeDasharray={`${6 * k} ${18 * k}`} strokeLinecap="round" opacity={t} />
      ) : (
        <rect x={x} y={y} width={w} height={h} rx={rx} fill="none" stroke={stroke} strokeWidth={width * k} strokeDasharray={`${per * t} ${per}`} strokeLinecap="round" />
      )}
    </g>
  );
};

// ---------- HUD text ----------

/** A HUD block: caption, big value text, small unit. Pops in. */
export const HudValue: React.FC<{ x: number; y: number; caption: string; value: string; unit: string; at: number; color?: string; size?: number }> = ({
  x,
  y,
  caption,
  value,
  unit,
  at,
  color = PITCH.chalk,
  size = 76,
}) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at);
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <text y={-size * 0.95} fill={color} opacity={0.75} fontFamily={FONTS.hud} fontWeight={700} fontSize={36} textAnchor="middle" letterSpacing={5}>
        {caption}
      </text>
      <text fill={color} fontFamily={FONTS.hud} fontWeight={700} fontSize={size} textAnchor="middle">
        {value}
        <tspan fontSize={size * 0.5} dx={12}>
          {unit}
        </tspan>
      </text>
    </g>
  );
};

// ---------- Flag inset ----------

/** A small round inset with a flag that flutters. `phase` drives the wave (radians). */
export const FlagInset: React.FC<{ x: number; y: number; r?: number; at: number; until: number; phase: number; flip: number }> = ({
  x,
  y,
  r = 150,
  at,
  until,
  phase,
  flip,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const poleX = -r * 0.5;
  const top = -r * 0.5;
  const fw = r * 1.05;
  const fh = r * 0.52;
  const N = 14;
  const pts: string[] = [];
  const bot: string[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const amp = r * 0.1 * u + Math.abs(flip) * r * 0.12 * u * u;
    const wy = Math.sin(u * 5 - phase) * amp + flip * r * 0.18 * u * u;
    pts.push(`${poleX + u * fw},${top + wy}`);
    bot.unshift(`${poleX + u * fw * 0.97},${top + fh + wy * 1.1}`);
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r={r + 10} fill={PITCH.sky} opacity={0.5} />
      <circle r={r} fill={PITCH.stands} />
      <rect x={poleX - 6} y={top - 12} width={12} height={r * 1.35} rx={6} fill={PITCH.chalk} />
      <circle cx={poleX} cy={top - 14} r={11} fill={PITCH.light} />
      <path d={`M${pts.join(" L")} L${bot.join(" L")} Z`} fill={CAST.band} strokeLinejoin="round" />
      <path d={`M${pts.slice(0, 8).join(" L")}`} fill="none" stroke="#FF9A66" strokeWidth={8} strokeLinecap="round" opacity={0.6} />
    </g>
  );
};

// ---------- Kick checklist ----------

const KickGlyph: React.FC<{ kind: 0 | 1 | 2; r: number }> = ({ kind, r }) => {
  const path =
    kind === 0
      ? `M${-r * 0.55},${r * 0.28} L${r * 0.55},${r * 0.1}`
      : kind === 1
        ? `M${-r * 0.4},${r * 0.5} Q${r * 0.55},${r * 0.2} ${r * 0.1},${-r * 0.5}`
        : `M${-r * 0.6},${r * 0.35} Q${-r * 0.05},${-r * 0.75} ${r * 0.55},${r * 0.3}`;
  const end = kind === 0 ? { x: r * 0.55, y: r * 0.1 } : kind === 1 ? { x: r * 0.1, y: -r * 0.5 } : { x: r * 0.55, y: r * 0.3 };
  return (
    <g>
      <path d={path} fill="none" stroke={PITCH.sky} strokeWidth={r * 0.12} strokeLinecap="round" strokeDasharray={`${r * 0.02} ${r * 0.2}`} />
      <circle cx={end.x} cy={end.y} r={r * 0.2} fill={CAST.ball} />
    </g>
  );
};

/** Three kicks with ticks: DRIVE, CURLER, VOLLEY. `ticks[i]` = frame the tick lands. Screen space. */
export const KickChecklist: React.FC<{ x: number; y: number; at: number; ticks: number[]; until?: number }> = ({ x, y, at, ticks, until }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 12, 8);
  if (o <= 0.001) return null;
  const names = ["DRIVE", "CURLER", "VOLLEY"];
  const slide = (1 - progress(frame, at, 14, EASE.enter)) * 60;
  return (
    <g opacity={o} transform={`translate(${x + slide} ${y})`}>
      <rect x={-40} y={-80} width={500} height={480} rx={40} fill={PITCH.sky} opacity={0.82} />
      {names.map((n, i) => {
        const ty = i * 140 + 30;
        const tk = pop(frame, ticks[i]);
        const on = clamp01(tk);
        return (
          <g key={n} transform={`translate(0 ${ty})`}>
            <circle cx={50} cy={0} r={46} fill={PITCH.chalk} opacity={0.55 + 0.45 * on} />
            <g transform="translate(50 0)">
              <KickGlyph kind={i as 0 | 1 | 2} r={46} />
            </g>
            <text x={120} y={14} fill={PITCH.chalk} opacity={0.55 + 0.45 * on} fontFamily={FONTS.title} fontWeight={800} fontSize={42} letterSpacing={2}>
              {n}
            </text>
            <circle cx={390} cy={0} r={28} fill="none" stroke={PITCH.chalk} strokeWidth={5} opacity={0.5} />
            {tk > 0.001 ? (
              <g transform={`translate(390 0) scale(${tk})`}>
                <circle r={28} fill={CAST.fix} />
                <path d="M-13,1 L-3,11 L14,-10" fill="none" stroke={PITCH.sky} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

// ---------- Run-up inset (top view) ----------

/**
 * A small round top-view inset: the run-up comes in at a slight angle from the kicker's left
 * and the last step (the standing foot) lands beside the ball. World metres: x towards goal,
 * y = left (up the inset). `steps[i]` = frame each footprint lands; `runAt`/`runEnd` move the
 * Tavi dot along the path. Screen space.
 */
export const RunUpInset: React.FC<{
  x: number;
  y: number;
  r?: number;
  at: number;
  until: number;
  runAt: number;
  runEnd: number;
  steps: number[];
}> = ({ x, y, r = 150, at, until, runAt, runEnd, steps }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const ppm = r / 2.7;
  const P = (wx: number, wy: number) => ({ x: (wx + 1.0) * ppm, y: -wy * ppm });
  const start = { x: -3.2, y: 1.0 };
  const plant = { x: -0.05, y: 0.22 };
  const at3 = (u: number) => P(start.x + (plant.x - start.x) * u, start.y + (plant.y - start.y) * u);
  const ang = (Math.atan2(-(plant.y - start.y), plant.x - start.x) * 180) / Math.PI;
  const line = progress(frame, at + 4, 14, EASE.enter);
  const a = at3(0);
  const b = at3(line);
  const ball = P(0, 0);
  const u = progress(frame, runAt, runEnd - runAt, EASE.soft);
  const dot = at3(u);
  const prints = [0.36, 0.68, 1];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r={r + 10} fill={PITCH.sky} opacity={0.55} />
      <circle r={r} fill={PITCH.grass} />
      <circle r={r} fill="none" stroke={PITCH.chalk} strokeWidth={5} opacity={0.8} />
      {/* The goal direction: a chalk arrow from the ball to the rim. */}
      <line x1={ball.x + 18} y1={ball.y} x2={r * 0.84} y2={ball.y} stroke={PITCH.chalk} strokeWidth={5} strokeDasharray="2 12" strokeLinecap="round" opacity={0.7} />
      <path d={`M${r * 0.84},${ball.y - 12} L${r * 0.84 + 16},${ball.y} L${r * 0.84},${ball.y + 12} Z`} fill={PITCH.chalk} opacity={0.8} />
      {/* The run-up line at a slight angle. */}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={PITCH.lightSoft} strokeWidth={6} strokeDasharray="3 14" strokeLinecap="round" opacity={0.9} />
      {prints.map((p, i) => {
        const q = at3(p);
        const side = i % 2 === 0 ? 1 : -1;
        const k = pop(frame, steps[i] ?? 9999);
        if (k <= 0.001) return null;
        const last = i === prints.length - 1;
        return (
          <g key={i} transform={`translate(${q.x} ${q.y + (last ? 0 : side * 8)}) rotate(${ang}) scale(${k})`}>
            <rect x={-17} y={-9} width={34} height={18} rx={9} fill={last ? PITCH.light : PITCH.chalk} opacity={last ? 1 : 0.85} />
          </g>
        );
      })}
      <circle cx={ball.x} cy={ball.y} r={11} fill={CAST.ball} />
      {frame >= runAt - 6 ? <circle cx={dot.x} cy={dot.y} r={12} fill={CAST.shirt} opacity={progress(frame, runAt - 6, 6)} /> : null}
    </g>
  );
};

// ---------- "Next level" card with a mini wall drill ----------

/**
 * A chalk card: a NEXT LEVEL badge, one line of text, and a mini wall with the yellow tape at
 * knee height (0.5 m, as in s07). Ten hit marks land one by one: `under` of them under the tape.
 * Screen space; (x, y) is the card's top-left corner.
 */
export const NextLevelCard: React.FC<{ x: number; y: number; at: number; until?: number; text: string; under?: number; marksAt: number }> = ({
  x,
  y,
  at,
  until,
  text,
  under = 9,
  marksAt,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const w = Math.max(640, text.length * 23 + 80);
  const h = 350;
  const wallX = 40;
  const wallY = 150;
  const wallW = w - 80;
  const wallH = 150;
  const mPerPx = 1.5 / wallH; // the wall is 1.5 m tall
  const tapeY = wallY + wallH - 0.5 / mPerPx;
  // Ten marks: nine under the tape, one over it (it does not count).
  const marks = Array.from({ length: 10 }, (_, i) => {
    const over = i === 6 && under < 10;
    const z = over ? 0.78 : 0.16 + 0.26 * ((i * 37) % 10) / 10;
    return { x: wallX + 50 + (i * (wallW - 100)) / 9, y: wallY + wallH - z / mPerPx, over };
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect width={w} height={h} rx={34} fill={PITCH.chalk} />
      <rect x={30} y={24} width={272} height={52} rx={26} fill={PITCH.accent} />
      <text x={166} y={61} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
        NEXT LEVEL
      </text>
      <text x={32} y={126} fill={PITCH.sky} fontFamily={FONTS.label} fontWeight={800} fontSize={40}>
        {text}
      </text>
      {/* The wall, its ground line and the knee-height tape. */}
      <rect x={wallX} y={wallY} width={wallW} height={wallH} rx={14} fill={PITCH.standsLight} />
      <rect x={wallX} y={wallY} width={wallW} height={16} rx={8} fill={PITCH.stands} opacity={0.6} />
      <rect x={wallX - 14} y={wallY + wallH - 4} width={wallW + 28} height={12} rx={6} fill={PITCH.grass} />
      <rect x={wallX} y={tapeY - 6} width={wallW * progress(frame, at + 4, 12, EASE.enter)} height={12} rx={6} fill={PITCH.light} />
      {marks.map((m, i) => {
        const k = pop(frame, marksAt + i * 3);
        if (k <= 0.001) return null;
        return (
          <g key={i} transform={`translate(${m.x} ${m.y}) scale(${k})`}>
            {m.over ? (
              <circle r={13} fill="none" stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="3 6" opacity={0.6} />
            ) : (
              <>
                <circle r={15} fill={PITCH.chalk} />
                <circle r={7} fill={CAST.ball} />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
};

// ---------- Stopwatch ----------

/** A chalk stopwatch with a sweeping hand and a readout. Screen space. */
export const Stopwatch: React.FC<{ x: number; y: number; at: number; until: number; text: string; r?: number }> = ({ x, y, at, until, text, r = 110 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const sweep = progress(frame, at + 4, 10, EASE.enter) * 36;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-r * 0.16} y={-r * 1.32} width={r * 0.32} height={r * 0.26} rx={r * 0.08} fill={PITCH.chalk} />
      <circle r={r} fill={PITCH.chalk} />
      <circle r={r * 0.84} fill={PITCH.sky} />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1={0}
          y1={-r * 0.72}
          x2={0}
          y2={-r * 0.62}
          stroke={PITCH.chalk}
          strokeWidth={5}
          strokeLinecap="round"
          transform={`rotate(${i * 30})`}
          opacity={0.6}
        />
      ))}
      <path d={`M0,0 L0,${-r * 0.7} A${r * 0.7},${r * 0.7} 0 0 1 ${Math.sin((sweep * Math.PI) / 180) * r * 0.7},${-Math.cos((sweep * Math.PI) / 180) * r * 0.7} Z`} fill={CAST.band} opacity={0.6} />
      <line x1={0} y1={0} x2={0} y2={-r * 0.7} stroke={PITCH.chalk} strokeWidth={7} strokeLinecap="round" transform={`rotate(${sweep})`} />
      <circle r={10} fill={CAST.band} />
      <text y={r + 84} fill={PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={72} textAnchor="middle">
        {text}
      </text>
    </g>
  );
};

// ---------- Soft light pool (radial gradient, no blur) ----------

/** Darkens the frame except a soft pool of light around (cx, cy). */
export const DarkPool: React.FC<{ id: string; cx: number; cy: number; r: number; dark: number; pool?: number }> = ({ id, cx, cy, r, dark, pool = 1 }) => {
  if (dark <= 0.001) return null;
  return (
    <g>
      <defs>
        <radialGradient id={id} cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={PITCH.skyHigh} stopOpacity={dark * (1 - pool)} />
          <stop offset="0.45" stopColor={PITCH.skyHigh} stopOpacity={dark * (1 - 0.8 * pool)} />
          <stop offset="1" stopColor={PITCH.skyHigh} stopOpacity={dark} />
        </radialGradient>
      </defs>
      <rect x={-WIDTH} y={-HEIGHT} width={WIDTH * 3} height={HEIGHT * 3} fill={`url(#${id})`} />
    </g>
  );
};

// ---------- Ball streak (replaces the long fixed trail) ----------

type Pt = { x: number; y: number };

/**
 * Screen points for a streak: the ball's position over the last `len` flight frames,
 * oldest first, the last point = the ball now. `at(f)` returns the screen point at flight
 * frame f (or null to skip it, for example behind a perspective camera).
 */
export const streakPoints = (at: (f: number) => Pt | null, fl: number, len = 6, n = 10): Pt[] => {
  const out: Pt[] = [];
  const f0 = Math.max(0, fl - len);
  for (let i = 0; i <= n; i++) {
    const p = at(f0 + ((fl - f0) * i) / n);
    if (p) out.push(p);
  }
  return out;
};

/**
 * A short streak behind a moving ball. It tapers and fades from the ball back to its tail,
 * it is never longer than `maxLen` pixels, and it stops at the ball's centre, so the ball
 * covers its front end. Draw it before the ball.
 */
export const Streak: React.FC<{ id: string; pts: Pt[]; width: number; maxLen: number; color?: string; opacity?: number }> = ({
  id,
  pts,
  width,
  maxLen,
  color = PITCH.lightSoft,
  opacity = 0.6,
}) => {
  if (pts.length < 2 || opacity <= 0.001 || maxLen <= 1) return null;
  // Walk back from the ball and keep at most maxLen pixels of path.
  const kept: { p: Pt; d: number }[] = [{ p: pts[pts.length - 1], d: 0 }];
  let d = 0;
  for (let i = pts.length - 1; i > 0 && d < maxLen; i--) {
    const a = pts[i];
    const b = pts[i - 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 0.01) continue;
    const k = Math.min(1, (maxLen - d) / L);
    d += L * k;
    kept.push({ p: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, d });
  }
  if (kept.length < 2 || d < 2) return null;
  // A tapered ribbon: full width at the ball, a quarter at the tail.
  const left: string[] = [];
  const right: string[] = [];
  kept.forEach(({ p, d: di }, i) => {
    const a = kept[Math.max(0, i - 1)].p;
    const b = kept[Math.min(kept.length - 1, i + 1)].p;
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    const hw = (width / 2) * (0.25 + 0.75 * (1 - di / d));
    const nx = (-ty / tl) * hw;
    const ny = (tx / tl) * hw;
    left.push(`${(p.x + nx).toFixed(1)},${(p.y + ny).toFixed(1)}`);
    right.unshift(`${(p.x - nx).toFixed(1)},${(p.y - ny).toFixed(1)}`);
  });
  const head = kept[0].p;
  const tail = kept[kept.length - 1].p;
  return (
    <g>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={tail.x} y1={tail.y} x2={head.x} y2={head.y}>
          <stop offset="0" stopColor={color} stopOpacity={0} />
          <stop offset="1" stopColor={color} stopOpacity={opacity} />
        </linearGradient>
      </defs>
      <path d={`M${left.join(" L")} L${right.join(" L")} Z`} fill={`url(#${id})`} />
    </g>
  );
};

// ---------- Hands for Tavi's reaction poses ----------

/** An open hand, palm up, at the wrist (x, y), pointing along `dir` (+1 = screen right). Sized from Tavi's height H. */
export const PalmUp: React.FC<{ x: number; y: number; dir: number; H: number; tilt?: number; shade?: boolean }> = ({ x, y, dir, H, tilt = 0, shade = false }) => {
  const w = 0.085 * H;
  const h = 0.032 * H;
  const skin = shade ? CAST.skinShade : CAST.skin;
  return (
    <g transform={`translate(${x} ${y}) scale(${dir} 1) rotate(${-tilt})`}>
      {/* Flat hand with the fingers out and the thumb up: the palm faces the sky. */}
      <rect x={-h * 0.4} y={-h / 2} width={w} height={h} rx={h / 2} fill={skin} />
      <rect x={w * 0.12} y={-h * 1.35} width={h * 0.8} height={h * 1.2} rx={h * 0.4} fill={skin} />
    </g>
  );
};

/** A small closed fist at (x, y). Sized from Tavi's height H. */
export const Fist: React.FC<{ x: number; y: number; H: number }> = ({ x, y, H }) => {
  const r = 0.05 * H;
  return (
    <g>
      <rect x={x - r} y={y - r * 1.1} width={r * 2} height={r * 2} rx={r * 0.7} fill={CAST.skin} />
      <path d={`M${x - r * 0.5},${y - r * 0.55} L${x + r * 0.5},${y - r * 0.55}`} stroke={CAST.skinShade} strokeWidth={r * 0.28} strokeLinecap="round" />
    </g>
  );
};

/** Little curved motion marks on each side of the neck: "shoulders up" in a shrug. */
export const ShrugMarks: React.FC<{ x: number; y: number; H: number; t: number }> = ({ x, y, H, t }) => {
  if (t <= 0.001) return null;
  const s = 0.05 * H;
  return (
    <g opacity={t} stroke={PITCH.chalk} strokeWidth={0.016 * H} strokeLinecap="round" fill="none">
      {[-1, 1].map((d) => (
        <g key={d}>
          <path d={`M${x + d * s * 1.7},${y - s * 0.4} Q${x + d * s * 2.4},${y - s * 1.3} ${x + d * s * 2.0},${y - s * 2.2}`} />
          <path d={`M${x + d * s * 2.8},${y + s * 0.1} Q${x + d * s * 3.5},${y - s * 0.8} ${x + d * s * 3.1},${y - s * 1.7}`} opacity={0.6} />
        </g>
      ))}
    </g>
  );
};

/** A glow built from rings that also shrinks as it fades (lamps switching off). */
export const ShrinkGlow: React.FC<{ cx: number; cy: number; r: number; on: number; color?: string }> = ({ cx, cy, r, on, color = PITCH.lightSoft }) =>
  on <= 0.001 ? null : <Glow cx={cx} cy={cy} r={r * (0.35 + 0.65 * on)} color={color} intensity={1.1 * on} rings={4} />;
