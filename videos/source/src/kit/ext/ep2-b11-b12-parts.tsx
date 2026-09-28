// Shared pieces for b11 (touch into space) and b12 (touch practice): the LOOK_STEP receive geometry both
// scenes replay, chalk corner marks for a held panel, a floating chalk note, the chalk steering wheel and
// the wheel map (b11's last beat, b12's backdrop), a small jogging Chalk icon and its caption card, a
// metronome, a fixed metre ruler, chalk number knobs, the grey pro ghost, numbered cue chips, the cone that
// stands in for Chalk, an oblique chalk box, the drill wall, a stand band, a ring icon, note and safety
// lines, hazard lights for the car park, a leg swap for the pose rig, the drill mini map and the pursuit
// table for Chalk chasing a rolling ball. Everything takes 0..1 values or explicit numbers, never a frame,
// unless a `frame` prop says so.

import React from "react";
import { CAST, FONTS, PITCH, WIDTH, XRAY } from "../../theme";
import { clamp01, idle, visible } from "../../lib/anim";
import { fmtSeconds, popT, trim } from "../ep2/chalk";
import type { Pose } from "../Player";
import { CHASE_SPEED, rollAt } from "../../physics/touch";
import { TOUCHES, chalkAt, lookStepMeet } from "../../physics/ep2sims";
import { CLOSING_SPEED, bubbleColor } from "../TimeBubble";
import { TopField } from "../Field";
import { TopPlayer, angleTo } from "../TopPlayer";
import { Ball } from "../Ball";
import type { View } from "../../lib/project";

export type Box = { x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------- the receive both scenes replay
export type ChaseSample = { x: number; y: number; bx: number; by: number; dist: number };

/**
 * Chalk chasing a rolling ball, one sample per frame: Chalk starts at (cx, cy) and heads for the
 * ball's current position at CHASE_SPEED; the ball starts at (bx, by) and rolls along the unit
 * direction (ux, uy) at `speed`, slowing on the grass. `dist` is the gap (0 when he is on it).
 */
export const pursuitTable = (cx: number, cy: number, bx: number, by: number, ux: number, uy: number, speed: number, frames: number, fps = 30): ChaseSample[] => {
  const out: ChaseSample[] = [{ x: cx, y: cy, bx, by, dist: Math.hypot(bx - cx, by - cy) }];
  let x = cx;
  let y = cy;
  const dt = 1 / fps;
  for (let k = 1; k <= frames; k++) {
    const r = rollAt(speed, k * dt);
    const px = bx + ux * r.x;
    const py = by + uy * r.x;
    const dx = px - x;
    const dy = py - y;
    const d = Math.hypot(dx, dy);
    const run = Math.min(d, CHASE_SPEED * dt);
    if (d > 1e-6) {
      x += (dx / d) * run;
      y += (dy / d) * run;
    }
    out.push({ x, y, bx: px, by: py, dist: Math.max(0, d - run) });
  }
  return out;
};

/** Sample the table at a fractional frame. */
export const chaseAt = (table: ChaseSample[], f: number): ChaseSample => {
  if (f <= 0) return table[0];
  if (f >= table.length - 1) return table[table.length - 1];
  const i = Math.floor(f);
  const t = f - i;
  const a = table[i];
  const b = table[i + 1];
  const m = (u: number, v: number) => u + (v - u) * t;
  return { x: m(a.x, b.x), y: m(a.y, b.y), bx: m(a.bx, b.bx), by: m(a.by, b.by), dist: m(a.dist, b.dist) };
};

/**
 * The LOOK_STEP receive (pitch frame: Tavi's mark at the origin, +x to the goal, +y to her left):
 * the ball meets Tavi at MEET (t 1.94 s, x -0.88, 4.95 m/s), Chalk is at C0 (3.2, -0.44), 4.1 m away.
 * TOUCH_AWAY sends the ball 3.0 m/s along AWAY_U (-0.6, 0.8); Tavi takes her second touch 0.8 s later.
 */
const MEET = lookStepMeet();
const C0 = chalkAt(MEET.t);
const AWAY = TOUCHES.TOUCH_AWAY();
const AWAY_SPEED = Math.hypot(AWAY.x, AWAY.y);
const AWAY_U = { x: AWAY.x / AWAY_SPEED, y: AWAY.y / AWAY_SPEED };
const SECOND_TOUCH = 0.8;
const DEAD_D = Math.hypot(MEET.x - C0.x, -C0.y);
export const RECEIVE = {
  MEET,
  C0,
  AWAY_U,
  AWAY_SPEED,
  SECOND_TOUCH,
  /** Chalk's gap to the dead ball and the time he needs to close it (1.03 s). */
  DEAD_D,
  DEAD_ARRIVE: DEAD_D / CHASE_SPEED,
  /** Screen heading of the touch away (0 = right, 90 = down): up and to the left. */
  AWAY_SCREEN: (Math.atan2(-AWAY_U.y, AWAY_U.x) * 180) / Math.PI + 360,
  /** Chalk against the ball rolling away, 3 s of samples. */
  CHASE_AWAY: pursuitTable(C0.x, C0.y, MEET.x, 0, AWAY_U.x, AWAY_U.y, AWAY_SPEED, 90),
  /** Where the ball is at the second touch. */
  END: (() => {
    const r = rollAt(AWAY_SPEED, SECOND_TOUCH).x;
    return { x: MEET.x + AWAY_U.x * r, y: AWAY_U.y * r, rolled: r };
  })(),
};

// ---------------------------------------------------------------- chalk marks and notes
/** Four chalk corner marks on a held panel (the SplitCompare idiom), popped by `t`. */
export const CornerMarks: React.FC<{ box: Box; t: number; color?: string }> = ({ box, t, color = PITCH.chalk }) => {
  const s = popT(t);
  if (s <= 0.001) return null;
  const len = 34;
  const m = 18;
  const corner = (cx: number, cy: number, sx: number, sy: number, key: string) => (
    <g key={key} transform={`translate(${cx} ${cy}) scale(${s})`}>
      <path d={`M${sx * len},0 L0,0 L0,${sy * len}`} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
    </g>
  );
  return (
    <g>
      {corner(box.x + m, box.y + m, 1, 1, "a")}
      {corner(box.x + box.w - m, box.y + m, -1, 1, "b")}
      {corner(box.x + m, box.y + box.h - m, 1, -1, "c")}
      {corner(box.x + box.w - m, box.y + box.h - m, -1, -1, "d")}
    </g>
  );
};

/** A chalk note ("+0") that pops, floats up and fades out over `t` 0..1. */
export const ChalkFloat: React.FC<{ x: number; y: number; text: string; t: number; color?: string; size?: number }> = ({ x, y, text, t, color = PITCH.chalk, size = 64 }) => {
  if (t <= 0.001 || t >= 0.999) return null;
  const s = popT(clamp01(t * 4));
  const rise = 70 * t;
  const o = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
  return (
    <g transform={`translate(${x} ${y - rise}) scale(${s})`} opacity={o}>
      <text y={size * 0.36} fill={color} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle">
        {text}
      </text>
    </g>
  );
};

/** A chalk knob with a digit, like the SplitCompare divider label, popped by `t`. */
export const ChalkNumber: React.FC<{ x: number; y: number; n: string; t: number; r?: number; color?: string }> = ({ x, y, n, t, r = 28, color = PITCH.chalk }) => {
  const s = popT(t);
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r={r} fill={color} />
      <text y={r * 0.38} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={r * 1.15} textAnchor="middle">
        {n}
      </text>
    </g>
  );
};

