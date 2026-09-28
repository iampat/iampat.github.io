// s07 Chapter 1 practice: the toes-up mistake and the fix on the board, the knee-height wall
// drill (seven of ten under the tape), then the real DRIVE_R past Chalk's late dive.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../kit/Camera";
import { CarPark, Dust, Floodlight, GroundSide, Sky, Stands, Stars } from "../kit/World";
import { Player, POSES, cyclePose, mixPose, poseAt, type Pose } from "../kit/Player";
import { Keeper, keeperPoseAt, type KeeperPose } from "../kit/Keeper";
import { Ball } from "../kit/Ball";
import { GoalFront, GoalSide } from "../kit/Goal";
import { Label, PracticeBoard, Stamp, Text } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { crossingAtX, simulate, sampleAt, spinAngleAt, type BallState, type KickParams } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, idle, lerp, pop, popSoft, progress, visible } from "../lib/anim";
import { pathD, project, type View } from "../lib/project";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH } from "../theme";
import {
  ConcreteWall,
  CueChips,
  DirArrow,
  DrillMap,
  FastTag,
  LockIcon,
  NetBulge,
  NetRipple,
  PerspGround,
  Pulse,
  RippleWipe,
  SafetyIcon,
  SpeedStreaks,
  jointsOf,
  obliqueOf,
  planted,
  type SafetyKind,
} from "../kit/ext/s06-s07-parts";

const PPM = 50;
const OX = 700;
const GROUND = 840;
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const OBL = obliqueOf({ originX: OX, groundY: GROUND, ppm: PPM });
const H_T = 1.62 * PPM;
const BALL_R = 0.11 * PPM;
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const GOAL_M = 18;
const WALL_M = -12; // wall face (metres)
const SPOT_M = WALL_M - 10; // drill kick spot: ten big steps from the wall
const TAPE_Z = 0.5; // knee-height tape (shared with s18: #FFD166 at 0.5 m)
const WALL_HALF = 2.5;
const GREY = "#6B7194";

// ---------- Drill flights ----------
// Seven good DRIVE_WALL shots; two are struck a little higher (over the tape), one is a
// scuffed roller along the grass. Heights and times come from the sim.
type WallShot = { path: BallState[]; hitIdx: number; hit: BallState; rebound: BallState[] };
const wallShot = (p: KickParams, restitution = 0.45): WallShot => {
  const path = simulate({ ...p, duration: 2 }, 30);
  const hit = crossingAtX(path, 10 - 0.11)!;
  const hitIdx = Math.ceil(hit.t * 30);
  const vx = -hit.vel.x * restitution;
  const vz = hit.vel.z;
  const rebound = simulate(
    { speed: Math.hypot(vx, vz), elevationDeg: (Math.atan2(vz, Math.abs(vx)) * 180) / Math.PI, azimuthDeg: 180, start: hit.pos, cd: 0.25, duration: 1.2 },
    30,
  );
  return { path, hitIdx, hit, rebound };
};
const GOOD = wallShot(SHOTS.DRIVE_WALL);
const HIGH = wallShot({ ...SHOTS.DRIVE_WALL, elevationDeg: 8 });
const ROLL = wallShot({ speed: SHOTS.DRIVE_WALL.speed * 0.55, elevationDeg: 0, cd: 0.25, start: SHOTS.DRIVE_WALL.start }, 0.35);
/** Which of the ten shots do not count: 1 = roller, 4 and 7 = over the tape. */
const KIND: ("good" | "high" | "roll")[] = ["good", "roll", "good", "good", "high", "good", "good", "high", "good", "good"];
const SHOT_OF = { good: GOOD, high: HIGH, roll: ROLL };
/** Lateral scatter of the ten balls on the wall (visual only; heights come from the sim). */
const JITTER = [0.15, -0.35, 0.4, -0.1, 0.3, -0.45, 0.05, 0.5, -0.25, -0.05];

// ---------- The real kick ----------
const DRIVE_NET = simulate({ ...SHOTS.DRIVE_R, duration: 2, stopAtX: GOAL_M + 1.8 }, 30);
const NET_IDX = DRIVE_NET.length - 1;
const NET_HIT = DRIVE_NET[NET_IDX];
const NET_DROP = simulate({ speed: 0, elevationDeg: -90, start: NET_HIT.pos, restitution: 0.3, duration: 1.5 }, 30);

// ---------- Poses ----------
const TOE_BACK: Pose = { ...POSES.plant, nearAnkle: 96 };
const TOEUP: Pose = { torso: -4, head: 2, nearHip: 16, nearKnee: 14, nearAnkle: 80, farHip: 8, farKnee: 22, farAnkle: 92, nearShoulder: -30, nearElbow: 20, farShoulder: 55, farElbow: 20 };
const TOE_FOLLOW: Pose = { ...TOEUP, torso: -9, nearHip: 34, nearKnee: 10, nearAnkle: 82 };
const OUCH: Pose = { torso: 5, head: 10, nearHip: 30, nearKnee: 74, nearAnkle: 100, farHip: -2, farKnee: 8, farAnkle: 90, nearShoulder: 28, nearElbow: 70, farShoulder: 36, farElbow: 80 };
const POINTED: Pose = { ...POSES.ready, nearAnkle: 165, nearKnee: 34 };
const PLANT_DOWN: Pose = { ...POSES.plant, nearAnkle: 160 };
const STRIKE_LACES_DX = jointsOf(planted(POSES.strike, H_T), H_T, 0, GROUND).nearLaces.x;
/**
 * Chalk's late dive and landing. The reach is kept short on purpose: the mitten tip stays
 * about 2.3 m right of centre in the air and 1.9 m on the grass, while DRIVE_R crosses the
 * line 2.7 m right of centre. On screen the mitten-to-ball gap stays at least two ball
 * widths for the whole pass (checked for f526-f560).
 */
