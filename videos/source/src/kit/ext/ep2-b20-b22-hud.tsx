// HUD and chalk pieces for the episode 2 ending scenes b20-b22: the ring readout pill and the lime eye
// lock (as b19 draws them, so the join has no pop), the chalk "?" that writes on and rubs out, the chalk X
// on the empty receiving spot, the lime ring on the grass, three time coins, a chalk stick walker, the
// split-panel Tavis, speed bars, the replay timeline strip, a chalk measure line, the far city with the
// dark stadium, and the end card.
// Screen or world pixels as noted. Floodlit Pitch palette.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { EASE, clamp01, idle, lerp, pop, popSoft, progress } from "../../lib/anim";
import { Glow, Stars } from "../World";
import { Keeper, type KeeperPose } from "../Keeper";
import { Player, POSES, solve, type Pose } from "../Player";
import { Ball } from "../Ball";
import { TopPlayer } from "../TopPlayer";
import { Snapshot } from "../Snapshot";
import { bubbleColor } from "../TimeBubble";
import { safeId, sequence, trim } from "../ep2/chalk";
import { GAVE_BACK, ROLL_AXIS, SIDE, breathe } from "./ep2-b20-b22-world";

const CH = PITCH.chalk;

// ---------- The ring readout pill (b19's look) ----------

/** The time bubble's number in its own pill, for side views where the ring lies under the feet. */
export const SecondsPill: React.FC<{ x: number; y: number; seconds: number; at: number; until?: number; size?: number }> = ({ x, y, seconds, at, until, size = 40 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 140, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const color = bubbleColor(seconds);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-size * 1.7} y={-size * 0.75} width={size * 3.4} height={size * 1.3} rx={size * 0.65} fill={PITCH.sky} opacity={0.85} />
      <text y={size * 0.33} fill={color} fontFamily={FONTS.mono} fontWeight={500} fontSize={size} textAnchor="middle">
        {seconds.toFixed(1)} s
      </text>
    </g>
  );
};

// ---------- The lime eye lock (b19's look) ----------

