// s17 Classic mistake: smashing it. Same angle, EASY dips under the bar, SMASH flies over.
// Replay with stopwatches: SMASH arrives first, so it has less time to fall (weight arrows, drop
// brackets from the "if it never fell" line, ramp-cars inset). Fix: nose over knee, knee over ball.
// Hit the middle, not the bottom: the contact band, struck with the laces (toes down). Clean beats hard
// holds to the end while the camera drops, the palette cools to night, and the s18 board dissolves in.
import React from "react";
import { AbsoluteFill, Freeze, useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { Ball } from "../kit/Ball";
import { Player, POSES, solve, type Face, type Pose } from "../kit/Player";
import { Label, SlowMoTag, Stamp } from "../kit/Graphics";
import { Stars } from "../kit/World";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { sampleAt, simulate, spinAngleAt, type BallState } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, idle, lerp, pop, popSoft, progress, visible } from "../lib/anim";
import { project } from "../lib/project";
import { CAST, FONTS, HEIGHT, PITCH, SKY, WIDTH } from "../theme";
import { ForceArrow, breathe, RoundInset, SolidTrail, StampPlate, Stopwatch, voCues } from "../kit/ext/s16-s18-fx";
import { SKY_BALL_R, SKY_GOAL_M, SKY_GROUND, SKY_TAVI_H, SKY_VIEW, SX, SZ, SkyBackdrop, SkyWorld, placeForBall, worldTransform } from "../kit/ext/s16-s18-sky";
import { S18 } from "./s18";

// ---------- Physics ----------
const EASY = simulate({ ...SHOTS.EASY }, 30);
const SMASH = simulate({ ...SHOTS.SMASH }, 30);
const crossIdx = (path: BallState[], x: number) => {
  for (let i = 1; i < path.length; i++) {
    if (path[i - 1].pos.x < x && path[i].pos.x >= x) return i - 1 + (x - path[i - 1].pos.x) / (path[i].pos.x - path[i - 1].pos.x);
  }
  return path.length - 1;
};
const FE = crossIdx(EASY, SKY_GOAL_M); // flight frames to the goal line
const FS = crossIdx(SMASH, SKY_GOAL_M);
const FE_NET = crossIdx(EASY, SKY_GOAL_M + 1.2);
const EL = (SHOTS.EASY.elevationDeg * Math.PI) / 180;
const START = SHOTS.EASY.start;
/** Height of the straight aim line (no fall, no air) at distance x. */
const aimZ = (x: number) => START.z + x * Math.tan(EL);
const LINE_N = { x: 0.6, y: 0.5, z: 0.62 };
const NO_SPIN_AXIS = { x: 0, y: 1, z: 0 };

// ---------- Tavi ----------
const TH = SKY_TAVI_H;
const BR = SKY_BALL_R;
const CONTACT = placeForBall(START, { ...POSES.volley, torso: -10, head: -8 }, { torso: [-10] });
/** The mistake: leaning back, knee behind the ball, laces under it. */
const WRONG = placeForBall(START, { ...POSES.volley, torso: -14, head: -10, nearAnkle: 140, farShoulder: 60 }, { torso: [-14], shin: [14] });
/** The fix: nose over knee, knee over ball. */
const noseOf = (j: ReturnType<typeof solve>) => ({ x: j.headC.x + j.headR * 0.95, y: j.headC.y + j.headR * 0.15 });
const RIGHT = placeForBall(START, { ...POSES.volley, head: 14, farShoulder: 80 }, {
  torso: Array.from({ length: 21 }, (_, i) => 6 + i * 2),
  shin: Array.from({ length: 21 }, (_, i) => -40 + i * 2),
  score: (j, hipX, ball) => Math.abs(hipX + j.nk.x - ball.x) * 1.5 + Math.abs(hipX + noseOf(j).x - ball.x),
});
const WINDUP: Pose = { torso: -10, head: -6, nearHip: -52, nearKnee: 118, nearAnkle: 150, farHip: 6, farKnee: 20, farAnkle: 92, nearShoulder: -65, nearElbow: 30, farShoulder: 110, farElbow: 25 };
const READY: Pose = POSES.ready;
const FOLLOW: Pose = { ...POSES.follow, torso: -12, head: -8, nearHip: 96, nearKnee: 18 };

type Cam = { x: number; y: number; zoom: number };

// Speech onsets measured on the final VO where whisper drifts (see voCues).
const MEASURED: Record<string, number> = {
  Fix: 8.255,
  "nose over knee": 8.91,
  "knee over ball": 10.026,
  "Hit the middle": 11.373,
  "not the bottom": 12.222,
  "Clean beats hard": 13.113,
};

