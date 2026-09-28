// Episode 2 kit preview: top-down tokens with vision cones, the time bubble, snapshots. Not in the video.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { TopField } from "../kit/Field";
import { TopPlayer, angleTo } from "../kit/TopPlayer";
import { TimeBubble, TimeBar, secondsToReach } from "../kit/TimeBubble";
import { Snapshot, ThoughtBubble, UnknownFog } from "../kit/Snapshot";
import { Ball } from "../kit/Ball";
import { Player, POSES, SAM_COLORS } from "../kit/Player";
import { Keeper, keeperPoseAt } from "../kit/Keeper";
import { GroundSide, Sky } from "../kit/World";
import { PITCH } from "../theme";
import type { View } from "../lib/project";
import { project } from "../lib/project";

export const Ep2KitPreview: React.FC = () => {
  const frame = useCurrentFrame();
  // Left: top-down midfield. Pitch x along screen x, +y up.
  const top: View = { kind: "top", originX: 120, originY: 640, ppm: 12 };
  const tavi = { x: 50, y: 4 };
  const chalk = { x: 55 + Math.sin(frame / 20) * 1.5, y: 10 };
  const sam = { x: 36, y: -6 };
  const T = project({ x: tavi.x, y: tavi.y, z: 0 }, top);
  const C = project({ x: chalk.x, y: chalk.y, z: 0 }, top);
  const S = project({ x: sam.x, y: sam.y, z: 0 }, top);
  const dist = Math.hypot(chalk.x - tavi.x, chalk.y - tavi.y);
  const secs = secondsToReach(dist, 6);
  const look = Math.sin(frame / 12) * 110;
  return (
    <Stage bg={PITCH.sky}>
      <g>
        <clipPath id="l"><rect width={960} height={1080} /></clipPath>
        <g clipPath="url(#l)">
          <TopField view={top} x0={30} x1={70} y0={-30} y1={30} />
          <TimeBubble x={T.x} y={T.y} seconds={secs} pxPerSecond={90} />
          <TopPlayer x={S.x} y={S.y} kind="sam" facing={angleTo(S.x, S.y, T.x, T.y)} label="Sam" />
          <TopPlayer x={C.x} y={C.y} kind="chalk" facing={angleTo(C.x, C.y, T.x, T.y)} stride={frame / 10} />
          <TopPlayer x={T.x} y={T.y} kind="tavi" facing={angleTo(T.x, T.y, S.x, S.y)} look={look} cone={{ angleDeg: 190, radius: 240 }} />
          <Ball cx={S.x + 26} cy={S.y + 10} r={10} view={top} />
          <TimeBar x={80} y={100} width={420} seconds={secs} label="your time" />
        </g>
      </g>
      {/* Right: side view, Sam passes, Tavi looks back, Chalk chases. */}
      <g>
        <clipPath id="r"><rect x={960} width={960} height={1080} /></clipPath>
        <g clipPath="url(#r)">
          <Sky />
          <GroundSide groundY={760} vanishX={1440} />
          <Player x={1120} groundY={760} h={300} pose={POSES.passInside} colors={SAM_COLORS} />
          <Player x={1500} groundY={760} h={300} pose={POSES.lookBack} headTurn={(Math.sin(frame / 10) + 1) / 2} />
          <Keeper x={1800} groundY={760} h={330} pose={keeperPoseAt(frame % 16, [[0, "runA"], [8, "runB"], [16, "runA"]])} flip face="annoyed" />
          <Snapshot x={1560} y={300} at={10} tilt={-8}><rect width={220} height={150} fill={PITCH.grass} /><circle cx={160} cy={70} r={16} fill={PITCH.chalk} /></Snapshot>
          <ThoughtBubble x={1250} y={330} w={300} h={190} hx={1500} hy={560} at={30}><UnknownFog w={250} h={140} /></ThoughtBubble>
          <TimeBubble x={1500} y={745} seconds={0.6} squash={0.35} pxPerSecond={140} />
        </g>
      </g>
    </Stage>
  );
};
