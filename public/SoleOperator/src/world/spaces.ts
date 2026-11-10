import { getCorridor, getNode, otherEnd } from './facility';
import { FACING_VEC, STUB_LENGTH, STUB_TRIGGER, rectUnion, stubRect, type SpaceLayout } from './geometry';
import type { Doorway, Rect, RoomDefinition, Vec2 } from './types';

/** What is mounted right now: one room, or one corridor being walked in a direction. */
export type Space = { kind: 'room'; room: string } | { kind: 'corridor'; corridor: string; from: string };

export type DoorState = 'open' | 'sealed' | 'locked';

export type Trigger =
  | { rect: Rect; action: { type: 'enterCorridor'; corridor: string } }
  | { rect: Rect; action: { type: 'arrive'; room: string; corridor: string } };

export interface BuiltSpace extends SpaceLayout {
  triggers: Trigger[];
}

/** Rooms that exist in the facility graph but have no playable folder yet are sealed. */
export function doorState(
  room: RoomDefinition,
  door: Doorway,
  isRoomBuilt: (id: string) => boolean,
): DoorState {
  const target = getNode(otherEnd(getCorridor(door.corridor), room.id));
  if (target.clearance) return 'locked';
  return isRoomBuilt(target.id) ? 'open' : 'sealed';
}

export function buildRoomSpace(room: RoomDefinition, isRoomBuilt: (id: string) => boolean): BuiltSpace {
  const walkable: Rect[] = [room.bounds];
  const triggers: Trigger[] = [];
  for (const door of room.doorways) {
    if (doorState(room, door, isRoomBuilt) !== 'open') continue;
    walkable.push(stubRect(room.bounds, door));
    triggers.push({
      rect: stubRect(room.bounds, door, STUB_LENGTH, STUB_TRIGGER),
      action: { type: 'enterCorridor', corridor: door.corridor },
    });
  }
  const b = room.bounds;
  return {
    walkable,
    obstacles: room.obstacles,
    triggers,
    frame: { minX: b.minX - 3, maxX: b.maxX + 3, minZ: b.minZ - 3, maxZ: b.maxZ + 3 },
  };
}

export const CORRIDOR_WIDTH = 4;

/** Geometry of a corridor walked from `from`: it starts at the origin and runs along `dir`. */
export interface CorridorFrame {
  corridor: string;
  from: string;
  to: string;
  length: number;
  dir: Vec2;
}

export function corridorFrame(corridorId: string, from: RoomDefinition): CorridorFrame {
  const c = getCorridor(corridorId);
  const door = from.doorways.find((d) => d.corridor === corridorId);
  const dir = door ? FACING_VEC[door.facing] : { x: -1, z: 0 };
  return { corridor: c.id, from: from.id, to: otherEnd(c, from.id), length: c.length, dir };
}

/** Distance walked along the corridor for a position. */
export function corridorT(frame: CorridorFrame, p: Vec2): number {
  return p.x * frame.dir.x + p.z * frame.dir.z;
}

export function corridorPoint(frame: CorridorFrame, t: number, side = 0): Vec2 {
  // `side` is a lateral offset (perpendicular to dir).
  return { x: frame.dir.x * t - frame.dir.z * side, z: frame.dir.z * t + frame.dir.x * side };
}

function rectAlong(frame: CorridorFrame, t0: number, t1: number, halfWidth: number): Rect {
  return rectUnion(
    [corridorPoint(frame, t0, -halfWidth), corridorPoint(frame, t1, halfWidth)].map((p) => ({
      minX: p.x,
      maxX: p.x,
      minZ: p.z,
      maxZ: p.z,
    })),
  );
}

export function buildCorridorSpace(frame: CorridorFrame): BuiltSpace {
  const half = CORRIDOR_WIDTH / 2;
  return {
    walkable: [rectAlong(frame, -3, frame.length + 3, half)],
    obstacles: [],
    triggers: [
      {
        rect: rectAlong(frame, -3, -1.2, half),
        action: { type: 'arrive', room: frame.from, corridor: frame.corridor },
      },
      {
        rect: rectAlong(frame, frame.length + 1.2, frame.length + 3, half),
        action: { type: 'arrive', room: frame.to, corridor: frame.corridor },
      },
    ],
    frame: rectAlong(frame, -6, frame.length + 6, half + 3),
  };
}
