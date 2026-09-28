// b05 Ch1 Look: too late. X-ray: Tavi seen from above (head on wide shoulders, both feet in front, a "seen from
// above" tag), centred first; the pass arrives at her foot and only then does the head turn. She slides left as
// the reaction dials pop: NOTICE (about a third of a second) and CHOOSE (about half, and it includes noticing),
// side by side and never added, while a pulse travels eye to brain and two doors pop, blink and one lights.
// Chalk jogs two steps along a ruler measured from the ball (2 m = 0.5 s, shown at half speed) until his mitten
// rests on the ball. The kerb sketch takes the focus (everything else dims): look after stepping off (MISTAKE),
// rewind, look first, then the kid walks across (FIX) while the dials come back and collapse to zero. The end
// frame is what b06's match cut starts from: the plain X-ray head at world (600, 730), r 150, camera
// (970, 546, 1.04), with a lime ring r 280 that grows as the dials drain.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Camera, Stage, type CamKey } from "../../kit/Camera";
import { Ball } from "../../kit/Ball";
import { Keeper, KPOSES, keeperPoseAt, type KeeperPose } from "../../kit/Keeper";
import { Dust } from "../../kit/World";
import { SlowMoTag, Stamp } from "../../kit/Graphics";
import { Sfx } from "../../kit/Sfx";
import { ChalkSketch, XRayHead } from "../../kit/ep2";
import { passInAt, passInTimeToX } from "../../physics/ep2sims";
import { CHASE_SPEED } from "../../physics/touch";
import { useCues } from "../../lib/timing";
import { EASE, idle, lerp, pop, progress, visible } from "../../lib/anim";
import type { View } from "../../lib/project";
import { CAST, FONTS, HEIGHT, PITCH, WIDTH, XRAY } from "../../theme";
import { BallRuler, KerbWalk, ReactionDials, SeenFromAbove, TOP_FOOT, XRayTopBody, keeperGlove, lin } from "../../kit/ext/ep2-b04-b05-parts";

const NOTICE_S = 0.33; // simple reaction, ages 10 to 18: about a third of a second
const CHOOSE_S = 0.5; // choice reaction (it includes noticing): about half a second

// Tavi from above. She starts centred and slides to the spot b06's match cut starts from.
const R = 150;
const HEAD_START = { x: 960, y: 640 };
const HEAD_END = { x: 600, y: 730 };
const BALL_R = 27;
/** The ball rests just in front of her right foot's toes. */
const BALL_OFF = { x: R * TOP_FOOT.x, y: R * (TOP_FOOT.y - TOP_FOOT.len / 2) - BALL_R - 2 };
const PPM_BALL = 112; // px per metre for the last metres of the pass
const T_ARRIVE = passInTimeToX(0);

// Chalk's two steps: 2 m at 160 px/m along a ruler measured from the ball. He stands on the ruler line, and at
// the end his front mitten rests on top of the ball with a normal arm (about 60 px of reach).
const STEPS_M = 2;
const RULER_PPM = 160;
const CHALK_H = 150;
const BALL_END = { x: HEAD_END.x + BALL_OFF.x, y: HEAD_END.y + BALL_OFF.y };
const RULER_Y = BALL_END.y;
const CHALK_GROUND = RULER_Y + 13;
const REACH_POSE: KeeperPose = { left: 50, right: 22, lean: 18, shift: 0, lift: 0, stretch: 0.95 };
const GLOVE = keeperGlove(0, CHALK_GROUND, CHALK_H, REACH_POSE, true);
const CHALK_END_X = BALL_END.x + BALL_R * 0.3 - GLOVE.x;
const CHALK_START_X = CHALK_END_X + STEPS_M * RULER_PPM;

// The kerb card, big and centred right while it is the focus.
const SK = { x: 1180, y: 740, size: 860 };
const DIALS = { x: 1480, y: 285, r: 105 };

const TOP: View = { kind: "top", originX: 0, originY: 0, ppm: 1 };

