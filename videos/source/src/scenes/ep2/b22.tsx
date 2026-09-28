// b22 Ending: lights out. The wide side view from b21: the chalk "?" is written on the grass at her feet
// again, rubs itself out, and a lime ring is drawn in its place. Three time coins drop into it while Chalk,
// still puffed, sinks back into the pitch and Sam waves and jogs off with the bag. The stand clock ticks on
// to half past nine, the floodlights clunk off one by one and the last pool of light stays on the ring.
// She walks off in a small pool of her own; the camera pushes in on her so the one look back over her
// shoulder reads: click (a soft flash once the head is round), and a polaroid drifts up into the dark. The
// ring glows once, the camera pulls back to the dark stadium as one warm dot among the city lights, then
// the end card, written on only after the polaroid and the pull-back are done, and a fade to the night sky.
// The card's hold is measured back from the scene's end, so a longer tail in the timeline lengthens it.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt } from "../../kit/Camera";
import { Dust, Glow } from "../../kit/World";
import { Player, POSES, SAM_COLORS, cyclePose, poseAt, solve, type Pose } from "../../kit/Player";
import { KPOSES } from "../../kit/Keeper";
import { Ball } from "../../kit/Ball";
import { Snapshot } from "../../kit/Snapshot";
import { Sfx } from "../../kit/Sfx";
import { sceneTiming, useCues } from "../../lib/timing";
import { EASE, idle, keys, lerp, progress } from "../../lib/anim";
import { HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import {
  BALL_R,
  CHALK_H,
  CLOCK_EARLY,
  ENDING_STAGE,
  END_CLOCK,
  GROUND,
  HANDS_ON_HIPS,
  NightBackdrop,
  ROLL_AXIS,
  SIDE,
  SideWorld,
  TAVI_H,
  TOWERS,
  WAVE,
  WIDE_END_CAM,
  X,
  breathe,
  depthHint,
  toScreen,
} from "../../kit/ext/ep2-b20-b22-world";
import { ChalkOneBrow, ChalkQuestion, ChalkX, CityNight, EndCard, GrassRing, NetBag, RingPhoto, TimeCoins } from "../../kit/ext/ep2-b20-b22-hud";

const S = ENDING_STAGE;
const RING_RX = 2.39 * 40; // the same ring scale as b19 and b20: 40 px per second, squashed 0.3
const RING_RY = RING_RX * 0.3;
const WAVE2: Pose = { ...WAVE, farElbow: -55, head: -2 };
const WALK_SPEED = 1.75; // m/s
const SAM_JOG = 2.8; // m/s
/** b21 ends on the same wide shot: the backdrop's own clock (twinkle, beam dust) carries on from it. */
const B21_FRAMES = sceneTiming("b21").frames;

export const B22: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b22");

  // ---------- Beats ----------
  const tWhere = cue("Where did the time go");
  const tNowhere = cue("Nowhere");
  const tBought = cue("You bought it before anyone noticed");
  const tBefore = cue("before");
  const tNoticed = cue.wordEnd("You bought it before anyone noticed");
  const tLights = cue("Lights out");
  const tNext = cue("Next pass that rolls at you");
  const tTake = cue("take a snapshot");
  const tSnapEnd = cue.wordEnd("take a snapshot");
  const END = cue.frames;

  const click = tTake + 11; // the head is fully round at tTake + 6: the flash lands after the turn
  const coinAt: [number, number, number] = [tBought + 6, tBought + 18, tBought + 30];
  const samGo = tBought + 32;
  const pullAt = tSnapEnd - 4; // the pull-back to the city starts on the end of "snapshot"
  const cityAt = pullAt + 2;
  const cityFull = cityAt + 12;
  const photoOff = tSnapEnd; // the polaroid is gone (8-frame exit) before the city is fully in
  const cardAt = cityFull + 2; // the end card writes on over the finished city shot
  const cardOff = END - 11; // hold to the end; the background fades to the night sky under it first

  const tv = depthHint(S.tavi.y);
  const sv = depthHint(S.sam.y);
  const ringW = { x: X(S.tavi.x), y: GROUND + tv.dy + 1 };

  // ---------- Tavi's walk (metres), needed by the camera that follows her ----------
  // She stands on her b21 mark until "Next pass", then speeds up evenly over 12 frames to walking pace.
  const walkM = (f: number) => {
    const s = Math.max(0, f - tNext);
    const d = s < 12 ? (s * s) / 24 : s - 6; // frames of walking-pace travel
    return S.tavi.x - (WALK_SPEED * d) / 30;
  };

  // ---------- Camera: the wide, the push to the ring, lights out, the push in on her look back, the city ----------
  const HEAD_Y = GROUND - 62;
  const cam = cameraAt(frame, [
    { f: 0, ...WIDE_END_CAM },
    { f: tWhere + 2, ...WIDE_END_CAM },
    { f: tWhere + 34, x: X(-6.3), y: GROUND - 95, zoom: 2.1 },
    { f: tNowhere + 24, x: X(-6.3), y: GROUND - 92, zoom: 2.2 },
    { f: tBought, x: X(-6.5), y: GROUND - 100, zoom: 2.0 },
    { f: tBought + 30, x: X(-8.2), y: GROUND - 130, zoom: 1.55 },
    { f: tLights - 6, x: X(-8.2), y: GROUND - 130, zoom: 1.55 },
    { f: tLights + 26, x: X(-7.0), y: GROUND - 205, zoom: 1.1 },
    { f: tNext, x: X(-7.1), y: GROUND - 196, zoom: 1.14 },
    { f: tTake - 2, x: X(walkM(tTake - 2) - 1.2), y: HEAD_Y, zoom: 2.6 },
    { f: pullAt, x: X(walkM(pullAt) - 1.2), y: HEAD_Y, zoom: 2.7 },
    { f: cityFull, x: X(-7.4), y: GROUND - 150, zoom: 0.86 },
  ]);

  // ---------- Tavi: looks down at the "?", then walks off and takes one snapshot over her shoulder ----------
  const lookDown = progress(frame, tWhere + 6, 14) * (1 - progress(frame, tNowhere + 30, 14));
  const taviM = walkM(frame);
  let taviPose: Pose;
  if (frame < tNext) {
    const base = breathe(HANDS_ON_HIPS, frame, 1, 0.8);
    taviPose = { ...base, head: base.head + 16 * lookDown };
  } else if (frame < tNext + 12) {
    taviPose = poseAt(frame, [
      [tNext, HANDS_ON_HIPS],
      [tNext + 12, cyclePose(12, "walk", 12)],
    ]);
  } else {
    taviPose = cyclePose(frame - tNext, "walk", 12);
  }
  const taviHeadTurn = frame < tNext ? keys(frame, [4, 22], [0.85, 0]) : keys(frame, [tTake - 2, tTake + 6, tTake + 18, tTake + 28], [0, 1, 1, 0]);
  const taviX = X(taviM);

  // ---------- Chalk: puffed, then he sinks back into the pitch, eyebrows last ----------
  const rise = 1 - progress(frame, tBefore, 34, EASE.standard);
  const kPose = { ...KPOSES.puffed, stretch: KPOSES.puffed.stretch * (1 + idle(frame, 5, 2.2, 0.01)) };
  const streak = progress(frame, tBefore + 10, 24) * (1 - progress(frame, tNoticed + 6, 30));

  // ---------- Sam: waves, taps the ball ahead, picks up the bag and jogs off ----------
  let samM = S.sam.x;
  let samPose: Pose;
  let samFlip = false;
  let samScale = 1;
  const samTurn = progress(frame, samGo, 8, EASE.standard);
  if (frame < samGo) {
    samPose = poseAt(frame, [
      [tBought, POSES.stand],
      [tBought + 8, WAVE],
      [tBought + 13, WAVE2],
      [tBought + 18, WAVE],
      [tBought + 24, POSES.stand],
      [samGo - 4, POSES.ready],
      [samGo, POSES.passInside],
    ]);
    samPose = breathe(samPose, frame, 4, 0.5);
  } else {
    samScale = Math.cos(samTurn * Math.PI);
    samFlip = samTurn > 0.5;
    samM = S.sam.x - (SAM_JOG * Math.max(0, frame - samGo - 8)) / 30;
    const run = cyclePose(frame - samGo, "run", 7);
    samPose = { ...run, farShoulder: 40, farElbow: 110 };
  }
  const samX = X(samM);
  const samH = TAVI_H * sv.scale;
  const sj = solve(samPose, samH);
  const samDy = GROUND + sv.dy - sj.lowest - (samPose.lift ?? 0) * samH;
  const bagHand = { x: samX + (samFlip ? -sj.fh.x : sj.fh.x), y: sj.fh.y + samDy };
  const bagCarried = frame >= samGo + 4;
  // He taps the ball round as he turns and dribbles it off ahead of him.
  const ballM = frame < samGo ? S.samFoot.x : lerp(S.samFoot.x, samM - 0.5, samTurn);
  const ballRoll = S.samFoot.x - ballM;

  // ---------- The clock ticks on to half past nine, just before "Lights out" ----------
  const clockHours = keys(frame, [tLights - 12, tLights - 3], [CLOCK_EARLY, END_CLOCK], EASE.back);

  // ---------- Lights out: the lamps go off right to left (four clunks), the pool of light stays on the ring ----------
  const lamps = TOWERS.map((_, i) => 1 - progress(frame, tLights + Math.min(3, Math.max(0, 4 - i)) * 8, 6, EASE.standard));
  const darkT = progress(frame, tLights + 26, 18, EASE.standard);
  const ringS = toScreen(cam, ringW.x, ringW.y);
  const poolR = RING_RX * cam.zoom * 1.9;
  const glowOnce = progress(frame, pullAt, 8, EASE.enter) * (1 - progress(frame, pullAt + 10, 18));
  const ringDraw = progress(frame, tNowhere + 8, 26, EASE.soft);
  const flash = frame >= click ? Math.max(0, 1 - (frame - click) / 5) : 0;
  const drift = Math.max(0, frame - click);
  // The polaroid pops beside her head and keeps its screen place as the camera pulls back.
  const camAtClick = cameraAt(click, [
    { f: tTake - 2, x: X(walkM(tTake - 2) - 1.2), y: HEAD_Y, zoom: 2.6 },
    { f: pullAt, x: X(walkM(pullAt) - 1.2), y: HEAD_Y, zoom: 2.7 },
  ]);
  const tjC = solve(cyclePose(click - tNext, "walk", 12), TAVI_H * tv.scale);
  const headAtClick = toScreen(camAtClick, X(walkM(click)) - tjC.headC.x, tjC.headC.y + GROUND + tv.dy - tjC.lowest);
  // Her own small pool of light while she walks out of the ring's pool.
  const taviPool = progress(frame, tNext + 4, 20, EASE.standard) * (1 - progress(frame, pullAt, 10, EASE.exit));
  const taviMid = toScreen(cam, taviX, GROUND + tv.dy - TAVI_H * 0.5);
  const taviPoolR = TAVI_H * cam.zoom * 1.25;
  const cityO = progress(frame, cityAt, cityFull - cityAt, EASE.standard);
  const fadeOut = progress(frame, cardOff - 6, 12, EASE.standard);

  return (
    <Stage bg={PITCH.skyHigh}>
      <NightBackdrop cam={cam} clockHours={clockHours} lamps={lamps} frameOffset={B21_FRAMES} />
      <SideWorld cam={cam}>
        <ChalkX x={X(S.spot.x)} y={GROUND + depthHint(S.spot.y).dy + 2} size={14} squash={0.32} width={4} at={-30} opacity={1 - 0.8 * darkT} />
        {/* The chalk streak Chalk leaves as he lies flat again. */}
        {streak > 0.01 ? <ellipse cx={X(S.chalkStop)} cy={GROUND + 2} rx={0.9 * 50 * streak} ry={3.5} fill={PITCH.chalk} opacity={0.8 * streak} /> : null}
        <GrassRing x={ringW.x} y={ringW.y} rx={RING_RX} ry={RING_RY} draw={ringDraw} glow={0.3 * darkT + 1.3 * glowOnce} />
        <TimeCoins x={ringW.x} y={ringW.y} rx={RING_RX} ry={RING_RY} at={coinAt} r={13} />
        <ChalkQuestion x={ringW.x - 46} y={ringW.y - 28} size={62} at={tWhere + 2} rubAt={tNowhere} />
        {!bagCarried ? <NetBag x={X(S.sam.x - 0.7)} y={GROUND + sv.dy} w={26} balls={3} /> : null}
        <Ball cx={X(ballM)} cy={GROUND + sv.dy - BALL_R * sv.scale} r={BALL_R * sv.scale} view={SIDE} axis={ROLL_AXIS} angle={-ballRoll / 0.11} />
        <g transform={`translate(${samX} 0) scale(${samScale} 1) translate(${-samX} 0)`}>
          <Player x={samX} groundY={GROUND + sv.dy} h={samH} pose={samPose} colors={SAM_COLORS} face="happy" flip={samFlip} />
        </g>
        {bagCarried ? <NetBag x={bagHand.x} y={bagHand.y + 38} w={26} balls={3} swing={Math.sin(frame / 3) * 7} /> : null}
        <Player x={taviX} groundY={GROUND + tv.dy} h={TAVI_H * tv.scale} pose={taviPose} face="happy" flip headTurn={taviHeadTurn} />
        {rise > 0.002 ? <ChalkOneBrow x={X(S.chalkStop)} groundY={GROUND} h={CHALK_H} pose={kPose} raise={1} look={1} rise={rise} flip /> : null}
        <Dust x={X(S.chalkStop)} y={GROUND} at={tBefore + 26} size={54} seed="b22sink" />
      </SideWorld>

      {/* The dark after lights out, with the last pool of light on the ring. */}
      {darkT > 0.001 ? (
        <g>
          <defs>
            {/* Black (clear) in the middle, fading to transparent, so two pools can overlap. */}
            <radialGradient id="b22-pool">
              <stop offset="0" stopColor="#000" stopOpacity={1} />
              <stop offset="0.45" stopColor="#000" stopOpacity={1} />
              <stop offset="1" stopColor="#000" stopOpacity={0} />
            </radialGradient>
            <mask id="b22-dark">
              <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#fff" />
              <ellipse cx={ringS.x} cy={ringS.y - poolR * 0.12} rx={poolR} ry={poolR * 0.8} fill="url(#b22-pool)" />
              {taviPool > 0.01 ? <ellipse cx={taviMid.x} cy={taviMid.y} rx={taviPoolR} ry={taviPoolR * 0.9} fill="url(#b22-pool)" opacity={taviPool} /> : null}
            </mask>
          </defs>
          <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} opacity={0.74 * darkT} mask="url(#b22-dark)" />
        </g>
      ) : null}

      {/* The snapshot: a flash, then the polaroid drifts up into the dark. */}
      {flash > 0.001 ? <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#FFFFFF" opacity={0.3 * flash} /> : null}
      <Snapshot x={headAtClick.x + 150} y={headAtClick.y - 150 - drift * 2.4} w={150} h={100} at={click + 1} until={photoOff} tilt={-8}>
        <RingPhoto w={150} h={100} />
      </Snapshot>

      {/* The far city, the dark stadium as one warm dot, and the end card. */}
      <CityNight opacity={cityO} dot={{ x: 960, y: 700 }} frame={frame} />
      {cityO > 0.5 ? <Glow cx={960} cy={700} r={40 + 30 * glowOnce} color={XRAY.lime} intensity={0.5} rings={3} /> : null}
      {/* The fade to the night-sky colour runs under the card; the card itself fades last. */}
      {fadeOut > 0.001 ? <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} opacity={fadeOut} /> : null}
      <EndCard lines={["WHY THE BEST", "PLAYERS LOOK SLOW"]} at={cardAt} until={cardOff} y={440} size={104} stagger={0.3} />

      <Sfx name="chalk" at={tWhere + 4} volume={0.45} />
      <Sfx name="chalk" at={tWhere + 14} volume={0.3} />
      <Sfx name="chalk" at={tNowhere + 2} volume={0.35} />
      <Sfx name="air" at={tNowhere + 8} volume={0.3} />
      <Sfx name="bell" at={tNowhere + 24} volume={0.3} />
      {coinAt.map((f, i) => (
        <Sfx key={i} name="pop-soft" at={f} volume={0.35} />
      ))}
      <Sfx name="pop" at={tBought + 8} volume={0.22} />
      <Sfx name="chalk" at={tBefore + 4} volume={0.35} />
      <Sfx name="subdrop" at={tBefore + 18} volume={0.2} />
      <Sfx name="chalk" at={tBefore + 26} volume={0.3} />
      <Sfx name="blip" at={tBefore + 30} volume={0.22} />
      <Sfx name="thump" at={samGo} volume={0.25} />
      <Sfx name="chalk" at={samGo + 12} volume={0.14} />
      <Sfx name="chalk" at={samGo + 26} volume={0.1} />
      <Sfx name="chalk" at={samGo + 40} volume={0.07} />
      <Sfx name="tick" at={tLights - 4} volume={0.3} />
      {[0, 1, 2, 3].map((i) => (
        <Sfx key={`off${i}`} name="light-off" at={tLights + i * 8} volume={0.45} />
      ))}
      <Sfx name="subdrop" at={tLights + 6} volume={0.35} />
      <Sfx name="chalk" at={tNext + 8} volume={0.12} />
      <Sfx name="chalk" at={tNext + 20} volume={0.12} />
      <Sfx name="chalk" at={tNext + 32} volume={0.12} />
      <Sfx name="tick" at={click} volume={0.45} />
      <Sfx name="pop-soft" at={click + 1} volume={0.35} />
      <Sfx name="bell" at={pullAt + 2} volume={0.35} />
      <Sfx name="whoosh-long" at={pullAt} volume={0.25} />
      <Sfx name="chalk" at={cardAt + 2} volume={0.3} />
      <Sfx name="bell" at={cardAt + 26} volume={0.3} />
    </Stage>
  );
};
