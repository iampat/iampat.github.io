// Extra parts for scenes s06-s07 (owned by the s06-s07 builder).
// Leg IK for the playground-swing arc, a near-side overlay for Tavi (so the ball
// can sit between his legs in depth), props (disc marker, swing seat, ghost ball,
// concrete wall, hazard lights), HUD pieces and a perspective ground.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH } from "../../theme";
import { solve, type Pose } from "../Player";
import { EASE, pop, popSoft, progress, visible } from "../../lib/anim";
import { project, type View } from "../../lib/project";

const rad = (d: number) => (d * Math.PI) / 180;

// ---------------------------------------------------------------- leg maths

/** Two-bone IK in Player units. dx forward, dy down from the hip. Knee bends forward. */
export const legIK = (dx: number, dy: number, a: number, b: number) => {
  const d = Math.max(Math.abs(a - b) + 1e-3, Math.min(Math.hypot(dx, dy), a + b - 1e-3));
  const phi = (Math.atan2(dx, dy) * 180) / Math.PI;
  const beta = (Math.acos((a * a + d * d - b * b) / (2 * a * d)) * 180) / Math.PI;
  const interior = (Math.acos((a * a + b * b - d * d) / (2 * a * b)) * 180) / Math.PI;
  return { hip: phi + beta, knee: 180 - interior };
};

/**
 * Pose whose near-boot laces sit on a circle of radius R around the hip, at swing angle
 * theta (0 = straight down, positive = forward). footAhead turns the toes forward of the radius.
 */
export const swingPose = (base: Pose, H: number, theta: number, R: number, footAhead = 50): Pose => {
  const t = rad(theta);
  const P = { x: Math.sin(t) * R, y: Math.cos(t) * R };
  const f = rad(theta + footAhead);
  const L = 0.13 * H;
  const A = { x: P.x - Math.sin(f) * 0.45 * L, y: P.y - Math.cos(f) * 0.45 * L };
  const ik = legIK(A.x, A.y, 0.245 * H, 0.235 * H);
  const shin = ik.hip - ik.knee;
  return { ...base, nearHip: ik.hip, nearKnee: ik.knee, nearAnkle: 180 - (theta + footAhead - shin) };
};

/** Height of the far (standing) foot's lowest point below the hip, in pixels. */
export const farLow = (pose: Pose, H: number) => {
  const j = solve(pose, H);
  return Math.max(j.fa.y, j.fToe.y) + 0.03 * H;
};

/** Sets `lift` so the standing foot stays on the ground, whatever the kicking leg does. */
export const planted = (pose: Pose, H: number): Pose => {
  const j = solve({ ...pose, lift: 0 }, H);
  return { ...pose, lift: (farLow(pose, H) - j.lowest) / H };
};

/** World positions of Tavi's joints, for a Player drawn at (x, groundY). */
export const jointsOf = (pose: Pose, H: number, x: number, groundY: number) => {
  const j = solve(pose, H);
  const dy = groundY - j.lowest - (pose.lift ?? 0) * H;
  const T = (p: { x: number; y: number }) => ({ x: x + p.x, y: p.y + dy });
  const laces = { x: j.na.x + (j.nToe.x - j.na.x) * 0.45, y: j.na.y + (j.nToe.y - j.na.y) * 0.45 };
  return {
    hip: T(j.hip),
    nearKnee: T(j.nk),
    nearAnkle: T(j.na),
    nearToe: T(j.nToe),
    nearLaces: T(laces),
    farAnkle: T(j.fa),
    farToe: T(j.fToe),
    shoulder: T(j.sh),
    head: T(j.headC),
    /** The eye (same offset as the kit face: 0.52 r forward, 0.05 r up). */
    eye: T({ x: j.headC.x + j.headR * 0.52, y: j.headC.y - j.headR * 0.05 }),
  };
};

/**
 * Redraws only Tavi's near side (kicking leg and right arm) exactly as Player does.
 * Draw Player, then the ball, then this: the ball sits between the legs in depth.
 */
