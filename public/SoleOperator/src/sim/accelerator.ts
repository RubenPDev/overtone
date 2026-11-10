import type { Rng } from './rng';
import { clamp, relax, type SimSystem } from './system';
import type { AccelState, PlantCommand, PlantState, SimEvent, StockId } from './types';

/**
 * Particle accelerator: a 3.4 km superconducting ring under the plant.
 *
 * Eight RF cavities set the beam energy; each drifts off resonance over time
 * (detune), which lowers its field, raises beam loss and warms the cryomodules.
 * Beam power (MW) = energy (GeV) x current (mA) drives the production
 * recipes at the target station. The ring's electrical draw comes off the
 * plant's output, and a reactor trip starves the cryo plant.
 */

export const RING_CIRCUMFERENCE_M = 3400;
export const CAVITY_COUNT = 8;
export const MAX_FIELD = 31; // MV/m
export const CAVITY_BANDWIDTH_KHZ = 30;
/** Detune random walk, kHz per sqrt(game second). ~15 kHz of drift over a game day. */
export const DETUNE_DRIFT = 0.05;
export const INJECTION_GEV = 0.2;
export const RAMP_GEV = 1.0;
export const MAX_CURRENT_MA = 2.8;
export const CRYO_BASE_K = 2.0;
export const CRYO_TRIP_K = 4.5;
export const LOSS_BASE = 0.0005;
/** Extra loss per unit of missing field fraction, summed over cavities. */
export const LOSS_PER_DETUNE = 0.03;
export const LOSS_TRIP = 0.02;
/** Cryo plant + magnets, always on (MWe). */
export const POWER_IDLE_MW = 18;
/** RF amplifiers with beam on (MWe), plus beam power over wall-plug efficiency. */
export const POWER_RF_MW = 10;
export const WALLPLUG_EFFICIENCY = 0.35;

export interface Recipe {
  id: string;
  name: string;
  /** What comes out, and in which unit. */
  stock: StockId;
  unit: string;
  /** Inputs consumed per unit produced (feedstock or earlier products). */
  inputs: { stock: StockId; perUnit: number }[];
  /** Units produced per MWh of beam on target. */
  perMWh: number;
  /** Minimum beam energy for the process, GeV. */
  minEnergy: number;
  /** Clearance level needed. */
  tier: number;
  station: string;
  blurb: string;
}

/**
 * Production recipes. Data only: add a line to add a product. Tiers above the
 * player's clearance are shown locked (the research/clearance progression is a TODO).
 */
export const RECIPES: Recipe[] = [
  {
    id: 'enrich-u',
    name: 'Enriched uranium',
    stock: 'enriched-u',
    unit: 'kg',
    inputs: [{ stock: 'depleted-u', perUnit: 8 }],
    perMWh: 1.0,
    minEnergy: 0.2,
    tier: 1,
    station: 'Target Station',
    blurb: 'Electromagnetic isotope separation on the extraction line: 5% U-235 for fresh fuel.',
  },
  {
    id: 'mo99',
    name: 'Medical isotopes (Mo-99)',
    stock: 'mo99',
    unit: 'batches',
    inputs: [{ stock: 'mo-targets', perUnit: 1 }],
    perMWh: 2.0,
    minEnergy: 0.5,
    tier: 1,
    station: 'Target Station',
    blurb: 'Irradiated molybdenum targets for hospital technetium generators.',
  },
  {
    id: 'research',
    name: 'Collider run',
    stock: 'research',
    unit: 'data',
    inputs: [],
    perMWh: 5,
    minEnergy: 1.0,
    tier: 1,
    station: 'Detector Hall',
    blurb: 'Collisions in the Detector Hall. Research data unlocks higher clearance.',
  },
  {
    id: 'breed-pu',
    name: 'Plutonium-239',
    stock: 'pu239',
    unit: 'g',
    inputs: [{ stock: 'depleted-u', perUnit: 0.25 }],
    perMWh: 4,
    minEnergy: 1.0,
    tier: 2,
    station: 'Target Station',
    blurb: 'Spallation neutrons breed Pu-239 in a U-238 blanket around the target.',
  },
  {
    id: 'breed-u233',
    name: 'Uranium-233',
    stock: 'u233',
    unit: 'g',
    inputs: [{ stock: 'thorium', perUnit: 0.2 }],
    perMWh: 3,
    minEnergy: 1.0,
    tier: 3,
    station: 'Target Station',
    blurb: 'A thorium blanket bred into fissile U-233.',
  },
  {
    id: 'transmute',
    name: 'Waste transmutation',
    stock: 'transmuted',
    unit: 'kg',
    inputs: [{ stock: 'spent-fuel', perUnit: 0.05 }],
    perMWh: 0.5,
    minEnergy: 1.0,
    tier: 3,
    station: 'Target Station',
    blurb: 'Burns long-lived actinides from spent assemblies into short-lived products.',
  },
  {
    id: 'tritium',
    name: 'Tritium',
    stock: 'tritium',
    unit: 'g',
    inputs: [{ stock: 'lithium-6', perUnit: 0.1 }],
    perMWh: 0.5,
    minEnergy: 1.0,
    tier: 4,
    station: 'Target Station',
    blurb: 'Lithium-6 blankets bred into tritium: the first step to fusion fuel.',
  },
  {
    id: 'dt-fuel',
    name: 'D-T fusion fuel',
    stock: 'dt-fuel',
    unit: 'pellets',
    inputs: [
      { stock: 'tritium', perUnit: 1 },
      { stock: 'deuterium', perUnit: 1 },
    ],
    perMWh: 0.2,
    minEnergy: 1.1,
    tier: 6,
    station: 'Target Station',
    blurb: 'Cryogenic deuterium-tritium pellets for the fusion reactor upgrade.',
  },
  {
    id: 'he3',
    name: 'Helium-3',
    stock: 'he3',
    unit: 'g',
    inputs: [{ stock: 'tritium', perUnit: 1 }],
    perMWh: 0.1,
    minEnergy: 1.1,
    tier: 7,
    station: 'Target Station',
    blurb: 'Collected from tritium decay for aneutronic fusion.',
  },
  {
    id: 'antimatter',
    name: 'Antimatter',
    stock: 'antimatter',
    unit: 'ng',
    inputs: [],
    perMWh: 0.02,
    minEnergy: 1.45,
    tier: 8,
    station: 'Target Station',
    blurb: 'Antiprotons caught in a Penning trap. Needs the 1.45 GeV ring energy upgrade.',
  },
];

