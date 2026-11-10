import type { PlantCommand, SimEvent } from '../sim';

export type ToastLevel = 'info' | 'ok' | 'warn' | 'alarm';

/**
 * Every message that crosses a system boundary goes through this one bus:
 * input → commands, sim → HUD/objectives, world → objectives, and so on.
 * Channels named `cmd/*` are requests ("do this"); the rest are facts ("this happened").
 *
 * Add a channel by adding a key here; TypeScript then checks every emit and listener.
 */
export interface GameEvents {
  /** Request a plant change. SimHost forwards it to the sim, applied at the next tick. */
  'cmd/sim': PlantCommand;
  /** Ask the world to move the player to a room (dev teleport, map waypoint later). */
  'cmd/teleport': { room: string };
  /** Something the plant did (alarms, rods settling, cells loaded…). */
  sim: SimEvent;
  /** The player used an interactable (pressed E near it). */
  interact: { room: string; interactable: string; kind: string };
  /** The fuel crane moved an assembly (`to` is where it was put down, or 'hook' when picked up). */
  'fuel/craned': {
    assembly: string;
    burnup: number;
    from: 'pool' | 'cask' | 'hook';
    to: 'pool' | 'cask' | 'hook';
  };
  /** The transfer cart was parked in a docking bay. */
  'cart/docked': { room: string; bay: string; fresh: number; spent: number };
  'cart/attached': { room: string };
  /** The RF Station rail drone finished scanning a cavity. */
  'drone/scanned': { room: string; cavity: number };
  'cart/parked': { room: string };
  /** The player switched control mode (walking, rod console, crane, refuelling machine). */
  'mode/changed': { mode: string };
  /** Plant snapshot, once per real second, for objectives that watch plant state. */
  'plant/sample': { output: number; thermalPower: number; coreTemp: number; rodsIn: number };
  'room/entered': { room: string };
  'room/left': { room: string };
  'corridor/entered': { corridor: string; from: string; to: string };
  'objective/started': { objective: string };
  'objective/step': { objective: string; step: number };
  'objective/completed': { objective: string };
  toast: { text: string; detail?: string; level: ToastLevel };
  'game/saved': { slot: string; auto: boolean };
  /** A bearing vibration analysis finished in the Turbine Hall. */
  'turbine/analyzed': { bearing: number };
  /** A HUD panel was opened (the ops tablet, the scanner). */
  'ui/opened': { panel: string };
}

export type Listener<T> = (payload: T) => void;

export class EventBus<M extends object> {
  private listeners = new Map<keyof M, Set<Listener<never>>>();
  private anyListeners = new Set<(type: keyof M, payload: unknown) => void>();

  on<K extends keyof M>(type: K, fn: Listener<M[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn as Listener<never>);
    return () => set.delete(fn as Listener<never>);
  }

  once<K extends keyof M>(type: K, fn: Listener<M[K]>): () => void {
    const off = this.on(type, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  /** Every event, e.g. for the dev log or a replay recorder. */
  onAny(fn: (type: keyof M, payload: unknown) => void): () => void {
    this.anyListeners.add(fn);
    return () => this.anyListeners.delete(fn);
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const set = this.listeners.get(type);
    if (set) {
      for (const fn of [...set]) {
        try {
          (fn as Listener<M[K]>)(payload);
        } catch (err) {
          console.error(`[bus] listener for "${String(type)}" threw`, err);
        }
      }
    }
    for (const fn of this.anyListeners) fn(type, payload);
  }

  clear(): void {
    this.listeners.clear();
    this.anyListeners.clear();
  }
}

/** The game's single bus. Systems import this; tests make their own EventBus. */
export const bus = new EventBus<GameEvents>();
