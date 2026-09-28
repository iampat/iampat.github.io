// s03 Chapter 1 opens: the title slides back into the pitch markings, the chapter card,
// Chalk stands big in the goal, two low corners he can't reach, then the weird fact
// in slow motion: after a clean strike the ball flies faster than the foot.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { Ball } from "../kit/Ball";
import { Flight } from "../kit/Flight";
import { Player, POSES, cyclePose, mixPose, type Pose } from "../kit/Player";
import { Keeper, keeperPoseAt, type KeeperPose } from "../kit/Keeper";
import { GoalFront } from "../kit/Goal";
import { Dust, Glow } from "../kit/World";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { len, simulate, sampleAt, type Vec3 } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, clamp01, idle, pop, progress } from "../lib/anim";
import { project } from "../lib/project";
import { PITCH, WIDTH } from "../theme";
import { GOAL_X, PerspPitch, PerspSky, orbitAt, orbitView, polyD, type Orbit, type PView } from "../kit/ext/s02-s03-persp";
import { ChalkMark, ChalkTitle, ChapterWrite, SlowTag, SpeedBars } from "../kit/ext/s02-s03-hud";
import { BALL_R, GROUND, PPM, SIDE, SideWorld, X, hipForContact, lacesAt, sideCamAt, snapCue, toScreen, type SideKey } from "../kit/ext/s02-s03-side";

const DRIVE = simulate({ ...SHOTS.DRIVE_R, duration: 1.6 }, 30);
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const REST = { x: X(0), y: GROUND - BALL_R };
const STRIKE: Pose = POSES.strike;
const FIT = hipForContact(STRIKE, REST.x, REST.y);
/** Bar scale: full bar = 23.6 m/s. Ball leaves at 21.7 m/s; the foot centre moves about 1.3 times slower. */
const BAR = 23.6;
const FOOT_AT_CONTACT = 21.7 / 1.3;
/** "How?": Tavi lifts his kicking boot and looks down at it (the camera then pushes in towards it, into the s04 X-ray). */
const LOOK: Pose = { torso: 18, head: 42, nearHip: 74, nearKnee: 64, nearAnkle: 98, farHip: -6, farKnee: 10, farAnkle: 90, nearShoulder: -24, nearElbow: 30, farShoulder: 34, farElbow: 40 };
const easeIn = (t: number) => t * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

