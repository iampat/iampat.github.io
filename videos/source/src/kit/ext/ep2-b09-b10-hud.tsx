// On-screen pieces for b09 and b10: the next-second map inset, the rock-and-pillow drop inset, ghost balls,
// flat speed arrows, a word card that wraps a long meaning, the chalk eye that blinks, the blink-versus-contact
// bars, a linear seconds ticker and impact flicks. All flat shapes, no filters.

import React from "react";
import { random, useCurrentFrame } from "remotion";
import { CAST, FONTS, PITCH, WIDTH, XRAY } from "../../theme";
import { EASE, clamp01, pop, popSoft, progress, visible } from "../../lib/anim";
import { simulate, type BallState } from "../../physics/sim";
import { rollAt } from "../../physics/touch";
import { TOUCHES } from "../../physics/ep2sims";
import { TopField } from "../Field";
import { TopPlayer } from "../TopPlayer";
import { Ball } from "../Ball";
import { Glow } from "../World";
import type { View } from "../../lib/project";
import { popT } from "../ep2/chalk";

/** Opaque HUD panel colour (no floodlight shows through). */
export const PANEL_BG = "#0A2C38";

// ---------- Small shapes ----------

/** A dashed ghost ball outline. */
export const GhostBall: React.FC<{ x: number; y: number; r: number; color?: string; opacity?: number; width?: number; spin?: number }> = ({ x, y, r, color = PITCH.chalk, opacity = 0.7, width = 3, spin = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${spin})`} opacity={opacity}>
    <circle r={r} fill={color} opacity={0.12} />
    <circle r={r} fill="none" stroke={color} strokeWidth={width} strokeDasharray={`${r * 0.7} ${r * 0.45}`} strokeLinecap="round" />
  </g>
);

/** A flat arrow: rounded bar with a triangle head, from (x, y) along `angle` degrees (0 = right). */
export const SpeedArrow: React.FC<{ x: number; y: number; len: number; color: string; width?: number; angle?: number; opacity?: number }> = ({ x, y, len, color, width = 16, angle = 0, opacity = 1 }) => {
  if (len < 0.5) return null;
  const head = width * 1.6;
  if (len < head) {
    return <circle cx={x} cy={y} r={width * 0.55} fill={color} opacity={opacity} transform={`rotate(${angle} ${x} ${y})`} />;
  }
  const bodyEnd = len - head * 0.7;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      <rect x={0} y={-width / 2} width={Math.max(width, bodyEnd)} height={width} rx={width / 2} fill={color} />
      <path d={`M${bodyEnd - width * 0.2},${-head * 0.62} L${len},0 L${bodyEnd - width * 0.2},${head * 0.62} Z`} fill={color} stroke={color} strokeWidth={width * 0.3} strokeLinejoin="round" />
    </g>
  );
};

/** Chalk impact flicks around a contact point (fade over 14 frames). */
export const ImpactFlicks: React.FC<{ x: number; y: number; at: number; r?: number; color?: string }> = ({ x, y, at, r = 60, color = PITCH.lightSoft }) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / 14;
  if (t < 0 || t > 1) return null;
  const angs = [-58, -90, -122, 58, 90, 122];
  return (
    <g transform={`translate(${x} ${y})`} opacity={1 - t}>
      <Glow cx={0} cy={0} r={r * 1.6} color={color} intensity={1.4 * (1 - t)} rings={3} />
      {angs.map((a, i) => {
        const th = (a * Math.PI) / 180;
        const r0 = r * (0.5 + 0.5 * t);
        const r1 = r0 + r * 0.5 * (1 - t * 0.5);
        return <line key={i} x1={Math.cos(th) * r0} y1={Math.sin(th) * r0} x2={Math.cos(th) * r1} y2={Math.sin(th) * r1} stroke={color} strokeWidth={7} strokeLinecap="round" />;
      })}
    </g>
  );
};

/** A rounded HUD panel that pops in around its centre and shrinks out. */
export const Panel: React.FC<{ x: number; y: number; w: number; h: number; at: number; until?: number; fill?: string; opacity?: number; children: React.ReactNode }> = ({ x, y, w, h, at, until, fill = PANEL_BG, opacity = 1, children }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 170, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x + w / 2} ${y + h / 2}) scale(${s}) translate(${-w / 2} ${-h / 2})`}>
      <rect width={w} height={h} rx={36} fill={fill} opacity={opacity} />
      {children}
    </g>
  );
};

/** Mono seconds that count in real time (no easing): "0.0 s" to "1.0 s" over `frames`. */
export const SecondTicker: React.FC<{ x: number; y: number; at: number; frames?: number; until?: number; caption?: string; size?: number; color?: string }> = ({ x, y, at, frames = 30, until, caption = "YOUR NEXT SECOND", size = 60, color = PITCH.light }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at - 8, until);
  if (o <= 0.001) return null;
  const v = clamp01((frame - at) / frames);
  return (
    <g opacity={o} transform={`translate(${x} ${y})`}>
      <text y={-size * 0.8} fill={PITCH.chalk} opacity={0.75} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
        {caption}
      </text>
      <text fill={color} fontFamily={FONTS.mono} fontWeight={500} fontSize={size} textAnchor="middle">
        {v.toFixed(1)}
        <tspan fontSize={size * 0.5} fontFamily={FONTS.hud} fontWeight={700}>
          {" s"}
        </tspan>
      </text>
    </g>
  );
};

// ---------- b09: the next-second map inset ----------

