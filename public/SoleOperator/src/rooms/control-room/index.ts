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
        detail: 'Rod control · coming soon',
        position: w.position,
        promptHeight: 1.6,
        radius: 2.0,
        action: { type: 'console', console: i + 1 },
      },
);

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
      label: 'Core port panel',
      detail: 'Cell burn-up · port 07',
      position: { x: 3.7, z: 3.7 },
      promptHeight: 1.8,
      radius: 2.2,
      action: { type: 'corePort', cell: 6 },
    },
    ...npcInteractables,
  ],
  workstations,
  obstacles: [{ kind: 'circle', x: 0, z: 0, r: PLINTH_RADIUS }, ...deskObstacles],
  load: () => import('./Contents'),
};
