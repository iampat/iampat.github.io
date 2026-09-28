// Cast preview: Tavi in key poses and Chalk in key poses. Not part of the video.
import React from "react";
import { Stage } from "../kit/Camera";
import { Sky, GroundSide } from "../kit/World";
import { Player, POSES, solve, type PoseName } from "../kit/Player";
import { Keeper, KPOSES, type KeeperPoseName } from "../kit/Keeper";
import { Ball } from "../kit/Ball";
import { BACKGROUND, FONTS, PITCH } from "../theme";

const PLAYER_POSES: PoseName[] = ["stand", "plant", "strike", "follow", "volley", "chip", "crouch", "celebrate"];
const KEEPER_POSES: KeeperPoseName[] = ["stand", "wide", "diveR", "punchUp", "shrug", "tapHead"];

export const CastPreview: React.FC = () => {
  const groundY = 520;
  const keeperGround = 1010;
  const H = 300;
  return (
    <Stage bg={BACKGROUND["Floodlit Pitch"]}>
      <Sky />
      <GroundSide groundY={groundY} />
      {PLAYER_POSES.map((p, i) => {
        const x = 130 + i * 235;
        const j = solve(POSES[p], H);
        const dy = groundY - j.lowest - ((POSES[p] as { lift?: number }).lift ?? 0) * H;
        const laces = { x: x + (j.na.x + (j.nToe.x - j.na.x) * 0.45), y: dy + (j.na.y + (j.nToe.y - j.na.y) * 0.45) };
        return (
          <g key={p}>
            <Player x={x} groundY={groundY} h={H} pose={POSES[p]} face={p === "celebrate" ? "happy" : p === "strike" ? "focus" : "neutral"} />
            {p === "strike" || p === "volley" || p === "chip" ? (
              <Ball cx={laces.x + 18} cy={laces.y - 6} r={17} view={{ kind: "side", originX: 0, groundY, ppm: 60 }} />
            ) : null}
            <text x={x} y={groundY + 50} fill={PITCH.chalk} fontFamily={FONTS.label} fontSize={26} fontWeight={800} textAnchor="middle">{p}</text>
          </g>
        );
      })}
      {KEEPER_POSES.map((p, i) => {
        const x = 170 + i * 310;
        return (
          <g key={p}>
            <Keeper x={x} groundY={keeperGround - 50} h={300} pose={KPOSES[p]} face={p === "shrug" ? "smug" : p === "tapHead" ? "thinking" : p === "diveR" ? "surprised" : "flat"} />
            <text x={x} y={keeperGround} fill={PITCH.chalk} fontFamily={FONTS.label} fontSize={26} fontWeight={800} textAnchor="middle">{p}</text>
          </g>
        );
      })}
    </Stage>
  );
};
