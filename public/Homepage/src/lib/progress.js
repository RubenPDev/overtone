/* Progress lives entirely in the visitor's browser, which is the trade for a
   streak that a cleared cache will erase. Only anonymous per-puzzle totals ever
   leave the device; see stats.js. */

export function todayStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

export function readResults(ns) {
  try { return JSON.parse(safeGet(`${ns}:results`) || '{}'); } catch { return {}; }
}

/* Outcomes, worst to best. "assisted" is a solve that came after a hint. */
const RANK = { missed: 0, assisted: 1, solved: 2 };

/** Puzzles where a hint has been used. Kept so a reload can't erase the hint. */
export function hintUsed(ns, puzzleNumber) {
  try { return JSON.parse(safeGet(`${ns}:hinted`) || '[]').includes(puzzleNumber); } catch { return false; }
}
export function markHintUsed(ns, puzzleNumber) {
  let list = [];
  try { list = JSON.parse(safeGet(`${ns}:hinted`) || '[]'); } catch { /* start fresh */ }
  if (!list.includes(puzzleNumber)) safeSet(`${ns}:hinted`, JSON.stringify([...list, puzzleNumber]));
}

/** Anyone with a result already knows how to play, even if they predate the lesson. */
export function helpSeen(ns) {
  return safeGet(`${ns}:helpSeen`) !== null || Object.keys(readResults(ns)).length > 0;
}
export function markHelpSeen(ns) {
  safeSet(`${ns}:helpSeen`, '1');
}

/**
 * Records a finished puzzle. Only today's puzzle moves the streak — replaying
 * the archive shouldn't inflate it. Pass `outcome` to record an assisted solve;
 * otherwise `solved` picks between "solved" and "missed".
 */
export function recordPlay(ns, { puzzleNumber, solved, outcome = solved ? 'solved' : 'missed', isToday }) {
  const results = readResults(ns);
  const prev = results[puzzleNumber];
  // Only ever upgrade: a later failed retry doesn't undo an earlier win.
  if (prev === undefined || RANK[outcome] > (RANK[prev] ?? 0)) {
    results[puzzleNumber] = outcome;
    safeSet(`${ns}:results`, JSON.stringify(results));
  }

  if (!isToday) return;

  const today = todayStamp();
  const last = safeGet(`${ns}:lastPlayed`);
  if (last === today) {
    safeSet(`${ns}:lastResult`, outcome);
    return;
  }

  const yesterday = todayStamp(new Date(Date.now() - 86400000));
  const streak = parseInt(safeGet(`${ns}:streak`) || '0', 10) || 0;

  safeSet(`${ns}:streak`, String(last === yesterday ? streak + 1 : 1));
  safeSet(`${ns}:lastPlayed`, today);
  safeSet(`${ns}:lastResult`, outcome);
}

export function readVisualPrefs(ns, fallback) {
  try {
    const raw = safeGet(`${ns}:visual`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function writeVisualPrefs(ns, prefs) {
  safeSet(`${ns}:visual`, JSON.stringify(prefs));
}
