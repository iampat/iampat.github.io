// The s21 recap row: four chalk cards (BACKSPIN/SPEED, SIDEWAYS/BEND, TOPSPIN/DIVE,
// BACKSPIN/FLOAT) and a fifth, dashed card with a "?". s21 builds the row and holds it
// still; s22 opens on the same row and only then pushes into the fifth card. Both scenes
// draw it with this module and the s21 clock, so the hand-over has no jump.

import React from "react";
import { useCurrentFrame } from "remotion";
import { FONTS, PITCH } from "../../theme";
import { EASE, idle, pop, popSoft, progress } from "../../lib/anim";
import { pathD, type View } from "../../lib/project";
import type { Cue } from "../../lib/timing";
import { Ball } from "../Ball";
import { SHOTS } from "../../physics/shots";
import { simulate, type BallState } from "../../physics/sim";
import { ChalkBox, RECAP, SpinArrow } from "./s21-s23-bits";

const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const SIDE: View = { kind: "side", originX: 400, groundY: 820, ppm: 50 };
const TOP_UP: View = { kind: "topUp", originX: 0, originY: 0, ppm: 1 };
const AX_BACK = { x: 0, y: -1, z: 0 };

// Flights from SHOTS, drawn as small icons.
const ICON_DRIVE = simulate({ ...SHOTS.DRIVE_L, duration: 1.2 }, 30);
const ICON_CURL = simulate({ ...SHOTS.CURLER, duration: 1.5 }, 30);
const ICON_VOLLEY = simulate({ ...SHOTS.VOLLEY, duration: 1.2 }, 30);
const ICON_VOLLEY_G = simulate({ ...SHOTS.VOLLEY_GHOST, duration: 1.2 }, 30);
const ICON_CHIP = simulate({ ...SHOTS.CHIP, duration: 2 }, 30);
const ICON_CHIP_G = simulate({ ...SHOTS.CHIP_GHOST, duration: 2 }, 30);

// Row layout (world pixels of the recap shot).
const SLOT_X = RECAP.slotX;
const BOX_W = RECAP.boxW;
const BOX_H = RECAP.boxH;
const BOX_Y = RECAP.boxY;
const TAG_Y = BOX_Y + 56;
export const RECAP_BALL_Y = 452;
const ICON_BASE = 642;
const SUB_Y = 702;
const WORD_Y = BOX_Y + BOX_H - 34;
// Card 2 (top-down bend): the start dot sits lower, because card 2 has no sub-line.
const BEND_BASE = 704;
const BEND_GOAL_Y = 594;

/** The still framing that shows the whole row (all five boxes). s21 ends on it and s22 opens on it. */
export const RECAP_HOLD = { x: 960, y: 540, zoom: 1.0 };

/** All recap beats, in s21 frames. */
export type RecapBeats = {
  shotE2: number;
  tLittle: number;
  tHardLow: number;
  tSpeed: number;
  tSide: number;
  tBend: number;
  tTop: number;
  tDive: number;
  tBack: number;
  tSoftHigh: number;
  tFloat: number;
  floatEnd: number;
  end: number;
};

/** The recap beats from the s21 cues (s22 calls this with useCues("s21")). */
export const recapBeats = (cue: Cue): RecapBeats => ({
  shotE2: cue("that line") - 2 + 26,
  // These offsets move the cue onto the audio onset (measured with ffmpeg silencedetect).
  tLittle: cue("A little backspin", 6),
  tHardLow: cue("hard and low"),
  tSpeed: cue("speed"),
  tSide: cue("Sideways"),
  tBend: cue("bend"),
  tTop: cue("Topspin", 10),
  tDive: cue("dive", 8),
  tBack: cue("Backspin, soft and high", 10),
  tSoftHigh: cue("soft and high"),
  tFloat: cue("float"),
  floatEnd: cue.wordEnd("float"),
  end: cue.frames,
});

/** Frames at which each of the four cards pulses once, in order, after "float" ends. */
export const pulseFrames = (b: RecapBeats) => [0, 1, 2, 3].map((i) => b.floatEnd + 2 + i * 7);