export const S17: React.FC = () => {
  const frame = useCurrentFrame();
  const cue0 = useCues("s17");
  const cue = voCues(cue0, MEASURED);

  // ---------- Beats ----------
  const tMistake = cue("Classic mistake");
  const tSmash = cue("Smashing it");
  const tSame = cue("Same angle");
  const tSooner = cue("It arrives sooner");
  const tSo = cue("so it has less time");
  const tLess = cue("less time to fall");
  const tFix = cue("Fix");
  const tNose = cue("nose over knee");
  const tKnee = cue("knee over ball");
  const tHit = cue("Hit the middle");
  const tBottom = cue("not the bottom");
  const tClean = cue("Clean beats hard");
  const END = cue0.frames;

  const K1 = tSame + 2; // first kick: both balls leave at the same angle
  const S1 = 0.5;
  const K2 = tSooner + 3; // replay
  const S2 = 0.45;
  const arriveS = K2 + FS / S2;
  const arriveE = K2 + FE / S2;
  const fixAt = tFix; // cut to the close-up on Tavi
  const snap0 = tKnee + 2; // dots snap into a line
  const lensAt = tHit - 4;
  const dropAt = END - 22; // camera drops to the wall, palette cools
  const XF = 14; // last frames: dissolve into the first frame of s18 (the drill board)

  // ---------- Camera: medium on Tavi, cut to the wide flight, cut to the close-up for the fix ----------
  const wideAt = K1 + 3;
  const cam: Cam =
    frame < wideAt
      ? camAt(frame, [
          { f: 0, x: SX(0.6), y: SZ(1.1), zoom: 2.35 },
          { f: wideAt, x: SX(0.5), y: SZ(1.1), zoom: 2.55 },
        ])
      : frame < fixAt
        ? camAt(frame, [
            { f: wideAt, x: SX(8.4), y: SZ(1.65), zoom: 1.58 },
            { f: fixAt, x: SX(8.8), y: SZ(1.7), zoom: 1.64 },
          ])
        : camAt(frame, [
            { f: fixAt, x: SX(0.35), y: SZ(0.95), zoom: 3.7 },
            { f: lensAt, x: SX(0.2), y: SZ(0.95), zoom: 3.95 },
            { f: lensAt + 30, x: SX(1.05), y: SZ(0.95), zoom: 3.9 },
            { f: END, x: SX(1.15), y: SZ(0.9), zoom: 4.05 },
          ]);

  // ---------- Balls ----------
  const replay = frame >= K2 - 6;
  const kAt = replay ? K2 : K1;
  const sp = replay ? S2 : S1;
  const tfE = frame < kAt ? 0 : Math.min((frame - kAt) * sp, FE_NET);
  const tfS = frame < kAt ? 0 : (frame - kAt) * sp;
  const showBalls = frame >= tMistake + 4 && frame < fixAt;
  const resetFade = replay ? progress(frame, K2 - 6, 6) : 1;
  const ptsE = EASY.slice(0, Math.floor(tfE) + 1).map((s) => project(s.pos, SKY_VIEW));
  const nowE = project(sampleAt(EASY, tfE).pos, SKY_VIEW);
  ptsE.push(nowE);
  const ptsS = SMASH.slice(0, Math.floor(tfS) + 1).map((s) => project(s.pos, SKY_VIEW));
  const nowS = project(sampleAt(SMASH, tfS).pos, SKY_VIEW);
  ptsS.push(nowS);
  const smashFade = 1 - progress(frame, kAt + (FS + 16) / sp, 10);
  const oldTrails = replay ? 1 - progress(frame, K2, 30) : 0;
  const oldE = EASY.slice(0, Math.floor(FE_NET) + 1).map((s) => project(s.pos, SKY_VIEW));
  const oldS = SMASH.slice(0, Math.floor(FS + 9) + 1).map((s) => project(s.pos, SKY_VIEW));
  const ballAppear = pop(frame, tMistake + 4, { stiffness: 220, damping: 14 });
  const inWide = frame >= wideAt && frame < fixAt;

  // ---------- Tavi ----------
  const hipX = frame < fixAt ? CONTACT.x : lerp(WRONG.x, RIGHT.x, EASE.standard(progress(frame, tKnee - 12, 16, (t) => t)));
  const shake = frame >= tSmash + 8 && frame < K1 - 8 ? idle(frame, 3, 0.2, 1.5) : 0;
  let pose: Pose;
  if (frame < fixAt) {
    pose = poseTrack(frame, [
      [0, READY],
      [tSmash - 2, READY],
      [tSmash + 12, WINDUP],
      [K1 - 8, { ...WINDUP, torso: WINDUP.torso + shake }],
      [K1, CONTACT.pose],
      [K1 + 12, FOLLOW],
      [K1 + 34, POSES.stand],
    ]);
  } else {
    pose = poseTrack(frame, [
      [fixAt, WRONG.pose],
      [tKnee - 12, WRONG.pose],
      [tKnee + 4, RIGHT.pose],
    ]);
  }
  const face: Face = frame >= tSmash && frame < K1 + 10 ? "shout" : frame >= tKnee ? "focus" : frame >= fixAt ? "wince" : "neutral";
  const tavX = hipX;
  // Before the kick Tavi stands a little behind the ball; he steps in for the kick.
  const stepIn = frame < fixAt ? lerp(-28, 0, EASE.standard(progress(frame, tSmash - 4, 16, (t) => t))) : 0;

  // ---------- Fix: the three dots ----------
  const jNow = solve(pose, TH);
  const dyNow = SKY_GROUND - jNow.lowest - (pose.lift ?? 0) * TH;
  const nose = { x: tavX + noseOf(jNow).x, y: noseOf(jNow).y + dyNow };
  const knee = { x: tavX + jNow.nk.x, y: jNow.nk.y + dyNow };
  const ballP = project(START, SKY_VIEW);

  // ---------- Compose world ----------
  const breatheAmt = frame < tSmash || (frame > K1 + 30 && frame < fixAt) || frame > tKnee + 6 ? 1 : 0.2;
  const world = (
    <g transform={worldTransform(cam)}>
      <SkyWorld />
      <Player x={tavX + stepIn} groundY={SKY_GROUND} h={TH} pose={breathe(pose, frame, breatheAmt, 1)} face={face} />
      {/* Speed arcs on the huge backswing. */}
      <WindupArcs frame={frame} at={tSmash + 4} until={K1 - 3} x={tavX + stepIn} />
      {/* The aim line: where both balls would go if they never fell. */}
      {frame < fixAt ? <AimLine frame={frame} at={tSooner + 2} until={fixAt - 6} /> : null}
      {showBalls ? (
        <g>
          {oldTrails > 0.01 ? (
            <g opacity={oldTrails * 0.5}>
              <SolidTrail pts={oldE} color={SKY.cloud} width={5} />
              <SolidTrail pts={oldS} color={CAST.mistake} width={5} />
            </g>
          ) : null}
          <g opacity={resetFade}>
            {frame >= kAt ? <SolidTrail pts={ptsE} color={SKY.accent} core={SKY.sunSoft} width={6} /> : null}
            {frame >= kAt ? <SolidTrail pts={ptsS} color={CAST.mistake} core={SKY.sunSoft} width={6} /> : null}
            <g opacity={smashFade}>
              <Ball cx={nowS.x} cy={nowS.y} r={BR * (frame < kAt ? ballAppear : 1)} view={SKY_VIEW} axis={NO_SPIN_AXIS} angle={spinAngleAt(SMASH, tfS)} lineNormal={LINE_N} />
            </g>
            <Ball cx={nowE.x} cy={nowE.y} r={BR * (frame < kAt ? ballAppear : 1)} view={SKY_VIEW} axis={NO_SPIN_AXIS} angle={spinAngleAt(EASY, tfE)} lineNormal={LINE_N} />
          </g>
          {/* Weight arrows on both balls (same weight). */}
          {replay ? (
            <g>
              {/* World-space label: 30 px here is about 48 px on screen in the wide shot. */}
              <ForceArrow x={nowE.x} y={nowE.y + BR + 3} len={58} color={SKY.deep} at={tSo} until={fixAt - 8} width={7} label="weight" labelSize={30} labelColor={SKY.cloud} labelAt="left" />
              <g opacity={smashFade}>
                <ForceArrow x={nowS.x} y={nowS.y + BR + 3} len={58} color={SKY.deep} at={tSo} until={fixAt - 8} width={7} />
              </g>
            </g>
          ) : null}
          {/* Drop brackets: how far each ball has fallen below the aim line. */}
          {replay ? (
            <g>
              <DropBracket frame={frame} path={EASY} tf={Math.min(tfE, FE)} at={tSo + 6} until={fixAt} color={SKY.deep} dx={20} />
              <DropBracket frame={frame} path={SMASH} tf={Math.min(tfS, FS)} at={tSo + 6} until={fixAt} color={CAST.mistake} dx={42} />
            </g>
          ) : null}
          {/* Tags follow the balls: first flight, and the start of the replay. */}
          <Label x={nowE.x - 34} y={nowE.y + 26} text="EASY" at={K1 + 8} until={tSooner - 6} size={22} bg={SKY.cloud} color={SKY.deep} />
          <g opacity={smashFade}>
            <Label x={nowS.x - 40} y={nowS.y - 26} text="SMASH" at={K1 + 8} until={tSooner - 6} size={22} bg={CAST.mistake} color={SKY.cloud} />
          </g>
          <Label x={nowE.x - 34} y={nowE.y + 26} text="EASY" at={K2 + 10} until={tSo + 4} size={22} bg={SKY.cloud} color={SKY.deep} />
          <Label x={nowS.x - 40} y={nowS.y - 26} text="SMASH" at={K2 + 10} until={tSo + 4} size={22} bg={CAST.mistake} color={SKY.cloud} />
          {/* Same angle marker at launch. */}
          <AngleMark frame={frame} at={K1 + 4} until={tSooner - 4} />
        </g>
      ) : null}
      {/* Fix: nose, knee and ball dots snap into one vertical line. */}
      {frame >= fixAt ? <Ball cx={ballP.x} cy={ballP.y} r={BR} view={SKY_VIEW} axis={NO_SPIN_AXIS} angle={0} lineNormal={LINE_N} /> : null}
      {frame >= fixAt ? <FixDots frame={frame} at={tNose - 4} snap={snap0} until={lensAt + 6} nose={nose} knee={knee} ball={ballP} /> : null}
    </g>
  );

  // Camera drop at the end: the world slides up and the night comes in.
  const drop = EASE.standard(progress(frame, dropAt, END - 1 - dropAt, (t) => t));

  const xf = progress(frame, END - XF, XF, EASE.soft);

  return (
    <>
    <Stage bg={SKY.mid}>
      <g transform={`translate(0 ${-drop * 700})`}>
        <SkyBackdrop cam={cam} id="s17sky" />
        {world}
      </g>
      {/* Night comes in as the camera drops to the wall. The lens and its label stay bright on top. */}
      {drop > 0.001 ? (
        <g opacity={drop}>
          <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} />
          <Stars count={70} seed="s18bg" maxY={1080} opacity={0.6} />
        </g>
      ) : null}

      {/* MISTAKE stamp on a chalk plate. */}
      <StampPlate x={300} y={170} w={340} h={120} at={tMistake} until={K1 - 10} color={SKY.deep} />
      <Stamp kind="MISTAKE" x={300} y={170} at={tMistake} until={K1 - 10} />
      {inWide ? <SlowMoTag at={wideAt} until={K2 - 10} /> : null}
      {inWide ? <SlowMoTag at={K2 - 4} until={fixAt} label="REPLAY · SLOW MOTION" /> : null}

      {/* Stopwatches, no digits: SMASH stops first. */}
      <Stopwatch x={170} y={300} r={58} start={K2} stop={arriveE} at={K2 - 4} until={fixAt - 4} face={SKY.cloud} ink={SKY.deep} />
      <Label x={170} y={410} text="EASY" at={K2 - 2} until={fixAt - 4} size={32} bg={SKY.cloud} color={SKY.deep} />
      <Stopwatch x={380} y={300} r={58} start={K2} stop={arriveS} at={K2 - 2} until={fixAt - 4} face={SKY.cloud} ink={SKY.deep} flash={CAST.mistake} />
      <Label x={380} y={410} text="SMASH" at={K2} until={fixAt - 4} size={32} bg={CAST.mistake} color={SKY.cloud} />

      {/* Metaphor: two cars leave equal ramps together, the faster one lands further away. */}
      <RoundInset x={CARS.x} y={CARS.y} r={CARS.r} at={tLess - 4} until={fixAt - 4} bg={SKY.horizon} ring={SKY.cloud} id="s17cars">
        <g transform={`scale(${CARS.r / 170})`}>
          <RampCars frame={frame} at={tLess - 2} />
        </g>
      </RoundInset>

      {/* FIX stamp. */}
      <StampPlate x={260} y={170} w={250} h={120} at={tFix} until={lensAt - 4} color={SKY.deep} />
      <Stamp kind="FIX" x={260} y={170} at={tFix} until={lensAt - 4} />

      {/* Hit the middle, not the bottom: the contact band on a close-up ball. Then the label. */}
      <CleanLens frame={frame} at={lensAt} band={tHit + 2} bad={tBottom} label={tClean} until={END + 20} />


      {/* Sound. */}
      <Sfx name="pop-soft" at={tMistake + 4} volume={0.3} />
      <Sfx name="stamp" at={tMistake} volume={0.5} />
      <Sfx name="whoosh-long" at={tSmash + 2} volume={0.45} />
      <Sfx name="thump" at={K1} volume={0.6} />
      <Sfx name="whoosh" at={K1 + 2} volume={0.4} />
      <Sfx name="whoosh" at={K1 + FS / S1} volume={0.3} />
      <Sfx name="net" at={K1 + FE / S1} volume={0.4} />
      <Sfx name="tick" at={K2} volume={0.4} />
      <Sfx name="tick" at={arriveS} volume={0.55} />
      <Sfx name="tick" at={arriveE} volume={0.55} />
      <Sfx name="whoosh" at={tLess + 4} volume={0.25} />
      <Sfx name="stamp" at={tFix} volume={0.5} />
      <Sfx name="pop" at={snap0} volume={0.35} />
      <Sfx name="pop" at={snap0 + 5} volume={0.35} />
      <Sfx name="pop" at={snap0 + 10} volume={0.35} />
      <Sfx name="blip" at={tHit + 2} volume={0.3} />
      <Sfx name="blip" at={tBottom} volume={0.22} />
      <Sfx name="bell" at={tClean + 2} volume={0.35} />
      <Sfx name="whoosh-long" at={dropAt} volume={0.35} />
    </Stage>
    {/* Dissolve into the first frame of s18, so the cut lands on the board with no empty sky. */}
    {xf > 0.001 ? (
      <AbsoluteFill style={{ opacity: xf }}>
        <Freeze frame={0}>
          <S18 />
        </Freeze>
      </AbsoluteFill>
    ) : null}
    </>
  );
};

