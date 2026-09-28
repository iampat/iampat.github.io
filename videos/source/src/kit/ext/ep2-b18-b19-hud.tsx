// HUD pieces for the episode 2 scenes b18 (steal-time teaser) and b19 (the first pass again):
// the chalk "STEAL TIME ?" card that rubs itself out, the pink FAKE bar, the two stolen footprints
// and the hand (in Tavi's colours) that snatches them, the ring readout pill, the distance tag, the
// look line and look timer, the lime eye lock, the polaroid photo of Chalk, the thought map and the
// side-on plan inset.
// Everything is screen space unless noted. Floodlit Pitch palette.

import React from "react";
import { useCurrentFrame } from "remotion";
import { CAST, FONTS, PITCH, XRAY } from "../../theme";
import { EASE, clamp01, idle, lerp, pop, popSoft, progress } from "../../lib/anim";
import type { View } from "../../lib/project";
import { Keeper, KPOSES, type KeeperPose } from "../Keeper";
import { Glow } from "../World";
import { TopField } from "../Field";
import { TopPlayer } from "../TopPlayer";
import { bubbleColor } from "../TimeBubble";
import { easeT, popT, trim } from "../ep2/chalk";
import { CHALK_START, chalkAt, endingMeet, passInAt, ringSeconds, SAM } from "../../physics/ep2sims";

// ---------- Slow-motion time map ----------

export type TimeKey = [frame: number, t: number];

/** Piecewise-linear sim time for a scene frame. Before the first key: its t. After the last: the last speed goes on. */
export const simTime = (frame: number, keys: TimeKey[]) => {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f0, t0] = keys[i - 1];
    const [f1, t1] = keys[i];
    if (frame <= f1) return t0 + ((frame - f0) / (f1 - f0)) * (t1 - t0);
  }
  const [fa, ta] = keys[keys.length - 2];
  const [fb, tb] = keys[keys.length - 1];
  return tb + ((frame - fb) / (fb - fa)) * (tb - ta);
};

/** Scene frame where the time map reaches sim time t. */
export const frameOf = (t: number, keys: TimeKey[]) => {
  for (let i = 1; i < keys.length; i++) {
    const [f0, t0] = keys[i - 1];
    const [f1, t1] = keys[i];
    if (t <= t1) return f0 + ((t - t0) / (t1 - t0)) * (f1 - f0);
  }
  const [fa, ta] = keys[keys.length - 2];
  const [fb, tb] = keys[keys.length - 1];
  return fb + ((t - tb) / (tb - ta)) * (fb - fa);
};

// ---------- b18: the chalk card ----------

const CARD_W = 600;
const CARD_H = 112;

/** "STEAL TIME" on a chalk pill with an orange "?" badge. `rubAt` wipes the words and shrinks the card to the badge. */
export const StealCard: React.FC<{ x: number; y: number; at: number; wordsAt: number; markAt: number; rubAt?: number }> = ({ x, y, at, wordsAt, markAt, rubAt }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at);
  if (s <= 0.001) return null;
  const word = "STEAL TIME";
  const write = progress(frame, wordsAt, 20, EASE.soft);
  const shown = word.slice(0, Math.ceil(word.length * write));
  const mark = pop(frame, markAt, { stiffness: 260, damping: 15 });
  const rub = rubAt === undefined ? 0 : progress(frame, rubAt, 24, EASE.standard);
  const shrink = rubAt === undefined ? 0 : progress(frame, rubAt + 14, 18, EASE.standard);
  const w = CARD_W - (CARD_W - CARD_H) * shrink;
  const badgeX = CARD_W - CARD_H / 2;
  const rubX = 24 + (CARD_W - CARD_H - 30) * rub;
  const erasing = rub > 0.02 && rub < 0.98;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={CARD_W - w} y={-CARD_H / 2} width={w} height={CARD_H} rx={CARD_H / 2} fill={PITCH.chalk} />
      <defs>
        <clipPath id="b18-steal-clip">
          <rect x={rubX} y={-CARD_H} width={CARD_W} height={CARD_H * 2} />
        </clipPath>
      </defs>
      <g clipPath="url(#b18-steal-clip)">
        <text x={42} y={19} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={54} letterSpacing={4}>
          {shown}
        </text>
      </g>
      {erasing ? (
        <g>
          <rect x={rubX - 34} y={-40} width={44} height={80} rx={14} fill={PITCH.stands} opacity={0.9} transform={`rotate(-12 ${rubX - 12} 0)`} />
          {[0, 1, 2, 3].map((k) => (
            <circle key={k} cx={rubX - 50 - k * 22 + idle(frame, k, 0.6, 4)} cy={-30 + k * 18 + idle(frame, k + 4, 0.5, 5)} r={5 - k} fill={PITCH.stands} opacity={0.35} />
          ))}
        </g>
      ) : null}
      <g transform={`translate(${badgeX} 0) scale(${mark})`}>
        <circle r={CARD_H * 0.4} fill={PITCH.accent} />
        <text y={22} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={62} textAnchor="middle">
          ?
        </text>
      </g>
    </g>
  );
};

