// Shared top-down "pass world" for b06-b08: the pass in from Sam (x = -12) to Tavi's mark, Chalk chasing
// from (10.9, -1.5), a fixed map scale, a playback clock that can freeze, and the small map graphics
// (snapshot pictures, the thought-bubble map, the b05 match cut, the eye icon). Sim frame: Tavi's mark is
// the origin, +x towards the goal (screen right), +y is her left when facing the goal (screen up).

import React from "react";
import { TopField } from "../Field";
import { TopPlayer, angleTo } from "../TopPlayer";
import { Ball } from "../Ball";
import { VisionFan } from "../Vision";
import { XRayHead } from "../ep2";
import { project, type View } from "../../lib/project";
import { EASE, clamp01, idle, pop, popSoft, progress } from "../../lib/anim";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { CHALK_START, SAM, chalkAt } from "../../physics/ep2sims";

// ---------- Map scale ----------
export const PPM = 66;
/** Tavi's mark along the pitch (pitch metres), so the edge of the box sits just past Chalk's start. */
export const MARK_PX = 76;
export const MARK = { x: 1040, y: 640 };
export const MAP_VIEW: View = { kind: "top", originX: MARK.x - MARK_PX * PPM, originY: MARK.y, ppm: PPM };
/** Sim metres (Tavi's mark at the origin) to screen pixels. */
export const S = (x: number, y: number) => {
  const p = project({ x: MARK_PX + x, y, z: 0 }, MAP_VIEW);
  return { x: p.x, y: p.y };
};
export const BALL_R = 20;
export const TOKEN = { tavi: 96, sam: 90, chalk: 100 };

// ---------- Playback clock ----------
/** [frame, speed]: the playback speed is linear between keys (1 = real time, 0 = frozen). */
export type SpeedKey = [number, number];

/** Sim seconds elapsed at `frame` (0 before the first key). */
export const clockAt = (frame: number, ks: SpeedKey[]) => {
  let t = 0;
  for (let i = 0; i < ks.length; i++) {
    const [f0, s0] = ks[i];
    if (frame <= f0) break;
    const next = ks[i + 1];
    if (!next) {
      t += s0 * (frame - f0);
      break;
    }
    const [f1, s1] = next;
    const e = Math.min(frame, f1);
    const se = s0 + (s1 - s0) * ((e - f0) / Math.max(1, f1 - f0));
    t += ((s0 + se) / 2) * (e - f0);
  }
  return t / 30;
};

/** First frame (quarter-frame steps) where the clock reaches `tau` seconds. */
export const frameAtTau = (tau: number, ks: SpeedKey[], maxFrame = 1200) => {
  let f = ks[0][0];
  while (clockAt(f, ks) < tau && f < maxFrame) f += 0.25;
  return f;
};

/** Playback speed at a frame (for a "paused" indicator). */
export const speedAt = (frame: number, ks: SpeedKey[]) => {
  if (frame <= ks[0][0]) return 0;
  for (let i = 0; i < ks.length - 1; i++) {
    const [f0, s0] = ks[i];
    const [f1, s1] = ks[i + 1];
    if (frame <= f1) return s0 + (s1 - s0) * ((frame - f0) / Math.max(1, f1 - f0));
  }
  return ks[ks.length - 1][1];
};

/** A scan: the head turns away and back between t0 and t1 (seconds), peaking at `amount` degrees. */
export const scanLook = (tau: number, t0: number, t1: number, amount: number) => {
  const u = clamp01((tau - t0) / (t1 - t0));
  if (u <= 0 || u >= 1) return 0;
  // Fast out, a short hold at the top, back a little slower.
  const shaped = u < 0.4 ? EASE.enter(u / 0.4) : u < 0.55 ? 1 : 1 - EASE.standard((u - 0.55) / 0.45);
  return amount * shaped;
};

// ---------- The world ----------
export type WorldToken = { x: number; y: number };

