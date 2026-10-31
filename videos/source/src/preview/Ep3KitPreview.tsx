// Episode 3 kit check: the board playing g1 (left), g5 (right), chains highlighted, score tags.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { DotsBoard, ScoreTags, movesDoneAt } from "../kit/ep3/DotsBoard";
import { GAMES, boardAfter, chains, safeLines, score, lineId } from "../kit/ep3/dots";
import { PITCH } from "../theme";

export const Ep3KitPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const mf = GAMES.g1.moves.map((_, k) => 10 + k * 12);
  const k = movesDoneAt(frame, mf);
  const b = boardAfter(GAMES.g1, k);
  const [t, c] = score(b);
  const ch = chains(b);
  const safe = safeLines(b);
  const b5 = boardAfter(GAMES.g5, 17);
  return (
    <Stage bg="#1B1F3A">
      <DotsBoard x={520} y={540} size={560} game={GAMES.g1} frame={frame} moveFrames={mf} highlights={[{ lines: safe.map(lineId), color: "#B6F24A", opacity: 0.5 }]} />
      <ScoreTags x={300} y={120} tavi={t} chalk={c} />
      <DotsBoard x={1400} y={540} size={560} game={GAMES.g5} upTo={17} highlights={chains(b5).map((bx, i) => ({ boxes: bx, color: i === 0 ? PITCH.accent : PITCH.teal }))} boxText={Object.fromEntries(chains(b5).flatMap((bx) => bx.map(([i, j]) => [`${i}${j}`, String(bx.length)])))} />
      <text x={1400} y={120} fontSize={40} fill={PITCH.chalk} textAnchor="middle" fontFamily="Nunito">g5 after 17 moves: chains {ch.length ? "" : ""}{chains(b5).map((x) => x.length).join(" + ")}</text>
    </Stage>
  );
};
