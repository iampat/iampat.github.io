// b10 Stiff or soft. X-ray slow motion: the still foot returns maybe a third of the ball's speed (IN / OUT meter,
// OUT pointing back towards Sam), a one-second pitch cut of the ball rolling almost 2 m back towards Sam while
// Chalk runs in, then the same ball into a foot that moves back with it: the ball meets the giving foot on
// "shrinks", the gap bar shortens by the foot's quarter and turns amber (same ratio as the b09 meter), the bounce
// (OUT) dies on "dies", the cushion word card, the hundredth-of-a-second freeze with the stopwatch, the blink, and
// the rewind that shows the foot already drifting back before contact. Ends on the map.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../../kit/Camera";
import { Player, mixPose, type Pose } from "../../kit/Player";
import { Keeper, keeperPoseAt, type KeeperPose, type KeeperPoseName } from "../../kit/Keeper";
import { Ball } from "../../kit/Ball";
import { XRayGrid } from "../../kit/XRay";
import { Glow } from "../../kit/World";
import { Label, SlowMoTag, Stamp } from "../../kit/Graphics";
import { TopField } from "../../kit/Field";
import { TopPlayer } from "../../kit/TopPlayer";
import { Sfx } from "../../kit/Sfx";
import { SpeedDiffMeter, mixHex } from "../../kit/ep2";
import { passInPath, passInTimeToX, TOUCHES } from "../../physics/ep2sims";
import { rollAt } from "../../physics/touch";
import { sampleAt } from "../../physics/sim";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, pop, progress, visible } from "../../lib/anim";
import { project, type View } from "../../lib/project";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import {
  BALL_R,
  BALL_R10,
  FOOT_TURN,
  FREEZE_M,
  GIVE,
  GROUND,
  GROUND10,
  H10,
  HIP10_X,
  PPM,
  PPM10,
  SAM_HIP_M,
  SIDE,
  SLOW10,
  SOFT,
  STIFF,
  SideWorld,
  TAVI_H,
  X,
  XRAY_CAM,
  XRayGround,
  XRayTavi,
  camFor,
  contactBallX,
  flippedLeg,
  hipYFor,
  toScreen,
} from "../../kit/ext/ep2-b09-b10-world";
import {
  BlinkBars,
  ChalkEye,
  ContactStopwatch,
  FootFromAbove,
  GapBar,
  GhostArrow,
  ImpactFlicks,
  InOutMeter,
  LeaderPill,
  Motes,
  PANEL_BG,
  RewindPill,
  SpeedArrow,
  WordCardLines,
} from "../../kit/ext/ep2-b09-b10-hud";

// ---------- Physics (from the sims, never invented) ----------
const BALL_IN = 4.8;
const STIFF_OUT = Math.abs(TOUCHES.TOUCH_STIFF().x); // 1.68 m/s back towards Sam (35%)
const CUSHION_FOOT = 1.25; // the foot gives way at about a quarter of the ball speed (same as the b09 meter)
const CUSHION_OUT = TOUCHES.TOUCH_CUSHION(CUSHION_FOOT).x; // 0.0075 m/s: a dead stop
const CONTACT_S = 0.01;
const BLINK_S = 0.15;

/** Screen px per m/s for the arrows drawn in the x-ray (ball and foot on one scale). */
const ARROW_PPS = 60;
/** Meter scale (px per m/s). */
const METER_PPS = 90;
const METER_ROW = 30 * 2.2;
const CHALK_H = 2.1 * PPM;

/** Screen px per frame of a ball at v m/s in the slow motion. */
const pxPerFrame = (v: number) => (v * SLOW10 * PPM10) / 30;
const BALL_PX = pxPerFrame(BALL_IN);

// The ball b09 froze: one metre before Tavi's foot, at the same screen spot under the shared x-ray camera.
const PASS = passInPath();
const FREEZE_IDX = Math.round(passInTimeToX(FREEZE_M) * 30);
const FROZEN_WORLD = project(sampleAt(PASS, FREEZE_IDX).pos, SIDE);
const BALL0_X = toScreen(FROZEN_WORLD, XRAY_CAM).x;
const BALL_Y = GROUND10 - BALL_R10;
/** The ball's speed arrow rides above the ball, so it never lies across the foot. */
const ARROW_Y = BALL_Y - BALL_R10 - 40;
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const ROLL_AXIS = { x: 0, y: 1, z: 0 };

