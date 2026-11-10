import type { ComponentType } from 'react';
import { lazy } from 'react';
import { controlRoom } from './control-room';
import { fuelStorage } from './fuel-storage';
import { ringSectors } from './ring';
import { waterContainers } from './water-containers';
import { turbineHall } from './turbine-hall';
import type { RoomContentsProps, RoomDefinition } from '../world/types';

/**
 * Every playable room. To add one: create src/rooms/<id>/ with an index.ts that
 * exports a RoomDefinition and a Contents.tsx, then add it to this list.
 * The id must match a node in world/facility.ts.
 */
const ALL: RoomDefinition[] = [controlRoom, fuelStorage, waterContainers, turbineHall, ...ringSectors];

export const ROOMS: ReadonlyMap<string, RoomDefinition> = new Map(ALL.map((r) => [r.id, r]));

export const START_ROOM = controlRoom.id;

export function getRoom(id: string): RoomDefinition {
  const r = ROOMS.get(id);
  if (!r) throw new Error(`Room "${id}" is not registered`);
  return r;
}

export const isRoomBuilt = (id: string) => ROOMS.has(id);

/** React.lazy wrappers, created once per room so remounts reuse the loaded chunk. */
const lazyContents = new Map<string, ComponentType<RoomContentsProps>>();
export function roomContents(room: RoomDefinition): ComponentType<RoomContentsProps> {
  let c = lazyContents.get(room.id);
  if (!c) lazyContents.set(room.id, (c = lazy(room.load)));
  return c;
}

/** Start fetching a room's code before it's needed (e.g. while walking its corridor). */
export function preloadRoom(id: string): Promise<unknown> {
  return ROOMS.get(id)?.load() ?? Promise.resolve();
}
