import { bus } from '../core/events';
import { POOL_SLOTS, isFresh } from '../logistics';
import { MARKET_BY_ID, hasTool, type PlantCommand } from '../sim';
import { useApp } from '../state/app';
import { pushToast, toHudSim, useHud } from '../state/hud';
import { useWorld } from '../state/world';
import { logistics, player, simHost, syncLogistics } from './runtime';

/**
 * The ops tablet: the operator's handheld for contracts, purchases, the market
 * and clearance reviews. Unlike the pause menu it doesn't stop the plant;
 * it only stops the player walking while it's up.
 */
export function openTablet() {
  if (useApp.getState().overlay) return;
  player.locked = true;
  player.path = [];
  useApp.getState().setOverlay('ops');
  bus.emit('ui/opened', { panel: 'ops' });
}

export function closeTablet() {
  if (useApp.getState().overlay !== 'ops') return;
  useApp.getState().setOverlay(null);
  if (useWorld.getState().transition.phase === 'idle') player.locked = false;
}

/**
 * Send a plant command from a menu and show its effect at once. Commands apply
 * at the next tick; while the game is paused, run one tick so the purchase lands.
 */
export function sendNow(cmd: PlantCommand) {
  bus.emit('cmd/sim', cmd);
  simHost.tick(); // apply now, paused or not, rather than at the next clock tick
  useHud.setState({ sim: toHudSim(simHost.state) });
}

const freeSlot = () => logistics.state.pool.findIndex((a) => a === null);

/** Buying fuel needs a free rack slot to deliver into. */
export function buyItem(id: string) {
  const item = MARKET_BY_ID.get(id);
  if (item && id.startsWith('fuel-') && freeSlot() < 0) {
    pushToast({ level: 'warn', text: 'Pool rack full', detail: 'Ship spent assemblies out to make room.' });
    return;
  }
  sendNow({ type: 'buyItem', id });
}

/** Next unused FA-number across the pool, crane hook, cask and core. */
function nextAssemblyId(): string {
  const s = logistics.state;
  const ids = [
    ...s.pool.map((a) => a?.id),
    s.crane.holding?.id,
    ...s.cart.cask.map((a) => a.id),
    ...simHost.state.cells.map((c) => c.assembly),
  ];
  const max = Math.max(40, ...ids.map((id) => (id?.startsWith('FA-') ? Number(id.slice(3)) || 0 : 0)));
  return `FA-${max + 1}`;
}

/** A bought or fabricated assembly arrives in the first free rack slot. */
export function deliverAssembly(): string | null {
  const slot = freeSlot();
  if (slot < 0) return null;
  const id = nextAssemblyId();
  logistics.state.pool[slot] = { id, burnup: 0 };
  syncLogistics();
  return id;
}

export const spentInPool = () => logistics.state.pool.filter((a) => a && !isFresh(a)).length;

/** Ship every spent assembly in the pool to the accelerator stores (feed for transmutation). */
export function shipSpent() {
  const n = spentInPool();
  if (!n) return;
  logistics.state.pool = logistics.state.pool.map((a) => (a && !isFresh(a) ? null : a));
  syncLogistics();
  sendNow({ type: 'addStock', stock: 'spent-fuel', amount: n });
  pushToast({
    level: 'ok',
    text: `${n} spent assembl${n === 1 ? 'y' : 'ies'} shipped`,
    detail: 'Now in the ring stores as transmutation feed.',
  });
}

/** Upgrades that live outside the sim (cart cask size) follow the sim's upgrade levels. */
export function applyGameUpgrades() {
  logistics.state.cart.capacity = hasTool(simHost.state, 'cask-3') ? 3 : 2;
  syncLogistics();
}

export const poolFree = () => POOL_SLOTS - logistics.state.pool.filter(Boolean).length;
