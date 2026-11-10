import { create } from 'zustand';

/**
 * What the player is controlling. In anything but 'walk' the Operator stands
 * still, the camera frames the machine, and a mode panel replaces the hotkey bar.
 */
export type Mode =
  | { kind: 'walk' }
  | { kind: 'rods'; selected: number; bank: boolean }
  | { kind: 'crane' }
  | { kind: 'refuel'; cell: number }
  | { kind: 'rf'; cavity: number }
  | { kind: 'production'; index: number }
  | { kind: 'shuttle'; index: number }
  | { kind: 'tanks'; tank: number }
  | { kind: 'analyze'; bearing: number }
  | { kind: 'balance'; angle: number; mass: number }
  | { kind: 'service' }
  | { kind: 'tdesk' };

export type RefuelPhase = 'insert-rod' | 'extract' | 'load' | 'done';

interface ModeState {
  mode: Mode;
  /** Refuelling machine progress (0–1 for the current hold-to-act phase), mirrored at ~10 Hz for the panel. */
  refuel: { phase: RefuelPhase; progress: number; busy: boolean; cell: number; armLoaded: boolean };
  /** Crane panel readout. */
  crane: { target: string; busy: boolean };
  /** Weld patch progress 0–1 in tank service, mirrored at ~10 Hz. */
  weld: number;
  /** Turbine hall hold-to-act progress 0–1 (analysis, service, weight fitting), ~10 Hz. */
  job: { progress: number; fitting: boolean };
  /** Last completed vibration analysis. */
  analysis: { bearing: number; at: number } | null;
  /** Balance trials this visit: weight and the B3 vibration it gave. */
  trials: { angle: number; mass: number; vib: number | null }[];
}

export const useMode = create<ModeState>()(() => ({
  mode: { kind: 'walk' },
  refuel: { phase: 'insert-rod', progress: 0, busy: false, cell: 6, armLoaded: false },
  crane: { target: '', busy: false },
  weld: 0,
  job: { progress: 0, fitting: false },
  analysis: null,
  trials: [],
}));
