import { NOMINAL_THERMAL_MW, STEAM_TAU, TURBINE_EFFICIENCY, VIBRATION_OUTPUT_LOSS } from './constants';
import { upgradeLevel } from './economy';
import type { Rng } from './rng';
import { clamp, relax, type SimSystem } from './system';
import type { PlantCommand, PlantState, SimEvent, TurbineState } from './types';

/**
 * Turbine B and its auxiliaries.
 *
 * - Speed: synchronous 3,000 rpm (50 Hz) while there is steam; it coasts down
 *   when steam is lost or the turbine trips, and runs back up after.
 * - Vibration comes from rotor imbalance on the LP rotor: a vector (grams at
 *   the balance radius, at a phase angle). Each bearing sees it through its
 *   own coupling, B3 (between the LP stages) most. A balance weight adds its
 *   own vector; placing one opposite the imbalance cancels it. Above 11 mm/s
 *   the protection trips the turbine.
 * - Feed pump motor B heats up as its bearing lubrication runs out; at 95 °C
 *   it trips and the feedwater shortfall costs output until it's serviced.
 * - Condenser vacuum follows the heat sink.
 */

export const SYNC_RPM = 3000;
/** Bearing vibration per gram of residual imbalance, mm/s (before coupling). */
export const MM_S_PER_GRAM = 0.05;
export const BEARING_BASE = [1.1, 1.3, 1.4, 1.2];
export const BEARING_COUPLING = [0.15, 0.45, 1.0, 0.7];
export const VIB_GOOD = 2.8;
export const VIB_ALERT = 7.1;
export const VIB_TRIP = 11;
/** Severity 0..1 used by alarms/HUD: max bearing / this. */
export const VIB_FULL_SCALE = 17.5;
export const PUMP_HOT_C = 80;
export const PUMP_TRIP_C = 95;
export const MAX_WEIGHT_G = 250;

export function createTurbineState(): TurbineState {
  return {
    rpm: SYNC_RPM,
    imbalance: { x: 8, y: -5 },
    weight: null,
    bearings: [...BEARING_BASE],
    tripped: false,
    balanced: true,
    vacuum: 0.05,
    lubeOilTemp: 46,
    feedPump: { temp: 66, lube: 0.75, tripped: false, hot: false },
  };
}

/** Residual imbalance vector after the balance weight, grams. */
export function residual(t: TurbineState): { x: number; y: number } {
  const w = t.weight;
  const wx = w ? w.mass * Math.cos((w.angle * Math.PI) / 180) : 0;
  const wy = w ? w.mass * Math.sin((w.angle * Math.PI) / 180) : 0;
  return { x: t.imbalance.x + wx, y: t.imbalance.y + wy };
}

export function bearingVibration(t: TurbineState, rpm = t.rpm): number[] {
  const r = residual(t);
  const mag = Math.hypot(r.x, r.y);
  // Imbalance force scales with speed squared.
  const k = (rpm / SYNC_RPM) ** 2;
  return BEARING_BASE.map((b, i) => (b + BEARING_COUPLING[i]! * mag * MM_S_PER_GRAM) * k);
}

