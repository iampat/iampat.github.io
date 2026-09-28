// b20 Ending: into space. The run of b19 continues without a cut (same camera, same backdrop): the camera
// dives to her feet in slow motion, the far foot glows lime and opens, the ball passes the near foot and
// meets the back foot, the knee gives and the ball leaves soft across the pitch (ENDING_TOUCH). No arrow in
// the side view: the touch rolls away from the camera, and the map shows where. Cut to the map, frozen at
// the touch: the lime space away from Chalk, the ring swelling to 2.4 s, then 2.2 s as time restarts. Just
// after the readout flips to 2.2 s (still lime) cut to the side view in real time: the ring fades, her
// second touch and a calm pass back to Sam, a short jog towards him, and Chalk braking hard at the empty
// chalk X. The camera pushes in on Chalk for "To nothing": he looks down at the X, then at her, one
// eyebrow up. PASS_IN, CHALK_CHASE, ENDING_RUN and ENDING_TOUCH from src/physics/ep2sims.ts.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, Camera, cameraAt } from "../../kit/Camera";
import { Dust, Glow } from "../../kit/World";
import { Player, POSES, SAM_COLORS, cyclePose, mixPose, poseAt, type Pose } from "../../kit/Player";
import { KPOSES, Keeper, keeperPoseAt, type KeeperPose, type KeeperPoseName } from "../../kit/Keeper";
import { Ball } from "../../kit/Ball";
import { TopField } from "../../kit/Field";
import { TopPlayer, angleTo } from "../../kit/TopPlayer";
import { TimeBubble } from "../../kit/TimeBubble";
import { Arrow, Label, SlowMoTag } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { CHALK_START, ENDING_RUN, SAM, TOUCHES, chalkAt, endingMeet, passInPath, ringSeconds } from "../../physics/ep2sims";
import { CHASE_SPEED, rollAt } from "../../physics/touch";
import { sampleAt } from "../../physics/sim";
import { sceneTiming, useCues } from "../../lib/timing";
import { EASE, clamp01, idle, keys, lerp, progress, visible } from "../../lib/anim";
import type { View } from "../../lib/project";
import { PITCH, XRAY } from "../../theme";
import { B19_HANDOFF } from "../../kit/ext/ep2-b18-b19-hud";
import {
  BALL_R,
  CHALK_H,
  CLOCK_EARLY,
  ENDING_STAGE,
  GAVE_BACK,
  GROUND,
  HANDS_ON_HIPS,
  NightBackdrop,
  RECEIVE_BACK,
  ROLL_AXIS,
  SIDE,
  SKID,
  STRIDE_S,
  SideWorld,
  TAVI_H,
  X,
  breathe,
  chalkBraking,
  depthHint,
  frameOf,
  playerAnchors,
  mixKeeper,
  runCycle,
  simTime,
  smooth,
  toScreen,
  type TimeKey,
} from "../../kit/ext/ep2-b20-b22-world";
import { ChalkOneBrow, ChalkX, EyeLock, NetBag, SecondsPill, SpacePatch } from "../../kit/ext/ep2-b20-b22-hud";

// ---------- The sims ----------

const H = B19_HANDOFF;
const B19_FRAMES = sceneTiming("b19").frames;
const MEET = endingMeet(); // t 1.34 s, x -4.0, y -0.3: where ENDING_RUN meets PASS_IN
const MEET_V = { x: MEET.x, y: MEET.y, z: 0 };
/** The ball's own line is y = 0; she meets it from y = -0.3 with the far foot. */
const B0 = { x: MEET.x, y: 0 };
const OUT = TOUCHES.ENDING_TOUCH(); // (0.24, 2.25) m/s: soft, almost straight across, away from the camera (+y)
const OUT_SPEED = Math.hypot(OUT.x, OUT.y);
const OUT_DIR = { x: OUT.x / OUT_SPEED, y: OUT.y / OUT_SPEED };
const PASS = passInPath();
const T_ARRIVE = Math.hypot(MEET.x - CHALK_START.x, MEET.y - CHALK_START.y) / CHASE_SPEED; // 3.74 s
const SAM_HIP_M = SAM.x - 0.4;
const GIVE_S = 0.03; // sim seconds the foot travels with the ball before the freeze
const GIVE_M = 0.12; // metres the far foot gives along the ball's path
const TAU_CUT = 0.2; // sim seconds after the touch when the map cuts to the side view: ring 2.2 s, lime
const SECOND_TAU = 0.86; // her second touch, seconds after the first
const PASS_TAU = 1.0; // the calm pass back to Sam leaves her foot
const PASS_V = 5.5;
const SAM_END = ENDING_STAGE.sam;
const TAVI_END = ENDING_STAGE.tavi;
const SPOT = ENDING_STAGE.spot;
/** Chalk brakes over the last 0.6 m and stops just short of the empty spot (the chalk X stays in view). */
const BRAKE_M = 0.6;
const BRAKE_S = (2 * BRAKE_M) / CHASE_SPEED;
const T_BRAKE = T_ARRIVE - BRAKE_S;
const BRAKE_X0 = chalkAt(T_BRAKE, MEET_V).x;
const CHALK_STOP = ENDING_STAGE.chalkStop; // where chalkBraking stops him, to a millimetre