export const NearSide: React.FC<{ x: number; groundY: number; h: number; pose: Pose }> = ({ x, groundY, h: H, pose }) => {
  const j = solve(pose, H);
  const dy = groundY - j.lowest - (pose.lift ?? 0) * H;
  const T = (p: { x: number; y: number }) => ({ x: x + p.x, y: p.y + dy });
  const limbW = 0.075 * H;
  const legW = 0.085 * H;
  const line = (pts: { x: number; y: number }[], color: string, w: number, key: string) => (
    <polyline key={key} points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  );
  const ankle = j.na;
  const toe = j.nToe;
  const ddx = toe.x - ankle.x;
  const ddy = toe.y - ankle.y;
  const L = Math.hypot(ddx, ddy) || 1;
  const d = { x: ddx / L, y: ddy / L };
  const n = { x: -d.y, y: d.x };
  const rh = 0.047 * H;
  const rt = 0.03 * H;
  const heel = { x: ankle.x - d.x * 0.015 * H, y: ankle.y - d.y * 0.015 * H };
  const pts = [
    { x: heel.x - n.x * rh, y: heel.y - n.y * rh },
    { x: toe.x - n.x * rt, y: toe.y - n.y * rt },
    { x: toe.x + n.x * rt, y: toe.y + n.y * rt },
    { x: heel.x + n.x * rh, y: heel.y + n.y * rh },
  ].map(T);
  const h2 = T(heel);
  const t2 = T(toe);
  const s1 = T({ x: heel.x + n.x * rh * 0.92, y: heel.y + n.y * rh * 0.92 });
  const s2 = T({ x: toe.x + n.x * rt * 0.9, y: toe.y + n.y * rt * 0.9 });
  const hip = T(j.hip);
  const sh = T(j.sh);
  return (
    <g>
      {line([hip, T(j.nk)], CAST.shorts, legW * 1.15, "a")}
      {line([T(j.nk), T(j.na)], CAST.sock, legW * 0.95, "b")}
      {line([hip, T(j.nk)], CAST.skin, legW, "c")}
      {line([hip, T({ x: j.hip.x + (j.nk.x - j.hip.x) * 0.35, y: j.hip.y + (j.nk.y - j.hip.y) * 0.35 })], CAST.shorts, legW * 1.2, "d")}
      <polygon points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill={CAST.boot} />
      <circle cx={h2.x} cy={h2.y} r={rh} fill={CAST.boot} />
      <circle cx={t2.x} cy={t2.y} r={rt} fill={CAST.boot} />
      <line x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke={CAST.bootShade} strokeWidth={0.018 * H} strokeLinecap="round" />
      {line([sh, T(j.ne), T(j.nh)], CAST.skin, limbW, "e")}
      {line([sh, T({ x: j.sh.x + (j.ne.x - j.sh.x) * 0.45, y: j.sh.y + (j.ne.y - j.sh.y) * 0.45 })], CAST.shirt, limbW * 1.25, "f")}
    </g>
  );
};

// ---------------------------------------------------------------- props

/** A flat training disc seen side-on. w = width in pixels. `squash` for the landing. */
export const DiscMarker: React.FC<{ x: number; groundY: number; w: number; squash?: number; opacity?: number }> = ({ x, groundY, w, squash = 1, opacity = 1 }) => {
  const h = w * 0.2 * squash;
  const ww = w / Math.sqrt(squash);
  return (
    <g opacity={opacity}>
      <path d={`M${x - ww / 2},${groundY} Q${x - ww * 0.46},${groundY - h} ${x - ww * 0.28},${groundY - h} L${x + ww * 0.28},${groundY - h} Q${x + ww * 0.46},${groundY - h} ${x + ww / 2},${groundY} Z`} fill={PITCH.light} />
      <rect x={x - ww * 0.47} y={groundY - h * 0.38} width={ww * 0.94} height={h * 0.38} rx={h * 0.19} fill={PITCH.accent} opacity={0.45} />
      <rect x={x - ww * 0.2} y={groundY - h * 1.02} width={ww * 0.4} height={h * 0.2} rx={h * 0.1} fill={PITCH.lightSoft} opacity={0.8} />
    </g>
  );
};

/**
 * A playground swing seat on two chains hanging from a pivot (screen space).
 * `part` draws only the ropes or only the seat, so the ropes can sit behind a leg.
 */
export const SwingSeat: React.FC<{ px: number; py: number; sx: number; sy: number; scale?: number; opacity?: number; part?: "all" | "ropes" | "seat" }> = ({
  px,
  py,
  sx,
  sy,
  scale = 1,
  opacity = 1,
  part = "all",
}) => {
  const a = Math.atan2(sy - py, sx - px);
  const perp = { x: -Math.sin(a), y: Math.cos(a) };
  const half = 44 * scale;
  const e1 = { x: sx + perp.x * half, y: sy + perp.y * half };
  const e2 = { x: sx - perp.x * half, y: sy - perp.y * half };
  const deg = (a * 180) / Math.PI - 90;
  return (
    <g opacity={opacity}>
      {part !== "seat" ? (
        <>
          <line x1={px} y1={py} x2={e1.x} y2={e1.y} stroke={PITCH.lightSoft} strokeWidth={4 * scale} strokeLinecap="round" opacity={0.8} />
          <line x1={px} y1={py} x2={e2.x} y2={e2.y} stroke={PITCH.lightSoft} strokeWidth={4 * scale} strokeLinecap="round" opacity={0.8} />
        </>
      ) : null}
      {part !== "ropes" ? (
        <g transform={`translate(${sx} ${sy}) rotate(${deg})`}>
          <rect x={-half - 8 * scale} y={-2 * scale} width={(half + 8 * scale) * 2} height={18 * scale} rx={9 * scale} fill={PITCH.light} />
          <rect x={-half - 4 * scale} y={9 * scale} width={(half + 4 * scale) * 2} height={6 * scale} rx={3 * scale} fill={PITCH.accent} opacity={0.5} />
        </g>
      ) : null}
    </g>
  );
};

/** Ghost ball: a dashed outline at about 40% with no line. */
export const GhostBall: React.FC<{ cx: number; cy: number; r: number; opacity?: number }> = ({ cx, cy, r, opacity = 1 }) => (
  <g opacity={opacity}>
    <circle cx={cx} cy={cy} r={r} fill={PITCH.chalk} opacity={0.12} />
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={PITCH.chalk} strokeWidth={Math.max(2, r * 0.16)} strokeDasharray={`${r * 0.42} ${r * 0.32}`} opacity={0.6} />
  </g>
);

