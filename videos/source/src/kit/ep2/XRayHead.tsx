// Top-down x-ray head for "seeing then choosing" (b05). A skull outline in XRAY.bone on the teal grid,
// eyes at the front that turn with the head (`turn`), a pulse of light that runs from the eyes to the back
// of the head (`pulse` 0..1), and two doors at the back labelled TURN and PASS that light up (`lit`).
// Put an <XRayGrid /> behind it. The head faces up the screen at turn 0 (change with `facing`).

import React from "react";
import { FONTS, PITCH, XRAY } from "../../theme";
import { clamp01 } from "../../lib/anim";
import { quad, segment } from "./chalk";

type Props = {
  x: number;
  y: number;
  /** Skull radius in pixels. Default 150. */
  size?: number;
  /** Head and eye turn in degrees (positive = clockwise on screen). */
  turn?: number;
  /** 0..1: a pulse of light travels from the eyes to the back of the head. */
  pulse?: number;
  /** Door labels at the back of the head; null hides the doors. */
  doors?: [string, string] | null;
  /** Brightness 0..1 of each door. */
  lit?: [number, number];
  /** Direction the head faces at turn 0, degrees (SVG rotation). Default -90 = up the screen. */
  facing?: number;
  opacity?: number;
};

export const XRayHead: React.FC<Props> = ({ x, y, size = 150, turn = 0, pulse = 0, doors = ["TURN", "PASS"], lit = [0, 0], facing = -90, opacity = 1 }) => {
  const R = size;
  const w = R * 0.05;
  const eyeY = -R * 0.66;
  const eyeX = R * 0.36;
  const back: [number, number] = [0, R * 0.52];
  const eyeL: [number, number] = [-eyeX, eyeY];
  const eyeR: [number, number] = [eyeX, eyeY];
  const ctrlL: [number, number] = [-R * 0.3, -R * 0.05];
  const ctrlR: [number, number] = [R * 0.3, -R * 0.05];
  const p = clamp01(pulse);
  const tail = 0.28;
  const flash = clamp01((p - 0.85) / 0.15);
  const dotL = quad(eyeL, ctrlL, back, p);
  const dotR = quad(eyeR, ctrlR, back, p);
  const pupilShift = Math.max(-1, Math.min(1, turn / 60)) * R * 0.05;
  const doorPos: [number, number][] = [
    [-R * 0.3, R * 0.36],
    [R * 0.3, R * 0.36],
  ];
  const doorW = R * 0.26;
  const doorH = R * 0.32;
  const labelSize = Math.max(32, R * 0.22);
  const labelY = doorPos[0][1] + labelSize * 0.35;
  const turnRad = (turn * Math.PI) / 180;
  const rot = (pt: [number, number]): [number, number] => [pt[0] * Math.cos(turnRad) - pt[1] * Math.sin(turnRad), pt[0] * Math.sin(turnRad) + pt[1] * Math.cos(turnRad)];
  const doorColor = (l: number) => (l > 0.5 ? XRAY.lime : XRAY.bone);
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing + 90})`} opacity={opacity}>
      {/* Shoulders behind the head (they do not turn with it). */}
      <rect x={-R * 1.4} y={R * 0.5} width={R * 2.8} height={R * 0.8} rx={R * 0.4} fill={XRAY.tissue} opacity={0.14} />
      <rect x={-R * 1.4} y={R * 0.5} width={R * 2.8} height={R * 0.8} rx={R * 0.4} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.5} opacity={0.35} />
      <g transform={`rotate(${turn})`}>
        {/* Soft tissue and the skull outline. */}
        <circle r={R} fill={XRAY.tissue} opacity={0.16} />
        <circle r={R} fill="none" stroke={XRAY.bone} strokeWidth={w} />
        {/* Nose bump at the front. */}
        <path d={`M${-R * 0.15},${-R * 0.99} Q0,${-R * 1.16} ${R * 0.15},${-R * 0.99}`} fill="none" stroke={XRAY.bone} strokeWidth={w} strokeLinecap="round" />
        {/* Ears. */}
        <path d={`M${-R * 0.98},${-R * 0.18} Q${-R * 1.16},0 ${-R * 0.98},${R * 0.18}`} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.8} strokeLinecap="round" />
        <path d={`M${R * 0.98},${-R * 0.18} Q${R * 1.16},0 ${R * 0.98},${R * 0.18}`} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.8} strokeLinecap="round" />
        {/* Brain: two lobes, a midline and a few folds. */}
        <ellipse cy={R * 0.12} rx={R * 0.62} ry={R * 0.6} fill={XRAY.tissue} opacity={0.22} />
        <ellipse cy={R * 0.12} rx={R * 0.62} ry={R * 0.6} fill="none" stroke={XRAY.tissue} strokeWidth={w * 0.7} />
        <path d={`M0,${-R * 0.46} Q${R * 0.06},${-R * 0.1} 0,${R * 0.12} Q${-R * 0.06},${R * 0.4} 0,${R * 0.7}`} fill="none" stroke={XRAY.tissue} strokeWidth={w * 0.6} strokeLinecap="round" />
        {[-1, 1].map((s) => (
          <g key={s}>
            <path d={`M${s * R * 0.14},${-R * 0.3} Q${s * R * 0.34},${-R * 0.36} ${s * R * 0.42},${-R * 0.12}`} fill="none" stroke={XRAY.tissue} strokeWidth={w * 0.5} strokeLinecap="round" />
            <path d={`M${s * R * 0.12},${R * 0.02} Q${s * R * 0.36},${R * 0.0} ${s * R * 0.5},${R * 0.22}`} fill="none" stroke={XRAY.tissue} strokeWidth={w * 0.5} strokeLinecap="round" />
          </g>
        ))}
        {/* Eyes: sockets, pupils and two dim gaze lines that show where the eyes look. */}
        {[eyeL, eyeR].map((e, i) => (
          <g key={i}>
            <line x1={e[0]} y1={e[1] - R * 0.1} x2={e[0] + pupilShift * 2} y2={-R * 1.55} stroke={PITCH.light} strokeWidth={w * 0.5} strokeLinecap="round" strokeDasharray={`${w * 0.8} ${w * 1.6}`} opacity={0.5} />
            <ellipse cx={e[0]} cy={e[1]} rx={R * 0.17} ry={R * 0.11} fill={XRAY.bg} stroke={XRAY.bone} strokeWidth={w * 0.8} />
            <circle cx={e[0] + pupilShift} cy={e[1] - R * 0.01} r={R * 0.055} fill={XRAY.bone} />
          </g>
        ))}
        {/* Optic paths from each eye to the back of the head, and the travelling pulse on them. */}
        {[
          { e: eyeL, c: ctrlL, d: dotL },
          { e: eyeR, c: ctrlR, d: dotR },
        ].map(({ e, c, d }, i) => {
          const path = `M${e[0]},${e[1]} Q${c[0]},${c[1]} ${back[0]},${back[1]}`;
          return (
            <g key={i}>
              <path d={path} fill="none" stroke={XRAY.bone} strokeWidth={w * 0.35} strokeDasharray={`${w * 0.6} ${w * 1.4}`} opacity={0.3} />
              {p > 0.001 ? (
                <g>
                  <path d={path} fill="none" stroke={PITCH.light} strokeWidth={w * 1.1} strokeLinecap="round" opacity={0.85} {...segment(p - tail, p)} />
                  <path d={path} fill="none" stroke={PITCH.light} strokeWidth={w * 2.4} strokeLinecap="round" opacity={0.2} {...segment(p - tail, p)} />
                  <circle cx={d[0]} cy={d[1]} r={w * 2.2} fill={PITCH.light} opacity={0.25} />
                  <circle cx={d[0]} cy={d[1]} r={w * 1.3} fill={PITCH.light} opacity={0.6} />
                  <circle cx={d[0]} cy={d[1]} r={w * 0.7} fill={PITCH.lightSoft} />
                </g>
              ) : null}
            </g>
          );
        })}
        {/* Arrival flash at the back of the head. */}
        {flash > 0 ? (
          <g opacity={flash}>
            <circle cx={back[0]} cy={back[1]} r={R * 0.26} fill={PITCH.light} opacity={0.18} />
            <circle cx={back[0]} cy={back[1]} r={R * 0.14} fill={PITCH.light} opacity={0.35} />
          </g>
        ) : null}
        {/* Doors. */}
        {doors
          ? doorPos.map(([dx, dy], i) => {
              const l = clamp01(lit[i] ?? 0);
              const c = doorColor(l);
              const top = dy - doorH / 2;
              const d = `M${dx - doorW / 2},${dy + doorH / 2} L${dx - doorW / 2},${top + doorW / 2} A${doorW / 2},${doorW / 2} 0 0 1 ${dx + doorW / 2},${top + doorW / 2} L${dx + doorW / 2},${dy + doorH / 2} Z`;
              return (
                <g key={i}>
                  {l > 0.01 ? (
                    <g>
                      <circle cx={dx} cy={dy} r={doorH * 1.05} fill={XRAY.lime} opacity={0.12 * l} />
                      <circle cx={dx} cy={dy} r={doorH * 0.7} fill={XRAY.lime} opacity={0.18 * l} />
                    </g>
                  ) : null}
                  <path d={d} fill={XRAY.lime} opacity={0.85 * l} />
                  <path d={d} fill={l > 0.01 ? "none" : XRAY.bg} fillOpacity={0.5} stroke={c} strokeWidth={w * 0.7} strokeLinejoin="round" />
                  <circle cx={dx + doorW * 0.22} cy={dy + doorH * 0.08} r={w * 0.45} fill={l > 0.5 ? XRAY.bg : c} />
                </g>
              );
            })
          : null}
      </g>
      {/* Door labels stay upright beside the head, with a thin leader to each (rotated) door. */}
      {doors
        ? doors.map((label, i) => {
            const l = clamp01(lit[i] ?? 0);
            const side = i === 0 ? -1 : 1;
            const dp = rot([doorPos[i][0] + (side * doorW) / 2, doorPos[i][1]]);
            const lw = label.length * labelSize * 0.66;
            const edge = side * (R * 1.2);
            return (
              <g key={i}>
                <line x1={dp[0]} y1={dp[1]} x2={edge} y2={labelY - labelSize * 0.35} stroke={doorColor(l)} strokeWidth={w * 0.3} strokeLinecap="round" opacity={0.35} />
                <text x={edge + side * (lw / 2 + labelSize * 0.3)} y={labelY} fill={doorColor(l)} fontFamily={FONTS.hud} fontWeight={700} fontSize={labelSize} textAnchor="middle" letterSpacing={3} opacity={0.6 + 0.4 * l}>
                  {label}
                </text>
              </g>
            );
          })
        : null}
    </g>
  );
};