/** A dark pill with one centred line of text, faded by `o`. */
export const PillCaption: React.FC<{ x: number; y: number; text: string; o: number; size?: number; color?: string }> = ({ x, y, text, o, size = 34, color = PITCH.lightSoft }) => {
  if (o <= 0.001) return null;
  const w = text.length * size * 0.52 + size * 1.6;
  const h = size * 1.6;
  return (
    <g opacity={o} transform={`translate(${x} ${y + (1 - o) * 14})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={PITCH.skyHigh} opacity={0.82} />
      <text y={size * 0.35} fill={color} fontFamily={FONTS.label} fontWeight={800} fontSize={size} textAnchor="middle">
        {text}
      </text>
    </g>
  );
};

/** A chalk speech bubble with up to two lines and a tail toward (tx, ty), popped by `s`. */
export const TalkBubble: React.FC<{ x: number; y: number; lines: string[]; tx: number; ty: number; s: number; size?: number }> = ({ x, y, lines, tx, ty, s, size = 32 }) => {
  const k = popT(s);
  if (k <= 0.001) return null;
  const longest = lines.reduce((a, b) => Math.max(a, b.length), 0);
  const w = longest * size * 0.6 + size * 1.2;
  const h = lines.length * size * 1.25 + size * 0.9;
  // The tail leaves the edge that faces the target: a side edge when the target is more sideways than
  // up or down (relative to the bubble's shape), else the top or bottom edge. Its base is always wide.
  const dx = tx - x;
  const dy = ty - y;
  const sideways = Math.abs(dx) / (w / 2) > Math.abs(dy) / (h / 2);
  const tail = sideways
    ? (() => {
        const ex = dx < 0 ? -w / 2 + 3 : w / 2 - 3;
        const cy = Math.max(-h * 0.2, Math.min(h * 0.2, dy * 0.3));
        return `M${ex},${cy - h * 0.2} L${dx},${dy} L${ex},${cy + h * 0.2} Z`;
      })()
    : (() => {
        const ey = dy > 0 ? h / 2 - 3 : -h / 2 + 3;
        const bx = dx < 0 ? -w * 0.28 : w * 0.1;
        return `M${bx},${ey} L${dx},${dy} L${bx + w * 0.18},${ey} Z`;
      })();
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <path d={tail} fill={PITCH.chalk} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={size * 0.9} fill={PITCH.chalk} />
      {lines.map((l, i) => (
        <text key={i} y={-h / 2 + size * 0.75 + size * 0.36 + i * size * 1.25} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={size} textAnchor="middle">
          {l}
        </text>
      ))}
    </g>
  );
};

/** One note line on the board (slides in, slides out when replaced). */
export const NoteLine: React.FC<{ frame: number; x: number; y: number; text: string; at: number; until?: number; size?: number; color?: string; dot?: string; number?: string }> = ({ frame, x, y, text, at, until, size = 36, color = PITCH.chalk, dot, number }) => {
  const o = visible(frame, at, until, 12, 7);
  if (o <= 0.001) return null;
  const lead = number ? 54 : dot ? 34 : 0;
  return (
    <g opacity={o} transform={`translate(${(1 - o) * 26} 0)`}>
      {number ? (
        <g transform={`translate(${x + 20} ${y - size * 0.34})`}>
          <circle r={22} fill={PITCH.chalk} />
          <text y={11} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={32} textAnchor="middle">
            {number}
          </text>
        </g>
      ) : dot ? (
        <circle cx={x + 10} cy={y - size * 0.34} r={9} fill={dot} />
      ) : null}
      <text x={x + lead} y={y} fill={color} fontFamily={FONTS.label} fontWeight={800} fontSize={size}>
        {text}
      </text>
    </g>
  );
};

/** The safety strip: a pink SAFETY pill and one line of text. */
export const SafetyLine: React.FC<{ frame: number; x: number; y: number; text: string; at: number }> = ({ frame, x, y, text, at }) => {
  const o = visible(frame, at, undefined, 14);
  if (o <= 0.001) return null;
  return (
    <g opacity={o} transform={`translate(0 ${(1 - o) * 18})`}>
      <rect x={x} y={y - 38} width={160} height={52} rx={26} fill={CAST.mistake} />
      <text x={x + 80} y={y} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={30} textAnchor="middle" letterSpacing={3}>
        SAFETY
      </text>
      <text x={x + 184} y={y} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={700} fontSize={32}>
        {text}
      </text>
    </g>
  );
};

// ---------------------------------------------------------------- the steering wheel
/** A chalk steering wheel drawn around a point: rim, three spokes, hub. `turn` rotates it (degrees). */
export const SteeringWheel: React.FC<{ cx: number; cy: number; r: number; draw: number; turn?: number; color?: string; scale?: number }> = ({ cx, cy, r, draw, turn = 0, color = PITCH.chalk, scale = 1 }) => {
  const d = clamp01(draw);
  if (d <= 0.001) return null;
  const rim = clamp01(d / 0.6);
  const spokes = clamp01((d - 0.55) / 0.35);
  const hub = popT(clamp01((d - 0.85) / 0.15));
  const w = Math.max(5, r * 0.09);
  const circle = `M${-r},0 A${r},${r} 0 1 1 ${r},0 A${r},${r} 0 1 1 ${-r},0`;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${turn}) scale(${scale})`}>
      <path d={circle} fill="none" stroke={color} strokeWidth={w * 1.6} strokeLinecap="round" opacity={0.95} {...trim(rim)} />
      {[-90, 30, 150].map((a, i) => {
        const t = clamp01(spokes * 3 - i);
        if (t <= 0.001) return null;
        const rad = (a * Math.PI) / 180;
        return <line key={a} x1={Math.cos(rad) * r * 0.22} y1={Math.sin(rad) * r * 0.22} x2={Math.cos(rad) * r * (0.22 + 0.7 * t)} y2={Math.sin(rad) * r * (0.22 + 0.7 * t)} stroke={color} strokeWidth={w} strokeLinecap="round" opacity={0.9} />;
      })}
      {hub > 0.001 ? <circle r={r * 0.2 * hub} fill="none" stroke={color} strokeWidth={w} opacity={0.9} /> : null}
      {/* A thumb mark at the top of the rim shows the turn. */}
      {rim >= 0.999 ? <circle cx={0} cy={-r} r={w * 1.5} fill={XRAY.lime} /> : null}
    </g>
  );
};