// ---------- b18: the FAKE bar ----------

/** One pink bar over the defender's head: how long the fake held him. Fills to `seconds` on a `maxSeconds` track. */
export const FakeBar: React.FC<{ x: number; y: number; at: number; fillAt: number; fillFrames: number; until?: number; seconds?: number; maxSeconds?: number }> = ({
  x,
  y,
  at,
  fillAt,
  fillFrames,
  until,
  seconds = 0.5,
  maxSeconds = 1,
}) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const v = seconds * progress(frame, fillAt, fillFrames, EASE.soft);
  const W = 440;
  const H = 124;
  const c = CAST.mistake;
  const x0 = -W / 2 + 30;
  const trackW = W - 60;
  const ty = H / 2 - 46;
  const glow = frame >= fillAt + fillFrames - 4 ? 0.6 + 0.4 * Math.sin(frame / 3) : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={30} fill={PITCH.sky} opacity={0.9} />
      <text x={x0} y={-H / 2 + 48} fill={c} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={4}>
        FAKE
      </text>
      <text x={W / 2 - 30} y={-H / 2 + 50} fill={c} fontFamily={FONTS.mono} fontWeight={500} fontSize={42} textAnchor="end">
        {v.toFixed(1)} s
      </text>
      <rect x={x0} y={ty} width={trackW} height={22} rx={11} fill={PITCH.chalk} opacity={0.2} />
      {v > 0.005 ? <rect x={x0} y={ty} width={Math.max(22, trackW * (v / maxSeconds))} height={22} rx={11} fill={c} /> : null}
      {glow > 0 ? <circle cx={x0 + trackW * (seconds / maxSeconds)} cy={ty + 11} r={16} fill={c} opacity={0.3 * glow} /> : null}
      <line x1={x0 + trackW * (seconds / maxSeconds)} y1={ty - 6} x2={x0 + trackW * (seconds / maxSeconds)} y2={ty + 28} stroke={PITCH.chalk} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
    </g>
  );
};

// ---------- b18: two chalk footprints and the hand that snatches them (screen space) ----------

/** One chalk footprint on the grass: `s` px per metre, `squash` flattens it onto the ground, `toward` = toe direction. */
const Footprint: React.FC<{ x: number; y: number; s: number; squash: number; toward: 1 | -1; k: number }> = ({ x, y, s, squash, toward, k }) => {
  if (k <= 0.001) return null;
  const len = s * 0.3;
  return (
    <g transform={`translate(${x} ${y}) scale(${k}) scale(${toward} ${squash})`} fill={PITCH.chalk} opacity={0.92}>
      <ellipse cx={len * 0.3} cy={0} rx={len} ry={len * 0.5} />
      <circle cx={-len * 0.9} cy={0} r={len * 0.45} />
      {[0.55, 1.0, 1.45].map((q, i) => (
        <circle key={i} cx={len * (1.15 + 0.1 * (i === 1 ? 1 : 0))} cy={(q - 1) * len * 0.55} r={len * 0.16} />
      ))}
    </g>
  );
};

