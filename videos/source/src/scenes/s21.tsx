// s21 Ending: the first shot again (DRIVE_L into the bottom left corner), then the Line
// recap of the three spins in a row of chalk boxes, ending on a fifth, empty box.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../kit/Camera";
import { CarPark, Dust, Glow, GroundSide, Stars } from "../kit/World";
import { Player, POSES, cyclePose, mixPose, type Face, type Pose } from "../kit/Player";
import { Keeper, keeperPoseAt, type KeeperFace, type KeeperPose } from "../kit/Keeper";
import { Ball } from "../kit/Ball";
import { Flight } from "../kit/Flight";
import { GoalSide } from "../kit/Goal";
import { SlowMoTag } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { crossingAtX, sampleAt, simulate, spinAngleAt, type Vec3 } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, idle, pop, progress } from "../lib/anim";
import { pathD, project, type View } from "../lib/project";
import { HEIGHT, PITCH, WIDTH } from "../theme";
import {
  CueBadge,
  EmptyBubble,
  Fist,
  KneeArrow,
  LineHalo,
  RECAP,
  RunUpInset,
  SideBackdrop,
  Streak,
  breathe,
  camT,
  streakPoints,
  taviJoints,
  toScreen,
  type Cam,
} from "../kit/ext/s21-s23-bits";
import { RECAP_BALL_Y, RECAP_HOLD, RecapRow, ball1Angle, pulseFrames, recapBeats } from "../kit/ext/s21-s23-recap";
import { GroundLines, NetGoal, StadiumPlate, behindCam, lensZoom, type Persp } from "../kit/ext/s21-s23-goal";

const PPM = 50;
const OX = 400;
const GROUND = 820;
const GOAL_M = 18;
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 }; // the same Line as s01
const TAVI_H = 1.62 * PPM;
const BALL_R = 0.11 * PPM * 1.1;

const MISS = simulate({ ...SHOTS.MISS, ground: true, duration: 3 }, 30);
const MISS_LAND = Math.max(20, MISS.findIndex((s) => s.bounces > 0));
const DRIVE = simulate({ ...SHOTS.DRIVE_L, duration: 2.5 }, 30);
const CROSS_F = (crossingAtX(DRIVE, GOAL_M)?.t ?? 0.97) * 30;
const NET_X = GOAL_M + 1.6; // back of the net at the ball's height
const STOP_I = Math.max(1, DRIVE.findIndex((s) => s.pos.x >= NET_X));

/** DRIVE_L until it meets the back net, then the net holds it and it drops (free fall). */
const drivePos = (fl: number): Vec3 => {
  if (fl <= STOP_I) return sampleAt(DRIVE, Math.max(0, fl)).pos;
  const s = DRIVE[STOP_I].pos;
  const t = (fl - STOP_I) / 30;
  const z = Math.max(0.11, s.z - 0.5 * 9.81 * t * t);
  const give = 0.28 * Math.exp(-t * 3.5) * Math.sin(t * 12);
  return { x: s.x + give, y: s.y, z };
};