type WorldProps = {
  frame: number;
  /** Tavi in sim metres, body facing and head look in screen degrees. */
  tavi: { x: number; y: number; facing: number; look: number };
  /** Chalk in sim metres (default: chalkAt(tau) towards the mark). `stride` 0..1 adds the run sway. */
  chalk?: (WorldToken & { stride?: number; facing?: number }) | null;
  tau?: number;
  /** Ball in sim metres (omit for no ball). */
  ball?: WorldToken | null;
  /** Ball rolled distance in metres (turns the Line). */
  rolled?: number;
  /** Vision fan on Tavi's head. `darken` dims everything outside it. `at` is the frame it grows in (negative: already there). */
  fan?: { darken?: boolean; radius?: number; at?: number } | false;
  /** Sam's kick nudge, 0..1 (he leans into the pass). */
  samKick?: number;
  /** Chalk's blinking eyes in the dark half. */
  darkEyes?: boolean;
  /** Name labels over Sam and Chalk. */
  labels?: boolean;
  /** Opacity of the name labels (fade them out without a pop). */
  labelOpacity?: number;
  /** Pitch x range (sim metres) to draw stripes over. */
  range?: [number, number];
  children?: React.ReactNode;
};

/** Blink: 1 open, 0 shut, a short shut every ~2.8 s. */
const blink = (frame: number, seed: number) => {
  const p = (frame + seed * 37) % 84;
  return p < 5 ? 0 : 1;
};

export const PassWorld: React.FC<WorldProps> = ({ frame, tavi, chalk, tau = 0, ball, rolled = 0, fan, samKick = 0, darkEyes = false, labels = false, labelOpacity = 0.9, range = [-16, 16], children }) => {
  const c = chalk === undefined ? { ...chalkAt(Math.max(0, tau)), stride: (Math.max(0, tau) * 3) % 1 } : chalk;
  const t = S(tavi.x, tavi.y);
  const samX = SAM.x - 0.45 + 0.3 * samKick;
  const s = S(samX, SAM.y + idle(frame, 3, 3.3, 0.02));
  const headAngle = tavi.facing + tavi.look;
  const breathe = 1 + idle(frame, 1, 2.8, 0.012);
  return (
    <g>
      <TopField view={MAP_VIEW} x0={MARK_PX + range[0]} x1={MARK_PX + range[1]} y0={-14} y1={14} lineOpacity={0.7} />
      {/* Sam, calm, facing Tavi. */}
      <TopPlayer x={s.x} y={s.y} size={TOKEN.sam} kind="sam" facing={angleTo(s.x, s.y, t.x, t.y) + idle(frame, 2, 4, 2)} />
      {labels && labelOpacity > 0.001 ? <NameTag x={s.x} y={s.y - TOKEN.sam * 0.78} text="Sam" opacity={labelOpacity} /> : null}
      {/* Chalk, chasing (or waiting) in the dark half. */}
      {c ? (
        (() => {
          const q = S(c.x, c.y);
          const facing = c.facing ?? angleTo(q.x, q.y, t.x, t.y);
          const moving = c.stride !== undefined && tau > 0.02;
          return (
            <g>
              <TopPlayer x={q.x} y={q.y} size={TOKEN.chalk} kind="chalk" facing={facing + (moving ? 0 : idle(frame, 4, 3.6, 3))} stride={moving ? c.stride : undefined} />
              {labels && labelOpacity > 0.001 ? <NameTag x={q.x} y={q.y - TOKEN.chalk * 0.78} text="Chalk" opacity={labelOpacity} /> : null}
            </g>
          );
        })()
      ) : null}
      {/* The ball, rolling along the pass line. */}
      {ball
        ? (() => {
            const b = S(ball.x, ball.y);
            return (
              <g>
                <ellipse cx={b.x + 3} cy={b.y + 4} rx={BALL_R * 1.05} ry={BALL_R * 0.8} fill="#000" opacity={0.2} />
                <Ball cx={b.x} cy={b.y} r={BALL_R} view={MAP_VIEW} axis={{ x: 0, y: -1, z: 0 }} angle={rolled / 0.11} lineNormal={{ x: 0.3, y: 0.2, z: 0.93 }} />
              </g>
            );
          })()
        : null}
      {children}
      {/* What Tavi's eyes cover; the rest of the pitch is dark to her. */}
      {fan ? (
        <VisionFan
          x={t.x}
          y={t.y}
          facing={headAngle}
          wideDeg={200}
          sharpDeg={5}
          radius={fan.radius ?? 900}
          at={fan.at ?? 0}
          color={PITCH.lightSoft}
          sharpColor={XRAY.lime}
          darkenOutside={fan.darken ? { x: -900, y: -900, w: 3700, h: 2900 } : undefined}
        />
      ) : null}
      {/* Chalk's eyes blink from the dark half, over the darkening. */}
      {c && darkEyes
        ? (() => {
            const q = S(c.x, c.y);
            const facing = c.facing ?? angleTo(q.x, q.y, t.x, t.y);
            const b = blink(frame, 1);
            return (
              <g transform={`translate(${q.x} ${q.y}) rotate(${facing})`}>
                <ellipse cx={TOKEN.chalk * 0.15} cy={-TOKEN.chalk * 0.085} rx={6} ry={6 * b} fill={PITCH.lightSoft} />
                <ellipse cx={TOKEN.chalk * 0.15} cy={TOKEN.chalk * 0.085} rx={6} ry={6 * b} fill={PITCH.lightSoft} />
              </g>
            );
          })()
        : null}
      {/* Tavi on top, never dimmed. */}
      <g transform={`translate(${t.x} ${t.y}) scale(${breathe}) translate(${-t.x} ${-t.y})`}>
        <TopPlayer x={t.x} y={t.y} size={TOKEN.tavi} kind="tavi" facing={tavi.facing} look={tavi.look} />
      </g>
    </g>
  );
};

