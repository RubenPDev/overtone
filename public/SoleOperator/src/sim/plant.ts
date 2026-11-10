import {
  CELL_COUNT,
  CORE_DT_PER_MW,
  DECAY_HEAT_FRACTION,
  GAME_SECONDS_PER_TICK,
  INLET_TEMP_C,
  NOMINAL_FISSION_MW,
  NOMINAL_PRESSURE_MPA,
  NOMINAL_THERMAL_MW,
  START_TIME_S,
  TURBINE_EFFICIENCY,
} from './constants';
import { Rng } from './rng';
import { clamp, type SimSystem, type TickContext } from './system';
import { alarmsSystem } from './systems/alarms';
import { fuelSystem } from './systems/fuel';
import { kineticsSystem } from './systems/kinetics';
import { netReactivity, reactivitySystem } from './systems/reactivity';
import { rodsSystem } from './systems/rods';
import { thermalSystem } from './systems/thermal';
import { turbineSystem } from './systems/turbine';
import type { ControlRod, FuelCell, PlantCommand, PlantSim, PlantState, SimEvent, SimSnapshot } from './types';

export const SIM_SCHEMA = 1;

/**
 * The tick pipeline, in order. Add a new system by writing a SimSystem and
 * inserting it here (see README "How to add a new sim system").
 */
export const SYSTEMS: readonly SimSystem[] = [
  rodsSystem,
  reactivitySystem,
  kineticsSystem,
  fuelSystem,
  thermalSystem,
  turbineSystem,
  alarmsSystem,
];

export interface PlantSimOptions {
  seed: string | number;
  /** Burn-up of the cell that starts the game due for a swap (index 6 = cell 07). */
  spentCell?: { cell: number; burnup: number };
}

export const assemblyId = (cell: number) => `FA-${String(cell + 1).padStart(2, '0')}`;

