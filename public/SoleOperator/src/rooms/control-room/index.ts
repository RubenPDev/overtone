import type { Interactable, Obstacle, RoomDefinition, Workstation } from '../../world/types';

/** Console ring: 7 desks around the core, leaving the door axes clear. */
export const DESK_RADIUS = 10.5;
export const DESK_ANGLES_DEG = [22.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
export const TANK_RADIUS = 3.4;
export const PLINTH_RADIUS = 4.4;

const STAFF = [
  { name: 'Operator console', role: 'Your station' },
  { name: 'Dr. Amara Okafor', role: 'Reactor physicist' },
  { name: 'Tomas Reyes', role: 'Shift engineer' },
  { name: 'Dr. Lena Varga', role: 'Thermal hydraulics' },
  { name: 'Priya Natarajan', role: 'Instrumentation' },
  { name: 'Jonas Weber', role: 'Turbine liaison' },
  { name: 'Mei Tanaka', role: 'Radiation safety' },
];

const LINES = [
  '',
  'Cell 07 is reading hot on burn-up. I’d swap it before the end of the shift.',
  'Turbine B has been grumbling all morning. Keep an eye on vibration.',
  'Core ΔT is nominal. Don’t let the inlet creep.',
  'All twelve port sensors are reporting. For now.',
  'Steam side is happy as long as you don’t yank the rods.',
  'Dose rates are fine in here. Don’t linger next to the tank.',
];

const rad = (d: number) => (d * Math.PI) / 180;

export const workstations: Workstation[] = DESK_ANGLES_DEG.map((deg, i) => {
  const a = rad(deg);
  const r = DESK_RADIUS + 1.05;
  return {
    id: `console-${i + 1}`,
    position: { x: Math.cos(a) * r, z: Math.sin(a) * r },
    facing: Math.atan2(-Math.cos(a), -Math.sin(a)),
    role: STAFF[i]!.role,
    staff: i === 0 ? undefined : STAFF[i]!.name,
  };
});

const npcInteractables: Interactable[] = workstations.map((w, i) =>
  w.staff
    ? {
        id: `npc-${i + 1}`,
        kind: 'npc',
        verb: 'TALK',
        label: w.staff,
        detail: w.role,
        position: w.position,
        promptHeight: 2.0,
        radius: 2.0,
        action: { type: 'talk', line: LINES[i]! },
      }
    : {
        id: w.id,
        kind: 'console',
        verb: 'USE',
        label: 'Operator console',
        detail: 'Control rod drives',
        position: w.position,
        promptHeight: 1.6,
        radius: 2.0,
        action: { type: 'rodControl' },
      },
);

/** Placed props, shared by the definition (collision, interactables) and Contents (meshes). */
export const PROPS = {
  vending: { x: -6.4, z: -15.25, yaw: 0 },
  cooler: { x: -15.3, z: -3.4, yaw: Math.PI / 2 },
  alarmPanel: { x: -9.5, z: -15.72 },
  extinguishers: [
    { x: -15.72, z: 3.4, yaw: Math.PI / 2 },
    { x: 3.4, z: -15.72, yaw: 0 },
  ],
  firstAid: { x: -13, z: -15.72 },
  clock: { x: -4.2, z: -15.72 },
  pedestal: { x: 3.75, z: 3.75 },
  plants: [
    [-14.6, -14.6],
    [-14.6, 14.4],
    [14.4, -14.6],
    [14.4, 14.4],
  ] as [number, number][],
};

export const CORE_BAY = { id: 'core-bay', label: 'TRANSFER CART BAY', x: 6.9, z: 0.8, yaw: 0 };

const deskObstacles: Obstacle[] = DESK_ANGLES_DEG.map((deg) => {
  const a = rad(deg);
  const r = DESK_RADIUS + 0.2;
  return { kind: 'circle', x: Math.cos(a) * r, z: Math.sin(a) * r, r: 1.45 };
});

export const controlRoom: RoomDefinition = {
  id: 'control-room',
  name: 'Reactor Control',
  level: 'B2',
  bounds: { minX: -16, maxX: 16, minZ: -16, maxZ: 16 },
  wallHeight: 8.5,
  floorLabel: 'CONTROL ROOM 01',
  doorways: [
    { id: 'fuel', facing: '-x', width: 4, corridor: 'C-1', sign: 'FUEL STORAGE' },
    { id: 'turbine', facing: '-z', width: 4, corridor: 'C-2', sign: 'TURBINE HALL' },
    { id: 'water', facing: '+x', width: 4, corridor: 'C-3', sign: 'WATER CONTAINERS' },
    { id: 'south', facing: '+z', width: 4, corridor: 'C-4', sign: 'CAFETERIA · COOLING' },
  ],
  spawn: { position: { x: 7.2, z: 7.2 }, facing: Math.atan2(-1, -1) },
  interactables: [
    {
      id: 'core-panel',
      kind: 'core',
      verb: 'INSPECT',
      label: 'Refuelling machine',
      detail: 'Core port panel',
      position: { x: 4.6, z: 4.6 },
      promptHeight: 1.9,
      radius: 1.8,
      action: { type: 'corePort', cell: 6 },
    },
    ...npcInteractables,
    {
      id: 'vending',
      kind: 'vending',
      verb: 'BUY',
      label: 'Coffee machine',
      detail: '+30% focus',
      position: { x: PROPS.vending.x, z: PROPS.vending.z + 1.25 },
      promptHeight: 2.4,
      radius: 1.5,
      action: { type: 'vending' },
    },
    {
      id: 'cooler',
      kind: 'cooler',
      verb: 'DRINK',
      label: 'Water cooler',
      detail: 'Restores stamina',
      position: { x: PROPS.cooler.x + 1.1, z: PROPS.cooler.z },
      promptHeight: 1.8,
      radius: 1.4,
      action: { type: 'water' },
    },
    {
      id: 'alarm-panel',
      kind: 'alarm',
      verb: 'ACK',
      label: 'Alarm panel',
      detail: 'Acknowledge alarms',
      position: { x: PROPS.alarmPanel.x, z: PROPS.alarmPanel.z + 1.0 },
      promptHeight: 2.2,
      radius: 1.6,
      action: { type: 'alarmPanel' },
    },
    ...PROPS.extinguishers.map((e, i) => ({
      id: `extinguisher-${i + 1}`,
      kind: 'safety',
      verb: 'CHECK',
      label: 'Fire extinguisher',
      position: { x: e.x + Math.sin(e.yaw) * 0.9, z: e.z + Math.cos(e.yaw) * 0.9 },
      promptHeight: 1.6,
      radius: 1.2,
      action: {
        type: 'message' as const,
        text: 'Fire extinguisher · inspected',
        detail: 'Gauge in the green. Tag signed.',
      },
    })),
    {
      id: 'first-aid',
      kind: 'safety',
      verb: 'CHECK',
      label: 'First-aid station',
      position: { x: PROPS.firstAid.x, z: PROPS.firstAid.z + 1.0 },
      promptHeight: 2.0,
      radius: 1.3,
      action: {
        type: 'message',
        text: 'First-aid station',
        detail: 'Stocked. Potassium iodide tablets in date.',
      },
    },
  ],
  workstations,
  obstacles: [
    { kind: 'circle', x: 0, z: 0, r: PLINTH_RADIUS },
    ...deskObstacles,
    { kind: 'rect', rect: { minX: -7.0, maxX: -5.8, minZ: -16, maxZ: -14.75 } },
    { kind: 'circle', x: PROPS.cooler.x + 0.1, z: PROPS.cooler.z, r: 0.4 },
    { kind: 'circle', x: PROPS.pedestal.x, z: PROPS.pedestal.z, r: 0.45 },
  ],
  cartBays: [CORE_BAY],
  focus: {
    rods: { x: 0, z: 0, zoom: 1.85 },
    refuel: { x: 1.8, z: 1.2, zoom: 2.0 },
  },
  load: () => import('./Contents'),
};