export const S03: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s03");
  // s02 ends on the finished title; s03 continues its clock so the letters do not jump at the cut.
  const s02Frames = useCues("s02").frames;
  // Beats. snapCue: audible onsets measured in vo/s03.wav where the word timing starts early.
  const tProblem = cue("Problem one");
  const tChalk = snapCue(cue("Chalk can't reach"), 67);
  const tReach = cue("can't reach");
  const tLow = cue("Low and hard");
  const tHard = cue("hard");
  const tWeird = cue("Weird fact");
  const tStrike = snapCue(cue("after a clean strike"), 208);
  const tHow = snapCue(cue("How"), 329);
  const END = cue.frames;
  const cutSide = tWeird - 4;

  // ---------------- Shot A: from the title (top-down) down to Chalk in his goal. ----------------
  if (frame < cutSide) {
    const TOP_O = { tx: 9.75, ty: 0, tz: 0, dist: 33, yaw: 0, pitch: 89.5, focal: 1250 };
    const GOAL_O = { tx: GOAL_X, ty: 0, tz: 1.5, dist: 8.9, yaw: 0, pitch: 1, focal: 1250 };
    const orbit: Orbit[] = [
      { f: 6, ...TOP_O },
      { f: tChalk + 2, ...GOAL_O },
      { f: cutSide, ...GOAL_O, dist: 8.2, yaw: -1.5 },
    ];
    const view = orbitView(orbitAt(frame, orbit));
    const titleOut = progress(frame, 6, 8, EASE.exit);
    const slide = 1 - progress(frame, 8, 16, EASE.standard);
    const cardAt = tProblem - 4;
    const cardUntil = tChalk;
    const riseAt = tChalk + 4;
    const rise = progress(frame, riseAt, 22, EASE.standard);
    const wideAt = Math.max(tReach + 4, riseAt + 16);
    const kp = project({ x: GOAL_X, y: 0, z: 0 }, view);
    const kPose = keeperPoseAt(frame, [
      [riseAt, "stand"],
      [wideAt - 4, "stand"],
      [wideAt + 6, "wide"],
    ]);
    const bubbleAt = wideAt + 6;
    // Both low corners pop on "Low" and hold until the cut. On "hard" they punch once.
    const boxes = [tLow, tLow + 4];
    const boxC = project({ x: 9.75, y: 0, z: 0 }, view);
    const spot = project({ x: 0, y: 0, z: 0.11 }, view); // the ball still sits on the spot (as at the end of s02)
    return (
      <Stage bg={PITCH.skyHigh}>
        <PerspSky view={view} seed="s03a" />
        <PerspPitch view={view} slide={slide} />
        <GoalFront view={view} goalX={GOAL_X} />
        {spot.depth > 0.3 && spot.x > -100 && spot.x < WIDTH + 100 && spot.y < 1180 ? (
          <Ball cx={spot.x} cy={spot.y} r={Math.max(2, 0.11 * spot.scale)} view={view} lineNormal={LINE_N} />
        ) : null}
        <ReachBubble view={view} at={bubbleAt} frame={frame} />
        {kp.scale > 0 ? (
          <Keeper
            x={kp.x}
            groundY={kp.y}
            h={2.1 * kp.scale}
            pose={{ ...kPose, left: kPose.left + idle(frame, 1, 2.4, 3), right: kPose.right + idle(frame, 2, 2.4, 3) }}
            face={frame >= wideAt ? "smug" : "flat"}
            look={idle(frame, 3, 3.2, 0.35)}
            rise={rise}
          />
        ) : null}
        <Dust x={kp.x} y={kp.y} at={riseAt} size={1.6 * kp.scale} seed="s03rise" />
        <Dust x={kp.x} y={kp.y - 1.4 * kp.scale} at={wideAt + 4} size={1.2 * kp.scale} seed="s03wide" />
        {boxes.map((b, i) => (
          <TargetBox key={i} view={view} side={i === 0 ? 1 : -1} at={b} punchAt={tHard + i * 2} frame={frame} />
        ))}
        <ChalkTitle lines={["THREE SPINS", "AND A LINE"]} x={boxC.x} y={boxC.y} at={s02Frames - 60} clock={frame + s02Frames} size={132} stagger={1} out={titleOut} />
        <ChapterWrite number={1} title="THE DRIVE" subtitle="slow spin" at={cardAt} until={cardUntil} id="s03-card" />
        <CardBall frame={frame} at={cardAt + 12} until={cardUntil} />
        <Sfx name="chalk" at={cardAt} volume={0.5} />
        <Sfx name="chalk" at={cardAt + 10} volume={0.4} />
        <Sfx name="whoosh-long" at={6} volume={0.25} />
        <Sfx name="chalk" at={riseAt} volume={0.4} />
        <Sfx name="pop" at={wideAt + 4} volume={0.35} />
        <Sfx name="pop-soft" at={bubbleAt} volume={0.35} />
        {boxes.map((b, i) => (
          <Sfx key={i} name="pop-soft" at={b} volume={0.4} />
        ))}
        <Sfx name="pop" at={tHard} volume={0.35} />
        <Sfx name="whoosh" at={cutSide - 4} volume={0.3} />
      </Stage>
    );
  }

  // ---------------- Shot B: side view, the strike in slow motion with the speed bars. ----------------
  const tRun = tWeird + 8; // last steps in, real time
  const S0 = tStrike; // slow motion starts at the standing foot
  const C = S0 + 30; // contact, on "strike"
  const SLOW = 0.1;
  const slowEnd = C + 75; // 0.25 s of flight at 1/10 speed
  // Real time (in frames) for any scene frame: 1x, then 1/10, then back up to 1x.
  const speedAt = (f: number) => (f < S0 ? 1 : f < slowEnd ? SLOW : SLOW + (1 - SLOW) * progress(f, slowEnd, 14, EASE.enter));
  const realAt = (f: number) => {
    let r = 0;
    for (let k = cutSide; k < f; k++) r += speedAt(k);
    return r + (f - Math.floor(f)) * speedAt(Math.floor(f));
  };
  const rC = realAt(C);
  const sfAt = (f: number) => Math.max(0, realAt(f) - rC); // sim frames after release

  const hipReady = FIT.hipX - 1.25 * PPM;
  const hipPlant = FIT.hipX - 0.22 * PPM;
  const poseAtF = (f: number): { pose: Pose; hip: number } => {
    if (f < tRun) return { pose: { ...POSES.ready, torso: POSES.ready.torso + idle(f, 1, 3, 1.5) }, hip: hipReady };
    if (f < S0) {
      const t = progress(f, tRun, S0 - tRun, EASE.soft);
      const run = cyclePose(f - tRun, "run", 6);
      return { pose: mixPose(run, POSES.plant, progress(f, S0 - 5, 5, EASE.soft)), hip: hipReady + (hipPlant - hipReady) * t };
    }
    if (f < C) {
      const t = easeIn(clamp01((f - S0) / (C - S0)));
      return { pose: mixPose(POSES.plant, STRIKE, t), hip: hipPlant + (FIT.hipX - hipPlant) * t };
    }
    const sf = sfAt(f);
    const a = easeOut(clamp01(sf / 12));
    const b = progress(sf, 14, 22, EASE.standard);
    const look = progress(f, tHow - 2, 18, EASE.standard);
    const base = mixPose(mixPose(STRIKE, POSES.follow, a), POSES.stand, b);
    const lookPose = { ...LOOK, head: LOOK.head + idle(f, 2, 2.2, 3), nearAnkle: LOOK.nearAnkle + idle(f, 1, 1.6, 6) };
    return { pose: mixPose(base, lookPose, look), hip: FIT.hipX + 0.3 * PPM * a + 0.25 * PPM * b };
  };
  const cur = poseAtF(frame);

  // Foot speed read from the rig: laces travel per real second, scaled so contact = 16.7 m/s.
  const lacesSpeed = (f: number) => {
    const p1 = poseAtF(f);
    const p0 = poseAtF(f - 1);
    const a = lacesAt(p1.pose, p1.hip, FIT.t);
    const b = lacesAt(p0.pose, p0.hip, FIT.t);
    const dr = Math.max(1e-4, realAt(f) - realAt(f - 1));
    return (Math.hypot(a.x - b.x, a.y - b.y) / PPM) * (30 / dr);
  };
  const beforeC = lacesSpeed(C - 1);
  const afterC = Math.max(1e-3, lacesSpeed(C + 2));
  const footMs =
    frame < C
      ? (lacesSpeed(frame) / Math.max(1e-3, beforeC)) * FOOT_AT_CONTACT
      : (lacesSpeed(frame) / afterC) * FOOT_AT_CONTACT * (1 - 0.2 * progress(frame, C, 3, EASE.soft));
  const sf = sfAt(frame);
  const released = frame >= C;
  const ballMs = frame < C - 3 ? 0 : frame < C ? progress(frame, C - 3, 3, EASE.soft) * 21.7 : len(sampleAt(DRIVE, sf).vel);
  // BALL glows while the narration says "the ball can fly faster than your foot".
  const ballWin = progress(frame, C, 4) * (1 - progress(frame, slowEnd - 14, 14));

  // End: push in towards the lifted boot (the s04 X-ray opens on the foot).
  const endPose = poseAtF(END);
  const boot = lacesAt(endPose.pose, endPose.hip, 0.5);
  const camKeys: SideKey[] = [
    { f: cutSide, x: X(0.35), y: GROUND - 48, zoom: 4.3 },
    { f: slowEnd, x: X(0.8), y: GROUND - 47, zoom: 4.55 },
    { f: tHow - 2, x: X(0.8), y: GROUND - 47, zoom: 4.6 },
    // The kicking knee ends near the frame centre, where the s04 X-ray iris opens.
    { f: END - 2, x: boot.x - 16, y: boot.y - 20, zoom: 6.4 },
  ];
  const cam = sideCamAt(frame, camKeys);

  // Chalk peeks in from the right edge at "How?", scratching his head.
  const peek = progress(frame, tHow - 4, 16, EASE.enter);
  const peekX = cam.x + (WIDTH / 2 - 40 + 320 * (1 - peek)) / cam.zoom;
  const scratch: KeeperPose = { left: 14, right: 150 + 10 * Math.sin(frame / 2.2), lean: -20, shift: 0, lift: 0, stretch: 1 };

  const head = toScreen({ x: cur.hip + 12, y: GROUND - 1.62 * PPM - 20 }, cam);
  const squash = frame < C - 3 ? 1 : frame < C ? 1 - 0.1 * progress(frame, C - 3, 3) : 1 - 0.1 * Math.exp(-(frame - C) / 6) * Math.cos((frame - C) / 1.8);

  return (
    <Stage bg={PITCH.sky}>
      <SideWorld cam={cam} seed="s03b">
        {peek > 0.001 ? <Keeper x={peekX} groundY={GROUND} h={2.1 * PPM} pose={scratch} face="thinking" look={-1} /> : null}
        <Player x={cur.hip} groundY={GROUND} h={1.62 * PPM} pose={cur.pose} face={frame >= tRun && frame < slowEnd + 10 ? "focus" : "neutral"} />
        {released ? (
          <Flight path={DRIVE} view={SIDE} at={0} frame={sf} r={BALL_R} trailColor={PITCH.lightSoft} trailOpacity={0.5 * (1 - progress(frame, slowEnd - 6, 10))} lineNormal={LINE_N} />
        ) : (
          <Ball cx={REST.x} cy={REST.y} r={BALL_R} view={SIDE} lineNormal={LINE_N} squash={squash} />
        )}
      </SideWorld>
      <SlowTag at={S0 - 2} until={slowEnd} />
      <SpeedBars x={1150} y={130} foot={footMs / BAR} ball={ballMs / BAR} at={S0} until={slowEnd} ballWin={ballWin} />
      <ChalkMark x={head.x + 330} y={head.y - 30} text="!" at={tWeird} until={S0 - 2} size={220} rotate={10} />
      <ChalkMark x={1240} y={350} text="?" at={tHow} until={END + 30} size={300} rotate={-6} />
      {frame >= C && frame < C + 12 ? <Glow cx={toScreen(REST, cam).x} cy={toScreen(REST, cam).y} r={130} color={PITCH.light} intensity={1.2 * (1 - (frame - C) / 12)} rings={4} /> : null}
      <Sfx name="pop" at={tWeird} volume={0.4} />
      <Sfx name="chalk" at={tWeird} volume={0.3} />
      <Sfx name="subdrop" at={S0 - 2} volume={0.45} />
      <Sfx name="whoosh" at={S0 + 6} volume={0.3} />
      <Sfx name="thump" at={C} volume={0.4} />
      <Sfx name="whoosh" at={C + 2} volume={0.4} />
      <Sfx name="whoosh-long" at={slowEnd} volume={0.35} />
      <Sfx name="blip" at={tHow} volume={0.45} />
      <Sfx name="pop" at={tHow + 2} volume={0.35} />
      <Sfx name="chalk" at={tHow + 4} volume={0.3} />
    </Stage>
  );
};