export const turbineSystem: SimSystem = {
  id: 'turbine',
  step(state, ctx) {
    const t = state.turbine;
    const dt = ctx.dt;
    state.steamPower = relax(state.steamPower, state.thermalPower, STEAM_TAU, dt);

    // Speed: synchronous with steam, coasting without it (or when tripped).
    const steam = state.steamPower > NOMINAL_THERMAL_MW * 0.08 && !t.tripped;
    t.rpm = steam ? relax(t.rpm, SYNC_RPM, 120, dt) : relax(t.rpm, 0, 240, dt);
    if (steam && SYNC_RPM - t.rpm < 1) t.rpm = SYNC_RPM;

    t.bearings = bearingVibration(t);
    const worst = Math.max(...t.bearings);
    state.turbineVibration = clamp(worst / VIB_FULL_SCALE, 0, 1);
    if (!t.tripped && worst > VIB_TRIP) {
      t.tripped = true;
      ctx.emit({ type: 'turbineTrip', reason: `Bearing vibration above ${VIB_TRIP} mm/s` });
    }
    const balancedNow = t.bearings[2]! < VIB_GOOD;
    if (balancedNow && !t.balanced && t.rpm > SYNC_RPM * 0.95) ctx.emit({ type: 'turbineBalanced' });
    t.balanced = balancedNow;

    // Feed pump motor B: lubrication runs down over ~6 game days; heat follows.
    const fp = t.feedPump;
    fp.lube = clamp(fp.lube - dt / (6 * 86400), 0, 1);
    const load = clamp(state.steamPower / NOMINAL_THERMAL_MW, 0, 1.2);
    fp.temp = relax(fp.temp, 32 + load * (28 + 38 * (1 - fp.lube)), 900, dt);
    if (!fp.hot && fp.temp > PUMP_HOT_C) {
      fp.hot = true;
      ctx.emit({ type: 'feedPumpHot', temp: fp.temp });
    } else if (fp.hot && fp.temp < PUMP_HOT_C - 4) fp.hot = false;
    if (!fp.tripped && fp.temp > PUMP_TRIP_C) {
      fp.tripped = true;
      ctx.emit({ type: 'feedPumpTripped' });
    } else if (fp.tripped && fp.lube > 0.5 && fp.temp < PUMP_HOT_C - 10) {
      // Serviced and cooled: the motor restarts.
      fp.tripped = false;
    }

    t.vacuum = 0.05 + 0.12 * (1 - state.coolingEfficiency) + (t.rpm < SYNC_RPM * 0.5 ? 0.02 : 0);
    t.lubeOilTemp = relax(t.lubeOilTemp, 30 + 16 * (t.rpm / SYNC_RPM), 600, dt);

    const efficiency = TURBINE_EFFICIENCY + 0.008 * upgradeLevel(state, 'turbine-blades');
    const sync = clamp((t.rpm - 2700) / 250, 0, 1);
    const feed = fp.tripped ? 0.6 : 1;
    const vacuumLoss = clamp((t.vacuum - 0.05) * 1.5, 0, 0.3);
    state.output =
      state.steamPower *
      efficiency *
      sync *
      feed *
      (1 - vacuumLoss) *
      (1 - VIBRATION_OUTPUT_LOSS * state.turbineVibration);
  },
};

/** Turbine commands. Returns true if the command was one of ours. */
export function applyTurbineCommand(
  state: PlantState,
  cmd: PlantCommand,
  emit: (e: SimEvent) => void,
  rng: Rng,
): boolean {
  const t = state.turbine;
  const reject = (reason: string) => {
    emit({ type: 'commandRejected', command: cmd.type, reason });
    return true;
  };
  switch (cmd.type) {
    case 'fitBalanceWeight': {
      const mass = clamp(cmd.mass, 0, MAX_WEIGHT_G);
      t.weight = mass > 0 ? { angle: ((cmd.angle % 360) + 360) % 360, mass } : null;
      const b3 = bearingVibration(t, SYNC_RPM)[2]!;
      emit({ type: 'weightFitted', vibration: b3 });
      return true;
    }
    case 'setImbalance': {
      const a = (cmd.phase * Math.PI) / 180;
      t.imbalance = { x: cmd.mass * Math.cos(a), y: cmd.mass * Math.sin(a) };
      t.weight = null;
      return true;
    }
    case 'serviceFeedPump':
      t.feedPump.lube = 1;
      emit({ type: 'feedPumpServiced' });
      return true;
    case 'setFeedPumpLube':
      t.feedPump.lube = clamp(cmd.lube, 0, 1);
      if (cmd.temp !== undefined) t.feedPump.temp = cmd.temp;
      return true;
    case 'resetTurbine':
      if (!t.tripped) return true;
      if (Math.max(...bearingVibration(t, SYNC_RPM)) > VIB_ALERT)
        return reject('Rotor still out of balance: rebalance before resetting.');
      t.tripped = false;
      emit({ type: 'turbineReset' });
      return true;
    case 'injectFault':
      if (cmd.fault !== 'turbine-vibration') return false;
      {
        // Severity s raises B3 by s × full scale: an imbalance kick at a random phase.
        const grams = (cmd.severity * VIB_FULL_SCALE) / MM_S_PER_GRAM / BEARING_COUPLING[2]!;
        const a = rng.range(0, Math.PI * 2);
        t.imbalance.x += grams * Math.cos(a);
        t.imbalance.y += grams * Math.sin(a);
        t.bearings = bearingVibration(t);
        state.turbineVibration = clamp(Math.max(...t.bearings) / VIB_FULL_SCALE, 0, 1);
      }
      return true;
    default:
      return false;
  }
}
