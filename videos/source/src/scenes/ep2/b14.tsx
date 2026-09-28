// b14 SHAPE: straight on costs a turn. Map view: Tavi faces Sam and rolls him the ball. On "Goal behind
// you" the camera slides right so the dark half and the chalk goal icon fill the frame, and Chalk lives
// there (he jogs on from b13 into the dark, big eyes blink, a wave). Sam's pass arrives (PASS_IN, the
// LOOK_STEP receive: Chalk 4.1 m, ring 1.0 s) and she turns a full half circle with the ball over
// TURN_TIME = 0.6 s. On "A full turn costs" the turn rewinds, holds on the arrival (ring 1.0 s) and replays
// at half speed (SlowMoTag): the stopwatch runs with it, Chalk takes two steps (footprints on his path and
// on a magnified ruler that ends at 2.4 m = 0.6 s), the ring shrinks to 0.4 s and goes pink. The
// run-and-turn test inset names the population. On "That's" the extras leave and the cold-open ring
// (0.6 s) pops beside the stopwatch: they match. Then a rewind to the arrival frame and a chalk arrow
// that asks her to turn sideways (b15).
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, cameraAt, type CamKey } from "../../kit/Camera";
import { Ball } from "../../kit/Ball";
import { TopPlayer } from "../../kit/TopPlayer";
import { VisionFan } from "../../kit/Vision";
import { TimeBubble } from "../../kit/TimeBubble";
import { Arrow, Label, SlowMoTag } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { SecondsRuler } from "../../kit/ep2";
import {
  Blob,
  CAM_B13_END,
  CAM_B14_END,
  ChalkEyes,
  DarkHalf,
  DimChalk,
  GOAL_M,
  GoalIcon,
  HANDOFF_PING,
  HANDOFF_TAIL,
  HangTag,
  HudCard,
  M,
  MAP_VIEW,
  MapField,
  PathSteps,
  Ping,
  RulerEnd,
  RunTurnInset,
  SHARP_DEG,
  StopwatchDial,
  TOKEN,
  WIDE_DEG,
  angleDeg,
  camTransform,
  chalkHandoff,
  dialPillBottom,
  fanLit,
  halfAngleDeg,
  sharpness,
  toScreen,
} from "../../kit/ext/ep2-b13-b15-map";
import { TURN_TIME, chalkAt, lookStepMeet, passInAt, ringSeconds } from "../../physics/ep2sims";
import { CHASE_SPEED, rollAt } from "../../physics/touch";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, progress } from "../../lib/anim";
import { CAST, FONTS, PITCH, WIDTH } from "../../theme";

const MEET = lookStepMeet(); // t 1.94 s, x -0.88 m, ball 4.95 m/s
const LEAVE_T = 1.5; // Tavi steps to meet the ball from here (LOOK_STEP)
const TURN_FRAMES = Math.round(TURN_TIME * 30);
const TURN_CLOSE = CHASE_SPEED * TURN_TIME; // 2.4 m: what Chalk closes during her turn
const SAM_WAIT = { x: -12, y: 3 }; // where he stood in b13
const SAM_PASS = { x: -12, y: 0 };
const BALL_REST = -2.2; // where b13 left the ball: two strides in front of her
const PASS_BACK = { at: 10, speed: 5.2 }; // she rolls it back to Sam (rollAt, grass slowing)
/** The cold-open ring: Chalk's distance when the ball reached her mark at 2.12 s (CHALK_CHASE). */
const COLD_OPEN_RING = chalkAt(2.12).remaining / CHASE_SPEED;
const DIAL = { x: 1450, y: 300, r: 90 };
const RING_X = DIAL.x + 250;
/** The replay runs at half speed. */
const SLOW = 2;
/** The magnified ruler in the HUD card (card pixels). */
const RULER = { x: 92, y: 168, ppm: 150 };
const SLOWMO_W = "SLOW MOTION".length * 25 + 86;

/** 0 -> 1 -> 0 over `dur` frames from `at`: a one-off pulse. */
const bump = (frame: number, at: number, dur = 12) => Math.sin(clamp01((frame - at) / dur) * Math.PI);