/** Chalk's reach in the goal mouth (m): an ellipse, half-width and half-height, centre height. */
const REACH = { hw: 2.3, hh: 1.2, cz: 1.2 };

/** Pale bubble in the goal mouth: what Chalk can reach. */
const ReachBubble: React.FC<{ view: PView; at: number; frame: number }> = ({ view, at, frame }) => {
  const s = pop(frame, at, { stiffness: 160, damping: 14 });
  if (s <= 0.001) return null;
  const pts: Vec3[] = Array.from({ length: 48 }, (_, i) => {
    const th = (i / 48) * Math.PI * 2;
    return { x: GOAL_X + 0.05, y: Math.cos(th) * REACH.hw * s, z: Math.max(0.03, REACH.cz + Math.sin(th) * REACH.hh * s) };
  });
  const d = polyD(pts, view);
  const breathe = 0.16 + 0.03 * Math.sin(frame / 12);
  return (
    <g>
      <path d={d} fill={PITCH.chalk} opacity={breathe} />
      <path d={d} fill="none" stroke={PITCH.chalk} strokeWidth={5} strokeDasharray="2 16" strokeLinecap="round" opacity={0.6} />
    </g>
  );
};

/**
 * A glowing target box in a bottom corner of the goal (side 1 = left post, -1 = right post).
 * It fills the low corner from the post (inner edge 3.6 m) to the edge of Chalk's reach, and it stays
 * outside the reach ellipse: 1.24 m x 1.16 m, 1.8 times the area of the first draft.
 * `punchAt`: one short swell on "hard".
 */