/** The ramp-cars inset: lower middle, clear of the flights, the goal and the stopwatches. */
const CARS = { x: 735, y: 815, r: 245 };

// ---------- Helpers ----------

const camAt = (f: number, ks: ({ f: number } & Cam)[]): Cam => {
  if (f <= ks[0].f) return ks[0];
  for (let i = 1; i < ks.length; i++) {
    if (f <= ks[i].f) {
      const t = EASE.camera((f - ks[i - 1].f) / Math.max(1, ks[i].f - ks[i - 1].f));
      return { x: lerp(ks[i - 1].x, ks[i].x, t), y: lerp(ks[i - 1].y, ks[i].y, t), zoom: lerp(ks[i - 1].zoom, ks[i].zoom, t) };
    }
  }
  return ks[ks.length - 1];
};

const mixP = (a: Pose, b: Pose, t: number): Pose => {
  const out: Record<string, number> = {};
  for (const k of Object.keys({ ...a, ...b }) as (keyof Pose)[]) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * t;
  return out as unknown as Pose;
};

/** Smoothstep pose track. */
const poseTrack = (f: number, track: [number, Pose][]): Pose => {
  if (f <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    if (f <= track[i][0]) {
      const t = (f - track[i - 1][0]) / Math.max(1, track[i][0] - track[i - 1][0]);
      return mixP(track[i - 1][1], track[i][1], t * t * (3 - 2 * t));
    }
  }
  return track[track.length - 1][1];
};

