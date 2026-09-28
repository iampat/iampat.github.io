// s02 The question and the title: rewind the miss, the hundredth of a second at contact,
// the tether snaps and the fan of possible paths sprays out, three kicks, one idea (spin:
// how much, which way, none), the promise, then the crane up to the title.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { Ball } from "../kit/Ball";
import { Flight } from "../kit/Flight";
import { Player, POSES, mixPose, poseAt, type Pose } from "../kit/Player";
import { Keeper, keeperPoseAt } from "../kit/Keeper";
import { GoalFront } from "../kit/Goal";
import { Dust, Glow } from "../kit/World";
import { Label } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { simulate, sampleAt, type BallState, type Vec3 } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, clamp01, idle, progress, visible } from "../lib/anim";
import { project } from "../lib/project";
import { HEIGHT, PITCH, WIDTH, XRAY } from "../theme";
import {
  GOAL_X,
  GroundDisc,
  PerspPath,
  PerspPitch,
  PerspSky,
  SpinRing,
  orbitAt,
  orbitView,
  qAxis,
  qMul,
  qToAxisAngle,
  type Orbit,
  type Quat,
} from "../kit/ext/s02-s03-persp";
import { ChalkTitle, FloodIcon, ImpactLines, KickTag, RewindTag, Stopwatch, Tether } from "../kit/ext/s02-s03-hud";
import { BALL_R, GROUND, PPM, SIDE, SideWorld, X, hipForContact, lacesAt, snapCue, toScreen, type SideCam } from "../kit/ext/s02-s03-side";

const MISS = simulate({ ...SHOTS.MISS, ground: true, duration: 3 }, 30);
const LAND = Math.max(1, MISS.findIndex((s) => s.bounces > 0));
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 }; // the line drawn in s01
/** Contact pose for the miss: laces on the ball, leaning back a touch. */
const CONTACT: Pose = { ...POSES.strike, torso: -6, head: -2, farHip: 0, farKnee: 22 };
/** Ball and boot travel together about 9 cm during the 9 ms contact (average 10.5 m/s). */
const CREEP_M = 0.09;
const EL = (18 * Math.PI) / 180;
const REST = { x: X(0), y: GROUND - BALL_R };
const FIT = hipForContact(CONTACT, REST.x, REST.y);
/** s01 ends on Tavi's boots: hip at 0.6 m behind the spot, camera at zoom 9. s02 opens on the same frame. */
const S01_HIP = X(-0.6);
const OPEN_CAM: SideCam = { x: X(-0.25), y: GROUND - 12, zoom: 9 };
const MID_CAM: SideCam = { x: X(3.4), y: GROUND - 75, zoom: 2.4 };

/** A shot redrawn from the one contact point (0, 0, 0.11), cut at the goal line or first bounce. */
const fanPath = (p: BallState[], maxX = 18.4): Vec3[] => {
  const s0 = p[0].pos;
  const out: Vec3[] = [];
  for (const s of p) {
    const q = { x: s.pos.x - s0.x, y: s.pos.y - s0.y, z: s.pos.z - s0.z + 0.11 };
    out.push(q);
    if (q.x >= maxX || s.bounces > 0) break;
  }
  return out;
};
const FAN = [
  { id: "drive", pts: fanPath(simulate({ ...SHOTS.DRIVE_R, duration: 2 }, 30)) },
  { id: "curler", pts: fanPath(simulate({ ...SHOTS.CURLER, duration: 2.5 }, 30)) },
  { id: "volley", pts: fanPath(simulate({ ...SHOTS.VOLLEY, duration: 2 }, 30)) },
  { id: "chip", pts: fanPath(simulate({ ...SHOTS.CHIP, duration: 3 }, 30)) },
];
const PROMISE = fanPath(simulate({ ...SHOTS.DRIVE_L, duration: 1.6 }, 30), 18.8);

