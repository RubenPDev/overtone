import { useApp } from '../state/app';
import { pushToast } from '../state/hud';
import { useMode } from '../state/mode';
import { useWorld } from '../state/world';
import { onAction, type Action } from './input';
import { canRefuel, interact } from './interactions';
import { enterMode, exitMode, inMode } from './modes';
import { player, simHost } from './runtime';
import { closeMenu, openMenu, setSpeed, togglePause } from './session';
import { currentRoomId } from './worldController';

/** Game-screen hotkeys. Returns an uninstall function. */
export function installHotkeys(): () => void {
  return onAction((a: Action) => {
    const app = useApp.getState();
    if (app.screen !== 'game') return;
    const overlay = app.overlay;

    if (a === 'pause') {
      if (overlay === 'settings') app.closeSettings();
      else if (overlay) closeMenu();
      else if (inMode()) exitMode();
      else openMenu('pause');
      return;
    }
    if (a === 'togglePause' && !overlay) return togglePause();
    // Inside a control mode, keys belong to the machine (see game/modes.ts).
    if (inMode()) {
      if (a === 'rods' && useMode.getState().mode.kind === 'rods') exitMode();
      return;
    }
    if (a === 'map') {
      if (overlay === 'map') closeMenu();
      else if (!overlay) openMenu('map');
      return;
    }
    if (overlay || player.locked) return;

    switch (a) {
      case 'interact': {
        const near = useWorld.getState().near;
        if (near) interact(near);
        return;
      }
      case 'speed1':
        return setSpeed(1);
      case 'speed2':
        return setSpeed(2);
      case 'speed3':
        return setSpeed(3);
      case 'rods':
        if (currentRoomId() === 'control-room') return enterMode({ kind: 'rods', selected: 6, bank: false });
        pushToast({
          level: 'info',
          text: 'Rod drives',
          detail: 'Rod control is at the operator console in Reactor Control.',
        });
        return;
      case 'refuel':
        if (canRefuel()) {
          const worst = simHost.state.cells.findIndex((c) => c.loaded && c.burnup > 0.9);
          return enterMode({ kind: 'refuel', cell: worst >= 0 ? worst : 6 });
        }
        pushToast({
          level: 'info',
          text: 'Refuelling machine',
          detail: 'Dock the transfer cart in the core cart bay first.',
        });
        return;
      case 'inspect':
        // TODO(milestone: tools): inspect mode (hover readouts on equipment).
        pushToast({ level: 'info', text: 'Inspect tool', detail: 'Not in this build yet.' });
        return;
    }
  });
}
