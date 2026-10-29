import { useEffect, useState } from 'react';

export function todayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Reads whatever a game has written to localStorage so the card can show
 * "played today" and a streak without any backend.
 *
 * The contract each game must honour:
 *   <key>:lastPlayed  -> "YYYY-MM-DD"
 *   <key>:streak      -> integer as a string
 *   <key>:lastResult  -> optional, e.g. "solved" | "missed"
 *
 * Reading is deliberately forgiving: a game that hasn't shipped yet, or a
 * browser with storage blocked, just yields the empty state.
 */
function read(storageKey) {
  const empty = { played: false, streak: 0, result: null };
  if (!storageKey) return empty;
  try {
    const last = localStorage.getItem(`${storageKey}:lastPlayed`);
    const streak = parseInt(localStorage.getItem(`${storageKey}:streak`) || '0', 10);
    return {
      played: last === todayStamp(),
      streak: Number.isFinite(streak) ? streak : 0,
      result: localStorage.getItem(`${storageKey}:lastResult`),
    };
  } catch {
    return empty;
  }
}

export function useGameStats(storageKey) {
  const [stats, setStats] = useState(() => read(storageKey));

  useEffect(() => {
    setStats(read(storageKey));

    // Another tab (or the game itself in an iframe) finishing a round.
    const onStorage = (e) => {
      if (!e.key || e.key.startsWith(`${storageKey}:`)) setStats(read(storageKey));
    };
    // Coming back from the game in the same tab.
    const onVisible = () => {
      if (!document.hidden) setStats(read(storageKey));
    };

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [storageKey]);

  return stats;
}