type Pt = { x: number; y: number };
type Leg = ReturnType<typeof flippedLeg>;
const legFor = (pose: Pose) => flippedLeg(pose, HIP10_X, hipYFor(pose, GROUND10, H10), H10);
/** Ball centre x at contact for a pose (the ball touches the inside of the near boot). */
const contactFor = (pose: Pose) => contactBallX(legFor(pose).toe.x, H10, BALL_R10);
const CONTACT_STIFF_X = contactFor(STIFF);
/** The heel of the near foot (behind the ankle: to the right, she faces left). */
const heelOf = (leg: Leg): Pt => ({ x: leg.ankle.x + 0.034 * H10, y: leg.ankle.y - 6 });
/** The inside of the foot (the arch face that meets the ball). */
const archOf = (leg: Leg): Pt => ({ x: leg.toe.x - 0.03 * H10, y: BALL_Y });
/** Front edge of the shin at height y (the ball arrow stops short of it). */
const shinFrontX = (leg: Leg, y: number) => {
  const t = clamp01((y - leg.knee.y) / (leg.ankle.y - leg.knee.y));
  return leg.knee.x + t * (leg.ankle.x - leg.knee.x) - 0.04 * H10;
};

/** Pose of the giving leg: SOFT until the give starts, GIVE once it is done (smoothstep). */
const givePose = (u: number) => mixPose(SOFT, GIVE, EASE.soft(clamp01(u)));

const WATCH: Pose = { ...STIFF, torso: 6, head: 18, nearShoulder: -18, farShoulder: 22, nearElbow: 30, farElbow: 30 };

/** Map view for the ending: Tavi's mark at the frame centre, Sam 12 m behind her inside the left edge. */
const MAP_PPM = 68;
const MAP_MARK_X = 40;
const MAP: View = { kind: "top", originX: WIDTH / 2 - MAP_MARK_X * MAP_PPM, originY: HEIGHT / 2, ppm: MAP_PPM };
const MAP_TOKEN = 64;

/** Meter slot (top left). Only one meter shows at a time: IN / OUT, then BALL / FOOT / GAP, then IN / OUT again. */
const MB = { x: 300, y: 232 };
const MA = { x: 210, y: 232 };