// The lime ring (2.5 s, the time-bubble look). b06's match cut starts from r 280 at 11 frames into a TimeBubble
// pop (a little overshoot), so the ring grows over 20 frames and lands exactly on that size on the last frame.
const RING_R = 280;
const RING_END_K = pop(11, 0, { stiffness: 140, damping: 15 });
const LimeRing: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) =>
  r <= 0.5 ? null : (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={XRAY.lime} opacity={0.1} />
      <circle r={r} fill="none" stroke={XRAY.lime} strokeWidth={5} opacity={0.9} />
      <circle r={r * 0.985} fill="none" stroke={XRAY.lime} strokeWidth={2} strokeDasharray={`${r * 0.12} ${r * 0.08}`} opacity={0.5} />
    </g>
  );

/** The X-ray grid, three frames wide, so a camera move never shows its edge. Lines sit on multiples of 60. */
const BigGrid: React.FC = () => {
  const lines: React.ReactNode[] = [];
  for (let x = -WIDTH; x <= 2 * WIDTH; x += 60) lines.push(<line key={`x${x}`} x1={x} y1={-HEIGHT} x2={x} y2={2 * HEIGHT} />);
  for (let y = -HEIGHT; y <= 2 * HEIGHT; y += 60) lines.push(<line key={`y${y}`} x1={-WIDTH} y1={y} x2={2 * WIDTH} y2={y} />);
  return (
    <g>
      <rect x={-WIDTH} y={-HEIGHT} width={3 * WIDTH} height={3 * HEIGHT} fill={XRAY.bg} />
      <g stroke={XRAY.grid} strokeWidth={2}>{lines}</g>
    </g>
  );
};

/** "2 m = 0.5 s" on a dark pill under the ruler. */
const RulerPill: React.FC<{ x: number; y: number; text: string; o: number }> = ({ x, y, text, o }) => {
  if (o <= 0.001) return null;
  const size = 32;
  const w = text.length * size * 0.62 + 44;
  return (
    <g opacity={o} transform={`translate(${x} ${y}) scale(${0.85 + 0.15 * o})`}>
      <rect x={-w / 2} y={-size * 0.8} width={w} height={size * 1.5} rx={size * 0.75} fill={XRAY.bg} opacity={0.92} />
      <rect x={-w / 2} y={-size * 0.8} width={w} height={size * 1.5} rx={size * 0.75} fill="none" stroke={PITCH.light} strokeWidth={3} opacity={0.6} />
      <text y={size * 0.3} fill={PITCH.light} fontFamily={FONTS.mono} fontWeight={500} fontSize={size} textAnchor="middle">
        {text}
      </text>
    </g>
  );
};