const SPOT: Vec3 = { x: 0, y: 0, z: 0.11 };
const BACK: Vec3 = { x: 0, y: -1, z: 0 };
const SIDEWAYS: Vec3 = { x: 0, y: 0, z: 1 };
const FORWARD: Vec3 = { x: 0, y: 1, z: 0 };
const GYRO: Vec3 = { x: 1, y: 0, z: 0 }; // pivot for the forward -> back flip (they are opposite)

const slerpDir = (a: Vec3, b: Vec3, t: number): Vec3 => {
  const v = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

export const S02: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s02");

  // Beats (scene frames). snapCue: audible onsets measured in vo/s02.wav where the word timing starts early.
  const tWrong = cue("What went wrong");
  const tTouch = cue("touches the ball");
  const tSecond = cue("of a second");
  const tAfter = snapCue(cue("After that"), 162);
  const tSnap = cue("on its own", 6);
  const tThree = snapCue(cue("Three kicks tonight"), 231);
  const tKicks = snapCue(cue("kicks"), 238);
  const tTonight = snapCue(cue("tonight"), 243);
  const tIdea = cue("one idea");
  const tSpin = snapCue(cue("spin"), 303);
  const tHow = snapCue(cue("How much"), 341);
  const tWhich = snapCue(cue("which way"), 364);
  const tNone = snapCue(cue("or none at all"), 390);
  const tBy = snapCue(cue("By lights out"), 437);
  const tLights = snapCue(cue("lights"), 441);
  const tOut = snapCue(cue("out"), 448);
  const END = cue.frames;

  const C0 = tWrong + 34; // the ball is back on the boot: freeze
  const creepA = tTouch + 12;
  const creepB = tSecond + 12;
  const cutB = tSnap + 14; // cut to the perspective pitch as the ball leaves the close-up

  // ---------------- Shot A: side view. Rewind, freeze, the hundredth of a second, release. ----------------
  if (frame < cutB) {
    // Everything in shot A as a function of the frame, so the snap point can be found too.
    const stateAt = (f: number) => {
      const cp = interpolateLin(f, creepA, creepB);
      const creepDx = CREEP_M * cp * Math.cos(EL) * PPM;
      const creepDy = -CREEP_M * cp * Math.sin(EL) * PPM;
      // Sim frames after release: very slow motion until the tether snaps, then it speeds up.
      let sf = 0;
      for (let k = tAfter; k < f; k++) {
        const u = progress(k, tSnap, 14, EASE.enter);
        sf += 0.018 + (0.7 - 0.018) * u;
      }
      const released = f >= tAfter;
      const rewinding = f < C0;
      const sfR = LAND * (1 - clamp01((f - 4) / (C0 - 4)));
      // Ball position (world pixels).
      let ball = { x: REST.x + creepDx, y: REST.y + creepDy };
      if (rewinding) {
        const p = project(sampleAt(MISS, sfR).pos, SIDE);
        ball = { x: p.x, y: p.y };
      } else if (released) {
        const p = project(sampleAt(MISS, sf).pos, SIDE);
        ball = { x: p.x + creepDx, y: p.y + creepDy };
      }
      // Tavi: the rewind runs his s01 moves backwards and slides him onto the contact spot.
      const slideIn = rewinding ? smooth(clamp01(1 - sfR / 22)) : 1;
      const hipX = S01_HIP + (FIT.hipX - S01_HIP) * slideIn + creepDx;
      const pose: Pose = rewinding
        ? poseAt(-sfR, [[-LAND, "shrug"], [-34, "stand"], [-12, "follow"], [0, CONTACT]])
        : released
          ? mixPose(CONTACT, POSES.follow, smooth(clamp01(sf / 12)))
          : CONTACT;
      return { cp, creepDx, creepDy, sf, released, rewinding, sfR, ball, hipX, pose };
    };
    const { cp, creepDx, creepDy, sf, released, rewinding, sfR, ball, hipX, pose } = stateAt(frame);

    // Camera: open on s01's last framing, pull back while the ball rewinds, then zoom through to the boot.
    const cam = sideCam(frame, C0, tAfter, tSnap, cutB);
    const face = rewinding && sfR > 14 ? "neutral" : "focus";

    // Squash: compresses through the contact, springs back after release.
    const squash = rewinding
      ? 1
      : released
        ? 1 - 0.07 * Math.exp(-(frame - tAfter) / 10) * Math.cos((frame - tAfter) / 2.2)
        : 1 - 0.07 * Math.sin(Math.PI * (0.5 + cp * 0.5)) - 0.03 * progress(frame, C0, 10, EASE.enter);

    // The spark stays where the tether broke (world point at the snap frame).
    const snapSt = stateAt(tSnap);
    const snapLace = lacesAt(snapSt.pose, snapSt.hipX, FIT.t);
    const spark = toScreen({ x: (snapLace.x + snapSt.ball.x) / 2, y: (snapLace.y + snapSt.ball.y) / 2 }, cam);

    const lace = lacesAt(pose, hipX, FIT.t);
    const sBall = toScreen(ball, cam);
    const sLace = toScreen(lace, cam);
    const toBoot = { x: sLace.x - sBall.x, y: sLace.y - sBall.y };
    const tl = Math.hypot(toBoot.x, toBoot.y) || 1;
    const rScreen = BALL_R * cam.zoom;
    const tetherB = { x: sBall.x + (toBoot.x / tl) * rScreen * 0.9, y: sBall.y + (toBoot.y / tl) * rScreen * 0.9 };

    const flash = frame >= C0 ? 0.35 * (1 - progress(frame, C0, 8, EASE.exit)) : 0;
    const freezeDim = progress(frame, C0, 10, EASE.enter) * (1 - progress(frame, tAfter + 20, 20));

    return (
      <Stage bg={PITCH.sky}>
        <SideWorld cam={cam} seed="s02a">
          <Keeper x={X(GOAL_X) - 8} groundY={GROUND} h={2.1 * PPM} pose={keeperPoseAt(frame, [[0, "crossed"]])} face="thinking" look={-0.5 + idle(frame, 2, 3, 0.2)} />
          <Player x={hipX} groundY={GROUND} h={1.62 * PPM} pose={pose} face={face} />
          {rewinding ? (
            <Flight path={MISS} view={SIDE} at={0} frame={sfR} r={BALL_R * 1.1} trailColor={PITCH.lightSoft} trailOpacity={0.5 * progress(frame, 0, 10)} lineNormal={LINE_N} />
          ) : released ? (
            <g transform={`translate(${creepDx} ${creepDy})`}>
              <Flight path={MISS} view={SIDE} at={0} frame={sf} r={BALL_R} trailColor={PITCH.lightSoft} trailOpacity={0.28 * progress(frame, tSnap, 8)} lineNormal={LINE_N} />
            </g>
          ) : (
            <Ball cx={ball.x} cy={ball.y} r={BALL_R} view={SIDE} lineNormal={LINE_N} squash={squash} />
          )}
        </SideWorld>
        {/* Freeze-frame look: darker edges, the contact point in a pool of light. */}
        {freezeDim > 0.001 ? (
          <g opacity={freezeDim}>
            <defs>
              <radialGradient id="s02-vig" cx="0.47" cy="0.55" r="0.75">
                <stop offset="0.45" stopColor={PITCH.skyHigh} stopOpacity={0} />
                <stop offset="1" stopColor={PITCH.skyHigh} stopOpacity={0.7} />
              </radialGradient>
            </defs>
            <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#s02-vig)" />
          </g>
        ) : null}
        {!rewinding && !released ? (
          <ImpactLines x={sLace.x} y={sLace.y} at={C0 + 2} until={tAfter} r={rScreen * 1.5} angle={(-EL * 180) / Math.PI} />
        ) : null}
        <Tether a={sLace} b={tetherB} at={tAfter} snap={tSnap} width={Math.max(6, rScreen * 0.09)} spark={spark} />
        <Stopwatch x={1300} y={200} value={0.009 * cp} at={C0 + 12} until={tSnap} />
        {!rewinding ? <Label x={sBall.x + 40} y={Math.min(HEIGHT - 90, sBall.y + rScreen + 110)} text="CONTACT" at={tTouch} until={tAfter} size={40} /> : null}
        <RewindTag at={2} until={C0 - 2} />
        {flash > 0.001 ? <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.chalk} opacity={flash} /> : null}
        <Sfx name="whoosh-long" at={0} volume={0.35} />
        <Sfx name="tick" at={C0} volume={0.6} />
        <Sfx name="whoosh" at={C0 + 4} volume={0.3} />
        <Sfx name="pop-soft" at={tTouch} volume={0.35} />
        <Sfx name="tick" at={creepA} volume={0.3} />
        <Sfx name="tick" at={Math.round((creepA + creepB) / 2)} volume={0.3} />
        <Sfx name="tick" at={creepB} volume={0.35} />
        <Sfx name="pop-soft" at={tSnap} volume={0.45} />
        <Sfx name="whoosh" at={tSnap + 4} volume={0.35} />
      </Stage>
    );
  }

  // ---------------- Shot B: perspective pitch. Fan, spin close-up, promise, crane up to the title. ----------------
  const FAN_O = { tx: 7, ty: -0.6, tz: 1.3, dist: 15, yaw: 24, pitch: 9, focal: 1250 };
  const CLOSE_O = { tx: 0, ty: 0, tz: 0.11, dist: 0.8, yaw: 64, pitch: 12, focal: 1250 };
  const BEHIND_O = { tx: 8.5, ty: 0.9, tz: 0.9, dist: 13.5, yaw: 0, pitch: 5, focal: 1250 };
  const TOP_O = { tx: 9.75, ty: 0, tz: 0, dist: 34, yaw: 0, pitch: 89.5, focal: 1250 };
  const tagsOut = tIdea - 3;
  const kick = tLights; // the promise path leaves the spot
  const craneA = kick + 22;
  const craneB = craneA + 36;
  const titleAt = craneB - 18;
  const orbit: Orbit[] = [
    { f: cutB, ...FAN_O },
    { f: tagsOut, ...FAN_O, dist: 13.6, yaw: 21 },
    { f: tSpin + 10, ...CLOSE_O, aimFast: true },
    { f: tBy - 1, ...CLOSE_O, dist: 0.72, yaw: 80, pitch: 13 },
    // Cut on "By lights out" to behind the kicker.
    { f: tBy, ...BEHIND_O },
    { f: craneA, ...BEHIND_O, dist: 13.0 },
    { f: craneB, ...TOP_O },
    { f: END, ...TOP_O, dist: 33 },
  ];
  const view = orbitView(orbitAt(frame, orbit));
  const behind = frame >= tBy;

  // Fan of paths: sprays out at the cut, three brighten, then it fades during the dive to the ball.
  // It shows again, faint, behind the kicker and fades away while the promise path draws.
  const fanStart = cutB + 2;
  const bright = [tThree, tKicks, tTonight];
  const fanOut = behind ? 0.75 * (1 - progress(frame, tBy + 3, 14, EASE.exit)) : 1 - progress(frame, tagsOut, 16, EASE.exit);

  // Spin schedule for the close-up (display turns per second, not the real rate).
  const flip1 = tWhich - 2; // back -> sideways
  const flip2 = flip1 + 13; // sideways -> forward (topspin)
  const flip3 = flip2 + 13; // forward -> back
  const fadeAt = tNone + 2;
  const spinRate = (f: number) =>
    f < tSpin + 2
      ? 0
      : f < tHow
        ? 0.5 * progress(f, tSpin + 2, 12, EASE.soft)
        : f < fadeAt
          ? 0.5 + 1.1 * progress(f, tHow, 12, EASE.standard) - 0.5 * progress(f, flip1, 10, EASE.standard)
          : (1 - progress(f, fadeAt, 18, EASE.soft)) * 1.06 + 0.04;
  const spinAxis = (f: number): Vec3 => {
    if (f < flip1) return BACK;
    if (f < flip2) return slerpDir(BACK, SIDEWAYS, progress(f, flip1, 7, EASE.standard));
    if (f < flip3) return slerpDir(SIDEWAYS, FORWARD, progress(f, flip2, 7, EASE.standard));
    const t = progress(f, flip3, 8, EASE.standard);
    return t < 0.5 ? slerpDir(FORWARD, GYRO, t * 2) : slerpDir(GYRO, BACK, t * 2 - 1);
  };
  let qBall: Quat = [1, 0, 0, 0];
  let phase = 0;
  for (let f = tSpin; f < frame && f < END; f++) {
    const w = (spinRate(f) * 2 * Math.PI) / 30;
    qBall = qMul(qAxis(spinAxis(f), w), qBall);
    phase += w;
  }
  const ori = qToAxisAngle(qBall);
  const axisNow = spinAxis(frame);
  const ringSweep = progress(frame, tSpin, 14, EASE.enter);
  const ringOn = (1 - progress(frame, fadeAt, 12, EASE.exit)) * (frame >= tSpin ? 1 : 0);
  const ringW = 12 + 6 * progress(frame, tHow, 12) - 4 * progress(frame, flip1, 10);

  // Ball on the spot.
  const bp = project(SPOT, view);
  const ballR = 0.11 * bp.scale;

  // Chalk in the goal.
  const kp = project({ x: GOAL_X, y: 0, z: 0 }, view);
  const sink = progress(frame, craneA + 12, 14, EASE.standard);

  // Promise path (DRIVE_L): dotted, drawn at the sim's own pace, ghost ball at its head.
  const promiseN = Math.min(PROMISE.length - 1, Math.max(0, frame - kick));
  const promiseUp = frame < kick ? 0 : promiseN / (PROMISE.length - 1);
  const promiseO = visible(frame, kick, titleAt - 8, 4, 10);
  const ghost = PROMISE[Math.floor(promiseN)];
  const gp = ghost ? project(ghost, view) : null;

  // Title.
  const boxC = project({ x: 9.75, y: 0, z: 0 }, view);
  const slide = progress(frame, titleAt, 18, EASE.standard);

  return (
    <Stage bg={PITCH.skyHigh}>
      <PerspSky view={view} seed="s02b" />
      <PerspPitch view={view} slide={slide} />
      <GoalFront view={view} goalX={GOAL_X} />
      {kp.scale > 0 && kp.x > -300 && kp.x < WIDTH + 300 ? (
        <Keeper
          x={kp.x}
          groundY={kp.y}
          h={2.1 * kp.scale}
          pose={keeperPoseAt(frame, [[cutB, "stand"], [tThree, "stand"], [tThree + 10, "ready"], [kick + 18, "ready"], [kick + 26, "shrug"]])}
          face={frame >= kick + 16 ? "surprised" : "flat"}
          look={frame < tThree ? idle(frame, 1, 3, 0.4) : frame < kick ? -0.3 : -1}
          rise={1 - sink}
        />
      ) : null}
      {sink > 0 && sink < 1 ? <Dust x={kp.x} y={kp.y} at={craneA + 12} size={2.4 * kp.scale} seed="sink" /> : null}

      {/* Fan of ghost paths from the one contact point. */}
      {fanOut > 0.001
        ? FAN.map((p, i) => {
            const n = p.pts.length;
            const up = behind ? 1 : clamp01((frame - (fanStart + i * 4)) / n);
            const isChip = p.id === "chip";
            const lift = behind || isChip ? 0 : progress(frame, bright[i], 10, EASE.enter);
            const dim = behind ? 0 : isChip ? progress(frame, tThree, 10) : 0;
            const op = (0.4 + 0.55 * lift - 0.26 * dim) * fanOut;
            const head = p.pts[Math.min(n - 1, Math.floor(up * (n - 1)))];
            const hp = project(head, view);
            return (
              <g key={p.id}>
                <PerspPath view={view} pts={p.pts} upto={up} width={5 + 5 * lift} opacity={op} color={PITCH.accent} />
                {up > 0 && up < 1 ? <circle cx={hp.x} cy={hp.y} r={Math.max(5, 0.11 * hp.scale)} fill={PITCH.accent} opacity={(0.6 - 0.35 * dim) * fanOut} /> : null}
              </g>
            );
          })
        : null}
      {frame < cutB + 40 ? <Glow cx={bp.x} cy={bp.y} r={120 * (0.6 + 0.4 * progress(frame, cutB, 12))} color={PITCH.light} intensity={1.4 * (1 - progress(frame, cutB + 14, 26))} rings={4} /> : null}

      {/* The ball, with its spin ring in the close-up. */}
      <SpinRing view={view} center={SPOT} radius={0.11 * 1.45} axis={axisNow} phase={phase} part="back" sweep={ringSweep} opacity={ringOn} width={ringW} color={XRAY.lime} />
      <GroundDisc view={view} x={0.03} y={0.02} r={0.12} />
      <Ball cx={bp.x} cy={bp.y} r={ballR} view={view} axis={ori.axis} angle={ori.angle} lineNormal={LINE_N} />
      <SpinRing view={view} center={SPOT} radius={0.11 * 1.45} axis={axisNow} phase={phase} part="front" sweep={ringSweep} opacity={ringOn} width={ringW} color={XRAY.lime} />

      {/* The promise: one dotted path low into the bottom-left corner. */}
      <PerspPath view={view} pts={PROMISE} upto={promiseUp} width={9} opacity={0.9 * promiseO} color={PITCH.chalk} dash="0.1 22" />
      {gp && frame >= kick && frame < kick + PROMISE.length + 6 ? (
        <circle cx={gp.x} cy={gp.y} r={Math.max(7, 0.11 * gp.scale)} fill="none" stroke={PITCH.chalk} strokeWidth={3} strokeDasharray="5 5" opacity={0.7 * promiseO} />
      ) : null}

      {/* Kick tags on the three bright paths. */}
      {!behind ? <FanTags view={view} at={bright} until={tagsOut} /> : null}

      <FloodIcon x={1790} y={150} at={tBy} blink={tOut} until={titleAt - 4} />
      <ChalkTitle lines={["THREE SPINS", "AND A LINE"]} x={boxC.x} y={boxC.y} at={titleAt} size={132} stagger={1} />

      <Sfx name="whoosh" at={cutB - 3} volume={0.3} />
      <Sfx name="air" at={fanStart} volume={0.35} />
      {bright.map((b, i) => (
        <Sfx key={i} name="pop" at={b} volume={0.35} />
      ))}
      <Sfx name="whoosh-long" at={tagsOut} volume={0.3} />
      <Sfx name="air" at={tSpin} volume={0.3} />
      <Sfx name="air" at={tHow} volume={0.35} />
      <Sfx name="air" at={flip1} volume={0.3} />
      <Sfx name="air" at={flip2} volume={0.3} />
      <Sfx name="air" at={flip3} volume={0.3} />
      <Sfx name="whoosh" at={tBy - 3} volume={0.3} />
      <Sfx name="blip" at={tOut} volume={0.4} />
      <Sfx name="thump" at={kick} volume={0.3} />
      <Sfx name="whoosh-long" at={craneA} volume={0.3} />
      <Sfx name="chalk" at={titleAt} volume={0.45} />
      <Sfx name="pop-soft" at={titleAt} volume={0.35} />
      <Sfx name="pop-soft" at={titleAt + 7} volume={0.35} />
      <Sfx name="pop-soft" at={titleAt + 14} volume={0.4} />
      <Sfx name="bell" at={titleAt + 22} volume={0.35} />
    </Stage>
  );
};

