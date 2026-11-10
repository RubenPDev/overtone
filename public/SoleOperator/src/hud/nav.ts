import { getRoom, isRoomBuilt } from '../rooms/registry';
import { clockOf } from '../sim';
import { NODES, getCorridor, getNode, otherEnd, routeTo, type GraphPosition } from '../world/facility';
import { doorPosition } from '../world/geometry';
import { corridorFrame, corridorPoint } from '../world/spaces';
import type { Vec2 } from '../world/types';

const S = Math.SQRT1_2;

/** Ground vector → angle on screen in degrees (0 = screen up, + = right) for the fixed iso camera. */
export function screenBearing(v: Vec2): number {
  const up = -(v.x + v.z) * S;
  const right = (v.x - v.z) * S;
  return (Math.atan2(right, up) * 180) / Math.PI;
}

/** Ground point → minimap plane (u right, v down), matching the camera's 45° view. */
export function toScreenPlane(p: Vec2): { u: number; v: number } {
  return { u: (p.x - p.z) * S, v: (p.x + p.z) * S };
}

/** Where in the current space the route to `target` leaves from (door or corridor end), local coords. */
export function exitPointToward(pos: GraphPosition, target: string): Vec2 | null {
  const r = routeTo(pos, target);
  if (!r.via) return null;
  if ('room' in pos) {
    if (!('corridor' in r.via) || !isRoomBuilt(pos.room)) return null;
    const room = getRoom(pos.room);
    const corridorId = r.via.corridor;
    const door = room.doorways.find((d) => d.corridor === corridorId);
    return door ? doorPosition(room.bounds, door) : null;
  }
  const frame = corridorFrame(pos.corridor, getRoom(pos.from));
  const end = (r.via as { end: string }).end;
  return corridorPoint(frame, end === pos.from ? -2 : frame.length + 2);
}

export interface CompassMarker {
  id: string;
  label: string;
  accent: string;
  dist: number;
  bearing: number;
  locked: boolean;
}

/** Compass markers: every other room with its walking distance and screen bearing. */
export function compassMarkers(pos: GraphPosition, player: Vec2): CompassMarker[] {
  const here = 'room' in pos ? pos.room : null;
  return NODES.filter((n) => n.kind === 'room' && n.id !== here).map((n) => {
    const exit = exitPointToward(pos, n.id);
    const r = routeTo(pos, n.id);
    return {
      id: n.id,
      label: n.short,
      accent: n.accent,
      dist: Math.round(r.dist + (exit ? Math.hypot(exit.x - player.x, exit.z - player.z) : 0)),
      bearing: exit ? screenBearing({ x: exit.x - player.x, z: exit.z - player.z }) : 0,
      locked: !!n.clearance,
    };
  });
}

export function placeName(pos: GraphPosition): string {
  if ('room' in pos) return getNode(pos.room).name;
  const c = getCorridor(pos.corridor);
  return `Corridor ${c.id} → ${getNode(otherEnd(c, pos.from)).name}`;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatClock(time: number) {
  const c = clockOf(time);
  return { hhmm: `${pad2(c.hours)}:${pad2(c.minutes)}`, day: c.day, shift: c.shift };
}

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
