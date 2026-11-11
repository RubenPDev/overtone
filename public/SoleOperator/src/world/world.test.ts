import { describe, expect, it } from 'vitest';
import { CORRIDORS, NODES, TOTAL_CORRIDOR_M, routeTo, shortestPaths } from './facility';
import { StraightLineNavigator, isWalkable, nearestFree, slideMove } from './geometry';
import { buildCorridorSpace, buildRoomSpace, corridorFrame, corridorT, doorState } from './spaces';
import { ROOMS, getRoom, isRoomBuilt } from '../rooms/registry';
import { EventBus, type GameEvents } from '../core/events';
import { ObjectiveRunner } from '../objectives/runner';
import { OBJECTIVES } from '../objectives/definitions';

describe('facility graph', () => {
  it('matches the reference map distances, plus a 3.4 km ring with three access shafts', () => {
    // Plant corridors C-1..C-6 (1,020 m) + A-1..A-3 (700 m) + 8 x 425 m ring.
    expect(TOTAL_CORRIDOR_M).toBe(1020 + 700 + 3400);
    const d = shortestPaths('control-room');
    expect(d.get('fuel-storage')!.dist).toBe(140);
    expect(d.get('turbine-hall')!.dist).toBe(210);
    expect(d.get('water-containers')!.dist).toBe(180);
    expect(d.get('cafeteria')!.dist).toBe(330);
    expect(d.get('cooling-chambers')!.dist).toBe(330);
    expect(d.get('cafeteria')!.via).toBe('C-4');
    // Target Station: down A-1 from Fuel Rod Storage.
    expect(d.get('ring-s6')!.dist).toBe(140 + 220);
    // RF Station: under a kilometre via the water containers and A-2.
    expect(d.get('ring-s1')!.dist).toBe(180 + 180 + 425);
    expect(d.get('ring-s1')!.via).toBe('C-3');
  });

  it('the ring is a closed loop of eight sectors', () => {
    const ring = CORRIDORS.filter((c) => c.kind === 'ring');
    expect(ring).toHaveLength(8);
    const d = shortestPaths('ring-s1');
    expect(d.get('ring-s3')!.dist).toBe(2 * 425);
    expect(d.get('ring-s7')!.dist).toBe(2 * 425); // the short way round
  });

  it('every corridor joins known nodes and every registered room is in the graph', () => {
    const ids = new Set(NODES.map((n) => n.id));
    for (const c of CORRIDORS) expect(ids.has(c.a) && ids.has(c.b)).toBe(true);
    for (const id of ROOMS.keys()) expect(ids.has(id)).toBe(true);
  });

  it('routes from inside a corridor pick the shorter end', () => {
    const r = routeTo({ corridor: 'C-1', from: 'control-room', t: 100 }, 'fuel-storage');
    expect(r.dist).toBe(40);
    expect(r.via).toEqual({ end: 'fuel-storage' });
    const back = routeTo({ corridor: 'C-1', from: 'control-room', t: 100 }, 'water-containers');
    expect(back.dist).toBe(280);
  });
});