const STIFF_V = TOUCHES.TOUCH_STIFF();
const AWAY_V = TOUCHES.TOUCH_AWAY();
const AWAY_SPEED = Math.hypot(AWAY_V.x, AWAY_V.y);
const AWAY_DIR = { x: AWAY_V.x / AWAY_SPEED, y: AWAY_V.y / AWAY_SPEED };
const STIFF_SPEED = Math.abs(STIFF_V.x);
/** The second touch of the touch-away comes at 0.8 s (storyboard sim TOUCH_AWAY). */
const AWAY_SECOND_TOUCH = 0.8;

/** Grey for the "stuck" option in the next-second inset. */
const STUCK_GREY = "#9AA0B8";

/** A pink cross over a ghost ball: "this option is bad". */
const PinkCross: React.FC<{ x: number; y: number; r: number; opacity?: number }> = ({ x, y, r, opacity = 1 }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity} stroke={CAST.mistake} strokeWidth={r * 0.34} strokeLinecap="round">
    <line x1={-r * 0.95} y1={-r * 0.95} x2={r * 0.95} y2={r * 0.95} />
    <line x1={-r * 0.95} y1={r * 0.95} x2={r * 0.95} y2={-r * 0.95} />
  </g>
);

/** A grey pause badge: "stuck". */
const StuckBadge: React.FC<{ x: number; y: number; r: number; opacity?: number }> = ({ x, y, r, opacity = 1 }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <circle r={r} fill={STUCK_GREY} />
    <rect x={-r * 0.42} y={-r * 0.45} width={r * 0.28} height={r * 0.9} rx={r * 0.12} fill={PITCH.sky} />
    <rect x={r * 0.14} y={-r * 0.45} width={r * 0.28} height={r * 0.9} rx={r * 0.12} fill={PITCH.sky} />
  </g>
);

/**
 * Top-down inset: the ball is at Tavi's foot and three solid ghost balls leave it for one second, on real time:
 * the stiff bounce back towards Sam (pink cross, "bounces off"), the dead stop under her (grey badge, "stuck")
 * and the touch away into space (lime, "into space"). `runAt` is the frame the second starts; the ghosts move
 * for 30 frames. The map is zoomed so Tavi's token is 96 px wide (more than the 44 px minimum).
 */
export const NextSecondInset: React.FC<{ x: number; y: number; w: number; h: number; at: number; runAt: number; until: number }> = ({ x, y, w, h, at, runAt, until }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 170, damping: 15 }) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const ppm = 150;
  const foot = { x: w * 0.68, y: h * 0.7 };
  const view: View = { kind: "top", originX: foot.x, originY: foot.y, ppm };
  const t = clamp01((frame - runAt) / 30);
  const tSec = t * 1.0;
  const ghostIn = (k: number) => popSoft(frame, at + 8 + k * 4);
  const labelIn = (k: number) => progress(frame, runAt + 12 + k * 5, 10, EASE.enter);
  const stiffD = rollAt(STIFF_SPEED, tSec).x;
  const awayD = rollAt(AWAY_SPEED, Math.min(tSec, AWAY_SECOND_TOUCH)).x;
  const stiffEnd = rollAt(STIFF_SPEED, 1).x;
  const awayEnd = rollAt(AWAY_SPEED, AWAY_SECOND_TOUCH).x;
  const stiff = { x: foot.x - stiffD * ppm, y: foot.y };
  const away = { x: foot.x + AWAY_DIR.x * awayD * ppm, y: foot.y - AWAY_DIR.y * awayD * ppm };
  const awayFinal = { x: foot.x + AWAY_DIR.x * awayEnd * ppm, y: foot.y - AWAY_DIR.y * awayEnd * ppm };
  const r = 24;
  const trail = (to: { x: number; y: number }, color: string, o: number, width = 5) => (
    <line x1={foot.x} y1={foot.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={width} strokeDasharray="3 13" strokeLinecap="round" opacity={o} />
  );
  const tag = (text: string, tx: number, ty: number, color: string, o: number, anchor: "middle" | "start" = "middle") =>
    o > 0.001 ? (
      <text x={tx} y={ty + (1 - o) * 10} opacity={o} fill={color} fontFamily={FONTS.label} fontWeight={800} fontSize={32} textAnchor={anchor}>
        {text}
      </text>
    ) : null;
  const idTag = `b09-next-${Math.round(x)}`;
  return (
    <g transform={`translate(${x + w / 2} ${y + h / 2}) scale(${s}) translate(${-w / 2} ${-h / 2})`}>
      <defs>
        <clipPath id={idTag}>
          <rect width={w} height={h} rx={36} />
        </clipPath>
      </defs>
      <rect width={w} height={h} rx={36} fill={PANEL_BG} />
      <g clipPath={`url(#${idTag})`}>
        <TopField view={view} x0={-8} x1={6} y0={-4} y1={5} lines={false} stripeM={2} />
        {/* Sam's side: a soft chalk line pointing back to where the pass came from. */}
        <text x={30} y={foot.y + 12} fill={PITCH.chalk} opacity={0.6} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={2}>
          SAM
        </text>
        <line x1={112} y1={foot.y} x2={stiff.x - r - 10} y2={foot.y} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="2 10" strokeLinecap="round" opacity={0.35} />
        <TopPlayer x={foot.x + 0.38 * ppm} y={foot.y} kind="tavi" facing={180} size={96} />
        {/* The dead stop: the ball stays under her foot. */}
        <Ball cx={foot.x} cy={foot.y} r={r} view={view} />
        <StuckBadge x={foot.x - r * 0.2} y={foot.y + r * 1.5} r={15} opacity={ghostIn(1)} />
        {/* The stiff bounce: back towards Sam. */}
        <g opacity={ghostIn(0)}>
          {trail(stiff, PITCH.chalk, 0.55, 4)}
          <Ball cx={stiff.x} cy={stiff.y} r={r} view={view} axis={{ x: 0, y: 1, z: 0 }} angle={-stiffD / 0.11} />
          <PinkCross x={stiff.x} y={stiff.y} r={r} opacity={labelIn(0)} />
        </g>
        {/* The touch away: into space (the only lime one). */}
        <g opacity={ghostIn(2)}>
          {trail(away, XRAY.lime, 0.85, 6)}
          <Glow cx={away.x} cy={away.y} r={r * 2.8} color={XRAY.lime} intensity={1} rings={3} />
          <Ball cx={away.x} cy={away.y} r={r} view={view} axis={{ x: AWAY_DIR.y, y: -AWAY_DIR.x, z: 0 }} angle={awayD / 0.11} />
          <circle cx={away.x} cy={away.y} r={r + 7} fill="none" stroke={XRAY.lime} strokeWidth={5} opacity={0.9} />
        </g>
        {tag("bounces off", foot.x - stiffEnd * ppm, foot.y + 64, CAST.mistake, labelIn(0))}
        {tag("stuck", foot.x + 4, foot.y + 92, STUCK_GREY, labelIn(1))}
        {tag("into space", awayFinal.x + r + 22, awayFinal.y + 11, XRAY.lime, labelIn(2), "start")}
      </g>
      <text x={30} y={48} fill={PITCH.chalk} opacity={0.85} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={3}>
        YOUR NEXT SECOND
      </text>
      <g transform={`translate(${w - 108} 52)`}>
        <rect x={-78} y={-34} width={156} height={62} rx={31} fill={PITCH.sky} opacity={0.9} />
        <text y={14} fill={PITCH.light} fontFamily={FONTS.mono} fontWeight={500} fontSize={40} textAnchor="middle">
          {tSec.toFixed(1)}
          <tspan fontSize={24} fontFamily={FONTS.hud} fontWeight={700}>
            {" s"}
          </tspan>
        </text>
      </g>
    </g>
  );
};