/** Dashed straight aim line at the launch angle, drawn out to past the goal line. */
const AimLine: React.FC<{ frame: number; at: number; until: number }> = ({ frame, at, until }) => {
  const o = visible(frame, at, until, 12, 8);
  if (o <= 0.001) return null;
  const d = progress(frame, at, 20, EASE.enter);
  const a = project(START, SKY_VIEW);
  const xEnd = (SKY_GOAL_M + 1.2) * d;
  const b = project({ x: xEnd, y: 0, z: aimZ(xEnd) }, SKY_VIEW);
  const lp = project({ x: 11.5, y: 0, z: aimZ(11.5) }, SKY_VIEW);
  return (
    <g opacity={o}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={SKY.deep} strokeWidth={4} strokeDasharray="14 12" strokeLinecap="round" opacity={0.75} />
      {/* World-space label: 22 px here is about 35 px on screen in the wide shot. */}
      <Label x={lp.x - 30} y={lp.y - 44} text="if it never fell" at={at + 12} until={until} size={22} bg={SKY.deep} color={SKY.cloud} />
    </g>
  );
};

/** Vertical bracket from the aim line down to the ball at its current distance (frozen at the goal line). */
const DropBracket: React.FC<{ frame: number; path: BallState[]; tf: number; at: number; until: number; color: string; dx: number }> = ({ frame, path, tf, at, until, color, dx }) => {
  const o = visible(frame, at, until, 10, 8);
  if (o <= 0.001 || tf <= 0.5) return null;
  const s = sampleAt(path, tf);
  const top = project({ x: s.pos.x, y: 0, z: aimZ(s.pos.x) }, SKY_VIEW);
  const bot = project(s.pos, SKY_VIEW);
  const x = top.x + dx;
  return (
    <g opacity={o} stroke={color} strokeWidth={5} strokeLinecap="round" fill="none">
      <line x1={x} y1={top.y} x2={x} y2={bot.y - BR - 2} />
      <line x1={x - 9} y1={top.y} x2={x + 9} y2={top.y} />
      <line x1={x - 9} y1={bot.y - BR - 2} x2={x + 9} y2={bot.y - BR - 2} />
    </g>
  );
};

