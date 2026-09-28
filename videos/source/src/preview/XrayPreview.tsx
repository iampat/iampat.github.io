// X-ray + Air Crowd preview. Not part of the video.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { XRayGrid, XRayLeg } from "../kit/XRay";
import { AirFlow, spinPushDir } from "../kit/AirFlow";
import { Ball } from "../kit/Ball";
import { Arrow, Label, WordCard } from "../kit/Graphics";
import { POSES } from "../kit/Player";
import { BACKGROUND, XRAY } from "../theme";

export const XrayPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const push = spinPushDir(1, 90);
  const bx = 1380;
  const by = 560;
  return (
    <Stage bg={BACKGROUND["X-ray Physics"]}>
      <XRayGrid />
      {/* Left: the kicking leg at contact, ankle locked. */}
      <XRayLeg x={330} y={300} h={1100} pose={POSES.strike} highlight={["foot"]} ankleLock={1} showFar />
      <Label x={380} y={140} text="toes down, ankle locked" at={0} size={36} />
      {/* Right: the Air Crowd around a curler seen from above, flying up the screen. */}
      <AirFlow cx={bx} cy={by} R={150} spin={1} rotate={90} count={70} speed={10} showSides />
      <Ball cx={bx} cy={by} r={150} view={{ kind: "topUp", originX: 0, originY: 0, ppm: 1 }} axis={{ x: 0, y: 0, z: 1 }} angle={frame * 0.25} />
      <Arrow x1={bx} y1={by} x2={bx + push.x * 300} y2={by + push.y * 300} at={0} color={XRAY.lime} width={14} />
      <WordCard term="Magnus effect" meaning="the spin push" at={0} until={999} />
    </Stage>
  );
};
