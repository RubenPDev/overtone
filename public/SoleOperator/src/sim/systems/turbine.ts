import { STEAM_TAU, TURBINE_EFFICIENCY, VIBRATION_DECAY_TAU, VIBRATION_OUTPUT_LOSS } from '../constants';
import { relax, type SimSystem } from '../system';

/** Steam generators and turbine: electrical output lags thermal power; vibration costs output. */
export const turbineSystem: SimSystem = {
  id: 'turbine',
  step(state, ctx) {
    state.steamPower = relax(state.steamPower, state.thermalPower, STEAM_TAU, ctx.dt);
    state.turbineVibration = relax(state.turbineVibration, 0, VIBRATION_DECAY_TAU, ctx.dt);
    state.output =
      state.steamPower * TURBINE_EFFICIENCY * (1 - VIBRATION_OUTPUT_LOSS * state.turbineVibration);
  },
};
