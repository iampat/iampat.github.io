// b19 Ending: the first pass again. It opens on the wide side view of the cold open: Sam left, Tavi on
// her mark with her back to the goal, Chalk 11 m to the right. The pass leaves in slow motion and we cut
// to a two-shot of Tavi and Chalk for her first look (a chalk look line from her eyes, a snapshot with a
// look timer, the live distance tag). Wide again for "Don't wait. Go to the ball": she leaves her mark at
// 0.2 s and jogs to the ball (a plan inset shows the half-turn). The two-shot again for the second look
// on "Halfway: look again", then wide for "Still far": the ring rides with her at about 2.4 s, lime, the
// map in her head holds Chalk and the space, and a lime eye locks on the ball. The last frame is the
// handoff to b20 (B19_HANDOFF). PASS_IN, CHALK_CHASE and ENDING_RUN from src/physics/ep2sims.ts.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../../kit/Camera";
import { CarPark, Dust, GroundSide } from "../../kit/World";
import { Player, POSES, SAM_COLORS, cyclePose, mixPose, poseAt, type Pose } from "../../kit/Player";
import { Keeper, KPOSES, type KeeperPose } from "../../kit/Keeper";
import { Ball } from "../../kit/Ball";
import { GoalSide } from "../../kit/Goal";
import { SlowMoTag } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { TimeBubble } from "../../kit/TimeBubble";
import { Snapshot, ThoughtBubble } from "../../kit/Snapshot";
import { CHALK_START, ENDING_RUN, SAM, chalkAt, endingMeet, passInAt, passInPath, ringSeconds } from "../../physics/ep2sims";
import { sampleAt } from "../../physics/sim";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, progress } from "../../lib/anim";
import { project, type View } from "../../lib/project";
import { PITCH } from "../../theme";
import { NightBackdrop, breathe, camT, playerAnchors, toScreen } from "../../kit/ext/ep2-b18-b19-world";
import { B19_HANDOFF, ChalkPhoto, DistanceTag, EyeLock, LookLine, LookTimer, PlanInset, SecondsPill, ThoughtMap, frameOf, simTime, type TimeKey } from "../../kit/ext/ep2-b18-b19-hud";

const PPM = 50;
const OX = 960; // world x of Tavi's mark
const GROUND = 820;
const GOAL_M = 18;
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const TAVI_H = 1.62 * PPM;
const CHALK_H = 2.1 * PPM;
const BALL_R = 0.11 * PPM;
const SAM_HIP_M = SAM.x - 0.4; // his hips sit behind the ball, so the inside foot meets it at x = -12
const ROLL_AXIS = { x: 0, y: -1, z: 0 }; // a ball rolling towards +x turns about -y
const STRIDE_S = 0.32; // Chalk's jog stride in sim seconds

const PASS = passInPath();
const MEET = endingMeet();
const MEET_V = { x: MEET.x, y: MEET.y, z: 0 };

// The two scans in sim time. The second one ends 0.38 s before contact, more than the third of a
// second she needs to notice (b05), so the ending keeps its own lesson.
const SCAN1 = { out: 0.1, back: 0.5 };
const SCAN2 = { out: 0.66, back: 0.96 };

// Sam's pass (side view, facing right): a backswing, the inside-foot contact and the follow.
const SAM_BACK: Pose = { torso: 8, head: 8, nearHip: -30, nearKnee: 40, nearAnkle: 110, farHip: 6, farKnee: 18, farAnkle: 92, nearShoulder: 22, nearElbow: 20, farShoulder: -30, farElbow: 30 };
const SAM_FOLLOW: Pose = { torso: 6, head: 6, nearHip: 42, nearKnee: 8, nearAnkle: 100, farHip: 4, farKnee: 16, farAnkle: 92, nearShoulder: -24, nearElbow: 25, farShoulder: 36, farElbow: 25, lift: 0.01 };
const SAM_DOWN: Pose = { ...POSES.stand, head: 14 };

