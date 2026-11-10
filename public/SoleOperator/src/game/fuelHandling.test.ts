import { beforeEach, describe, expect, it } from 'vitest';
import { bus } from '../core/events';
import { initialLogistics } from '../logistics';
import { POOL_DOCK, slotPosition } from '../rooms/fuel-storage';
import { CORE_BAY } from '../rooms/control-room';
import { hook, startCraneCycle, updateCrane } from './crane';
import { machine, startRefuel, updateRefuel } from './refuel';
import { logistics, simHost } from './runtime';

/** Runs the crane until its lower/raise cycle finishes. */
function runCraneCycle() {
  startCraneCycle();
  for (let i = 0; i < 400 && (hook.phase !== 'idle' || i === 0); i++) updateCrane(0.05, null);
}

describe('fuel crane', () => {
  beforeEach(() => {
    logistics.state = initialLogistics();
    hook.phase = 'idle';
  });

  it('lifts a fresh assembly from the pool and drops it into the docked cask', () => {
    const events: string[] = [];
    const off = bus.on('fuel/craned', (e) => events.push(`${e.assembly}:${e.from}->${e.to}`));
    const slot = slotPosition(1);
    Object.assign(logistics.state.crane, { x: slot.x, z: slot.z });
    runCraneCycle();
    expect(logistics.state.crane.holding?.id).toBe('FA-31');
    expect(logistics.state.pool[1]).toBeNull();

    Object.assign(logistics.state.crane, { x: POOL_DOCK.x, z: POOL_DOCK.z });
    runCraneCycle();
    expect(logistics.state.crane.holding).toBeNull();
    expect(logistics.state.cart.cask.map((a) => a.id)).toEqual(['FA-31']);
    expect(events).toEqual(['FA-31:pool->hook', 'FA-31:hook->cask']);
    off();
  });

  it('cannot reach the cask when the cart is not docked', () => {
    logistics.state.crane.holding = { id: 'FA-31', burnup: 0 };
    logistics.state.cart.bay = null;
    Object.assign(logistics.state.crane, { x: POOL_DOCK.x, z: POOL_DOCK.z });
    runCraneCycle();
    expect(logistics.state.crane.holding?.id).toBe('FA-31');
    expect(logistics.state.cart.cask).toEqual([]);
  });
});

describe('refuelling machine', () => {
  it('rod in → extract spent → load fresh, through held keys and sim ticks', () => {
    simHost.reset('refuel-test');
    simHost.setSpeed(1);
    logistics.state = initialLogistics();
    Object.assign(logistics.state.cart, {
      room: 'control-room',
      x: CORE_BAY.x,
      z: CORE_BAY.z,
      bay: CORE_BAY.id,
    });
    logistics.state.cart.cask = [{ id: 'FA-31', burnup: 0 }];
    const spentBurnup = simHost.state.cells[6]!.burnup;

    startRefuel(6);
    const step = (holdE: boolean, holdS: boolean) => {
      updateRefuel(0.1, holdE, holdS);
      simHost.frame(0.1);
    };

    // Phase 1: hold S until rod 07 is home.
    for (let i = 0; i < 600 && machine.phase === 'insert-rod'; i++) step(false, true);
    expect(simHost.state.rods[6]!.insertion).toBeGreaterThanOrEqual(0.999);
    expect(machine.phase).toBe('extract');

    // Releasing E lets progress fall back; holding it finishes the extraction.
    for (let i = 0; i < 10; i++) step(true, false);
    const partial = machine.progress;
    for (let i = 0; i < 5; i++) step(false, false);
    expect(machine.progress).toBeLessThan(partial);
    for (let i = 0; i < 200 && machine.phase === 'extract'; i++) step(true, false);
    expect(machine.phase).toBe('load');
    step(false, false); // the sim applies the unload on the next tick
    expect(simHost.state.cells[6]!.loaded).toBe(false);

    // Spent assembly rides the chute down; fresh comes up into the arm.
    for (let i = 0; i < 100 && !machine.arm; i++) step(false, false);
    expect(machine.arm?.id).toBe('FA-31');
    expect(logistics.state.cart.cask.map((a) => a.id)).toEqual(['FA-07']);
    expect(logistics.state.cart.cask[0]!.burnup).toBeCloseTo(spentBurnup, 2);

    for (let i = 0; i < 200 && machine.phase === 'load'; i++) step(true, false);
    step(false, false);
    expect(machine.phase).toBe('done');
    const cell = simHost.state.cells[6]!;
    expect(cell.loaded).toBe(true);
    expect(cell.assembly).toBe('FA-31');
    expect(cell.burnup).toBeLessThan(0.01);
  });
});