/** A small lime eye that locks on the ball: an eye icon, a dotted line and a dashed ring round the ball. */
export const EyeLock: React.FC<{ x: number; y: number; bx: number; by: number; br: number; at: number; until?: number; spin?: number }> = ({ x, y, bx, by, br, at, until, spin = 0 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 240, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const lead = progress(frame, at + 3, 10, EASE.enter);
  const ring = progress(frame, at + 8, 8, EASE.enter);
  const ex = x + (bx - x) * lead;
  const ey = y + (by - y) * lead;
  return (
    <g opacity={Math.min(1, s)}>
      <line x1={x} y1={y + 26} x2={ex} y2={ey} stroke={XRAY.lime} strokeWidth={4} strokeDasharray="3 10" strokeLinecap="round" opacity={0.8} />
      {ring > 0.01 ? (
        <circle cx={bx} cy={by} r={(br + 12) * ring} fill="none" stroke={XRAY.lime} strokeWidth={4} strokeDasharray="10 8" transform={`rotate(${(frame + spin) * 2} ${bx} ${by})`} opacity={0.9} />
      ) : null}
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <circle r={38} fill={PITCH.sky} opacity={0.85} />
        <path d="M-26,0 Q0,-22 26,0 Q0,22 -26,0 Z" fill={XRAY.lime} />
        <circle cx={0} cy={0} r={9} fill={PITCH.sky} />
        <circle cx={3} cy={-3} r={3} fill={PITCH.chalk} />
      </g>
    </g>
  );
};

// ---------- Chalk with one eyebrow up ----------

/**
 * Chalk (the shared Keeper, face "flat") with one eyebrow raised and arched. The shared "thinking" face only
 * tilts both brows, which reads as a frown at close range. This paints out the brow on the side away from
 * his shade stripe in body colour and draws it again, higher and arched. `raise` 0..1 (an overshoot ease is
 * fine); at 0 the new brow sits exactly on the old one. `rise` sinks him into the grass as the Keeper does.
 */
export const ChalkOneBrow: React.FC<{ x: number; groundY: number; h: number; pose: KeeperPose; raise: number; look?: number; flip?: boolean; rise?: number; opacity?: number }> = ({
  x,
  groundY,
  h,
  pose,
  raise,
  look = 0,
  flip = false,
  rise = 1,
  opacity = 1,
}) => {
  const id = safeId(React.useId(), "brow");
  const H = h * pose.stretch;
  const W = (h * 0.34) / Math.sqrt(pose.stretch);
  const lx = look * W * 0.08;
  const cx = -W * 0.18 + lx;
  const by = -H * 0.8 - H * 0.06;
  const up = Math.max(-0.2, raise) * H * 0.055;
  const arch = Math.max(0, raise) * h * 0.02;
  const half = W * 0.08;
  return (
    <g opacity={opacity}>
      <Keeper x={x} groundY={groundY} h={h} pose={pose} face="flat" look={look} flip={flip} rise={rise} />
      {rise > 0.002 ? (
        <g>
          <defs>
            <clipPath id={id}>
              <rect x={x - h * 2} y={groundY - h * 2 * rise} width={h * 4} height={h * 2 * rise + 4} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id})`}>
            <g transform={`translate(${x + pose.shift * h * (flip ? -1 : 1)} ${groundY - pose.lift * h}) scale(${flip ? -1 : 1} 1) rotate(${pose.lean} 0 ${-H * 0.45}) translate(0 ${(1 - rise) * h})`}>
              <rect x={cx - W * 0.115} y={by - h * 0.013} width={W * 0.23} height={h * 0.026} rx={h * 0.013} fill={CAST.keeper} />
              <path
                d={`M${cx - half},${by - up * 0.7} Q${cx},${by - up * 1.1 - arch} ${cx + half},${by - up * 0.9}`}
                fill="none"
                stroke={CAST.keeperEye}
                strokeWidth={h * 0.018}
                strokeLinecap="round"
              />
            </g>
          </g>
        </g>
      ) : null}
    </g>
  );
};

// ---------- The chalk "?" on the grass ----------

/**
 * A chalk question mark that writes itself on from `at` and, with `rubAt`, rubs itself out from the top
 * with a small eraser and chalk dust. `size` is the glyph height in the parent's pixels.
 */
export const ChalkQuestion: React.FC<{ x: number; y: number; size?: number; at: number; rubAt?: number; color?: string }> = ({ x, y, size = 100, at, rubAt, color = CH }) => {
  const frame = useCurrentFrame();
  const id = safeId(React.useId(), "cq");
  const draw = progress(frame, at, 22, EASE.soft);
  if (draw <= 0.001) return null;
  const rub = rubAt === undefined ? 0 : progress(frame, rubAt, 16, EASE.standard);
  if (rub >= 0.999) return null;
  const [hook, dot] = sequence(draw, [4, 1]);
  const k = size / 100;
  const wob = idle(frame, 2, 1.8, 2.5);
  const lineY = -70 + 130 * rub;
  return (
    <g transform={`translate(${x} ${y}) rotate(${5 + wob}) scale(${k})`}>
      <defs>
        <clipPath id={id}>
          <rect x={-70} y={lineY} width={140} height={140} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {hook > 0.002 ? <path d="M-28,-30 A28,28 0 1 1 14,-6 Q2,6 0,24" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} {...trim(hook)} /> : null}
        {dot > 0.002 ? <circle cx={0} cy={44} r={6.5 * Math.min(1, dot * 1.2)} fill={color} opacity={0.95} /> : null}
        {/* Chalk crumbs along the stroke. */}
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={i} cx={(random(`cq-x-${i}`) - 0.5) * 50} cy={(random(`cq-y-${i}`) - 0.55) * 90} r={1.5 + random(`cq-r-${i}`) * 2} fill={color} opacity={0.3 * clamp01(draw * 1.5 - 0.5)} />
        ))}
      </g>
      {rub > 0.01 && rub < 0.99 ? (
        <g>
          <rect x={-46 + idle(frame, 3, 0.4, 6)} y={lineY - 12} width={92} height={24} rx={8} fill={PITCH.stands} opacity={0.9} />
          {[0, 1, 2, 3].map((m) => (
            <circle key={m} cx={-30 + m * 20 + idle(frame, m, 0.5, 5)} cy={lineY + 14 + m * 3 + idle(frame, m + 4, 0.45, 4)} r={3.5 - m * 0.5} fill={color} opacity={0.5} />
          ))}
        </g>
      ) : null}
    </g>
  );
};

// ---------- The chalk X on the empty receiving spot ----------

/**
 * A chalk X that writes itself on (two strokes) from `at`. `size` is the half-width in the parent's pixels;
 * `squash` flattens it onto the grass for a side view (1 = top view). Chalk crumbs sit round it.
 */
export const ChalkX: React.FC<{ x: number; y: number; size: number; at: number; squash?: number; opacity?: number; color?: string; width?: number }> = ({
  x,
  y,
  size,
  at,
  squash = 1,
  opacity = 1,
  color = CH,
  width,
}) => {
  const frame = useCurrentFrame();
  const draw = progress(frame, at, 12, EASE.soft);
  if (draw <= 0.001 || opacity <= 0.001) return null;
  const [s1, s2] = sequence(draw, [1, 1]);
  const w = width ?? Math.max(3, size * 0.28);
  const hy = size * squash;
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      {s1 > 0.002 ? <path d={`M${-size},${-hy} L${size},${hy}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" opacity={0.92} {...trim(s1)} /> : null}
      {s2 > 0.002 ? <path d={`M${size},${-hy} L${-size},${hy}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" opacity={0.92} {...trim(s2)} /> : null}
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={(random(`cx-x-${i}`) - 0.5) * size * 2.6} cy={(random(`cx-y-${i}`) - 0.5) * hy * 2.6} r={w * (0.18 + random(`cx-r-${i}`) * 0.2)} fill={color} opacity={0.35 * clamp01(draw * 2 - 1)} />
      ))}
    </g>
  );
};

// ---------- The ring drawn on the grass ----------

/** A flat chalk ring on the grass (an ellipse) that draws itself on, with tick marks and a soft glow. */
export const GrassRing: React.FC<{ x: number; y: number; rx: number; ry: number; draw: number; color?: string; glow?: number; opacity?: number }> = ({ x, y, rx, ry, draw, color = XRAY.lime, glow = 0, opacity = 1 }) => {
  if (draw <= 0.001) return null;
  const d = `M${x - rx},${y} A${rx},${ry} 0 1 1 ${x + rx},${y} A${rx},${ry} 0 1 1 ${x - rx},${y}`;
  return (
    <g opacity={opacity}>
      {glow > 0.01 ? (
        <g transform={`translate(${x} ${y}) scale(1 ${ry / rx})`}>
          <Glow cx={0} cy={0} r={rx * 1.5} color={color} intensity={glow * 1.3} rings={4} />
        </g>
      ) : null}
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={color} opacity={0.1 * draw} />
      <path d={d} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.92} {...trim(draw)} />
      <ellipse cx={x} cy={y} rx={rx * 0.97} ry={ry * 0.95} fill="none" stroke={color} strokeWidth={2} strokeDasharray={`${rx * 0.12} ${rx * 0.08}`} opacity={0.45 * clamp01(draw * 1.5 - 0.5)} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI;
        const show = clamp01(draw * 1.3 - i / 12);
        return <line key={i} x1={x + Math.cos(a) * rx * 0.9} y1={y + Math.sin(a) * ry * 0.9} x2={x + Math.cos(a) * rx * (0.9 - 0.12 * show)} y2={y + Math.sin(a) * ry * (0.9 - 0.12 * show)} stroke={color} strokeWidth={3.5} strokeLinecap="round" opacity={0.7 * show} />;
      })}
    </g>
  );
};

// ---------- Three time coins ----------

/** Three chalk coins with clock hands that drop into a flat ring at (x, y), one per frame in `at`. */
export const TimeCoins: React.FC<{ x: number; y: number; rx: number; ry: number; at: [number, number, number]; r?: number; color?: string }> = ({ x, y, rx, ry, at, r = 14, color = CH }) => {
  const frame = useCurrentFrame();
  const spots: [number, number][] = [
    [-rx * 0.5, ry * 0.15],
    [0, -ry * 0.15],
    [rx * 0.5, ry * 0.15],
  ];
  return (
    <g transform={`translate(${x} ${y})`}>
      {spots.map(([cx, cy], i) => {
        const p = pop(frame, at[i], { stiffness: 220, damping: 14 });
        if (p <= 0.001) return null;
        const drop = (1 - Math.min(1, p)) * -r * 5;
        const land = progress(frame, at[i] + 6, 10, EASE.enter);
        return (
          <g key={i} transform={`translate(${cx} ${cy + drop})`} opacity={Math.min(1, p * 1.5)}>
            <circle r={r} fill="none" stroke={color} strokeWidth={r * 0.22} opacity={0.95} />
            <line x1={0} y1={0} x2={0} y2={-r * 0.58} stroke={color} strokeWidth={r * 0.2} strokeLinecap="round" />
            <line x1={0} y1={0} x2={r * 0.42} y2={r * 0.08} stroke={color} strokeWidth={r * 0.2} strokeLinecap="round" />
            {land > 0.01 && land < 1 ? [0, 1, 2].map((k) => <circle key={k} cx={(k - 1) * r * 1.3 * (0.5 + land)} cy={r * 0.9 - land * r * 0.8} r={r * 0.14 * (1 - land)} fill={color} opacity={0.6 * (1 - land)} />) : null}
          </g>
        );
      })}
    </g>
  );
};

// ---------- A chalk stick figure ----------

/**
 * A chalk stick figure seen from the side, facing right. `h` is the height in pixels. `run` 0..1 is how hard
 * it runs (limb swing and lean), `phase` the stride phase (one cycle per 1.0).
 */
export const ChalkWalker: React.FC<{ x: number; y: number; h: number; run: number; phase: number; color?: string; opacity?: number; puffs?: boolean }> = ({ x, y, h, run, phase, color = CH, opacity = 1, puffs = false }) => {
  const w = Math.max(5, h * 0.045);
  const headR = h * 0.09;
  const hipY = -h * 0.47;
  const shoulderY = -h * 0.78;
  const thigh = h * 0.24;
  const shin = h * 0.23;
  const upper = h * 0.16;
  const fore = h * 0.15;
  const swing = Math.sin(phase * Math.PI * 2);
  const amp = 8 + 44 * run;
  const lean = 16 * run;
  const bob = run * h * 0.012 * Math.abs(Math.cos(phase * Math.PI * 2));
  const rad = (d: number) => (d * Math.PI) / 180;
  const leg = (sign: number, key: string, o: number) => {
    const hipA = sign * swing * amp;
    const kneeBend = Math.max(0, sign * swing) * (20 + 60 * run) + 6;
    const kx = Math.sin(rad(hipA)) * thigh;
    const ky = hipY + Math.cos(rad(hipA)) * thigh;
    const ax = kx + Math.sin(rad(hipA - kneeBend)) * shin;
    const ay = ky + Math.cos(rad(hipA - kneeBend)) * shin;
    const fx = ax + Math.cos(rad(-(hipA - kneeBend) - 8)) * h * 0.09;
    const fy = ay - Math.sin(rad(-(hipA - kneeBend) - 8)) * h * 0.09 * 0.15;
    return <polyline key={key} points={`0,${hipY} ${kx},${ky} ${ax},${ay} ${fx},${fy}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} />;
  };
  const arm = (sign: number, key: string, o: number) => {
    const a = -sign * swing * amp * 0.8 + 6;
    const ex = Math.sin(rad(a)) * upper;
    const ey = shoulderY + Math.cos(rad(a)) * upper;
    const bend = 30 + 70 * run;
    const hx = ex + Math.sin(rad(a + bend)) * fore;
    const hy = ey + Math.cos(rad(a + bend)) * fore;
    return <polyline key={key} points={`0,${shoulderY} ${ex},${ey} ${hx},${hy}`} fill="none" stroke={color} strokeWidth={w * 0.85} strokeLinecap="round" strokeLinejoin="round" opacity={o} />;
  };
  return (
    <g transform={`translate(${x} ${y - bob})`} opacity={opacity}>
      {puffs
        ? [0, 1, 2].map((i) => (
            <circle key={i} cx={-h * 0.2 - i * 22 - ((phase * 40) % 22)} cy={-h * 0.08 - i * 4} r={3 + i * 1.6} fill={color} opacity={0.35 - i * 0.08} />
          ))
        : null}
      <g transform={`rotate(${lean} 0 ${hipY})`}>
        {leg(-1, "farLeg", 0.55)}
        {arm(-1, "farArm", 0.55)}
        <line x1={0} y1={hipY} x2={0} y2={shoulderY} stroke={color} strokeWidth={w * 1.1} strokeLinecap="round" />
        <circle cx={h * 0.02} cy={shoulderY - headR * 1.25} r={headR} fill="none" stroke={color} strokeWidth={w} />
        <circle cx={h * 0.02 + headR * 0.45} cy={shoulderY - headR * 1.35} r={w * 0.45} fill={color} />
        {leg(1, "nearLeg", 1)}
        {arm(1, "nearArm", 1)}
      </g>
    </g>
  );
};

// ---------- b21 split panels: the two Tavis at the moment the ball reaches them ----------

/**
 * Tavi frozen at contact, feet on y = 0 and hips at x = 0, facing left. "stiff": the cold open, the ball on
 * the locked shin. "back": tonight, the ball at the open back foot. Breathes a little, never dead still.
 */
export const FrozenTavi: React.FC<{ variant: "stiff" | "back"; h: number; frame: number }> = ({ variant, h, frame }) => {
  const stiff = variant === "stiff";
  const base = stiff ? POSES.receiveStiff : GAVE_BACK;
  const pose: Pose = breathe(base, frame, stiff ? 1 : 3, 0.6);
  const footTurn = stiff ? 0 : 0.6;
  const j = solve(pose, h, footTurn);
  const dy = -j.lowest - (pose.lift ?? 0) * h;
  const T = (p: { x: number; y: number }) => ({ x: -p.x, y: p.y + dy });
  const r = (0.11 / 1.62) * h;
  const ballX = stiff ? T(j.na).x - r - 0.03 * h : T(j.fToe).x - r - 0.01 * h;
  return (
    <g>
      <line x1={-260} y1={3} x2={260} y2={3} stroke={CH} strokeWidth={4} strokeLinecap="round" opacity={0.28} />
      <ellipse cx={ballX + 2} cy={2} rx={r * 1.15} ry={r * 0.32} fill="#000" opacity={0.22} />
      <Player x={0} groundY={0} h={h} pose={pose} face={stiff ? "wince" : "focus"} flip footTurn={footTurn} />
      <Ball cx={ballX} cy={-r} r={r} view={SIDE} axis={ROLL_AXIS} angle={0.4} squash={0.92} />
    </g>
  );
};

/** A chalk check mark that draws on at `at`. */
export const ChalkTick: React.FC<{ x: number; y: number; at: number; until?: number; size?: number; color?: string }> = ({ x, y, at, until, size = 1, color = CH }) => {
  const frame = useCurrentFrame();
  const t = progress(frame, at, 10, EASE.enter);
  const o = until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit);
  if (t <= 0.002 || o <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} opacity={o}>
      <path d="M-22,2 L-6,18 L24,-18" fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" {...trim(t)} />
    </g>
  );
};

