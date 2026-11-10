import { useMemo } from 'react';
import { continueGame, hasSave, newGame } from '../game/session';
import { useApp } from '../state/app';

export function TitleScreen() {
  const openSettings = useApp((s) => s.openSettings);
  const canContinue = useMemo(() => hasSave(), []);
  return (
    <div className="screen title">
      <div className="title__glow" aria-hidden="true" />
      <div className="title__inner">
        <div className="title__eyebrow">Overtone presents · Unit 1</div>
        <h1 className="title__name">SOLE OPERATOR</h1>
        <p className="title__tag">
          One nuclear plant. Seven rooms. A kilometre of corridor. Nobody else on shift who can do your job.
        </p>
        <nav className="menu">
          <button className="menu__item is-primary" onClick={newGame} autoFocus>
            New game
          </button>
          <button className="menu__item" onClick={() => continueGame()} disabled={!canContinue}>
            Continue
          </button>
          <button className="menu__item" onClick={openSettings}>
            Settings
          </button>
        </nav>
        <a className="title__back" href="/">
          ← Back to Overtone
        </a>
      </div>
      <div className="title__hint">WASD or click to move · E interact · M map · Esc pause</div>
    </div>
  );
}