const RATES = [0.4, 0.7, 0.4, 0.6]; // turns per second at 1/10 speed: DRIVE_L 4, CURLER 7, VOLLEY 4, CHIP 6

/** Ball 1 angle: it keeps the big ball's angle, so the hand-over in s21 has no jump. */
export const ball1Angle = (frame: number, b: RecapBeats) =>
  0.9 * (1 - Math.exp(-(frame - b.shotE2) / 18)) + ((frame - b.shotE2) / 30) * 2 * Math.PI * RATES[0] * progress(frame, b.tLittle - 18, 30);

/** A small side-view flight icon from a simulated path (true proportions). */
const SideIcon: React.FC<{
  frame: number;
  path: BallState[];
  ghost?: BallState[];
  cx: number;
  stopX: number;
  at: number;
  dur: number;
  color: string;
  speedLines?: boolean;
}> = ({ frame, path, ghost, cx, stopX, at, dur, color, speedLines = false }) => {
  const t = progress(frame, at, dur, EASE.soft);
  if (t <= 0.001) return null;
  const w = 250;
  const s = w / stopX;
  const map = (q: BallState) => ({ x: cx - w / 2 + q.pos.x * s, y: ICON_BASE - q.pos.z * s });
  const cut = (p: BallState[]) => p.filter((q) => q.pos.x <= stopX + 0.01);
  const pts = cut(path).map(map);
  const shown = pts.slice(0, Math.max(2, Math.floor(pts.length * t)));
  const tip = shown[shown.length - 1];
  const post = { x: cx - w / 2 + stopX * s, top: ICON_BASE - 2.44 * s };
  return (
    <g>
      <line x1={cx - w / 2 - 10} y1={ICON_BASE + 8} x2={cx + w / 2 + 10} y2={ICON_BASE + 8} stroke={PITCH.chalk} strokeWidth={3} opacity={0.25} />
      <g opacity={0.7}>
        <line x1={post.x} y1={ICON_BASE + 8} x2={post.x} y2={post.top} stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" />
        <line x1={post.x} y1={post.top} x2={post.x + 16} y2={post.top + 8} stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" />
      </g>
      {ghost ? (
        <path d={pathD(cut(ghost).map(map).slice(0, Math.max(2, Math.floor(cut(ghost).length * t))))} fill="none" stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" opacity={0.55} />
      ) : null}
      <path d={pathD(shown)} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      {speedLines
        ? [0, 1, 2].map((i) => (
            <line key={i} x1={tip.x - 30 - i * 14} y1={tip.y - 20 - i * 14} x2={tip.x - 70 - i * 18} y2={tip.y - 20 - i * 14} stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.7 * t} />
          ))
        : null}
      <circle cx={tip.x} cy={tip.y} r={11} fill={PITCH.accent} />
    </g>
  );
};

/**
 * Card 2: the curler seen from above. It starts at the kick spot, swings out to the right
 * and bends back left into a small goal (a right-footer's sideways spin, anticlockwise from
 * above, bends the ball left). The sideways axis is stretched so the bend is easy to see.
 * A faint dashed line shows the straight path for comparison.
 */
