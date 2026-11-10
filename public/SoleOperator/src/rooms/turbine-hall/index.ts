import type { Interactable, Obstacle, RoomDefinition, Vec2 } from '../../world/types';

/**
 * Steam Turbine Hall B (after docs/design turbine hall mockup). A long hall with
 * tall windows on the back wall. The turbine train runs along x on a low
 * plinth: HP turbine → LP rotor A (hood off for inspection) → bearing B3 →
 * LP B → generator → exciter, with the lube oil skid at the far end. The
 * condenser, feed pumps and the removed LP hood sit on the open floor in front.
 * Everything you work on is reached from the walkway along the plinth's front.
 */
export const SHAFT_Z = -3;
export const SHAFT_Y = 2.3;
export const PLINTH = { minX: -22, maxX: 25.5, minZ: -6.6, maxZ: 0.4, h: 0.6 };

/** Train layout along x (room-local). */
export const TRAIN = {
  hp: { x0: -20, x1: -12.5, r: 1.7 },
  lpA: { x0: -9.8, x1: 0.2, r: 2.5 },
  lpB: { x0: 2.8, x1: 11.6, r: 2.6 },
  gen: { x0: 14.2, x1: 21.6, r: 2.0 },
  exciter: { x0: 22.0, x1: 24.6, r: 1.0 },
};

/** Bearing pedestals B1–B4 along the shaft. */
export const BEARINGS_X = [-21.2, -11.2, 1.5, 12.9];

export const PROPS = {
  condenser: { minX: -4, maxX: 6, minZ: 5, maxZ: 9.6 },
  feedPumps: [
    { x: -13, z: 6.4, id: 'A' },
    { x: -9, z: 8.6, id: 'B' },
  ],
  hood: { x: -19, z: 8, len: 8 },
  lube: { minX: 23, maxX: 27.4, minZ: 3, maxZ: 7.4 },
  desk: { x: 18, z: 6.5 },
  crates: [
    [9.5, 9.6],
    [11.2, 9.4],
    [10.3, 10.9],
  ] as [number, number][],
  balanceStation: { x: -4.8, z: 1.9 },
};

export const CREW = {
  rotor: [
    { x: -7.4, z: 1.6, yaw: Math.PI, name: 'Tomás Reyes', role: 'Turbine fitter' },
    { x: -2.6, z: 1.7, yaw: Math.PI + 0.4, name: 'Hana Sato', role: 'Turbine fitter' },
  ],
  lube: { x: 22.4, z: 5.2, yaw: Math.PI / 2, name: 'Ade Mensah', role: 'Lube oil' },
  patrol: [
    { x: -16, z: 3.6 },
    { x: 16, z: 3.6 },
    { x: 16, z: 10.5 },
    { x: 8, z: 11 },
  ] as Vec2[],
};

const bearingStations: Interactable[] = BEARINGS_X.map((x, i) => ({
  id: `bearing-b${i + 1}`,
  kind: 'bearing',
  verb: 'INSPECT',
  label: `Bearing B${i + 1} · shaft`,
  detail: 'Hold E · vibration analysis',
  position: { x, z: PLINTH.maxZ + 1.0 },
  promptHeight: 1.9,
  radius: 1.3,
  action: { type: 'turbine', task: 'analyze', bearing: i },
}));

const pumpPos = PROPS.feedPumps[1]!;

const obstacles: Obstacle[] = [
  { kind: 'rect', rect: { minX: PLINTH.minX, maxX: PLINTH.maxX, minZ: -12, maxZ: PLINTH.maxZ } },
  { kind: 'rect', rect: PROPS.condenser },
  ...PROPS.feedPumps.map((p): Obstacle => ({
    kind: 'rect',
    rect: { minX: p.x - 1.3, maxX: p.x + 1.3, minZ: p.z - 0.9, maxZ: p.z + 0.9 },
  })),
  {
    kind: 'rect',
    rect: {
      minX: PROPS.hood.x - PROPS.hood.len / 2,
      maxX: PROPS.hood.x + PROPS.hood.len / 2,
      minZ: 6.2,
      maxZ: 9.8,
    },
  },
  { kind: 'rect', rect: PROPS.lube },
  {
    kind: 'rect',
    rect: {
      minX: PROPS.desk.x - 1.1,
      maxX: PROPS.desk.x + 1.1,
      minZ: PROPS.desk.z - 0.5,
      maxZ: PROPS.desk.z + 0.5,
    },
  },
  ...PROPS.crates.map(([x, z]): Obstacle => ({ kind: 'circle', x, z, r: 0.8 })),
];