// ---------- b09: rock and pillow drop inset ----------

const DROP_M = 0.5;
const dropSim = (e: number): BallState[] => simulate({ speed: 0, elevationDeg: -90, start: { x: 0, y: 0, z: 0.11 + DROP_M }, restitution: e, friction: 0.5, duration: 2.2, ground: true }, 30);
const ROCK_DROP = dropSim(0.62);
const PILLOW_DROP = dropSim(0.3);
const firstBounce = (p: BallState[]) => Math.max(1, p.findIndex((s) => s.bounces > 0));
export const ROCK_LAND = firstBounce(ROCK_DROP);
export const PILLOW_LAND = firstBounce(PILLOW_DROP);

const SHAPE_K = 1.35;

const RockShape: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <g transform={`translate(${x} ${y}) scale(${SHAPE_K})`}>
    <path d="M-66,0 L-58,-28 L-30,-58 L18,-62 L52,-40 L66,-8 L60,0 Z" fill="none" stroke={color} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" opacity={0.95} />
    <path d="M-30,-58 L-14,-30 L30,-24" fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" opacity={0.5} />
  </g>
);

const PillowShape: React.FC<{ x: number; y: number; color: string; squash: number }> = ({ x, y, color, squash }) => (
  <g transform={`translate(${x} ${y}) scale(${SHAPE_K * (1 + squash * 0.12)} ${SHAPE_K * (1 - squash * 0.35)})`}>
    <path d="M-76,0 Q-84,-22 -76,-44 Q-40,-36 0,-40 Q40,-36 76,-44 Q84,-22 76,0 Q40,-8 0,-4 Q-40,-8 -76,0 Z" fill="none" stroke={color} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" opacity={0.95} />
    <path d="M-40,-22 Q-30,-14 -20,-22" fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" opacity={0.5} />
    <path d="M20,-22 Q30,-14 40,-22" fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" opacity={0.5} />
  </g>
);

/**
 * "The ball doesn't bounce off just because your boot's hard": a ball drops on a chalk rock and on a chalk pillow.
 * Both bounce (restitution 0.62 and 0.3 from the sim), the pillow clearly lower. `dim` fades the whole card.
 */
export const DropInset: React.FC<{ x: number; y: number; w: number; h: number; at: number; dropAt: number; captionAt: number; until: number; dim?: number }> = ({ x, y, w, h, at, dropAt, captionAt, until, dim = 0 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 170, damping: 15 }) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const ppm = 230;
  const floor = h - 44;
  const rockX = w * 0.28;
  const pillowX = w * 0.72;
  const rockTop = floor - 62 * SHAPE_K;
  const pillowTop = floor - 44 * SHAPE_K;
  const r = 0.11 * ppm;
  const f = Math.max(0, frame - dropAt);
  const zr = ROCK_DROP[Math.min(ROCK_DROP.length - 1, Math.floor(f))].pos.z;
  const zp = PILLOW_DROP[Math.min(PILLOW_DROP.length - 1, Math.floor(f))].pos.z;
  const ballView: View = { kind: "side", originX: 0, groundY: 0, ppm };
  const squash = frame >= dropAt + PILLOW_LAND && frame < dropAt + PILLOW_LAND + 10 ? Math.sin((Math.PI * (frame - dropAt - PILLOW_LAND)) / 10) : 0;
  const cap = popSoft(frame, captionAt);
  const chalk = PITCH.chalk;
  return (
    <g transform={`translate(${x + w / 2} ${y + h / 2}) scale(${s}) translate(${-w / 2} ${-h / 2})`}>
      {/* The panel stays opaque when the card dims, so no floodlight shows through; only the contents fade. */}
      <rect width={w} height={h} rx={36} fill={PANEL_BG} />
      <g opacity={1 - 0.55 * dim}>
      <line x1={40} y1={floor} x2={w - 40} y2={floor} stroke={chalk} strokeWidth={4} strokeLinecap="round" opacity={0.35} />
      <RockShape x={rockX} y={floor} color={chalk} />
      <PillowShape x={pillowX} y={floor} color={chalk} squash={squash} />
      {frame >= dropAt - 10 ? (
        <g>
          <Ball cx={rockX} cy={rockTop - (zr - 0.11) * ppm - r} r={r} view={ballView} />
          <Ball cx={pillowX} cy={pillowTop - (zp - 0.11) * ppm - r} r={r} view={ballView} />
        </g>
      ) : null}
      <text x={rockX} y={h - 8} fill={chalk} opacity={0.6} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={2}>
        HARD
      </text>
      <text x={pillowX} y={h - 8} fill={chalk} opacity={0.6} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={2}>
        SOFT
      </text>
      {cap > 0.001 ? (
        <g transform={`translate(${w / 2} 50) scale(${cap})`}>
          <rect x={-190} y={-30} width={380} height={56} rx={28} fill={chalk} />
          <text y={12} fill={PITCH.sky} fontFamily={FONTS.label} fontWeight={800} fontSize={34} textAnchor="middle">
            softer helps a bit
          </text>
        </g>
      ) : null}
      </g>
    </g>
  );
};

