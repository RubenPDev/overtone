import type { Doorway, Facing, Obstacle, Rect, RoomDefinition, Vec2 } from './types';

export const FACING_VEC: Record<Facing, Vec2> = {
  '+x': { x: 1, z: 0 },
  '-x': { x: -1, z: 0 },
  '+z': { x: 0, z: 1 },
  '-z': { x: 0, z: -1 },
};

/** Yaw (radians, three.js convention: rotation about +Y, 0 = facing +z) for a ground direction. */
export function yawOf(dir: Vec2): number {
  return Math.atan2(dir.x, dir.z);
}

export function rectContains(r: Rect, p: Vec2, inset = 0): boolean {
  return p.x >= r.minX + inset && p.x <= r.maxX - inset && p.z >= r.minZ + inset && p.z <= r.maxZ - inset;
}

export function rectCenter(r: Rect): Vec2 {
  return { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 };
}

export function rectUnion(rs: Rect[]): Rect {
  return {
    minX: Math.min(...rs.map((r) => r.minX)),
    maxX: Math.max(...rs.map((r) => r.maxX)),
    minZ: Math.min(...rs.map((r) => r.minZ)),
    maxZ: Math.max(...rs.map((r) => r.maxZ)),
  };
}

/** Centre of a doorway on its wall line, room-local. */
export function doorPosition(bounds: Rect, door: Doorway): Vec2 {
  const c = rectCenter(bounds);
  const o = door.offset ?? 0;
  switch (door.facing) {
    case '+x':
      return { x: bounds.maxX, z: c.z + o };
    case '-x':
      return { x: bounds.minX, z: c.z + o };
    case '+z':
      return { x: c.x + o, z: bounds.maxZ };
    case '-z':
      return { x: c.x + o, z: bounds.minZ };
  }
}

/** Length of the corridor stub drawn outside each open doorway. */
export const STUB_LENGTH = 14;
/** How far into the stub the player walks before the corridor transition starts. */
export const STUB_TRIGGER = 8;

/** The floor rectangle of a door's corridor stub outside the wall, from `start` to `length` metres out. */
export function stubRect(bounds: Rect, door: Doorway, length = STUB_LENGTH, start = 0): Rect {
  const p = doorPosition(bounds, door);
  const f = FACING_VEC[door.facing];
  const half = door.width / 2;
  const a = { x: p.x - (f.z !== 0 ? half : 0) + f.x * start, z: p.z - (f.x !== 0 ? half : 0) + f.z * start };
  const b = {
    x: p.x + (f.z !== 0 ? half : 0) + f.x * length,
    z: p.z + (f.x !== 0 ? half : 0) + f.z * length,
  };
  return {
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minZ: Math.min(a.z, b.z),
    maxZ: Math.max(a.z, b.z),
  };
}

/** Where a player arriving through `door` appears: just inside, facing into the room. */
export function arrivalPoint(room: RoomDefinition, doorId: string): { position: Vec2; facing: number } {
  const door = room.doorways.find((d) => d.id === doorId) ?? room.doorways[0]!;
  const p = doorPosition(room.bounds, door);
  const f = FACING_VEC[door.facing];
  return { position: { x: p.x - f.x * 2.2, z: p.z - f.z * 2.2 }, facing: yawOf({ x: -f.x, z: -f.z }) };
}

// --- Collision ---------------------------------------------------------------

/**
 * The walkable layout of whatever space is mounted (a room or a corridor):
 * the union of `walkable` rects minus obstacles. This is the seam where a
 * navmesh (recast-navigation-js) or a physics world (Rapier) plugs in later.
 */
export interface SpaceLayout {
  walkable: Rect[];
  obstacles: Obstacle[];
  /** Camera framing limits. */
  frame: Rect;
}

export const PLAYER_RADIUS = 0.4;

export function isWalkable(layout: SpaceLayout, p: Vec2, radius = PLAYER_RADIUS): boolean {
  // The player's disc must be covered by the union of walkable rects (room floor + door stubs).
  if (!pointInUnionWithMargin(layout.walkable, p, radius)) return false;
  for (const o of layout.obstacles) {
    if (o.kind === 'circle') {
      if ((p.x - o.x) ** 2 + (p.z - o.z) ** 2 < (o.r + radius) ** 2) return false;
    } else if (
      rectContains(
        {
          minX: o.rect.minX - radius,
          maxX: o.rect.maxX + radius,
          minZ: o.rect.minZ - radius,
          maxZ: o.rect.maxZ + radius,
        },
        p,
      )
    ) {
      return false;
    }
  }
  return true;
}

/** True if a disc of `radius` at p is covered by the union of rects (checks 8 points on the rim). */
function pointInUnionWithMargin(rects: Rect[], p: Vec2, radius: number): boolean {
  const covered = (q: Vec2) => rects.some((r) => rectContains(r, q));
  if (!covered(p)) return false;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (!covered({ x: p.x + Math.cos(a) * radius, z: p.z + Math.sin(a) * radius })) return false;
  }
  return true;
}

/** Moves from `from` by `delta`, sliding along walls/obstacles instead of stopping dead. */
export function slideMove(layout: SpaceLayout, from: Vec2, delta: Vec2): Vec2 {
  const full = { x: from.x + delta.x, z: from.z + delta.z };
  if (isWalkable(layout, full)) return full;
  const xOnly = { x: from.x + delta.x, z: from.z };
  if (Math.abs(delta.x) > 1e-6 && isWalkable(layout, xOnly)) return xOnly;
  const zOnly = { x: from.x, z: from.z + delta.z };
  if (Math.abs(delta.z) > 1e-6 && isWalkable(layout, zOnly)) return zOnly;
  return from;
}

// --- Navigation --------------------------------------------------------------

/**
 * Pathfinding seam. v0 walks in a straight line and lets slideMove handle walls.
 * A recast-navigation-js implementation can replace it without touching Player.
 */
export interface Navigator {
  /** Waypoints from `from` to `to` (excluding `from`), or null if unreachable. */
  findPath(from: Vec2, to: Vec2): Vec2[] | null;
}

export class StraightLineNavigator implements Navigator {
  constructor(private readonly layout: SpaceLayout) {}

  findPath(_from: Vec2, to: Vec2): Vec2[] | null {
    if (isWalkable(this.layout, to)) return [to];
    // Clicked on a wall/obstacle: aim for the closest walkable point nearby.
    for (let r = 0.5; r <= 3; r += 0.5) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const q = { x: to.x + Math.cos(a) * r, z: to.z + Math.sin(a) * r };
        if (isWalkable(this.layout, q)) return [q];
      }
    }
    return null;
  }
}
