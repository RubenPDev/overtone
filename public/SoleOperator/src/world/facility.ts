/**
 * The plant layout: every room (built or not), junctions and corridors with their
 * in-world lengths. This feeds the compass, minimap, map screen and (later)
 * long-range pathfinding. Plant corridors C-1..C-6 follow docs/design/facility-map-v2.png;
 * the accelerator ring (facility-map-v3, ring level B4) is eight 425 m tunnel
 * segments around the whole plant, reached by access shafts A-1..A-3.
 *
 * `map` positions are in map-plane metres using the same axes as rooms
 * (+x screen down-right, +z screen down-left); they only affect drawing.
 */
export interface FacilityNode {
  id: string;
  kind: 'room' | 'junction';
  name: string;
  short: string;
  /** CSS colour for map/compass. */
  accent: string;
  map: { x: number; z: number; w: number; d: number };
  /** Clearance level needed to enter (0 = none). */
  clearance?: number;
  /** Ring sector number (1-8) for accelerator sector chambers. */
  sector?: number;
  /** Named ring stations show on the compass and map list; plain junction sectors don't. */
  station?: boolean;
}

export interface Corridor {
  id: string;
  a: string;
  b: string;
  /** Walking length in metres. */
  length: number;
  /** Service corridors (plant level), access shafts down to the ring, or ring tunnel segments. */
  kind?: 'service' | 'access' | 'ring';
}

/** Ring geometry on the map plane (drawing only). */
export const RING_MAP = { cx: -10, cz: -20, r: 330 };
export const RING_SEGMENT_M = 425;

const RING_SECTORS = [
  { name: 'RF Station · S1', short: 'RF STATION', accent: '#6dffb6', station: true },
  { name: 'Ring Sector 2', short: 'S2', accent: '#a58cff', station: false },
  { name: 'Detector Hall · S3', short: 'DETECTOR', accent: '#ff7ad9', station: true },
  { name: 'Ring Sector 4', short: 'S4', accent: '#a58cff', station: false },
  { name: 'Injector Linac · S5', short: 'LINAC', accent: '#f2d25f', station: true },
  { name: 'Target Station · S6', short: 'TARGET', accent: '#5fe3ff', station: true },
  { name: 'Beam Dump · S7', short: 'BEAM DUMP', accent: '#ff9a4a', station: true },
  { name: 'Ring Sector 8', short: 'S8', accent: '#a58cff', station: false },
];

export const NODES: FacilityNode[] = [
  {
    id: 'control-room',
    kind: 'room',
    name: 'Reactor Control',
    short: 'CONTROL',
    accent: '#5fe3ff',
    map: { x: 0, z: 0, w: 64, d: 64 },
  },
  {
    id: 'fuel-storage',
    kind: 'room',
    name: 'Fuel Rod Storage',
    short: 'FUEL STORAGE',
    accent: '#a8f05a',
    map: { x: -150, z: 0, w: 70, d: 64 },
  },
  {
    id: 'turbine-hall',
    kind: 'room',
    name: 'Steam Turbine Hall',
    short: 'TURBINE HALL',
    accent: '#ffb35c',
    map: { x: 0, z: -215, w: 90, d: 150 },
  },
  {
    id: 'water-containers',
    kind: 'room',
    name: 'Water Containers',
    short: 'WATER',
    accent: '#4fa3ff',
    map: { x: 185, z: 0, w: 90, d: 90 },
  },
  {
    id: 'junction-south',
    kind: 'junction',
    name: 'Junction J-1',
    short: 'J-1',
    accent: '#64768a',
    map: { x: 0, z: 175, w: 8, d: 8 },
  },
  {
    id: 'cafeteria',
    kind: 'room',
    name: 'Cafeteria',
    short: 'CAFETERIA',
    accent: '#ff7aa8',
    map: { x: -150, z: 175, w: 80, d: 80 },
  },
  {
    id: 'cooling-chambers',
    kind: 'room',
    name: 'Cooling Chambers',
    short: 'COOLING',
    accent: '#5fe3d0',
    map: { x: 160, z: 175, w: 90, d: 90 },
  },
  ...RING_SECTORS.map((r, k): FacilityNode => {
    // Sectors sit on a circle round the plant; S1 east (screen right), clockwise on screen.
    const a = (k * Math.PI) / 4;
    const right = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
    const down = { x: Math.SQRT1_2, z: Math.SQRT1_2 };
    return {
      id: `ring-s${k + 1}`,
      kind: 'room',
      name: r.name,
      short: r.short,
      accent: r.accent,
      sector: k + 1,
      station: r.station,
      map: {
        x: RING_MAP.cx + RING_MAP.r * (Math.cos(a) * right.x + Math.sin(a) * down.x),
        z: RING_MAP.cz + RING_MAP.r * (Math.cos(a) * right.z + Math.sin(a) * down.z),
        w: r.station ? 34 : 16,
        d: r.station ? 34 : 16,
      },
    };
  }),
];