const BendIcon: React.FC<{ frame: number; cx: number; at: number; dur: number; color: string }> = ({ frame, cx, at, dur, color }) => {
  const t = progress(frame, at, dur, EASE.soft);
  const g = progress(frame, at - 10, 12, EASE.enter);
  if (g <= 0.001) return null;
  const stopX = 20;
  const sx = (BEND_BASE - BEND_GOAL_Y) / stopX; // px per metre towards the goal
  const lat = sx * 9; // sideways stretch
  const x0 = cx - 18;
  const map = (q: BallState) => ({ x: x0 - q.pos.y * lat, y: BEND_BASE - q.pos.x * sx });
  const pts = ICON_CURL.filter((q) => q.pos.x <= stopX + 0.01).map(map);
  const shown = pts.slice(0, Math.max(2, Math.floor(pts.length * t)));
  const tip = shown[shown.length - 1];
  const end = pts[pts.length - 1];
  const gw = 92; // the small goal (not to scale)
  const gd = 22;
  const gx = end.x;
  return (
    <g>
      {/* The small goal, seen from above: goal line at the front, net box behind it. */}
      <g opacity={0.85 * g}>
        <rect x={gx - gw / 2} y={BEND_GOAL_Y - gd} width={gw} height={gd} rx={6} fill={PITCH.chalk} opacity={0.14} />
        <path d={`M${gx - gw / 2},${BEND_GOAL_Y} L${gx - gw / 2},${BEND_GOAL_Y - gd} L${gx + gw / 2},${BEND_GOAL_Y - gd} L${gx + gw / 2},${BEND_GOAL_Y}`} fill="none" stroke={PITCH.chalk} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
        <circle cx={gx - gw / 2} cy={BEND_GOAL_Y} r={7} fill={PITCH.chalk} />
        <circle cx={gx + gw / 2} cy={BEND_GOAL_Y} r={7} fill={PITCH.chalk} />
        {/* The straight path, for comparison. */}
        <line x1={x0} y1={BEND_BASE} x2={x0} y2={BEND_GOAL_Y + 10} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" opacity={0.5} />
        <circle cx={x0} cy={BEND_BASE} r={7} fill={PITCH.chalk} opacity={0.8} />
      </g>
      {t > 0.001 ? (
        <>
          <path d={pathD(shown)} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={tip.x} cy={tip.y} r={11} fill={PITCH.accent} />
        </>
      ) : null}
    </g>
  );
};

/** Sideways spin seen from above: a flat ring of two arrows round the ball's middle, anticlockwise. */
const TopRing: React.FC<{ cx: number; cy: number; r: number; t: number }> = ({ cx, cy, r, t }) => (
  <g>
    <SpinArrow cx={cx} cy={cy} r={r} ccw from={-45} sweep={90} t={t} width={6} />
    <SpinArrow cx={cx} cy={cy} r={r} ccw from={135} sweep={90} t={t} width={6} />
  </g>
);

/**
 * The recap row in world pixels. `frame` is the s21 frame (s22 passes its frame plus the
 * s21 length). `rowOpacity` fades cards 1-4 (box 5 and its "?" stay).
 */