/** A small speed bar with no digits: a chalk track and a fill that grows to the same length every time. */
export const SpeedBar: React.FC<{ x: number; y: number; w: number; at: number; until?: number; fill?: string }> = ({ x, y, w, at, until, fill = PITCH.lightSoft }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const f = progress(frame, at + 4, 16, EASE.enter);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-w / 2} y={-10} width={w} height={20} rx={10} fill={CH} opacity={0.2} />
      <rect x={-w / 2} y={-10} width={Math.max(20, w * 0.62 * f)} height={20} rx={10} fill={fill} />
    </g>
  );
};

// ---------- b21 replay: the timeline strip ----------

/**
 * A chalk timeline of the pass: a bar from the kick to `tMax` seconds, a ball dot at `t`, a polaroid that pops
 * above each scan (with a tiny Chalk in it) and a lime tick where the touch happened.
 */
export const TimelineStrip: React.FC<{ x0: number; x1: number; y: number; t: number; tMax: number; snaps: { t: number; at: number }[]; touch?: { t: number; at: number }; at: number; until?: number }> = ({
  x0,
  x1,
  y,
  t,
  tMax,
  snaps,
  touch,
  at,
  until,
}) => {
  const frame = useCurrentFrame();
  const s = progress(frame, at, 14, EASE.enter) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const px = (tt: number) => lerp(x0, x1, clamp01(tt / tMax));
  const bx = px(t);
  return (
    <g opacity={s}>
      <rect x={x0 - 6} y={y - 5} width={(x1 - x0 + 12) * s} height={10} rx={5} fill={CH} opacity={0.35} />
      <rect x={x0 - 6} y={y - 5} width={Math.max(0, bx - x0 + 6)} height={10} rx={5} fill={CH} opacity={0.5} />
      {/* The kick: a small chalk boot tick at the start. */}
      <circle cx={x0} cy={y} r={11} fill={CH} opacity={0.9} />
      {touch ? (
        <g opacity={pop(frame, touch.at, { stiffness: 240, damping: 15 })}>
          <line x1={px(touch.t)} y1={y - 26} x2={px(touch.t)} y2={y + 26} stroke={XRAY.lime} strokeWidth={7} strokeLinecap="round" />
          <circle cx={px(touch.t)} cy={y} r={14} fill={XRAY.lime} opacity={0.35} />
        </g>
      ) : null}
      <circle cx={bx + 2} cy={y + 2} r={13} fill="#000" opacity={0.25} />
      <circle cx={bx} cy={y} r={13} fill={CAST.ball} />
      <circle cx={bx - 4} cy={y - 4} r={4} fill={CAST.ballRim} opacity={0.8} />
      {snaps.map((sn, i) => (
        <Snapshot key={i} x={px(sn.t)} y={y - 86} w={96} h={64} at={sn.at} tilt={i % 2 ? 6 : -6}>
          <rect width={96} height={64} fill={PITCH.sky} />
          <rect y={30} width={96} height={34} fill={PITCH.grassDark} />
          <rect x={20} y={30} width={22} height={34} fill={PITCH.grass} />
          <rect x={62} y={30} width={22} height={34} fill={PITCH.grass} />
          <TopPlayer x={60} y={44} kind="chalk" size={22} facing={200} />
        </Snapshot>
      ))}
    </g>
  );
};

