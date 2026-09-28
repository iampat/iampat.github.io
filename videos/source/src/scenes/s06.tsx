// s06 Chapter 1: the playground-swing arc, the standing foot beside the ball, the car alarm,
// kicking knee and chest over the ball, eyes on it, the strike, and the first look at backspin.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../kit/Camera";
import { CarPark, Dust, Floodlight, Glow, GroundSide, Sky, Stands, Stars } from "../kit/World";
import { Player, cyclePose, mixPose, type Pose } from "../kit/Player";
import { Keeper, keeperPoseAt } from "../kit/Keeper";
import { Ball } from "../kit/Ball";
import { Flight } from "../kit/Flight";
import { GoalSide } from "../kit/Goal";
import { Label, SlowMoTag, WordCard } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { simulate, sampleAt, spinAngleAt } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, idle, keys, lerp, pop, popSoft, progress, visible } from "../lib/anim";
import { pathD, project, type View } from "../lib/project";
import { CAST, HEIGHT, PITCH, WIDTH } from "../theme";
import {
  CurlArrow,
  DirArrow,
  DiscMarker,
  EffortBar,
  GhostBall,
  HazardLights,
  NearSide,
  PopDot,
  Pulse,
  SpeedStreaks,
  SwingSeat,
  Target,
  TopInset,
  farLow,
  jointsOf,
  planted,
  swingPose,
} from "../kit/ext/s06-s07-parts";

const PPM = 50;
const OX = 700;
const GROUND = 820;
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const H_T = 1.62 * PPM;
const GOAL_M = 18;
const CAR_X0 = 20; // fence position, metres (kit CarPark: first car 7 m behind it)
const CAR_M = CAR_X0 + 7;
const BALL_R = 0.11 * PPM;
const BALL_Y = GROUND - BALL_R;
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const BACK_M = 0.4; // standing foot behind the ball
const START_M = -1.3; // where Tavi practises the swing, away from the ball
const OVER_M = -0.08; // hip position for "knee and chest over the ball"
const LAND_M = 0.72; // one step past the ball after the strike
const CONTACT = BALL_R + 3; // laces-to-ball-centre distance at contact (pixels)
const CAM_Y = GROUND - 0.72 * PPM;

// Flights: the ghost (standing foot behind) is MISS, the real strike is DRIVE_R.
const MISS = simulate({ ...SHOTS.MISS, duration: 3 }, 30);
const DRIVE = simulate({ ...SHOTS.DRIVE_R, duration: 2 }, 30);
/** First frame where the MISS ghost comes down onto the first car (body 1.05 m, cabin 1.55 m). */
const ROOF_IDX = (() => {
  for (let i = 1; i < MISS.length; i++) {
    const p = MISS[i].pos;
    if (MISS[i].vel.z >= 0) continue;
    const body = p.x > CAR_M - 2.1 && p.x < CAR_M + 2.1 && p.z <= 1.05 + 0.11;
    const cabin = p.x > CAR_M - 1.2 && p.x < CAR_M + 1.1 && p.z <= 1.55 + 0.11;
    if (body || cabin) return i;
  }
  return MISS.length - 1;
})();
const ROOF_HIT = MISS[ROOF_IDX];
/** Small rebound off the roof (the same state, reflected with a soft restitution). */
const BOUNCE = (() => {
  const vx = ROOF_HIT.vel.x * 0.7;
  const vz = -ROOF_HIT.vel.z * 0.4;
  return simulate({ speed: Math.hypot(vx, vz), elevationDeg: (Math.atan2(vz, vx) * 180) / Math.PI, start: { x: ROOF_HIT.pos.x, y: 0, z: ROOF_HIT.pos.z }, cd: 0.25, duration: 1, ground: false }, 30);
})();
/** Highest point of the ghost so far (for the follow camera). */
const MISS_ZMAX = (() => {
  let m = 0;
  return MISS.map((s) => (m = Math.max(m, s.pos.z)));
})();
const ghostAt = (f: number) => (f <= ROOF_IDX ? sampleAt(MISS, Math.max(0, f)) : sampleAt(BOUNCE, f - ROOF_IDX));

// Poses. The kicking leg is replaced by the swing IK when it swings.
const REST: Pose = { torso: 7, head: 6, nearHip: -14, nearKnee: 40, nearAnkle: 118, farHip: 4, farKnee: 12, farAnkle: 92, nearShoulder: -18, nearElbow: 25, farShoulder: 40, farElbow: 22 };
const OVER: Pose = { ...REST, torso: 20, head: 14, farHip: 10, farKnee: 24, farAnkle: 94, nearShoulder: -32, nearElbow: 22, farShoulder: 74, farElbow: 18 };
/** Landing on the kicking foot, one step past the ball. */
const LAND: Pose = { torso: 11, head: 8, nearHip: 14, nearKnee: 14, nearAnkle: 98, farHip: -30, farKnee: 50, farAnkle: 128, nearShoulder: -30, nearElbow: 30, farShoulder: 58, farElbow: 25 };
/** Far boot centre relative to the hip, so the disc sits under the standing foot. */
const DISC_DX = (() => {
  const j = jointsOf(planted(REST, H_T), H_T, 0, GROUND);
  return (j.farAnkle.x + j.farToe.x) / 2;
})();

