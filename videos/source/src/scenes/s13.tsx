// s13 Chapter 3 opens: "3 · THE VOLLEY". Three shots: Tavi shoots, Chalk punches it clear, and
// the ball drops back to Tavi, who pops it up off his thigh. Slow motion from the pop: the ball
// rises off the level thigh ("off your thigh"), and at the top the kicking leg swings down and back
// into the plant. Time slows to a near stop mid-fall on "Now hit it". A chalk arrow points from the
// ball to his laces. After "lands" (music only), 507 dots (goals) fill fast and 96 light up in
// four quick groups: about one goal in five was a volley. The dot grid runs on into s14, where it
// dissolves into dust that falls with the ball.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../kit/Camera";
import { Dust } from "../kit/World";
import { Player, cyclePose, mixPose, poseAt, solve, type Pose } from "../kit/Player";
import { Keeper, keeperPoseAt, type KeeperPose } from "../kit/Keeper";
import { Ball } from "../kit/Ball";
import { GoalSide } from "../kit/Goal";
import { Arrow, ChapterCard } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { simulate, sampleAt } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, clamp01, idle, lerp, progress } from "../lib/anim";
import { pathD, project } from "../lib/project";
import { PITCH } from "../theme";
import {
  BALL_R,
  CHALK_H,
  SwapTag,
  DROP,
  DROP_X_M,
  FREEZE_CAM,
  GOAL_M,
  GROUND,
  PLANT_HIP_M,
  PPM,
  PUNCH_N,
  PitchBackdrop,
  S13_END_CAM,
  SIDE,
  TAVI_H,
  THIGH_BALL_Z,
  THIGH_HIP_M,
  VPOSE,
  X,
  Z,
  hipY,
  keeperGlove,
  s13Timing,
  toScreen,
  volleyAt,
  type Cam,
} from "../kit/ext/s13-s15-volley";
import { REPLAY_CROSS, VolleyDots, litGroupAt } from "../kit/ext/s13-s15-dots";

const SHOT = simulate({ ...SHOTS.MISS_NOSPIN, duration: 2 }, 30); // Tavi's shot (Chalk punches it)
const G = 9.81;
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };

const PUNCH_POSE: KeeperPose = { left: 25, right: 100, lean: 0, shift: 0, lift: 0.02, stretch: 1.05 };
const PUNCH_FOLLOW: KeeperPose = { left: 22, right: 150, lean: -6, shift: -0.03, lift: 0.04, stretch: 1.06 };

/** DROP samples after the top over which the kicking leg swings down from the thigh into the plant. */
const D_DOWN = 5;
/** Standing (far) foot x relative to the hip, in pixels. */
const farFootX = (p: Pose) => {
  const j = solve(p, TAVI_H);
  return (j.fa.x + j.fToe.x) / 2;
};
/** Hip (m) that keeps the standing foot where it was in the thigh lift. */
const keepFootHip = (p: Pose) => THIGH_HIP_M + (farFootX(VPOSE.thighWatch) - farFootX(p)) / PPM;

