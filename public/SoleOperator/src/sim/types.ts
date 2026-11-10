import type { RngState } from './rng';
import type { ALARM_LIMITS } from './constants';

/** Cells and rods are indexed 0–11 internally and shown as 01–12. */
export type CellIndex = number;

export interface FuelCell {
  loaded: boolean;
  /** Fraction of design burn-up, 0 (fresh) → 1 (spent). Only ever increases while loaded. */
  burnup: number;
  /** Id of the assembly in the cell, e.g. 'FA-07'. */
  assembly: string | null;
  /** Thermal power produced in this cell, MWt (derived each tick). */
  power: number;
}

export interface ControlRod {
  /** 0 = fully withdrawn, 1 = fully inserted. */
  insertion: number;
  target: number;
}

export type AlarmId = keyof typeof ALARM_LIMITS;

export interface PlantState {
  tick: number;
  /** Game seconds since day 1, 00:00. */
  time: number;
  fissionPower: number;
  decayHeat: number;
  /** Total thermal power (fission + decay), MWt. */
  thermalPower: number;
  /** Net reactivity, pcm. */
  reactivity: number;
  keff: number;
  /** Relative power change per game minute (smoothed). Used for "stable". */
  powerTrend: number;
  coreTemp: number;
  inletTemp: number;
  pressure: number;
  /** Primary coolant pump flow, fraction of nominal. */
  coolantFlow: number;
  /** Heat-sink performance, 1 = nominal. Degraded by faults. */
  coolingEfficiency: number;
  steamPower: number;
  /** Gross electrical output, MWe. */
  output: number;
  turbineVibration: number;
  scrammed: boolean;
  cells: FuelCell[];
  rods: ControlRod[];
  alarms: AlarmId[];
  /** Output after the plant's own big consumers (the accelerator), MWe. */
  netOutput: number;
  accel: AccelState;
}

// --- Particle accelerator ------------------------------------------------------------

export interface Cavity {
  /** Distance from resonance, kHz. Drifts over time; tuning brings it back to 0. */
  detune: number;
  /** Accelerating field, MV/m (falls off as the cavity detunes). */
  field: number;
}

/** Feedstock and products share one stock map; recipes consume and produce by id. */
export type StockId =
  | 'depleted-u'
  | 'mo-targets'
  | 'thorium'
  | 'lithium-6'
  | 'spent-fuel'
  | 'deuterium'
  | 'enriched-u'
  | 'mo99'
  | 'pu239'
  | 'u233'
  | 'transmuted'
  | 'tritium'
  | 'dt-fuel'
  | 'he3'
  | 'antimatter'
  | 'research';

export interface AccelState {
  beamOn: boolean;
  /** Set by an interlock trip; cleared when the beam is switched on again. */
  tripped: boolean;
  /** Beam energy, GeV. */
  energy: number;
  /** Beam current, mA. Beam power (MW) = energy (GeV) x current (mA). */
  current: number;
  /** Cryomodule temperature, K (superconducting at ~2 K; trips above 4.5 K). */
  cryo: number;
  /** Fraction of the beam lost per turn (0.004 = 0.4%). */
  loss: number;
  /** Electrical draw: cryo plant, magnets, RF, MWe. */
  powerDraw: number;
  cavities: Cavity[];
  /** Recipe the beam is delivering to (null = beam circulating, nothing on target). */
  recipe: string | null;
  /** Fractional progress toward the next whole unit of the current recipe. */
  progress: number;
  stock: Record<StockId, number>;
  /** Clearance level: recipes above it are locked. */
  clearance: number;
  /** Per-cavity "below 90% field" flags, for edge-triggered events. */
  detuned: boolean[];
}

export type FaultKind = 'turbine-vibration' | 'cooling-loss';

export type PlantCommand =
  | { type: 'setRodTarget'; rod: number; insertion: number }
  | { type: 'setAllRods'; insertion: number }
  | { type: 'nudgeRod'; rod: number; delta: number }
  | { type: 'scram' }
  | { type: 'resetScram' }
  | { type: 'unloadCell'; cell: CellIndex }
  | { type: 'loadCell'; cell: CellIndex; assembly: string; burnup?: number }
  | { type: 'setCoolantFlow'; fraction: number }
  | { type: 'injectFault'; fault: FaultKind; severity: number }
  | { type: 'clearFaults' }
  | { type: 'accelBeam'; on: boolean }
  | { type: 'tuneCavity'; cavity: number; deltaKHz: number }
  | { type: 'selectRecipe'; recipe: string | null }
  | { type: 'addStock'; stock: StockId; amount: number }
  | { type: 'setClearance'; level: number };

export type SimEvent =
  | { type: 'alarm'; alarm: AlarmId }
  | { type: 'alarmCleared'; alarm: AlarmId }
  | { type: 'rodSettled'; rod: number; insertion: number }
  | { type: 'scram' }
  | { type: 'scramReset' }
  | { type: 'cellUnloaded'; cell: CellIndex; assembly: string | null; burnup: number }
  | { type: 'cellLoaded'; cell: CellIndex; assembly: string }
  | { type: 'cellSpent'; cell: CellIndex }
  | { type: 'commandRejected'; command: PlantCommand['type']; reason: string }
  | { type: 'beamStarted' }
  | { type: 'beamStopped' }
  | { type: 'beamTrip'; reason: string }
  | { type: 'cavityDetuned'; cavity: number }
  | { type: 'cavityTuned'; cavity: number }
  | { type: 'productionStarted'; recipe: string }
  | { type: 'produced'; recipe: string; stock: StockId; total: number }
  | { type: 'feedExhausted'; recipe: string };

export interface SimSnapshot {
  /** Bumped when PlantState's shape changes; save migrations key off it. */
  schema: number;
  state: PlantState;
  rng: RngState;
  pending: PlantCommand[];
}

/**
 * The boundary between the game and its simulation. Everything outside src/sim
 * talks to the plant only through this interface, so the TypeScript model can be
 * replaced by a Rust/WASM build later without touching callers.
 */
export interface PlantSim {
  /** Game seconds advanced by one step(). */
  readonly tickSeconds: number;
  /** Queue a command; it takes effect at the start of the next tick (deterministic). */
  enqueue(command: PlantCommand): void;
  /** Advance exactly one fixed tick and return what happened during it. */
  step(): SimEvent[];
  /** Current state. Treat as read-only; it is mutated in place by step(). */
  getState(): Readonly<PlantState>;
  snapshot(): SimSnapshot;
  restore(snapshot: SimSnapshot): void;
}
