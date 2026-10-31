import { safeGet, safeSet } from './progress.js';

/* Anonymous totals per puzzle: how many people finished an attempt, and how
   many solved it with or without help. Each browser reports each of those
   once, and a report only counts as sent once the server has accepted it, so
   one that fails is tried again the next time the puzzle is finished. */

const EVENT_URL = 'https://stats.overtone.games/event';

function send(ns, puzzle, event, sent) {
  const id = `${puzzle}:${event}`;
  return fetch(EVENT_URL, {
    method: 'POST',
    // text/plain needs no CORS preflight, so each report is a single request.
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ game: ns, puzzle, event }),
    keepalive: true,
  }).then((res) => {
    if (res.ok) sent.add(id);
  }).catch(() => { /* offline or blocked: never the player's problem */ });
}

export function reportResult(ns, puzzle, outcome) {
  if (import.meta.env.DEV) return;

  const key = `${ns}:reported`;
  let list = [];
  try { list = JSON.parse(safeGet(key) || '[]'); } catch { /* start fresh */ }
  const sent = new Set(list);

  const solvedBefore = sent.has(`${puzzle}:solved`) || sent.has(`${puzzle}:assisted`);
  const events = [];
  if (!sent.has(`${puzzle}:played`)) events.push('played');
  if (outcome !== 'missed' && !solvedBefore) events.push(outcome);

  Promise.all(events.map((event) => send(ns, puzzle, event, sent))).then(() => {
    if (events.length) safeSet(key, JSON.stringify([...sent]));
  });
}
