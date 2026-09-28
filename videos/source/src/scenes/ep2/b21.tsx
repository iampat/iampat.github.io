// b21 Ending: four times the time. A split: the cold-open Tavi and tonight's Tavi at the moment the
// ball reaches them, low in each panel so the pills clear their heads, same legs (chalk ticks), same speed
// (equal bars, and Chalk's jog between them, labelled), and beside each Tavi her ring, 0.6 s pink and 2.4 s
// lime: the pink one slides over and fits four times across the lime one. Then the map replays the ending:
// two polaroids early on the timeline, the run to the ball with a chalk measure ("about 4 m"), the
// half-turn and the back-foot touch (ring 2.4 s, lime, and it closes there), the lime space and Chalk
// braking at the empty chalk X. Last, the calm chalk stroller from b03 crosses the frame with a lime ring
// while Chalk jogs behind and never gains, and the wide side view of the night pitch returns for b22.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, Camera } from "../../kit/Camera";
import { Dust, Glow, Stars } from "../../kit/World";
import { Player, POSES, SAM_COLORS } from "../../kit/Player";
import { Keeper, KPOSES } from "../../kit/Keeper";
import { Ball } from "../../kit/Ball";
import { TopField } from "../../kit/Field";
import { TopPlayer, angleTo } from "../../kit/TopPlayer";
import { TimeBubble } from "../../kit/TimeBubble";
import { Arrow, Label, Text } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { SplitCompare, splitPanels } from "../../kit/ep2";
import { CHALK_START, ENDING_RUN, SAM, TOUCHES, chalkAt, endingMeet, passInAt, passInTimeToX, ringSeconds } from "../../physics/ep2sims";
import { CHASE_SPEED, rollAt } from "../../physics/touch";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, pop, popSoft, progress } from "../../lib/anim";
import type { View } from "../../lib/project";
import { CAST, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import {
  BALL_R,
  CHALK_H,
  CLOCK_EARLY,
  ENDING_STAGE,
  GROUND,
  HANDS_ON_HIPS,
  NightBackdrop,
  ROLL_AXIS,
  SIDE,
  STRIDE_S,
  SideWorld,
  TAVI_H,
  WIDE_END_CAM,
  X,
  breathe,
  chalkBraking,
  depthHint,
  frameOf,
  runCycle,
  simTime,
  smooth,
  type TimeKey,
} from "../../kit/ext/ep2-b20-b22-world";
import { ChalkOneBrow, ChalkTick, ChalkWalker, ChalkX, FrozenTavi, MeasureLine, NetBag, SpacePatch, SpeedBar, TimelineStrip } from "../../kit/ext/ep2-b20-b22-hud";

// ---------- The two readings, from the sims ----------

const MEET = endingMeet();
const MEET_V = { x: MEET.x, y: MEET.y, z: 0 };
const B0 = { x: MEET.x, y: 0 };
const OUT = TOUCHES.ENDING_TOUCH();
const OUT_SPEED = Math.hypot(OUT.x, OUT.y);
const OUT_DIR = { x: OUT.x / OUT_SPEED, y: OUT.y / OUT_SPEED };
const T_ARRIVE = Math.hypot(MEET.x - CHALK_START.x, MEET.y - CHALK_START.y) / CHASE_SPEED;
const T_COLD = passInTimeToX(0); // 2.12 s: the cold-open ball reaches her mark
const COLD_CHALK = chalkAt(T_COLD);
const COLD_SECS = ringSeconds(COLD_CHALK.x, COLD_CHALK.y, 0, 0); // 0.63 s
const END_CHALK = chalkAt(MEET.t, MEET_V);
const END_SECS = ringSeconds(END_CHALK.x, END_CHALK.y, MEET.x, MEET.y); // 2.39 s
const PX_S = 64;
const R_COLD = Math.max(34, COLD_SECS * PX_S);
const R_END = END_SECS * PX_S;

// ---------- Layout ----------

// Panel-local, origin at the panel centre (the panel is 900 x 820; its pill sits in the top 70 px).
const SPLIT_GEO = { y: 30, height: 900, gutter: 40 };
const FIG_X = -150; // Tavi's hips
const FIG_Y = 160; // her feet: low enough that the pill clears her hair by about 160 px
const FIG_H = 320;
const TICK_Y = FIG_Y + 36;
const BAR_Y = FIG_Y + 72;
const RING_X = 200; // the ring stands beside her, fully inside the panel
const RING_Y = 10;

const RPPM = 60;
const RX0 = 1000; // screen x of her old mark
const RY0 = 560;
const RV: View = { kind: "top", originX: RX0 - 87 * RPPM, originY: RY0, ppm: RPPM };
const R = (x: number, y: number) => ({ x: RX0 + x * RPPM, y: RY0 - y * RPPM });
const SPACE = { x: -3.7, y: 2.4 };

/** The ball in the replay (pitch metres) and how far it has rolled. */
const replayBall = (t: number) => {
  if (t < MEET.t) {
    const p = passInAt(t);
    return { x: p.x, y: 0, d: p.x - SAM.x };
  }
  const r = rollAt(OUT_SPEED, t - MEET.t).x;
  return { x: B0.x + OUT_DIR.x * r, y: B0.y + OUT_DIR.y * r, d: MEET.x - SAM.x + r };
};

export const B21: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b21");

  // ---------- Beats ----------
  const tLegs = cue("Same legs");
  const tSpeed = cue("Same speed");
  const tFour = cue("Four times the time");
  const tLooked = cue("You looked earlier");
  const tMoved = cue("moved earlier");
  const tMet = cue("and met the ball side-on");
  const tThen = cue("Then one touch where Chalk wasn't");
  const tWasnt = cue.wordEnd("Then one touch where Chalk wasn't");
  const tThats = cue("That's why the best players look slow");
  const END = cue.frames;

  const splitEnd = tLooked - 2;
  const mapEnd = tThats - 10;
  const wideAt = END - 26;

  // The replay clock: the kick at the map's first frame, slow into the touch, a hold, then real time.
  const TR: TimeKey[] = [
    [splitEnd + 2, 0],
    [tLooked + 36, 0.7],
    [tMoved + 30, 1.2],
    [tMet + 29, MEET.t],
    [tThen, MEET.t],
    [tWasnt - 8, T_ARRIVE],
    [mapEnd, T_ARRIVE + 0.6],
  ];
  const fSnap1 = Math.round(frameOf(0.12, TR));
  const fSnap2 = Math.round(frameOf(0.62, TR));
  const fLeave = Math.round(frameOf(ENDING_RUN.leaveAt, TR));
  const fTouch = Math.round(frameOf(MEET.t, TR));
  const fArrive = Math.round(frameOf(T_ARRIVE, TR));
  const fRingOff = tThen - 4; // the ring closes on its 2.4 s lime reading, before time runs again

  const sfx = (
    <>
      <Sfx name="whoosh" at={0} volume={0.25} />
      <Sfx name="chalk" at={tLegs + 4} volume={0.35} />
      <Sfx name="chalk" at={tLegs + 12} volume={0.35} />
      <Sfx name="tick" at={tSpeed + 4} volume={0.3} />
      <Sfx name="tick" at={tSpeed + 10} volume={0.3} />
      <Sfx name="blip" at={tSpeed + 16} volume={0.25} />
      <Sfx name="pop" at={tFour + 2} volume={0.35} />
      <Sfx name="whoosh" at={tFour + 4} volume={0.25} />
      <Sfx name="tick" at={tFour + 18} volume={0.35} />
      <Sfx name="tick" at={tFour + 24} volume={0.35} />
      <Sfx name="tick" at={tFour + 30} volume={0.35} />
      <Sfx name="tick" at={tFour + 36} volume={0.35} />
      <Sfx name="bell" at={tFour + 40} volume={0.35} />
      <Sfx name="whoosh" at={splitEnd - 2} volume={0.3} />
      <Sfx name="thump" at={splitEnd + 2} volume={0.3} />
      <Sfx name="tick" at={fSnap1} volume={0.35} />
      <Sfx name="pop-soft" at={fSnap1 + 1} volume={0.3} />
      <Sfx name="tick" at={fSnap2} volume={0.35} />
      <Sfx name="pop-soft" at={fSnap2 + 1} volume={0.3} />
      <Sfx name="thump" at={fLeave} volume={0.18} />
      <Sfx name="chalk" at={tMoved + 2} volume={0.4} />
      <Sfx name="chalk" at={tMoved + 12} volume={0.16} />
      <Sfx name="chalk" at={tMoved + 20} volume={0.16} />
      <Sfx name="air" at={tMet + 2} volume={0.25} />
      <Sfx name="thump" at={fTouch} volume={0.35} />
      <Sfx name="chalk" at={fTouch + 3} volume={0.25} />
      <Sfx name="bell" at={fTouch + 6} volume={0.3} />
      <Sfx name="pop-soft" at={tThen + 2} volume={0.3} />
      <Sfx name="pop-soft" at={fRingOff} volume={0.18} />
      <Sfx name="whoosh" at={fArrive - 4} volume={0.35} />
      <Sfx name="chalk" at={fArrive + 1} volume={0.3} />
      <Sfx name="blip" at={fArrive + 10} volume={0.25} />
      <Sfx name="whoosh-long" at={mapEnd - 2} volume={0.2} />
      <Sfx name="chalk" at={mapEnd + 8} volume={0.12} />
      <Sfx name="chalk" at={mapEnd + 26} volume={0.12} />
      <Sfx name="chalk" at={mapEnd + 44} volume={0.12} />
      <Sfx name="chalk" at={mapEnd + 62} volume={0.12} />
      <Sfx name="bell" at={tThats + 6} volume={0.3} />
      <Sfx name="whoosh-long" at={wideAt - 4} volume={0.2} />
    </>
  );

  // ================= Phase 1: the split =================
  let split: React.ReactNode = null;
  if (frame < splitEnd + 12) {
    const out = progress(frame, splitEnd, 10, EASE.exit);
    const { left: L, right: RB } = splitPanels(SPLIT_GEO);
    const cL = { x: L.x + L.w / 2, y: L.y + L.h / 2 };
    const cR = { x: RB.x + RB.w / 2, y: RB.y + RB.h / 2 };
    const ringY = cL.y + RING_Y;
    const fitX = (k: number) => cR.x + RING_X - R_END + R_COLD + k * 2 * R_COLD;
    const slide = progress(frame, tFour + 4, 14, EASE.standard);
    const sx = lerp(cL.x + RING_X, fitX(0), slide);
    const sy = ringY - Math.sin(slide * Math.PI) * 90;
    const pinkRing = (x: number, y: number, s: number, key: string) => (
      <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
        <circle r={R_COLD} fill={CAST.mistake} opacity={0.14} />
        <circle r={R_COLD} fill="none" stroke={CAST.mistake} strokeWidth={5} opacity={0.9} />
      </g>
    );
    const iconS = popSoft(frame, tSpeed + 14);
    const barY = cL.y + BAR_Y;
    split = (
      <g opacity={1 - out} transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${1 - 0.04 * out}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>
        <SplitCompare
          {...SPLIT_GEO}
          origin="centre"
          labels={["FIRST TIME", "TONIGHT"]}
          progress={progress(frame, 0, 14)}
          panelBg={PITCH.grassDark}
          left={
            <g>
              <g transform={`translate(${FIG_X} ${FIG_Y})`}>
                <FrozenTavi variant="stiff" h={FIG_H} frame={frame} />
              </g>
              <ChalkTick x={FIG_X} y={TICK_Y} at={tLegs + 4} />
              <SpeedBar x={FIG_X} y={BAR_Y} w={220} at={tSpeed + 2} />
              <TimeBubble x={RING_X} y={RING_Y} seconds={COLD_SECS} pxPerSecond={PX_S} at={tFour} fontSize={40} />
            </g>
          }
          right={
            <g>
              <g transform={`translate(${FIG_X} ${FIG_Y})`}>
                <FrozenTavi variant="back" h={FIG_H} frame={frame} />
              </g>
              <ChalkTick x={FIG_X} y={TICK_Y} at={tLegs + 12} />
              <SpeedBar x={FIG_X} y={BAR_Y} w={220} at={tSpeed + 8} />
              <TimeBubble x={RING_X} y={RING_Y} seconds={END_SECS} pxPerSecond={PX_S} at={tFour + 2} fontSize={40} />
            </g>
          }
        />
        {/* Chalk's jog between them: also one bar. A side-view Chalk, jogging, named under his bar. */}
        {iconS > 0.001 ? (
          <g transform={`translate(${WIDTH / 2} ${barY - 30}) scale(${iconS})`}>
            <ellipse cx={0} cy={2} rx={34} ry={6} fill="#000" opacity={0.25} />
            <Keeper x={0} groundY={0} h={104} pose={runCycle(frame / 9)} face="flat" look={0.6} flip />
          </g>
        ) : null}
        <SpeedBar x={WIDTH / 2} y={barY} w={140} at={tSpeed + 16} />
        <Label x={WIDTH / 2} y={barY + 46} text="CHALK" at={tSpeed + 18} until={splitEnd - 4} size={32} />
        <Text x={WIDTH / 2} y={986} text="Speed still matters." at={tSpeed + 16} until={splitEnd - 6} size={34} />
        <Text x={WIDTH / 2} y={1034} text="Time is what lets you use it." at={tSpeed + 26} until={splitEnd - 6} size={34} color={PITCH.lightSoft} />
        {/* Four times: the pink ring slides over and fits across the lime one, like a coin in a saucer. */}
        {slide > 0.001 ? pinkRing(sx, sy, 1, "slide") : null}
        {[1, 2, 3].map((k) => {
          const s = pop(frame, tFour + 18 + k * 6, { stiffness: 240, damping: 15 });
          return s > 0.001 ? pinkRing(fitX(k), ringY, s, `fit${k}`) : null;
        })}
        <Label x={WIDTH / 2} y={ringY} text="FOUR TIMES" at={tFour + 38} until={splitEnd - 4} size={38} bg={XRAY.lime} color={PITCH.sky} />
      </g>
    );
  }

  // ================= Phase 2: the map replay =================
  let map: React.ReactNode = null;
  if (frame >= splitEnd && frame < mapEnd + 14) {
    const mapO = progress(frame, splitEnd, 12, EASE.enter) * (1 - progress(frame, mapEnd, 12, EASE.exit));
    const t = Math.max(0, simTime(frame, TR));
    const tau = t - MEET.t;
    const ball = replayBall(t);
    const chalk = chalkBraking(t, (tt) => chalkAt(tt, MEET_V), T_ARRIVE);
    let tavi: { x: number; y: number };
    let facing: number;
    let look = 0;
    let stride: number | undefined;
    if (t < MEET.t) {
      const on = clamp01((t - ENDING_RUN.leaveAt) / 0.5);
      tavi = t < ENDING_RUN.leaveAt ? { x: 0, y: 0 } : { x: -(t - ENDING_RUN.leaveAt) * ENDING_RUN.speed, y: ENDING_RUN.y * on };
      const turn = smooth((t - 0.92) / (MEET.t - 0.92));
      facing = 180 + 90 * turn;
      const s1 = smooth((t - 0.1) / 0.1) * (1 - smooth((t - 0.4) / 0.1));
      const s2 = smooth((t - 0.6) / 0.1) * (1 - smooth((t - 0.8) / 0.1));
      look = -110 * (s1 + s2) * (1 - turn);
      stride = t >= ENDING_RUN.leaveAt ? t * 3 : undefined;
    } else {
      const back = lerp(0.65, 0.5, clamp01(tau / 0.8));
      tavi = { x: ball.x - OUT_DIR.x * back, y: ball.y - OUT_DIR.y * back };
      facing = lerp(270, angleTo(0, 0, OUT_DIR.x, -OUT_DIR.y) + 360, smooth(tau / 0.3));
      stride = tau < 2.6 ? tau * 3 : undefined;
    }
    const secs = t < MEET.t ? ringSeconds(chalk.x, chalk.y, tavi.x, tavi.y) : ringSeconds(chalk.x, chalk.y, ball.x, ball.y);
    const ringAt = t < MEET.t ? R(tavi.x, tavi.y) : R(ball.x, ball.y);
    const taviS = R(tavi.x, tavi.y);
    const ballS = R(ball.x, ball.y);
    const chalkS = R(chalk.x, chalk.y);
    const spotS = R(MEET.x, MEET.y);
    const markS = R(0, 0);
    const samS = R(SAM.x, SAM.y);
    const spaceS = R(SPACE.x, SPACE.y);
    const arrowTo = R(B0.x + OUT_DIR.x * 1.8, B0.y + OUT_DIR.y * 1.8);
    const measureMid = { x: (markS.x + spotS.x) / 2, y: (markS.y + spotS.y) / 2 };
    const trail: string[] = [];
    if (tau > 0) {
      for (let k = MEET.t; k <= t; k += 0.05) trail.push(`${R(replayBall(k).x, replayBall(k).y).x.toFixed(1)},${R(replayBall(k).x, replayBall(k).y).y.toFixed(1)}`);
      trail.push(`${ballS.x.toFixed(1)},${ballS.y.toFixed(1)}`);
    }
    const touchGlow = progress(frame, fTouch, 6, EASE.enter) * (1 - progress(frame, fTouch + 14, 12));
    map = (
      <g opacity={mapO}>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.grassDark} />
        <Camera
          keys={[
            { f: splitEnd, x: 960, y: 540, zoom: 1.0 },
            { f: tThen, x: 960, y: 540, zoom: 1.0 },
            { f: tThen + 50, x: 920, y: 560, zoom: 1.06 },
            { f: mapEnd, x: 920, y: 560, zoom: 1.06 },
          ]}
        >
          <TopField view={RV} x0={70} x1={110} y0={-14} y1={14} lineOpacity={0.55} />
          <circle cx={markS.x} cy={markS.y} r={8} fill={PITCH.chalk} opacity={0.6} />
          {/* The receiving spot: a chalk X the ball leaves behind; Chalk will arrive at it. */}
          <ChalkX x={spotS.x} y={spotS.y} size={14} width={5} at={fTouch + 2} opacity={0.9} />
          <SpacePatch x={spaceS.x} y={spaceS.y} rx={2.2 * RPPM} ry={1.4 * RPPM} at={tThen + 2} />
          <MeasureLine a={markS} b={spotS} at={tMoved + 2} until={mapEnd - 6} />
          <Label x={measureMid.x} y={measureMid.y - 64} text="about 4 m" at={tMoved + 8} until={tMet + 34} size={34} bg={PITCH.chalk} color={PITCH.sky} />
          {trail.length > 1 ? <polyline points={trail.join(" ")} fill="none" stroke={PITCH.lightSoft} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} /> : null}
          <Arrow x1={R(B0.x, B0.y).x} y1={R(B0.x, B0.y).y} x2={arrowTo.x} y2={arrowTo.y} at={tThen + 5} until={tThen + 44} dur={14} color={XRAY.lime} width={8} />
          {touchGlow > 0.01 ? <Glow cx={ballS.x} cy={ballS.y} r={120} color={XRAY.lime} intensity={touchGlow * 1.2} rings={4} /> : null}
          <TopPlayer x={samS.x} y={samS.y} kind="sam" size={50} facing={angleTo(samS.x, samS.y, ballS.x, ballS.y)} />
          <TopPlayer x={chalkS.x} y={chalkS.y} kind="chalk" size={54} facing={angleTo(chalkS.x, chalkS.y, spotS.x, spotS.y)} stride={!chalk.stopped ? t / STRIDE_S : undefined} />
          <TopPlayer
            x={taviS.x}
            y={taviS.y}
            kind="tavi"
            size={52}
            facing={facing}
            look={look}
            stride={stride}
            cone={{ angleDeg: 200, radius: 150, color: facing > 225 ? XRAY.lime : PITCH.lightSoft, opacity: 0.16 }}
          />
          <ellipse cx={ballS.x + 3} cy={ballS.y + 3} rx={10} ry={7} fill="#000" opacity={0.25} />
          <Ball cx={ballS.x} cy={ballS.y} r={10} view={RV} axis={{ x: 0, y: 1, z: 0 }} angle={ball.d / 0.11} />
          <TimeBubble x={ringAt.x} y={ringAt.y} seconds={secs} pxPerSecond={60} minRadius={34} maxRadius={260} fontSize={40} at={splitEnd + 4} until={fRingOff} />
          <Dust x={spotS.x} y={spotS.y} at={fArrive} size={44} seed="b21arrive" />
          <Label x={chalkS.x} y={chalkS.y - 64} text="CHALK" at={splitEnd + 10} until={tLooked + 40} size={32} />
          <Label x={R(-2.0, -0.3).x} y={R(-2.0, -0.3).y + 78} text="most of the time came from here" at={tMoved + 16} until={tMet + 34} size={32} />
        </Camera>
        <TimelineStrip x0={300} x1={1620} y={1000} t={t} tMax={2.2} snaps={[{ t: 0.1, at: fSnap1 }, { t: 0.6, at: fSnap2 }]} touch={{ t: MEET.t, at: fTouch }} at={splitEnd + 4} until={mapEnd - 8} />
      </g>
    );
  }

  // ================= Phase 3: the calm stroller and Chalk who never gains =================
  let stroll: React.ReactNode = null;
  if (frame >= mapEnd && frame < wideAt + 16) {
    const o = progress(frame, mapEnd, 12, EASE.enter) * (1 - progress(frame, wideAt, 14, EASE.exit));
    const u = clamp01((frame - mapEnd) / (END - mapEnd));
    const wx = 380 + 720 * u;
    const phase = (wx - 380) / 230;
    const kPose = runCycle(phase * 1.7);
    stroll = (
      <g opacity={o}>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.skyHigh} />
        <Stars count={150} maxY={HEIGHT * 0.8} seed="b21" />
        <rect x={0} y={846} width={WIDTH} height={HEIGHT - 846} fill={PITCH.sky} opacity={0.5} />
        <line x1={-40} y1={846} x2={WIDTH + 40} y2={846} stroke={PITCH.chalk} strokeWidth={4} opacity={0.22} />
        <TimeBubble x={wx} y={842} seconds={END_SECS} pxPerSecond={80} squash={0.32} showNumber={false} at={mapEnd + 4} />
        <Keeper x={wx - 640} groundY={842} h={250} pose={{ ...kPose, stretch: kPose.stretch * (1 + idle(frame, 5, 2.2, 0.01)) }} face="flat" look={0.7} opacity={0.8} />
        <ChalkWalker x={wx} y={842} h={290} run={0.22} phase={phase} />
      </g>
    );
  }

  // ================= Phase 4: the wide side view for the cut to b22 =================
  let wide: React.ReactNode = null;
  if (frame >= wideAt) {
    const o = progress(frame, wideAt, 14, EASE.enter);
    const S = ENDING_STAGE;
    const tv = depthHint(S.tavi.y);
    const sv = depthHint(S.sam.y);
    const kPose = { ...KPOSES.puffed, stretch: KPOSES.puffed.stretch * (1 + idle(frame, 5, 2.2, 0.01)) };
    wide = (
      <g opacity={o}>
        <NightBackdrop cam={WIDE_END_CAM} clockHours={CLOCK_EARLY} />
        <SideWorld cam={WIDE_END_CAM}>
          <ChalkX x={X(S.spot.x)} y={GROUND + depthHint(S.spot.y).dy + 2} size={14} squash={0.32} width={4} at={wideAt - 30} />
          <NetBag x={X(S.sam.x - 0.7)} y={GROUND + sv.dy} w={26} balls={3} />
          <Player x={X(S.sam.x)} groundY={GROUND + sv.dy} h={TAVI_H * sv.scale} pose={breathe(POSES.stand, frame, 4, 0.7)} colors={SAM_COLORS} face="happy" />
          <Ball cx={X(S.samFoot.x)} cy={GROUND + sv.dy - BALL_R * sv.scale} r={BALL_R * sv.scale} view={SIDE} axis={ROLL_AXIS} angle={2} />
          <Player x={X(S.tavi.x)} groundY={GROUND + tv.dy} h={TAVI_H * tv.scale} pose={breathe(HANDS_ON_HIPS, frame, 1, 0.8)} face="happy" flip headTurn={0.85} />
          <ChalkOneBrow x={X(S.chalkStop)} groundY={GROUND} h={CHALK_H} pose={kPose} raise={1} look={1} flip />
        </SideWorld>
      </g>
    );
  }

  return (
    <Stage bg={PITCH.sky}>
      {split}
      {map}
      {stroll}
      {wide}
      {sfx}
    </Stage>
  );
};