/** Top-down view of the wheel beat, 100 px per metre around Tavi's touch point at (960, 640). */
export const WHEEL_VIEW: View = { kind: "top", originX: 960, originY: 640, ppm: 100 };
export const WHEEL = {
  view: WHEEL_VIEW,
  P: (x: number, y: number) => ({ x: WHEEL_VIEW.originX + x * WHEEL_VIEW.ppm, y: WHEEL_VIEW.originY - y * WHEEL_VIEW.ppm }),
  /** The lime patch of space, Chalk's spot and the wheel radius. */
  space: { x: -1.5, y: 2.0 },
  chalk: { x: 2.3, y: -1.2 },
  radius: 126,
  token: 72,
  ballR: 14,
};

/**
 * The wheel map: the pitch, the lime space, Chalk closing, Tavi at her touch point with the ball, and the
 * chalk steering wheel around the ball. `pop` scales the tokens in, `draw` draws the wheel, `turn` rotates
 * it, `nudge` 0..1 rolls the ball a little toward the space. `field` false leaves out the grass.
 */
export const WheelScene: React.FC<{ frame: number; pop: number; draw: number; turn: number; nudge: number; field?: boolean; opacity?: number }> = ({ frame, pop, draw, turn, nudge, field = true, opacity = 1 }) => {
  const s = popT(pop);
  const P = WHEEL.P;
  const tavi = P(0, 0);
  const space = P(WHEEL.space.x, WHEEL.space.y);
  const chalk = P(WHEEL.chalk.x, WHEEL.chalk.y);
  const toSpace = angleTo(tavi.x, tavi.y, space.x, space.y);
  const rad = (toSpace * Math.PI) / 180;
  // The ball sits half a metre in front of her, toward the space; the nudge rolls it 0.4 m further.
  const ball0 = { x: tavi.x + Math.cos(rad) * 50, y: tavi.y + Math.sin(rad) * 50 };
  const ball = { x: ball0.x + Math.cos(rad) * 40 * nudge, y: ball0.y + Math.sin(rad) * 40 * nudge };
  return (
    <g opacity={opacity}>
      {field ? <TopField view={WHEEL_VIEW} x0={-14} x1={14} y0={-8} y1={8} stripeM={3} lines={false} /> : null}
      {s > 0.001 ? (
        <g>
          <circle cx={space.x} cy={space.y} r={170 * s} fill={XRAY.lime} opacity={0.16} />
          <circle cx={space.x} cy={space.y} r={(120 + idle(frame, 4, 3, 6)) * s} fill={XRAY.lime} opacity={0.1} />
          <g transform={`translate(${chalk.x} ${chalk.y}) scale(${s})`}>
            <TopPlayer x={0} y={0} kind="chalk" size={WHEEL.token} facing={angleTo(chalk.x, chalk.y, tavi.x, tavi.y)} stride={(frame * 0.13) % 1} />
          </g>
        </g>
      ) : null}
      {/* The wheel sits on the ground centred on the ball and travels with it; Tavi and the ball stay on top. */}
      <SteeringWheel cx={ball.x} cy={ball.y} r={WHEEL.radius} draw={draw} turn={turn} />
      {s > 0.001 ? (
        <g transform={`translate(${tavi.x} ${tavi.y}) scale(${s})`}>
          <TopPlayer x={0} y={idle(frame, 3, 2.8, 2)} kind="tavi" size={WHEEL.token} facing={RECEIVE.AWAY_SCREEN} />
          <Ball cx={ball.x - tavi.x} cy={ball.y - tavi.y} r={WHEEL.ballR} view={WHEEL_VIEW} axis={{ x: 1, y: 1, z: 0 }} angle={nudge * 4} />
        </g>
      ) : null}
    </g>
  );
};