// ---------- Word card with a wrapped meaning ----------

/** Same look as the kit WordCard, but the meaning is given as lines, so a long meaning never runs off the frame. */
export const WordCardLines: React.FC<{ term: string; lines: string[]; at: number; until: number; x?: number; y?: number }> = ({ term, lines, at, until, x = WIDTH - 60, y = 90 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const w = Math.max(term.length * 36, ...lines.map((l) => l.length * 18.5), 260) + 90;
  const h = 196 + (lines.length - 1) * 42;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(${-w} 0)`}>
      <rect width={w} height={h} rx={28} fill={PITCH.chalk} />
      <rect x={24} y={22} width={210} height={42} rx={21} fill={PITCH.accent} />
      <text x={129} y={52} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={26} textAnchor="middle" letterSpacing={3}>
        NEW WORD
      </text>
      <text x={24} y={124} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={56}>
        {term}
      </text>
      {lines.map((l, i) => (
        <text key={i} x={24} y={172 + i * 42} fill={PITCH.stands} fontFamily={FONTS.label} fontWeight={700} fontSize={34}>
          {l}
        </text>
      ))}
    </g>
  );
};

// ---------- b10: the chalk eye and the blink bars ----------

/** A chalk eye that blinks once at `blinkAt` (lid down 4 frames, up 6). */
export const ChalkEye: React.FC<{ x: number; y: number; at: number; blinkAt: number; until?: number; size?: number; bg?: string }> = ({ x, y, at, blinkAt, until, size = 70, bg = XRAY.bg }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const d = frame - blinkAt;
  const lid = d < 0 ? 0 : d < 4 ? d / 4 : d < 10 ? 1 - (d - 4) / 6 : 0;
  const k = size / 70;
  const iris = 22 * k;
  const look = Math.sin(frame / 17) * 3 * k;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={`M${-70 * k},0 Q0,${-52 * k} ${70 * k},0 Q0,${52 * k} ${-70 * k},0 Z`} fill={PITCH.chalk} opacity={0.12} />
      <circle cx={look} cy={0} r={iris} fill="none" stroke={PITCH.chalk} strokeWidth={5 * k} />
      <circle cx={look} cy={0} r={iris * 0.45} fill={PITCH.chalk} />
      {/* The lid: the upper arc sinks to the lower arc as it closes. */}
      <path d={`M${-70 * k},0 Q0,${-52 * k} ${70 * k},0 Q0,${(-52 + 104 * lid) * k} ${-70 * k},0 Z`} fill={bg} opacity={lid > 0.01 ? 1 : 0} />
      <path d={`M${-70 * k},0 Q0,${-52 * k} ${70 * k},0 Q0,${52 * k} ${-70 * k},0 Z`} fill="none" stroke={PITCH.chalk} strokeWidth={6 * k} strokeLinejoin="round" />
      <path d={`M${-70 * k},0 Q0,${(-52 + 104 * lid) * k} ${70 * k},0`} fill="none" stroke={PITCH.chalk} strokeWidth={6 * k} strokeLinecap="round" opacity={lid > 0.01 ? 1 : 0} />
      {/* Lashes on the open lid. */}
      {[-42, 0, 42].map((lx) => {
        const ly = (-52 + (lx === 0 ? 0 : 9)) * k;
        return <line key={lx} x1={lx * k} y1={ly} x2={lx * k * 1.18} y2={ly - 15 * k} stroke={PITCH.chalk} strokeWidth={4 * k} strokeLinecap="round" opacity={0.7 * (1 - lid)} />;
      })}
    </g>
  );
};

/** Two bars on one scale: a blink (about 0.15 s) and the contact (0.01 s): the contact is a sliver. No digits. */
export const BlinkBars: React.FC<{ x: number; y: number; at: number; until?: number; width?: number; blinkS?: number; contactS?: number }> = ({ x, y, at, until, width = 420, blinkS = 0.15, contactS = 0.01 }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 12, 8);
  if (o <= 0.001) return null;
  const grow1 = progress(frame, at, 14, EASE.enter);
  const grow2 = progress(frame, at + 10, 12, EASE.enter);
  const row = (yy: number, label: string, frac: number, color: string, grow: number) => (
    <g transform={`translate(0 ${yy})`}>
      <text x={0} y={12} fill={color} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={3}>
        {label}
      </text>
      <rect x={170} y={-14} width={width} height={28} rx={14} fill={PITCH.chalk} opacity={0.12} />
      <rect x={170} y={-14} width={Math.max(10, width * frac * grow)} height={28} rx={Math.min(14, width * frac * grow * 0.5)} fill={color} />
    </g>
  );
  return (
    <g opacity={o} transform={`translate(${x} ${y})`}>
      {row(0, "BLINK", 1, PITCH.chalk, grow1)}
      {row(70, "CONTACT", contactS / blinkS, PITCH.accent, grow2)}
    </g>
  );
};

// ---------- b10: the contact stopwatch and the rewind tag (same look as the s02 ones, kept here so the
// touch chapter does not depend on an episode 1 ext file) ----------

/** Stopwatch whose full dial is one hundredth of a second: `value` in seconds, mono readout to three places. */
export const ContactStopwatch: React.FC<{ x: number; y: number; value: number; at: number; until?: number; scale?: number }> = ({ x, y, value, at, until, scale = 1 }) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const hand = (value / 0.01) * 360;
  const r = 58;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * scale})`}>
      <rect x={-r - 36} y={-r - 34} width={2 * r + 72 + 330} height={2 * r + 68} rx={r + 34} fill={PITCH.skyHigh} opacity={0.82} />
      <rect x={-12} y={-r - 22} width={24} height={16} rx={6} fill={PITCH.chalk} />
      <circle r={r + 7} fill={PITCH.chalk} />
      <circle r={r - 3} fill={PITCH.sky} />
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={0} y1={-r + 8} x2={0} y2={-r + 18} stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" opacity={0.6} transform={`rotate(${i * 36})`} />
      ))}
      <path d={`M0,0 L0,${-r + 6} A${r - 6},${r - 6} 0 ${hand % 360 > 180 ? 1 : 0} 1 ${Math.sin((hand * Math.PI) / 180) * (r - 6)},${-Math.cos((hand * Math.PI) / 180) * (r - 6)} Z`} fill={PITCH.accent} opacity={hand > 0.5 ? 0.35 : 0} />
      <line x1={0} y1={0} x2={0} y2={-r + 10} stroke={PITCH.accent} strokeWidth={7} strokeLinecap="round" transform={`rotate(${hand})`} />
      <circle r={8} fill={PITCH.accent} />
      <text x={r + 30} y={30} fill={PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={88}>
        {value.toFixed(3)}
        <tspan fontFamily={FONTS.hud} fontWeight={700} fontSize={48} dx={10}>
          s
        </tspan>
      </text>
    </g>
  );
};