export const B14: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b14");

  const tGoal = cue("Goal behind you");
  const tBehind = cue("behind");
  const tLives = cue("lives");
  const tThere = cue("there");
  const tPlay = cue("To play forward");
  const tArrive = cue.wordEnd("you turn") + 6;
  const tCosts = cue("costs");
  const tSecond = cue("second");
  const tTimed = cue("Timed on youth players");
  const tThats = cue("That's");
  const tRing = cue("ring");
  const tFirst = cue("first pass");
  const tPassEnd = cue.wordEnd("first pass");

  // Sim clock: the kick is timed so the ball reaches her just after "you turn".
  const kick = tArrive - Math.round(MEET.t * 30);
  const turnEnd = tArrive + TURN_FRAMES;
  // The replay of the turn: rewind to the arrival, hold (ring 1.0 s), play at half speed from "costs".
  const rwStart = turnEnd + 6;
  const rwEnd = rwStart + 8;
  const playStart = tCosts + 3;
  const playEnd = playStart + TURN_FRAMES * SLOW;
  const turnClock = (f: number) => {
    if (f < rwStart) return f;
    if (f < rwEnd) return lerp(turnEnd, tArrive, progress(f, rwStart, rwEnd - rwStart, EASE.standard));
    if (f < playStart) return tArrive;
    if (f < playEnd) return tArrive + (f - playStart) / SLOW;
    return turnEnd;
  };
  const ef = turnClock(frame);
  const inReplay = frame >= rwEnd && frame < playEnd;
  const t = (ef - kick) / 30;
  const rewindAt = tPassEnd;
  const rewindDur = 9;
  const arrowAt = rewindAt + rewindDur + 2;
  const extrasOut = tThats - 2; // the ruler card, the test and its caption, her ring leave on "That's"

  // Sam: from his b13 spot to the passing line, then he takes her ball and passes it in.
  const samT = progress(frame, 6, 40, EASE.standard);
  const samSim = { x: lerp(SAM_WAIT.x, SAM_PASS.x, samT), y: lerp(SAM_WAIT.y, SAM_PASS.y, samT) };
  const sam = M(samSim.x, samSim.y);
  const samFoot = samSim.x + 0.55;

  // Tavi: on her mark, the LOOK_STEP to meet the ball, then the turn (and the rewind at the end).
  const stepT = clamp01((t - LEAVE_T) / (MEET.t - LEAVE_T));
  const taviSim = { x: MEET.x * stepT, y: 0 };
  const tavi = M(taviSim.x, taviSim.y);
  const turnT = progress(ef, tArrive, TURN_FRAMES, EASE.soft) * (1 - progress(frame, rewindAt, rewindDur, EASE.standard));
  const facing = 180 + 180 * turnT;
  const eyes = facing;

  // The ball: resting, rolled back to Sam, at his foot, rolling in, then at her front foot (it goes round with her).
  let ballSim: { x: number; y: number } | null;
  if (frame < kick) {
    const tb = (frame - PASS_BACK.at) / 30;
    ballSim = tb <= 0 ? { x: BALL_REST, y: 0 } : { x: Math.max(samFoot, BALL_REST - rollAt(PASS_BACK.speed, tb).x), y: 0 };
  } else {
    ballSim = t < MEET.t ? { x: passInAt(t).x, y: 0 } : null;
  }
  const ball = ballSim
    ? M(ballSim.x, ballSim.y)
    : { x: tavi.x + Math.cos((facing * Math.PI) / 180) * TOKEN * 0.34, y: tavi.y + Math.sin((facing * Math.PI) / 180) * TOKEN * 0.34 };
  const ballBackT = (() => {
    // Scene frame where the rolled ball reaches Sam's foot (bisection on rollAt).
    let lo = 0;
    let hi = 4;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (BALL_REST - rollAt(PASS_BACK.speed, mid).x > SAM_PASS.x + 0.55) lo = mid;
      else hi = mid;
    }
    return PASS_BACK.at + Math.round(((lo + hi) / 2) * 30);
  })();

  // Chalk: the jog from b13 on to his mark in the dark, then the chase from the kick, frozen when the turn ends.
  const target = { x: MEET.x, y: 0, z: 0 };
  const chaseT = Math.min(Math.max(0, t), (turnEnd - kick) / 30);
  const handoff = chalkHandoff((frame + HANDOFF_TAIL) / 30);
  const chalkSim = frame < kick ? handoff : chalkAt(chaseT, target);
  const chalkArrival = chalkAt(MEET.t, target);
  const chalkTwoSteps = chalkAt(MEET.t + 0.5, target); // 2 m on: his two steps, one per metre
  const chalk = M(chalkSim.x, chalkSim.y);
  const chalkMoving = (frame < kick && !handoff.arrived) || (frame >= kick && frame < turnEnd) || inReplay;
  // His two steps and the ruler only in the replay (half speed): steps over the first 0.5 s, the ruler over 0.6 s.
  const replayed = inReplay || frame >= playEnd;
  const stepsT = replayed ? clamp01((ef - tArrive) / 15) : 0;
  const rulerT = replayed ? clamp01((ef - tArrive) / TURN_FRAMES) : 0;
  const chalkFacing = angleDeg(chalk, tavi);
  const eyesOpen = progress(frame, tLives, 5, EASE.enter) * (frame >= tLives + 10 && frame < tLives + 14 ? 0.1 : 1);
  // In the dim fan he is a blob (the start, from b13); in the dark a faint token once the eyes have blinked;
  // whole once her turn brings him inside the fan.
  const toChalk = angleDeg(tavi, chalk);
  const chalkLit = fanLit(eyes, toChalk);
  const rewindFade = 1 - progress(frame, rewindAt, rewindDur, EASE.exit);
  const blobShow = frame < kick ? 0.95 * chalkLit : 0;
  const chalkIn = lerp(0.4, 1, chalkLit) * progress(frame, tLives + 12, 10, EASE.enter);
  const chalkShow = chalkIn * rewindFade;
  // The dot eyes hand over to the dim token and stay gone, also while the rewind fades him out.
  const eyesShow = eyesOpen * clamp01(1 - chalkIn / 0.4) * rewindFade;
  const waveT = progress(frame, tThere - 2, 18, EASE.soft);
  const wave = waveT > 0 && waveT < 1 ? Math.sin(waveT * Math.PI * 3) * 14 : 0;

  // The ring: Chalk's distance to her, over his jog of 4 m/s. Up before the ball arrives; a pulse on the
  // replay's hold (1.0 s) and on "second" (0.4 s).
  const ring = ringSeconds(chalkSim.x, chalkSim.y, taviSim.x, taviSim.y);
  const ringAt = tArrive - 16;
  const ringScale = 1 + 0.16 * bump(frame, rwEnd, 12) + 0.12 * bump(frame, tSecond, 12);

  // The stopwatch: runs with the turn (and with the replay), stops at 0.6 s.
  const watch = clamp01((ef - tArrive) / TURN_FRAMES) * TURN_TIME;
  const stopped = (frame >= turnEnd && frame < rwStart) || frame >= playEnd;
  const dialScale = 1 + 0.1 * bump(frame, tSecond, 12);

  // The dark half behind her: on from the cut, deeper on "Goal behind you".
  const dark = 0.5 + 0.18 * progress(frame, tGoal, 16, EASE.standard);
  const toSam = angleDeg(tavi, sam);
  const samLit = fanLit(eyes, toSam);
  const samSharp = sharpness(eyes, toSam, SHARP_DEG, 3, halfAngleDeg(Math.hypot(sam.x - tavi.x, sam.y - tavi.y), TOKEN * 0.5));

  // Camera: the b13 framing, a small push on Tavi and Sam for "Face Sam straight on"; on "Goal behind you"
  // right, so the dark half, Chalk and the goal fill the frame; back left for Sam's pass; in on the receive;
  // out to the b15 framing for the cut.
  const keys: CamKey[] = [
    { f: 0, ...CAM_B13_END },
    { f: tGoal - 14, x: 960, y: 562, zoom: 1.32 },
    { f: tGoal + 20, x: 1250, y: 566, zoom: 1.5 },
    { f: tThere + 2, x: 1262, y: 572, zoom: 1.58 },
    { f: tPlay + 8, x: 940, y: 578, zoom: 1.5 },
    { f: tArrive + 30, x: 930, y: 582, zoom: 1.62 },
    { f: tRing, x: 930, y: 582, zoom: 1.62 },
    { f: rewindAt + 4, x: 1000, y: 570, zoom: 1.35 },
    { f: cue.frames - 1, ...CAM_B14_END },
  ];
  const cam = cameraAt(frame, keys);
  // The goal label sits over the chalk goal icon and never leaves the safe area.
  const goalTop = toScreen(cam, M(GOAL_M + 1, 3.66));
  const goalLabelHalf = ("goal".length * 32 * 0.58 + 32 * 1.2) / 2;
  const goalLabelX = Math.min(goalTop.x, WIDTH - 120 - goalLabelHalf);

  // Rewind hint arrow: a quarter turn, for b15.
  const arrowR = TOKEN * 1.35;
  const a0 = (205 * Math.PI) / 180;
  const a1 = (258 * Math.PI) / 180;

  return (
    <Stage bg={PITCH.grassDark}>
      <g transform={camTransform(cam)}>
        <MapField />
        <DarkHalf x={tavi.x} y={tavi.y} facing={eyes} opacity={dark} />
        <VisionFan x={tavi.x} y={tavi.y} facing={eyes} wideDeg={WIDE_DEG} sharpDeg={SHARP_DEG} radius={900} at={-20} />
        <GoalIcon t={progress(frame, tBehind - 4, 22, EASE.soft)} opacity={0.9 * (1 - progress(frame, rewindAt - 4, 8, EASE.exit))} />
        {/* Chalk's two steps in the replay: footprints on his path, one per metre. */}
        <g opacity={1 - progress(frame, rewindAt - 6, 8, EASE.exit)}>
          <PathSteps from={M(chalkArrival.x, chalkArrival.y)} to={M(chalkTwoSteps.x, chalkTwoSteps.y)} count={2} t={stepsT} />
        </g>
        {/* Sam: sharp in the wedge, a grey shape in the dim fan, and (like Chalk) only a faint token in the dark. */}
        <Blob x={sam.x} y={sam.y} facing={angleDeg(sam, tavi)} opacity={(1 - samSharp) * samLit} />
        <g opacity={0.4 * (1 - samLit)}>
          <TopPlayer x={sam.x} y={sam.y} kind="sam" facing={angleDeg(sam, tavi)} size={TOKEN} />
        </g>
        <g opacity={samSharp}>
          <TopPlayer x={sam.x} y={sam.y} kind="sam" facing={angleDeg(sam, tavi)} size={TOKEN} stride={samT < 1 ? frame / 8 : undefined} />
        </g>
        {/* Chalk: the blob from b13 jogging into the dark, big eyes in the dark, a dim token that waves, then the chase. */}
        <Blob x={chalk.x} y={chalk.y} facing={chalkFacing} opacity={blobShow} wobble={chalkMoving ? 1 : 0} />
        {chalkLit > 0.5 ? <Ping x={chalk.x} y={chalk.y} at={HANDOFF_PING - HANDOFF_TAIL} /> : null}
        <ChalkEyes x={chalk.x} y={chalk.y} facing={chalkFacing} open={eyesShow} eyeScale={2} />
        <DimChalk x={chalk.x} y={chalk.y} facing={chalkFacing} opacity={chalkShow} stride={chalkMoving ? ef / 7 : undefined} />
        {wave !== 0 ? <circle cx={chalk.x - 4} cy={chalk.y - TOKEN * 0.78 + wave} r={TOKEN * 0.24} fill={PITCH.chalk} opacity={Math.min(1, chalkShow * 2.2)} /> : null}
        {/* The ring, the ball, Tavi. */}
        <g transform={`translate(${tavi.x} ${tavi.y}) scale(${ringScale}) translate(${-tavi.x} ${-tavi.y})`}>
          <TimeBubble x={tavi.x} y={tavi.y} seconds={ring} pxPerSecond={90} minRadius={36} at={ringAt} until={extrasOut} fontSize={28} />
        </g>
        <Ball cx={ball.x} cy={ball.y} r={8} view={MAP_VIEW} showLine={false} />
        <TopPlayer x={tavi.x} y={tavi.y} kind="tavi" facing={facing + idle(frame, 1, 3.2, 1)} size={TOKEN} stride={stepT > 0 && stepT < 1 ? frame / 6 : undefined} />
        <Arrow
          x1={tavi.x + Math.cos(a0) * arrowR}
          y1={tavi.y + Math.sin(a0) * arrowR}
          x2={tavi.x + Math.cos(a1) * arrowR}
          y2={tavi.y + Math.sin(a1) * arrowR}
          at={arrowAt}
          dur={10}
          color={PITCH.chalk}
          width={5}
          curve={-0.22}
        />
      </g>

      {/* Screen-space graphics. */}
      <Label x={goalLabelX} y={goalTop.y - 44} text="goal" at={tBehind + 6} until={tThere + 2} size={32} />
      {/* The replay tag, top centre, clear of the ruler card and the stopwatch. */}
      <g transform={`translate(${WIDTH / 2 - SLOWMO_W / 2 - 70} 0)`}>
        <SlowMoTag at={rwStart} until={playEnd + 2} />
      </g>
      {/* The same two steps, magnified: a chalk ruler as long as what he closes in the turn (2.4 m), which ends at 0.6 s. */}
      <HudCard x={70} y={80} w={600} h={250} title="CHALK'S TWO STEPS" at={rwEnd - 2} until={extrasOut}>
        <SecondsRuler from={[RULER.x, RULER.y]} dir={[1, 0]} pxPerMetre={RULER.ppm} metres={TURN_CLOSE} progress={rulerT} steps secondsEvery={99} fontSize={32} secondsColor={CAST.mistake} />
        <RulerEnd x={RULER.x + TURN_CLOSE * RULER.ppm} y={RULER.y} t={clamp01((rulerT - 0.9) * 10)} metres={`${TURN_CLOSE.toFixed(1)} m`} seconds={`${TURN_TIME.toFixed(1)} s`} />
      </HudCard>
      <g transform={`translate(${DIAL.x} ${DIAL.y}) scale(${dialScale}) translate(${-DIAL.x} ${-DIAL.y})`}>
        <StopwatchDial x={DIAL.x} y={DIAL.y} r={DIAL.r} seconds={watch} at={tPlay + 8} until={rewindAt - 4} stopped={stopped} />
      </g>
      <HangTag x={DIAL.x} y={DIAL.y + dialPillBottom(DIAL.r)} text="about" at={tTimed + 8} until={rewindAt - 4} drop={26} />
      <RunTurnInset x={1090} y={620} at={tTimed + 4} until={extrasOut} p={clamp01(((frame - tTimed - 10 + 9000) % 96) / 78)} />
      <Label x={1400} y={1000} text="run-and-turn test, boys 11 to 15, no ball" at={tTimed + 18} until={extrasOut} size={32} color={PITCH.chalk} bg={PITCH.sky} />
      {/* The cold-open ring beside the stopwatch, the same size. */}
      <TimeBubble x={RING_X} y={DIAL.y} seconds={COLD_OPEN_RING} pxPerSecond={DIAL.r / COLD_OPEN_RING} minRadius={DIAL.r} maxRadius={DIAL.r} at={tRing} until={rewindAt - 4} fontSize={34} />
      <Label x={RING_X} y={DIAL.y + DIAL.r + 46} text="first pass" at={tRing + 6} until={rewindAt - 4} size={32} color={PITCH.chalk} bg={PITCH.sky} />
      {frame >= tFirst && frame < rewindAt - 4 ? (
        <text x={DIAL.x + 125} y={DIAL.y + 22} fill={PITCH.chalk} fontFamily={FONTS.title} fontWeight={800} fontSize={64} textAnchor="middle" opacity={progress(frame, tFirst, 6, EASE.enter)}>
          =
        </text>
      ) : null}

      <Sfx name="air" at={0} volume={0.22} />
      <Sfx name="thump" at={PASS_BACK.at} volume={0.3} />
      <Sfx name="thump" at={ballBackT} volume={0.2} />
      <Sfx name="whoosh" at={tGoal - 8} volume={0.2} />
      <Sfx name="chalk" at={tBehind} volume={0.4} />
      <Sfx name="pop-soft" at={tLives + 1} volume={0.35} />
      <Sfx name="blip" at={tThere + 4} volume={0.35} />
      <Sfx name="thump" at={kick} volume={0.35} />
      <Sfx name="bell" at={ringAt} volume={0.25} />
      {/* The turn, live. */}
      <Sfx name="thump" at={tArrive} volume={0.45} />
      <Sfx name="whoosh" at={tArrive + 2} volume={0.3} />
      <Sfx name="tick" at={tArrive + 6} volume={0.3} />
      <Sfx name="tick" at={tArrive + 12} volume={0.3} />
      <Sfx name="tick" at={turnEnd} volume={0.45} />
      {/* The rewind and the half-speed replay. */}
      <Sfx name="whoosh" at={rwStart} volume={0.3} />
      <Sfx name="pop" at={rwEnd} volume={0.3} />
      <Sfx name="tick" at={playStart + 12} volume={0.3} />
      <Sfx name="chalk" at={playStart + 15} volume={0.4} />
      <Sfx name="tick" at={playStart + 24} volume={0.3} />
      <Sfx name="chalk" at={playStart + 30} volume={0.4} />
      <Sfx name="tick" at={playEnd} volume={0.5} />
      <Sfx name="alarm" at={playEnd + 2} volume={0.28} />
      <Sfx name="blip" at={tSecond} volume={0.3} />
      <Sfx name="pop-soft" at={tTimed + 6} volume={0.3} />
      <Sfx name="pop-soft" at={tTimed + 10} volume={0.3} />
      <Sfx name="pop" at={tRing} volume={0.4} />
      <Sfx name="blip" at={tFirst} volume={0.4} />
      <Sfx name="whoosh" at={rewindAt} volume={0.35} />
      <Sfx name="chalk" at={arrowAt} volume={0.4} />
    </Stage>
  );
};
