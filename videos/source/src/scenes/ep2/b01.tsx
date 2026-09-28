// b01 Cold open: the next night. The floodlights clunk on, Sam tips out the balls, Chalk steps off his line,
// Tavi faces Sam with her back to the goal. The pass comes, meets a stiff foot (close-up) and bounces away;
// she traps it under her sole, looks up, and Chalk hooks it out from under her foot. Two seconds on a
// stopwatch that felt like nothing, and a chalk question mark.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../../kit/Camera";
import { Dust } from "../../kit/World";
import { Player, POSES, cyclePose, mixPose, poseAt, solve, type Pose } from "../../kit/Player";
import { SAM_COLORS } from "../../kit/Player";
import { Keeper, keeperPoseAt, type KeeperPose, type KeeperPoseName } from "../../kit/Keeper";
import { Ball } from "../../kit/Ball";
import { Arrow, Label } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { simulate, sampleAt } from "../../physics/sim";
import { rollAt } from "../../physics/touch";
import { chalkAt, passInAt, passInTimeToX, TOUCHES } from "../../physics/ep2sims";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, progress } from "../../lib/anim";
import { HEIGHT, PITCH, WIDTH } from "../../theme";
import {
  AnkleLockIcon,
  BALL_R,
  BallBag,
  CHALK_H,
  ChalkSteps,
  GROUND,
  GrassCaption,
  GroundShadow,
  NightWorld,
  PPM,
  SIDE,
  TAVI_H,
  TwoSecondWatch,
  X,
  sideCamAt,
  toScreen,
  type SideKey,
} from "../../kit/ext/ep2-b01-b03-world";
import { ChalkQuestion } from "../../kit/ext/ep2-b01-b03-graphics";

// ---------- Fixed geometry (pitch metres) ----------
const SAM_STAND = -14.3; // where Sam stops with the bag
const SAM_TAP = -13.5; // one step forward, to tap the pass ball into place
const SAM_PASS = -12.35; // hips for the pass: the inside of the foot meets the ball at -12
const BAG_MOUTH = SAM_STAND + 0.45;
const LINE_N = { x: 0.3, y: 0.6, z: 0.74 };
const T_ARRIVE = passInTimeToX(0); // 2.12 s
const STIFF = TOUCHES.STIFF_BOUNCE(); // (-1.43, 0.78) m/s
const STIFF_SPEED = Math.hypot(STIFF.x, STIFF.y); // 1.62 m/s
const STIFF_DX = STIFF.x / STIFF_SPEED; // -0.88: share of the roll along x
const STOP_TAU = 1.1; // Tavi stops the rebound dead 1.1 s after the touch (sim note)
const POKE_TAU = 2.0; // Chalk pokes it 2.0 s after the touch: "two seconds"
const BALL_STOP_X = STIFF_DX * rollAt(STIFF_SPEED, STOP_TAU).x; // -1.14
/** Chalk hooks the ball back out from under her sole, 1.3 m towards himself (rolling, decel 0.8). */
const HOOK_M = 1.3;
const HOOK_V = Math.sqrt(2 * 0.8 * HOOK_M);
const HOOK_FRAMES = Math.round((HOOK_V / 0.8) * 30); // 54: until the hooked ball stops
const BALL_HELD = BALL_STOP_X + HOOK_M; // +0.16, under his front mitten
const GONE_V = 5.0;

// Two balls tumble out of the bag (small tosses, real bounces).
const DROP_A = simulate({ speed: 1.2, elevationDeg: -10, start: { x: BAG_MOUTH, y: 0, z: 0.45 }, restitution: 0.5, friction: 0.6, duration: 2, ground: true, rollDecel: 1.5 }, 30);
const DROP_B = simulate({ speed: 0.55, elevationDeg: -12, azimuthDeg: 180, start: { x: BAG_MOUTH - 0.1, y: 0, z: 0.42 }, restitution: 0.45, friction: 0.6, duration: 2, ground: true, rollDecel: 1.5 }, 30);
const REST_A = DROP_A[DROP_A.length - 1].pos.x;
/** Tap speed that rolls ball A from its rest to exactly -12 (Sam's pass spot). */
const TAP_V = Math.sqrt(2 * 0.8 * Math.max(0.2, -12 - REST_A));
const bounceFrames = (path: typeof DROP_A) => {
  const out: number[] = [];
  for (let i = 1; i < path.length; i++) if (path[i].bounces > path[i - 1].bounces && out.length < 2) out.push(i);
  return out;
};
const BOUNCES_A = bounceFrames(DROP_A);

