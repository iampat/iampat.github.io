// Camera: slow push-ins and pans across one big scene. Never snaps (easeInOutSine).
// Usage: <Camera keys={[{ f: 0, x: 960, y: 540, zoom: 1 }, { f: 150, x: 1100, y: 600, zoom: 1.08 }]}>...</Camera>
// (x, y) is the world point that sits at the centre of the frame.

import React from "react";
import { useCurrentFrame } from "remotion";
import { EASE, keys } from "../lib/anim";
import { HEIGHT, WIDTH } from "../theme";

export type CamKey = { f: number; x: number; y: number; zoom: number; rot?: number };

export const cameraAt = (frame: number, ks: CamKey[]) => {
  if (ks.length === 1) return ks[0];
  const fs = ks.map((k) => k.f);
  return {
    f: frame,
    x: keys(frame, fs, ks.map((k) => k.x), EASE.camera),
    y: keys(frame, fs, ks.map((k) => k.y), EASE.camera),
    zoom: keys(frame, fs, ks.map((k) => k.zoom), EASE.camera),
    rot: keys(frame, fs, ks.map((k) => k.rot ?? 0), EASE.camera),
  };
};

export const Camera: React.FC<{ keys: CamKey[]; children: React.ReactNode; frame?: number }> = ({ keys: ks, children, frame }) => {
  const current = useCurrentFrame();
  const c = cameraAt(frame ?? current, ks);
  return (
    <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) rotate(${c.rot ?? 0}) scale(${c.zoom}) translate(${-c.x} ${-c.y})`}>
      {children}
    </g>
  );
};

/** A parallax layer inside a Camera: depth 0 = moves with the camera target, 1 = fixed to the frame. */
export const Parallax: React.FC<{ keys: CamKey[]; depth: number; children: React.ReactNode }> = ({ keys: ks, depth, children }) => {
  const frame = useCurrentFrame();
  const c = cameraAt(frame, ks);
  const c0 = ks[0];
  const dx = (c.x - c0.x) * depth;
  const dy = (c.y - c0.y) * depth;
  return <g transform={`translate(${dx} ${dy})`}>{children}</g>;
};

/** Full-frame SVG stage. Everything in the video is drawn inside one of these. */
export const Stage: React.FC<{ bg: string; children: React.ReactNode }> = ({ bg, children }) => (
  <svg
    width={WIDTH}
    height={HEIGHT}
    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    style={{ position: "absolute", inset: 0, background: bg }}
  >
    {children}
  </svg>
);
