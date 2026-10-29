import { useCallback, useEffect, useState } from 'react';

const KEY = 'overtone:theme';

function systemPrefersDark() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Three states, not two: 'light', 'dark', or null meaning "follow the system".
 * A fresh visitor stays on null so flipping their OS theme at dusk still works.
 * Once they touch the toggle we respect that choice and stop following.
 */
export function useTheme() {
  const [override, setOverride] = useState(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = override ?? (systemDark ? 'dark' : 'light');

  useEffect(() => {
    const root = document.documentElement;
    if (override) root.setAttribute('data-theme', override);
    else root.removeAttribute('data-theme');
  }, [override]);

  const toggle = useCallback(() => {
    setOverride((prev) => {
      const current = prev ?? (systemPrefersDark() ? 'dark' : 'light');
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* private mode — the choice just won't persist */
      }
      return next;
    });
  }, []);

  return { theme: resolved, isDark: resolved === 'dark', toggle };
}
