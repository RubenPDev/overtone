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
    reward: 5_000,
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
    reward: 4_000,
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
    reward: 8_000,
    next: 'ops-online',
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
  {
    id: 'ops-online',
    title: 'Run the Plant Like a Business',
    kind: 'main',
    reward: 5_000,
    next: 'clearance-2',
    steps: [
      {
        id: 'tablet',
        text: 'Open the ops tablet',
        detail: 'Press T, or click your credits',
        completeOn: { channel: 'ui/opened', where: (e) => e.panel === 'ops' },
      },
      {
        id: 'accept',
        text: 'Accept a contract',
        detail: 'Ops tablet · Contracts',
        completeOn: { channel: 'sim', where: (e) => e.type === 'contractAccepted' },
      },
      {
        id: 'scanner',
        text: 'Buy the handheld scanner',
        detail: 'Ops tablet · Tools · 8,000 CR',
        completeOn: { channel: 'sim', where: (e) => e.type === 'purchased' && e.item === 'scanner' },
      },
      {
        id: 'scan',
        text: 'Take a reading with the scanner',
        detail: 'Press Q near any equipment',
        completeOn: { channel: 'ui/opened', where: (e) => e.panel === 'scanner' },
      },
    ],
  },
  {
    id: 'clearance-2',
    title: 'Clearance Level 2',
    kind: 'main',
    reward: 10_000,
    next: 'water-leak',
    steps: [
      {
        id: 'reach',
        text: 'Go to the Detector Hall in sector 3',
        detail: 'Ring shuttle from any sector',
        target: { room: 'ring-s3', interactable: 'research-console' },
        completeOn: { channel: 'room/entered', where: (e) => e.room === 'ring-s3' },
      },
      {
        id: 'run',
        text: 'Start a collider run',
        detail: 'Detector control console',
        target: { room: 'ring-s3', interactable: 'research-console' },
        completeOn: {
          channel: 'sim',
          where: (e) => e.type === 'productionStarted' && e.recipe === 'research',
        },
      },
      {
        id: 'data',
        text: 'Collect 60 research data',
        detail: 'Keep the beam above 1.0 GeV',
        target: { room: 'ring-s3', interactable: 'research-console' },
        completeOn: {
          channel: 'sim',
          where: (e) => e.type === 'produced' && e.stock === 'research' && e.total >= 60,
        },
      },
      {
        id: 'review',
        text: 'File a clearance review',
        detail: 'Ops tablet · Clearance · 15,000 CR',
        completeOn: { channel: 'sim', where: (e) => e.type === 'clearanceRaised' },
      },
    ],
  },
  {
    id: 'water-leak',
    title: 'Leak in the Tank Farm',
    kind: 'main',
    reward: 6_000,
    next: 'fix-turbine-b',
    steps: [
      {
        id: 'reach',
        text: 'Go to Water Containers',
        detail: 'Corridor C-3 from Reactor Control',
        target: { room: 'water-containers', interactable: 'water-panel' },
        completeOn: { channel: 'room/entered', where: (e) => e.room === 'water-containers' },
      },
      {
        id: 'find',
        text: 'Find the leaking tank',
        detail: 'Watch the sight glasses and the floor',
        target: { room: 'water-containers', interactable: 'tank-3' },
        completeOn: { channel: 'interact', where: (e) => e.interactable === 'tank-3' },
      },
      {
        id: 'isolate',
        text: 'Close tank T-3’s outlet valve',
        detail: 'Hold S at the tank’s service station',
        target: { room: 'water-containers', interactable: 'tank-3' },
        completeOn: { channel: 'sim', where: (e) => e.type === 'valveClosed' && e.tank === 2 },
      },
      {
        id: 'weld',
        text: 'Weld a patch over the leak',
        detail: 'Hold E with the valve closed',
        target: { room: 'water-containers', interactable: 'tank-3' },
        completeOn: { channel: 'sim', where: (e) => e.type === 'tankRepaired' && e.tank === 2 },
      },
      {
        id: 'reopen',
        text: 'Bring T-3 back online',
        detail: 'Hold W to reopen the valve',
        target: { room: 'water-containers', interactable: 'tank-3' },
        completeOn: { channel: 'sim', where: (e) => e.type === 'valveOpened' && e.tank === 2 },
      },
    ],
  },
  {
    id: 'fix-turbine-b',
    title: 'Fix Turbine B Vibration',
    kind: 'main',
    reward: 12_000,
    steps: [
      {
        id: 'walk',
        text: 'Walk to Turbine Hall B',
        detail: 'Corridor C-2 from Reactor Control',
        target: { room: 'turbine-hall', interactable: 'bearing-b3' },
        completeOn: { channel: 'room/entered', where: (e) => e.room === 'turbine-hall' },
      },
      {
        id: 'inspect',
        text: 'Inspect bearing B3 on the shaft',
        detail: 'Hold E · vibration analysis',
        target: { room: 'turbine-hall', interactable: 'bearing-b3' },
        completeOn: { channel: 'turbine/analyzed', where: (e) => e.bearing === 2 },
      },
      {
        id: 'balance',
        text: 'Rebalance the LP rotor with the crew',
        detail: 'LP rotor station · B3 under 2.8 mm/s',
        target: { room: 'turbine-hall', interactable: 'lp-rotor' },
        completeOn: { channel: 'sim', where: (e) => e.type === 'turbineBalanced' },
      },
      {
        id: 'pump',
        text: 'Service feed pump motor B',
        detail: 'Hold E at the pump',
        target: { room: 'turbine-hall', interactable: 'feed-pump-b' },
        completeOn: { channel: 'sim', where: (e) => e.type === 'feedPumpServiced' },
      },
    ],
  },
];

export const FIRST_OBJECTIVE = 'swap-cell-07';
