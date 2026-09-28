// Kit preview: renders kit pieces for visual review. Not part of the video.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, Camera } from "../kit/Camera";
import { Sky, Stars, Floodlight, Stands, GroundSide, StandClock } from "../kit/World";
import { Ball } from "../kit/Ball";
import { BACKGROUND } from "../theme";
import { progress } from "../lib/anim";
import type { View } from "../lib/project";

export const KitPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const groundY = 820;
  const view: View = { kind: "side", originX: 400, groundY, ppm: 60 };
  const lights = [0, 8, 16, 24].map((f) => progress(frame, f, 10));
  return (
    <Stage bg={BACKGROUND["Floodlit Pitch"]}>
      <Camera keys={[{ f: 0, x: 960, y: 540, zoom: 1 }, { f: 90, x: 1000, y: 560, zoom: 1.06 }]}>
        <Sky />
        <Stars />
        <Stands baseY={groundY - 20} lit={lights[3]} />
        <StandClock x={1500} y={430} hours={22} />
        <Floodlight x={180} baseY={groundY - 160} height={520} on={lights[0]} />
        <Floodlight x={760} baseY={groundY - 180} height={560} on={lights[1]} />
        <Floodlight x={1220} baseY={groundY - 180} height={560} on={lights[2]} flip />
        <Floodlight x={1780} baseY={groundY - 160} height={520} on={lights[3]} flip />
        <GroundSide groundY={groundY} />
        <Ball cx={900} cy={groundY - 26} r={26} view={view} axis={{ x: 0, y: 1, z: 0 }} angle={frame * 0.2} />
        <Ball cx={1300} cy={600} r={110} view={view} axis={{ x: 0, y: 0, z: 1 }} angle={frame * 0.15} showBack />
      </Camera>
    </Stage>
  );
};
