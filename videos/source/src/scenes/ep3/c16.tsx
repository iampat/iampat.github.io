// c16 Bonus: the one-sentence rule. Teal-ink view: an empty 16-dot board in chalk on the X-ray grid, a chalk
// crown doodle beside it. Chalk's stub hovers, then writes on the right: 'DOTS 16' (the dots ripple 1-16 as the
// number counts), '+ LONG CHAINS ?', then 'FIRST → EVEN' with Tavi's ring and 'SECOND → ODD' with Chalk's cross,
// boxed (bell). A chalk calendar pops over the board and flips three pages fast ('takes years'). Then everything
// clears and Chalk's dome and eyes draw on in chalk, tiny chain shapes drifting in the pupils.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Camera, Stage, type CamKey } from "../../kit/Camera";
import { DotsBoard, dotPos } from "../../kit/ep3/DotsBoard";
import { emptyBoard } from "../../kit/ep3/dots";
import { Sfx } from "../../kit/Sfx";
import { useCues } from "../../lib/timing";
import { EASE, idle, lerp, pop, progress } from "../../lib/anim";
import { PITCH, XRAY } from "../../theme";
import { BigGrid, CHALK, Calendar, ChalkBox, ChalkCross, ChalkEyes, ChalkRing, ChalkStub, ChalkWrite, Crown, writtenW, textW } from "../../kit/ext/ep3-c16-c19-parts";

const BOARD = { x: 520, y: 580, size: 520 };
const COL = 1010; // left edge of the handwriting
const L1 = { y: 330, size: 86 }; // DOTS 16
const L2 = { y: 460, size: 70 }; // + LONG CHAINS ?
const L3 = { y: 620, size: 70 }; // FIRST -> EVEN
const L4 = { y: 750, size: 70 }; // SECOND -> ODD
const MARK_X = COL + 34; // ring / cross centre
const TEXT_X = COL + 96;
const EYES = { x: 960, y: 540, R: 290 };

const lin = (t: number) => t;