/**
 * Two footprints on the grass (screen points with their px-per-metre scale) pop in, then a hand in
 * Tavi's colours (skin, teal sleeve, orange band) reaches in from `from` (her side), grabs them and
 * pulls them away, so the stolen steps are clearly hers.
 */
export const StolenSteps: React.FC<{
  prints: { x: number; y: number; s: number }[];
  squash: number;
  toward: 1 | -1;
  at: number;
  snatchAt: number;
  from: { x: number; y: number };
}> = ({ prints, squash, toward, at, snatchAt, from }) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > snatchAt + 30) return null;
  const drop = progress(frame, snatchAt, 9, EASE.enter);
  const lift = progress(frame, snatchAt + 9, 14, EASE.exit);
  const hx = prints.reduce((a, p) => a + p.x, 0) / prints.length;
  const hy = prints.reduce((a, p) => a + p.y, 0) / prints.length;
  const s = prints.reduce((a, p) => a + p.s, 0) / prints.length;
  const k = drop * (1 - lift);
  const hand = { x: lerp(from.x, hx, k), y: lerp(from.y, hy, k) };
  const grab = clamp01(drop * 2 - 1);
  const palm = s * 0.34;
  const ang = (Math.atan2(hy - from.y, hx - from.x) * 180) / Math.PI;
  const dx = hand.x - from.x;
  const dy = hand.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const wrist = { x: hand.x - (dx / d) * palm * 0.5, y: hand.y - (dy / d) * palm * 0.5 };
  const band = { x: hand.x - (dx / d) * palm * 1.0, y: hand.y - (dy / d) * palm * 1.0 };
  return (
    <g>
      {prints.map((p, i) => {
        const pk = pop(frame, at + i * 9, { stiffness: 220, damping: 15 });
        return (
          <g key={i} transform={`translate(${lerp(p.x, hand.x, lift)} ${lerp(p.y, hand.y, lift)}) scale(${1 - lift}) translate(${-p.x} ${-p.y})`}>
            <Footprint x={p.x} y={p.y} s={p.s} squash={squash} toward={toward} k={pk} />
          </g>
        );
      })}
      {drop > 0.01 ? (
        <g opacity={1 - clamp01((lift - 0.75) / 0.25)}>
          {/* Her arm: skin, then the teal sleeve with its orange band, in from her side. */}
          <line x1={from.x} y1={from.y} x2={wrist.x} y2={wrist.y} stroke={CAST.skin} strokeWidth={palm * 0.5} strokeLinecap="round" />
          <line x1={from.x} y1={from.y} x2={band.x} y2={band.y} stroke={CAST.shirt} strokeWidth={palm * 0.7} strokeLinecap="round" />
          <circle cx={band.x} cy={band.y} r={palm * 0.36} fill={CAST.band} />
          <g transform={`translate(${hand.x} ${hand.y}) rotate(${ang})`}>
            {/* Palm along the reach, fingers curling shut as it grabs. */}
            <rect x={-palm * 0.3} y={-palm * 0.7} width={palm * 1.5} height={palm * 1.4} rx={palm * 0.55} fill={CAST.skin} />
            <rect x={palm * 0.55} y={-palm * 0.45 + grab * palm * 0.2} width={palm * 0.55} height={palm * 0.9 - grab * palm * 0.4} rx={palm * 0.27} fill={CAST.skinShade} />
            <ellipse cx={palm * 0.2} cy={-palm * 0.75 + grab * palm * 0.35} rx={palm * 0.5} ry={palm * 0.26} fill={CAST.skin} transform={`rotate(${-35 + grab * 30} ${palm * 0.2} ${-palm * 0.75})`} />
          </g>
          {lift > 0.05 && lift < 0.9
            ? [0, 1, 2].map((m) => (
                <circle key={m} cx={hand.x + (m - 1) * palm * 0.8} cy={hand.y - palm * 0.9 - lift * s * 0.6 - m * 5} r={4 + m} fill={PITCH.light} opacity={0.7 * (1 - lift)} />
              ))
            : null}
        </g>
      ) : null}
    </g>
  );
};

