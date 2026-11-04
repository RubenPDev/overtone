import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

/* Light or dark. Left alone it follows the time of day, light from seven in the
   morning to seven at night, so the site darkens at dusk wherever someone is. Picking
   light or dark in the settings keeps that choice until it's set back to auto.
   index.html applies the same rule before the first paint, so there's no flash. */

const KEY = 'overtone:theme';
export const DAY_FROM = 7;  // the hour light mode starts, local time
export const DAY_TO = 19;   // and ends
export const THEME_MODES = ['auto', 'light', 'dark'];

/** What the time of day says, for auto. */
export function timeTheme(at = new Date()) {
  const h = at.getHours();
  return h >= DAY_FROM && h < DAY_TO ? 'light' : 'dark';
}

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

let mode = typeof window === 'undefined' ? 'auto' : readStored();
const listeners = new Set();

const resolve = () => (mode === 'auto' ? timeTheme() : mode);

/* Always set, auto included, so the page and the canvases agree on one theme. */
function apply() {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', resolve());
}

function publish() {
  apply();
  listeners.forEach((listener) => listener({ mode, theme: resolve() }));
}

/** Auto, light or dark. Light and dark are remembered; auto forgets any choice. */
export function setThemeMode(next) {
  if (!THEME_MODES.includes(next)) return;
  mode = next;
  try {
    if (next === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    /* private mode: the choice just won't persist */
  }
  publish();
}

export function useTheme() {
  const [state, setState] = useState(() => ({ mode, theme: resolve() }));

  // Before any effect runs, so a canvas re-reading the theme's colours sees the right ones.
  useLayoutEffect(() => {
    listeners.add(setState);
    apply();
    setState({ mode, theme: resolve() });
    return () => { listeners.delete(setState); };
  }, []);

  // On auto, dusk and dawn arrive while the page is open: check every minute and on return.
  useEffect(() => {
    const check = () => {
      if (mode === 'auto' && document.documentElement.getAttribute('data-theme') !== timeTheme()) publish();
    };
    const id = setInterval(check, 60 * 1000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check); };
  }, []);

  const toggle = useCallback(() => setThemeMode(resolve() === 'dark' ? 'light' : 'dark'), []);

  return { theme: state.theme, mode: state.mode, isDark: state.theme === 'dark', toggle, setMode: setThemeMode };
}