// ---------- b21 replay: the chalk measure line ----------

/** A dashed chalk line from a to b that draws on, with a tick at each end. */
export const MeasureLine: React.FC<{ a: { x: number; y: number }; b: { x: number; y: number }; at: number; until?: number; dur?: number; color?: string }> = ({ a, b, at, until, dur = 16, color = CH }) => {
  const frame = useCurrentFrame();
  const t = progress(frame, at, dur, EASE.enter);
  const o = until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit);
  if (t <= 0.002 || o <= 0.001) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const ex = a.x + dx * t;
  const ey = a.y + dy * t;
  const tick = (px: number, py: number, s: number) => <line x1={px - nx * 16 * s} y1={py - ny * 16 * s} x2={px + nx * 16 * s} y2={py + ny * 16 * s} stroke={color} strokeWidth={6} strokeLinecap="round" />;
  return (
    <g opacity={0.9 * o}>
      <line x1={a.x} y1={a.y} x2={ex} y2={ey} stroke={color} strokeWidth={5} strokeDasharray="4 14" strokeLinecap="round" />
      {tick(a.x, a.y, clamp01(t * 4))}
      {tick(b.x, b.y, clamp01(t * 4 - 3))}
    </g>
  );
};

// ---------- b20 map: the lime space ----------

/** The open space on the map: a soft lime patch that pulses, popping in at `at`. */
export const SpacePatch: React.FC<{ x: number; y: number; rx: number; ry: number; at: number; until?: number }> = ({ x, y, rx, ry, at, until }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const pulse = 0.85 + 0.15 * Math.sin(frame / 7);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g transform={`scale(1 ${ry / rx})`}>
        <Glow cx={0} cy={0} r={rx * 1.25} color={XRAY.lime} intensity={0.9 * pulse} rings={4} />
      </g>
      <ellipse rx={rx} ry={ry} fill={XRAY.lime} opacity={0.2 * pulse} />
      <ellipse rx={rx} ry={ry} fill="none" stroke={XRAY.lime} strokeWidth={3} strokeDasharray="14 12" opacity={0.55} />
    </g>
  );
};

