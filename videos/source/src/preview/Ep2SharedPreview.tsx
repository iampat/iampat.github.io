// Episode 2 shared-kit preview: all six ep2 pieces at a readable size, in a 3 x 2 grid. Not in the video.
// Frame 15 shows the draw-ons under way, frame 60 shows them near done.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Stage } from "../kit/Camera";
import { TopField } from "../kit/Field";
import { TopPlayer, angleTo } from "../kit/TopPlayer";
import { TimeBubble } from "../kit/TimeBubble";
import { XRayGrid } from "../kit/XRay";
import { Ball } from "../kit/Ball";
import { ChalkSketch, SecondsRuler, SpeedDiffMeter, SplitCompare, TwoPartStopwatch, XRayHead, type SketchKind } from "../kit/ep2";
import { FONTS, PITCH, XRAY } from "../theme";
import { clamp01 } from "../lib/anim";
import type { View } from "../lib/project";

const PW = 640;
const PH = 540;

const Panel: React.FC<{ col: number; row: number; bg: string; title: string; children: React.ReactNode }> = ({ col, row, bg, title, children }) => {
  const x = col * PW;
  const y = row * PH;
  const id = `p${col}${row}`;
  return (
    <g>
      <clipPath id={id}>
        <rect x={x} y={y} width={PW} height={PH} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect x={x} y={y} width={PW} height={PH} fill={bg} />
        <g transform={`translate(${x} ${y})`}>{children}</g>
        <text x={x + 24} y={y + 44} fill={PITCH.chalk} opacity={0.55} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} letterSpacing={2}>
          {title}
        </text>
      </g>
      <rect x={x} y={y} width={PW} height={PH} fill="none" stroke={PITCH.skyHigh} strokeWidth={4} />
    </g>
  );
};

/** A small map: grass, Tavi, Chalk and a bubble, in panel-local coordinates (w x h). */
const MiniMap: React.FC<{ w: number; h: number; chalkDist: number; away: boolean }> = ({ w, h, chalkDist, away }) => {
  const ppm = 22;
  const view: View = { kind: "top", originX: w / 2 - (away ? 1.2 : 0) * ppm, originY: h * 0.58, ppm };
  const tavi = { x: w / 2 + (away ? -1.2 * ppm : 0), y: h * 0.58 - (away ? 1.6 * ppm : 0) };
  const chalk = { x: w / 2 + Math.cos(-0.3) * chalkDist * ppm, y: h * 0.58 - Math.sin(-0.3) * chalkDist * ppm };
  return (
    <g>
      <TopField view={view} x0={-16} x1={16} y0={-14} y1={14} lines={false} />
      <TimeBubble x={tavi.x} y={tavi.y} seconds={chalkDist / 4} pxPerSecond={110} fontSize={34} />
      <TopPlayer x={chalk.x} y={chalk.y} kind="chalk" facing={angleTo(chalk.x, chalk.y, tavi.x, tavi.y)} size={44} stride={0.3} />
      <TopPlayer x={tavi.x} y={tavi.y} kind="tavi" facing={-90} size={44} />
      <Ball cx={tavi.x + (away ? 14 : 4)} cy={tavi.y + 18} r={9} view={view} />
    </g>
  );
};

export const Ep2SharedPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = clamp01((frame - 5) / 60);
  const sketchP = clamp01((frame - 8) / 55);
  const late = frame < 45;
  const kinds: { kind: SketchKind; label: string; mode?: "stiff" | "giving" | "late" | "early" | "topple" }[] = [
    { kind: "coins", label: "coins" },
    { kind: "kerb", label: late ? "kerb (late)" : "kerb (early)", mode: late ? "late" : "early" },
    { kind: "egg", label: late ? "egg (stiff)" : "egg (giving)", mode: late ? "stiff" : "giving" },
    { kind: "jars", label: "jars" },
    { kind: "train", label: "train" },
    { kind: "row", label: late ? "row (rings)" : "row (topple)", mode: late ? undefined : "topple" },
  ];
  const ruleDir: [number, number] = [1, -0.22];
  return (
    <Stage bg={PITCH.skyHigh}>
      <Panel col={0} row={0} bg={PITCH.sky} title="TwoPartStopwatch">
        <TwoPartStopwatch x={320} y={300} r={108} notice={0.3} choose={0.5} progress={clamp01((frame - 5) / 70)} caption="ages 10 to 18, computer tests" />
      </Panel>
      <Panel col={1} row={0} bg={XRAY.bg} title="XRayHead">
        <XRayGrid step={60} />
        <XRayHead x={320} y={262} size={132} turn={Math.sin(frame / 14) * 28} pulse={clamp01((frame - 10) / 40)} lit={[0, clamp01((frame - 52) / 8)]} />
      </Panel>
      <Panel col={2} row={0} bg={PITCH.sky} title="SpeedDiffMeter">
        <SpeedDiffMeter x={150} y={130} width={440} ballSpeed={4.8} footSpeed={4.0 * clamp01((frame - 20) / 40)} scale={82} />
        <SpeedDiffMeter x={150} y={400} width={440} ballSpeed={4.8} footSpeed={1.68} scale={82} stacked />
      </Panel>
      <Panel col={0} row={1} bg={PITCH.grass} title="SecondsRuler">
        <TopField view={{ kind: "top", originX: 0, originY: 270, ppm: 32 }} x0={-1} x1={22} y0={-9} y1={9} lines={false} />
        <SecondsRuler from={[70, 400]} dir={ruleDir} pxPerMetre={118} metres={4} progress={draw} steps highlight={2} />
      </Panel>
      <Panel col={1} row={1} bg={PITCH.sky} title="SplitCompare">
        <SplitCompare
          width={PW}
          height={PH}
          gutter={36}
          labels={["DEAD STOP", "TOUCH AWAY"]}
          dividerLabel="2"
          freezeAt={[undefined, 30]}
          progress={draw}
          left={<MiniMap w={266} h={468} chalkDist={0.9} away={false} />}
          right={<MiniMap w={266} h={468} chalkDist={2.6} away />}
        />
      </Panel>
      <Panel col={2} row={1} bg={PITCH.skyHigh} title="ChalkSketch">
        {kinds.map((k, i) => {
          const cx = 110 + (i % 3) * 210;
          const cy = 170 + Math.floor(i / 3) * 235;
          return (
            <g key={k.kind}>
              <ChalkSketch kind={k.kind} mode={k.mode} progress={sketchP} size={196} x={cx} y={cy} />
              <text x={cx} y={cy + 110} fill={PITCH.chalk} opacity={0.6} fontFamily={FONTS.hud} fontWeight={700} fontSize={32} textAnchor="middle">
                {k.label}
              </text>
            </g>
          );
        })}
      </Panel>
    </Stage>
  );
};
