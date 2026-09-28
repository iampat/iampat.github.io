// s18 The top-of-the-bounce wall drill (BOUNCE_DRILL) on the practice board, then the real thing:
// Chalk punches it clear, Tavi lifts it with his thigh, it drops (DROP), and he volleys (side view).
// A 0.6 s tracking close-up shows the Line rolling forward. Then a raised camera behind the kicker,
// pushed in on the goal, shows the VOLLEY dip under the bar, inside the right post, just past
// Chalk's mitten, and into the net.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Ball } from "../kit/Ball";
import { Stage } from "../kit/Camera";
import { Player, POSES, cyclePose, solve, type Face, type Pose } from "../kit/Player";
import { Keeper, keeperPoseAt } from "../kit/Keeper";
import { GoalFront } from "../kit/Goal";
import { Dust, GroundSide, Stars } from "../kit/World";
import { Label, PracticeBoard, SlowMoTag, Stamp } from "../kit/Graphics";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { sampleAt, simulate, spinAngleAt, type BallState } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, clamp01, lerp, pop, popSoft, progress, visible } from "../lib/anim";
import { project, type View } from "../lib/project";
import { CAST, FONTS, PITCH, WIDTH } from "../theme";
import { HangRing, Meter, NetRipple, SolidTrail, SpinArrows, breathe, voCues } from "../kit/ext/s16-s18-fx";
import { ConcreteWall, NightSideBack, PerspStadium, StepMark, placeKicker } from "../kit/ext/s16-s18-night";

// ---------- Physics ----------
const BOUNCE = simulate({ ...SHOTS.BOUNCE_DRILL }, 30);
const DROP = simulate({ ...SHOTS.DROP }, 30);
const VOL = simulate({ ...SHOTS.VOLLEY }, 30);
const TOP_IDX = BOUNCE.reduce((best, s, i) => (s.bounces === 1 && s.pos.z > BOUNCE[best].pos.z ? i : best), 14);
const Z_TOP = BOUNCE[TOP_IDX].pos.z;
const T_STRIKE = TOP_IDX + 0.5; // the top sits between two equal samples
const WALL_M = 2.5; // three big steps
const TAPE_Z = 0.5; // knee-height tape, the same as s07
/** Wall rep: the chapter 1 wall-drill shot at half power ("Start soft"), struck from the top of the bounce. */
const WALL_SHOT = simulate({ ...SHOTS.DRIVE_WALL, speed: SHOTS.DRIVE_WALL.speed * 0.5, start: { x: 0, y: 0, z: Z_TOP }, ground: false, stopAtX: WALL_M - 0.11, duration: 1 }, 30);
const WALL_HIT = WALL_SHOT[WALL_SHOT.length - 1];
const WALL_FRAMES = WALL_SHOT.length - 1;
/** Rebound off the wall: back the way it came at about 45% of its speed, then it bounces and rolls. */
const REBOUND = simulate({ speed: Math.hypot(WALL_HIT.vel.x, WALL_HIT.vel.z) * 0.45, elevationDeg: 10, azimuthDeg: 180, start: WALL_HIT.pos, duration: 2.5 }, 30);
const crossIdx = (path: BallState[], x: number) => {
  for (let i = 1; i < path.length; i++) {
    if (path[i - 1].pos.x < x && path[i].pos.x >= x) return i - 1 + (x - path[i - 1].pos.x) / (path[i].pos.x - path[i - 1].pos.x);
  }
  return path.length - 1;
};
const FC = crossIdx(VOL, 16);
const FNET = crossIdx(VOL, 17.2);
const VOL_AXIS = { x: 0.174, y: 0.985, z: 0 };
const WALL_AXIS = { x: 0, y: -1, z: 0 };
const LINE_N = { x: 0.6, y: 0.5, z: 0.62 };

// ---------- Board window: side view at the wall ----------
const WIN = { x: 120, y: 190, w: 1060, h: 680 };
const WCX = WIN.x + WIN.w / 2;
const WCY = WIN.y + WIN.h / 2;
const W_PPM = 200;
const W_GROUND = 880;
const WALL_X = 1010;
const DROP_X = WALL_X - WALL_M * W_PPM;
const WV: Extract<View, { kind: "side" }> = { kind: "side", originX: DROP_X, groundY: W_GROUND, ppm: W_PPM };
const WH = 1.62 * W_PPM;
const WR = 0.11 * W_PPM;
/** Holding the ball out in front at about 1 m (searched so the drop starts at the BOUNCE_DRILL height). */
const HOLD: Pose = (() => {
  let best: Pose = POSES.hold;
  let err = 1e9;
  for (let sh = 0; sh <= 80; sh += 1) {
    const p: Pose = { ...POSES.stand, torso: 5, head: 10, nearShoulder: sh, nearElbow: 62, farShoulder: sh - 4, farElbow: 66 };
    const j = solve(p, WH);
    const z = (W_GROUND - (W_GROUND - j.lowest + j.nh.y + WR * 0.35)) / W_PPM;
    if (Math.abs(z - SHOTS.BOUNCE_DRILL.start.z) < err) {
      err = Math.abs(z - SHOTS.BOUNCE_DRILL.start.z);
      best = p;
    }
  }
  return best;
})();
const HOLD_J = solve(HOLD, WH);
const HAND_OFF = { x: HOLD_J.nh.x + WR * 0.8, y: HOLD_J.nh.y + WR * 0.35 };
const HOLD_X = DROP_X - HAND_OFF.x;
const START_X = WALL_X - 0.85 * W_PPM;
const HALF = placeKicker(WV, WH, WR, { x: 0, y: 0, z: Z_TOP }, { ...POSES.volley, torso: 16, head: 12, farShoulder: 75 }, { torso: [16], shin: [-8] });
const PLANT: Pose = { ...POSES.plant, torso: 10 };
const FOLLOW_W: Pose = { ...POSES.follow, nearHip: 55, nearKnee: 20, torso: 12 };