export const S13: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s13");

  // ---------- Beats ----------
  const tProblem = cue("Problem three");
  const tNow = cue("Now hit it");
  const end = cue.frames;

  const tm = s13Timing(cue);
  const { punch, kick, thighF, popV, peakF, slowFrom, freezeFrom, W, dots: dt } = tm;
  const runStart = kick - 22;
  const cardUntil = tProblem + 24;
  const cutB = kick + 15; // shot B: Chalk (the ball is leaving shot A on the right)
  const cutC = punch + 27; // shot C: Tavi (the punched ball drops in from the top right)

  // ---------- Ball path pieces ----------
  const P = SHOT[PUNCH_N].pos; // punch point (m)
  const glove = keeperGlove(PUNCH_POSE, CHALK_H);
  const chalkX = X(P.x) - glove.x; // Chalk stands so his glove meets the ball
  const Ts = (thighF - punch) / 30;
  const vx = (DROP_X_M - P.x) / Ts;
  const vz = (THIGH_BALL_Z - P.z + 0.5 * G * Ts * Ts) / Ts;
  const arcAt = (f: number) => {
    const t = f / 30;
    return { x: P.x + vx * t, z: P.z + vz * t - 0.5 * G * t * t };
  };
  const wf = W(frame); // warped frame: time slows to a near stop after the thigh pop
  const d = wf - peakF; // DROP samples since the top

  let ball = { x: 0, z: 0.11 };
  let spinAngle = 0;
  let squash = 1;
  if (frame >= kick && frame < punch) {
    const s = sampleAt(SHOT, frame - kick);
    ball = { x: s.pos.x, z: s.pos.z };
  } else if (frame >= punch && frame < thighF) {
    ball = arcAt(frame - punch);
    spinAngle = -((frame - punch) / 30) * 2 * Math.PI * 1.5;
  } else if (frame >= thighF && d < 0) {
    const t = (wf - thighF) / 30;
    ball = { x: DROP_X_M, z: THIGH_BALL_Z + popV * t - 0.5 * G * t * t };
    spinAngle = -3 - t * 2;
    squash = 1 - 0.12 * Math.max(0, 1 - (frame - thighF) / 3);
  } else if (d >= 0) {
    ball = { x: DROP_X_M, z: sampleAt(DROP, d).pos.z };
    spinAngle = -3.6 - d * 0.05;
  }
  const shotTrail = frame >= kick ? SHOT.slice(0, Math.min(PUNCH_N, frame - kick) + 1).map((s) => project(s.pos, SIDE)) : [];
  const arcTrail: { x: number; y: number }[] = [];
  if (frame >= punch) {
    const upto = Math.min(frame, thighF) - punch;
    for (let f = 0; f <= upto; f += 1) {
      const a = arcAt(f);
      arcTrail.push({ x: X(a.x), y: Z(a.z) });
    }
  }
  const trailFade = 1 - progress(frame, thighF - 4, 12);

  // ---------- Camera: three shots, cut on the ball's exits ----------
  let keysC: CamKey[];
  if (frame < cutB) {
    keysC = [
      { f: 0, x: X(2.2), y: GROUND - 196, zoom: 2.3 },
      { f: cutB, x: X(3.4), y: GROUND - 196, zoom: 2.34 },
    ];
  } else if (frame < cutC) {
    keysC = [
      { f: cutB, x: X(12.6), y: GROUND - 172, zoom: 2.4 },
      { f: cutC, x: X(11.5), y: GROUND - 188, zoom: 2.36 },
    ];
  } else {
    keysC = [
      { f: cutC, x: X(DROP_X_M + 1.7), y: Z(1.55), zoom: 3.3 },
      { f: thighF + 4, x: X(DROP_X_M + 1.95), y: Z(1.4), zoom: 3.5 },
      { f: tNow - 8, x: FREEZE_CAM.x, y: FREEZE_CAM.y, zoom: FREEZE_CAM.zoom },
      { f: end, x: S13_END_CAM.x, y: S13_END_CAM.y, zoom: S13_END_CAM.zoom },
    ];
  }
  const c = cameraAt(frame, keysC);
  const cam: Cam = { x: c.x, y: c.y, zoom: c.zoom };

  // ---------- Tavi ----------
  const strikeHip = -0.55;
  let hipM = frame < runStart ? -3.1 : lerp(-3.1, strikeHip, progress(frame, runStart, kick - runStart - 3, EASE.soft));
  if (frame >= kick + 10) hipM = lerp(strikeHip, THIGH_HIP_M, progress(frame, kick + 18, cutC - kick - 14, EASE.standard));
  let pose: Pose;
  if (frame < thighF - 14) {
    pose = poseAt(frame, [
      [runStart, "ready"],
      [runStart + 6, cyclePose(6, "run", 7)],
      [runStart + 12, cyclePose(12, "run", 7)],
      [kick - 6, "plant"],
      [kick, "strike"],
      [kick + 12, "follow"],
      [kick + 24, "stand"],
      [punch + 4, VPOSE.lookUp],
      [thighF - 14, VPOSE.lookUp],
    ]);
    if (frame < runStart) pose = { ...pose, torso: pose.torso + idle(frame, 2, 2.4, 1.2) };
    if (frame >= kick + 18 && frame < cutC + 6) {
      // A couple of small steps while watching the ball.
      const w = cyclePose(frame - kick, "walk", 8);
      pose = mixPose(pose, { ...w, head: pose.head, torso: pose.torso }, 0.45 * Math.sin(Math.PI * clamp01((frame - kick - 18) / (cutC - kick - 12))));
    }
  } else if (d < 0) {
    // Thigh lift: the pop, then the thigh stays level under the ball while it rises (slow motion),
    // standing leg straight, eyes up on the ball.
    hipM = THIGH_HIP_M;
    pose = poseAt(wf, [
      [thighF - 14, VPOSE.lookUp],
      [thighF - 2, VPOSE.thigh],
      [thighF + 3, VPOSE.thighUp],
      [thighF + 9, VPOSE.thighWatch],
    ]);
  } else if (d < D_DOWN) {
    // After the top: the kicking leg swings down and back into the plant. The standing foot stays put.
    const u = d / D_DOWN;
    const e = u * u * (3 - 2 * u);
    pose = mixPose(VPOSE.thighWatch, VPOSE.plant, e);
    hipM = keepFootHip(pose) + (PLANT_HIP_M - keepFootHip(VPOSE.plant)) * e;
  } else {
    // Planted, kicking leg drawn back (s14 carries on from here).
    const v = volleyAt(d, 1);
    hipM = v.hip;
    pose = v.pose;
  }
  // Breathing runs in warped time, so it freezes with the ball (s14 continues this phase).
  pose = { ...pose, torso: pose.torso + (frame >= thighF ? idle(wf, 1, 3, 1.2) : 0) };
  const face = frame >= runStart && frame < kick + 6 ? "focus" : frame >= thighF - 14 ? "focus" : "neutral";

  // ---------- Chalk ----------
  const kPose = keeperPoseAt(frame, [
    [kick, "stand"],
    [kick + 10, "ready"],
    [punch - 5, "ready"],
    [punch - 1, PUNCH_POSE],
    [punch + 7, PUNCH_FOLLOW],
    [punch + 24, "stand"],
  ]);
  const kFace = frame >= punch - 2 ? "smug" : "flat";
  const kLook = frame > punch ? -0.7 : idle(frame, 2, 3, 0.3);

  // ---------- The chalk arrow: from the ball to Tavi's laces ----------
  const tavX = X(hipM);
  const j = solve(pose, TAVI_H);
  const hy = hipY(pose, TAVI_H, GROUND);
  const lacesW = { x: tavX + j.na.x + (j.nToe.x - j.na.x) * 0.5, y: hy + j.na.y + (j.nToe.y - j.na.y) * 0.5 };
  const ballS = toScreen(cam, { x: X(ball.x), y: Z(ball.z) });
  const lacesS = toScreen(cam, lacesW);
  const rS = BALL_R * 1.08 * cam.zoom;
  const ad = { x: lacesS.x - ballS.x, y: lacesS.y - ballS.y };
  const al = Math.hypot(ad.x, ad.y) || 1;
  const arrowA = { x: ballS.x + (ad.x / al) * (rS + 16), y: ballS.y + (ad.y / al) * (rS + 16) };
  const arrowB = { x: lacesS.x - (ad.x / al) * 26, y: lacesS.y - (ad.y / al) * 26 };

  return (
    <Stage bg={PITCH.sky}>
      <PitchBackdrop cam={cam} seed="s13">
        <GoalSide view={SIDE} goalX={GOAL_M} />
        <Keeper x={chalkX} groundY={GROUND} h={CHALK_H} pose={kPose} face={kFace} look={kLook} />
        <Dust x={X(P.x)} y={Z(P.z)} at={punch} size={26} seed="s13-punch" />
        <Player x={tavX} groundY={GROUND} h={TAVI_H} pose={pose} face={face} />
        {/* Ball trails */}
        {frame >= kick && frame < thighF + 12 ? (
          <g opacity={trailFade}>
            {shotTrail.length > 1 ? (
              <path d={pathD(shotTrail)} fill="none" stroke={PITCH.lightSoft} strokeWidth={2.6} strokeLinecap="round" opacity={0.5 * (1 - progress(frame, punch, 14))} />
            ) : null}
            {arcTrail.length > 1 ? <path d={pathD(arcTrail)} fill="none" stroke={PITCH.lightSoft} strokeWidth={2.4} strokeLinecap="round" opacity={0.45} /> : null}
          </g>
        ) : null}
        <Ball cx={X(ball.x)} cy={Z(ball.z)} r={BALL_R * 1.08} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={spinAngle} lineNormal={LINE_N} squash={squash} />
      </PitchBackdrop>

      <Arrow x1={arrowA.x} y1={arrowA.y} x2={arrowB.x} y2={arrowB.y} at={tNow - 2} dur={14} color={PITCH.chalk} width={9} curve={0.62} />

      {/* The dot grid over the frozen frame (continues into s14). */}
      <VolleyDots f={frame} offset={0} t={dt} />

      <ChapterCard number={3} title="THE VOLLEY" subtitle="forward spin" at={0} until={cardUntil} />

      {/* Slow motion from the thigh pop (the tag runs on into s14). */}
      <SwapTag steps={[{ at: slowFrom + 4, label: "SLOW MOTION" }]} until={end + 600} />

      {/* SFX */}
      <Sfx name="chalk" at={0} volume={0.45} />
      <Sfx name="chalk" at={10} volume={0.35} />
      <Sfx name="thump" at={kick} volume={0.5} />
      <Sfx name="whoosh" at={kick + 1} volume={0.35} />
      <Sfx name="thump" at={punch} volume={0.6} />
      <Sfx name="pop" at={punch + 1} volume={0.3} />
      <Sfx name="whoosh-long" at={punch + 2} volume={0.3} />
      <Sfx name="pop-soft" at={thighF} volume={0.5} />
      <Sfx name="air" at={thighF + 1} volume={0.3} />
      <Sfx name="whoosh-long" at={slowFrom} volume={0.28} />
      <Sfx name="subdrop" at={freezeFrom} volume={0.45} />
      <Sfx name="chalk" at={tNow} volume={0.35} />
      <Sfx name="whoosh" at={dt.fillStart} volume={0.16} />
      {litGroupAt(dt).map((at, i) => (
        <Sfx key={i} name="tick" at={at} volume={0.3 + i * 0.07} />
      ))}
      <Sfx name="bell" at={dt.labelAt} volume={0.35} />
      <Sfx name="pop" at={dt.heroAt} volume={0.3} />
      {dt.replayAt + REPLAY_CROSS < end ? <Sfx name="net" at={dt.replayAt + REPLAY_CROSS} volume={0.22} /> : null}
    </Stage>
  );
};
