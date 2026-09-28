// A static background plate (Nano Banana) drawn inside the SVG, so camera moves apply to it.
// Waits for the image to load before the frame is captured.
import React, { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { HEIGHT, WIDTH } from "../theme";

export const Plate: React.FC<{ name: string; opacity?: number }> = ({ name, opacity = 1 }) => {
  const src = staticFile(`plates/${name}.jpg`);
  const [handle] = useState(() => delayRender(`plate ${name}`));
  useEffect(() => {
    const img = new Image();
    img.onload = () => continueRender(handle);
    img.onerror = () => continueRender(handle);
    img.src = src;
  }, [src, handle]);
  return <image href={src} x={0} y={0} width={WIDTH} height={HEIGHT} preserveAspectRatio="xMidYMid slice" opacity={opacity} />;
};

/** Lamp-head centres in the stadium plate (1920x1080 space), for SVG light overlays. */
export const STADIUM_LAMPS = [
  { x: 222, y: 326 },
  { x: 713, y: 326 },
  { x: 1207, y: 326 },
  { x: 1697, y: 326 },
];
/** Ground line (far edge of the pitch) in the stadium plate. */
export const STADIUM_GROUND_Y = 835;