/** Uniform rod insertion that makes the core exactly critical at nominal power and temperature. */
export function criticalInsertion(cells: readonly FuelCell[]): number {
  const coreTemp = INLET_TEMP_C + CORE_DT_PER_MW * NOMINAL_THERMAL_MW;
  const rho = (x: number) =>
    netReactivity(
      cells,
      Array.from({ length: CELL_COUNT }, () => ({ insertion: x, target: x })),
      coreTemp,
      NOMINAL_FISSION_MW,
    );
  let lo = 0;
  let hi = 1;
  if (rho(lo) < 0) return 0;
  if (rho(hi) > 0) return 1;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (rho(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** A plant at steady nominal power, mid-cycle, with one cell close to spent. */
export function createInitialState(rng: Rng, options: PlantSimOptions): PlantState {
  const spent = options.spentCell ?? { cell: 6, burnup: 0.955 };
  const cells: FuelCell[] = Array.from({ length: CELL_COUNT }, (_, i) => ({
    loaded: true,
    burnup: i === spent.cell ? spent.burnup : rng.range(0.22, 0.58),
    assembly: assemblyId(i),
    power: NOMINAL_THERMAL_MW / CELL_COUNT,
  }));
  const x = criticalInsertion(cells);
  const rods: ControlRod[] = Array.from({ length: CELL_COUNT }, () => ({ insertion: x, target: x }));
  const coreTemp = INLET_TEMP_C + CORE_DT_PER_MW * NOMINAL_THERMAL_MW;
  return {
    tick: 0,
    time: START_TIME_S,
    fissionPower: NOMINAL_FISSION_MW,
    decayHeat: NOMINAL_FISSION_MW * DECAY_HEAT_FRACTION,
    thermalPower: NOMINAL_THERMAL_MW,
    reactivity: 0,
    keff: 1,
    powerTrend: 0,
    coreTemp,
    inletTemp: INLET_TEMP_C,
    pressure: NOMINAL_PRESSURE_MPA,
    coolantFlow: 1,
    coolingEfficiency: 1,
    steamPower: NOMINAL_THERMAL_MW,
    output: NOMINAL_THERMAL_MW * TURBINE_EFFICIENCY,
    turbineVibration: 0,
    scrammed: false,
    cells,
    rods,
    alarms: [],
  };
}

function validCell(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n < CELL_COUNT;
}

function applyCommand(state: PlantState, cmd: PlantCommand, emit: (e: SimEvent) => void): void {
  const reject = (reason: string) => emit({ type: 'commandRejected', command: cmd.type, reason });
  const rodsLocked = () => state.scrammed && (reject('Rods are latched in after a scram. Reset first.'), true);

  switch (cmd.type) {
    case 'setRodTarget':
      if (!validCell(cmd.rod)) return reject('No such rod');
      if (rodsLocked()) return;
      state.rods[cmd.rod]!.target = clamp(cmd.insertion, 0, 1);
      return;
    case 'nudgeRod': {
      if (!validCell(cmd.rod)) return reject('No such rod');
      if (rodsLocked()) return;
      const rod = state.rods[cmd.rod]!;
      rod.target = clamp(rod.target + cmd.delta, 0, 1);
      return;
    }
    case 'setAllRods':
      if (rodsLocked()) return;
      for (const r of state.rods) r.target = clamp(cmd.insertion, 0, 1);
      return;
    case 'scram':
      if (state.scrammed) return;
      state.scrammed = true;
      for (const r of state.rods) r.target = 1;
      emit({ type: 'scram' });
      return;
    case 'resetScram':
      if (!state.scrammed) return;
      state.scrammed = false;
      emit({ type: 'scramReset' });
      return;
    case 'unloadCell': {
      if (!validCell(cmd.cell)) return reject('No such cell');
      const cell = state.cells[cmd.cell]!;
      if (!cell.loaded) return reject('Cell is already empty');
      if (state.rods[cmd.cell]!.insertion < 0.999) return reject('Insert the cell’s rod fully first');
      emit({ type: 'cellUnloaded', cell: cmd.cell, assembly: cell.assembly, burnup: cell.burnup });
      cell.loaded = false;
      cell.assembly = null;
      cell.burnup = 0;
      cell.power = 0;
      return;
    }
    case 'loadCell': {
      if (!validCell(cmd.cell)) return reject('No such cell');
      const cell = state.cells[cmd.cell]!;
      if (cell.loaded) return reject('Cell is occupied');
      if (state.rods[cmd.cell]!.insertion < 0.999) return reject('Insert the cell’s rod fully first');
      cell.loaded = true;
      cell.assembly = cmd.assembly;
      cell.burnup = clamp(cmd.burnup ?? 0, 0, 1);
      emit({ type: 'cellLoaded', cell: cmd.cell, assembly: cmd.assembly });
      return;
    }
    case 'setCoolantFlow':
      state.coolantFlow = clamp(cmd.fraction, 0, 1.2);
      return;
    case 'injectFault':
      if (cmd.fault === 'turbine-vibration')
        state.turbineVibration = clamp(state.turbineVibration + cmd.severity, 0, 1);
      if (cmd.fault === 'cooling-loss')
        state.coolingEfficiency = clamp(state.coolingEfficiency - cmd.severity, 0, 1);
      return;
    case 'clearFaults':
      state.turbineVibration = 0;
      state.coolingEfficiency = 1;
      return;
  }
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export function createPlantSim(options: PlantSimOptions): PlantSim {
  let rng = Rng.fromSeed(options.seed);
  let state = createInitialState(rng, options);
  let pending: PlantCommand[] = [];

  return {
    tickSeconds: GAME_SECONDS_PER_TICK,

    enqueue(command) {
      pending.push(command);
    },

    step() {
      const events: SimEvent[] = [];
      const emit = (e: SimEvent) => events.push(e);
      const commands = pending;
      pending = [];
      for (const cmd of commands) applyCommand(state, cmd, emit);

      const ctx: TickContext = { dt: GAME_SECONDS_PER_TICK, rng, emit };
      for (const system of SYSTEMS) system.step(state, ctx);

      state.tick += 1;
      state.time += GAME_SECONDS_PER_TICK;
      return events;
    },

    getState() {
      return state;
    },

    snapshot() {
      return { schema: SIM_SCHEMA, state: clone(state), rng: rng.getState(), pending: clone(pending) };
    },

    restore(snapshot: SimSnapshot) {
      if (snapshot.schema !== SIM_SCHEMA) throw new Error(`Unsupported sim schema ${snapshot.schema}`);
      state = clone(snapshot.state);
      rng = Rng.fromState(snapshot.rng);
      pending = clone(snapshot.pending);
    },
  };
}
