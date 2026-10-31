// The Dots and Boxes board for episode 3: chalk dots on dark concrete, lines "handwritten" with a
// trim path, Tavi's boxes marked with a ring and Chalk's with a cross. Drives itself from a move list:
//   <DotsBoard x y size game={GAMES.g1} frame={frame} moveFrames={[f1, f2, ...]} />
// moveFrames[k] is the frame where move k (0-based) starts being drawn; a line takes `drawFrames`.
// Or pass `upTo` (moves completed) for a still. Everything is SVG, flat, round caps, no filters.

import React from "react";
import { PITCH, XRAY } from "../../theme";
import { clamp01, progress, EASE, pop } from "../../lib/anim";
import { trim } from "../ep2/chalk";
import { type Board, type Game, type Line, type LineId, boardAfter, emptyBoard, parseLine, allLines, isDrawn, boxesOf, sidesOf } from "./dots";

export const DOTS_COLORS = {
  dot: PITCH.chalk,
  tavi: PITCH.teal, // her lines and rings
  chalk: PITCH.chalk, // his lines and crosses
  safe: XRAY.lime,
  gift: "#FF4FA3",
  dim: "#6B7098",
};

export type Highlight = { lines?: LineId[]; boxes?: [number, number][]; color?: string; width?: number; opacity?: number; dashed?: boolean };

type Props = {
  x: number; // centre of the board on screen
  y: number;
  size: number; // width of the dot square (N cells)
  game?: Game;
  start?: Board; // board before the game's first move (g3 starts mid-game)
  frame?: number;
  moveFrames?: number[];
  drawFrames?: number; // frames per line (default 9)
  upTo?: number; // for stills: moves completed
  board?: Board; // or a plain board, no animation
  highlights?: Highlight[];
  /** Fade all lines and marks that are not highlighted. */
  dimOthers?: number;
  opacity?: number;
  colors?: Partial<typeof DOTS_COLORS>;
  /** Draw numbers on the boxes (chain lengths, counts). */
  boxText?: Record<string, string>;
  seed?: number;
  /** Mark styles: "ring" and "cross" (default), or "fill". */
  marks?: "ring-cross" | "fill";
};

/** Small deterministic wobble so chalk lines are not ruler-straight. */
const wob = (seed: number, k: number) => {
  const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
};

export const dotPos = (x: number, y: number, size: number, n: number, r: number, c: number) => {
  const cell = size / n;
  return { x: x - size / 2 + c * cell, y: y - size / 2 + r * cell };
};

/** A chalk line path between two dots with a gentle bow. */
export const linePath = (x: number, y: number, size: number, n: number, l: Line, seed: number) => {
  const a = l.kind === "h" ? dotPos(x, y, size, n, l.r, l.c) : dotPos(x, y, size, n, l.r, l.c);
  const b = l.kind === "h" ? dotPos(x, y, size, n, l.r, l.c + 1) : dotPos(x, y, size, n, l.r + 1, l.c);
  const k = (l.kind === "h" ? 0 : 100) + l.r * 10 + l.c;
  const bow = (size / n) * 0.05 * wob(seed, k);
  const mx = (a.x + b.x) / 2 + (l.kind === "h" ? 0 : bow);
  const my = (a.y + b.y) / 2 + (l.kind === "h" ? bow : 0);
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
};

export const boxCentre = (x: number, y: number, size: number, n: number, i: number, j: number) => {
  const cell = size / n;
  return { x: x - size / 2 + (j + 0.5) * cell, y: y - size / 2 + (i + 0.5) * cell };
};

