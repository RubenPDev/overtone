import { upgradeLevel } from './economy';
import type { Rng } from './rng';
import { clamp, type SimSystem } from './system';
import type { PlantCommand, PlantState, SimEvent, Tank, WaterState } from './types';

/**
 * Demineralised water reserve: the tanks in the Water Containers hall feed
 * primary make-up and the steam cycle. Treatment (reverse osmosis) refills
 * them; the plant draws from every tank whose valve is open.
 *
 * Tanks corrode. Corrosion raises the chance of a leak, which is a hole at a
 * height on the shell: water drains out until the level falls below the
 * hole. To patch one, close the tank's valve (isolate it) and weld. If the
 * online reserve runs low the plant's heat sink suffers (`supply` < 1).
 */

export const TANK_CAPACITY = 2000; // m³
export const BASE_TANKS = 4;
export const MAX_TANKS = 6;
/** Make-up demand at zero and full power, m³/h. */
export const DEMAND_IDLE = 6;
export const DEMAND_FULL = 44;
/** Treatment train output, m³/h (before upgrades). */
export const TREATMENT_RATE = 50;
/** Below this fraction of the base reserve, cooling starts to suffer. */
export const SUPPLY_KNEE = 0.2;
export const VALVE_CLOSED = 0.02;

const LINER = [1, 0.5, 0.2];

function newTank(level: number, integrity: number): Tank {
  return { level, integrity, leak: 0, leakHeight: 0.4, leakAngle: 0, valve: 1 };
}

export function createWaterState(rng: Rng): WaterState {
  const integrity = [0.82, 0.74, 0.48, 0.78];
  const tanks = integrity.map((i) => newTank(TANK_CAPACITY * rng.range(0.82, 0.94), i));
  const w: WaterState = {
    tanks,
    inventory: 0,
    supply: 1,
    demand: 0,
    treatment: 0,
    fallingFor: 0,
    warned: false,
  };
  w.inventory = onlineVolume(w) / (BASE_TANKS * TANK_CAPACITY);
  return w;
}

export const isOnline = (t: Tank) => t.valve > VALVE_CLOSED;

function onlineVolume(w: WaterState) {
  return w.tanks.reduce((s, t) => s + (isOnline(t) ? t.level : 0), 0);
}

function startLeak(t: Tank, rng: Rng, rate: number) {
  t.leak = rate;
  // Radians from the side of the tank facing the hall (kept to the side you can see).
  t.leakAngle = rng.range(-1.1, 1.1);
  t.leakHeight = rng.range(0.12, 0.55);
}

