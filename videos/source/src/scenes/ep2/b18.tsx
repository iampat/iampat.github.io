// b18 Steal time (teaser): the fake. It opens on the wide side view that b17's outro ends on (Tavi with
// the ball, Chalk 7.2 m out) and Chalk starts to jog in at once while the chalk card pops. Then it cuts to a front view from behind Tavi, where left
// and right are left and right on screen. Slow motion: her shoulders dip left (an arrow and the word
// "fake"), the ball goes right on "ball the other", and Chalk leans left, away from the ball. Freeze: a
// pink FAKE bar over his head fills to half a second (adult footballers, life-size video test). Then
// real time: she takes the ball past him, two of his footprints appear and a hand in her colours
// snatches them. He looks down at the empty grass, then up with both eyebrows; the chalk card rubs
// itself out down to its "?". FEINT from src/physics/ep2sims.ts.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../../kit/Camera";
import { Dust, GroundSide } from "../../kit/World";
import { Player, POSES } from "../../kit/Player";
import { Keeper, KPOSES, type KeeperPose } from "../../kit/Keeper";
import { Ball } from "../../kit/Ball";
import { Arrow, Label, SlowMoTag } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { FEINT } from "../../physics/ep2sims";
import { rollAt } from "../../physics/touch";
import { useCues } from "../../lib/timing";
import { type View } from "../../lib/project";
import { clamp01, idle, lerp } from "../../lib/anim";
import { CAST, PITCH, XRAY } from "../../theme";
import { BACK, ChalkFront, FrontPitch, GroundShadow, NightBackdrop, TaviBack, backAnchors, backRun, breathe, camT, fp, frontCamAt, frontView, mixBack, type BackPose, type FrontCam } from "../../kit/ext/ep2-b18-b19-world";
import { FakeBar, StealCard, StolenSteps, frameOf, simTime, type TimeKey } from "../../kit/ext/ep2-b18-b19-hud";

const smooth = (u: number) => {
  const s = clamp01(u);
  return s * s * (3 - 2 * s);
};
const norm = (x: number, y: number) => {
  const d = Math.hypot(x, y);
  return { x: x / d, y: y / d };
};
const lerpK = (a: KeeperPose, b: KeeperPose, u: number): KeeperPose => ({
  left: lerp(a.left, b.left, u),
  right: lerp(a.right, b.right, u),
  lean: lerp(a.lean, b.lean, u),
  shift: lerp(a.shift, b.shift, u),
  lift: lerp(a.lift, b.lift, u),
  stretch: lerp(a.stretch, b.stretch, u),
});
const mixK = (a: KeeperPose, b: KeeperPose, u: number) => lerpK(a, b, smooth(u));
/** Chalk's jog: runA -> runB -> runA, one half stride per unit of `psi`. */
const jog = (psi: number): KeeperPose => {
  const h = Math.floor(psi);
  const u = smooth(psi - h);
  return h % 2 === 0 ? lerpK(KPOSES.runA, KPOSES.runB, u) : lerpK(KPOSES.runB, KPOSES.runA, u);
};
/** Pose at time T from [time, pose] keys, smoothstep between keys. */
const backAt = (T: number, track: [number, BackPose][]): BackPose => {
  if (T <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    if (T <= track[i][0]) {
      const [t0, p0] = track[i - 1];
      const [t1, p1] = track[i];
      return mixBack(p0, p1, smooth((T - t0) / Math.max(1e-6, t1 - t0)));
    }
  }
  return track[track.length - 1][1];
};

// ---------- Opening: the wide side view b17's outro ends on (keep frame 0 as it is) ----------
const PPM = 50;
const OX = 960; // world x of Tavi's spot
const GROUND = 820;
const X = (m: number) => OX + m * PPM;
const SIDE: View = { kind: "side", originX: OX, groundY: GROUND, ppm: PPM };
const S_CAM0 = { x: X(3.6), y: GROUND - 95, zoom: 2.0 };
const S_BALL = 0.45;
const CHALK_FAR = 7.2; // where Chalk stands at the join
const CHALK_D0 = 3.4; // his distance to Tavi as the slow motion starts (m)
const V_CLOSE = 1.5; // he jogs in, then slows down to close her down
const JOG_AT = 4;

