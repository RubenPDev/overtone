import { createPlantSim, type PlantSim, type PlantState, type SimSnapshot } from '../sim';
import { FixedStepClock, type GameSpeed } from './clock';
import type { EventBus, GameEvents } from './events';

/**
 * Owns the running simulation: drives it from frame time through the fixed-step
 * clock, feeds it commands from the bus and publishes its events back to the bus.
 * This is the only place that calls sim.step(). No React or Three in here.
 */
export class SimHost {
  readonly clock = new FixedStepClock();
  private sim: PlantSim;
  private offCommands: () => void;

  constructor(
    private readonly bus: EventBus<GameEvents>,
    seed: string | number = 'unit-1',
  ) {
    this.sim = createPlantSim({ seed });
    this.offCommands = bus.on('cmd/sim', (cmd) => this.sim.enqueue(cmd));
  }

  /** Call once per rendered frame with the real elapsed seconds. Returns ticks run. */
  frame(realDtSeconds: number): number {
    const n = this.clock.advance(realDtSeconds);
    for (let i = 0; i < n; i++) this.tick();
    return n;
  }

  /** Run exactly one tick (dev "step" button, tests). */
  tick(): void {
    for (const e of this.sim.step()) this.bus.emit('sim', e);
  }

  get state(): Readonly<PlantState> {
    return this.sim.getState();
  }

  get speed(): GameSpeed {
    return this.clock.speed;
  }

  setSpeed(speed: GameSpeed): void {
    this.clock.speed = speed;
  }

  snapshot(): SimSnapshot {
    return this.sim.snapshot();
  }

  restore(snapshot: SimSnapshot): void {
    this.sim.restore(snapshot);
    this.clock.reset();
  }

  /** Fresh plant for a new game. */
  reset(seed: string | number): void {
    this.sim = createPlantSim({ seed });
    this.clock.reset();
  }

  dispose(): void {
    this.offCommands();
  }
}