export const waterSystem: SimSystem = {
  id: 'water',
  step(state, ctx) {
    const w = state.water;
    const dt = ctx.dt;
    const hours = dt / 3600;

    // New tanks arrive with the upgrade (part-filled; treatment tops them up).
    const want = Math.min(MAX_TANKS, BASE_TANKS + upgradeLevel(state, 'extra-tanks'));
    while (w.tanks.length < want) {
      w.tanks.push(newTank(TANK_CAPACITY * 0.3, 1));
      ctx.emit({ type: 'tankInstalled', tank: w.tanks.length - 1 });
    }

    const liner = LINER[Math.min(2, upgradeLevel(state, 'tank-liners'))]!;
    const sensors = upgradeLevel(state, 'leak-sensors') > 0;
    const before = w.tanks.reduce((s, t) => s + t.level, 0);

    w.tanks.forEach((t, i) => {
      // Corrosion and leak hazard.
      t.integrity = clamp(t.integrity - (0.012 / 24) * hours * liner, 0, 1);
      if (t.leak === 0 && t.level > 0) {
        const hazard = (0.004 + 0.05 * (1 - t.integrity) ** 2) * liner;
        if (ctx.rng.next() < hazard * hours) {
          startLeak(t, ctx.rng, ctx.rng.range(25, 60) * (1.3 - t.integrity));
          ctx.emit({ type: 'leakStarted', tank: i, reported: sensors });
        }
      }
      // A leak drains the tank down to the height of the hole, and slowly widens.
      if (t.leak > 0) {
        t.leak *= 1 + 0.08 * hours;
        const head = t.level / TANK_CAPACITY - t.leakHeight;
        if (head > 0)
          t.level = Math.max(t.leakHeight * TANK_CAPACITY, t.level - t.leak * Math.sqrt(head / 0.5) * hours);
      }
    });

    // Plant demand from open tanks (by valve opening × level), treatment into open tanks that aren't full.
    w.demand = DEMAND_IDLE + (DEMAND_FULL - DEMAND_IDLE) * clamp(state.thermalPower / 3700, 0, 1.2);
    w.treatment = TREATMENT_RATE * (1 + 0.5 * upgradeLevel(state, 'water-treatment'));
    const open = w.tanks.filter(isOnline);
    const weight = open.reduce((s, t) => s + t.valve * t.level, 0);
    let unmet = 0;
    if (weight > 0)
      for (const t of open) {
        const take = w.demand * hours * ((t.valve * t.level) / weight);
        unmet += Math.max(0, take - t.level);
        t.level = Math.max(0, t.level - take);
      }
    else unmet = w.demand * hours;
    const filling = open.filter((t) => t.level < TANK_CAPACITY);
    for (const t of filling)
      t.level = Math.min(TANK_CAPACITY, t.level + (w.treatment * hours) / filling.length);

    w.inventory = onlineVolume(w) / (BASE_TANKS * TANK_CAPACITY);
    w.supply = unmet > 0 ? 0 : clamp(w.inventory / SUPPLY_KNEE, 0, 1);

    // "Reserve falling" warning when a leak outruns treatment for half a game hour.
    const after = w.tanks.reduce((s, t) => s + t.level, 0);
    if (after < before - 1e-6 && w.tanks.some((t) => t.leak > 0)) w.fallingFor += dt;
    else w.fallingFor = 0;
    if (w.fallingFor > 1800 && !w.warned) {
      w.warned = true;
      ctx.emit({ type: 'reserveFalling' });
    }
    if (!w.tanks.some((t) => t.leak > 0)) w.warned = false;
  },
};

/** Water commands. Returns true if the command was one of ours. */
export function applyWaterCommand(
  state: PlantState,
  cmd: PlantCommand,
  emit: (e: SimEvent) => void,
): boolean {
  const w = state.water;
  const reject = (reason: string) => {
    emit({ type: 'commandRejected', command: cmd.type, reason });
    return true;
  };
  switch (cmd.type) {
    case 'turnValve': {
      const t = w.tanks[cmd.tank];
      if (!t) return reject('No such tank.');
      const was = isOnline(t);
      t.valve = clamp(t.valve + cmd.delta, 0, 1);
      if (was && !isOnline(t)) emit({ type: 'valveClosed', tank: cmd.tank });
      if (!was && isOnline(t)) emit({ type: 'valveOpened', tank: cmd.tank });
      return true;
    }
    case 'repairTank': {
      const t = w.tanks[cmd.tank];
      if (!t) return reject('No such tank.');
      if (t.leak <= 0) return reject('That tank isn’t leaking.');
      if (isOnline(t)) return reject('Close the tank valve before welding.');
      t.leak = 0;
      t.integrity = Math.max(t.integrity, 0.8);
      emit({ type: 'tankRepaired', tank: cmd.tank });
      return true;
    }
    case 'startLeak': {
      const t = w.tanks[cmd.tank];
      if (!t || t.leak > 0) return true;
      t.leak = cmd.rate;
      t.leakAngle = cmd.angle ?? 0.6;
      t.leakHeight = cmd.height ?? 0.35;
      emit({ type: 'leakStarted', tank: cmd.tank, reported: upgradeLevel(state, 'leak-sensors') > 0 });
      return true;
    }
    default:
      return false;
  }
}