// ---------- b22: the polaroid of the ring, the net bag, the far city, the end card ----------

/** What the last snapshot shows: the lime ring glowing on the dark grass. Draws in a w x h box. */
export const RingPhoto: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <g>
    <rect width={w} height={h} fill={PITCH.skyHigh} />
    <rect y={h * 0.42} width={w} height={h * 0.58} fill={PITCH.grassDark} />
    <rect x={w * 0.12} y={h * 0.42} width={w * 0.16} height={h * 0.58} fill={PITCH.grass} opacity={0.5} />
    <rect x={w * 0.6} y={h * 0.42} width={w * 0.16} height={h * 0.58} fill={PITCH.grass} opacity={0.5} />
    <g transform={`translate(${w / 2} ${h * 0.7}) scale(1 0.34)`}>
      <Glow cx={0} cy={0} r={w * 0.42} color={XRAY.lime} intensity={1.1} rings={4} />
    </g>
    <ellipse cx={w / 2} cy={h * 0.7} rx={w * 0.3} ry={h * 0.1} fill="none" stroke={XRAY.lime} strokeWidth={4} />
  </g>
);

/** A net bag of balls, bottom centre at (x, y). `swing` tilts it a little. */
export const NetBag: React.FC<{ x: number; y: number; w?: number; balls?: number; swing?: number }> = ({ x, y, w = 30, balls = 3, swing = 0 }) => {
  const h = w * 1.35;
  return (
    <g transform={`translate(${x} ${y}) rotate(${swing})`}>
      <path d={`M${-w / 2},${-h * 0.15} Q${-w / 2},${0} 0,0 Q${w / 2},0 ${w / 2},${-h * 0.15} L${w * 0.35},${-h} L${-w * 0.35},${-h} Z`} fill={PITCH.chalk} opacity={0.35} />
      {Array.from({ length: balls }, (_, i) => (
        <circle key={i} cx={(i - (balls - 1) / 2) * w * 0.34} cy={-h * 0.22 - (i % 2) * w * 0.32} r={w * 0.2} fill={CAST.ball} />
      ))}
      {[0.25, 0.5, 0.75].map((k) => (
        <line key={k} x1={-w * 0.45} y1={-h * k} x2={w * 0.45} y2={-h * k} stroke={PITCH.chalk} strokeWidth={1.5} opacity={0.5} />
      ))}
      <rect x={-w * 0.4} y={-h - 4} width={w * 0.8} height={8} rx={4} fill={PITCH.chalk} opacity={0.9} />
    </g>
  );
};

