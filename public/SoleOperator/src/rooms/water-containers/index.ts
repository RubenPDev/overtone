import type { Interactable, Obstacle, RoomDefinition, Vec2 } from '../../world/types';

/**
 * Water Containers: the demineralised water tank farm. Four 2,000 m³ tanks stand
 * along the back wall, with two reserved pads along the west wall for the
 * upgrade tanks. Tall things stay against the back walls so they never hide
 * the floor from the iso camera; the treatment skid, make-up pumps and the
 * ops panel sit on the open floor.
 */
export const TANK_R = 3.0;
export const TANK_H = 7.2;

export interface TankSpot extends Vec2 {
  /** Direction the tank's service side faces (radians, 0 = +z, π/2 = +x). */
  face: number;
  /** Service station (valve wheel + local panel). */
  station: Vec2;
}

const back = (x: number): TankSpot => ({ x, z: -11, face: 0, station: { x: x + 1.6, z: -7.3 } });
const west = (z: number): TankSpot => ({ x: -13, z, face: Math.PI / 2, station: { x: -9.3, z: z + 1.6 } });

/** Tank positions by index: T-1…T-4 along the back, T-5 and T-6 on the west pads. */
export const TANKS: TankSpot[] = [back(-11.5), back(-4.5), back(2.5), back(9.5), west(1.5), west(9)];

export const PROPS = {
  panel: { x: 13.6, z: -6.2 },
  skid: { minX: 10.5, maxX: 16.2, minZ: 2, maxZ: 12.5 },
  pumps: [
    { x: 3.5, z: 11.6 },
    { x: 7.0, z: 11.6 },
  ] as Vec2[],
  eyewash: { x: 16.7, z: 0.4 },
  extinguisher: { x: -16.7, z: -6.2 },
};

export const WORKERS = {
  skid: { x: 9.6, z: 7, yaw: Math.PI / 2, name: 'Imani Okafor', role: 'Water chemistry' },
  patrol: [
    { x: -4, z: -4.5 },
    { x: 8, z: -4.5 },
    { x: 8, z: 4 },
    { x: -5, z: 4 },
  ] as Vec2[],
};

const tankName = (i: number) => `T-${i + 1}`;

const stations: Interactable[] = TANKS.map((t, i) => ({
  id: `tank-${i + 1}`,
  kind: 'tank',
  verb: 'SERVICE',
  label: `Tank ${tankName(i)}`,
  detail: 'Outlet valve · weld patch',
  position:
    t.face === 0 ? { x: t.station.x, z: t.station.z + 1.0 } : { x: t.station.x + 1.0, z: t.station.z },
  promptHeight: 1.9,
  radius: 1.4,
  action: { type: 'tankStation', tank: i },
}));

const obstacles: Obstacle[] = [
  ...TANKS.map((t): Obstacle => ({ kind: 'circle', x: t.x, z: t.z, r: TANK_R + 0.35 })),
  ...TANKS.map((t): Obstacle => ({
    kind: 'rect',
    rect: {
      minX: t.station.x - 0.5,
      maxX: t.station.x + 0.5,
      minZ: t.station.z - 0.5,
      maxZ: t.station.z + 0.5,
    },
  })),
  { kind: 'rect', rect: PROPS.skid },
  ...PROPS.pumps.map((p): Obstacle => ({
    kind: 'rect',
    rect: { minX: p.x - 1.2, maxX: p.x + 1.2, minZ: p.z - 0.8, maxZ: 15 },
  })),
  {
    kind: 'rect',
    rect: {
      minX: PROPS.panel.x - 0.8,
      maxX: PROPS.panel.x + 0.8,
      minZ: PROPS.panel.z - 0.5,
      maxZ: PROPS.panel.z + 0.5,
    },
  },
];

export const waterContainers: RoomDefinition = {
  id: 'water-containers',
  name: 'Water Containers',
  level: 'B2',
  bounds: { minX: -17, maxX: 17, minZ: -15, maxZ: 15 },
  wallHeight: 9,
  floorLabel: 'WATER CONTAINERS',
  doorways: [
    { id: 'control', facing: '-x', offset: -4, width: 4, corridor: 'C-3', sign: 'REACTOR CONTROL' },
    { id: 'ring', facing: '+x', offset: -3, width: 4, corridor: 'A-2', sign: 'ACCESS A-2 · RING B4' },
  ],
  spawn: { position: { x: -13.5, z: -4 }, facing: Math.PI / 2 },
  interactables: [
    ...stations,
    {
      id: 'water-panel',
      kind: 'console',
      verb: 'OPERATE',
      label: 'Water ops panel',
      detail: 'Reserve, valves and leak detection',
      position: { x: PROPS.panel.x, z: PROPS.panel.z + 1.3 },
      promptHeight: 2.0,
      radius: 1.6,
      action: { type: 'tankStation', tank: -1 },
    },
    {
      id: 'npc-imani',
      kind: 'npc',
      verb: 'TALK',
      label: WORKERS.skid.name,
      detail: WORKERS.skid.role,
      position: { x: WORKERS.skid.x - 0.6, z: WORKERS.skid.z },
      promptHeight: 2.2,
      radius: 1.5,
      action: {
        type: 'talk',
        line: 'Conductivity’s at 0.06 µS. If a tank weeps, close its valve before you weld. The plant draws from every open tank.',
      },
    },
    {
      id: 'eyewash',
      kind: 'safety',
      verb: 'TEST',
      label: 'Eyewash station',
      detail: 'Weekly flow check',
      position: { x: PROPS.eyewash.x - 1.0, z: PROPS.eyewash.z },
      promptHeight: 1.9,
      radius: 1.3,
      action: { type: 'message', text: 'Eyewash station · flow OK', detail: 'Weekly check logged.' },
    },
    {
      id: 'extinguisher',
      kind: 'safety',
      verb: 'CHECK',
      label: 'Fire extinguisher',
      position: { x: PROPS.extinguisher.x + 0.9, z: PROPS.extinguisher.z },
      promptHeight: 1.6,
      radius: 1.2,
      action: { type: 'message', text: 'Fire extinguisher · inspected', detail: 'Gauge in the green.' },
    },
  ],
  workstations: [],
  obstacles,
  focus: { tanks: { x: 0, z: -6, zoom: 1.5 } },
  load: () => import('./Contents'),
};

/** Camera framing for one tank's station. */
export function tankFocus(i: number) {
  const t = TANKS[i]!;
  return t.face === 0 ? { x: t.x + 0.8, z: t.z + 4.5, zoom: 1.7 } : { x: t.x + 4.5, z: t.z + 0.8, zoom: 1.7 };
}