// ---------------------------------------------------------------- the join from b10
/** b10's closing map (its numbers): Tavi's mark at the frame centre, Sam 12.3 m behind her, 68 px per metre. */
const OPEN_PPM = 68;
const OPEN_MARK_X = 40;
const OPEN_VIEW: View = { kind: "top", originX: WIDTH / 2 - OPEN_MARK_X * OPEN_PPM, originY: 540, ppm: OPEN_PPM };
const OPEN_TOKEN = 64;

/**
 * The picture b10 ends on (the ink faded into stripes): Sam, the dotted pass line, the chalk mark and Tavi
 * with the ball dead at her foot. b11 opens on it so the cut does not blink. `lookFrame` keeps Tavi's
 * idle head turn continuous across the cut (b10's own frame count plus this scene's frame).
 */
export const OpenMap: React.FC<{ lookFrame: number; opacity: number }> = ({ lookFrame, opacity }) => {
  if (opacity <= 0.001) return null;
  const tavi = { x: OPEN_VIEW.originX + OPEN_MARK_X * OPEN_PPM, y: 540 };
  const sam = { x: tavi.x - 12.3 * OPEN_PPM, y: 540 };
  return (
    <g opacity={opacity}>
      <TopField view={OPEN_VIEW} x0={OPEN_MARK_X - 20} x1={OPEN_MARK_X + 20} y0={-12} y1={12} lines={false} />
      <line x1={sam.x + OPEN_TOKEN * 0.7} y1={sam.y} x2={tavi.x - OPEN_TOKEN * 0.9} y2={tavi.y} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="3 16" strokeLinecap="round" opacity={0.35} />
      <g stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" opacity={0.6}>
        <line x1={tavi.x - 20} y1={tavi.y - 20} x2={tavi.x + 20} y2={tavi.y + 20} />
        <line x1={tavi.x - 20} y1={tavi.y + 20} x2={tavi.x + 20} y2={tavi.y - 20} />
      </g>
      <TopPlayer x={sam.x} y={sam.y} kind="sam" facing={0} size={OPEN_TOKEN} label="Sam" />
      <TopPlayer x={tavi.x} y={tavi.y} kind="tavi" facing={180} size={OPEN_TOKEN} look={idle(lookFrame, 7, 2.4, 6)} />
      <Ball cx={tavi.x - OPEN_TOKEN * 0.62} cy={tavi.y + OPEN_TOKEN * 0.16} r={0.11 * OPEN_PPM * 1.3} view={OPEN_VIEW} />
    </g>
  );
};

// ---------------------------------------------------------------- Chalk's jog and the pros
/** A tiny side-view Chalk jogging on the spot: capsule, pumping arms, alternating legs, dust. */
export const JogChalk: React.FC<{ x: number; y: number; h?: number; phase: number; opacity?: number; flip?: boolean }> = ({ x, y, h = 90, phase, opacity = 1, flip = false }) => {
  const W = h * 0.36;
  const sw = Math.sin(phase * Math.PI * 2);
  const bob = Math.abs(Math.cos(phase * Math.PI * 2)) * h * 0.04;
  const legW = h * 0.09;
  return (
    <g transform={`translate(${x} ${y - bob}) scale(${flip ? -1 : 1} 1)`} opacity={opacity}>
      {/* Legs: two short capsules swinging in opposite phase. */}
      <line x1={-W * 0.12} y1={-h * 0.16} x2={-W * 0.12 - sw * h * 0.14} y2={0} stroke={CAST.keeperShade} strokeWidth={legW} strokeLinecap="round" />
      <line x1={W * 0.12} y1={-h * 0.16} x2={W * 0.12 + sw * h * 0.14} y2={0} stroke={CAST.keeperShade} strokeWidth={legW} strokeLinecap="round" />
      <g transform={`rotate(${12} 0 ${-h * 0.5})`}>
        <rect x={-W / 2} y={-h} width={W} height={h * 0.86} rx={W / 2} fill={CAST.keeper} />
        <rect x={W * 0.1} y={-h * 0.93} width={W * 0.26} height={h * 0.7} rx={W * 0.13} fill={CAST.keeperShade} opacity={0.55} />
        {/* Arms pumping. */}
        <line x1={W * 0.3} y1={-h * 0.7} x2={W * 0.3 + sw * h * 0.16} y2={-h * 0.5} stroke={CAST.keeperShade} strokeWidth={legW * 0.8} strokeLinecap="round" />
        {/* Face: two dots and a brow, looking forward (+x). */}
        <circle cx={W * 0.2} cy={-h * 0.8} r={h * 0.025} fill={CAST.keeperEye} />
        <circle cx={W * 0.36} cy={-h * 0.8} r={h * 0.025} fill={CAST.keeperEye} />
        <line x1={W * 0.12} y1={-h * 0.87} x2={W * 0.42} y2={-h * 0.88} stroke={CAST.keeperEye} strokeWidth={h * 0.02} strokeLinecap="round" />
      </g>
      {/* Dust behind the heels. */}
      {[0, 1, 2].map((k) => (
        <circle key={k} cx={-W * 0.7 - k * h * 0.12 - ((phase * 60) % 12)} cy={-h * 0.04 - k * h * 0.03} r={h * 0.035 * (1 - k * 0.25)} fill={PITCH.chalk} opacity={0.45 - k * 0.12} />
      ))}
    </g>
  );
};

/** The estimate card: a dark card with the jogging Chalk icon and two lines of caption, popped by `t`. */
export const JogCard: React.FC<{ x: number; y: number; w: number; t: number; phase: number; lines: [string, string] }> = ({ x, y, w, t, phase, lines }) => {
  const s = popT(t);
  if (s <= 0.001) return null;
  const h = 150;
  return (
    <g transform={`translate(${x + w / 2} ${y + h / 2}) scale(${s}) translate(${-w / 2} ${-h / 2})`}>
      <rect width={w} height={h} rx={30} fill={PITCH.skyHigh} opacity={0.86} />
      <JogChalk x={92} y={h - 30} h={96} phase={phase} />
      <text x={180} y={64} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={34}>
        {lines[0]}
      </text>
      <text x={180} y={108} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={34}>
        {lines[1]}
      </text>
    </g>
  );
};