/** Blinking hazard lights on the first car of the kit CarPark (car centre cx, world pixels). */
export const HazardLights: React.FC<{ cx: number; groundY: number; ppm: number; on: boolean; glow?: number }> = ({ cx, groundY, ppm, on, glow = 1 }) => {
  if (!on) return null;
  const y = groundY - 0.78 * ppm;
  return (
    <g>
      {[-2.02, 2.02].map((dx, i) => (
        <g key={i}>
          <circle cx={cx + dx * ppm} cy={y} r={0.9 * ppm} fill={PITCH.light} opacity={0.12 * glow} />
          <circle cx={cx + dx * ppm} cy={y} r={0.5 * ppm} fill={PITCH.light} opacity={0.2 * glow} />
          <rect x={cx + dx * ppm - 0.16 * ppm} y={y - 0.1 * ppm} width={0.32 * ppm} height={0.2 * ppm} rx={0.08 * ppm} fill={PITCH.lightSoft} />
        </g>
      ))}
    </g>
  );
};

/**
 * A concrete wall block seen at an angle from the side view (oblique projection).
 * The face (x = faceX metres) spans y in [-halfW, halfW] and z in [0, height].
 */
export const obliqueOf = (view: { originX: number; groundY: number; ppm: number }, k = 0.3, kz = 0.12) => (x: number, y: number, z: number) => ({
  x: view.originX + x * view.ppm - y * view.ppm * k,
  y: view.groundY - z * view.ppm - y * view.ppm * kz,
});

