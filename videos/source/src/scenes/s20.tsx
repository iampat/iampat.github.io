// s20 The first miss, revealed: "That first shot tonight? Your foot came up under it. It took off
// steep, with backspin, like a chip. By accident. Chip on purpose, when the keeper rushes out."
// A see-through ghost replay of the s01 miss up to contact, a freeze with markers (standing foot
// behind, chest behind, foot low on the way up), the slow take-off (angle arc, backspin arrows,
// float arrow), a stamp, then live play: Chalk rushes out, Tavi chips (CHIP) over him into the goal,
// Chalk turns round, puzzled. A chip practice board slides into the sky band above the play.
// The last frame holds on the exact wide framing that s21 opens on.
// The first frame matches the last frame of s19 (the big merged ball with its spin dial).
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { Dust, Floodlight, Glow, GroundSide, CarPark, Sky, Stands, Stars } from "../kit/World";
import { Player, POSES, mixPose, poseAt, cyclePose, solve, type Face, type Pose } from "../kit/Player";
import { Keeper, KPOSES, keeperPoseAt, type KeeperFace, type KeeperPose } from "../kit/Keeper";
import { Ball } from "../kit/Ball";
import { GoalSide } from "../kit/Goal";
import { Arrow, Label, SlowMoTag, Stamp } from "../kit/Graphics";
import { XRayGrid } from "../kit/XRay";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { simulate, sampleAt, spinAngleAt, type BallState, type Vec3 } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, clamp01, idle, lerp, pop, progress, visible } from "../lib/anim";
import { pathD, project, type View } from "../lib/project";
import { FONTS, HEIGHT, PITCH, WIDTH } from "../theme";
import {
  AngleArc,
  BOARD_HEAD,
  BoardLines,
  CornerBoard,
  DashLine,
  GhostPlayer,
  MERGE_R,
  MergeDial,
  NetBulge,
  PopArrow,
  RingMarker,
  SafetyIcon,
  SpinArrows,
  TextStamp,
  type SafetyKind,
} from "../kit/ext/s19-s20-parts";

// Same side-view world as s01 and s21.
const PPM = 50;
const OX = 400;
const GROUND = 820;
const GOAL_M = 18;
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const SIDE_UNIT: View = { kind: "side", originX: 0, groundY: 0, ppm: 1 };
const LINE_N: Vec3 = { x: 0.92, y: 0.25, z: 0.3 };
const TAVI_H = 1.62 * PPM;
const CHALK_H = 2.1 * PPM;
const REST_R = 0.11 * PPM;
/** The live chip ball is drawn at twice true size (like the replay ball in the wide shot), so it reads. */
const LIVE_R = 2 * REST_R;

const MISS = simulate({ ...SHOTS.MISS, duration: 3.2 }, 30);
const CHIP_SPOT = GOAL_M - 14; // the chip is taken 14 m out
const CHIP = simulate({ ...SHOTS.CHIP, start: { x: CHIP_SPOT, y: 0, z: 0.11 }, duration: 2.6 }, 30);
const LAUNCH_DEG = SHOTS.MISS.elevationDeg;

/** First sample where a ball reaches the back of the net, or -1. */
const netIndex = (path: BallState[], goalX: number) => {
  for (let i = 1; i < path.length; i++) {
    const s = path[i];
    if (s.pos.z > 2.36) continue;
    const back = goalX + 1.8 - 0.9 * Math.min(1, s.pos.z / 2.32) - 0.12;
    if (s.pos.x >= back && path[i - 1].pos.x >= goalX - 0.2) return i;
  }
  return -1;
};
const CHIP_NET = netIndex(CHIP, GOAL_M);

/** Ball after the kick: follows the sim, then drops straight down once the net stops it. */
const flightAt = (path: BallState[], f: number, iNet: number) => {
  const ff = Math.max(0, f);
  if (iNet < 0 || ff <= iNet) {
    const s = sampleAt(path, ff);
    return { pos: s.pos, angle: spinAngleAt(path, ff), axis: s.spin };
  }
  const n = path[iNet];
  const dt = (ff - iNet) / 30;
  return {
    pos: { x: n.pos.x + 0.12 * (1 - Math.exp(-dt * 10)), y: n.pos.y, z: Math.max(0.11, n.pos.z - 0.5 * 9.81 * dt * dt) },
    angle: spinAngleAt(path, iNet) + 1.5 * (1 - Math.exp(-dt * 3)),
    axis: n.spin,
  };
};

