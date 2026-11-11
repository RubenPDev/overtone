import { describe, expect, it } from 'vitest';
import { CRYO_TRIP_K, MAX_FIELD, RECIPES, beamPower } from './accelerator';
import { createPlantSim } from './plant';
import type { PlantSim, SimEvent } from './types';

const run = (sim: PlantSim, ticks: number): SimEvent[] => {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
};

describe('particle accelerator', () => {
  it('starts circulating around 1.2 GeV with cavity 03 detuned, drawing power off the net output', () => {
    const s = createPlantSim({ seed: 1 }).getState();
    const a = s.accel;
    expect(a.beamOn).toBe(true);
    expect(a.energy).toBeGreaterThan(1.05);
    expect(a.energy).toBeLessThan(1.25);
    expect(a.cavities[2]!.detune).toBe(-12);
    expect(a.cavities[2]!.field).toBeGreaterThan(25);
    expect(a.cavities[2]!.field).toBeLessThan(28);
    expect(a.powerDraw).toBeGreaterThan(30);
    expect(s.netOutput).toBeCloseTo(s.output - a.powerDraw, 6);
  });

  it('tuning a cavity back to resonance restores its field, lowers loss and raises energy', () => {
    const sim = createPlantSim({ seed: 2 });
    const before = { loss: sim.getState().accel.loss, energy: sim.getState().accel.energy };
    sim.enqueue({ type: 'tuneCavity', cavity: 2, deltaKHz: 12 });
    const events = run(sim, 600);
    const a = sim.getState().accel;
    expect(events).toContainEqual({ type: 'cavityTuned', cavity: 2 });
    expect(a.cavities[2]!.field).toBeGreaterThan(MAX_FIELD * 0.97);
    expect(a.loss).toBeLessThan(before.loss);
    expect(a.energy).toBeGreaterThan(before.energy);
  });

  it('a badly detuned ring trips the beam on loss', () => {
    const sim = createPlantSim({ seed: 3 });
    for (let c = 0; c < 8; c++) sim.enqueue({ type: 'tuneCavity', cavity: c, deltaKHz: 60 });
    const events = run(sim, 5);
    expect(events.find((e) => e.type === 'beamTrip')).toMatchObject({ reason: 'Beam loss above 2%' });
    run(sim, 300);
    expect(sim.getState().accel.current).toBeLessThan(0.05);
  });

  it('a reactor scram starves the cryo plant: the ring warms up and trips', () => {
    const sim = createPlantSim({ seed: 4 });
    sim.enqueue({ type: 'scram' });
    const events = run(sim, 2000);
    expect(events.some((e) => e.type === 'beamTrip')).toBe(true);
    expect(sim.getState().accel.cryo).toBeGreaterThan(CRYO_TRIP_K);
    sim.enqueue({ type: 'accelBeam', on: true });
    expect(run(sim, 1).some((e) => e.type === 'commandRejected')).toBe(true);
  });

  it('produces enriched uranium from depleted feed at a rate set by beam power', () => {
    const sim = createPlantSim({ seed: 5 });
    sim.enqueue({ type: 'selectRecipe', recipe: 'enrich-u' });
    const feed0 = sim.getState().accel.stock['depleted-u'];
    const events = run(sim, 600); // one game hour
    const a = sim.getState().accel;
    const made = a.stock['enriched-u'];
    expect(events.some((e) => e.type === 'productionStarted')).toBe(true);
    // ~1 kg per MWh: one hour at ~3 MW makes a few kg.
    expect(made).toBeGreaterThanOrEqual(Math.floor(beamPower(a) * 0.8));
    expect(made).toBeLessThanOrEqual(Math.ceil(beamPower(a) * 1.2) + 1);
    expect(a.stock['depleted-u']).toBeCloseTo(feed0 - made * 8, 6);
  });

  it('nothing is produced with the beam off, and production stops when feed runs out', () => {
    const sim = createPlantSim({ seed: 6 });
    sim.enqueue({ type: 'accelBeam', on: false });
    sim.enqueue({ type: 'selectRecipe', recipe: 'mo99' });
    run(sim, 600);
    expect(sim.getState().accel.stock.mo99).toBe(0);

    sim.enqueue({ type: 'accelBeam', on: true });
    sim.enqueue({ type: 'addStock', stock: 'mo-targets', amount: -38 }); // leave 2
    const events = run(sim, 2400);
    expect(sim.getState().accel.stock.mo99).toBe(2);
    expect(events.some((e) => e.type === 'feedExhausted')).toBe(true);
    expect(sim.getState().accel.recipe).toBeNull();
  });

  it('locks recipes above the clearance level, and every recipe is well-formed', () => {
    const sim = createPlantSim({ seed: 7 });
    sim.enqueue({ type: 'selectRecipe', recipe: 'antimatter' });
    expect(run(sim, 1).find((e) => e.type === 'commandRejected')).toMatchObject({
      reason: 'Needs clearance L8.',
    });
    sim.enqueue({ type: 'setClearance', level: 8 });
    sim.enqueue({ type: 'selectRecipe', recipe: 'antimatter' });
    expect(run(sim, 1).some((e) => e.type === 'productionStarted')).toBe(true);
    for (const r of RECIPES) {
      expect(r.perMWh).toBeGreaterThan(0);
      expect(r.tier).toBeGreaterThanOrEqual(1);
      expect(r.tier).toBeLessThanOrEqual(8);
    }
  });

  it('cavities drift over a game day, which is what makes tuning a recurring job', () => {
    const sim = createPlantSim({ seed: 8 });
    const d0 = sim.getState().accel.cavities.map((c) => c.detune);
    run(sim, 14400);
    const drift = sim.getState().accel.cavities.map((c, i) => Math.abs(c.detune - d0[i]!));
    expect(Math.max(...drift)).toBeGreaterThan(3);
  });
});
