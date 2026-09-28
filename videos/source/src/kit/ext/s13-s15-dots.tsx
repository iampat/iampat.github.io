// The s13 dot grid (visual only, no narrated number): 507 goals from the 2018 + 2022 World Cups
// and Euro 2020 + 2024 (no penalties), 96 of them volleys or half-volleys. It plays over the
// frozen frame at the end of s13 and dissolves into falling dust at the start of s14, so both
// scenes draw it from the same s13 frame clock.
// Owned by the s13-s15 builder. Other scenes must not import this file.

import React from "react";
import { random } from "remotion";
import { Label } from "../Graphics";
import { SHOTS } from "../../physics/shots";
import { simulate, sampleAt } from "../../physics/sim";
import { EASE, clamp01, lerp, pop, progress, visible } from "../../lib/anim";
import { pathD } from "../../lib/project";
import { FONTS, PITCH } from "../../theme";
import { FallingDust, GOAL_M, type DotTiming } from "./s13-s15-volley";

const VOLLEY = simulate({ ...SHOTS.VOLLEY, duration: 1.6 }, 30); // the mini replay in the hero dot

const COLS = 39;
const N_DOTS = 507;
const N_LIT = 96;
const PITCH_PX = 28;
const GX0 = 668;
const GY0 = 206;
const N_GROUPS = 4;
/** Lit dot index -> its pop group (0..3). The lit dots pop in 4 quick groups of 24. */
const LIT: Map<number, number> = (() => {
  const idx = Array.from({ length: N_DOTS }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(random(`s13-lit-${i}`) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return new Map(idx.slice(0, N_LIT).map((d, rank) => [d, Math.floor((rank * N_GROUPS) / N_LIT)]));
})();
/** The lit dot that grows into the mini replay: the lit dot nearest row 11, column 33. */
const HERO = (() => {
  let best = -1;
  let bd = 1e9;
  for (const i of LIT.keys()) {
    const d = (Math.floor(i / COLS) - 11) ** 2 + ((i % COLS) - 33) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
})();
/** The replay bubble: its size and where it settles (screen px). */
const BUB_R = 184;
const BUB = { x: 1606, y: 756 };
const dotPos = (i: number) => ({ x: GX0 + (i % COLS) * PITCH_PX, y: GY0 + Math.floor(i / COLS) * PITCH_PX });

/** Sim frames from the replay kick until the volley crosses the goal line. */
export const REPLAY_CROSS = VOLLEY.findIndex((s) => s.pos.x >= GOAL_M);
/** Frames of each lit group (s13 clock), for the tick sounds. */
export const litGroupAt = (t: DotTiming) => Array.from({ length: N_GROUPS }, (_, g) => t.litStart + g * t.litGap);
/** When the replay bubble leaves (s13 clock): after the net swish, never before the dots dissolve. */
export const bubbleOutAt = (t: DotTiming) => Math.max(t.dissolveAt, t.replayAt + REPLAY_CROSS + 3);

/**
 * The dot grid overlay (screen space). `f` is the frame on the s13 clock. `offset` is
 * (s13 frame - current scene frame): 0 in s13, s13's length in s14. Kit parts that read the
 * current frame themselves get their times shifted by it.
 */
export const VolleyDots: React.FC<{ f: number; offset: number; t: DotTiming }> = ({ f, offset, t }) => {
  const outAt = bubbleOutAt(t);
  if (f < t.panelAt - 1 || f > Math.max(t.dissolveAt + 32, outAt + 12)) return null;
  const { panelAt, fillStart, rowDur, litStart, litGap, labelAt, heroAt, replayAt, dissolveAt } = t;

  const dim = visible(f, panelAt, dissolveAt, 10, 14) * 0.2;
  const panel = progress(f, panelAt, 8, EASE.soft) * (1 - progress(f, dissolveAt, 12, EASE.exit));
  const panelS = 0.92 + 0.08 * pop(f, panelAt, { stiffness: 190, damping: 15 });

  const heroGrow = progress(f, heroAt, 14, EASE.standard);
  const heroPos = dotPos(HERO);
  const bubble = {
    x: lerp(heroPos.x, BUB.x, heroGrow),
    y: lerp(heroPos.y, BUB.y, heroGrow),
    r: lerp(10, BUB_R, pop(f, heroAt, { stiffness: 160, damping: 15 })),
  };

  const dots: React.ReactNode[] = [];
  for (let i = 0; i < N_DOTS; i++) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const at = fillStart + r * rowDur + (c / COLS) * 4;
    const s = pop(f, at, { stiffness: 280, damping: 18 });
    if (s <= 0.001) continue;
    if (i === HERO && heroGrow > 0.02) continue;
    const p = dotPos(i);
    const g = LIT.get(i);
    const litAt = i === HERO ? litStart : litStart + (g ?? 0) * litGap;
    const litT = g === undefined ? 0 : pop(f, Math.max(litAt, at + 1), { stiffness: 240, damping: 13 });
    const fallT = clamp01((f - dissolveAt - random(`s13-f-${i}`) * 6) / 12);
    if (fallT >= 1) continue;
    const y = p.y + 300 * fallT * fallT;
    const rr = 10 * s * (1 + 0.35 * litT * (1 - clamp01((f - litStart - 12) / 12))) * (1 - 0.6 * fallT);
    dots.push(<circle key={i} cx={p.x} cy={y} r={rr} fill={litT > 0.5 ? PITCH.accent : PITCH.chalk} opacity={(litT > 0.5 ? 1 : 0.45) * (1 - fallT)} />);
  }

  // Mini replay inside the bubble: side view, 2.6x vertical scale so the dip under the bar reads.
  const k = BUB_R / 140;
  const bx = bubble.x;
  const by = bubble.y;
  const mppm = 13.5 * k;
  const kx = bx - 118 * k;
  const gy = by + 76 * k;
  const mini = (m: { x: number; z: number }) => ({ x: kx + m.x * mppm, y: gy - m.z * mppm * 2.6 });
  const rf = Math.max(0, f - replayAt);
  const rs = sampleAt(VOLLEY, Math.min(rf, VOLLEY.length - 1));
  const rp = mini({ x: rs.pos.x, z: rs.pos.z });
  const rTrail = VOLLEY.slice(0, Math.min(VOLLEY.length, Math.floor(rf) + 1)).map((s) => mini({ x: s.pos.x, z: s.pos.z }));
  rTrail.push(rp);
  const goalPx = mini({ x: GOAL_M, z: 0 }).x;
  const barY = mini({ x: 0, z: 2.44 }).y;
  const bubbleOn = heroGrow > 0.02;
  const bubbleOut = 1 - progress(f, outAt, 7, EASE.exit);
  const netHit = REPLAY_CROSS > 0 ? clamp01(1 - Math.abs(rf - REPLAY_CROSS - 3) / 6) : 0;

  const capOn = visible(f, fillStart + 2, dissolveAt, 10, 10);
  const legend = visible(f, litStart, dissolveAt, 8, 10);

  return (
    <g>
      {/* Dim the frozen world a little so the dots read. */}
      <rect x={0} y={0} width={1920} height={1080} fill={PITCH.skyHigh} opacity={dim} />

      {/* Dot panel (pops in with a small scale overshoot). */}
      <g transform={`translate(1200 330) scale(${panelS}) translate(-1200 -330)`}>
        {panel > 0.001 ? (
          <g opacity={panel}>
            <rect x={600} y={96} width={1200} height={476} rx={40} fill={PITCH.skyHigh} />
            <text x={GX0 - 8} y={164} fill={PITCH.chalk} opacity={0.92} fontFamily={FONTS.label} fontWeight={800} fontSize={40}>
              each dot is one goal
            </text>
            {legend > 0.001 ? (
              <g opacity={legend}>
                <circle cx={1196} cy={151} r={13} fill={PITCH.accent} />
                <text x={1222} y={164} fill={PITCH.accent} fontFamily={FONTS.label} fontWeight={800} fontSize={38}>
                  = volley or half-volley
                </text>
              </g>
            ) : null}
          </g>
        ) : null}
        {dots}
      </g>

      {/* The hero dot becomes a mini replay of a volley dipping under the bar. */}
      {bubbleOn && bubbleOut > 0.001 ? (
        <g opacity={bubbleOut} transform={`translate(${bx} ${by}) scale(${1 - 0.3 * (1 - bubbleOut)}) translate(${-bx} ${-by})`}>
          <defs>
            <clipPath id="s13-dots-bubble">
              <circle cx={bx} cy={by} r={Math.max(1, bubble.r)} />
            </clipPath>
          </defs>
          <circle cx={bx} cy={by} r={bubble.r + 10} fill={PITCH.accent} />
          <circle cx={bx} cy={by} r={bubble.r} fill={PITCH.skyHigh} />
          <g clipPath="url(#s13-dots-bubble)" opacity={clamp01((bubble.r - 70) / 70)}>
            <rect x={bx - 260} y={gy} width={520} height={260} fill={PITCH.grassDark} />
            <rect x={bx - 260} y={gy - 2} width={520} height={6} fill={PITCH.grassLight} />
            <line x1={bx - 260} y1={barY} x2={goalPx} y2={barY} stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="6 11" opacity={0.45} />
            {/* Net and post */}
            <g stroke={PITCH.chalk} strokeWidth={2} opacity={0.35 + 0.4 * netHit}>
              {[0.25, 0.5, 0.75].map((q) => (
                <line key={q} x1={goalPx + (20 + 5 * netHit) * k * q} y1={mini({ x: 0, z: 2.44 * (1 - 0.05 * q) }).y} x2={goalPx + (26 + 6 * netHit) * k * q} y2={gy} />
              ))}
              <line x1={goalPx} y1={barY} x2={goalPx + 22 * k} y2={mini({ x: 0, z: 2.3 }).y} />
              <line x1={goalPx + 22 * k} y1={mini({ x: 0, z: 2.3 }).y} x2={goalPx + 30 * k} y2={gy} />
            </g>
            <line x1={goalPx} y1={gy} x2={goalPx} y2={barY} stroke={PITCH.chalk} strokeWidth={7} strokeLinecap="round" />
            {rf > 0 ? (
              <>
                <path d={pathD(rTrail)} fill="none" stroke={PITCH.lightSoft} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
                <circle cx={rp.x} cy={rp.y} r={11} fill={PITCH.accent} />
              </>
            ) : (
              <circle cx={kx} cy={mini({ x: 0, z: 0.4 }).y} r={11} fill={PITCH.accent} />
            )}
          </g>
        </g>
      ) : null}

      <Label x={1010} y={690} text="≈ 1 in 5 goals" at={labelAt - offset} until={dissolveAt + 4 - offset} size={64} bg={PITCH.accent} color={PITCH.skyHigh} />

      {/* Source caption: short line for kids, the source underneath. */}
      {capOn > 0.001 ? (
        <g opacity={capOn} fontFamily={FONTS.label} fill={PITCH.chalk}>
          <rect x={620} y={914} width={800} height={112} rx={24} fill={PITCH.skyHigh} opacity={0.6} />
          <text x={646} y={962} fontWeight={800} fontSize={36}>
            World Cups + Euros 2018–2024 · no penalties
          </text>
          <text x={646} y={1005} fontWeight={700} fontSize={26} opacity={0.72}>
            StatsBomb open data
          </text>
        </g>
      ) : null}

      {/* Dots dissolve into falling dust. */}
      {f >= dissolveAt - 1
        ? Array.from({ length: 44 }, (_, q) => {
            const p = dotPos(Math.floor(random(`s13-dd-${q}`) * N_DOTS));
            return <FallingDust key={q} x={p.x} y={p.y} at={dissolveAt + random(`s13-dt-${q}`) * 8 - offset} seed={`s13-dd-${q}`} size={12} />;
          })
        : null}
    </g>
  );
};
