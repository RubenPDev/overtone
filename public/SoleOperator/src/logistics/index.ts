/**
 * Fuel logistics: where every assembly outside the core is. Pure TypeScript
 * (no React/Three) like the sim, so it can be tested and saved as plain JSON.
 *
 * Assemblies live in three places: the underwater pool rack in Fuel Rod
 * Storage, the crane hook, and the shielded cask on the transfer cart.
 * (Assemblies inside the core are the sim's cells.)
 */

export interface Assembly {
  id: string;
  /** Fraction of design burn-up: < 0.5 counts as fresh, ≥ 0.5 as spent. */
  burnup: number;
}

export const POOL_COLS = 5;
export const POOL_ROWS = 4;
export const POOL_SLOTS = POOL_COLS * POOL_ROWS;
export const CASK_CAPACITY = 2;

export interface CartState {
  /** Room the cart is parked in (carts can't be parked in corridors). */
  room: string;
  x: number;
  z: number;
  yaw: number;
  /** Being pushed by the player (follows them across rooms). */
  attached: boolean;
  /** Bay id when parked in a docking bay. */
  bay: string | null;
  cask: Assembly[];
  /** Cask bays (2, or 3 with the triple-bay cask). Missing in older saves = 2. */
  capacity?: number;
}

export interface LogisticsState {
  pool: (Assembly | null)[];
  crane: { x: number; z: number; holding: Assembly | null };
  cart: CartState;
}

export const isFresh = (a: Assembly) => a.burnup < 0.5;

export const caskCapacity = (s: LogisticsState) => s.cart.capacity ?? CASK_CAPACITY;

export const slotName = (i: number) =>
  `${String.fromCharCode(65 + Math.floor(i / POOL_COLS))}${(i % POOL_COLS) + 1}`;

/** Start of a new game: six fresh assemblies, five old spent ones, the cart docked at the pool. */
export function initialLogistics(): LogisticsState {
  const pool: (Assembly | null)[] = Array.from({ length: POOL_SLOTS }, () => null);
  [1, 2, 3, 6, 7, 8].forEach((slot, k) => (pool[slot] = { id: `FA-${31 + k}`, burnup: 0 }));
  [15, 16, 17, 18, 19].forEach((slot, k) => (pool[slot] = { id: `SA-${11 + k}`, burnup: 0.97 + k * 0.005 }));
  return {
    pool,
    crane: { x: -6, z: -4.5, holding: null },
    cart: { room: 'fuel-storage', x: -0.6, z: -4.5, yaw: 0, attached: false, bay: 'pool-dock', cask: [] },
  };
}

export type CraneResult =
  { ok: true; picked?: Assembly; placed?: Assembly; where: 'pool' | 'cask' } | { ok: false; reason: string };

/** Hook over pool slot `i`: grab what's there, or release what the hook holds. */
export function craneAtSlot(s: LogisticsState, i: number): CraneResult {
  const held = s.crane.holding;
  const slot = s.pool[i];
  if (held && !slot) {
    s.pool[i] = held;
    s.crane.holding = null;
    return { ok: true, placed: held, where: 'pool' };
  }
  if (!held && slot) {
    s.crane.holding = slot;
    s.pool[i] = null;
    return { ok: true, picked: slot, where: 'pool' };
  }
  return { ok: false, reason: held ? 'That slot is occupied.' : 'Nothing in that slot.' };
}

/** Hook over the cart's cask: drop what the hook holds, or take one out (spent first). */
export function craneAtCask(s: LogisticsState): CraneResult {
  const held = s.crane.holding;
  const cask = s.cart.cask;
  if (held) {
    if (cask.length >= caskCapacity(s)) return { ok: false, reason: 'The cask is full.' };
    cask.push(held);
    s.crane.holding = null;
    return { ok: true, placed: held, where: 'cask' };
  }
  if (!cask.length) return { ok: false, reason: 'The cask is empty.' };
  const idx = Math.max(
    cask.findIndex((a) => !isFresh(a)),
    0,
  );
  const [picked] = cask.splice(idx, 1);
  s.crane.holding = picked!;
  return { ok: true, picked: picked!, where: 'cask' };
}

export function caskFresh(s: LogisticsState): Assembly | null {
  return s.cart.cask.find(isFresh) ?? null;
}

/** Refuelling machine: spent assembly from the core goes into the cask. */
export function caskReceive(s: LogisticsState, a: Assembly): boolean {
  if (s.cart.cask.length >= caskCapacity(s)) return false;
  s.cart.cask.push(a);
  return true;
}

/** Refuelling machine: take the fresh assembly out of the cask for loading. */
export function caskTakeFresh(s: LogisticsState): Assembly | null {
  const i = s.cart.cask.findIndex(isFresh);
  if (i < 0) return null;
  return s.cart.cask.splice(i, 1)[0]!;
}

/** Every assembly id in logistics (for conservation checks). */
export function allAssemblies(s: LogisticsState): string[] {
  return [
    ...s.pool.filter((a): a is Assembly => !!a).map((a) => a.id),
    ...(s.crane.holding ? [s.crane.holding.id] : []),
    ...s.cart.cask.map((a) => a.id),
  ];
}
