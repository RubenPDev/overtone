import { ALARM_LIMITS } from '../constants';
import type { SimSystem } from '../system';
import type { AlarmId, PlantState } from '../types';

const READINGS: Record<AlarmId, (s: PlantState) => number> = {
  'core-temp-high': (s) => s.coreTemp,
  'pressure-high': (s) => s.pressure,
  'power-high': (s) => s.thermalPower,
  'turbine-vibration': (s) => s.turbineVibration,
  'water-low': (s) => 1 - s.water.inventory,
};

/** Edge-triggered alarms with hysteresis, so a reading on the line doesn't chatter. */
export const alarmsSystem: SimSystem = {
  id: 'alarms',
  step(state, ctx) {
    for (const id of Object.keys(ALARM_LIMITS) as AlarmId[]) {
      const value = READINGS[id](state);
      const { set, clear } = ALARM_LIMITS[id];
      const active = state.alarms.includes(id);
      if (!active && value > set) {
        state.alarms.push(id);
        ctx.emit({ type: 'alarm', alarm: id });
      } else if (active && value < clear) {
        state.alarms = state.alarms.filter((a) => a !== id);
        ctx.emit({ type: 'alarmCleared', alarm: id });
      }
    }
  },
};