export const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

export const STOCK_LABEL: Record<StockId, string> = {
  'depleted-u': 'Depleted uranium',
  'mo-targets': 'Mo targets',
  thorium: 'Thorium',
  'lithium-6': 'Lithium-6',
  'spent-fuel': 'Spent assemblies',
  deuterium: 'Deuterium',
  'enriched-u': 'Enriched uranium',
  mo99: 'Mo-99 batches',
  pu239: 'Plutonium-239',
  u233: 'Uranium-233',
  transmuted: 'Transmuted waste',
  tritium: 'Tritium',
  'dt-fuel': 'D-T pellets',
  he3: 'Helium-3',
  antimatter: 'Antimatter',
  research: 'Research data',
};

export function cavityField(detune: number): number {
  return MAX_FIELD / (1 + (detune / CAVITY_BANDWIDTH_KHZ) ** 2);
}

export function beamPower(a: AccelState): number {
  return a.energy * a.current;
}

/** Ring after a long, uneventful shift: beam circulating, cavity 03 drifting. */
export function createAccelState(rng: Rng): AccelState {
  const cavities = Array.from({ length: CAVITY_COUNT }, (_, i) => {
    const detune = i === 2 ? -12 : rng.noise(3);
    return { detune, field: cavityField(detune) };
  });
  const stock = Object.fromEntries(Object.keys(STOCK_LABEL).map((k) => [k, 0])) as Record<StockId, number>;
  Object.assign(stock, { 'depleted-u': 400, 'mo-targets': 40, thorium: 60 });
  const a: AccelState = {
    beamOn: true,
    tripped: false,
    energy: 0,
    current: 2.4,
    cryo: CRYO_BASE_K,
    loss: 0,
    powerDraw: 0,
    cavities,
    recipe: null,
    progress: 0,
    stock,
    clearance: 3,
    detuned: cavities.map((c) => c.field < MAX_FIELD * 0.9),
  };
  a.energy = targetEnergy(a);
  a.loss = beamLoss(a);
  a.powerDraw = powerDraw(a);
  return a;
}

function targetEnergy(a: AccelState) {
  const eff = a.cavities.reduce((s, c) => s + c.field, 0) / (CAVITY_COUNT * MAX_FIELD);
  return INJECTION_GEV + RAMP_GEV * eff;
}

function beamLoss(a: AccelState) {
  return LOSS_BASE + (a.cavities.reduce((s, c) => s + (1 - c.field / MAX_FIELD), 0) * LOSS_PER_DETUNE) / 2;
}

function powerDraw(a: AccelState) {
  return POWER_IDLE_MW + (a.beamOn ? POWER_RF_MW + beamPower(a) / WALLPLUG_EFFICIENCY : 0);
}

