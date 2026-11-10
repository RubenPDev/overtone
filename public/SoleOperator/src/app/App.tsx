import { Suspense, lazy, useEffect } from 'react';
import { installInput } from '../game/input';
import { useApp } from '../state/app';
import { loadGameView } from './loaders';
import { LoadingScreen } from './LoadingScreen';
import { SettingsPanel } from './SettingsPanel';
import { TitleScreen } from './TitleScreen';
import './app.css';

const GameView = lazy(loadGameView);

/** Screen router: loading → title → game (with pause / map / settings overlays). */
export function App() {
  const screen = useApp((s) => s.screen);
  const overlay = useApp((s) => s.overlay);

  useEffect(() => {
    installInput();
    document.querySelector('.boot')?.remove();
  }, []);

  return (
    <div className="app">
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'title' && <TitleScreen />}
      {screen === 'game' && (
        <Suspense fallback={<LoadingScreen />}>
          <GameView />
        </Suspense>
      )}
      {overlay === 'settings' && <SettingsPanel />}
    </div>
  );
}