/** A small name over a token: 32 px Nunito on a soft dark pill. */
export const NameTag: React.FC<{ x: number; y: number; text: string; opacity?: number }> = ({ x, y, text, opacity = 0.9 }) => {
  const w = text.length * 20 + 30;
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <rect x={-w / 2} y={-26} width={w} height={44} rx={22} fill={PITCH.skyHigh} opacity={0.55} />
      <text y={9} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={32} textAnchor="middle">
        {text}
      </text>
    </g>
  );
};

/** Chalk's start mark, for scenes that need it in screen pixels. */
export const CHALK_SCREEN = S(CHALK_START.x, CHALK_START.y);
/**
 * Screen bearing (degrees) from Tavi's mark to Chalk. He runs straight at the mark, so it is the same at
 * every scan: a scan look of CHALK_BEARING - facing puts the narrow sharp wedge right on his token.
 */
export const CHALK_BEARING = angleTo(S(0, 0).x, S(0, 0).y, CHALK_SCREEN.x, CHALK_SCREEN.y);

// ---------- Snapshot pictures ----------
/** The photo inside a Snapshot: grass, Chalk small, and (second look) a chalk arrow of his path. */
export const ChalkPhoto: React.FC<{ w?: number; h?: number; arrow?: boolean; stride?: number; facing?: number; cone?: string }> = ({ w = 220, h = 150, arrow = false, stride, facing = 200, cone }) => (
  <g>
    {Array.from({ length: 5 }, (_, i) => (
      <rect key={i} x={(i * w) / 5} y={0} width={w / 5 + 1} height={h} fill={i % 2 ? PITCH.grass : PITCH.grassDark} />
    ))}
    <rect x={0} y={0} width={w} height={h} fill={PITCH.skyHigh} opacity={0.45} />
    {cone ? (
      <g transform={`translate(${w * 0.5} ${h * 0.52})`}>
        <ellipse cx={4} cy={6} rx={30} ry={22} fill="#000" opacity={0.25} />
        <circle r={28} fill={cone} />
        <circle r={13} fill={cone === PITCH.chalk ? PITCH.lightSoft : "#FFB38A"} opacity={0.9} />
      </g>
    ) : (
      <TopPlayer x={w * 0.55} y={h * 0.55} size={Math.min(w, h) * 0.5} kind="chalk" facing={facing} stride={stride} />
    )}
    {arrow ? <path d={`M${w * 0.82},${h * 0.3} L${w * 0.66},${h * 0.44} M${w * 0.7},${h * 0.3} L${w * 0.66},${h * 0.44} L${w * 0.8},${h * 0.48}`} fill="none" stroke={PITCH.chalk} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} /> : null}
  </g>
);

// ---------- The map in her head ----------
type MiniMapProps = {
  w: number;
  h: number;
  frame: number;
  /** Chalk dots in sim metres, each with the frame it lands. */
  dots: { x: number; y: number; at: number }[];
  /** Frame the path arrow draws between dot 0 and dot 1. */
  arrowAt?: number;
  /** Frame the Chalk dot pulses pink. */
  pulseAt?: number;
  /** Frame the lime space patch appears. */
  spaceAt?: number;
  /** Frame the fog clears and the full map (Sam, ball, Tavi) shows. */
  mapAt?: number;
  /** Ball x (sim metres) when the map completes. */
  ballX?: number;
  /** Stronger dots (for the frame-filling version). */
  scale?: number;
  /** Drawn over the map and under the dots: the fog of what she does not know yet. */
  fog?: React.ReactNode;
};

