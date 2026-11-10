import { bus } from '../core/events';
import { isFresh, slotName } from '../logistics';
import { CORE_BAY } from '../rooms/control-room';
import { pushToast, useHud } from '../state/hud';
import type { Interactable } from '../world/types';
import { attachCart, cartDockedAt, parkCart } from './cart';
import { enterMode } from './modes';
import { logistics, player, simHost } from './runtime';
import { currentRoomId } from './worldController';

const cellName = (cell: number) => String(cell + 1).padStart(2, '0');
const cooldowns = new Map<string, number>();

function cooledDown(id: string, ms: number) {
  const now = performance.now();
  if ((cooldowns.get(id) ?? 0) > now) return false;
  cooldowns.set(id, now + ms);
  return true;
}

/** True when the transfer cart sits in the core bay with fuel to work with. */
export function canRefuel(): boolean {
  return cartDockedAt('control-room', CORE_BAY.id);
}

/** The worst-burnt loaded cell, else the first empty one, else cell 07. */
function suggestedCell(): number {
  const cells = simHost.state.cells;
  let best = -1;
  cells.forEach((c, i) => {
    if (c.loaded && c.burnup > 0.9 && (best < 0 || c.burnup > cells[best]!.burnup)) best = i;
  });
  if (best < 0) best = cells.findIndex((c) => !c.loaded);
  return best < 0 ? 6 : best;
}

/** Verb shown in the E prompt; some interactables change verb with context. */
export function promptVerb(i: Interactable): string {
  if (i.action.type === 'corePort' && canRefuel()) return 'REFUEL';
  return i.verb;
}

/**
 * The player pressed E on an interactable. Announce it on the bus (objectives
 * listen), then run its data-defined action. Add new action types here.
 */
export function interact(i: Interactable): void {
  const room = currentRoomId() ?? '';
  bus.emit('interact', { room, interactable: i.id, kind: i.kind });

  if (i.id === 'cart') {
    if (logistics.state.cart.attached) parkCart();
    else attachCart();
    return;
  }

  const a = i.action;
  switch (a.type) {
    case 'corePort': {
      if (canRefuel()) return enterMode({ kind: 'refuel', cell: suggestedCell() });
      const cell = simHost.state.cells[a.cell]!;
      const pct = Math.round(cell.burnup * 100);
      pushToast(
        {
          level: pct >= 90 ? 'warn' : 'info',
          text: `Fuel cell ${cellName(a.cell)} · burn-up ${pct}%`,
          detail:
            pct >= 90
              ? 'Swap due. Bring a fresh assembly on the transfer cart and dock it in the cart bay.'
              : 'Within limits.',
        },
        6000,
      );
      return;
    }
    case 'rodControl':
      return enterMode({ kind: 'rods', selected: 6, bank: false });
    case 'crane':
      return enterMode({ kind: 'crane' });
    case 'inventory': {
      const pool = logistics.state.pool;
      const fresh = pool.flatMap((x, k) => (x && isFresh(x) ? [`${slotName(k)} ${x.id}`] : []));
      const spent = pool.filter((x) => x && !isFresh(x)).length;
      pushToast(
        {
          level: 'info',
          text: `Pool manifest · ${fresh.length} fresh, ${spent} spent`,
          detail: fresh.length ? `Fresh: ${fresh.join(', ')}` : 'No fresh assemblies left in the pool.',
        },
        7000,
      );
      return;
    }
    case 'talk':
      pushToast({ level: 'info', text: i.label, detail: `“${a.line}”` }, 6000);
      return;
    case 'vending':
      if (!cooledDown('vending', 15000)) {
        pushToast({ level: 'info', text: 'Still brewing', detail: 'Give it a moment.' });
        return;
      }
      player.focus = Math.min(1, player.focus + 0.3);
      pushToast({ level: 'ok', text: 'Coffee, black', detail: 'Focus +30%' });
      return;
    case 'water':
      player.stamina = 1;
      pushToast({ level: 'ok', text: 'Cold water', detail: 'Stamina restored' });
      return;
    case 'alarmPanel': {
      const alarms = useHud.getState().sim?.alarms ?? [];
      useHud.setState({ acked: [...alarms] });
      pushToast(
        alarms.length
          ? {
              level: 'warn',
              text: `Acknowledged ${alarms.length} alarm${alarms.length > 1 ? 's' : ''}`,
              detail: 'Beacons steady. Fix the cause to clear them.',
            }
          : { level: 'ok', text: 'Alarm panel', detail: 'No active alarms. Lamp test passed.' },
      );
      return;
    }
    case 'message':
      pushToast({ level: 'info', text: a.text, detail: a.detail });
      return;
  }
}