// ---------- Shared: the ring readout pill ----------

/** The time bubble's number in its own pill (for side views, where the ring sits under the feet). */
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

// ---------- b19: distance tag with a dotted leader ----------

export const DistanceTag: React.FC<{ x: number; y: number; metres: number; caption: string; at: number; until?: number; tx: number; ty: number }> = ({ x, y, metres, caption, at, until, tx, ty }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const lead = progress(frame, at + 4, 14, EASE.enter);
  const W = 320;
  const H = 104;
  const ex = x + (tx - x) * lead;
  const ey = y + (ty - y) * lead;
  const v = metres * progress(frame, at, 16, EASE.soft);
  return (
    <g opacity={Math.min(1, s)}>
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" opacity={0.85} />
      {lead > 0.95 ? <circle cx={tx} cy={ty} r={9} fill={PITCH.chalk} /> : null}
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={26} fill={PITCH.sky} opacity={0.9} />
        <text x={0} y={-4} fill={PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={44} textAnchor="middle">
          {v.toFixed(1)} m
        </text>
        <text x={0} y={36} fill={PITCH.light} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
          {caption}
        </text>
      </g>
    </g>
  );
};

// ---------- b19: the look line and the look timer ----------

/**
 * Where her eyes go during a scan: a short run of chalk dashes from her eyes towards the target, fading
 * out along the way. `k` 0..1 is how far the head is turned; `reach` is the share of the way it goes.
 */
export const LookLine: React.FC<{ x1: number; y1: number; x2: number; y2: number; k: number; reach?: number }> = ({ x1, y1, x2, y2, k, reach = 0.42 }) => {
  if (k <= 0.02) return null;
  const n = 7;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const len = L * reach * k;
  const step = len / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const a = i * step + 6;
        const b = a + step * 0.55;
        return <line key={i} x1={x1 + ux * a} y1={y1 + uy * a} x2={x1 + ux * b} y2={y1 + uy * b} stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" opacity={k * (0.95 - (0.75 * i) / n)} />;
      })}
    </g>
  );
};