/** The open-space patch in the thought map, sim metres: her right side, up the screen, radius r. */
export const SPACE = { x: -1.0, y: 4.6, r: 2.5 };

/** A tiny top-down map: what two snapshots build. Draws in a w x h box at (0,0). */
export const MiniMap: React.FC<MiniMapProps> = ({ w, h, frame, dots, arrowAt, pulseAt, spaceAt, mapAt, ballX = -4, scale = 1.3, fog }) => {
  const k = w / 26; // px per metre: 26 m across (Sam at -12 .. Chalk at 11)
  const cx = w * 0.5;
  const cy = h * 0.56;
  const P = (x: number, y: number) => ({ x: cx + x * k, y: cy - y * k });
  const mapT = mapAt === undefined ? 0 : progress(frame, mapAt, 18, EASE.standard);
  const space = spaceAt === undefined ? 0 : popSoft(frame, spaceAt);
  const shimmer = spaceAt === undefined ? 0 : 0.7 + 0.3 * Math.sin((frame - spaceAt) / 3);
  const tavi = P(0, 0);
  const sam = P(SAM.x, 0);
  const ball = P(ballX, 0);
  const d1 = dots[0] ? P(dots[0].x, dots[0].y) : null;
  const d2 = dots[1] ? P(dots[1].x, dots[1].y) : null;
  const r = 9 * scale;
  return (
    <g>
      <rect width={w} height={h} rx={14} fill={PITCH.grassDark} />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={(i * w) / 6} y={0} width={w / 6} height={h} rx={i === 0 || i === 5 ? 14 : 0} fill={i % 2 ? PITCH.grass : PITCH.grassDark} opacity={0.9} />
      ))}
      {/* The open space away from Chalk: up the screen, on her right (he comes in on her left, below the pass
          line), clear of her dot and of the pass line, on the side the touch away goes (TOUCH_AWAY). */}
      {space > 0.01 ? (
        <g transform={`translate(${P(SPACE.x, SPACE.y).x} ${P(SPACE.x, SPACE.y).y}) scale(${space})`}>
          <circle r={SPACE.r * k} fill={XRAY.lime} opacity={0.3 * shimmer} />
          <circle r={SPACE.r * 0.68 * k} fill={XRAY.lime} opacity={0.45 * shimmer} />
        </g>
      ) : null}
      {/* Sam, the ball and Tavi appear when the fog clears. */}
      {mapT > 0.01 ? (
        <g opacity={mapT}>
          <line x1={sam.x} y1={sam.y} x2={ball.x} y2={ball.y} stroke={PITCH.chalk} strokeWidth={2.5} strokeDasharray="4 6" opacity={0.5} />
          <circle cx={sam.x} cy={sam.y} r={r * 1.1} fill="#FF7A3D" />
          <circle cx={ball.x} cy={ball.y} r={r * 0.7} fill={CAST.ball} />
          <circle cx={ball.x} cy={ball.y} r={r * 0.7} fill="none" stroke={CAST.ballLine} strokeWidth={1.5} />
          <circle cx={tavi.x} cy={tavi.y} r={r * 1.2} fill={CAST.shirt} />
          <circle cx={tavi.x} cy={tavi.y} r={r * 0.5} fill={CAST.skin} />
        </g>
      ) : null}
      {fog}
      {/* Chalk's path: a trail from dot 1 to dot 2, then an arrow past dot 2 that points at her. */}
      {d1 && d2 && arrowAt !== undefined
        ? (() => {
            const tA = progress(frame, arrowAt, 16, EASE.enter);
            if (tA <= 0.001) return null;
            const ux = tavi.x - d2.x;
            const uy = tavi.y - d2.y;
            const ul = Math.max(1, Math.hypot(ux, uy));
            const hd = 11 * scale;
            // The tip sits clear of dot 2 and stops well short of her dot.
            const tipLen = Math.min(r + 2.2 * k + hd, ul - r * 1.3 - hd);
            const ang = Math.atan2(uy, ux);
            const seg1 = Math.min(1, tA * 1.6);
            const seg2 = Math.max(0, tA * 1.6 - 0.6);
            const ex = d2.x + Math.cos(ang) * tipLen * seg2;
            const ey = d2.y + Math.sin(ang) * tipLen * seg2;
            return (
              <g opacity={0.95}>
                <line x1={d1.x} y1={d1.y} x2={d1.x + (d2.x - d1.x) * seg1} y2={d1.y + (d2.y - d1.y) * seg1} stroke={PITCH.chalk} strokeWidth={3.5 * scale} strokeLinecap="round" />
                {seg2 > 0.001 ? (
                  <g>
                    <line x1={d2.x} y1={d2.y} x2={ex - Math.cos(ang) * hd * 0.5} y2={ey - Math.sin(ang) * hd * 0.5} stroke={PITCH.chalk} strokeWidth={3.5 * scale} strokeLinecap="round" />
                    <path d={`M${ex + Math.cos(ang) * hd * 0.6},${ey + Math.sin(ang) * hd * 0.6} L${ex + Math.cos(ang + 2.5) * hd},${ey + Math.sin(ang + 2.5) * hd} L${ex + Math.cos(ang - 2.5) * hd},${ey + Math.sin(ang - 2.5) * hd} Z`} fill={PITCH.chalk} />
                  </g>
                ) : null}
              </g>
            );
          })()
        : null}
      {dots.map((d, i) => {
        const q = P(d.x, d.y);
        const s = popSoft(frame, d.at);
        if (s <= 0.001) return null;
        const pulse = pulseAt !== undefined && i === dots.length - 1 ? (frame - pulseAt) / 22 : -1;
        return (
          <g key={i} transform={`translate(${q.x} ${q.y})`}>
            {pulse >= 0 && pulse <= 1 ? <circle r={r + 30 * pulse} fill="none" stroke={CAST.mistake} strokeWidth={4} opacity={1 - pulse} /> : null}
            <g transform={`scale(${s})`}>
              <circle r={r} fill={PITCH.chalk} />
              {pulseAt !== undefined && frame >= pulseAt ? <circle r={r * 0.55} fill={CAST.mistake} opacity={0.9} /> : <circle r={r * 0.35} fill={PITCH.sky} opacity={0.6} />}
            </g>
          </g>
        );
      })}
    </g>
  );
};

