import { bus } from '../core/events';
import { SimHost } from '../core/simHost';
import { ObjectiveRunner } from '../objectives/runner';
import { OBJECTIVES } from '../objectives/definitions';
import type { Vec2 } from '../world/types';

/**
 * Long-lived, non-React game objects. React components read these inside
 * useFrame or event handlers; they never trigger renders on their own.
 */
export const simHost = new SimHost(bus, 'unit-1');
export const objectives = new ObjectiveRunner(bus, OBJECTIVES);

/** Per-frame player state, written by <Player> in useFrame and read by camera, HUD publisher and saves. */
export const player = {
  pos: { x: 0, z: 0 } as Vec2,
  yaw: 0,
  /** Current ground speed, m/s (drives the walk animation). */
  speed: 0,
  stamina: 1,
  focus: 0.88,
  /** mSv received this game. */
  dose: 0,
  /** Click-to-move target path. */
  path: [] as Vec2[],
  /** Input is ignored while a transition runs or a menu is open. */
  locked: false,
};

export const session = {
  seed: 'unit-1',
  /** Number of fresh assemblies taken so far (FA-31, FA-32, …). */
  assembliesTaken: 0,
};