/** Linear 0..1 between two frames (time itself: never eased). */
const interpolateLin = (frame: number, a: number, b: number) => clamp01((frame - a) / Math.max(1, b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerpLog = (a: number, b: number, t: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
const lerpP = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
/** Camera that puts world point `w` at screen point `s` with the given zoom. */
const camFor = (w: { x: number; y: number }, s: { x: number; y: number }, zoom: number): SideCam => ({
  x: w.x - (s.x - WIDTH / 2) / zoom,
  y: w.y - (s.y - HEIGHT / 2) / zoom,
  zoom,
});

/** Side camera for shot A. The kick spot is the anchor, so it glides smoothly on screen while the zoom changes. */
const sideCam = (frame: number, C0: number, tAfter: number, tSnap: number, cutB: number): SideCam => {
  const sOpen = toScreen(REST, OPEN_CAM);
  const sMid = toScreen(REST, MID_CAM);
  if (frame < C0) {
    // Pull back from s01's boot close-up while the ball rewinds towards it.
    const t = progress(frame, 3, C0 - 8, EASE.camera);
    return camFor(REST, lerpP(sOpen, sMid, t), lerpLog(OPEN_CAM.zoom, MID_CAM.zoom, t));
  }
  // Zoom-through into the boot, a slow push during the contact, then a small drift back after the snap.
  const zIn = progress(frame, C0 + 2, 26, EASE.camera);
  const push = progress(frame, C0 + 28, tAfter - C0 - 28, EASE.camera);
  const out = progress(frame, tSnap - 2, cutB - tSnap + 2, EASE.camera);
  const zoom = lerpLog(MID_CAM.zoom, 19, zIn) * (1 + 0.07 * push) * (1 - 0.2 * out);
  const a = lerpP(sMid, { x: 900, y: 610 }, zIn);
  return camFor(REST, { x: a.x - 90 * out, y: a.y + 50 * out }, zoom);
};

/**
 * Where the curler starts to bend back: its furthest point to the right (lowest y). The inside-of-the-foot
 * tag pins here, so it sits on the curling path and not near the chip.
 */
const CURL_BEND = (() => {
  const pts = FAN[1].pts;
  let k = 0;
  pts.forEach((p, i) => {
    if (p.y < pts[k].y) k = i;
  });
  return k / (pts.length - 1);
})();

/** Tags for the three kicks. Each one pins to a point on its own path with a short leader line. */
const FanTags: React.FC<{ view: ReturnType<typeof orbitView>; at: number[]; until: number }> = ({ view, at, until }) => {
  const place = (i: number, frac: number, dx: number, dy: number) => {
    const pts = FAN[i].pts;
    const p = project(pts[Math.round((pts.length - 1) * frac)], view);
    return { pin: { x: p.x, y: p.y }, x: p.x + dx, y: p.y + dy };
  };
  // Pills: LACES under the drive, INSIDE above the curler's bend (clear of the chip arc), VOLLEY right of the goal.
  const a = place(0, 0.62, 30, 70);
  const b = place(1, CURL_BEND, -10, -118);
  const c = place(2, 0.72, 150, -34);
  return (
    <g>
      <KickTag x={a.x} y={a.y} pin={a.pin} kind="laces" text="LACES" at={at[0]} until={until} />
      <KickTag x={b.x} y={b.y} pin={b.pin} kind="inside" text="INSIDE" at={at[1]} until={until} />
      <KickTag x={c.x} y={c.y} pin={c.pin} kind="volley" text="VOLLEY" at={at[2]} until={until} />
    </g>
  );
};
