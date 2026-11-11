import { describe, expect, it } from 'vitest';
import { createPlantSim } from './plant';
import { SYNC_RPM, VIB_GOOD, VIB_TRIP, bearingVibration } from './turbine';
import type { PlantSim, SimEvent } from './types';

const run = (sim: PlantSim, ticks: number): SimEvent[] => {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
};
const HOUR = 600;

describe('turbine B', () => {
  it('runs synchronous at 3,000 rpm with smooth bearings', () => {
    const sim = createPlantSim({ seed: 1 });
    run(sim, 10);
    const t = sim.getState().turbine;
    expect(t.rpm).toBe(SYNC_RPM);
    expect(Math.max(...t.bearings)).toBeLessThan(VIB_GOOD);
    expect(t.balanced).toBe(true);
  });

  it('LP imbalance shows most on B3 and costs output', () => {
    const sim = createPlantSim({ seed: 2 });
    const before = sim.getState().output;
    sim.enqueue({ type: 'setImbalance', mass: 115, phase: 140 });
    const ev = run(sim, 5);
    const b = sim.getState().turbine.bearings;
    expect(b[2]).toBeGreaterThan(6.5);
    expect(b[2]).toBeLessThan(7.6);
    expect(b[2]).toBeGreaterThan(b[3]!);
    expect(b[3]).toBeGreaterThan(b[1]!);
    expect(b[1]).toBeGreaterThan(b[0]!);
    expect(ev).toContainEqual({ type: 'alarm', alarm: 'turbine-vibration' });
    expect(sim.getState().output).toBeLessThan(before);
  });

  it('a weight opposite the imbalance balances the rotor; a wrong one makes it worse', () => {
    const sim = createPlantSim({ seed: 3 });
    sim.enqueue({ type: 'setImbalance', mass: 115, phase: 140 });
    run(sim, 2);
    sim.enqueue({ type: 'fitBalanceWeight', angle: 140, mass: 60 }); // same side: worse
    const worse = run(sim, 1).find((e) => e.type === 'weightFitted');
    expect(worse && worse.type === 'weightFitted' && worse.vibration).toBeGreaterThan(9);
    sim.enqueue({ type: 'fitBalanceWeight', angle: 320, mass: 112 });
    const ev = run(sim, 3);
    expect(ev).toContainEqual({ type: 'turbineBalanced' });
    expect(sim.getState().turbine.bearings[2]).toBeLessThan(VIB_GOOD);
  });

  it('protection trips the turbine above 11 mm/s; it coasts down and needs balancing before a reset', () => {
    const sim = createPlantSim({ seed: 4 });
    sim.enqueue({ type: 'setImbalance', mass: 220, phase: 30 });
    const ev = run(sim, 2);
    expect(ev.some((e) => e.type === 'turbineTrip')).toBe(true);
    run(sim, HOUR);
    expect(sim.getState().turbine.rpm).toBeLessThan(SYNC_RPM * 0.2);
    expect(sim.getState().output).toBeLessThan(5);
    sim.enqueue({ type: 'resetTurbine' });
    expect(run(sim, 1).some((e) => e.type === 'commandRejected')).toBe(true);
    sim.enqueue({ type: 'fitBalanceWeight', angle: 210, mass: 220 });
    sim.enqueue({ type: 'resetTurbine' });
    expect(run(sim, 1)).toContainEqual({ type: 'turbineReset' });
    run(sim, HOUR);
    expect(sim.getState().turbine.rpm).toBeGreaterThan(SYNC_RPM * 0.99);
    expect(sim.getState().output).toBeGreaterThan(1000);
  });

  it('vibration scales with speed squared (a coasting rotor shakes less)', () => {
    const sim = createPlantSim({ seed: 5 });
    sim.enqueue({ type: 'setImbalance', mass: 200, phase: 0 });
    run(sim, 1);
    const t = sim.getState().turbine;
    const full = bearingVibration(t, SYNC_RPM)[2]!;
    const half = bearingVibration(t, SYNC_RPM / 2)[2]!;
    expect(half).toBeCloseTo(full / 4, 6);
    expect(full).toBeLessThan(VIB_TRIP + 1);
  });

  it('feed pump B overheats as its lubrication runs out, trips, and servicing fixes it', () => {
    const sim = createPlantSim({ seed: 6 });
    sim.enqueue({ type: 'setFeedPumpLube', lube: 0.3 });
    const ev = run(sim, HOUR * 2);
    expect(ev.some((e) => e.type === 'feedPumpHot')).toBe(true);
    sim.enqueue({ type: 'setFeedPumpLube', lube: 0, temp: 94 });
    const before = sim.getState().output;
    const ev2 = run(sim, HOUR);
    expect(ev2).toContainEqual({ type: 'feedPumpTripped' });
    expect(sim.getState().output).toBeLessThan(before * 0.7);
    sim.enqueue({ type: 'serviceFeedPump' });
    expect(run(sim, 1)).toContainEqual({ type: 'feedPumpServiced' });
    run(sim, HOUR * 3);
    expect(sim.getState().turbine.feedPump.temp).toBeLessThan(70);
    expect(sim.getState().output).toBeGreaterThan(before * 0.95);
  });

  it('a scram coasts the turbine down', () => {
    const sim = createPlantSim({ seed: 7 });
    sim.enqueue({ type: 'scram' });
    run(sim, HOUR * 3);
    expect(sim.getState().turbine.rpm).toBeLessThan(500);
  });
});
