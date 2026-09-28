// Small chalk-line sketches for the metaphors, drawn on trim-path style with `progress` 0..1.
// Chalk white strokes on whatever is behind, round caps, 7 px at size 320, no fills except chalk-dust dots
// and a few accent dots (marbles, headlights). Each sketch is designed in a 320 x 224 box centred on (0,0)
// and scaled by `size` / 320.
//
// kinds: coins (coins with clock faces drop into a saucer), kerb (a kid at a kerb, a car; mode 'late' looks
// after stepping off, 'early' looks first), egg (a hand catching an egg; 'stiff' splats, 'giving' is safe),
// jars (two jars of seconds: one marble vs three), train (a ball-train rolls through a two-foot station),
// row (a row of rings growing left to right; mode 'topple': ten small defenders, four topple into dust).

import React from "react";
import { PITCH, XRAY } from "../../theme";
import { clamp01 } from "../../lib/anim";
import { popT, sequence, trim } from "./chalk";

export type SketchKind = "coins" | "kerb" | "egg" | "jars" | "train" | "row";
export type SketchMode = "stiff" | "giving" | "late" | "early" | "topple";

type Props = {
  kind: SketchKind;
  progress: number;
  mode?: SketchMode;
  /** Box width in pixels (height is 0.7 of it). Default 320. */
  size?: number;
  x?: number;
  y?: number;
  color?: string;
  /** Colour of the filled accent dots (marbles, headlights). Default XRAY.lime. */
  accent?: string;
  opacity?: number;
};

const W = 7;

/** One chalk stroke drawn to t. */
const S: React.FC<{ d: string; t: number; w?: number; color: string; o?: number }> = ({ d, t, w = W, color, o = 0.95 }) =>
  t <= 0.002 ? null : <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} {...trim(t)} />;

/** Chalk-dust dots that pop in at t. */
const Dots: React.FC<{ pts: [number, number, number][]; t: number; color: string; o?: number }> = ({ pts, t, color, o = 0.55 }) => {
  const s = popT(t);
  if (s <= 0.001) return null;
  return (
    <g>
      {pts.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r * s} fill={color} opacity={o} />
      ))}
    </g>
  );
};

