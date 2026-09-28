// Stand-in for a scene that is not built yet: shows the id and the narration.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { BACKGROUND, FONTS, PITCH, WIDTH } from "../theme";
import { sceneTiming } from "../lib/timing";

export const Placeholder: React.FC<{ id: string }> = ({ id }) => {
  const frame = useCurrentFrame();
  const s = sceneTiming(id);
  const t = (frame - s.leadFrames) / 30;
  const current = s.sentences.find((x) => t >= x.start && t <= x.end + 0.3);
  return (
    <Stage bg={BACKGROUND["Title"]}>
      <text x={80} y={110} fill={PITCH.light} fontFamily={FONTS.hud} fontWeight={700} fontSize={40}>
        {id} · {s.chapter}
      </text>
      <foreignObject x={80} y={380} width={WIDTH - 160} height={400}>
        <div style={{ fontFamily: FONTS.label, fontWeight: 800, fontSize: 56, color: PITCH.chalk, lineHeight: 1.25, textAlign: "center" }}>
          {current?.text ?? ""}
        </div>
      </foreignObject>
    </Stage>
  );
};
