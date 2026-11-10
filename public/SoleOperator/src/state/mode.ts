import { create } from 'zustand';

/**
 * What the player is controlling. In anything but 'walk' the Operator stands
 * still, the camera frames the machine, and a mode panel replaces the hotkey bar.
 */
export type Mode =
  | { kind: 'walk' }
  | { kind: 'rods'; selected: number; bank: boolean }
  | { kind: 'crane' }
  | { kind: 'refuel'; cell: number };

export type RefuelPhase = 'insert-rod' | 'extract' | 'load' | 'done';

interface ModeState {
  mode: Mode;
  /** Refuelling machine progress (0–1 for the current hold-to-act phase), mirrored at ~10 Hz for the panel. */
  refuel: { phase: RefuelPhase; progress: number; busy: boolean; cell: number; armLoaded: boolean };
  /** Crane panel readout. */
  crane: { target: string; busy: boolean };
}

export const useMode = create<ModeState>()(() => ({
  mode: { kind: 'walk' },
  refuel: { phase: 'insert-rod', progress: 0, busy: false, cell: 6, armLoaded: false },
  crane: { target: '', busy: false },
}));
