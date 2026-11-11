import { describe, expect, it } from 'vitest';
import { GRID_PRICE, START_CREDITS, UPGRADES, clearanceCost, gridPrice, upgradeLevel } from './economy';
import { createPlantSim } from './plant';
import type { PlantSim, SimEvent } from './types';

const run = (sim: PlantSim, ticks: number): SimEvent[] => {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
};
const HOUR = 600; // ticks per game hour

describe('economy', () => {
  it('sells net output to the grid at a price that follows demand', () => {
    expect(gridPrice(18 * 3600)).toBeCloseTo(GRID_PRICE * 1.3, 6);
    expect(gridPrice(6 * 3600)).toBeCloseTo(GRID_PRICE * 0.7, 6);
    const sim = createPlantSim({ seed: 1 });
    expect(sim.getState().econ.credits).toBe(START_CREDITS);
    run(sim, HOUR);
    const s = sim.getState();
    // ~1180 MWe net for an hour at roughly the 08:00–09:00 price.
    const gained = s.econ.credits - START_CREDITS;
    expect(gained).toBeGreaterThan(s.netOutput * gridPrice(8.5 * 3600) * 0.9);
    expect(gained).toBeLessThan(s.netOutput * gridPrice(8.5 * 3600) * 1.1);
    expect(s.econ.earned).toBeCloseTo(gained, 6);
  });

  it('buys power back at a premium when the plant is a net consumer', () => {
    const sim = createPlantSim({ seed: 2 });
    sim.enqueue({ type: 'scram' });
    run(sim, HOUR * 2);
    const c0 = sim.getState().econ.credits;
    run(sim, HOUR);
    expect(sim.getState().netOutput).toBeLessThan(0);
    expect(sim.getState().econ.credits).toBeLessThan(c0);
  });

  it('upgrades cost credits, respect clearance, and change the systems that read them', () => {
    const sim = createPlantSim({ seed: 3 });
    sim.enqueue({ type: 'grantCredits', amount: 15_000 });
    sim.enqueue({ type: 'buyUpgrade', id: 'rod-drives' });
    const ev = run(sim, 1);
    expect(ev).toContainEqual({ type: 'purchased', item: 'rod-drives', level: 1 });
    expect(upgradeLevel(sim.getState(), 'rod-drives')).toBe(1);

    // Level 2 needs clearance L3, however rich you are.
    sim.enqueue({ type: 'grantCredits', amount: 1_000_000 });
    sim.enqueue({ type: 'buyUpgrade', id: 'rod-drives' });
    expect(run(sim, 1).find((e) => e.type === 'commandRejected')).toMatchObject({
      reason: 'Needs clearance L3.',
    });

    // Faster rods: a full stroke now takes 200 game s instead of 300.
    sim.enqueue({ type: 'setAllRods', insertion: 1 });
    const start = sim.getState().rods[0]!.insertion;
    run(sim, 10); // 60 game s
    const moved = sim.getState().rods[0]!.insertion - start;
    expect(moved).toBeCloseTo(60 / 200, 3);
  });

  it('refuses purchases it cannot afford', () => {
    const sim = createPlantSim({ seed: 4 });
    sim.enqueue({ type: 'grantCredits', amount: -START_CREDITS });
    sim.enqueue({ type: 'buyUpgrade', id: 'scanner' });
    const r = run(sim, 1).find((e) => e.type === 'commandRejected');
    expect(r).toMatchObject({ command: 'buyUpgrade' });
    expect(upgradeLevel(sim.getState(), 'scanner')).toBe(0);
  });

  it('turbine blades raise output; cryo expansion lowers the ring’s draw', () => {
    const a = createPlantSim({ seed: 5 });
    const b = createPlantSim({ seed: 5 });
    b.enqueue({ type: 'setClearance', level: 2 });
    b.enqueue({ type: 'grantCredits', amount: 200_000 });
    b.enqueue({ type: 'buyUpgrade', id: 'turbine-blades' });
    b.enqueue({ type: 'buyUpgrade', id: 'cryo-plant' });
    run(a, 50);
    run(b, 50);
    expect(b.getState().output - a.getState().output).toBeGreaterThan(25);
    expect(a.getState().accel.powerDraw - b.getState().accel.powerDraw).toBeCloseTo(4, 0);
  });

  it('market: sells products, buys feedstock, fabricates fuel from enriched uranium', () => {
    const sim = createPlantSim({ seed: 6 });
    sim.enqueue({ type: 'addStock', stock: 'mo99', amount: 5 });
    sim.enqueue({ type: 'sell', stock: 'mo99', amount: 10 });
    const sold = run(sim, 1).find((e) => e.type === 'sold');
    expect(sold).toMatchObject({ stock: 'mo99', amount: 5, credits: 5 * 420 });
    expect(sim.getState().accel.stock.mo99).toBe(0);

    sim.enqueue({ type: 'sell', stock: 'depleted-u', amount: 10 });
    expect(run(sim, 1).some((e) => e.type === 'commandRejected')).toBe(true);

    const du = sim.getState().accel.stock['depleted-u'];
    sim.enqueue({ type: 'buyItem', id: 'depleted-u' });
    run(sim, 1);
    expect(sim.getState().accel.stock['depleted-u']).toBe(du + 100);

    sim.enqueue({ type: 'buyItem', id: 'fuel-fab' });
    expect(run(sim, 1).some((e) => e.type === 'commandRejected')).toBe(true);
    sim.enqueue({ type: 'addStock', stock: 'enriched-u', amount: 40 });
    sim.enqueue({ type: 'buyItem', id: 'fuel-fab' });
    expect(run(sim, 1)).toContainEqual({ type: 'purchased', item: 'fuel-fab', level: 0 });
    expect(sim.getState().accel.stock['enriched-u']).toBe(0);
  });

  it('clearance reviews spend research and credits and unlock higher tiers', () => {
    const sim = createPlantSim({ seed: 7 });
    expect(sim.getState().accel.clearance).toBe(1);
    sim.enqueue({ type: 'clearanceReview' });
    expect(run(sim, 1).some((e) => e.type === 'commandRejected')).toBe(true);
    const cost = clearanceCost(1);
    sim.enqueue({ type: 'addStock', stock: 'research', amount: cost.research });
    sim.enqueue({ type: 'clearanceReview' });
    expect(run(sim, 1)).toContainEqual({ type: 'clearanceRaised', level: 2 });
    expect(sim.getState().accel.stock.research).toBe(0);
    sim.enqueue({ type: 'selectRecipe', recipe: 'breed-pu' });
    expect(run(sim, 1).some((e) => e.type === 'productionStarted')).toBe(true);
  });

  it('offers contracts, pays out deliveries, and fails ones past their deadline', () => {
    const sim = createPlantSim({ seed: 8 });
    const offered = run(sim, 1).filter((e) => e.type === 'contractOffered');
    expect(offered).toHaveLength(1);
    run(sim, HOUR * 7);
    const offers = sim.getState().econ.contracts.filter((c) => c.status === 'offered');
    expect(offers.length).toBeGreaterThanOrEqual(2);
    expect(offers.length).toBeLessThanOrEqual(3);
    for (const c of offers) expect(c.reward).toBeGreaterThan(0);

    const deliver = offers.find((c) => c.kind === 'deliver');
    const grid = offers.find((c) => c.kind === 'grid');
    if (deliver) {
      sim.enqueue({ type: 'acceptContract', id: deliver.id });
      sim.enqueue({ type: 'addStock', stock: deliver.stock!, amount: deliver.amount });
      const credits = sim.getState().econ.credits;
      const ev = run(sim, 1);
      expect(ev.find((e) => e.type === 'contractCompleted')).toMatchObject({ reward: deliver.reward });
      expect(sim.getState().econ.credits).toBeGreaterThan(credits + deliver.reward - 1);
    }
    if (grid) {
      sim.enqueue({ type: 'acceptContract', id: grid.id });
      sim.enqueue({ type: 'scram' }); // can't hold the target with the reactor down
      const ev = run(sim, Math.ceil(grid.window / 6) + 1);
      expect(ev.some((e) => e.type === 'contractFailed' && e.id === grid.id)).toBe(true);
    }
  });

  it('contracts are deterministic for a seed', () => {
    const a = createPlantSim({ seed: 'same' });
    const b = createPlantSim({ seed: 'same' });
    run(a, HOUR * 10);
    run(b, HOUR * 10);
    expect(a.getState().econ).toEqual(b.getState().econ);
  });

  it('every upgrade is well-formed', () => {
    const ids = new Set<string>();
    for (const u of UPGRADES) {
      expect(ids.has(u.id)).toBe(false);
      ids.add(u.id);
      expect(u.levels.length).toBe(u.effect.length);
      for (const l of u.levels) {
        expect(l.cost).toBeGreaterThan(0);
        expect(l.clearance).toBeGreaterThanOrEqual(1);
        expect(l.clearance).toBeLessThanOrEqual(8);
      }
    }
  });
});