export const B10: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b10");
  const END = cue.frames;

  // ---------- Beats (exact word cues) ----------
  const tStiff = cue("Stiff, still foot");
  const tThird = cue("maybe a third");
  const tOf = cue("of its speed");
  const tNow = cue("Now move your foot back");
  const tBack = cue("back with it");
  const tGap = cue("The gap shrinks");
  const tShrinks = cue("shrinks");
  const tBounce = cue("The bounce dies");
  const tDies = cue("dies");
  const tCushion = cue("cushion");
  const tContact = cue("Contact");
  const tSecond = cue("second");
  const tFar = cue("Far shorter than a blink");
  const tBlink = cue("blink");
  const tSo = cue("So be soft");
  const tSoft = cue("soft");
  const tLands = cue("lands");
  const tLandsEnd = cue.wordEnd("lands");

  // ---------- Run 1: the stiff foot ----------
  const rollA = 12;
  const contactA = rollA + Math.ceil((CONTACT_STIFF_X - BALL0_X) / BALL_PX);
  const leaveA = contactA + 6;
  const cutA = tOf + 6;
  const cutB = tNow - 2;

  // ---------- Run 2: the foot moves back with it ----------
  const rollB = cutB + 2;
  // The foot starts to drift back just before the ball lands (soft before contact) and gives all through
  // "The gap shrinks"; the ball rolls in from off the left edge and meets the giving foot on "shrinks".
  const giveStart = tGap - 18;
  const giveLen = 60;
  const poseB = (f: number) => givePose((f - giveStart) / giveLen);
  const contactAim = tShrinks + 2;
  const x0B = contactFor(poseB(contactAim)) - (contactAim - rollB) * BALL_PX;
  let contactB = contactAim;
  for (let f = rollB; f < rollB + 240; f++) {
    if (x0B + (f - rollB) * BALL_PX >= contactFor(poseB(f))) {
      contactB = f;
      break;
    }
  }
  const leaveB = contactB + 6;
  // Foot speed of the smoothstep give, scaled so that it is exactly CUSHION_FOOT at contact.
  const uC = clamp01((contactB - giveStart) / giveLen);
  const footV = (f: number) => {
    const u = clamp01((f - giveStart) / giveLen);
    return (CUSHION_FOOT * u * (1 - u)) / Math.max(0.05, uC * (1 - uC));
  };
  const freezeAt = tContact - 4;
  const rewAt = tSo;
  const playAt = rewAt + 10;
  const pullAt = tLandsEnd;

  // Virtual clock for run 2: live until the freeze, then held at the contact, rewound twelve frames, replayed slowly.
  const vf = (() => {
    if (frame < freezeAt) return frame;
    const hold = contactB + 2;
    if (frame < rewAt) return hold;
    if (frame < playAt) return hold - 12 * progress(frame, rewAt, 8, EASE.standard);
    const back = hold - 12;
    // Ten frames of slow motion spread until "lands", then on to the hold.
    const toLand = clamp01((frame - playAt) / Math.max(1, tLands - playAt));
    if (frame <= tLands) return back + 10 * toLand;
    return Math.min(hold, back + 10 + (frame - tLands) * 0.5);
  })();
  const replay = frame >= rewAt;

  const inRun1 = frame < cutA;
  const inCut = frame >= cutA && frame < cutB;

  // ---------- The x-ray state for the current run ----------
  let pose: Pose;
  let ballX: number;
  let squash = 1;
  let ballArrow: { len: number; dir: 1 | -1; o: number } | null = null;
  let footArrowV = 0;
  let planO = 0;
  let trailFrom = 0;
  let trailO = 0;
  let teal = 0;
  let pink = 0;
  let contactNow = 0;
  if (inRun1 || inCut) {
    pose = STIFF;
    pink = progress(frame, tStiff, 12, EASE.enter);
    if (frame < rollA) ballX = BALL0_X;
    else if (frame < contactA) ballX = BALL0_X + (frame - rollA) * BALL_PX;
    else if (frame < leaveA) {
      const k = (frame - contactA) / (leaveA - contactA);
      ballX = CONTACT_STIFF_X + Math.sin(Math.PI * k) * BALL_R10 * 0.12;
      squash = 1 - 0.14 * Math.sin(Math.PI * k);
    } else {
      const t = ((frame - leaveA) / 30) * SLOW10;
      ballX = CONTACT_STIFF_X - rollAt(STIFF_OUT, t).x * PPM10;
    }
    trailFrom = BALL0_X;
    trailO = frame >= rollA ? 0.35 : 0;
    if (frame >= rollA && frame < contactA) ballArrow = { len: BALL_IN * ARROW_PPS, dir: 1, o: progress(frame, rollA, 10, EASE.enter) * (1 - progress(frame, contactA - 3, 3)) };
    else if (frame >= leaveA) ballArrow = { len: STIFF_OUT * ARROW_PPS, dir: -1, o: progress(frame, leaveA, 8, EASE.enter) };
    contactNow = frame >= contactA && frame < contactA + 14 ? 1 : 0;
  } else {
    const f = vf;
    pose = poseB(f);
    teal = progress(frame, tNow + 6, 14, EASE.enter);
    const cx = contactFor(pose);
    if (f < rollB) ballX = x0B;
    else if (f < contactB) ballX = x0B + (f - rollB) * BALL_PX;
    else if (f < leaveB) {
      const k = (f - contactB) / (leaveB - contactB);
      ballX = cx + Math.sin(Math.PI * k) * BALL_R10 * 0.1;
      squash = 1 - 0.12 * Math.sin(Math.PI * k);
    } else {
      const t = ((f - leaveB) / 30) * SLOW10;
      ballX = contactFor(poseB(leaveB)) + rollAt(Math.abs(CUSHION_OUT), t).x * PPM10 * Math.sign(CUSHION_OUT);
    }
    trailFrom = x0B;
    trailO = f >= rollB ? 0.35 * (1 - progress(frame, tDies, 20, EASE.soft)) : 0;
    if (f >= rollB && f < contactB) ballArrow = { len: BALL_IN * ARROW_PPS, dir: 1, o: progress(f, rollB, 10, EASE.enter) * (1 - progress(f, contactB - 3, 3)) };
    footArrowV = f >= giveStart && f < giveStart + giveLen ? footV(f) : 0;
    // "back with it": the planned move shows as a dashed arrow at the heel until the real give takes over.
    planO = replay ? 0 : progress(frame, tBack, 10, EASE.enter) * (1 - progress(frame, giveStart + 2, 10, EASE.exit));
    contactNow = f >= contactB && f < contactB + 14 && frame < freezeAt ? 1 : 0;
  }
  const leg = legFor(pose);
  const heel = heelOf(leg);
  const arch = archOf(leg);
  const rollAngle = (ballX - trailFrom) / BALL_R10;
  const contactPoint = { x: ballX + BALL_R10, y: BALL_Y };
  // The ball arrow above the ball: from its back edge forwards, stopped short of the shin; the rebound points back.
  const arrowStart = ballArrow && ballArrow.dir > 0 ? ballX - BALL_R10 : ballX + BALL_R10 * 0.4;
  const arrowLen = ballArrow ? (ballArrow.dir > 0 ? Math.min(ballArrow.len, shinFrontX(leg, ARROW_Y) - 18 - arrowStart) : ballArrow.len) : 0;

  // ---------- Camera for the x-ray (screen space) ----------
  const camKeys: CamKey[] = [
    { f: 0, x: 960, y: 540, zoom: 1 },
    { f: cutA, x: 966, y: 536, zoom: 1.02 },
    { f: cutB, x: 960, y: 540, zoom: 1 },
    { f: tCushion, x: 966, y: 536, zoom: 1.03 },
    { f: freezeAt, x: 966, y: 536, zoom: 1.03 },
    { f: freezeAt + 22, x: 930, y: 580, zoom: 1.08 },
    { f: rewAt, x: 930, y: 580, zoom: 1.08 },
    { f: rewAt + 20, x: 946, y: 560, zoom: 1.05 },
    { f: pullAt, x: 946, y: 560, zoom: 1.05 },
    { f: END, x: 960, y: 620, zoom: 0.86 },
  ];
  const cam = cameraAt(frame, camKeys);
  const xT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
  const S = (p: Pt) => ({ x: WIDTH / 2 + (p.x - cam.x) * cam.zoom, y: HEIGHT / 2 + (p.y - cam.y) * cam.zoom });

  // ---------- Meters (screen space, one at a time in the top-left slot) ----------
  const meterOut = 1 - progress(frame, freezeAt - 6, 8, EASE.exit);
  // IN / OUT: "maybe a third" in run 1; back on "The bounce dies" with the stiff OUT, which dies on "dies".
  const mBAt = frame < cutA ? tThird : tBounce + 2;
  const mBIn = pop(frame, mBAt, { stiffness: 170, damping: 15 });
  const dieT = progress(frame, tDies - 2, 12, EASE.standard);
  const mBOutSpeed = frame < cutA ? STIFF_OUT * progress(frame, tThird + 2, 14, EASE.enter) : lerp(STIFF_OUT, Math.abs(CUSHION_OUT), dieT);
  const mBPulse = 1 + 0.06 * Math.sin(Math.PI * clamp01((frame - tDies) / 12));
  // BALL / FOOT / GAP: the foot holds at zero, then on "shrinks" grows to its give speed while the gap shortens.
  const mAIn = pop(frame, tNow + 4, { stiffness: 170, damping: 15 });
  const mAOut = 1 - progress(frame, tBounce - 4, 8, EASE.exit);
  const shrinkT = progress(frame, tShrinks - 4, 15, EASE.standard);
  const mAFoot = CUSHION_FOOT * shrinkT;
  const gapColor = mixHex(CAST.mistake, PITCH.light, shrinkT);
  const mAPulse = 1 + 0.06 * (Math.sin(Math.PI * clamp01((frame - tGap) / 12)) + Math.sin(Math.PI * clamp01((frame - tShrinks) / 12)));

  // ---------- Stopwatch, blink, stamp ----------
  const watchVal = CONTACT_S * clamp01((frame - (tContact + 6)) / Math.max(1, tSecond - tContact - 6));
  const hudRightOut = rewAt - 2;

  // ---------- Ending: the ink fades into pitch stripes ----------
  const pull = progress(frame, pullAt, END - pullAt - 2, EASE.soft);
  const mapIn = progress(frame, pullAt + 4, 14, EASE.soft);
  const tokenIn = pop(frame, pullAt + 8, { stiffness: 160, damping: 15 });
  const taviMap = project({ x: MAP_MARK_X, y: 0, z: 0 }, MAP);
  const samMap = project({ x: MAP_MARK_X + SAM_HIP_M, y: 0, z: 0 }, MAP);

  // ---------- The one-second pitch cut: tight on Tavi, the ball rolls almost 2 m back, Chalk runs in ----------
  if (inCut) {
    const t = (frame - cutA) / 30 + 0.15; // real time since the ball left her boot
    const toeW = flippedLeg(STIFF, X(0), 0, TAVI_H).toe.x;
    const contactW = contactBallX(toeW, TAVI_H, BALL_R);
    const rolled = rollAt(STIFF_OUT, t).x;
    const ballW = { x: contactW - rolled * PPM, y: GROUND - BALL_R };
    const pan = progress(frame, cutA, cutB - cutA, EASE.camera);
    // Tavi about half the frame height, the ground low in the frame, a slow pull-out as the ball rolls away.
    const pcam = camFor({ x: X(0), y: GROUND }, { x: 1250 + 40 * pan, y: 900 }, 6.0 - 0.3 * pan);
    const watch = mixPose(STIFF, WATCH, EASE.soft(clamp01((frame - cutA) / 24)));
    // Chalk runs in from the right at his chase speed (4 m/s) and brakes to a stop 1.9 m from her (a linear
    // brake from 4 m/s covers 1.7 m in 26 frames). His floodlight shadow slides in ahead of him first.
    const runIn = cutA + 10;
    const brake = 26;
    const chalkM = frame < runIn ? 3.6 + (4 * (runIn - frame)) / 30 : 3.6 - 1.7 * (1 - (1 - clamp01((frame - runIn) / brake)) ** 2);
    const kTrack: [number, KeeperPose | KeeperPoseName][] = [];
    for (let i = 0; cutA - 6 + i * 6 < runIn + brake - 8; i++) kTrack.push([cutA - 6 + i * 6, i % 2 ? "runB" : "runA"]);
    kTrack.push([runIn + brake, "ready"]);
    const kPose = keeperPoseAt(frame, kTrack);
    return (
      <Stage bg={PITCH.sky}>
        <SideWorld cam={pcam} seed="b10p">
          {/* Chalk's shadow, then Chalk. */}
          <ellipse cx={X(chalkM - 1.3)} cy={GROUND + 3} rx={1.4 * PPM} ry={0.12 * PPM} fill={PITCH.skyHigh} opacity={0.45} />
          <Keeper x={X(chalkM)} groundY={GROUND} h={CHALK_H} pose={{ ...kPose, stretch: kPose.stretch * (1 + idle(frame, 5, 2.6, 0.006)) }} face="flat" flip look={0.8} />
          <Player x={X(0)} groundY={GROUND} h={TAVI_H} pose={watch} face="wince" flip footTurn={FOOT_TURN} />
          <line x1={ballW.x + BALL_R * 1.6} y1={GROUND - 1.5} x2={contactW} y2={GROUND - 1.5} stroke={PITCH.lightSoft} strokeWidth={0.6} strokeDasharray="0.6 1.8" strokeLinecap="round" opacity={0.6} />
          <Ball cx={ballW.x} cy={ballW.y} r={BALL_R} view={SIDE} axis={ROLL_AXIS} angle={-rolled / 0.11} lineNormal={LINE_N} />
        </SideWorld>
        <Label x={800} y={560} text="almost two metres, straight back" at={cutA + 8} until={cutB - 4} size={36} />
        <Sfx name="whoosh" at={cutA} volume={0.3} />
        <Sfx name="whoosh-long" at={cutA + 2} volume={0.14} />
        <Sfx name="whoosh" at={runIn} volume={0.3} />
        <Sfx name="whoosh" at={cutB - 2} volume={0.3} />
      </Stage>
    );
  }

  // ---------- The x-ray ----------
  const ballS = S({ x: ballX, y: BALL_Y });
  const heelS = S(heel);
  const archS = S(arch);
  const legS = { hip: S(leg.hip), knee: S(leg.knee) };
  const showSlowTag = (frame >= rollA - 2 && frame < cutA - 4) || (frame >= cutB + 2 && frame < freezeAt - 2);
  const insideAt = rollA + 8;
  const insideUntil = contactA + 44;
  const archO = inRun1 ? visible(frame, insideAt, insideUntil) : 0;
  const insideLabel = { x: archS.x - 60, y: GROUND10 + 104 };
  // The heel arrow steps aside for the blink bars during the freeze and comes back for the replay.
  const footO = frame < rewAt ? 1 - progress(frame, tFar - 4, 8, EASE.exit) : progress(frame, rewAt + 2, 8, EASE.enter);

  return (
    <Stage bg={XRAY.bg}>
      <g opacity={1 - pull}>
        <XRayGrid />
        <g transform={xT}>
          <XRayGround />
          {/* Trail of the rolling ball. */}
          {trailO > 0.001 ? <line x1={trailFrom} y1={BALL_Y} x2={ballX} y2={BALL_Y} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="3 14" strokeLinecap="round" opacity={trailO} /> : null}
          <XRayTavi pose={pose} highlight={pink > 0.001 ? ["thigh", "shin"] : []} highlightAmount={0.75 * pink} teal={teal} face={inRun1 ? "focus" : "neutral"} />
          {/* The inside of the foot: the arch face turned towards the ball. */}
          {archO > 0.001 ? (
            <g opacity={archO}>
              <Glow cx={arch.x} cy={arch.y} r={42} color={PITCH.teal} intensity={1} rings={3} />
              <rect x={arch.x - 8} y={arch.y - 34} width={16} height={68} rx={8} fill={PITCH.teal} />
            </g>
          ) : null}
          {/* The foot: a teal dot at the heel while it is still, a teal arrow from the heel as it gives way. */}
          {inRun1 && frame >= rollA + 4 && frame < contactA ? <circle cx={heel.x + 10} cy={heel.y} r={12} fill={CAST.shirt} opacity={progress(frame, rollA + 4, 8)} /> : null}
          <GhostArrow x={heel.x} y={heel.y} len={CUSHION_FOOT * ARROW_PPS} color={CAST.shirt} width={22} opacity={planO} />
          {footArrowV * ARROW_PPS > 0.5 && footO > 0.001 ? <SpeedArrow x={heel.x} y={heel.y} len={footArrowV * ARROW_PPS} color={CAST.shirt} width={22} opacity={footO} /> : null}
          <Ball cx={ballX} cy={BALL_Y} r={BALL_R10} view={SIDE} axis={ROLL_AXIS} angle={rollAngle} lineNormal={LINE_N} squash={squash} showBack />
          {ballArrow && ballArrow.o > 0.001 ? <SpeedArrow x={arrowStart} y={ARROW_Y} len={arrowLen} color={CAST.ball} width={18} angle={ballArrow.dir > 0 ? 0 : 180} opacity={ballArrow.o} /> : null}
          {contactNow ? <ImpactFlicks x={contactPoint.x} y={contactPoint.y} at={inRun1 ? contactA : contactB} r={BALL_R10 * 1.1} /> : null}
          {frame >= freezeAt ? <ImpactFlicks x={contactPoint.x} y={contactPoint.y} at={freezeAt} r={BALL_R10 * 1.2} /> : null}
        </g>
        <Motes seed="b10" opacity={0.7} />
      </g>

      {/* Labels on the world: the inside-of-the-foot pill points at the arch, the chip shows the foot from above. */}
      {archO > 0.001 ? <line x1={insideLabel.x + 30} y1={insideLabel.y - 26} x2={archS.x - 4} y2={archS.y + 38} stroke={PITCH.chalk} strokeWidth={4} strokeLinecap="round" opacity={0.8 * archO} /> : null}
      <Label x={insideLabel.x} y={insideLabel.y} text="inside of the foot" at={insideAt} until={insideUntil} size={34} />
      <FootFromAbove x={archS.x + 290} y={GROUND10 + 118} at={insideAt + 6} until={insideUntil} scale={0.78} />
      {inRun1 ? <Label x={ballS.x} y={S({ x: 0, y: ARROW_Y }).y - 52} text="BALL" at={rollA + 6} until={contactA - 2} size={32} bg={CAST.ball} color={XRAY.bg} /> : null}
      {inRun1 ? <Label x={heelS.x + 76} y={heelS.y - 52} text="FOOT" at={rollA + 12} until={contactA - 2} size={32} bg={CAST.shirt} color={XRAY.bg} /> : null}
      {!inRun1 ? <LeaderPill x={1480} y={470} text="give from the knee and hip" at={tNow + 10} until={tDies} to={[legS.hip, legS.knee]} /> : null}

      {showSlowTag ? <SlowMoTag at={inRun1 ? rollA - 2 : cutB + 2} until={inRun1 ? cutA - 4 : freezeAt - 2} /> : null}
      {/* The replay tag waits until the rewind pill has faded (visible() fades out after `until`). */}
      {frame >= playAt + 8 && frame < pullAt ? <SlowMoTag at={playAt + 8} until={pullAt - 2} label="SUPER SLOW MOTION" /> : null}
      <RewindPill at={rewAt} until={playAt} />

      {/* IN / OUT: OUT points back towards Sam, from the same zero line. */}
      {mBIn > 0.001 && meterOut > 0.001 ? (
        <g transform={`translate(${MB.x + 130} ${MB.y + 40}) scale(${Math.min(1.08, mBIn) * meterOut * mBPulse}) translate(${-MB.x - 130} ${-MB.y - 40})`}>
          <rect x={50} y={MB.y - 62} width={760} height={192} rx={36} fill={PANEL_BG} />
          <InOutMeter x={MB.x} y={MB.y} inSpeed={BALL_IN} outSpeed={mBOutSpeed} scale={METER_PPS} ghostOut={STIFF_OUT} ghostOpacity={frame < cutA ? 0 : 0.7 * dieT} />
          {frame >= tThird + 10 && frame < cutA ? (
            <text x={MB.x + 110} y={MB.y + METER_ROW + 11} fill={PITCH.chalk} opacity={0.85 * progress(frame, tThird + 10, 8)} fontFamily={FONTS.hud} fontWeight={700} fontSize={30} letterSpacing={3}>
              MAYBE A THIRD
            </text>
          ) : null}
          {frame >= tDies ? (
            <text x={MB.x + 110} y={MB.y + METER_ROW + 11} fill={XRAY.lime} opacity={0.95 * progress(frame, tDies, 8)} fontFamily={FONTS.hud} fontWeight={700} fontSize={30} letterSpacing={3}>
              THE BOUNCE DIES
            </text>
          ) : null}
        </g>
      ) : null}

      {/* BALL, FOOT and the GAP, for the foot that moves back with it: the old gap stays dashed pink. */}
      {!inRun1 && mAIn > 0.001 && mAOut > 0.001 ? (
        <g transform={`translate(${MA.x + 250} ${MA.y + 100}) scale(${Math.min(1.08, mAIn) * mAOut * mAPulse}) translate(${-MA.x - 250} ${-MA.y - 100})`}>
          <rect x={50} y={MA.y - 62} width={760} height={296} rx={36} fill={PANEL_BG} />
          <SpeedDiffMeter x={MA.x} y={MA.y} width={500} ballSpeed={BALL_IN} footSpeed={mAFoot} scale={METER_PPS} showGap={false} />
          <GapBar
            x0={MA.x + mAFoot * METER_PPS}
            x1={MA.x + BALL_IN * METER_PPS}
            y={MA.y + METER_ROW * 2}
            color={gapColor}
            ghostX0={MA.x}
            ghostX1={MA.x + BALL_IN * METER_PPS}
            ghostColor={CAST.mistake}
            ghostOpacity={0.6 * shrinkT}
          />
        </g>
      ) : null}

      {/* Word card at the first use. */}
      <WordCardLines term="cushion" lines={["the inside of your foot gives way as the", "ball arrives, so the bounce dies and the", "ball stays close"]} at={tCushion} until={tFar - 6} />

      {/* Contact: about a hundredth of a second (the s02 stopwatch), far shorter than a blink. */}
      <ContactStopwatch x={1250} y={520} value={watchVal} at={tContact} until={hudRightOut} />
      <ChalkEye x={1784} y={520} at={tFar} blinkAt={tBlink} until={hudRightOut} size={84} />
      <BlinkBars x={1160} y={690} at={tFar + 4} until={hudRightOut} width={400} blinkS={BLINK_S} contactS={CONTACT_S} />

      {/* The cue: soft before contact. */}
      <Stamp kind="CUE" x={1520} y={300} at={tSoft} until={pullAt} />
      <Label x={1520} y={392} text="soft before contact" at={tSoft + 6} until={pullAt} size={36} bg={PITCH.accent} color={PITCH.sky} />

      {/* The ending map: the ink fades into stripes, the camera settles back a touch, the ball sits dead at her foot. */}
      {mapIn > 0.001 ? (
        <g opacity={mapIn} transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${1.06 - 0.06 * pull}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>
          <TopField view={MAP} x0={MAP_MARK_X - 20} x1={MAP_MARK_X + 20} y0={-12} y1={12} lines={false} />
          {/* The pass line from Sam to her mark, and the mark itself: a small chalk cross. */}
          <line x1={samMap.x + MAP_TOKEN * 0.7} y1={samMap.y} x2={taviMap.x - MAP_TOKEN * 0.9} y2={taviMap.y} stroke={PITCH.chalk} strokeWidth={4} strokeDasharray="3 16" strokeLinecap="round" opacity={0.35 * tokenIn} />
          <g stroke={PITCH.chalk} strokeWidth={6} strokeLinecap="round" opacity={0.6 * tokenIn}>
            <line x1={taviMap.x - 20} y1={taviMap.y - 20} x2={taviMap.x + 20} y2={taviMap.y + 20} />
            <line x1={taviMap.x - 20} y1={taviMap.y + 20} x2={taviMap.x + 20} y2={taviMap.y - 20} />
          </g>
          <g transform={`translate(${samMap.x} ${samMap.y}) scale(${tokenIn}) translate(${-samMap.x} ${-samMap.y})`}>
            <TopPlayer x={samMap.x} y={samMap.y} kind="sam" facing={0} size={MAP_TOKEN} label="Sam" />
          </g>
          <g transform={`translate(${taviMap.x} ${taviMap.y}) scale(${tokenIn}) translate(${-taviMap.x} ${-taviMap.y})`}>
            <TopPlayer x={taviMap.x} y={taviMap.y} kind="tavi" facing={180} size={MAP_TOKEN} look={idle(frame, 7, 2.4, 6)} />
            <Ball cx={taviMap.x - MAP_TOKEN * 0.62} cy={taviMap.y + MAP_TOKEN * 0.16} r={0.11 * MAP_PPM * 1.3} view={MAP} />
          </g>
        </g>
      ) : null}

      {/* ---------- Sound ---------- */}
      <Sfx name="air" at={tStiff} volume={0.16} dur={70} />
      <Sfx name="subdrop" at={rollA - 2} volume={0.45} />
      <Sfx name="pop-soft" at={rollA + 8} volume={0.3} />
      <Sfx name="thump" at={contactA} volume={0.5} />
      <Sfx name="tick" at={contactA} volume={0.4} />
      <Sfx name="pop-soft" at={leaveA} volume={0.35} />
      <Sfx name="whoosh" at={leaveA + 1} volume={0.2} />
      <Sfx name="pop" at={tThird} volume={0.32} />
      <Sfx name="whoosh" at={cutB} volume={0.3} />
      <Sfx name="subdrop" at={cutB + 2} volume={0.3} />
      <Sfx name="pop-soft" at={tNow + 4} volume={0.3} />
      <Sfx name="air" at={tNow + 6} volume={0.18} dur={80} />
      <Sfx name="pop-soft" at={tBack} volume={0.25} />
      <Sfx name="pop-soft" at={tGap} volume={0.3} />
      <Sfx name="thump" at={contactB} volume={0.28} />
      <Sfx name="pop-soft" at={tShrinks} volume={0.3} />
      <Sfx name="pop" at={tBounce + 2} volume={0.3} />
      <Sfx name="tick" at={tDies} volume={0.4} />
      <Sfx name="pop" at={tCushion} volume={0.35} />
      <Sfx name="bell" at={tCushion} volume={0.3} />
      <Sfx name="whoosh" at={freezeAt - 4} volume={0.3} />
      <Sfx name="tick" at={freezeAt} volume={0.6} />
      <Sfx name="pop-soft" at={tContact} volume={0.35} />
      {[14, 28, 42, 56].map((d) => (
        <Sfx key={d} name="tick" at={tContact + 6 + d} volume={0.22} dur={6} />
      ))}
      <Sfx name="pop-soft" at={tFar} volume={0.3} />
      <Sfx name="blip" at={tBlink} volume={0.35} />
      <Sfx name="whoosh-long" at={rewAt} volume={0.35} />
      <Sfx name="tick" at={rewAt + 8} volume={0.4} />
      <Sfx name="stamp" at={tSoft} volume={0.5} />
      <Sfx name="pop-soft" at={tSoft + 6} volume={0.3} />
      <Sfx name="thump" at={tLands} volume={0.3} />
      <Sfx name="whoosh-long" at={pullAt} volume={0.3} />
      <Sfx name="chalk" at={pullAt + 8} volume={0.3} />
    </Stage>
  );
};
