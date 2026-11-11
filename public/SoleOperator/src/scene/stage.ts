import type { BuiltSpace, CorridorFrame } from '../world/spaces';

/**
 * The currently mounted space's collision layout and (in corridors) frame.
 * Set by <SpaceStage> when a space mounts; read every frame by the camera,
 * player and HUD publisher. Not React state: nothing re-renders from it.
 */
export const stage: {
  layout: BuiltSpace | null;
  corridor: CorridorFrame | null;
  version: number;
  focus: { x: number; z: number; zoom: number } | null;
} = {
  layout: null,
  corridor: null,
  /** Increments whenever a new space mounts (camera snaps instead of easing). */
  version: 0,
  /** Camera override while a control mode frames a machine. */
  focus: null,
};
