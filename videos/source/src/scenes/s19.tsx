// s19 Chip mirror: "Bonus kick: the chip." Split screen, X-ray palette.
// Left: the chip (backspin, blue). Right: the volley (topspin, orange).
// Stages: S1 split intro (Chalk writes the title, spin dial), S2 x-ray jab (standing foot behind
// the ball, toes down, a loupe with the thumb gauge, the stopped foot), S3 the steep pop-up in
// slow motion, then the Air Crowd close-up (air flicked down, float vs weight), S4 side-view flights
// (CHIP over a rushing Chalk with the CHIP_GHOST, VOLLEY under the bar with the VOLLEY_GHOST),
// S5 the halves merge into one big ball with a spin dial (the first frame of s20).
// S4 is drawn in the Open Sky palette on both halves, and the float arrow rides on the chip.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../kit/Camera";
import { Ball } from "../kit/Ball";
import { AirFlow } from "../kit/AirFlow";
import { XRayGrid, XRayLeg } from "../kit/XRay";
import { Player, POSES, poseAt, solve, type Face, type Pose } from "../kit/Player";
import { Keeper, KPOSES, keeperPoseAt, type KeeperFace, type KeeperPose } from "../kit/Keeper";
import { GoalSide } from "../kit/Goal";
import { Arrow, Label, SlowMoTag, Text } from "../kit/Graphics";
import { Glow, GroundSide } from "../kit/World";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { simulate, sampleAt, spinAngleAt, type BallState, type Vec3 } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, idle, lerp, pop, popSoft, progress, visible } from "../lib/anim";
import { pathD, project, type View } from "../lib/project";
import { CAST, PITCH, SKY, XRAY } from "../theme";
import {
  AirDrift,
  AngleArc,
  ChalkWrite,
  FloatTag,
  GhostBall,
  Loupe,
  MERGE_R,
  MergeDial,
  NetBulge,
  PanelSky,
  Pill,
  PopArrow,
  RingMarker,
  SpinArrows,
  SpinDial,
  Thumb,
  XRayGround,
  XRayStandLeg,
} from "../kit/ext/s19-s20-parts";

// ---------- Flights (all from SHOTS) ----------
const CHIP = simulate({ ...SHOTS.CHIP, duration: 2.6 }, 30);
const CHIP_G = simulate({ ...SHOTS.CHIP_GHOST, duration: 2.6 }, 30);
const VOL = simulate({ ...SHOTS.VOLLEY, duration: 1.8 }, 30);
const VOL_G = simulate({ ...SHOTS.VOLLEY_GHOST, duration: 1.8 }, 30);
const DROP = simulate({ ...SHOTS.DROP }, 30);
const LINE_N: Vec3 = { x: 0.92, y: 0.25, z: 0.3 };
const SIDE_UNIT: View = { kind: "side", originX: 0, groundY: 0, ppm: 1 };

/** First sample where the ball reaches the back of the net (side view), or -1 if it never enters. */
const netIndex = (path: BallState[], goalX: number) => {
  for (let i = 1; i < path.length; i++) {
    const s = path[i];
    if (s.pos.z > 2.36) continue;
    const back = goalX + 1.8 - 0.9 * Math.min(1, s.pos.z / 2.32) - 0.12;
    if (s.pos.x >= back && path[i - 1].pos.x >= goalX - 0.2) return i;
  }
  return -1;
};

/** Ball state at f frames after the kick. After the net it drops straight down (the net takes its speed). */
const flightAt = (path: BallState[], f: number, iNet: number) => {
  const ff = Math.max(0, f);
  if (iNet < 0 || ff <= iNet) {
    const s = sampleAt(path, ff);
    return { pos: s.pos, angle: spinAngleAt(path, ff), axis: s.spin };
  }
  const n = path[iNet];
  const dt = (ff - iNet) / 30;
  const z = Math.max(0.11, n.pos.z - 0.5 * 9.81 * dt * dt);
  return {
    pos: { x: n.pos.x + 0.12 * (1 - Math.exp(-dt * 10)), y: n.pos.y, z },
    angle: spinAngleAt(path, iNet) + 1.5 * (1 - Math.exp(-dt * 3)),
    axis: n.spin,
  };
};

// ---------- Left panel close-up world (S1, S2): x-ray scale ----------
const GROUND_L = 860;
const BALL_R = 95;
const BALL_C = { x: 520, y: GROUND_L - BALL_R };
const PPM_X = BALL_R / 0.11; // pixels per metre in the close-up
const XH = 1400; // character height for the x-ray leg (ball r = 0.068 H)
// Contact point: a thumb's width (about 2 cm) above the grass, on the back of the ball.
const GAP = BALL_R * (2 / 11);
const CONTACT = { x: BALL_C.x - Math.sqrt(BALL_R * BALL_R - (BALL_R - GAP) ** 2), y: GROUND_L - GAP };