// ---------- The hand-off from b05 ----------
/**
 * How b05 leaves its last frame: camera (970, 546, zoom 1.04), the X-ray head at world (600, 730), r 150, a lime
 * ring r 280 that is 11 frames into its pop (TimeBubble spring 140/15), so it still overshoots a little.
 */
export const B05_END = { cam: { x: 970, y: 546, zoom: 1.04 }, head: { x: 600, y: 730, r: 150 }, ring: 280, ringPopFrames: 11 };
const b05Screen = (x: number, y: number) => ({
  x: (x - B05_END.cam.x) * B05_END.cam.zoom + WIDTH / 2,
  y: (y - B05_END.cam.y) * B05_END.cam.zoom + HEIGHT / 2,
});

/**
 * The match cut from b05 (screen space). Frame 0 repeats b05's last frame: the teal grid, the head from above
 * and its lime ring. Then the grid dissolves to the map, the head turns to face Sam and shrinks into Tavi's
 * token at `to`, and the ring rides in with it and fades. About `dur` frames.
 */
export const XRayMatchCut: React.FC<{ frame: number; to: { x: number; y: number }; tokenR: number; dur?: number }> = ({ frame, to, tokenR, dur = 16 }) => {
  if (frame > dur + 14) return null;
  const z = B05_END.cam.zoom;
  const m = progress(frame, 0, dur, EASE.standard);
  const gridO = 1 - progress(frame, 1, 10, EASE.standard);
  const h0 = b05Screen(B05_END.head.x, B05_END.head.y);
  const r0 = B05_END.head.r * z;
  const x = h0.x + (to.x - h0.x) * m;
  const y = h0.y + (to.y - h0.y) * m;
  const size = r0 + (tokenR - r0) * m;
  const headO = 1 - progress(frame, dur * 0.45, dur * 0.55, EASE.standard);
  const ring0 = B05_END.ring * z * pop(B05_END.ringPopFrames, 0, { stiffness: 140, damping: 15 });
  const ringR = ring0 + (tokenR * 1.6 - ring0) * m;
  const ringO = 1 - progress(frame, dur - 2, 14, EASE.exit);
  // The grid as b05's camera draws it: world lines every 60 px.
  const step = 60 * z;
  const o = b05Screen(0, 0);
  const x0 = ((o.x % step) + step) % step;
  const y0 = ((o.y % step) + step) % step;
  const lines: React.ReactNode[] = [];
  for (let gx = x0; gx <= WIDTH; gx += step) lines.push(<line key={`x${gx}`} x1={gx} y1={0} x2={gx} y2={HEIGHT} />);
  for (let gy = y0; gy <= HEIGHT; gy += step) lines.push(<line key={`y${gy}`} x1={0} y1={gy} x2={WIDTH} y2={gy} />);
  return (
    <g>
      {gridO > 0.001 ? (
        <g opacity={gridO}>
          <rect width={WIDTH} height={HEIGHT} fill={XRAY.bg} />
          <g stroke={XRAY.grid} strokeWidth={2 * z}>
            {lines}
          </g>
        </g>
      ) : null}
      {headO > 0.001 ? <XRayHead x={x} y={y} size={size} doors={["TURN", "PASS"]} lit={[0, 0]} facing={-90 - 90 * m} opacity={headO} /> : null}
      {ringO > 0.001 ? (
        <g transform={`translate(${x} ${y})`} opacity={ringO}>
          <circle r={ringR} fill={XRAY.lime} opacity={0.1} />
          <circle r={ringR} fill="none" stroke={XRAY.lime} strokeWidth={5} opacity={0.9} />
          <circle r={ringR * 0.985} fill="none" stroke={XRAY.lime} strokeWidth={2} strokeDasharray={`${ringR * 0.12} ${ringR * 0.08}`} opacity={0.5} />
        </g>
      ) : null}
    </g>
  );
};

