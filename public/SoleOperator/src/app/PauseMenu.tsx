import { closeMenu, openMenu, quitToTitle, saveGame } from '../game/session';
import { pushToast } from '../state/hud';
import { useApp } from '../state/app';

export function PauseMenu() {
  const openSettings = useApp((s) => s.openSettings);
  return (
    <div className="overlay">
      <div className="panel">
        <div className="panel__eyebrow">Paused</div>
        <h2 className="panel__title">Unit 1 · Level B2</h2>
        <nav className="menu">
          <button className="menu__item is-primary" onClick={closeMenu} autoFocus>
            Resume
          </button>
          <button
            className="menu__item"
            onClick={() =>
              pushToast(
                saveGame('manual')
                  ? { level: 'ok', text: 'Game saved' }
                  : { level: 'warn', text: 'Could not save', detail: 'Storage is blocked or full.' },
              )
            }
          >
            Save game
          </button>
          <button className="menu__item" onClick={() => openMenu('map')}>
            Facility map
          </button>
          <button className="menu__item" onClick={openSettings}>
            Settings
          </button>
          <button className="menu__item" onClick={quitToTitle}>
            Save and quit to title
          </button>
        </nav>
      </div>
    </div>
  );
}
