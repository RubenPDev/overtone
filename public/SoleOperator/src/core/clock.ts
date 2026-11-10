/** Simulation ticks per real second at 1×. */
export const TICKS_PER_SECOND = 10;

export type GameSpeed = 0 | 1 | 2 | 3;

/**
 * Fixed-timestep accumulator. Each frame, `advance(realDt)` says how many
 * fixed ticks to run, so the sim runs the same ticks at 30 fps or 144 fps.
 * Speed multiplies the number of ticks, never the tick length, so 3× produces
 * exactly the same results as 1×, only sooner.
 */
export class FixedStepClock {
  speed: GameSpeed = 1;
  /** Accumulated, not-yet-run ticks (fractional). */
  private acc = 0;

  constructor(
    readonly tickRate = TICKS_PER_SECOND,
    /** Cap per advance, so a slow frame can't trigger a catch-up spiral. */
    readonly maxTicksPerAdvance = 45,
    /** Real-time gaps longer than this (tab in the background) are dropped, not replayed. */
    readonly maxFrameSeconds = 0.25,
  ) {}

  advance(realDtSeconds: number): number {
    if (this.speed === 0 || !(realDtSeconds > 0)) return 0;
    const dt = Math.min(realDtSeconds, this.maxFrameSeconds);
    this.acc += dt * this.tickRate * this.speed;
    let n = Math.floor(this.acc + 1e-9);
    this.acc -= n;
    if (n > this.maxTicksPerAdvance) {
      n = this.maxTicksPerAdvance;
      this.acc = 0;
    }
    return n;
  }

  /** Fraction (0–1) of the next tick already elapsed; for render interpolation. */
  get alpha(): number {
    return this.acc;
  }

  reset(): void {
    this.acc = 0;
  }
}

/** Returns true at most `hz` times per (real) second as you feed it frame deltas. */
export function createThrottle(hz: number) {
  const period = 1 / hz;
  let t = period; // fire on the first call
  return (realDtSeconds: number): boolean => {
    t += realDtSeconds;
    if (t < period) return false;
    t = t % period;
    return true;
  };
}