/** A small metronome: a rounded pyramid with a pendulum. `swing` is -1..1 (left..right), `s` the pop. */
export const Metronome: React.FC<{ x: number; y: number; h?: number; swing: number; s: number; color?: string }> = ({ x, y, h = 120, swing, s, color = PITCH.chalk }) => {
  const k = popT(s);
  if (k <= 0.001) return null;
  const w = h * 0.62;
  const ang = swing * 28;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <path d={`M${-w / 2},0 L${-w * 0.16},${-h} L${w * 0.16},${-h} L${w / 2},0 Z`} fill={PITCH.skyHigh} stroke={color} strokeWidth={5} strokeLinejoin="round" opacity={0.95} />
      <g transform={`translate(0 ${-h * 0.18}) rotate(${ang})`}>
        <line x1={0} y1={0} x2={0} y2={-h * 0.72} stroke={color} strokeWidth={5} strokeLinecap="round" />
        <rect x={-h * 0.07} y={-h * 0.6} width={h * 0.14} height={h * 0.1} rx={h * 0.03} fill={XRAY.lime} />
      </g>
      <circle r={h * 0.05} cy={-h * 0.18} fill={color} />
    </g>
  );
};

/**
 * A grey pro: the TopPlayer shoulder-and-head shape (shirt capsule, chest band, hair cap, nose tick) in greys,
 * with no dot eyes, so it reads as "a player" and never as a Chalk clone. `look` turns the head.
 */
export const GhostToken: React.FC<{ x: number; y: number; facing: number; look?: number; size?: number; stride?: number; opacity?: number }> = ({ x, y, facing, look = 0, size = 64, stride, opacity = 1 }) => {
  const w = size;
  const h = size * 0.45;
  const headR = size * 0.27;
  const sway = stride === undefined ? 0 : Math.sin(stride * Math.PI * 2) * 6;
  const shirt = "#7F88A3";
  const shade = "#5F6782";
  const band = "#AEB5C9";
  const head = "#B8BDCC";
  const hair = "#4E556E";
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <ellipse cx={size * 0.08} cy={size * 0.1} rx={w * 0.55} ry={h * 0.7} fill="#000" opacity={0.18} />
      <g transform={`rotate(${facing + sway})`}>
        <rect x={-h / 2} y={-w / 2} width={h} height={w} rx={h / 2} fill={shirt} />
        <rect x={-h / 2} y={-w / 2} width={h * 0.45} height={w} rx={h / 2} fill={shade} opacity={0.5} />
        <rect x={-h * 0.12} y={-w / 2} width={h * 0.24} height={w} fill={band} />
      </g>
      <g transform={`rotate(${facing + look})`}>
        <circle r={headR} fill={head} />
        <path d={`M${-headR * 0.95},${-headR * 0.3} A${headR},${headR} 0 0 0 ${-headR * 0.95},${headR * 0.3} L${headR * 0.15},${headR * 0.5} A${headR * 0.7},${headR * 0.7} 0 0 0 ${headR * 0.15},${-headR * 0.5} Z`} fill={hair} />
        <path d={`M${headR * 0.9},${-headR * 0.18} L${headR * 1.2},0 L${headR * 0.9},${headR * 0.18} Z`} fill={head} />
      </g>
    </g>
  );
};

// ---------------------------------------------------------------- the metre ruler
type RulerProps = {
  from: [number, number];
  dir: [number, number];
  pxPerMetre: number;
  metres: number;
  progress: number;
  color?: string;
  secondsColor?: string;
  speed?: number;
  secondsEvery?: number;
  highlight?: number;
  fontSize?: number;
  /** Font size of the metre labels. Default 36. */
  metreSize?: number;
  /** Put the metre labels on the seconds side too (metre pill next to the tick, seconds pill beyond it). */
  stack?: boolean;
  /** Put each mark's pills in one horizontal row beside its tick (metre pill first, seconds pill beyond it), for a steep ruler. */
  row?: "left" | "right";
  opacity?: number;
};

/**
 * The kit SecondsRuler with two changes: every metre mark pops fully by the time the baseline reaches it,
 * and the metre labels sit in dark pills (like the seconds), 20 px clear of their tick, so a highlighted
 * label reads on any ground. The highlight glow sits behind the pills, never behind the text.
 */
