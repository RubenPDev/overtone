import type { GameEvents } from '../core/events';

/** Completes a step when an event arrives on `channel` and `where` (if given) accepts it. */
export type StepTrigger = {
  [K in keyof GameEvents]: { channel: K; where?: (payload: GameEvents[K]) => boolean };
}[keyof GameEvents];

export interface ObjectiveStep {
  id: string;
  text: string;
  /** Second line under the step, e.g. '140 m · through corridor C-1'. */
  detail?: string;
  /** Where to go for this step: drives the compass highlight, minimap pin and map waypoint. */
  target?: { room: string; interactable?: string };
  completeOn: StepTrigger;
}

export interface ObjectiveDef {
  id: string;
  title: string;
  kind: 'main' | 'side';
  steps: ObjectiveStep[];
}