const CHIP_BACK: Pose = { ...POSES.chip, torso: 2, nearHip: -24, nearKnee: 62, nearAnkle: 122 };
const RUSH: KeeperPose = { ...KPOSES.ready, lean: -12, left: 55, right: 55 };

// Ghost Tavi at contact (the s01 lean-back strike): joints for the markers.
const HIP_X = X(-0.6);
const J_LB = solve(POSES.leanBack, TAVI_H);
const HIP_Y = GROUND - J_LB.lowest;
const STAND_FOOT = { x: HIP_X + (J_LB.fa.x + J_LB.fToe.x) / 2, y: GROUND - 3 };
const CHEST = { x: HIP_X + J_LB.sh.x * 0.85, y: HIP_Y + J_LB.sh.y * 0.85 };
const HEAD_TOP = { x: HIP_X + J_LB.headC.x, y: HIP_Y + J_LB.headC.y - J_LB.headR };
const BALL_REST = { x: X(0), y: GROUND - REST_R };
const CONTACT = { x: BALL_REST.x - 0.62 * REST_R, y: BALL_REST.y + 0.78 * REST_R };

type Cam = { x: number; y: number; zoom: number };
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), t)),
});
/** Zoom between two framings while a chosen world point glides smoothly across the screen. */
const glideCam = (a: Cam, b: Cam, t: number, anchor: { x: number; y: number }): Cam => {
  const z = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), t));
  const sa = { x: (anchor.x - a.x) * a.zoom, y: (anchor.y - a.y) * a.zoom };
  const sb = { x: (anchor.x - b.x) * b.zoom, y: (anchor.y - b.y) * b.zoom };
  const s = { x: lerp(sa.x, sb.x, t), y: lerp(sa.y, sb.y, t) };
  return { x: anchor.x - s.x / z, y: anchor.y - s.y / z, zoom: z };
};

// Framings.
const C_BALL: Cam = { x: BALL_REST.x, y: BALL_REST.y, zoom: MERGE_R / REST_R }; // matches the last frame of s19
const C_RUN: Cam = { x: X(-1.6), y: GROUND - 62, zoom: 4.6 };
const C_RUN2: Cam = { x: X(-1.2), y: GROUND - 60, zoom: 4.75 };
const C_FREEZE: Cam = { x: X(-0.4), y: GROUND - 54, zoom: 5.2 };
const C_WIDE: Cam = { x: X(8.4), y: 590, zoom: 1.24 };
const C_WIDE2: Cam = { x: X(8.1), y: 584, zoom: 1.2 };
const C_S21: Cam = { x: X(7.4), y: GROUND - 250, zoom: 1.12 }; // the first frame of s21

/** Safety strip on the chip board: icon plus a two-line caption. */
const SAFETY: { kind: SafetyKind; a: string; b: string }[] = [
  { kind: "goal", a: "No one near", b: "the goal" },
  { kind: "cars", a: "Far from", b: "roads, cars" },
  { kind: "warmup", a: "Warm up", b: "5 minutes" },
  { kind: "half", a: "Start at", b: "half power" },
  { kind: "turf", a: "Hard ground:", b: "start soft" },
];