export const S21: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s21");

  // ---------- Beats (scene frames) ----------
  const tFirst = cue("The first shot again");
  const tAgain = cue("again");
  const tStand = cue("Standing foot");
  const tBeside = cue("beside the ball");
  const tToes = cue("Toes down");
  const tLock = cue("ankle locked");
  const tIn = cue("In"); // "Low. Hard. In.": the ball crosses the line on "In"
  const tNo = cue("No shouting needed");
  // "And that line?" The recogniser puts "and" inside the long pause. In the audio a breath comes
  // at 12.7 s and the question at 13.4-14.1 s. "that" (13.2 s) is the reliable word.
  const tLine = cue("that line");
  const tTold = cue("It told you everything");
  // The recap beats (shared with s22, which opens on the same row).
  const rb = recapBeats(cue);
  const { tLittle, tHardLow, tSide, tTop, tBack, tFloat } = rb;
  const END = cue.frames;

  const kickF = Math.round(tIn + 2 - CROSS_F); // the thump lands on "Hard", the ball crosses on "In"
  const hitF = kickF + STOP_I;
  const shotB = tStand - 6;
  const shotC = kickF + 3;
  const shotD = tNo - 6;
  const shotC2 = tNo + 36;
  const shotE = tLine - 2;
  const shotE2 = shotE + 26;

  const runStart = tStand + 6;
  const plantF = tBeside + 6;
  const swingStart = tToes + 4;
  const contactF = tLock + 14;

  // ---------- Shared side world ----------
  const sideWorld = (cam: Cam, extra: React.ReactNode, keeper: { pose: KeeperPose; face: KeeperFace; look: number }, seed: string) => (
    <>
      <SideBackdrop cam={cam} ground={GROUND} refX={X(4)} seed={seed} />
      <g transform={camT(cam)}>
        <GroundSide groundY={GROUND} vanishX={X(8)} />
        <CarPark x0={X(GOAL_M + 3)} groundY={GROUND} ppm={PPM} />
        <GoalSide view={SIDE} goalX={GOAL_M} />
        <Keeper x={X(GOAL_M) - 8} groundY={GROUND} h={2.1 * PPM} pose={keeper.pose} face={keeper.face} look={keeper.look} />
        {extra}
      </g>
    </>
  );

  // ---------- Shot A: the first shot again (wide), with the ghost of the old miss ----------
  if (frame < shotB) {
    const cam = cameraAt(frame, [
      { f: 0, x: X(7.4), y: GROUND - 250, zoom: 1.12 },
      { f: shotB, x: X(6.6), y: GROUND - 240, zoom: 1.19 },
    ]);
    const pts = MISS.slice(0, MISS_LAND + 1).map((s) => project(s.pos, SIDE));
    const draw = progress(frame, tFirst + 2, 18, EASE.soft);
    const back = progress(frame, tAgain, 14, EASE.standard);
    const n = Math.floor(pts.length * draw * (1 - back));
    const ghostTip = n > 1 ? pts[n - 1] : null;
    const kPose = keeperPoseAt(frame, [
      [0, "crossed"],
      [tAgain + 2, "crossed"],
      [tAgain + 14, "ready"],
    ]);
    const pose = breathe(POSES.ready, frame, 1);
    return (
      <Stage bg={PITCH.sky}>
        {sideWorld(
          cam,
          <>
            <Player x={X(-3.2)} groundY={GROUND} h={TAVI_H} pose={pose} face="focus" />
            {n > 1 ? <path d={pathD(pts.slice(0, n))} fill="none" stroke={PITCH.chalk} strokeWidth={3.5} strokeDasharray="3 10" strokeLinecap="round" opacity={0.6} /> : null}
            {ghostTip && back < 0.98 ? <circle cx={ghostTip.x} cy={ghostTip.y} r={BALL_R * 1.2} fill="none" stroke={PITCH.chalk} strokeWidth={2} strokeDasharray="3 4" opacity={0.6} /> : null}
            <Ball cx={X(0)} cy={GROUND - 0.11 * PPM} r={BALL_R} view={SIDE} lineNormal={LINE_N} />
            <Glow cx={X(0)} cy={GROUND - 0.11 * PPM} r={30} color={PITCH.lightSoft} intensity={0.8 * progress(frame, tAgain + 8, 8) * (1 - progress(frame, tAgain + 18, 10))} rings={3} />
          </>,
          { pose: kPose, face: frame < tAgain + 6 ? "smug" : "flat", look: -0.5 + idle(frame, 2, 3, 0.2) },
          "s21a",
        )}
        <Sfx name="whoosh" at={tFirst + 2} volume={0.25} />
        <Sfx name="whoosh" at={tAgain} volume={0.3} />
        <Sfx name="blip" at={tAgain + 10} volume={0.3} />
        <Sfx name="whoosh" at={shotB - 4} volume={0.3} />
      </Stage>
    );
  }

  // ---------- Shot B: close on Tavi. Angled run-up, standing foot, toes down, ankle locked ----------
  if (frame < shotC) {
    const keysB: CamKey[] = [
      { f: shotB, x: X(-1.5), y: GROUND - 64, zoom: 3.4 },
      { f: plantF, x: X(-0.7), y: GROUND - 60, zoom: 3.7 },
      { f: kickF, x: X(-0.45), y: GROUND - 58, zoom: 4.0 },
    ];
    const cam = cameraAt(frame, keysB);
    const hipX =
      frame < runStart
        ? X(-3.2)
        : frame < plantF
          ? X(-3.2 + 3.04 * progress(frame, runStart, plantF - runStart, EASE.soft))
          : frame < kickF
            ? X(-0.16 + 0.06 * progress(frame, swingStart, contactF - swingStart, EASE.soft))
            : X(-0.1 + 0.3 * progress(frame, kickF, 14, EASE.enter));
    let pose: Pose;
    if (frame < runStart) pose = breathe(POSES.ready, frame, 1);
    else if (frame < plantF) {
      const run = cyclePose(frame - runStart, "run", 8);
      pose = mixPose(mixPose(POSES.ready, run, progress(frame, runStart, 6, EASE.soft)), POSES.plant, progress(frame, plantF - 8, 8, EASE.soft));
    } else if (frame < swingStart) pose = breathe(POSES.plant, frame, 2, 0.35);
    else if (frame < kickF) pose = breathe(mixPose(POSES.plant, POSES.strike, progress(frame, swingStart, contactF - swingStart, EASE.soft)), frame, 2, 0.15);
    else pose = mixPose(POSES.strike, POSES.follow, progress(frame, kickF, 12, EASE.enter));
    const face: Face = frame >= runStart - 4 ? "focus" : "neutral";
    const J = taviJoints(pose, hipX, GROUND, TAVI_H);
    const ballW = { x: X(0), y: GROUND - 0.11 * PPM };
    const ballS = toScreen(cam, ballW.x, ballW.y);
    const footS = toScreen(cam, (J.farAnkle.x + J.farToe.x) / 2, GROUND - 2);
    const ankleS = toScreen(cam, J.ankle.x, J.ankle.y);
    const kneeS = toScreen(cam, J.knee.x, J.knee.y);
    const squash = frame >= contactF - 1 && frame < kickF ? 0.9 : 1;
    const kPose = keeperPoseAt(frame, [[shotB, "ready"]]);
    return (
      <Stage bg={PITCH.sky}>
        {sideWorld(
          cam,
          <>
            <Player x={hipX} groundY={GROUND} h={TAVI_H} pose={pose} face={face} />
            {frame < kickF ? (
              <Ball cx={ballW.x + (squash < 1 ? 0.6 : 0)} cy={ballW.y} r={BALL_R} view={SIDE} lineNormal={LINE_N} squash={squash} />
            ) : (
              <>
                <Streak id="s21b-streak" pts={streakPoints((f) => project(sampleAt(DRIVE, f).pos, SIDE), frame - kickF, 3)} width={BALL_R * 1.4} maxLen={BALL_R * 7} />
                <Flight path={DRIVE} view={SIDE} at={kickF} r={BALL_R} trail={false} lineNormal={LINE_N} />
              </>
            )}
            <Dust x={(J.farAnkle.x + J.farToe.x) / 2} y={GROUND} at={plantF} size={14} seed="plant21" />
            {frame >= plantF + 2 ? (
              <ellipse cx={X(-0.02)} cy={GROUND + 1.5} rx={9} ry={2.2} fill={PITCH.chalk} opacity={0.55 * progress(frame, plantF + 2, 8) * (1 - progress(frame, kickF, 6))} />
            ) : null}
          </>,
          { pose: kPose, face: "flat", look: -0.6 },
          "s21b",
        )}
        {/* Top view: the run-up comes in at a slight angle; the last step lands beside the ball. */}
        <RunUpInset x={1650} y={250} r={150} at={shotB + 4} until={tToes - 2} runAt={runStart} runEnd={plantF} steps={[runStart + 9, runStart + 18, plantF]} />
        <CueBadge kind="disc" x={ballS.x - 380} y={ballS.y - 250} tx={footS.x - 4} ty={footS.y} at={tBeside + 8} until={kickF} r={70} />
        <CueBadge kind="lock" x={ballS.x + 330} y={ballS.y - 250} tx={ankleS.x + 8} ty={ankleS.y} at={tLock} until={kickF} r={70} />
        <KneeArrow x={kneeS.x} y1={kneeS.y} y2={ballS.y - BALL_R * cam.zoom - 6} at={contactF + 2} until={kickF} color={PITCH.light} />
        <SlowMoTag at={swingStart} until={kickF} />
        <Sfx name="pop-soft" at={shotB + 4} volume={0.25} />
        <Sfx name="tick" at={tBeside + 8} volume={0.35} />
        <Sfx name="tick" at={tLock} volume={0.35} />
        <Sfx name="tick" at={contactF + 2} volume={0.35} />
        <Sfx name="thump" at={plantF} volume={0.2} />
        <Sfx name="thump" at={kickF} volume={0.7} />
        <Sfx name="air" at={kickF + 1} volume={0.35} />
      </Stage>
    );
  }

  // ---------- Behind-the-kicker goal view (shots C, C2 and E1) ----------
  const LIE: KeeperPose = { left: 150, right: 112, lean: -84, shift: -0.62, lift: -0.3, stretch: 1 };
  // After the late dive Chalk stays flat for a moment, then gets up slowly: first onto his
  // knees and elbows (low and bent), then upright, and only then taps his head.
  const GETUP: KeeperPose = { left: 30, right: 75, lean: -20, shift: -0.3, lift: -0.2, stretch: 0.86 };
  const kPoseGoal = keeperPoseAt(frame, [
    [shotC, "ready"],
    [kickF + 17, "ready"],
    [kickF + 29, "diveL"],
    [kickF + 37, LIE],
    [shotC2 + 22, LIE],
    [shotC2 + 44, GETUP],
    [shotC2 + 52, GETUP],
    [shotC2 + 72, "stand"],
    [shotC2 + 84, "tapHead"],
    [shotE + 6, "tapHead"],
  ]);
  const kFaceGoal: KeeperFace =
    frame < kickF + 20 ? "flat" : frame < kickF + 40 ? "surprised" : frame < shotC2 + 60 ? "annoyed" : "thinking";
  const goalView = (view: Persp, flat: string, plateOpacity: number, keeperOpacity = 1) => {
    const fl = frame - kickF;
    const pos = drivePos(fl);
    const bs = project(pos, view);
    const streak = streakPoints((f) => {
      const q = project(drivePos(Math.min(f, STOP_I)), view);
      return q.depth > 0.3 ? q : null;
    }, Math.min(fl, STOP_I), 4);
    const fs = Math.min(fl, STOP_I);
    const spin = sampleAt(DRIVE, Math.max(0, fs)).spin;
    const angle = spinAngleAt(DRIVE, Math.max(0, fs)) + (fl > STOP_I ? 2.5 * (1 - Math.exp(-(fl - STOP_I) / 12)) : 0);
    const kp = project({ x: GOAL_M, y: 0, z: 0 }, view);
    const land = project({ x: GOAL_M, y: 1.4, z: 0 }, view);
    const hit = DRIVE[STOP_I].pos;
    return (
      <>
        <g transform={flat} opacity={plateOpacity}>
          <StadiumPlate lamps={[1, 1, 1, 1]} seed="s21c" />
        </g>
        <GroundLines view={view} goalX={GOAL_M} opacity={0.35} />
        <NetGoal view={view} goalX={GOAL_M} frame={frame} hit={{ y: hit.y, z: hit.z, at: hitF }} sway={0.1} swayDecay={4} />
        {keeperOpacity > 0.01 ? (
          <Keeper x={kp.x} groundY={kp.y} h={2.1 * kp.scale} pose={kPoseGoal} face={kFaceGoal} look={frame < kickF + 20 ? 0 : -0.8} opacity={keeperOpacity} />
        ) : null}
        <Dust x={land.x - 40} y={land.y} at={kickF + 37} size={0.9 * land.scale} seed="lie21" />
        {fl >= 0 ? (
          <>
            <Streak id="s21c-streak" pts={streak} width={Math.max(8, 0.11 * bs.scale * 1.8)} maxLen={Math.max(60, 0.11 * bs.scale * 9)} opacity={0.6 * (1 - progress(frame, hitF, 6))} />
            <Ball cx={bs.x} cy={bs.y} r={Math.max(5, 0.11 * bs.scale * 1.15)} view={view} axis={spin} angle={angle} lineNormal={LINE_N} />
          </>
        ) : null}
      </>
    );
  };
  const base = behindCam(-4, 2400);

  // ---------- Shot C: low, hard, in. Chalk dives late ----------
  if (frame < shotD) {
    const push = progress(frame, shotC, shotD - shotC, EASE.camera);
    const { view, flat } = lensZoom(base, 1 + 0.12 * push, { x: GOAL_M, y: 1.4, z: 0.9 }, 0, 0, 0);
    return (
      <Stage bg={PITCH.sky}>
        {goalView(view, flat, 1)}
        <Sfx name="net" at={hitF} volume={0.6} />
        <Sfx name="chalk" at={kickF + 37} volume={0.4} />
        <Sfx name="whoosh" at={kickF + 18} volume={0.25} />
      </Stage>
    );
  }

  // ---------- Shot D: no shouting needed ----------
  if (frame < shotC2) {
    const cam = cameraAt(frame, [
      { f: shotD, x: X(0.55), y: GROUND - 64, zoom: 4.0 },
      { f: shotC2, x: X(0.62), y: GROUND - 65, zoom: 4.2 },
    ]);
    const hip = X(0.2);
    // A quiet fist pump: the near fist comes up to the chest on "No shouting needed", holds for
    // half a second, then drops back. No shout, so the mouth stays a closed smile.
    const FIST: Pose = { ...POSES.stand, torso: -3, head: -8, nearShoulder: 52, nearElbow: 92, farShoulder: -8, farElbow: 30 };
    const settle = mixPose(mixPose(POSES.strike, POSES.follow, 0.6), POSES.stand, progress(frame, shotD, 16, EASE.soft));
    const up = pop(frame, tNo - 3, { stiffness: 260, damping: 14 });
    const down = progress(frame, tNo + 14, 10, EASE.soft);
    const fistT = up * (1 - down);
    const pose = breathe(mixPose(settle, FIST, fistT), frame, 4, 1 - 0.7 * fistT);
    const J = taviJoints(pose, hip, GROUND, TAVI_H);
    const head = toScreen(cam, J.head.x, J.head.y);
    return (
      <Stage bg={PITCH.sky}>
        {sideWorld(
          cam,
          <>
            <Player x={hip} groundY={GROUND} h={TAVI_H} pose={pose} face={frame < shotD + 8 ? "focus" : "happy"} />
            {fistT > 0.4 ? <Fist x={J.nearHand.x} y={J.nearHand.y} H={TAVI_H} /> : null}
          </>,
          { pose: keeperPoseAt(frame, [[0, "stand"]]), face: "annoyed", look: -0.6 },
          "s21d",
        )}
        <EmptyBubble x={head.x + 230} y={head.y - 170} tx={head.x + 50} ty={head.y - 40} at={tNo + 4} until={tNo + 32} w={200} />
        <Sfx name="whoosh" at={tNo - 3} volume={0.2} />
        <Sfx name="pop-soft" at={tNo + 4} volume={0.4} />
      </Stage>
    );
  }

  // The long pause: a tighter goal view that holds on the swaying net while Chalk gets up.
  const holdView = (f: number) => {
    const p = progress(f, shotC2, shotE - shotC2, EASE.camera);
    return lensZoom(base, 1.3 + 0.1 * p, { x: GOAL_M, y: 1.2, z: 0.8 }, 0, 0, 0);
  };

  // ---------- Shot C2: the long pause, on the ripple ----------
  if (frame < shotE) {
    const { view, flat } = holdView(frame);
    return (
      <Stage bg={PITCH.sky}>
        {goalView(view, flat, 1)}
        <Sfx name="chalk" at={shotC2 + 26} volume={0.25} />
        <Sfx name="chalk" at={shotC2 + 56} volume={0.18} />
        <Sfx name="tick" at={shotC2 + 84} volume={0.2} />
        <Sfx name="tick" at={shotC2 + 96} volume={0.15} />
      </Stage>
    );
  }

  // ---------- Shot E1: push in on the ball in the net ----------
  if (frame < shotE2) {
    const { view: v0, flat: f0 } = holdView(shotE);
    const u = progress(frame, shotE, shotE2 - shotE, EASE.exit);
    const k = Math.exp(Math.log(5) * u);
    const ballNow = drivePos(frame - kickF);
    const { view, flat } = lensZoom(v0, k, ballNow, WIDTH / 2, HEIGHT / 2 - 20, progress(frame, shotE, shotE2 - shotE, EASE.soft));
    const combined = `${flat} ${f0}`;
    const plateO = 1 - progress(k, 1.3, 0.6, EASE.soft);
    const keeperO = 1 - progress(k, 1.15, 0.5, EASE.soft);
    return (
      <Stage bg={PITCH.skyHigh}>
        {goalView(view, combined, plateO, keeperO)}
        <Sfx name="whoosh-long" at={shotE} volume={0.3} />
      </Stage>
    );
  }

  // ---------- Shots E2 + F: the ball close-up, then the row of chalk boxes ----------
  const SLOT_X = RECAP.slotX;
  const qAt = tFloat + 6;
  const mid01 = (SLOT_X[0] + SLOT_X[1]) / 2;
  // The camera drifts along the row as each card arrives. On the fourth card it pulls back to
  // the whole row (all five boxes), and from "float" to the end it holds still, so the four
  // answers can be read together. s22 opens on the same framing, then pushes into box 5.
  const cam: Cam = cameraAt(frame, [
    { f: shotE2, x: 960, y: 540, zoom: 1.0 },
    { f: tLittle - 18, x: 960, y: 540, zoom: 1.02 },
    { f: tLittle + 12, x: SLOT_X[0], y: 540, zoom: 1.5 },
    { f: tSide - 8, x: SLOT_X[0] + 20, y: 540, zoom: 1.48 },
    { f: tSide + 20, x: mid01, y: 540, zoom: 1.36 },
    { f: tTop - 8, x: mid01 + 15, y: 540, zoom: 1.34 },
    { f: tTop + 20, x: SLOT_X[1], y: 540, zoom: 1.22 },
    { f: tBack - 8, x: SLOT_X[1] + 15, y: 540, zoom: 1.2 },
    { f: tBack + 26, x: RECAP_HOLD.x, y: RECAP_HOLD.y, zoom: RECAP_HOLD.zoom },
    { f: END, x: RECAP_HOLD.x, y: RECAP_HOLD.y, zoom: RECAP_HOLD.zoom },
  ]);

  // The big ball: grows in (matching the push), glows on "It told you everything", then shrinks into box 1.
  const grow = progress(frame, shotE2, 26, EASE.enter);
  const toBox = progress(frame, tLittle - 18, 20, EASE.standard);
  const bigR = (100 + 110 * grow) * (1 - toBox) + 64 * toBox;
  const bigX = 960 + (SLOT_X[0] - 960) * toBox;
  const bigY = 520 + (RECAP_BALL_Y - 520) * toBox + idle(frame, 1, 2.4, 6) * (1 - toBox);
  const AX_BACK = { x: 0, y: -1, z: 0 };
  // Ball 1 keeps this angle, so the hand-over from the big ball has no jump.
  const angle1 = ball1Angle(frame, rb);
  const halo = Math.max(0.35 * progress(frame, shotE2, 10) * (1 - progress(frame, tLittle - 18, 16)), progress(frame, tTold, 8, EASE.enter) * (1 - progress(frame, tTold + 14, 22, EASE.soft)));
  const netO = 1 - progress(frame, tTold + 16, 20, EASE.soft);

  const boxAt = [tLittle - 8, tSide - 4, tTop - 4, tBack - 4];
  const wordAt = [rb.tSpeed - 2, rb.tBend - 2, rb.tDive - 2, rb.tFloat - 2];
  const pulses = pulseFrames(rb);

  return (
    <Stage bg={PITCH.sky}>
      <g transform={camT(cam)}>
        <rect x={-400} y={-400} width={WIDTH + 800} height={HEIGHT + 800} fill={PITCH.sky} />
        <Stars count={RECAP.starCount} maxY={HEIGHT} seed={RECAP.starSeed} opacity={RECAP.starOpacity} />
        {/* The net behind the ball in the close-up. */}
        {netO > 0.01 ? (
          <g opacity={netO * 0.5} stroke={PITCH.chalk} strokeWidth={5} fill="none">
            {Array.from({ length: 16 }, (_, i) => {
              const o = (i - 8) * 150 + idle(frame, 2, 3, 10);
              return (
                <g key={i}>
                  <line x1={960 + o - 700} y1={-100} x2={960 + o + 700} y2={1180} />
                  <line x1={960 + o + 700} y1={-100} x2={960 + o - 700} y2={1180} />
                </g>
              );
            })}
          </g>
        ) : null}
        {halo > 0.01 ? <Glow cx={bigX} cy={bigY} r={bigR * 2.3} color={PITCH.lightSoft} intensity={halo * 1.2} rings={5} /> : null}
        {/* Cards 1-4 and the dashed box 5 with its "?". */}
        <RecapRow frame={frame} beats={rb} />
        {/* The big ball (becomes ball 1). */}
        {frame < tLittle + 4 ? (
          <>
            <Ball cx={bigX} cy={bigY} r={bigR} view={SIDE} axis={AX_BACK} angle={angle1} lineNormal={LINE_N} />
            <LineHalo cx={bigX} cy={bigY} r={bigR} view={SIDE} axis={AX_BACK} angle={angle1} lineNormal={LINE_N} amount={halo} />
          </>
        ) : null}
      </g>
      <Sfx name="bell" at={tTold} volume={0.3} />
      {wordAt.map((f, i) => (
        <Sfx key={i} name="blip" at={f} volume={0.3} />
      ))}
      {boxAt.map((f, i) => (
        <Sfx key={`b${i}`} name="chalk" at={f} volume={0.22} />
      ))}
      {pulses.map((f, i) => (
        <Sfx key={`p${i}`} name="tick" at={f} volume={0.16} />
      ))}
      <Sfx name="whoosh" at={tHardLow} volume={0.2} />
      <Sfx name="whoosh" at={tBack + 4} volume={0.18} />
      <Sfx name="pop" at={qAt} volume={0.35} />
    </Stage>
  );
};
