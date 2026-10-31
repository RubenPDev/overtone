import { readStreak, safeGet, safeSet, todayStamp } from './progress.js';

/* Anonymous totals, and nothing that could tell one person from another: each
   browser only remembers what it has already reported, here and in localStorage.
   A report only counts as sent once the server has accepted it, so one that fails
   is tried again next time. The server decides the date and rejects anything not
   on its lists. Nothing is sent from the dev server. */

const STATS_URL = 'https://stats.overtone.games';

function post(path, body) {
  return fetch(`${STATS_URL}${path}`, {
    method: 'POST',
    // text/plain needs no CORS preflight, so each report is a single request.
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
    keepalive: true,
  }).then((res) => res.ok)
    .catch(() => false); // offline or blocked: never the player's problem
}

const track = (metric, key) => post('/track', { metric, key });

/** Runs a report unless `flag` is already set, and sets it once accepted. */
function once(flag, send) {
  if (safeGet(flag)) return;
  send().then((ok) => { if (ok) safeSet(flag, '1'); });
}

function daysBetween(fromStamp, toStamp) {
  return Math.round((Date.parse(toStamp) - Date.parse(fromStamp)) / 86400000);
}

const SOURCES = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'x'],
  [/(^|\.)facebook\.com$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)discord(app)?\.com$/, 'discord'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)news\.ycombinator\.com$/, 'hackernews'],
];

/** One word from a fixed list. The page or link someone came from is never sent. */
function sourceOf() {
  if (new URLSearchParams(window.location.search).get('via') === 'share') return 'shared';
  if (!document.referrer) return 'direct';
  let host = '';
  try { host = new URL(document.referrer).hostname; } catch { return 'other'; }
  if (host === window.location.hostname) return 'direct';
  const match = SOURCES.find(([pattern]) => pattern.test(host));
  return match ? match[1] : 'other';
}

/** Once a day per browser. On the very first visit, also how they arrived. */
export function reportVisit() {
  if (import.meta.env.DEV) return;
  const today = todayStamp();
  if (safeGet('overtone:lastVisit') === today) return;

  const isNew = safeGet('overtone:lastVisit') === null;
  track('visitor', isNew ? 'new' : 'returning').then((ok) => {
    if (!ok) return;
    safeSet('overtone:lastVisit', today);
    if (!isNew) return;
    track('source', sourceOf());
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    track('device', coarse ? 'mobile' : 'desktop');
  });
}

function reportedList(ns) {
  try { return JSON.parse(safeGet(`${ns}:reported`) || '[]'); } catch { return []; }
}

function sendEvent(ns, puzzle, event) {
  return post('/event', { game: ns, puzzle, event }).then((ok) => {
    if (!ok) return;
    // Read afresh: another report may have finished while this one was in flight.
    const list = reportedList(ns);
    const id = `${puzzle}:${event}`;
    if (!list.includes(id)) safeSet(`${ns}:reported`, JSON.stringify([...list, id]));
  });
}

/** The first tap on a puzzle. Compared with finishes, shows where people give up. */
export function reportStart(ns, puzzle) {
  if (import.meta.env.DEV) return;
  once('overtone:startReported', () => track('funnel', 'started'));
  if (!reportedList(ns).includes(`${puzzle}:started`)) sendEvent(ns, puzzle, 'started');
}

function triesEvent(count) {
  if (count <= 3) return `tries${count}`;
  return count <= 5 ? 'tries4-5' : 'tries6+';
}

/** Once a day per browser, by how long ago this browser first finished a puzzle. */
function reportActive() {
  const today = todayStamp();
  if (safeGet('overtone:lastActive') === today) return;

  const first = safeGet('overtone:firstFinish') ?? today;
  const days = daysBetween(first, today);
  const key = days === 0 ? 'new' : days === 1 ? 'd1' : days <= 6 ? 'd2-6' : days <= 29 ? 'd7-29' : 'd30+';
  track('active', key).then((ok) => {
    if (!ok) return;
    safeSet('overtone:firstFinish', first);
    safeSet('overtone:lastActive', today);
  });
}

function streakKey(streak) {
  if (streak <= 1) return '1';
  if (streak <= 3) return '2-3';
  if (streak <= 6) return '4-6';
  if (streak <= 13) return '7-13';
  return streak <= 29 ? '14-29' : '30+';
}

/** Pass `tries` only for the attempt that first solved the puzzle. Call after recordPlay. */
export function reportResult(ns, puzzle, outcome, { tries = null, isToday = false } = {}) {
  if (import.meta.env.DEV) return;

  // Site-wide rather than per game: someone who plays three games is one player.
  once('overtone:playerReported', () => post('/player', {}));
  reportActive();

  if (isToday) {
    const flag = `${ns}:streakReported`;
    const today = todayStamp();
    if (safeGet(flag) !== today) {
      track('streak', streakKey(readStreak(ns))).then((ok) => { if (ok) safeSet(flag, today); });
    }
  }

  const sent = reportedList(ns);
  if (!sent.includes(`${puzzle}:played`)) sendEvent(ns, puzzle, 'played');
  if (outcome === 'missed') return;

  once('overtone:solveReported', () => track('funnel', 'solved'));
  if (!sent.includes(`${puzzle}:solved`) && !sent.includes(`${puzzle}:assisted`)) sendEvent(ns, puzzle, outcome);
  if (tries) sendEvent(ns, puzzle, triesEvent(tries));
}

export function reportShare(method) {
  if (!import.meta.env.DEV) track('share', method);
}

/** Once per browser: did the lesson work, or did they just close it? */
export function reportLesson(solved) {
  if (!import.meta.env.DEV) once('overtone:lessonReported', () => track('lesson', solved ? 'solved' : 'skipped'));
}