export const turbineHall: RoomDefinition = {
  id: 'turbine-hall',
  name: 'Steam Turbine Hall B',
  level: 'B1',
  bounds: { minX: -28, maxX: 28, minZ: -12, maxZ: 12 },
  wallHeight: 11,
  floorLabel: 'TURBINE HALL',
  doorways: [
    { id: 'control', facing: '-x', offset: 4.5, width: 4, corridor: 'C-2', sign: 'REACTOR CONTROL' },
    { id: 'ring', facing: '-x', offset: -3.5, width: 4, corridor: 'A-3', sign: 'ACCESS A-3 · RING B4' },
  ],
  spawn: { position: { x: -25, z: 4.5 }, facing: Math.PI / 2 },
  interactables: [
    ...bearingStations,
    {
      id: 'lp-rotor',
      kind: 'console',
      verb: 'BALANCE',
      label: 'LP rotor A · blades',
      detail: 'Fit balance weights with the crew',
      position: { x: PROPS.balanceStation.x, z: PROPS.balanceStation.z + 0.6 },
      promptHeight: 2.0,
      radius: 1.5,
      action: { type: 'turbine', task: 'balance' },
    },
    {
      id: 'feed-pump-b',
      kind: 'pump',
      verb: 'SERVICE',
      label: 'Feed pump motor B',
      detail: 'Hold E · grease bearings, check winding',
      position: { x: pumpPos.x + 0.2, z: pumpPos.z + 1.6 },
      promptHeight: 1.9,
      radius: 1.4,
      action: { type: 'turbine', task: 'service' },
    },
    {
      id: 'turbine-desk',
      kind: 'console',
      verb: 'OPERATE',
      label: 'Turbine B local desk',
      detail: 'Status · trip reset',
      position: { x: PROPS.desk.x, z: PROPS.desk.z + 1.2 },
      promptHeight: 2.0,
      radius: 1.5,
      action: { type: 'turbine', task: 'tdesk' },
    },
    ...CREW.rotor.map((c, i): Interactable => ({
      id: `npc-crew-${i}`,
      kind: 'npc',
      verb: 'TALK',
      label: c.name,
      detail: c.role,
      position: { x: c.x, z: c.z + 0.7 },
      promptHeight: 2.2,
      radius: 1.3,
      action: {
        type: 'talk',
        line:
          i === 0
            ? 'Run the analysis on B3 first. The 1× peak and its phase tell us where the heavy spot is: we bolt the weight on the opposite side.'
            : 'Give us an angle and a mass at the LP station and we’ll fit it. If it gets worse, you’re on the heavy side.',
      },
    })),
    {
      id: 'npc-lube',
      kind: 'npc',
      verb: 'TALK',
      label: CREW.lube.name,
      detail: CREW.lube.role,
      position: { x: CREW.lube.x - 0.8, z: CREW.lube.z + 0.3 },
      promptHeight: 2.2,
      radius: 1.3,
      action: {
        type: 'talk',
        line: 'Lube oil’s at 46 degrees, clean. Feed pump B is the one to watch; its motor bearings are dry.',
      },
    },
  ],
  workstations: [],
  obstacles,
  focus: {
    analyze: { x: 0, z: -1, zoom: 1.5 },
    balance: { x: -4.5, z: -1.5, zoom: 1.6 },
    service: { x: pumpPos.x, z: pumpPos.z, zoom: 1.9 },
    tdesk: { x: 14, z: 1, zoom: 1.3 },
  },
  load: () => import('./Contents'),
};

/** Camera framing on one bearing. */
export const bearingFocus = (i: number) => ({ x: BEARINGS_X[i]!, z: SHAFT_Z + 1.5, zoom: 1.9 });