const TargetBox: React.FC<{ view: PView; side: 1 | -1; at: number; punchAt: number; frame: number }> = ({ view, side, at, punchAt, frame }) => {
  const punch = 0.1 * Math.sin(Math.PI * clamp01((frame - punchAt) / 9));
  const s = pop(frame, at, { stiffness: 220, damping: 13 }) * (1 + punch);
  if (s <= 0.001) return null;
  const inner = REACH.hw;
  const outer = 3.54;
  const cyM = 0.64;
  const cxM = side * ((inner + outer) / 2);
  const hw = ((outer - inner) / 2) * s;
  const hh = 0.58 * s;
  const pts: Vec3[] = [
    { x: GOAL_X + 0.1, y: cxM - hw, z: cyM - hh },
    { x: GOAL_X + 0.1, y: cxM + hw, z: cyM - hh },
    { x: GOAL_X + 0.1, y: cxM + hw, z: cyM + hh },
    { x: GOAL_X + 0.1, y: cxM - hw, z: cyM + hh },
  ];
  const d = polyD(pts, view);
  const c = project({ x: GOAL_X, y: cxM, z: cyM }, view);
  const pulse = 0.75 + 0.25 * Math.sin((frame - at) / 5) + 2 * punch;
  return (
    <g>
      <Glow cx={c.x} cy={c.y} r={1.6 * c.scale} color={PITCH.light} intensity={1.2 * pulse} rings={4} />
      <path d={d} fill={PITCH.light} opacity={0.28} />
      <path d={d} fill="none" stroke={PITCH.light} strokeWidth={7} strokeLinejoin="round" />
    </g>
  );
};

/** The card's ball: its line rolls slowly backward (a drive's slow backspin). */
const CardBall: React.FC<{ frame: number; at: number; until: number }> = ({ frame, at, until }) => {
  const s = pop(frame, at) * (1 - progress(frame, until, 8, EASE.exit));
  if (s <= 0.001) return null;
  const angle = ((frame - at) / 30) * Math.PI * 2 * 0.45;
  return (
    <g transform={`translate(${WIDTH / 2 + 210} 624) scale(${s})`}>
      <Ball cx={0} cy={0} r={36} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={angle} lineNormal={LINE_N} />
    </g>
  );
};
