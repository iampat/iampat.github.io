// The time bubble: the motif of episode 2. A ring around the player whose size and number
// show the seconds until the nearest defender reaches the ball: distance / closing speed.
// Colour runs from pink (almost no time) to lime (plenty).

import React from "react";
import { useCurrentFrame } from "remotion";
import { CAST, FONTS, PITCH, XRAY } from "../theme";
import { pop } from "../lib/anim";

/** Chalk's closing speed all episode: a jog-to-run, so "every two metres is about half a second". */
export const CLOSING_SPEED = 4;

/** Seconds until a defender `distanceM` away arrives, closing at `speedMps` (default CLOSING_SPEED). */
export const secondsToReach = (distanceM: number, speedMps: number = CLOSING_SPEED) => (speedMps > 0.01 ? distanceM / speedMps : 99);

const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};

/** Ring colour for a number of seconds: pink under 0.5 s, amber around 1 s, lime from 2 s. */
export const bubbleColor = (seconds: number) => {
  if (seconds <= 0.5) return CAST.mistake;
  if (seconds <= 1.2) return mix(CAST.mistake, PITCH.light, (seconds - 0.5) / 0.7);
  if (seconds <= 2.2) return mix(PITCH.light, XRAY.lime, (seconds - 1.2) / 1.0);
  return XRAY.lime;
};

type Props = {
  x: number;
  y: number;
  seconds: number;
  /** Ring radius per second of time, in pixels. */
  pxPerSecond?: number;
  minRadius?: number;
  maxRadius?: number;
  at?: number;
  until?: number;
  showNumber?: boolean;
  fontSize?: number;
  /** Flatten the ring for a side view (0..1, 1 = circle). */
  squash?: number;
  /** Alarm pulse when time is short. */
  alarm?: boolean;
  /** Where the seconds readout sits: above the ring (default), below it, or at the centre. */
  labelPos?: "above" | "below" | "centre";
};

export const TimeBubble: React.FC<Props> = ({
  x,
  y,
  seconds,
  pxPerSecond = 70,
  minRadius = 34,
  maxRadius = 260,
  at = 0,
  until,
  showNumber = true,
  fontSize = 40,
  squash = 1,
  alarm,
  labelPos = "above",
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 140, damping: 15 }) * (until === undefined ? 1 : Math.max(0, 1 - Math.max(0, frame - until) / 8));
  if (s <= 0.001) return null;
  const r = Math.min(maxRadius, Math.max(minRadius, seconds * pxPerSecond));
  const color = bubbleColor(seconds);
  const pulse = (alarm ?? seconds < 0.7) ? 0.75 + 0.25 * Math.sin(frame / 2.2) : 1;
  const text = seconds >= 10 ? "∞" : `${seconds.toFixed(1)} s`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g transform={`scale(1 ${squash})`}>
        <circle r={r} fill={color} opacity={0.1 * pulse} />
        <circle r={r} fill="none" stroke={color} strokeWidth={5} opacity={0.9 * pulse} />
        <circle r={r * 0.985} fill="none" stroke={color} strokeWidth={2} strokeDasharray={`${r * 0.12} ${r * 0.08}`} opacity={0.5} />
      </g>
      {showNumber ? (
        <g transform={`translate(0 ${labelPos === "above" ? -r * squash - fontSize * 0.6 : labelPos === "below" ? r * squash + fontSize * 0.9 : 0})`}>
          <rect x={-fontSize * 1.7} y={-fontSize * 0.75} width={fontSize * 3.4} height={fontSize * 1.3} rx={fontSize * 0.65} fill={PITCH.sky} opacity={0.85} />
          <text y={fontSize * 0.33} fill={color} fontFamily={FONTS.mono} fontWeight={500} fontSize={fontSize} textAnchor="middle">
            {text}
          </text>
        </g>
      ) : null}
    </g>
  );
};

/** A horizontal time bar: how many seconds you have, filling left to right. */
export const TimeBar: React.FC<{ x: number; y: number; width: number; seconds: number; maxSeconds?: number; label?: string; at?: number }> = ({
  x,
  y,
  width,
  seconds,
  maxSeconds = 3,
  label,
  at = 0,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, { stiffness: 160, damping: 16 });
  if (s <= 0.001) return null;
  const f = Math.min(1, seconds / maxSeconds);
  const color = bubbleColor(seconds);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={s}>
      {label ? (
        <text x={0} y={-16} fill={PITCH.chalk} fontFamily={FONTS.hud} fontWeight={700} fontSize={26} letterSpacing={3}>
          {label.toUpperCase()}
        </text>
      ) : null}
      <rect x={0} y={0} width={width} height={22} rx={11} fill={PITCH.chalk} opacity={0.2} />
      <rect x={0} y={0} width={width * f} height={22} rx={11} fill={color} />
      <text x={width + 16} y={19} fill={color} fontFamily={FONTS.mono} fontWeight={500} fontSize={28}>
        {seconds.toFixed(1)} s
      </text>
    </g>
  );
};
