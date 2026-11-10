import { describe, expect, it } from 'vitest';
import { createPlantSim } from './plant';
import { Rng } from './rng';
import { NOMINAL_THERMAL_MW } from './constants';
import type { PlantSim, SimEvent } from './types';

const run = (sim: PlantSim, ticks: number): SimEvent[] => {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
};

/** Sets all rods to `insertion`, waits for the plant to settle and returns the final state. */
const settleAt = (insertion: number) => {
  const sim = createPlantSim({ seed: 'settle' });
  sim.enqueue({ type: 'setAllRods', insertion });
  run(sim, 1500); // 2.5 game hours
  return sim.getState();
};

describe('plant sim v0', () => {
  it('starts at steady nominal power and stays there with no input', () => {
    const sim = createPlantSim({ seed: 1 });
    const s0 = { ...sim.getState() };
    expect(s0.thermalPower).toBeCloseTo(NOMINAL_THERMAL_MW, 0);
    expect(s0.coreTemp).toBeCloseTo(312, 0);
    expect(s0.output).toBeGreaterThan(1200);
    expect(s0.output).toBeLessThan(1240);

    run(sim, 2000);
    const s = sim.getState();
    expect(Math.abs(s.thermalPower - s0.thermalPower) / s0.thermalPower).toBeLessThan(0.03);
    expect(Math.abs(s.coreTemp - s0.coreTemp)).toBeLessThan(3);
    expect(Math.abs(s.pressure - 15.4)).toBeLessThan(0.2);
    expect(s.alarms).toEqual([]);
  });

  it('starts with rod insertion in a sensible mid-travel band', () => {
    const s = createPlantSim({ seed: 1 }).getState();
    expect(s.rods[0]!.insertion).toBeGreaterThan(0.25);
    expect(s.rods[0]!.insertion).toBeLessThan(0.5);
  });

  it('inserting more rods lowers power (monotonic across settled states)', () => {
    const powers = [0.3, 0.38, 0.46, 0.54].map((x) => settleAt(x).thermalPower);
    for (let i = 1; i < powers.length; i++) expect(powers[i]!).toBeLessThan(powers[i - 1]!);
  });

  it('a single rod moving in drops power relative to an untouched plant', () => {
    const a = createPlantSim({ seed: 2 });
    const b = createPlantSim({ seed: 2 });
    b.enqueue({ type: 'nudgeRod', rod: 3, delta: 0.3 });
    run(a, 300);
    run(b, 300);
    expect(b.getState().thermalPower).toBeLessThan(a.getState().thermalPower * 0.99);
  });

  it('core temperature lags power after a reactivity step', () => {
    const sim = createPlantSim({ seed: 3 });
    const p0 = sim.getState().thermalPower;
    const t0 = sim.getState().coreTemp;
    sim.enqueue({ type: 'setAllRods', insertion: sim.getState().rods[0]!.insertion - 0.04 });
    const trace: { p: number; t: number }[] = [];
    for (let i = 0; i < 1500; i++) {
      sim.step();
      trace.push({ p: sim.getState().thermalPower, t: sim.getState().coreTemp });
    }
    const pEnd = trace.at(-1)!.p;
    const tEnd = trace.at(-1)!.t;
    expect(pEnd).toBeGreaterThan(p0 * 1.03);
    expect(tEnd).toBeGreaterThan(t0 + 0.5);
    // When power has covered half its change, temperature has covered less than half of its own.
    const half = trace.findIndex((x) => (x.p - p0) / (pEnd - p0) >= 0.5);
    expect(half).toBeGreaterThan(0);
    expect((trace[half]!.t - t0) / (tEnd - t0)).toBeLessThan(0.5);
  });

  it('burn-up only ever increases, under random rod moves', () => {
    const sim = createPlantSim({ seed: 4 });
    const rng = Rng.fromSeed('rods');
    let prev = sim.getState().cells.map((c) => c.burnup);
    for (let i = 0; i < 4000; i++) {
      if (i % 50 === 0)
        sim.enqueue({ type: 'setRodTarget', rod: Math.floor(rng.next() * 12), insertion: rng.next() });
      sim.step();
      const now = sim.getState().cells.map((c) => c.burnup);
      now.forEach((b, j) => expect(b).toBeGreaterThanOrEqual(prev[j]!));
      prev = now;
    }
    expect(prev.some((b, j) => b > createPlantSim({ seed: 4 }).getState().cells[j]!.burnup)).toBe(true);
  });

  it('scram drops power fast and keeps decay heat', () => {
    const sim = createPlantSim({ seed: 5 });
    sim.enqueue({ type: 'scram' });
    const events = run(sim, 40);
    const s = sim.getState();
    expect(events.some((e) => e.type === 'scram')).toBe(true);
    expect(s.fissionPower).toBeLessThan(NOMINAL_THERMAL_MW * 0.02);
    expect(s.decayHeat).toBeGreaterThan(50);
    // Rods stay latched until reset.
    sim.enqueue({ type: 'setAllRods', insertion: 0 });
    expect(run(sim, 1).some((e) => e.type === 'commandRejected')).toBe(true);
  });

  it('unloading needs the rod in; an empty cell stops burning and costs reactivity', () => {
    const sim = createPlantSim({ seed: 6 });
    sim.enqueue({ type: 'unloadCell', cell: 6 });
    expect(run(sim, 1).some((e) => e.type === 'commandRejected')).toBe(true);

    sim.enqueue({ type: 'setRodTarget', rod: 6, insertion: 1 });
    run(sim, 120);
    sim.enqueue({ type: 'unloadCell', cell: 6 });
    const events = run(sim, 1);
    expect(events.find((e) => e.type === 'cellUnloaded')).toMatchObject({ cell: 6, assembly: 'FA-07' });
    expect(sim.getState().reactivity).toBeLessThan(-100);
    run(sim, 200);
    expect(sim.getState().cells[6]!.burnup).toBe(0);
    expect(sim.getState().cells[6]!.power).toBe(0);

    sim.enqueue({ type: 'loadCell', cell: 6, assembly: 'FA-31' });
    expect(run(sim, 1).some((e) => e.type === 'cellLoaded')).toBe(true);
  });

  it('is deterministic for a seed, and snapshot/restore resumes identically', () => {
    const script = (sim: PlantSim) => {
      sim.enqueue({ type: 'nudgeRod', rod: 1, delta: -0.05 });
      run(sim, 100);
      sim.enqueue({ type: 'injectFault', fault: 'turbine-vibration', severity: 0.5 });
      run(sim, 100);
    };
    const a = createPlantSim({ seed: 'same' });
    const b = createPlantSim({ seed: 'same' });
    script(a);
    script(b);
    expect(a.snapshot()).toEqual(b.snapshot());

    const snap = a.snapshot();
    run(a, 250);
    const c = createPlantSim({ seed: 'other' });
    c.restore(JSON.parse(JSON.stringify(snap)));
    run(c, 250);
    expect(c.snapshot()).toEqual(a.snapshot());
  });

  it('stays finite and bounded with everything pulled out and the pumps off', () => {
    const sim = createPlantSim({ seed: 7 });
    sim.enqueue({ type: 'setAllRods', insertion: 0 });
    sim.enqueue({ type: 'setCoolantFlow', fraction: 0 });
    const events = run(sim, 3000);
    const s = sim.getState();
    for (const v of [s.thermalPower, s.coreTemp, s.pressure, s.output, s.reactivity])
      expect(Number.isFinite(v)).toBe(true);
    expect(s.pressure).toBeLessThanOrEqual(25);
    expect(events.some((e) => e.type === 'alarm' && e.alarm === 'core-temp-high')).toBe(true);
  });

  it('turbine vibration raises an alarm and costs output', () => {
    const sim = createPlantSim({ seed: 8 });
    const before = sim.getState().output;
    sim.enqueue({ type: 'injectFault', fault: 'turbine-vibration', severity: 0.8 });
    const events = run(sim, 5);
    expect(events).toContainEqual({ type: 'alarm', alarm: 'turbine-vibration' });
    expect(sim.getState().output).toBeLessThan(before * 0.9);
  });
});
