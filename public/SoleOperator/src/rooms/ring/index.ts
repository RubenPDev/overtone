import type { Doorway, Interactable, Obstacle, RoomDefinition } from '../../world/types';

/**
 * Accelerator ring sector chambers (level B4). One template builds all eight:
 * a 44 m hall the beamline runs straight through, ring tunnel doors at both
 * ends, an optional access shaft, a shuttle stop, and station equipment for the
 * named sectors. Room-local: the beamline runs along x at BEAM_Z (back side).
 */
export const BEAM_Z = -3.6;
export const BEAM_Y = 1.25;
export const HALF_LENGTH = 22;
export const SHUTTLE = { x: -12, z: 5.3 };

export type Station = 'rf' | 'target' | 'detector' | 'linac' | 'dump' | null;

export interface SectorSpec {
  sector: number;
  name: string;
  station: Station;
  access?: { corridor: string; sign: string };
}

export const SECTORS: SectorSpec[] = [
  { sector: 1, name: 'RF Station', station: 'rf' },
  {
    sector: 2,
    name: 'Ring Sector 2',
    station: null,
    access: { corridor: 'A-2', sign: 'ACCESS A-2 · WATER' },
  },
  { sector: 3, name: 'Detector Hall', station: 'detector' },
  { sector: 4, name: 'Ring Sector 4', station: null },
  { sector: 5, name: 'Injector Linac', station: 'linac' },
  {
    sector: 6,
    name: 'Target Station',
    station: 'target',
    access: { corridor: 'A-1', sign: 'ACCESS A-1 · FUEL STORAGE' },
  },
  { sector: 7, name: 'Beam Dump', station: 'dump' },
  {
    sector: 8,
    name: 'Ring Sector 8',
    station: null,
    access: { corridor: 'A-3', sign: 'ACCESS A-3 · TURBINE HALL' },
  },
];

export const sectorId = (k: number) => `ring-s${k}`;
const wrap = (k: number) => ((k - 1 + 8) % 8) + 1;
/** Ring segment corridor between sector a and the next one clockwise. */
export const segmentId = (a: number) => `R-${a}${wrap(a + 1)}`;

/** Where each RF cavity sits along the RF Station's beamline. */
export const CAVITY_X = Array.from({ length: 8 }, (_, i) => -14.7 + i * 4.2);
export const TARGET_VESSEL = { x: 6.5, z: 3.3, r: 2.2 };
export const DETECTOR = { x: 0, r: 3.4 };

export function specFor(roomId: string): SectorSpec | undefined {
  return SECTORS.find((s) => sectorId(s.sector) === roomId);
}

function stationExtras(spec: SectorSpec): { interactables: Interactable[]; obstacles: Obstacle[] } {
  const interactables: Interactable[] = [];
  const obstacles: Obstacle[] = [];
  switch (spec.station) {
    case 'rf':
      interactables.push(
        {
          id: 'rf-console',
          kind: 'console',
          verb: 'TUNE',
          label: 'RF console',
          detail: 'Cavity tuning · sector 1',
          position: { x: 5, z: -0.6 },
          promptHeight: 2.0,
          radius: 1.6,
          action: { type: 'rfConsole' },
        },
        {
          id: 'drone-dock',
          kind: 'console',
          verb: 'LAUNCH',
          label: 'Rail drone',
          detail: 'Scan the cryomodules',
          position: { x: -18.5, z: -0.8 },
          promptHeight: 2.2,
          radius: 1.6,
          action: { type: 'droneDock' },
        },
      );
      obstacles.push({ kind: 'rect', rect: { minX: 4.4, maxX: 5.6, minZ: -2.3, maxZ: -1.3 } });
      break;
    case 'target':
      interactables.push({
        id: 'production',
        kind: 'console',
        verb: 'OPERATE',
        label: 'Target station',
        detail: 'Production runs · beam control',
        position: { x: 0.5, z: 2.4 },
        promptHeight: 2.0,
        radius: 1.6,
        action: { type: 'production' },
      });
      obstacles.push(
        { kind: 'circle', x: TARGET_VESSEL.x, z: TARGET_VESSEL.z, r: TARGET_VESSEL.r },
        { kind: 'rect', rect: { minX: 0, maxX: 1.0, minZ: 3.1, maxZ: 4.1 } },
      );
      break;
    case 'detector':
      interactables.push({
        id: 'research-console',
        kind: 'console',
        verb: 'OPERATE',
        label: 'Detector control',
        detail: 'Collider runs · research data',
        position: { x: 9, z: -0.6 },
        promptHeight: 2.0,
        radius: 1.6,
        action: { type: 'production' },
      });
      obstacles.push({ kind: 'rect', rect: { minX: -4.2, maxX: 4.2, minZ: -7, maxZ: 0.2 } });
      break;
    case 'dump':
      obstacles.push({ kind: 'rect', rect: { minX: 9, maxX: 17, minZ: -7, maxZ: -1.8 } });
      break;
    default:
      break;
  }
  return { interactables, obstacles };
}

export function makeSector(spec: SectorSpec): RoomDefinition {
  const k = spec.sector;
  const doorways: Doorway[] = [
    {
      id: 'ccw',
      facing: '-x',
      offset: 1.6,
      width: 4,
      corridor: segmentId(wrap(k - 1)),
      sign: `← S${wrap(k - 1)}`,
    },
    { id: 'cw', facing: '+x', offset: 1.6, width: 4, corridor: segmentId(k), sign: `S${wrap(k + 1)} →` },
  ];
  if (spec.access)
    doorways.push({
      id: 'access',
      facing: '+z',
      offset: 13,
      width: 4,
      corridor: spec.access.corridor,
      sign: spec.access.sign,
    });
  const extras = stationExtras(spec);
  return {
    id: sectorId(k),
    name: `${spec.name} · S${k}`,
    level: 'B4',
    bounds: { minX: -HALF_LENGTH, maxX: HALF_LENGTH, minZ: -7, maxZ: 7 },
    wallHeight: 6.5,
    floorLabel: `RING · SECTOR ${k}`,
    doorways,
    spawn: { position: { x: SHUTTLE.x + 2.5, z: 3.2 }, facing: Math.PI / 2 },
    interactables: [
      {
        id: 'shuttle',
        kind: 'shuttle',
        verb: 'RIDE',
        label: 'Ring shuttle',
        detail: 'Travel to any sector',
        position: { x: SHUTTLE.x, z: 3.7 },
        promptHeight: 2.4,
        radius: 1.8,
        action: { type: 'shuttle' },
      },
      ...extras.interactables,
    ],
    workstations: [],
    obstacles: [
      // The magnet string and its stands along the back of the hall.
      { kind: 'rect', rect: { minX: -HALF_LENGTH, maxX: HALF_LENGTH, minZ: -7, maxZ: BEAM_Z + 1.0 } },
      // Shuttle platform.
      { kind: 'rect', rect: { minX: SHUTTLE.x - 3.4, maxX: SHUTTLE.x + 3.4, minZ: 4.5, maxZ: 7 } },
      ...extras.obstacles,
    ],
    focus: {
      rf: { x: -1, z: -2, zoom: 1.45 },
      production: { x: spec.station === 'detector' ? 4 : 3.5, z: 0.5, zoom: 1.5 },
      shuttle: { x: SHUTTLE.x, z: 3, zoom: 1.7 },
    },
    load: () => import('./Contents'),
  };
}

export const ringSectors: RoomDefinition[] = SECTORS.map(makeSector);