const Ring: React.FC<{ cx: number; cy: number; r: number; t: number; color: string; w: number }> = ({ cx, cy, r, t, color, w }) =>
  t <= 0.01 ? null : (
    <path
      d={`M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
      {...trim(t)}
    />
  );
const Cross: React.FC<{ cx: number; cy: number; r: number; t: number; color: string; w: number }> = ({ cx, cy, r, t, color, w }) => {
  if (t <= 0.01) return null;
  const t1 = clamp01(t * 2);
  const t2 = clamp01(t * 2 - 1);
  return (
    <>
      <path d={`M ${cx - r} ${cy - r} L ${cx + r} ${cy + r}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" {...trim(t1)} />
      <path d={`M ${cx + r} ${cy - r} L ${cx - r} ${cy + r}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" {...trim(t2)} />
    </>
  );
};

export const DotsBoard: React.FC<Props> = ({
  x, y, size, game, start, frame = 0, moveFrames, drawFrames = 9, upTo, board, highlights = [], dimOthers = 0, opacity = 1, colors = {}, boxText = {}, seed = 1, marks = "ring-cross",
}) => {
  const C = { ...DOTS_COLORS, ...colors };
  const base = start ?? emptyBoard(3);
  const n = (board ?? base).n;
  const cell = size / n;
  const w = Math.max(3, size / 70);
  const dotR = Math.max(3, size / 48);

  // What is drawn at this frame: finished lines (with owner), the line in progress, and box marks with their pop time.
  type Drawn = { line: Line; owner: 0 | 1; t: number };
  const drawn: Drawn[] = [];
  const markAt = new Map<string, { owner: 0 | 1; f: number }>();
  let b: Board = board ?? base;
  if (board) {
    for (const l of allLines(n)) if (isDrawn(board, l)) drawn.push({ line: l, owner: (l.kind === "h" ? board.h[l.r][l.c] : board.v[l.r][l.c]) as 0 | 1, t: 1 });
    board.box.forEach((row, i) => row.forEach((o, j) => o !== null && markAt.set(`${i}${j}`, { owner: o, f: -1000 })));
  } else if (game) {
    // start lines (for g3) are drawn already
    for (const l of allLines(n)) if (isDrawn(base, l)) drawn.push({ line: l, owner: (l.kind === "h" ? base.h[l.r][l.c] : base.v[l.r][l.c]) as 0 | 1, t: 1 });
    base.box.forEach((row, i) => row.forEach((o, j) => o !== null && markAt.set(`${i}${j}`, { owner: o, f: -1000 })));
    const count = upTo !== undefined ? Math.min(upTo, game.moves.length) : game.moves.length;
    for (let k = 0; k < count; k++) {
      const m = game.moves[k];
      const f0 = moveFrames ? moveFrames[k] : -1000;
      const t = upTo !== undefined && !moveFrames ? 1 : progress(frame, f0, drawFrames, EASE.soft);
      if (t <= 0) break;
      drawn.push({ line: parseLine(m.line), owner: m.p, t });
      if (t >= 1) {
        const before = b;
        b = boardAfter(game, k + 1, base);
        for (const [i, j] of boxesOf(n, parseLine(m.line))) {
          if (before.box[i][j] === null && b.box[i][j] !== null) markAt.set(`${i}${j}`, { owner: m.p, f: f0 + drawFrames });
        }
      }
    }
  }

  const hlLines = new Map<string, Highlight>();
  const hlBoxes = new Map<string, Highlight>();
  for (const h of highlights) {
    for (const id of h.lines ?? []) hlLines.set(id, h);
    for (const [i, j] of h.boxes ?? []) hlBoxes.set(`${i}${j}`, h);
  }
  const dimK = 1 - clamp01(dimOthers) * 0.75;

  return (
    <g opacity={opacity}>
      {/* highlighted boxes: soft fill under everything */}
      {[...hlBoxes.entries()].map(([key, h]) => {
        const i = Number(key[0]);
        const j = Number(key[1]);
        const c = boxCentre(x, y, size, n, i, j);
        return <rect key={`hb${key}`} x={c.x - cell / 2 + w} y={c.y - cell / 2 + w} width={cell - 2 * w} height={cell - 2 * w} rx={cell * 0.12} fill={h.color ?? C.safe} opacity={(h.opacity ?? 0.22)} />;
      })}
      {/* ghost lines (highlighted but not drawn): dashed hints such as the safe lines */}
      {[...hlLines.entries()].map(([id, h]) => {
        const l = parseLine(id);
        if (drawn.some((d) => d.line.kind === l.kind && d.line.r === l.r && d.line.c === l.c)) return null;
        return (
          <path key={`gl${id}`} d={linePath(x, y, size, n, l, seed)} fill="none" stroke={h.color ?? C.safe} strokeWidth={h.width ?? w * 0.8} strokeLinecap="round" opacity={h.opacity ?? 0.8} strokeDasharray={h.dashed === false ? undefined : `${w * 1.6} ${w * 1.6}`} />
        );
      })}
      {/* drawn lines */}
      {drawn.map((d, k) => {
        const id = `${d.line.kind}${d.line.r}${d.line.c}`;
        const h = hlLines.get(id);
        const col = h?.color ?? (d.owner === 0 ? C.tavi : C.chalk);
        const o = (h ? 1 : dimK) * 0.95;
        return <path key={`l${k}`} d={linePath(x, y, size, n, d.line, seed)} fill="none" stroke={col} strokeWidth={h?.width ?? w} strokeLinecap="round" opacity={o} {...trim(d.t)} />;
      })}
      {/* dots on top of lines */}
      {Array.from({ length: n + 1 }, (_, r) =>
        Array.from({ length: n + 1 }, (_, c) => {
          const p = dotPos(x, y, size, n, r, c);
          return <circle key={`d${r}${c}`} cx={p.x + wob(seed, r * 7 + c) * 1.5} cy={p.y + wob(seed, r * 9 + c + 50) * 1.5} r={dotR} fill={C.dot} />;
        }),
      )}
      {/* box marks */}
      {[...markAt.entries()].map(([key, m]) => {
        const i = Number(key[0]);
        const j = Number(key[1]);
        const c = boxCentre(x, y, size, n, i, j);
        const t = m.f <= -1000 ? 1 : clamp01(pop(frame, m.f, { stiffness: 160, damping: 15 }));
        const r = cell * 0.22;
        const h = hlBoxes.get(key);
        const col = m.owner === 0 ? C.tavi : C.chalk;
        const o = h ? 1 : dimK;
        if (marks === "fill") return <rect key={`m${key}`} x={c.x - cell / 2 + w * 1.5} y={c.y - cell / 2 + w * 1.5} width={cell - 3 * w} height={cell - 3 * w} rx={cell * 0.1} fill={col} opacity={0.35 * t * o} />;
        return (
          <g key={`m${key}`} opacity={o}>
            {m.owner === 0 ? <Ring cx={c.x} cy={c.y} r={r} t={t} color={col} w={w} /> : <Cross cx={c.x} cy={c.y} r={r * 0.85} t={t} color={col} w={w} />}
          </g>
        );
      })}
      {/* optional text in boxes */}
      {Object.entries(boxText).map(([key, txt]) => {
        const c = boxCentre(x, y, size, n, Number(key[0]), Number(key[1]));
        return (
          <text key={`t${key}`} x={c.x} y={c.y + cell * 0.12} textAnchor="middle" fontSize={cell * 0.36} fontWeight={800} fill={PITCH.chalk} fontFamily="Nunito, sans-serif" opacity={0.9}>
            {txt}
          </text>
        );
      })}
    </g>
  );
};

/** Which move (0-based) is complete at this frame, and the live score. */
export const movesDoneAt = (frame: number, moveFrames: number[], drawFrames = 9) => {
  let k = 0;
  while (k < moveFrames.length && frame >= moveFrames[k] + drawFrames) k++;
  return k;
};

/** Score tags: a ring for Tavi, a cross for Chalk, and the numbers. */
export const ScoreTags: React.FC<{ x: number; y: number; tavi: number; chalk: number; size?: number; opacity?: number; names?: [string, string] }> = ({ x, y, tavi, chalk, size = 44, opacity = 1, names = ["YOU", "CHALK"] }) => {
  const w = size * 0.11;
  const gap = size * 4.2;
  const row = (dx: number, mark: "ring" | "cross", name: string, n: number) => (
    <g transform={`translate(${x + dx} ${y})`}>
      {mark === "ring" ? (
        <circle r={size * 0.32} fill="none" stroke={PITCH.teal} strokeWidth={w} />
      ) : (
        <>
          <path d={`M ${-size * 0.28} ${-size * 0.28} L ${size * 0.28} ${size * 0.28}`} stroke={PITCH.chalk} strokeWidth={w} strokeLinecap="round" />
          <path d={`M ${size * 0.28} ${-size * 0.28} L ${-size * 0.28} ${size * 0.28}`} stroke={PITCH.chalk} strokeWidth={w} strokeLinecap="round" />
        </>
      )}
      <text x={size * 0.6} y={size * 0.3} fontSize={size * 0.78} fontWeight={800} fill={PITCH.chalk} fontFamily="Nunito, sans-serif">
        {name}
      </text>
      <text x={size * 0.6 + name.length * size * 0.52 + size * 0.5} y={size * 0.3} fontSize={size * 0.82} fontWeight={800} fill={mark === "ring" ? PITCH.teal : PITCH.chalk} fontFamily="JetBrains Mono, monospace">
        {n}
      </text>
    </g>
  );
  return (
    <g opacity={opacity}>
      {row(0, "ring", names[0], tavi)}
      {row(gap, "cross", names[1], chalk)}
    </g>
  );
};

/** Sides already drawn around a box: a tiny helper for narration beats ("three sides"). */
export const sides = (b: Board, i: number, j: number) => sidesOf(b, i, j);
