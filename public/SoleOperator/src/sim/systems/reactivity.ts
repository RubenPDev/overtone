import {
  CELL_COUNT,
  EMPTY_CELL_PCM,
  FUEL_BURNUP_PCM,
  FUEL_FRESH_PCM,
  NOMINAL_FISSION_MW,
  POWER_COEFF_PCM,
  TEMP_COEFF_PCM,
  TEMP_REF_C,
  TOTAL_ROD_WORTH_PCM,
} from '../constants';
import type { SimSystem } from '../system';
import type { ControlRod, FuelCell } from '../types';

/** Integral rod worth: the classic S-curve. Rods are worth little at the ends of travel. */
export function rodWorthFraction(insertion: number): number {
  return insertion - Math.sin(2 * Math.PI * insertion) / (2 * Math.PI);
}

export function fuelReactivity(cells: readonly FuelCell[]): number {
  let sum = 0;
  for (const c of cells) sum += c.loaded ? FUEL_FRESH_PCM - FUEL_BURNUP_PCM * c.burnup : EMPTY_CELL_PCM;
  return sum / CELL_COUNT;
}

export function rodReactivity(rods: readonly ControlRod[]): number {
  let sum = 0;
  for (const r of rods) sum += rodWorthFraction(r.insertion);
  return (TOTAL_ROD_WORTH_PCM / CELL_COUNT) * sum;
}

export function feedbackReactivity(coreTemp: number, fissionPower: number): number {
  return TEMP_COEFF_PCM * (coreTemp - TEMP_REF_C) + POWER_COEFF_PCM * (fissionPower / NOMINAL_FISSION_MW);
}

export function netReactivity(
  cells: readonly FuelCell[],
  rods: readonly ControlRod[],
  coreTemp: number,
  fissionPower: number,
): number {
  return fuelReactivity(cells) - rodReactivity(rods) - feedbackReactivity(coreTemp, fissionPower);
}

/** Net reactivity (pcm) and k-effective from fuel, rods and temperature/power feedback. */
export const reactivitySystem: SimSystem = {
  id: 'reactivity',
  step(state) {
    state.reactivity = netReactivity(state.cells, state.rods, state.coreTemp, state.fissionPower);
    state.keff = 1 / (1 - state.reactivity * 1e-5);
  },
};
