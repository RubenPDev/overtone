import {
  DECAY_HEAT_FRACTION,
  DECAY_HEAT_TAU,
  GENERATION_TIME,
  MAX_DECAY_PER_TICK,
  MAX_FISSION_MW,
  MAX_GROWTH_PER_TICK,
  MIN_FISSION_MW,
  SOURCE_MW_PER_S,
} from '../constants';
import { clamp, relax, type SimSystem } from '../system';

/**
 * Simplified point kinetics: power grows or decays exponentially with reactivity
 * (one lumped generation time standing in for delayed neutrons), plus decay heat
 * that lags fission power and keeps the core warm after a scram.
 */
export const kineticsSystem: SimSystem = {
  id: 'kinetics',
  step(state, ctx) {
    const prevThermal = state.thermalPower;
    const exponent = clamp(
      ((state.reactivity * 1e-5) / GENERATION_TIME) * ctx.dt,
      -MAX_DECAY_PER_TICK,
      MAX_GROWTH_PER_TICK,
    );
    state.fissionPower = clamp(
      state.fissionPower * Math.exp(exponent) + SOURCE_MW_PER_S * ctx.dt,
      MIN_FISSION_MW,
      MAX_FISSION_MW,
    );
    state.decayHeat = relax(
      state.decayHeat,
      state.fissionPower * DECAY_HEAT_FRACTION,
      DECAY_HEAT_TAU,
      ctx.dt,
    );
    state.thermalPower = state.fissionPower + state.decayHeat;

    // Relative change per game minute, smoothed over ~half a minute.
    const rate = prevThermal > 0 ? ((state.thermalPower - prevThermal) / prevThermal) * (60 / ctx.dt) : 0;
    state.powerTrend = relax(state.powerTrend, rate, 30, ctx.dt);
  },
};