export const ConcreteWall: React.FC<{
  view: { originX: number; groundY: number; ppm: number };
  faceX: number;
  halfW: number;
  height: number;
  thick?: number;
  children?: React.ReactNode;
}> = ({ view, faceX, halfW, height, thick = 0.5, children }) => {
  const P = obliqueOf(view);
  const q = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
  const face = [P(faceX, halfW, 0), P(faceX, -halfW, 0), P(faceX, -halfW, height), P(faceX, halfW, height)];
  const end = [P(faceX, -halfW, 0), P(faceX + thick, -halfW, 0), P(faceX + thick, -halfW, height), P(faceX, -halfW, height)];
  const top = [P(faceX, halfW, height), P(faceX, -halfW, height), P(faceX + thick, -halfW, height), P(faceX + thick, halfW, height)];
  const seams = [];
  for (let i = 1; i < 6; i++) {
    const yy = -halfW + (2 * halfW * i) / 6;
    const a = P(faceX, yy, 0);
    const b = P(faceX, yy, height);
    seams.push(<line key={`s${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={PITCH.stands} strokeWidth={2} opacity={0.5} />);
  }
  const base = [P(faceX - 0.25, halfW, 0), P(faceX - 0.25, -halfW, 0), P(faceX, -halfW, 0), P(faceX, halfW, 0)];
  return (
    <g>
      <path d={q(base)} fill={PITCH.grassDark} opacity={0.6} />
      <path d={q(face)} fill="#3A4585" />
      {seams}
      <path d={q(top)} fill="#4A5699" />
      <path d={q(end)} fill={PITCH.standsLight} />
      {children}
    </g>
  );
};

// ---------------------------------------------------------------- HUD pieces

/** A straight arrow at an angle (degrees, screen: 0 = right, positive = down), drawn on by t. */
export const DirArrow: React.FC<{ x: number; y: number; angle: number; len: number; color: string; width?: number; t?: number; opacity?: number }> = ({
  x,
  y,
  angle,
  len,
  color,
  width = 10,
  t = 1,
  opacity = 1,
}) => {
  if (t <= 0.001 || opacity <= 0.001) return null;
  const a = rad(angle);
  const L = len * t;
  const ex = x + Math.cos(a) * L;
  const ey = y + Math.sin(a) * L;
  const head = width * 2.3;
  const bx = ex - Math.cos(a) * head * 0.6;
  const by = ey - Math.sin(a) * head * 0.6;
  return (
    <g opacity={opacity}>
      <line x1={x} y1={y} x2={bx} y2={by} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path
        d={`M${ex + Math.cos(a) * head * 0.35},${ey + Math.sin(a) * head * 0.35} L${ex + Math.cos(a + 2.5) * head},${ey + Math.sin(a + 2.5) * head} L${ex + Math.cos(a - 2.5) * head},${ey + Math.sin(a - 2.5) * head} Z`}
        fill={color}
        stroke={color}
        strokeWidth={width * 0.4}
        strokeLinejoin="round"
      />
    </g>
  );
};

/** A curved arrow along a circle (screen degrees: 0 = right, positive = clockwise), drawn on by t. */
export const CurlArrow: React.FC<{ cx: number; cy: number; r: number; a0: number; a1: number; color: string; width?: number; t?: number; opacity?: number }> = ({
  cx,
  cy,
  r,
  a0,
  a1,
  color,
  width = 10,
  t = 1,
  opacity = 1,
}) => {
  if (t <= 0.001 || opacity <= 0.001) return null;
  const end = a0 + (a1 - a0) * t;
  const n = 32;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const a = rad(a0 + ((end - a0) * i) / n);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  const dir = Math.sign(a1 - a0) || 1;
  const ae = rad(end);
  const tang = ae + (dir * Math.PI) / 2;
  const tip = { x: cx + Math.cos(ae) * r, y: cy + Math.sin(ae) * r };
  const head = width * 2.3;
  const bodyPts = pts.slice(0, Math.max(2, n - 2));
  return (
    <g opacity={opacity}>
      <polyline points={bodyPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={`M${tip.x + Math.cos(tang) * head * 0.5},${tip.y + Math.sin(tang) * head * 0.5} L${tip.x + Math.cos(tang + 2.5) * head},${tip.y + Math.sin(tang + 2.5) * head} L${tip.x + Math.cos(tang - 2.5) * head},${tip.y + Math.sin(tang - 2.5) * head} Z`}
        fill={color}
        stroke={color}
        strokeWidth={width * 0.4}
        strokeLinejoin="round"
      />
    </g>
  );
};

/** A padlock; locked 0..1 drops the shackle. */
export const LockIcon: React.FC<{ x: number; y: number; size: number; locked: number; color: string; scale?: number }> = ({ x, y, size, locked, color, scale = 1 }) => {
  if (scale <= 0.001) return null;
  const lift = (1 - locked) * size * 0.4;
  const right = locked > 0.5 ? 0 : -size * 0.18 - lift;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d={`M${-size * 0.3},${-lift} L${-size * 0.3},${-size * 0.32 - lift} A${size * 0.3},${size * 0.3} 0 0 1 ${size * 0.3},${-size * 0.32 - lift} L${size * 0.3},${right}`}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.15}
        strokeLinecap="round"
      />
      <rect x={-size * 0.5} y={0} width={size} height={size * 0.78} rx={size * 0.18} fill={color} />
      <circle cx={0} cy={size * 0.34} r={size * 0.1} fill={PITCH.sky} />
    </g>
  );
};

/** The effort bar: almost all SPEED, a thin sliver of SPIN. */
export const EffortBar: React.FC<{ x: number; y: number; w: number; at: number; until: number; speed?: number }> = ({ x, y, w, at, until, speed = 0.92 }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const fillS = progress(frame, at + 6, 18, EASE.standard) * speed;
  const fillP = progress(frame, at + 22, 10, EASE.standard) * (1 - speed);
  const h = 58;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-24} y={-66} width={w + 170} height={h + 92} rx={34} fill={PITCH.skyHigh} opacity={0.82} />
      <text x={0} y={-22} fill={PITCH.lightSoft} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={3}>
        WHERE THE KICK GOES
      </text>
      <defs>
        <clipPath id={`effort-${at}`}>
          <rect x={0} y={0} width={w} height={h} rx={h / 2} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={w} height={h} rx={h / 2} fill={PITCH.stands} />
      <g clipPath={`url(#effort-${at})`}>
        <rect x={0} y={0} width={w * fillS} height={h} fill={PITCH.accent} />
        {fillP > 0.001 ? <rect x={w * speed} y={0} width={w * fillP} height={h} fill={PITCH.light} /> : null}
        {fillP > 0.001 ? <rect x={w * speed - 3} y={0} width={6} height={h} fill={PITCH.skyHigh} /> : null}
      </g>
      <text x={26} y={h / 2 + 12} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={34} opacity={fillS > 0.2 ? 1 : 0}>
        SPEED
      </text>
      <text x={w + 18} y={h / 2 + 12} fill={PITCH.light} fontFamily={FONTS.label} fontWeight={800} fontSize={34} opacity={fillP > 0.01 ? 1 : 0}>
        SPIN
      </text>
    </g>
  );
};

/** A dashed ring pulse (screen space). */
export const Pulse: React.FC<{ x: number; y: number; r0: number; r1: number; at: number; dur?: number; color?: string; width?: number }> = ({
  x,
  y,
  r0,
  r1,
  at,
  dur = 18,
  color = CAST.fix,
  width = 6,
}) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / dur;
  if (t < 0 || t > 1) return null;
  const e = EASE.enter(t);
  return <circle cx={x} cy={y} r={r0 + (r1 - r0) * e} fill="none" stroke={color} strokeWidth={width * (1 - t * 0.6)} opacity={1 - t} />;
};

/** A dot that pops in (screen space). */
export const PopDot: React.FC<{ x: number; y: number; r: number; at: number; until?: number; color?: string; ring?: string }> = ({ x, y, r, at, until, color = PITCH.chalk, ring }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {ring ? <circle r={r * 1.7} fill={ring} opacity={0.35} /> : null}
      <circle r={r} fill={color} />
    </g>
  );
};

// ---------------------------------------------------------------- perspective world

/** Grass seen in perspective (stripes every 4 m) with the goal-area lines. */
export const PerspGround: React.FC<{ view: View; goalX: number; fromX: number; horizonY: number }> = ({ view, goalX, fromX, horizonY }) => {
  const P = (x: number, y: number) => project({ x, y, z: 0 }, view);
  const quad = (x0: number, x1: number, y0: number, y1: number) => {
    const a = P(x0, y0);
    const b = P(x0, y1);
    const c = P(x1, y1);
    const d = P(x1, y0);
    return `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)} L${c.x.toFixed(1)},${c.y.toFixed(1)} L${d.x.toFixed(1)},${d.y.toFixed(1)} Z`;
  };
  const stripes = [];
  let i = 0;
  for (let x = Math.floor(fromX / 4) * 4; x < goalX + 60; x += 4, i++) {
    if (i % 2) stripes.push(<path key={x} d={quad(Math.max(x, fromX), x + 4, -60, 60)} fill={PITCH.grass} />);
  }
  const line = (pts: [number, number][], key: string) => (
    <path key={key} d={pts.map(([x, y], k) => `${k ? "L" : "M"}${P(x, y).x.toFixed(1)},${P(x, y).y.toFixed(1)}`).join(" ")} fill="none" stroke={PITCH.chalk} strokeWidth={4} opacity={0.75} strokeLinejoin="round" />
  );
  const arc: [number, number][] = [];
  for (let a = -53; a <= 53; a += 4) {
    const t = rad(a);
    arc.push([goalX - 11 - 9.15 * Math.cos(t), 9.15 * Math.sin(t)]);
  }
  return (
    <g>
      <rect x={-WIDTH} y={horizonY} width={WIDTH * 3} height={HEIGHT * 2} fill={PITCH.grassDark} />
      {stripes}
      <rect x={-WIDTH} y={horizonY - 3} width={WIDTH * 3} height={8} fill={PITCH.grassLight} />
      {line([[goalX, -30], [goalX, 30]], "gl")}
      {line([[goalX, 20.16], [goalX - 16.5, 20.16], [goalX - 16.5, -20.16], [goalX, -20.16]], "box")}
      {line([[goalX, 9.16], [goalX - 5.5, 9.16], [goalX - 5.5, -9.16], [goalX, -9.16]], "six")}
      {line(arc, "arc")}
    </g>
  );
};

/**
 * The net pushed back into a pocket around the ball (screen space): a darker hollow and
 * mesh strands pinched towards it. It springs out at `at`, then settles to a small sag.
 * size = pocket radius in pixels at full bulge.
 */
export const NetBulge: React.FC<{ x: number; y: number; at: number; size: number }> = ({ x, y, at, size }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const b = Math.min(1, t / 3) * (0.55 + 0.45 * Math.exp(-t / 12) * Math.cos(t * 0.5));
  const c = { x: x - size * 0.1, y: y - size * 0.1 };
  const pull = 0.62 * b;
  const strands = [];
  for (let i = -2; i <= 2; i++) {
    const dx = i * size * 0.5;
    const w = Math.exp(-((i / 2.2) ** 2));
    const ctrl = { x: c.x + dx * (1 - pull * w), y: c.y + size * 0.1 };
    strands.push(<path key={`v${i}`} d={`M${x + dx},${y - size * 1.5} Q${ctrl.x},${ctrl.y} ${x + dx},${y + size * 0.45}`} />);
  }
  for (const k of [-1.05, -0.45, 0.15]) {
    const dy = k * size;
    const ctrl = { x: c.x, y: c.y + dy * (1 - pull) };
    strands.push(<path key={`h${k}`} d={`M${x - size * 1.7},${y + dy} Q${ctrl.x},${ctrl.y} ${x + size * 1.7},${y + dy}`} />);
  }
  return (
    <g>
      <ellipse cx={c.x} cy={c.y} rx={size * (0.35 + 0.75 * b)} ry={size * (0.28 + 0.55 * b)} fill={PITCH.sky} opacity={0.5} />
      <g fill="none" stroke={PITCH.chalk} strokeWidth={Math.max(2.5, size * 0.05)} strokeLinecap="round" opacity={0.5}>
        {strands}
      </g>
    </g>
  );
};

/** Ripple rings on the net where the ball lands (screen space). */
export const NetRipple: React.FC<{ x: number; y: number; at: number; size: number }> = ({ x, y, at, size }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 40) return null;
  return (
    <g>
      {[0, 6, 12].map((d, i) => {
        const u = (t - d) / 26;
        if (u < 0 || u > 1) return null;
        const e = EASE.enter(u);
        return <ellipse key={i} cx={x} cy={y} rx={size * (0.2 + e * 1.1)} ry={size * (0.14 + e * 0.75)} fill="none" stroke={PITCH.chalk} strokeWidth={5 * (1 - u)} opacity={0.9 * (1 - u)} />;
      })}
    </g>
  );
};