// ---------- The real thing: side view (thigh lift + volley) ----------
const G_PPM = 200;
const G_GROUND = 900;
const G_BALL_X = 1060;
const GV: Extract<View, { kind: "side" }> = { kind: "side", originX: G_BALL_X, groundY: G_GROUND, ppm: G_PPM };
const GH = 1.62 * G_PPM;
const GR = 0.11 * G_PPM;
const THIGH: Pose = { ...POSES.stand, torso: 4, head: 14, nearHip: 86, nearKnee: 92, nearAnkle: 110, nearShoulder: 35, nearElbow: 40, farShoulder: 55, farElbow: 30 };
const THIGH_J = solve(THIGH, GH);
const THIGH_TOP = { x: (THIGH_J.hip.x + THIGH_J.nk.x) * 0.5 + GH * 0.02, y: (THIGH_J.hip.y + THIGH_J.nk.y) * 0.5 - GH * 0.045 };
const THIGH_X = G_BALL_X - THIGH_TOP.x;
const THIGH_Z = (THIGH_J.lowest - THIGH_TOP.y) / G_PPM + 0.11;
const I_THIGH = Math.max(1, DROP.findIndex((s) => s.pos.z <= THIGH_Z));
const VOLLEY_K = placeKicker(GV, GH, GR, SHOTS.VOLLEY.start, { ...POSES.volley, torso: 22, head: 12 }, { torso: [22], shin: [-12] });
const BACK: Pose = { ...POSES.plant, torso: 12, nearHip: -32, nearKnee: 96 };

// ---------- Behind-the-kicker perspective ----------
const PV: Extract<View, { kind: "persp" }> = { kind: "persp", cam: { x: -5.5, y: 0, z: 1.45 }, yawDeg: 0, pitchDeg: 0, focal: 2000, cx: 960, cy: 520 };
/**
 * The payoff: a raised camera behind the kicker with a long lens, pushed in on the right half of the goal.
 * It sits above the top of the flight (2.64 m), so the ball never shows above the bar on screen: it dips
 * from the top of its arc into the net. The ball is about 31-47 px across its radius here.
 */
const PG: Extract<View, { kind: "persp" }> = { kind: "persp", cam: { x: -2, y: -1.2, z: 3.7 }, yawDeg: 0, pitchDeg: 0, focal: 5400, cx: 720, cy: -138 };
/** Tracking close-up: the flight sample where it starts and where it hands over to the goal shot (its top). */
const CU_SIM0 = 2;
const CU_SIM1 = 19;
const CU_R = 118;
const CU_BALL = { x: 900, y: 560 };
/** Chalk at the goal line: the dive that reaches just short of the ball. */
const DIVE = { left: 160, right: 112, lean: 58, shift: 0.46, lift: 0.14, stretch: 1.05 };
const DIVE_END = { left: 162, right: 116, lean: 62, shift: 0.48, lift: 0.1, stretch: 1.03 };

// Speech onsets measured on the final VO where whisper drifts (see voCues).
const MEASURED: Record<string, number> = {
  "Volley it at the top": 5.257,
  "where it almost stops": 6.779,
  "Start soft": 8.896,
  "Stay under the tape": 9.774,
  "Now, for real": 11.625,
  "Under the bar": 12.582,
};

// Board text (from the storyboard).
const CUES = ["Eyes on the ball", "Arms out wide", "Knee over ball"];
const SAFETY = ["Solid wall, no windows. Nobody near the wall. Pick a spot far from roads", "and parked cars. Jog and pass easy for 5 minutes. Start at half power."];