/** "same angle" arc at the launch spot. */
const AngleMark: React.FC<{ frame: number; at: number; until: number }> = ({ frame, at, until }) => {
  const o = visible(frame, at, until, 10, 8);
  if (o <= 0.001) return null;
  const a = project(START, SKY_VIEW);
  const R = 70;
  const sweep = EL * progress(frame, at, 14, EASE.enter);
  const ex = a.x + Math.cos(sweep) * R;
  const ey = a.y - Math.sin(sweep) * R;
  return (
    <g opacity={o}>
      <line x1={a.x} y1={a.y} x2={a.x + R * 1.25} y2={a.y} stroke={SKY.deep} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <path d={`M${a.x + R},${a.y} A${R},${R} 0 0 0 ${ex},${ey}`} fill="none" stroke={SKY.deep} strokeWidth={5} strokeLinecap="round" />
      <Label x={a.x + R + 28} y={a.y - 26} text="same angle" at={at + 6} until={until} size={22} bg={SKY.deep} color={SKY.cloud} anchor="start" />
    </g>
  );
};

/** Motion arcs behind the huge backswing. */
const WindupArcs: React.FC<{ frame: number; at: number; until: number; x: number }> = ({ frame, at, until, x }) => {
  const o = visible(frame, at, until, 8, 6);
  if (o <= 0.001) return null;
  const hy = SKY_GROUND - TH * 0.52;
  return (
    <g opacity={o * 0.8} fill="none" stroke={SKY.cloud} strokeLinecap="round">
      {[0, 1, 2].map((i) => {
        const R = TH * (0.42 + i * 0.1);
        const a0 = Math.PI * (0.62 + 0.02 * i);
        const a1 = Math.PI * (1.18 + 0.04 * Math.sin(frame / 3 + i));
        return <path key={i} d={`M${x + Math.cos(a0) * R},${hy + Math.sin(a0) * R} A${R},${R} 0 0 1 ${x + Math.cos(a1) * R},${hy + Math.sin(a1) * R}`} strokeWidth={3 - i * 0.6} />;
      })}
    </g>
  );
};