/** Rewind tag: a pill with two pulsing triangles and the word REWIND, top left. */
export const RewindPill: React.FC<{ at: number; until: number }> = ({ at, until }) => {
  const frame = useCurrentFrame();
  const o = visible(frame, at, until, 8, 8);
  if (o <= 0.001) return null;
  const pulse = 0.55 + 0.45 * Math.sin(frame / 3);
  return (
    <g opacity={o} transform={`translate(70 ${70 + (1 - o) * -20})`}>
      <rect width={300} height={72} rx={36} fill={PITCH.skyHigh} opacity={0.8} />
      <g fill={PITCH.accent} opacity={pulse}>
        <path d="M58,20 L30,36 L58,52 Z" />
        <path d="M86,20 L58,36 L86,52 Z" />
      </g>
      <text x={104} y={49} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} letterSpacing={4}>
        REWIND
      </text>
    </g>
  );
};

/** Faint drifting motes for the x-ray air (screen space). */
export const Motes: React.FC<{ seed: string; opacity?: number; count?: number }> = ({ seed, opacity = 1, count = 26 }) => {
  const frame = useCurrentFrame();
  return (
    <g opacity={opacity}>
      {Array.from({ length: count }, (_, i) => {
        const x = random(`${seed}-x-${i}`) * WIDTH;
        const y0 = random(`${seed}-y-${i}`) * 1080;
        const y = ((y0 - frame * (0.15 + random(`${seed}-v-${i}`) * 0.25)) % 1080 + 1080) % 1080;
        const r = 1.5 + random(`${seed}-r-${i}`) * 2.5;
        const tw = 0.4 + 0.6 * Math.sin(frame / 20 + random(`${seed}-p-${i}`) * 6.28);
        return <circle key={i} cx={x + Math.sin(frame / 50 + i) * 8} cy={y} r={r} fill={XRAY.bone} opacity={0.25 * tw} />;
      })}
    </g>
  );
};

export const GAP_COLOR = CAST.mistake;

// ---------- Speed-gap pieces: the gap bar, a flat meter arrow and the IN / OUT meter ----------

/**
 * The GAP bracket between two arrow tips, drawn by the scene so it controls the colour (pink for a big gap,
 * amber once the foot gives). `ghostX0..ghostX1` draws a dashed outline: the empty bracket before the arrows
 * grow, or the old gap after it shrinks. The label sits under the ghost when there is one, else under the bar.
 */
