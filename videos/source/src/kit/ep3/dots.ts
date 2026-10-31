// Dots and Boxes game model for episode 3. Same data shape as the app:
//   h[r][c]  horizontal lines, r = 0..N, c = 0..N-1   (null | 0 | 1 = who drew it)
//   v[r][c]  vertical lines,   r = 0..N-1, c = 0..N
//   box[i][j] owner, i, j = 0..N-1
// Box (i,j) has sides h[i][j], h[i+1][j], v[i][j], v[i][j+1]. Player 0 is Tavi, player 1 is Chalk.
// The sample games come from research/ep3/games.c (brute-force, every line on screen is a real game).

import GAMES_JSON from "./games.json";

export type Owner = null | 0 | 1;
export type Board = { n: number; h: Owner[][]; v: Owner[][]; box: Owner[][] };
export type LineId = string; // "h10" = h[1][0], "v23" = v[2][3]
export type Line = { kind: "h" | "v"; r: number; c: number };

export type Move = { n: number; p: 0 | 1; line: LineId; got: number; score: [number, number]; safeBefore: number; couldCapture: number; gave: number };
export type Game = { first: "tavi" | "chalk"; final: [number, number]; moves: Move[] };

const RAW = GAMES_JSON as unknown as Record<string, unknown>;
/** g1: Tavi first, grabs everything, 3-6. g5: Chalk first, both perfect, Tavi 6-3. g3: the eat-all branch of g5 from move 19. */
export const GAMES = {
  g1: RAW.g1 as Game,
  g5: RAW.g5 as Game,
  g3: RAW.g3_eat_all_from_decline_position as Game,
};
/** g3 starts from the position after move 18 of g5 (Tavi has just taken one box of the 3-chain). */
export const G3_FROM_G5_MOVE = (RAW.g5_decline_move as number) - 1; // 18

export const parseLine = (id: LineId): Line => ({ kind: id[0] as "h" | "v", r: Number(id[1]), c: Number(id[2]) });
export const lineId = (l: Line): LineId => `${l.kind}${l.r}${l.c}`;

export const emptyBoard = (n = 3): Board => ({
  n,
  h: Array.from({ length: n + 1 }, () => Array<Owner>(n).fill(null)),
  v: Array.from({ length: n }, () => Array<Owner>(n + 1).fill(null)),
  box: Array.from({ length: n }, () => Array<Owner>(n).fill(null)),
});

export const allLines = (n = 3): Line[] => {
  const out: Line[] = [];
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) out.push({ kind: "h", r, c });
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) out.push({ kind: "v", r, c });
  return out;
};

export const sidesOf = (b: Board, i: number, j: number): number =>
  Number(b.h[i][j] !== null) + Number(b.h[i + 1][j] !== null) + Number(b.v[i][j] !== null) + Number(b.v[i][j + 1] !== null);

/** The one or two boxes a line borders (inside the board). */
export const boxesOf = (n: number, l: Line): [number, number][] => {
  const out: [number, number][] = [];
  if (l.kind === "h") {
    if (l.r - 1 >= 0) out.push([l.r - 1, l.c]);
    if (l.r < n) out.push([l.r, l.c]);
  } else {
    if (l.c - 1 >= 0) out.push([l.r, l.c - 1]);
    if (l.c < n) out.push([l.r, l.c]);
  }
  return out;
};

export const isDrawn = (b: Board, l: Line) => (l.kind === "h" ? b.h[l.r][l.c] : b.v[l.r][l.c]) !== null;

const clone = (b: Board): Board => ({ n: b.n, h: b.h.map((r) => [...r]), v: b.v.map((r) => [...r]), box: b.box.map((r) => [...r]) });

