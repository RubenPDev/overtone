import type { Obstacle, RoomDefinition } from '../../world/types';

/** Rack rows: three long racks running along z. Placeholder until the fuel-handling milestone. */
export const RACK_ROWS = [-6, -1, 4].map((x) => ({ x, z0: -6.5, z1: 5.5, width: 1.6 }));

const rackObstacles: Obstacle[] = RACK_ROWS.map((r) => ({
  kind: 'rect',
  rect: { minX: r.x - r.width / 2, maxX: r.x + r.width / 2, minZ: r.z0, maxZ: r.z1 },
}));

export const fuelStorage: RoomDefinition = {
  id: 'fuel-storage',
  name: 'Fuel Rod Storage',
  level: 'B2',
  bounds: { minX: -12, maxX: 12, minZ: -10, maxZ: 10 },
  wallHeight: 7,
  floorLabel: 'FUEL STORAGE',
  doorways: [
    { id: 'control', facing: '+x', width: 4, corridor: 'C-1', sign: 'REACTOR CONTROL' },
    { id: 'accelerator', facing: '-z', width: 4, corridor: 'C-7', sign: 'ACCELERATOR · L8' },
  ],
  spawn: { position: { x: 8, z: 0 }, facing: -Math.PI / 2 },
  interactables: [
    {
      id: 'fuel-rack',
      kind: 'rack',
      verb: 'TAKE',
      label: 'Fresh fuel assembly',
      detail: 'Rack 2 · ready for loading',
      position: { x: 1.8, z: 0 },
      promptHeight: 2.2,
      radius: 1.8,
      action: { type: 'takeAssembly' },
    },
  ],
  workstations: [],
  obstacles: rackObstacles,
  load: () => import('./Contents'),
};