// Kicking leg. At contact the toes point down (foot about 35 deg from vertical) and the front of
// the laces meets the ball low. The thigh is forward and the knee bent, so the standing leg can
// reach the grass from the same hip.
const LEG_BACK_A: Pose = { ...POSES.chip, nearHip: 14, nearKnee: 74, nearAnkle: 135 };
const LEG_BACK: Pose = { ...POSES.chip, nearHip: 8, nearKnee: 72, nearAnkle: 140 };
const LEG_HIT: Pose = { ...POSES.chip, nearHip: 50, nearKnee: 80, nearAnkle: 115 };
const LEG_FOLLOW: Pose = { ...POSES.chip, nearHip: 75, nearKnee: 25, nearAnkle: 135 };
const J_HIT = solve(LEG_HIT, XH);
const FOOT_DIR = (() => {
  const dx = J_HIT.nToe.x - J_HIT.na.x;
  const dy = J_HIT.nToe.y - J_HIT.na.y;
  const l = Math.hypot(dx, dy);
  return { x: dx / l, y: dy / l };
})();
// Hip placed so the toe bone ends just behind the contact point (the tissue meets the ball).
const HIP = { x: CONTACT.x - FOOT_DIR.x * 40 - J_HIT.nToe.x, y: CONTACT.y - 18 - J_HIT.nToe.y };
const J_FOLLOW = solve(LEG_FOLLOW, XH);
// Standing foot: flat on the grass, its toe a little behind the ball.
const STAND_TOE_X = BALL_C.x - 150;
const STAND_ANKLE = { x: STAND_TOE_X - 0.13 * XH, y: GROUND_L - 0.03 * XH };

// ---------- Side views (S4), panel-local pixels ----------
const PPM_S = 52;
const GROUND_S = 860;
const VIEW_CHIP: View = { kind: "side", originX: 110, groundY: GROUND_S, ppm: PPM_S };
const VIEW_VOL: View = { kind: "side", originX: 80, groundY: GROUND_S, ppm: PPM_S };
const CHIP_GOAL = 14;
const VOL_GOAL = 16;
const CHIP_NET = netIndex(CHIP, CHIP_GOAL);
const CHIPG_NET = netIndex(CHIP_G, CHIP_GOAL);
const VOL_NET = netIndex(VOL, VOL_GOAL);
const VOLG_NET = netIndex(VOL_G, VOL_GOAL);
const TAVI_H = 1.62 * PPM_S;
const CHALK_H = 2.1 * PPM_S;
const BALL_S = 9; // flight-view ball radius (slightly larger than true size, so the Line reads)

const CHIP_BACK: Pose = { ...POSES.chip, torso: 2, nearHip: -24, nearKnee: 62, nearAnkle: 122 };
const VOL_WIND: Pose = { ...POSES.volley, torso: 12, nearHip: -14, nearKnee: 95, nearAnkle: 150 };
const VOL_HIT: Pose = { ...POSES.volley, nearHip: 80, nearKnee: 60 };
const RUSH: KeeperPose = { ...KPOSES.ready, lean: -12, left: 55, right: 55 };

const W2 = 960;