const DIVE_LATE: KeeperPose = { left: 138, right: 112, lean: 64, shift: 0.3, lift: 0.16, stretch: 1.05 };
const FLAT: KeeperPose = { left: 152, right: 125, lean: 86, shift: 0.18, lift: -0.28, stretch: 1 };
/** The kit Keeper clips at its ground line; drawing him from a lower line keeps the landing mitten whole. */
const CLIP_PAD = 0.4;

// ---------- Board layout ----------
const PANEL_Y = 250;
const PANEL_H = 730;
const MINI_H = 400;
const MINI_G = 850;
const MINI_R = (0.11 / 1.62) * MINI_H;
const M_X = 470; // mistake mini-Tavi hip at contact
const F_X = 1320; // fix mini-Tavi hip at contact

export const S07: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s07");

  // Beats. A few words sit late or early in the word timing; small offsets move them
  // onto the audible syllable (checked against the waveform).
  const tMistW = cue("mistake");
  const tToesUp = cue("toes up");
  const tHit = cue("hits your toes");
  const tPoint = cue("Point your toes", 4);
  const tDown = cue("toes down");
  const tLock = cue("lock your ankle");
  const tSwingW = cue("then swing", 12);
  const tDrill = cue("Solo drill");
  const tDrillW = cue("drill", 4);
  const tTape = cue("tape a line");
  const tWall = cue("across a wall");
  const tKneeH = cue("at knee height");
  const tSteps = cue("From ten big steps", 6);
  const tShoot = cue("shoot ten", 4);
  const tHalf = cue("Start at half power", 6);
  const tHalfP = cue("half power");
  const tReal = cue("Now, for real");
  const tRealW = cue("real");
  const tDives = cue("dives");
  const tLate = cue("late");

  const boardUntil = tDrill - 4;
  const cardAt = tDrill + 2;
  const safeAt = tHalf - 8; // the safety strip replaces the map at the end of the drill
  const stepStart = tSteps;
  const STEP_F = 3.4;
  const stepEnd = stepStart + 10 * STEP_F;
  const turnF = stepEnd + 2;
  const K0 = turnF + 5;
  const kicksAt = Array.from({ length: 10 }, (_, i) => Math.round(K0 + 5.5 * i));
  const hitAt = kicksAt.map((k, i) => k + SHOT_OF[KIND[i]].hitIdx);
  const lastHit = Math.max(...hitAt);
  const panStart = tReal - 6;
  const panEnd = panStart + 40;
  const cardUntil = Math.max(panStart - 4, safeAt + 62); // hold the safety strip at least 2 s
  const counterUntil = Math.max(cardUntil, lastHit + 10);
  const crouchAt = panEnd - 14;
  const kickF = tRealW + 24;
  const behindCut = kickF + 1;
  const netF = kickF + NET_IDX;
  const diveAt = Math.max(kickF + 16, tDives + 8); // just after "dives": clearly late
  const landF = diveAt + 24; // lands on "late"

  const sfx = (
    <>
      <Sfx name="whoosh" at={0} volume={0.3} />
      <Sfx name="pop-soft" at={8} volume={0.25} />
      <Sfx name="stamp" at={tMistW} volume={0.45} />
      <Sfx name="blip" at={tToesUp + 6} volume={0.25} />
      <Sfx name="thump" at={tHit} volume={0.3} />
      <Sfx name="pop" at={tHit + 8} volume={0.3} />
      <Sfx name="stamp" at={tPoint} volume={0.45} />
      <Sfx name="blip" at={tDown} volume={0.25} />
      <Sfx name="tick" at={tLock + 8} volume={0.5} />
      <Sfx name="thump" at={tSwingW} volume={0.45} />
      <Sfx name="whoosh" at={boardUntil} volume={0.3} />
      <Sfx name="whoosh" at={cardAt} volume={0.25} />
      <Sfx name="stamp" at={tDrillW} volume={0.45} />
      <Sfx name="chalk" at={tTape + 4} volume={0.4} />
      <Sfx name="chalk" at={tTape + 22} volume={0.35} />
      <Sfx name="pop" at={tKneeH} volume={0.3} />
      <Sfx name="pop-soft" at={tKneeH + 10} volume={0.3} />
      {Array.from({ length: 10 }, (_, i) => (
        <Sfx key={`st${i}`} name="tick" at={Math.round(stepStart + i * STEP_F)} volume={0.28} dur={20} />
      ))}
      {kicksAt.map((k, i) => (
        <React.Fragment key={`k${i}`}>
          <Sfx name="thump" at={k} volume={0.2} dur={30} />
          <Sfx name="thump" at={hitAt[i]} volume={KIND[i] === "roll" ? 0.14 : 0.28} dur={30} />
          {KIND[i] === "good" ? <Sfx name="tick" at={hitAt[i] + 1} volume={0.25} dur={20} /> : <Sfx name="blip" at={hitAt[i] + 6} volume={0.2} dur={20} />}
        </React.Fragment>
      ))}
      <Sfx name="pop-soft" at={tShoot} volume={0.28} />
      <Sfx name="pop" at={tHalf} volume={0.3} />
      <Sfx name="tick" at={tHalfP + 14} volume={0.45} />
      <Sfx name="whoosh-long" at={panStart} volume={0.35} />
      <Sfx name="pop-soft" at={crouchAt} volume={0.3} />
      <Sfx name="thump" at={kickF} volume={0.6} />
      <Sfx name="whoosh" at={kickF + 3} volume={0.4} />
      <Sfx name="whoosh" at={diveAt} volume={0.25} />
      <Sfx name="net" at={netF} volume={0.55} />
      <Sfx name="thump" at={landF} volume={0.35} />
      <Sfx name="whoosh" at={cue.frames - 16} volume={0.3} />
    </>
  );

  if (frame >= behindCut) {
    return (
      <Behind kickF={kickF} start={behindCut} diveAt={diveAt} tLate={tLate} landF={landF} netF={netF} end={cue.frames}>
        {sfx}
      </Behind>
    );
  }

  // ---------- Camera ----------
  const camY = GROUND - 1.0 * PPM;
  const tavWallX = WALL_M - 0.85;
  const wideY = GROUND - 1.25 * PPM;
  const camKeys: CamKey[] = [
    { f: 0, x: X(WALL_M - 2.6), y: camY, zoom: 2.8 },
    { f: boardUntil, x: X(WALL_M - 2.0), y: camY, zoom: 3.0 },
    { f: tDrill + 14, x: X(WALL_M - 1.3), y: camY, zoom: 3.5 },
    { f: tKneeH + 20, x: X(WALL_M - 1.2), y: camY, zoom: 3.7 },
    { f: stepStart + 4, x: X(WALL_M - 1.9), y: camY - 6, zoom: 3.25 },
    { f: stepEnd + 6, x: X(WALL_M - 5.2), y: wideY, zoom: 1.98 },
    { f: panStart, x: X(WALL_M - 5.25), y: wideY, zoom: 2.02 },
  ];
  const endCam = { x: X(8.2), y: GROUND - 3.4 * PPM, zoom: 1.4 };
  const cam = (() => {
    if (frame < panStart) return cameraAt(frame, camKeys);
    // Pan back to the goal: eased position with the zoom eased in log space.
    const a = cameraAt(panStart, camKeys);
    const u = EASE.camera(Math.min(1, (frame - panStart) / (panEnd - panStart)));
    const drift = progress(frame, panEnd, 30, EASE.soft);
    return { x: lerp(a.x, endCam.x, u) + drift * 6, y: lerp(a.y, endCam.y, u), zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(endCam.zoom), u)) * (1 + 0.012 * drift) };
  })();
  const Z = cam.zoom;
  const cardIn = progress(frame, cardAt, 14, EASE.enter) * (1 - progress(frame, cardUntil, 12, EASE.standard));
  const cx0 = WIDTH / 2 + 300 * cardIn;
  const S = (p: { x: number; y: number }) => ({ x: cx0 + (p.x - cam.x) * Z, y: HEIGHT / 2 + (p.y - cam.y) * Z });
  const horizonY = HEIGHT / 2 + (GROUND - cam.y) * Z;
  const worldT = `translate(${cx0} ${HEIGHT / 2}) scale(${Z}) translate(${-cam.x} ${-cam.y})`;
  const bgScale = 1 + (Z - 1) * 0.05;
  // Solid backdrop for the first frames, so the drill wall never flashes before the board covers it.
  const dim = Math.max(0.55, 1 - progress(frame, 7, 10, EASE.soft)) * (1 - progress(frame, boardUntil - 2, 12, EASE.standard));
  const panSpeed = frame >= panStart && frame < panEnd ? Math.sin(Math.PI * ((frame - panStart) / (panEnd - panStart))) : 0;

  // ---------- Drill Tavi ----------
  const spotBallX = X(SPOT_M);
  const spotHipX = spotBallX - STRIKE_LACES_DX - BALL_R - 2;
  const walking = frame >= stepStart && frame < stepEnd;
  let dx: number;
  let dPose: Pose;
  let dDepth = 0; // metres behind the kick line (the angled run-up)
  if (frame < stepStart) {
    dx = X(tavWallX);
    dPose = poseAt(frame, [
      [tTape - 12, "stand"],
      [tTape - 2, "crouch"],
      [tKneeH - 10, "crouch"],
      [tKneeH + 2, "stand"],
    ]);
  } else if (walking) {
    const u = (frame - stepStart) / (stepEnd - stepStart);
    dx = X(tavWallX) + (spotHipX - X(tavWallX)) * u;
    dPose = cyclePose(frame - stepStart, "walk", STEP_F);
    dPose = { ...dPose, nearHip: dPose.nearHip * 1.5, farHip: dPose.farHip * 1.5 };
  } else {
    dx = spotHipX;
    const last = kicksAt[kicksAt.length - 1];
    if (frame < K0 - 4) dPose = poseAt(frame, [[turnF, "stand"], [K0 - 4, "plant"]]);
    else if (frame < last + 3) {
      // Condensed kick cycle (fast forward): a short run-in from a slight angle, plant, strike, follow.
      const c = ((((frame - (K0 - 4)) % 5.5) + 5.5) % 5.5) * (6 / 5.5);
      const runIn = c < 2 ? 1 - c / 2 : 0;
      dx = spotHipX - runIn * 0.55 * PPM;
      dDepth = runIn * 0.7;
      dPose = c < 2 ? mixPose(cyclePose(frame, "run", 2), POSES.plant, c / 2) : c < 4 ? mixPose(POSES.plant, POSES.strike, (c - 2) / 2) : mixPose(POSES.strike, POSES.follow, (c - 4) / 2);
    } else dPose = poseAt(frame, [[last + 3, "follow"], [last + 16, "stand"]]);
  }
  dPose = { ...dPose, torso: dPose.torso + idle(frame, 3, 3, 0.8) };
  const stepCount = walking ? Math.min(10, Math.floor((frame - stepStart) / STEP_F) + 1) : frame >= stepEnd && frame < stepEnd + 16 ? 10 : 0;
  const stepBump = walking ? 1 + 0.25 * (1 - progress(frame, stepStart + (stepCount - 1) * STEP_F, 4, EASE.enter)) : 1;
  const dJ = jointsOf(dPose, H_T, dx, GROUND);
  // Cartoon turn: squash through zero width instead of a hard flip.
  const turnSx = Math.cos(Math.PI * (progress(frame, stepStart - 4, 7, EASE.standard) - progress(frame, turnF - 3, 7, EASE.standard)));
  const depthShift = OBL(0, dDepth, 0);
  const depthDX = depthShift.x - OX;
  const depthDY = depthShift.y - GROUND;

  // Shots at the wall: only the good ones count.
  const shotsDone = kicksAt.filter((_, i) => KIND[i] === "good" && frame >= hitAt[i]).length;
  const ballsLeft = 10 - kicksAt.filter((k) => frame >= k - 5).length;

  // ---------- Real-kick Tavi (after the pan) ----------
  const realHipKick = X(0) - STRIKE_LACES_DX - BALL_R - 2;
  const runStart = kickF - 12;
  const rx = frame < runStart ? X(-2.4) : X(-2.4) + (realHipKick - X(-2.4)) * progress(frame, runStart, 10, EASE.soft);
  const rPose = poseAt(frame, [
    [runStart, "ready"],
    [runStart + 4, cyclePose(4, "run", 5)],
    [runStart + 8, cyclePose(9, "run", 5)],
    [kickF - 4, "plant"],
    [kickF, "strike"],
  ]);
  const kPose = keeperPoseAt(frame, [
    [crouchAt, "stand"],
    [crouchAt + 10, "ready"],
  ]);
  // Only one Tavi at a time: the drill Tavi leaves the frame before the real one enters it.
  const drillGone = frame >= panStart && S({ x: X(SPOT_M + 0.6), y: 0 }).x < -60;

  // ---------- Wall overlays ----------
  const tapeT = progress(frame, tTape + 4, tWall + 16 - (tTape + 4), EASE.soft);
  const tapeA = OBL(WALL_M, WALL_HALF, TAPE_Z);
  const tapeB = OBL(WALL_M, WALL_HALF - 2 * WALL_HALF * tapeT, TAPE_Z);
  const tapeMid = S(OBL(WALL_M, 0, TAPE_Z));
  const kneeS = S(dJ.nearKnee);
  const kneeLineO = visible(frame, tKneeH + 4, stepStart, 10, 8);

  return (
    <Stage bg={PITCH.sky}>
      <Sky />
      <Stars count={90} maxY={Math.max(140, horizonY - 330)} seed="s07" />
      <g transform={`translate(${cx0} ${horizonY}) scale(${bgScale}) translate(${-WIDTH / 2 - (cam.x - X(-6)) * 0.04} ${-GROUND})`}>
        <Stands baseY={GROUND} lit={1} />
        {[180, 720, 1220, 1760].map((x, i) => (
          <Floodlight key={i} x={x} baseY={GROUND - 20} height={470} on={1} />
        ))}
      </g>
      <g transform={worldT}>
        <GroundSide groundY={GROUND} vanishX={X(-4)} />
        <CarPark x0={X(21)} groundY={GROUND} ppm={PPM} />
        <GoalSide view={SIDE} goalX={GOAL_M} />
        <Keeper x={X(GOAL_M) - 8} groundY={GROUND} h={2.1 * PPM} pose={kPose} face={frame >= crouchAt ? "annoyed" : "flat"} look={-0.7 + idle(frame, 2, 3, 0.2)} />
        <ConcreteWall view={{ originX: OX, groundY: GROUND, ppm: PPM }} faceX={WALL_M} halfW={WALL_HALF} height={2.2}>
          {tapeT > 0.001 ? <line x1={tapeA.x} y1={tapeA.y} x2={tapeB.x} y2={tapeB.y} stroke={PITCH.light} strokeWidth={0.08 * PPM} strokeLinecap="round" /> : null}
          {kicksAt.map((_, i) => {
            if (frame < hitAt[i]) return null;
            const z = SHOT_OF[KIND[i]].hit.pos.z;
            const p = OBL(WALL_M, JITTER[i], z);
            const grey = KIND[i] === "good" ? 0 : progress(frame, hitAt[i] + 4, 10, EASE.standard);
            return <circle key={i} cx={p.x} cy={p.y} r={0.12 * PPM * Math.min(1, pop(frame, hitAt[i]))} fill={grey > 0.5 ? GREY : PITCH.chalk} opacity={0.9 - 0.2 * grey} />;
          })}
        </ConcreteWall>
        {!drillGone ? (
          <>
            {/* Ball pile beside the drill spot. */}
            {Array.from({ length: ballsLeft }, (_, i) => {
              const row = i < 4 ? 0 : i < 7 ? 1 : i < 9 ? 2 : 3;
              const col = i < 4 ? i : i < 7 ? i - 4 : i < 9 ? i - 7 : 0;
              const bx = X(SPOT_M - 1.15) + (col + row * 0.5) * BALL_R * 2.05;
              const by = GROUND - BALL_R - row * BALL_R * 1.75;
              return <Ball key={i} cx={bx} cy={by} r={BALL_R} view={SIDE} lineNormal={LINE_N} />;
            })}
            <g transform={`translate(${dx + depthDX} ${depthDY}) scale(${turnSx * (1 - 0.03 * dDepth)} ${1 - 0.03 * dDepth}) translate(${-dx} 0)`}>
              <Player x={dx} groundY={GROUND} h={H_T} pose={dPose} face={frame >= K0 - 4 && frame < kicksAt[9] + 8 ? "focus" : "neutral"} />
            </g>
          </>
        ) : null}
        {/* Drill balls. */}
        {kicksAt.map((k, i) => {
          const f = frame - k;
          const shot = SHOT_OF[KIND[i]];
          if (f < -5 || f > shot.hitIdx + 16) return null;
          const st = f <= shot.hitIdx ? sampleAt(shot.path, Math.max(0, f)) : sampleAt(shot.rebound, f - shot.hitIdx);
          const pos = { x: SPOT_M + st.pos.x, y: JITTER[i] * Math.min(1, Math.max(0, f) / shot.hitIdx), z: st.pos.z };
          const p = OBL(pos.x, pos.y, pos.z);
          const o = f < 0 ? popSoft(frame, k - 5) : 1 - progress(frame, k + shot.hitIdx + 6, 10);
          const trail = f > 0 && f <= shot.hitIdx + 2 ? shot.path.slice(Math.max(0, Math.floor(f) - 5), Math.min(Math.floor(f), shot.hitIdx) + 1).map((q) => OBL(SPOT_M + q.pos.x, 0, q.pos.z)) : [];
          const src = f <= shot.hitIdx ? shot.path : shot.rebound;
          return (
            <g key={i} opacity={o}>
              {trail.length > 1 ? <path d={pathD(trail)} fill="none" stroke={PITCH.lightSoft} strokeWidth={3} strokeLinecap="round" opacity={0.5} /> : null}
              <Ball cx={p.x} cy={p.y} r={BALL_R} view={SIDE} axis={st.spin} angle={spinAngleAt(src, Math.max(0, f <= shot.hitIdx ? f : f - shot.hitIdx))} lineNormal={LINE_N} />
            </g>
          );
        })}
        {kicksAt.map((_, i) => {
          const p = OBL(WALL_M, JITTER[i], SHOT_OF[KIND[i]].hit.pos.z);
          return <Dust key={i} x={p.x} y={p.y} at={hitAt[i]} size={KIND[i] === "roll" ? 9 : 14} seed={`w${i}`} />;
        })}
        {/* The real kick. */}
        {drillGone ? (
          <>
            <Player x={rx} groundY={GROUND} h={H_T} pose={rPose} face="focus" />
            <Ball cx={X(0)} cy={GROUND - BALL_R} r={BALL_R} view={SIDE} lineNormal={LINE_N} squash={frame >= kickF - 1 ? 0.9 : 1} />
          </>
        ) : null}
      </g>
      {panSpeed > 0.05 ? <SpeedStreaks count={10} speed={-40 * panSpeed} seed="s07pan" y0={160} y1={760} opacity={0.18 * panSpeed} /> : null}

      {/* Wall labels (screen space). */}
      {kneeLineO > 0.001 ? (
        <line x1={kneeS.x + 10} y1={tapeMid.y} x2={tapeMid.x} y2={tapeMid.y} stroke={PITCH.chalk} strokeWidth={5} strokeDasharray="4 12" strokeLinecap="round" opacity={0.9 * kneeLineO} />
      ) : null}
      {kicksAt.map((_, i) => {
        if (KIND[i] === "good") return null;
        const m = S(OBL(WALL_M, JITTER[i], SHOT_OF[KIND[i]].hit.pos.z));
        return <Pulse key={`x${i}`} x={m.x} y={m.y} r0={8} r1={46} at={hitAt[i] + 4} dur={16} color={CAST.mistake} width={6} />;
      })}
      <Label x={kneeS.x - 40} y={tapeMid.y} text="KNEE HEIGHT" at={tKneeH} until={stepStart} size={40} bg={PITCH.light} color={PITCH.sky} anchor="end" />
      {/* Step counter above Tavi. */}
      {stepCount > 0 ? (
        <g transform={`translate(${S(dJ.head).x} ${S(dJ.head).y - 95}) scale(${stepBump * visible(frame, stepStart, stepEnd + 12, 4, 6)})`}>
          <circle r={42} fill={PITCH.chalk} />
          <text y={16} fill={PITCH.sky} fontFamily={FONTS.title} fontWeight={800} fontSize={44} textAnchor="middle">
            {stepCount}
          </text>
        </g>
      ) : null}
      <FastTag x={690} y={56} at={stepStart - 2} until={lastHit + 4} />
      <ShotCounter x={1650} y={110} count={shotsDone} at={K0 - 10} until={counterUntil} />

      {dim > 0.001 ? <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.sky} opacity={dim} /> : null}
      <Board frame={frame} at={-3} chipsAt={6} until={boardUntil} tMistW={tMistW} tToesUp={tToesUp} tHit={tHit} tPoint={tPoint} tDown={tDown} tLock={tLock} tSwingW={tSwingW} />
      <DrillCard
        at={cardAt}
        until={cardUntil}
        tDrill={tDrill}
        tDrillW={tDrillW}
        tWall={tWall}
        tSteps={tSteps}
        tHalf={tHalf}
        tHalfP={tHalfP}
        safeAt={safeAt}
        stepsT={progress(frame, stepStart, stepEnd - stepStart, (t) => t)}
        runT={progress(frame, K0 - 4, 10, EASE.standard)}
      />
      {sfx}
    </Stage>
  );
};