const R2 = rollAt(OUT_SPEED, SECOND_TAU);
const P2 = { x: B0.x + OUT_DIR.x * R2.x, y: B0.y + OUT_DIR.y * R2.x };
const STOP_D = R2.v * 0.07; // the second touch kills it in 0.14 s
const P3 = { x: P2.x + OUT_DIR.x * STOP_D, y: P2.y + OUT_DIR.y * STOP_D };
const SAM_FOOT = ENDING_STAGE.samFoot;
const PASS_D = Math.hypot(SAM_FOOT.x - P3.x, SAM_FOOT.y - P3.y);
const PASS_DIR = { x: (SAM_FOOT.x - P3.x) / PASS_D, y: (SAM_FOOT.y - P3.y) / PASS_D };
/** Roll time to Sam's foot: PASS_V t - 0.4 t^2 = PASS_D. */
const T_PASS = (PASS_V - Math.sqrt(PASS_V * PASS_V - 4 * 0.4 * PASS_D)) / (2 * 0.4);

/** The ball after the touch (pitch metres), tau seconds after contact, and how far it has rolled. */
const ballAfter = (tau: number) => {
  if (tau <= 0) return { x: B0.x, y: B0.y, dist: 0 };
  if (tau < SECOND_TAU) {
    const r = rollAt(OUT_SPEED, tau).x;
    return { x: B0.x + OUT_DIR.x * r, y: B0.y + OUT_DIR.y * r, dist: r };
  }
  if (tau < PASS_TAU) {
    const dt = Math.min(0.14, tau - SECOND_TAU);
    const d = R2.v * dt - (R2.v / 0.28) * dt * dt;
    return { x: P2.x + OUT_DIR.x * d, y: P2.y + OUT_DIR.y * d, dist: R2.x + d };
  }
  const r = Math.min(PASS_D, rollAt(PASS_V, tau - PASS_TAU).x);
  return { x: P3.x + PASS_DIR.x * r, y: P3.y + PASS_DIR.y * r, dist: R2.x + STOP_D + r };
};

/** Chalk's x in the last shot: CHALK_CHASE, then a hard brake to a stop just short of the spot. */
const chalkXAt = (t: number) => chalkBraking(t, (tt) => chalkAt(tt, MEET_V), T_ARRIVE).x;

/** The middle of Chalk's two eyes in world pixels (Keeper geometry, drawn with flip on). */
const chalkEyes = (x: number, groundY: number, h: number, pose: KeeperPose, look: number) => {
  const Hh = h * pose.stretch;
  const W = (h * 0.34) / Math.sqrt(pose.stretch);
  const lx = look * W * 0.08;
  const px = lx;
  const py = -Hh * 0.8 + Hh * 0.45;
  const a = (pose.lean * Math.PI) / 180;
  const rx = px * Math.cos(a) - py * Math.sin(a);
  const ry = px * Math.sin(a) + py * Math.cos(a) - Hh * 0.45;
  return { x: x - pose.shift * h - rx, y: groundY - pose.lift * h + ry };
};

// ---------- The map view ----------

