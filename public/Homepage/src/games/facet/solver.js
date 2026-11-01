/* ============================================================
   Facet — the puzzle's maths, with no DOM and no React.

   Model: one 3x3 face (its centre fixed) plus the nearest row of
   each of the four neighbouring faces, flattened into a cross.
   20 movable cells: 8 tiles of the target colour and 3 each of four
   others. Solved means the ring is all target colour and every arm is
   a single colour. Any colour can finish on any arm.

   Positions
     0..7   the ring, clockwise from the face's top-left
     8..10  top arm      11..13 right arm
     14..16 bottom arm   17..19 left arm

   Moves (14 of them)
     quarter turn either way  — the ring shifts by two
     12 single swaps          — one arm cell trades with the one
                                face cell it touches

   The four corners each have TWO possible partners, which is where
   all the coupling comes from: fixing one edge disturbs the other.

   No move ever takes a tile between the 12 corner-type cells (ring
   corners, arm ends) and the 8 edge-type cells (ring edges, arm
   middles), so each colour's tiles stay split the way they started.
   ============================================================ */

export const N = 20;
export const PITCH = 60;
export const CELL = 52;
export const CENTRE = 146;      // px, centre of the 5x5 grid

/** Grid coordinates [row, col] in the 5x5 cross, indexed by position. */
export const RC = [
  [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [2, 1],
  [0, 1], [0, 2], [0, 3],
  [1, 4], [2, 4], [3, 4],
  [4, 1], [4, 2], [4, 3],
  [1, 0], [2, 0], [3, 0],
];

export const ARMS = [[8, 9, 10], [11, 12, 13], [14, 15, 16], [17, 18, 19]];

/** [armPosition, facePosition] — every legal swap. */
export const SWAPS = [
  [8, 0], [9, 1], [10, 2],
  [11, 2], [12, 3], [13, 4],
  [16, 4], [15, 5], [14, 6],
  [19, 6], [18, 7], [17, 0],
];

function permTable(pairs) {
  const m = new Int8Array(N);
  for (let i = 0; i < N; i++) m[i] = i;
  for (const [from, to] of pairs) m[from] = to;
  return m;
}

export function turnPerm(k) {
  const s = (((2 * k) % 8) + 8) % 8;
  return permTable(Array.from({ length: 8 }, (_, i) => [i, (i + s) % 8]));
}

export function swapPerm(arm, ring) {
  return permTable([[arm, ring], [ring, arm]]);
}

const MOVES = [
  turnPerm(1),
  turnPerm(-1),
  ...SWAPS.map(([arm, ring]) => swapPerm(arm, ring)),
];

/** The move that undoes each move: turns pair up, a swap undoes itself. */
const UNDO = MOVES.map((_, j) => (j < 2 ? 1 - j : j));

/** Swaps sharing no cell give the same board in either order; only search one. */
const REDUNDANT = MOVES.map((_, a) => MOVES.map((_, b) => {
  if (a < 2 || b < 2 || b >= a) return false;
  const [p, q] = SWAPS[a - 2];
  const [r, s] = SWAPS[b - 2];
  return p !== r && p !== s && q !== r && q !== s;
}));

/* ------------------------------------------------------------------
   Exact distances. There are 87,318,000 boards once colours count as
   interchangeable, with every one reachable and the hardest 15 moves
   out, which is too many to tabulate in a browser. So each board is
   solved on demand by iterative deepening, steered by a lower bound
   from smaller tables that do fit: each of the two cell groups solved
   alone, the swaps those groups need (a swap only touches one group, so
   those add up), and the target colour's tiles alone. Takes ~100ms once.
------------------------------------------------------------------ */

const CORNER_CELLS = [0, 2, 4, 6, 8, 10, 11, 13, 14, 16, 17, 19];
const EDGE_CELLS = [1, 3, 5, 7, 9, 12, 15, 18];

function solvedBoard(labels = [1, 2, 3, 4]) {
  const board = new Array(N).fill(0);
  ARMS.forEach((arm, i) => { for (const p of arm) board[p] = labels[i]; });
  return board;
}

/** Every arrangement of one cell group, with colours named by first appearance. */
function buildGroup(cells) {
  const index = new Array(N).fill(-1);
  cells.forEach((p, i) => { index[p] = i; });
  const moved = MOVES.map((m) => cells.map((p) => index[m[p]]));

  const keyOf = (colours) => {
    const names = [0, 0, 0, 0, 0];
    let nextName = 1;
    let key = 0;
    for (const c of colours) {
      if (c && !names[c]) names[c] = nextName++;
      key = key * 5 + (c ? names[c] : 0);
    }
    return key;
  };

  const solved = solvedBoard();
  const first = cells.map((p) => solved[p]);
  const ids = new Map([[keyOf(first), 0]]);
  const found = [first];
  const next = [];
  for (let i = 0; i < found.length; i++) {
    for (const to of moved) {
      const after = new Array(cells.length);
      for (let c = 0; c < cells.length; c++) after[to[c]] = found[i][c];
      const key = keyOf(after);
      let id = ids.get(key);
      if (id === undefined) { id = found.length; ids.set(key, id); found.push(after); }
      next.push(id);
    }
  }

  const size = found.length;
  const count = MOVES.length;
  const dist = new Int8Array(size).fill(-1);
  dist[0] = 0;
  for (let frontier = [0], depth = 0; frontier.length; depth++) {
    const ahead = [];
    for (const s of frontier) {
      for (let j = 0; j < count; j++) {
        const q = next[s * count + j];
        if (dist[q] === -1) { dist[q] = depth + 1; ahead.push(q); }
      }
    }
    frontier = ahead;
  }

  // The same again with turns free, leaving only the swaps this group needs.
  const swaps = new Int8Array(size).fill(127);
  swaps[0] = 0;
  const buckets = [[0]];
  for (let cost = 0; cost < buckets.length; cost++) {
    for (const s of buckets[cost]) {
      if (swaps[s] !== cost) continue;
      for (let j = 0; j < count; j++) {
        const q = next[s * count + j];
        const c = cost + (j < 2 ? 0 : 1);
        if (c < swaps[q]) {
          swaps[q] = c;
          (buckets[c] ??= []).push(q);
        }
      }
    }
  }

  const greens = found.map((colours) => colours.reduce((m, c, i) => (c ? m : m | (1 << i)), 0));
  return { cells, index, keyOf, ids, next: Int32Array.from(next), dist, swaps, greens, size };
}

/** Moves needed for the target colour alone, by which cells of each group hold it. */
function buildGreenTable(corners, edges) {
  const table = new Int8Array(1 << 20).fill(-1);
  const moveMask = (mask, group, m) => {
    let out = 0;
    group.cells.forEach((p, i) => { if (mask & (1 << i)) out |= 1 << group.index[m[p]]; });
    return out;
  };
  const start = (corners.greens[0] << 8) | edges.greens[0];
  table[start] = 0;
  for (let frontier = [start], depth = 0; frontier.length; depth++) {
    const ahead = [];
    for (const s of frontier) {
      for (const m of MOVES) {
        const q = (moveMask(s >> 8, corners, m) << 8) | moveMask(s & 255, edges, m);
        if (table[q] === -1) { table[q] = depth + 1; ahead.push(q); }
      }
    }
    frontier = ahead;
  }
  return table;
}

let TABLES = null;

export function isBuilt() {
  return TABLES !== null;
}

export function buildTables() {
  if (TABLES) return TABLES;
  const corners = buildGroup(CORNER_CELLS);
  const edges = buildGroup(EDGE_CELLS);
  const green = buildGreenTable(corners, edges);
  const bound = new Int8Array(corners.size * edges.size);
  for (let c = 0; c < corners.size; c++) {
    for (let e = 0; e < edges.size; e++) {
      bound[c * edges.size + e] = Math.max(
        corners.dist[c],
        edges.dist[e],
        corners.swaps[c] + edges.swaps[e],
        green[(corners.greens[c] << 8) | edges.greens[e]],
      );
    }
  }
  TABLES = { corners, edges, bound };
  return TABLES;
}

function isSolvedBoard(board) {
  for (let i = 0; i < 8; i++) if (board[i] !== 0) return false;
  return ARMS.every(([a, b, c]) => board[a] === board[b] && board[b] === board[c]);
}

/** Is the board solvable in `limit` moves or fewer? Rearranges it, but puts it back. */
function solvableWithin(board, c, e, limit, prev) {
  const { corners, edges, bound } = TABLES;
  const estimate = bound[c * edges.size + e];
  if (estimate > limit) return false;
  if (estimate === 0 && isSolvedBoard(board)) return true;
  if (limit === 0) return false;

  for (let j = 0; j < MOVES.length; j++) {
    if (prev >= 0 && (UNDO[prev] === j || REDUNDANT[prev][j])) continue;
    const nextC = corners.next[c * MOVES.length + j];
    const nextE = edges.next[e * MOVES.length + j];
    let done;
    if (j < 2) {
      const ring = board.slice(0, 8);
      for (let i = 0; i < 8; i++) board[MOVES[j][i]] = ring[i];
      done = solvableWithin(board, nextC, nextE, limit - 1, j);
      for (let i = 0; i < 8; i++) board[i] = ring[i];
    } else {
      const [a, r] = SWAPS[j - 2];
      [board[a], board[r]] = [board[r], board[a]];
      done = solvableWithin(board, nextC, nextE, limit - 1, j);
      [board[a], board[r]] = [board[r], board[a]];
    }
    if (done) return true;
  }
  return false;
}

function groupIds(board) {
  const { corners, edges } = TABLES;
  return [
    corners.ids.get(corners.keyOf(corners.cells.map((p) => board[p]))),
    edges.ids.get(edges.keyOf(edges.cells.map((p) => board[p]))),
  ];
}

/** Exact moves from solved, or null if it's more than `cap`. */
function distanceOfBoard(board, cap = Infinity) {
  const [c, e] = groupIds(board);
  const from = TABLES.bound[c * TABLES.edges.size + e];
  for (let limit = from; limit <= cap; limit++) {
    if (solvableWithin(board, c, e, limit, -1)) return limit;
  }
  return null;
}

/** pos maps position -> tile id; a move permutes positions. */
export function applyPerm(pos, m) {
  const next = pos.slice();
  for (let i = 0; i < N; i++) next[m[i]] = pos[i];
  return next;
}

/** A solved layout of these tiles. Which colour takes which arm is arbitrary. */
export function solvedPosition(colours) {
  const tiles = [[], [], [], [], []];
  colours.forEach((colour, tile) => tiles[colour].push(tile));
  return solvedBoard().map((colour) => tiles[colour].pop());
}

/* Proving a board is further than this gets slow fast (seconds at 14, even
   on a desktop), and the floor is already full by here. */
export const FAR = 12;

/** Exact moves from solved, except that anything further just reads as FAR. */
export function distanceOf(pos, colours) {
  buildTables();
  return distanceOfBoard(pos.map((tile) => colours[tile]), FAR - 1) ?? FAR;
}

/* ------------------------------------------------------------------
   Daily puzzles. Everyone gets the same board because the scramble is
   derived from the puzzle number, not from Math.random.
------------------------------------------------------------------ */

export const LAUNCH_UTC = Date.UTC(2026, 9, 26); // 26 Oct 2026

export function todayNumber(now = new Date()) {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(1, Math.floor((midnight - LAUNCH_UTC) / 86400000) + 1);
}

/** Today's puzzle lives at the plain URL. */
export function puzzlePath(n) {
  return n === todayNumber() ? '/facet' : `/facet/${n}`;
}

export function dateForNumber(n) {
  return new Date(LAUNCH_UTC + (n - 1) * 86400000);
}

/* Sunday..Saturday. A shuffled board is most often 11 from solved, so
   Saturday asks for a typical board and the rest are gentler than that. */
const PAR_BY_DOW = [10, 8, 8, 9, 10, 11, 12];

export function parFor(n) {
  return PAR_BY_DOW[dateForNumber(n).getUTCDay()];
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns { par, colours } for a puzzle number. colours is indexed by
 * tile id, 0 = target colour, 1..4 = the arm colours. Tiles start with
 * tile id === position, so the caller's initial pos is the identity.
 *
 * Boards come from walking away from solved, since a random colouring
 * usually splits a colour across the two cell groups and can't be solved.
 * A walk of exactly par moves can't end further out than par, so checking
 * one only ever has to rule out a shorter route.
 */
export function scrambleFor(puzzleNumber) {
  buildTables();
  const want = parFor(puzzleNumber);
  const rand = mulberry32(Math.imul(puzzleNumber, 2654435761));

  const labels = [1, 2, 3, 4];
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }

  for (let attempt = 0; attempt < 60000; attempt++) {
    let board = solvedBoard(labels);
    let prev = -1;
    for (let i = 0; i < want; i++) {
      let j;
      do { j = Math.floor(rand() * MOVES.length); } while (prev >= 0 && (UNDO[prev] === j || REDUNDANT[prev][j]));
      board = applyPerm(board, MOVES[j]);
      prev = j;
    }
    if (distanceOfBoard(board, want) === want) return { par: want, colours: board };
  }
  // Fall back to the solved board rather than hanging, which should
  // never happen for the par values above.
  return { par: 0, colours: solvedBoard(labels) };
}