/** HUD counter: shots that went under the tape. */
const ShotCounter: React.FC<{ x: number; y: number; count: number; at: number; until: number }> = ({ x, y, count, at, until }) => {
  const frame = useCurrentFrame();
  const s = popSoft(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-210} y={-62} width={420} height={128} rx={36} fill={PITCH.skyHigh} opacity={0.85} />
      <text x={0} y={-18} fill={PITCH.lightSoft} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
        UNDER THE TAPE
      </text>
      <text x={0} y={46} fill={PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={60} textAnchor="middle">
        {count}
        <tspan fill={PITCH.lightSoft} fontSize={40}>{" / 10"}</tspan>
      </text>
    </g>
  );
};

/** The practice board: three cues on top, MISTAKE (toes up: toe hit) beside FIX (point, lock, swing). */
const Board: React.FC<{ frame: number; at: number; chipsAt: number; until: number; tMistW: number; tToesUp: number; tHit: number; tPoint: number; tDown: number; tLock: number; tSwingW: number }> = ({
  frame,
  at,
  chipsAt,
  until,
  tMistW,
  tToesUp,
  tHit,
  tPoint,
  tDown,
  tLock,
  tSwingW,
}) => {
  // Mistake: toes up, and the toe tip meets the ball. Then an "ouch" hop.
  const shake = frame > tHit + 12 ? 10 * Math.sin((frame - tHit) * 1.3) * Math.exp(-(frame - tHit - 12) / 30) : 0;
  const mPoseRaw = poseAt(frame, [
    [tMistW - 4, "stand"],
    [tMistW + 8, "ready"],
    [tToesUp + 4, TOE_BACK],
    [tHit - 4, TOE_BACK],
    [tHit, TOEUP],
    [tHit + 9, TOE_FOLLOW],
    [tHit + 20, OUCH],
    [tPoint + 6, OUCH],
    [tPoint + 20, "stand"],
  ]);
  const hopping = frame > tHit + 16 && frame < tPoint + 10 ? Math.abs(Math.sin((frame - tHit) * 0.32)) * 0.03 : 0;
  const mPl = planted({ ...mPoseRaw, nearAnkle: mPoseRaw.nearAnkle + shake, torso: mPoseRaw.torso + idle(frame, 4, 3, 0.8) }, MINI_H);
  const mPose = { ...mPl, lift: (mPl.lift ?? 0) + hopping };
  const mX = M_X - 70 * (1 - progress(frame, tHit - 12, 12, EASE.standard));
  const mContact = jointsOf(planted(TOEUP, MINI_H), MINI_H, M_X, MINI_G);
  const mBall = { x: mContact.nearToe.x + MINI_R + 4, y: MINI_G - MINI_R };
  const mJ = jointsOf(mPose, MINI_H, mX, MINI_G);
  const leftDim = 1 - 0.45 * progress(frame, tPoint + 6, 12, EASE.standard);
  // Fix: toes pointed down, ankle locked, then the swing.
  const fPoseRaw = poseAt(frame, [
    [tPoint - 2, "stand"],
    [tPoint + 12, POINTED],
    [tSwingW - 12, POINTED],
    [tSwingW - 5, PLANT_DOWN],
    [tSwingW, "strike"],
    [tSwingW + 10, "follow"],
  ]);
  const fPose = planted({ ...fPoseRaw, torso: fPoseRaw.torso + idle(frame, 5, 3, 0.8) }, MINI_H);
  const fX = F_X - 150 * (1 - progress(frame, tSwingW - 14, 14, EASE.standard));
  const fContact = jointsOf(planted(POSES.strike, MINI_H), MINI_H, F_X, MINI_G);
  const fBall = { x: fContact.nearLaces.x + MINI_R + 6, y: MINI_G - MINI_R };
  const fJ = jointsOf(fPose, MINI_H, fX, MINI_G);
  const lockS = pop(frame, tLock);
  const locked = progress(frame, tLock + 6, 4, EASE.standard);
  const mFace = frame >= tHit ? "wince" : frame >= tMistW + 8 ? "focus" : "neutral";
  const fFace = frame >= tSwingW + 10 ? "happy" : frame >= tPoint ? "focus" : "neutral";
  const panel = (x: number, key: string) => <rect key={key} x={x} y={PANEL_Y} width={800} height={PANEL_H} rx={40} fill="#16324B" />;
  const miniGround = (x: number, key: string) => <rect key={key} x={x + 40} y={MINI_G} width={720} height={8} rx={4} fill={PITCH.chalk} opacity={0.25} />;
  return (
    <PracticeBoard at={at} until={until}>
      <CueChips
        y={205}
        at={chipsAt}
        active={2}
        activeAt={tPoint}
        cues={[
          { icon: "angle", text: "Run-up at an angle" },
          { icon: "hand", text: "Hand-width beside ball" },
          { icon: "lock", text: "Toes down, locked" },
        ]}
      />
      <g opacity={leftDim}>
        {panel(130, "pl")}
        {miniGround(130, "gl")}
        <Stamp kind="MISTAKE" x={340} y={318} at={tMistW} />
        <Player x={mX} groundY={MINI_G} h={MINI_H} pose={mPose} face={mFace} />
        <Ball cx={mBall.x} cy={mBall.y} r={MINI_R} view={SIDE} lineNormal={LINE_N} squash={frame >= tHit && frame < tHit + 5 ? 0.9 : 1} />
        {/* Toes up: the toe tip points up, then meets the ball. */}
        <DirArrow x={mJ.nearToe.x + 6} y={mJ.nearToe.y - 14} angle={-90} len={60} color={CAST.mistake} width={9} t={progress(frame, tToesUp + 6, 10, EASE.enter)} opacity={1 - progress(frame, tHit - 2, 5, EASE.exit)} />
        <Pulse x={mBall.x - MINI_R} y={mBall.y} r0={8} r1={60} at={tHit} dur={16} color={CAST.mistake} width={7} />
        <DirArrow x={mBall.x + MINI_R + 14} y={mBall.y - 6} angle={-14} len={120} color={CAST.mistake} width={11} t={progress(frame, tHit + 3, 12, EASE.enter)} />
        <Label x={mBall.x + 150} y={mBall.y - 120} text="−15% (toe hit)" at={tHit + 8} size={38} bg={CAST.mistake} color={PITCH.chalk} />
        <Text x={530} y={945} text="toes up, ball hits toes" at={tToesUp} size={46} color={CAST.mistake} />
      </g>

      {panel(990, "pr")}
      {miniGround(990, "gr")}
      <Stamp kind="FIX" x={1150} y={318} at={tPoint} />
      <Player x={fX} groundY={MINI_G} h={MINI_H} pose={fPose} face={fFace} />
      <Ball cx={fBall.x} cy={fBall.y} r={MINI_R} view={SIDE} lineNormal={LINE_N} squash={frame >= tSwingW && frame < tSwingW + 5 ? 0.9 : 1} />
      <DirArrow x={fJ.nearToe.x + 4} y={fJ.nearToe.y + 8} angle={90} len={60} color={CAST.fix} width={9} t={progress(frame, tDown, 10, EASE.enter)} opacity={1 - progress(frame, tSwingW - 8, 6, EASE.exit)} />
      <LockIcon x={fJ.nearAnkle.x - 62} y={fJ.nearAnkle.y - 70} size={46} locked={locked} color={CAST.fix} scale={lockS} />
      <DirArrow x={fBall.x + MINI_R + 14} y={fBall.y - 6} angle={-6} len={320} color={CAST.fix} width={13} t={progress(frame, tSwingW + 2, 12, EASE.enter)} />
      <Text x={1250} y={945} text="point," at={tPoint} size={50} color={CAST.fix} />
      <Text x={1415} y={945} text="lock," at={tLock} size={50} color={CAST.fix} />
      <Text x={1575} y={945} text="swing" at={tSwingW - 8} size={50} color={CAST.fix} />
    </PracticeBoard>
  );
};

