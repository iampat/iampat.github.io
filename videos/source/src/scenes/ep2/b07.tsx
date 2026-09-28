// b07 The free edge. Open Sky evidence: a chalk 4v4 pitch with grey tokens and a camera, one token looks
// before the ball, two jars of marbles (one look: three), the "did it cause it?" arrow struck through and
// turned into a plus ("went with, not because"), the jars shrink to a chip beside the big "skill" block and
// a film strip of polaroids rattles past ("dozens of times a game"). Then the sky fades to the floodlit map:
// LOOK_STEP (two scans, eyes back at 1.2 s, one step at 1.5 s) meets the ball at x = -0.88 with Chalk still
// 4.1 m away, and the ring that has been there since the kick reads 1.0 s. Freeze on the touch.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, Camera, type CamKey } from "../../kit/Camera";
import { Sky } from "../../kit/World";
import { Snapshot } from "../../kit/Snapshot";
import { TimeBubble, bubbleColor } from "../../kit/TimeBubble";
import { Arrow, Label, Text } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { ChalkSketch } from "../../kit/ep2";
import { useCues } from "../../lib/timing";
import { EASE, idle, lerp, pop, popSoft, progress, visible } from "../../lib/anim";
import { FONTS, HEIGHT, PITCH, SKY, WIDTH, XRAY } from "../../theme";
import { LOOK_STEP, SAM, chalkAt, lookStepMeet, passInAt, passInTimeToX, ringSeconds } from "../../physics/ep2sims";
import { rollAt } from "../../physics/touch";
import { CHALK_BEARING, CamFlash, ChalkPhoto, ChalkX, EyeIcon, Footprint, PassWorld, S, clockAt, frameAtTau, scanLook, type SpeedKey } from "../../kit/ext/ep2-b06-b08-map";
import { ChalkPlus, Clouds, FilmStrip, MINI_RECEIVER, MiniPitch4v4, PriceTag, Strike } from "../../kit/ext/ep2-b06-b08-parts";

const TAVI_FACING = 180;
/** The scan: the head swings over her left shoulder until the narrow sharp wedge sits on Chalk (he runs straight at her mark). */
const SCAN_DEG = CHALK_BEARING - TAVI_FACING;
const MEET = lookStepMeet();
/** The cold open: the pass reaches her still mark at 2.12 s with Chalk 2.5 m away, so its ring read 0.63 s. */
const COLD_T = passInTimeToX(0);
const COLD_RING = ringSeconds(chalkAt(COLD_T).x, chalkAt(COLD_T).y, 0, 0);
/** The study pass on the mini pitch: passer to receiver, 8.9 m at 6 m/s (a sketch scale, not the map's). */
const STUDY_PASS = { metres: 8.9, speed: 6 };
/** The study pitch: big on its own (tokens about 70 px), smaller beside the jars (tokens still 49 px or more). */
const PITCH_HOME = { x: 700, y: 490, k: 1.2 };
const PITCH_SIDE = { x: 480, y: 560, k: 0.85 };
const JARS = { x: 1290, y: 500, size: 460 };
const CHIP = { x: 1400, y: 620, k: 0.36 };
const BLOCK = { x: 760, y: 620, w: 640, h: 340 };
/** Curve of the "did the look cause it?" arrow (positive bends it up, over the camera). */
const ARC_CURVE = 0.3;

