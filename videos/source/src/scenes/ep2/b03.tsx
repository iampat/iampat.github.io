// b03 The question and the title: a chalk sprinter dashes in and stops, a ring draws itself around him
// (a game of time), a calm player in Tavi's teal strolls in with a ball at his feet and the ring moves to centre
// on him (the sprinter stays inside, at its edge). Three gold time coins drop in by his feet and the ring grows a
// step each time; they fly out and become the three chapter icons (Look, Touch, Shape), the promise (0.6 s swells
// to 2.4 s by lights out), then the title. The exit squeezes the letters into the halfway line and tilts down to
// the grass, where b04 writes its chapter card.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../../kit/Camera";
import { Dust, GroundSide, Stars } from "../../kit/World";
import { TimeBubble } from "../../kit/TimeBubble";
import { Sfx } from "../../kit/Sfx";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, progress } from "../../lib/anim";
import { CAST, HEIGHT, PITCH, WIDTH } from "../../theme";
import { ChalkRunner, ChapterIcon, DrawnRing, TitlePitchLines, type ChapterIconKind } from "../../kit/ext/ep2-b01-b03-graphics";
import { ChalkTitle, FloodIcon } from "../../kit/ext/s02-s03-hud";

/** Everything left of the icon row slides this far left at "Three ways" to make room for the row. */
const SHIFT = -300;
const RY = 540;
const FEET = RY + 118;
const FIG_H = 224;
/** The sprinter stops here and stays; the calm player stops here with the ball, and the ring centres on him. */
const SPR_X = 885;
const CALM_X = 1080;
const RING_R0 = 250;
const COIN_STEP = 30;
const COIN_R = 35;
/** Where the coins land, around the calm player's feet (offsets from CALM_X, FEET). */
const COIN_LAND: [number, number][] = [
  [-100, 64],
  [0, 84],
  [100, 64],
];
const COIN_FALL = 12;
const ICON_X = [1230, 1430, 1630];
const ICON_Y = 540;
const KINDS: ChapterIconKind[] = ["look", "touch", "shape"];
const LABELS = ["LOOK", "TOUCH", "SHAPE"];
const BALL_R = 15;
/** b04 opens on the side pitch with its horizon at about y = 704: the exit tilt lands the grass there. */
const B04_HORIZON = 704;
const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};

