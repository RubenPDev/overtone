/**
 * Plant model constants. Values are PWR-flavoured so the numbers on screen look
 * right (≈3.7 GWt, 312 °C, 15.4 MPa, ≈1.2 GWe), but the model is a game model,
 * not a licensing code. All times are in GAME seconds.
 */

/** Fixed simulation step, in game seconds. The host runs 10 ticks per real second at 1×,
 *  so 1 real second = 1 game minute. Change GAME_SECONDS_PER_TICK to change the pace. */
export const GAME_SECONDS_PER_TICK = 6;

export const CELL_COUNT = 12;

// --- Power -------------------------------------------------------------------
/** Nominal total thermal power (fission + decay heat), MWt. */
export const NOMINAL_THERMAL_MW = 3700;
/** Decay heat as a fraction of (lagged) fission power. */
export const DECAY_HEAT_FRACTION = 0.065;
export const DECAY_HEAT_TAU = 600;
export const NOMINAL_FISSION_MW = NOMINAL_THERMAL_MW / (1 + DECAY_HEAT_FRACTION);
/** Effective neutron generation time (game seconds). Large on purpose so power moves at a readable pace. */
export const GENERATION_TIME = 1;
/** External neutron source, keeps a shut-down core from reaching exactly zero (MW per game s). */
export const SOURCE_MW_PER_S = 0.02;
export const MIN_FISSION_MW = 0.001;
export const MAX_FISSION_MW = NOMINAL_FISSION_MW * 3;
/** Cap on the per-tick exponent so huge reactivity steps stay numerically sane. */
export const MAX_GROWTH_PER_TICK = 0.35;
export const MAX_DECAY_PER_TICK = 0.7;

// --- Reactivity (pcm) ----------------------------------------------------------
/** Excess reactivity of a fresh fuel cell and how much burn-up takes away. */
export const FUEL_FRESH_PCM = 16000;
export const FUEL_BURNUP_PCM = 14000;
/** An empty port is a water hole: strongly negative. */
export const EMPTY_CELL_PCM = -6000;
/** Combined worth of all 12 rods fully inserted. */
export const TOTAL_ROD_WORTH_PCM = 14000;
/** Moderator/fuel temperature coefficient (pcm per °C above the reference). */
export const TEMP_COEFF_PCM = 60;
export const TEMP_REF_C = 285;
/** Doppler/power coefficient (pcm at nominal fission power). */
export const POWER_COEFF_PCM = 5000;

// --- Thermal hydraulics ---------------------------------------------------------
export const INLET_TEMP_C = 285;
/** Inlet temperature rise at zero cooling efficiency. */
export const INLET_LOSS_C = 40;
export const INLET_TAU = 300;
/** Core temperature rise per MWt at full coolant flow (312 °C at nominal). */
export const CORE_DT_PER_MW = (312 - INLET_TEMP_C) / NOMINAL_THERMAL_MW;
export const CORE_TEMP_TAU = 90;
export const MIN_FLOW = 0.05;

export const NOMINAL_PRESSURE_MPA = 15.4;
export const PRESSURE_PER_C = 0.055;
export const PRESSURE_TAU = 60;
export const PRESSURE_NOISE_MPA = 0.004;

// --- Turbine -----------------------------------------------------------------
export const STEAM_TAU = 150;
/** Thermal-to-electric efficiency: 3700 MWt → ≈1218 MWe. */
export const TURBINE_EFFICIENCY = 0.3292;
export const VIBRATION_OUTPUT_LOSS = 0.2;
/** Vibration slowly settles on its own once excited. */
export const VIBRATION_DECAY_TAU = 3600;

// --- Rods --------------------------------------------------------------------
/** Full stroke in 300 game s (5 real seconds at 1×). */
export const ROD_SPEED_PER_S = 1 / 300;
/** Scram: rods fall the full stroke in about two ticks. */
export const SCRAM_SPEED_PER_S = 1 / 12;

// --- Fuel --------------------------------------------------------------------
/** Game seconds for a cell at average power to go from fresh to 100 % design burn-up (40 game days). */
export const BURN_TIME_S = 40 * 86400;
/** How strongly a cell's own rod shades its local power. */
export const ROD_SHADING = 0.7;
export const SPENT_BURNUP = 0.98;

// --- Alarms (set / clear thresholds) ---------------------------------------------
export const ALARM_LIMITS = {
  'core-temp-high': { set: 330, clear: 325 },
  'pressure-high': { set: 16.5, clear: 16.2 },
  'power-high': { set: NOMINAL_THERMAL_MW * 1.1, clear: NOMINAL_THERMAL_MW * 1.05 },
  'turbine-vibration': { set: 0.4, clear: 0.3 },
  /** Reading is 1 − reserve fraction: sets below 30% of the base reserve, clears above 40%. */
  'water-low': { set: 0.7, clear: 0.6 },
} as const;

/** Day 1 starts at 08:00. */
export const START_TIME_S = 8 * 3600;
