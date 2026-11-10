import type { ObjectiveDef } from './types';

/**
 * Objectives are data. Each step completes when a matching bus event arrives,
 * so objectives never call into rooms or the sim directly.
 */
export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: 'swap-cell-07',
    title: 'Swap Fuel Cell 07',
    kind: 'main',
    steps: [
      {
        id: 'check',
        text: 'Check cell 07 burn-up at the core',
        detail: 'Core port panel · Reactor Control',
        target: { room: 'control-room', interactable: 'core-panel' },
        completeOn: { channel: 'interact', where: (e) => e.interactable === 'core-panel' },
      },
      {
        id: 'fetch',
        text: 'Fetch a fresh assembly from Fuel Rod Storage',
        detail: '140 m · through corridor C-1',
        target: { room: 'fuel-storage', interactable: 'fuel-rack' },
        completeOn: { channel: 'item/picked', where: (e) => e.item.startsWith('FA-') },
      },
      {
        id: 'load',
        text: 'Load the assembly into cell 07',
        detail: 'Core port panel · rod 07 drives in for the swap',
        target: { room: 'control-room', interactable: 'core-panel' },
        completeOn: { channel: 'sim', where: (e) => e.type === 'cellLoaded' && e.cell === 6 },
      },
    ],
  },
];

export const FIRST_OBJECTIVE = 'swap-cell-07';