/** A full-frame wipe: rings of grass spread from a point and fill the frame. */
export const RippleWipe: React.FC<{ x: number; y: number; at: number; dur?: number; color?: string }> = ({ x, y, at, dur = 14, color = PITCH.grassDark }) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / dur;
  if (t <= 0) return null;
  const R = Math.hypot(Math.max(x, WIDTH - x), Math.max(y, HEIGHT - y)) * 1.05;
  const e = EASE.standard(Math.min(1, t));
  return (
    <g>
      <circle cx={x} cy={y} r={R * Math.min(1, e * 1.25)} fill={PITCH.chalk} opacity={0.9} />
      <circle cx={x} cy={y} r={R * e} fill={color} />
    </g>
  );
};

/** Small drifting chalk speed streaks (screen space) for tracking shots. */
export const SpeedStreaks: React.FC<{ count?: number; speed: number; seed?: string; y0?: number; y1?: number; opacity?: number }> = ({
  count = 10,
  speed,
  seed = "streak",
  y0 = 150,
  y1 = 950,
  opacity = 0.35,
}) => {
  const frame = useCurrentFrame();
  const span = WIDTH + 600;
  return (
    <g opacity={opacity}>
      {Array.from({ length: count }, (_, i) => {
        const y = y0 + random(`${seed}-y-${i}`) * (y1 - y0);
        const len = 80 + random(`${seed}-l-${i}`) * 180;
        const base = random(`${seed}-x-${i}`) * span;
        const x = ((((base - frame * speed * (0.7 + random(`${seed}-s-${i}`) * 0.6)) % span) + span) % span) - 300;
        return <line key={i} x1={x} y1={y} x2={x + len} y2={y} stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" />;
      })}
    </g>
  );
};