const circle = (cx: number, cy: number, r: number) => `M${cx - r},${cy} A${r},${r} 0 1 1 ${cx + r},${cy} A${r},${r} 0 1 1 ${cx - r},${cy}`;
const egg = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx},${cy} A${rx},${ry * 1.15} 0 0 1 ${cx + rx},${cy} A${rx},${ry * 0.85} 0 0 1 ${cx - rx},${cy}`;

const Coins: React.FC<{ p: number; c: string }> = ({ p, c }) => {
  const [saucer, ...rest] = sequence(p, [2, 1.4, 0.6, 1.4, 0.6, 1.4, 0.6]);
  const coins: [number, number][] = [
    [-66, 26],
    [0, 8],
    [66, 26],
  ];
  return (
    <g>
      <S d="M-100,64 A100,26 0 1 0 100,64 A100,26 0 1 0 -100,64" t={saucer} color={c} />
      <S d="M-64,60 A64,14 0 1 0 64,60" t={saucer} w={W * 0.7} color={c} o={0.6} />
      {coins.map(([cx, cy], i) => {
        const face = rest[i * 2];
        const hands = rest[i * 2 + 1];
        const drop = (1 - popT(face)) * -60;
        return (
          <g key={i} transform={`translate(0 ${drop})`}>
            <S d={circle(cx, cy, 29)} t={face} color={c} />
            <S d={`M${cx},${cy} L${cx},${cy - 17}`} t={hands} color={c} />
            <S d={`M${cx},${cy} L${cx + 12},${cy + 2}`} t={hands} color={c} />
            <Dots
              pts={[
                [cx - 34, 58, 3],
                [cx + 36, 56, 2.5],
                [cx - 20, 66, 2],
                [cx + 22, 68, 2.5],
              ]}
              t={hands}
              color={c}
            />
          </g>
        );
      })}
    </g>
  );
};

const Kerb: React.FC<{ p: number; c: string; late: boolean; accent: string }> = ({ p, c, late, accent }) => {
  const kx = late ? -14 : -100;
  const fy = late ? 60 : 24;
  const hy = fy - 84;
  const seq = late ? sequence(p, [2, 3, 3, 1, 1, 0.6]) : sequence(p, [2, 3, 1, 3, 1, 0.6]);
  const [kerb, kid] = seq;
  const car = late ? seq[2] : seq[3];
  const beams = late ? seq[3] : seq[4];
  const look = late ? seq[4] : seq[2];
  const bang = seq[5];
  const carShift = late ? 0 : -popT(car) * 0 - clamp01((p - 0.8) / 0.2) * 120;
  const beamTo: [number, number] = late ? [kx + 14, fy - 40] : [-30, 50];
  return (
    <g>
      {/* Pavement, kerb step and road. */}
      <S d="M-160,24 L-52,24 L-52,60 L160,60" t={kerb} color={c} />
      {/* The kid. */}
      <S d={circle(kx, hy, 13)} t={kid} color={c} />
      <S d={`M${kx},${hy + 13} L${kx},${fy - 30}`} t={kid} color={c} />
      <S d={`M${kx},${fy - 30} L${kx - 13},${fy}`} t={kid} color={c} />
      <S d={`M${kx},${fy - 30} L${kx + 13},${fy}`} t={kid} color={c} />
      <S d={`M${kx},${fy - 60} L${kx - 16},${fy - 40}`} t={kid} color={c} />
      <S d={`M${kx},${fy - 60} L${kx + 16},${fy - 40}`} t={kid} color={c} />
      {/* The car, front to the left. */}
      <g transform={`translate(${carShift} 0)`}>
        <S d="M158,52 L158,30 Q158,18 146,18 L122,18 L108,0 L84,0 Q74,0 74,10 L74,18 L62,24 L56,36 L56,52" t={car} color={c} />
        <S d={circle(74, 54, 8)} t={car} color={c} />
        <S d={circle(140, 54, 8)} t={car} color={c} />
        {popT(beams) > 0.01 ? <circle cx={57} cy={30} r={4.5 * popT(beams)} fill={accent} /> : null}
        <S d={`M54,28 L${beamTo[0]},${beamTo[1] - 16}`} t={beams} w={W * 0.55} color={c} o={0.55} />
        <S d={`M54,34 L${beamTo[0]},${beamTo[1] + 10}`} t={beams} w={W * 0.55} color={c} o={0.55} />
      </g>
      {/* Head turn: a small arc arrow over the head. */}
      <S d={`M${kx - 2},${hy - 30} A24,24 0 0 1 ${kx + 24},${hy - 8}`} t={look} color={c} />
      <S d={`M${kx + 12},${hy - 10} L${kx + 25},${hy - 7} L${kx + 22},${hy - 21}`} t={clamp01(look * 1.4 - 0.4)} color={c} />
      {late ? (
        <g>
          <S d={`M${kx + 42},${hy - 34} L${kx + 42},${hy - 12}`} t={bang} color={c} />
          <Dots pts={[[kx + 42, hy - 1, 4]]} t={bang} color={c} o={0.95} />
        </g>
      ) : (
        <Dots
          pts={[
            [kx + 34, hy - 30, 3],
            [kx + 44, hy - 22, 2.5],
            [kx + 40, hy - 40, 2],
          ]}
          t={bang}
          color={c}
        />
      )}
    </g>
  );
};

const Egg: React.FC<{ p: number; c: string; giving: boolean }> = ({ p, c, giving }) => {
  const [arm, palm, thumb, shell, act, dust] = sequence(p, [1, 1.5, 0.5, 2, 1.2, 0.8]);
  const drop = giving ? 26 : 0;
  const eggY = giving ? 56 : 2;
  return (
    <g>
      <g transform={`translate(0 ${drop})`}>
        <S d="M-160,34 L-84,34" t={arm} color={c} />
        {giving ? <S d="M-84,34 Q-30,90 30,30" t={palm} color={c} /> : <S d="M-84,34 L34,34" t={palm} color={c} />}
        {giving ? <S d="M-76,32 L-62,12" t={thumb} color={c} /> : <S d="M-66,34 L-50,18" t={thumb} color={c} />}
      </g>
      <S d={egg(-25, eggY, 25, 32)} t={shell} color={c} />
      {giving ? (
        <g>
          {/* Motion arrow: the hand goes down with the egg. */}
          <S d="M84,-40 L84,50" t={act} color={c} />
          <S d="M68,34 L84,52 L100,34" t={clamp01(act * 1.5 - 0.5)} color={c} />
          <Dots
            pts={[
              [-58, -30, 3],
              [8, -36, 2.5],
              [-26, -48, 2],
            ]}
            t={dust}
            color={c}
          />
        </g>
      ) : (
        <g>
          {/* Crack, drips and splat. */}
          <S d="M-46,-4 L-38,8 L-28,-8 L-18,8 L-8,-2" t={act} color={c} />
          <S d="M-46,36 L-46,60" t={dust} w={W * 0.8} color={c} />
          <S d="M-2,36 L-2,52" t={dust} w={W * 0.8} color={c} />
          <Dots
            pts={[
              [-72, 42, 4],
              [-60, 50, 3],
              [4, 44, 3.5],
              [18, 40, 2.5],
              [-30, 46, 3],
              [26, 52, 2],
              [-84, 44, 2.5],
            ]}
            t={dust}
            color={c}
            o={0.8}
          />
        </g>
      )}
    </g>
  );
};

const jar = (jx: number) =>
  `M${jx - 30},-74 L${jx + 30},-74 L${jx + 30},-58 L${jx + 34},-58 Q${jx + 46},-58 ${jx + 46},-46 L${jx + 46},76 Q${jx + 46},88 ${jx + 34},88 L${jx - 34},88 Q${jx - 46},88 ${jx - 46},76 L${jx - 46},-46 Q${jx - 46},-58 ${jx - 34},-58 L${jx - 30},-58 Z`;

const Jars: React.FC<{ p: number; c: string; accent: string }> = ({ p, c, accent }) => {
  const [jl, jr, m1, m2, m3, m4] = sequence(p, [3, 3, 0.7, 0.7, 0.7, 0.7]);
  const marble = (x: number, y: number, t: number, k: number) => {
    const s = popT(t);
    return s > 0.001 ? <circle key={k} cx={x} cy={y - (1 - s) * 50} r={12 * Math.min(1, s)} fill={accent} opacity={0.95} /> : null;
  };
  return (
    <g>
      <S d={jar(-78)} t={jl} color={c} />
      <S d={jar(78)} t={jr} color={c} />
      <S d="M-100,-50 L-100,60" t={jl} w={W * 0.5} color={c} o={0.35} />
      <S d="M56,-50 L56,60" t={jr} w={W * 0.5} color={c} o={0.35} />
      {marble(-78, 72, m1, 0)}
      {marble(58, 72, m2, 1)}
      {marble(98, 72, m3, 2)}
      {marble(78, 50, m4, 3)}
    </g>
  );
};

/** A top-down foot: a sole with a round heel, a wider ball, and three toe dots in front. */
const foot = (cx: number, cy: number) => {
  const toe = (tx: number, ty: number, r: number) => `M${tx - r},${ty} A${r},${r} 0 1 1 ${tx + r},${ty} A${r},${r} 0 1 1 ${tx - r},${ty}`;
  return (
    `M${cx - 34},${cy} A11,11 0 0 1 ${cx - 23},${cy - 11} L${cx + 4},${cy - 13} A15,13 0 0 1 ${cx + 19},${cy} A15,13 0 0 1 ${cx + 4},${cy + 13} L${cx - 23},${cy + 11} A11,11 0 0 1 ${cx - 34},${cy} ` +
    toe(cx + 30, cy - 9, 4) +
    toe(cx + 33, cy + 1, 4.5) +
    toe(cx + 29, cy + 11, 3.5)
  );
};

const Train: React.FC<{ p: number; c: string }> = ({ p, c }) => {
  const [rail, ties, fa, fb, body, move] = sequence(p, [2, 1, 2, 2, 1.5, 5]);
  const x0 = -136;
  const tx = x0 + popT(0) * 0 + (136 - x0) * (move <= 0 ? 0 : move >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * move));
  const r = 22;
  const rollDeg = ((tx - x0) / r) * (180 / Math.PI);
  const cy = 44 - r - 3;
  return (
    <g>
      <S d="M-160,44 L160,44" t={rail} color={c} />
      {Array.from({ length: 13 }, (_, i) => (
        <S key={i} d={`M${-150 + i * 25},44 L${-150 + i * 25},54`} t={clamp01(ties * 13 - i)} w={W * 0.7} color={c} o={0.6} />
      ))}
      {/* Station platforms shaped like two feet: near foot above, far foot below the track. */}
      <S d={foot(-74, 12)} t={fa} color={c} />
      <S d={foot(74, 76)} t={fb} color={c} />
      {/* The train: the ball with its line, a chimney, and puffs when moving. */}
      <g transform={`translate(${tx} ${cy})`}>
        <g transform={`rotate(${rollDeg})`}>
          <S d={circle(0, 0, r)} t={body} color={c} />
          <S d={`M-13,-5 Q0,${9} 13,-5`} t={clamp01(body * 1.5 - 0.5)} color={c} />
        </g>
        <S d={`M4,${-r + 2} L4,${-r - 16} L16,${-r - 16} L16,${-r + 1}`} t={clamp01(body * 1.5 - 0.5)} color={c} />
        {move > 0.02 && move < 0.98
          ? [0, 1, 2, 3].map((k) => <circle key={k} cx={4 - k * 15 - (move * 40) % 15} cy={-r - 26 - k * 5} r={3.5 + k * 1.4} fill={c} opacity={0.5 - k * 0.1} />)
          : null}
      </g>
    </g>
  );
};

const Row: React.FC<{ p: number; c: string; topple: boolean }> = ({ p, c, topple }) => {
  if (!topple) {
    const n = 6;
    const seq = sequence(p, Array.from({ length: n }, () => 1));
    return (
      <g>
        <S d="M-150,60 L150,60" t={clamp01(p * 3)} w={W * 0.6} color={c} o={0.4} />
        {seq.map((t, i) => {
          const cx = -140 + i * 56;
          const r = 12 + i * 5.5;
          const s = popT(t);
          return (
            <g key={i}>
              <S d={circle(cx, 8, r)} t={t} color={c} />
              {s > 0.001 ? <circle cx={cx} cy={8} r={4.5 * s} fill={c} /> : null}
            </g>
          );
        })}
      </g>
    );
  }
  const n = 10;
  const drawT = clamp01(p / 0.7);
  const fallT = clamp01((p - 0.72) / 0.28);
  const seq = sequence(drawT, Array.from({ length: n }, () => 1));
  const fallers = new Set([1, 4, 6, 8]);
  return (
    <g>
      <S d="M-156,62 L156,62" t={clamp01(p * 3)} w={W * 0.6} color={c} o={0.4} />
      {seq.map((t, i) => {
        const x = -144 + i * 32;
        const falls = fallers.has(i);
        const ang = falls ? popT(fallT) * 74 : 0;
        return (
          <g key={i} transform={`translate(${x} 62) rotate(${ang}) translate(${-x} -62)`}>
            <S d={circle(x, 4, 8)} t={t} color={c} />
            <S d={`M${x},12 L${x},38`} t={t} color={c} />
            <S d={`M${x},38 L${x - 9},62`} t={t} color={c} />
            <S d={`M${x},38 L${x + 9},62`} t={t} color={c} />
            <S d={`M${x - 11},24 L${x + 11},20`} t={t} color={c} />
          </g>
        );
      })}
      {Array.from(fallers).map((i) => {
        const x = -144 + i * 32;
        return (
          <Dots
            key={i}
            pts={[
              [x + 18, 60, 3.5],
              [x + 30, 56, 2.5],
              [x + 26, 66, 2],
            ]}
            t={clamp01(fallT * 1.4 - 0.4)}
            color={c}
          />
        );
      })}
    </g>
  );
};

export const ChalkSketch: React.FC<Props> = ({ kind, progress, mode, size = 320, x = 0, y = 0, color = PITCH.chalk, accent = XRAY.lime, opacity = 1 }) => {
  const p = clamp01(progress);
  if (p <= 0.001) return null;
  const k = size / 320;
  let body: React.ReactNode;
  switch (kind) {
    case "coins":
      body = <Coins p={p} c={color} />;
      break;
    case "kerb":
      body = <Kerb p={p} c={color} late={mode !== "early"} accent={accent} />;
      break;
    case "egg":
      body = <Egg p={p} c={color} giving={mode === "giving"} />;
      break;
    case "jars":
      body = <Jars p={p} c={color} accent={accent} />;
      break;
    case "train":
      body = <Train p={p} c={color} />;
      break;
    case "row":
      body = <Row p={p} c={color} topple={mode === "topple"} />;
      break;
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} opacity={opacity}>
      {body}
    </g>
  );
};
