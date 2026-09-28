// Flight preview: a curler from above and a drive from the side. Not part of the video.
import React from "react";
import { Stage } from "../kit/Camera";
import { Sky, Stars, GroundSide, PitchTop } from "../kit/World";
import { Flight, useFlight } from "../kit/Flight";
import { GoalSide, GoalTop } from "../kit/Goal";
import { Keeper, KPOSES } from "../kit/Keeper";
import { Player, POSES } from "../kit/Player";
import { Label, Readout } from "../kit/Graphics";
import { revPerSec, v3 } from "../physics/sim";
import { BACKGROUND, PITCH } from "../theme";
import type { View } from "../lib/project";

const TILT = (63 * Math.PI) / 180;

export const FlightPreview: React.FC = () => {
  // Left half: top-down curler, goal at the top.
  const top: View = { kind: "topUp", originX: 560, originY: 980, ppm: 38 };
  const curler = useFlight({
    speed: 20, elevationDeg: 10, azimuthDeg: -7.5,
    spin: v3(0, -revPerSec(8) * Math.cos(TILT), revPerSec(8) * Math.sin(TILT)),
    start: v3(0, 0, 0.11), ground: false, stopAtX: 21,
  });
  // Right half: side-on drive into the goal.
  const side: View = { kind: "side", originX: 1080, groundY: 860, ppm: 34 };
  const drive = useFlight({ speed: 25, elevationDeg: 5, spin: v3(0, -revPerSec(4), 0), stopAtX: 20 });
  return (
    <Stage bg={BACKGROUND["Floodlit Pitch"]}>
      <Sky />
      <Stars count={60} maxY={500} />
      <g>
        <clipPath id="left"><rect x={0} y={0} width={1000} height={1080} /></clipPath>
        <g clipPath="url(#left)">
          <PitchTop view={top} goalX={21} />
          <GoalTop view={top} goalX={21} />
          <Flight path={curler} view={top} at={10} ghost trailColor={PITCH.light} r={16} />
          <Label x={560} y={80} text="curler, seen from above" at={0} size={34} />
        </g>
      </g>
      <g>
        <clipPath id="right"><rect x={1000} y={0} width={920} height={1080} /></clipPath>
        <g clipPath="url(#right)">
          <GroundSide groundY={860} />
          <GoalSide view={side} goalX={20} />
          <Keeper x={1080 + 19.2 * 34} groundY={860} h={2.0 * 34 * 1.5} pose={KPOSES.ready} />
          <Player x={1040} groundY={860} h={1.6 * 34 * 1.6} pose={POSES.follow} face="focus" />
          <Flight path={drive} view={side} at={10} r={12} trailColor={PITCH.light} />
          <Readout x={1460} y={260} caption="shot speed" value={90} unit="km/h" at={10} color={PITCH.chalk} />
        </g>
      </g>
    </Stage>
  );
};
