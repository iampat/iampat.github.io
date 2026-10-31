// Episode 3 world check: the bench side view (frame 0-89) and the concrete top view with the board (90+).
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { BenchSide, TaviOnBench, ChalkOnFloor, BoardEdge, ConcreteTop } from "../kit/ep3/World";
import { DotsBoard, ScoreTags } from "../kit/ep3/DotsBoard";
import { GAMES } from "../kit/ep3/dots";
import { PITCH } from "../theme";
import { KPOSES } from "../kit/Keeper";

export const Ep3WorldPreview: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < 90)
    return (
      <Stage bg={PITCH.sky}>
        <BenchSide seed="ep3prev">
          <BoardEdge />
          <TaviOnBench face="happy" chalkStub />
          <ChalkOnFloor pose={frame > 45 ? KPOSES.drawFloor : KPOSES.sitFloor} />
        </BenchSide>
      </Stage>
    );
  return (
    <Stage bg={PITCH.sky}>
      <ConcreteTop>
        <DotsBoard x={960} y={560} size={620} game={GAMES.g1} upTo={18} />
        <ScoreTags x={120} y={110} tavi={3} chalk={0} />
      </ConcreteTop>
    </Stage>
  );
};
