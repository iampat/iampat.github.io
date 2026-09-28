// b12 TOUCH practice. The board rises over b11's wheel map and stays up to the cut. Three cue chips on top.
// Panel A (map) fills the board while it is the focus: the classic mistake, the ball killed dead under the
// feet while Chalk arrives (ring pink), then the fix slides in beside it: the aim arrow and "I already know
// where I'm going" before the ball arrives, the soft touch rolling 2 m into the space. On "Wall drill" panel A
// shrinks into the top row and panel B (side view) enters: the wall drill alone, 5 m from the wall under the
// stand, a cone with one eyebrow standing in for Chalk: cushion the return, then one touch out of a 2 m chalk
// box away from the cone, pass again from there, swap feet (the rig mirrors), start soft. The drill steps stay
// on the board. The car park far behind appears on its line and blinks once.
// Every roll is rollAt on grass; the wall keeps 0.8 of the speed (DRILLS.wall); touches from TOUCHES.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../../kit/Camera";
import { TopField } from "../../kit/Field";
import { TopPlayer, angleTo } from "../../kit/TopPlayer";
import { TimeBubble } from "../../kit/TimeBubble";
import { Ball } from "../../kit/Ball";
import { Player, POSES, cyclePose, mixPose, poseAt, type Pose } from "../../kit/Player";
import { Arrow, Label, PracticeBoard, Stamp } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { CarPark, Dust, Glow } from "../../kit/World";
import { easeT } from "../../kit/ep2";
import { chalkAt, passInAt, DRILLS, TOUCHES } from "../../physics/ep2sims";
import { rollAt, CHASE_SPEED } from "../../physics/touch";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, progress, visible } from "../../lib/anim";
import type { View } from "../../lib/project";
import { HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import {
  ChalkBox,
  ConeChalk,
  CornerMarks,
  DrillMiniMap,
  DrillWall,
  HazardLights,
  NoteLine,
  NumberChips,
  RECEIVE,
  RingIcon,
  SafetyLine,
  StandBand,
  TalkBubble,
  WheelScene,
  chaseAt,
  obliqueP,
  swapLegs,
} from "../../kit/ext/ep2-b11-b12-parts";

// ---------- Board layout ----------
// Panel A fills the board (BIG_H) until "Wall drill", then shrinks into the top row (STRIP_H) above panel B.
const PA = { x: 130, y: 250, w: 1660 };
const BIG_H = 730;
const STRIP_H = 240;
const PB = { x: 130, y: 504, w: 1660, h: 286 };
const HALF_W = 820; // each map in panel A
const FIX_X = PA.w - HALF_W; // the fix map's left edge inside panel A
const NOTE_X = 150;
const NOTE_X2 = 1010; // the right note column
const ROWS = [840, 886, 932];
const CARD = { x: 1230, y: 18, w: 420 }; // the drill mini map, docked inside panel B
/** Strip centre (half-local) and the content scale once panel A is a strip. */
const STRIP_C = { x: HALF_W / 2, y: STRIP_H / 2 };
const STRIP_K = 0.7;

// ---------- Panel A: the LOOK_STEP receive, 100 px per metre (half-local pixels) ----------
const { MEET, C0, AWAY_U, AWAY_SPEED, SECOND_TOUCH, DEAD_D, DEAD_ARRIVE, AWAY_SCREEN, CHASE_AWAY, END } = RECEIVE;
const A_PPM = 100;
/** Tavi's mark per map: the mistake keeps Chalk's run in frame, the fix keeps the space in frame. */
const ORIGIN = { dead: { x: 290, y: 420 }, away: { x: 400, y: 480 } };
/** The point of each map that lands in the strip's centre when panel A shrinks. */
const FOCUS = { dead: { x: 260, y: 400 }, away: { x: 300, y: 350 } };
const TOKEN_A = 70;
const BALL_RA = 15;

type HalfProps = { frame: number; mode: "dead" | "away"; T: number; ringAt: number; aimAt?: number; talk?: number };

/** One map: the same pass in, then the dead stop (Chalk arrives) or the touch away (2 m into the space). */
const HalfMap: React.FC<HalfProps> = ({ frame, mode, T, ringAt, aimAt, talk = 0 }) => {
  const dead = mode === "dead";
  const O = ORIGIN[mode];
  const view: View = { kind: "top", originX: O.x, originY: O.y, ppm: A_PPM };
  const AP = (x: number, y: number) => ({ x: O.x + x * A_PPM, y: O.y - y * A_PPM });
  const tt = MEET.t - Math.max(0, T - frame) / 30;
  let tavi = { x: Math.max(MEET.x, -Math.max(0, tt - 1.5) * 2), y: 0 };
  let facing = 180;
  let look = 0;
  let stride: number | undefined = tt > 1.5 && frame < T ? (frame * 0.1) % 1 : undefined;
  let ball = { x: tt >= 0 ? passInAt(tt).x : -12, y: 0 };
  let rolled = tt >= 0 ? ball.x + 12 : 0;
  let chalk: { x: number; y: number } = frame < T ? chalkAt(tt) : { x: C0.x, y: C0.y };
  let chalkStride: number | undefined = tt > 0 && frame < T ? (frame * 0.13) % 1 : undefined;
  let seconds = Math.hypot(chalk.x - tavi.x, chalk.y - tavi.y) / CHASE_SPEED;
  let chalkFace: number | undefined;
  const aimT = aimAt === undefined ? 0 : progress(frame, aimAt, 14, EASE.enter);
  if (!dead && frame < T) {
    // Already facing the space; the head keeps the ball.
    facing = lerp(180, AWAY_SCREEN, aimT);
    look = 180 - facing;
  }
  const arrive = T + DEAD_ARRIVE * 30;
  if (frame >= T) {
    const u = (frame - T) / 30;
    if (dead) {
      const dx = (MEET.x - C0.x) / DEAD_D;
      const dy = -C0.y / DEAD_D;
      const run = Math.min(DEAD_D - 0.4, CHASE_SPEED * u);
      const arrived = run >= DEAD_D - 0.4;
      chalk = { x: C0.x + dx * run, y: C0.y + dy * run };
      chalkStride = !arrived ? (frame * 0.13) % 1 : undefined;
      seconds = Math.max(0, DEAD_D - CHASE_SPEED * u) / CHASE_SPEED;
      ball = { x: MEET.x - 0.14, y: 0.06 };
      tavi = { x: MEET.x, y: 0 };
      if (arrived) chalkFace = angleTo(chalk.x, chalk.y, MEET.x - 0.14, -0.06) + idle(frame, 7, 3.4, 6);
    } else {
      const v = Math.min(SECOND_TOUCH, u);
      const c = chaseAt(CHASE_AWAY, v * 30);
      chalk = { x: c.x, y: c.y };
      chalkStride = v < SECOND_TOUCH ? (frame * 0.13) % 1 : undefined;
      ball = { x: c.bx, y: c.by };
      rolled = 12 + MEET.x + rollAt(AWAY_SPEED, v).x;
      const k = v / SECOND_TOUCH;
      tavi = { x: lerp(MEET.x, END.x, k) - AWAY_U.x * 0.28, y: lerp(0, END.y, k) - AWAY_U.y * 0.28 };
      facing = AWAY_SCREEN;
      stride = v < SECOND_TOUCH ? (frame * 0.11) % 1 : undefined;
      seconds = c.dist / CHASE_SPEED;
    }
  }
  const sway = idle(frame, dead ? 1 : 2, 2.8, 2) * (dead && frame >= T ? 0.5 : 1);
  const tp = AP(tavi.x, tavi.y);
  const tpy = tp.y + sway;
  const bp = AP(ball.x, ball.y);
  const cp = AP(chalk.x, chalk.y);
  const touchPx = AP(MEET.x, 0);
  const spacePx = AP(END.x, END.y);
  const spaceT = dead ? 0 : progress(frame, T, 20, EASE.enter);
  return (
    <g>
      <TopField view={view} x0={-12} x1={20} y0={-6} y1={6} stripeM={3} lines={false} />
      {spaceT > 0.001 ? (
        <g>
          <circle cx={spacePx.x} cy={spacePx.y} r={150 * easeT(spaceT)} fill={XRAY.lime} opacity={0.16} />
          <circle cx={spacePx.x} cy={spacePx.y} r={(106 + idle(frame, 5, 3, 5)) * easeT(spaceT)} fill={XRAY.lime} opacity={0.1} />
        </g>
      ) : null}
      {/* The aim, drawn before the ball arrives. */}
      {!dead && aimAt !== undefined ? <Arrow x1={touchPx.x} y1={touchPx.y} x2={spacePx.x + AWAY_U.x * 8} y2={spacePx.y - AWAY_U.y * 8} at={aimAt} until={T + 6} dur={14} color={XRAY.lime} width={9} /> : null}
      {/* The ball's path after the touch away: a faint chalk trail. */}
      {!dead && frame > T ? <line x1={touchPx.x} y1={touchPx.y} x2={bp.x} y2={bp.y} stroke={PITCH.chalk} strokeWidth={5} strokeDasharray="3 14" strokeLinecap="round" opacity={0.45} /> : null}
      <TimeBubble x={tp.x} y={tpy} seconds={seconds} pxPerSecond={90} minRadius={38} maxRadius={200} fontSize={38} at={ringAt} until={dead ? Math.round(arrive) - 2 : undefined} alarm={dead ? undefined : false} />
      <TopPlayer x={cp.x} y={cp.y} kind="chalk" size={TOKEN_A} facing={chalkFace ?? angleTo(cp.x, cp.y, bp.x, bp.y)} stride={chalkStride} />
      <TopPlayer x={tp.x} y={tpy} kind="tavi" size={TOKEN_A} facing={facing} look={look} stride={stride} />
      <Ball cx={bp.x} cy={bp.y} r={BALL_RA} view={view} axis={{ x: 0, y: 1, z: 0 }} angle={rolled / 0.11} />
      {dead ? <Dust x={bp.x + 12} y={bp.y} at={Math.round(arrive)} size={54} seed="stop" /> : null}
      {/* Tavi's line; the tail follows her token wherever she is. */}
      {talk > 0.001 ? <TalkBubble x={560} y={236} lines={["I already know", "where I'm going"]} tx={tp.x + 6} ty={tpy - TOKEN_A * 0.42} s={talk} size={34} /> : null}
    </g>
  );
};

// ---------- Panel B: the wall drill, oblique side view (panel-local pixels) ----------
const B_PPM = 70;
const B_OX = 700; // Tavi's mark
const B_GY = 210; // her ground line (y = 0)
const BP = obliqueP(B_OX, B_GY, B_PPM, 0.45, 0.26);
const SIDE_B: View = { kind: "side", originX: B_OX, groundY: B_GY, ppm: B_PPM };
const H_T = 1.62 * B_PPM;
const BALL_RB = 11;
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const WALL_D = DRILLS.wall.distance; // 5 m
const OUT_V = DRILLS.wall.speed; // 6 m/s
const KEEP = DRILLS.wall.wallKeeps; // the wall returns 0.8 of the speed
const FOOT_X = -0.3; // the ball's spot in front of her toe, metres
const GO = WALL_D + FOOT_X - 0.11; // the ball centre's run to the wall face
const CONE = { x: 0.6, y: -3 };
const BOX_TOUCH = DRILLS.boxTouch; // 2.0 m/s out of the box
const GIVE_M = 0.13; // how far the foot carries the ball while it gives
const GIVE: Pose = { ...POSES.receiveSoft, nearHip: 15, nearKnee: 26, torso: 12, head: 10 };
/** Seconds a ball at v m/s needs to roll d metres on grass. */
const tRoll = (v: number, d: number) => (v - Math.sqrt(Math.max(0, v * v - 2 * 0.8 * d))) / 0.8;
const T_GO = tRoll(OUT_V, GO);
const V_HIT = OUT_V - 0.8 * T_GO;
const V_BACK = KEEP * V_HIT; // about 4.3 m/s off the wall
const T_BACK = tRoll(V_BACK, GO);
const REP = (T_GO + T_BACK) * 30; // frames from her pass to the return at her foot (about 2 s)
const HIT = T_GO * 30;
// The cushion: WALL_CUSHION gives -0.02 m/s, a dead stop.
const CUSHION_OUT = Math.abs(TOUCHES.WALL_CUSHION().x);

export const B12: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b12");
  const END_F = cue.frames;

  // Beats.
  const tClassic = cue("Classic mistake");
  const tDead = cue("dead");
  const tFix = cue("Fix");
  const tSoft = cue("soft foot");
  const tAimed = cue("aimed where you're going");
  const tWall = cue("Wall drill, alone");
  const tCushion = cue("Cushion the return");
  const tThen = cue("Then one touch out of a box");
  const tBox = cue("box");
  const tAway = cue("away from a cone");
  const tSwap = cue("Swap feet");
  const tStart = cue("Start soft");
  const tCar = cue("The car park");
  const tEnough = cue("enough");
  // The board stays up through the cut; b13 opens on its own card.
  const boardOut = END_F + 30;

  // ---------- Panel A clocks ----------
  const T1 = tDead; // the dead stop lands on "dead"
  const arrive1 = Math.round(T1 + DEAD_ARRIVE * 30);
  const fixIn = progress(frame, tFix, 16, EASE.standard); // the fix map slides in from the right
  const T2 = tAimed + 6;
  const aimAt = tSoft + 4;
  const second2 = Math.round(T2 + SECOND_TOUCH * 30);
  const dimMistake = 1 - 0.45 * progress(frame, tFix + 4, 14, EASE.standard);
  const dimA = 1 - 0.4 * progress(frame, tWall, 12, EASE.standard);
  const marksFix = visible(frame, second2 + 6, tWall - 10, 8, 6);
  // Panel A shrinks into the top row just before panel B enters on "Wall drill".
  const shrinkAt = tWall - 8;
  const shrink = progress(frame, shrinkAt, 14, EASE.standard);
  const paH = lerp(BIG_H, STRIP_H, shrink);
  const k = lerp(1, STRIP_K, shrink);
  const fit = (F: { x: number; y: number }) => `translate(${lerp(F.x, STRIP_C.x, shrink)} ${lerp(F.y, STRIP_C.y, shrink)}) scale(${k}) translate(${-F.x} ${-F.y})`;
  // Tavi's line pops while she waits at the touch point with the aim arrow, and leaves before the shrink.
  const talk = visible(frame, tAimed - 4, tWall - 12, 10, 8);

  // ---------- Panel B clocks ----------
  const K1 = Math.round(tCushion - REP); // she passed just before the panel opens; the return lands on "Cushion"
  const hit1 = Math.round(K1 + HIT);
  const arr1 = Math.round(K1 + REP);
  const K2 = arr1 + 20;
  const hit2 = Math.round(K2 + HIT);
  const arr2 = Math.max(Math.round(K2 + REP), tBox - 2); // the touch out of the box lands on "box"
  const walkAt = arr2 + 6;
  const K3 = walkAt + 32; // the pass from the far spot
  const Y3 = rollAt(BOX_TOUCH, (K3 - arr2) / 30).x; // where the touched ball is when she reaches it
  const hit3 = Math.round(K3 + HIT);
  const arr3 = Math.round(K3 + REP);
  const mirrorAt = K3 + 12; // the rig mirrors for the left-foot rep
  const panelIn = progress(frame, tWall + 2, 10, EASE.enter);
  const drillStamp = tWall + 6;
  const coneAt = tWall + 10;
  const boxAt = tThen;
  const panT = progress(frame, tCar - 2, 26, EASE.camera);
  const pan = -120 * panT;
  const blink = (frame >= tCar + 26 && frame < tCar + 30) || (frame >= tCar + 34 && frame < tCar + 38) ? 1 : 0;
  // The car park far behind: only on its line. The mini map steps aside for it.
  const carT = progress(frame, tCar, 14, EASE.enter);
  const cardO = progress(frame, tWall + 12, 12, EASE.enter) * (1 - progress(frame, tCar - 4, 10, EASE.exit));

  // The ball in panel B (pitch metres; rolled metres for the spin).
  const ballAt = (f: number) => {
    const rep = (K: number, y: number, g: number) => {
      // One rep: out to the wall, back, cushioned dead. Returns null before K.
      if (g < K) return null;
      const t = (g - K) / 30;
      if (t < T_GO) return { x: FOOT_X - rollAt(OUT_V, t).x, y, rolled: rollAt(OUT_V, t).x };
      const t2 = t - T_GO;
      if (t2 < T_BACK) return { x: FOOT_X - GO + rollAt(V_BACK, t2).x, y, rolled: GO + rollAt(V_BACK, t2).x };
      const give = easeT(clamp01((t2 - T_BACK) / (8 / 30)));
      // After the give the ball creeps back at the sim's 0.02 m/s: dead for the eye.
      const creep = CUSHION_OUT * Math.max(0, t2 - T_BACK - 8 / 30);
      return { x: FOOT_X + GIVE_M * give - creep, y, rolled: 2 * GO + GIVE_M * give + creep };
    };
    if (f < K2) return rep(K1, 0, f) ?? { x: FOOT_X, y: 0, rolled: 0 };
    if (f < arr2) return rep(K2, 0, f) as { x: number; y: number; rolled: number };
    if (f < K3) {
      // The touch out of the box: 2 m/s away from the cone.
      const t = (f - arr2) / 30;
      return { x: FOOT_X, y: rollAt(BOX_TOUCH, t).x, rolled: 2 * GO + rollAt(BOX_TOUCH, t).x };
    }
    return rep(K3, Y3, f) as { x: number; y: number; rolled: number };
  };
  const ballB = ballAt(frame);
  const ballPx = BP(ballB.x, ballB.y, 0.11);
  // A short trail for the mini map: where the ball was 3, 6 and 9 frames ago (only while it moves).
  const trail = [3, 6, 9]
    .map((d) => ballAt(frame - d))
    .filter((q) => Math.hypot(q.x - ballB.x, q.y - ballB.y) > 0.05)
    .map((q) => ({ x: q.x, y: q.y }));

  // Tavi in panel B: her spot, pose and face.
  const walkT = easeT(clamp01((frame - walkAt) / 30));
  const taviY = frame < walkAt ? 0 : Y3 * walkT;
  const taviPx = BP(0, taviY, 0);
  const passTrack = (K: number): [number, Pose | "receiveReady" | "passInside"][] => [
    [K - 8, "receiveReady"],
    [K, "passInside"],
    [K + 6, { ...POSES.passInside, nearHip: 34 }],
    [K + 16, "receiveReady"],
  ];
  const cushionTrack = (A: number): [number, Pose | "receiveReady" | "receiveSoft"][] => [
    [A - 8, "receiveReady"],
    [A - 1, "receiveSoft"],
    [A + 8, GIVE],
    [A + 24, "receiveReady"],
  ];
  const walkPose = (f: number) => cyclePose(f, "walk", 9);
  const track: [number, Pose | "receiveReady" | "receiveSoft" | "passInside" | "inside"][] = [
    ...passTrack(K1),
    ...cushionTrack(arr1),
    ...passTrack(K2),
    [arr2 - 6, "receiveReady"],
    [arr2, "inside"],
    [arr2 + 5, { ...POSES.inside, nearHip: 30 }],
    [walkAt + 2, walkPose(walkAt + 2)],
    [walkAt + 28, walkPose(walkAt + 28)],
    [walkAt + 30, "receiveReady"],
    ...passTrack(K3),
    ...cushionTrack(arr3),
  ];
  const basePose: Pose = frame > walkAt + 2 && frame < walkAt + 28 ? walkPose(frame) : poseAt(frame, track);
  const mirror = progress(frame, mirrorAt, 6, EASE.standard);
  const poseRaw = mirror > 0.001 ? mixPose(basePose, swapLegs(basePose), mirror) : basePose;
  const pose: Pose = { ...poseRaw, torso: poseRaw.torso + idle(frame, 3, 3, 0.8) };
  const footTurn = clamp01(visible(frame, arr1 - 8, arr1 + 22, 6, 6) + visible(frame, arr3 - 8, arr3 + 22, 6, 6) + visible(frame, arr2 - 6, arr2 + 8, 4, 6));
  const face = frame >= arr3 + 16 ? "happy" : "focus";

  // Cue chips: lit in turn by the give, the touch away and the two metres out of the box.
  const chipAt = [T2, second2, arr2];
  let active = -1;
  let litAt = 0;
  chipAt.forEach((f, i) => {
    if (frame >= f) {
      active = i;
      litAt = f;
    }
  });
  const lit = active < 0 ? 0 : progress(frame, litAt, 10, EASE.standard);

  // The board's ring icon: pink when Chalk arrives, amber once the touch away plays, lime at "enough".
  const ringAt = arrive1 + 2;
  const limeAt = tEnough + 6;
  const ringSeconds = frame < second2 ? 0.3 : frame < limeAt ? 1.0 : 2.4;
  const ringPulse = frame < second2 ? 0.75 + 0.25 * Math.sin(frame / 2.5) : 1;
  const ringFlash = Math.sin(Math.PI * clamp01((frame - limeAt) / 16));

  const dimBack = 0.42 * progress(frame, 0, 12) * (1 - progress(frame, boardOut, 9));

  return (
    <Stage bg={PITCH.grassDark}>
      {/* Backdrop: b11's last frame, the steering wheel turned toward the space. */}
      <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(1.45) translate(-925 -605)`}>
        <WheelScene frame={frame} pop={1} draw={1} turn={-58} nudge={1} />
      </g>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} opacity={dimBack} />

      <PracticeBoard at={0} until={boardOut}>
        <defs>
          <clipPath id="b12-pa">
            <rect x={PA.x} y={PA.y} width={PA.w} height={paH} rx={36} />
          </clipPath>
          {/* The fix map's clip is in its own coordinates, so it travels with the slide. */}
          <clipPath id="b12-fix">
            <rect x={0} y={0} width={HALF_W} height={paH} rx={36} />
          </clipPath>
          <clipPath id="b12-pb">
            <rect x={PB.x} y={PB.y} width={PB.w} height={PB.h} rx={36} />
          </clipPath>
        </defs>
        <NumberChips cues={["Inside foot, soft knee", "Touch away from pressure", "Two metres, not zero"]} y={200} centre={920} pops={[progress(frame, 8, 14, EASE.enter), progress(frame, 14, 14, EASE.enter), progress(frame, 20, 14, EASE.enter)]} active={active} lit={lit} />
        <RingIcon x={1755} y={200} seconds={ringSeconds} s={progress(frame, ringAt, 12, EASE.enter)} flash={ringFlash} pulse={ringPulse} />

        {/* ---------- Panel A: the mistake, then the fix beside it ---------- */}
        <g opacity={dimA}>
          <rect x={PA.x} y={PA.y} width={PA.w} height={paH} rx={36} fill="#16324B" />
          <g clipPath="url(#b12-pa)">
            <g opacity={dimMistake} transform={`translate(${PA.x} ${PA.y})`}>
              <g transform={fit(FOCUS.dead)}>
                <HalfMap frame={frame} mode="dead" T={T1} ringAt={T1 - 10} />
              </g>
              <Label x={HALF_W / 2} y={650} text="or letting it bounce away" at={T1 + 14} until={tFix + 16} size={34} />
            </g>
            {fixIn > 0.001 ? (
              <g transform={`translate(${PA.x + FIX_X + (1 - fixIn) * HALF_W} ${PA.y})`}>
                <rect x={-12} y={-4} width={HALF_W + 24} height={paH + 8} fill="#16324B" />
                <g clipPath="url(#b12-fix)">
                  <g transform={fit(FOCUS.away)}>
                    <HalfMap frame={frame} mode="away" T={T2} ringAt={T2 - 6} aimAt={aimAt} talk={talk} />
                  </g>
                  <CornerMarks box={{ x: 0, y: 0, w: HALF_W, h: paH }} t={marksFix} />
                </g>
              </g>
            ) : null}
          </g>
          {/* Stamps sit inside their panels with a margin, outside the clip, so the slam is never cut. */}
          <Stamp kind="MISTAKE" x={PA.x + 170} y={PA.y + 74} at={tClassic} />
          {fixIn > 0.001 ? (
            <g transform={`translate(${PA.x + FIX_X + (1 - fixIn) * HALF_W} ${PA.y})`}>
              <Stamp kind="FIX" x={116} y={70} at={tFix + 10} />
            </g>
          ) : null}
        </g>

        {/* ---------- Panel B: the wall drill ---------- */}
        {panelIn > 0.001 ? (
          <g opacity={panelIn} transform={`translate(${PB.x + PB.w / 2} ${PB.y + PB.h / 2}) scale(${0.97 + 0.03 * panelIn}) translate(${-(PB.x + PB.w / 2)} ${-(PB.y + PB.h / 2)})`}>
            <rect x={PB.x} y={PB.y} width={PB.w} height={PB.h} rx={36} fill={PITCH.skyHigh} />
            <g clipPath="url(#b12-pb)">
              <g transform={`translate(${PB.x} ${PB.y})`}>
                {/* Sky, one floodlight glow, the stand along the far touchline (half the pan), the oblique grass. */}
                <Glow cx={120 + pan * 0.5} cy={30} r={200} color={PITCH.lightSoft} intensity={0.7} rings={4} />
                <g transform={`translate(${pan * 0.5} 0)`}>
                  <StandBand x={-200} y={56} w={1300} h={94} />
                  {/* Past the stand's end, across the far side of the ground: a low fence, always there. */}
                  <g opacity={0.6}>
                    <rect x={1146} y={142} width={900} height={10} fill="#1B2150" />
                    <rect x={1146} y={122} width={900} height={4} rx={2} fill={PITCH.standsLight} />
                    {Array.from({ length: 40 }, (_, i) => (
                      <line key={i} x1={1150 + i * 22} y1={122} x2={1150 + i * 22} y2={148} stroke={PITCH.standsLight} strokeWidth={2} opacity={0.7} />
                    ))}
                  </g>
                  {/* The car park behind that fence, on its line only. */}
                  {carT > 0.001 ? (
                    <g opacity={carT} transform={`translate(${1150} ${150 - 6 * (1 - carT)}) scale(0.24)`}>
                      <CarPark x0={0} groundY={0} ppm={B_PPM} />
                      <HazardLights ppm={B_PPM} on={blink} />
                    </g>
                  ) : null}
                </g>
                <g transform={`translate(${pan} 0)`}>
                  <rect x={-300} y={150} width={PB.w + 700} height={PB.h - 150 + 20} fill={PITCH.grassDark} />
                  {[
                    [0.6, 1.8],
                    [-1.4, -2.6],
                  ].map(([a, b], i) => {
                    const p = [BP(-40, a, 0), BP(40, a, 0), BP(40, b, 0), BP(-40, b, 0)];
                    return <path key={i} d={`M${p.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" L")} Z`} fill={PITCH.grass} />;
                  })}
                  <DrillWall P={BP} faceX={-WALL_D} halfW={3.2} height={1.4} />
                  {/* The 2 m chalk box around her feet. */}
                  <ChalkBox P={BP} cx={0} cy={0} half={1} draw={progress(frame, boxAt, 22, EASE.soft)} />
                  {/* The cone that stands in for Chalk: one eyebrow. */}
                  <ConeChalk x={BP(CONE.x, CONE.y, 0).x} y={BP(CONE.x, CONE.y, 0).y} h={56} s={progress(frame, coneAt, 12, EASE.enter)} brow={1} />
                  {/* Wall hits. */}
                  {[hit1, hit2, hit3].map((h, i) => (
                    <Dust key={i} x={BP(-WALL_D + 0.1, i === 2 ? Y3 : 0, 0.11).x} y={BP(-WALL_D + 0.1, i === 2 ? Y3 : 0, 0.11).y} at={h} size={30} seed={`wall${i}`} />
                  ))}
                  {/* The mirror swish. */}
                  <Dust x={taviPx.x} y={taviPx.y - H_T * 0.45} at={mirrorAt} size={60} seed="swap" />
                  <Player x={taviPx.x} groundY={taviPx.y} h={H_T} pose={pose} face={face} flip footTurn={0.4 * footTurn} />
                  <Ball cx={ballPx.x} cy={ballPx.y} r={BALL_RB} view={SIDE_B} axis={{ x: 0, y: -1, z: 0 }} angle={-ballB.rolled / 0.11} lineNormal={LINE_N} />
                  <Label x={BP(CONE.x, CONE.y, 0).x + 10} y={BP(CONE.x, CONE.y, 0).y - 78} text="Chalk" at={coneAt + 8} until={tCar} size={32} />
                </g>
                <DrillMiniMap x={CARD.x} y={CARD.y} w={CARD.w} coneT={progress(frame, coneAt + 10, 12, EASE.enter)} boxT={progress(frame, boxAt + 6, 20, EASE.soft)} arrowT={progress(frame, tAway + 6, 16, EASE.soft)} opacity={cardO} ball={{ x: ballB.x, y: ballB.y }} trail={trail} taviY={taviY} wallD={WALL_D} />
              </g>
            </g>
            <Stamp kind="DRILL" x={PB.x + 120} y={PB.y + 50} at={drillStamp} />
          </g>
        ) : null}

        {/* ---------- Notes: the drill steps stay; the right column adds the feet swap and the start. ---------- */}
        <NoteLine frame={frame} x={NOTE_X} y={ROWS[0]} text="cushion it dead" at={arr1 + 8} number="1" size={34} />
        <NoteLine frame={frame} x={NOTE_X} y={ROWS[1]} text="touch it out, away from the cone" at={tAway} number="2" size={34} />
        <NoteLine frame={frame} x={NOTE_X} y={ROWS[2]} text="Move the cone every five passes." at={arr2 + 24} size={34} color={PITCH.lightSoft} dot={PITCH.light} />
        <NoteLine frame={frame} x={NOTE_X2} y={ROWS[0]} text="Swap feet every ten." at={tSwap} size={34} color={PITCH.lightSoft} dot={XRAY.lime} />
        <NoteLine frame={frame} x={NOTE_X2} y={ROWS[1]} text="Start soft. Add pace when it always" at={tStart + 2} size={34} dot={PITCH.light} />
        <NoteLine frame={frame} x={NOTE_X2 + 34} y={ROWS[2]} text="stops where you meant." at={tStart + 5} size={34} />
        <SafetyLine frame={frame} x={NOTE_X} y={992} text="Solid wall, no windows. Nobody near the wall. Away from roads and parked cars." at={tStart + 12} />
      </PracticeBoard>

      {/* ---------- Sound ---------- */}
      <Sfx name="whoosh" at={0} volume={0.35} />
      <Sfx name="pop-soft" at={8} volume={0.25} />
      <Sfx name="pop-soft" at={14} volume={0.2} />
      <Sfx name="pop-soft" at={20} volume={0.2} />
      <Sfx name="stamp" at={tClassic} volume={0.45} />
      <Sfx name="thump" at={T1} volume={0.4} />
      <Sfx name="tick" at={T1 + 12} volume={0.3} />
      <Sfx name="pop-soft" at={T1 + 14} volume={0.22} />
      <Sfx name="alarm" at={T1 + 22} volume={0.22} />
      <Sfx name="whoosh" at={arrive1 - 4} volume={0.35} />
      <Sfx name="whoosh" at={tFix} volume={0.3} />
      <Sfx name="stamp" at={tFix + 10} volume={0.45} />
      <Sfx name="pop" at={aimAt} volume={0.3} />
      <Sfx name="pop" at={tAimed - 4} volume={0.35} />
      <Sfx name="thump" at={T2} volume={0.35} />
      <Sfx name="whoosh" at={T2 + 2} volume={0.18} />
      <Sfx name="thump" at={second2} volume={0.3} />
      <Sfx name="tick" at={second2 + 6} volume={0.35} />
      <Sfx name="whoosh" at={shrinkAt} volume={0.3} />
      <Sfx name="stamp" at={drillStamp} volume={0.45} />
      <Sfx name="pop" at={coneAt} volume={0.35} />
      <Sfx name="blip" at={coneAt + 6} volume={0.3} />
      <Sfx name="thump" at={hit1} volume={0.35} />
      <Sfx name="thump" at={arr1} volume={0.25} />
      <Sfx name="pop-soft" at={arr1 + 8} volume={0.25} />
      <Sfx name="thump" at={K2} volume={0.35} />
      <Sfx name="thump" at={hit2} volume={0.35} />
      <Sfx name="chalk" at={boxAt} volume={0.4} />
      <Sfx name="chalk" at={boxAt + 12} volume={0.3} />
      <Sfx name="thump" at={arr2} volume={0.3} />
      <Sfx name="pop-soft" at={tAway} volume={0.25} />
      <Sfx name="pop-soft" at={arr2 + 24} volume={0.22} />
      <Sfx name="thump" at={K3} volume={0.35} />
      <Sfx name="pop-soft" at={tSwap} volume={0.3} />
      <Sfx name="whoosh" at={mirrorAt} volume={0.3} />
      <Sfx name="thump" at={hit3} volume={0.35} />
      <Sfx name="pop-soft" at={tStart + 2} volume={0.25} />
      <Sfx name="pop-soft" at={tStart + 12} volume={0.22} />
      <Sfx name="thump" at={arr3} volume={0.25} />
      <Sfx name="whoosh" at={tCar - 2} volume={0.25} />
      <Sfx name="blip" at={tCar + 26} volume={0.4} />
      <Sfx name="blip" at={tCar + 34} volume={0.3} />
      <Sfx name="bell" at={limeAt} volume={0.3} />
      <Sfx name="blip" at={limeAt + 2} volume={0.3} />
    </Stage>
  );
};