// ---------- The fake, front view, in metres (x towards the goal, y to Tavi's left) ----------
const GOAL_M = 18;
const BALL_R = 0.11;
const B0 = { x: 0.35, y: -0.45 }; // the ball, just outside her right foot
const PUSH_DIR = norm(0.45, -0.89); // to her right and a little forward
const RUN_DIR = norm(0.94, -0.34); // then up the pitch, past Chalk
const T_PUSH = 0.45;
const T_MEET = T_PUSH + 0.7; // she reaches the ball after its 1.9 m (rollAt(3.0, 0.7))
const T_FREEZE = 0.95;
const T_STUCK0 = 0.5; // Chalk is fully committed the wrong way ...
const T_STUCK1 = T_STUCK0 + FEINT.wrongWay; // ... for half a second
const V_RUN = 4;
const T_CRUISE = 2.2;
const T_STOP = 3.0;

const ballFree = (T: number) => {
  const r = T < T_PUSH ? 0 : rollAt(FEINT.pushSpeed, T - T_PUSH).x;
  return { x: B0.x + PUSH_DIR.x * r, y: B0.y + PUSH_DIR.y * r, r };
};
const MEET = (() => {
  const b = ballFree(T_MEET);
  return { x: b.x - PUSH_DIR.x * 0.35, y: b.y - PUSH_DIR.y * 0.35 };
})();
const runDist = (T: number) => {
  if (T <= T_MEET) return 0;
  if (T <= T_CRUISE) return V_RUN * (T - T_MEET);
  const L = T_STOP - T_CRUISE;
  const w = Math.min(T, T_STOP) - T_CRUISE;
  return V_RUN * (T_CRUISE - T_MEET) + V_RUN * (w - (w * w) / (2 * L));
};
const taviAt = (T: number) => {
  if (T <= T_PUSH) return { x: 0, y: 0 };
  if (T < T_MEET) {
    const u = (T - T_PUSH) / (T_MEET - T_PUSH);
    const k = 0.5 * u + 0.5 * u * u;
    return { x: MEET.x * k, y: MEET.y * k };
  }
  const d = runDist(T);
  return { x: MEET.x + RUN_DIR.x * d, y: MEET.y + RUN_DIR.y * d };
};
/** The ball: pushed, rolling and slowing, then dribbled a stride ahead of her until she stops it. */
const ballAt = (T: number) => {
  if (T < T_MEET) {
    const b = ballFree(T);
    return { x: b.x, y: b.y, roll: b.r, dir: PUSH_DIR };
  }
  const p = taviAt(T);
  const lead = lerp(0.42 + 0.2 * Math.sin(((T - T_MEET) * Math.PI * 2) / 0.55), 0.36, smooth((T - (T_STOP - 0.35)) / 0.35));
  return { x: p.x + RUN_DIR.x * lead, y: p.y + RUN_DIR.y * lead, roll: ballFree(T_MEET).r + runDist(T), dir: RUN_DIR };
};
const chalkPos = (T: number) => ({
  x: CHALK_D0 - 0.5 * smooth(T / 0.4),
  // A step to his left as he bites, and half of it back as he recovers.
  y: 0.25 * smooth((T - 0.25) / 0.3) - 0.12 * smooth((T - T_STUCK1) / 0.45),
});

// Chalk (front view, no flip: negative lean and shift go to screen left).
const LEAN_L: KeeperPose = { left: 30, right: 104, lean: -24, shift: -0.12, lift: 0.02, stretch: 1.03 };
const CLOSE_IN: KeeperPose = { left: 42, right: 42, lean: 0, shift: 0, lift: 0, stretch: 0.96 };
const LOOK_DOWN: KeeperPose = { left: 10, right: 10, lean: 5, shift: 0.01, lift: 0, stretch: 0.93 };