export const B03: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("b03");

  // Beats. "Look" as a sentence of its own (the word also appears in "look slow").
  const tSpeed = cue("Football isn't only a game of speed");
  const tSpeedW = cue("speed");
  const tTime = cue("It's a game of time");
  const tBest = cue("The best players look slow");
  const tBought = cue("They bought time before anyone noticed");
  const tThree = cue("Three ways to buy it");
  const tLook = cue.sentence(5).start;
  const tTouch = cue("Touch");
  const tShape = cue("Shape");
  const tBy = cue("By lights out");
  const tOut = cue("out");
  const tFour = cue("four times the time");
  const tSpeechEnd = cue.wordEnd("four times the time");
  const END = cue.frames;

  const runIn = tSpeed;
  const runStop = tSpeedW - 2;
  const ringAt = tTime + 2;
  const walkIn = tBest;
  const walkStop = walkIn + 48;
  const coinsAt = tBought;
  const coinsDur = 68;
  const coinLand = [0.43, 0.68, 0.93].map((p) => coinsAt + Math.round(p * coinsDur));
  const flyAt = tThree;
  const morphAt = [tLook, tTouch, tShape];
  const figuresOut = tBy - 12;
  const bubbleAt = tBy;
  const swellAt = tFour;
  const titleAt = tSpeechEnd + 4;
  // The exit: 13 frames at the very end. The letters squeeze into the halfway line, then the view tilts down.
  const exitAt = END - 13;
  const shift = SHIFT * smooth(progress(frame, flyAt, 20, EASE.standard));

  // The sprinter: fast in from the left, slowing to a stand.
  const u = clamp01((frame - runIn) / (runStop - runIn));
  const eased = 1 - Math.pow(1 - u, 2.6);
  const runX = lerp(-180, SPR_X, eased) + shift;
  const runAmt = frame < runIn ? 1 : Math.pow(1 - u, 0.8);
  const runPhase = (runX - shift + 180) / 92;
  const runOpacity = progress(frame, runIn - 2, 4) * (1 - progress(frame, figuresOut, 12, EASE.exit));

  // The calm player: in from the right at walking pace, the ball rolling a little ahead of his feet.
  const wu = smooth(clamp01((frame - walkIn) / (walkStop - walkIn)));
  const walkX = lerp(1560, CALM_X, wu) + shift;
  const walkAmt = frame < walkIn ? 0 : 0.28 * (1 - Math.pow(wu, 6));
  const walkPhase = (1560 - (walkX - shift)) / 64;
  const walkOpacity = progress(frame, walkIn - 2, 4) * (1 - progress(frame, figuresOut, 12, EASE.exit));
  const touch = walkAmt > 0.01 ? Math.abs(Math.sin(walkPhase * Math.PI)) * 10 * (walkAmt / 0.28) : 0;
  const ballX = walkX - 46 - touch;
  const ballSpin = (-(1560 - (walkX - shift)) / BALL_R) * (180 / Math.PI);

  // The ring: draws itself around the sprinter, then moves to centre on the calm player as he walks in, and grows
  // a step for each coin. Then it hands over to the time bubble.
  const recentre = smooth(progress(frame, walkIn + 14, 40, EASE.standard));
  const ringX = lerp(SPR_X, CALM_X, recentre) + shift;
  const coinsLanded = coinLand.reduce((n, f) => n + progress(frame, f, 10, EASE.back), 0);
  const ringR = RING_R0 + COIN_STEP * coinsLanded;
  const ringDraw = progress(frame, ringAt, 26, EASE.soft);
  const ringOpacity = 1 - progress(frame, figuresOut, 12, EASE.exit);

  // Coins: each falls from above the ring into place by his feet (gravity-like), lands with a pop and a chalk
  // puff, then all three fly to the row and become icons.
  const fly = smooth(progress(frame, flyAt, 18, EASE.standard));
  const landAt = (i: number) => ({ x: CALM_X + COIN_LAND[i][0] + shift, y: FEET + COIN_LAND[i][1] });
  const coinPos = (i: number) => {
    const land = landAt(i);
    const fall = clamp01((frame - (coinLand[i] - COIN_FALL)) / COIN_FALL);
    const y = land.y - 330 * (1 - fall * fall);
    return { x: lerp(land.x, ICON_X[i], fly), y: lerp(y, ICON_Y, fly) - Math.sin(fly * Math.PI) * 80 };
  };
  const coinPulse = (i: number) => {
    const k = frame - coinLand[i];
    return k >= 0 && k < 14 ? Math.sin((k / 14) * Math.PI) * 0.24 * (1 - k / 14) : 0;
  };

  // The promise: pink 0.6 s swells to lime 2.4 s, centred where the calm player stood.
  const swell = progress(frame, swellAt, 36, EASE.standard);
  const seconds = lerp(0.6, 2.4, swell);
  const bubbleX = CALM_X + shift;

  // Title: everything slides up, pitch lines slide in, chalk letters pop (fast enough to finish before the exit).
  const slide = progress(frame, titleAt - 2, 14, EASE.exit);
  const starsIn = progress(frame, 0, 20);
  const squeeze = progress(frame, exitAt, 7, EASE.exit);
  const tilt = progress(frame, exitAt + 3, 9, EASE.standard);
  const groundY = lerp(HEIGHT + 60, B04_HORIZON, tilt);

  return (
    <Stage bg={PITCH.skyHigh}>
      <g transform={`translate(0 ${-380 * tilt})`}>
        <Stars count={150} maxY={HEIGHT} seed="b03" opacity={starsIn} />
      </g>
      <g transform={`translate(0 ${-420 * slide})`} opacity={1 - slide}>
        {ringOpacity > 0.001 ? <DrawnRing x={ringX} y={RY} r={ringR} draw={ringDraw} opacity={ringOpacity} /> : null}
        {runOpacity > 0.001 ? <ChalkRunner x={runX} y={FEET} h={FIG_H} run={runAmt} phase={runPhase} trail={runAmt * progress(frame, runIn, 3)} opacity={runOpacity} /> : null}
        {walkOpacity > 0.001 ? (
          <g>
            <g transform={`translate(${walkX} 0) scale(-1 1) translate(${-walkX} 0)`}>
              <ChalkRunner x={walkX} y={FEET} h={FIG_H} run={walkAmt} phase={walkPhase} opacity={walkOpacity} accent={PITCH.teal} />
            </g>
            {/* His ball: orange, rolling with him, then resting at his toes. */}
            <g transform={`translate(${ballX} ${FEET - BALL_R}) rotate(${ballSpin})`} opacity={walkOpacity}>
              <circle r={BALL_R} fill={CAST.ballShade} />
              <circle cx={-2} cy={-2} r={BALL_R * 0.84} fill={CAST.ball} />
              <path d={`M${-BALL_R * 0.8},${-BALL_R * 0.3} Q0,${BALL_R * 0.35} ${BALL_R * 0.8},${-BALL_R * 0.3}`} fill="none" stroke={CAST.ballLine} strokeWidth={2.5} strokeLinecap="round" />
            </g>
          </g>
        ) : null}
        {coinLand.map((f, i) => (
          <Dust key={`d${i}`} x={landAt(i).x} y={landAt(i).y + COIN_R * 0.7} at={f} size={34} seed={`b03coin${i}`} />
        ))}
        {KINDS.map((k, i) => {
          const p = coinPos(i);
          const dropAt = coinLand[i] - COIN_FALL;
          const morph = progress(frame, morphAt[i], 16, EASE.standard);
          return (
            <ChapterIcon
              key={k}
              x={p.x}
              y={p.y}
              r={lerp(COIN_R * (1 + coinPulse(i)), 48, fly)}
              kind={k}
              appear={clamp01((frame - dropAt) / 7)}
              morph={morph}
              gold={1 - morph}
              lit={0.6 * progress(frame, morphAt[i] + 8, 10)}
              label={LABELS[i]}
            />
          );
        })}
        {frame >= bubbleAt ? (
          <g>
            {swell > 0.05 ? <circle cx={bubbleX} cy={RY} r={0.6 * 118} fill="none" stroke={CAST.mistake} strokeWidth={3} strokeDasharray="10 10" opacity={0.35} /> : null}
            <TimeBubble x={bubbleX} y={RY} seconds={seconds} pxPerSecond={118} minRadius={60} maxRadius={300} at={bubbleAt} fontSize={46} alarm={frame < swellAt} />
          </g>
        ) : null}
        <FloodIcon x={1760} y={150} at={tBy} blink={tOut} until={titleAt} />
      </g>

      {/* The title, which squeezes into the halfway line at the end while the view tilts down to the grass. */}
      <g transform={`translate(0 ${-380 * tilt})`} opacity={1 - tilt}>
        <TitlePitchLines at={titleAt + 2} />
        <g transform={`translate(${WIDTH / 2} 0) scale(${Math.max(0.001, 1 - squeeze)} 1) translate(${-WIDTH / 2} 0)`} opacity={1 - 0.5 * squeeze}>
          <ChalkTitle lines={["WHY THE BEST", "PLAYERS LOOK SLOW"]} x={WIDTH / 2} y={HEIGHT / 2 + idle(frame, 1, 6, 2)} at={titleAt + 6} size={126} stagger={0.65} />
        </g>
        {squeeze > 0.001 ? (
          <line x1={WIDTH / 2} y1={-60} x2={WIDTH / 2} y2={HEIGHT + 60} stroke={PITCH.chalk} strokeWidth={8 + 6 * squeeze} strokeLinecap="round" opacity={0.22 + 0.5 * squeeze} />
        ) : null}
      </g>
      {tilt > 0.001 ? <GroundSide groundY={groundY} /> : null}

      <Sfx name="whoosh" at={runIn} volume={0.35} />
      {[4, 10, 17, 26, 38].map((k, i) => (
        <Sfx key={`r${k}`} name="chalk" at={runIn + k} volume={0.24 - i * 0.03} />
      ))}
      <Sfx name="thump" at={runStop} volume={0.25} />
      <Sfx name="air" at={ringAt} volume={0.3} />
      {[8, 16, 24].map((k) => (
        <Sfx key={`t${k}`} name="tick" at={ringAt + k} volume={0.22} />
      ))}
      {[8, 22, 36].map((k) => (
        <Sfx key={`w${k}`} name="chalk" at={walkIn + k} volume={0.14} />
      ))}
      <Sfx name="air" at={walkIn + 16} volume={0.18} />
      <Sfx name="chalk" at={coinsAt} volume={0.3} />
      {coinLand.map((f, i) => (
        <Sfx key={`c${i}`} name="pop-soft" at={f} volume={0.4} />
      ))}
      <Sfx name="whoosh" at={flyAt} volume={0.25} />
      {morphAt.map((f, i) => (
        <Sfx key={`m${i}`} name="tick" at={f} volume={0.4 - i * 0.03} />
      ))}
      <Sfx name="pop" at={tBy} volume={0.3} />
      <Sfx name="blip" at={tOut} volume={0.4} />
      <Sfx name="alarm" at={bubbleAt + 2} volume={0.22} />
      <Sfx name="air" at={swellAt} volume={0.35} />
      <Sfx name="bell" at={swellAt + 30} volume={0.3} />
      <Sfx name="whoosh-long" at={titleAt - 2} volume={0.3} />
      <Sfx name="chalk" at={titleAt + 6} volume={0.45} />
      <Sfx name="pop-soft" at={titleAt + 6} volume={0.35} />
      <Sfx name="pop-soft" at={titleAt + 12} volume={0.35} />
      <Sfx name="pop-soft" at={titleAt + 18} volume={0.35} />
      <Sfx name="pop-soft" at={titleAt + 24} volume={0.4} />
      <Sfx name="bell" at={titleAt + 36} volume={0.4} />
      <Sfx name="whoosh" at={exitAt} volume={0.25} />
    </Stage>
  );
};
