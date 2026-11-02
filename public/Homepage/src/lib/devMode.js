/**
 * Developer mode: unlocked by tapping the homepage board's bottom tile eight
 * times, it lets the archives reach puzzles whose day hasn't come yet. It lasts
 * for this visit only (a reload keeps it, a new tab or browser session doesn't),
 * and puzzles played ahead of their day send no stats.
 */
const KEY = 'overtone:dev';

export function devMode() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setDevMode(on) {
  try {
    if (on) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch { /* storage blocked: it simply stays off */ }
}