export const C16: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("c16");

  const tRule = cue("one-sentence rule");
  const tChampions = cue("champions");
  const tBefore = cue("Before the first line");
  const tCount = cue("Count the dots.");
  const tCountEnd = cue.end("Count the dots.");
  const tAdd = cue("Add the long chains");
  const tExpect = cue("expect");
  const tFirst = cue("Went first?");
  const tEven = cue("number even");
  const tSecond = cue("Went second?");
  const tOdd = cue("Odd.");
  const tYears = cue("Using it takes years.");
  const tReads = cue("Chalk reads it that way");
  const tPicked = cue("picked up the chalk");
  const end = cue.frames;
  const last = end - 1;

  // Beats.
  const boardAt = tRule - 4;
  const crownAt = tChampions;
  const hoverAt = tBefore;
  const w1At = tCount; // 'DOTS' writes
  const W1 = 14;
  const ripple0 = w1At + W1 - 2; // the 1-16 ripple runs to the end of 'Count the dots.'
  const rippleStep = Math.max(2, Math.floor((tCountEnd - ripple0) / 16));
  const w2At = tAdd + 2;
  const W2 = Math.max(30, tExpect - w2At);
  const qAt = w2At + W2 + 2; // the '?' pops
  const ringAt = tFirst;
  const w3At = tFirst + 6; // 'FIRST →'
  const W3 = 18;
  const evenAt = tEven + 6;
  const WE = 14;
  const crossAt = tSecond;
  const w4At = tSecond + 6; // 'SECOND →'
  const W4 = 20;
  const oddAt = tOdd + 2;
  const WO = 10;
  const boxAt = Math.max(oddAt + WO + 2, tYears - 12);
  const calAt = tYears + 2;
  const flips = [calAt + 14, calAt + 24, calAt + 33]; // three flips, fast
  const FLIP = 7;
  const clearAt = tReads - 6; // everything leaves
  const eyesAt = tReads + 2;
  const chainsAt = tReads + 26;
  const stubAt = tPicked;

  // Writing progress for each line.
  const p1 = progress(frame, w1At, W1, lin);
  const countN = Math.min(16, Math.max(0, Math.floor((frame - ripple0) / rippleStep) + 1));
  const p2 = progress(frame, w2At, W2, lin);
  const p3 = progress(frame, w3At, W3, lin);
  const pE = progress(frame, evenAt, WE, lin);
  const p4 = progress(frame, w4At, W4, lin);
  const pO = progress(frame, oddAt, WO, lin);
  const qPop = pop(frame, qAt, { stiffness: 180, damping: 11 });

  // The chalk stub: hovers over the board, then rides the tip of whatever is being written.
  type Tip = { x: number; y: number };
  const hoverTip: Tip = { x: BOARD.x + 40 + idle(frame, 2, 2.6, 26), y: BOARD.y - 20 + idle(frame, 5, 3.4, 14) };
  const tipOf = (x: number, text: string, size: number, p: number, y: number): Tip => ({ x: x + writtenW(text, size, p) + size * 0.08, y: y + size * 0.1 });
  let tip: Tip = hoverTip;
  let stubO = 0;
  if (frame >= hoverAt - 10 && frame < w1At) {
    stubO = progress(frame, hoverAt - 10, 10, EASE.enter);
    tip = hoverTip;
  } else if (frame >= w1At) {
    stubO = 1;
    // sequence of (start, tip at that time) segments; between writes the stub waits at the last tip
    const segs: { from: number; to: number; tip: () => Tip }[] = [
      { from: w1At, to: w1At + W1, tip: () => tipOf(TEXT_X - 62, "DOTS", L1.size, p1, L1.y) },
      { from: ripple0, to: ripple0 + 16 * rippleStep, tip: () => ({ x: TEXT_X - 62 + textW("DOTS ", L1.size) + textW(String(countN), L1.size) + 6, y: L1.y + 8 }) },
      { from: w2At, to: w2At + W2, tip: () => tipOf(TEXT_X - 62, "+ LONG CHAINS", L2.size, p2, L2.y) },
      { from: qAt - 4, to: qAt + 4, tip: () => ({ x: TEXT_X - 62 + textW("+ LONG CHAINS ?", L2.size) + 4, y: L2.y + 6 }) },
      { from: ringAt, to: ringAt + 10, tip: () => ({ x: MARK_X + 20 + 24 * Math.sin(progress(frame, ringAt, 10, lin) * Math.PI * 2 - 1.57), y: L3.y - 26 - 24 * Math.cos(progress(frame, ringAt, 10, lin) * Math.PI * 2 - 1.57) }) },
      { from: w3At, to: w3At + W3, tip: () => tipOf(TEXT_X, "FIRST →", L3.size, p3, L3.y) },
      { from: evenAt, to: evenAt + WE, tip: () => tipOf(TEXT_X + textW("FIRST → ", L3.size), "EVEN", L3.size, pE, L3.y) },
      { from: crossAt, to: crossAt + 10, tip: () => ({ x: MARK_X + lerp(-24, 24, progress(frame, crossAt, 10, lin) < 0.5 ? progress(frame, crossAt, 10, lin) * 2 : 1 - (progress(frame, crossAt, 10, lin) - 0.5) * 2), y: L4.y - 26 + lerp(-24, 24, progress(frame, crossAt, 10, lin) < 0.5 ? progress(frame, crossAt, 10, lin) * 2 : (progress(frame, crossAt, 10, lin) - 0.5) * 2) }) },
      { from: w4At, to: w4At + W4, tip: () => tipOf(TEXT_X, "SECOND →", L4.size, p4, L4.y) },
      { from: oddAt, to: oddAt + WO, tip: () => tipOf(TEXT_X + textW("SECOND → ", L4.size), "ODD", L4.size, pO, L4.y) },
    ];
    let cur: Tip | null = null;
    let lastTip: Tip | null = null;
    for (const s of segs) {
      if (frame >= s.from && frame < s.to) cur = s.tip();
      if (frame >= s.to) lastTip = s.tip();
    }
    tip = cur ?? lastTip ?? hoverTip;
    if (!cur) tip = { x: tip.x + idle(frame, 3, 1.8, 3), y: tip.y + idle(frame, 4, 2.2, 3) };
    stubO *= 1 - progress(frame, boxAt, 8, EASE.exit);
  }

  // Ripple over the dots: dot i flashes at ripple0 + i * rippleStep.
  const ripple = Array.from({ length: 16 }, (_, i) => {
    const at = ripple0 + i * rippleStep;
    const s = pop(frame, at, { stiffness: 260, damping: 12 });
    const fade = 1 - progress(frame, at + 10, 24, EASE.standard);
    return { i, s, fade: fade * 0.9 };
  });

  // The rule box, the calendar, the clear-out and the eyes.
  const boxT = progress(frame, boxAt, 16, EASE.standard);
  const calDraw = progress(frame, calAt, 12, EASE.enter);
  let flip = 0;
  for (const f of flips) flip += progress(frame, f, FLIP, EASE.standard);
  const calO = calDraw * (1 - progress(frame, clearAt, 8, EASE.exit));
  const boardDim = 1 - 0.7 * (progress(frame, calAt, 10) - progress(frame, clearAt, 1));
  const clear = progress(frame, clearAt, 10, EASE.exit);
  const writeO = 1 - clear;
  const writeDx = 60 * clear;
  const eyesDraw = progress(frame, eyesAt, 22, EASE.standard);
  const eyesPop = progress(frame, eyesAt + 12, 14, lin);
  const chainsO = progress(frame, chainsAt, 16, EASE.enter);
  const brow = progress(frame, tPicked + 6, 10, EASE.back);
  const stubLie = pop(frame, stubAt, { stiffness: 220, damping: 13 });

  // Board: pops in, dims under the calendar, leaves on the clear.
  const boardS = 0.85 + 0.15 * pop(frame, boardAt, { stiffness: 160, damping: 14 });
  const boardO = progress(frame, boardAt, 8) * boardDim * (1 - clear);
  const by = BOARD.y + idle(frame, 1, 4, 3);

  // Camera: a slow push over the writing, then onto the eyes.
  const camKeys: CamKey[] = [
    { f: 0, x: 960, y: 540, zoom: 1 },
    { f: clearAt, x: 970, y: 545, zoom: 1.04 },
    { f: eyesAt + 40, x: EYES.x, y: EYES.y - 40, zoom: 1.1 },
    { f: last, x: EYES.x, y: EYES.y - 46, zoom: 1.13 },
  ];

  return (
    <Stage bg={XRAY.bg}>
      <Camera keys={camKeys}>
        <BigGrid />

        {/* The empty 16-dot board and the crown. */}
        {boardO > 0.001 ? (
          <g opacity={boardO} transform={`translate(${BOARD.x} ${by}) scale(${boardS}) translate(${-BOARD.x} ${-by})`}>
            <DotsBoard x={BOARD.x} y={by} size={BOARD.size} board={emptyBoard(3)} seed={16} />
            {ripple.map(({ i, s, fade }) => {
              if (s <= 0.01 || fade <= 0.01) return null;
              const p = dotPos(BOARD.x, by, BOARD.size, 3, Math.floor(i / 4), i % 4);
              return (
                <g key={i} opacity={fade}>
                  <circle cx={p.x} cy={p.y} r={30 * s} fill={XRAY.lime} opacity={0.18} />
                  <circle cx={p.x} cy={p.y} r={22 * s} fill="none" stroke={XRAY.lime} strokeWidth={5} opacity={0.9} />
                </g>
              );
            })}
            <Crown x={BOARD.x - BOARD.size / 2 - 50} y={by - BOARD.size / 2 - 120 + idle(frame, 9, 3.2, 3)} size={110} t={progress(frame, crownAt, 18, EASE.standard)} />
          </g>
        ) : null}

        {/* The calendar over the dimmed board. */}
        <Calendar x={BOARD.x} y={BOARD.y - 10} scale={1.15} draw={calDraw} flip={flip} opacity={calO} />

        {/* Handwriting on the right. */}
        {writeO > 0.001 ? (
          <g opacity={writeO} transform={`translate(${writeDx} 0)`}>
            <ChalkWrite x={TEXT_X - 62} y={L1.y} text="DOTS" size={L1.size} t={p1} seed={11} />
            {countN > 0 ? <ChalkWrite x={TEXT_X - 62 + textW("DOTS ", L1.size)} y={L1.y} text={String(countN)} size={L1.size} t={1} seed={12 + countN} color={XRAY.lime} /> : null}
            <ChalkWrite x={TEXT_X - 62} y={L2.y} text="+ LONG CHAINS" size={L2.size} t={p2} seed={21} />
            {qPop > 0.01 ? (
              <g transform={`translate(${TEXT_X - 62 + textW("+ LONG CHAINS ", L2.size) + L2.size * 0.3} ${L2.y - L2.size * 0.35}) rotate(${idle(frame, 6, 2.4, 6)}) scale(${qPop})`}>
                <ChalkWrite x={0} y={L2.size * 0.35} text="?" size={L2.size * 1.15} t={1} seed={23} color={XRAY.pink} anchor="middle" />
              </g>
            ) : null}
            <ChalkRing cx={MARK_X} cy={L3.y - 26} r={24} t={progress(frame, ringAt, 10, EASE.standard)} color={PITCH.teal} />
            <ChalkWrite x={TEXT_X} y={L3.y} text="FIRST →" size={L3.size} t={p3} seed={31} />
            <ChalkWrite x={TEXT_X + textW("FIRST → ", L3.size)} y={L3.y} text="EVEN" size={L3.size} t={pE} seed={32} color={PITCH.teal} />
            <ChalkCross cx={MARK_X} cy={L4.y - 26} r={22} t={progress(frame, crossAt, 10, EASE.standard)} color={CHALK} />
            <ChalkWrite x={TEXT_X} y={L4.y} text="SECOND →" size={L4.size} t={p4} seed={41} />
            <ChalkWrite x={TEXT_X + textW("SECOND → ", L4.size)} y={L4.y} text="ODD" size={L4.size} t={pO} seed={42} />
            <ChalkBox x={COL - 30} y={L3.y - 86} w={textW("SECOND → ODD", L4.size) + 96 + 70} h={L4.y - L3.y + 130} t={boxT} r={34} width={6} />
            <ChalkStub x={tip.x} y={tip.y} opacity={stubO} />
          </g>
        ) : null}

        {/* Chalk's eyes, with chains drifting inside. */}
        <ChalkEyes x={EYES.x} y={EYES.y} R={EYES.R} draw={eyesDraw} eyes={eyesPop} chains={chainsO} frame={frame} brow={brow} />
        {/* The chalk she has not picked up yet, lying at the bottom. */}
        {stubLie > 0.01 ? (
          <g transform={`translate(${EYES.x + 420} ${EYES.y + 330}) scale(${stubLie})`}>
            <ChalkStub x={0} y={0} angle={-100} color={PITCH.teal} size={1.2} />
          </g>
        ) : null}
      </Camera>

      {/* SFX */}
      <Sfx name="chalk" at={boardAt} volume={0.35} />
      <Sfx name="pop-soft" at={crownAt} volume={0.3} />
      <Sfx name="chalk" at={w1At} volume={0.3} />
      {Array.from({ length: 16 }, (_, i) => (
        <Sfx key={i} name="tick" at={ripple0 + i * rippleStep} volume={0.22} />
      ))}
      <Sfx name="chalk" at={w2At} volume={0.3} />
      <Sfx name="pop" at={qAt} volume={0.3} />
      <Sfx name="pop-soft" at={ringAt} volume={0.3} />
      <Sfx name="chalk" at={w3At} volume={0.3} />
      <Sfx name="chalk" at={evenAt} volume={0.3} />
      <Sfx name="pop-soft" at={crossAt} volume={0.3} />
      <Sfx name="chalk" at={w4At} volume={0.3} />
      <Sfx name="chalk" at={oddAt} volume={0.3} />
      <Sfx name="bell" at={boxAt + 4} volume={0.35} />
      <Sfx name="pop-soft" at={calAt} volume={0.3} />
      {flips.map((f, i) => (
        <Sfx key={`f${i}`} name="blip" at={f} volume={0.3} />
      ))}
      <Sfx name="whoosh" at={clearAt} volume={0.2} />
      <Sfx name="chalk" at={eyesAt} volume={0.3} />
      <Sfx name="pop-soft" at={eyesAt + 12} volume={0.3} />
      <Sfx name="blip" at={tPicked + 6} volume={0.3} />
      <Sfx name="pop-soft" at={stubAt} volume={0.25} />
    </Stage>
  );
};
