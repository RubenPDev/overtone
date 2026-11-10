import { Suspense, lazy, useEffect } from 'react';
import { installHotkeys } from '../game/hotkeys';
import Hud from '../hud/Hud';
import GameCanvas from '../scene/GameCanvas';
import { useApp } from '../state/app';
import { MapScreen } from './MapScreen';
import { PauseMenu } from './PauseMenu';
import { OpsTablet } from './OpsTablet';
import { TransitionOverlay } from './TransitionOverlay';

// Dev tools are only bundled in dev builds (the import is dead code in production).
const DevOverlay = import.meta.env.DEV ? lazy(() => import('../dev/DevOverlay')) : null;

if (import.meta.env.DEV) {
  // Console / automation handle for dev builds: __soleOperator.player.path = [{ x: 20, z: 0 }]
  void Promise.all([
    import('../game/runtime'),
    import('../core/events'),
    import('../game/refuel'),
    import('../game/modes'),
  ]).then(([rt, ev, refuel, modes]) => {
    (window as unknown as Record<string, unknown>).__soleOperator = {
      ...rt,
      bus: ev.bus,
      machine: refuel.machine,
      enterMode: modes.enterMode,
      exitMode: modes.exitMode,
    };
  });
}

/** The playing screen: 3D canvas, HUD, transitions and in-game menus. */
export default function GameView() {
  const overlay = useApp((s) => s.overlay);
  const quality = useApp((s) => s.settings.quality);
  useEffect(() => installHotkeys(), []);

  return (
    <div className="game">
      {/* Remount the canvas when quality changes so shadow and MSAA settings apply cleanly. */}
      <GameCanvas key={quality} />
      {overlay !== 'map' && <Hud />}
      <TransitionOverlay />
      {overlay === 'pause' && <PauseMenu />}
      {overlay === 'map' && <MapScreen />}
      {overlay === 'ops' && <OpsTablet />}
      {DevOverlay && (
        <Suspense fallback={null}>
          <DevOverlay />
        </Suspense>
      )}
    </div>
  );
}