/** Nose, knee and ball dots; they slide into one vertical line with three snaps. */
const FixDots: React.FC<{ frame: number; at: number; snap: number; until: number; nose: { x: number; y: number }; knee: { x: number; y: number }; ball: { x: number; y: number } }> = ({
  frame,
  at,
  snap,
  until,
  nose,
  knee,
  ball,
}) => {
  const o = visible(frame, at, until, 10, 8);
  if (o <= 0.001) return null;
  const dots = [nose, knee, ball];
  const line = progress(frame, snap + 12, 12, EASE.enter);
  const aligned = Math.abs(nose.x - ball.x) < 4 && Math.abs(knee.x - ball.x) < 4;
  return (
    <g opacity={o}>
      {line > 0.001 ? (
        <line x1={ball.x} y1={nose.y - 12} x2={ball.x} y2={nose.y - 12 + (ball.y + 16 - nose.y + 12) * line} stroke={CAST.fix} strokeWidth={3} strokeDasharray="6 6" strokeLinecap="round" />
      ) : null}
      {dots.map((d, i) => {
        const s = popSoft(frame, at + i * 4) * (1 + 0.5 * (frame >= snap + i * 5 ? 1 - progress(frame, snap + i * 5, 10, EASE.soft) : 0));
        return (
          <g key={i} transform={`translate(${d.x} ${d.y}) scale(${s})`}>
            <circle r={8} fill={aligned && frame >= snap + i * 5 ? CAST.fix : SKY.cloud} />
            <circle r={3.5} fill={SKY.deep} />
          </g>
        );
      })}
    </g>
  );
};

/**
 * Metaphor inset: two cars race off two equal ramps (same angle) at the same moment. Top lane: the slow
 * white car. Bottom lane: the fast pink car. The fast one flies further. A bar under each lane marks the
 * jump. Local coordinates fit a circle of radius 170.
 */
