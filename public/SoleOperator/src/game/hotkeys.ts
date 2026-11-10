import { useApp } from '../state/app';
import { pushToast } from '../state/hud';
import { useWorld } from '../state/world';
import { onAction, type Action } from './input';
import { interact } from './interactions';
import { player } from './runtime';
import { closeMenu, openMenu, setSpeed, togglePause } from './session';

/** Game-screen hotkeys. Returns an uninstall function. */
export function installHotkeys(): () => void {
  return onAction((a: Action) => {
    const app = useApp.getState();
    if (app.screen !== 'game') return;
    const overlay = app.overlay;

    if (a === 'pause') {
      if (overlay === 'settings') app.closeSettings();
      else if (overlay) closeMenu();
      else openMenu('pause');
      return;
    }
    if (a === 'map') {
      if (overlay === 'map') closeMenu();
      else if (!overlay) openMenu('map');
      return;
    }
    if (overlay) return;

    switch (a) {
      case 'interact': {
        const near = useWorld.getState().near;
        if (near && !player.locked) interact(near);
        return;
      }
      case 'speed1':
        return setSpeed(1);
      case 'speed2':
        return setSpeed(2);
      case 'speed3':
        return setSpeed(3);
      case 'togglePause':
        return togglePause();
      case 'inspect':
      case 'refuel':
      case 'rods':
        // TODO(milestone: tools): Inspect mode, refuelling machine and the rod panel.
        pushToast({
          level: 'info',
          text: `${a[0]!.toUpperCase()}${a.slice(1)} tool`,
          detail: 'Not in this build yet.',
        });
        return;
    }
  });
}
