import {
  CORE_DT_PER_MW,
  CORE_TEMP_TAU,
  INLET_LOSS_C,
  INLET_TAU,
  INLET_TEMP_C,
  MIN_FLOW,
  NOMINAL_PRESSURE_MPA,
  PRESSURE_NOISE_MPA,
  PRESSURE_PER_C,
  PRESSURE_TAU,
} from '../constants';
import { clamp, relax, type SimSystem } from '../system';

/** Lumped core heat balance: core temperature lags thermal power; pressure follows temperature. */
export const thermalSystem: SimSystem = {
  id: 'thermal',
  step(state, ctx) {
    // A starved make-up supply (water reserve) costs heat-sink performance too.
    const sink = state.coolingEfficiency * (0.4 + 0.6 * state.water.supply);
    const inletTarget = INLET_TEMP_C + (1 - sink) * INLET_LOSS_C;
    state.inletTemp = relax(state.inletTemp, inletTarget, INLET_TAU, ctx.dt);

    const flow = Math.max(MIN_FLOW, state.coolantFlow);
    const coreTarget = state.inletTemp + (CORE_DT_PER_MW * state.thermalPower) / flow;
    state.coreTemp = relax(state.coreTemp, coreTarget, CORE_TEMP_TAU, ctx.dt);

    const pressureTarget = NOMINAL_PRESSURE_MPA + PRESSURE_PER_C * (state.coreTemp - 312);
    state.pressure = clamp(
      relax(state.pressure, pressureTarget, PRESSURE_TAU, ctx.dt) + ctx.rng.noise(PRESSURE_NOISE_MPA),
      0.1,
      25,
    );
  },
};
