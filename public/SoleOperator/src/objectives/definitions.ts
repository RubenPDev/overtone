import type { ObjectiveDef } from './types';

/**
 * Objectives are data. Each step completes when a matching bus event arrives,
 * so objectives never call into rooms or the sim directly. If an event matches
 * a later step, the steps before it complete too (players don't go in order).
 */
export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: 'swap-cell-07',
    title: 'Swap Fuel Cell 07',
    kind: 'main',
    next: 'return-spent',
    steps: [
      {
        id: 'check',
        text: 'Check cell 07 burn-up at the core',
        detail: 'Refuelling machine · Reactor Control',
        target: { room: 'control-room', interactable: 'core-panel' },
        completeOn: { channel: 'interact', where: (e) => e.interactable === 'core-panel' },
      },
      {
        id: 'cask',
        text: 'Crane a fresh assembly into the transfer cask',
        detail: 'Fuel crane console · Fuel Rod Storage',
        target: { room: 'fuel-storage', interactable: 'crane-console' },
        completeOn: { channel: 'fuel/craned', where: (e) => e.to === 'cask' && e.burnup < 0.5 },
      },
      {
        id: 'deliver',
        text: 'Push the transfer cart to the core cart bay',
        detail: 'Cart bay beside the refuelling machine',
        target: { room: 'control-room', interactable: 'core-panel' },
        completeOn: { channel: 'cart/docked', where: (e) => e.room === 'control-room' && e.fresh > 0 },
      },
      {
        id: 'swap',
        text: 'Swap cell 07 with the refuelling machine',
        detail: 'Rod in, extract, load',
        target: { room: 'control-room', interactable: 'core-panel' },
        completeOn: { channel: 'sim', where: (e) => e.type === 'cellLoaded' && e.cell === 6 },
      },
    ],
  },
  {
    id: 'return-spent',
    title: 'Return the Spent Assembly',
    kind: 'side',
    steps: [
      {
        id: 'push-back',
        text: 'Push the cart back to the cask dock',
        detail: 'Fuel Rod Storage · by the pool',
        target: { room: 'fuel-storage', interactable: 'crane-console' },
        completeOn: { channel: 'cart/docked', where: (e) => e.room === 'fuel-storage' && e.spent > 0 },
      },
      {
        id: 'rack',
        text: 'Crane the spent assembly into the pool',
        detail: 'Any free rack slot',
        target: { room: 'fuel-storage', interactable: 'crane-console' },
        completeOn: { channel: 'fuel/craned', where: (e) => e.to === 'pool' && e.burnup >= 0.5 },
      },
    ],
    next: 'retune-cavity-03',
  },
  {
    id: 'retune-cavity-03',
    title: 'Re-tune RF Cavity 03',
    kind: 'main',
    next: 'first-enrichment',
    steps: [
      {
        id: 'reach',
        text: 'Reach the RF station in sector 1',
        detail: 'Access A-1 from Fuel Rod Storage, then the ring shuttle',
        target: { room: 'ring-s1', interactable: 'rf-console' },
        completeOn: { channel: 'room/entered', where: (e) => e.room === 'ring-s1' },
      },
      {
        id: 'scan',
        text: 'Scan the cryomodule with the rail drone',
        detail: 'Drone dock at the west end of the hall',
        target: { room: 'ring-s1', interactable: 'drone-dock' },
        completeOn: { channel: 'drone/scanned' },
      },
      {
        id: 'tune',
        text: 'Tune cavity 03 at the RF console',
        detail: 'Sweep to resonance: detune under 1 kHz',
        target: { room: 'ring-s1', interactable: 'rf-console' },
        completeOn: { channel: 'sim', where: (e) => e.type === 'cavityTuned' && e.cavity === 2 },
      },
    ],
  },
  {
    id: 'first-enrichment',
    title: 'First Enrichment Run',
    kind: 'main',
    steps: [
      {
        id: 'reach',
        text: 'Go to the Target Station in sector 6',
        detail: 'Ring shuttle, or access A-1',
        target: { room: 'ring-s6', interactable: 'production' },
        completeOn: { channel: 'room/entered', where: (e) => e.room === 'ring-s6' },
      },
      {
        id: 'start',
        text: 'Start an enriched-uranium run',
        detail: 'Target station console',
        target: { room: 'ring-s6', interactable: 'production' },
        completeOn: {
          channel: 'sim',
          where: (e) => e.type === 'productionStarted' && e.recipe === 'enrich-u',
        },
      },
      {
        id: 'make',
        text: 'Produce 5 kg of enriched uranium',
        detail: 'Keep the beam on and the cavities tuned',
        target: { room: 'ring-s6', interactable: 'production' },
        completeOn: {
          channel: 'sim',
          where: (e) => e.type === 'produced' && e.stock === 'enriched-u' && e.total >= 5,
        },
      },
    ],
  },
];

export const FIRST_OBJECTIVE = 'swap-cell-07';
