// Graphics for b07 (the Open Sky evidence beat) and b08 (the LOOK practice board): drifting clouds, a chalk
// 4v4 mini pitch with grey tokens and a camera, the price tag, the polaroid film strip, the chalk plus and
// strike, board cue chips, note lines, the safety strip, the call tally and top-down cones.

import React from "react";
import { EASE, clamp01, idle, pop, popSoft, progress, visible } from "../../lib/anim";
import { trim } from "../ep2/chalk";
import { CAST, FONTS, PITCH, SKY, XRAY } from "../../theme";

// ---------- Open Sky ----------
/** Flat clouds that drift slowly. Two shades, no outlines. */
export const Clouds: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 1 }) => {
  const clouds = [
    { x: 260, y: 170, s: 1.1, v: 0.18 },
    { x: 1500, y: 120, s: 0.85, v: 0.14 },
    { x: 900, y: 940, s: 1.3, v: 0.1 },
    { x: 1750, y: 820, s: 0.9, v: 0.16 },
  ];
  return (
    <g opacity={opacity}>
      {clouds.map((c, i) => {
        const x = ((c.x + frame * c.v + 300) % 2500) - 300;
        const y = c.y + idle(frame, i, 6, 4);
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${c.s})`}>
            <ellipse cx={0} cy={10} rx={150} ry={34} fill={SKY.cloudShade} opacity={0.55} />
            <ellipse cx={-40} cy={-6} rx={80} ry={40} fill={SKY.cloud} opacity={0.9} />
            <ellipse cx={40} cy={-2} rx={95} ry={46} fill={SKY.cloud} opacity={0.9} />
            <ellipse cx={-90} cy={10} rx={60} ry={30} fill={SKY.cloud} opacity={0.9} />
          </g>
        );
      })}
    </g>
  );
};

/** Study token greys: a light team and a mid-grey team, both clear on the dark study pitch. */
const TOKEN_GREY = {
  light: { body: SKY.cloud, head: "#D5E2F0" },
  dark: { body: "#AEB9CB", head: "#8E9BB2" },
};

/**
 * A grey top-down token for the study's players: a disc, a head and a nose tick. `look` turns the head.
 * `wedge` (0..1) draws a lime look wedge from the head, so a quick head flick reads at a distance.
 */
export const GreyToken: React.FC<{ x: number; y: number; facing: number; look?: number; shade?: "light" | "dark"; size?: number; opacity?: number; wedge?: number }> = ({ x, y, facing, look = 0, shade = "light", size = 40, opacity = 1, wedge = 0 }) => {
  const { body, head } = TOKEN_GREY[shade];
  const hr = size * 0.27;
  const wl = size * 1.9;
  const wa = (22 * Math.PI) / 180;
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      {wedge > 0.01 ? (
        <g transform={`rotate(${facing + look})`} opacity={wedge}>
          <path d={`M0,0 L${wl * Math.cos(wa)},${-wl * Math.sin(wa)} A${wl},${wl} 0 0 1 ${wl * Math.cos(wa)},${wl * Math.sin(wa)} Z`} fill={XRAY.lime} opacity={0.4} />
        </g>
      ) : null}
      <ellipse cx={3} cy={4} rx={size * 0.55} ry={size * 0.32} fill={SKY.deep} opacity={0.3} />
      <g transform={`rotate(${facing})`}>
        <rect x={-size * 0.22} y={-size / 2} width={size * 0.44} height={size} rx={size * 0.22} fill={body} />
      </g>
      <g transform={`rotate(${facing + look})`}>
        <circle r={hr} fill={head} />
        <path d={`M${hr * 0.9},${-hr * 0.2} L${hr * 1.25},0 L${hr * 0.9},${hr * 0.2} Z`} fill={head} />
        <circle cx={hr * 0.55} cy={-hr * 0.3} r={hr * 0.12} fill={SKY.deep} />
        <circle cx={hr * 0.55} cy={hr * 0.3} r={hr * 0.12} fill={SKY.deep} />
      </g>
    </g>
  );
};

/** A chalk video camera on a tripod, drawn on with `t`. */
export const CameraIcon: React.FC<{ x: number; y: number; t: number; color?: string; scale?: number }> = ({ x, y, t, color = PITCH.chalk, scale = 1 }) => {
  if (t <= 0.002) return null;
  const st = { fill: "none", stroke: color, strokeWidth: 6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const a = clamp01(t * 1.6);
  const b = clamp01(t * 1.6 - 0.6);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0,0 L-34,70 M0,0 L34,70 M0,0 L0,72" {...st} {...trim(a)} />
      <path d="M-34,-40 L26,-40 L26,-2 L-34,-2 Z M26,-30 L46,-40 L46,-4 L26,-14" {...st} {...trim(b)} />
      {b > 0.9 ? <circle cx={-18} cy={-52} r={5} fill={CAST.mistake} opacity={0.6 + 0.4 * Math.sin(t * 40)} /> : null}
    </g>
  );
};

/**
 * The study's 4v4 pitch in chalk: outline, halfway line, two small goals, eight grey tokens and the
 * camera. `drawT` draws it on. A pass rolls from token 2 to token 5; token 5 looks over its shoulder
 * before the ball arrives (`look` degrees, from the scene). `ballT` is the ball's 0..1 travel.
 */
/** The study pitch's tokens in pitch-local pixels (640 x 400 box centred on 0,0). */
export const MINI_TOKENS: { x: number; y: number; f: number; shade: "light" | "dark" }[] = [
  { x: -230, y: -110, f: 10, shade: "light" },
  { x: -120, y: 60, f: 30, shade: "light" },
  { x: -220, y: 120, f: 0, shade: "light" },
  { x: -40, y: -60, f: 40, shade: "light" },
  { x: 60, y: 120, f: 200, shade: "dark" },
  { x: 130, y: -70, f: 170, shade: "dark" },
  { x: 240, y: 40, f: 190, shade: "dark" },
  { x: 220, y: -130, f: 160, shade: "dark" },
];
/** Passer (token 2) and receiver (token 5) of the study pass, pitch-local. */
export const MINI_PASSER = MINI_TOKENS[2];
export const MINI_RECEIVER = MINI_TOKENS[5];

export const MiniPitch4v4: React.FC<{ frame: number; drawT: number; tokensT: number; ball?: { t: number }; look: number; eye?: React.ReactNode; opacity?: number; tokenSize?: number; lookWedge?: number }> = ({
  frame,
  drawT,
  tokensT,
  ball,
  look,
  eye,
  opacity = 1,
  tokenSize = 58,
  lookWedge = 0,
}) => {
  const W = 640;
  const H = 400;
  const st = { fill: "none", stroke: PITCH.chalk, strokeWidth: 6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const tokens = MINI_TOKENS;
  const passer = MINI_PASSER;
  const receiver = MINI_RECEIVER;
  const bx = ball ? passer.x + (receiver.x - passer.x) * ball.t : passer.x;
  const by = ball ? passer.y + (receiver.y - passer.y) * ball.t : passer.y;
  const [o1, o2, o3] = [clamp01(drawT * 1.5), clamp01(drawT * 1.5 - 0.35), clamp01(drawT * 1.5 - 0.5)];
  return (
    <g opacity={opacity}>
      {/* A dark chalkboard fill under the pitch, so the grey tokens stand out from the sky. */}
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={18} fill={SKY.deep} opacity={0.5 * clamp01(drawT * 2)} />
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={18} {...st} {...trim(o1)} />
      <path d={`M0,${-H / 2} L0,${H / 2}`} {...st} {...trim(o2)} />
      <path d={`M${-W / 2},-50 L${-W / 2 - 26},-50 L${-W / 2 - 26},50 L${-W / 2},50`} {...st} {...trim(o3)} />
      <path d={`M${W / 2},-50 L${W / 2 + 26},-50 L${W / 2 + 26},50 L${W / 2},50`} {...st} {...trim(o3)} />
      <CameraIcon x={W / 2 + 90} y={-H / 2 + 10} t={clamp01(drawT * 1.5 - 0.5)} scale={0.9} />
      {tokens.map((tk, i) => {
        const s = popSoft(frame, 0) * clamp01(tokensT * 8 - i);
        if (s <= 0.001) return null;
        const sway = idle(frame, i, 3 + i * 0.3, 3);
        const isR = i === 5;
        return (
          <g key={i} transform={`translate(${tk.x} ${tk.y}) scale(${popSoftT(clamp01(tokensT * 8 - i))})`}>
            <GreyToken x={0} y={0} facing={tk.f + sway} look={isR ? look : 0} shade={tk.shade} size={isR ? tokenSize * 1.15 : tokenSize} wedge={isR ? lookWedge : 0} />
          </g>
        );
      })}
      {ball ? (
        <g>
          <circle cx={bx + 2} cy={by + 3} r={14} fill={SKY.deep} opacity={0.3} />
          <circle cx={bx} cy={by} r={14} fill={CAST.ball} />
          <circle cx={bx - 4} cy={by - 4} r={5} fill={CAST.ballRim} opacity={0.8} />
        </g>
      ) : null}
      {eye ? <g transform={`translate(${receiver.x} ${receiver.y})`}>{eye}</g> : null}
    </g>
  );
};

/** Pop with overshoot from a 0..1 value. */
const popSoftT = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : EASE.back(t));

/**
 * A chalk price tag reading FREE. (x, y) is the hole the string runs through: the string rises to an
 * anchor above-left, the tag hangs to the right and swings about the hole.
 */
export const PriceTag: React.FC<{ x: number; y: number; at: number; frame: number; swing?: number }> = ({ x, y, at, frame, swing = 7 }) => {
  const s = pop(frame, at, { stiffness: 180, damping: 12 });
  if (s <= 0.001) return null;
  const rot = swing * Math.sin((frame - at) / 6) * Math.exp(-(frame - at) / 40);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0,0 Q-12,-40 -16,-72" fill="none" stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" />
      <g transform={`rotate(${rot})`}>
        <path d="M0,-24 L128,-24 L154,0 L128,24 L0,24 Q-18,24 -18,6 L-18,-6 Q-18,-24 0,-24 Z" fill={PITCH.chalk} />
        <circle cx={0} cy={0} r={5.5} fill={SKY.mid} />
        <text x={70} y={11} fill={SKY.deep} fontFamily={FONTS.title} fontWeight={800} fontSize={32} textAnchor="middle" letterSpacing={2}>
          FREE
        </text>
      </g>
    </g>
  );
};

/** Dozens of small polaroids rattle along a strip at y, right to left, on a loop so the strip is always full. No digits. */
export const FilmStrip: React.FC<{ y: number; at: number; frame: number; until?: number; speed?: number }> = ({ y, at, frame, until, speed = 9 }) => {
  const o = visible(frame, at, until, 10, 8);
  if (o <= 0.001) return null;
  const gap = 92;
  const loop = 2300;
  const n = Math.floor(loop / gap);
  const travel = (frame - at) * speed;
  return (
    <g opacity={o}>
      <rect x={-100} y={y - 62} width={2120} height={124} fill={SKY.deep} opacity={0.94} />
      {Array.from({ length: 2 }, (_, k) =>
        Array.from({ length: 26 }, (_, i) => <rect key={`${k}-${i}`} x={-60 + i * 84 - (travel % 84)} y={k ? y + 44 : y - 54} width={14} height={10} rx={3} fill={SKY.mid} opacity={0.55} />),
      )}
      {Array.from({ length: n }, (_, i) => {
        const x = ((((i * gap - travel) % loop) + loop) % loop) - 150;
        if (x < -80 || x > 2000) return null;
        const rattle = Math.sin(frame / 2 + i) * 3;
        const tilt = Math.sin(i * 1.7) * 5 + rattle * 0.6;
        return (
          <g key={i} transform={`translate(${x} ${y + rattle}) rotate(${tilt})`}>
            <rect x={-32} y={-30} width={64} height={66} rx={5} fill={PITCH.chalk} />
            <rect x={-25} y={-23} width={50} height={40} fill={PITCH.grassDark} />
            <circle cx={4 + Math.sin(i * 2.3) * 8} cy={-4 + Math.cos(i * 1.3) * 6} r={5} fill={PITCH.chalk} opacity={0.9} />
          </g>
        );
      })}
    </g>
  );
};

/** A chalk plus sign that pops and glows once, and exits (fast) from `until`. */
export const ChalkPlus: React.FC<{ x: number; y: number; at: number; frame: number; size?: number; until?: number }> = ({ x, y, at, frame, size = 34, until }) => {
  const s = pop(frame, at, { stiffness: 200, damping: 13 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const glow = Math.sin(Math.PI * clamp01((frame - at - 4) / 22));
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {glow > 0.01 ? (
        <g opacity={glow}>
          <circle r={size * 2.2} fill={XRAY.lime} opacity={0.18} />
          <circle r={size * 1.5} fill={XRAY.lime} opacity={0.25} />
        </g>
      ) : null}
      <rect x={-size} y={-9} width={size * 2} height={18} rx={9} fill={PITCH.chalk} />
      <rect x={-9} y={-size} width={18} height={size * 2} rx={9} fill={PITCH.chalk} />
    </g>
  );
};

/** A soft pink strike across a point, drawn on with `t`. */
export const Strike: React.FC<{ x: number; y: number; t: number; len?: number; angle?: number }> = ({ x, y, t, len = 120, angle = -28 }) => {
  if (t <= 0.002) return null;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={`M${-len / 2},0 L${len / 2},0`} fill="none" stroke={CAST.mistake} strokeWidth={10} strokeLinecap="round" opacity={0.9} {...trim(t)} />
    </g>
  );
};

// ---------- Practice board ----------
/** A row of cue chips across the board. `lit[i]` is the frame chip i lights up (lime). */
export const CueChips: React.FC<{ frame: number; y: number; at: number; cues: string[]; lit: (number | undefined)[]; x0?: number; x1?: number }> = ({ frame, y, at, cues, lit, x0 = 130, x1 = 1710 }) => {
  const size = 32;
  const gap = 28;
  const widths = cues.map((c) => c.length * size * 0.56 + 84);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (cues.length - 1);
  let x = (x0 + x1) / 2 - total / 2;
  return (
    <g>
      {cues.map((c, i) => {
        const w = widths[i];
        const left = x;
        x += w + gap;
        const s = popSoft(frame, at + i * 5);
        if (s <= 0.001) return null;
        const l = lit[i] === undefined ? 0 : progress(frame, lit[i] as number, 10, EASE.standard);
        const bump = 1 + 0.08 * Math.sin(Math.PI * l);
        return (
          <g key={i} transform={`translate(${left + w / 2} ${y}) scale(${s * bump}) translate(${-w / 2} 0)`}>
            <rect x={0} y={-30} width={w} height={60} rx={30} fill="#1E4260" />
            {l > 0.01 ? <rect x={0} y={-30} width={w} height={60} rx={30} fill={XRAY.lime} opacity={l} /> : null}
            <circle cx={38} cy={0} r={11} fill={l > 0.5 ? PITCH.sky : XRAY.lime} opacity={l > 0.5 ? 1 : 0.7} />
            <text x={64} y={11} fill={l > 0.5 ? PITCH.sky : PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={size}>
              {c}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** One note line on the board (slides in, slides out when replaced). */
export const NoteLine: React.FC<{ frame: number; x: number; y: number; text: string; at: number; until?: number; size?: number; color?: string; dot?: string }> = ({ frame, x, y, text, at, until, size = 36, color = PITCH.chalk, dot }) => {
  const o = visible(frame, at, until, 12, 7);
  if (o <= 0.001) return null;
  return (
    <g opacity={o} transform={`translate(${(1 - o) * 26} 0)`}>
      {dot ? <circle cx={x + 10} cy={y - size * 0.34} r={9} fill={dot} /> : null}
      <text x={x + (dot ? 34 : 0)} y={y} fill={color} fontFamily={FONTS.label} fontWeight={800} fontSize={size}>
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

/** A tally row: a lime tick or a pink cross (drawn on at `markAt`) beside a short text. */
export const TallyRow: React.FC<{ frame: number; x: number; y: number; text: string; at: number; kind: "tick" | "cross"; markAt?: number }> = ({ frame, x, y, text, at, kind, markAt }) => {
  const s = popSoft(frame, at);
  if (s <= 0.001) return null;
  const m = progress(frame, markAt ?? at, 10, EASE.enter);
  const color = kind === "tick" ? XRAY.lime : CAST.mistake;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`}>
      <rect x={x - 22} y={y - 24} width={44} height={44} rx={12} fill={PITCH.skyHigh} opacity={0.8} />
      {kind === "tick" ? (
        <path d="M-13,0 L-4,9 L13,-9" transform={`translate(${x} ${y - 2})`} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" {...trim(m)} />
      ) : (
        <g transform={`translate(${x} ${y - 2})`} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round">
          <path d="M-11,-11 L11,11" {...trim(clamp01(m * 2))} />
          <path d="M11,-11 L-11,11" {...trim(clamp01(m * 2 - 1))} />
        </g>
      )}
      <text x={x + 36} y={y + 10} fill={m > 0.5 ? color : PITCH.lightSoft} fontFamily={FONTS.label} fontWeight={800} fontSize={32}>
        {text}
      </text>
    </g>
  );
};

/** A flat top-down training cone: a disc with a lighter centre and a soft shadow. */
export const ConeTop: React.FC<{ x: number; y: number; color: string; at: number; frame: number; r?: number }> = ({ x, y, color, at, frame, r = 22 }) => {
  const s = pop(frame, at, { stiffness: 240, damping: 13 });
  if (s <= 0.001) return null;
  const light = color === PITCH.chalk ? PITCH.lightSoft : CAST.ballRim;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={3} cy={5} rx={r * 1.05} ry={r * 0.8} fill="#000" opacity={0.25} />
      <circle r={r} fill={color} />
      <circle r={r * 0.46} fill={light} opacity={0.85} />
    </g>
  );
};

