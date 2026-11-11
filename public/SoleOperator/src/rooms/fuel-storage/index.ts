import { POOL_COLS, POOL_ROWS } from '../../logistics';
import type { CartBay, Obstacle, RoomDefinition, Vec2, Workstation } from '../../world/types';

/** Spent-fuel pool: sunken, water at POOL_WATER_Y, racks on the bottom. Room-local metres. */
export const POOL = { minX: -12.4, maxX: -1.8, minZ: -9.8, maxZ: 0.8 };
export const POOL_CENTER = { x: (POOL.minX + POOL.maxX) / 2, z: (POOL.minZ + POOL.maxZ) / 2 };
export const POOL_WATER_Y = -0.35;
export const POOL_FLOOR_Y = -4.2;
/** Height of an assembly's top (the crane grabs here) when racked underwater. */
export const RACK_TOP_Y = -2.5;
export const SLOT_PITCH = { x: 1.8, z: 1.9 };

export function slotPosition(i: number): Vec2 {
  const col = i % POOL_COLS;
  const row = Math.floor(i / POOL_COLS);
  return {
    x: POOL_CENTER.x + (col - (POOL_COLS - 1) / 2) * SLOT_PITCH.x,
    z: POOL_CENTER.z + (row - (POOL_ROWS - 1) / 2) * SLOT_PITCH.z,
  };
}

/** Bridge crane: the hook can travel anywhere over the pool and the cask dock. */
export const CRANE = {
  minX: -11.4,
  maxX: 0.2,
  minZ: -8.6,
  maxZ: -0.4,
  railZ: [-10.4, 1.4] as const,
  railY: 6.3,
  hookTopY: 5.2,
};

export const POOL_DOCK: CartBay = { id: 'pool-dock', label: 'CASK DOCK', x: -0.6, z: -4.5, yaw: 0 };
/** Top of the cask on a docked cart (the crane lowers to here). */
export const CASK_TOP_Y = 1.55;

export const PROPS = {
  craneConsole: { x: 1.9, z: -8.2 },
  inventoryDesk: { x: 9.5, z: -10.25 },
  eyewash: { x: 12.6, z: -10.72 },
  extinguisher: { x: -13.72, z: 4.2 },
  portal: { x: 12.2, z: 0 },
  casks: [
    [-10.2, 8],
    [-7.4, 8],
    [-4.6, 8],
  ] as [number, number][],
};

export const WORKERS = {
  seated: { x: 9.5, z: -9.15, yaw: Math.PI, name: 'Kai Lindqvist', role: 'Fuel inventory' },
  standing: { x: -5.2, z: 1.75, yaw: Math.PI, name: 'Rosa Medina', role: 'Pool supervisor' },
  /** Patrol loop for the walking technician. */
  patrol: [
    { x: 4, z: 5 },
    { x: 11, z: 5 },
    { x: 11, z: -5.5 },
    { x: 4, z: -5.5 },
  ] as Vec2[],
};

const workstations: Workstation[] = [
  {
    id: 'inventory',
    position: WORKERS.seated,
    facing: WORKERS.seated.yaw,
    role: WORKERS.seated.role,
    staff: WORKERS.seated.name,
  },
];

const obstacles: Obstacle[] = [
  {
    kind: 'rect',
    rect: { minX: POOL.minX - 0.25, maxX: POOL.maxX + 0.25, minZ: POOL.minZ - 0.25, maxZ: POOL.maxZ + 0.25 },
  },
  { kind: 'rect', rect: { minX: 1.3, maxX: 2.5, minZ: -9.0, maxZ: -7.4 } },
  { kind: 'rect', rect: { minX: 8.3, maxX: 10.7, minZ: -11, maxZ: -9.5 } },
  ...PROPS.casks.map(([x, z]): Obstacle => ({ kind: 'circle', x, z, r: 1.0 })),
];

export const fuelStorage: RoomDefinition = {
  id: 'fuel-storage',
  name: 'Fuel Rod Storage',
  level: 'B2',
  bounds: { minX: -14, maxX: 14, minZ: -11, maxZ: 11 },
  wallHeight: 7.5,
  floorLabel: 'FUEL ROD STORAGE',
  doorways: [
    { id: 'control', facing: '+x', width: 4, corridor: 'C-1', sign: 'REACTOR CONTROL' },
    { id: 'ring', facing: '-z', offset: 5, width: 4, corridor: 'A-1', sign: 'ACCESS A-1 · RING B4' },
  ],
  spawn: { position: { x: 10, z: 0 }, facing: -Math.PI / 2 },
  interactables: [
    {
      id: 'crane-console',
      kind: 'console',
      verb: 'OPERATE',
      label: 'Fuel crane',
      detail: 'Pool bridge crane controls',
      position: { x: PROPS.craneConsole.x + 1.0, z: PROPS.craneConsole.z },
      promptHeight: 1.9,
      radius: 1.6,
      action: { type: 'crane' },
    },
    {
      id: 'inventory',
      kind: 'console',
      verb: 'READ',
      label: 'Fuel inventory',
      detail: 'Pool rack manifest',
      position: { x: PROPS.inventoryDesk.x + 1.6, z: PROPS.inventoryDesk.z + 1.3 },
      promptHeight: 1.9,
      radius: 1.3,
      action: { type: 'inventory' },
    },
    {
      id: 'npc-kai',
      kind: 'npc',
      verb: 'TALK',
      label: WORKERS.seated.name,
      detail: WORKERS.seated.role,
      position: { x: WORKERS.seated.x - 0.6, z: WORKERS.seated.z + 0.6 },
      promptHeight: 2.0,
      radius: 1.4,
      action: {
        type: 'talk',
        line: 'Fresh assemblies are in rows A and B. Green tops. Don’t mix them up with the blue ones.',
      },
    },
    {
      id: 'npc-rosa',
      kind: 'npc',
      verb: 'TALK',
      label: WORKERS.standing.name,
      detail: WORKERS.standing.role,
      position: { x: WORKERS.standing.x + 0.2, z: WORKERS.standing.z + 0.4 },
      promptHeight: 2.2,
      radius: 1.6,
      action: {
        type: 'talk',
        line: 'Crane’s yours. Lower slow, and the cask on the dock takes two at a time.',
      },
    },
    {
      id: 'eyewash',
      kind: 'safety',
      verb: 'TEST',
      label: 'Eyewash station',
      detail: 'Weekly flow check',
      position: { x: PROPS.eyewash.x, z: PROPS.eyewash.z + 1.1 },
      promptHeight: 1.9,
      radius: 1.3,
      action: {
        type: 'message',
        text: 'Eyewash station · flow OK',
        detail: 'Both nozzles clear. Weekly check logged.',
      },
    },
    {
      id: 'extinguisher',
      kind: 'safety',
      verb: 'CHECK',
      label: 'Fire extinguisher',
      position: { x: PROPS.extinguisher.x + 0.9, z: PROPS.extinguisher.z },
      promptHeight: 1.6,
      radius: 1.2,
      action: {
        type: 'message',
        text: 'Fire extinguisher · inspected',
        detail: 'Gauge in the green. Tag signed.',
      },
    },
  ],
  workstations,
  obstacles,
  floorHoles: [POOL],
  cartBays: [POOL_DOCK],
  focus: { crane: { x: POOL_CENTER.x + 1.6, z: POOL_CENTER.z + 0.6, zoom: 1.75 } },
  load: () => import('./Contents'),
};