/** The far city at night: a dark skyline with a few lit windows, and the stadium as one warm dot. Full frame. */
export const CityNight: React.FC<{ opacity: number; dot: { x: number; y: number }; frame: number }> = ({ opacity, dot, frame }) => {
  if (opacity <= 0.001) return null;
  const horizon = HEIGHT * 0.66;
  return (
    <g opacity={opacity}>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} />
      <Stars count={120} maxY={horizon - 40} seed="b22city" />
      {/* Far hills. */}
      <path d={`M0,${horizon + 20} Q300,${horizon - 60} 620,${horizon} T1240,${horizon - 30} T1920,${horizon + 10} L1920,${HEIGHT} L0,${HEIGHT} Z`} fill="#10143A" />
      {/* Blocks with windows. */}
      {Array.from({ length: 34 }, (_, i) => {
        const bw = 36 + random(`cw-${i}`) * 46;
        const bx = i * 58 - 20 + random(`cx-${i}`) * 10;
        const bh = 40 + random(`ch-${i}`) * 150;
        const rows = Math.floor(bh / 22);
        return (
          <g key={i}>
            <rect x={bx} y={horizon - bh + 10} width={bw} height={bh} rx={3} fill={i % 3 ? "#171C48" : "#1B2150"} />
            {Array.from({ length: Math.min(6, rows) }, (_, k) =>
              random(`cwin-${i}-${k}`) > 0.45 ? (
                <rect key={k} x={bx + 8 + (random(`cwx-${i}-${k}`) * (bw - 20))} y={horizon - bh + 22 + k * 22} width={7} height={9} rx={1.5} fill={PITCH.lightSoft} opacity={0.3 + 0.5 * (0.5 + 0.5 * Math.sin(frame / 17 + i + k))} />
              ) : null,
            )}
          </g>
        );
      })}
      {/* The ground below the skyline. */}
      <rect x={0} y={horizon + 8} width={WIDTH} height={HEIGHT - horizon} fill="#0C1030" />
      {/* The stadium: a dark oval and one warm dot. */}
      <ellipse cx={dot.x} cy={dot.y + 22} rx={90} ry={22} fill="#141A48" />
      <Glow cx={dot.x} cy={dot.y} r={70 + idle(frame, 1, 2.6, 6)} color={PITCH.light} intensity={1.4} rings={5} />
      <circle cx={dot.x} cy={dot.y} r={7} fill={PITCH.lightSoft} />
    </g>
  );
};