export const S18: React.FC = () => {
  const frame = useCurrentFrame();
  const cue0 = useCues("s18");
  const cue = voCues(cue0, MEASURED);

  // ---------- Beats ----------
  const tDrill = cue("Solo drill");
  const tSteps = cue("three big steps");
  const tBounce = cue("Let it bounce once");
  const tVolley = cue("Volley it at the top");
  const tWhere = cue("where it almost stops");
  const tSoft = cue("Start soft");
  const tTape = cue("Stay under the tape");
  const tReal = cue("Now, for real");
  const tBar = cue("Under the bar");
  const END = cue0.frames;

  const boardAt = -16; // already up on frame 0: s17 dissolves straight into this board
  const stepAt = tSteps - 2;
  const STEP = 16;
  const D1 = Math.max(stepAt + 3 * STEP + 4, tBounce - 13); // first drop: it lands on "bounce"
  const STRIKE1 = tWhere + 34; // the laces meet it on "stops"
  const HIT1 = STRIKE1 + WALL_FRAMES;
  const HIT2 = tTape + 2;
  const STRIKE2 = HIT2 - WALL_FRAMES;
  const D2 = Math.round(STRIKE2 - T_STRIKE);
  const newBall = D2 - 12;
  const boardOut = tReal - 25;
  const G1 = boardOut; // punch shot
  const PUNCH = G1 + 8;
  const G2 = PUNCH + 6; // thigh lift, side view
  const V = G2 + I_THIGH + (DROP.length - 1); // volley contact
  const CU0 = V + CU_SIM0; // tracking close-up on the ball
  const CU1 = V + CU_SIM1; // the goal shot, from the top of the arc
  const cross = V + FC;
  const netAt = V + FNET;

  // ---------- Drill ball timing (scene frame -> BOUNCE_DRILL frame) ----------
  // Rep 1 ramps into ultra slow motion after the bounce: the last centimetre of the rise (the ball
  // "almost stops") stretches over the whole phrase, and the leg swings in with it.
  const simT1 = (f: number) =>
    mapFrames(f, [
      [D1, 0],
      [D1 + 13, 13],
      [D1 + 18, 16.5],
      [tVolley, TOP_IDX - 1],
      [STRIKE1, T_STRIKE],
    ]);
  const backStart = HIT1 + 4;
  const rep2 = frame >= D2;
  const st = rep2 ? Math.max(0, Math.min(T_STRIKE, frame - D2)) : simT1(frame);
  const hang = !rep2 && frame >= D1 + 18 && frame < STRIKE1;
  const SWING0 = 16.5;

  // ---------- Drill: Tavi ----------
  const kickPose = (t: number, after: number): Pose => {
    if (after >= 0) return poseMix(HALF.pose, FOLLOW_W, EASE.soft(clamp01(after / 12)));
    const armsDown = clamp01(t / 4);
    const legs = t < 13 ? poseMix(HOLD, PLANT, EASE.soft(t / 13)) : t < SWING0 ? PLANT : poseMix(PLANT, HALF.pose, EASE.standard(clamp01((t - SWING0) / (T_STRIKE - SWING0))));
    return armsDown < 1 ? { ...legs, nearShoulder: lerp(HOLD.nearShoulder, legs.nearShoulder, armsDown), farShoulder: lerp(HOLD.farShoulder, legs.farShoulder, armsDown) } : legs;
  };
  let wx: number;
  let wpose: Pose;
  if (frame < D1) {
    // Near the wall, then three big steps back.
    const k = clamp01((frame - stepAt) / (3 * STEP));
    const stepI = Math.min(2, Math.floor(k * 3));
    const within = k >= 1 ? 1 : EASE.soft((k * 3) % 1);
    const walked = k >= 1 ? 3 : stepI + within;
    wx = lerp(START_X, HOLD_X, walked / 3);
    const walking = frame >= stepAt && frame < stepAt + 3 * STEP;
    const legs = walking ? cyclePose(-(frame - stepAt), "walk", STEP) : POSES.stand;
    wpose = { ...legs, torso: HOLD.torso, head: HOLD.head, nearShoulder: HOLD.nearShoulder, nearElbow: HOLD.nearElbow, farShoulder: HOLD.farShoulder, farElbow: HOLD.farElbow };
  } else if (frame < backStart) {
    wx = lerp(HOLD_X, HALF.x, EASE.standard(clamp01(st / 12)));
    wpose = kickPose(st, frame >= STRIKE1 ? frame - STRIKE1 : -1);
  } else if (frame < D2) {
    // Back to the drop spot; a new ball.
    const back = EASE.standard(progress(frame, backStart, newBall + 4 - backStart, (t) => t));
    wx = lerp(HALF.x, HOLD_X, back);
    const walking = back > 0.02 && back < 0.98;
    const base = poseMix(FOLLOW_W, HOLD, back);
    wpose = walking ? { ...base, ...pickLegs(cyclePose(-(frame - backStart), "walk", 10)) } : base;
  } else {
    wx = lerp(HOLD_X, HALF.x, EASE.standard(clamp01(st / 12)));
    wpose = kickPose(st, frame >= STRIKE2 ? frame - STRIKE2 : -1);
  }
  const wface: Face = hang || (frame >= D2 - 4 && frame < HIT2 + 6) ? "focus" : frame >= HIT1 && frame < HIT1 + 20 ? "happy" : "neutral";

  // ---------- Drill: balls ----------
  const wShown = frame < stepAt || (frame > D1 - 8 && frame < D1) || (frame > newBall && frame < D2) || frame > HIT2 + 14 ? breathe(wpose, frame, 1, 3) : wpose;
  const handBall = () => {
    const j = solve(wShown, WH);
    return { x: wx + HAND_OFF.x, y: W_GROUND - j.lowest + j.nh.y + WR * 0.35, angle: 0, s: 1, axis: undefined as undefined | typeof WALL_AXIS };
  };
  const flightBall = (strikeAt: number, t: number) => {
    if (frame < strikeAt) {
      const p = project(sampleAt(BOUNCE, t).pos, WV);
      return { x: p.x, y: p.y, angle: spinAngleAt(BOUNCE, t) * 0.3, s: 1, axis: undefined as undefined | typeof WALL_AXIS };
    }
    const fw = Math.min(frame - strikeAt, WALL_FRAMES);
    const p = project(sampleAt(WALL_SHOT, fw).pos, WV);
    return { x: p.x, y: p.y, angle: spinAngleAt(WALL_SHOT, fw), axis: WALL_AXIS as undefined | typeof WALL_AXIS, s: 1 };
  };
  const mainBall = (() => {
    if (frame < D1) return handBall();
    if (frame <= HIT1) return flightBall(STRIKE1, st);
    if (frame < newBall) return null;
    if (frame < D2) return { ...handBall(), s: pop(frame, newBall, { stiffness: 240, damping: 14 }) };
    if (frame <= HIT2) return flightBall(STRIKE2, st);
    return null;
  })();
  const rebound = (hit: number) => {
    if (frame <= hit || frame > hit + 28) return null;
    const fr = frame - hit;
    const p = project(sampleAt(REBOUND, fr).pos, WV);
    return { x: p.x, y: p.y, angle: -spinAngleAt(REBOUND, fr), o: 1 - progress(frame, hit + 14, 12, EASE.exit) };
  };
  const rb1 = rebound(HIT1);
  const rb2 = rebound(HIT2);

  // ---------- Drill window camera ----------
  const wc = camAt(frame, [
    { f: 0, x: 730, y: 640, zoom: 1.0 },
    { f: D1, x: 720, y: 640, zoom: 1.04 },
    { f: tVolley - 4, x: DROP_X + 150, y: W_GROUND - 175, zoom: 1.3 },
    { f: STRIKE1, x: DROP_X + 170, y: W_GROUND - 170, zoom: 1.38 },
    { f: HIT1 + 14, x: 740, y: 645, zoom: 1.06 },
    { f: END, x: 735, y: 640, zoom: 1.08 },
  ]);
  const wT = `translate(${WCX} ${WCY}) scale(${wc.zoom}) translate(${-wc.x} ${-wc.y})`;
  const wHorizon = WCY + (W_GROUND - wc.y) * wc.zoom;
  const toWin = (p: { x: number; y: number }) => ({ x: WCX + (p.x - wc.x) * wc.zoom, y: WCY + (p.y - wc.y) * wc.zoom });
  const topP = project({ x: 0, y: 0, z: Z_TOP }, WV);
  const ringAt = toWin(mainBall && !rep2 && frame < STRIKE1 + 2 ? { x: mainBall.x, y: mainBall.y } : topP);
  const hangValue = progress(frame, tVolley, STRIKE1 - 6 - tVolley, (t) => t);

  const drillWindow = (
    <g>
      <defs>
        <clipPath id="s18win">
          <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx={30} />
        </clipPath>
      </defs>
      <g clipPath="url(#s18win)">
        <NightSideBack horizonY={wHorizon} scale={0.42} cx={WCX} shiftX={-(wc.x - 730) * 0.08} id="s18skyW" />
        <g transform={wT}>
          <GroundSide groundY={W_GROUND} vanishX={700} />
          <ConcreteWall x={WALL_X} groundY={W_GROUND} ppm={W_PPM} tapeZ={TAPE_Z} hits={[{ z: WALL_HIT.pos.z, at: HIT1 }, { z: WALL_HIT.pos.z + 0.02, at: HIT2 }]} />
          {[0, 1, 2].map((i) => (
            <StepMark key={i} x={lerp(START_X, HOLD_X, (i + 1) / 3) + 70} y={W_GROUND + 34} n={i + 1} at={stepAt + (i + 1) * STEP - 3} until={D1 + 8} size={50} />
          ))}
          {/* "top" guide at the top of the bounce. */}
          <TopGuide frame={frame} at={tVolley - 6} until={STRIKE1 - 2} y={topP.y} x0={DROP_X - 110} x1={DROP_X + 150} />
          <Player x={wx} groundY={W_GROUND} h={WH} pose={wShown} face={wface} />
          {mainBall ? <Ball cx={mainBall.x} cy={mainBall.y} r={WR * mainBall.s} view={WV} axis={mainBall.axis ?? VOL_AXIS} angle={mainBall.angle} lineNormal={LINE_N} /> : null}
          {[rb1, rb2].map((b, i) =>
            b ? (
              <g key={i} opacity={b.o}>
                <Ball cx={b.x} cy={b.y} r={WR} view={WV} axis={WALL_AXIS} angle={b.angle} lineNormal={LINE_N} />
              </g>
            ) : null,
          )}
          <Dust x={project({ x: 0, y: 0, z: 0 }, WV).x} y={W_GROUND} at={D1 + 13} size={34} seed="b1" />
          <Dust x={WALL_X + 4} y={W_GROUND - WALL_HIT.pos.z * W_PPM} at={HIT1} size={40} seed="w1" />
          <Dust x={WALL_X + 4} y={W_GROUND - WALL_HIT.pos.z * W_PPM} at={HIT2} size={40} seed="w2" />
        </g>
        {/* Hover meter: a ring round the ball fills while it barely moves at the top. */}
        {/* The label sits up and to the right, clear of Tavi's knee and the floodlights, with a leader. */}
        <HangRing cx={ringAt.x} cy={ringAt.y} r={WR * wc.zoom * 2.3} value={hangValue} at={tVolley - 4} until={STRIKE1 + 1} labelDx={262} labelDy={-214} />
        <g transform={`translate(${WIN.x - 40} ${WIN.y - 45})`}>
          <SlowMoTag at={D1 + 16} until={STRIKE1} label="ULTRA SLOW MOTION" />
        </g>
        {/* Counter on the wall side: balls under the tape. */}
        <TapeTally frame={frame} x={WIN.x + WIN.w - 30} y={WIN.y + 28} value={frame >= HIT2 ? 2 : frame >= HIT1 ? 1 : 0} bumpAt={[HIT1, HIT2]} at={tBounce} />
      </g>
    </g>
  );

  // ---------- Board panel ----------
  const PX = 1240;
  const PW = 560;
  const cuesOut = HIT1 + 2;
  const panel = (
    <g>
      <Stamp kind="DRILL" x={1520} y={252} at={tDrill + 2} rotate={-5} />
      {/* Cues first; the Level 2 note takes their place after the first rep. */}
      <CueList frame={frame} x={PX} y={330} items={CUES} at={tDrill + 10} until={cuesOut} />
      <NoteCard frame={frame} x={PX} y={330} w={PW} title="LEVEL 2" lines={["Hit it just as it leaves the", "grass. That is a half-volley."]} at={cuesOut + 8} color={PITCH.teal} />
      <NoteCard frame={frame} x={PX} y={590} w={PW} title="TRICKY?" lines={["Throw the ball to yourself", "at first."]} at={tBounce + 10} color={PITCH.lightSoft} />
      {/* "Start soft" = half power, the same as the safety line and the wall rep's speed. */}
      <Meter x={PX} y={830} w={PW} value={progress(frame, tSoft + 2, 16, EASE.enter) / 2} label="POWER" color={PITCH.light} at={tSoft - 6} size={32} />
      <Label x={PX + PW / 2 + 22} y={847} text="half power" at={tSoft + 14} size={32} anchor="start" bg={PITCH.light} color={PITCH.sky} />
    </g>
  );

  // ---------- Shots after the board ----------
  const inG2 = frame >= G2 && frame < CU0;
  const inCU = frame >= CU0 && frame < CU1;
  const inGoal = frame >= CU1;
  const inPersp = frame >= G1 - 12 && frame < G2;

  // Perspective view: Chalk punches it clear (G1).
  const pz = lerp(1.0, 1.04, progress(frame, G1, 20, EASE.camera));
  const goalBase = project({ x: 16.25, y: 0, z: 0 }, PV);
  const kScale = goalBase.scale;
  const punchPose = keeperPoseAt(frame, [
    [G1, "ready"],
    [PUNCH - 4, "ready"],
    [PUNCH, "punchUp"],
    [PUNCH + 8, "punchUp"],
    [G2, "ready"],
  ]);
  // The punched ball leaves up and towards the camera.
  const glove = { x: goalBase.x + kScale * 0.7, y: goalBase.y - kScale * 2.75 };
  const pt = progress(frame, PUNCH, 9, (t) => t);
  const punchBall = { x: lerp(glove.x, 760, pt), y: lerp(glove.y, -120, pt * pt * 0.4 + pt * 0.6), r: lerp(kScale * 0.11, 70, pt * pt) };

  const perspShot = (
    <g transform={`translate(960 480) scale(${pz}) translate(-960 -480)`}>
      <PerspStadium view={PV} goalX={16} standX={40} />
      <GoalFront view={PV} goalX={16} netOpacity={0.4} />
      <Keeper x={goalBase.x} groundY={goalBase.y} h={2.1 * kScale} pose={punchPose} face={frame >= PUNCH - 2 ? "smug" : "flat"} />
      {frame >= PUNCH && pt < 1 ? (
        <g>
          <line x1={glove.x} y1={glove.y} x2={punchBall.x} y2={punchBall.y} stroke={PITCH.lightSoft} strokeWidth={6} strokeLinecap="round" opacity={0.5 * (1 - pt)} />
          <Ball cx={punchBall.x} cy={punchBall.y} r={punchBall.r} view={PV} axis={{ x: 0, y: 1, z: 0 }} angle={pt * 4} lineNormal={LINE_N} />
        </g>
      ) : null}
      <Dust x={glove.x} y={glove.y} at={PUNCH} size={50} seed="punch" />
    </g>
  );

  // Side view: thigh lift, drop, volley. After contact the ball leaves on the VOLLEY path.
  const gBall = (() => {
    const f = frame - G2;
    if (frame >= V) return sampleAt(VOL, frame - V);
    if (f < I_THIGH) return sampleAt(DROP, I_THIGH - f);
    return sampleAt(DROP, Math.min(DROP.length - 1, f - I_THIGH));
  })();
  const gb = project(gBall.pos, GV);
  const gx = lerp(THIGH_X, VOLLEY_K.x, EASE.standard(progress(frame, G2 + 8, 18, (t) => t)));
  const gpose = poseTrack(frame, [
    [G2, THIGH],
    [G2 + 6, THIGH],
    [G2 + 14, { ...POSES.stand, nearShoulder: 20, farShoulder: 30 }],
    [V - 10, BACK],
    [V - 4, BACK],
    [V, VOLLEY_K.pose],
    [V + 8, { ...POSES.follow, torso: 14, nearHip: 70, nearKnee: 24 }],
  ]);
  const gc = camAt(frame, [
    { f: G2, x: G_BALL_X - 70, y: G_GROUND - 300, zoom: 1.5 },
    { f: V, x: G_BALL_X - 110, y: G_GROUND - 250, zoom: 1.4 },
    { f: CU0, x: G_BALL_X - 104, y: G_GROUND - 252, zoom: 1.39 },
  ]);
  const sideShot = (
    <g>
      <NightSideBack horizonY={540 + (G_GROUND - gc.y) * gc.zoom} scale={0.8} shiftX={-(gc.x - G_BALL_X) * 0.1} id="s18skyG" />
      <g transform={`translate(960 540) scale(${gc.zoom}) translate(${-gc.x} ${-gc.y})`}>
        <GroundSide groundY={G_GROUND} vanishX={900} />
        <Player x={gx} groundY={G_GROUND} h={GH} pose={gpose} face="focus" />
        <Ball cx={gb.x} cy={gb.y} r={GR} view={GV} axis={frame >= V ? VOL_AXIS : { x: 0, y: 1, z: 0 }} angle={frame >= V ? spinAngleAt(VOL, frame - V) : (frame - G2) * 0.05} lineNormal={LINE_N} />
      </g>
    </g>
  );

  // Tracking close-up (real speed): the camera rides with the ball, the stand slides away behind it,
  // and the Line rolls forward (topspin: the top of the ball turns toward the goal).
  const cuShot = (() => {
    const ts = clamp01((frame - CU0) / (CU1 - CU0)) * (CU_SIM1 - CU_SIM0) + CU_SIM0;
    const st = sampleAt(VOL, ts);
    const a = Math.atan2(st.vel.z, st.vel.x); // flight angle, up is positive
    const k = (ts - CU_SIM0) / (CU_SIM1 - CU_SIM0);
    const horizonY = 720 + (st.pos.z - 0.9) * 170;
    const back = { x: -Math.cos(a), y: Math.sin(a) }; // screen direction behind the ball
    const nrm = { x: -back.y, y: back.x };
    const tail = 360;
    const bx = CU_BALL.x;
    const by = CU_BALL.y;
    const wedge = (w: number, len: number) =>
      `M${bx + nrm.x * w},${by + nrm.y * w} L${bx + back.x * len},${by + back.y * len} L${bx - nrm.x * w},${by - nrm.y * w} Z`;
    const streaks = Array.from({ length: 11 }, (_, i) => {
      const y0 = 90 + ((i * 373) % 900);
      const u = (((i * 617 + 200 - (frame - CU0) * 150) % 2400) + 2400) % 2400 - 240;
      const len = 150 + (i % 4) * 45;
      const dy = (frame - CU0) * 150 * Math.tan(a) * 0.4;
      return <line key={i} x1={u} y1={y0 + dy} x2={u + len} y2={y0 + dy} stroke={PITCH.chalk} strokeWidth={4 + (i % 3)} strokeLinecap="round" opacity={0.18 + 0.1 * (i % 3)} />;
    });
    return (
      <g>
        <NightSideBack horizonY={horizonY} scale={1.3} shiftX={200 - 400 * k} id="s18skyC" />
        {streaks}
        <path d={wedge(CU_R * 0.9, tail)} fill={PITCH.accent} opacity={0.16} />
        <path d={wedge(CU_R * 0.62, tail * 0.75)} fill={PITCH.accent} opacity={0.24} />
        <path d={wedge(CU_R * 0.34, tail * 0.5)} fill={PITCH.lightSoft} opacity={0.3} />
        <SpinArrows cx={bx} cy={by} r={CU_R} angle={(frame - CU0) * 0.06} dir={1} color={PITCH.teal} opacity={progress(frame, CU0 + 2, 5)} width={11} />
        <Ball cx={bx} cy={by} r={CU_R} view={GV} axis={VOL_AXIS} angle={spinAngleAt(VOL, ts)} lineNormal={LINE_N} />
        <Label x={bx - CU_R * 1.55} y={by - CU_R * 1.45} text="topspin" at={CU0 + 3} until={CU1 - 3} size={40} bg={PITCH.teal} color={PITCH.sky} />
      </g>
    );
  })();

  // The goal shot: the ball dips from the top of its arc under the bar, just past the mitten, into the net.
  const gz = lerp(1.0, 1.05, progress(frame, CU1, END - CU1, EASE.camera));
  const gFocus = project({ x: 16, y: -1.6, z: 1.2 }, PG);
  const goalG = project({ x: 16.25, y: 0, z: 0 }, PG);
  const kPose = keeperPoseAt(frame, [
    [CU1, "ready"],
    [cross - 9, "ready"],
    [cross - 1, DIVE],
    [cross + 20, DIVE_END],
  ]);
  const tf = Math.max(CU_SIM1, Math.min(frame - V, FNET));
  const volPts = VOL.slice(CU_SIM1, Math.floor(tf) + 1).map((st) => project(st.pos, PG));
  const volNow = project(sampleAt(VOL, tf).pos, PG);
  volPts.push(volNow);
  const inNet = frame >= netAt;
  const netDrop = progress(frame, netAt + 3, 14, EASE.enter);
  const netBottom = project({ x: 17.2, y: sampleAt(VOL, FNET).pos.y, z: 0.11 }, PG);
  const volDraw = inNet ? { x: lerp(volNow.x, netBottom.x, netDrop), y: lerp(volNow.y, netBottom.y, netDrop) } : { x: volNow.x, y: volNow.y };
  const netPt = project(sampleAt(VOL, FNET).pos, PG);
  const goalShot = (
    <g transform={`translate(${gFocus.x} ${gFocus.y}) scale(${gz}) translate(${-gFocus.x} ${-gFocus.y})`}>
      <PerspStadium view={PG} goalX={16} standX={40} />
      <GoalFront view={PG} goalX={16} netOpacity={0.45} />
      <Keeper x={goalG.x} groundY={goalG.y} h={2.1 * goalG.scale} pose={kPose} face={frame >= cross - 4 ? "surprised" : "flat"} look={0.7} />
      {/* The trail starts at the top of the arc (this shot's first frame), so it never crosses Chalk. */}
      <SolidTrail pts={volPts} color={PITCH.accent} core={PITCH.lightSoft} width={12} opacity={0.9 * (1 - progress(frame, netAt + 8, 14))} />
      <Ball cx={volDraw.x} cy={volDraw.y} r={Math.max(31, 0.11 * volNow.scale)} view={PG} axis={VOL_AXIS} angle={spinAngleAt(VOL, tf) + (inNet ? netDrop * 2 : 0)} lineNormal={LINE_N} />
      <NetRipple cx={netPt.x} cy={netPt.y} at={netAt} size={110} squashY={0.8} />
    </g>
  );

  const bgDark = (
    <g>
      <rect x={0} y={0} width={WIDTH} height={1080} fill={PITCH.skyHigh} />
      <Stars count={70} seed="s18bg" maxY={1080} opacity={0.6} />
    </g>
  );

  return (
    <Stage bg={PITCH.skyHigh}>
      {inGoal ? goalShot : inCU ? cuShot : inG2 ? sideShot : inPersp ? perspShot : bgDark}
      <PracticeBoard at={boardAt} until={boardOut} title="SOLO DRILL">
        {drillWindow}
        {panel}
        <SafetyStrip frame={frame} x={120} y={892} w={WIN.w + 620} at={tSoft + 4} />
      </PracticeBoard>

      {/* Sound. */}
      <Sfx name="stamp" at={tDrill + 2} volume={0.5} />
      {[0, 1, 2].map((i) => (
        <Sfx key={i} name="pop-soft" at={stepAt + (i + 1) * STEP - 3} volume={0.3} />
      ))}
      <Sfx name="thump" at={D1 + 13} volume={0.35} />
      <Sfx name="blip" at={tVolley} volume={0.3} />
      <Sfx name="air" at={tVolley + 4} volume={0.25} />
      <Sfx name="thump" at={STRIKE1} volume={0.45} />
      <Sfx name="thump" at={HIT1} volume={0.5} />
      <Sfx name="tick" at={HIT1 + 2} volume={0.45} />
      <Sfx name="pop" at={newBall} volume={0.3} />
      <Sfx name="tick" at={tSoft + 4} volume={0.35} />
      <Sfx name="tick" at={tSoft + 10} volume={0.35} />
      <Sfx name="thump" at={D2 + 13} volume={0.3} />
      <Sfx name="thump" at={STRIKE2} volume={0.4} />
      <Sfx name="thump" at={HIT2} volume={0.5} />
      <Sfx name="tick" at={HIT2 + 2} volume={0.45} />
      <Sfx name="whoosh" at={boardOut} volume={0.35} />
      <Sfx name="pop" at={PUNCH} volume={0.45} />
      <Sfx name="chalk" at={PUNCH} volume={0.3} />
      <Sfx name="thump" at={G2} volume={0.25} />
      <Sfx name="thump" at={V} volume={0.6} />
      <Sfx name="whoosh" at={CU0} volume={0.4} />
      <Sfx name="whoosh" at={Math.max(CU1, tBar)} volume={0.22} />
      <Sfx name="net" at={netAt} volume={0.55} />
      <Sfx name="bell" at={netAt + 6} volume={0.25} />
    </Stage>
  );
};

