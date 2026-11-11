import { create } from 'zustand';
import type { Space } from '../world/spaces';
import type { Interactable, Vec2 } from '../world/types';

export interface Arrival {
  position: Vec2;
  facing: number;
}

export type TransitionPhase = 'idle' | 'out' | 'in';

interface WorldState {
  space: Space;
  /** Bumped on every space change; used as a React key so the space remounts cleanly. */
  spaceVersion: number;
  /** Where the player stands when the current space mounts. */
  arrival: Arrival;
  transition: { phase: TransitionPhase; title: string; subtitle: string };
  /** Interactable in range (changes only when the nearest one changes, not per frame). */
  near: Interactable | null;
  /** Room picked on the map screen. */
  waypoint: string | null;
}

export const useWorld = create<WorldState>()(() => ({
  space: { kind: 'room', room: 'control-room' },
  spaceVersion: 0,
  arrival: { position: { x: 0, z: 0 }, facing: 0 },
  transition: { phase: 'idle', title: '', subtitle: '' },
  near: null,
  waypoint: null,
}));