// ---------------------------------------------------------------- s06: targets and the top-view inset

/** A small ring target (screen space): two rings and a centre dot, scaled by s. */
export const Target: React.FC<{ x: number; y: number; r: number; s: number; color?: string; opacity?: number }> = ({ x, y, r, s, color = PITCH.chalk, opacity = 1 }) => {
  if (s <= 0.001 || opacity <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <circle r={r} fill="none" stroke={color} strokeWidth={Math.max(4, r * 0.09)} opacity={0.85} />
      <circle r={r * 0.62} fill="none" stroke={color} strokeWidth={Math.max(3, r * 0.07)} opacity={0.65} />
      <circle r={Math.max(6, r * 0.12)} fill={color} />
    </g>
  );
};

/** A flat mitten hand seen from above, fingers pointing up (screen space, width w). */
export const HandIcon: React.FC<{ x: number; y: number; w: number; s?: number }> = ({ x, y, w, s = 1 }) => {
  if (s <= 0.001) return null;
  const fw = w / 4.3;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 1, 2, 3].map((i) => {
        const fx = -w / 2 + fw * 0.15 + i * fw * 1.08;
        const len = [0.62, 0.74, 0.7, 0.56][i] * w;
        return <rect key={i} x={fx} y={-w * 0.25 - len} width={fw} height={len + fw} rx={fw / 2} fill={CAST.skin} />;
      })}
      <rect x={-w / 2} y={-w * 0.32} width={w} height={w * 0.92} rx={w * 0.3} fill={CAST.skin} />
      <rect x={-w / 2 - w * 0.18} y={-w * 0.12} width={fw * 1.05} height={w * 0.55} rx={fw * 0.52} fill={CAST.skinShade} transform={`rotate(-28 ${-w / 2} ${w * 0.1})`} />
    </g>
  );
};

/**
 * Round "from above" inset: the ball, the standing boot on its disc beside it, a hand that
 * measures the gap (one hand's width) and an arrow from the toes to the goal.
 */
export const TopInset: React.FC<{ cx: number; cy: number; r: number; at: number; until: number; handAt: number; toesAt: number }> = ({ cx, cy, r, at, until, handAt, toesAt }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 170, damping: 17 }) * (1 - progress(frame, until, 9, EASE.exit));
  if (s <= 0.001) return null;
  const k = r / 210; // layout was drawn for r = 210
  const ballR = 50 * k;
  const ball = { x: 58 * k, y: 40 * k };
  const gap = 46 * k;
  const bootW = 46 * k;
  const bootL = 124 * k;
  const bootX = ball.x - ballR - gap - bootW / 2;
  const bootY = ball.y + 6 * k;
  const hand = pop(frame, handAt, { stiffness: 190, damping: 15 });
  const measure = progress(frame, handAt + 6, 10, EASE.standard);
  const toes = progress(frame, toesAt, 14, EASE.enter);
  const goalY = -r + 46 * k;
  const stripes = [];
  for (let i = -6; i <= 6; i += 2) stripes.push(<rect key={i} x={-r} y={i * 34 * k} width={2 * r} height={34 * k} fill={PITCH.grass} />);
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <circle r={r + 14 * k} fill={PITCH.skyHigh} opacity={0.9} />
      <defs>
        <clipPath id="s06-inset-clip">
          <circle r={r} />
        </clipPath>
      </defs>
      <g clipPath="url(#s06-inset-clip)">
        <rect x={-r} y={-r} width={2 * r} height={2 * r} fill={PITCH.grassDark} />
        {stripes}
        {/* The goal, up the screen. */}
        <rect x={-120 * k} y={goalY - 5 * k} width={240 * k} height={10 * k} rx={5 * k} fill={PITCH.chalk} opacity={0.9} />
        <rect x={-120 * k} y={goalY - 34 * k} width={10 * k} height={34 * k} rx={5 * k} fill={PITCH.chalk} opacity={0.9} />
        <rect x={110 * k} y={goalY - 34 * k} width={10 * k} height={34 * k} rx={5 * k} fill={PITCH.chalk} opacity={0.9} />
        {/* Disc under the standing boot. */}
        <circle cx={bootX} cy={bootY} r={48 * k} fill={PITCH.light} opacity={0.75} />
        <circle cx={bootX} cy={bootY} r={20 * k} fill={PITCH.accent} opacity={0.35} />
        {/* Standing boot, toes up the screen (towards the goal). */}
        <rect x={bootX - bootW / 2} y={bootY - bootL / 2} width={bootW} height={bootL} rx={bootW / 2} fill={CAST.boot} />
        <circle cx={bootX} cy={bootY + bootL / 2 - bootW * 0.3} r={bootW * 0.42} fill={CAST.sock} />
        {/* Ball. */}
        <circle cx={ball.x} cy={ball.y} r={ballR} fill={CAST.ball} />
        <path d={`M${ball.x - ballR * 0.2},${ball.y - ballR * 0.97} Q${ball.x + ballR * 0.35},${ball.y} ${ball.x - ballR * 0.2},${ball.y + ballR * 0.97}`} fill="none" stroke={CAST.ballLine} strokeWidth={6 * k} strokeLinecap="round" />
        {/* The hand fills the gap. */}
        <HandIcon x={ball.x - ballR - gap / 2} y={ball.y + 40 * k} w={gap * 0.98} s={hand} />
        {/* Toes point at the goal. */}
        <DirArrow x={bootX} y={bootY - bootL / 2 - 10 * k} angle={-90} len={150 * k} color={PITCH.light} width={12 * k} t={toes} />
      </g>
      {/* Gap measure above the ball (outside the clip so it stays crisp). */}
      {measure > 0.001 ? (
        <g opacity={measure}>
          <line x1={bootX + bootW / 2} y1={ball.y - ballR - 30 * k} x2={ball.x - ballR} y2={ball.y - ballR - 30 * k} stroke={PITCH.chalk} strokeWidth={6 * k} strokeLinecap="round" />
          <line x1={bootX + bootW / 2} y1={ball.y - ballR - 46 * k} x2={bootX + bootW / 2} y2={ball.y - ballR - 14 * k} stroke={PITCH.chalk} strokeWidth={6 * k} strokeLinecap="round" />
          <line x1={ball.x - ballR} y1={ball.y - ballR - 46 * k} x2={ball.x - ballR} y2={ball.y - ballR - 14 * k} stroke={PITCH.chalk} strokeWidth={6 * k} strokeLinecap="round" />
        </g>
      ) : null}
    </g>
  );
};