describe('rooms and spaces', () => {
  it('a position inside furniture (an old save after a layout change) never traps the player', () => {
    const cr = getRoom('control-room');
    const space = buildRoomSpace(cr, isRoomBuilt);
    // Where the coffee machine used to be: now inside the inner console ring.
    const stale = { x: -6.4, z: -14 };
    expect(isWalkable(space, stale)).toBe(false);
    const free = nearestFree(space, stale)!;
    expect(free).not.toBeNull();
    expect(isWalkable(space, free)).toBe(true);
    expect(Math.hypot(free.x - stale.x, free.z - stale.z)).toBeLessThan(2.5);
    // And if the player does end up overlapping, any step on the floor gets them out.
    const moved = slideMove(space, stale, { x: 0.1, z: 0.1 });
    expect(moved).toEqual({ x: stale.x + 0.1, z: stale.z + 0.1 });
  });

  it('the rings leave a walkable path from the spawn to the station and out through every lane', () => {
    const cr = getRoom('control-room');
    const space = buildRoomSpace(cr, isRoomBuilt);
    const station = cr.interactables.find((i) => i.id === 'console-1')!;
    expect(isWalkable(space, station.position)).toBe(true);
    // Walk the walkway ring between the console rings all the way round.
    const r = 17.75;
    for (let a = 0; a < Math.PI * 2; a += 0.05)
      expect(isWalkable(space, { x: Math.cos(a) * r, z: Math.sin(a) * r })).toBe(true);
    // Each lane is open from the wall to the core floor.
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      for (let d = 6; d < 29; d += 0.5) expect(isWalkable(space, { x: dx! * d, z: dz! * d })).toBe(true);
  });

  it('every doorway refers to a corridor touching its room', () => {
    for (const room of ROOMS.values())
      for (const d of room.doorways) {
        const c = CORRIDORS.find((c) => c.id === d.corridor)!;
        expect(c.a === room.id || c.b === room.id).toBe(true);
      }
  });

  it('only doors to built rooms are open; Fuel Rod Storage opens onto the ring via A-1', () => {
    const cr = getRoom('control-room');
    const states = Object.fromEntries(cr.doorways.map((d) => [d.id, doorState(cr, d, isRoomBuilt)]));
    expect(states).toEqual({ fuel: 'open', turbine: 'open', water: 'open', south: 'sealed' });
    const fs = getRoom('fuel-storage');
    expect(doorState(fs, fs.doorways[1]!, isRoomBuilt)).toBe('open');
    // Every ring sector is walkable both ways; A-2 leads up to Water Containers.
    const s2 = getRoom('ring-s2');
    expect(s2.doorways.map((d) => doorState(s2, d, isRoomBuilt))).toEqual(['open', 'open', 'open']);
    const s8 = getRoom('ring-s8');
    expect(s8.doorways.map((d) => doorState(s8, d, isRoomBuilt))).toEqual(['open', 'open', 'open']);
  });

  it('blocks walls and the reactor plinth, but lets you walk out through an open door', () => {
    const cr = getRoom('control-room');
    const space = buildRoomSpace(cr, isRoomBuilt);
    expect(isWalkable(space, cr.spawn.position)).toBe(true);
    expect(isWalkable(space, { x: 0, z: 0 })).toBe(false); // tank
    expect(isWalkable(space, { x: 0, z: 31 })).toBe(false); // sealed door (south) / wall
    expect(isWalkable(space, { x: -32, z: 0 })).toBe(true); // C-1 stub
    // Sliding along a wall keeps the free axis.
    const p = slideMove(space, { x: 10, z: -29.5 }, { x: 0.5, z: -1 });
    expect(p.x).toBeCloseTo(10.5);
    expect(p.z).toBeCloseTo(-29.5);
    expect(space.triggers).toHaveLength(3); // C-1, C-2 and C-3
  });

  it('every interactable and spawn is reachable floor', () => {
    for (const room of ROOMS.values()) {
      const space = buildRoomSpace(room, isRoomBuilt);
      expect(isWalkable(space, room.spawn.position)).toBe(true);
      const nav = new StraightLineNavigator(space);
      for (const i of room.interactables)
        expect(nav.findPath(room.spawn.position, i.position)).not.toBeNull();
    }
  });

  it('a corridor runs from the door direction for its full length, with exits at both ends', () => {
    const frame = corridorFrame('C-1', getRoom('control-room'));
    expect(frame.dir).toEqual({ x: -1, z: 0 });
    expect(frame.to).toBe('fuel-storage');
    const space = buildCorridorSpace(frame);
    expect(isWalkable(space, { x: -70, z: 0 })).toBe(true);
    expect(isWalkable(space, { x: -70, z: 3 })).toBe(false);
    expect(corridorT(frame, { x: -70, z: 0 })).toBe(70);
    expect(space.triggers.map((t) => t.action.type === 'arrive' && t.action.room)).toEqual([
      'control-room',
      'fuel-storage',
    ]);
  });
});