/** Tavi with her sole on the ball: the near foot raised and forward, toe over the ball. */
const SOLE_STOP: Pose = { torso: 6, head: 12, nearHip: 46, nearKnee: 80, nearAnkle: 78, farHip: -3, farKnee: 4, farAnkle: 90, nearShoulder: -12, nearElbow: 30, farShoulder: 14, farElbow: 30 };
const SOLE_TOE_DX = solve(SOLE_STOP, TAVI_H).nToe.x / PPM; // metres forward of the hips (0.165 H)
/** Sam tipping the bag: bent forward, the far arm down and forward. */
const TIP: Pose = { torso: 24, head: 14, nearHip: 8, nearKnee: 26, nearAnkle: 96, farHip: -10, farKnee: 20, farAnkle: 100, nearShoulder: -10, nearElbow: 40, farShoulder: 62, farElbow: 6 };
const HOLD_BAG: Pose = { ...POSES.stand, farShoulder: -8, farElbow: 6 };
/** Tavi after the ball is taken: the sole comes down where the ball was. */
const FOOT_DOWN: Pose = { ...POSES.stand, torso: 4, head: 2 };
/** Tavi deflating: chest drops, head sinks, arms hang. */
const SAG: Pose = { torso: 12, head: 14, nearHip: 4, nearKnee: 8, nearAnkle: 92, farHip: -4, farKnee: 8, farAnkle: 92, nearShoulder: 2, nearElbow: 8, farShoulder: 6, farElbow: 8 };
/** Chalk is drawn flipped (facing left, towards Tavi) all scene. In flipped poses "left" is his screen-left mitten. */
const SKID: KeeperPose = { left: 22, right: 96, lean: -22, shift: 0, lift: 0, stretch: 1.05 };
/** The poke: the front mitten reaches down to the ball under her sole (tip 0.73 m ahead of his centre). */
const LUNGE: KeeperPose = { left: 38, right: 12, lean: 26, shift: 0, lift: 0, stretch: 0.94 };
const LUNGE_REACH = 0.73;
/** Standing over the hooked ball: the front mitten hovers just above it (0.29 m ahead of his centre). */
const MITTEN: KeeperPose = { left: 10, right: 20, lean: 20, shift: 0, lift: 0, stretch: 0.96 };
const MITTEN_REACH = 0.29;
/** The swipe that sends the ball away to the right: wind up to the left, then sweep the front mitten across. */
const WIND: KeeperPose = { left: 50, right: 16, lean: 12, shift: 0, lift: 0, stretch: 0.97 };
const SWIPE: KeeperPose = { left: -45, right: 16, lean: -14, shift: 0, lift: 0, stretch: 1.02 };
/** Where Chalk pokes from (behind her, reaching past her legs) and where he stands over the ball. */
const POKE_CM = BALL_STOP_X + LUNGE_REACH; // -0.41
const OVER_M = BALL_HELD + MITTEN_REACH; // +0.45

/** Alternating run poses from f0 to f1, every `step` frames, then `end`. */
const runTrack = (f0: number, f1: number, step: number, end: KeeperPose | KeeperPoseName): [number, KeeperPose | KeeperPoseName][] => {
  const t: [number, KeeperPose | KeeperPoseName][] = [];
  for (let f = f0, k = 0; f < f1; f += step, k++) t.push([f, k % 2 ? "runB" : "runA"]);
  t.push([f1, end]);
  return t;
};
const easeOut = (t: number) => 1 - (1 - clamp01(t)) * (1 - clamp01(t));
const linear = (t: number) => t;
/** A floodlight clunking on at `at`: a flash, a dip, then full. */
const clunk = (frame: number, at: number) => {
  const k = frame - at;
  if (k < 0) return 0;
  return k < 1 ? 0.85 : k < 2 ? 0.4 : k < 3 ? 0.95 : k < 4 ? 0.7 : 1;
};
/** Tower index (left to right) and the frame it clunks on: the four in shot one after another. */
const LAMP_AT = [10, 1, 4, 7, 10, 10];
const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};