// ---------------------------------------------------------------- s07: board and drill pieces

/** "FAST FORWARD" tag with a double-triangle icon (screen space, left edge at x). */
export const FastTag: React.FC<{ x: number; y: number; at: number; until: number; label?: string }> = ({ x, y, at, until, label = "FAST FORWARD" }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 10, 8);
  if (o <= 0.001) return null;
  const blink = 0.65 + 0.35 * Math.sin(frame / 4);
  const w = label.length * 24 + 110;
  return (
    <g opacity={o} transform={`translate(${x} ${y})`}>
      <rect width={w} height={66} rx={33} fill={PITCH.sky} opacity={0.94} />
      <g fill={PITCH.light} opacity={blink} transform="translate(26 33)">
        <path d="M0,-14 L20,0 L0,14 Z" />
        <path d="M20,-14 L40,0 L20,14 Z" />
      </g>
      <text x={84} y={45} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={3}>
        {label}
      </text>
    </g>
  );
};

type CueIcon = "angle" | "hand" | "lock";
const CueGlyph: React.FC<{ icon: CueIcon; color: string }> = ({ icon, color }) => {
  if (icon === "angle")
    return (
      <g>
        <line x1={-14} y1={14} x2={10} y2={-10} stroke={color} strokeWidth={6} strokeLinecap="round" />
        <path d="M14,-14 L1,-12 L12,-1 Z" fill={color} stroke={color} strokeWidth={3} strokeLinejoin="round" />
        <line x1={-16} y1={16} x2={16} y2={16} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
      </g>
    );
  if (icon === "hand") return <HandIcon x={0} y={4} w={22} />;
  return <LockIcon x={0} y={-2} size={24} locked={1} color={color} />;
};

