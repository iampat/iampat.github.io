// b09 Way two: touch. Chapter card, Sam's pass freezes a metre from Tavi's foot, the first-touch word card and
// the next-second map (bounces off, stuck, into space), the rock and the pillow, the speed-gap meter (the empty
// GAP bracket on "gap", fast ball, still foot), big gap big bounce (the frozen ball replays the stiff touch and
// rewinds), the egg in a stiff hand (splat) and in a hand that moves with it, while the meter's foot grows to a
// quarter of the ball speed (the TOUCH_CUSHION give) and the bounce dies. Ends pushing into the boot as the x-ray
// builds inside it: b10 opens on that exact frame.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../../kit/Camera";
import { Player, POSES, SAM_COLORS, mixPose, poseAt, type Face, type Pose } from "../../kit/Player";
import { Ball } from "../../kit/Ball";
import { Flight } from "../../kit/Flight";
import { XRayGrid } from "../../kit/XRay";
import { ChapterCard, Label, WordCard } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { ChalkSketch, SpeedDiffMeter, mixHex } from "../../kit/ep2";
import { passInPath, passInTimeToX, TOUCHES } from "../../physics/ep2sims";
import { rollAt } from "../../physics/touch";
import { sampleAt } from "../../physics/sim";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, pop, progress } from "../../lib/anim";
import { project } from "../../lib/project";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import {
  BALL_R,
  FOOT_TURN,
  FREEZE_M,
  GROUND,
  PPM,
  SAM_HIP_M,
  SIDE,
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
  sideCamAt,
  toScreen,
  type SideKey,
} from "../../kit/ext/ep2-b09-b10-world";
import { DropInset, GapBar, GhostBall, ImpactFlicks, NextSecondInset, PANEL_BG, Panel, ROCK_LAND, SpeedArrow, StiffHandEgg } from "../../kit/ext/ep2-b09-b10-hud";

const PASS = passInPath();
/** Sim frames after the kick when the pass is one metre before Tavi's foot. */
const FREEZE_IDX = Math.round(passInTimeToX(FREEZE_M) * 30);
const FROZEN = project(sampleAt(PASS, FREEZE_IDX).pos, SIDE);
const BALL_IN = 4.8;
const STIFF_OUT = Math.abs(TOUCHES.TOUCH_STIFF().x); // 1.68 m/s back towards Sam
/** TOUCH_CUSHION: the foot gives at about a quarter of the ball speed and the ball stops (same as b10). */
const CUSHION_FOOT = 1.25;
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const ROLL_AXIS = { x: 0, y: 1, z: 0 };
/** Meter scale: pixels per m/s. The rebound arrow at the ball uses the same scale, so lengths compare. */
const METER_SCALE = 100;
const METER = { x: 200, y: 520, width: 520 };
const METER_CENTRE = { x: METER.x + 260, y: METER.y + 110 };
const METER_ROW = 30 * 2.2;
const GAP_Y = METER.y + METER_ROW * 2;

/** Where the replayed stiff touch meets the still boot (world px), for her ready pose. */
const READY_TOE_X = flippedLeg(POSES.receiveReady, X(0), hipYFor(POSES.receiveReady, GROUND, TAVI_H), TAVI_H).toe.x;
const CONTACT_W = contactBallX(READY_TOE_X, TAVI_H, BALL_R);
/** World px per frame of the pass at 4.8 m/s (real speed). */
const BALL_PXF = (BALL_IN * PPM) / 30;

const SAM_KICK: Pose = { ...POSES.passInside, nearHip: -22, nearKnee: 34, nearAnkle: 92 };
const SAM_FOLLOW: Pose = { ...POSES.passInside, nearHip: 36, nearKnee: 8, torso: 8 };