export const GapBar: React.FC<{
  x0: number;
  x1: number;
  y: number;
  color: string;
  h?: number;
  label?: string;
  labelColor?: string;
  ghostX0?: number;
  ghostX1?: number;
  ghostColor?: string;
  ghostOpacity?: number;
  fontSize?: number;
  opacity?: number;
}> = ({ x0, x1, y, color, h = 30, label = "GAP", labelColor, ghostX0, ghostX1, ghostColor = PITCH.chalk, ghostOpacity = 0, fontSize = 32, opacity = 1 }) => {
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  const solid = b - a > 2;
  const hasGhost = ghostOpacity > 0.001 && ghostX0 !== undefined && ghostX1 !== undefined;
  const gA = hasGhost ? Math.min(ghostX0 as number, ghostX1 as number) : a;
  const gB = hasGhost ? Math.max(ghostX0 as number, ghostX1 as number) : b;
  const labelMid = solid ? (a + b) / 2 : (gA + gB) / 2;
  return (
    <g opacity={opacity}>
      {hasGhost ? (
        <g opacity={ghostOpacity} stroke={ghostColor} strokeWidth={4} strokeLinecap="round" fill="none">
          <line x1={gA} y1={y} x2={gB} y2={y} strokeDasharray="8 10" />
          <line x1={gA} y1={y - h * 0.5} x2={gA} y2={y + h * 0.5} />
          <line x1={gB} y1={y - h * 0.5} x2={gB} y2={y + h * 0.5} />
        </g>
      ) : null}
      {solid ? (
        <g>
          <rect x={a - h * 0.9} y={y - h * 0.9} width={b - a + h * 1.8} height={h * 1.8} rx={h * 0.9} fill={color} opacity={0.14} />
          <rect x={a - h * 0.5} y={y - h * 0.5} width={b - a + h} height={h} rx={h * 0.5} fill={color} opacity={0.22} />
          <rect x={a - h * 0.15} y={y - h * 0.15} width={b - a + h * 0.3} height={h * 0.3} rx={h * 0.15} fill={color} />
          <rect x={a - h * 0.15} y={y - h * 0.55} width={h * 0.3} height={h * 1.1} rx={h * 0.15} fill={color} />
          <rect x={b - h * 0.15} y={y - h * 0.55} width={h * 0.3} height={h * 1.1} rx={h * 0.15} fill={color} />
        </g>
      ) : null}
      {label ? (
        <text x={labelMid} y={y + h * 0.9 + fontSize} fill={labelColor ?? (solid ? color : ghostColor)} fontFamily={FONTS.hud} fontWeight={700} fontSize={fontSize} textAnchor="middle" letterSpacing={4}>
          {label}
        </text>
      ) : null}
    </g>
  );
};

/** Flat meter arrow in the SpeedDiffMeter look, pointing right (dir 1) or left (dir -1). Zero length draws a nub. */
export const MeterArrow: React.FC<{ x: number; y: number; length: number; h?: number; color: string; dir?: 1 | -1 }> = ({ x, y, length, h = 30, color, dir = 1 }) => {
  if (length < h * 0.6) return <circle cx={x + dir * Math.max(0, length)} cy={y} r={h / 2} fill={color} />;
  const head = h * 0.9;
  const bodyEnd = length - head;
  return (
    <g transform={`translate(${x} ${y}) scale(${dir} 1)`}>
      <rect x={0} y={-h / 2} width={Math.max(h, bodyEnd + h * 0.3)} height={h} rx={h / 2} fill={color} />
      <path d={`M${bodyEnd - h * 0.1},${-h * 0.95} L${length},0 L${bodyEnd - h * 0.1},${h * 0.95} Z`} fill={color} stroke={color} strokeWidth={h * 0.35} strokeLinejoin="round" />
    </g>
  );
};

/**
 * IN / OUT meter from one zero line: IN points right (towards the foot, like the ball), OUT points left (the
 * ball goes back towards Sam). A dashed guide marks a third of IN on the OUT side. `ghostOut` draws the old
 * OUT length as a dashed outline when OUT shrinks. No digits.
 */
export const InOutMeter: React.FC<{
  x: number;
  y: number;
  inSpeed: number;
  outSpeed: number;
  scale: number;
  ghostOut?: number;
  ghostOpacity?: number;
  barHeight?: number;
  fontSize?: number;
}> = ({ x, y, inSpeed, outSpeed, scale, ghostOut = 0, ghostOpacity = 0, barHeight = 30, fontSize = 32 }) => {
  const row = barHeight * 2.2;
  const l1 = Math.max(0, inSpeed) * scale;
  const l2 = Math.max(0, outSpeed) * scale;
  const inTrack = l1 + barHeight;
  const outTrack = l1 * 0.5;
  const third = l1 / 3;
  const g = Math.max(0, ghostOut) * scale;
  return (
    <g>
      {/* Tracks. */}
      <rect x={x} y={y - barHeight * 0.25} width={inTrack} height={barHeight * 0.5} rx={barHeight * 0.25} fill={PITCH.chalk} opacity={0.12} />
      <rect x={x - outTrack} y={y + row - barHeight * 0.25} width={outTrack} height={barHeight * 0.5} rx={barHeight * 0.25} fill={PITCH.chalk} opacity={0.12} />
      {/* The zero line both arrows start from. */}
      <line x1={x} y1={y - barHeight * 1.0} x2={x} y2={y + row + barHeight * 1.0} stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" opacity={0.55} />
      {/* Thirds of IN, and a third mirrored on the OUT side. */}
      {[1, 2].map((k) => (
        <line key={k} x1={x + third * k} y1={y - barHeight * 0.9} x2={x + third * k} y2={y + barHeight * 0.9} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="6 8" strokeLinecap="round" opacity={0.4} />
      ))}
      <line x1={x - third} y1={y - barHeight * 0.3} x2={x - third} y2={y + row + barHeight * 0.9} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="6 8" strokeLinecap="round" opacity={0.4} />
      {/* The old OUT, dashed, once OUT shrinks. */}
      {ghostOpacity > 0.001 && g > 1 ? (
        <rect x={x - g} y={y + row - barHeight * 0.5} width={g} height={barHeight} rx={barHeight * 0.5} fill="none" stroke={CAST.ballRim} strokeWidth={4} strokeDasharray="8 9" opacity={ghostOpacity} />
      ) : null}
      <MeterArrow x={x} y={y} length={l1} h={barHeight} color={CAST.ball} dir={1} />
      <MeterArrow x={x} y={y + row} length={l2} h={barHeight} color={CAST.ballRim} dir={-1} />
      {/* Names on the empty side of each row. */}
      <text x={x - 22} y={y + fontSize * 0.36} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={fontSize} textAnchor="end" letterSpacing={3} opacity={0.9}>
        IN
      </text>
      <text x={x + 22} y={y + row + fontSize * 0.36} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={fontSize} textAnchor="start" letterSpacing={3} opacity={0.9}>
        OUT
      </text>
    </g>
  );
};

