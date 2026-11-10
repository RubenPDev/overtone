import type { EventBus, GameEvents } from '../core/events';
import type { ObjectiveSave } from '../core/save';
import type { ObjectiveDef, ObjectiveStep } from './types';

export interface ObjectiveProgress {
  active: ObjectiveDef | null;
  step: number;
  completed: string[];
}

/**
 * Listens to the bus and advances the active objective when its current step's
 * trigger fires. Pure TS; the HUD reads progress through `onChange`.
 */
export class ObjectiveRunner {
  private defs: Map<string, ObjectiveDef>;
  private active: ObjectiveDef | null = null;
  private step = 0;
  private completed: string[] = [];
  private off: () => void;
  private listeners = new Set<(p: ObjectiveProgress) => void>();

  constructor(
    private readonly bus: EventBus<GameEvents>,
    defs: ObjectiveDef[],
  ) {
    this.defs = new Map(defs.map((d) => [d.id, d]));
    this.off = bus.onAny((channel, payload) => this.handle(channel, payload));
  }

  start(id: string): void {
    const def = this.defs.get(id);
    if (!def) throw new Error(`Unknown objective ${id}`);
    this.active = def;
    this.step = 0;
    this.bus.emit('objective/started', { objective: id });
    this.changed();
  }

  get progress(): ObjectiveProgress {
    return { active: this.active, step: this.step, completed: [...this.completed] };
  }

  get currentStep(): ObjectiveStep | null {
    return this.active?.steps[this.step] ?? null;
  }

  /** Completes the current step regardless of its trigger (dev tools). */
  forceAdvance(): void {
    if (this.active) this.advance();
  }

  onChange(fn: (p: ObjectiveProgress) => void): () => void {
    this.listeners.add(fn);
    fn(this.progress);
    return () => this.listeners.delete(fn);
  }

  save(): ObjectiveSave {
    return { active: this.active?.id ?? null, step: this.step, completed: [...this.completed] };
  }

  load(s: ObjectiveSave): void {
    this.active = s.active ? (this.defs.get(s.active) ?? null) : null;
    this.step = s.step;
    this.completed = [...s.completed];
    this.changed();
  }

  dispose(): void {
    this.off();
    this.listeners.clear();
  }

  /**
   * Steps are linear, but players aren't: an event that satisfies a LATER step
   * (e.g. picking up fuel before inspecting the core) completes every step up to it.
   */
  private handle(channel: keyof GameEvents, payload: unknown): void {
    const def = this.active;
    if (!def) return;
    for (let k = this.step; k < def.steps.length; k++) {
      const trig = def.steps[k]!.completeOn;
      if (trig.channel !== channel) continue;
      const where = trig.where as ((p: unknown) => boolean) | undefined;
      if (where && !where(payload)) continue;
      const target = def.id;
      while (this.active?.id === target && this.step <= k) this.advance();
      return;
    }
  }

  private advance(): void {
    const def = this.active!;
    this.bus.emit('objective/step', { objective: def.id, step: this.step });
    this.step += 1;
    if (this.step >= def.steps.length) {
      this.completed.push(def.id);
      this.active = null;
      this.step = 0;
      this.bus.emit('objective/completed', { objective: def.id });
    }
    this.changed();
  }

  private changed(): void {
    const p = this.progress;
    for (const fn of this.listeners) fn(p);
  }
}