describe('objective runner', () => {
  const craned = (burnup: number, to: 'cask' | 'pool') =>
    ({ assembly: 'FA-31', burnup, from: 'hook', to }) as const;

  it('advances "Swap Fuel Cell 07" through bus events only, then chains the return objective', () => {
    const bus = new EventBus<GameEvents>();
    const runner = new ObjectiveRunner(bus, OBJECTIVES);
    const done: string[] = [];
    bus.on('objective/completed', (e) => done.push(e.objective));
    runner.start('swap-cell-07');
    expect(runner.currentStep?.id).toBe('check');

    bus.emit('interact', { room: 'control-room', interactable: 'npc-2', kind: 'npc' });
    expect(runner.currentStep?.id).toBe('check');
    bus.emit('interact', { room: 'control-room', interactable: 'core-panel', kind: 'core' });
    expect(runner.currentStep?.id).toBe('cask');
    bus.emit('fuel/craned', craned(0.97, 'cask')); // spent fuel doesn't count
    expect(runner.currentStep?.id).toBe('cask');
    bus.emit('fuel/craned', craned(0, 'cask'));
    expect(runner.currentStep?.id).toBe('deliver');
    bus.emit('cart/docked', { room: 'control-room', bay: 'core-bay', fresh: 0, spent: 0 }); // empty cart
    expect(runner.currentStep?.id).toBe('deliver');
    bus.emit('cart/docked', { room: 'control-room', bay: 'core-bay', fresh: 1, spent: 0 });
    expect(runner.currentStep?.id).toBe('swap');
    bus.emit('sim', { type: 'cellLoaded', cell: 3, assembly: 'FA-32' });
    expect(runner.currentStep?.id).toBe('swap');
    bus.emit('sim', { type: 'cellLoaded', cell: 6, assembly: 'FA-31' });
    expect(done).toEqual(['swap-cell-07']);

    // The side objective starts on its own.
    expect(runner.progress.active?.id).toBe('return-spent');
    bus.emit('cart/docked', { room: 'fuel-storage', bay: 'pool-dock', fresh: 0, spent: 1 });
    bus.emit('fuel/craned', craned(0.96, 'pool'));
    expect(done).toEqual(['swap-cell-07', 'return-spent']);
    // ...which chains straight into the accelerator work.
    expect(runner.progress.active?.id).toBe('retune-cavity-03');
    bus.emit('room/entered', { room: 'ring-s1' });
    bus.emit('drone/scanned', { room: 'ring-s1', cavity: 2 });
    bus.emit('sim', { type: 'cavityTuned', cavity: 2 });
    expect(runner.progress.active?.id).toBe('first-enrichment');
    bus.emit('sim', { type: 'productionStarted', recipe: 'enrich-u' });
    bus.emit('sim', { type: 'produced', recipe: 'enrich-u', stock: 'enriched-u', total: 4 });
    expect(runner.currentStep?.id).toBe('make');
    bus.emit('sim', { type: 'produced', recipe: 'enrich-u', stock: 'enriched-u', total: 5 });
    expect(done).toEqual(['swap-cell-07', 'return-spent', 'retune-cavity-03', 'first-enrichment']);
    // Then the business side: tablet, contract, scanner.
    expect(runner.progress.active?.id).toBe('ops-online');
    bus.emit('ui/opened', { panel: 'ops' });
    bus.emit('sim', { type: 'contractAccepted', id: 1, title: 'x' });
    bus.emit('sim', { type: 'purchased', item: 'hazmat', level: 1 }); // wrong item
    expect(runner.currentStep?.id).toBe('scanner');
    bus.emit('sim', { type: 'purchased', item: 'scanner', level: 1 });
    bus.emit('ui/opened', { panel: 'scanner' });
    expect(runner.progress.active?.id).toBe('clearance-2');
    bus.emit('room/entered', { room: 'ring-s3' });
    bus.emit('sim', { type: 'productionStarted', recipe: 'research' });
    bus.emit('sim', { type: 'produced', recipe: 'research', stock: 'research', total: 60 });
    bus.emit('sim', { type: 'clearanceRaised', level: 2 });
    expect(done.slice(-2)).toEqual(['ops-online', 'clearance-2']);
    // Water, then the turbine.
    expect(runner.progress.active?.id).toBe('water-leak');
    bus.emit('room/entered', { room: 'water-containers' });
    bus.emit('interact', { room: 'water-containers', interactable: 'tank-3', kind: 'tank' });
    bus.emit('sim', { type: 'valveClosed', tank: 1 }); // wrong tank
    expect(runner.currentStep?.id).toBe('isolate');
    bus.emit('sim', { type: 'valveClosed', tank: 2 });
    bus.emit('sim', { type: 'tankRepaired', tank: 2 });
    bus.emit('sim', { type: 'valveOpened', tank: 2 });
    expect(runner.progress.active?.id).toBe('fix-turbine-b');
    bus.emit('room/entered', { room: 'turbine-hall' });
    bus.emit('turbine/analyzed', { bearing: 1 }); // B2 isn't the one
    expect(runner.currentStep?.id).toBe('inspect');
    bus.emit('turbine/analyzed', { bearing: 2 });
    bus.emit('sim', { type: 'turbineBalanced' });
    bus.emit('sim', { type: 'feedPumpServiced' });
    expect(done.slice(-2)).toEqual(['water-leak', 'fix-turbine-b']);
    expect(runner.progress.active).toBeNull();
  });

  it('a later step’s event completes the skipped steps before it', () => {
    const bus = new EventBus<GameEvents>();
    const runner = new ObjectiveRunner(bus, OBJECTIVES);
    const steps: number[] = [];
    bus.on('objective/step', (e) => steps.push(e.step));
    runner.start('swap-cell-07');
    bus.emit('fuel/craned', craned(0, 'cask'));
    expect(steps).toEqual([0, 1]);
    expect(runner.currentStep?.id).toBe('deliver');
  });

  it('saves and restores progress', () => {
    const bus = new EventBus<GameEvents>();
    const a = new ObjectiveRunner(bus, OBJECTIVES);
    a.start('swap-cell-07');
    a.forceAdvance();
    const s = a.save();
    a.dispose();
    const b = new ObjectiveRunner(new EventBus<GameEvents>(), OBJECTIVES);
    b.load(s);
    expect(b.currentStep?.id).toBe('cask');
  });
});