export const S20: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s20");

  // ---------- Beats (exact word cues) ----------
  const tFirst = cue("That first shot tonight");
  const tYour = cue("Your foot came up");
  const tCame = cue("came up");
  const tUnderIt = cue("under it");
  const tTook = cue("It took off steep");
  const tSteep = cue("steep");
  const tBack = cue("backspin");
  const tAcc = cue("By accident");
  const tPurpose = cue("Chip on purpose");
  const tPurp = cue("purpose");
  const END = cue.frames;

  // Replay: the run-up plays at 0.6x and freezes at contact on "Your foot".
  const contact = tYour;
  const runStart = contact - 43;
  const TAKE = tTook + 2; // the ball leaves the foot
  const R0 = tSteep + 16; // slow motion starts to speed up
  const R1 = tBack; // slow motion reaches 0.6x
  /** Sim frames since contact at a scene frame (0.15x, a ramp, then 0.6x). */
  const tau = (f: number) => {
    if (f <= TAKE) return 0;
    let t = 0.15 * (Math.min(f, R0) - TAKE);
    if (f > R0) {
      const b = Math.min(f, R1) - R0;
      t += 0.15 * b + (0.45 * b * b) / (2 * (R1 - R0));
    }
    if (f > R1) t += 0.6 * (f - R1);
    return t;
  };
  const tauNow = tau(frame);
  const missNow = flightAt(MISS, tauNow, -1);
  const missP = project(missNow.pos, SIDE);

  // Live chip.
  const liveIn = tPurpose - 7; // the live shot starts just before "Chip on purpose"
  const rushStart = liveIn + 2;
  const kick = tPurp + 4;
  const overChalk = kick + 21;
  const chipNetF = kick + (CHIP_NET > 0 ? CHIP_NET : 60);
  const puzzled = overChalk + 30;
  // Chip practice board. The storyboard puts it in a 2.5 s music-only hold after the narration.
  // With no hold in the timeline, it slides into the sky band above the live play (it never covers
  // the chip) just after the stamp has gone, and it is fully built before the ball clears Chalk.
  // If the timeline gets an extra tail for s20, the board moves into that hold by itself.
  const narrEnd = cue.wordEnd("rushes out");
  const hasHold = END - narrEnd >= 60;
  const boardIn = hasHold ? narrEnd : liveIn + 6;

  // ---------- Camera ----------
  const W_END = tTook + 76;
  let cam: Cam;
  if (frame < 44) {
    cam = glideCam(C_BALL, C_RUN, progress(frame, 0, 44, EASE.camera), BALL_REST);
  } else if (frame < contact) {
    cam = lerpCam(C_RUN, C_RUN2, progress(frame, 44, contact - 44, EASE.soft));
  } else if (frame < tTook) {
    cam = lerpCam(C_RUN2, C_FREEZE, progress(frame, contact, tTook - contact, EASE.soft));
  } else if (frame < W_END) {
    cam = glideCam(C_FREEZE, C_WIDE, progress(frame, tTook, W_END - tTook, EASE.camera), { x: X(0), y: GROUND });
  } else if (frame < liveIn) {
    cam = lerpCam(C_WIDE, C_WIDE2, progress(frame, W_END, liveIn - W_END, EASE.soft));
  } else {
    cam = lerpCam(C_WIDE2, C_S21, progress(frame, liveIn, END - 1 - liveIn, EASE.soft));
  }
  const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
  const toScreen = (p: { x: number; y: number }) => ({ x: WIDTH / 2 + (p.x - cam.x) * cam.zoom, y: HEIGHT / 2 + (p.y - cam.y) * cam.zoom });
  const horizonY = HEIGHT / 2 + (GROUND - cam.y) * cam.zoom;
  const bgScale = 1 + (Math.min(cam.zoom, 6) - 1) * 0.05;
  // Wide-shot size boost for the replay ball (true size in the freeze, twice true size in the wide).
  const wideK = clamp01(Math.log(C_FREEZE.zoom / cam.zoom) / Math.log(C_FREEZE.zoom / C_WIDE.zoom));

  // ---------- Ghost Tavi (replay) ----------
  const ghostX = X(-3.2 + 2.6 * progress(frame, runStart, contact - 3 - runStart, EASE.soft));
  const ghostPose =
    frame < TAKE
      ? poseAt(frame, [
          [runStart, "ready"],
          [runStart + 10, cyclePose(6, "run", 7)],
          [runStart + 22, cyclePose(13, "run", 7)],
          [contact - 10, "plant"],
          [contact, "leanBack"],
        ])
      : mixPose(POSES.leanBack, POSES.follow, EASE.soft(clamp01(tauNow / 12)));
  // The ghost is gone before live Tavi fades in, so two Tavis never share the frame.
  const ghostO = progress(frame, 14, 16, EASE.enter) * (1 - progress(frame, liveIn - 14, 10, EASE.exit));
  const ghostBoost = visible(frame, contact, tTook + 10, 10, 16); // stronger ghost during the freeze

  // ---------- Live Tavi ----------
  const liveO = progress(frame, liveIn, 12, EASE.enter);
  const liveX = X(CHIP_SPOT - 1.0 + 0.7 * progress(frame, kick - 12, 10, EASE.soft));
  const livePose = poseAt(frame, [
    [liveIn, "stand"],
    [liveIn + 10, "ready"],
    [kick - 12, "ready"],
    [kick - 6, CHIP_BACK],
    [kick, "chip"],
    [kick + 24, "chip"],
    [kick + 36, "stand"],
    [chipNetF, "stand"],
    [chipNetF + 8, "celebrate"],
  ]);
  const liveFace: Face = frame >= chipNetF ? "happy" : frame >= kick - 12 && frame < kick + 24 ? "focus" : "neutral";
  const fC = frame - kick;
  const chipNow = flightAt(CHIP, fC, CHIP_NET);
  /** Side-view point, lifted so the enlarged ball sits on the grass at z = 0.11 m. */
  const liveP = (pos: Vec3) => {
    const p = project(pos, SIDE);
    return { x: p.x, y: p.y - (LIVE_R - REST_R) };
  };
  const chipP = liveP(chipNow.pos);

  // ---------- Chalk ----------
  const rushT = progress(frame, rushStart, overChalk + 2 - rushStart, (t) => 1 - (1 - t) * (1 - t));
  const chalkX = X(GOAL_M) - 8 - rushT * (X(GOAL_M) - 8 - X(CHIP_SPOT + 6.1));
  const rushing = frame >= rushStart && frame < overChalk - 6;
  const cPose0 = keeperPoseAt(frame, [
    [0, "crossed"],
    [rushStart - 4, "crossed"],
    [rushStart + 4, RUSH],
    [overChalk - 6, RUSH],
    [overChalk, "punchUp"],
    [overChalk + 12, "wide"],
    [puzzled, "shrug"],
  ]);
  const chalkPose: KeeperPose = rushing ? { ...cPose0, lift: cPose0.lift + Math.abs(Math.sin((frame - rushStart) / 3.2)) * 0.035 } : cPose0;
  const chalkFace: KeeperFace = frame >= puzzled ? "thinking" : frame >= overChalk - 2 ? "surprised" : frame >= rushStart ? "annoyed" : frame >= tFirst ? "smug" : "flat";
  const turn = overChalk + 6;
  const chalkLook = frame >= turn ? Math.min(1, (frame - turn) / 8) : frame >= rushStart ? -0.6 : -0.5 + idle(frame, 3, 3, 0.12);
  const qPop = pop(frame, puzzled + 2, { stiffness: 260, damping: 14 });

  // ---------- Overlays (screen space) ----------
  const ballS = toScreen(missP);
  const ghostBallRW = REST_R * (1 + wideK); // world radius
  const ballSR = ghostBallRW * cam.zoom;
  const xrayO = 1 - progress(frame, 0, 12, EASE.soft);
  const dialO = 1 - progress(frame, 2, 9, EASE.exit);
  const flashT = frame >= contact && frame < contact + 10 ? 1 - (frame - contact) / 10 : 0;
  const markOut = tTook - 4;

  const standS = toScreen(STAND_FOOT);
  const groundS = toScreen({ x: 0, y: GROUND });
  const chestS = toScreen(CHEST);
  const chestGroundS = toScreen({ x: CHEST.x, y: GROUND });
  const ballCS = toScreen(BALL_REST);
  const ballTopS = toScreen({ x: BALL_REST.x, y: CHEST.y });
  const ballGroundS = toScreen({ x: BALL_REST.x, y: GROUND });
  const contactS = toScreen(CONTACT);
  const headTopS = toScreen(HEAD_TOP);
  const launchS = toScreen(BALL_REST);
  const mpx = cam.zoom * PPM; // screen pixels per metre

  // Replay trail (screen space, so its width stays even while the camera pulls out).
  const trailD = (() => {
    if (tauNow <= 0) return "";
    const n = Math.min(MISS.length - 1, Math.floor(tauNow));
    const pts = MISS.slice(0, n + 1).map((q) => toScreen(project(q.pos, SIDE)));
    pts.push(ballS);
    return pathD(pts);
  })();

  const restBallAngle = 0.06 * 12 * (1 - Math.pow(1 - Math.min(1, frame / 12), 2)); // starts at the s19 spin rate

  return (
    <Stage bg={PITCH.sky}>
      {/* Far background: sits on the horizon, barely moves (as in s01 and s21). */}
      <Sky />
      <Stars count={90} maxY={Math.max(200, horizonY - 300)} seed="s21a" />
      <g transform={`translate(${WIDTH / 2} ${horizonY}) scale(${bgScale}) translate(${-WIDTH / 2 - (cam.x - X(4)) * 0.04} ${-GROUND})`}>
        <Stands baseY={GROUND} lit={1} />
        {[180, 720, 1220, 1760].map((x, i) => (
          <Floodlight key={i} x={x} baseY={GROUND - 20} height={470} on={1} />
        ))}
      </g>

      {/* World. */}
      <g transform={worldT}>
        <GroundSide groundY={GROUND} vanishX={X(8)} />
        <CarPark x0={X(GOAL_M + 3)} groundY={GROUND} ppm={PPM} />
        <GoalSide view={SIDE} goalX={GOAL_M} />
        <Keeper x={chalkX} groundY={GROUND} h={CHALK_H} pose={chalkPose} face={chalkFace} look={chalkLook} />
        {frame >= rushStart && frame < overChalk ? (
          <>
            <Dust x={chalkX} y={GROUND} at={rushStart + 2} size={34} seed="r1" />
            <Dust x={chalkX} y={GROUND} at={rushStart + 14} size={30} seed="r2" />
            <Dust x={chalkX} y={GROUND} at={rushStart + 26} size={30} seed="r3" />
          </>
        ) : null}
        <Dust x={chalkX} y={GROUND - CHALK_H * 0.95} at={puzzled} size={46} seed="puzzle" />

        {/* Ghost replay: the background dims about 20% under the ghost, which has a light rim. */}
        {ghostO > 0.001 ? (
          <g opacity={ghostO}>
            <Glow cx={ghostX} cy={GROUND - TAVI_H * 0.5} r={TAVI_H * 0.95} color={PITCH.skyHigh} intensity={0.65 + 0.2 * ghostBoost} />
            <GhostPlayer
              id="s20-ghost"
              x={ghostX}
              groundY={GROUND}
              h={TAVI_H}
              pose={ghostPose}
              rim={3.2 / cam.zoom}
              fill={0.9 + 0.1 * ghostBoost}
              rimOpacity={0.85 + 0.15 * ghostBoost}
            />
          </g>
        ) : null}

        {/* Live play. */}
        {liveO > 0.001 ? (
          <g opacity={liveO}>
            <Player x={liveX} groundY={GROUND} h={TAVI_H} pose={livePose} face={liveFace} />
            {fC > 0 ? (
              <g>
                <Glow cx={chipP.x} cy={chipP.y} r={LIVE_R * 3} color={PITCH.lightSoft} intensity={0.9} />
                <Ball cx={chipP.x} cy={chipP.y} r={LIVE_R} view={SIDE} axis={chipNow.axis} angle={chipNow.angle} lineNormal={LINE_N} />
              </g>
            ) : (
              <Ball cx={X(CHIP_SPOT)} cy={GROUND - LIVE_R} r={LIVE_R} view={SIDE} lineNormal={LINE_N} />
            )}
          </g>
        ) : null}
        <NetBulge x={X(GOAL_M + 1.25)} y={GROUND - 1.5 * PPM} at={chipNetF} size={12} />
      </g>

      {/* Live chip trail (screen space). */}
      {fC > 0 ? (
        <path
          d={pathD(
            CHIP.slice(0, Math.floor(CHIP_NET > 0 ? Math.min(fC, CHIP_NET) : fC) + 1)
              .map((q) => toScreen(liveP(q.pos)))
              .concat([toScreen(chipP)]),
          )}
          fill="none"
          stroke={PITCH.lightSoft}
          strokeWidth={3.5}
          strokeLinecap="round"
          opacity={0.5 * (1 - progress(frame, chipNetF + 10, 16))}
        />
      ) : null}

      {/* The replay ball (drawn in screen space so it can grow in the wide shot) and its trail. */}
      {ghostO > 0.001 ? (
        <g opacity={ghostO}>
          {trailD ? <path d={trailD} fill="none" stroke={PITCH.lightSoft} strokeWidth={3} strokeLinecap="round" opacity={0.5} /> : null}
          {tauNow < 44 ? (
            <Ball
              cx={ballS.x}
              cy={ballS.y}
              r={ballSR}
              view={SIDE_UNIT}
              axis={tauNow > 0 ? missNow.axis : { x: 0, y: -1, z: 0 }}
              angle={tauNow > 0 ? missNow.angle : restBallAngle}
              lineNormal={LINE_N}
              opacity={frame < 12 ? 0 : 0.95}
            />
          ) : null}
        </g>
      ) : null}

      {/* Freeze at contact: markers. */}
      {flashT > 0 ? <circle cx={contactS.x} cy={contactS.y} r={30 + 100 * (1 - flashT)} fill="none" stroke={PITCH.chalk} strokeWidth={10 * flashT} opacity={flashT} /> : null}
      {/* 1. The standing foot is behind the ball. */}
      <RingMarker x={standS.x} y={standS.y} r={24} at={contact + 4} until={markOut} color={PITCH.light} />
      <Label x={standS.x + 30} y={groundS.y + 80} text="standing foot behind" at={contact + 6} until={markOut} size={40} anchor="end" />
      {/* 2. The chest is behind the ball. */}
      <DashLine x1={chestGroundS.x} y1={chestGroundS.y} x2={chestS.x} y2={chestS.y} at={contact + 12} until={markOut} color={PITCH.chalk} width={6} />
      <DashLine x1={ballGroundS.x} y1={ballGroundS.y} x2={ballTopS.x} y2={ballTopS.y} at={contact + 14} until={markOut} color={PITCH.chalk} width={6} />
      {frame >= contact + 18 && frame < markOut + 10 ? (
        <PopArrow x={ballTopS.x - 12} y={chestS.y} dx={chestS.x - ballTopS.x + 36} dy={0} at={contact + 18} until={markOut} color={PITCH.light} width={10} />
      ) : null}
      <Label x={headTopS.x} y={headTopS.y - 58} text="chest behind" at={contact + 20} until={markOut} size={40} />
      {/* 3. The foot meets it low, on the way up. */}
      <Arrow
        x1={contactS.x - 0.45 * mpx}
        y1={contactS.y - 0.3 * mpx}
        x2={contactS.x + 0.3 * mpx}
        y2={contactS.y - 0.55 * mpx}
        curve={-1.0}
        at={tCame}
        until={markOut}
        dur={14}
        color={PITCH.light}
        width={9}
      />
      <RingMarker x={contactS.x} y={contactS.y} r={16} at={tUnderIt} until={markOut} color={PITCH.light} />
      <Label x={ballCS.x + 40} y={groundS.y + 80} text="low, on the way up" at={tUnderIt + 3} until={markOut} size={40} anchor="start" />

      {/* Take-off: the angle arc, then the backspin arrows and the float arrow on the replay ball. */}
      <AngleArc x={launchS.x} y={launchS.y} deg={LAUNCH_DEG} r={Math.max(170, 1.5 * mpx)} at={tSteep} until={tBack - 2} color={PITCH.light} label="steep" labelSize={42} width={6} ray={1.8} />
      {tauNow > 0 && tauNow < 44 ? (
        <SpinArrows cx={ballS.x} cy={ballS.y} r={ballSR + 24} dir={-1} color={PITCH.chalk} width={7} phase={(frame - tBack) * 7} opacity={visible(frame, tBack, tAcc - 16, 10, 8)} />
      ) : null}
      {frame >= tBack + 8 && frame < tAcc ? (
        <PopArrow x={ballS.x} y={ballS.y - ballSR - 30} dx={0} dy={-72} at={tBack + 8} until={tAcc - 16} color={PITCH.light} width={11} label="float" labelSize={40} lx={24} ly={-4} />
      ) : null}

      {/* Chalk, puzzled. */}
      {qPop > 0.001 ? (
        <g transform={`translate(${toScreen({ x: chalkX, y: GROUND - CHALK_H * 1.32 }).x} ${toScreen({ x: chalkX, y: GROUND - CHALK_H * 1.32 }).y}) scale(${qPop})`}>
          <text y={30} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={96} textAnchor="middle">
            ?
          </text>
        </g>
      ) : null}

      <TextStamp text="LIKE A CHIP, BY ACCIDENT" x={WIDTH / 2} y={170} at={tAcc} until={liveIn - 2} size={50} />
      <SlowMoTag at={tFirst} until={contact - 8} label="REPLAY" />
      <SlowMoTag at={contact + 2} until={tTook - 8} label="FREEZE" />
      <SlowMoTag at={TAKE} until={tAcc - 10} label="SLOW MOTION" />

      {/* Chip practice board: opaque, two short lines and a safety icon strip, in the sky band. */}
      <CornerBoard x={40} y={28} w={1260} h={470} at={boardIn} title="THE CHIP AT PRACTICE">
        <g transform="translate(128 124) scale(0.72)">
          <Stamp kind="MISTAKE" x={0} y={0} at={boardIn + 4} rotate={-5} />
        </g>
        <BoardLines x={252} y={137} lines={["Big follow-through = over the bar."]} at={boardIn + 4} />
        <g transform="translate(128 204) scale(0.72)">
          <Stamp kind="DRILL" x={0} y={0} at={boardIn + 8} rotate={-5} />
        </g>
        <BoardLines x={252} y={217} lines={["Bag 4 steps ahead. Chip 10 balls over it."]} at={boardIn + 8} />
        {frame >= boardIn + 12 ? (
          <g opacity={progress(frame, boardIn + 12, 10, EASE.enter)}>
            <rect x={20} y={252} width={1220} height={200} rx={24} fill={BOARD_HEAD} />
            <text x={48} y={290} fill={PITCH.light} fontFamily={FONTS.hud} fontWeight={700} fontSize={28} letterSpacing={3}>
              STAY SAFE
            </text>
          </g>
        ) : null}
        {SAFETY.map((it, i) => {
          const o = progress(frame, boardIn + 14 + i * 2, 10, EASE.enter);
          if (o <= 0.001) return null;
          const cx = 20 + (1220 * (i + 0.5)) / SAFETY.length;
          return (
            <g key={it.kind} opacity={o} transform={`translate(0 ${(1 - o) * 10})`}>
              <SafetyIcon kind={it.kind} x={cx} y={332} />
              {[it.a, it.b].map((t, k) => (
                <text key={k} x={cx} y={400 + k * 36} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={32} textAnchor="middle">
                  {t}
                </text>
              ))}
            </g>
          );
        })}
      </CornerBoard>

      {/* Carry-over from s19: the X-ray grid and the spin dial fade away as the camera pulls out. */}
      {xrayO > 0.001 ? (
        <g opacity={xrayO}>
          <XRayGrid />
        </g>
      ) : null}
      <MergeDial
        cx={ballCS.x}
        cy={ballCS.y}
        s={(0.85 + 0.15 * dialO) * Math.min(1, (REST_R * cam.zoom) / MERGE_R)}
        phase={-30 + frame * 3}
        opacity={dialO}
      />
      {frame < 12 ? (
        <Ball cx={ballCS.x} cy={ballCS.y} r={REST_R * cam.zoom} view={SIDE_UNIT} axis={{ x: 0, y: -1, z: 0 }} angle={restBallAngle} lineNormal={LINE_N} />
      ) : null}

      {/* SFX. */}
      <Sfx name="whoosh-long" at={0} volume={0.3} />
      <Sfx name="tick" at={contact} volume={0.45} />
      <Sfx name="pop-soft" at={contact + 6} volume={0.25} />
      <Sfx name="pop-soft" at={contact + 20} volume={0.25} />
      <Sfx name="whoosh" at={tCame} volume={0.2} />
      <Sfx name="pop-soft" at={tUnderIt} volume={0.3} />
      <Sfx name="thump" at={TAKE} volume={0.2} />
      <Sfx name="tick" at={tSteep} volume={0.3} />
      <Sfx name="air" at={tBack} volume={0.3} />
      <Sfx name="stamp" at={tAcc} volume={0.5} />
      <Sfx name="whoosh" at={boardIn} volume={0.25} />
      <Sfx name="chalk" at={rushStart} volume={0.35} />
      <Sfx name="thump" at={kick} volume={0.3} />
      <Sfx name="whoosh-long" at={kick + 2} volume={0.35} />
      <Sfx name="net" at={chipNetF} volume={0.3} />
      <Sfx name="chalk" at={puzzled} volume={0.4} />
      <Sfx name="pop" at={puzzled + 2} volume={0.3} />
    </Stage>
  );
};