export const CORRIDORS: Corridor[] = [
  { id: 'C-1', a: 'control-room', b: 'fuel-storage', length: 140 },
  { id: 'C-2', a: 'control-room', b: 'turbine-hall', length: 210 },
  { id: 'C-3', a: 'control-room', b: 'water-containers', length: 180 },
  { id: 'C-4', a: 'control-room', b: 'junction-south', length: 170 },
  { id: 'C-5', a: 'junction-south', b: 'cafeteria', length: 160 },
  { id: 'C-6', a: 'junction-south', b: 'cooling-chambers', length: 160 },
  // Access shafts down to ring level B4.
  { id: 'A-1', a: 'fuel-storage', b: 'ring-s6', length: 220, kind: 'access' },
  { id: 'A-2', a: 'water-containers', b: 'ring-s2', length: 180, kind: 'access' },
  { id: 'A-3', a: 'turbine-hall', b: 'ring-s8', length: 300, kind: 'access' },
  // Ring tunnel: R-12 joins S1 and S2, ..., R-81 closes the loop.
  ...Array.from({ length: 8 }, (_, k): Corridor => ({
    id: `R-${k + 1}${((k + 1) % 8) + 1}`,
    a: `ring-s${k + 1}`,
    b: `ring-s${((k + 1) % 8) + 1}`,
    length: RING_SEGMENT_M,
    kind: 'ring',
  })),
];

const nodeById = new Map(NODES.map((n) => [n.id, n]));
const corridorById = new Map(CORRIDORS.map((c) => [c.id, c]));

export function getNode(id: string): FacilityNode {
  const n = nodeById.get(id);
  if (!n) throw new Error(`Unknown facility node ${id}`);
  return n;
}

export function getCorridor(id: string): Corridor {
  const c = corridorById.get(id);
  if (!c) throw new Error(`Unknown corridor ${id}`);
  return c;
}

export function otherEnd(corridor: Corridor, from: string): string {
  return corridor.a === from ? corridor.b : corridor.a;
}

export const ROOM_NODES = NODES.filter((n) => n.kind === 'room');

export const TOTAL_CORRIDOR_M = CORRIDORS.reduce((a, c) => a + c.length, 0);

/** Shortest walking distance (m) from `source` to every node, and the first corridor to take. */
export function shortestPaths(source: string): Map<string, { dist: number; via: string | null }> {
  const result = new Map<string, { dist: number; via: string | null }>();
  const open = new Map<string, { dist: number; via: string | null }>([[source, { dist: 0, via: null }]]);
  while (open.size) {
    let bestId = '';
    let best = { dist: Infinity, via: null as string | null };
    for (const [id, v] of open) if (v.dist < best.dist) [bestId, best] = [id, v];
    open.delete(bestId);
    result.set(bestId, best);
    for (const c of CORRIDORS) {
      if (c.a !== bestId && c.b !== bestId) continue;
      const next = otherEnd(c, bestId);
      if (result.has(next)) continue;
      const d = best.dist + c.length;
      const via = best.via ?? c.id;
      const cur = open.get(next);
      if (!cur || d < cur.dist) open.set(next, { dist: d, via });
    }
  }
  return result;
}

/**
 * Where the player is in the facility graph: inside a room, or `t` metres along
 * a corridor walking from `from`.
 */
export type GraphPosition = { room: string } | { corridor: string; from: string; t: number };

export interface Route {
  dist: number;
  /** In a room: the corridor to leave by. In a corridor: which end to head for. */
  via: { corridor: string } | { end: string } | null;
}

/** Distance and first step from the player's graph position to a target node. */
export function routeTo(pos: GraphPosition, target: string): Route {
  if ('room' in pos) {
    const p = shortestPaths(pos.room).get(target);
    return p ? { dist: p.dist, via: p.via ? { corridor: p.via } : null } : { dist: Infinity, via: null };
  }
  const c = getCorridor(pos.corridor);
  const to = otherEnd(c, pos.from);
  const back = pos.t + (shortestPaths(pos.from).get(target)?.dist ?? Infinity);
  const fwd = c.length - pos.t + (shortestPaths(to).get(target)?.dist ?? Infinity);
  return fwd <= back ? { dist: fwd, via: { end: to } } : { dist: back, via: { end: pos.from } };
}