const RampCars: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const ang = (32 * Math.PI) / 180;
  const g = 1.0;
  const U = 21; // px per unit
  const T = 5.2; // frames per time unit
  const launch = at + 7;
  const t = (frame - launch) / T;
  const lipX = -112;
  const rampH = 22;
  const rampLen = rampH / Math.sin(ang);
  const lanes = [
    { v: 2.4, ground: -12, color: SKY.cloud, fast: false },
    { v: 3.0, ground: 86, color: CAST.mistake, fast: true },
  ];
  const car = (lane: (typeof lanes)[number], i: number) => {
    const lip = { x: lipX, y: lane.ground - rampH };
    const vx = lane.v * Math.cos(ang);
    const vy0 = lane.v * Math.sin(ang);
    const drop = rampH / U;
    const tLand = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * drop)) / g;
    const landX = lip.x + vx * tLand * U;
    let p: { x: number; y: number };
    let rot = 0;
    if (t < 0) {
      // Driving in: along the flat, then up the ramp.
      const d = lane.v * t * U; // negative distance before the lip
      if (-d <= rampLen) {
        p = { x: lip.x + d * Math.cos(ang), y: lip.y - d * Math.sin(ang) };
        rot = (-ang * 180) / Math.PI;
      } else {
        p = { x: lip.x - rampLen * Math.cos(ang) + (d + rampLen), y: lane.ground };
      }
    } else if (t < tLand) {
      p = { x: lip.x + vx * t * U, y: lip.y - (vy0 * t - 0.5 * g * t * t) * U };
      rot = (-Math.atan2(vy0 - g * t, vx) * 180) / Math.PI;
    } else {
      // Landed: a short skid, then parked.
      const skid = 1 - Math.exp(-(t - tLand) * 1.6);
      p = { x: landX + 12 * skid, y: lane.ground };
    }
    const landed = t >= tLand;
    const bar = progress(frame, launch + tLand * T, 8, EASE.enter);
    const moving = t < tLand + 0.4;
    return (
      <g key={i}>
        {/* Road strip and ramp. */}
        <rect x={-200} y={lane.ground} width={400} height={12} fill={PITCH.grassDark} />
        <path d={`M${lip.x - rampLen * Math.cos(ang)},${lane.ground + 1} L${lip.x},${lip.y} L${lip.x},${lane.ground + 1} Z`} fill={SKY.deep} />
        {/* Jump bar: from the ramp lip to the landing spot. */}
        {bar > 0.001 ? (
          <g stroke={lane.color} strokeWidth={6} strokeLinecap="round">
            <line x1={lip.x} y1={lane.ground + 24} x2={lip.x + (landX - lip.x) * bar} y2={lane.ground + 24} />
            <line x1={lip.x} y1={lane.ground + 17} x2={lip.x} y2={lane.ground + 31} />
            <line x1={landX} y1={lane.ground + 17} x2={landX} y2={lane.ground + 31} opacity={bar} />
          </g>
        ) : null}
        {landed ? <circle cx={landX} cy={lane.ground + 6} r={5 * bar} fill={lane.color} /> : null}
        <g transform={`translate(${p.x} ${p.y}) rotate(${rot})`}>
          {lane.fast && moving ? (
            <g stroke={lane.color} strokeWidth={4} strokeLinecap="round" opacity={0.8}>
              <line x1={-48} y1={-28} x2={-72} y2={-28} />
              <line x1={-46} y1={-18} x2={-80} y2={-18} />
              <line x1={-48} y1={-8} x2={-66} y2={-8} />
            </g>
          ) : null}
          {lane.fast ? (
            <g>
              {/* Low sports car with a spoiler. */}
              <rect x={-38} y={-38} width={14} height={5} rx={2} fill={lane.color} />
              <rect x={-33} y={-35} width={4} height={12} rx={2} fill={lane.color} />
              <rect x={-38} y={-25} width={76} height={17} rx={8} fill={lane.color} />
              <rect x={-16} y={-37} width={30} height={15} rx={7} fill={lane.color} />
              <rect x={-10} y={-34} width={18} height={8} rx={4} fill={SKY.horizon} />
              <rect x={-30} y={-18} width={60} height={3} rx={1.5} fill={SKY.cloud} opacity={0.85} />
            </g>
          ) : (
            <g>
              {/* Tall, boxy car. */}
              <rect x={-32} y={-30} width={64} height={22} rx={8} fill={lane.color} />
              <rect x={-26} y={-48} width={42} height={22} rx={8} fill={lane.color} />
              <rect x={-20} y={-44} width={30} height={11} rx={4} fill={SKY.horizon} />
            </g>
          )}
          {[-19, 19].map((wx) => (
            <g key={wx}>
              <circle cx={wx} cy={-8} r={8.5} fill={SKY.deep} />
              <circle cx={wx} cy={-8} r={3} fill={SKY.cloudShade} />
            </g>
          ))}
        </g>
      </g>
    );
  };
  return (
    <g>
      <rect x={-200} y={-12} width={400} height={220} fill={PITCH.grass} />
      {lanes.map(car)}
      <text x={0} y={-114} fill={SKY.deep} fontFamily={FONTS.label} fontWeight={800} fontSize={29} textAnchor="middle" opacity={progress(frame, at + 4, 10)}>
        faster, further
      </text>
    </g>
  );
};