// ---------- Helpers ----------

type Cam = { x: number; y: number; zoom: number };
const camAt = (f: number, ks: ({ f: number } & Cam)[]): Cam => {
  if (f <= ks[0].f) return ks[0];
  for (let i = 1; i < ks.length; i++) {
    if (f <= ks[i].f) {
      const t = EASE.camera((f - ks[i - 1].f) / Math.max(1, ks[i].f - ks[i - 1].f));
      return { x: lerp(ks[i - 1].x, ks[i].x, t), y: lerp(ks[i - 1].y, ks[i].y, t), zoom: lerp(ks[i - 1].zoom, ks[i].zoom, t) };
    }
  }
  return ks[ks.length - 1];
};

/** Piecewise-linear map from scene frames to simulation frames (a slow-motion ramp, never an ease on the ball). */
const mapFrames = (f: number, pts: [number, number][]) => {
  if (f <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (f <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (f - pts[i - 1][0]) / Math.max(1e-6, pts[i][0] - pts[i - 1][0]));
  }
  return pts[pts.length - 1][1];
};

/** Only the leg angles of a pose (to walk while the arms do something else). */
const pickLegs = (p: Pose): Partial<Pose> => ({ nearHip: p.nearHip, nearKnee: p.nearKnee, nearAnkle: p.nearAnkle, farHip: p.farHip, farKnee: p.farKnee, farAnkle: p.farAnkle, lift: p.lift });

