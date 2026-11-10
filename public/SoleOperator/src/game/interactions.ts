import { bus } from '../core/events';
import { pushToast } from '../state/hud';
import { useWorld } from '../state/world';
import type { Interactable } from '../world/types';
import { currentRoomId } from './worldController';
import { player, session, simHost } from './runtime';

const cellName = (cell: number) => String(cell + 1).padStart(2, '0');
let swapping = false;

/** Verb shown in the E prompt; some interactables change verb with context. */
export function promptVerb(i: Interactable): string {
  if (i.action.type === 'corePort' && useWorld.getState().carrying) return 'LOAD';
  return i.verb;
}

/**
 * The player pressed E on an interactable. Announce it on the bus (objectives
 * listen), then run its data-defined action. Add new action types here.
 */
export function interact(i: Interactable): void {
  const room = currentRoomId() ?? '';
  bus.emit('interact', { room, interactable: i.id, kind: i.kind });
  const a = i.action;

  switch (a.type) {
    case 'corePort': {
      const carrying = useWorld.getState().carrying;
      if (carrying) return swapCell(a.cell, carrying);
      const cell = simHost.state.cells[a.cell]!;
      const pct = Math.round(cell.burnup * 100);
      pushToast({
        level: pct >= 90 ? 'warn' : 'info',
        text: `Fuel cell ${cellName(a.cell)} · burn-up ${pct}%`,
        detail: pct >= 90 ? 'Swap due. Fetch a fresh assembly from Fuel Rod Storage.' : 'Within limits.',
      });
      return;
    }
    case 'takeAssembly': {
      if (useWorld.getState().carrying) {
        pushToast({ level: 'info', text: 'Hands full', detail: 'You are already carrying an assembly.' });
        return;
      }
      session.assembliesTaken += 1;
      const item = `FA-${30 + session.assembliesTaken}`;
      useWorld.setState({ carrying: item });
      bus.emit('item/picked', { item, room });
      pushToast({ level: 'ok', text: `Picked up ${item}`, detail: 'Fresh fuel assembly · 0% burn-up' });
      return;
    }
    case 'talk':
      pushToast({ level: 'info', text: i.label, detail: `“${a.line}”` }, 6000);
      return;
    case 'console':
      pushToast({
        level: 'info',
        text: 'Operator console',
        detail: 'Rod and coolant controls arrive in a later milestone.',
      });
      return;
    case 'message':
      pushToast({ level: 'info', text: a.text, detail: a.detail });
      return;
  }
}

/** Drive the cell's rod fully in, then swap the assembly. */
function swapCell(cell: number, assembly: string) {
  if (swapping) return;
  swapping = true;
  const finish = () => {
    off();
    bus.emit('cmd/sim', { type: 'unloadCell', cell });
    bus.emit('cmd/sim', { type: 'loadCell', cell, assembly });
    // Fresh fuel adds ~1,100 pcm. The rod stays fully in to hold most of it back;
    // TODO(rods panel): let the player withdraw it gradually instead.
    pushToast(
      {
        level: 'info',
        text: `Rod ${cellName(cell)} left fully inserted`,
        detail: 'Fresh fuel is hot. Withdraw the rod slowly once the rod panel is online.',
      },
      6500,
    );
    useWorld.setState({ carrying: null });
    bus.emit('item/dropped', { item: assembly, room: currentRoomId() ?? '' });
    swapping = false;
  };
  const off = bus.on('sim', (e) => {
    if (e.type === 'rodSettled' && e.rod === cell && e.insertion >= 0.999) finish();
  });

  if (simHost.state.rods[cell]!.insertion >= 0.999) {
    finish();
  } else {
    bus.emit('cmd/sim', { type: 'setRodTarget', rod: cell, insertion: 1 });
    pushToast({
      level: 'info',
      text: `Driving rod ${cellName(cell)} in`,
      detail: 'The cell unlocks when the rod is home.',
    });
  }
  player.path = [];
}