/** A line of card text (32 px minimum). */
const T: React.FC<{ x: number; y: number; text: string; color?: string; size?: number; weight?: number }> = ({ x, y, text, color = PITCH.chalk, size = 32, weight = 800 }) => (
  <text x={x} y={y} fill={color} fontFamily={FONTS.label} fontWeight={weight} fontSize={size}>
    {text}
  </text>
);

/** One tile of the safety strip: a flat icon over a two-word caption. */
const SAFETY: { kind: SafetyKind; text: string }[] = [
  { kind: "wall", text: "Solid wall" },
  { kind: "nobody", text: "Nobody near" },
  { kind: "cars", text: "No cars" },
  { kind: "warm", text: "Warm up" },
];

/**
 * The drill card, docked on the left while the wall drill plays on the right.
 * A picture slot on top (the drill map, then the safety strip) and a note slot below it.
 * The note slot holds three short lines at most, and each new note replaces the old one.
 */
const DrillCard: React.FC<{
  at: number;
  until: number;
  tDrill: number;
  tDrillW: number;
  tWall: number;
  tSteps: number;
  tHalf: number;
  tHalfP: number;
  safeAt: number;
  stepsT: number;
  runT: number;
}> = ({ at, until, tDrill, tDrillW, tWall, tSteps, tHalf, tHalfP, safeAt, stepsT, runT }) => {
  const frame = useCurrentFrame();
  const inT = progress(frame, at, 14, EASE.enter);
  const outT = progress(frame, until, 9, EASE.exit);
  if (inT <= 0.001 || outT >= 0.999) return null;
  const x = -700 * (1 - inT) - 700 * outT;
  const L = 36;
  const W = 600;
  const P = L + 30;
  const NOTE_Y = 620;
  // Picture slot: the map, then the safety strip.
  const map = visible(frame, tDrill + 16, safeAt - 8, 12, 8);
  const safe = visible(frame, safeAt, undefined, 12);
  // Note slot: the rope note, then the roller rule, then the half-power meter.
  const rollAt = tSteps + 11;
  const rope = visible(frame, tWall + 4, rollAt - 8, 12, 8);
  const roll = visible(frame, rollAt, tHalf - 8, 12, 8);
  const meter = popSoft(frame, tHalf);
  const fill = progress(frame, tHalfP, 14, EASE.standard) * 0.5;
  const meterLock = pop(frame, tHalfP + 10);
  const note = (o: number, lines: { text: string; color?: string }[], key: string) =>
    o > 0.001 ? (
      <g key={key} opacity={o} transform={`translate(0 ${(1 - o) * 14})`}>
        <rect x={P - 10} y={NOTE_Y} width={W - 40} height={176} rx={26} fill="#16324B" />
        {lines.map((l, i) => (
          <T key={i} x={P + 12} y={NOTE_Y + 50 + i * 46} text={l.text} color={l.color} size={36} />
        ))}
      </g>
    ) : null;
  const tileW = (W - 60 - 16) / 2;
  const tileH = 136;
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x={L} y={40} width={W} height={800} rx={44} fill="#10263A" />
      <rect x={L} y={40} width={W} height={96} rx={44} fill="#16324B" />
      <rect x={L} y={90} width={W} height={46} fill="#16324B" />
      <text x={L + W / 2} y={104} fill={PITCH.lightSoft} fontFamily={FONTS.hud} fontWeight={700} fontSize={36} textAnchor="middle" letterSpacing={6}>
        SOLO DRILL
      </text>
      <Stamp kind="DRILL" x={L + W / 2} y={200} at={tDrillW} rotate={-5} />
      {/* Picture slot, first: the top-view map of the drill. */}
      <DrillMap x={P} y={272} w={W - 60} stepsT={stepsT} runT={runT} opacity={map} />
      {/* Picture slot, then: the safety rules as one icon strip, held to the end of the drill. */}
      {safe > 0.001 ? (
        <g opacity={safe} transform={`translate(0 ${(1 - safe) * 14})`}>
          <rect x={P} y={262} width={176} height={50} rx={25} fill={CAST.mistake} />
          <text x={P + 88} y={299} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
            SAFETY
          </text>
          {SAFETY.map((s, i) => {
            const tx = P + (i % 2) * (tileW + 16);
            const ty = 330 + Math.floor(i / 2) * (tileH + 12);
            const k = popSoft(frame, safeAt + 4 + i * 4);
            if (k <= 0.001) return null;
            return (
              <g key={s.kind} transform={`translate(${tx + tileW / 2} ${ty + tileH / 2}) scale(${k}) translate(${-tileW / 2} ${-tileH / 2})`}>
                <rect x={0} y={0} width={tileW} height={tileH} rx={24} fill="#16324B" />
                <g transform={`translate(${tileW / 2} 54)`}>
                  <SafetyIcon kind={s.kind} />
                </g>
                <text x={tileW / 2} y={124} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={32} textAnchor="middle">
                  {s.text}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}
      {/* Note slot: one short note at a time. */}
      {note(
        rope,
        [
          { text: "No wall? Tie a rope", color: PITCH.lightSoft },
          { text: "across a goal, knee high.", color: PITCH.lightSoft },
          { text: "Nobody in or behind it.", color: CAST.mistake },
        ],
        "rope",
      )}
      {note(
        roll,
        [
          { text: "Rollers don't count.", color: PITCH.light },
          { text: "7 of 10? Step back." },
          { text: "Then 5 with the other foot." },
        ],
        "roll",
      )}
      {/* Note slot, last: half power. */}
      {meter > 0.001 ? (
        <g transform={`translate(${P} ${NOTE_Y + 50}) scale(${meter})`}>
          <text x={0} y={0} fill={PITCH.light} fontFamily={FONTS.label} fontWeight={800} fontSize={36}>
            Start at half power.
          </text>
          <rect x={0} y={24} width={W - 60} height={42} rx={21} fill={PITCH.stands} />
          <rect x={0} y={24} width={Math.max(42, (W - 60) * fill)} height={42} rx={21} fill={PITCH.light} opacity={fill > 0.01 ? 1 : 0} />
          <line x1={(W - 60) / 2} y1={16} x2={(W - 60) / 2} y2={74} stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
          <LockIcon x={(W - 60) / 2 + 44} y={30} size={30} locked={progress(frame, tHalfP + 14, 4)} color={PITCH.chalk} scale={meterLock} />
        </g>
      ) : null}
    </g>
  );
};

/** Behind the shot: DRIVE_R skims into the right corner past Chalk's late dive. */
const Behind: React.FC<{ kickF: number; start: number; diveAt: number; tLate: number; landF: number; netF: number; end: number; children?: React.ReactNode }> = ({
  kickF,
  start,
  diveAt,
  tLate,
  landF,
  netF,
  end,
  children,
}) => {
  const frame = useCurrentFrame();
  const push = progress(frame, start, end - start, EASE.camera);
  const focal = 2300 + 260 * push;
  const PITCH_DEG = 1; // looking up a little, so the goal sits near the middle of the frame
  const view: View = { kind: "persp", cam: { x: 0.5, y: 0, z: 0.9 }, yawDeg: 0, pitchDeg: PITCH_DEG, focal, cx: 960, cy: 560 };
  const horizonY = 560 + focal * Math.tan((PITCH_DEG * Math.PI) / 180);
  const f = frame - kickF;
  const inFlight = f <= NET_IDX;
  const st = inFlight ? sampleAt(DRIVE_NET, f) : sampleAt(NET_DROP, f - NET_IDX);
  const p = project(st.pos, view);
  const r = 0.11 * p.scale;
  const angle = inFlight ? spinAngleAt(DRIVE_NET, f) : spinAngleAt(DRIVE_NET, NET_IDX);
  const trail = DRIVE_NET.slice(0, Math.min(NET_IDX, Math.floor(f)) + 1)
    .filter((q) => q.pos.x - view.cam.x > 1.4)
    .map((q) => project(q.pos, view));
  if (inFlight && st.pos.x - view.cam.x > 1.4) trail.push(p);
  const trailO = 0.55 * (1 - progress(frame, netF + 4, 16));
  const kk = project({ x: GOAL_M, y: 0, z: 0 }, view);
  const kh = 2.1 * kk.scale;
  const kPose = keeperPoseAt(frame, [
    [diveAt, "ready"],
    [diveAt + 12, DIVE_LATE],
    [landF, FLAT],
  ]);
  const kFace = frame >= tLate - 6 ? "annoyed" : frame >= diveAt - 4 ? "surprised" : "flat";
  const net = project(NET_HIT.pos, view);
  const rest = project(NET_DROP[NET_DROP.length - 1].pos, view);
  const shadow = project({ ...st.pos, z: 0 }, view);
  return (
    <Stage bg={PITCH.sky}>
      <Sky id="sky-s07b" />
      <Stars count={80} maxY={horizonY - 220} seed="s07b" />
      {[140, 700, 1220, 1780].map((x, i) => (
        <Floodlight key={i} x={x} baseY={horizonY - 10} height={250} on={1} />
      ))}
      <g transform={`translate(0 ${horizonY - 840 * 0.8}) scale(1 0.8)`}>
        <Stands baseY={840} lit={1} />
      </g>
      <PerspGround view={view} goalX={GOAL_M} fromX={view.cam.x + 1.2} horizonY={horizonY} />
      <GoalFront view={view} goalX={GOAL_M} />
      {/* The ball sits in a bulging pocket in the bottom corner, past Chalk's fingertips. */}
      <NetBulge x={rest.x} y={rest.y} at={netF} size={r * 3.4} />
      <Keeper x={kk.x} groundY={kk.y + CLIP_PAD * kh} h={kh} pose={{ ...kPose, lift: kPose.lift + CLIP_PAD }} face={kFace} look={frame >= diveAt - 4 ? 0.9 : idle(frame, 2, 3, 0.2)} />
      <Dust x={kk.x + (FLAT.shift + 0.12) * kh} y={kk.y} at={landF} size={kh * 0.45} seed="flop" />
      <NetRipple x={net.x} y={net.y} at={netF} size={84} />
      {st.pos.x - view.cam.x > 1.2 ? <ellipse cx={shadow.x} cy={shadow.y} rx={r * 0.95} ry={r * 0.28} fill="#0B3F31" opacity={0.45} /> : null}
      {trail.length > 1 ? <path d={pathD(trail)} fill="none" stroke={PITCH.lightSoft} strokeWidth={Math.max(4, r * 0.35)} strokeLinecap="round" strokeLinejoin="round" opacity={trailO} /> : null}
      {st.pos.x - view.cam.x > 0.8 ? <Ball cx={p.x} cy={p.y} r={r} view={view} axis={DRIVE_NET[Math.min(NET_IDX, Math.max(0, Math.floor(f)))].spin} angle={angle} lineNormal={LINE_N} /> : null}
      {/* Hold 1 s on the goal after the net, then the wipe (it covers the frame on the last frame). */}
      <RippleWipe x={net.x} y={net.y} at={Math.max(netF + 30, end - 13)} dur={12} />
      {children}
    </Stage>
  );
};
