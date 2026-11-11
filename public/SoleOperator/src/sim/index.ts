/**
 * Public surface of the plant simulation. Code outside src/sim imports only from
 * here. Everything in this folder is pure TypeScript: no React, Three, DOM,
 * wall-clock time or Math.random (enforced by architecture.test.ts).
 */
export { createPlantSim, SIM_SCHEMA, SYSTEMS, assemblyId } from './plant';
export { coreStatus, averageInsertion, clockOf } from './derived';
export type { Criticality, Stability } from './derived';
export { Rng } from './rng';
export type { RngState } from './rng';
export { CELL_COUNT, GAME_SECONDS_PER_TICK, NOMINAL_THERMAL_MW, ALARM_LIMITS } from './constants';
export type * from './types';
export {
  RECIPES,
  RECIPE_BY_ID,
  STOCK_LABEL,
  MAX_FIELD,
  CAVITY_COUNT,
  CAVITY_BANDWIDTH_KHZ,
  RING_CIRCUMFERENCE_M,
  CRYO_TRIP_K,
  cavityField,
  beamPower,
  createAccelState,
} from './accelerator';
export type { Recipe } from './accelerator';
export {
  UPGRADES,
  UPGRADE_BY_ID,
  MARKET,
  MARKET_BY_ID,
  SELL_PRICE,
  clearanceCost,
  createEconState,
  gridPrice,
  hasTool,
  upgradeLevel,
} from './economy';
export type { MarketItem, UpgradeCategory, UpgradeDef } from './economy';
export {
  SYNC_RPM,
  VIB_GOOD,
  VIB_ALERT,
  VIB_TRIP,
  MAX_WEIGHT_G,
  PUMP_HOT_C,
  PUMP_TRIP_C,
  BEARING_COUPLING,
  MM_S_PER_GRAM,
  bearingVibration,
  residual,
  createTurbineState,
} from './turbine';
export { TANK_CAPACITY, BASE_TANKS, MAX_TANKS, VALVE_CLOSED, createWaterState, isOnline } from './water';