const MPPM = 55;
const MX0 = 921.5; // screen x of her old mark
const MY0 = 560;
const MV: View = { kind: "top", originX: MX0 - 87 * MPPM, originY: MY0, ppm: MPPM };
const M = (x: number, y: number) => ({ x: MX0 + x * MPPM, y: MY0 - y * MPPM });
const SPACE = { x: -3.55, y: 1.9 };

export const B20: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b20");

  // ---------- Beats ----------
  const tBack = cue("Back foot");
  const tRolls = cue("It rolls across you");
  const tSoft = cue("Soft touch");
  const tAway = cue("Away from Chalk");
  const tRead = cue("Read the ring");
  const tAlmost = cue("Almost two and a half seconds");
  const tTwo = cue("two");
  const tAlmostEnd = cue.wordEnd("Almost two and a half seconds");
  const tNothing = cue("To nothing");
  const END = cue.frames;

  // Shots.
  const F_C = tSoft - 13; // the ball meets the far foot
  const F_G = F_C + 44; // the give ends, time stops
  const cutMap = tAway - 5;
  const cutSide = tAlmostEnd + 5; // just after the readout reads 2.2 s

  // ---------- Shot A time: slow motion from the b19 handoff, a freeze after the give ----------
  const TIME_A: TimeKey[] = [
    [0, H.simTimeAtEnd],
    [tBack, 1.285],
    [F_C, MEET.t],
    [F_G, MEET.t + GIVE_S],
  ];
  // ---------- Shot B time (tau after the touch): frozen at the touch, then 2.4 -> 2.2 s ----------
  const TAU_B: TimeKey[] = [
    [cutMap, GIVE_S],
    [tTwo, GIVE_S],
    [cutSide, TAU_CUT],
  ];
  const fTick22 = Math.round(frameOf(0.16, TAU_B)); // the readout flips to 2.2 s
  // ---------- Shot C time: real time from the cut ----------
  const fOfTau = (tau: number) => cutSide + Math.round((tau - TAU_CUT) * 30);
  const fSecond = fOfTau(SECOND_TAU);
  const fPass = fOfTau(PASS_TAU);
  const fBrake = fOfTau(T_BRAKE - MEET.t);
  const fArrive = fOfTau(T_ARRIVE - MEET.t);
  const fSamStop = fOfTau(PASS_TAU + T_PASS);
  const fJog = fPass + 8;
  const fJogEnd = fArrive - 2;
  const fGaze = fArrive + 16; // he looks down at the X
  const fBrow = tNothing + 10; // then at her, one eyebrow up

  const sfx = (
    <>
      <Sfx name="air" at={tBack + 2} volume={0.22} />
      <Sfx name="pop-soft" at={tBack + 6} volume={0.3} />
      <Sfx name="subdrop" at={tRolls} volume={0.28} />
      <Sfx name="thump" at={F_C} volume={0.35} />
      <Sfx name="tick" at={F_G + 4} volume={0.25} />
      <Sfx name="whoosh" at={cutMap - 2} volume={0.35} />
      <Sfx name="pop-soft" at={tAway + 2} volume={0.3} />
      <Sfx name="tick" at={tAway + 5} volume={0.25} />
      <Sfx name="air" at={tRead} volume={0.3} />
      <Sfx name="bell" at={tRead + 5} volume={0.35} />
      <Sfx name="tick" at={tAlmost} volume={0.3} />
      <Sfx name="tick" at={fTick22} volume={0.3} />
      <Sfx name="whoosh" at={cutSide - 2} volume={0.3} />
      <Sfx name="chalk" at={cutSide + 10} volume={0.3} />
      <Sfx name="thump" at={fSecond} volume={0.28} />
      <Sfx name="thump" at={fPass} volume={0.4} />
      <Sfx name="whoosh" at={fPass + 2} volume={0.22} />
      <Sfx name="whoosh" at={fArrive - 12} volume={0.4} />
      <Sfx name="chalk" at={fBrake + 1} volume={0.35} />
      <Sfx name="chalk" at={fArrive - 2} volume={0.3} />
      <Sfx name="thump" at={fArrive + 2} volume={0.25} />
      <Sfx name="thump" at={fSamStop} volume={0.2} />
      <Sfx name="whoosh-long" at={fArrive + 8} volume={0.16} />
      <Sfx name="blip" at={fBrow + 2} volume={0.32} />
    </>
  );

  // ================= Shot C: the side view in real time, Chalk arrives to nothing =================
  if (frame >= cutSide) {
    const tC = MEET.t + TAU_CUT + (frame - cutSide) / 30;
    const tau = tC - MEET.t;
    const cam = cameraAt(frame, [
      { f: cutSide, x: X(-4.6), y: GROUND - 100, zoom: 2.0 },
      { f: fPass + 6, x: X(-4.6), y: GROUND - 100, zoom: 2.05 },
      { f: fArrive, x: X(-4.3), y: GROUND - 95, zoom: 2.3 },
      { f: fArrive + 4, x: X(-4.3), y: GROUND - 95, zoom: 2.3 },
      { f: tNothing - 2, x: X(-4.5), y: GROUND - 80, zoom: 3.6 },
      { f: END, x: X(-4.5), y: GROUND - 80, zoom: 3.7 },
    ]);
    // Chalk: the last strides, the hard brake, then puffed over the empty X; the double take on "To nothing".
    const chalkM = chalkXAt(tC);
    let kPose: KeeperPose;
    if (frame < fBrake) {
      kPose = runCycle(tC / STRIDE_S);
    } else {
      const track: [number, KeeperPose | KeeperPoseName][] = [
        [fBrake, runCycle((MEET.t + (fBrake - cutSide) / 30 + TAU_CUT) / STRIDE_S)],
        [fBrake + 3, SKID],
        [fArrive + 6, SKID],
        [fArrive + 18, "puffed"],
      ];
      kPose = keeperPoseAt(frame, track);
    }
    // Leaning over towards the X while he looks at it, then straightening up for the look at her.
    const leanX = progress(frame, fGaze - 4, 10, EASE.standard) * (1 - progress(frame, fBrow - 4, 8, EASE.standard));
    const straighten = progress(frame, fBrow - 4, 8, EASE.back);
    if (frame >= fArrive + 18) kPose = mixKeeper(kPose, { ...KPOSES.puffed, lean: 9, shift: -0.03 }, leanX);
    kPose = { ...kPose, stretch: (kPose.stretch + 0.08 * straighten) * (1 + idle(frame, 5, 2.2, 0.01)) };
    const kLook = keys(frame, [fArrive - 4, fGaze, fBrow - 4, fBrow + 2], [0.8, 0.35, 0.35, 1.0]);
    // One eyebrow up as he looks at her (the far brow, so it stays clear of his shade stripe).
    const browUp = progress(frame, fBrow, 9, EASE.back);
    const eyes = chalkEyes(X(chalkM), GROUND, CHALK_H, kPose, kLook);
    const spotW = { x: X(SPOT.x), y: GROUND + depthHint(SPOT.y).dy + 2 };
    const gazeDraw = progress(frame, fGaze, 10, EASE.enter);
    const gazeO = 1 - progress(frame, fBrow - 6, 6, EASE.exit);

    // Tavi: small steps after the ball, the second touch, the pass, a short jog towards Sam, hands on hips.
    const back = lerp(0.6, 0.5, clamp01((tau - TAU_CUT) / (SECOND_TAU - TAU_CUT)));
    const tauHold = Math.min(tau, SECOND_TAU);
    const bh = ballAfter(tauHold);
    const passFrom = { x: bh.x - OUT_DIR.x * 0.5, y: bh.y - OUT_DIR.y * 0.5 };
    let tavi: { x: number; y: number };
    if (tau < SECOND_TAU) tavi = { x: bh.x - OUT_DIR.x * back, y: bh.y - OUT_DIR.y * back };
    else {
      const u = progress(frame, fJog, fJogEnd - fJog, EASE.standard);
      tavi = { x: lerp(passFrom.x, TAVI_END.x, u), y: lerp(passFrom.y, TAVI_END.y, u) };
    }
    const steps = mixPose(POSES.ready, cyclePose(frame, "walk", 9), 0.45);
    const jog = cyclePose(frame - fJog, "run", 7);
    const taviBase = poseAt(frame, [
      [cutSide, steps],
      [fSecond - 5, steps],
      [fSecond, POSES.receiveSoft],
      [fPass - 3, POSES.ready],
      [fPass, POSES.passInside],
      [fJog - 1, POSES.passInside],
      [fJog + 4, jog],
      [fJogEnd - 3, jog],
      [fJogEnd + 6, POSES.stand],
      [fJogEnd + 20, HANDS_ON_HIPS],
    ]);
    const taviPose = frame < fJog + 4 || frame > fJogEnd - 3 ? breathe(taviBase, frame, 1, 0.8) : cyclePose(frame - fJog, "run", 7);
    const tv = depthHint(tavi.y);
    const headTurn = keys(frame, [fBrow + 4, fBrow + 14], [0, 0.85]);
    // Sam: moves left for the pass, stops it with the inside of the foot, stands with the ball.
    const samMove = smooth((tau - 0.35) / 0.6);
    const sam = { x: lerp(SAM.x, SAM_END.x, samMove), y: lerp(SAM.y, SAM_END.y, samMove) };
    const sv = depthHint(sam.y);
    const samBase = poseAt(frame, [
      [cutSide, POSES.receiveReady],
      [fSamStop - 5, POSES.receiveReady],
      [fSamStop, POSES.passInside],
      [fSamStop + 12, POSES.stand],
    ]);
    const samPose = breathe(samBase, frame, 4, 0.7);
    // The ball: the roll into space, the second touch, the pass on its way to Sam.
    const b = ballAfter(tau);
    const bd = depthHint(b.y);
    // The ring, honest to the end: Chalk to the ball, 2.2 s and lime at the cut; it fades as time runs.
    const chase = chalkAt(tC, MEET_V);
    const ringSecs = ringSeconds(chase.x, chase.y, b.x, b.y);
    return (
      <Stage bg={PITCH.sky}>
        <NightBackdrop cam={cam} clockHours={CLOCK_EARLY} frameOffset={B19_FRAMES} />
        <SideWorld cam={cam}>
          {/* The empty receiving spot: a chalk X where the ball met her foot. */}
          <ChalkX x={spotW.x} y={spotW.y} size={14} squash={0.32} width={4} at={cutSide + 8} />
          <TimeBubble x={X(b.x)} y={GROUND + bd.dy} seconds={ringSecs} pxPerSecond={40} minRadius={20} squash={0.3} showNumber={false} at={cutSide - 40} until={cutSide} />
          <NetBag x={X(SAM_END.x - 0.7)} y={GROUND + depthHint(SAM_END.y).dy} w={26} balls={3} />
          <Player x={X(sam.x)} groundY={GROUND + sv.dy} h={TAVI_H * sv.scale} pose={samPose} colors={SAM_COLORS} face={frame >= fSamStop + 6 ? "happy" : "neutral"} />
          <Player x={X(tavi.x)} groundY={GROUND + tv.dy} h={TAVI_H * tv.scale} pose={taviPose} face={frame >= fPass + 4 ? "happy" : "focus"} flip headTurn={headTurn} />
          <ellipse cx={X(b.x) + 2} cy={GROUND + bd.dy - 1} rx={BALL_R * 1.1} ry={BALL_R * 0.35} fill="#000" opacity={0.2} />
          <Ball cx={X(b.x)} cy={GROUND + bd.dy - BALL_R * bd.scale} r={BALL_R * bd.scale} view={SIDE} axis={ROLL_AXIS} angle={b.dist / 0.11} />
          <ChalkOneBrow x={X(chalkM)} groundY={GROUND} h={CHALK_H} pose={kPose} raise={browUp} look={kLook} flip />
          {/* His look down at the empty X: a dotted chalk line from his eyes. */}
          {gazeDraw > 0.01 && gazeO > 0.01 ? (
            <line
              x1={eyes.x}
              y1={eyes.y}
              x2={lerp(eyes.x, spotW.x, gazeDraw)}
              y2={lerp(eyes.y, spotW.y - 3, gazeDraw)}
              stroke={PITCH.chalk}
              strokeWidth={1.6}
              strokeDasharray="0.5 4.5"
              strokeLinecap="round"
              opacity={0.85 * gazeO}
            />
          ) : null}
          <Dust x={X(BRAKE_X0 - 0.2)} y={GROUND} at={fBrake + 1} size={34} seed="b20skid1" />
          <Dust x={X(CHALK_STOP - 0.3)} y={GROUND} at={fArrive - 2} size={40} seed="b20skid2" />
        </SideWorld>
        {sfx}
      </Stage>
    );
  }

  // ================= Shot B: the map, frozen at the touch, then time restarts =================
  if (frame >= cutMap) {
    const tau = simTime(frame, TAU_B);
    const t = MEET.t + tau;
    const chalk = chalkAt(t, MEET_V);
    const ball = ballAfter(tau);
    const secs = ringSeconds(chalk.x, chalk.y, ball.x, ball.y);
    const swell = progress(frame, tRead, 22, EASE.back);
    const pxPerS = lerp(70, 105, swell);
    const ringR = Math.min(320, Math.max(40, secs * pxPerS));
    // Tavi follows her touch.
    const back = lerp(0.65, 0.5, clamp01(tau / SECOND_TAU));
    const tavi = { x: ball.x - OUT_DIR.x * back, y: ball.y - OUT_DIR.y * back };
    const facing = lerp(270, angleTo(0, 0, OUT_DIR.x, -OUT_DIR.y) + 360, smooth(tau / 0.3));
    const stride = tau > 0.1 ? tau * 3 : undefined;
    const samS = M(SAM.x, SAM.y);
    const ballS = M(ball.x, ball.y);
    const chalkS = M(chalk.x, chalk.y);
    const taviS = M(tavi.x, tavi.y);
    const spotS = M(MEET.x, MEET.y);
    const b0S = M(B0.x, B0.y);
    const trail: string[] = [];
    for (let k = 0; k <= tau; k += 0.04) {
      const p = ballAfter(k);
      trail.push(`${M(p.x, p.y).x.toFixed(1)},${M(p.x, p.y).y.toFixed(1)}`);
    }
    trail.push(`${ballS.x.toFixed(1)},${ballS.y.toFixed(1)}`);
    const spaceS = M(SPACE.x, SPACE.y);
    const arrowTo = M(B0.x + OUT_DIR.x * 1.7, B0.y + OUT_DIR.y * 1.7);
    const chaseLine = progress(frame, cutMap + 6, 14, EASE.enter);
    return (
      <Stage bg={PITCH.grassDark}>
        <Camera
          keys={[
            { f: cutMap, x: 900, y: 590, zoom: 1.14 },
            { f: cutMap + 16, x: 930, y: 570, zoom: 1.0 },
            { f: tRead, x: 930, y: 570, zoom: 1.0 },
            { f: tRead + 26, x: 850, y: 560, zoom: 1.1 },
            { f: cutSide, x: 846, y: 560, zoom: 1.12 },
          ]}
        >
          <TopField view={MV} x0={70} x1={110} y0={-14} y1={14} lineOpacity={0.55} />
          <circle cx={M(0, 0).x} cy={M(0, 0).y} r={7} fill={PITCH.chalk} opacity={0.5} />
          {/* The receiving spot: the chalk X that Chalk will run to. */}
          <ChalkX x={spotS.x} y={spotS.y} size={13} width={5} at={cutMap + 2} opacity={0.85} />
          <SpacePatch x={spaceS.x} y={spaceS.y} rx={2.3 * MPPM} ry={1.5 * MPPM} at={tAway} />
          {/* Chalk's line to the spot where she received. */}
          {chaseLine > 0.01 ? <line x1={chalkS.x} y1={chalkS.y} x2={lerp(chalkS.x, spotS.x, chaseLine)} y2={lerp(chalkS.y, spotS.y, chaseLine)} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="3 12" strokeLinecap="round" opacity={0.7} /> : null}
          {trail.length > 1 ? <polyline points={trail.join(" ")} fill="none" stroke={PITCH.lightSoft} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} /> : null}
          <Arrow x1={b0S.x} y1={b0S.y} x2={arrowTo.x} y2={arrowTo.y} at={tAway + 3} until={tTwo + 16} dur={16} color={XRAY.lime} width={8} />
          <TopPlayer x={samS.x} y={samS.y} kind="sam" size={52} facing={angleTo(samS.x, samS.y, ballS.x, ballS.y)} />
          <TopPlayer x={chalkS.x} y={chalkS.y} kind="chalk" size={54} facing={angleTo(chalkS.x, chalkS.y, spotS.x, spotS.y)} stride={t / STRIDE_S} />
          <TopPlayer x={taviS.x} y={taviS.y} kind="tavi" size={52} facing={facing} stride={stride} />
          <ellipse cx={ballS.x + 3} cy={ballS.y + 3} rx={10} ry={7} fill="#000" opacity={0.25} />
          <Ball cx={ballS.x} cy={ballS.y} r={10} view={MV} axis={{ x: -OUT_DIR.y, y: OUT_DIR.x, z: 0 }} angle={ball.dist / 0.11} />
          <TimeBubble x={ballS.x} y={ballS.y} seconds={secs} pxPerSecond={pxPerS} minRadius={40} maxRadius={320} showNumber={false} at={cutMap + 4} />
          {/* The readout sits inside the ring, under the ball, so it never covers the space above. */}
          <SecondsPill x={ballS.x} y={ballS.y + ringR * 0.6} seconds={secs} at={cutMap + 6} size={52} />
          <Label x={spaceS.x} y={spaceS.y - 1.5 * MPPM - 40} text="space" at={tAway + 8} until={tRead + 24} size={34} bg={XRAY.lime} color={PITCH.sky} />
          <Label x={chalkS.x} y={chalkS.y - 66} text="CHALK" at={tAway + 14} until={tRead - 2} size={32} />
        </Camera>
        <SlowMoTag at={-20} until={cutSide - 4} />
        {sfx}
      </Stage>
    );
  }

  // ================= Shot A: the side view, the back-foot touch in slow motion =================
  const tA = Math.min(simTime(frame, TIME_A), MEET.t + GIVE_S);
  const tauA = tA - MEET.t;
  const taviY = ENDING_RUN.y;
  const k = smooth((tA - 1.26) / (1.33 - 1.26));
  // Her hips ease a hand's width behind the ball's line as the stance forms, so the ball meets the back foot's toe.
  const runM = tA <= MEET.t ? -(tA - ENDING_RUN.leaveAt) * ENDING_RUN.speed : MEET.x - ENDING_RUN.speed * tauA * (1 - tauA / 0.12);
  const hipM = runM - 0.12 * k;
  const taviX = X(hipM);
  const twist = clamp01((tA - 0.95) / (MEET.t - 0.95));
  // The run of b19 (same expression, so the join has no seam), blending into the side-on receive.
  const run = cyclePose(Math.max(0, tA - ENDING_RUN.leaveAt) * 30 + 2, "run", 5);
  const runPose: Pose = { ...run, nearShoulder: run.nearShoulder + 18 * twist, farShoulder: run.farShoulder - 18 * twist };
  const give = frame < F_C ? 0 : smooth((frame - F_C) / (F_G - F_C));
  const recv = breathe(mixPose(RECEIVE_BACK, GAVE_BACK, give), frame + B19_FRAMES, 2, 0.4);
  const pose = mixPose(runPose, recv, k);
  const footTurn = 0.6 * progress(frame, tBack + 4, 20, EASE.standard);
  const anchors = playerAnchors(pose, taviX, GROUND, TAVI_H, true, footTurn);
  // The far foot is drawn on the twisted body: its screen x sits closer to the hips by the twist scale.
  const farFoot = { x: taviX + (anchors.farToe.x - taviX) * (1 - 0.28 * twist), y: anchors.farToe.y };
  const farAnkle = { x: taviX + (anchors.farAnkle.x - taviX) * (1 - 0.28 * twist), y: anchors.farAnkle.y };

  // The ball: PASS_IN, then the give along its path (the depth grows a little as it leaves across).
  let ballM: { x: number; y: number };
  if (tA <= MEET.t) {
    const p = sampleAt(PASS, tA * 30).pos;
    ballM = { x: p.x, y: 0 };
  } else {
    ballM = { x: MEET.x + GIVE_M * smooth(tauA / GIVE_S), y: OUT.y * tauA };
  }
  const bw = { x: X(ballM.x), y: GROUND - BALL_R + depthHint(ballM.y).dy };
  const ballAngle = (ballM.x - SAM.x) / 0.11;
  const squash = frame >= F_C && frame < F_C + 14 ? 1 - 0.14 * Math.exp(-(frame - F_C) / 4) : 1;

  // Chalk and Sam as b19 leaves them (both out of the close-up, in frame only at the join).
  const chalk = chalkAt(tA, MEET_V);
  const kPoseA = runCycle(tA / STRIDE_S);
  const secsA = ringSeconds(chalk.x, chalk.y, hipM, taviY);

  // The camera starts exactly where b19's camera ends (same backdrop, same parallax), then dives.
  const cam = cameraAt(frame, [
    { f: 0, x: X(H.camera.xMetres), y: GROUND - H.camera.yAboveGround, zoom: H.camera.zoom },
    { f: tBack + 22, x: X(-3.95) + 55, y: GROUND - 62, zoom: 4.6 },
    { f: F_C - 6, x: X(-4.02) + 60, y: GROUND - 58, zoom: 5.0 },
    { f: F_G + 8, x: X(-4.02) + 60, y: GROUND - 58, zoom: 5.0 },
    { f: cutMap, x: X(-3.9) + 50, y: GROUND - 84, zoom: 3.9 },
  ]);
  const headS = toScreen(cam, anchors.head.x, anchors.head.y);
  const ballS = toScreen(cam, bw.x, bw.y);
  const footS = toScreen(cam, farFoot.x, farFoot.y);
  const glowI = visible(frame, tBack + 2, F_C + 14, 12, 14) * (0.8 + 0.25 * Math.sin(frame / 4));
  const labelP = { x: footS.x + 210, y: footS.y - 170 };

  return (
    <Stage bg={PITCH.sky}>
      <NightBackdrop cam={cam} clockHours={CLOCK_EARLY} frameOffset={B19_FRAMES} />
      <SideWorld cam={cam}>
        <Keeper x={X(chalk.x)} groundY={GROUND} h={CHALK_H} pose={kPoseA} face="flat" look={0.8} flip />
        <Player x={X(SAM_HIP_M)} groundY={GROUND} h={TAVI_H} pose={POSES.stand} colors={SAM_COLORS} face="neutral" />
        <TimeBubble x={taviX} y={GROUND} seconds={secsA} pxPerSecond={H.ring.pxPerSecond} minRadius={H.ring.minRadius} squash={H.ring.squash} showNumber={false} at={-40} />
        {glowI > 0.01 ? <Glow cx={(farFoot.x + farAnkle.x) / 2} cy={farFoot.y - 2} r={0.5 * 50} color={XRAY.lime} intensity={glowI * 1.5} rings={4} /> : null}
        <g transform={`translate(${taviX} 0) scale(${1 - 0.28 * twist} 1) translate(${-taviX} 0)`}>
          <Player x={taviX} groundY={GROUND} h={TAVI_H} pose={pose} face="focus" flip footTurn={footTurn} />
        </g>
        {glowI > 0.01 ? <ellipse cx={(farFoot.x + farAnkle.x) / 2} cy={farFoot.y + 1} rx={9} ry={3} fill="none" stroke={XRAY.lime} strokeWidth={2} opacity={0.9 * glowI} /> : null}
        <Ball cx={bw.x} cy={bw.y} r={BALL_R} view={SIDE} axis={ROLL_AXIS} angle={ballAngle} squash={squash} />
      </SideWorld>

      {/* HUD: the pieces b19 leaves on screen fade as the camera dives; then the labels of this shot. No
          direction arrow here: the touch rolls away from the camera (+y), and the map right after shows where. */}
      <SlowMoTag at={-20} until={cutSide - 4} />
      <SecondsPill x={headS.x} y={headS.y - anchors.headR * cam.zoom - 50} seconds={secsA} at={-40} until={tBack - 2} />
      <EyeLock x={ballS.x - 70} y={ballS.y - 175} bx={ballS.x} by={ballS.y} br={BALL_R * cam.zoom} at={-40} until={4} spin={B19_FRAMES} />
      <Label x={labelP.x} y={labelP.y} text="back foot" at={tBack + 6} until={tRolls + 22} size={36} bg={XRAY.lime} color={PITCH.sky} />
      <Arrow x1={labelP.x - 40} y1={labelP.y + 34} x2={footS.x + 14} y2={footS.y - 16} at={tBack + 10} until={tRolls + 22} dur={10} color={XRAY.lime} width={6} />
      <Label x={footS.x - 40} y={footS.y + 110} text="soft" at={tSoft + 2} until={cutMap - 6} size={36} bg={PITCH.chalk} color={PITCH.sky} />
      {sfx}
    </Stage>
  );
};