/** Cavity drift, beam energy and current, loss, cryo, interlocks and power draw. */
export const acceleratorSystem: SimSystem = {
  id: 'accelerator',
  step(state, ctx) {
    const a = state.accel;
    const dt = ctx.dt;
    a.cavities.forEach((c, i) => {
      c.detune += ctx.rng.noise(DETUNE_DRIFT * Math.sqrt(dt) * 1.7);
      c.field = cavityField(c.detune);
      const low = c.field < MAX_FIELD * 0.9;
      const recovered = c.field > MAX_FIELD * 0.94;
      if (!a.detuned[i] && low) {
        a.detuned[i] = true;
        ctx.emit({ type: 'cavityDetuned', cavity: i });
      } else if (a.detuned[i] && recovered) a.detuned[i] = false;
    });

    a.loss = beamLoss(a);
    // The cryo plant needs power: if the reactor isn't making it, the ring warms up.
    const starved = state.output < POWER_IDLE_MW;
    a.cryo = relax(a.cryo, CRYO_BASE_K + (a.beamOn ? a.loss * 60 : 0) + (starved ? 4 : 0), 900, dt);

    if (a.beamOn) {
      const reason =
        a.cryo > CRYO_TRIP_K ? 'Cryomodules too warm' : a.loss > LOSS_TRIP ? 'Beam loss above 2%' : null;
      if (reason) {
        a.beamOn = false;
        a.tripped = true;
        ctx.emit({ type: 'beamTrip', reason });
      }
    }

    a.energy = relax(a.energy, a.beamOn ? targetEnergy(a) : 0, a.beamOn ? 60 : 6, dt);
    a.current = clamp(
      relax(a.current, a.beamOn ? MAX_CURRENT_MA * (1 - a.loss * 10) : 0, a.beamOn ? 120 : 6, dt),
      0,
      MAX_CURRENT_MA,
    );
    a.powerDraw = powerDraw(a);
    state.netOutput = state.output - a.powerDraw;
  },
};

/** Beam on target turns into product. */
export const productionSystem: SimSystem = {
  id: 'production',
  step(state, ctx) {
    const a = state.accel;
    if (!a.recipe || !a.beamOn) return;
    const r = RECIPE_BY_ID.get(a.recipe);
    if (!r || a.energy < r.minEnergy) return;
    a.progress += ((beamPower(a) * ctx.dt) / 3600) * r.perMWh;
    while (a.progress >= 1) {
      if (r.inputs.some((i) => a.stock[i.stock] < i.perUnit)) {
        ctx.emit({ type: 'feedExhausted', recipe: r.id });
        a.recipe = null;
        a.progress = 0;
        return;
      }
      for (const i of r.inputs) a.stock[i.stock] -= i.perUnit;
      a.stock[r.stock] += 1;
      a.progress -= 1;
      ctx.emit({ type: 'produced', recipe: r.id, stock: r.stock, total: a.stock[r.stock] });
    }
  },
};

/** Accelerator commands. Returns true if the command was one of ours. */
export function applyAccelCommand(
  state: PlantState,
  cmd: PlantCommand,
  emit: (e: SimEvent) => void,
): boolean {
  const a = state.accel;
  const reject = (reason: string) => emit({ type: 'commandRejected', command: cmd.type, reason });
  switch (cmd.type) {
    case 'accelBeam':
      if (cmd.on === a.beamOn) return true;
      if (cmd.on && a.cryo > CRYO_TRIP_K - 0.3) {
        reject('Cryomodules are too warm to hold beam.');
        return true;
      }
      a.beamOn = cmd.on;
      a.tripped = false;
      emit({ type: cmd.on ? 'beamStarted' : 'beamStopped' });
      return true;
    case 'tuneCavity': {
      const c = a.cavities[cmd.cavity];
      if (!c) {
        reject('No such cavity');
        return true;
      }
      const before = Math.abs(c.detune);
      c.detune = clamp(c.detune + cmd.deltaKHz, -120, 120);
      c.field = cavityField(c.detune);
      if (before >= 1 && Math.abs(c.detune) < 1) emit({ type: 'cavityTuned', cavity: cmd.cavity });
      return true;
    }
    case 'selectRecipe': {
      if (cmd.recipe === null) {
        a.recipe = null;
        a.progress = 0;
        return true;
      }
      const r = RECIPE_BY_ID.get(cmd.recipe);
      if (!r) reject('Unknown recipe');
      else if (r.tier > a.clearance) reject(`Needs clearance L${r.tier}.`);
      else if (r.inputs.some((i) => a.stock[i.stock] < i.perUnit)) reject('Not enough feedstock.');
      else {
        a.recipe = r.id;
        a.progress = 0;
        emit({ type: 'productionStarted', recipe: r.id });
      }
      return true;
    }
    case 'addStock':
      a.stock[cmd.stock] = Math.max(0, a.stock[cmd.stock] + cmd.amount);
      return true;
    case 'setClearance':
      a.clearance = clamp(Math.round(cmd.level), 1, 8);
      return true;
    default:
      return false;
  }
}