export const S19: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s19");

  // ---------- Beats (exact word cues) ----------
  const tBonus = cue("Bonus kick");
  const tChip = cue("the chip");
  const tSame = cue("Same air");
  const tOpp = cue("opposite spin");
  const tJab = cue("Jab your laces");
  const tUnder = cue("under the ball");
  const tThumb = cue("a thumb's width");
  const tGrass = cue("above the grass");
  const tThen = cue("Then stop your foot");
  const tStop = cue("stop your foot");
  const tPops = cue("It pops up steep");
  const tSteep = cue("steep");
  const tBack = cue("backspin");
  const tFlick = cue("flicks air down");
  const tHangs = cue("and hangs over");
  const tRush = cue("a rushing keeper");
  const END = cue.frames;

  const s2In = tJab - 14; // the x-ray leg arrives
  const plantAt = tJab; // the standing foot lands
  const contact = tUnder - 2; // the laces meet the ball
  const release = tPops; // the ball leaves the foot (slow motion)
  const SLOW = 0.025; // slow motion after the jab (sim frames per scene frame)
  const hand = tBack - 4; // the close-up ball becomes the S3 ball
  const s3In = hand - 2;
  const s4In = tHangs - 9;
  const kick = tHangs - 2; // chip and volley kicks: the chip passes over Chalk on "a rushing keeper"
  const merge = END - 14; // the halves slide together after the chip lands

  // ---------- Left close-up camera (S1, S2) ----------
  const keysL: CamKey[] = [
    { f: 0, x: BALL_C.x, y: 686, zoom: 1.5 },
    { f: s2In - 6, x: BALL_C.x, y: 686, zoom: 1.56 },
    { f: s2In + 24, x: 390, y: 505, zoom: 0.88 },
    { f: tThen - 4, x: 400, y: 500, zoom: 0.9 },
    { f: tThen + 24, x: 560, y: 480, zoom: 0.9 },
    { f: hand, x: 575, y: 470, zoom: 0.92 },
  ];
  const camL = cameraAt(frame, keysL);
  const camLT = `translate(480 540) scale(${camL.zoom}) translate(${-camL.x} ${-camL.y})`;
  const toScreenL = (p: { x: number; y: number }) => ({ x: 480 + (p.x - camL.x) * camL.zoom, y: 540 + (p.y - camL.y) * camL.zoom });
  const chipSlowF = (f: number) => Math.max(0, (f - release) * SLOW);
  const ballLW = (f: number) => {
    const s = sampleAt(CHIP, chipSlowF(f));
    return { x: BALL_C.x + s.pos.x * PPM_X, y: BALL_C.y - (s.pos.z - 0.11) * PPM_X };
  };

  // Stage opacities.
  const s1o = 1 - progress(frame, s2In - 2, 10, EASE.exit);
  const s2World = 1 - progress(frame, s3In + 2, 10, EASE.exit);
  const s3o = progress(frame, s3In, 10, EASE.enter) * (1 - progress(frame, s4In - 5, 7, EASE.exit));
  const s4o = progress(frame, s4In + 1, 10, EASE.enter);
  // S4 cameras (panel-local): start close on Tavi, then track the ball in one smooth move.
  // The chip half frames the arc over Chalk about 1.8x tighter than a full-arc framing.
  type Cam3 = { x: number; y: number; zoom: number };
  const camS4 = (tx: number, endX: number, trackDur: number, zPeak: number, zEnd: number): Cam3 => {
    if (frame < kick) {
      return cameraAt(frame, [
        { f: s4In, x: tx + 110, y: GROUND_S - 110, zoom: 1.42 },
        { f: kick, x: tx + 130, y: GROUND_S - 120, zoom: 1.34 },
      ]);
    }
    const t = progress(frame, kick, trackDur, EASE.camera);
    const zIn = progress(frame, kick, 22, EASE.camera);
    const zOut = progress(frame, kick + 22, Math.max(1, trackDur - 22), EASE.camera);
    return {
      x: lerp(tx + 130, endX, t),
      y: lerp(GROUND_S - 120, 700, t),
      zoom: 1.34 + (zPeak - 1.34) * zIn + (zEnd - zPeak) * zOut,
    };
  };
  const camT = (c: Cam3) => `translate(480 540) scale(${c.zoom}) translate(${-c.x} ${-c.y})`;
  const horizon = (c: Cam3) => 540 + (GROUND_S - c.y) * c.zoom;

  // Merge (S5): both halves slide into the centre.
  const m = progress(frame, merge, 10, EASE.exit);
  const leftMerge = `translate(${420 * m} 0)`;
  const rightMerge = `translate(${-420 * m} 0)`;
  const panelsO = 1 - progress(frame, merge - 2, 8, EASE.soft);

  // The frame splits at the start: one chip ball in the centre, then the divider draws down,
  // the chip half slides left and the volley half slides in from the right.
  const split = progress(frame, 3, 15, EASE.standard);
  const divDraw = progress(frame, 2, 11, EASE.enter);

  // ---------- LEFT: S1 + S2 world ----------
  const legO = progress(frame, s2In, 10, EASE.enter);
  const legPose = poseAt(frame, [
    [s2In, LEG_BACK_A],
    [contact - 7, LEG_BACK],
    [contact, LEG_HIT],
  ]);
  const standDrop = 36 * (1 - progress(frame, plantAt - 6, 8, EASE.standard));
  const standO = progress(frame, s2In, 10, EASE.enter);
  const ghostO = visible(frame, tThen + 16, release + 2, 12, 9);
  const squash = frame >= contact && frame < contact + 6 ? 1 - 0.05 * Math.sin(((frame - contact) / 6) * Math.PI) : 1;
  const bl = ballLW(frame);
  const chipAngle = (f: number) => {
    if (f < release) return idle(f, 1, 3, 0.04);
    if (f < hand) return spinAngleAt(CHIP, chipSlowF(f));
    return spinAngleAt(CHIP, chipSlowF(hand)) + (f - hand) * 0.06;
  };
  const grassHi = visible(frame, tGrass, tThen - 4, 8, 10);
  const loupeS = pop(frame, tThumb - 5, { stiffness: 170, damping: 17 }) * (1 - progress(frame, tThen, 9, EASE.exit));
  const thumbS = popSoft(frame, tThumb + 4);

  /** The close-up world in world pixels (drawn by the main camera and again inside the loupe). */
  const closeWorld = (inLoupe: boolean) => (
    <g>
      <XRayGround groundY={GROUND_L} x0={-800} x1={2200} seed="s19l" tufts={30} />
      {grassHi > 0 ? <rect x={-800} y={GROUND_L - 5} width={3000} height={10} rx={5} fill={XRAY.lime} opacity={grassHi * (0.6 + 0.4 * Math.sin(frame / 3))} /> : null}
      {standO > 0 ? <XRayStandLeg hip={HIP} ankle={{ x: STAND_ANKLE.x, y: STAND_ANKLE.y - standDrop }} h={XH} opacity={standO * (inLoupe ? 0.6 : 1)} /> : null}
      {ghostO > 0 && !inLoupe ? (
        <g>
          <g opacity={0.32 * ghostO}>
            <XRayLeg x={HIP.x} y={HIP.y} h={XH} pose={LEG_FOLLOW} />
          </g>
          {/* Cross on the big follow-through it did not do. */}
          <g opacity={0.9 * ghostO} transform={`translate(${HIP.x + (J_FOLLOW.na.x + J_FOLLOW.nToe.x) / 2} ${HIP.y + (J_FOLLOW.na.y + J_FOLLOW.nToe.y) / 2})`} stroke={CAST.mistake} strokeWidth={22} strokeLinecap="round">
            <line x1={-50} y1={-50} x2={50} y2={50} />
            <line x1={50} y1={-50} x2={-50} y2={50} />
          </g>
        </g>
      ) : null}
      {legO > 0 ? (
        <g opacity={legO}>
          <XRayLeg x={HIP.x} y={HIP.y} h={XH} pose={legPose} />
        </g>
      ) : null}
      {frame < hand ? (
        <g>
          <Glow cx={bl.x} cy={bl.y} r={BALL_R * 2.2} color={XRAY.air} intensity={0.35} />
          <Ball cx={bl.x} cy={bl.y} r={BALL_R} view={SIDE_UNIT} axis={{ x: 0, y: -1, z: 0 }} angle={chipAngle(frame)} lineNormal={LINE_N} squash={squash} />
        </g>
      ) : null}
      {inLoupe && thumbS > 0.001 ? (
        <g>
          <g transform={`translate(${CONTACT.x + 4} ${GROUND_L}) scale(${thumbS}) translate(${-CONTACT.x - 4} ${-GROUND_L})`}>
            <Thumb x={CONTACT.x + 4} y={CONTACT.y} w={GAP * 3.1} h={GAP} />
          </g>
          {/* Measure bracket: grass to the contact point. */}
          <g opacity={thumbS} stroke={XRAY.lime} strokeWidth={2.2} strokeLinecap="round">
            <line x1={CONTACT.x + 14} y1={CONTACT.y} x2={CONTACT.x + 14} y2={GROUND_L} />
            <line x1={CONTACT.x + 9} y1={CONTACT.y} x2={CONTACT.x + 19} y2={CONTACT.y} />
            <line x1={CONTACT.x + 9} y1={GROUND_L} x2={CONTACT.x + 19} y2={GROUND_L} />
          </g>
        </g>
      ) : null}
    </g>
  );

  // Contact flash.
  const flash = frame >= contact && frame < contact + 10 ? 1 - (frame - contact) / 10 : 0;
  const cS = toScreenL(CONTACT);

  // S1 overlays (left): spin arrows and the dial.
  const flipT = progress(frame, tOpp, 12, EASE.standard);
  const leftBallS = toScreenL(BALL_C);
  const dialPointer = -60 + 120 * progress(frame, tOpp - 2, 12, EASE.back);
  const s1In = popSoft(frame, 10);

  // Loupe placement (screen, left half) and the lead line to the contact point.
  const LOUPE = { x: 705, y: 335, r: 185 };
  const standToeS = toScreenL({ x: STAND_TOE_X, y: GROUND_L - 10 });
  const stopS = toScreenL({ x: HIP.x + J_HIT.nToe.x, y: GROUND_L });

  // Take-off: the ball's start point on screen (the angle arc sits there).
  const launchS = toScreenL(BALL_C);

  // ---------- LEFT: S3 Air Crowd close-up ----------
  const handT = progress(frame, hand, 14, EASE.standard);
  const ballAtHand = toScreenL(ballLW(hand));
  const s3Ball = {
    x: lerp(ballAtHand.x, 480, handT),
    y: lerp(ballAtHand.y, 480, handT) + idle(frame, 2, 2.6, 5) * handT,
  };
  const s3R = lerp(BALL_R * camL.zoom, 119, handT);
  const spinPhase = (frame - hand) * 2.2;
  const s3BallO = frame >= hand ? 1 - progress(frame, s4In - 5, 7, EASE.exit) : 0;

  // ---------- LEFT: S4 chip flight ----------
  const fChip = frame - kick;
  const chipNow = flightAt(CHIP, fChip, CHIP_NET);
  const chipG = flightAt(CHIP_G, fChip, CHIPG_NET);
  const chipP = project(chipNow.pos, VIEW_CHIP);
  const chipGP = project(chipG.pos, VIEW_CHIP);
  const trail = (path: BallState[], f: number, iNet: number, view: View) => {
    if (f <= 0) return "";
    const upto = Math.min(iNet < 0 ? path.length - 1 : iNet, Math.floor(f));
    const pts = path.slice(0, upto + 1).map((q) => project(q.pos, view));
    const cur = project(sampleAt(path, Math.min(f, iNet < 0 ? path.length - 1 : iNet)).pos, view);
    pts.push(cur);
    return pathD(pts);
  };
  const chipNetF = kick + (CHIP_NET > 0 ? CHIP_NET : 60);
  const taviXL = -0.75 + 0.46 * progress(frame, s4In - 4, kick - 3 - (s4In - 4), EASE.soft);
  const taviPoseL = poseAt(frame, [
    [s4In - 4, "ready"],
    [kick - 7, CHIP_BACK],
    [kick, "chip"],
    [kick + 30, "chip"],
    [kick + 44, "stand"],
    [chipNetF, "stand"],
    [chipNetF + 8, "celebrate"],
  ]);
  const taviFaceL: Face = frame >= chipNetF ? "happy" : frame >= kick - 10 && frame < kick + 30 ? "focus" : "neutral";
  const rushT = progress(frame, s4In - 14, kick + 22 - (s4In - 14), (t) => 1 - (1 - t) * (1 - t));
  const chalkXL = 9.8 - 3.7 * rushT;
  const rushing = frame < kick + 14;
  const chalkPoseL0 = keeperPoseAt(frame, [
    [s4In, RUSH],
    [kick + 12, RUSH],
    [kick + 19, "punchUp"],
    [kick + 32, "wide"],
  ]);
  const chalkPoseL: KeeperPose = rushing ? { ...chalkPoseL0, lift: chalkPoseL0.lift + Math.abs(Math.sin(frame / 3.2)) * 0.035 } : chalkPoseL0;
  const chalkFaceL: KeeperFace = frame >= kick + 16 ? "surprised" : "flat";
  const turnL = Math.min(kick + 20, tRush + 4);
  const chalkLookL = frame >= turnL ? Math.min(1, (frame - turnL) / 8) : -0.5;
  const camL4 = camS4(VIEW_CHIP.originX + taviXL * PPM_S, 690, 62, 1.86, 1.76);
  // The float arrow rides on the chip from the kick until after the top of the arc.
  const floatS4 = fChip > 2 ? popSoft(frame, kick + 3) * (1 - progress(frame, kick + 42, 8, EASE.exit)) : 0;

  // ---------- RIGHT: S1-S3 volley close-up ----------
  const rDim = 1 - 0.15 * progress(frame, s2In, 12, EASE.standard) + 0.15 * progress(frame, s3In, 12, EASE.standard);
  const r3 = progress(frame, s3In, 14, EASE.standard);
  const rBall = { x: 480, y: 500 - 20 * r3 + idle(frame, 4, 2.4, 7), r: 142 - 23 * r3 };
  const volAngle = frame * 0.075;
  const speedLines = [];
  for (let i = 0; i < 5; i++) {
    const off = (frame * 16 + i * 53) % 280;
    const y = rBall.y + (i - 2) * 48;
    const x2 = rBall.x - rBall.r - 30 - off;
    speedLines.push(<line key={i} x1={x2 - 110} y1={y} x2={x2} y2={y} stroke={XRAY.bone} strokeWidth={9} strokeLinecap="round" opacity={0.35 * (1 - off / 280) * (1 - r3)} />);
  }

  // ---------- RIGHT: S4 volley flight ----------
  const volNow = flightAt(VOL, fChip, VOL_NET);
  const volG = flightAt(VOL_G, fChip, VOLG_NET);
  const volP = project(volNow.pos, VIEW_VOL);
  const volGP = project(volG.pos, VIEW_VOL);
  const dropStart = kick - (DROP.length - 1);
  const dropP = project(sampleAt(DROP, Math.max(0, frame - dropStart)).pos, VIEW_VOL);
  const volNetF = kick + (VOL_NET > 0 ? VOL_NET : 34);
  const taviPoseR = poseAt(frame, [
    [s4In, VOL_WIND],
    [kick - 6, VOL_WIND],
    [kick, VOL_HIT],
    [kick + 10, "follow"],
    [kick + 26, "stand"],
    [volNetF + 2, "stand"],
    [volNetF + 12, "celebrate"],
  ]);
  const taviFaceR: Face = frame >= volNetF + 2 ? "happy" : frame >= kick - 10 && frame < kick + 14 ? "focus" : "neutral";
  const chalkPoseR = keeperPoseAt(frame, [
    [s4In, "ready"],
    [kick + 18, "ready"],
    [kick + 26, "wide"],
    [kick + 46, "shrug"],
  ]);
  const chalkFaceR: KeeperFace = frame >= kick + 24 ? "surprised" : "flat";
  const camR4 = camS4(VIEW_VOL.originX - 0.685 * PPM_S, 660, 28, 1.22, 1.2);

  // ---------- Merge ball ----------
  const mb = progress(frame, merge + 2, 10, EASE.back); // full size by END - 2, held into s20
  const ringT = progress(frame, merge + 4, 9, EASE.enter);
  const dialPhase = -90 + (frame - (END - 20)) * 3; // s20 continues from -30 at its frame 0

  // ---------- Render helpers ----------
  const ghostTrail = (d: string, z: number) =>
    d ? <path d={d} fill="none" stroke={SKY.deep} strokeWidth={6 / z} strokeDasharray={`${0.1 / z} ${13 / z}`} strokeLinecap="round" opacity={0.8} /> : null;
  const realTrail = (d: string, z: number) =>
    d ? (
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} stroke={SKY.accent} strokeWidth={7 / z} />
        <path d={d} stroke={SKY.sunSoft} strokeWidth={2.5 / z} />
      </g>
    ) : null;

  const leftPanel = (
    <g transform={`translate(${480 * (1 - split)} 0)`}>
      {/* S1 + S2 close-up world. */}
      <g opacity={s2World}>
        <g transform={camLT}>{closeWorld(false)}</g>
      </g>
      {flash > 0 ? <circle cx={cS.x} cy={cS.y} r={30 + 80 * (1 - flash)} fill="none" stroke={XRAY.bone} strokeWidth={9 * flash} opacity={flash} /> : null}
      {/* The standing foot lands a little behind the ball. */}
      <g opacity={s2World}>
        <RingMarker x={standToeS.x - 70 * camL.zoom} y={standToeS.y} r={22} at={plantAt + 2} until={contact - 2} color={XRAY.lime} />
      </g>
      {/* Take-off angle: the ball pops up steep. */}
      <g opacity={s2World}>
        <AngleArc x={launchS.x} y={launchS.y} deg={45} r={150} at={tSteep} until={hand + 4} color={XRAY.lime} label="steep" labelSize={42} width={7} ray={1.9} />
      </g>
      {/* Loupe on the contact: a thumb's width above the grass. */}
      {loupeS > 0.001 ? (
        <g>
          <line x1={cS.x} y1={cS.y} x2={LOUPE.x - LOUPE.r * 0.55 * loupeS} y2={LOUPE.y + LOUPE.r * 0.84 * loupeS} stroke={XRAY.bone} strokeWidth={5} strokeLinecap="round" opacity={0.7 * Math.min(1, loupeS)} />
          <circle cx={cS.x} cy={cS.y} r={12} fill="none" stroke={XRAY.bone} strokeWidth={5} opacity={Math.min(1, loupeS)} />
          <Loupe id="s19-loupe" cx={LOUPE.x} cy={LOUPE.y} r={LOUPE.r} s={loupeS} wx={CONTACT.x + 14} wy={CONTACT.y - 26} zoom={2.6}>
            {closeWorld(true)}
          </Loupe>
        </g>
      ) : null}
      {/* S1 overlays: spin arrows flip, and the dial turns. */}
      {s1o > 0.001 ? (
        <g opacity={s1o}>
          <SpinArrows cx={leftBallS.x} cy={leftBallS.y} r={BALL_R * camL.zoom + 34} dir={1} flipT={flipT} color={XRAY.air} width={14} phase={frame < tOpp ? frame * 1.2 : tOpp * 1.2 + (frame - tOpp) * 2.4 * (flipT > 0.5 ? 1 : -1)} opacity={s1In} />
          <SpinDial cx={480} cy={948} r={46} pointer={dialPointer} scale={s1In} />
        </g>
      ) : null}
      {/* S3: the ball in flight with its Air Crowd. */}
      {s3o > 0.001 ? (
        <g opacity={s3o} transform={`translate(480 480) scale(${1 - 0.12 * progress(frame, s4In, 8, EASE.exit)}) translate(-480 -480)`}>
          <AirFlow cx={s3Ball.x} cy={s3Ball.y} R={s3R} spin={0.55} rotate={180} count={130} speed={6.5} at={s3In} seed="s19chip" />
          <SpinArrows cx={s3Ball.x} cy={s3Ball.y} r={s3R + 31} dir={-1} color={XRAY.air} width={12} phase={spinPhase} opacity={progress(frame, hand + 6, 10) * (1 - progress(frame, tFlick - 4, 8, EASE.exit))} />
        </g>
      ) : null}
      {s3BallO > 0.001 ? (
        <g opacity={s3BallO} transform={`translate(480 480) scale(${1 - 0.12 * progress(frame, s4In, 8, EASE.exit)}) translate(-480 -480)`}>
          <Glow cx={s3Ball.x} cy={s3Ball.y} r={s3R * 2.1} color={XRAY.air} intensity={0.3} />
          <Ball cx={s3Ball.x} cy={s3Ball.y} r={s3R} view={SIDE_UNIT} axis={{ x: 0, y: -1, z: 0 }} angle={chipAngle(frame)} lineNormal={LINE_N} />
          <Arrow x1={s3Ball.x - 150} y1={s3Ball.y + 50} x2={s3Ball.x - 250} y2={s3Ball.y + 250} curve={-0.28} at={tFlick} until={s4In - 2} color={XRAY.air} width={11} dur={12} />
          {/* Float and weight pop together on "flicks" (float about a quarter of weight). */}
          <PopArrow x={s3Ball.x} y={s3Ball.y - 125} dx={0} dy={-75} at={tFlick} until={s4In - 2} color={XRAY.lime} width={13} label="float" labelSize={48} lx={30} ly={-8} />
          <PopArrow x={s3Ball.x} y={s3Ball.y + 125} dx={0} dy={300} at={tFlick + 2} until={s4In - 2} color={XRAY.bone} width={13} label="weight" labelSize={44} lx={34} ly={70} />
        </g>
      ) : null}
      {/* S4: Open Sky side view, the chip over a rushing Chalk (camera tracks the ball). */}
      {s4o > 0.001 ? (
        <g opacity={s4o}>
          <PanelSky id="s19-sky-l" horizonY={horizon(camL4)} camX={camL4.x} seed={0} />
          <g transform={camT(camL4)}>
            <GroundSide groundY={GROUND_S} vanishX={480} />
            <GoalSide view={VIEW_CHIP} goalX={CHIP_GOAL} netOpacity={0.5} />
            {ghostTrail(trail(CHIP_G, fChip, CHIPG_NET, VIEW_CHIP), camL4.zoom)}
            {fChip > 0 ? realTrail(trail(CHIP, fChip, CHIP_NET, VIEW_CHIP), camL4.zoom) : null}
            <Keeper x={VIEW_CHIP.originX + chalkXL * PPM_S} groundY={GROUND_S} h={CHALK_H} pose={chalkPoseL} face={chalkFaceL} look={chalkLookL} />
            <Player x={VIEW_CHIP.originX + taviXL * PPM_S} groundY={GROUND_S} h={TAVI_H} pose={taviPoseL} face={taviFaceL} />
            {fChip > 0 ? <GhostBall cx={chipGP.x} cy={chipGP.y} r={BALL_S} color={SKY.deep} /> : null}
            {fChip > 0 ? (
              <Ball cx={chipP.x} cy={chipP.y} r={BALL_S} view={VIEW_CHIP} axis={chipNow.axis} angle={chipNow.angle} lineNormal={LINE_N} />
            ) : (
              <Ball cx={project({ x: 0, y: 0, z: 0.11 }, VIEW_CHIP).x} cy={GROUND_S - BALL_S} r={BALL_S} view={VIEW_CHIP} lineNormal={LINE_N} />
            )}
            {floatS4 > 0.001 ? (
              <g transform={`translate(${chipP.x} ${chipP.y}) scale(${1 / camL4.zoom})`}>
                <FloatTag s={floatS4} r={BALL_S * camL4.zoom} />
              </g>
            ) : null}
            <NetBulge x={project({ x: CHIP_GOAL + 1.25, y: 0, z: 1.6 }, VIEW_CHIP).x} y={project({ x: 0, y: 0, z: 1.6 }, VIEW_CHIP).y} at={chipNetF} size={16} />
            <Pill x={project({ x: 7.2, y: 0, z: 3.5 }, VIEW_CHIP).x} y={project({ x: 0, y: 0, z: 3.5 }, VIEW_CHIP).y} text="no spin" s={popSoft(frame, kick + 34) / camL4.zoom} size={36} bg={SKY.deep} color={SKY.cloud} />
          </g>
        </g>
      ) : null}
    </g>
  );

  const rightPanel = (
    <g transform={`translate(${W2 * (1 - split)} 0)`} opacity={Math.min(1, split * 6)}>
      {/* S1-S3: the volley ball, topspin, orange arrows. */}
      {1 - s4o > 0.001 ? (
        <g opacity={rDim * (1 - progress(frame, s4In - 5, 7, EASE.exit))}>
          <XRayGround groundY={800} x0={-40} x1={1000} seed="s19r" tufts={14} />
          <ellipse cx={rBall.x} cy={806} rx={120 * (1 - r3)} ry={14} fill="#041419" opacity={0.6 * (1 - r3)} />
          {speedLines}
          <Glow cx={rBall.x} cy={rBall.y} r={rBall.r * 2.2} color={XRAY.ball} intensity={0.3} />
          {r3 > 0 ? <AirFlow cx={rBall.x} cy={rBall.y} R={rBall.r} spin={-0.55} rotate={180} count={120} speed={6.5} at={s3In} seed="s19vol" opacity={r3} /> : null}
          <Ball cx={rBall.x} cy={rBall.y} r={rBall.r} view={SIDE_UNIT} axis={{ x: 0, y: 1, z: 0 }} angle={volAngle} lineNormal={LINE_N} />
          <SpinArrows cx={rBall.x} cy={rBall.y} r={rBall.r + 32} dir={1} color={XRAY.ball} width={14} phase={frame * 2.4} opacity={s1In * (1 - progress(frame, tFlick - 4, 8, EASE.exit))} />
        </g>
      ) : null}
      {/* S4: Open Sky side view, the volley under the bar (same palette as the chip half). */}
      {s4o > 0.001 ? (
        <g opacity={s4o}>
          <PanelSky id="s19-sky-r" horizonY={horizon(camR4)} camX={camR4.x} seed={1} sun />
          <g transform={camT(camR4)}>
          <GroundSide groundY={GROUND_S} vanishX={480} />
          <Keeper x={VIEW_VOL.originX + (VOL_GOAL - 0.45) * PPM_S} groundY={GROUND_S} h={CHALK_H} pose={chalkPoseR} face={chalkFaceR} look={frame >= kick + 26 ? 0.8 : -0.4} />
          <GoalSide view={VIEW_VOL} goalX={VOL_GOAL} netOpacity={0.5} />
          {ghostTrail(trail(VOL_G, fChip, VOLG_NET, VIEW_VOL), camR4.zoom)}
          {fChip > 0 ? realTrail(trail(VOL, fChip, VOL_NET, VIEW_VOL), camR4.zoom) : null}
          <Player x={VIEW_VOL.originX - 0.685 * PPM_S} groundY={GROUND_S} h={TAVI_H} pose={taviPoseR} face={taviFaceR} />
          {fChip > 0 ? <GhostBall cx={volGP.x} cy={volGP.y} r={BALL_S} color={SKY.deep} /> : null}
          {fChip > 0 ? (
            <Ball cx={volP.x} cy={volP.y} r={BALL_S} view={VIEW_VOL} axis={volNow.axis} angle={volNow.angle} lineNormal={LINE_N} />
          ) : (
            <Ball cx={dropP.x} cy={dropP.y} r={BALL_S} view={VIEW_VOL} axis={{ x: 0, y: 1, z: 0 }} angle={frame * 0.05} lineNormal={LINE_N} />
          )}
          <NetBulge x={project({ x: VOL_GOAL + 1.2, y: 0, z: 1.7 }, VIEW_VOL).x} y={project({ x: 0, y: 0, z: 1.7 }, VIEW_VOL).y} at={volNetF} size={16} />
          <Pill x={project({ x: 11.6, y: 0, z: 4.0 }, VIEW_VOL).x} y={project({ x: 0, y: 0, z: 4.0 }, VIEW_VOL).y} text="no spin" s={popSoft(frame, kick + 24) / camR4.zoom} size={36} bg={SKY.deep} color={SKY.cloud} />
          </g>
        </g>
      ) : null}
    </g>
  );

  // Divider: draws down at the split, retracts into the centre at the merge.
  const divHalf = 550 * (1 - progress(frame, merge, 11, EASE.standard));
  const divTop = 540 - divHalf;
  const divBot = Math.min(540 + divHalf, -10 + 1100 * divDraw);

  return (
    <Stage bg={XRAY.bg}>
      <XRayGrid />
      <defs>
        <clipPath id="s19-left">
          <rect x={0} y={0} width={W2 + W2 * (1 - split)} height={1080} />
        </clipPath>
        <clipPath id="s19-right">
          <rect x={W2} y={0} width={W2} height={1080} />
        </clipPath>
      </defs>
      {/* The same air drifting through both halves. */}
      <AirDrift x0={0} x1={1920} y0={250} y1={760} count={34} speed={4.2} size={13} at={tSame} until={s2In} seed="s19air" opacity={0.75} />

      <g opacity={panelsO}>
        <g clipPath="url(#s19-left)">
          <g transform={leftMerge}>{leftPanel}</g>
        </g>
        <g clipPath="url(#s19-right)">
          <g transform={`translate(${W2} 0)`}>
            <g transform={rightMerge}>{rightPanel}</g>
          </g>
        </g>
      </g>

      {/* Divider (chalk, as drawn at the end of s18). */}
      {divBot > divTop + 1 ? <line x1={W2} y1={divTop} x2={W2} y2={divBot} stroke={PITCH.chalk} strokeWidth={10} strokeLinecap="round" opacity={1 - progress(frame, merge + 1, 6, EASE.soft)} /> : null}

      {/* Headers and spin words (screen space, one per half). */}
      <g opacity={panelsO}>
        <ChalkWrite id="s19-title" text="BONUS · THE CHIP" x={480} y={128} at={tBonus} until={s2In - 4} size={62} dur={Math.max(24, tChip + 14 - tBonus)} />
        <Label x={1440} y={110} text="VOLLEY" at={tBonus + 6} until={s2In - 4} bg={XRAY.ball} color={XRAY.bg} size={46} />
        <Text x={480} y={232} text="BACKSPIN" at={tOpp + 6} until={s2In - 4} color={XRAY.air} size={46} />
        <Text x={1440} y={222} text="TOPSPIN" at={tOpp} until={s2In - 4} color={XRAY.ball} size={46} />
        <Label x={480} y={110} text="BACKSPIN" at={tBack} until={merge} bg={XRAY.air} color={XRAY.bg} size={42} />
        <Label x={1440} y={110} text="TOPSPIN" at={tBack + 3} until={merge} bg={XRAY.ball} color={XRAY.bg} size={42} />
        {/* S2 labels. */}
        <Label x={LOUPE.x} y={LOUPE.y - LOUPE.r - 52} text="a thumb's width" at={tThumb + 8} until={tThen - 2} size={44} />
        <Label x={stopS.x} y={Math.min(1010, stopS.y + 105)} text="STOP" at={tStop + 1} until={release + 4} bg={CAST.mistake} color={XRAY.bg} size={46} />
      </g>
      <SlowMoTag at={contact + 2} until={release - 10} label="FREEZE" />
      <SlowMoTag at={release} until={hand - 6} label="SLOW MOTION" />

      {/* Merge: one big ball with a backspin dial (two arrows). s20 opens on this exact frame. */}
      {mb > 0.001 ? (
        <g>
          <MergeDial cx={960} cy={540} s={mb} ringO={ringT} phase={dialPhase} />
          <Ball cx={960} cy={540} r={MERGE_R * mb} view={SIDE_UNIT} axis={{ x: 0, y: -1, z: 0 }} angle={-(END - frame) * 0.12} lineNormal={LINE_N} />
        </g>
      ) : null}

      {/* SFX. */}
      <Sfx name="whoosh" at={2} volume={0.3} />
      <Sfx name="chalk" at={tBonus} volume={0.4} />
      <Sfx name="pop-soft" at={tBonus + 6} volume={0.25} />
      <Sfx name="air" at={tSame} volume={0.22} />
      <Sfx name="tick" at={tOpp + 2} volume={0.45} />
      <Sfx name="whoosh" at={s2In} volume={0.22} />
      <Sfx name="blip" at={plantAt + 2} volume={0.2} />
      <Sfx name="thump" at={contact} volume={0.55} dur={14} />
      <Sfx name="pop-soft" at={tThumb - 4} volume={0.3} />
      <Sfx name="tick" at={tThumb + 4} volume={0.35} />
      <Sfx name="blip" at={tGrass} volume={0.22} />
      <Sfx name="pop" at={tStop + 1} volume={0.3} />
      <Sfx name="air" at={release} volume={0.3} />
      <Sfx name="tick" at={tSteep} volume={0.3} />
      <Sfx name="whoosh" at={hand} volume={0.2} />
      <Sfx name="air" at={tFlick} volume={0.3} />
      <Sfx name="pop-soft" at={tFlick + 1} volume={0.35} />
      <Sfx name="whoosh" at={s4In} volume={0.22} />
      <Sfx name="thump" at={kick} volume={0.4} />
      <Sfx name="whoosh-long" at={kick + 2} volume={0.35} />
      <Sfx name="net" at={volNetF} volume={0.35} />
      <Sfx name="net" at={chipNetF} volume={0.25} />
      <Sfx name="whoosh" at={merge} volume={0.3} />
      <Sfx name="pop" at={merge + 2} volume={0.3} />
    </Stage>
  );
};