/** Pose at sim time T from [time, pose] keys, smoothstep between keys. */
const poseAtT = (T: number, track: [number, Pose][]): Pose => {
  if (T <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    if (T <= track[i][0]) {
      const [t0, p0] = track[i - 1];
      const [t1, p1] = track[i];
      const u = (T - t0) / Math.max(1e-6, t1 - t0);
      return mixPose(p0, p1, u * u * (3 - 2 * u));
    }
  }
  return track[track.length - 1][1];
};

const mixKeeper = (a: KeeperPose, b: KeeperPose, u: number): KeeperPose => {
  const s = clamp01(u);
  const k = s * s * (3 - 2 * s);
  return { left: lerp(a.left, b.left, k), right: lerp(a.right, b.right, k), lean: lerp(a.lean, b.lean, k), shift: lerp(a.shift, b.shift, k), lift: lerp(a.lift, b.lift, k), stretch: lerp(a.stretch, b.stretch, k) };
};
const runCycle = (phase: number): KeeperPose => mixKeeper(KPOSES.runA, KPOSES.runB, 0.5 + 0.5 * Math.sin(phase * Math.PI * 2));

/** Chalk's spot at sim time t, and his distance to Tavi in ring seconds. */
const chalkAndRing = (t: number, taviX: number, taviY: number) => {
  const c = t <= 0 ? { x: CHALK_START.x, y: CHALK_START.y } : chalkAt(t, MEET_V);
  return { c, secs: ringSeconds(c.x, c.y, taviX, taviY) };
};
const taviAt = (t: number) => ({
  x: t < ENDING_RUN.leaveAt ? 0 : -(t - ENDING_RUN.leaveAt) * ENDING_RUN.speed,
  y: ENDING_RUN.y * clamp01((t - ENDING_RUN.leaveAt) / 0.5),
});