export const RecapRow: React.FC<{ frame: number; beats: RecapBeats; rowOpacity?: number }> = ({ frame, beats: b, rowOpacity = 1 }) => {
  // ChalkBox reads the scene's own frame, so its start frames are moved onto that clock.
  const shift = frame - useCurrentFrame();
  const boxAt = [b.tLittle - 8, b.tSide - 4, b.tTop - 4, b.tBack - 4];
  const ballAt = [b.tLittle + 4, b.tSide + 2, b.tTop + 2, b.tBack + 2];
  const iconAt = [b.tHardLow, b.tSide + 14, b.tTop + 14, b.tSoftHigh];
  const iconDur = [10, 22, 22, 34];
  // The big words land on the spoken word (the pop is fast, so the word is full size on time).
  const wordAt = [b.tSpeed - 2, b.tBend - 2, b.tDive - 2, b.tFloat - 2];
  const subs = ["hard and low", "", "", "soft and high"];
  const tags = ["BACKSPIN", "SIDEWAYS", "TOPSPIN", "BACKSPIN"];
  const words = ["SPEED", "BEND", "DIVE", "FLOAT"];
  const views: View[] = [SIDE, TOP_UP, SIDE, SIDE];
  const axes = [AX_BACK, { x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }, AX_BACK];
  const pulses = pulseFrames(b);
  const b5 = b.tFloat - 10;
  const qAt = b.tFloat + 6;
  return (
    <g>
      {rowOpacity > 0.001 ? (
        <g opacity={rowOpacity}>
          {[0, 1, 2, 3].map((i) => {
            const cx = SLOT_X[i];
            const bob = idle(frame, i, 3.2, 3);
            const ballPop = i === 0 ? 1 : pop(frame, ballAt[i]);
            const ang = i === 0 ? ball1Angle(frame, b) : ((frame - ballAt[i]) / 30) * 2 * Math.PI * RATES[i];
            const wp = pop(frame, wordAt[i]);
            // One pulse per card, in order, once the row is complete.
            const pu = Math.sin(progress(frame, pulses[i], 14, EASE.soft) * Math.PI);
            const k = 1 + 0.06 * pu;
            const cy = BOX_Y + BOX_H / 2;
            const arrowT = progress(frame, ballAt[i] + 8, 12, EASE.enter);
            return (
              <g key={i} transform={`translate(0 ${bob}) translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}>
                <ChalkBox x={cx - BOX_W / 2} y={BOX_Y} w={BOX_W} h={BOX_H} at={boxAt[i] - shift} />
                {pu > 0.01 ? <rect x={cx - BOX_W / 2} y={BOX_Y} width={BOX_W} height={BOX_H} rx={34} fill="none" stroke={PITCH.light} strokeWidth={9} opacity={pu} /> : null}
                {frame >= boxAt[i] + 4 ? (
                  <text x={cx} y={TAG_Y} fill={PITCH.chalk} opacity={0.8 * progress(frame, boxAt[i] + 4, 10)} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} textAnchor="middle" letterSpacing={4}>
                    {tags[i]}
                  </text>
                ) : null}
                {frame >= ballAt[i] ? (
                  <g transform={`translate(${cx} ${RECAP_BALL_Y}) scale(${ballPop}) translate(${-cx} ${-RECAP_BALL_Y})`}>
                    <Ball cx={cx} cy={RECAP_BALL_Y} r={64} view={views[i]} axis={axes[i]} angle={ang} lineNormal={LINE_N} />
                    {i === 1 ? (
                      <TopRing cx={cx} cy={RECAP_BALL_Y} r={82} t={arrowT} />
                    ) : (
                      <SpinArrow cx={cx} cy={RECAP_BALL_Y + 4} r={84} ccw={i !== 2} from={i === 2 ? -140 : -40} sweep={80} t={arrowT} width={6} />
                    )}
                  </g>
                ) : null}
                {i === 1 ? (
                  <BendIcon frame={frame} cx={cx} at={iconAt[1]} dur={iconDur[1]} color={PITCH.teal} />
                ) : (
                  <SideIcon
                    frame={frame}
                    path={[ICON_DRIVE, ICON_CURL, ICON_VOLLEY, ICON_CHIP][i]}
                    ghost={i === 2 ? ICON_VOLLEY_G : i === 3 ? ICON_CHIP_G : undefined}
                    cx={cx}
                    stopX={[18, 20, 16, 14][i]}
                    at={iconAt[i]}
                    dur={iconDur[i]}
                    color={[PITCH.light, PITCH.teal, PITCH.accent, PITCH.lightSoft][i]}
                    speedLines={i === 0}
                  />
                )}
                {subs[i] && frame >= iconAt[i] ? (
                  <text x={cx} y={SUB_Y + (1 - popSoft(frame, iconAt[i])) * 12} opacity={0.9 * popSoft(frame, iconAt[i])} fill={PITCH.lightSoft} fontFamily={FONTS.label} fontWeight={800} fontSize={34} textAnchor="middle">
                    {subs[i]}
                  </text>
                ) : null}
                {wp > 0.001 ? (
                  <g transform={`translate(${cx} ${WORD_Y - 18}) scale(${wp})`}>
                    <text y={18} fill={pu > 0.01 ? PITCH.light : PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={58} textAnchor="middle" letterSpacing={3}>
                      {words[i]}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      ) : null}
      {/* Box 5: empty, with a question mark. */}
      <ChalkBox x={SLOT_X[4] - BOX_W / 2} y={BOX_Y} w={BOX_W} h={BOX_H} at={b5 - shift} dashed />
      {frame >= qAt ? (
        <g transform={`translate(${SLOT_X[4]} 540) scale(${pop(frame, qAt)})`}>
          <text y={38} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={120} textAnchor="middle">
            ?
          </text>
        </g>
      ) : null}
    </g>
  );
};
