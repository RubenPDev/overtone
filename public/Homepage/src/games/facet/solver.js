/* ============================================================
   Facet — the puzzle's maths, with no DOM and no React.

   Model: one 3x3 face (its centre fixed) plus the nearest row of
   each of the four neighbouring faces, flattened into a cross.
   20 movable cells, 8 of which carry the target colour.

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
   ============================================================ */

export const N = 20;
export const PITCH = 60;
export const CELL = 52;
export const CENTRE = 146;      // px, centre of the 5x5 grid
export const SOLVED_MASK = 0xFF; // ring full of target colour

/** Grid coordinates [row, col] in the 5x5 cross, indexed by position. */
export const RC = [
  [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [2, 1],
  [0, 1], [0, 2], [0, 3],
  [1, 4], [2, 4], [3, 4],
  [4, 1], [4, 2], [4, 3],
  [1, 0], [2, 0], [3, 0],
];

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

function applyMask(mask, m) {
  let out = 0;
  for (let i = 0; i < N; i++) if (mask & (1 << i)) out |= 1 << m[i];
  return out;
}

/* ------------------------------------------------------------------
   Exhaustive search from the solved state. 34,650 positions are
   reachable out of the 125,970 ways to place 8 tiles in 20 cells, so
   a random shuffle is unsolvable roughly three times in four — always
   generate by searching for a reachable mask, never by shuffling.
   Diameter is 10. Takes ~100ms once, then every lookup is free.
------------------------------------------------------------------ */

let DIST = null;

export function isBuilt() {
  return DIST !== null;
}

export function distances() {
  if (DIST) return DIST;
  const d = new Int8Array(1 << N).fill(-1);
  d[SOLVED_MASK] = 0;
  let frontier = [SOLVED_MASK];
  let depth = 0;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (const m of MOVES) {
        const q = applyMask(s, m);
        if (d[q] === -1) { d[q] = depth + 1; next.push(q); }
      }
    }
    frontier = next;
    depth++;
  }
  DIST = d;
  return DIST;
}

/** Positions currently holding a target-coloured tile, as a bitmask. */
export function maskOf(pos, colours) {
  let m = 0;
  for (let i = 0; i < N; i++) if (colours[pos[i]] === 0) m |= 1 << i;
  return m;
}

/** pos maps position -> tile id; a move permutes positions. */
export function applyPerm(pos, m) {
  const next = pos.slice();
  for (let i = 0; i < N; i++) next[m[i]] = pos[i];
  return next;
}

export function distanceOf(pos, colours) {
  return distances()[maskOf(pos, colours)];
}

/* ------------------------------------------------------------------
   Daily puzzles. Everyone gets the same board because the scramble is
   derived from the puzzle number, not from Math.random.
------------------------------------------------------------------ */

export const LAUNCH_UTC = Date.UTC(2026, 9, 31); // 31 Oct 2026

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

/* Sunday..Saturday. Par 8 covers 2,300 of the 34,650 reachable boards,
   so Saturday is genuinely rare without being unfindable. */
const PAR_BY_DOW = [6, 5, 5, 6, 6, 7, 8];

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

const JUNK_COUNT = 4;

/**
 * Returns { par, colours } for a puzzle number. colours is indexed by
 * tile id, 0 = target colour, 1..4 = the junk colours. Tiles start with
 * tile id === position, so the caller's initial pos is the identity.
 */
export function scrambleFor(puzzleNumber) {
  const dist = distances();
  const want = parFor(puzzleNumber);
  const rand = mulberry32(Math.imul(puzzleNumber, 2654435761));

  let chosen = null;
  for (let attempt = 0; attempt < 60000 && !chosen; attempt++) {
    const idx = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    let mask = 0;
    for (let i = 0; i < 8; i++) mask |= 1 << idx[i];
    if (dist[mask] === want) chosen = idx.slice(0, 8);
  }
  // Fall back to the solved board rather than hanging, which should
  // never happen for the par values above.
  if (!chosen) chosen = [0, 1, 2, 3, 4, 5, 6, 7];

  const isTarget = new Set(chosen);
  const colours = [];
  for (let i = 0; i < N; i++) {
    colours.push(isTarget.has(i) ? 0 : 1 + Math.floor(rand() * JUNK_COUNT));
  }
  let mask = 0;
  for (const i of chosen) mask |= 1 << i;

  return { par: dist[mask], colours };
}
