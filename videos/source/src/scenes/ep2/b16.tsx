// b16 Back foot. Side view: Tavi side-on, chest open to the camera, head on the ball. Sam is off
// screen left (a small chip says so). The back foot glows and gets its word card, the near foot gets
// a quiet pointer, toes open toward the goal side. As the pass rolls across her a chalk station draws
// itself on the grass under her boots ("near", then "back"), and the ball gets a chalk chimney: the
// train through a station (slow motion for the last metre). The back-foot cushion sends it forward
// along the grass, and a stopwatch beside her never starts. Cut to the map: the same receive from
// above with Sam, Chalk and the ring; she plays forward 0.3 s after the touch into the open lane and
// the ring bursts at its release value. Then the split: straight-on vs half-turned, each frozen at
// her own READY frame (0.4 s pink after the turn, 1.0 s amber at the touch). Stamp CUE, and the ink
// spreads into the practice board of b17.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, Camera, cameraAt, type CamKey } from "../../kit/Camera";
import { Glow } from "../../kit/World";
import { SAM_COLORS } from "../../kit/Player";
import { Ball } from "../../kit/Ball";
import { Arrow, Label, SlowMoTag, Stamp, WordCard } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { SplitCompare, splitPanels } from "../../kit/ep2";
import { useCues } from "../../lib/timing";
import { EASE, idle, keys, progress, visible } from "../../lib/anim";
import type { View } from "../../lib/project";
import { CAST, PITCH, WIDTH, HEIGHT, XRAY } from "../../theme";
import { passInAt } from "../../physics/ep2sims";
import { rollAt } from "../../physics/touch";
import {
  BF_DIR,
  BF_SPEED,
  GoalHint,
  MapReceive,
  MEET_T,
  MEET_X,
  SIDE_GROUND,
  SIDE_PPM,
  SIDE_VIEW,
  SideWorld,
  TurnWatch,
  sideX,
  toScreen,
  type Cam,
} from "../../kit/ext/ep2-b16-b17-parts";
import { ChalkStation, OPEN_GIVE, OPEN_REACH, OPEN_READY, OPEN_SET, OpenTavi, TrainChimney, openAt, solveOpen } from "../../kit/ext/ep2-b16-b17-open";

const H_T = 1.62 * SIDE_PPM;
/** Where the ball meets her back foot (the LOOK_STEP meeting point). */
const TAVI_X = sideX(MEET_X);
/** Figure x: in the reaching pose the middle of the back boot sits on the meeting point. */
const FIG_X = TAVI_X - (OPEN_REACH.backFoot + 0.3 * (0.08 + 0.05 * OPEN_REACH.backOpen)) * H_T;
const BALL_R = 0.11 * SIDE_PPM;
/** The ball rolls a hair in front of her feet (nearer the camera), on the grass line. */
const BALL_Y = SIDE_GROUND - BALL_R + 3;
const LINE_N = { x: 0.92, y: 0.25, z: 0.3 };
const SLOW = 0.2;
/** The practice board colour (PracticeBoard in Graphics.tsx): the ink at the end fills the frame with it. */
const BOARD_BG = "#10263A";
/** Joints of the waiting pose: the station platforms and the toes arrow sit on these. */
const J_READY = solveOpen(OPEN_READY, FIG_X, SIDE_GROUND, H_T);
const J_REACH = solveOpen(OPEN_REACH, FIG_X, SIDE_GROUND, H_T);

/** The map: Sam (-12 m) sits near the left edge, Chalk's run and the forward play fit on the right. */
const MAP_VIEW: View = { kind: "top", originX: 1100, originY: 560, ppm: 80 };
const MAP_FIELD = { x0: -16, x1: 14, y0: -8, y1: 8 };
/** Split panels (centre origin): Tavi left of centre so Chalk (4.1 m at the touch) stays in the panel. */
const PANEL_VIEW: View = { kind: "top", originX: -110, originY: 30, ppm: 115 };
const PANEL_FIELD = { x0: -6, x1: 8, y0: -5, y1: 5 };
/** The split ends at y 874, so the CUE stamp and its label sit clear of the bottom title-safe margin. */
const SPLIT_GEO = { y: 84, height: 790, gutter: 40 };
const STAMP_Y = 920;