/** A small "SLOW MOTION" pill inside a panel (32 px text). */
export const SlowPill: React.FC<{ x: number; y: number; at: number; until?: number; frame: number }> = ({ x, y, at, until, frame }) => {
  const o = visible(frame, at, until);
  if (o <= 0.001) return null;
  const pulse = 0.6 + 0.4 * Math.sin(frame / 5);
  return (
    <g opacity={o} transform={`translate(${x} ${y})`}>
      <rect width={296} height={50} rx={25} fill={PITCH.skyHigh} opacity={0.85} />
      <circle cx={28} cy={25} r={9} fill={CAST.mistake} opacity={pulse} />
      <text x={50} y={36} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={3}>
        SLOW MOTION
      </text>
    </g>
  );
};

/** A ring icon for the board corner: pink, then lime. `size` scales it (1 = 40 px across when pink). */
export const RingIcon: React.FC<{ x: number; y: number; at: number; limeAt: number; frame: number; size?: number }> = ({ x, y, at, limeAt, frame, size = 1 }) => {
  const s = popSoft(frame, at) * size;
  if (s <= 0.001) return null;
  const k = progress(frame, limeAt, 10, EASE.standard);
  const color = k > 0.5 ? XRAY.lime : CAST.mistake;
  const r = 20 + 10 * k;
  const pulse = k < 0.5 ? 0.75 + 0.25 * Math.sin(frame / 2.5) : 1;
  const bump = 1 + 0.25 * Math.sin(Math.PI * k);
  return (
    <g transform={`translate(${x} ${y}) scale(${s * bump})`} opacity={pulse}>
      <circle r={r} fill={color} opacity={0.18} />
      <circle r={r} fill="none" stroke={color} strokeWidth={4} />
      <circle r={5} fill={color} />
    </g>
  );
};