export const MetreRuler: React.FC<RulerProps> = ({ from, dir, pxPerMetre, metres, progress, color = PITCH.chalk, secondsColor = PITCH.light, speed = CLOSING_SPEED, secondsEvery = 2, highlight, fontSize = 34, metreSize = 36, stack = false, row, opacity = 1 }) => {
  const p = clamp01(progress);
  if (p <= 0.001) return null;
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / len;
  const uy = dir[1] / len;
  // The normal points up the screen.
  const up = ux > 0 || (ux === 0 && uy > 0) ? 1 : -1;
  const nx = uy * up;
  const ny = -ux * up;
  const total = metres * pxPerMetre;
  const drawn = total * p;
  const at = (m: number, side = 0): [number, number] => [from[0] + ux * m * pxPerMetre + nx * side, from[1] + uy * m * pxPerMetre + ny * side];
  const stroke = 6;
  const marks = Array.from({ length: metres + 1 }, (_, i) => i);
  // Half the extent of a pill along the ruler's normal, so the pill edge (not its centre) keeps the gap.
  const halfAlong = (w: number, h: number) => Math.abs(nx) * (w / 2) + Math.abs(ny) * (h / 2);
  const glow = (x: number, y: number, r: number, key: string) => (
    <g key={key} opacity={0.9}>
      <circle cx={x} cy={y} r={r * 1.35} fill={secondsColor} opacity={0.12} />
      <circle cx={x} cy={y} r={r} fill={secondsColor} opacity={0.2} />
    </g>
  );
  return (
    <g opacity={opacity}>
      <line x1={from[0]} y1={from[1]} x2={from[0] + ux * drawn} y2={from[1] + uy * drawn} stroke={color} strokeWidth={stroke} strokeLinecap="round" opacity={0.9} />
      <circle cx={from[0]} cy={from[1]} r={stroke * 1.3} fill={color} />
      {marks.map((i) => {
        // Mark i pops over the last third of a metre before the line reaches it.
        const s = popT(clamp01(i === 0 ? p * metres * 6 : (p * metres - (i - 1 / 3)) * 3));
        if (s <= 0.001) return null;
        const [cx, cy] = at(i);
        const even = i % 2 === 0;
        const tick = even ? 24 : 15;
        const isHi = highlight === i;
        const secs = i / speed;
        const showSec = i > 0 && i % secondsEvery === 0;
        const secText = `${fmtSeconds(secs)} s`;
        const pillW = secText.length * fontSize * 0.62 + fontSize * 0.8;
        const pillH = fontSize * 1.3;
        const mText = `${i} m`;
        const mW = mText.length * metreSize * 0.62 + metreSize * 0.7;
        const mH = metreSize * 1.3;
        const mOff = tick + 20 + halfAlong(mW, mH);
        const sOff = stack ? mOff + halfAlong(mW, mH) + 10 + halfAlong(pillW, pillH) : tick + 12 + halfAlong(pillW, pillH);
        let [mx, my] = at(i, stack ? -mOff : mOff);
        let [sx, sy] = at(i, -sOff);
        if (row) {
          // One row per mark: the pills start 20 px past the tick's end on that side of the screen.
          const sg = row === "right" ? 1 : -1;
          const lead = Math.abs(nx) * tick + 20;
          mx = cx + sg * (lead + mW / 2);
          my = cy;
          sx = cx + sg * (lead + mW + 12 + pillW / 2);
          sy = cy;
        }
        const k = s * (isHi ? 1.12 : 1);
        return (
          <g key={i}>
            {isHi ? glow(mx, my, mW * 0.62, "gm") : null}
            {isHi && showSec ? glow(sx, sy, pillW * 0.6, "gs") : null}
            <g transform={`translate(${cx} ${cy}) scale(${s})`}>
              <line x1={-nx * tick} y1={-ny * tick} x2={nx * tick} y2={ny * tick} stroke={isHi ? secondsColor : color} strokeWidth={even ? stroke : stroke * 0.75} strokeLinecap="round" />
            </g>
            <g transform={`translate(${mx} ${my}) scale(${k})`}>
              <rect x={-mW / 2} y={-mH / 2} width={mW} height={mH} rx={mH / 2} fill={PITCH.sky} opacity={0.85} />
              <text y={metreSize * 0.35} fill={isHi ? secondsColor : color} fontFamily={FONTS.mono} fontWeight={500} fontSize={metreSize} textAnchor="middle">
                {mText}
              </text>
            </g>
            {showSec ? (
              <g transform={`translate(${sx} ${sy}) scale(${k})`}>
                <rect x={-pillW / 2} y={-pillH / 2} width={pillW} height={pillH} rx={pillH / 2} fill={PITCH.sky} opacity={0.85} />
                <text y={fontSize * 0.35} fill={secondsColor} fontFamily={FONTS.mono} fontWeight={500} fontSize={fontSize} textAnchor="middle">
                  {secText}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

// ---------------------------------------------------------------- the practice board
/** Numbered cue chips across the board: `pops` per chip (0..1), `active` chip lit by `lit` (0..1). */
export const NumberChips: React.FC<{ cues: string[]; y: number; pops: number[]; active: number; lit: number; size?: number; centre?: number }> = ({ cues, y, pops, active, lit, size = 32, centre = WIDTH / 2 }) => {
  const widths = cues.map((c) => c.length * size * 0.54 + 112);
  const gap = 26;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (cues.length - 1);
  let x = centre - total / 2;
  return (
    <g>
      {cues.map((c, i) => {
        const w = widths[i];
        const left = x;
        x += w + gap;
        const s = popT(pops[i] ?? 0);
        if (s <= 0.001) return null;
        const isActive = i === active;
        const o = isActive ? 1 : 1 - 0.4 * lit;
        const on = isActive && lit > 0.5;
        const bg = on ? XRAY.lime : "#1E4260";
        const fg = on ? PITCH.sky : PITCH.chalk;
        return (
          <g key={i} opacity={o} transform={`translate(${left + w / 2} ${y}) scale(${s * (isActive ? 1 + 0.06 * Math.sin(Math.PI * lit) : 1)}) translate(${-w / 2} 0)`}>
            <rect x={0} y={-32} width={w} height={64} rx={32} fill={bg} />
            <circle cx={40} cy={0} r={22} fill={on ? PITCH.sky : PITCH.light} />
            <text x={40} y={11} fill={on ? XRAY.lime : PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={30} textAnchor="middle">
              {i + 1}
            </text>
            <text x={78} y={12} fill={fg} fontFamily={FONTS.label} fontWeight={800} fontSize={size}>
              {c}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** A training cone standing in for Chalk: orange cone, chalk band, two dot eyes and one raised eyebrow. */
export const ConeChalk: React.FC<{ x: number; y: number; h: number; s: number; brow?: number }> = ({ x, y, h, s, brow = 1 }) => {
  const k = popT(s);
  if (k <= 0.001) return null;
  const w = h * 0.7;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <ellipse cx={0} cy={0} rx={w * 0.62} ry={w * 0.16} fill="#000" opacity={0.18} />
      <rect x={-w * 0.6} y={-h * 0.08} width={w * 1.2} height={h * 0.1} rx={h * 0.04} fill={CAST.ballShade} />
      <path d={`M${-w * 0.42},${-h * 0.05} L${-w * 0.1},${-h} Q0,${-h * 1.06} ${w * 0.1},${-h} L${w * 0.42},${-h * 0.05} Z`} fill={CAST.ball} />
      <path d={`M${-w * 0.3},${-h * 0.4} L${-w * 0.22},${-h * 0.62} L${w * 0.22},${-h * 0.62} L${w * 0.3},${-h * 0.4} Z`} fill={PITCH.chalk} opacity={0.9} />
      {/* Eyes on the band and one raised chalk eyebrow. */}
      <circle cx={-w * 0.1} cy={-h * 0.51} r={h * 0.03} fill={CAST.keeperEye} />
      <circle cx={w * 0.1} cy={-h * 0.51} r={h * 0.03} fill={CAST.keeperEye} />
      <line x1={w * 0.02} y1={-h * 0.72 - brow * h * 0.05} x2={w * 0.2} y2={-h * 0.72 - brow * h * 0.09} stroke={PITCH.chalk} strokeWidth={h * 0.035} strokeLinecap="round" opacity={brow} />
    </g>
  );
};

export type Proj = (x: number, y: number, z: number) => { x: number; y: number };

/**
 * An oblique ground projection for the drill panel: x along the wall line (pixels per metre `ppm`), +y away
 * from the viewer goes up and to the left, z up. (ox, gy) is the screen point of the origin.
 */
export const obliqueP = (ox: number, gy: number, ppm: number, kx = 0.45, ky = 0.35): Proj => (x, y, z) => ({ x: ox + x * ppm - y * ppm * kx, y: gy - z * ppm - y * ppm * ky });

/** A chalk square on the ground around (cx, cy) metres, drawn on by `draw`, in any ground projection. */
export const ChalkBox: React.FC<{ P: Proj; cx: number; cy: number; half: number; draw: number; color?: string; width?: number; opacity?: number }> = ({ P, cx, cy, half, draw, color = PITCH.chalk, width = 6, opacity = 0.9 }) => {
  const d = clamp01(draw);
  if (d <= 0.001) return null;
  const pts = [P(cx - half, cy + half, 0), P(cx + half, cy + half, 0), P(cx + half, cy - half, 0), P(cx - half, cy - half, 0)];
  const path = `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")} Z`;
  return <path d={path} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} {...trim(d)} />;
};

/** The practice wall: a block whose face is at x = faceX, spanning y in [-halfW, halfW], `height` metres tall. */
export const DrillWall: React.FC<{ P: Proj; faceX: number; halfW: number; height: number; thick?: number }> = ({ P, faceX, halfW, height, thick = 0.5 }) => {
  const q = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
  const face = [P(faceX, halfW, 0), P(faceX, -halfW, 0), P(faceX, -halfW, height), P(faceX, halfW, height)];
  const end = [P(faceX, -halfW, 0), P(faceX - thick, -halfW, 0), P(faceX - thick, -halfW, height), P(faceX, -halfW, height)];
  const top = [P(faceX, halfW, height), P(faceX, -halfW, height), P(faceX - thick, -halfW, height), P(faceX - thick, halfW, height)];
  const seams: React.ReactNode[] = [];
  for (let i = 1; i < 6; i++) {
    const yy = -halfW + (2 * halfW * i) / 6;
    const a = P(faceX, yy, 0);
    const b = P(faceX, yy, height);
    seams.push(<line key={`s${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={PITCH.stands} strokeWidth={2} opacity={0.5} />);
  }
  const shade = [P(faceX, halfW, 0), P(faceX, -halfW, 0), P(faceX + 0.3, -halfW, 0), P(faceX + 0.3, halfW, 0)];
  return (
    <g>
      <path d={q(shade)} fill={PITCH.grassDark} opacity={0.7} />
      <path d={q(face)} fill="#3A4585" />
      {seams}
      <path d={q(top)} fill="#4A5699" />
      <path d={q(end)} fill={PITCH.standsLight} />
    </g>
  );
};

/** A band of stand seats along the far touchline of a panel: roof line and three seat rows. */
export const StandBand: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-40} y={0} width={w + 80} height={h} fill={PITCH.stands} />
    <rect x={-40} y={-6} width={w + 80} height={16} rx={8} fill={PITCH.standsLight} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={-20 - i * 10} y={h * 0.28 + i * h * 0.22} width={w + 40 + i * 20} height={h * 0.11} rx={h * 0.055} fill={PITCH.standsLight} opacity={0.85} />
    ))}
    <rect x={-40} y={h - 10} width={w + 80} height={12} fill="#252C66" />
  </g>
);

/** A small ring icon for the board: colour from the seconds, `s` pops it, `flash` glows it briefly. */
export const RingIcon: React.FC<{ x: number; y: number; r?: number; seconds: number; s: number; flash?: number; pulse?: number }> = ({ x, y, r = 30, seconds, s, flash = 0, pulse = 1 }) => {
  const k = popT(s);
  if (k <= 0.001) return null;
  const color = bubbleColor(seconds);
  return (
    <g transform={`translate(${x} ${y}) scale(${k * (1 + 0.2 * flash)})`} opacity={pulse}>
      {flash > 0.001 ? <circle r={r * 2.2} fill={color} opacity={0.25 * flash} /> : null}
      <circle r={r} fill={color} opacity={0.15} />
      <circle r={r} fill="none" stroke={color} strokeWidth={5} />
      <circle r={r * 0.98} fill="none" stroke={color} strokeWidth={2} strokeDasharray={`${r * 0.12} ${r * 0.08}`} opacity={0.5} />
      <circle r={6} fill={color} />
    </g>
  );
};

/** Hazard lights for the first car of the kit CarPark (its local coordinates, x0 = 0): two orange lamps. */
export const HazardLights: React.FC<{ ppm: number; on: number }> = ({ ppm, on }) => {
  const cx = 7 * ppm;
  return (
    <g transform={`translate(${cx} 0)`}>
      {[-2.08, 1.96].map((lx, i) => (
        <g key={i}>
          <rect x={lx * ppm} y={-0.95 * ppm} width={0.12 * ppm} height={0.2 * ppm} rx={0.05 * ppm} fill={PITCH.accent} opacity={0.35 + 0.65 * on} />
          {on > 0.01 ? (
            <g opacity={on}>
              <circle cx={(lx + 0.06) * ppm} cy={-0.85 * ppm} r={1.3 * ppm} fill={PITCH.light} opacity={0.16} />
              <circle cx={(lx + 0.06) * ppm} cy={-0.85 * ppm} r={0.8 * ppm} fill={PITCH.light} opacity={0.24} />
              <circle cx={(lx + 0.06) * ppm} cy={-0.85 * ppm} r={0.4 * ppm} fill={PITCH.light} opacity={0.4} />
            </g>
          ) : null}
        </g>
      ))}
    </g>
  );
};

/** The same pose on the other leg: the far leg takes the near leg's angles (a left-foot rep). */
export const swapLegs = (p: Pose): Pose => ({
  ...p,
  nearHip: p.farHip,
  nearKnee: p.farKnee,
  nearAnkle: p.farAnkle,
  farHip: p.nearHip,
  farKnee: p.nearKnee,
  farAnkle: p.nearAnkle,
  nearShoulder: p.farShoulder,
  nearElbow: p.farElbow,
  farShoulder: p.nearShoulder,
  farElbow: p.nearElbow,
});

type DrillPt = { x: number; y: number };

/**
 * Top-view mini map of the wall drill for the docked card: the wall on top, Tavi's mark 5 m below it,
 * the cone 3 m to one side, the 2 m box and the touch-out arrow away from the cone. (x, y) = top-left.
 * `ball` and `trail` are live drill positions in the side view's pitch metres (x towards the wall is
 * negative, y to the side, the cone at y -3); `taviY` is her spot along y. The map turns the drill a
 * quarter turn so the wall is on top: pitch -x is up, pitch +y is right.
 */
export const DrillMiniMap: React.FC<{ x: number; y: number; w: number; coneT: number; boxT: number; arrowT: number; opacity?: number; ball?: DrillPt; trail?: DrillPt[]; taviY?: number; wallD?: number }> = ({
  x,
  y,
  w,
  coneT,
  boxT,
  arrowT,
  opacity = 1,
  ball,
  trail = [],
  taviY = 0,
  wallD = 5,
}) => {
  if (opacity <= 0.001) return null;
  const ppm = 30;
  const wallY = 40;
  const faceY = wallY + 12;
  const cx = w / 2 - 20;
  const M = (px: number, py: number) => ({ x: cx + py * ppm, y: faceY + (px + wallD) * ppm });
  const mark = M(0, 0);
  const cone = M(0, -3);
  const half = 1 * ppm;
  const box = clamp01(boxT);
  const arrow = clamp01(arrowT);
  const rowY = M(-0.3, 0).y;
  const ax1 = mark.x + 0.5 * ppm;
  const ax2 = mark.x + (0.5 + 2.0 * arrow) * ppm;
  const b = ball ? M(ball.x, ball.y) : M(-0.3, 0);
  const t = M(0, taviY);
  const h = mark.y + 50;
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <rect x={0} y={0} width={w} height={h} rx={26} fill="#16324B" />
      <rect x={40} y={wallY - 12} width={w - 80} height={24} rx={8} fill="#3A4585" />
      <text x={w / 2} y={wallY - 20} fill={PITCH.chalk} opacity={0.75} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
        WALL
      </text>
      {/* 5 m tick line from the wall to the mark. */}
      <line x1={mark.x - 40} y1={faceY + 4} x2={mark.x - 40} y2={mark.y - 6} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="4 12" strokeLinecap="round" opacity={0.5} />
      <text x={mark.x - 58} y={faceY + 2.6 * ppm} fill={PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={32} opacity={0.85} textAnchor="end">
        5 m
      </text>
      {box > 0.001 ? <rect x={mark.x - half} y={mark.y - half} width={half * 2} height={half * 2} rx={6} fill="none" stroke={PITCH.chalk} strokeWidth={5} strokeLinecap="round" opacity={0.9} {...trim(box)} /> : null}
      {coneT > 0.001 ? (
        <g transform={`translate(${cone.x} ${cone.y}) scale(${popT(coneT)})`}>
          <path d="M-14,10 L-5,-18 L5,-18 L14,10 Z" fill={CAST.ball} />
          <rect x={-16} y={8} width={32} height={7} rx={3} fill={CAST.ballShade} />
          <line x1={-3} y1={-24} x2={6} y2={-27} stroke={PITCH.chalk} strokeWidth={3} strokeLinecap="round" />
        </g>
      ) : null}
      {/* The aim: drawn before the touch, on the ball's row. */}
      {arrow > 0.001 ? (
        <g opacity={0.75}>
          <line x1={ax1} y1={rowY} x2={ax2} y2={rowY} stroke={XRAY.lime} strokeWidth={7} strokeLinecap="round" />
          <path d={`M${ax2 + 10},${rowY} L${ax2 - 8},${rowY - 12} L${ax2 - 8},${rowY + 12} Z`} fill={XRAY.lime} />
        </g>
      ) : null}
      {/* Tavi's dot: teal shirt, a head, following her spot. */}
      <g transform={`translate(${t.x} ${t.y + 12})`}>
        <rect x={-14} y={-6} width={28} height={12} rx={6} fill={CAST.shirt} />
        <circle r={7} fill={CAST.skin} />
      </g>
      {/* The live ball and a short fading trail. */}
      {trail.map((p, i) => {
        const q = M(p.x, p.y);
        return <circle key={i} cx={q.x} cy={q.y} r={11 - i * 2} fill={CAST.ball} opacity={0.35 - i * 0.08} />;
      })}
      <circle cx={b.x} cy={b.y} r={12} fill={CAST.ball} />
    </g>
  );
};