/** Draw a line for player p. Returns the new board and the boxes it completed. */
export const applyMove = (b: Board, id: LineId, p: 0 | 1): { board: Board; completed: [number, number][] } => {
  const l = parseLine(id);
  const nb = clone(b);
  if (l.kind === "h") nb.h[l.r][l.c] = p;
  else nb.v[l.r][l.c] = p;
  const completed: [number, number][] = [];
  for (const [i, j] of boxesOf(b.n, l)) {
    if (sidesOf(nb, i, j) === 4 && nb.box[i][j] === null) {
      nb.box[i][j] = p;
      completed.push([i, j]);
    }
  }
  return { board: nb, completed };
};

/** Board after the first `k` moves of a game (k = 0 is empty). Cached per game. */
const cache = new WeakMap<Game, Board[]>();
export const boardAfter = (g: Game, k: number, start: Board = emptyBoard(3)): Board => {
  let arr = cache.get(g);
  if (!arr || arr[0] !== start) {
    arr = [start];
    let b = start;
    for (const m of g.moves) {
      b = applyMove(b, m.line, m.p).board;
      arr.push(b);
    }
    cache.set(g, arr);
  }
  return arr[Math.max(0, Math.min(g.moves.length, k))];
};

/** A line is safe when it completes nothing and gives no box its third side. */
export const isSafe = (b: Board, l: Line): boolean => {
  if (isDrawn(b, l)) return false;
  for (const [i, j] of boxesOf(b.n, l)) if (sidesOf(b, i, j) >= 2) return false;
  return true;
};
export const safeLines = (b: Board): Line[] => allLines(b.n).filter((l) => isSafe(b, l));
/** Lines that would complete a box right now. */
export const captureLines = (b: Board): Line[] =>
  allLines(b.n).filter((l) => !isDrawn(b, l) && boxesOf(b.n, l).some(([i, j]) => sidesOf(b, i, j) === 3));

/** Undrawn sides of a box. */
export const openSides = (b: Board, i: number, j: number) => 4 - sidesOf(b, i, j);

/**
 * Open boxes grouped into chains, the way players count them: a chain is a run of boxes joined through
 * undrawn lines where every box has at most 2 undrawn sides. A box with 3 or 4 undrawn sides is a
 * junction: it is its own group and chains stop at it. Sorted long to short.
 */
export const chains = (b: Board): [number, number][][] => {
  const seen = b.box.map((r) => r.map(() => false));
  const out: [number, number][][] = [];
  const isLink = (i: number, j: number) => b.box[i][j] === null && openSides(b, i, j) <= 2;
  for (let i = 0; i < b.n; i++)
    for (let j = 0; j < b.n; j++) {
      if (seen[i][j] || b.box[i][j] !== null) continue;
      seen[i][j] = true;
      if (!isLink(i, j)) {
        out.push([[i, j]]);
        continue;
      }
      const comp: [number, number][] = [];
      const stack: [number, number][] = [[i, j]];
      while (stack.length) {
        const [a, c] = stack.pop()!;
        comp.push([a, c]);
        const nbrs: [number, number, boolean][] = [
          [a - 1, c, b.h[a][c] === null],
          [a + 1, c, b.h[a + 1][c] === null],
          [a, c - 1, b.v[a][c] === null],
          [a, c + 1, b.v[a][c + 1] === null],
        ];
        for (const [x, y, open] of nbrs) {
          if (!open || x < 0 || y < 0 || x >= b.n || y >= b.n || seen[x][y] || !isLink(x, y)) continue;
          seen[x][y] = true;
          stack.push([x, y]);
        }
      }
      out.push(comp);
    }
  return out.sort((p, q) => q.length - p.length);
};

/** Chain lengths as a short string, e.g. "4 + 2 + 1". Junction boxes are marked with a star. */
export const chainSummary = (b: Board) =>
  chains(b)
    .map((c) => (c.length === 1 && openSides(b, c[0][0], c[0][1]) >= 3 ? `${c.length}*` : String(c.length)))
    .join(" + ");

export const score = (b: Board): [number, number] => {
  let a = 0;
  let c = 0;
  for (const row of b.box) for (const o of row) if (o === 0) a++; else if (o === 1) c++;
  return [a, c];
};