/** The practice-board cue strip: three pills; the active one is lit, the others are dimmed. */
export const CueChips: React.FC<{ cues: { icon: CueIcon; text: string }[]; y: number; at: number; active: number; activeAt: number }> = ({ cues, y, at, active, activeAt }) => {
  const frame = useCurrentFrame();
  const size = 34;
  const widths = cues.map((c) => c.text.length * size * 0.54 + 104);
  const gap = 28;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (cues.length - 1);
  let x = WIDTH / 2 - total / 2;
  const lit = progress(frame, activeAt, 10, EASE.standard);
  return (
    <g>
      {cues.map((c, i) => {
        const w = widths[i];
        const left = x;
        x += w + gap;
        const s = popSoft(frame, at + i * 5);
        if (s <= 0.001) return null;
        const isActive = i === active;
        const o = isActive ? 1 : 1 - 0.45 * lit;
        const bg = isActive ? (lit > 0.5 ? CAST.fix : "#1E4260") : "#1E4260";
        const fg = isActive && lit > 0.5 ? PITCH.sky : PITCH.chalk;
        return (
          <g key={i} opacity={o} transform={`translate(${left + w / 2} ${y}) scale(${s * (isActive ? 1 + 0.06 * lit : 1)}) translate(${-w / 2} 0)`}>
            <rect x={0} y={-32} width={w} height={64} rx={32} fill={bg} />
            <g transform="translate(40 0)">
              <CueGlyph icon={c.icon} color={fg} />
            </g>
            <text x={76} y={12} fill={fg} fontFamily={FONTS.label} fontWeight={800} fontSize={size}>
              {c.text}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/**
 * Top-view mini map of the wall drill for the drill card: the wall with its tape, ten step
 * dots, the ball spot and an angled run-up. (x, y) = top-left, w = width.
 */
export const DrillMap: React.FC<{ x: number; y: number; w: number; stepsT: number; runT: number; opacity?: number }> = ({ x, y, w, stepsT, runT, opacity = 1 }) => {
  if (opacity <= 0.001) return null;
  const wallX = 40;
  const wallW = 250;
  const spotY = 176;
  const spot = { x: wallX + wallW / 2, y: spotY };
  const dots = Array.from({ length: 10 }, (_, i) => ({ x: spot.x, y: 30 + (i + 0.5) * ((spotY - 44) / 10) }));
  // Same count as the step counter above Tavi: step 1 shows as soon as he starts walking.
  const shown = stepsT > 0 ? Math.min(10, Math.floor(stepsT * 10 + 1e-6) + 1) : 0;
  const run0 = { x: spot.x - 86, y: spotY + 60 };
  const runEnd = { x: run0.x + (spot.x - 16 - run0.x) * runT, y: run0.y + (spot.y + 10 - run0.y) * runT };
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <rect x={0} y={-10} width={w} height={spotY + 110} rx={26} fill="#16324B" />
      <rect x={wallX} y={6} width={wallW} height={22} rx={8} fill="#3A4585" />
      <rect x={wallX - 6} y={13} width={wallW + 12} height={8} rx={4} fill={PITCH.light} />
      {dots.map((d, i) => (i < shown ? <circle key={i} cx={d.x} cy={d.y} r={5} fill={PITCH.chalk} opacity={0.85} /> : null))}
      <circle cx={spot.x} cy={spot.y} r={14} fill={CAST.ball} />
      {runT > 0.001 ? (
        <g>
          <line x1={run0.x} y1={run0.y} x2={runEnd.x} y2={runEnd.y} stroke={PITCH.lightSoft} strokeWidth={6} strokeDasharray="3 12" strokeLinecap="round" />
          <circle cx={run0.x} cy={run0.y} r={7} fill={PITCH.lightSoft} />
        </g>
      ) : null}
      {/* Step count as a big numeral (no sentence to read). */}
      <text x={wallX + wallW + 70} y={spotY - 40} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={84} textAnchor="middle" opacity={stepsT > 0.05 ? 0.9 : 0}>
        {Math.max(1, shown)}
      </text>
    </g>
  );
};

export type SafetyKind = "wall" | "nobody" | "cars" | "warm";

/** Flat safety icon in an 80 px box centred on (0, 0): brick wall, no people, no cars, a 5-minute stopwatch. */
export const SafetyIcon: React.FC<{ kind: SafetyKind }> = ({ kind }) => {
  const slash = (
    <g>
      <circle r={40} fill="none" stroke={CAST.mistake} strokeWidth={7} />
      <line x1={-28} y1={-28} x2={28} y2={28} stroke={CAST.mistake} strokeWidth={7} strokeLinecap="round" />
    </g>
  );
  if (kind === "wall") {
    // Three rows of bricks: [x, width] pairs, 17 px tall with 4 px gaps.
    const rows: [number, number][][] = [
      [[-38, 33], [-1, 33]],
      [[-38, 14], [-20, 33], [17, 15]],
      [[-38, 33], [-1, 33]],
    ];
    return (
      <g>
        {rows.map((r, i) =>
          r.map(([bx, bw], k) => <rect key={`${i}-${k}`} x={bx} y={-22 + i * 21} width={bw} height={17} rx={5} fill={(i + k) % 2 === 0 ? "#8A94D1" : "#6F7CC4"} />),
        )}
        <circle cx={34} cy={-30} r={15} fill={CAST.fix} />
        <path d="M27,-30 L32,-25 L41,-35" fill="none" stroke={PITCH.sky} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }
  if (kind === "nobody")
    return (
      <g>
        <circle cx={0} cy={-18} r={11} fill={PITCH.chalk} />
        <rect x={-16} y={-4} width={32} height={34} rx={14} fill={PITCH.chalk} />
        {slash}
      </g>
    );
  if (kind === "cars")
    return (
      <g>
        <rect x={-18} y={-18} width={34} height={20} rx={9} fill={PITCH.chalk} />
        <rect x={-30} y={-4} width={60} height={20} rx={9} fill={PITCH.chalk} />
        <circle cx={-16} cy={17} r={7} fill={PITCH.stands} />
        <circle cx={16} cy={17} r={7} fill={PITCH.stands} />
        {slash}
      </g>
    );
  return (
    <g>
      <rect x={-7} y={-40} width={14} height={10} rx={4} fill={PITCH.light} />
      <circle r={32} cy={4} fill={PITCH.light} />
      <circle r={24} cy={4} fill={PITCH.sky} />
      <text x={0} y={16} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={32} textAnchor="middle">
        5
      </text>
    </g>
  );
};
