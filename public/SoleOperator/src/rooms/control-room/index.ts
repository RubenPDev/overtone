import type { Interactable, Obstacle, RoomDefinition, Vec2, Workstation } from '../../world/types';

/**
 * Reactor Control: the Unit 1 core hall. A 60 m hall with tiered galleries on
 * the back walls; at its centre the glass core tank (the "core window") under
 * a 36 m control rod drive stack. Two rings of consoles face the core, broken
 * by lanes on the door axes; the Reactor Operator Station sits on the inner
 * ring, front-right, where the camera sees it best.
 */
export const HALL = 30;
export const TANK_RADIUS = 3.4;
export const PLINTH_RADIUS = 4.4;
export const INNER_R = 15;
export const OUTER_R = 20.5;
/** Railing ring round the core floor (gaps on the lanes). */
export const RAIL_R = 11.5;
/** Clear lanes from each door to the core (half-width, metres). */
export const LANE_HALF = 3.2;
export const GALLERY_Y = [8, 13.5, 19, 24.5];
export const GALLERY_DEPTH = 3.2;

const rad = (d: number) => (d * Math.PI) / 180;
const at = (a: number, r: number): Vec2 => ({ x: Math.cos(a) * r, z: Math.sin(a) * r });

/** The Reactor Operator Station: horseshoe desk on the inner ring at 60°. */
export const STATION = (() => {
  const a = rad(60);
  const op = at(a, INNER_R + 2.3);
  return {
    angle: a,
    /** Where the Operator stands, facing the core. */
    op,
    /** Station yaw: its local -z points at the core. */
    yaw: Math.atan2(op.x, op.z),
    /** Hologram base over the desk, between the Operator and the core. */
    holo: at(a, INNER_R + 0.6),
    /** Angular half-span kept free of ring desks. */
    clear: rad(10),
  };
})();

/** Coolant loop pedestals round the core: back and sides only, so the core window stays in view. */
export const LOOP_ANGLES = [110, 150, 200, 250, 290, 340].map(rad);
export const LOOP_R = 9.5;

export interface DeskSlot {
  ring: 'inner' | 'outer';
  angle: number;
  x: number;
  z: number;
  /** Faces the core. */
  yaw: number;
}

const angDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function laneClear(a: number, r: number) {
  const half = Math.asin(Math.min(1, (LANE_HALF + 1.1) / r));
  return [0, 90, 180, 270].map(rad).every((lane) => angDiff(a, lane) >= half);
}

function ring(r: number, which: DeskSlot['ring']): DeskSlot[] {
  const step = 2.1 / r;
  const out: DeskSlot[] = [];
  for (let a = step / 2; a < Math.PI * 2; a += step) {
    if (!laneClear(a, r)) continue;
    if (which === 'inner' && angDiff(a, STATION.angle) < STATION.clear) continue;
    const p = at(a, r);
    out.push({ ring: which, angle: a, ...p, yaw: Math.atan2(p.x, p.z) });
  }
  return out;
}

export const DESKS: DeskSlot[] = [...ring(INNER_R, 'inner'), ...ring(OUTER_R, 'outer')];

const STAFF = [
  { name: 'Dr. Amara Okafor', role: 'Reactor physicist', deg: 120 },
  { name: 'Tomas Reyes', role: 'Shift engineer', deg: 160 },
  { name: 'Dr. Lena Varga', role: 'Thermal hydraulics', deg: 205 },
  { name: 'Priya Natarajan', role: 'Instrumentation', deg: 245 },
  { name: 'Jonas Weber', role: 'Turbine liaison', deg: 295 },
  { name: 'Mei Tanaka', role: 'Radiation safety', deg: 330 },
];

const LINES = [
  'Cell 07 is reading hot on burn-up. I’d swap it before the end of the shift.',
  'Turbine B has been grumbling all morning. Keep an eye on vibration.',
  'Core ΔT is nominal. Don’t let the inlet creep.',
  'All twelve port sensors are reporting. For now.',
  'Steam side is happy as long as you don’t yank the rods.',
  'Dose rates are fine out here on the ring. Don’t linger next to the tank.',
];

/** Named staff take the inner-ring desk nearest their angle; they sit just behind it. */
const staffDesks = STAFF.map((s) =>
  DESKS.filter((d) => d.ring === 'inner').reduce((best, d) =>
    angDiff(d.angle, rad(s.deg)) < angDiff(best.angle, rad(s.deg)) ? d : best,
  ),
);

export const workstations: Workstation[] = [
  { id: 'console-1', position: STATION.op, facing: STATION.yaw + Math.PI, role: 'Your station' },
  ...STAFF.map((s, i) => {
    const d = staffDesks[i]!;
    return {
      id: `console-${i + 2}`,
      position: at(d.angle, INNER_R + 1.0),
      facing: d.yaw + Math.PI,
      role: s.role,
      staff: s.name,
    };
  }),
];

/** Desks with a named staff member (the crew instancer leaves these seats empty). */
export const STAFF_DESK_ANGLES = staffDesks.map((d) => d.angle);

