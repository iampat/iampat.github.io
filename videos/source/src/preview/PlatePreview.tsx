// Composite test: plate + SVG lights + Tavi + ball. Not part of the video.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage, Camera } from "../kit/Camera";
import { Plate, STADIUM_LAMPS } from "../kit/Plate";
import { Glow, Stars } from "../kit/World";
import { Player, POSES } from "../kit/Player";
import { Keeper, KPOSES } from "../kit/Keeper";
import { Ball } from "../kit/Ball";
import { progress } from "../lib/anim";
import { PITCH } from "../theme";

export const PlatePreview: React.FC = () => {
  const frame = useCurrentFrame();
  const groundY = 960;
  return (
    <Stage bg="transparent">
      <Camera keys={[{ f: 0, x: 960, y: 540, zoom: 1.0 }, { f: 120, x: 1000, y: 580, zoom: 1.08 }]}>
        <Plate name="stadium-off" />
        <Stars count={40} maxY={250} />
        {STADIUM_LAMPS.map((l, i) => {
          const on = progress(frame, 6 + i * 8, 8);
          return (
            <g key={i} opacity={on}>
              <rect x={l.x - 70} y={l.y - 46} width={140} height={92} rx={22} fill={PITCH.lightSoft} />
              <Glow cx={l.x} cy={l.y} r={175} color={PITCH.lightSoft} intensity={1.1} rings={4} />
            </g>
          );
        })}
        <Keeper x={1500} groundY={900} h={210} pose={KPOSES.stand} face="flat" />
        <Player x={760} groundY={groundY} h={330} pose={POSES.crouch} face="focus" />
        <Ball cx={905} cy={groundY - 30} r={30} view={{ kind: "side", originX: 0, groundY, ppm: 60 }} lineDraw={progress(frame, 40, 30)} />
      </Camera>
    </Stage>
  );
};