/** The end card: chalk letters that appear one by one, an orange underline, then a fade. */
export const EndCard: React.FC<{ lines: string[]; at: number; until: number; y?: number; size?: number; stagger?: number }> = ({ lines, at, until, y = HEIGHT / 2, size = 112, stagger = 1.2 }) => {
  const frame = useCurrentFrame();
  const o = 1 - progress(frame, until, 12, EASE.exit);
  if (frame < at || o <= 0.001) return null;
  let n = 0;
  const wob = idle(frame, 1, 6, 2);
  const total = lines.reduce((a, l) => a + l.length, 0);
  const line = progress(frame, at + total * stagger + 4, 16, EASE.standard);
  const w = Math.max(...lines.map((l) => l.length)) * size * 0.6;
  return (
    <g opacity={o}>
      {lines.map((text, li) => {
        const ly = y + (li - (lines.length - 1) / 2) * size * 1.2 + wob;
        return (
          <text key={li} x={WIDTH / 2} y={ly + size * 0.36} fill={CH} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle" letterSpacing={4}>
            {text.split("").map((ch, ci) => {
              const k = n++;
              const a = clamp01((frame - (at + k * stagger)) / 5);
              return (
                <tspan key={ci} opacity={a}>
                  {ch}
                </tspan>
              );
            })}
          </text>
        );
      })}
      <rect x={WIDTH / 2 - (w / 2) * line} y={y + lines.length * size * 0.62 + 10} width={w * line} height={size * 0.09} rx={size * 0.045} fill={PITCH.accent} />
    </g>
  );
};