// ---------- b10: the inside of the foot, seen from above ----------

/**
 * A small chip that shows the receiving foot from above: turned out, so its inside (the arch side, teal)
 * faces the ball coming in from the left. Pops at `at`, shrinks out at `until`.
 */
export const FootFromAbove: React.FC<{ x: number; y: number; at: number; until?: number; scale?: number }> = ({ x, y, at, until, scale = 1 }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const nudge = 4 * Math.sin(frame / 7);
  return (
    <g transform={`translate(${x} ${y}) scale(${s * scale})`}>
      <rect x={-130} y={-112} width={260} height={236} rx={30} fill={PANEL_BG} />
      <g transform="translate(22 -10)">
        {/* The foot: heel at the bottom, toes at the top, big toe on the left (the inside). */}
        <path d="M-18,-58 C-30,-40 -31,-10 -24,10 C-19,26 -24,44 -19,58 C-12,72 12,72 18,58 C26,30 30,0 28,-30 C26,-52 12,-64 -2,-64 C-9,-64 -14,-62 -18,-58 Z" fill={PITCH.chalk} opacity={0.92} />
        {[
          [-13, -74, 9.5],
          [1, -77, 6.5],
          [11, -74, 6],
          [20, -68, 5.5],
          [27, -59, 5],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={PITCH.chalk} opacity={0.92} />
        ))}
        {/* The inside of the foot: the face the ball meets. */}
        <path d="M-29,-36 C-32,-14 -28,8 -22,26" fill="none" stroke={PITCH.teal} strokeWidth={10} strokeLinecap="round" />
        {/* The ball comes in from the left. */}
        <g transform={`translate(${nudge} 0)`}>
          <circle cx={-84} cy={-6} r={22} fill={CAST.ball} />
          <path d="M-100,-12 Q-84,-2 -68,-12" fill="none" stroke={CAST.ballLine} strokeWidth={3.5} strokeLinecap="round" opacity={0.85} />
          <path d="M-58,-6 L-42,-6" stroke={CAST.ball} strokeWidth={6} strokeLinecap="round" />
          <path d="M-46,-14 L-37,-6 L-46,2" fill="none" stroke={CAST.ball} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      <text x={0} y={104} fill={PITCH.chalk} opacity={0.85} fontFamily={FONTS.hud} fontWeight={700} fontSize={28} textAnchor="middle" letterSpacing={2}>
        FROM ABOVE
      </text>
    </g>
  );
};

// ---------- b09: the egg in a stiff hand ----------

const YOLK = PITCH.light;
const SHELL_BITS: [number, number, number, number][] = [
  // [vx, vy, spin, size] in px per unit of splat time; vy < 0 goes up.
  [-190, -150, -200, 1],
  [-110, -210, 160, 0.8],
  [30, -230, -140, 0.9],
  [150, -170, 220, 1.1],
  [210, -90, -180, 0.8],
  [-230, -60, 120, 0.9],
];
const SPRAY: [number, number, number, string][] = [
  // [angle deg, distance, radius, colour]
  [-170, 170, 8, YOLK],
  [-145, 200, 6, PITCH.chalk],
  [-120, 150, 9, YOLK],
  [-100, 210, 5, PITCH.chalk],
  [-80, 190, 8, YOLK],
  [-60, 220, 6, PITCH.chalk],
  [-35, 170, 9, YOLK],
  [-12, 200, 6, PITCH.chalk],
  [-158, 120, 5, YOLK],
  [-25, 120, 5, YOLK],
  [-90, 120, 7, PITCH.chalk],
  [-8, 150, 7, YOLK],
];

/**
 * A flat, rigid open hand (side view, palm up, fingers straight) and an egg that pops in above it, hangs,
 * falls and splats: yolk spray, a spreading yolk with drips and shell bits flying off. All flat shapes.
 * `draw` (0..1) brings the hand in, `eggIn` pops the egg, `fall` drops it, `splat` runs the burst.
 */