const poseMix = (a: Pose, b: Pose, t: number): Pose => {
  const out: Record<string, number> = {};
  for (const k of Object.keys({ ...a, ...b }) as (keyof Pose)[]) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * t;
  return out as unknown as Pose;
};

const poseTrack = (f: number, track: [number, Pose][]): Pose => {
  if (f <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    if (f <= track[i][0]) {
      const t = (f - track[i - 1][0]) / Math.max(1, track[i][0] - track[i - 1][0]);
      return poseMix(track[i - 1][1], track[i][1], t * t * (3 - 2 * t));
    }
  }
  return track[track.length - 1][1];
};

/** Dashed line at the top of the bounce with a small "top" tag (world space, about 34 px on screen when zoomed). */
const TopGuide: React.FC<{ frame: number; at: number; until: number; y: number; x0: number; x1: number }> = ({ frame, at, until, y, x0, x1 }) => {
  const o = visible(frame, at, until, 10, 8);
  if (o <= 0.001) return null;
  const d = progress(frame, at, 16, EASE.enter);
  return (
    <g opacity={o}>
      <line x1={x0} y1={y} x2={x0 + (x1 - x0) * d} y2={y} stroke={PITCH.lightSoft} strokeWidth={4} strokeDasharray="12 10" strokeLinecap="round" />
      <Label x={x1 + 10} y={y} text="top" at={at + 8} until={until} size={26} anchor="start" bg={PITCH.lightSoft} color={PITCH.sky} />
    </g>
  );
};