/** A magnifier on the ball: a teal band on and just above the middle (hit here), the bottom glows pink (not here), then the label. */
const CleanLens: React.FC<{ frame: number; at: number; band: number; bad: number; label: number; until: number }> = ({ frame, at, band, bad, label, until }) => {
  const s = pop(frame, at, { stiffness: 170, damping: 15 }) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const R = 290;
  const r = 165;
  const cx = 1300;
  const cy = 440;
  const bx = 70;
  const bandT = progress(frame, band, 12, EASE.enter);
  const badT = progress(frame, bad, 12, EASE.enter);
  const bootIn = EASE.standard(progress(frame, band + 4, 22, (t) => t));
  const glowPulse = 0.75 + 0.25 * Math.sin(frame / 5);
  const lens = { kind: "side" as const, originX: 0, groundY: 0, ppm: 1 };
  // Contact: the middle of the green band on the back of the ball. The boot turns so its laces lie flat there.
  const bandY = -r * 0.16;
  const contact = { x: bx - Math.sqrt(r * r - bandY * bandY), y: bandY };
  const BOOT_DEG = 90 + (Math.asin(-bandY / r) * 180) / Math.PI;
  return (
    <g>
      <g transform={`translate(${cx} ${cy}) scale(${s})`}>
        <defs>
          <clipPath id="s17lens">
            <circle r={R} />
          </clipPath>
          <clipPath id="s17ball">
            <circle r={r} />
          </clipPath>
        </defs>
        <circle r={R + 14} fill={SKY.cloud} />
        <circle r={R} fill={SKY.top} />
        <g clipPath="url(#s17lens)">
          <Ball cx={bx} cy={0} r={r} view={lens} axis={NO_SPIN_AXIS} angle={0.3 + idle(frame, 2, 4, 0.04)} lineNormal={LINE_N} />
          <g clipPath="url(#s17ball)" transform={`translate(${bx} 0)`}>
            {/* Hit here: on and just above the middle. */}
            <rect x={-r} y={-r * 0.34} width={r * 2 * bandT} height={r * 0.36} fill={CAST.fix} opacity={0.72 + 0.2 * glowPulse} />
            {/* Not here: the bottom of the ball. */}
            <rect x={-r} y={r * 0.5} width={r * 2} height={r * 0.6} fill={CAST.mistake} opacity={0.75 * badT} />
          </g>
          {/* The laces, toes down and ankle locked: the middle of the laces meets the band. The shin
              comes down from above in one line with the foot. */}
          <g transform={`translate(${contact.x - 26 * (1 - bootIn)} ${contact.y}) rotate(${BOOT_DEG}) translate(60 44)`} opacity={progress(frame, band, 8)}>
            <rect x={-430} y={-40} width={300} height={76} rx={38} fill={CAST.skin} />
            <rect x={-250} y={-44} width={112} height={84} rx={30} fill={CAST.sock} />
            <rect x={-250} y={18} width={112} height={22} rx={11} fill={CAST.sockShade} />
            <rect x={-160} y={-44} width={200} height={88} rx={44} fill={PITCH.chalk} />
            <rect x={-150} y={20} width={180} height={18} rx={9} fill={CAST.bootShade} />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={-110 + i * 32} y={-40} width={10} height={28} rx={5} fill={CAST.bootLaces} />
            ))}
          </g>
          {/* Check and cross marks, no words. */}
          <g transform={`translate(${bx + r * 0.62} ${-r * 0.16}) scale(${popSoft(frame, band + 10)})`}>
            <circle r={30} fill={SKY.cloud} />
            <path d="M-13,1 L-3,11 L14,-10" fill="none" stroke={CAST.fix} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g transform={`translate(${bx + r * 0.2} ${r * 0.78}) scale(${popSoft(frame, bad + 6)})`}>
            <circle r={30} fill={SKY.cloud} />
            <path d="M-10,-10 L10,10 M10,-10 L-10,10" fill="none" stroke={CAST.mistake} strokeWidth={8} strokeLinecap="round" />
          </g>
        </g>
      </g>
      <Label x={cx} y={cy + R + 76} text="Clean beats hard" at={label} until={until} size={50} bg={SKY.deep} color={SKY.cloud} />
    </g>
  );
};