export const StiffHandEgg: React.FC<{ x: number; y: number; scale?: number; draw: number; eggIn: number; fall: number; splat: number; wobble?: number; bg?: string }> = ({ x, y, scale = 1, draw, eggIn, fall, splat, wobble = 0, bg = PANEL_BG }) => {
  if (draw <= 0.001) return null;
  const handIn = EASE.enter(clamp01(draw));
  const eggTop = -210;
  const eggRest = -36;
  const fallE = fall * fall;
  const eggY = eggTop + (eggRest - eggTop) * fallE;
  const squashT = clamp01(splat / 0.18);
  const burst = clamp01((splat - 0.1) / 0.9);
  const burstE = EASE.enter(burst);
  const eggShow = eggIn > 0.001 && splat < 0.22;
  const drip = (dx: number, len: number, w: number) => <rect x={dx - w / 2} y={36} width={w} height={8 + len * burstE} rx={w / 2} fill={YOLK} opacity={0.95} />;
  return (
    <g transform={`translate(${x} ${y + (1 - handIn) * 40}) scale(${scale})`} opacity={handIn}>
      {/* The splat flash behind everything. */}
      {splat > 0.001 && splat < 1 ? (
        <path
          d="M0,-150 L28,-70 L110,-110 L64,-40 L150,-20 L60,6 L-60,6 L-150,-20 L-64,-40 L-110,-110 L-28,-70 Z"
          fill={CAST.mistake}
          opacity={0.3 * (1 - burst)}
          transform={`translate(0 -10) scale(${0.4 + 0.9 * EASE.back(Math.min(1, splat * 2.2))})`}
        />
      ) : null}
      {/* Sleeve, then the flat hand: palm and straight fingers as one rigid slab, thumb up. */}
      <rect x={-236} y={2} width={76} height={52} rx={16} fill={CAST.shirt} />
      <path d="M-168,8 L-100,4 L40,0 L150,2 Q172,4 172,18 Q172,32 150,34 L40,38 Q10,44 -40,46 L-100,46 L-168,50 Z" fill={PITCH.chalk} />
      <path d="M-46,6 L-14,-36" stroke={PITCH.chalk} strokeWidth={24} strokeLinecap="round" />
      {/* Finger lines and knuckles. */}
      <path d="M52,12 L160,13" stroke={bg} strokeWidth={3.5} strokeLinecap="round" opacity={0.7} />
      <path d="M52,24 L162,25" stroke={bg} strokeWidth={3.5} strokeLinecap="round" opacity={0.7} />
      <path d="M40,4 L40,34" stroke={bg} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <path d="M96,3 L96,36" stroke={bg} strokeWidth={3} strokeLinecap="round" opacity={0.25} />
      {/* The egg: pops in above the hand, hangs with a little wobble, then drops. */}
      {eggShow ? (
        <g transform={`translate(0 ${eggY}) rotate(${wobble * (1 - fall)}) scale(${popT(eggIn) * (1 + 0.5 * squashT)} ${popT(eggIn) * (1 - 0.55 * squashT)})`}>
          <path d="M-27,4 C-27,-26 -14,-44 0,-44 C14,-44 27,-26 27,4 C27,24 15,36 0,36 C-15,36 -27,24 -27,4 Z" fill={PITCH.chalk} />
          <path d="M-14,-18 C-12,-28 -6,-34 0,-36" fill="none" stroke={bg} strokeWidth={3} strokeLinecap="round" opacity={0.25} />
        </g>
      ) : null}
      {/* The splat: egg white and yolk spread over the palm, drips over the edge. */}
      {burst > 0.001 ? (
        <g>
          <ellipse cx={0} cy={-2} rx={120 * burstE} ry={14 + 8 * burstE} fill={PITCH.chalk} opacity={0.85} />
          <ellipse cx={-6} cy={-6} rx={58 * burstE} ry={10 + 8 * burstE} fill={YOLK} />
          {drip(-70, 30, 12)}
          {drip(-18, 44, 14)}
          {drip(52, 26, 11)}
          {drip(118, 36, 12)}
          {/* Spray. */}
          {SPRAY.map(([a, d, r, c], i) => {
            const th = (a * Math.PI) / 180;
            const dd = d * burstE;
            const drop = 140 * burst * burst;
            return <circle key={i} cx={Math.cos(th) * dd} cy={-10 + Math.sin(th) * dd + drop} r={r * (1 - 0.4 * burst)} fill={c} opacity={1 - burst} />;
          })}
          {/* Shell bits. */}
          {SHELL_BITS.map(([vx, vy, spin, k], i) => {
            const u = burstE;
            const px = vx * u;
            const py = -20 + vy * u + 260 * burst * burst;
            return (
              <path
                key={i}
                d="M-14,-6 L-4,-14 L2,-6 L10,-13 L15,2 L2,10 L-12,7 Z"
                fill={PITCH.chalk}
                opacity={1 - burst}
                transform={`translate(${px} ${py}) rotate(${spin * u}) scale(${k * 1.3})`}
              />
            );
          })}
        </g>
      ) : null}
    </g>
  );
};

// ---------- b10: a pill with leader lines, and a dashed ghost arrow ----------

/**
 * A pill label that sits in empty space and points at one or more body points with thin leader lines
 * (each ends in a small dot on the point). Pops like the kit Label and shrinks out at `until`.
 */
export const LeaderPill: React.FC<{
  x: number;
  y: number;
  text: string;
  at: number;
  until?: number;
  to: { x: number; y: number }[];
  bg?: string;
  color?: string;
  size?: number;
}> = ({ x, y, text, at, until, to, bg = CAST.shirt, color = PITCH.sky, size = 32 }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const w = text.length * size * 0.58 + size * 1.2;
  const h = size * 1.55;
  const left = x - w / 2;
  const draw = progress(frame, at + 4, 12, EASE.enter);
  return (
    <g>
      <g opacity={Math.min(1, s)} stroke={bg} strokeWidth={4} strokeLinecap="round">
        {to.map((p, i) => {
          const ex = left + (p.x - left) * draw;
          const ey = y + (p.y - y) * draw;
          return (
            <g key={i}>
              <line x1={left + 6} y1={y} x2={ex} y2={ey} />
              {draw > 0.95 ? <circle cx={p.x} cy={p.y} r={9} fill={bg} stroke="none" /> : null}
            </g>
          );
        })}
      </g>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={bg} />
        <text y={size * 0.35} fill={color} fontFamily={FONTS.label} fontWeight={800} fontSize={size} textAnchor="middle">
          {text}
        </text>
      </g>
    </g>
  );
};

/** A dashed outline of a SpeedArrow (a planned move that has not started yet). */
export const GhostArrow: React.FC<{ x: number; y: number; len: number; color: string; width?: number; angle?: number; opacity?: number }> = ({ x, y, len, color, width = 16, angle = 0, opacity = 1 }) => {
  if (len < width * 1.6 || opacity <= 0.001) return null;
  const head = width * 1.6;
  const bodyEnd = len - head * 0.7;
  const hw = width / 2;
  const d = `M0,${-hw} L${bodyEnd - width * 0.2},${-hw} L${bodyEnd - width * 0.2},${-head * 0.62} L${len},0 L${bodyEnd - width * 0.2},${head * 0.62} L${bodyEnd - width * 0.2},${hw} L0,${hw} Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      <path d={d} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={4} strokeDasharray="8 7" strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
};