export const B01: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b01");

  // Beats.
  const tNight = cue("The next night");
  const tSam = cue("Your friend Sam's");
  const tChalk = cue("Chalk's out of goal");
  const tChasing = cue("chasing");
  const tBack = cue("Your back's to the goal");
  const tFace = cue("You face Sam");
  const tPass = cue("The pass comes");
  const tStiff = cue("Stiff foot");
  const tBounce = cue("It bounces away");
  const tLook = cue("You look up");
  const tThere = cue("Chalk's already there");
  const tGone = cue("Ball gone");
  const tTwo = cue("You had the ball for two seconds");
  const tFelt = cue("It felt like nothing");
  const tWhere = cue("Where did the time go");
  const END = cue.frames;

  // Shots.
  const cutS = tSam - 6;
  const cutC = tChalk - 4;
  const cutW = tBack - 3;
  const cutM = tStiff + 2;

  // Sam's business.
  const samIn = cutS;
  const samStop = samIn + 32;
  const tipAt = samStop + 6;
  const dropAt = tipAt + 6;
  const stepAt = tipAt + 18;
  const tapAt = stepAt + 12;
  const samStep2 = tPass - 18;
  const kick = tPass + 4;
  const arriveF = kick + T_ARRIVE * 30;
  const contact = Math.ceil(arriveF);
  const stopF = Math.round(kick + (T_ARRIVE + STOP_TAU) * 30);
  const pokeF = Math.round(kick + (T_ARRIVE + POKE_TAU) * 30);
  const goneF = tGone + 4;
  // Two small rolls of the held ball under his mitten while he waits ("mine"): out and back, 0.07 m during
  // the long pause and 0.08 m after "there". They fill the hold without moving the ball out of his reach.
  const tap1At = pokeF + 56;
  const tap1End = tap1At + 22;
  const dribbleAt = tThere + 14;
  const dribbleEnd = goneF - 8;
  const roll = (f: number) => {
    const bump = (a: number, b: number, amp: number) => (f >= a && f < b ? amp * Math.sin((Math.PI * (f - a)) / (b - a)) : 0);
    return bump(tap1At, tap1End, 0.07) + bump(dribbleAt, dribbleEnd, 0.08);
  };

  // Chalk's business.
  const riseAt = tChalk;
  const runAt = riseAt + 24;
  const runEnd = runAt + 46; // 6.1 m at 4 m/s
  const brakeAt = kick + Math.round(2.55 * 30);
  const skidStop = brakeAt + 13;
  const dartAt = pokeF - 9;
  const followAt = pokeF + 4;
  const followEnd = pokeF + 50;

  // Tavi's business.
  const walkAt = riseAt + 12;
  const walkEnd = walkAt + 62;
  const turnAt = walkEnd + 4;

  // ---------- Camera ----------
  const keys: SideKey[] =
    frame < cutS
      ? [
          { f: 0, x: X(3.2), y: GROUND - 214, zoom: 1.12 },
          { f: cutS, x: X(2.4), y: GROUND - 200, zoom: 1.22 },
        ]
      : frame < cutC
        ? [
            { f: cutS, x: X(-13.6), y: GROUND - 62, zoom: 2.9 },
            { f: cutC, x: X(-13.8), y: GROUND - 60, zoom: 3.05 },
          ]
        : frame < cutW
          ? [
              { f: cutC, x: X(15.2), y: GROUND - 95, zoom: 2.2 },
              { f: cutC + 26, x: X(15.2), y: GROUND - 95, zoom: 2.2 },
              { f: cutW, x: X(12.4), y: GROUND - 92, zoom: 2.1 },
            ]
          : frame < cutM
            ? [
                // Wide: Sam, Tavi and all of Chalk (mittens included) in shot.
                { f: cutW, x: X(-0.9), y: GROUND - 120, zoom: 1.36 },
                { f: cutM, x: X(-0.7), y: GROUND - 112, zoom: 1.43 },
              ]
            : [
                // Close on Tavi for the stiff touch (her foot about 55 px), then ease out as she looks up,
                // then a slow push through the steal and the long pause, and a last push to the question mark.
                { f: cutM, x: X(-0.3), y: GROUND - 44, zoom: 5.0 },
                { f: contact + 16, x: X(-0.42), y: GROUND - 46, zoom: 5.2 },
                { f: tLook + 8, x: X(-0.3), y: GROUND - 62, zoom: 3.5 },
                // The long pause: a 15% push over about 4.5 s, so the hold keeps moving.
                { f: pokeF + 2, x: X(-0.3), y: GROUND - 62, zoom: 3.5 },
                { f: tGone + 12, x: X(-0.2), y: GROUND - 58, zoom: 4.02 },
                { f: tWhere + 30, x: X(-0.4), y: GROUND - 56, zoom: 4.05 },
                { f: END, x: X(-0.95), y: GROUND - 30, zoom: 4.9 },
              ];
  // The opening push moves from the very first frame (no ease-in), while the lights clunk on.
  const cam = sideCamAt(frame, keys, frame < cutS ? linear : EASE.camera);
  const lamps = LAMP_AT.map((at) => clunk(frame, at));

  // ---------- The pass ball (pitch metres along x) ----------
  const ballX = (f: number): number => {
    if (f < dropAt) return BAG_MOUTH;
    if (f < tapAt) return sampleAt(DROP_A, f - dropAt).pos.x;
    if (f < kick) return REST_A + rollAt(TAP_V, (f - tapAt) / 30).x;
    const t = (f - kick) / 30;
    if (t < T_ARRIVE) return Math.min(0, passInAt(t).x);
    const tau = t - T_ARRIVE;
    if (tau < STOP_TAU) return STIFF_DX * rollAt(STIFF_SPEED, tau).x;
    if (f < pokeF) return BALL_STOP_X;
    if (f < goneF) {
      const hooked = BALL_STOP_X + rollAt(HOOK_V, Math.min(HOOK_FRAMES, f - pokeF) / 30).x;
      return hooked + roll(f);
    }
    return BALL_HELD + rollAt(GONE_V, (f - goneF) / 30).x;
  };
  const ballZ = (f: number) => (f >= dropAt && f < tapAt ? sampleAt(DROP_A, f - dropAt).pos.z : 0.11);
  const bx = ballX(frame);
  const ballAngle = (bx - BAG_MOUTH) / 0.11;
  const squash = frame >= contact && frame < contact + 8 ? 1 - 0.2 * Math.exp(-(frame - contact) / 2.5) : 1;
  const trail: { x: number; y: number }[] = [];
  const trailOn = (frame >= kick && frame < stopF) || (frame >= pokeF + 1 && frame < pokeF + 26) || (frame >= goneF && frame < goneF + 70);
  if (trailOn) {
    for (let k = 14; k >= 0; k--) {
      const f = frame - k;
      if (f < kick) continue;
      trail.push({ x: X(ballX(f)), y: GROUND - ballZ(f) * PPM });
    }
  }
  const ballInBag = frame < dropAt;
  const ballB = frame >= dropAt ? sampleAt(DROP_B, frame - dropAt).pos : null;

  // ---------- Sam ----------
  let samM: number;
  let samPose: Pose;
  if (frame < samStop) {
    samM = lerp(-19.5, SAM_STAND, clamp01((frame - samIn) / (samStop - samIn)));
    samPose = { ...cyclePose(frame - samIn, "run", 7), farShoulder: -14, farElbow: 8 };
  } else if (frame < stepAt) {
    samM = SAM_STAND;
    samPose = poseAt(frame, [
      [samStop, { ...cyclePose(samStop - samIn, "run", 7), farShoulder: -14, farElbow: 8 }],
      [samStop + 6, HOLD_BAG],
      [tipAt, HOLD_BAG],
      [tipAt + 7, TIP],
      [dropAt + 6, TIP],
      [stepAt, "stand"],
    ]);
  } else if (frame < samStep2) {
    const w = clamp01((frame - stepAt) / 12);
    samM = lerp(SAM_STAND, SAM_TAP, smooth(w));
    samPose =
      frame < stepAt + 12
        ? cyclePose(frame - stepAt, "walk", 6)
        : poseAt(frame, [
            [stepAt + 12, cyclePose(12, "walk", 6)],
            [tapAt - 3, "ready"],
            [tapAt, "passInside"],
            [tapAt + 9, "stand"],
          ]);
  } else {
    const w = clamp01((frame - samStep2) / 14);
    samM = lerp(SAM_TAP, SAM_PASS, smooth(w));
    samPose =
      frame < samStep2 + 14
        ? cyclePose(frame - samStep2, "walk", 7)
        : poseAt(frame, [
            [samStep2 + 14, cyclePose(14, "walk", 7)],
            [kick - 5, "ready"],
            [kick, "passInside"],
            [kick + 8, "follow"],
            [kick + 24, "stand"],
          ]);
  }
  const samX = X(samM);
  const samJ = solve(samPose, TAVI_H);
  const samDy = GROUND - samJ.lowest - (samPose.lift ?? 0) * TAVI_H;
  const bagHand = { x: samX + samJ.fh.x, y: samJ.fh.y + samDy };
  const tipT = progress(frame, tipAt, 8, EASE.standard);
  const bagDown = frame >= stepAt - 4;
  const bagBallsLeft = frame < dropAt ? 3 : 1;
  const bagSwing = frame < samStop ? Math.sin((frame - samIn) / 3.5) * 9 : 0;
  const samFace = frame >= kick - 6 && frame < kick + 20 ? "focus" : frame >= tapAt + 8 && frame < kick - 20 ? "happy" : "neutral";

  // ---------- Tavi ----------
  let taviM: number;
  let taviPose: Pose;
  let flip = false;
  let turnScale = 1;
  let headTurn = 0;
  if (frame < walkEnd) {
    taviM = lerp(-4, 0.2, clamp01((frame - walkAt) / (walkEnd - walkAt)));
    taviPose = frame < walkAt ? POSES.walk1 : cyclePose(frame - walkAt, "walk", 12);
  } else if (frame < contact - 8) {
    taviM = 0.2;
    // The half-turn to face Sam: the side view narrows (never to zero) and flips at the midpoint, so she
    // ends facing left at full width and stays that way until the pass arrives.
    const turn = progress(frame, turnAt, 8, EASE.standard);
    turnScale = Math.max(0.25, Math.abs(Math.cos(turn * Math.PI)));
    flip = turn > 0.5;
    taviPose = poseAt(frame, [
      [walkEnd, cyclePose(walkEnd - walkAt, "walk", 12)],
      [walkEnd + 4, "stand"],
      [turnAt + 8, "stand"],
      [turnAt + 20, "receiveReady"],
    ]);
  } else if (frame < stopF) {
    flip = true;
    const w = smooth(clamp01((frame - (contact + 4)) / (stopF - contact - 4)));
    taviM = lerp(0.2, BALL_STOP_X + SOLE_TOE_DX, w);
    taviPose =
      frame < contact + 4
        ? poseAt(frame, [
            [contact - 8, "receiveReady"],
            [contact - 1, "receiveStiff"],
            [contact + 4, "receiveStiff"],
          ])
        : poseAt(frame, [
            [contact + 4, "receiveStiff"],
            [contact + 12, cyclePose(8, "walk", 8)],
            [contact + 20, cyclePose(16, "walk", 8)],
            [stopF - 6, cyclePose(22, "walk", 8)],
            [stopF, SOLE_STOP],
          ]);
  } else {
    // Her sole stays on the ball; only the head comes up. Chalk hooks it out from under her foot at the poke,
    // the foot drops where the ball was and she deflates: a first sag after the steal, more on "there",
    // then the half shrug on "Ball gone".
    flip = true;
    taviM = BALL_STOP_X + SOLE_TOE_DX;
    const footDown = progress(frame, pokeF, 8, EASE.standard);
    // The deflate never stops through the long pause: a first drop right after the steal, a slow sink while
    // Chalk backs off with the ball, and the rest on "there". A heavy breath keeps her alive in the hold.
    const sag =
      0.35 * progress(frame, pokeF + 6, 20, EASE.standard) +
      0.3 * progress(frame, followEnd - 10, 40, EASE.standard) +
      0.35 * progress(frame, tThere + 4, 26, EASE.standard);
    const shrugMix = progress(frame, tGone + 6, 14, EASE.standard) * (1 - progress(frame, tWhere - 10, 16, EASE.standard));
    const base = mixPose(mixPose(SOLE_STOP, FOOT_DOWN, footDown), SAG, sag * (1 - shrugMix * 0.6));
    const mixed = mixPose(base, POSES.shrug, shrugMix * 0.55);
    const breath = Math.sin((frame - pokeF) / 10) * 1.6 * progress(frame, pokeF + 6, 20, EASE.standard);
    taviPose = { ...mixed, torso: mixed.torso + breath, head: mixed.head + breath * 1.4 };
    headTurn = progress(frame, tLook, 10, EASE.standard) * (1 - progress(frame, tGone + 14, 14, EASE.standard));
  }
  const taviX = X(taviM);
  const taviFace = frame >= contact - 2 && frame < tBounce + 16 ? "wince" : frame >= tLook && frame < tGone + 10 ? "focus" : "neutral";
  const showTavi = frame >= walkAt - 2;

  // ---------- Chalk ----------
  const rise = progress(frame, riseAt, 22, EASE.standard);
  // He skids on past her mark (a skid keeps its direction: 4 m/s braking over 13 frames is about 0.85 m),
  // stops a hand's width behind her, steps in and pokes the ball out from under her sole, then backs off
  // with it under his front mitten.
  const cBrake = chalkAt((brakeAt - kick) / 30).x;
  const skidEnd = cBrake - 0.85;
  let chalkM: number;
  const chalkFlip = true;
  if (frame < runAt) chalkM = 17;
  else if (frame < runEnd) chalkM = lerp(17, 10.9, (frame - runAt) / (runEnd - runAt));
  else if (frame < kick) chalkM = 10.9;
  else if (frame < brakeAt) chalkM = chalkAt((frame - kick) / 30).x;
  else if (frame < dartAt) chalkM = lerp(cBrake, skidEnd, easeOut((frame - brakeAt) / (skidStop - brakeAt)));
  else if (frame < pokeF) chalkM = lerp(skidEnd, POKE_CM, smooth((frame - dartAt) / (pokeF - 1 - dartAt)));
  else chalkM = lerp(POKE_CM, OVER_M, smooth((frame - followAt) / (followEnd - followAt)));
  const following = frame >= followAt && frame < followEnd;
  const chalkX = X(chalkM);
  const chalkTrack: [number, KeeperPose | KeeperPoseName][] = [
    [riseAt, "stand"],
    [runAt - 6, "stand"],
    [runAt - 2, "wide"],
    ...runTrack(runAt, runEnd, 7, "ready"),
    [runEnd + 8, "stand"],
    [kick - 4, "stand"],
    [kick, "ready"],
    ...runTrack(kick + 3, brakeAt, 7, SKID),
    [skidStop, SKID],
    [skidStop + 8, "stand"],
    [dartAt, "stand"],
    [dartAt + 4, "runA"],
    [pokeF - 3, LUNGE],
    [pokeF + 2, LUNGE],
    [pokeF + 12, MITTEN],
    [goneF - 8, MITTEN],
    [goneF - 3, WIND],
    [goneF + 1, SWIPE],
    [goneF + 8, SWIPE],
    [goneF + 20, "stand"],
  ];
  const kBase = keeperPoseAt(frame, chalkTrack);
  // Small shuffle while he backs off with the ball, the mitten riding the little roll, and a pop on "there".
  // His lean rides each little roll (0.08 m of roll is 6 degrees of lean), plus a slow weight shift while he waits.
  const dribbleLean = -75 * roll(frame) + idle(frame, 9, 2.4, 2.5) * progress(frame, followEnd - 6, 14, EASE.standard) * (1 - progress(frame, goneF - 10, 8, EASE.standard));
  const therePop = frame >= tThere - 2 && frame < tThere + 10 ? Math.sin((Math.PI * (frame - tThere + 2)) / 12) : 0;
  const kPose: KeeperPose = {
    ...kBase,
    lean: kBase.lean + dribbleLean,
    lift: kBase.lift + (following ? 0.012 * Math.abs(Math.sin((frame - followAt) / 4)) : 0),
    stretch: kBase.stretch * (1 + idle(frame, 5, 2.6, 0.006) + 0.05 * therePop),
  };
  // One eyebrow at "chasing" (business), and one eyebrow up on "there" (beaten her to it).
  const kFace = (frame >= tChasing - 4 && frame < tChasing + 24) || (frame >= tThere - 1 && frame < tGone + 18) ? "thinking" : "flat";
  // Where he looks on screen (-1 left .. 1 right); the Keeper mirrors his eyes when flipped.
  const lookScreen =
    frame < kick ? -0.5 + idle(frame, 2, 3, 0.2) : frame < pokeF + 8 ? -0.8 : frame < tThere - 2 ? -0.5 : frame < goneF - 2 ? -1 : 0.8;
  const kLook = chalkFlip ? -lookScreen : lookScreen;
  const chalkSteps = [
    ...Array.from({ length: 7 }, (_, i) => ({ x: X(17 - (6.1 * (i * 7)) / 46), f: runAt + i * 7 })),
    ...Array.from({ length: 11 }, (_, i) => ({ x: X(chalkAt(((i * 7) + 3) / 30).x), f: kick + 3 + i * 7 })),
  ];

  // ---------- HUD in screen space ----------
  const taviS = toScreen({ x: taviX, y: GROUND - TAVI_H * 0.5 }, cam);
  const spotS = toScreen({ x: X(BALL_STOP_X + 0.1), y: GROUND }, cam);
  const dimT = progress(frame, tWhere, 18, EASE.standard);
  // The watch fills 0.0 to 2.0 s in 40 frames, so it reads 2.0 on "seconds" and holds until the slump.
  const WATCH_FILL = 40;
  const watchValue = 2 * clamp01((frame - tTwo) / WATCH_FILL);
  const slump = progress(frame, tFelt + 2, 16, EASE.standard);
  const ghostOn = frame >= tTwo && frame < tFelt + 8;
  const ghostF = contact + clamp01((frame - tTwo) / WATCH_FILL) * (pokeF - contact);
  // The stand clock steps back while the stopwatch is up: one clock face at a time.
  const clockOpacity = 1 - 0.8 * progress(frame, tTwo - 6, 10, EASE.standard) * (1 - progress(frame, tWhere - 4, 14, EASE.standard));
  // Tavi's near ankle on screen, for the lock icon at the stiff touch.
  const ankleJ = solve(taviPose, TAVI_H);
  const ankleS = toScreen({ x: taviX + (flip ? -ankleJ.na.x : ankleJ.na.x), y: ankleJ.na.y + GROUND - ankleJ.lowest - (taviPose.lift ?? 0) * TAVI_H }, cam);
  const ghostPts: { x: number; y: number }[] = [];
  if (ghostOn) for (let f = contact; f <= ghostF; f += 2) ghostPts.push({ x: X(ballX(f)), y: GROUND - 0.11 * PPM });
  const ballOverChalk = frame >= pokeF && frame < goneF;
  const ballOverTavi = frame >= kick && frame < goneF;

  const ballNode = (
    <Ball cx={X(bx)} cy={GROUND - ballZ(frame) * PPM} r={BALL_R} view={SIDE} axis={{ x: 0, y: 1, z: 0 }} angle={ballAngle} lineNormal={LINE_N} squash={squash} />
  );

  return (
    <Stage bg={PITCH.sky}>
      {/* The next night: the four lights clunk on, the clock reads nine. */}
      <NightWorld cam={cam} seed="b01" lamps={lamps} clockOpacity={clockOpacity}>
        <GrassCaption x={X(2.6)} y={GROUND + 82} text="NIGHT 2" at={tNight + 6} until={cutS - 6} size={64} />
        {/* Chalk's chalk footprints and the balls that stay on the grass. */}
        <ChalkSteps steps={chalkSteps} frame={frame} />
        {ballB ? <Ball cx={X(ballB.x)} cy={GROUND - ballB.z * PPM} r={BALL_R} view={SIDE} angle={(ballB.x - BAG_MOUTH) / 0.11} axis={{ x: 0, y: 1, z: 0 }} lineNormal={LINE_N} /> : null}
        {/* The bag: in Sam's hand, tipped, then left on the grass. */}
        {frame >= samIn - 2 ? (
          bagDown ? (
            <BallBag x={X(SAM_STAND + 0.2)} y={GROUND - 0.36 * PPM} tilt={1} balls={bagBallsLeft} />
          ) : (
            <BallBag x={bagHand.x} y={bagHand.y} tilt={tipT} balls={bagBallsLeft} swing={bagSwing} />
          )
        ) : null}
        {/* Depth: the ball is behind Tavi (pitch y > 0), Chalk chases in front (pitch y < 0). */}
        {!ballInBag && !ballOverTavi ? ballNode : null}
        {trail.length > 1 ? (
          <polyline points={trail.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke={PITCH.lightSoft} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} />
        ) : null}
        {ghostOn && ghostPts.length > 1 ? (
          <g>
            <polyline points={ghostPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke={PITCH.chalk} strokeWidth={2.5} strokeDasharray="2 7" strokeLinecap="round" opacity={0.6} />
            <circle cx={X(ballX(ghostF))} cy={GROUND - 0.11 * PPM} r={BALL_R} fill={PITCH.chalk} opacity={0.22} />
            <circle cx={X(ballX(ghostF))} cy={GROUND - 0.11 * PPM} r={BALL_R} fill="none" stroke={PITCH.chalk} strokeWidth={1.6} strokeDasharray="3 3" opacity={0.85} />
          </g>
        ) : null}
        {frame >= samIn - 2 ? <GroundShadow x={samX} y={GROUND} w={0.7 * PPM} /> : null}
        {frame >= samIn - 2 ? <Player x={samX} groundY={GROUND} h={TAVI_H} pose={samPose} face={samFace} colors={SAM_COLORS} /> : null}
        {showTavi ? <GroundShadow x={taviX} y={GROUND} w={0.7 * PPM} /> : null}
        {showTavi ? (
          <g transform={`translate(${taviX} 0) scale(${turnScale} 1) translate(${-taviX} 0)`}>
            <Player x={taviX} groundY={GROUND} h={TAVI_H} pose={taviPose} face={taviFace} flip={flip} headTurn={headTurn} />
          </g>
        ) : null}
        {ballOverTavi && !ballOverChalk ? ballNode : null}
        {rise > 0.001 ? <GroundShadow x={chalkX} y={GROUND} w={1.2 * PPM * rise} opacity={0.26} /> : null}
        {rise > 0.001 ? <Keeper x={chalkX} groundY={GROUND} h={CHALK_H} pose={kPose} face={kFace} rise={rise} look={kLook} flip={chalkFlip} /> : null}
        {ballOverChalk ? ballNode : null}
        <Dust x={X(17)} y={GROUND} at={riseAt + 4} size={60} seed="b01rise" />
        <Dust x={X(16.2)} y={GROUND} at={runAt + 2} size={40} seed="b01go" />
        <Dust x={X(cBrake - 0.35)} y={GROUND} at={brakeAt + 3} size={46} seed="b01skid1" />
        <Dust x={X(skidEnd + 0.1)} y={GROUND} at={brakeAt + 9} size={40} seed="b01skid2" />
        <Dust x={X(BALL_STOP_X)} y={GROUND - 4} at={pokeF} size={34} seed="b01poke" />
        <Dust x={X(BALL_HELD)} y={GROUND - 4} at={goneF} size={30} seed="b01gone" />
        <Label x={X(SAM_STAND)} y={GROUND - 2.0 * PPM} text="SAM" at={samStop + 4} until={cutC - 4} size={19} />
        <Label x={X(15.6)} y={GROUND - 2.75 * PPM} text="CHALK" at={tChasing - 4} until={cutW - 4} size={19} />
        {/* From her back to the goal (off to the right, out of shot): the tip says where it points. */}
        <g opacity={0.55}>
          <Arrow x1={X(0.55)} y1={GROUND - 1.0 * PPM} x2={X(7.4)} y2={GROUND - 1.0 * PPM} at={turnAt + 6} until={Math.max(tFace + 20, tPass - 6)} color={PITCH.chalk} width={5} />
        </g>
        <Label x={X(8.55)} y={GROUND - 1.0 * PPM} text="GOAL" at={turnAt + 16} until={Math.max(tFace + 20, tPass - 6)} size={19} />
        {/* The question mark is written on the grass where the ball was: flattened so it lies on the ground. */}
        <g transform={`translate(${X(-1.25)} ${GROUND + 12}) scale(1 0.58)`}>
          <ChalkQuestion x={0} y={0} at={tWhere + 6} size={62} />
        </g>
      </NightWorld>

      {/* "Where did the time go?": the night dims 30%, except Tavi and the grass where the ball was. */}
      {dimT > 0.001 ? (
        <g>
          <defs>
            <mask id="b01-dim">
              <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#fff" />
              <ellipse cx={taviS.x} cy={taviS.y} rx={0.9 * PPM * cam.zoom} ry={1.05 * PPM * cam.zoom} fill="#000" />
              <ellipse cx={spotS.x} cy={spotS.y + 6 * cam.zoom} rx={0.95 * PPM * cam.zoom} ry={0.34 * PPM * cam.zoom} fill="#000" />
            </mask>
          </defs>
          <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} opacity={0.3 * dimT} mask="url(#b01-dim)" />
        </g>
      ) : null}

      {/* The stiff touch: a lock snaps shut at her ankle as the ball hits it. */}
      <AnkleLockIcon x={ankleS.x + 70} y={ankleS.y - 70} at={contact} until={contact + 26} size={46} />

      <TwoSecondWatch x={600} y={228} value={watchValue} at={tTwo} until={tWhere - 6} slump={slump} />

      {[1, 4, 7, 10].map((f, i) => (
        <Sfx key={`lamp${i}`} name="light-on" at={f} volume={0.34 - i * 0.03} />
      ))}
      <Sfx name="whoosh-long" at={cutS - 8} volume={0.25} />
      <Sfx name="whoosh" at={cutS - 3} volume={0.25} />
      {BOUNCES_A.map((b, i) => (
        <Sfx key={`ba${i}`} name="thump" at={dropAt + b} volume={0.22 - i * 0.06} />
      ))}
      <Sfx name="thump" at={dropAt + 5} volume={0.16} />
      <Sfx name="pop" at={samStop + 4} volume={0.3} />
      <Sfx name="thump" at={tapAt} volume={0.28} />
      <Sfx name="whoosh" at={cutC - 3} volume={0.28} />
      <Sfx name="chalk" at={riseAt + 2} volume={0.5} />
      <Sfx name="chalk" at={runAt + 7} volume={0.22} />
      <Sfx name="chalk" at={runAt + 21} volume={0.22} />
      <Sfx name="chalk" at={runAt + 35} volume={0.22} />
      <Sfx name="pop" at={tChasing - 4} volume={0.3} />
      <Sfx name="blip" at={tChasing + 2} volume={0.25} />
      <Sfx name="whoosh" at={cutW - 3} volume={0.28} />
      <Sfx name="chalk" at={turnAt + 6} volume={0.3} />
      <Sfx name="thump" at={kick} volume={0.5} />
      <Sfx name="air" at={kick + 2} volume={0.14} />
      <Sfx name="whoosh" at={cutM - 3} volume={0.28} />
      <Sfx name="thump" at={contact} volume={0.55} />
      <Sfx name="clang" at={contact + 1} volume={0.12} />
      <Sfx name="thump" at={stopF} volume={0.32} />
      <Sfx name="whoosh" at={brakeAt} volume={0.4} />
      <Sfx name="chalk" at={brakeAt + 4} volume={0.35} />
      <Sfx name="whoosh" at={dartAt} volume={0.25} />
      <Sfx name="thump" at={pokeF} volume={0.4} />
      <Sfx name="blip" at={tThere} volume={0.3} />
      <Sfx name="thump" at={goneF} volume={0.4} />
      <Sfx name="whoosh" at={goneF + 2} volume={0.32} />
      <Sfx name="pop-soft" at={tTwo} volume={0.35} />
      {[10, 20, 30, 40].map((k) => (
        <Sfx key={`tk${k}`} name="tick" at={tTwo + k} volume={0.22} />
      ))}
      <Sfx name="subdrop" at={tFelt + 2} volume={0.4} />
      <Sfx name="chalk" at={tWhere + 6} volume={0.45} />
      <Sfx name="whoosh-long" at={tWhere + 30} volume={0.22} />
    </Stage>
  );
};
