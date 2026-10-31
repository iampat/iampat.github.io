// c19 Ending: every game. Teal-ink view. The 16-dot board small in the centre; on 'every possible game' it
// shrinks to a tile and copies spread outwards in rings, faster and faster, until the frame is a wall of tiny
// boards (152 cheap MiniBoards), while a mono readout climbs to 16 777 216 positions and holds. The wall drops
// away to one board: a chalk cross (the second player) glows beside it and '6 – 3' writes on. All 24 lines
// light in white one by one, each with a tiny '6-3' tag (ticks). Hold. The board slides left; a 5x5-dot board
// draws beside it with '=' and '8 – 8'; a 6x6-dot board draws with a chalk '?' and 'as far as anyone knows'.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Camera, Stage, type CamKey } from "../../kit/Camera";
import { DotsBoard, linePath } from "../../kit/ep3/DotsBoard";
import { allLines, emptyBoard } from "../../kit/ep3/dots";
import { Sfx } from "../../kit/Sfx";
import { trim } from "../../kit/ep2/chalk";
import { useCues } from "../../lib/timing";
import { EASE, clamp01, idle, lerp, pop, progress } from "../../lib/anim";
import { FONTS, XRAY } from "../../theme";
import { BigGrid, CHALK, ChalkCross, ChalkWrite, MiniBoard, PositionsReadout, SoftGlow, seeded, textW } from "../../kit/ext/ep3-c16-c19-parts";

const CX = 960;
const CY = 540;
const PITCH_PX = 122; // wall grid pitch
const TILE = 92; // tiny board size
const COLS = 8; // -8..8
const ROWS = 4; // -4..4
const POSITIONS = 16777216; // 2^24
const ROW_Y = 505; // board centres in the three-board layout
const CAP_Y = 828; // caption baseline
const lin = (t: number) => t;

/** Wall tiles in ring order (distance from the centre, with a little seeded jitter). */
const TILES = (() => {
  const rng = seeded(19);
  const out: { col: number; row: number; d: number; seed: number }[] = [];
  for (let r = -ROWS; r <= ROWS; r++)
    for (let c = -COLS; c <= COLS; c++) {
      if (r === 0 && c === 0) continue;
      out.push({ col: c, row: r, d: Math.hypot(c * PITCH_PX, r * PITCH_PX) + rng() * 60, seed: 100 + out.length * 7 + Math.floor(rng() * 1000) });
    }
  return out.sort((a, b) => a.d - b.d);
})();
const N_TILES = TILES.length;

/** The 24 lines in a shuffled order so the lighting sparkles over the board. */
const LINE_ORDER = (() => {
  const rng = seeded(24);
  const ls = allLines(3);
  for (let i = ls.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ls[i], ls[j]] = [ls[j], ls[i]];
  }
  return ls;
})();

/** Two chalk strokes: an equals sign drawn on. */
const Equals: React.FC<{ x: number; y: number; w: number; t: number }> = ({ x, y, w, t }) =>
  t <= 0.01 ? null : (
    <g>
      <path d={`M ${x - w / 2} ${y - w * 0.22} H ${x + w / 2}`} fill="none" stroke={CHALK} strokeWidth={7} strokeLinecap="round" {...trim(clamp01(t * 2))} />
      <path d={`M ${x - w / 2} ${y + w * 0.22} H ${x + w / 2}`} fill="none" stroke={CHALK} strokeWidth={7} strokeLinecap="round" {...trim(clamp01(t * 2 - 1))} />
    </g>
  );