export const B05: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b05");

  const tArrives = cue("arrives");
  const tNoticing = cue("Noticing something new");
  const tThird = cue("third");
  const tChoosing = cue("Choosing what to do");
  const tHalf = cue("half");
  const tThats = cue("That's two of Chalk's steps");
  const tTwo = cue("two");
  const tLike = cue("Like checking for cars");
  const tKerb = cue("kerb");
  const tCheck = cue("Check first");
  const tThen = cue("Then move");
  const end = cue.frames;
  const last = end - 1;

  // Beats.
  const headIn = 0;
  const arrive = tArrives + 4;
  const turnStart = arrive + 3;
  const slideAt = tNoticing - 6; // the dials pop and she slides left
  const SLIDE = 20;
  const turnBack = tThats;
  const n0 = tNoticing + 4;
  const n1 = tThird + 2;
  const c0 = tChoosing + 4;
  const c1 = tHalf + 2;
  const doorsAt = c0 - 4;
  const jog0 = tTwo - 2;
  const JOG = 30; // 2 m at 4 m/s is 0.5 s; shown at half speed (with the tag) so the steps read
  const jogEnd = jog0 + JOG;
  const reachEnd = jogEnd + 6; // the last half step: the mitten comes down onto the ball
  const browAt = jogEnd + 12;
  const sketchAt = tLike;
  const sketchLateEnd = tKerb + 6;
  const stampAt = sketchLateEnd - 2;
  const rewindAt = tCheck - 4;
  const earlyAt = rewindAt + 2;
  const crossAt = tThen; // the kid starts across on "Then"
  const WALK = 15;
  const earlyEnd = crossAt - 3;
  const fixAt = crossAt + 9;
  const undimAt = tThen - 6; // the dials come back for the collapse
  const collapseAt = tThen + 4;
  const ringAt = last - 20; // the ring settles (not a flash) by the last frame
  const cardOut = last - 12; // FIX has held for about 0.75 s
  const fadeAt = last - 14;
  const swapAt = last - 14; // the body fades to the plain X-ray head that b06 starts from

  // Where she is: centred for the first question, then left as the dials pop.
  const slide = progress(frame, slideAt, SLIDE, EASE.standard);
  const head = { x: lerp(HEAD_START.x, HEAD_END.x, slide), y: lerp(HEAD_START.y, HEAD_END.y, slide) + idle(frame, 1, 3.6, 2) };
  const ballRest = { x: head.x + BALL_OFF.x, y: head.y + BALL_OFF.y };

  // The pass: the ball rolls down from the top edge and stops at her foot on "arrives".
  const rollPx = HEAD_START.y + BALL_OFF.y + 80;
  const rollFrames = Math.round((T_ARRIVE - passInTimeToX(-rollPx / PPM_BALL)) * 30);
  const simT = T_ARRIVE - Math.max(0, arrive - frame) / 30;
  const ballPitchX = passInAt(Math.min(simT, T_ARRIVE)).x; // metres short of her mark (negative)
  const ballY = ballRest.y + Math.min(0, ballPitchX) * PPM_BALL;
  const ballShow = frame >= arrive - rollFrames;
  const ballAngle = (ballPitchX * PPM_BALL) / BALL_R;

  // The late look: the head turns only after the ball is at her foot, and comes back for Chalk's steps.
  const turn = 110 * progress(frame, turnStart, 12, EASE.standard) * (1 - progress(frame, turnBack, 14, EASE.standard));

  // Reaction dials: NOTICE fills on "about a third of a second", CHOOSE (which starts with the same noticing) on
  // "about half a second". They dim while the kerb sketch has the focus, come back and drain to zero on "Then move".
  const p1 = progress(frame, n0, n1 - n0, lin);
  const p2 = progress(frame, c0, c1 - c0, lin);
  const collapse = progress(frame, collapseAt, 14, EASE.standard);
  const dim = 1 - 0.75 * (progress(frame, sketchAt, 12) - progress(frame, undimAt, 10));
  const dialsIn = progress(frame, slideAt, 12, EASE.enter);
  // The captions under the dials leave with the sketch and do not come back (the card covers their spot).
  const captionsOff = 1 - progress(frame, sketchAt, 10);
  const restO = 1 - progress(frame, fadeAt, 8, EASE.exit);
  // Doors: pop in with CHOOSE, both blink while choosing, then TURN lights up.
  const doorsIn = progress(frame, doorsAt, 12, lin);
  const choosing = p2 > 0.001 && p2 < 0.8;
  const blink = 0.5 + 0.5 * Math.sin(frame / 2.4);
  const litScale = 1 - collapse;
  const lit1 = (choosing ? 0.25 + 0.35 * blink : p2 >= 0.8 ? 1 : 0) * litScale;
  const lit2 = (choosing ? 0.25 + 0.35 * (1 - blink) : p2 >= 0.8 ? 0.12 : 0) * litScale;

  // Chalk's jog: constant speed along the ruler from 2 m to the ball, then the mitten rests on it, one eyebrow.
  const jogT = progress(frame, jog0, JOG, lin);
  const chalkX = CHALK_START_X - STEPS_M * RULER_PPM * jogT + (frame > reachEnd ? idle(frame, 3, 2.4, 1.5) : 0);
  const rulerP = progress(frame, jog0 - 14, 12, EASE.standard);
  const chalkIn = progress(frame, jog0 - 10, 10, EASE.back);
  // Chalk and his ruler dim with the sketch and stay dim: only the dials come back for the collapse.
  const jogGroupO = progress(frame, jog0 - 14, 8) * (1 - 0.75 * progress(frame, sketchAt, 12)) * restO;
  const kPose = keeperPoseAt(frame, [
    [jog0 - 1, "stand"],
    [jog0 + 4, "runA"],
    [jog0 + 11, "runB"],
    [jog0 + 18, "runA"],
    [jog0 + 25, "runB"],
    [jogEnd, { ...KPOSES.runA, lean: 16 }],
    [reachEnd, REACH_POSE],
    [reachEnd + 60, { ...REACH_POSE, lean: REACH_POSE.lean + 1 }],
  ]);
  const kFace = frame >= browAt ? "thinking" : "flat";
  const stepX = [CHALK_START_X - RULER_PPM, CHALK_END_X];
  const stepAt = [jog0 + JOG / 2, jogEnd];
  const pillO = visible(frame, jogEnd - 2, undefined, 10);

  // Kerb sketch: late (mistake), rewind, early (fix), then the kid walks across.
  const pLate = progress(frame, sketchAt, sketchLateEnd - sketchAt, lin) * (1 - progress(frame, rewindAt, 7, EASE.exit));
  const pEarly = progress(frame, earlyAt, earlyEnd - earlyAt, lin);
  const earlyO = 1 - progress(frame, crossAt - 4, 6, EASE.standard);
  const walkShow = progress(frame, crossAt - 4, 4, lin);
  const walk = progress(frame, crossAt, WALK, lin);
  const sketchO = progress(frame, sketchAt, 8) * (1 - progress(frame, cardOut, 8, EASE.exit));
  const cardS = 0.9 + 0.1 * progress(frame, sketchAt, 14, EASE.back);

  // The body: pops in, dims while the kerb card has the focus, and at the end fades to the plain X-ray head.
  const headO = progress(frame, headIn, 12, EASE.enter);
  const headScale = 0.9 + 0.1 * progress(frame, headIn, 14, EASE.back);
  const headDim = 1 - 0.75 * (progress(frame, sketchAt, 12) - progress(frame, undimAt, 10));
  const swap = progress(frame, swapAt, 10, EASE.standard);

  // Camera: from the grid b04 left (identity), a drift onto the centred head, back out as she slides left, a
  // small push onto the kerb card, and the exact end framing b06's match cut starts from.
  const camKeys: CamKey[] = [
    { f: 0, x: 960, y: 540, zoom: 1 },
    { f: 30, x: 960, y: 560, zoom: 1.06 },
    { f: slideAt, x: 960, y: 560, zoom: 1.06 },
    { f: slideAt + SLIDE, x: 960, y: 540, zoom: 1 },
    { f: sketchAt, x: 965, y: 545, zoom: 1.01 },
    { f: sketchAt + 30, x: 1040, y: 600, zoom: 1.05 },
    { f: undimAt, x: 1030, y: 590, zoom: 1.05 },
    { f: fadeAt, x: 970, y: 546, zoom: 1.04 },
    { f: last, x: 970, y: 546, zoom: 1.04 },
  ];

  return (
    <Stage bg={XRAY.bg}>
      <Camera keys={camKeys}>
        <BigGrid />

        {/* Chalk's ruler (measured from the ball) and his two steps. */}
        <g opacity={jogGroupO}>
          {/* Two chalk footprints, one metre apart, left as each step lands. */}
          {stepX.map((sx, i) =>
            frame >= stepAt[i] ? (
              <ellipse key={i} cx={sx + (i ? 10 : -10)} cy={CHALK_GROUND - 2} rx={16} ry={6} fill={PITCH.chalk} opacity={0.55 * progress(frame, stepAt[i], 6)} />
            ) : null,
          )}
          <Dust x={stepX[0]} y={CHALK_GROUND} at={stepAt[0]} size={34} seed="b05-step1" />
          <Dust x={stepX[1]} y={CHALK_GROUND} at={stepAt[1]} size={34} seed="b05-step2" />
          {chalkIn > 0.001 ? (
            <g transform={`translate(${chalkX} ${CHALK_GROUND}) scale(${chalkIn}) translate(${-chalkX} ${-CHALK_GROUND})`}>
              <Keeper x={chalkX} groundY={CHALK_GROUND} h={CHALK_H} pose={kPose} face={kFace} flip look={0.5} />
            </g>
          ) : null}
          {/* The ruler draws over Chalk so its labels stay readable where he stands. */}
          <BallRuler from={[BALL_END.x, RULER_Y]} ppm={RULER_PPM} metres={STEPS_M} progress={rulerP} glow={progress(frame, reachEnd - 2, 8)} glowAt={0} />
          <RulerPill x={BALL_END.x + 1.5 * RULER_PPM} y={RULER_Y + 68} text={`${STEPS_M} m = ${(STEPS_M / CHASE_SPEED).toFixed(1)} s`} o={pillO} />
        </g>

        {/* The ring: it grows as the dials drain, and b06 carries it onto her map token. Drawn under the rest. */}
        <LimeRing x={HEAD_END.x} y={HEAD_END.y} r={RING_R * RING_END_K * progress(frame, ringAt, last - ringAt, EASE.standard)} />

        {/* Tavi from above: head, shoulders, both feet, the ball at her right foot. */}
        <g transform={`translate(${head.x} ${head.y}) scale(${headScale}) translate(${-head.x} ${-head.y})`}>
          <XRayTopBody
            x={head.x}
            y={head.y}
            size={R}
            turn={turn}
            pulse={p1 * (1 - collapse)}
            doors={["TURN", "PASS"]}
            lit={[lit1, lit2]}
            doorsIn={doorsIn}
            feet={restO}
            opacity={headO * headDim * (1 - swap)}
          />
        </g>
        {swap > 0.001 ? <XRayHead x={HEAD_END.x} y={HEAD_END.y} size={R} doors={["TURN", "PASS"]} lit={[0, 0]} opacity={swap} /> : null}
        {ballShow ? (
          <g opacity={restO * (0.35 + 0.65 * headDim)}>
            <Ball cx={ballRest.x} cy={ballY} r={BALL_R} view={TOP} axis={{ x: 1, y: 0, z: 0 }} angle={ballAngle} />
          </g>
        ) : null}

        {/* The reaction dials, side by side, never added. */}
        <g opacity={dialsIn * dim * restO}>
          <ReactionDials
            x={DIALS.x}
            y={DIALS.y}
            r={DIALS.r}
            notice={NOTICE_S}
            choose={CHOOSE_S}
            pNotice={p1 * (1 - collapse)}
            pChoose={p2 * (1 - collapse)}
            wake={progress(frame, c0 - 6, 10)}
            caption="ages 10 to 18, computer tests"
            captionO={progress(frame, n0, 12) * captionsOff}
            totalO={progress(frame, c1 + 2, 10) * (1 - collapse) * captionsOff}
          />
        </g>

        {/* The kerb sketch on a big dark card: the focus while everything else dims. */}
        {sketchO > 0.001 ? (
          <g opacity={sketchO} transform={`translate(${SK.x} ${SK.y}) scale(${cardS}) translate(${-SK.x} ${-SK.y})`}>
            <rect x={SK.x - SK.size / 2 - 20} y={SK.y - SK.size * 0.35 - 20} width={SK.size + 40} height={SK.size * 0.7 + 40} rx={36} fill={PITCH.skyHigh} />
            <rect x={SK.x - SK.size / 2 - 20} y={SK.y - SK.size * 0.35 - 20} width={SK.size + 40} height={SK.size * 0.7 + 40} rx={36} fill="none" stroke={PITCH.chalk} strokeWidth={4} opacity={0.25} />
            {pLate > 0.001 ? <ChalkSketch kind="kerb" mode="late" progress={pLate} size={SK.size} x={SK.x} y={SK.y} accent={CAST.mistake} /> : null}
            {pEarly > 0.001 && earlyO > 0.001 ? <ChalkSketch kind="kerb" mode="early" progress={pEarly} size={SK.size} x={SK.x} y={SK.y} accent={XRAY.lime} opacity={earlyO} /> : null}
            <KerbWalk show={walkShow} walk={walk} size={SK.size} x={SK.x} y={SK.y} />
            <Stamp kind="MISTAKE" x={SK.x + SK.size * 0.32} y={SK.y - SK.size * 0.25} at={stampAt} until={rewindAt} rotate={-8} />
            {/* The kid ends on the right pavement, so the FIX stamp goes top-left. */}
            <Stamp kind="FIX" x={SK.x - SK.size * 0.25} y={SK.y - SK.size * 0.25} at={fixAt} rotate={-8} />
          </g>
        ) : null}
      </Camera>

      {/* Screen tags: what the view is, and the half-speed jog. */}
      <SeenFromAbove x={60} y={60} at={10} until={slideAt + 90} />
      <SlowMoTag at={jog0 - 6} until={reachEnd + 4} label="HALF SPEED" />

      {/* SFX */}
      <Sfx name="subdrop" at={0} volume={0.35} />
      <Sfx name="thump" at={arrive} volume={0.4} />
      <Sfx name="whoosh" at={turnStart} volume={0.25} />
      <Sfx name="whoosh" at={slideAt} volume={0.2} />
      <Sfx name="tick" at={n0} volume={0.3} />
      <Sfx name="blip" at={n0 + 18} volume={0.2} />
      <Sfx name="pop-soft" at={doorsAt} volume={0.25} />
      <Sfx name="tick" at={c0} volume={0.3} />
      <Sfx name="pop-soft" at={c0 + 10} volume={0.25} />
      <Sfx name="pop-soft" at={c0 + 22} volume={0.25} />
      <Sfx name="pop" at={Math.round(c0 + (c1 - c0) * 0.8)} volume={0.3} />
      <Sfx name="chalk" at={jog0 - 12} volume={0.25} />
      <Sfx name="chalk" at={Math.round(stepAt[0])} volume={0.35} />
      <Sfx name="chalk" at={stepAt[1]} volume={0.35} />
      <Sfx name="thump" at={reachEnd} volume={0.2} />
      <Sfx name="blip" at={browAt} volume={0.25} />
      <Sfx name="chalk" at={sketchAt} volume={0.3} />
      <Sfx name="pop-soft" at={Math.round(sketchAt + (sketchLateEnd - sketchAt) * 0.45)} volume={0.3} />
      <Sfx name="whoosh" at={Math.round(sketchAt + (sketchLateEnd - sketchAt) * 0.76)} volume={0.3} />
      <Sfx name="alarm" at={Math.round(sketchAt + (sketchLateEnd - sketchAt) * 0.82)} volume={0.3} />
      <Sfx name="stamp" at={stampAt} volume={0.45} />
      <Sfx name="blip" at={rewindAt} volume={0.3} />
      <Sfx name="chalk" at={earlyAt} volume={0.3} />
      <Sfx name="whoosh" at={Math.round(earlyAt + (earlyEnd - earlyAt) * 0.82)} volume={0.25} />
      <Sfx name="chalk" at={crossAt + 4} volume={0.3} />
      <Sfx name="chalk" at={crossAt + 9} volume={0.3} />
      <Sfx name="chalk" at={crossAt + 14} volume={0.3} />
      <Sfx name="stamp" at={fixAt} volume={0.45} />
      <Sfx name="pop-soft" at={collapseAt} volume={0.3} />
      <Sfx name="bell" at={ringAt} volume={0.3} />
    </Stage>
  );
};
