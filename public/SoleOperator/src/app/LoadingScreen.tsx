import { useEffect, useState } from 'react';
import { preloadRoom, START_ROOM } from '../rooms/registry';
import { useApp } from '../state/app';
import { loadGameView } from './loaders';

const STEPS = [
  'Spinning up rod drives',
  'Filling the tank',
  'Calibrating 12 port sensors',
  'Waking the night shift',
];

/** Fetches the 3D engine chunk and the first room, then hands over to the title screen. */
export function LoadingScreen() {
  const screen = useApp((s) => s.screen);
  const [progress, setProgress] = useState(0.08);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (screen !== 'loading') return;
    let cancelled = false;
    const tasks: Promise<unknown>[] = [
      loadGameView(),
      preloadRoom(START_ROOM),
      document.fonts?.ready ?? Promise.resolve(),
    ];
    let done = 0;
    tasks.forEach((t) =>
      t.then(() => {
        done += 1;
        if (!cancelled) setProgress(0.1 + (0.9 * done) / tasks.length);
      }),
    );
    const ticker = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 700);
    Promise.all(tasks)
      .then(() => new Promise((r) => setTimeout(r, 350)))
      .then(async () => {
        if (cancelled) return;
        // Dev shortcut: ?play skips the title, ?play=<room-id> also teleports there.
        const play = import.meta.env.DEV ? new URLSearchParams(location.search).get('play') : null;
        if (play !== null) {
          const { newGame } = await import('../game/session');
          newGame();
          if (play) (await import('../core/events')).bus.emit('cmd/teleport', { room: play });
        } else useApp.getState().setScreen('title');
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setStep(-1);
      });
    return () => {
      cancelled = true;
      clearInterval(ticker);
    };
  }, [screen]);

  return (
    <div className="screen loading">
      <div className="loading__mark" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <polygon points="32,6 56,23 47,52 17,52 8,23" fill="none" stroke="#5fe3ff" strokeWidth="2.5" />
          <polygon points="32,20 42,27 38,39 26,39 22,27" fill="#5fe3ff" />
        </svg>
      </div>
      <div className="loading__title">SOLE OPERATOR</div>
      <div className="loading__bar">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="loading__step">
        {step < 0 ? 'Could not load. Check your connection and reload.' : STEPS[step]}
      </div>
    </div>
  );
}
