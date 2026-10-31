import { safeGet, safeSet } from './progress.js';

/* Anonymous totals: how many people finished an attempt at each puzzle, how
   many solved it with or without help, and how many players there are from each
   country. Each browser reports each of those once, and a report only counts as
   sent once the server has accepted it, so one that fails is tried again the
   next time a puzzle is finished. */

const STATS_URL = 'https://stats.overtone.games';
const PLAYER_KEY = 'overtone:playerReported';

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

/** Site-wide rather than per game: someone who plays three games is one player. */
function reportPlayer() {
  if (safeGet(PLAYER_KEY)) return;
  post('/player', {}).then((ok) => { if (ok) safeSet(PLAYER_KEY, '1'); });
}

export function reportResult(ns, puzzle, outcome) {
  if (import.meta.env.DEV) return;

  reportPlayer();

  const key = `${ns}:reported`;
  let list = [];
  try { list = JSON.parse(safeGet(key) || '[]'); } catch { /* start fresh */ }
  const sent = new Set(list);

  const solvedBefore = sent.has(`${puzzle}:solved`) || sent.has(`${puzzle}:assisted`);
  const events = [];
  if (!sent.has(`${puzzle}:played`)) events.push('played');
  if (outcome !== 'missed' && !solvedBefore) events.push(outcome);

  Promise.all(events.map((event) => post('/event', { game: ns, puzzle, event }).then((ok) => {
    if (ok) sent.add(`${puzzle}:${event}`);
  }))).then(() => {
    if (events.length) safeSet(key, JSON.stringify([...sent]));
  });
}
