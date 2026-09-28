// Sound effects placed at exact frames inside a scene.
import React from "react";
import { Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";

export type SfxName =
  | "thump" | "pop" | "pop-soft" | "tick" | "whoosh" | "whoosh-long" | "net" | "clang"
  | "light-on" | "light-off" | "chalk" | "stamp" | "blip" | "subdrop" | "bell" | "air" | "alarm";

export const Sfx: React.FC<{ name: SfxName; at: number; volume?: number; dur?: number }> = ({ name, at, volume = 0.5, dur = 90 }) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={dur} layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);