const deg = (d: number) => (d * Math.PI) / 180;
const asinDeg = (v: number) => (Math.asin(Math.max(-1, Math.min(1, v))) * 180) / Math.PI;

type Cam = { x: number; y: number; zoom: number };

/** Framing that keeps Tavi and the ghost in view (metres: left -1.7, right 4.5 m past the ghost). */
const fitCam = (fg: number): { x: number; y: number; lz: number } => {
  const g = ghostAt(fg);
  const L = -1.7;
  const R = Math.max(4.5, g.pos.x + 4.5);
  const T = Math.max(2.8, MISS_ZMAX[Math.max(0, Math.min(Math.floor(fg), ROOF_IDX))] + 1.7);
  const zoom = Math.min(WIDTH / ((R - L) * PPM), 860 / (T * PPM));
  const cz = T / 2 + 0.8 / zoom;
  return { x: X((L + R) / 2), y: GROUND - cz * PPM, lz: Math.log(zoom) };
};

export const S06: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s06");

  // Beats (scene frames). A few words sit late in the word timing, so small offsets
  // move them onto the audible syllable (checked against the waveform).
  const tSwing = cue("Your foot swings");
  const tPlay = cue("playground swing");
  const tFlat = cue("flat only");
  const tBottom = cue("at the bottom");
  const tMeet = cue("Meet the ball");
  const tThere = cue("ball there");
  const tStandF = cue("standing foot");
  const tBeside = cue("beside the ball");
  const tToes = cue("toes at the goal");
  const tBehind = cue("Put it behind");
  const tKFoot = cue("kicking foot");
  const tRising = cue("already rising"); // the audible "rising" starts here
  const tKnee = cue("Kicking knee");
  const tChest = cue("chest over");
  const tOver = cue("over the ball");
  const tEyes = cue("Eyes on it", 4);
  const tStrike = cue("Strike through");
  const kick = cue("the middle", 8); // the audible "middle"
  const tLine = cue("The line turns");
  const tSlow = cue("slowly backward");
  const tBack = cue("backspin");

  const slideT = progress(frame, tMeet, 24, EASE.standard); // the low point slides onto the ball
  const targetAt = tThere + 4;
  const discAt = tStandF;
  const discLand = discAt + 9;
  const stepA = discLand + 3; // Tavi steps onto the disc
  const STEP_D = 24;
  const insetAt = tBeside + 2;
  const handAt = insetAt + 14;
  const lowAt = tToes + 16;
  const contactF = tRising; // the foot meets the ball on the way up
  const ghostKick = contactF + 12;
  const roofF = ghostKick + ROOF_IDX;
  const zin0 = Math.max(roofF + 14, tKnee + 2); // zoom back in to Tavi
  const zin1 = zin0 + 34;
  const ballBack = zin0 + 4;
  const backStep = zin0 + 8; // disc and Tavi return to the ball
  const kneeGlowAt = tKnee + 20;
  const landF = kick + 20;
  const closeCut = tLine + 1;

  const sfx = (
    <>
      <Sfx name="air" at={tSwing + 8} volume={0.22} />
      <Sfx name="air" at={tSwing + 30} volume={0.2} />
      <Sfx name="pop-soft" at={tPlay} volume={0.35} />
      <Sfx name="tick" at={tFlat + 4} volume={0.35} />
      <Sfx name="pop" at={targetAt} volume={0.3} />
      <Sfx name="whoosh" at={discAt} volume={0.2} />
      <Sfx name="pop-soft" at={discLand} volume={0.4} />
      <Sfx name="thump" at={discLand} volume={0.12} />
      <Sfx name="pop" at={insetAt} volume={0.3} />
      <Sfx name="tick" at={handAt + 6} volume={0.45} />
      <Sfx name="blip" at={tToes} volume={0.3} />
      <Sfx name="whoosh" at={tBehind} volume={0.22} />
      <Sfx name="whoosh" at={tKFoot + 14} volume={0.3} />
      <Sfx name="blip" at={contactF + 4} volume={0.35} />
      <Sfx name="whoosh-long" at={ghostKick} volume={0.35} />
      <Sfx name="clang" at={roofF} volume={0.3} />
      <Sfx name="alarm" at={roofF + 1} volume={0.4} />
      <Sfx name="alarm" at={roofF + 22} volume={0.3} />
      <Sfx name="whoosh" at={zin0} volume={0.25} />
      <Sfx name="pop-soft" at={ballBack} volume={0.25} />
      <Sfx name="blip" at={kneeGlowAt} volume={0.3} />
      <Sfx name="pop-soft" at={tOver + 4} volume={0.3} />
      <Sfx name="tick" at={tEyes + 2} volume={0.3} />
      <Sfx name="pop" at={tStrike} volume={0.3} />
      <Sfx name="thump" at={kick} volume={0.55} />
      <Sfx name="whoosh" at={kick + 2} volume={0.3} />
      <Sfx name="pop-soft" at={landF} volume={0.3} />
      <Sfx name="air" at={closeCut} volume={0.35} dur={100} />
      <Sfx name="pop" at={tBack - 6} volume={0.35} />
    </>
  );

  const effort = <EffortBar x={1180} y={930} w={520} at={tStrike + 8} until={tBack - 6} />;

  if (frame >= closeCut) {
    return (
      <CloseUp kick={kick} start={closeCut} tSlow={tSlow} tBack={tBack} end={cue.frames}>
        {effort}
        {sfx}
      </CloseUp>
    );
  }

  // ---------- Tavi ----------
  const hipM = keys(
    frame,
    [stepA, stepA + STEP_D, tBehind, tBehind + 18, backStep, backStep + 18, kick + 8, kick + 20],
    [START_M, 0, 0, -BACK_M, -BACK_M, OVER_M, OVER_M, OVER_M + LAND_M],
    EASE.standard,
  );
  const discM = keys(frame, [tBehind, tBehind + 18, backStep, backStep + 18], [0, -BACK_M, -BACK_M, 0], EASE.standard);
  const hipX = X(hipM);
  const discX = X(discM) + DISC_DX * 0.3;

  const stepSeg = (a: number, d: number) => (frame > a && frame < a + d ? Math.sin(Math.PI * ((frame - a) / d)) : 0);
  const stepW = Math.max(stepSeg(stepA, STEP_D), stepSeg(tBehind, 18), stepSeg(backStep, 18));
  const walk = cyclePose(frame, "walk", 6);

  const wOver = progress(frame, tChest, 18, EASE.standard);
  const wLand = progress(frame, kick + 8, 12, EASE.standard);
  const baseRaw = mixPose(REST, OVER, wOver);
  const R = farLow(baseRaw, H_T) - BALL_R; // arc radius: the low point is at ball-centre height
  const thetaB = asinDeg((BACK_M * PPM - CONTACT) / R); // contact angle, standing foot behind
  const thetaC = asinDeg((-OVER_M * PPM - CONTACT) / R); // contact angle, knee over the ball

  // Swing angle (0 = straight down, positive = forward) and how much of the IK leg to use.
  const swingAmp = 50 * progress(frame, tSwing, 24, EASE.soft) * (1 - progress(frame, tBottom - 4, 26, EASE.soft));
  let theta = 0;
  let wIK = 0;
  if (frame < stepA) {
    theta = swingAmp * Math.sin((2 * Math.PI * (frame - tSwing)) / 44);
    wIK = progress(frame, tSwing - 8, 12, EASE.soft) * (1 - progress(frame, tBottom + 16, 14, EASE.soft));
  } else if (frame < zin0) {
    if (frame < tKFoot + 14) theta = keys(frame, [tKFoot - 6, tKFoot + 14], [-8, -58], EASE.soft);
    else if (frame < contactF) theta = keys(frame, [tKFoot + 14, contactF], [-58, thetaB], EASE.exit);
    else if (frame < ghostKick) theta = thetaB + 4 * ((frame - contactF) / (ghostKick - contactF));
    else theta = keys(frame, [ghostKick, ghostKick + 10], [thetaB + 4, 70], EASE.enter);
    wIK = progress(frame, tKFoot - 8, 10, EASE.soft) * (1 - progress(frame, ghostKick + 22, 14, EASE.soft));
  } else {
    if (frame < tStrike + 6) theta = thetaC;
    else if (frame < tStrike + 18) theta = keys(frame, [tStrike + 6, tStrike + 18], [thetaC, -55], EASE.soft);
    else if (frame < kick) theta = keys(frame, [tStrike + 18, kick], [-55, thetaC], EASE.exit);
    else theta = keys(frame, [kick, kick + 10], [thetaC, 72], EASE.enter);
    wIK = progress(frame, zin0 + 10, 14, EASE.soft) * (1 - wLand);
  }
  const base: Pose = {
    ...baseRaw,
    torso: baseRaw.torso + idle(frame, 1, 3, 0.8),
    nearShoulder: baseRaw.nearShoulder - theta * 0.3 * wIK,
    farShoulder: baseRaw.farShoulder + theta * 0.25 * wIK,
  };
  let pose = mixPose(base, swingPose(base, H_T, theta, R, 45), wIK);
  pose = mixPose(pose, walk, stepW * 0.85);
  pose = mixPose(pose, LAND, wLand);
  const pl = planted(pose, H_T);
  const hop = Math.sin(Math.PI * wLand) * 0.05;
  pose = { ...pose, lift: (pl.lift ?? 0) * (1 - stepW) * (1 - wLand) + hop };
  const J = jointsOf(pose, H_T, hipX, GROUND);
  const face = (frame >= tKFoot && frame < ghostKick + 10) || (frame >= tKnee && frame < landF + 6) ? "focus" : "neutral";

  // ---------- Camera ----------
  const keysA: CamKey[] = [
    { f: 0, x: X(START_M + 0.3), y: CAM_Y, zoom: 5.3 }, // matches the s05 hand-off frame
    { f: tBottom + 14, x: X(START_M + 0.35), y: CAM_Y, zoom: 5.55 },
    { f: tMeet + 30, x: X(-0.5), y: CAM_Y, zoom: 5.35 },
    { f: stepA + STEP_D, x: X(0.05), y: CAM_Y, zoom: 5.5 },
    { f: tBehind + 18, x: X(-0.3), y: CAM_Y, zoom: 5.6 },
    { f: contactF, x: X(-0.25), y: CAM_Y + 4, zoom: 5.9 },
    { f: ghostKick, x: X(-0.15), y: CAM_Y + 2, zoom: 5.8 },
  ];
  const home: Cam = { x: X(-0.05), y: CAM_Y, zoom: 5.35 };
  const keysB: CamKey[] = [
    { f: zin1, ...home },
    { f: tStrike, x: X(0.05), y: CAM_Y, zoom: 5.6 },
    { f: kick + 4, x: X(0.2), y: CAM_Y, zoom: 5.62 },
    { f: closeCut, x: X(0.6), y: CAM_Y, zoom: 5.5 },
  ];
  /** Follow camera during the ghost: eases from the key camera to the fit framing. */
  const followCam = (upto: number): Cam => {
    const a0 = cameraAt(ghostKick, keysA);
    let c = { x: a0.x, y: a0.y, lz: Math.log(a0.zoom) };
    for (let f = ghostKick + 1; f <= upto; f++) {
      const t = fitCam(f - ghostKick);
      const a = 0.08 + 0.2 * Math.min(1, (f - ghostKick) / 16);
      c = { x: lerp(c.x, t.x, a), y: lerp(c.y, t.y, a), lz: lerp(c.lz, t.lz, a) };
    }
    return { x: c.x, y: c.y, zoom: Math.exp(c.lz) * (1 + 0.012 * progress(upto, roofF, 30, EASE.soft)) };
  };
  const camAt = (f: number): Cam => {
    if (f <= ghostKick) return cameraAt(f, keysA);
    if (f < zin0) return followCam(f);
    if (f < zin1) {
      // Zoom back in, keeping Tavi's screen position moving in a straight line.
      const c0 = followCam(zin0);
      const u = EASE.camera((f - zin0) / (zin1 - zin0));
      const P = { x: X(-0.2), y: GROUND - 0.8 * PPM };
      const s0 = { x: WIDTH / 2 + (P.x - c0.x) * c0.zoom, y: HEIGHT / 2 + (P.y - c0.y) * c0.zoom };
      const s1 = { x: WIDTH / 2 + (P.x - home.x) * home.zoom, y: HEIGHT / 2 + (P.y - home.y) * home.zoom };
      const z = Math.exp(lerp(Math.log(c0.zoom), Math.log(home.zoom), u));
      const sx = lerp(s0.x, s1.x, u);
      const sy = lerp(s0.y, s1.y, u);
      return { x: P.x - (sx - WIDTH / 2) / z, y: P.y - (sy - HEIGHT / 2) / z, zoom: z };
    }
    return cameraAt(f, keysB);
  };
  const cam = camAt(frame);
  const Z = cam.zoom;
  const S = (p: { x: number; y: number }) => ({ x: WIDTH / 2 + (p.x - cam.x) * Z, y: HEIGHT / 2 + (p.y - cam.y) * Z });
  const horizonY = HEIGHT / 2 + (GROUND - cam.y) * Z;
  const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${Z}) translate(${-cam.x} ${-cam.y})`;
  /** Inverse of worldT: lets a screen-space drawing sit between world layers. */
  const screenInWorld = `translate(${cam.x} ${cam.y}) scale(${1 / Z}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`;
  const bgScale = 1 + (Z - 1) * 0.05;

  // ---------- Ball, ghost ----------
  const ballC = { x: X(0), y: BALL_Y };
  const inContact = frame >= contactF && frame < ghostKick;
  const ghostOn = frame >= ghostKick && frame < zin1;
  const gF = frame - ghostKick;
  const gState = ghostAt(gF);
  const gPts = [
    ...MISS.slice(0, Math.max(1, Math.min(Math.floor(gF), ROOF_IDX) + 1)).map((q) => project(q.pos, SIDE)),
    ...(gF > ROOF_IDX ? BOUNCE.slice(0, Math.floor(gF - ROOF_IDX) + 1).map((q) => project(q.pos, SIDE)) : []),
    project(gState.pos, SIDE),
  ];
  const ghostO = 1 - progress(frame, roofF + 8, 14);
  const pathO = visible(frame, ghostKick, zin0 + 6, 4, 10);
  const realBallShown = frame < ghostKick || frame >= ballBack;
  const hazardOn = frame >= roofF && frame < zin1 && Math.floor((frame - roofF) / 6) % 2 === 0;

  // ---------- Chalk ----------
  const kPose = keeperPoseAt(frame, [
    [0, "crossed"],
    [ghostKick + 10, "crossed"],
    [ghostKick + 22, "stand"],
    [roofF + 4, "stand"],
    [roofF + 14, "shrug"],
    [zin0 + 12, "shrug"],
    [zin0 + 26, "crossed"],
  ]);
  const kLook = ghostOn ? Math.max(-0.8, Math.min(1, (gState.pos.x - GOAL_M) / 8)) : -0.7 + idle(frame, 2, 3, 0.15);
  const kFace = frame >= ghostKick + 14 && frame < roofF + 4 ? "surprised" : frame >= roofF + 4 && frame < zin0 + 20 ? "annoyed" : "flat";

  // ---------- Screen-space diagram ----------
  const pivotX = frame < stepA + STEP_D ? lerp(J.hip.x, X(0), slideT) : J.hip.x;
  const hipS = S({ x: pivotX, y: J.hip.y });
  const Rs = R * Z;
  const lowS = S({ x: pivotX, y: J.hip.y + R });
  const arcO = visible(frame, tSwing, ghostKick + 10, 12, 8);
  const arcDraw = progress(frame, tSwing, 30, EASE.standard);
  const radiusO = visible(frame, tMeet, stepA + STEP_D, 10, 10);
  const arcPts = Array.from({ length: 41 }, (_, i) => {
    const a = deg(-72 + 144 * arcDraw * (i / 40));
    return { x: hipS.x + Math.sin(a) * Rs, y: hipS.y + Math.cos(a) * Rs };
  });
  // Seat and its speed arrow ride on the arc in the first beat.
  const seatO = visible(frame, tPlay, tBottom + 18, 12, 8) * popSoft(frame, tPlay);
  const seatR = Rs + 0.07 * PPM * Z;
  const seatS = { x: hipS.x + Math.sin(deg(theta)) * seatR, y: hipS.y + Math.cos(deg(theta)) * seatR };
  const omega = swingAmp * Math.cos((2 * Math.PI * (frame - tSwing)) / 44); // proportional to dtheta/dt
  const tanO = visible(frame, tFlat - 6, tBottom + 6, 10, 8);
  const tanLen = 120 * Math.min(1, Math.abs(omega) / 45);
  const tanAng = omega >= 0 ? -theta : 180 - theta;
  const tanS = { x: hipS.x + Math.sin(deg(theta)) * (seatR + 46), y: hipS.y + Math.cos(deg(theta)) * (seatR + 46) };
  const contactS = S({ x: J.hip.x + Math.sin(deg(thetaB)) * R, y: J.hip.y + Math.cos(deg(thetaB)) * R });
  const ballS = S(ballC);
  const groundS = S({ x: 0, y: GROUND }).y;
  const risingAng = -thetaB * progress(frame, contactF + 2, 10, EASE.standard);
  const gapT = progress(frame, tBehind + 16, 12, EASE.standard);
  const gapO = visible(frame, tBehind + 16, tKFoot, 8, 8);
  const vertTop = S(J.shoulder).y - 40;
  const vertDraw = progress(frame, tOver, 14, EASE.standard);
  const vertO = visible(frame, tOver, tEyes, 8, 8);
  const meetT = pop(frame, targetAt) * (1 - 0.55 * progress(frame, tBehind, 12, EASE.standard)) * (1 - progress(frame, ghostKick, 6, EASE.exit));
  const strikeT = popSoft(frame, tStrike) * (1 - progress(frame, kick, 5, EASE.exit));
  const dropY = -(1 - progress(frame, discAt, 9, EASE.exit)) * 60;
  const discSquash = 1 - 0.3 * Math.sin(Math.PI * progress(frame, discLand, 8, (t) => t));
  const eyeS = S(J.eye);
  const sightT = progress(frame, tEyes, 12, EASE.standard);
  const sightO = 1 - progress(frame, kick + 6, 8, EASE.exit);
  const kneeS = S(J.nearKnee);
  const kneeGlow = Math.sin(Math.PI * Math.min(1, Math.max(0, (frame - kneeGlowAt) / 30)));

  return (
    <Stage bg={PITCH.sky}>
      <Sky />
      <Stars count={90} maxY={Math.max(140, horizonY - 330)} seed="s06" />
      <g transform={`translate(${WIDTH / 2} ${horizonY}) scale(${bgScale}) translate(${-WIDTH / 2 - (cam.x - X(6)) * 0.04} ${-GROUND})`}>
        <Stands baseY={GROUND} lit={1} />
        {[180, 720, 1220, 1760].map((x, i) => (
          <Floodlight key={i} x={x} baseY={GROUND - 20} height={470} on={1} />
        ))}
      </g>
      <g transform={worldT}>
        <GroundSide groundY={GROUND} vanishX={X(8)} />
        <CarPark x0={X(CAR_X0)} groundY={GROUND} ppm={PPM} />
        <HazardLights cx={X(CAR_M)} groundY={GROUND} ppm={PPM} on={hazardOn} />
        <GoalSide view={SIDE} goalX={GOAL_M} />
        <Keeper x={X(GOAL_M) - 8} groundY={GROUND} h={2.1 * PPM} pose={kPose} face={kFace} look={kLook} />
        {frame >= discAt ? <DiscMarker x={discX} groundY={GROUND + dropY} w={0.52 * PPM} squash={discSquash} /> : null}
        <Dust x={discX} y={GROUND} at={discLand} size={14} seed="disc" />
        {/* Swing ropes at 30% behind Tavi, so they never read as strings tied to the leg. */}
        {seatO > 0.001 ? (
          <g transform={screenInWorld}>
            <SwingSeat px={hipS.x} py={hipS.y} sx={seatS.x} sy={seatS.y} opacity={0.375 * seatO} part="ropes" />
          </g>
        ) : null}
        {/* Kicking knee glow sits behind the limbs, so the shin and boot stay visible. */}
        {kneeGlow > 0.001 ? <Glow cx={J.nearKnee.x} cy={J.nearKnee.y} r={(80 / Z) * (0.7 + 0.3 * kneeGlow)} color={PITCH.light} intensity={2 * kneeGlow} /> : null}
        <Player x={hipX} groundY={GROUND} h={H_T} pose={pose} face={face} />
        {realBallShown && frame < kick ? (
          <g opacity={frame < ghostKick ? 1 : popSoft(frame, ballBack)}>
            <Ball cx={ballC.x} cy={ballC.y} r={BALL_R} view={SIDE} lineNormal={LINE_N} squash={inContact ? 0.9 : 1} />
          </g>
        ) : null}
        <NearSide x={hipX} groundY={GROUND} h={H_T} pose={pose} />
        {frame >= kick ? <Flight path={DRIVE} view={SIDE} at={kick} r={BALL_R} trailColor={PITCH.lightSoft} trailOpacity={0.5} lineNormal={LINE_N} /> : null}
        <Dust x={X(CAR_M) - 1.0 * PPM} y={GROUND - 1.55 * PPM} at={roofF} size={26} seed="roof" color={PITCH.lightSoft} />
        <Dust x={J.nearToe.x} y={GROUND} at={landF} size={10} seed="land" />
      </g>

      {/* The swing arc and its markers (screen space, so strokes and text keep their size). */}
      {radiusO > 0.001 ? <line x1={hipS.x} y1={hipS.y} x2={lowS.x} y2={lowS.y} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="6 12" strokeLinecap="round" opacity={0.45 * radiusO} /> : null}
      {arcO > 0.001 ? (
        <g opacity={arcO}>
          <path d={pathD(arcPts)} fill="none" stroke={PITCH.chalk} strokeWidth={7} strokeLinecap="round" opacity={0.85} strokeDasharray="2 15" />
          <circle cx={hipS.x} cy={hipS.y} r={10} fill={PITCH.chalk} />
        </g>
      ) : null}
      {seatO > 0.001 ? <SwingSeat px={hipS.x} py={hipS.y} sx={seatS.x} sy={seatS.y} opacity={seatO} part="seat" /> : null}
      <DirArrow x={tanS.x} y={tanS.y} angle={tanAng} len={Math.max(1, tanLen)} color={PITCH.light} width={9} opacity={tanO * (tanLen > 12 ? 1 : tanLen / 12)} />
      {/* Flat only at the bottom. */}
      <PopDot x={lowS.x} y={lowS.y} r={11} at={tFlat + 4} until={targetAt} ring={PITCH.light} />
      <DirArrow x={lowS.x + 20} y={lowS.y} angle={0} len={150} color={CAST.fix} width={10} t={progress(frame, tFlat + 10, 14, EASE.enter)} opacity={1 - progress(frame, tMeet, 8, EASE.exit)} />
      <Label x={lowS.x + 95} y={groundS + 64} text="FLAT" at={tBottom + 6} until={tMeet} size={40} bg={CAST.fix} color={PITCH.sky} />
      {/* Meet the ball there: the low point becomes a small target on the ball. */}
      <Target x={ballS.x} y={ballS.y} r={BALL_R * Z * 1.9} s={meetT} />
      {/* Standing foot: toes point at the goal. */}
      <DirArrow x={S(J.farToe).x + 8} y={groundS + 28} angle={0} len={96} color={PITCH.light} width={9} t={progress(frame, tToes, 12, EASE.enter)} opacity={1 - progress(frame, tBehind, 8, EASE.exit)} />
      <Pulse x={ballS.x} y={ballS.y} r0={BALL_R * Z * 1.2} r1={BALL_R * Z * 3.2} at={lowAt} dur={20} />
      <Pulse x={ballS.x} y={ballS.y} r0={BALL_R * Z * 1.2} r1={BALL_R * Z * 3.2} at={lowAt + 10} dur={20} />
      <Label x={lowS.x} y={groundS + 74} text="LOW POINT" at={lowAt} until={tBehind + 2} size={40} />
      <TopInset cx={1545} cy={330} r={210} at={insetAt} until={tBehind - 6} handAt={handAt} toesAt={tToes} />
      <Label x={1545} y={600} text="one hand" at={handAt + 8} until={tBehind - 6} size={40} bg={PITCH.light} color={PITCH.sky} />
      {/* Standing foot behind: the low point moves back and the foot is already rising at contact. */}
      <PopDot x={lowS.x} y={lowS.y} r={13} at={tBehind + 12} until={ghostKick + 6} color={CAST.mistake} ring={CAST.mistake} />
      {gapO > 0.001 ? (
        <line x1={lowS.x + 16} y1={lowS.y} x2={lowS.x + 16 + (ballS.x - BALL_R * Z - lowS.x - 16) * gapT} y2={lowS.y} stroke={CAST.mistake} strokeWidth={6} strokeDasharray="10 10" strokeLinecap="round" opacity={gapO} />
      ) : null}
      <DirArrow x={contactS.x} y={contactS.y} angle={risingAng} len={190} color={CAST.mistake} width={12} t={progress(frame, contactF, 10, EASE.enter)} opacity={1 - progress(frame, ghostKick + 8, 8, EASE.exit)} />
      <Label x={contactS.x + 150} y={groundS + 74} text="RISING" at={contactF + 4} until={ghostKick + 8} size={40} bg={CAST.mistake} color={PITCH.chalk} />
      {/* The ghost: MISS clears the bar and lands on a car roof. */}
      {ghostOn ? (
        <g>
          <path d={pathD(gPts.map(S))} fill="none" stroke={PITCH.chalk} strokeWidth={6} strokeDasharray="1 16" strokeLinecap="round" opacity={0.7 * pathO} />
          <GhostBall cx={S(project(gState.pos, SIDE)).x} cy={S(project(gState.pos, SIDE)).y} r={Math.max(22, BALL_R * Z * 1.3)} opacity={ghostO} />
        </g>
      ) : null}
      {/* Kicking knee glows, then knee and chest go over the ball. */}
      {kneeGlow > 0.001 ? <circle cx={kneeS.x} cy={kneeS.y} r={46 + 12 * kneeGlow} fill="none" stroke={PITCH.light} strokeWidth={5} opacity={0.85 * kneeGlow} /> : null}
      <Pulse x={kneeS.x} y={kneeS.y} r0={14} r1={70} at={kneeGlowAt + 2} dur={18} color={PITCH.light} />
      {vertO > 0.001 ? (
        <line x1={ballS.x} y1={groundS} x2={ballS.x} y2={groundS + (vertTop - groundS) * vertDraw} stroke={PITCH.chalk} strokeWidth={5} strokeDasharray="14 12" strokeLinecap="round" opacity={0.85 * vertO} />
      ) : null}
      <PopDot x={kneeS.x} y={kneeS.y} r={12} at={tOver + 6} until={tEyes} color={PITCH.light} />
      <PopDot x={S(J.shoulder).x} y={S(J.shoulder).y} r={12} at={tOver + 10} until={tEyes} color={PITCH.light} />
      {/* Eyes on it: a dotted sight line from the eye to the ball, held through contact. */}
      {sightT > 0.001 && sightO > 0.001 ? (
        <g opacity={sightO}>
          <line x1={eyeS.x} y1={eyeS.y} x2={lerp(eyeS.x, ballS.x, sightT)} y2={lerp(eyeS.y, ballS.y, sightT)} stroke={PITCH.light} strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" />
          <circle cx={eyeS.x} cy={eyeS.y} r={16} fill="none" stroke={PITCH.light} strokeWidth={4} opacity={0.9} />
        </g>
      ) : null}
      {/* Strike through the middle: a ring target on the ball. */}
      <Target x={ballS.x} y={ballS.y} r={BALL_R * Z * 2.1} s={strikeT} />
      <Pulse x={ballS.x} y={ballS.y} r0={10} r1={BALL_R * Z * 3} at={kick} dur={14} color={PITCH.chalk} />
      {effort}
      {sfx}
    </Stage>
  );
};

/** Tracking close-up of DRIVE_R at 1/10 speed: the Line turns slowly backward. */
const CloseUp: React.FC<{ kick: number; start: number; tSlow: number; tBack: number; end: number; children?: React.ReactNode }> = ({ kick, start, tSlow, tBack, end, children }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, (frame - kick) * 0.1);
  const s = sampleAt(DRIVE, f);
  const angle = spinAngleAt(DRIVE, f);
  const axis = s.spin;
  const r = 180 + 16 * progress(frame, start, end - start, EASE.camera);
  const bx = 700;
  const by = 650;
  const horizon = 640;
  const flown = s.pos.x;
  const lift = s.pos.z - 0.11;
  const shadowY = by + r + lift * 420;
  const shadowK = Math.min(1, lift / 0.8);
  const velAng = (Math.atan2(s.vel.z, s.vel.x) * 180) / Math.PI;
  const stripeOffset = -(((flown * 300) % 738) + 738) % 738;
  const flash = 1 - progress(frame, start, 6, EASE.exit);
  // WordCard geometry (the kit card scales from its top-right corner) for the small icon on it.
  const term = "backspin";
  const meaning = "the top of the ball turns back toward you as it flies";
  const cardAt = tBack - 6;
  const cardUntil = end + 30;
  const cw = Math.max(term.length * 36, meaning.length * 19, 260) + 90;
  const cs = pop(frame, cardAt) * (1 - progress(frame, cardUntil, 8, EASE.exit));
  const cardX = WIDTH - 56;
  const cardY = 64;
  const iconX = cw - 96;
  const iconY = 92;
  return (
    <Stage bg={PITCH.sky}>
      <Sky id="sky-s06c" />
      <Stars count={70} maxY={360} seed="s06c" />
      <g transform={`translate(${-flown * 14} 0)`}>
        {[260, 900, 1540, 2180].map((x, i) => (
          <Floodlight key={i} x={x} baseY={horizon - 20} height={380} on={1} />
        ))}
        <Stands baseY={horizon} lit={1} />
      </g>
      <GroundSide groundY={horizon} vanishX={960} offset={stripeOffset} />
      <SpeedStreaks count={12} speed={24} seed="s06c" y0={200} y1={1010} opacity={0.22} />
      {/* Shadow falls away as the ball climbs. */}
      <ellipse cx={bx - 20} cy={shadowY} rx={r * 0.85 * (1 - 0.4 * shadowK)} ry={24 * (1 - 0.4 * shadowK)} fill="#0B3F31" opacity={0.55 * (1 - shadowK)} />
      <defs>
        <linearGradient id="s06-trail" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={PITCH.lightSoft} stopOpacity={0.35} />
          <stop offset="1" stopColor={PITCH.lightSoft} stopOpacity={0} />
        </linearGradient>
      </defs>
      <g transform={`translate(${bx} ${by}) rotate(${-velAng})`}>
        <path d={`M0,${-r * 0.8} L${-760},${-8} L${-760},8 L0,${r * 0.8} Z`} fill="url(#s06-trail)" />
      </g>
      <Ball cx={bx} cy={by} r={r} view={SIDE} axis={axis} angle={angle} lineNormal={LINE_N} />
      {/* Backward over the top: from the front (right) to the back (left). */}
      <CurlArrow cx={bx} cy={by} r={r + 58} a0={-30} a1={-150} color={PITCH.light} width={14} t={progress(frame, tSlow - 4, 18, EASE.standard)} />
      <Label x={bx + r + 250} y={by - 30} text="slow spin" at={tSlow + 2} size={48} />
      <SlowMoTag at={start} until={end + 30} />
      <WordCard term={term} meaning={meaning} at={cardAt} until={cardUntil} x={cardX} y={cardY} />
      {cs > 0.001 ? (
        <g transform={`translate(${cardX} ${cardY}) scale(${cs}) translate(${-cw} 0)`}>
          <circle cx={iconX} cy={iconY} r={24} fill={CAST.ball} />
          <line x1={iconX} y1={iconY - 22} x2={iconX} y2={iconY + 22} stroke={CAST.ballLine} strokeWidth={5} strokeLinecap="round" transform={`rotate(${-((frame - cardAt) * 2.4)} ${iconX} ${iconY})`} />
          <CurlArrow cx={iconX} cy={iconY} r={40} a0={-25} a1={-160} color={PITCH.stands} width={7} t={progress(frame, cardAt + 4, 14, EASE.standard)} />
          <DirArrow x={iconX + 34} y={iconY + 38} angle={0} len={42} color={PITCH.accent} width={5} t={progress(frame, cardAt + 8, 10, EASE.enter)} />
        </g>
      ) : null}
      {flash > 0.001 ? <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.chalk} opacity={0.22 * flash} /> : null}
      {children}
    </Stage>
  );
};
