// b11 Touch into space. The scene opens on b10's closing map, then a split map from the LOOK_STEP receive
// (Chalk 4.1 m, ring 1.0 s): the dead stop (Chalk arrives, +0) against the touch away (2.14 m in 0.8 s,
// ring 0.65 s). The dead stop rewinds and replays on the touch away's clock, so both halves freeze at the
// second touch side by side (0.2 s against 0.7 s). The metre ruler with seconds under it (every two metres is
// about half a second at Chalk's jog), the pro ghosts (touch, touch, gone, with a metronome) and the chalk
// steering wheel that turns toward the space. All positions come from ep2sims and touch.ts.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../../kit/Camera";
import { TopField } from "../../kit/Field";
import { TopPlayer, angleTo } from "../../kit/TopPlayer";
import { TimeBubble } from "../../kit/TimeBubble";
import { Ball } from "../../kit/Ball";
import { Sfx } from "../../kit/Sfx";
import { Dust } from "../../kit/World";
import { SplitCompare, splitPanels, easeT, popT } from "../../kit/ep2";
import { chalkAt, passInAt } from "../../physics/ep2sims";
import { rollAt, CHASE_SPEED } from "../../physics/touch";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, progress, visible } from "../../lib/anim";
import type { View } from "../../lib/project";
import { CAST, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { ChalkFloat, ChalkNumber, CornerMarks, GhostToken, JogCard, MetreRuler, Metronome, OpenMap, PillCaption, RECEIVE, WHEEL, WheelScene, chaseAt } from "../../kit/ext/ep2-b11-b12-parts";

// ---------- Sims (pitch frame: Tavi's mark at the origin, +x to the goal, +y to her left) ----------
const { MEET, C0, AWAY_U, AWAY_SPEED, SECOND_TOUCH, DEAD_D, DEAD_ARRIVE, AWAY_SCREEN, CHASE_AWAY, END } = RECEIVE;
/** Chalk stops 0.4 m short of the dead ball: the run in seconds. */
const DEAD_RUN_S = (DEAD_D - 0.4) / CHASE_SPEED;

// ---------- Panel layout (panel-local pixels; each panel is 900 x 1000) ----------
const PPM = 110;
const OX = 420; // panel-local x of Tavi's mark (left of centre, so Chalk at 4.1 m sits well inside the panel)
const OY = 600;
const LOCAL: View = { kind: "top", originX: OX, originY: OY, ppm: PPM };
const P = (x: number, y: number) => ({ x: OX + x * PPM, y: OY - y * PPM });
const TOKEN = 72;
const BALL_R = 15;
const { left: L_BOX, right: R_BOX } = splitPanels({});
const ZOOM_AT = { x: OX + 40, y: OY - 50 };
/** The ruler runs beside the touch path, 1.9 m to its upper right (clear of Tavi's ring and of Chalk's frozen spot). */
const RULER_OFF = 1.9;

type HalfProps = {
  side: "dead" | "away";
  frame: number;
  /** The shared cushion frame, the frame the ring pops, and the frame this side's own clock starts. */
  T0: number;
  ringAt: number;
  start: number;
  camT: number;
  /** Dead side only: the rewind starts at `rewindAt` and the replay runs from `start2` on the touch away's clock. */
  rewindAt?: number;
  start2?: number;
  rulerT?: number;
  rulerHi?: number;
  jogT?: number;
  floatT?: number;
  marksT?: number;
  spaceT?: number;
};

/** The dead side's seconds since its touch: run 1, a quick rewind, then run 2 frozen at the second touch. */
const deadClock = (frame: number, start: number, rewindAt?: number, start2?: number) => {
  const run1 = Math.max(0, frame - start) / 30;
  if (rewindAt === undefined || start2 === undefined || frame < rewindAt) return { u: run1, rewinding: false };
  if (frame < start2) {
    const from = Math.min(DEAD_RUN_S, (rewindAt - start) / 30);
    return { u: lerp(from, 0, easeT((frame - rewindAt) / Math.max(1, start2 - 2 - rewindAt))), rewinding: true };
  }
  return { u: Math.min(SECOND_TOUCH, (frame - start2) / 30), rewinding: false };
};

/** One half of the split: the same pass in, then its own touch. Panel-local coordinates. */
const MapHalf: React.FC<HalfProps> = ({ side, frame, T0, ringAt, start, camT, rewindAt, start2, rulerT = 0, rulerHi, jogT = 0, floatT = 0, marksT = 0, spaceT = 0 }) => {
  const dead = side === "dead";
  // The pass-in clock: Sam kicks at tt = 0, the ball meets Tavi at MEET.t (scene frame T0).
  const tt = MEET.t - Math.max(0, T0 - frame) / 30;
  let tavi = { x: Math.max(MEET.x, -Math.max(0, tt - 1.5) * 2), y: 0 };
  let taviFacing = 180;
  let taviStride: number | undefined = tt > 1.5 && frame < T0 ? (frame * 0.1) % 1 : undefined;
  let ball = { x: tt >= 0 ? passInAt(tt).x : -12, y: 0 };
  let rolled = tt >= 0 ? ball.x + 12 : 0;
  let chalk: { x: number; y: number } = frame < T0 ? chalkAt(tt) : { x: C0.x, y: C0.y };
  let chalkStride: number | undefined = tt > 0 && frame < T0 ? (frame * 0.13) % 1 : undefined;
  let seconds = Math.hypot(chalk.x - tavi.x, chalk.y - tavi.y) / CHASE_SPEED;
  let taviIdle = 1;
  let chalkFace: number | undefined;
  let replay = false;
  if (frame >= T0) {
    if (dead) {
      const { u, rewinding } = deadClock(frame, start, rewindAt, start2);
      replay = start2 !== undefined && rewindAt !== undefined && frame >= rewindAt;
      const dx = (MEET.x - C0.x) / DEAD_D;
      const dy = -C0.y / DEAD_D;
      const run = Math.min(DEAD_D - 0.4, CHASE_SPEED * u);
      chalk = { x: C0.x + dx * run, y: C0.y + dy * run };
      const arrived = run >= DEAD_D - 0.4;
      const frozen = start2 !== undefined && frame >= start2 + SECOND_TOUCH * 30;
      chalkStride = rewinding ? (frame * 0.2) % 1 : frame > start && u > 0 && !arrived && !frozen ? (frame * 0.13) % 1 : undefined;
      seconds = Math.max(0, DEAD_D - CHASE_SPEED * u) / CHASE_SPEED;
      ball = { x: MEET.x - 0.14, y: 0.06 };
      tavi = { x: MEET.x, y: 0 };
      taviIdle = 0.6;
      // Arrived: he stands over the ball and slowly looks up at her (one raised eyebrow in spirit).
      if (arrived && !rewinding) chalkFace = angleTo(chalk.x, chalk.y, MEET.x - 0.14, -0.06) + idle(frame, 7, 3.4, 6);
    } else {
      const u = Math.max(0, frame - start) / 30;
      const v = Math.min(SECOND_TOUCH, u);
      const c = chaseAt(CHASE_AWAY, v * 30);
      chalk = { x: c.x, y: c.y };
      chalkStride = v > 0 && v < SECOND_TOUCH ? (frame * 0.13) % 1 : undefined;
      ball = { x: c.bx, y: c.by };
      rolled = 12 + MEET.x + rollAt(AWAY_SPEED, v).x;
      const k = v / SECOND_TOUCH;
      // Tavi jogs behind the ball and arrives with it for the second touch.
      tavi = { x: lerp(MEET.x, END.x, k) - AWAY_U.x * 0.28, y: lerp(0, END.y, k) - AWAY_U.y * 0.28 };
      taviFacing = lerp(180, AWAY_SCREEN, easeT(clamp01(v / 0.25)));
      taviStride = v > 0 && v < SECOND_TOUCH ? (frame * 0.11) % 1 : undefined;
      seconds = c.dist / CHASE_SPEED;
    }
  }
  const tp = P(tavi.x, tavi.y);
  const bp = P(ball.x, ball.y);
  const cp = P(chalk.x, chalk.y);
  const cs = lerp(0.7, 1, camT);
  const sway = idle(frame, dead ? 1 : 2, 2.8, 2.5) * taviIdle;
  const touchPx = P(MEET.x, 0);
  const spacePx = P(END.x, END.y);
  // Ruler: parallel to the touch path, offset to its upper right; each mark's pills sit in one row to its right.
  const rulerFrom: [number, number] = [touchPx.x + 0.8 * RULER_OFF * PPM, touchPx.y - 0.6 * RULER_OFF * PPM];
  const dirPx: [number, number] = [AWAY_U.x, -AWAY_U.y];
  // The dead side's first ring fades as Chalk arrives; the replay brings a second ring back with the rewind.
  const arriveFrame = Math.round(start + DEAD_ARRIVE * 30);
  const ring = (at: number, until: number | undefined, key: string) => (
    <TimeBubble key={key} x={tp.x} y={tp.y + sway} seconds={seconds} pxPerSecond={100} minRadius={34} maxRadius={250} fontSize={36} at={at} until={until} alarm={dead ? undefined : false} />
  );
  return (
    <g>
      <g transform={`translate(${ZOOM_AT.x} ${ZOOM_AT.y}) scale(${cs}) translate(${-ZOOM_AT.x} ${-ZOOM_AT.y})`}>
        <TopField view={LOCAL} x0={-14} x1={12} y0={-9} y1={9} stripeM={3} lines={false} />
        {/* The open side: a lime patch of space where the touch away lands. */}
        {spaceT > 0.001 ? (
          <g>
            <circle cx={spacePx.x} cy={spacePx.y} r={150 * popT(spaceT)} fill={XRAY.lime} opacity={0.16} />
            <circle cx={spacePx.x} cy={spacePx.y} r={(105 + idle(frame, 5, 3, 5)) * popT(spaceT)} fill={XRAY.lime} opacity={0.1} />
          </g>
        ) : null}
        {/* The ball's path after the touch away: a faint chalk trail. */}
        {!dead && frame > start ? <line x1={touchPx.x} y1={touchPx.y} x2={bp.x} y2={bp.y} stroke={PITCH.chalk} strokeWidth={5} strokeDasharray="3 14" strokeLinecap="round" opacity={0.45} /> : null}
        {!dead && rulerT > 0.001 ? <MetreRuler from={rulerFrom} dir={dirPx} pxPerMetre={PPM} metres={2} progress={rulerT} secondsEvery={1} highlight={rulerHi} fontSize={34} metreSize={36} row="right" /> : null}
        {dead && replay ? ring(rewindAt ?? 0, undefined, "r2") : ring(ringAt, dead ? arriveFrame - 2 : undefined, "r1")}
        <TopPlayer x={cp.x} y={cp.y} kind="chalk" size={TOKEN} facing={chalkFace ?? angleTo(cp.x, cp.y, bp.x, bp.y)} stride={chalkStride} />
        <TopPlayer x={tp.x} y={tp.y + sway} kind="tavi" size={TOKEN} facing={taviFacing} stride={taviStride} />
        <Ball cx={bp.x} cy={bp.y} r={BALL_R} view={LOCAL} axis={{ x: 0, y: 1, z: 0 }} angle={rolled / 0.11} />
        {floatT > 0.001 ? <ChalkFloat x={tp.x} y={tp.y - 120} text="+0" t={floatT} color={CAST.mistake} /> : null}
      </g>
      {!dead ? <JogCard x={50} y={840} w={R_BOX.w - 100} t={jogT} phase={(frame * 0.09) % 1} lines={["an estimate: Chalk's jog,", "about 4 metres a second"]} /> : null}
      <CornerMarks box={{ x: 0, y: 0, w: dead ? L_BOX.w : R_BOX.w, h: L_BOX.h }} t={marksT} />
    </g>
  );
};

// ---------- The pros on the full map (pitch metres around the ghost's receiving point) ----------
const PRO_IN = 5.0; // the pass to the pro, m/s
const PRO_TOUCH = 2.6; // the first touch into space, m/s along U1
const PRO_PASS = 10; // the second touch: the pass away, m/s along U2
const U1 = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
const U2 = { x: 0.92, y: 0.39 };
const PASSER = { x: -6.6, y: 0.2 };
const IN_LEN = Math.hypot(PASSER.x, PASSER.y);
const IN_U = { x: -PASSER.x / IN_LEN, y: -PASSER.y / IN_LEN };
const PASS_FLIGHT = 1.5; // s from the passer's kick to the ghost's first touch (rollAt(5, 1.5) = 6.6 m)
const MATE_M = 5.5; // the teammate, metres from the second touch
/** Touch chips sit 0.7 m to the lower right of each touch point, off the ghost's path along U1. */
const CHIP_OFF = { x: 0.7 * Math.SQRT1_2, y: -0.7 * Math.SQRT1_2 };

export const B11: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b11");

  // Beats.
  const tStep = cue("Step one");
  const tBounce = cue("bounce");
  const tComing = cue("With Chalk coming");
  const tNothing = cue("nothing");
  const tOneTouch = cue("One touch into space");
  const tMetres = cue("buys metres");
  const tJog = cue("At Chalk's jog");
  const tTwo = cue("every two metres");
  const tHalf = cue("half a second");
  const tPros = cue("Pros");
  const tTouch1 = cue("touch, touch");
  const tTouch2 = cue.wordEnd("touch, touch"); // the second "touch" ends here
  const tGone = cue("gone");
  const tWheelLine = cue("Your first touch");
  const tWheel = cue("steering wheel");
  const end = cue.frames;

  // Shared touch and each side's own clock.
  const T0 = tBounce + 8;
  const ringAt = T0 - 10; // the rings pop as Chalk jogs into the panels (about 1.2 s, then 1.0 s at the touch)
  const startDead = tComing;
  const arriveDead = Math.round(startDead + DEAD_ARRIVE * 30);
  const startAway = tOneTouch;
  const rewindAt = startAway - 14; // the dead stop rewinds, then replays on the touch away's clock
  const secondTouch = Math.round(startAway + SECOND_TOUCH * 30);
  const t2 = secondTouch; // the "2" on the divider
  const rulerAt = Math.max(secondTouch + 2, tMetres - 8); // the ruler unrolls on "buys metres"
  const closeAt = tPros - 16; // the split closes into the full map
  const mapAt = closeAt + 6;
  const passArrive = tTouch1; // the pro's first touch
  const passAway = Math.round(tTouch1 + (tTouch2 - tTouch1) * 0.5 + 6); // the pro's second touch: the pass
  const proOut = tWheelLine - 10;
  const wheelIn = tWheelLine - 2;

  // Camera push inside the panels and a slow global push.
  const camT = progress(frame, 0, T0 + 14, EASE.camera);
  const globalZ = 1 + 0.025 * progress(frame, 40, closeAt - 40, EASE.camera);
  const splitP = progress(frame, 2, 18, EASE.standard) * (1 - progress(frame, closeAt, 12, EASE.exit));
  // The split fades in over b10's closing map, which stays underneath until the split is opaque.
  const splitIn = progress(frame, 0, 10, EASE.soft);
  const splitO = splitIn * (1 - progress(frame, closeAt + 4, 10, EASE.exit));
  const openO = 1 - progress(frame, 10, 6, EASE.soft);

  // Corner marks: the held beats. Both halves hold together at the second touch.
  const marksDead = visible(frame, T0 + 4, startDead - 4, 8, 6) + visible(frame, arriveDead + 14, rewindAt - 6, 8, 6) + visible(frame, secondTouch + 4, closeAt - 6, 8, 6);
  const marksAway = visible(frame, T0 + 4, startAway - 4, 8, 6) + visible(frame, secondTouch + 4, closeAt - 6, 8, 6);
  const floatT = clamp01((frame - tNothing) / 34);
  // The replayed dead stop dims while the touch away plays, then comes back up for the side-by-side hold.
  const dimDead = 1 - 0.3 * progress(frame, startAway + 4, 12, EASE.standard) + 0.22 * progress(frame, secondTouch + 2, 12, EASE.standard);

  // Ruler.
  const rulerT = progress(frame, rulerAt, 40, EASE.standard);
  const rulerHi = frame >= tTwo ? 2 : undefined;
  const jogT = progress(frame, tJog, 14, EASE.enter);

  // Full map camera: the pros play wide, then the camera settles on Tavi's touch point for the wheel.
  const fullKeys: CamKey[] = [
    { f: 0, x: 960, y: 560, zoom: 1.12 },
    { f: proOut, x: 960, y: 560, zoom: 1.12 },
    { f: wheelIn + 14, x: 935, y: 600, zoom: 1.38 },
    { f: end, x: 925, y: 605, zoom: 1.45 },
  ];
  const cam = cameraAt(frame, fullKeys);
  const fullT = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;

  // Pro ghosts: the passer plays in, the ghost scans, touches into space, passes, jogs on.
  const FP = WHEEL.P;
  const proT = (frame - passArrive) / 30;
  const tAwayS = (passAway - passArrive) / 30;
  const r1 = rollAt(PRO_TOUCH, tAwayS).x;
  const B1 = { x: U1.x * r1, y: U1.y * r1 };
  const MATE = { x: B1.x + U2.x * MATE_M, y: B1.y + U2.y * MATE_M };
  let proBall: { x: number; y: number };
  let proRolled = 0;
  if (proT < 0) {
    const s = rollAt(PRO_IN, Math.max(0, proT + PASS_FLIGHT)).x;
    proBall = { x: PASSER.x + IN_U.x * s, y: PASSER.y + IN_U.y * s };
    proRolled = s;
  } else if (proT < tAwayS) {
    const s = rollAt(PRO_TOUCH, proT).x;
    proBall = { x: U1.x * s, y: U1.y * s };
    proRolled = IN_LEN + s;
  } else {
    const s = Math.min(MATE_M, rollAt(PRO_PASS, proT - tAwayS).x);
    proBall = { x: B1.x + U2.x * s, y: B1.y + U2.y * s };
    proRolled = IN_LEN + r1 + s;
  }
  const ballAtMate = proT >= tAwayS && rollAt(PRO_PASS, proT - tAwayS).x >= MATE_M;
  // The ghost never stands still: drifts to meet the ball, follows the touch, jogs on after the pass.
  const drift = easeT(clamp01((proT + 1.0) / 1.0));
  const ghostPos = proT < 0 ? { x: 0.5 - 0.5 * drift, y: -0.5 + 0.5 * drift } : proT < tAwayS ? { x: proBall.x - U1.x * 0.35, y: proBall.y - U1.y * 0.35 } : { x: B1.x - U1.x * 0.35 + U1.x * 1.2 * (proT - tAwayS), y: B1.y - U1.y * 0.35 + U1.y * 1.2 * (proT - tAwayS) };
  const facingU1 = (Math.atan2(-U1.y, U1.x) * 180) / Math.PI;
  const facingU2 = (Math.atan2(-U2.y, U2.x) * 180) / Math.PI;
  const ghostFacing = proT < 0 ? 180 : proT < tAwayS ? lerp(180, facingU1 + 360, easeT(clamp01(proT / 0.2))) : lerp(facingU1, facingU2, easeT(clamp01((proT - tAwayS) / 0.3)));
  // A scan before the ball arrives: the head turns toward the space and back in 0.4 s.
  const scan = proT > -0.9 && proT < -0.5 ? Math.sin((Math.PI * (proT + 0.9)) / 0.4) : 0;
  const ghostLook = 95 * scan;
  const ghostPx = FP(ghostPos.x, ghostPos.y);
  const proBallPx = FP(proBall.x, proBall.y);
  const passerPx = FP(PASSER.x, PASSER.y);
  const matePx = FP(MATE.x, MATE.y);
  const touch1Px = FP(0, 0);
  const touch2Px = FP(B1.x, B1.y);
  const chip1Px = FP(CHIP_OFF.x, CHIP_OFF.y);
  const chip2Px = FP(B1.x + CHIP_OFF.x, B1.y + CHIP_OFF.y);
  const proO = visible(frame, mapAt, proOut, 10, 6);
  const swing = frame < passArrive - 8 ? -1 : frame < passArrive ? lerp(-1, 1, easeT((frame - (passArrive - 8)) / 8)) : frame < passAway ? lerp(1, -1, easeT((frame - passArrive) / (passAway - passArrive))) : lerp(-1, 0.2, easeT(clamp01((frame - passAway) / 12)));
  const metroS = visible(frame, mapAt + 4, proOut, 10, 6);
  const capO = visible(frame, mapAt + 8, proOut, 12, 6);
  const chip1T = progress(frame, passArrive, 10, EASE.enter);
  const chip2T = progress(frame, passAway, 10, EASE.enter);

  // Steering wheel beat: Tavi's touch point on the full map. On the last frame the spin sits near -57 degrees, b12's backdrop angle.
  const wheelPop = progress(frame, wheelIn, 12, EASE.enter);
  const wheelDraw = progress(frame, tWheelLine + 4, 26, EASE.soft);
  const wheelTurn = -52 * progress(frame, tWheel - 2, 26, EASE.standard) - 420 * Math.pow(progress(frame, end - 16, 16, (t) => t), 2.2);
  const nudge = progress(frame, tWheel + 6, 20, EASE.soft);

  const sfx = (
    <>
      <Sfx name="chalk" at={4} volume={0.35} />
      <Sfx name="tick" at={tStep + 6} volume={0.4} />
      <Sfx name="thump" at={T0} volume={0.4} />
      <Sfx name="thump" at={T0 + 2} volume={0.3} />
      <Sfx name="tick" at={Math.round(startDead + 0.4 * 30)} volume={0.3} />
      <Sfx name="tick" at={Math.round(startDead + 0.8 * 30)} volume={0.3} />
      <Sfx name="alarm" at={Math.round(startDead + 0.8 * 30)} volume={0.2} />
      <Sfx name="whoosh" at={arriveDead - 4} volume={0.35} />
      <Sfx name="pop-soft" at={tNothing} volume={0.3} />
      <Sfx name="whoosh" at={rewindAt} volume={0.16} />
      <Sfx name="thump" at={startAway} volume={0.45} />
      <Sfx name="whoosh" at={startAway + 2} volume={0.2} />
      <Sfx name="thump" at={secondTouch} volume={0.35} />
      <Sfx name="tick" at={t2} volume={0.4} />
      <Sfx name="chalk" at={rulerAt} volume={0.4} />
      <Sfx name="tick" at={rulerAt + 14} volume={0.3} />
      <Sfx name="tick" at={rulerAt + 30} volume={0.3} />
      <Sfx name="pop-soft" at={rulerAt + 20} volume={0.25} />
      <Sfx name="pop-soft" at={rulerAt + 36} volume={0.25} />
      <Sfx name="pop-soft" at={tJog + 2} volume={0.25} />
      <Sfx name="bell" at={tTwo + 4} volume={0.3} />
      <Sfx name="bell" at={tHalf} volume={0.2} />
      <Sfx name="whoosh" at={closeAt} volume={0.3} />
      <Sfx name="pop" at={mapAt + 4} volume={0.3} />
      <Sfx name="tick" at={passArrive - 28} volume={0.3} />
      <Sfx name="tick" at={passArrive} volume={0.5} />
      <Sfx name="thump" at={passArrive} volume={0.35} />
      <Sfx name="tick" at={passAway} volume={0.5} />
      <Sfx name="thump" at={passAway} volume={0.4} />
      <Sfx name="whoosh" at={tGone} volume={0.35} />
      <Sfx name="pop" at={wheelIn} volume={0.3} />
      <Sfx name="chalk" at={tWheelLine + 4} volume={0.45} />
      <Sfx name="chalk" at={tWheelLine + 20} volume={0.35} />
      <Sfx name="whoosh-long" at={end - 16} volume={0.35} />
    </>
  );

  return (
    <Stage bg={PITCH.sky}>
      {/* b10's closing map: the cut lands on the same picture, then the split fades in over it. */}
      <OpenMap lookFrame={580 + frame} opacity={openO} />
      {/* Full map, revealed when the split closes. */}
      {frame >= closeAt - 2 ? (
        <g transform={fullT}>
          <WheelScene frame={frame} pop={wheelPop} draw={wheelDraw} turn={wheelTurn} nudge={nudge} />
          {/* Pro ghosts: touch, touch, gone. */}
          {proO > 0.001 ? (
            <g opacity={proO}>
              {/* Chalk dots on the touch points; the numbered chips sit beside them, off the ghost's path. */}
              {chip1T > 0.001 ? <circle cx={touch1Px.x} cy={touch1Px.y} r={8} fill={PITCH.chalk} opacity={0.7 * chip1T} /> : null}
              {chip2T > 0.001 ? <circle cx={touch2Px.x} cy={touch2Px.y} r={8} fill={PITCH.chalk} opacity={0.7 * chip2T} /> : null}
              {frame >= passAway ? <line x1={touch2Px.x} y1={touch2Px.y} x2={proBallPx.x} y2={proBallPx.y} stroke={PITCH.chalk} strokeWidth={5} strokeLinecap="round" opacity={0.35} /> : null}
              <GhostToken x={passerPx.x} y={passerPx.y} facing={angleTo(passerPx.x, passerPx.y, proBallPx.x, proBallPx.y) + idle(frame, 6, 3.2, 2)} />
              <GhostToken x={matePx.x} y={matePx.y} facing={angleTo(matePx.x, matePx.y, proBallPx.x, proBallPx.y) + idle(frame, 8, 3.6, 2)} stride={ballAtMate ? undefined : (frame * 0.06) % 1} />
              <GhostToken x={ghostPx.x} y={ghostPx.y} facing={ghostFacing} look={ghostLook} stride={(frame * 0.1) % 1} />
              <Ball cx={proBallPx.x} cy={proBallPx.y} r={WHEEL.ballR} view={WHEEL.view} axis={{ x: 0, y: 1, z: 0 }} angle={proRolled / 0.11} />
              <ChalkNumber x={chip1Px.x} y={chip1Px.y} n="1" t={chip1T} />
              <ChalkNumber x={chip2Px.x} y={chip2Px.y} n="2" t={chip2T} />
            </g>
          ) : null}
        </g>
      ) : null}
      {frame >= closeAt - 2 ? (
        <g>
          <Metronome x={300} y={330} h={160} swing={swing} s={metroS} />
          <PillCaption x={960} y={990} text="pro players (Ligue 1): about 1 s and 2 touches per possession" o={capO} />
        </g>
      ) : null}
      {/* The split: dead stop against touch away. */}
      {splitO > 0.001 ? (
        <g opacity={splitO} transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${globalZ * (0.97 + 0.03 * splitIn)}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>
          <SplitCompare
            labels={["DEAD STOP", "TOUCH AWAY"]}
            dividerLabel={frame < t2 ? "1" : "2"}
            progress={splitP}
            left={
              <g opacity={dimDead}>
                <MapHalf side="dead" frame={frame} T0={T0} ringAt={ringAt} start={startDead} camT={camT} rewindAt={rewindAt} start2={startAway} floatT={floatT} marksT={marksDead} />
              </g>
            }
            right={<MapHalf side="away" frame={frame} T0={T0} ringAt={ringAt} start={startAway} camT={camT} rulerT={rulerT} rulerHi={rulerHi} jogT={jogT} marksT={marksAway} spaceT={progress(frame, startAway, 20, EASE.enter)} />}
          />
          <Dust x={960} y={HEIGHT / 2} at={t2} size={70} seed="two" />
        </g>
      ) : null}
      {sfx}
    </Stage>
  );
};
