import type { Rng } from './rng';
import type { PlantState, SimEvent } from './types';

/** Shared helpers handed to every system on every tick. */
export interface TickContext {
  /** Game seconds in this tick. */
  dt: number;
  rng: Rng;
  emit(event: SimEvent): void;
}

/**
 * A sim system is one ordered step of the tick pipeline: it reads the state and
 * mutates the parts it owns. Systems must be deterministic: no wall-clock time,
 * no Math.random (use ctx.rng), no I/O. See README "How to add a new sim system".
 */
export interface SimSystem {
  id: string;
  step(state: PlantState, ctx: TickContext): void;
}

/** Exact first-order lag: moves `value` toward `target` with time constant `tau`. Stable for any dt. */
export function relax(value: number, target: number, tau: number, dt: number): number {
  return target + (value - target) * Math.exp(-dt / tau);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