/** Placed props on the back walls (x = -30, z = -30), shared by definition and Contents. */
export const PROPS = {
  vending: { x: -12, z: -29.25, yaw: 0 },
  cooler: { x: -29.3, z: -9, yaw: Math.PI / 2 },
  alarmPanel: { x: -18, z: -29.72 },
  extinguishers: [
    { x: -29.72, z: 8, yaw: Math.PI / 2 },
    { x: 8, z: -29.72, yaw: 0 },
  ],
  firstAid: { x: -24, z: -29.72 },
  clock: { x: -7, z: -29.72 },
  pedestal: { x: 3.75, z: 3.75 },
  plants: [
    [-28.6, -28.6],
    [-28.6, 28.2],
    [28.2, -28.6],
    [28.2, 28.2],
  ] as [number, number][],
};

export const CORE_BAY = { id: 'core-bay', label: 'TRANSFER CART BAY', x: 6.9, z: 0.8, yaw: 0 };

const npcInteractables: Interactable[] = workstations.map((w, i) =>
  w.staff
    ? {
        id: `npc-${i + 1}`,
        kind: 'npc',
        verb: 'TALK',
        label: w.staff,
        detail: w.role,
        position: { x: w.position.x * 1.04, z: w.position.z * 1.04 },
        promptHeight: 2.0,
        radius: 1.6,
        action: { type: 'talk', line: LINES[i - 1]! },
      }
    : {
        id: w.id,
        kind: 'console',
        verb: 'USE',
        label: 'Reactor Operator Station',
        detail: 'Control rod drives · holo core',
        position: w.position,
        promptHeight: 2.2,
        radius: 1.8,
        action: { type: 'rodControl' },
      },
);

const stationObstacles: Obstacle[] = [-0.9, -0.45, 0, 0.45, 0.9].map((k) => ({
  kind: 'circle',
  ...at(STATION.angle + k * 0.11, INNER_R + 0.85),
  r: 0.75,
}));

export const controlRoom: RoomDefinition = {
  id: 'control-room',
  name: 'Reactor Control',
  level: 'B2',
  bounds: { minX: -HALL, maxX: HALL, minZ: -HALL, maxZ: HALL },
  wallHeight: 30,
  floorLabel: 'UNIT 1 · CORE HALL',
  shell: { wall: '#2b333d', band: '#1d242c', floor: '#3a4554' },
  view: { zoom: 0.78, ambient: 0.55 },
  doorways: [
    { id: 'fuel', facing: '-x', width: 4, corridor: 'C-1', sign: 'FUEL STORAGE' },
    { id: 'turbine', facing: '-z', width: 4, corridor: 'C-2', sign: 'TURBINE HALL' },
    { id: 'water', facing: '+x', width: 4, corridor: 'C-3', sign: 'WATER CONTAINERS' },
    { id: 'south', facing: '+z', width: 4, corridor: 'C-4', sign: 'CAFETERIA · COOLING' },
  ],
  // On the walkway between the rings, just beside the station.
  spawn: { position: at((48 * Math.PI) / 180, (INNER_R + OUTER_R) / 2), facing: Math.atan2(-1, -1) },
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
    ...LOOP_ANGLES.map((a): Obstacle => ({ kind: 'circle', ...at(a, LOOP_R), r: 1.1 })),
    ...DESKS.map((d): Obstacle => ({
      kind: 'circle',
      ...at(d.angle, (d.ring === 'inner' ? INNER_R : OUTER_R) + 0.3),
      r: 0.95,
    })),
    ...stationObstacles,
    {
      kind: 'rect',
      rect: { minX: PROPS.vending.x - 0.6, maxX: PROPS.vending.x + 0.6, minZ: -30, maxZ: -28.75 },
    },
    { kind: 'circle', x: PROPS.cooler.x + 0.1, z: PROPS.cooler.z, r: 0.4 },
    { kind: 'circle', x: PROPS.pedestal.x, z: PROPS.pedestal.z, r: 0.45 },
    // Cabinet banks along the front walls (the lanes stay open).
    ...([-1, 1] as const).flatMap((side): Obstacle[] => {
      const [u0, u1] = side < 0 ? [-HALL, -(LANE_HALF + 0.6)] : [LANE_HALF + 0.6, HALL];
      return [
        { kind: 'rect', rect: { minX: HALL - 1.0, maxX: HALL, minZ: u0, maxZ: u1 } },
        { kind: 'rect', rect: { minX: u0, maxX: u1, minZ: HALL - 1.0, maxZ: HALL } },
      ];
    }),
  ],
  cartBays: [CORE_BAY],
  focus: {
    // The hologram floats ~2 m up: shift the floor target back along the camera ray to centre it.
    rods: { x: STATION.holo.x - 2.75, z: STATION.holo.z - 2.75, zoom: 5.2 },
    refuel: { x: 1.8, z: 1.2, zoom: 2.0 },
  },
  load: () => import('./Contents'),
};