export const B19: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b19");

  // ---------- Beats ----------
  const tAgain = cue("again");
  const tLeaves = cue("It leaves Sam's foot");
  const tLook = cue("look");
  const tTen = cue("about ten metres out");
  const tDont = cue("Don't wait");
  const tGo = cue("Go to the ball");
  const tOpening = cue("opening side-on");
  const tHalfway = cue("Halfway");
  const tLookAgain = cue("look again");
  const tStill = cue("Still far");
  const END = cue.frames;

  // The kick, then slow motion: the two scans and the run to the ball stretch over the narration.
  const kick = tLeaves + 24;
  const fScan1Out = kick + 12;
  const fScan1Back = tDont + 8; // eyes back on the ball as "Don't wait" is said
  const fScan2Out = tHalfway + 5;
  const fScan2Back = tLookAgain + 30;
  const TIME: TimeKey[] = [
    [kick, 0],
    [fScan1Out, SCAN1.out],
    [fScan1Back, SCAN1.back],
    [fScan2Out, SCAN2.out],
    [fScan2Back, SCAN2.back],
    [END, B19_HANDOFF.simTimeAtEnd],
  ];
  const t = frame < kick ? 0 : simTime(frame, TIME);
  const fLeave = Math.round(frameOf(ENDING_RUN.leaveAt, TIME));
  const scan1 = progress(frame, fScan1Out, 12, EASE.standard) * (1 - progress(frame, fScan1Back - 12, 12, EASE.standard));
  const scan2 = progress(frame, fScan2Out, 12, EASE.standard) * (1 - progress(frame, fScan2Back - 12, 12, EASE.standard));
  const headTurn = Math.max(scan1, scan2);

  // ---------- Tavi: ENDING_RUN ----------
  const tv = taviAt(t);
  const taviM = tv.x;
  const taviY = tv.y;
  const taviX = X(taviM);
  const twist = clamp01((t - 0.95) / (MEET.t - 0.95)); // the hips open in the last two strides
  let pose: Pose;
  if (frame < kick) {
    pose = breathe(POSES.receiveReady, frame, 1);
  } else {
    const lean = clamp01((t - 0.14) / 0.16);
    const run = cyclePose(Math.max(0, t - ENDING_RUN.leaveAt) * 30 + 2, "run", 5);
    pose = mixPose(breathe(POSES.receiveReady, frame, 1, 0.5), run, lean * lean * (3 - 2 * lean));
    pose = { ...pose, head: pose.head - 6 * headTurn, nearShoulder: pose.nearShoulder + 18 * twist, farShoulder: pose.farShoulder - 18 * twist };
  }
  const anchors = playerAnchors(pose, taviX, GROUND, TAVI_H, true);

  // ---------- Chalk: CHALK_CHASE towards the meeting point ----------
  const { c: chalk, secs } = chalkAndRing(t, taviM, taviY);
  const chalkX = X(chalk.x);
  let kPose: KeeperPose;
  if (frame < kick) {
    // He shifts his weight as Sam shapes to pass.
    const w = Math.sin(clamp01((frame - (tAgain + 16)) / Math.max(1, kick - tAgain - 16)) * Math.PI);
    kPose = { ...KPOSES.stand, lean: -5 * w + idle(frame, 6, 3.1, 1), shift: -0.03 * w, stretch: 1 + idle(frame, 5, 2.6, 0.008) };
  } else {
    kPose = mixKeeper(KPOSES.stand, runCycle(t / STRIDE_S), t / 0.12);
  }
  const stepFrames = [1, 2, 3].map((k) => Math.round(frameOf(k * STRIDE_S, TIME)));

  // ---------- Sam: the pass ----------
  const samX = X(SAM_HIP_M);
  const samPose =
    frame < kick
      ? frame < tAgain + 10
        ? breathe(SAM_DOWN, frame, 2)
        : poseAt(frame, [
            [tAgain + 10, SAM_DOWN],
            [tAgain + 30, { ...POSES.stand, head: 3 }],
            [kick - 36, POSES.ready],
            [kick - 12, SAM_BACK],
            [kick, POSES.passInside],
          ])
      : poseAtT(t, [
          [0, POSES.passInside],
          [0.25, SAM_FOLLOW],
          [0.6, SAM_FOLLOW],
          [1.1, POSES.stand],
        ]);

  // ---------- The ball: PASS_IN ----------
  const ballPos = frame < kick ? { x: SAM.x, y: 0, z: 0.11 } : sampleAt(PASS, t * 30).pos;
  const ballW = project(ballPos, SIDE);
  const ballAngle = (ballPos.x - SAM.x) / 0.11;

  // ---------- Camera: wide for the pass, a two-shot for each look, wide for the run and the handoff ----------
  const cutLook1 = kick + 8;
  const cutRun = tDont;
  const cutLook2 = fScan2Out - 2;
  const cutEnd = fScan2Back + 8;
  const H = B19_HANDOFF.camera;
  const shots: CamKey[][] = [
    [
      // The exact wide framing of the first pass in b01 (its "pass comes" key); Sam and Chalk both in frame.
      { f: 0, x: X(-0.4), y: GROUND - 105, zoom: 1.42 },
      { f: tAgain + 10, x: X(-0.45), y: GROUND - 114, zoom: 1.44 },
      { f: cutLook1, x: X(-0.5), y: GROUND - 124, zoom: 1.45 },
    ],
    [
      // Two-shot for the first look: Tavi left, Chalk right, ten metres apart.
      { f: cutLook1, x: X(4.75), y: GROUND - 140, zoom: 2.5 },
      { f: cutRun, x: X(3.95), y: GROUND - 138, zoom: 2.6 },
    ],
    [
      // Wide: the ball on its way, the run to it.
      { f: cutRun, x: X(-1.1), y: GROUND - 128, zoom: 1.6 },
      { f: cutLook2, x: X(-1.25), y: GROUND - 127, zoom: 1.66 },
    ],
    [
      // Two-shot for the second look.
      { f: cutLook2, x: X(3.3), y: GROUND - 140, zoom: 2.5 },
      { f: cutEnd, x: X(2.1), y: GROUND - 138, zoom: 2.6 },
    ],
    [
      // Wide again, easing onto the handoff framing that b20 starts on.
      { f: cutEnd, x: X(-2.0), y: GROUND - 116, zoom: 1.8 },
      { f: END, x: X(H.xMetres), y: GROUND - H.yAboveGround, zoom: H.zoom },
    ],
  ];
  const shot = frame < cutLook1 ? 0 : frame < cutRun ? 1 : frame < cutLook2 ? 2 : frame < cutEnd ? 3 : 4;
  const cam = cameraAt(frame, shots[shot]);
  const headS = toScreen(cam, anchors.head.x, anchors.head.y);
  const chalkS = toScreen(cam, chalkX, GROUND - CHALK_H * 0.9);
  const chalkHeadS = toScreen(cam, chalkX, GROUND - CHALK_H * 0.82);
  const ballS = toScreen(cam, ballW.x, ballW.y);

  // The map in her head after the second look.
  const known = { tavi: taviAt(SCAN2.back), chalk: chalkAt(SCAN2.back, MEET_V), ball: { x: passInAt(SCAN2.back).x, y: 0 }, space: { x: -3.6, y: 3.0 } };

  // Thought bubble geometry (inner box for the map).
  const TB_W = 480;
  const TB_H = 320;
  const bumpR = Math.min(TB_W, TB_H) * 0.22;
  const tbX = Math.max(TB_W / 2 + 40, Math.min(1920 - TB_W / 2 - 40, headS.x + 300));
  const tbY = Math.max(TB_H / 2 + 50, headS.y - 350);

  return (
    <Stage bg={PITCH.sky}>
      <NightBackdrop cam={cam} ground={GROUND} refX={X(0)} seed="b19" clockHours={21.33} />
      <g transform={camT(cam)}>
        <GroundSide groundY={GROUND} vanishX={X(8)} />
        <CarPark x0={X(GOAL_M + 3)} groundY={GROUND} ppm={PPM} />
        <GoalSide view={SIDE} goalX={GOAL_M} />
        {/* A faint chalk mark where she starts (her spot from the cold open). */}
        <ellipse cx={X(0)} cy={GROUND + 3} rx={11} ry={2.5} fill={PITCH.chalk} opacity={0.3} />
        {stepFrames.map((f, i) => (
          <Dust key={i} x={X(chalkAt(i * STRIDE_S + STRIDE_S, MEET_V).x)} y={GROUND} at={f} size={22} seed={`cstep${i}`} />
        ))}
        <Dust x={X(0)} y={GROUND} at={fLeave} size={18} seed="leave" />
        <Keeper x={chalkX} groundY={GROUND} h={CHALK_H} pose={kPose} face="flat" look={0.8} flip />
        <Player x={samX} groundY={GROUND} h={TAVI_H} pose={samPose} colors={SAM_COLORS} face="neutral" />
        {/* The time bubble rides with her: Chalk's distance over his 4 m/s. */}
        <TimeBubble x={taviX} y={GROUND} seconds={secs} pxPerSecond={40} minRadius={20} squash={0.3} showNumber={false} at={kick} />
        <g transform={`translate(${taviX} 0) scale(${1 - 0.28 * twist} 1) translate(${-taviX} 0)`}>
          <Player x={taviX} groundY={GROUND} h={TAVI_H} pose={pose} face="focus" flip headTurn={headTurn} />
        </g>
        <Ball cx={ballW.x} cy={ballW.y} r={BALL_R} view={SIDE} axis={ROLL_AXIS} angle={ballAngle} />
      </g>

      {/* HUD */}
      {/* Where her eyes go on each scan: over her shoulder, at Chalk. */}
      <LookLine x1={headS.x + 10} y1={headS.y - 4} x2={chalkHeadS.x} y2={chalkHeadS.y} k={headTurn} />
      <SlowMoTag at={kick + 3} until={END + 20} />
      <SecondsPill x={headS.x} y={headS.y - anchors.headR * cam.zoom - 50} seconds={secs} at={kick + 2} />
      <Snapshot x={1560} y={250} w={300} h={200} at={tLook + 2} until={fScan1Back + 6} tilt={-6}>
        <ChalkPhoto w={300} h={200} phase={t / STRIDE_S} />
      </Snapshot>
      <LookTimer x={1090} y={250} secs={Math.max(0, Math.min(t, SCAN1.back) - SCAN1.out)} total={SCAN1.back - SCAN1.out} at={tLook + 4} until={fScan1Back + 6} />
      {/* The live distance, so it always agrees with the ring: metres / 4 = seconds. */}
      <DistanceTag x={1560} y={472} metres={secs * 4} caption="TO CHALK" at={tTen} until={fScan1Back + 6} tx={chalkS.x} ty={chalkS.y} />
      <PlanInset x={1570} y={252} w={620} h={350} at={tGo + 4} until={tHalfway - 6} progress={progress(frame, tGo + 8, tHalfway - 22 - tGo, (u) => u)} />
      <Snapshot x={1560} y={250} w={300} h={200} at={tLookAgain} until={fScan2Back + 6} tilt={5}>
        <ChalkPhoto w={300} h={200} phase={t / STRIDE_S} closeness={0.2} />
      </Snapshot>
      <LookTimer x={1090} y={250} secs={Math.max(0, Math.min(t, SCAN2.back) - SCAN2.out)} total={SCAN2.back - SCAN2.out} at={tLookAgain + 2} until={fScan2Back + 6} />
      <ThoughtBubble x={tbX} y={tbY} w={TB_W} h={TB_H} hx={headS.x + 20} hy={headS.y - 30} at={tLookAgain + 24} until={END - 14}>
        <ThoughtMap w={TB_W - bumpR} h={TB_H - bumpR} dotAt={tLookAgain + 30} spaceAt={tLookAgain + 38} tavi={known.tavi} chalk={known.chalk} ball={known.ball} space={known.space} />
      </ThoughtBubble>
      <EyeLock x={ballS.x - 70} y={ballS.y - 175} bx={ballS.x} by={ballS.y} br={BALL_R * cam.zoom} at={tStill + 4} />

      {/* SFX */}
      <Sfx name="tick" at={30} volume={0.2} />
      <Sfx name="air" at={kick - 10} volume={0.25} />
      <Sfx name="thump" at={kick} volume={0.5} />
      <Sfx name="subdrop" at={kick + 2} volume={0.35} />
      <Sfx name="bell" at={kick + 3} volume={0.35} />
      <Sfx name="tick" at={fScan1Out} volume={0.35} />
      <Sfx name="pop-soft" at={tLook + 2} volume={0.35} />
      <Sfx name="tick" at={tTen} volume={0.3} />
      <Sfx name="thump" at={fLeave} volume={0.2} />
      <Sfx name="whoosh" at={tGo + 4} volume={0.2} />
      <Sfx name="air" at={tOpening + 20} volume={0.2} />
      <Sfx name="tick" at={fScan2Out} volume={0.3} />
      <Sfx name="tick" at={tLookAgain} volume={0.35} />
      <Sfx name="pop-soft" at={tLookAgain + 1} volume={0.35} />
      <Sfx name="pop-soft" at={tLookAgain + 30} volume={0.3} />
      <Sfx name="pop-soft" at={tLookAgain + 38} volume={0.3} />
      <Sfx name="bell" at={tStill} volume={0.25} />
      <Sfx name="tick" at={tStill + 4} volume={0.3} />
    </Stage>
  );
};