/** The three cues, one after another. */
const CueList: React.FC<{ frame: number; x: number; y: number; items: string[]; at: number; until: number }> = ({ frame, x, y, items, at, until }) => {
  const o = visible(frame, at, until, 12, 8);
  if (o <= 0.001) return null;
  return (
    <g opacity={o}>
      <text x={x} y={y + 24} fill={PITCH.lightSoft} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={4}>
        CUES
      </text>
      {items.map((t, i) => {
        const s = popSoft(frame, at + 4 + i * 6);
        return (
          <g key={t} transform={`translate(${x} ${y + 88 + i * 66})`} opacity={Math.min(1, s)}>
            <circle cx={20} cy={-12} r={20 * s} fill={PITCH.teal} />
            <path d="M11,-12 L18,-5 L30,-19" fill="none" stroke={PITCH.sky} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={s} />
            <text x={56} y={0} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={38}>
              {t}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** A board note: a coloured title pill and two short lines. */
const NoteCard: React.FC<{ frame: number; x: number; y: number; w: number; title: string; lines: string[]; at: number; color: string }> = ({ frame, x, y, w, title, lines, at, color }) => {
  const o = visible(frame, at, undefined, 12);
  if (o <= 0.001) return null;
  const h = 76 + lines.length * 44;
  const tw = title.length * 25 + 40;
  return (
    <g opacity={o} transform={`translate(${x} ${y + (1 - o) * 14})`}>
      <rect width={w} height={h} rx={26} fill="#16324B" />
      <rect x={20} y={18} width={tw} height={44} rx={22} fill={color} />
      <text x={20 + tw / 2} y={51} fill={PITCH.sky} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={2}>
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={i} x={22} y={104 + i * 44} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={32}>
          {l}
        </text>
      ))}
    </g>
  );
};

/** The wall safety line, as a strip across the bottom of the board. */
const SafetyStrip: React.FC<{ frame: number; x: number; y: number; w: number; at: number }> = ({ frame, x, y, w, at }) => {
  const o = visible(frame, at, undefined, 12);
  if (o <= 0.001) return null;
  return (
    <g opacity={o} transform={`translate(${x} ${y + (1 - o) * 14})`}>
      <rect width={w} height={104} rx={24} fill="#16324B" />
      <rect x={18} y={29} width={176} height={46} rx={23} fill={CAST.mistake} />
      <text x={106} y={63} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3}>
        SAFETY
      </text>
      {SAFETY.map((l, i) => (
        <text key={i} x={216} y={44 + i * 42} fill={PITCH.chalk} fontFamily={FONTS.label} fontWeight={800} fontSize={32}>
          {l}
        </text>
      ))}
    </g>
  );
};

/** Counter with no words: a ball under a strip of tape, then the count. Right-aligned at x. */
const TapeTally: React.FC<{ frame: number; x: number; y: number; value: number; bumpAt: number[]; at: number }> = ({ frame, x, y, value, bumpAt, at }) => {
  const o = visible(frame, at, undefined, 12);
  if (o <= 0.001) return null;
  const bump = bumpAt.reduce((m, f) => Math.max(m, frame >= f ? 1 - progress(frame, f, 12, EASE.soft) : 0), 0);
  const w = 210;
  return (
    <g opacity={o} transform={`translate(${x - w} ${y})`}>
      <rect width={w} height={112} rx={26} fill={PITCH.skyHigh} opacity={0.85} />
      <rect x={22} y={34} width={82} height={12} rx={6} fill={PITCH.light} />
      <circle cx={63} cy={74} r={18} fill={CAST.ball} />
      <g transform={`translate(${156} ${84}) scale(${1 + 0.3 * bump})`}>
        <text x={0} y={0} fill={bump > 0.05 ? PITCH.light : PITCH.chalk} fontFamily={FONTS.mono} fontWeight={500} fontSize={76} textAnchor="middle">
          {value}
        </text>
      </g>
    </g>
  );
};