export const C19: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues("c19");

  const tOne = cue("One more thing.");
  const tComputer = cue("A computer has played");
  const tComputerEnd = cue.end("A computer has played");
  const tNobody = cue("If nobody slips");
  const tSecondWins = cue("goes second wins");
  const tSix = cue("Six–three.");
  const tWhatever = cue("Whatever the first line is.");
  const tWhateverEnd = cue.end("Whatever the first line is.");
  const tNext = cue("The next board up");
  const tFive = cue("five dots by five");
  const tTie = cue("Perfect play is a tie.");
  const tAfter = cue("The one after that?");
  const tCounting = cue("Nobody has finished counting.");
  const end = cue.frames;
  const last = end - 1;

  // Beats.
  const boardAt = tOne - 2;
  const wallAt = tComputer + 6;
  const wallEnd = Math.max(wallAt + 60, tComputerEnd - 24); // the last tile lands here
  const countAt = wallAt + 4;
  const wallOut = tNobody - 2;
  const growAt = wallOut + 2;
  const crossAt = tSecondWins + 2;
  const sixAt = tSix;
  const SIX = 12;
  const linesAt = tWhatever + 2;
  const lineStep = Math.max(2, Math.floor((tWhateverEnd - 8 - linesAt) / 24));
  const moveAt = tNext + 2;
  const MOVE = 22;
  const bAt = tFive - 2;
  const eightAt = tTie + 2;
  const eqAt = tTie + 16;
  const cAt = tAfter + 2;
  const qAt = tAfter + 22;
  const captionAt = tCounting + 2;

  // Board A: small centre -> tile -> big -> left column.
  const shrink = progress(frame, wallAt, 18, EASE.standard);
  const grow = progress(frame, growAt, 18, EASE.back);
  const mv = progress(frame, moveAt, MOVE, EASE.standard);
  const baseSize = lerp(lerp(300, TILE, shrink), 420, grow);
  const A = { x: lerp(CX, 400, mv), y: lerp(CY, ROW_Y, mv) + idle(frame, 1, 4.2, 2), size: lerp(baseSize, 340, mv) };
  const aPop = pop(frame, boardAt, { stiffness: 160, damping: 14 });
  const aScale = 0.85 + 0.15 * aPop;
  const aO = progress(frame, boardAt, 8);

  // The wall: tile i lands at wallAt + span * sqrt(i / N), so the gaps shrink as it spreads.
  const span = wallEnd - wallAt;
  const wallFade = 1 - progress(frame, wallOut, 10, EASE.exit);
  const showWall = frame >= wallAt && wallFade > 0.001;
  // The count accelerates with the wall and holds on the exact number.
  const u = progress(frame, countAt, wallEnd - countAt, lin);
  const countV = POSITIONS * Math.pow(u, 2.6);
  const readO = progress(frame, countAt, 10, EASE.enter) * wallFade;

  // Cross, glow and '6 – 3': beside the big board, then as a caption under the small one.
  const crossT = progress(frame, crossAt, 12, EASE.standard);
  const glow = clamp01(progress(frame, crossAt + 6, 14) * (0.75 + 0.25 * Math.sin(frame / 4)));
  const cross = { x: lerp(A.x - A.size / 2 - 150, A.x - 96, mv), y: lerp(A.y, CAP_Y - 24, mv), r: lerp(56, 26, mv) };
  const sixSize = lerp(120, 64, mv);
  const six = { x: lerp(A.x + A.size / 2 + 70, A.x - 44, mv), y: lerp(A.y + 42, CAP_Y, mv) };
  const pSix = progress(frame, sixAt, SIX, lin);

  // All 24 lines light in white, one by one, with a tiny tag each. Tags fade when the board slides left.
  const tagO = 1 - progress(frame, moveAt, 10, EASE.exit);
  const lines = LINE_ORDER.map((l, i) => {
    const at = linesAt + i * lineStep;
    const t = progress(frame, at, 7, EASE.soft);
    const tag = pop(frame, at + 5, { stiffness: 240, damping: 13 });
    return { l, t, tag, i };
  });

  // Boards B and C with their marks.
  const bPop = pop(frame, bAt, { stiffness: 160, damping: 14 });
  const B = { x: 960, y: ROW_Y + idle(frame, 2, 3.8, 2), size: 380 };
  const cPop = pop(frame, cAt, { stiffness: 160, damping: 14 });
  const C = { x: 1520, y: ROW_Y + idle(frame, 3, 4.6, 2), size: 400 };
  const pEight = progress(frame, eightAt, 12, lin);
  const eqT = progress(frame, eqAt, 10, EASE.standard);
  const qPop = pop(frame, qAt, { stiffness: 170, damping: 11 });
  const pCap = progress(frame, captionAt, 26, lin);

  // Camera: a touch of push on the small board, out as the wall spreads, a slow drift after.
  const camKeys: CamKey[] = [
    { f: 0, x: 960, y: 540, zoom: 1.04 },
    { f: wallAt, x: 960, y: 540, zoom: 1.08 },
    { f: wallEnd, x: 960, y: 540, zoom: 1 },
    { f: wallOut, x: 960, y: 540, zoom: 1 },
    { f: moveAt, x: 960, y: 548, zoom: 1.04 },
    { f: moveAt + MOVE, x: 960, y: 560, zoom: 1 },
    { f: last, x: 960, y: 566, zoom: 1.02 },
  ];

  const seedA = 3;
  return (
    <Stage bg={XRAY.bg}>
      <Camera keys={camKeys}>
        <BigGrid />

        {/* The wall of tiny boards. */}
        {showWall ? (
          <g opacity={wallFade}>
            {TILES.map((tl, i) => {
              const at = wallAt + span * Math.sqrt(i / N_TILES);
              if (frame < at) return null;
              const s = pop(frame, at, { stiffness: 200, damping: 13 });
              return <MiniBoard key={i} x={CX + tl.col * PITCH_PX} y={CY + tl.row * PITCH_PX} size={TILE} seed={tl.seed} scale={s} opacity={Math.min(1, (frame - at) / 3)} />;
            })}
          </g>
        ) : null}

        {/* Board A: the 16-dot board. */}
        {aO > 0.001 ? (
          <g opacity={aO} transform={`translate(${A.x} ${A.y}) scale(${aScale}) translate(${-A.x} ${-A.y})`}>
            <DotsBoard x={A.x} y={A.y} size={A.size} board={emptyBoard(3)} seed={seedA} />
            {lines.map(({ l, t, tag, i }) => {
              if (t <= 0.001) return null;
              const d = linePath(A.x, A.y, A.size, 3, l, seedA);
              const cell = A.size / 3;
              const mx = A.x - A.size / 2 + (l.kind === "h" ? (l.c + 0.5) * cell : l.c * cell);
              const my = A.y - A.size / 2 + (l.kind === "h" ? l.r * cell : (l.r + 0.5) * cell);
              const tx = l.kind === "h" ? mx : mx + cell * 0.16;
              const ty = l.kind === "h" ? my - cell * 0.09 : my;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={CHALK} strokeWidth={Math.max(3, A.size / 70)} strokeLinecap="round" opacity={0.95} {...trim(t)} />
                  {tag > 0.01 && tagO > 0.01 ? (
                    <text x={tx} y={ty + 5} fill={XRAY.lime} fontFamily={FONTS.mono} fontWeight={500} fontSize={15} textAnchor="middle" opacity={0.85 * tagO} transform={`translate(${tx} ${ty}) scale(${tag}) translate(${-tx} ${-ty})`}>
                      6-3
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        ) : null}

        {/* The second player's cross, its glow, and '6 – 3'. */}
        <SoftGlow x={cross.x} y={cross.y} r={cross.r * 2.6} color={CHALK} opacity={glow * (1 - 0.5 * mv)} />
        <ChalkCross cx={cross.x} cy={cross.y} r={cross.r} t={crossT} color={CHALK} w={lerp(10, 7, mv)} />
        <ChalkWrite x={six.x} y={six.y} text="6 – 3" size={sixSize} t={pSix} seed={63} />

        {/* Board B: five dots by five, a tie. */}
        {bPop > 0.01 ? (
          <g transform={`translate(${B.x} ${B.y}) scale(${0.85 + 0.15 * bPop}) translate(${-B.x} ${-B.y})`} opacity={Math.min(1, bPop * 2)}>
            <DotsBoard x={B.x} y={B.y} size={B.size} board={emptyBoard(4)} seed={5} />
          </g>
        ) : null}
        <Equals x={B.x - 100} y={CAP_Y - 24} w={54} t={eqT} />
        <ChalkWrite x={B.x - 50} y={CAP_Y} text="8 – 8" size={64} t={pEight} seed={88} />

        {/* Board C: six dots by six, nobody knows. */}
        {cPop > 0.01 ? (
          <g transform={`translate(${C.x} ${C.y}) scale(${0.85 + 0.15 * cPop}) translate(${-C.x} ${-C.y})`} opacity={Math.min(1, cPop * 2)}>
            <DotsBoard x={C.x} y={C.y} size={C.size} board={emptyBoard(5)} seed={6} />
          </g>
        ) : null}
        {qPop > 0.01 ? (
          <g transform={`translate(${C.x} ${C.y + 10}) rotate(${idle(frame, 7, 2.6, 5)}) scale(${qPop})`}>
            <circle r={122} fill={XRAY.bg} />
            <ChalkWrite x={0} y={82} text="?" size={230} t={1} seed={99} color={XRAY.pink} anchor="middle" />
          </g>
        ) : null}
        <ChalkWrite x={C.x - textW("as far as anyone knows", 40) / 2} y={CAP_Y} text="as far as anyone knows" size={40} t={pCap} seed={77} opacity={0.8} />
      </Camera>

      {/* The positions count, fixed to the frame over the wall. */}
      <PositionsReadout x={960} y={930} value={countV} opacity={readO} />

      {/* SFX */}
      <Sfx name="chalk" at={boardAt} volume={0.35} />
      <Sfx name="subdrop" at={wallAt} volume={0.4} />
      <Sfx name="tick" at={countAt} volume={0.25} />
      <Sfx name="whoosh-long" at={wallAt + 6} volume={0.25} />
      <Sfx name="bell" at={wallEnd} volume={0.25} />
      <Sfx name="whoosh" at={wallOut} volume={0.25} />
      <Sfx name="pop-soft" at={growAt} volume={0.3} />
      <Sfx name="chalk" at={crossAt} volume={0.35} />
      <Sfx name="bell" at={sixAt} volume={0.35} />
      <Sfx name="chalk" at={sixAt} volume={0.3} />
      {LINE_ORDER.map((_, i) => (
        <Sfx key={i} name="tick" at={linesAt + i * lineStep} volume={0.2} />
      ))}
      <Sfx name="whoosh" at={moveAt} volume={0.2} />
      <Sfx name="chalk" at={bAt} volume={0.35} />
      <Sfx name="chalk" at={eightAt} volume={0.3} />
      <Sfx name="pop-soft" at={eqAt} volume={0.3} />
      <Sfx name="chalk" at={cAt} volume={0.35} />
      <Sfx name="blip" at={qAt} volume={0.35} />
      <Sfx name="chalk" at={captionAt} volume={0.25} />
    </Stage>
  );
};