/** A small timer for one scan: the ring fills as the look goes on, the readout counts the real seconds. */
export const LookTimer: React.FC<{ x: number; y: number; secs: number; total: number; at: number; until?: number }> = ({ x, y, secs, total, at, until }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const r = 20;
  const f = clamp01(secs / total);
  const a = f * Math.PI * 2;
  const arc = f >= 0.999 ? null : `M0,${-r} A${r},${r} 0 ${a > Math.PI ? 1 : 0} 1 ${Math.sin(a) * r},${-Math.cos(a) * r}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-34} y={-32} width={268} height={64} rx={32} fill={PITCH.sky} opacity={0.9} />
      <g transform="translate(0 0)">
        <circle r={r} fill="none" stroke={PITCH.chalk} strokeWidth={6} opacity={0.25} />
        {f >= 0.999 ? <circle r={r} fill="none" stroke={PITCH.chalk} strokeWidth={6} /> : f > 0.005 ? <path d={arc ?? ""} fill="none" stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" /> : null}
      </g>
      <text x={34} y={11} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={1}>
        look
      </text>
      <text x={216} y={11} fill={PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={32} textAnchor="end">
        {secs.toFixed(1)} s
      </text>
    </g>
  );
};

// ---------- b19: lime eye lock ----------

/** A small lime eye that locks on the ball: an eye icon, a dotted line and a dashed ring round the ball. */
export const EyeLock: React.FC<{ x: number; y: number; bx: number; by: number; br: number; at: number; until?: number }> = ({ x, y, bx, by, br, at, until }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 240, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const lead = progress(frame, at + 3, 10, EASE.enter);
  const ring = progress(frame, at + 8, 8, EASE.enter);
  const ex = x + (bx - x) * lead;
  const ey = y + (by - y) * lead;
  const spin = frame * 2;
  return (
    <g opacity={Math.min(1, s)}>
      <line x1={x} y1={y + 26} x2={ex} y2={ey} stroke={XRAY.lime} strokeWidth={4} strokeDasharray="3 10" strokeLinecap="round" opacity={0.8} />
      {ring > 0.01 ? (
        <circle cx={bx} cy={by} r={(br + 12) * ring} fill="none" stroke={XRAY.lime} strokeWidth={4} strokeDasharray="10 8" transform={`rotate(${spin} ${bx} ${by})`} opacity={0.9} />
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

// ---------- b19: the polaroid photo of Chalk ----------

/** What she sees over her shoulder: Chalk, small, jogging in under the lamps. Draws in a w x h photo box. */
export const ChalkPhoto: React.FC<{ w: number; h: number; phase: number; closeness?: number }> = ({ w, h, phase, closeness = 0 }) => {
  const k = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const a = KPOSES.runA;
  const b = KPOSES.runB;
  const pose: KeeperPose = {
    left: lerp(a.left, b.left, k),
    right: lerp(a.right, b.right, k),
    lean: lerp(a.lean, b.lean, k),
    shift: 0,
    lift: lerp(a.lift, b.lift, k),
    stretch: lerp(a.stretch, b.stretch, k),
  };
  const horizon = h * 0.44;
  const hh = h * (0.46 + 0.14 * closeness);
  return (
    <g>
      <rect width={w} height={h} fill={PITCH.sky} />
      <rect y={horizon} width={w} height={h - horizon} fill={PITCH.grassDark} />
      {[0.1, 0.45, 0.8].map((t, i) => (
        <path key={i} d={`M${w * t},${horizon} L${w * (t + 0.12)},${horizon} L${w * (t + 0.3)},${h} L${w * (t - 0.1)},${h} Z`} fill={PITCH.grass} />
      ))}
      <rect y={horizon - 4} width={w} height={6} fill={PITCH.grassLight} opacity={0.8} />
      <rect y={horizon - 40} width={w} height={40} fill={PITCH.stands} />
      <Glow cx={w * 0.82} cy={h * 0.1} r={h * 0.55} color={PITCH.lightSoft} intensity={0.9} rings={3} />
      <rect x={w * 0.78} y={h * 0.04} width={w * 0.08} height={h * 0.07} rx={6} fill={PITCH.lightSoft} />
      <Keeper x={w * 0.54} groundY={h * 0.9} h={hh} pose={pose} face="flat" flip look={0.7} />
    </g>
  );
};

// ---------- b19: the map in her head (thought bubble content) ----------

type P2 = { x: number; y: number };

/**
 * The map in her head after two looks (pitch metres, +y up the map): Sam, the ball on its way, her
 * token side-on, Chalk's token with his arrow (pops at `dotAt`) and the lime space on the open side
 * with its label (pops at `spaceAt`). Tokens are 50 px.
 */
export const ThoughtMap: React.FC<{ w: number; h: number; dotAt: number; spaceAt: number; tavi: P2; chalk: P2; ball: P2; space: P2 }> = ({ w, h, dotAt, spaceAt, tavi, chalk, ball, space }) => {
  const frame = useCurrentFrame();
  const dot = pop(frame, dotAt, { stiffness: 220, damping: 15 });
  const sp = pop(frame, spaceAt, { stiffness: 160, damping: 15 });
  const ppm = 17.5;
  const cx = (SAM.x + chalk.x) / 2;
  const sx = (m: number) => w / 2 + (m - cx) * ppm;
  const sy = (m: number) => h * 0.64 - m * ppm;
  const cTo = { x: tavi.x - chalk.x, y: tavi.y - chalk.y };
  const cL = Math.hypot(cTo.x, cTo.y) || 1;
  return (
    <g>
      <defs>
        <clipPath id="b19-thought-clip">
          <rect width={w} height={h} rx={16} />
        </clipPath>
      </defs>
      <g clipPath="url(#b19-thought-clip)">
        <rect width={w} height={h} fill={PITCH.grassDark} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={w * (0.06 + i * 0.25)} width={w * 0.125} height={h} fill={PITCH.grass} />
        ))}
        {/* The lime space on the open side, with its word. */}
        {sp > 0.001 ? (
          <g transform={`translate(${sx(space.x)} ${sy(space.y)}) scale(${sp})`}>
            <rect x={-78} y={-34} width={156} height={68} rx={34} fill={XRAY.lime} />
            <text y={11} fill={PITCH.sky} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle">
              space
            </text>
          </g>
        ) : null}
        {/* The pass: dashed from Sam to the ball. */}
        <line x1={sx(SAM.x) + 24} y1={sy(0)} x2={sx(ball.x)} y2={sy(0)} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="3 10" strokeLinecap="round" opacity={0.7} />
        <TopPlayer x={sx(SAM.x)} y={sy(0)} kind="sam" facing={0} size={50} />
        <circle cx={sx(ball.x)} cy={sy(ball.y)} r={10} fill={CAST.ball} />
        <TopPlayer x={sx(tavi.x)} y={sy(tavi.y)} kind="tavi" facing={270} size={50} />
        {dot > 0.001 ? (
          <g transform={`translate(${sx(chalk.x)} ${sy(chalk.y)}) scale(${dot})`}>
            <line x1={(cTo.x / cL) * 30} y1={(-cTo.y / cL) * 30} x2={(cTo.x / cL) * 62} y2={(-cTo.y / cL) * 62} stroke={PITCH.chalk} strokeWidth={5} strokeLinecap="round" />
            <path d="M0,-9 L14,0 L0,9 Z" fill={PITCH.chalk} transform={`translate(${(cTo.x / cL) * 66} ${(-cTo.y / cL) * 66}) rotate(${(Math.atan2(-cTo.y, cTo.x) * 180) / Math.PI})`} />
            <TopPlayer x={0} y={0} kind="chalk" facing={180} size={50} />
          </g>
        ) : null}
      </g>
    </g>
  );
};

// ---------- b19: the side-on plan inset ----------

const MEET = endingMeet();

/**
 * A map card that shows the run to the ball and the half-turn: the token leaves the mark, jogs to the
 * meeting point from ENDING_RUN and opens side-on in the last strides, so the eyes cover Sam and the goal.
 * `progress` 0..1 drives it; positions come from the sims for the matching time.
 */
export const PlanInset: React.FC<{ x: number; y: number; w: number; h: number; at: number; until: number; progress: number }> = ({ x, y, w, h, at, until, progress: p0 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 150, damping: 15 }) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const p = clamp01(p0);
  const ppm = 18.5;
  const X0 = -w / 2 + 14 * ppm; // screen x (card-local) of pitch x = 0 (Tavi's mark)
  const view: View = { kind: "top", originX: X0 - 87 * ppm, originY: 0, ppm };
  const sx = (m: number) => X0 + m * ppm;
  const sy = (m: number) => -m * ppm;
  // Sim time for the run: 0.2 s (leaving) to the touch, over p 0.15..0.75. Then a hold.
  const t = lerp(0.2, MEET.t, easeT(clamp01((p - 0.15) / 0.6)));
  const run = clamp01((t - 0.2) / (MEET.t - 0.2));
  const tavi = { x: -(t - 0.2) * 3.5, y: -0.3 * clamp01((t - 0.2) / 0.5) };
  const chalk = chalkAt(t, { x: MEET.x, y: MEET.y, z: 0 });
  const ball = passInAt(t);
  // Facing: 180 (to the ball, screen left) -> 270 (chest up the map, side-on) in the last strides.
  const turn = easeT(clamp01((t - 0.92) / (MEET.t - 0.92)));
  const facing = 180 + 90 * turn;
  const secs = ringSeconds(chalk.x, chalk.y, tavi.x, tavi.y);
  const arrow = clamp01((p - 0.62) / 0.16);
  const label = popT(clamp01((p - 0.8) / 0.12));
  const tx = sx(tavi.x);
  const ty = sy(tavi.y);
  const arcR = 62;
  const arcPath = `M${tx - arcR},${ty} A${arcR},${arcR} 0 0 1 ${tx},${ty - arcR}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <defs>
        <clipPath id="b19-plan-clip">
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={26} />
        </clipPath>
      </defs>
      <rect x={-w / 2 - 8} y={-h / 2 - 8} width={w + 16} height={h + 16} rx={32} fill={PITCH.sky} opacity={0.9} />
      <g clipPath="url(#b19-plan-clip)">
        <TopField view={view} x0={70} x1={110} y0={-14} y1={14} lineOpacity={0.5} />
        {/* The half of the pitch behind her chest is dark. */}
        <g transform={`translate(${tx} ${ty}) rotate(${facing})`}>
          <rect x={-2400} y={-1200} width={2400} height={2400} fill={PITCH.skyHigh} opacity={0.45} />
        </g>
        {/* Goal on the right. */}
        <rect x={sx(18)} y={sy(3.66)} width={ppm * 1.2} height={ppm * 7.32} rx={4} fill={PITCH.chalk} opacity={0.9} />
        {/* Chalk mark and the dotted trail from it. */}
        <circle cx={sx(0)} cy={sy(0)} r={6} fill={PITCH.chalk} opacity={0.8} />
        {run > 0.01 ? <line x1={sx(0)} y1={sy(0)} x2={tx} y2={ty} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="3 10" strokeLinecap="round" opacity={0.7} /> : null}
        {/* Ring round her token, honest to the sims. */}
        <circle cx={tx} cy={ty} r={secs * 24} fill={XRAY.lime} opacity={0.12} />
        <circle cx={tx} cy={ty} r={secs * 24} fill="none" stroke={bubbleColor(secs)} strokeWidth={4} opacity={0.85} />
        <TopPlayer x={sx(SAM.x)} y={sy(SAM.y)} kind="sam" facing={0} size={56} />
        <TopPlayer x={sx(chalk.x)} y={sy(chalk.y)} kind="chalk" facing={180} size={56} stride={t * 3} />
        <circle cx={sx(ball.x)} cy={sy(ball.y)} r={10} fill={CAST.ball} />
        <TopPlayer x={tx} y={ty} kind="tavi" facing={facing} size={56} stride={run > 0 && run < 1 ? t * 3 : undefined} cone={{ angleDeg: 200, radius: 250, color: turn > 0.5 ? XRAY.lime : PITCH.lightSoft, opacity: 0.24 }} />
        {/* The quarter turn: a chalk arc round the token. */}
        {arrow > 0.01 ? (
          <g>
            <path d={arcPath} fill="none" stroke={PITCH.chalk} strokeWidth={5} strokeLinecap="round" {...trim(arrow)} />
            {arrow > 0.95 ? <path d={`M${tx - 12},${ty - arcR - 10} L${tx + 12},${ty - arcR} L${tx - 12},${ty - arcR + 10} Z`} fill={PITCH.chalk} /> : null}
          </g>
        ) : null}
      </g>
      <g transform={`translate(${-w / 2 + 26} ${-h / 2 + 26}) scale(${label})`}>
        <rect width={190} height={54} rx={27} fill={XRAY.lime} />
        <text x={95} y={38} fill={PITCH.sky} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
          SIDE-ON
        </text>
      </g>
      <g transform={`translate(${-w / 2 + 26} ${-h / 2 + 26}) scale(${popT(clamp01((p - 0.02) / 0.1)) * (1 - label)})`}>
        <rect width={250} height={54} rx={27} fill={PITCH.chalk} />
        <text x={125} y={38} fill={PITCH.sky} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
          TO THE BALL
        </text>
      </g>
    </g>
  );
};

export { CHALK_START };

// ---------- b19 -> b20 handoff ----------

/**
 * Where b19 leaves the ending run (the storyboard cuts straight into b20): the side-view world
 * (50 px per metre, ground at y = 820, Tavi's mark at world x = 960), the camera on the last frame
 * (x in metres from her mark, y above the ground line), the sim time reached and the ring settings.
 */
export const B19_HANDOFF = {
  ppm: 50,
  groundY: 820,
  markX: 960,
  camera: { xMetres: -2.8, yAboveGround: 114, zoom: 1.85 },
  simTimeAtEnd: 1.24,
  ring: { pxPerSecond: 40, minRadius: 20, squash: 0.3 },
  slowMotion: true,
} as const;
