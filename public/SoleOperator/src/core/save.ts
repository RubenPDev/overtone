import type { SimSnapshot } from '../sim';

/**
 * Save games: versioned JSON in localStorage.
 *
 * When the save shape changes: bump SAVE_VERSION, change SaveData, and add a
 * migration MIGRATIONS[oldVersion] that turns an old save into the next version.
 * Old saves then upgrade step by step on load.
 */
export const SAVE_VERSION = 1;
const PREFIX = 'sole-operator:save:';

export type SaveSlot = 'auto' | 'manual';

export interface WorldSave {
  room: string;
  player: { x: number; z: number };
  carrying: string | null;
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
  // 1: (old) => ({ ...old, version: 2, newField: defaultValue }),
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
