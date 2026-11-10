import { describe, expect, it } from 'vitest';
import { createPlantSim } from './plant';
import type { PlantSim, SimEvent } from './types';
import { TANK_CAPACITY } from './water';

const run = (sim: PlantSim, ticks: number): SimEvent[] => {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
};
const HOUR = 600;

describe('water reserve', () => {
  it('starts with four healthy-ish tanks and a full supply; treatment keeps up with demand', () => {
    const sim = createPlantSim({ seed: 1 });
    const w = sim.getState().water;
    expect(w.tanks).toHaveLength(4);
    expect(w.supply).toBe(1);
    // Clear any random leak so this test is about the balance.
    sim.getState().water.tanks.forEach((t) => (t.integrity = 1));
    run(sim, HOUR * 4);
    const after = sim.getState().water;
    expect(after.treatment).toBeGreaterThan(after.demand);
    expect(after.inventory).toBeGreaterThan(0.85);
  });

  it('a leak drains a tank down to the height of the hole, then stops', () => {
    const sim = createPlantSim({ seed: 2 });
    sim.enqueue({ type: 'turnValve', tank: 1, delta: -1 }); // isolate so only the leak changes the level
    sim.enqueue({ type: 'startLeak', tank: 1, rate: 80, height: 0.4 });
    const ev = run(sim, 1);
    expect(ev).toContainEqual({ type: 'leakStarted', tank: 1, reported: false });
    expect(ev).toContainEqual({ type: 'valveClosed', tank: 1 });
    run(sim, HOUR * 40);
    const t = sim.getState().water.tanks[1]!;
    expect(t.level / TANK_CAPACITY).toBeCloseTo(0.4, 2);
  });

  it('patching needs the valve closed; reopening brings the tank back online', () => {
    const sim = createPlantSim({ seed: 3 });
    sim.enqueue({ type: 'startLeak', tank: 2, rate: 40 });
    sim.enqueue({ type: 'repairTank', tank: 2 });
    expect(run(sim, 1).find((e) => e.type === 'commandRejected')).toMatchObject({
      reason: 'Close the tank valve before welding.',
    });
    sim.enqueue({ type: 'turnValve', tank: 2, delta: -1 });
    sim.enqueue({ type: 'repairTank', tank: 2 });
    expect(run(sim, 1)).toContainEqual({ type: 'tankRepaired', tank: 2 });
    expect(sim.getState().water.tanks[2]!.leak).toBe(0);
    expect(sim.getState().water.tanks[2]!.integrity).toBeGreaterThan(0.79);
    sim.enqueue({ type: 'turnValve', tank: 2, delta: 0.5 });
    expect(run(sim, 1)).toContainEqual({ type: 'valveOpened', tank: 2 });
  });

  it('an empty reserve starves the heat sink and raises the water-low alarm', () => {
    const sim = createPlantSim({ seed: 4 });
    const s = sim.getState();
    for (let i = 0; i < 4; i++) sim.enqueue({ type: 'turnValve', tank: i, delta: i === 0 ? 0 : -1 });
    s.water.tanks[0]!.level = 100;
    const ev = run(sim, HOUR * 3);
    expect(ev).toContainEqual({ type: 'alarm', alarm: 'water-low' });
    expect(sim.getState().water.supply).toBeLessThan(0.3);
    expect(sim.getState().inletTemp).toBeGreaterThan(290);
  });

  it('leak sensors report leaks; extra tanks and liners come from upgrades', () => {
    const sim = createPlantSim({ seed: 5 });
    sim.enqueue({ type: 'grantCredits', amount: 500_000 });
    sim.enqueue({ type: 'setClearance', level: 3 });
    sim.enqueue({ type: 'buyUpgrade', id: 'leak-sensors' });
    sim.enqueue({ type: 'buyUpgrade', id: 'extra-tanks' });
    sim.enqueue({ type: 'buyUpgrade', id: 'extra-tanks' });
    const ev = run(sim, 1);
    expect(ev.filter((e) => e.type === 'tankInstalled')).toHaveLength(2);
    expect(sim.getState().water.tanks).toHaveLength(6);
    sim.enqueue({ type: 'startLeak', tank: 5, rate: 30 });
    expect(run(sim, 1)).toContainEqual({ type: 'leakStarted', tank: 5, reported: true });
  });

  it('corroded tanks leak on their own over time, liners make it rarer', () => {
    const leaks = (liners: number) => {
      let n = 0;
      for (let seed = 0; seed < 12; seed++) {
        const sim = createPlantSim({ seed: `leak-${seed}` });
        sim.enqueue({ type: 'grantCredits', amount: 500_000 });
        sim.enqueue({ type: 'setClearance', level: 3 });
        for (let i = 0; i < liners; i++) sim.enqueue({ type: 'buyUpgrade', id: 'tank-liners' });
        n += run(sim, HOUR * 24 * 2).filter((e) => e.type === 'leakStarted').length;
      }
      return n;
    };
    const bare = leaks(0);
    expect(bare).toBeGreaterThan(3);
    expect(leaks(2)).toBeLessThan(bare);
  });
});