/** A lime eye that locks onto a point: an almond with a pupil and a soft lock ring when it lands. */
export const EyeIcon: React.FC<{ x: number; y: number; at: number; frame: number; size?: number; color?: string; until?: number }> = ({ x, y, at, frame, size = 30, color = XRAY.lime, until }) => {
  const s = pop(frame, at, { stiffness: 220, damping: 15 }) * (until === undefined ? 1 : 1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const ring = (frame - at) / 14;
  const bob = idle(frame, 7, 1.6, 2);
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s})`}>
      {ring >= 0 && ring <= 1 ? <circle r={size * 0.6 + size * 1.6 * ring} fill="none" stroke={color} strokeWidth={3} opacity={1 - ring} /> : null}
      <path d={`M${-size},0 Q0,${-size * 0.72} ${size},0 Q0,${size * 0.72} ${-size},0 Z`} fill={color} />
      <circle r={size * 0.3} fill={PITCH.skyHigh} />
      <circle cx={-size * 0.08} cy={-size * 0.08} r={size * 0.1} fill={PITCH.chalk} />
    </g>
  );
};

/** A camera flash over the frame at a snapshot. */
export const CamFlash: React.FC<{ at: number; frame: number; strength?: number }> = ({ at, frame, strength = 0.35 }) => {
  const t = frame - at;
  if (t < 0 || t > 5) return null;
  return <rect x={-200} y={-200} width={2400} height={1500} fill="#FFFFFF" opacity={strength * (1 - t / 5)} />;
};

/** A chalk footprint (top-down) for "one step", toes along `angle`. */
export const Footprint: React.FC<{ x: number; y: number; angle: number; scale?: number; color?: string; opacity?: number }> = ({ x, y, angle, scale = 1, color = PITCH.chalk, opacity = 0.85 }) => (
  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} opacity={opacity}>
    <ellipse cx={6} cy={0} rx={13} ry={8} fill={color} />
    <circle cx={-11} cy={0} r={6} fill={color} />
  </g>
);

/** A chalk X on the grass: "her old mark". */
export const ChalkX: React.FC<{ x: number; y: number; size?: number; t?: number; color?: string }> = ({ x, y, size = 16, t = 1, color = PITCH.chalk }) => {
  if (t <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y})`} opacity={0.8 * Math.min(1, t)}>
      <line x1={-size} y1={-size} x2={size * (2 * Math.min(1, t * 2) - 1)} y2={size * (2 * Math.min(1, t * 2) - 1)} stroke={color} strokeWidth={5} strokeLinecap="round" />
      {t > 0.5 ? <line x1={size} y1={-size} x2={size - 2 * size * Math.min(1, (t - 0.5) * 2)} y2={-size + 2 * size * Math.min(1, (t - 0.5) * 2)} stroke={color} strokeWidth={5} strokeLinecap="round" /> : null}
    </g>
  );
};