export const B07: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b07");

  // Beats.
  const tElite = cue("Elite youth players");
  const tOneLook = cue("one look");
  const tThree = cue("Three times");
  const tOdds = cue("odds");
  const tGood = cue("good next move");
  const tDid = cue("Did the look");
  const tCause = cue("cause");
  const tProved = cue("proved");
  const tWent = cue("It went with it");
  const tWentW = cue("went");
  const tSmall = cue("Small");
  const tFree = cue("free");
  const tDozens = cue("dozens");
  const tKnow = cue("Know early");
  const tKnowEarly = cue("early");
  const tRingW = cue("ring's");
  const END = cue.frames;

  // ---------- Sky part ----------
  const drawT = progress(frame, 4, 34, EASE.soft);
  const tokensT = progress(frame, 16, 30, EASE.standard);
  const studyTau = frame >= tOneLook ? (frame - tOneLook) / 30 : -1;
  const studyBall = studyTau >= 0 ? Math.min(1, rollAt(STUDY_PASS.speed, studyTau).x / STUDY_PASS.metres) : 0;
  const studyLook = studyTau >= 0 ? scanLook(studyTau, 0.1, 0.6, -110) : 0;
  const studyWedge = Math.min(1, Math.abs(studyLook) / 60);
  const studySnap = tOneLook + 9;
  const shift = progress(frame, tThree, 22, EASE.standard);
  const pitchPos = { x: lerp(PITCH_HOME.x, PITCH_SIDE.x, shift), y: lerp(PITCH_HOME.y, PITCH_SIDE.y, shift), k: lerp(PITCH_HOME.k, PITCH_SIDE.k, shift) };
  const pitchOut = 1 - progress(frame, tSmall, 8, EASE.exit);
  const jarsP = progress(frame, tThree, 58, (t) => t);
  const toChip = progress(frame, tSmall, 18, EASE.standard);
  const jarsPos = { x: lerp(JARS.x, CHIP.x, toChip), y: lerp(JARS.y, CHIP.y, toChip), k: lerp(1, CHIP.k, toChip) };
  const receiverScreen = { x: pitchPos.x + MINI_RECEIVER.x * pitchPos.k, y: pitchPos.y + MINI_RECEIVER.y * pitchPos.k };
  const eyeScreen = { x: receiverScreen.x, y: receiverScreen.y - 54 * pitchPos.k };
  const jarMouth = { x: JARS.x + 78 * (JARS.size / 320), y: JARS.y - 74 * (JARS.size / 320) };
  // The arrow from the look to the full jar, and the top of its arc (where the "?", the strike and the plus sit).
  const arc0 = { x: eyeScreen.x + 26, y: eyeScreen.y - 12 };
  const arc1 = { x: jarMouth.x - 20, y: jarMouth.y - 30 };
  const arcC = { x: (arc0.x + arc1.x) / 2 + (arc1.y - arc0.y) * ARC_CURVE, y: (arc0.y + arc1.y) / 2 - (arc1.x - arc0.x) * ARC_CURVE };
  const ARC_TOP = { x: 0.25 * arc0.x + 0.5 * arcC.x + 0.25 * arc1.x, y: 0.25 * arc0.y + 0.5 * arcC.y + 0.25 * arc1.y };
  const arrowO = visible(frame, tDid, tWent + 2, 4, 8) * (frame >= tProved ? 0.6 : 1);
  const strikeT = progress(frame, tProved, 9, EASE.enter);
  const skyO = 1 - progress(frame, tKnow - 8, 14, EASE.standard);
  const showSky = frame < tKnow + 8;
  const marbleAt = [140, 145, 150, 154].map((f) => tThree + (f - 98));

  // ---------- Map part: LOOK_STEP ----------
  const K = tKnowEarly + 6;
  const base: SpeedKey[] = [
    [K, 1],
    [K + 45, 1],
    [K + 47, 0.6],
  ];
  const TOUCH = Math.round(frameAtTau(MEET.t - 0.03, base)) + 3;
  const keys: SpeedKey[] = [...base, [TOUCH - 3, 0.6], [TOUCH, 0]];
  const tauRaw = clockAt(frame, keys);
  const tau = frame >= TOUCH ? MEET.t : Math.min(tauRaw, MEET.t);
  const kicked = frame >= K;
  const taviX = tau >= LOOK_STEP.leaveAt ? Math.max(MEET.x, -(tau - LOOK_STEP.leaveAt) * LOOK_STEP.speed) : 0;
  const ballX = kicked ? Math.min(passInAt(tau).x, taviX - 0.75) : SAM.x;
  const chalk = chalkAt(tau);
  const look = kicked ? scanLook(tau, 0.1, 0.5, SCAN_DEG) + scanLook(tau, 0.9, 1.2, SCAN_DEG) : 0;
  const snapA = Math.round(frameAtTau(0.3, keys));
  const snapB = Math.round(frameAtTau(1.05, keys));
  const eyesBack = Math.round(frameAtTau(1.2, keys));
  const stepAt = Math.round(frameAtTau(LOOK_STEP.leaveAt, keys));
  const samKick = progress(frame, K - 8, 8, EASE.enter) * (1 - progress(frame, K + 2, 12, EASE.standard));
  const tq = S(taviX, 0);
  const bq = S(ballX, 0);
  const ringS = ringSeconds(chalk.x, chalk.y, taviX, 0);
  const ringR = Math.min(270, Math.max(40, ringS * 95));
  // "The ring's there before the ball": a faint ghost of the cold open's 0.6 s ring at her old mark for a
  // beat, then one confident pulse on today's ring. The ghost is gone before the last frame (b08 holds it).
  const ghostAt = tRingW - 4;
  const ghostUntil = END - 18;
  const pulseAt = tRingW + 12;
  const pulse = (frame - pulseAt) / 22;
  // A slow push on the touch; Sam's token stays inside the left edge (zoom at most 1.16 about x = 980).
  const cam: CamKey[] = [
    { f: tKnow - 8, x: 1000, y: 600, zoom: 1.1 },
    { f: K, x: 1000, y: 600, zoom: 1.1 },
    { f: TOUCH, x: 985, y: 610, zoom: 1.15 },
    { f: END, x: 980, y: 612, zoom: 1.16 },
  ];

  const smallSnap = (at: number, children: React.ReactNode) => (
    <g transform={`translate(${tq.x + 190} ${tq.y - 150})`}>
      <Snapshot x={0} y={0} w={150} h={100} at={at} until={at + 26} tilt={-7}>
        {children}
      </Snapshot>
    </g>
  );

  return (
    <Stage bg={SKY.mid}>
      {/* ---------- The evidence on the open sky ---------- */}
      {showSky ? (
        <g opacity={skyO}>
          <Sky top={SKY.top} bottom={SKY.horizon} id="b07-sky" />
          <Clouds frame={frame} opacity={0.9} />
          {/* The study's 4v4 pitch. */}
          <g opacity={pitchOut}>
            <g transform={`translate(${pitchPos.x} ${pitchPos.y}) scale(${pitchPos.k})`}>
              <MiniPitch4v4 frame={frame} drawT={drawT} tokensT={tokensT} ball={studyTau >= 0 ? { t: studyBall } : undefined} look={studyLook} lookWedge={studyWedge} />
            </g>
            {/* The look, marked: a steady lime ring on the receiver from just before the flick until the eye has
                popped and the jars start, a ripple at the look's apex, and the eye that stays as "the look". */}
            {(() => {
              const s = popSoft(frame, tOneLook - 6) * (1 - progress(frame, tThree + 4, 8, EASE.exit));
              if (s <= 0.001) return null;
              return <circle cx={receiverScreen.x} cy={receiverScreen.y} r={50 * pitchPos.k * s} fill="none" stroke={XRAY.lime} strokeWidth={6} opacity={0.95} />;
            })()}
            {(() => {
              const t = (frame - studySnap) / 14;
              return t >= 0 && t <= 1 ? <circle cx={receiverScreen.x} cy={receiverScreen.y} r={(50 + 60 * t) * pitchPos.k} fill="none" stroke={XRAY.lime} strokeWidth={5} opacity={1 - t} /> : null;
            })()}
            <EyeIcon x={eyeScreen.x} y={eyeScreen.y} at={studySnap + 6} frame={frame} size={28 * pitchPos.k + 6} />
            <Label x={pitchPos.x} y={pitchPos.y + 240 * pitchPos.k + 50} text="elite youth women, about 17, filmed 4v4 games" at={tElite + 10} size={32} bg={SKY.deep} color={SKY.cloud} />
          </g>
          {/* Two jars: no look, one marble; one look, three. Then the chip. */}
          <g>
            {toChip > 0.01 ? (
              <g transform={`translate(${jarsPos.x} ${jarsPos.y}) scale(${Math.min(1, toChip * 1.4)})`} opacity={toChip}>
                <rect x={-120} y={-95} width={240} height={190} rx={22} fill={SKY.deep} opacity={0.9} />
                <rect x={-120} y={-95} width={240} height={190} rx={22} fill="none" stroke={PITCH.chalk} strokeWidth={4} opacity={0.7} />
              </g>
            ) : null}
            <ChalkSketch kind="jars" progress={jarsP} size={JARS.size * jarsPos.k} x={jarsPos.x} y={jarsPos.y} color={PITCH.chalk} accent={XRAY.lime} />
            <Label x={JARS.x - 78 * (JARS.size / 320)} y={JARS.y + 170} text="no look" at={tOdds} until={tSmall} size={34} bg={SKY.deep} color={SKY.cloud} />
            <Label x={JARS.x + 78 * (JARS.size / 320)} y={JARS.y + 170} text="one look" at={tOdds + 6} until={tSmall} size={34} bg={XRAY.lime} color={SKY.deep} />
            <Label x={JARS.x} y={JARS.y + 250} text="about 3.4 times the odds" at={tGood} until={tSmall} size={32} bg={PITCH.chalk} color={SKY.deep} />
            <Label x={CHIP.x} y={CHIP.y + 130} text="look" at={tSmall + 14} size={32} bg={PITCH.chalk} color={SKY.deep} />
          </g>
          {/* Did the look cause it? An arrow, a question, a strike, then a plus. */}
          {arrowO > 0.001 ? (
            <g opacity={arrowO}>
              <Arrow x1={arc0.x} y1={arc0.y} x2={arc1.x} y2={arc1.y} at={tDid} dur={18} color={PITCH.chalk} width={8} curve={ARC_CURVE} />
              <Text x={ARC_TOP.x} y={ARC_TOP.y - 34} text="?" at={tCause} size={72} color={PITCH.chalk} />
              <Strike x={ARC_TOP.x} y={ARC_TOP.y} t={strikeT} len={170} angle={-22} />
            </g>
          ) : null}
          <ChalkPlus x={ARC_TOP.x} y={ARC_TOP.y} at={tWentW} frame={frame} until={tSmall} />
          <Label x={ARC_TOP.x} y={ARC_TOP.y - 92} text="went with, not because" at={tWentW + 8} until={tSmall + 2} size={34} bg={PITCH.chalk} color={SKY.deep} />
          {/* Small, but free: the skill block, the chip, the price tag, the film strip. */}
          {(() => {
            const s = pop(frame, tSmall + 4, { stiffness: 170, damping: 14 });
            if (s <= 0.001) return null;
            return (
              <g transform={`translate(${BLOCK.x} ${BLOCK.y}) scale(${s})`}>
                <rect x={-BLOCK.w / 2} y={-BLOCK.h / 2} width={BLOCK.w} height={BLOCK.h} rx={34} fill={SKY.deep} opacity={0.92} />
                <text y={20} fill={PITCH.chalk} fontFamily="Rubik, sans-serif" fontWeight={800} fontSize={64} textAnchor="middle" letterSpacing={4}>
                  skill
                </text>
              </g>
            );
          })()}
          <PriceTag x={CHIP.x + 150} y={CHIP.y - 20} at={tFree} frame={frame} />
          <FilmStrip y={930} at={tDozens} frame={frame} until={tKnow - 4} />
        </g>
      ) : null}

      {/* ---------- The floodlit map: know early, move early ---------- */}
      {frame >= tKnow - 8 ? (
        <g opacity={1 - skyO}>
          <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={PITCH.grassDark} />
          <Camera keys={cam}>
            <PassWorld frame={frame} tau={tau} tavi={{ x: taviX, y: 0, facing: TAVI_FACING, look }} ball={{ x: ballX, y: 0 }} rolled={ballX - SAM.x} fan={{ darken: false, radius: 700 }} samKick={samKick} labels>
              {/* Her old mark and the one step. */}
              {frame >= stepAt ? <ChalkX x={S(0, 0).x} y={S(0, 0).y} t={progress(frame, stepAt + 4, 10)} /> : null}
              {frame >= stepAt ? <Footprint x={S(-0.5, -0.15).x} y={S(-0.5, -0.15).y} angle={180} scale={popSoft(frame, stepAt)} /> : null}
              {frame >= eyesBack ? (
                <g opacity={progress(frame, eyesBack, 8)}>
                  {[-7, 7].map((dy) => (
                    <line key={dy} x1={tq.x - 34} y1={tq.y + dy} x2={bq.x + 18} y2={bq.y + dy * 0.4} stroke={XRAY.lime} strokeWidth={3} strokeDasharray="6 10" strokeLinecap="round" opacity={0.7} />
                  ))}
                </g>
              ) : null}
            </PassWorld>
            {frame >= eyesBack ? <EyeIcon x={bq.x} y={bq.y - 44} at={eyesBack + 3} frame={frame} size={24} /> : null}
            {/* The ring, on screen from the kick frame. */}
            {kicked ? <TimeBubble x={tq.x} y={tq.y} seconds={ringS} at={K} pxPerSecond={95} minRadius={40} maxRadius={270} fontSize={38} /> : null}
            {frame >= ghostAt ? (
              <g>
                <g opacity={0.6}>
                  <TimeBubble x={S(0, 0).x} y={S(0, 0).y} seconds={COLD_RING} at={ghostAt} until={ghostUntil} pxPerSecond={95} minRadius={40} showNumber={false} alarm={false} />
                </g>
                {/* Its number sits below right, clear of today's amber ring, so both readouts stay legible. */}
                <g opacity={0.8}>
                  <Label x={S(0, 0).x + 22} y={S(0, 0).y + 112} anchor="start" text={`${COLD_RING.toFixed(1)} s`} at={ghostAt + 2} until={ghostUntil} size={32} bg={PITCH.sky} color={bubbleColor(COLD_RING)} font={FONTS.mono} />
                </g>
              </g>
            ) : null}
            {pulse >= 0 && pulse <= 1 ? <circle cx={tq.x} cy={tq.y} r={ringR + 90 * pulse} fill="none" stroke={bubbleColor(ringS)} strokeWidth={8} opacity={(1 - pulse) * 0.9} /> : null}
            {smallSnap(snapA, <ChalkPhoto w={150} h={100} facing={200 + idle(frame, 1, 3, 2)} />)}
            {smallSnap(snapB, <ChalkPhoto w={150} h={100} arrow stride={0.3} facing={195} />)}
            <CamFlash at={snapA} frame={frame} strength={0.25} />
            <CamFlash at={snapB} frame={frame} strength={0.25} />
          </Camera>
        </g>
      ) : null}

      {/* Sound. */}
      <Sfx name="chalk" at={4} volume={0.4} />
      <Sfx name="chalk" at={22} volume={0.3} />
      <Sfx name="thump" at={tOneLook} volume={0.3} />
      <Sfx name="tick" at={studySnap} volume={0.5} />
      <Sfx name="chalk" at={tThree} volume={0.35} />
      {marbleAt.map((f, i) => (
        <Sfx key={i} name="pop-soft" at={f} volume={i === 0 ? 0.4 : 0.3} />
      ))}
      <Sfx name="pop-soft" at={tOdds} volume={0.25} />
      <Sfx name="chalk" at={tDid} volume={0.35} />
      <Sfx name="blip" at={tCause} volume={0.3} />
      <Sfx name="whoosh" at={tProved} volume={0.3} />
      <Sfx name="bell" at={tWentW} volume={0.25} />
      <Sfx name="pop" at={tSmall + 4} volume={0.35} />
      <Sfx name="pop-soft" at={tSmall + 14} volume={0.3} />
      <Sfx name="pop" at={tFree} volume={0.35} />
      {Array.from({ length: 8 }, (_, i) => (
        <Sfx key={`r${i}`} name="tick" at={tDozens + i * 6} volume={0.14} dur={20} />
      ))}
      <Sfx name="whoosh-long" at={tKnow - 8} volume={0.3} />
      <Sfx name="thump" at={K} volume={0.5} />
      <Sfx name="bell" at={K + 2} volume={0.25} />
      <Sfx name="tick" at={snapA} volume={0.45} />
      <Sfx name="tick" at={snapB} volume={0.45} />
      <Sfx name="tick" at={eyesBack + 3} volume={0.3} />
      <Sfx name="pop-soft" at={stepAt} volume={0.4} />
      <Sfx name="thump" at={TOUCH} volume={0.45} />
      <Sfx name="pop-soft" at={ghostAt} volume={0.25} />
      <Sfx name="bell" at={pulseAt} volume={0.45} />
    </Stage>
  );
};