export const B16: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b16");

  // Beats.
  const tBack = cue("Take it on your back foot");
  const tFurther = cue("the one further from Sam");
  const tToes = cue("Toes where you're going");
  const tRolls = cue("It rolls across you");
  const tStation = cue("train through a station");
  const tHalf = cue("Half-turned");
  const tNoTurn = cue("no turn to pay for");
  const tPlay = cue("You play forward");
  const tRing = cue("while the ring's still big");

  // The touch lands as "train" is said; the last metre plays at 0.2x.
  const F_C = tStation + 8;
  const F_SLOW = F_C - 30;
  const slowEnd = F_C + 22;
  const cutMap = tNoTurn - 19;
  const touchMap = cutMap + 30;
  const playMap = touchMap + 9; // the second touch goes forward at once (0.3 s): no turn to pay for
  const splitAt = tPlay;
  const touchP = splitAt + 20;
  const freezeR = touchP; // half-turned: ready at the touch
  const freezeL = touchP + 18; // straight-on: ready after the 0.6 s turn
  const stampAt = Math.max(freezeL + 8, tRing + 12);
  const inkAt = cue.frames - 12;

  /**
   * Sim seconds on the pass clock for a scene frame: real time, then 0.2x from one metre before
   * the foot, held a little after contact, then a short ramp back to real time.
   */
  const simTime = (f: number) => {
    const tSlow = MEET_T - SLOW; // 30 slow frames at 0.2x cover 0.2 s of the sim
    if (f <= F_SLOW) return tSlow - (F_SLOW - f) / 30;
    if (f <= F_C + 12) return tSlow + (SLOW * (f - F_SLOW)) / 30;
    const t1 = tSlow + (SLOW * (F_C + 12 - F_SLOW)) / 30;
    const u = f - (F_C + 12);
    if (u <= 10) return t1 + (SLOW * u + ((1 - SLOW) * u * u) / 20) / 30;
    const t2 = t1 + (SLOW * 10 + ((1 - SLOW) * 100) / 20) / 30;
    return t2 + (u - 10) / 30;
  };

  const sfx = (
    <>
      <Sfx name="pop" at={tBack} volume={0.35} />
      <Sfx name="bell" at={tBack + 6} volume={0.18} />
      <Sfx name="pop-soft" at={tBack + 10} volume={0.3} />
      <Sfx name="pop-soft" at={tFurther + 4} volume={0.2} />
      <Sfx name="pop-soft" at={tFurther + 10} volume={0.2} />
      <Sfx name="whoosh" at={tToes} volume={0.3} />
      <Sfx name="chalk" at={tRolls + 2} volume={0.35} />
      <Sfx name="subdrop" at={F_SLOW} volume={0.3} />
      <Sfx name="chalk" at={tStation - 4} volume={0.4} />
      <Sfx name="chalk" at={tStation + 10} volume={0.3} />
      <Sfx name="thump" at={F_C} volume={0.4} />
      <Sfx name="blip" at={tStation + 36} volume={0.3} />
      <Sfx name="pop-soft" at={tHalf} volume={0.3} />
      <Sfx name="blip" at={tNoTurn + 4} volume={0.18} />
      <Sfx name="whoosh" at={cutMap - 3} volume={0.35} />
      <Sfx name="bell" at={cutMap + 4} volume={0.3} />
      <Sfx name="thump" at={touchMap} volume={0.3} />
      <Sfx name="thump" at={playMap} volume={0.4} />
      <Sfx name="pop-soft" at={playMap + 2} volume={0.3} />
      <Sfx name="whoosh" at={splitAt - 2} volume={0.35} />
      <Sfx name="thump" at={touchP} volume={0.25} />
      <Sfx name="tick" at={freezeR} volume={0.4} />
      <Sfx name="tick" at={freezeL} volume={0.4} />
      <Sfx name="bell" at={freezeL + 4} volume={0.3} />
      <Sfx name="stamp" at={stampAt} volume={0.5} />
      <Sfx name="whoosh-long" at={inkAt - 2} volume={0.35} />
    </>
  );

  // ---------- Shot C: the split (straight-on vs half-turned) ----------
  if (frame >= splitAt) {
    const { left: L, right: R } = splitPanels(SPLIT_GEO);
    const enter = progress(frame, splitAt, 10, EASE.enter);
    const ink = progress(frame, inkAt, 10, EASE.standard);
    return (
      <Stage bg={PITCH.sky}>
        <g opacity={enter} transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${0.96 + 0.04 * enter}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>
          <SplitCompare
            {...SPLIT_GEO}
            origin="centre"
            labels={["STRAIGHT ON", "HALF-TURNED"]}
            progress={progress(frame, splitAt, 14)}
            freezeAt={[frame >= freezeL ? freezeL : undefined, frame >= freezeR ? freezeR : undefined]}
            panelBg={PITCH.grassDark}
            left={
              <g>
                <MapReceive view={PANEL_VIEW} stance="square" touchFrame={touchP} ringAt={splitAt} pxPerSecond={135} tokenSize={62} sam={false} field={PANEL_FIELD} />
                <GoalHint x={L.w / 2 - 150} y={-L.h / 2 + 62} at={splitAt + 8} />
              </g>
            }
            right={
              <g>
                <MapReceive view={PANEL_VIEW} stance="half" touchFrame={touchP} ringAt={splitAt} pxPerSecond={135} tokenSize={62} sam={false} field={PANEL_FIELD} />
                <GoalHint x={R.w / 2 - 150} y={-R.h / 2 + 62} at={splitAt + 8} />
              </g>
            }
          />
        </g>
        <Label x={L.x + L.w / 2} y={L.y + L.h - 64} text="READY" at={freezeL + 2} size={36} bg={CAST.mistake} color={PITCH.chalk} />
        <Label x={R.x + R.w / 2} y={R.y + R.h - 64} text="READY" at={freezeR + 2} size={36} bg={XRAY.lime} color={PITCH.sky} />
        <Stamp kind="CUE" x={WIDTH / 2} y={STAMP_Y} at={stampAt} />
        <Label x={WIDTH / 2} y={988} text="side-on, back foot" at={stampAt + 6} size={36} bg={PITCH.accent} color={PITCH.chalk} />
        {ink > 0.001 ? <circle cx={WIDTH / 2} cy={STAMP_Y} r={ink * 1500} fill={BOARD_BG} /> : null}
        {sfx}
      </Stage>
    );
  }

  // ---------- Shot B: the map, the same receive from above ----------
  if (frame >= cutMap) {
    return (
      <Stage bg={PITCH.grassDark}>
        <Camera
          keys={[
            { f: cutMap, x: 940, y: 560, zoom: 1.1 },
            { f: splitAt, x: 975, y: 540, zoom: 1.03 },
          ]}
        >
          <MapReceive view={MAP_VIEW} stance="half" touchFrame={touchMap} playAt={playMap} ringAt={cutMap + 2} pxPerSecond={150} tokenSize={64} field={MAP_FIELD} />
        </Camera>
        <GoalHint x={1720} y={110} at={cutMap + 10} />
        <TurnWatch x={270} y={210} at={tHalf} until={splitAt - 2} />
        {sfx}
      </Stage>
    );
  }

  // ---------- Shot A: side view ----------
  const camKeys: CamKey[] = [
    { f: 0, x: TAVI_X + 10, y: SIDE_GROUND - 105, zoom: 2.3 },
    { f: tToes - 2, x: TAVI_X + 10, y: SIDE_GROUND - 105, zoom: 2.3 },
    { f: tToes + 22, x: TAVI_X + 70, y: SIDE_GROUND - 80, zoom: 2.75 },
    { f: tRolls - 2, x: TAVI_X + 70, y: SIDE_GROUND - 80, zoom: 2.75 },
    { f: tRolls + 18, x: TAVI_X - 60, y: SIDE_GROUND - 85, zoom: 2.35 },
    { f: F_SLOW + 6, x: TAVI_X - 60, y: SIDE_GROUND - 85, zoom: 2.35 },
    { f: F_C, x: TAVI_X + 10, y: SIDE_GROUND - 60, zoom: 2.9 },
    { f: F_C + 22, x: TAVI_X + 10, y: SIDE_GROUND - 60, zoom: 2.9 },
    { f: F_C + 50, x: TAVI_X + 80, y: SIDE_GROUND - 95, zoom: 2.4 },
    { f: cutMap, x: TAVI_X + 80, y: SIDE_GROUND - 95, zoom: 2.4 },
  ];
  const c = cameraAt(frame, camKeys);
  const cam: Cam = { x: c.x, y: c.y, zoom: c.zoom };
  const S = (wx: number, wy: number) => toScreen(cam, wx, wy);

  // Tavi: side-on on soft knees, head on Sam and the ball; the back foot reaches, gives with the
  // ball, and the weight follows it. After the touch the head turns to where she is going.
  const base = openAt(frame, [
    [F_C - 16, OPEN_READY],
    [F_C - 2, OPEN_REACH],
    [F_C + 14, OPEN_GIVE],
    [F_C + 40, OPEN_SET],
  ]);
  const pose = { ...base, lean: base.lean + idle(frame, 1, 3.2, 1.2), crouch: base.crouch + 0.004 * (1 + idle(frame, 2, 3.2)) };
  const lookT = keys(frame, [F_C + 4, F_C + 24], [0, 1]);
  const J = solveOpen(pose, FIG_X, SIDE_GROUND, H_T);

  // The ball on the pass clock: PASS_IN in, then the BACK_FOOT roll forward and across.
  const t = simTime(frame);
  let ballM: { x: number; travelled: number };
  if (t < MEET_T) {
    const p = passInAt(t);
    ballM = { x: p.x, travelled: p.x + 12 };
  } else {
    const r = rollAt(BF_SPEED, t - MEET_T);
    ballM = { x: MEET_X + BF_DIR.x * r.x, travelled: MEET_X + 12 + r.x };
  }
  // The ball stays on the grass line: the touch sends it forward and across, not up.
  const ballW = { x: sideX(ballM.x), y: BALL_Y };
  const leftEdgeM = (cam.x - WIDTH / 2 / cam.zoom - sideX(0)) / SIDE_PPM;
  const showBall = frame >= tRolls - 12 && ballM.x > leftEdgeM - 0.6;

  // Overlays in screen space, anchored to world points so they move with the camera.
  const glowI = visible(frame, tBack + 6, tRolls + 4, 12, 10) * (0.85 + 0.25 * Math.sin(frame / 4));
  const backLbl = S(J.backToe.x + 0.7 * SIDE_PPM, J.backToe.y - 0.95 * SIDE_PPM);
  const backTip = S(J.backLaces.x + 0.08 * SIDE_PPM, J.backLaces.y - 0.08 * SIDE_PPM);
  // The near foot: a quiet pill on the grass just below-left of the boot, with a thin pointer.
  const nearLbl = S(J.nearAnkle.x - 0.62 * SIDE_PPM, SIDE_GROUND + 0.4 * SIDE_PPM);
  const nearTip = S(J.nearAnkle.x - 0.05 * SIDE_PPM, J.nearAnkle.y + 0.03 * SIDE_PPM);
  const groundS = S(0, SIDE_GROUND).y;
  // Toes where you're going: flat along the grass from the back boot toward the goal side.
  const arrowFrom = S(J_READY.backToe.x + 0.1 * SIDE_PPM, SIDE_GROUND - 0.035 * SIDE_PPM);
  const arrowTo = S(J_READY.backToe.x + 1.45 * SIDE_PPM, SIDE_GROUND - 0.035 * SIDE_PPM);
  const arrowDim = 1 - 0.5 * progress(frame, F_C, 12);
  // Train through a station: the chalk station draws on as the ball rolls across her.
  const stationP = progress(frame, tRolls + 2, 44, EASE.soft);
  const stationO = 1 - progress(frame, cutMap - 10, 8, EASE.exit);
  const chimneyO = visible(frame, tStation - 6, F_C + 26, 10, 10);
  const chimneyMoving = 1 - progress(frame, F_C, 22);

  return (
    <Stage bg={PITCH.sky}>
      <SideWorld cam={cam} seed="b16">
        <ChalkStation x0={TAVI_X - 4.4 * SIDE_PPM} x1={TAVI_X + 2.4 * SIDE_PPM} groundY={SIDE_GROUND} near={J_READY.nearAnkle.x - 0.03 * SIDE_PPM} back={J_REACH.backAnkle.x + 0.1 * SIDE_PPM} ppm={SIDE_PPM} p={stationP} opacity={stationO} />
        {glowI > 0.01 ? <Glow cx={J.backLaces.x} cy={J.backLaces.y} r={0.5 * SIDE_PPM} color={XRAY.lime} intensity={glowI * 1.6} rings={4} /> : null}
        <OpenTavi x={FIG_X} groundY={SIDE_GROUND} h={H_T} pose={pose} lookT={lookT} face="focus" />
        {glowI > 0.01 ? <circle cx={J.backLaces.x} cy={J.backLaces.y + 0.01 * SIDE_PPM} r={0.15 * SIDE_PPM} fill="none" stroke={XRAY.lime} strokeWidth={3} opacity={0.9 * glowI} /> : null}
        {showBall ? (
          <g>
            <ellipse cx={ballW.x + 2} cy={SIDE_GROUND + 2} rx={BALL_R * 1.1} ry={BALL_R * 0.35} fill="#000" opacity={0.22} />
            <Ball cx={ballW.x} cy={ballW.y} r={BALL_R} view={SIDE_VIEW} lineNormal={LINE_N} axis={{ x: 0, y: 1, z: 0 }} angle={ballM.travelled / 0.11} squash={frame >= F_C && frame < F_C + 8 ? 0.93 : 1} />
            <TrainChimney cx={ballW.x} cy={ballW.y} r={BALL_R} frame={frame} opacity={chimneyO} moving={chimneyMoving} />
          </g>
        ) : null}
      </SideWorld>
      {/* Sam is off screen left: a small chip and arrow at the edge until the ball rolls in from there. */}
      <Arrow x1={140} y1={groundS - 64} x2={44} y2={groundS - 64} at={tFurther + 10} until={tRolls - 10} dur={10} color={SAM_COLORS.shirt} width={6} />
      <Label x={206} y={groundS - 64} text="Sam" at={tFurther + 6} until={tRolls - 10} size={34} bg={SAM_COLORS.shirt} color={PITCH.sky} />
      {/* Back foot: the lime label and its pointer; the near foot in a quiet pill with a thin pointer. */}
      <Label x={backLbl.x} y={backLbl.y} text="back foot" at={tBack + 10} until={tRolls} size={36} bg={XRAY.lime} color={PITCH.sky} />
      <Arrow x1={backLbl.x - 20} y1={backLbl.y + 34} x2={backTip.x} y2={backTip.y} at={tBack + 14} until={tRolls} dur={10} color={XRAY.lime} width={6} />
      <Arrow x1={nearLbl.x + 60} y1={nearLbl.y - 26} x2={nearTip.x} y2={nearTip.y} at={tFurther + 8} until={tRolls - 6} dur={10} color={PITCH.chalk} width={4} />
      <Label x={nearLbl.x} y={nearLbl.y} text="near foot" at={tFurther + 4} until={tRolls - 6} size={32} bg={PITCH.standsLight} color={PITCH.chalk} />
      {/* Toes where you're going: the open foot points the touch at the goal side, along the grass. */}
      <g opacity={arrowDim}>
        <Arrow x1={arrowFrom.x} y1={arrowFrom.y} x2={arrowTo.x} y2={arrowTo.y} at={tToes} until={cutMap - 6} dur={16} color={XRAY.lime} width={8} />
      </g>
      <WordCard term="back foot" meaning="the foot further from the passer, not the foot behind you" at={tBack} until={tToes - 4} />
      <SlowMoTag at={F_SLOW} until={slowEnd} />
      <TurnWatch x={270} y={210} at={tHalf} />
      {sfx}
    </Stage>
  );
};
