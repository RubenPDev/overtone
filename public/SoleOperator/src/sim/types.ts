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
  econ: EconState;
  water: WaterState;
  turbine: TurbineState;
}

// --- Turbine B ---------------------------------------------------------------------------

export interface TurbineState {
  rpm: number;
  /** LP rotor imbalance vector, grams at the balance radius (x = cos, y = sin of the phase). */
  imbalance: { x: number; y: number };
  /** Balance weight fitted by the crew (angle in degrees, mass in grams). */
  weight: { angle: number; mass: number } | null;
  /** Bearing vibration B1–B4, mm/s RMS. */
  bearings: number[];
  /** Protection trip (vibration); needs a reset once the rotor is balanced. */
  tripped: boolean;
  /** B3 under 2.8 mm/s (edge-triggers turbineBalanced). */
  balanced: boolean;
  /** Condenser pressure, bar absolute. */
  vacuum: number;
  lubeOilTemp: number;
  /** Feed pump motor B: winding temperature, bearing lubrication 0..1. */
  feedPump: { temp: number; lube: number; tripped: boolean; hot: boolean };
}

// --- Water reserve ---------------------------------------------------------------------

export interface Tank {
  /** Volume, m³. */
  level: number;
  /** Shell condition 0..1: corrosion lowers it, which raises the leak hazard. */
  integrity: number;
  /** Leak rate at a 50% head, m³/h (0 = sound). */
  leak: number;
  /** Height of the hole as a fraction of the tank: it drains down to here. */
  leakHeight: number;
  /** Where round the shell the hole is (radians, for the visuals). */
  leakAngle: number;
  /** Outlet valve opening 0..1 (closed = isolated from the plant). */
  valve: number;
}

export interface WaterState {
  tanks: Tank[];
  /** Online volume as a fraction of the 4-tank base reserve. */
  inventory: number;
  /** 1 = make-up fine; falls toward 0 as the reserve empties (degrades cooling). */
  supply: number;
  /** Plant make-up demand and treatment output, m³/h. */
  demand: number;
  treatment: number;
  fallingFor: number;
  warned: boolean;
}

// --- Economy and progression ----------------------------------------------------------

export interface Contract {
  id: number;
  kind: 'deliver' | 'grid';
  client: string;
  title: string;
  /** Deliveries: what and how much. Grid: amount = game seconds to hold the target. */
  stock: StockId | null;
  amount: number;
  /** Grid: net MWe to hold. */
  target: number;
  progress: number;
  reward: number;
  /** Offer lapses at this game time if not accepted. */
  expires: number;
  /** Once accepted: game time by which it must be done. */
  deadline: number;
  /** Game seconds allowed once accepted. */
  window: number;
  status: 'offered' | 'active' | 'done' | 'failed' | 'expired';
}

export interface EconState {
  credits: number;
  /** Lifetime income, credits. */
  earned: number;
  /** Current grid price, credits per MWh. */
  price: number;
  /** Upgrade and tool levels by id (missing = 0). */
  upgrades: Record<string, number>;
  contracts: Contract[];
  nextContractAt: number;
  nextContractId: number;
  completed: number;
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
  | { type: 'setClearance'; level: number }
  | { type: 'acceptContract'; id: number }
  | { type: 'declineContract'; id: number }
  | { type: 'buyUpgrade'; id: string }
  | { type: 'buyItem'; id: string }
  | { type: 'sell'; stock: StockId; amount: number }
  | { type: 'clearanceReview' }
  | { type: 'grantCredits'; amount: number }
  | { type: 'turnValve'; tank: number; delta: number }
  | { type: 'repairTank'; tank: number }
  | { type: 'startLeak'; tank: number; rate: number; angle?: number; height?: number }
  | { type: 'fitBalanceWeight'; angle: number; mass: number }
  | { type: 'setImbalance'; mass: number; phase: number }
  | { type: 'serviceFeedPump' }
  | { type: 'setFeedPumpLube'; lube: number; temp?: number }
  | { type: 'resetTurbine' };

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
  | { type: 'feedExhausted'; recipe: string }
  | { type: 'contractOffered'; id: number }
  | { type: 'contractAccepted'; id: number; title: string }
  | { type: 'contractCompleted'; id: number; title: string; reward: number }
  | { type: 'contractFailed'; id: number; title: string }
  | { type: 'purchased'; item: string; level: number }
  | { type: 'sold'; stock: StockId; amount: number; credits: number }
  | { type: 'clearanceRaised'; level: number }
  | { type: 'leakStarted'; tank: number; reported: boolean }
  | { type: 'tankRepaired'; tank: number }
  | { type: 'tankInstalled'; tank: number }
  | { type: 'valveClosed'; tank: number }
  | { type: 'valveOpened'; tank: number }
  | { type: 'reserveFalling' }
  | { type: 'turbineTrip'; reason: string }
  | { type: 'turbineReset' }
  | { type: 'turbineBalanced' }
  | { type: 'weightFitted'; vibration: number }
  | { type: 'feedPumpHot'; temp: number }
  | { type: 'feedPumpTripped' }
  | { type: 'feedPumpServiced' };

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