export const B09: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b09");
  const END = cue.frames;

  // ---------- Beats (exact word cues) ----------
  const tWay = cue("Way two");
  const tTouchEnd = cue.wordEnd("touch");
  const tFirst = cue("first touch");
  const tDecides = cue("decides");
  const tNext = cue("your next second");
  const tBall = cue("The ball doesn't bounce off");
  const tBounce = cue("bounce off");
  const tHard = cue("hard");
  const tMostly = cue("Mostly");
  const tSpeedGap = cue("speed gap");
  const tFast = cue("fast ball");
  const tStill = cue("still foot");
  const tBig = cue("Big gap");
  const tBigBounce = cue("big bounce");
  const tCatch = cue("Catch an egg");
  const tEgg = cue("egg");
  const tSplat = cue("splat");
  const tMove = cue("Move with it");
  const tSafe = cue("safe");

  const kick = tWay + 4;
  const freezeAt = kick + FREEZE_IDX;
  const cardUntil = tTouchEnd + 12;
  const fanAt = tDecides;
  const fanRun = tNext + 4;
  const fanUntil = tBall - 2;
  const closeStart = tBall - 10;
  const closeEnd = tBall + 26;
  const wordUntil = tBall + 20;
  const dropAt = tBall + 8;
  const dropRelease = tBounce - ROCK_LAND + 2;
  const dropUntil = tMostly + 22;
  const meterAt = tMostly + 2;
  // The empty GAP bracket pops a few frames before "gap" so it is full size on the word.
  const gapHintAt = tSpeedGap - 5;
  const pulses = [tBig, tBigBounce];
  const eggAt = tCatch;
  const landAt = tSplat - 2;
  const fallAt = landAt - 12;
  const givingAt = tMove;
  const shrinkAt = tMove + 4;
  const hudOut = END - 14;
  const pushStart = END - 44;
  const xrayAt = END - 20;

  // ---------- "Big gap, big bounce": the frozen ball replays the stiff touch, then rewinds ----------
  const bounceAt = tBig;
  const hitAt = bounceAt + Math.ceil((CONTACT_W - FROZEN.x) / BALL_PXF);
  const leaveAt = hitAt + 3;
  const reboundEnd = tCatch - 10;
  const rewindEnd = tCatch - 1;
  const reboundX = (f: number) => CONTACT_W - rollAt(STIFF_OUT, Math.max(0, f - leaveAt) / 30).x * PPM;
  let ballWX = FROZEN.x;
  let ballSquash = 1;
  const replaying = frame >= bounceAt && frame < rewindEnd;
  if (replaying) {
    if (frame < hitAt) ballWX = FROZEN.x + (frame - bounceAt) * BALL_PXF;
    else if (frame < leaveAt) {
      ballWX = CONTACT_W;
      ballSquash = 1 - 0.16 * Math.sin((Math.PI * (frame - hitAt + 1)) / (leaveAt - hitAt + 1));
    } else if (frame < reboundEnd) ballWX = reboundX(frame);
    else ballWX = lerp(reboundX(reboundEnd), FROZEN.x, EASE.standard(clamp01((frame - reboundEnd) / (rewindEnd - reboundEnd))));
  }
  const rewinding = frame >= reboundEnd && frame < rewindEnd;

  // ---------- Camera (world pixels, log zoom): a slow push towards the boot through the long hold ----------
  const WIDE: SideKey = { f: 0, x: X(-6.4), y: GROUND - 118, zoom: 2.3 };
  const MID = camFor(FROZEN, { x: 1150, y: 842 }, 3.2);
  const CLOSE = camFor(FROZEN, { x: 900, y: 840 }, 9);
  const PUSH_W = { x: (FROZEN.x + CONTACT_W) / 2, y: GROUND - 8 };
  const CLOSE2 = camFor(PUSH_W, toScreen(PUSH_W, CLOSE), 9.55);
  const cam = sideCamAt(frame, [
    WIDE,
    { ...WIDE, f: kick + 10 },
    { f: freezeAt, x: X(-3.4), y: GROUND - 104, zoom: 2.9 },
    { f: freezeAt + 34, ...MID },
    { f: closeStart, ...MID },
    { f: closeEnd, ...CLOSE },
    { f: pushStart, ...CLOSE2 },
    { f: END, ...XRAY_CAM },
  ]);

  // ---------- Sam and Tavi ----------
  const samPose = poseAt(frame, [
    [kick - 18, "stand"],
    [kick - 6, SAM_KICK],
    [kick, "passInside"],
    [kick + 8, SAM_FOLLOW],
    [kick + 28, "stand"],
  ]);
  const sway = idle(frame, 3, 2.8, 1);
  const breathe = idle(frame, 1, 3.4, 1);
  const ready: Pose = {
    ...POSES.receiveReady,
    torso: POSES.receiveReady.torso + sway * 0.8,
    nearKnee: POSES.receiveReady.nearKnee + sway * 1.2,
    head: (POSES.receiveReady.head ?? 0) + breathe * 1.5,
    nearShoulder: POSES.receiveReady.nearShoulder + breathe * 2,
    farShoulder: POSES.receiveReady.farShoulder - breathe * 2,
    lift: 0.004 * (1 + idle(frame, 1, 2.8, 1)),
  };
  const stiffen = progress(frame, xrayAt - 12, 26, EASE.standard);
  const taviPose = stiffen > 0 ? mixPose(ready, STIFF, stiffen) : ready;
  const taviFace: Face = frame >= hitAt && frame < reboundEnd + 6 ? "wince" : "focus";

  // ---------- The ball, the rebound arrow and the meter ----------
  const ballFrame = Math.min(frame, freezeAt);
  const ballS = toScreen({ x: ballWX, y: FROZEN.y }, cam);
  const frozenS = toScreen(FROZEN, cam);
  const ballScreenR = BALL_R * cam.zoom;
  const pulse = pulses.reduce((acc, p) => acc + 0.1 * Math.sin(Math.PI * clamp01((frame - p) / 12)), 0);
  // The rebound arrow: STIFF_OUT at the meter scale. It rides on the replayed ball, then on "Move with it" it
  // comes back at the frozen ball and dies as the foot gives.
  const giveT = progress(frame, shrinkAt, tSafe - shrinkAt + 2, EASE.standard);
  const bounceArrow = frame >= leaveAt && frame < reboundEnd ? progress(frame, leaveAt, 6, EASE.enter) * (1 - progress(frame, reboundEnd - 5, 5, EASE.exit)) : 0;
  const safeArrow = frame >= tMove && frame < hudOut + 8 ? pop(frame, tMove, { stiffness: 170, damping: 15 }) * (1 - giveT) : 0;
  const reboundLen = STIFF_OUT * METER_SCALE * Math.max(bounceArrow, Math.min(1.08, safeArrow));
  const meterPop = Math.min(1.08, Math.max(0, frame < meterAt ? 0 : 1 + 0.1 * Math.exp(-(frame - meterAt) / 6) * Math.cos((frame - meterAt) / 2.4)));
  const meterOut = 1 - progress(frame, hudOut, 8, EASE.exit);
  const ballSpeed = BALL_IN * progress(frame, tFast, 14, EASE.enter);
  const footSpeed = CUSHION_FOOT * giveT;
  const nubPulse = clamp01((frame - tStill) / 14);
  const gapColor = mixHex(CAST.mistake, PITCH.light, giveT);
  const hintPop = Math.min(1.1, pop(frame, gapHintAt, { stiffness: 170, damping: 14 }));
  const gapGhost = 0.55 * clamp01(hintPop);

  // ---------- The x-ray builds inside the boot ----------
  const xray = progress(frame, xrayAt, END - 2 - xrayAt, EASE.soft);
  const flash = frame >= freezeAt ? 0.22 * (1 - progress(frame, freezeAt, 6, EASE.exit)) : 0;
  const worldT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
  // The x-ray ground is drawn in screen space (stroke widths stay in screen px), pinned to the world ground:
  // on the last frame the camera equals XRAY_CAM, so it matches b10's opening frame exactly.
  const groundFromX = XRAY_CAM.x + (40 - WIDTH / 2) / XRAY_CAM.zoom;
  const xrayGroundS = { y: toScreen({ x: 0, y: GROUND }, cam).y, fromX: toScreen({ x: groundFromX, y: GROUND }, cam).x, ppm: PPM * cam.zoom };

  return (
    <Stage bg={PITCH.sky}>
      <SideWorld cam={cam} seed="b09">
        <Player x={X(SAM_HIP_M)} groundY={GROUND} h={TAVI_H} pose={samPose} colors={SAM_COLORS} face={frame < kick + 30 ? "focus" : "neutral"} />
        <Player x={X(0)} groundY={GROUND} h={TAVI_H} pose={taviPose} face={taviFace} flip footTurn={FOOT_TURN} />
        {replaying ? (
          <g>
            {/* The frozen spot stays marked while the replay runs, so the rewind has somewhere to go. */}
            <GhostBall x={FROZEN.x} y={FROZEN.y} r={BALL_R} opacity={0.55} width={0.5} />
            <line x1={Math.min(ballWX, CONTACT_W)} y1={FROZEN.y} x2={CONTACT_W} y2={FROZEN.y} stroke={PITCH.lightSoft} strokeWidth={0.35} strokeDasharray="0.4 1.4" strokeLinecap="round" opacity={frame >= leaveAt ? 0.5 : 0} />
            <Ball cx={ballWX} cy={FROZEN.y} r={BALL_R} view={SIDE} axis={ROLL_AXIS} angle={(ballWX - FROZEN.x) / BALL_R} lineNormal={LINE_N} squash={ballSquash} />
          </g>
        ) : (
          <Flight path={PASS} view={SIDE} at={kick} frame={ballFrame} r={BALL_R} trailColor={PITCH.lightSoft} trailOpacity={0.35 * (1 - progress(frame, freezeAt + 16, 24))} lineNormal={LINE_N} />
        )}
      </SideWorld>

      {/* Freeze flash. */}
      {flash > 0.001 ? <rect width={WIDTH} height={HEIGHT} fill={PITCH.chalk} opacity={flash} /> : null}

      {/* The replayed stiff touch: impact flicks at the boot, rewind marks on the way back. */}
      {frame >= hitAt && frame < hitAt + 14 ? <ImpactFlicks x={toScreen({ x: CONTACT_W + BALL_R, y: FROZEN.y }, cam).x} y={ballS.y} at={hitAt} r={ballScreenR * 1.3} /> : null}
      {rewinding ? (
        <g transform={`translate(${ballS.x} ${ballS.y - ballScreenR - 56})`} fill={PITCH.chalk} opacity={0.85 * (0.6 + 0.4 * Math.sin(frame / 1.6))}>
          <path d="M-4,-18 L-34,0 L-4,18 Z" />
          <path d="M26,-18 L-4,0 L26,18 Z" />
        </g>
      ) : null}

      {/* The rebound arrow at the ball: the bounce, in the gap colour. */}
      {reboundLen > 0.5 ? (
        <g transform={`translate(${ballS.x - ballScreenR - 10} ${ballS.y}) scale(${1 + pulse})`}>
          <SpeedArrow x={0} y={0} len={reboundLen} color={CAST.mistake} width={22} angle={180} />
        </g>
      ) : null}
      {bounceArrow > 0.001 ? <Label x={ballS.x - ballScreenR - 90} y={ballS.y - 84} text="BOUNCE" at={tBigBounce - 4} until={reboundEnd - 4} size={38} bg={CAST.mistake} color={PITCH.sky} /> : null}
      {frame >= tSafe - 4 ? <Label x={frozenS.x} y={frozenS.y + ballScreenR + 74} text="NO BOUNCE" at={tSafe - 4} until={hudOut} size={38} bg={XRAY.lime} color={PITCH.sky} /> : null}

      {/* Chapter card. */}
      <ChapterCard number={2} title="TOUCH" subtitle="buy time as it arrives" at={2} until={cardUntil} />

      {/* Word card at the first use. */}
      <WordCard term="first touch" meaning="your first contact with a pass, and where it sends the ball" at={tFirst} until={wordUntil} />

      {/* The next second: a small map of the three touches. */}
      <NextSecondInset x={70} y={90} w={700} h={560} at={fanAt} runAt={fanRun} until={fanUntil} />

      {/* Rock and pillow: softer helps a bit. */}
      <DropInset x={70} y={90} w={580} h={340} at={dropAt} dropAt={dropRelease} captionAt={tHard} until={dropUntil} dim={progress(frame, tMostly, 10)} />

      {/* The speed-gap meter: the hero of the shot from "Mostly it's the speed gap". */}
      {meterPop > 0.001 && meterOut > 0.001 ? (
        <g transform={`translate(${METER_CENTRE.x} ${METER_CENTRE.y}) scale(${meterPop * meterOut * (1 + pulse * 0.6)}) translate(${-METER_CENTRE.x} ${-METER_CENTRE.y})`}>
          <rect x={60} y={METER.y - 70} width={720} height={270} rx={36} fill={PANEL_BG} />
          <SpeedDiffMeter x={METER.x} y={METER.y} width={METER.width} ballSpeed={ballSpeed} footSpeed={footSpeed} scale={METER_SCALE} showGap={false} />
          {/* The GAP: an empty dashed bracket on "gap", filled as the ball arrow grows; on "safe" the foot grows to
              a quarter, the gap shrinks by that quarter and turns amber, the old gap stays dashed. */}
          {hintPop > 0.001 ? (
            <g transform={`translate(${METER.x + 240} ${GAP_Y}) scale(${hintPop}) translate(${-METER.x - 240} ${-GAP_Y})`}>
              <GapBar
                x0={METER.x + footSpeed * METER_SCALE}
                x1={METER.x + ballSpeed * METER_SCALE}
                y={GAP_Y}
                color={gapColor}
                ghostX0={METER.x}
                ghostX1={METER.x + BALL_IN * METER_SCALE}
                ghostColor={giveT > 0 ? CAST.mistake : PITCH.chalk}
                ghostOpacity={gapGhost}
                labelColor={ballSpeed > 0.5 ? gapColor : PITCH.chalk}
              />
            </g>
          ) : null}
          {/* "still foot": a teal ring leaves the zero-length foot arrow. */}
          {nubPulse > 0 && nubPulse < 1 ? <circle cx={METER.x + footSpeed * METER_SCALE} cy={METER.y + METER_ROW} r={14 + 40 * nubPulse} fill="none" stroke={CAST.shirt} strokeWidth={5} opacity={1 - nubPulse} /> : null}
        </g>
      ) : null}

      {/* The egg: a flat stiff hand (splat), then a hand that moves with it. */}
      <Panel x={60} y={56} w={830} h={384} at={eggAt} until={hudOut}>
        <StiffHandEgg
          x={240}
          y={236}
          scale={0.95}
          draw={progress(frame, eggAt + 2, 12)}
          eggIn={clamp01((frame - (tEgg - 3)) / 12)}
          fall={clamp01((frame - fallAt) / (landAt - fallAt))}
          splat={clamp01((frame - landAt) / 22)}
          wobble={idle(frame, 2, 0.7, 7)}
        />
        <ChalkSketch kind="egg" mode="giving" progress={clamp01((frame - givingAt) / 40)} size={440} x={640} y={150} accent={XRAY.lime} />
        <text x={230} y={352} fill={CAST.mistake} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3} opacity={0.9 * progress(frame, tSplat, 8)}>
          STIFF HAND
        </text>
        <text x={620} y={352} fill={XRAY.lime} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle" letterSpacing={3} opacity={0.9 * progress(frame, tSafe, 8)}>
          MOVES WITH IT
        </text>
      </Panel>

      {/* The x-ray builds inside the boot: teal grid over the pitch, then Tavi's bones and the ball on top. */}
      {xray > 0.001 ? (
        <g>
          <XRayGrid opacity={xray} />
          <XRayGround y={xrayGroundS.y} fromX={xrayGroundS.fromX} ppm={xrayGroundS.ppm} opacity={xray} />
          <g transform={worldT} opacity={xray}>
            <XRayTavi pose={taviPose} hipX={X(0)} groundY={GROUND} h={TAVI_H} />
            <Ball cx={FROZEN.x} cy={FROZEN.y} r={BALL_R} view={SIDE} lineNormal={LINE_N} />
          </g>
        </g>
      ) : null}

      {/* ---------- Sound ---------- */}
      <Sfx name="chalk" at={2} volume={0.45} />
      <Sfx name="pop-soft" at={16} volume={0.3} />
      <Sfx name="thump" at={kick} volume={0.45} />
      <Sfx name="whoosh-long" at={kick + 2} volume={0.18} />
      <Sfx name="tick" at={freezeAt} volume={0.6} />
      <Sfx name="pop" at={tFirst} volume={0.35} />
      <Sfx name="bell" at={tFirst} volume={0.2} />
      <Sfx name="pop-soft" at={fanAt} volume={0.35} />
      {[0, 1, 2].map((k) => (
        <Sfx key={k} name="whoosh" at={fanAt + 8 + k * 4} volume={0.12} />
      ))}
      <Sfx name="tick" at={fanRun} volume={0.35} />
      <Sfx name="tick" at={fanRun + 30} volume={0.4} />
      <Sfx name="whoosh" at={closeStart} volume={0.28} />
      <Sfx name="pop-soft" at={dropAt} volume={0.3} />
      <Sfx name="thump" at={dropRelease + ROCK_LAND} volume={0.4} />
      <Sfx name="thump" at={dropRelease + ROCK_LAND + 1} volume={0.15} />
      <Sfx name="pop-soft" at={tHard} volume={0.3} />
      <Sfx name="pop" at={meterAt} volume={0.32} />
      <Sfx name="pop-soft" at={gapHintAt} volume={0.3} />
      <Sfx name="whoosh" at={tFast} volume={0.3} />
      <Sfx name="pop-soft" at={tStill} volume={0.35} />
      <Sfx name="air" at={tFast + 10} volume={0.22} dur={60} />
      <Sfx name="pop" at={tBig} volume={0.32} />
      <Sfx name="thump" at={hitAt} volume={0.45} />
      <Sfx name="whoosh" at={leaveAt} volume={0.2} />
      <Sfx name="pop" at={tBigBounce} volume={0.32} />
      <Sfx name="whoosh" at={reboundEnd} volume={0.25} />
      <Sfx name="chalk" at={eggAt} volume={0.35} />
      <Sfx name="pop-soft" at={tEgg - 3} volume={0.3} />
      <Sfx name="tick" at={landAt} volume={0.4} />
      <Sfx name="blip" at={tSplat + 2} volume={0.4} />
      <Sfx name="chalk" at={givingAt} volume={0.3} />
      <Sfx name="pop-soft" at={tSafe} volume={0.4} />
      <Sfx name="whoosh" at={hudOut} volume={0.25} />
      <Sfx name="subdrop" at={xrayAt} volume={0.4} />
    </Stage>
  );
};
