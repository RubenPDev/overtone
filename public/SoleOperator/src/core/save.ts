import { initialLogistics, type LogisticsState } from '../logistics';
import {
  Rng,
  createAccelState,
  createEconState,
  createTurbineState,
  createWaterState,
  type RngState,
  type SimSnapshot,
} from '../sim';

/**
 * Save games: versioned JSON in localStorage.
 *
 * When the save shape changes: bump SAVE_VERSION, change SaveData, and add a
 * migration MIGRATIONS[oldVersion] that turns an old save into the next version.
 * Old saves then upgrade step by step on load.
 */
export const SAVE_VERSION = 4;
const PREFIX = 'sole-operator:save:';

export type SaveSlot = 'auto' | 'manual';

export interface WorldSave {
  room: string;
  player: { x: number; z: number };
  focus: number;
  dose: number;
}

export interface ObjectiveSave {
  active: string | null;
  step: number;
  completed: string[];
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  savedAt: string;
  seed: string;
  sim: SimSnapshot;
  world: WorldSave;
  objectives: ObjectiveSave;
  /** Fuel outside the core: pool, crane, transfer cart (added in v2). */
  logistics: LogisticsState;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type AnySave = { version: number } & Record<string, unknown>;
export type Migration = (old: AnySave) => AnySave;

/** MIGRATIONS[n] upgrades a version-n save to version n+1. */
export const MIGRATIONS: Record<number, Migration> = {
  /**
   * v1 → v2: fuel moved from the player's hands to the transfer cart. An assembly
   * the player was carrying ends up in the cart's cask, parked where they stood.
   */
  1: (old) => {
    const world = old.world as { room: string; player: { x: number; z: number }; carrying?: string | null };
    const logistics = initialLogistics();
    if (world.carrying) {
      const id = world.carrying;
      logistics.pool = logistics.pool.map((a) => (a?.id === id ? null : a));
      logistics.cart = {
        ...logistics.cart,
        room: world.room,
        x: world.player.x + 1.5,
        z: world.player.z,
        bay: null,
      };
      logistics.cart.cask = [{ id, burnup: 0 }];
    }
    return {
      ...old,
      version: 2,
      world: { room: world.room, player: world.player, focus: 0.88, dose: 0 },
      logistics,
    };
  },
  /**
   * v2 → v3: the particle accelerator joined the sim (sim schema 2). Old saves get
   * a freshly commissioned ring; the old 'particle-accelerator' room no longer exists.
   */
  2: (old) => {
    const sim = old.sim as { schema: number; state: Record<string, unknown>; rng: RngState };
    const accel = createAccelState(Rng.fromState(sim.rng));
    const output = (sim.state.output as number) ?? 0;
    const world = old.world as { room: string };
    return {
      ...old,
      version: 3,
      sim: { ...sim, schema: 2, state: { ...sim.state, accel, netOutput: output - accel.powerDraw } },
      world: world.room === 'particle-accelerator' ? { ...world, room: 'fuel-storage' } : world,
    };
  },
  /**
   * v3 → v4: economy, progression and the water reserve (sim schema 3). Old saves
   * start with the opening balance, keep their clearance (L3 in v3) and get a
   * freshly filled tank farm.
   */
  3: (old) => {
    const sim = old.sim as { schema: number; state: Record<string, unknown>; rng: RngState };
    const water = createWaterState(Rng.fromState(sim.rng));
    return {
      ...old,
      version: 4,
      sim: {
        ...sim,
        schema: 3,
        state: { ...sim.state, econ: createEconState(), water, turbine: createTurbineState() },
      },
    };
  },
};

export function migrate(raw: AnySave, migrations = MIGRATIONS, target = SAVE_VERSION): AnySave | null {
  let data = raw;
  while (data.version < target) {
    const step = migrations[data.version];
    if (!step) return null;
    const next = step(data);
    if (next.version !== data.version + 1) return null;
    data = next;
  }
  return data.version === target ? data : null;
}

function looksValid(d: AnySave): d is AnySave & SaveData {
  const s = d as unknown as SaveData;
  return (
    typeof s.seed === 'string' &&
    !!s.sim &&
    typeof s.sim.schema === 'number' &&
    !!s.world &&
    typeof s.world.room === 'string' &&
    !!s.objectives
  );
}

export function defaultStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    const probe = `${PREFIX}probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function writeSave(storage: StorageLike | null, slot: SaveSlot, data: SaveData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PREFIX + slot, JSON.stringify(data));
    return true;
  } catch {
    return false; // quota, private mode…
  }
}

export function readSave(
  storage: StorageLike | null,
  slot: SaveSlot,
  migrations = MIGRATIONS,
  target = SAVE_VERSION,
): SaveData | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFIX + slot);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnySave;
    if (typeof parsed?.version !== 'number') return null;
    const data = migrate(parsed, migrations, target);
    return data && looksValid(data) ? (data as unknown as SaveData) : null;
  } catch {
    return null;
  }
}

/** The most recent valid save across slots, for "Continue". */
export function latestSave(storage: StorageLike | null): { slot: SaveSlot; data: SaveData } | null {
  const found = (['auto', 'manual'] as const)
    .map((slot) => ({ slot, data: readSave(storage, slot) }))
    .filter((x): x is { slot: SaveSlot; data: SaveData } => !!x.data)
    .sort((a, b) => b.data.savedAt.localeCompare(a.data.savedAt));
  return found[0] ?? null;
}

export function deleteSaves(storage: StorageLike | null): void {
  if (!storage) return;
  for (const slot of ['auto', 'manual']) storage.removeItem(PREFIX + slot);
}
