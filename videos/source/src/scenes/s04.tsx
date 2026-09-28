// s04 X-ray: the whip (the thigh swings, slows and flings the shin), the trampoline (squash and spring back),
// the heavy leg that lets the ball bounce off faster than the foot, and the speed of club players aged 12.
// It ends on the exact first picture of s05 (the split screen), so the cut is invisible.
import React from "react";
import { Easing, useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../kit/Camera";
import { XRayLeg } from "../kit/XRay";
import { Player, POSES, mixPose, solve, type Pose } from "../kit/Player";
import { Ball } from "../kit/Ball";
import { Flight, flightPoint } from "../kit/Flight";
import { Label, SlowMoTag } from "../kit/Graphics";
import { Glow } from "../kit/World";
import { Sfx } from "../kit/Sfx";
import { SHOTS } from "../physics/shots";
import { sampleAt, simulate } from "../physics/sim";
import { useCues } from "../lib/timing";
import { EASE, clamp01, idle, lerp, popSoft, progress, visible } from "../lib/anim";
import type { View } from "../lib/project";
import { BACKGROUND, CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../theme";
import {
  CutawayBall,
  FlatArrow,
  Motes,
  MotionTrail,
  TrolleyInset,
  Bullwhip,
  WorldGrid,
  camTransform,
  toScreen,
  type Cam,
  type P,
} from "../kit/ext/s04-s05-parts";
import { BACKP5, BALL5, HIP5, LH, DashedKicker, SplitOpen, TownCar, dangleAt } from "../kit/ext/s04-s05-split";

const H = 860; // Tavi's height in world pixels (x-ray close-up)
const PPM = H / 1.62;
const HIP: P = { x: 760, y: 470 };
const BALL_R = 0.11 * PPM;
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const SLOW = 1 / 20;
const SUPER = 1 / 100;
const GSLOW = 1 / 14; // the club player's kick
const H_G = (H * 1.5) / 1.62; // a club player aged 12 is about 1.50 m
const WIDE = 0.72; // camera zoom in the wide shot

// Kick poses for the x-ray leg. The standing leg stays the same so the standing foot stays planted.
// Standing foot beside the ball: at contact its ankle is level with the ball centre (as s06 teaches).
const FAR = { farHip: 8, farKnee: 10, farAnkle: 100 };
// The standing leg s03 ends on (the rewind moves it onto the plant beside the ball).
const FAR_S03 = { farHip: 10, farKnee: 26, farAnkle: 92 };
const BACK: Pose = { ...POSES.plant, ...FAR, nearHip: -30, nearKnee: 110, nearAnkle: 150 };
const THIGH: Pose = { ...POSES.plant, ...FAR, torso: 12, nearHip: 14, nearKnee: 118, nearAnkle: 150 };
// The thigh slows but keeps moving forward (no stop): the shin whips past it.
const THIGH_SLOW: Pose = { ...THIGH, nearHip: 22, nearKnee: 116, torso: 13 };
// Knee over the ball, chest over the ball, toes pointing down, the ankle locked.
const CONTACT: Pose = { ...POSES.strike, ...FAR, nearHip: 30, nearKnee: 72, nearAnkle: 165 };
const FOLLOW: Pose = { ...POSES.follow, ...FAR };
// Follow-through path: a smooth curve through MID keeps the toe off the grass while the knee straightens.
const MID: Pose = { ...CONTACT, nearHip: 50, nearKnee: 70, nearAnkle: 158 };
const FOLLOW_Q: Pose = mixPose(MID, mixPose(CONTACT, FOLLOW, 0.5), -1); // 2 MID - (CONTACT + FOLLOW) / 2
const followMix = (e: number): Pose => mixPose(mixPose(CONTACT, FOLLOW_Q, e), mixPose(FOLLOW_Q, FOLLOW, e), e);
// Follow-through that s03 ends on: the scene opens here and rewinds to the back-lift.
const START: Pose = { ...POSES.follow, ...FAR_S03, torso: 6, nearHip: 55, nearKnee: 50, nearAnkle: 120 };
// Wide shot: leg cocked back, ready for the next ball. It becomes the s05 leg pose at the end.
const READY: Pose = { ...BACKP5, ...FAR, nearHip: -10, nearKnee: 70, nearAnkle: 140 };

const DRIVE = simulate({ ...SHOTS.DRIVE_R, duration: 1.2 }, 30);
// Club players aged 12: about 18.5 m/s (67 km/h), struck like the drive.
const GHOST = simulate({ ...SHOTS.DRIVE_R, speed: 18.5, duration: 1.0 }, 30);
const KMH = 67;
const MPH = 42;
const CAR_MS = 50 / 3.6; // a town car at a town speed limit

const easeThigh = Easing.bezier(0.5, 0, 0.7, 1);
const easeSnap = Easing.bezier(0.55, 0, 1, 0.6);

const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const joints = (pose: Pose, hip: P = HIP, h = H) => {
  const j = solve(pose, h);
  const laces = { x: j.na.x + (j.nToe.x - j.na.x) * 0.45, y: j.na.y + (j.nToe.y - j.na.y) * 0.45 };
  return { hip, knee: add(hip, j.nk), ankle: add(hip, j.na), toe: add(hip, j.nToe), laces: add(hip, laces), j };
};

// Ground under the standing foot, and the ball resting on it, just touching the front of the foot at contact.
const J_CONTACT = joints(CONTACT);
const GROUND = HIP.y + Math.max(J_CONTACT.j.fa.y, J_CONTACT.j.fToe.y) + 0.03 * H;
const restFor = (hip: P, h: number): P => {
  const jc = joints(CONTACT, hip, h);
  const a = jc.ankle;
  const t = jc.toe;
  const l = Math.hypot(t.x - a.x, t.y - a.y);
  const n = { x: (t.y - a.y) / l, y: -(t.x - a.x) / l }; // front of the foot
  const y = GROUND - BALL_R;
  return { x: a.x + (BALL_R + 0.0375 * h - (y - a.y) * n.y) / n.x, y };
};
const REST = restFor(HIP, H);
const CONTACT_DX = REST.x - J_CONTACT.ankle.x;

// The club player stands beside Tavi (1.1 m ahead), on the same ground.
const HIP_G: P = (() => {
  const j = solve(CONTACT, H_G);
  return { x: HIP.x + 1.1 * PPM, y: GROUND - Math.max(j.fa.y, j.fToe.y) - 0.03 * H_G };
})();
const REST_G = restFor(HIP_G, H_G);
const SIDE_G: View = { kind: "side", originX: REST_G.x, groundY: GROUND, ppm: PPM };

// First camera: Tavi at the size and place where s03 leaves him (hip at 900, 530).
const Z0 = 0.63;
const CAM_START: Cam = { x: HIP.x + (WIDTH / 2 - 900) / Z0, y: HIP.y + (HEIGHT / 2 - 530) / Z0, zoom: Z0 };
// Wide camera: Tavi's hip at x = 380, the ground at y = 880.
const CAM_WIDE: Cam = { x: HIP.x + (WIDTH / 2 - 380) / WIDE, y: GROUND - (880 - HEIGHT / 2) / WIDE, zoom: WIDE };
// Last camera: Tavi's leg lands exactly on the left leg of the s05 split screen.
const Z_SPLIT = LH / H;
const CAM_SPLIT: Cam = { x: HIP.x + (WIDTH / 2 - HIP5.x) / Z_SPLIT, y: HIP.y + (HEIGHT / 2 - HIP5.y) / Z_SPLIT, zoom: Z_SPLIT };
// Tavi's next ball: where the s05 left ball sits.
const NEXT_BALL: P = { x: HIP.x + (BALL5.x - HIP5.x) / Z_SPLIT, y: HIP.y + (BALL5.y - HIP5.y) / Z_SPLIT };

export const S04: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("s04");

  // ---------- Beats (exact word cues) ----------
  const tWhip = cue("the whip");
  const tThigh = cue("Your thigh swings");
  const tSlows = cue("slows");
  const tFlings = cue("flings");
  const tForward = cue("forward");
  const tTramp = cue("Then, the trampoline");
  const tTrampWord = cue("trampoline");
  const tSquash = cue("squashes");
  const tSprings = cue("springs back");
  const tLeg = cue("Your leg is way heavier");
  const tHeavier = cue("heavier");
  const tBounces = cue("bounces off");
  const tFaster = cue("faster than your foot");
  const tClub = cue("Club players");
  const tSixty = cue("sixty-seven");
  const tHour = cue.wordEnd("an hour");
  const END = cue.frames;

  const swingStart = tThigh;
  const kick = tForward - 2; // the shin arrives on "forward"
  const snapStart = kick - 24; // the whip lasts 0.8 s
  const contactStart = tSquash - 10;
  const tSpring = tSprings - 6;
  const contactLen = tSpring - contactStart;
  const rampA = tFaster + 12; // time speeds back up to real time
  const rampB = rampA + 10;
  const readyAt = rampB + 6;
  const ghostKick = tClub + 18;
  const landAt = tSixty - 6;
  const pushStart = ghostKick + 58;
  const pushEnd = pushStart + 34;
  const bump = tBounces - 2;

  // ---------- One virtual clock for the leg and Tavi's ball (units: scene frames at 1/20) ----------
  const clockAt = (f: number): number => {
    if (f < kick) return f;
    if (f < contactStart) return kick; // held at first touch
    const k = SUPER / SLOW; // 0.2 per frame
    if (f < rampA) return kick + (f - contactStart) * k;
    const base = kick + (rampA - contactStart) * k;
    const Lr = rampB - rampA;
    if (f < rampB) {
      const u = (f - rampA) / Lr;
      return base + k * (f - rampA) + (20 - k) * Lr * (u * u * u) / 3;
    }
    return base + k * Lr + ((20 - k) * Lr) / 3 + 20 * (f - rampB);
  };
  const vf = clockAt(frame);
  const rewindEnd = 40;
  const followPose = (v: number): Pose => {
    if (v < rewindEnd) return mixPose(START, BACK, progress(v, 4, rewindEnd - 4, EASE.standard));
    if (v < swingStart) {
      const b = idle(v, 1, 3, 1) * progress(v, rewindEnd, 16, EASE.soft);
      return { ...BACK, nearHip: BACK.nearHip + b * 1.5, torso: BACK.torso + b * 0.6, nearShoulder: BACK.nearShoulder + b * 2 };
    }
    if (v < tSlows) return mixPose(BACK, THIGH, easeThigh(clamp01((v - swingStart) / (tSlows - swingStart))));
    if (v < snapStart) return mixPose(THIGH, THIGH_SLOW, EASE.soft(clamp01((v - tSlows) / (snapStart - tSlows))));
    if (v < kick) return mixPose(THIGH_SLOW, CONTACT, easeSnap(clamp01((v - snapStart) / (kick - snapStart))));
    const u = clamp01((v - kick) / 53);
    return followMix(1 - (1 - u) * (1 - u));
  };
  let pose = followPose(vf);
  if (frame >= readyAt) pose = mixPose(pose, READY, progress(frame, readyAt, 24, EASE.standard));
  if (frame >= pushStart + 4) {
    const target: Pose = { ...BACKP5, ...FAR, nearAnkle: 150 + dangleAt(frame - END) };
    pose = mixPose(pose, target, progress(frame, pushStart + 4, 24, EASE.standard));
  }
  const J = joints(pose);

  // ---------- Tavi's ball ----------
  const SIDE: View = { kind: "side", originX: REST.x, groundY: GROUND, ppm: PPM };
  const flat = frame >= contactStart && frame < tSpring ? 0.33 * Math.sin((Math.PI * (frame - contactStart)) / contactLen) : 0;
  const vSpring = clockAt(tSpring);
  const springX = joints(followPose(vSpring)).ankle.x + CONTACT_DX;
  const SIDE2: View = { kind: "side", originX: springX, groundY: GROUND, ppm: PPM };
  const ballReal = Math.max(0, (vf - vSpring) / 20); // real frames of flight after the spring
  // The scene opens after the kick: the ball rewinds back onto its spot with the leg.
  const rewindT = 14 * (1 - progress(frame, 4, rewindEnd - 6, EASE.standard));
  let ballPos: P = frame < rewindEnd ? flightPoint(DRIVE, SIDE, 0, rewindT, 1) : REST;
  if (frame >= contactStart && frame < tSpring) ballPos = { x: J.ankle.x + CONTACT_DX - flat * BALL_R, y: REST.y };
  else if (frame >= tSpring) ballPos = flightPoint(DRIVE, SIDE2, 0, ballReal, 1);
  const ballGone = frame > rampB + 10;

  // ---------- Camera ----------
  const camKeys: CamKey[] = [
    { f: 0, x: CAM_START.x, y: CAM_START.y, zoom: Z0 },
    { f: 8, x: CAM_START.x, y: CAM_START.y, zoom: Z0 * 1.005 },
    { f: 64, x: 830, y: 480, zoom: 0.96 },
    { f: swingStart, x: 835, y: 488, zoom: 0.98 },
    { f: kick, x: 860, y: 560, zoom: 1.06 },
    { f: tTramp, x: 866, y: 562, zoom: 1.08 },
    { f: tTramp + 40, x: REST.x - 60, y: REST.y - 30, zoom: 2.5 },
    { f: tSpring, x: REST.x - 30, y: REST.y - 34, zoom: 2.62 },
    { f: tSpring + 34, x: REST.x + 40, y: REST.y - 60, zoom: 2.2 },
    { f: tLeg + 14, x: REST.x + 150, y: REST.y - 210, zoom: 1.26 },
    { f: rampA, x: REST.x + 175, y: REST.y - 205, zoom: 1.3 },
    { f: tClub + 8, x: CAM_WIDE.x, y: CAM_WIDE.y, zoom: WIDE },
    { f: pushStart, x: CAM_WIDE.x + 6, y: CAM_WIDE.y + 4, zoom: WIDE },
    { f: pushEnd, x: CAM_SPLIT.x, y: CAM_SPLIT.y, zoom: Z_SPLIT },
    { f: END, x: CAM_SPLIT.x, y: CAM_SPLIT.y, zoom: Z_SPLIT },
  ];
  const cam: Cam = cameraAt(frame, camKeys);
  const S = (p: P) => toScreen(p, cam);

  // ---------- Leg effects ----------
  const scanX = lerp(-200, WIDTH + 200, progress(frame, 0, 16, EASE.soft));
  // The thigh glows while it swings. As it slows, the glow fades and a pulse runs down to the shin.
  const thighAmt = progress(frame, swingStart - 4, 10) * (1 - progress(frame, tSlows, 26, EASE.soft));
  const shinAmt = progress(frame, snapStart - 4, 8) * (1 - progress(frame, kick + 18, 14, EASE.soft));
  const highlight: ("thigh" | "shin" | "foot")[] = frame < snapStart - 4 ? ["thigh"] : ["shin", "foot"];
  const hlAmount = frame < snapStart - 4 ? thighAmt : shinAmt;
  const pulseU = clamp01((frame - tSlows) / (snapStart - tSlows));
  const pulseOn = frame >= tSlows && frame <= snapStart + 4 ? 1 - progress(frame, snapStart, 4) : 0;
  const pulsePos =
    pulseU < 0.5
      ? { x: lerp(J.hip.x, J.knee.x, pulseU * 2), y: lerp(J.hip.y, J.knee.y, pulseU * 2) }
      : { x: lerp(J.knee.x, J.ankle.x, pulseU * 2 - 1), y: lerp(J.knee.y, J.ankle.y, pulseU * 2 - 1) };
  // "flings your shin forward": the leg turns into a bullwhip (thigh = handle, shin and foot = lash) for
  // about 0.8 s. One loop runs down the lash and cracks at the toe as the foot meets the ball.
  const whipAmt = progress(frame, tFlings, 7, EASE.enter) * (1 - progress(frame, kick + 5, 12, EASE.exit));
  const whipPhase = Math.pow(clamp01((frame - tFlings) / (kick - tFlings)), 1.5);
  const footLen = Math.hypot(J.toe.x - J.ankle.x, J.toe.y - J.ankle.y) || 1;
  const footA = Math.atan2(J.toe.x - J.ankle.x, J.toe.y - J.ankle.y); // limb angle: 0 = down, + = forward
  // The popper trails behind the swing, straightens at the crack and flicks a little past it.
  const curl = frame < kick ? 1.1 * (1 - whipPhase) : -0.35 * Math.sin(Math.PI * clamp01((frame - kick) / 10));
  const tail = {
    x: J.toe.x + Math.sin(footA - curl) * footLen * 0.55,
    y: Math.min(GROUND - 12, J.toe.y + Math.cos(footA - curl) * footLen * 0.55),
  };
  const crack = frame >= kick - 1 && frame < kick + 11 ? 1 - (frame - kick + 1) / 12 : 0;
  const trailOn = visible(frame, swingStart, kick + 16, 8, 12) * (1 - 0.6 * whipAmt);
  const trailToe: P[] = [];
  const trailKnee: P[] = [];
  if (trailOn > 0.001) {
    for (let i = 12; i >= 0; i--) {
      const jj = joints(followPose(Math.max(0, clockAt(frame) - i * 1.2)));
      trailToe.push(jj.toe);
      trailKnee.push(jj.knee);
    }
  }
  const speedGlow = progress(frame, snapStart + 4, 10) * (1 - progress(frame, kick + 26, 16, EASE.soft));

  // Ghost body: its hip sits on the x-ray hip.
  const gj = solve(pose, H);
  const ghostGround = HIP.y + gj.lowest + (pose.lift ?? 0) * H;

  // ---------- Trampoline ----------
  const cutAmt = progress(frame, tTramp + 8, 14, EASE.enter) * (1 - progress(frame, tSpring + 16, 16, EASE.soft));
  const rel = frame - tSpring;
  const bow = frame < contactStart ? 0 : frame < tSpring ? (flat / 0.33) * 0.95 : -0.55 * Math.exp(-rel / 9) * Math.sin(rel / 2.6);
  const ringU = clamp01((frame - contactStart) / contactLen);
  const ringOp = visible(frame, contactStart - 8, tSpring + 16, 8, 10);

  // ---------- Arrows: the ball bounces off faster than the foot ----------
  const arrowsOn = visible(frame, tBounces, rampA, 12, 6);
  const footSpeed = 3.0; // world px per frame at 1/100 (from the leg blend)
  const ballSpeed = (21.7 * PPM * SUPER) / 30;
  const aK = 44 * cam.zoom;
  const toeS = S(J.toe);
  const bS = S(ballPos);
  const footArrowY = Math.max(toeS.y + 30, bS.y + BALL_R * cam.zoom + 34);

  // ---------- The club player (wide shot) ----------
  const gOn = progress(frame, tClub - 4, 12, EASE.enter) * (1 - progress(frame, pushStart - 10, 16, EASE.soft));
  const gSwing = frame - ghostKick;
  const gPose: Pose =
    gSwing < -14
      ? { ...BACK, nearHip: BACK.nearHip + idle(frame, 2, 2.4, 1.5) }
      : gSwing < 0
        ? mixPose(BACK, CONTACT, easeSnap(clamp01((gSwing + 14) / 14)))
        : followMix(1 - Math.pow(1 - clamp01(gSwing / 26), 2));
  const gReal = Math.max(0, gSwing) * GSLOW;
  const gBall = flightPoint(GHOST, SIDE_G, 0, gReal, 1);
  const gBallS = S(gBall);
  const gTrail = GHOST.slice(0, Math.max(1, Math.floor(gReal) + 1)).map((q) => ({ x: SIDE_G.originX + q.pos.x * PPM, y: GROUND - q.pos.z * PPM }));
  gTrail.push(gBall);
  const count = KMH * progress(frame, ghostKick + 2, landAt - ghostKick - 2, EASE.soft);
  const landed = frame >= landAt;
  const tagOn = visible(frame, ghostKick + 2, Math.min(tHour - 2, pushStart + 12), 10, 10);
  const tagPulse = 1 + 0.14 * Math.sin(Math.PI * clamp01((frame - landAt) / 12)) * (landed ? 1 : 0);
  const mphIn = popSoft(frame, landAt + 4);
  const TAG_TOP = -64;
  const tagH = 88 + 46 * clamp01(mphIn);
  const tagX = Math.min(gBallS.x, WIDTH - 190);
  const tagY = gBallS.y - BALL_R * cam.zoom - 16 - (TAG_TOP + tagH + 20);

  // Town car on a lane at the bottom: the same slow motion and scale as the club player's ball.
  const carPxPerFrame = (CAR_MS * GSLOW * PPM * WIDE) / 30;
  const overtakeAt = tSixty - 2;
  const ballXAt = (f: number) => WIDTH / 2 + (REST_G.x + sampleAt(GHOST, Math.max(0, f - ghostKick) * GSLOW).pos.x * PPM - CAM_WIDE.x) * WIDE;
  const carX = ballXAt(overtakeAt) + carPxPerFrame * (frame - overtakeAt);
  const laneOn = visible(frame, rampB, pushStart + 18, 14, 10);
  const LANE_Y = 1012;

  // ---------- The end: Tavi's next ball, and the split screen of s05 ----------
  const nextBall = popSoft(frame, readyAt + 10);
  const worldFade = 1 - progress(frame, pushEnd - 18, 22, EASE.soft);
  const splitOp = progress(frame, pushEnd - 6, 8, EASE.soft);
  const splitDraw = progress(frame, pushEnd - 4, 12, EASE.standard);
  const splitRight = progress(frame, pushEnd - 2, 14, EASE.enter);

  const worldBall = ballGone ? null : frame < rewindEnd ? (
    <Flight path={DRIVE} view={SIDE} at={0} frame={rewindT} r={BALL_R} trail={false} lineNormal={LINE_N} />
  ) : frame < tSpring ? (
    <Ball cx={ballPos.x} cy={ballPos.y} r={BALL_R} view={SIDE} lineNormal={LINE_N} />
  ) : (
    <Flight path={DRIVE} view={SIDE2} at={0} frame={ballReal} r={BALL_R} trail={frame >= rampA} trailColor={CAST.ball} trailOpacity={0.5 * (1 - progress(frame, rampB, 8))} lineNormal={LINE_N} />
  );

  return (
    <Stage bg={BACKGROUND["X-ray Physics"]}>
      <g>
        <rect width={WIDTH} height={HEIGHT} fill={XRAY.bg} />
        <g transform={camTransform(cam)}>
          <WorldGrid cam={cam} opacity={worldFade} />
          <g opacity={worldFade}>
            <line x1={-3000} y1={GROUND} x2={9000} y2={GROUND} stroke={XRAY.tissue} strokeWidth={5 / cam.zoom} opacity={0.55} />
            {/* Ground ticks every half metre. */}
            {Array.from({ length: 40 }, (_, i) => {
              const x = REST.x - 4 * PPM + i * 0.5 * PPM;
              return <rect key={i} x={x - 3} y={GROUND + 10} width={6} height={i % 2 ? 16 : 30} rx={3} fill={XRAY.tissue} opacity={0.6} />;
            })}
          </g>
          {/* The club player and the ghost ball. */}
          {gOn > 0.001 ? (
            <g opacity={gOn * worldFade}>
              <DashedKicker x={HIP_G.x} hipY={HIP_G.y} h={H_G} pose={gPose} dash={frame * 1.5} />
              {gSwing >= 0 ? (
                <path
                  d={`M${gTrail.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`}
                  fill="none"
                  stroke={XRAY.bone}
                  strokeWidth={6}
                  strokeDasharray="6 16"
                  strokeLinecap="round"
                  opacity={0.55}
                />
              ) : null}
              {/* Ghost ball: a dashed outline at 40%, no fill. */}
              <circle
                cx={gBall.x}
                cy={gBall.y}
                r={BALL_R}
                fill="none"
                stroke={PITCH.chalk}
                strokeWidth={9}
                strokeDasharray="20 13"
                strokeDashoffset={-gReal * 8}
                strokeLinecap="round"
                opacity={0.4}
              />
            </g>
          ) : null}
          {/* Ghost body and the x-ray kicking leg. */}
          <Player x={HIP.x} groundY={ghostGround} h={H} pose={pose} ghost opacity={0.62 * worldFade} />
          <MotionTrail pts={trailKnee} color={XRAY.bone} width={10} opacity={trailOn * 0.5} />
          <MotionTrail pts={trailToe} color={XRAY.bone} width={22} opacity={trailOn * 0.8} />
          {speedGlow > 0.001 ? (
            <>
              <Glow cx={J.knee.x} cy={J.knee.y} r={46} color={XRAY.bone} intensity={0.8 * speedGlow} rings={3} />
              <Glow cx={J.toe.x} cy={J.toe.y} r={150} color={XRAY.bone} intensity={2.2 * speedGlow} rings={5} />
            </>
          ) : null}
          <g opacity={1 - 0.88 * whipAmt}>
            {thighAmt > 0.001 ? (
              <line x1={J.hip.x} y1={J.hip.y} x2={J.knee.x} y2={J.knee.y} stroke={XRAY.pink} strokeWidth={H * 0.085} strokeLinecap="round" opacity={0.55 * thighAmt} />
            ) : null}
            {shinAmt > 0.001 ? (
              <polyline
                points={`${J.knee.x},${J.knee.y} ${J.ankle.x},${J.ankle.y} ${J.toe.x},${J.toe.y}`}
                fill="none"
                stroke={XRAY.pink}
                strokeWidth={H * 0.07}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.5 * shinAmt}
              />
            ) : null}
            <XRayLeg x={HIP.x} y={HIP.y} h={H} pose={pose} highlight={highlight} highlightAmount={hlAmount} />
          </g>
          <Bullwhip
            hip={J.hip}
            knee={J.knee}
            ankle={J.ankle}
            toe={J.toe}
            tail={tail}
            amount={whipAmt}
            phase={whipPhase}
            loop={H * 0.1}
            handleW={H * 0.07}
            lashW={H * 0.05}
          />
          {/* The crack: a spark at the toe tip as the foot meets the ball. */}
          {crack > 0 ? (
            <g opacity={crack}>
              <Glow cx={J.toe.x} cy={J.toe.y} r={120} color={XRAY.bone} intensity={2} rings={4} />
              <circle cx={J.toe.x} cy={J.toe.y} r={16 + 10 * crack} fill="#FFFFFF" />
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const a = (i / 8) * Math.PI * 2 + 0.2;
                const r0 = 28 + (1 - crack) * 40;
                const len = i % 2 ? 26 : 44;
                return (
                  <line
                    key={i}
                    x1={J.toe.x + Math.cos(a) * r0}
                    y1={J.toe.y + Math.sin(a) * r0}
                    x2={J.toe.x + Math.cos(a) * (r0 + len)}
                    y2={J.toe.y + Math.sin(a) * (r0 + len)}
                    stroke={i % 2 ? XRAY.pink : "#FFFFFF"}
                    strokeWidth={7}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          ) : null}
          {pulseOn > 0.001 ? (
            <g opacity={pulseOn}>
              <Glow cx={pulsePos.x} cy={pulsePos.y} r={60} color={XRAY.pink} intensity={1.6} rings={4} />
              <circle cx={pulsePos.x} cy={pulsePos.y} r={11} fill="#FFFFFF" />
            </g>
          ) : null}
          {/* Tavi's ball: normal, or the trampoline cutaway during the squash. */}
          <g opacity={1 - cutAmt}>{worldBall}</g>
          {cutAmt > 0.001 ? (
            <g opacity={cutAmt}>
              <CutawayBall cx={ballPos.x} cy={ballPos.y} r={BALL_R} flat={flat} bow={bow} ring={ringU} ringOpacity={ringOp} />
            </g>
          ) : null}
          {nextBall > 0.001 ? (
            <g transform={`translate(${NEXT_BALL.x} ${NEXT_BALL.y}) scale(${nextBall}) translate(${-NEXT_BALL.x} ${-NEXT_BALL.y})`}>
              <Ball cx={NEXT_BALL.x} cy={NEXT_BALL.y} r={BALL_R} view={{ kind: "side", originX: 0, groundY: 0, ppm: PPM }} lineNormal={LINE_N} />
            </g>
          ) : null}
        </g>
        <Motes seed="s04" opacity={worldFade} />
      </g>
      {/* X-ray switches on: one scan band sweeps across. */}
      {frame < 18 ? (
        <g opacity={0.5 * (1 - progress(frame, 10, 8))}>
          <rect x={scanX - 90} y={0} width={180} height={HEIGHT} fill={XRAY.bone} opacity={0.08} />
          <rect x={scanX - 4} y={0} width={8} height={HEIGHT} fill={XRAY.bone} opacity={0.7} />
        </g>
      ) : null}
      <SlowMoTag at={2} until={rewindEnd + 2} label="REWIND" />

      {/* ---------- Screen-space graphics ---------- */}
      <Label x={S(HIP).x + 470} y={S(HIP).y - 60} text="WHIP" at={tWhip} until={kick + 2} size={64} />
      <SlowMoTag at={swingStart - 8} until={tTramp} />
      <SlowMoTag at={tTramp + 6} until={rampA} label="SUPER SLOW MOTION" />
      <SlowMoTag at={tClub} until={pushStart + 6} />
      <Label x={bS.x} y={bS.y - BALL_R * cam.zoom * 1.32 - 80} text="TRAMPOLINE" at={tTrampWord} until={tLeg - 8} size={48} />

      <TrolleyInset x={1110} y={70} w={740} h={340} at={tLeg} bump={bump} until={rampB} pulseAt={tHeavier} />

      {arrowsOn > 0.001 ? (
        <g opacity={arrowsOn}>
          <FlatArrow x={toeS.x + 10} y={footArrowY} len={footSpeed * aK * progress(frame, tBounces, 12, EASE.enter)} color={PITCH.teal} width={14} />
          <FlatArrow x={bS.x + BALL_R * cam.zoom + 16} y={bS.y} len={ballSpeed * aK * progress(frame, tBounces + 8, 12, EASE.enter)} color={CAST.ball} width={14} />
          <Label x={toeS.x - 14} y={footArrowY} text="FOOT" at={tBounces} anchor="end" size={36} bg={PITCH.teal} color={XRAY.bg} />
          <Label x={bS.x} y={bS.y - BALL_R * cam.zoom - 50} text="BALL" at={tBounces + 8} size={36} bg={CAST.ball} color={XRAY.bg} />
        </g>
      ) : null}

      {/* Club players, age 12: note, speed tag and the town car. */}
      <Label x={S(HIP_G).x} y={S({ x: HIP_G.x, y: HIP_G.y - 0.62 * H_G }).y - 56} text="club players, age 12" at={tClub + 2} until={pushStart} size={38} bg={XRAY.grid} color={XRAY.bone} />
      {tagOn > 0.001 ? (
        <g opacity={tagOn} transform={`translate(${tagX} ${tagY}) scale(${tagPulse})`}>
          <rect x={-150} y={TAG_TOP} width={300} height={tagH} rx={44} fill={XRAY.bone} />
          {gBallS.x < WIDTH - 150 ? (
            <path d={`M${gBallS.x - tagX - 14},${TAG_TOP + tagH - 4} L${gBallS.x - tagX},${TAG_TOP + tagH + 20} L${gBallS.x - tagX + 14},${TAG_TOP + tagH - 4} Z`} fill={XRAY.bone} />
          ) : null}
          <text y={TAG_TOP + 62} fill={XRAY.bg} fontFamily={FONTS.hud} fontWeight={700} fontSize={50} textAnchor="middle">
            {`≈ ${Math.round(count)} km/h`}
          </text>
          {mphIn > 0.001 ? (
            <text y={TAG_TOP + 112} fill={XRAY.tissue} fontFamily={FONTS.hud} fontWeight={700} fontSize={34} textAnchor="middle" opacity={Math.min(1, mphIn)}>
              {`≈ ${MPH} mph`}
            </text>
          ) : null}
        </g>
      ) : null}
      {laneOn > 0.001 ? (
        <g opacity={laneOn}>
          <line x1={0} y1={LANE_Y + 4} x2={WIDTH} y2={LANE_Y + 4} stroke={XRAY.tissue} strokeWidth={4} strokeDasharray="30 22" opacity={0.6} />
          <TownCar x={carX} y={LANE_Y} size={150} roll={carX} />
        </g>
      ) : null}

      {/* The split screen of s05 builds over the last frames. */}
      <SplitOpen f={frame - END} opacity={splitOp} draw={splitDraw} rightIn={splitRight} />

      {/* ---------- Sound ---------- */}
      <Sfx name="whoosh" at={0} volume={0.25} />
      <Sfx name="pop" at={tWhip} volume={0.3} />
      <Sfx name="subdrop" at={swingStart - 8} volume={0.45} />
      <Sfx name="whoosh-long" at={swingStart} volume={0.3} />
      {/* Whip crack: a sharp click, a short hiss of noise and a pop. */}
      <Sfx name="tick" at={kick - 1} volume={0.9} />
      <Sfx name="net" at={kick - 1} volume={0.4} dur={3} />
      <Sfx name="pop" at={kick - 1} volume={0.45} />
      <Sfx name="thump" at={kick} volume={0.45} />
      <Sfx name="whoosh" at={tTramp} volume={0.25} />
      <Sfx name="thump" at={contactStart} volume={0.3} />
      <Sfx name="pop-soft" at={tSpring} volume={0.45} />
      <Sfx name="pop" at={tSpring + 2} volume={0.25} />
      <Sfx name="pop-soft" at={tLeg} volume={0.3} />
      <Sfx name="thump" at={bump} volume={0.35} />
      <Sfx name="tick" at={bump + 1} volume={0.25} />
      <Sfx name="whoosh" at={rampA + 4} volume={0.35} />
      <Sfx name="air" at={rampB} volume={0.12} dur={110} />
      <Sfx name="pop-soft" at={tClub + 2} volume={0.3} />
      <Sfx name="thump" at={ghostKick} volume={0.3} />
      {Array.from({ length: Math.max(0, Math.floor((landAt - ghostKick) / 6)) }, (_, i) => (
        <Sfx key={i} name="tick" at={ghostKick + 4 + i * 6} volume={0.1} dur={6} />
      ))}
      <Sfx name="pop-soft" at={landAt} volume={0.4} />
      <Sfx name="whoosh" at={pushStart + 4} volume={0.25} />
      <Sfx name="chalk" at={pushEnd - 8} volume={0.35} />
    </Stage>
  );
};