// The front camera: behind Tavi's left shoulder and above, so Chalk (leaning left) and Tavi with the ball
// (going right) never hide one another.
type FrontKey = { f: number } & FrontCam;

export const B18: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b18");

  // ---------- Beats ----------
  const tOne = cue("One more way");
  const tSteal = cue("steal time");
  const tShoulders = cue("Shoulders one way");
  const tBall = cue("ball the other");
  const tTest = cue("One test");
  const tAdult = cue("adult players");
  const tFake = cue("a fake cost the defender");
  const tHalf = cue("half a second");
  const tTwo = cue("Two of Chalk's steps");
  const tStolen = cue("stolen");
  const tStolenEnd = cue.wordEnd("stolen");
  const tBut = cue("But that's for another night");
  const tButEnd = cue.wordEnd("But that's for another night");
  const END = cue.frames;

  const cutF = tShoulders - 3; // cut to the front view as the slow motion starts
  const freezeF = tFake - 1;
  const fillEnd = tHalf + 14;
  const unfreezeF = fillEnd + 2;
  const T_RESUME = T_FREEZE + ((tTwo - unfreezeF) * 0.3) / 30; // slow motion again, then real time from "Two"
  const TIME: TimeKey[] = [
    [cutF, 0],
    [tBall, T_PUSH],
    [freezeF, T_FREEZE],
    [unfreezeF, T_FREEZE],
    [tTwo, T_RESUME],
    [tTwo + 30, T_RESUME + 1],
  ];
  const T = frame < cutF ? 0 : simTime(frame, TIME);
  const catchF = Math.round(frameOf(T_MEET, TIME));
  const lookDownF = tStolenEnd - 4;
  const browsF = tStolenEnd + 8;

  const clockHours = frame >= tButEnd + 12 ? 21.317 : 21.3;
  const hud = (
    <>
      <StealCard x={80} y={985} at={tOne + 10} wordsAt={tSteal - 9} markAt={tSteal + 12} rubAt={tBut + 2} />
      <Sfx name="chalk" at={tSteal - 2} volume={0.4} />
      <Sfx name="pop" at={tSteal + 14} volume={0.35} />
      <Sfx name="whoosh" at={JOG_AT} volume={0.2} />
      <Sfx name="subdrop" at={cutF} volume={0.4} />
      <Sfx name="air" at={cutF + 8} volume={0.3} />
      <Sfx name="thump" at={tBall} volume={0.4} />
      <Sfx name="tick" at={freezeF} volume={0.45} />
      <Sfx name="pop-soft" at={tTest} volume={0.3} />
      <Sfx name="tick" at={tFake} volume={0.3} />
      <Sfx name="blip" at={fillEnd - 4} volume={0.3} />
      <Sfx name="whoosh" at={unfreezeF} volume={0.2} />
      <Sfx name="thump" at={catchF} volume={0.25} />
      <Sfx name="whoosh" at={tTwo + 2} volume={0.25} />
      <Sfx name="chalk" at={tTwo} volume={0.4} />
      <Sfx name="chalk" at={tTwo + 9} volume={0.4} />
      <Sfx name="whoosh" at={tStolen} volume={0.2} />
      <Sfx name="blip" at={tStolen + 10} volume={0.35} />
      <Sfx name="blip" at={browsF + 2} volume={0.3} />
      <Sfx name="chalk" at={tBut + 2} volume={0.45} />
      <Sfx name="tick" at={tButEnd + 12} volume={0.35} />
    </>
  );

  // ================= Opening: b17's last frame, continued =================
  // Chalk stands 7.2 m out at the join (b17 ends on this frame), jogs in at once and slows to close her
  // down, 3.4 m out as the slow motion starts.
  const D = CHALK_FAR - CHALK_D0;
  const span = cutF - JOG_AT;
  const m1 = ((V_CLOSE / 30) * span) / D;
  const herm = (u: number) => -2 * u * u * u + 3 * u * u + (u * u * u - u * u) * m1;
  const hermV = (u: number) => (-6 * u * u + 6 * u + (3 * u * u - 2 * u) * m1) * (D / span) * 30; // m/s
  let psi = 0;
  for (let k = JOG_AT; k < Math.min(frame, cutF); k++) psi += (0.35 + (0.65 * hermV((k - JOG_AT) / span)) / 4) / 5;

  if (frame < cutF) {
    const u = clamp01((frame - JOG_AT) / span);
    const chalkM = CHALK_FAR - D * herm(u);
    const standK: KeeperPose = { ...KPOSES.stand, stretch: 1 + idle(frame, 5, 2.6, 0.008), lean: idle(frame, 6, 3.1, 1.5) };
    const going = smooth((frame - JOG_AT) / 8);
    const slow = u > 0.5 ? 1 - hermV(u) / 2.6 : 0;
    const kPose = lerpK(standK, lerpK(jog(psi), KPOSES.ready, 0.5 * clamp01(slow)), going);
    const pose = breathe(POSES.receiveReady, frame, 1);
    const keys: CamKey[] = [
      { f: 0, ...S_CAM0 },
      { f: cutF, x: X(2.4), y: GROUND - 92, zoom: 2.12 },
    ];
    const cam = cameraAt(frame, keys);
    const steps = Array.from({ length: 6 }, (_, i) => JOG_AT + 6 + i * 9);
    return (
      <Stage bg={PITCH.sky}>
        <NightBackdrop cam={cam} ground={GROUND} refX={X(0)} seed="b18" clockHours={clockHours} />
        <g transform={camT(cam)}>
          <GroundSide groundY={GROUND} vanishX={X(8)} />
          {steps.map((f, i) => (
            <Dust key={i} x={X(CHALK_FAR - D * herm(clamp01((f - JOG_AT) / span)))} y={GROUND} at={f} size={20} seed={`step${i}`} />
          ))}
          <Player x={X(0)} groundY={GROUND} h={1.62 * PPM} pose={pose} face="focus" />
          <Ball cx={X(S_BALL)} cy={GROUND - 0.11 * PPM} r={0.11 * PPM} view={SIDE} axis={{ x: 0, y: -1, z: 0 }} angle={0} />
          <Keeper x={X(chalkM)} groundY={GROUND} h={2.1 * PPM} pose={kPose} face="flat" look={0.8} flip />
        </g>
        {hud}
      </Stage>
    );
  }

  // ================= The fake: front view from behind Tavi =================
  const CAM: FrontKey[] = [
    { f: cutF, x: -4.0, y: 2.0, z: 2.6, yaw: -12, pitch: -12.5, focal: 1260 },
    { f: freezeF, x: -3.85, y: 1.95, z: 2.55, yaw: -12.4, pitch: -12.5, focal: 1340 },
    { f: unfreezeF, x: -3.83, y: 1.95, z: 2.55, yaw: -12.5, pitch: -12.5, focal: 1352 },
    { f: tTwo, x: -3.6, y: 1.5, z: 2.5, yaw: -12, pitch: -12, focal: 1300 },
    { f: tStolenEnd, x: -3.6, y: 1.4, z: 2.6, yaw: -15, pitch: -9, focal: 1180 },
    { f: END, x: -3.6, y: 1.35, z: 2.6, yaw: -15.5, pitch: -8.5, focal: 1170 },
  ];
  const fcam = frontCamAt(frame, CAM);
  const view = frontView(fcam);

  // ---------- Tavi (from behind) ----------
  const tp = taviAt(T);
  const tS = fp(view, tp.x, tp.y, 0);
  const H = 1.62 * tS.scale;
  const runPhase = Math.max(0, T - 0.62) * 2.6;
  const settled = frame >= unfreezeF + 60 && T > T_STOP;
  let bp: BackPose = backAt(T, [
    [0, BACK.ready],
    [0.05, BACK.ready],
    [0.28, BACK.dip],
    [0.36, BACK.dip],
    [T_PUSH, BACK.push],
    [0.62, BACK.follow],
  ]);
  if (T > 0.62) bp = mixBack(bp, backRun(runPhase, T < T_MEET ? -9 : -4), smooth((T - 0.62) / 0.15));
  if (T > T_STOP - 0.35) bp = mixBack(bp, BACK.stand, smooth((T - (T_STOP - 0.35)) / 0.45));
  if (frame < freezeF || frame >= unfreezeF) {
    // Breathing, except in the freeze (a freeze is a freeze).
    bp = { ...bp, tilt: bp.tilt + idle(frame, 1, 3, settled ? 1.2 : 0.6), head: bp.head + idle(frame, 2, 3.4, 1.2) };
  }
  const ta = backAnchors(bp, tS.x, tS.y, H);

  // ---------- The ball ----------
  const b = ballAt(T);
  const bS = fp(view, b.x, b.y, BALL_R);
  const bG = fp(view, b.x, b.y, 0);
  const ballAxis = { x: b.dir.y, y: -b.dir.x, z: 0 };
  const b0S = fp(view, B0.x, B0.y, 0);
  const bMeetS = fp(view, ballFree(T_MEET).x, ballFree(T_MEET).y, 0);
  // "Ball the other": a lime arrow on the grass just in front of the ball's path.
  const arrowA = fp(view, B0.x + 0.3 * PUSH_DIR.x - 0.45, B0.y + 0.3 * PUSH_DIR.y, 0);
  const arrowB = fp(view, ballFree(T_MEET).x + 0.3 * PUSH_DIR.x - 0.45, ballFree(T_MEET).y + 0.3 * PUSH_DIR.y, 0);

  // ---------- Chalk (front view) ----------
  const cp = chalkPos(T);
  const cS = fp(view, cp.x, cp.y, 0);
  const CH = 2.1 * cS.scale;
  const psiF = psi + (T * 30) / 6;
  const closing = lerpK({ ...jog(psiF), lean: 0 }, CLOSE_IN, 0.5);
  let kPose: KeeperPose;
  let kLook = 0.4; // at her (she is to his screen right)
  if (T < 0.18) kPose = closing;
  else if (T < T_STUCK1) {
    kPose = mixK(closing, LEAN_L, (T - 0.18) / (T_STUCK0 - 0.18));
    if (T > T_STUCK0) kPose = { ...kPose, lean: kPose.lean + 2 * Math.sin((T - T_STUCK0) * 26), right: kPose.right + 4 * Math.sin((T - T_STUCK0) * 19) };
    kLook = lerp(0.4, -0.5, smooth((T - 0.18) / 0.3)); // fooled: his eyes go with her shoulders, the wrong way
  } else {
    kPose = mixK(LEAN_L, KPOSES.stand, (T - T_STUCK1) / 0.45);
    kLook = lerp(-0.5, 0.5, smooth((T - T_STUCK1) / 0.35)); // too late: she is past him, to screen right
  }
  if (frame >= unfreezeF + 20) kPose = { ...kPose, stretch: kPose.stretch * (1 + idle(frame, 5, 2.6, 0.008)) };
  // He looks down at the empty grass, then up: both eyebrows.
  const down = smooth((frame - lookDownF) / 8) * (1 - smooth((frame - browsF) / 7));
  if (down > 0) {
    kPose = lerpK(kPose, LOOK_DOWN, down);
    kLook = lerp(kLook, 0.3, down);
  }
  const browsUp = frame >= browsF;
  if (browsUp) kPose = { ...kPose, stretch: kPose.stretch * (1 + 0.025 * smooth((frame - browsF) / 6)) };

  // ---------- HUD anchors ----------
  const freezeView = frontView(frontCamAt(freezeF, CAM));
  const cpF = chalkPos(T_FREEZE);
  const cFeet = fp(freezeView, cpF.x, cpF.y, 0);
  const cHead = fp(freezeView, cpF.x, cpF.y, 2.1);
  const barX = cFeet.x - 70;
  const barY = cHead.y - 150;
  const prints = [0.9, 1.9].map((dy) => {
    const p = fp(view, cp.x, cp.y - dy, 0);
    return { x: p.x, y: p.y, s: p.scale };
  });
  // Footprints are drawn a little rounder than true perspective, so they read as prints and not dashes.
  const groundSquash = Math.max(0.8, clamp01(fcam.z / Math.max(1, cp.x - fcam.x)) * 1.1);
  const armFrom = { x: 2010, y: prints[1].y - 330 };

  // Draw back to front.
  const tavi = (
    <g key="tavi">
      <GroundShadow x={tS.x} y={tS.y} w={H * 0.36} />
      <TaviBack x={tS.x} groundY={tS.y} h={H} pose={bp} />
    </g>
  );
  const chalk = (
    <g key="chalk">
      <GroundShadow x={cS.x} y={cS.y} w={CH * 0.5} />
      <ChalkFront x={cS.x} groundY={cS.y} h={CH} pose={kPose} browsUp={browsUp} look={Math.max(-0.55, Math.min(0.5, kLook))} />
    </g>
  );
  const ball = (
    <g key="ball">
      <ellipse cx={bG.x} cy={bG.y} rx={BALL_R * bG.scale * 1.1} ry={BALL_R * bG.scale * 0.35} fill="#000" opacity={0.22} />
      {T > T_PUSH && T < T_MEET ? <line x1={b0S.x} y1={b0S.y - BALL_R * b0S.scale} x2={bS.x} y2={bS.y} stroke={PITCH.lightSoft} strokeWidth={BALL_R * bS.scale * 1.2} strokeLinecap="round" opacity={0.18} /> : null}
      <Ball cx={bS.x} cy={bS.y} r={BALL_R * bS.scale} view={view} axis={ballAxis} angle={b.roll / BALL_R} />
    </g>
  );
  const items: [number, React.ReactNode][] = [
    [tS.depth, tavi],
    [cS.depth, chalk],
    [bS.depth, ball],
  ];
  items.sort((p, q) => q[0] - p[0]);

  return (
    <Stage bg={PITCH.sky}>
      <FrontPitch view={view} cam={fcam} goalX={GOAL_M} clockHours={clockHours} seed="b18" clockZ={14.6} />
      <StolenSteps prints={prints} squash={groundSquash} toward={1} at={tTwo} snatchAt={tStolen} from={armFrom} />
      {items.map(([, node]) => node)}
      <Dust x={b0S.x} y={b0S.y} at={tBall} size={0.3 * b0S.scale} seed="push" />
      <Dust x={bMeetS.x} y={bMeetS.y} at={catchF} size={0.3 * bMeetS.scale} seed="catch" />

      {/* Shoulders one way (a pink arrow, the FAKE colour, and the word), ball the other (lime arrow). */}
      <Arrow x1={ta.head.x - ta.headR - 16} y1={ta.head.y + ta.headR * 0.9} x2={ta.head.x - ta.headR - 140} y2={ta.head.y + ta.headR * 0.9 + 34} at={tShoulders + 16} until={tBall + 40} color={CAST.mistake} width={10} dur={12} />
      <Label x={ta.head.x + 40} y={ta.head.y - ta.headR - 52} text="fake" at={tShoulders + 14} until={tTwo - 6} size={40} />
      <Arrow x1={arrowA.x} y1={arrowA.y} x2={arrowB.x} y2={arrowB.y} at={tBall - 1} until={tTwo - 6} color={XRAY.lime} width={10} dur={14} />

      <SlowMoTag at={cutF + 2} until={freezeF} />
      {frame >= freezeF + 1 ? <SlowMoTag at={freezeF + 1} until={unfreezeF} label="FREEZE" /> : null}
      {frame >= unfreezeF + 1 ? <SlowMoTag at={unfreezeF + 1} until={tTwo} /> : null}
      <FakeBar x={barX} y={barY} at={tTest} fillAt={tFake + 2} fillFrames={fillEnd - tFake - 2} until={tTwo + 2} seconds={FEINT.wrongWay} />
      <Label x={barX} y={barY + 106} text="adult footballers, life-size video test" at={tAdult} until={tTwo + 2} size={40} bg={PITCH.sky} color={PITCH.chalk} />
      {hud}
    </Stage>
  );
};
