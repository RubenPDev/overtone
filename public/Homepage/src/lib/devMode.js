/**
 * Developer mode: unlocked by tapping the homepage board's bottom tile eight
 * times, it lets the archives reach puzzles whose day hasn't come yet. It lives
 * in memory only, so moving around the site keeps it and any reload ends it,
 * and puzzles played ahead of their day send no stats.
 */
let on = false;

export function devMode() {
  return on;
}

export function setDevMode(value) {
  on = value;
}
