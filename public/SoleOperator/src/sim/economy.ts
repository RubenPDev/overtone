import type { Rng } from './rng';
import { clamp, type SimSystem } from './system';
import type { Contract, EconState, PlantCommand, PlantState, SimEvent, StockId } from './types';

/**
 * Plant economy and progression.
 *
 * - Net electrical output is sold to the grid at a price that follows daily
 *   demand (evening peak, night trough). A plant drawing more than it makes
 *   buys power back at a premium.
 * - Accelerator products sell on the market; feedstock and fresh fuel are bought.
 * - Upgrades and tools are bought with credits (some also need research data
 *   and a clearance level). Their effects are read by the systems that own them
 *   through `upgradeLevel()`.
 * - Clearance reviews spend research data and credits to raise the clearance
 *   level, which unlocks recipes, upgrades and contracts.
 * - Contracts are generated from the seeded RNG every few game hours, sized to
 *   what the player can currently make.
 */

export const START_CREDITS = 20_000;
/** Average grid price, credits per MWh. */
export const GRID_PRICE = 2.4;
export const IMPORT_PREMIUM = 1.5;
export const CONTRACT_INTERVAL_S = 3 * 3600;
export const OFFER_LIFETIME_S = 8 * 3600;
export const MAX_OFFERS = 3;
export const MAX_ACTIVE = 3;

/** Grid price at a game time: peaks at 18:00 (+30%), lowest at 06:00 (−30%). */
export function gridPrice(time: number): number {
  const h = (time / 3600) % 24;
  return GRID_PRICE * (1 + 0.3 * Math.cos((2 * Math.PI * (h - 18)) / 24));
}

// --- Upgrades and tools -------------------------------------------------------------

export type UpgradeCategory = 'reactor' | 'ring' | 'turbine' | 'water' | 'tools';

export interface UpgradeLevel {
  cost: number;
  research?: number;
  clearance: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  category: UpgradeCategory;
  /** One entry per level; buying advances to the next. */
  levels: UpgradeLevel[];
  blurb: string;
  /** What each level does, shown on the card. */
  effect: string[];
}

/**
 * Upgrades and tools. Data only: add an entry to add a purchase, then read its
 * level with upgradeLevel(state, id) in the system (or game code) it affects.
 */
export const UPGRADES: UpgradeDef[] = [
  {
    id: 'rod-drives',
    name: 'Rod drive motors',
    category: 'reactor',
    levels: [
      { cost: 30_000, clearance: 1 },
      { cost: 90_000, clearance: 3 },
    ],
    blurb: 'Higher-torque stepper motors on the control rod drives.',
    effect: ['Rods move 50% faster', 'Rods move twice as fast'],
  },
  {
    id: 'turbine-blades',
    name: 'Turbine blade retrofit',
    category: 'turbine',
    levels: [
      { cost: 60_000, clearance: 2 },
      { cost: 180_000, research: 200, clearance: 4 },
    ],
    blurb: '3D-profiled last-stage blades for the LP turbines.',
    effect: ['+0.8 pt thermal efficiency (~+30 MWe)', '+1.6 pt thermal efficiency (~+60 MWe)'],
  },
  {
    id: 'rf-feedback',
    name: 'RF feedback loop',
    category: 'ring',
    levels: [
      { cost: 25_000, clearance: 1 },
      { cost: 80_000, research: 120, clearance: 3 },
    ],
    blurb: 'Piezo tuners on every cavity, driven by a phase-locked loop.',
    effect: ['Cavities drift 35% slower', 'Cavities drift 70% slower'],
  },
  {
    id: 'cryo-plant',
    name: 'Cryo plant expansion',
    category: 'ring',
    levels: [
      { cost: 45_000, clearance: 2 },
      { cost: 140_000, research: 250, clearance: 4 },
    ],
    blurb: 'Extra helium compressor and cold box stage.',
    effect: ['−4 MWe idle draw, 25% less beam heating', '−8 MWe idle draw, 50% less beam heating'],
  },
  {
    id: 'beam-current',
    name: 'Ion source upgrade',
    category: 'ring',
    levels: [
      { cost: 70_000, research: 80, clearance: 2 },
      { cost: 220_000, research: 400, clearance: 5 },
    ],
    blurb: 'A brighter ion source at the injector linac.',
    effect: ['+20% beam current', '+40% beam current'],
  },
  {
    id: 'ring-energy',
    name: 'Ring energy upgrade',
    category: 'ring',
    levels: [{ cost: 900_000, research: 2500, clearance: 7 }],
    blurb: 'Nb3Sn cavities: 1.45 GeV top energy. Needed for antimatter.',
    effect: ['Top beam energy 1.2 → 1.45 GeV'],
  },
  {
    id: 'scanner',
    name: 'Handheld scanner',
    category: 'tools',
    levels: [{ cost: 8_000, clearance: 1 }],
    blurb: 'Point it at equipment for live readings (Q).',
    effect: ['Unlocks the Inspect tool'],
  },
  {
    id: 'vibration-analyzer',
    name: 'Vibration analyzer',
    category: 'tools',
    levels: [{ cost: 15_000, clearance: 1 }],
    blurb: 'Accelerometer probe and spectrum display for rotating machinery.',
    effect: ['Shows bearing spectra and the imbalance phase'],
  },
  {
    id: 'cask-3',
    name: 'Triple-bay transfer cask',
    category: 'tools',
    levels: [{ cost: 40_000, clearance: 2 }],
    blurb: 'A bigger shielded cask for the transfer cart.',
    effect: ['Cart carries 3 assemblies'],
  },
  {
    id: 'hazmat',
    name: 'Shielded work suit',
    category: 'tools',
    levels: [{ cost: 20_000, clearance: 1 }],
    blurb: 'Tungsten-loaded apron and visor.',
    effect: ['Halves radiation dose'],
  },
  {
    id: 'extra-tanks',
    name: 'Additional water tank',
    category: 'water',
    levels: [
      { cost: 35_000, clearance: 1 },
      { cost: 70_000, clearance: 2 },
    ],
    blurb: 'Another 2,000 m³ demineralised water tank in the Water Containers hall.',
    effect: ['5th tank (+25% reserve)', '6th tank (+50% reserve)'],
  },
  {
    id: 'tank-liners',
    name: 'Tank liners',
    category: 'water',
    levels: [
      { cost: 25_000, clearance: 1 },
      { cost: 75_000, research: 60, clearance: 3 },
    ],
    blurb: 'Reline the tanks: stainless steel, then a glass-flake composite.',
    effect: ['Stainless liners: corrosion and leaks halved', 'Composite liners: leaks rare'],
  },
  {
    id: 'leak-sensors',
    name: 'Leak detection',
    category: 'water',
    levels: [{ cost: 12_000, clearance: 1 }],
    blurb: 'Acoustic and moisture sensors under every tank.',
    effect: ['Leaks are reported the moment they start, with the tank number'],
  },
  {
    id: 'water-treatment',
    name: 'Treatment train',
    category: 'water',
    levels: [
      { cost: 30_000, clearance: 1 },
      { cost: 90_000, clearance: 3 },
    ],
    blurb: 'More reverse-osmosis skids feeding the tanks.',
    effect: ['Refill 50% faster', 'Refill twice as fast'],
  },
];

export const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export function upgradeLevel(state: Readonly<PlantState>, id: string): number {
  return state.econ.upgrades[id] ?? 0;
}

export const hasTool = (state: Readonly<PlantState>, id: string) => upgradeLevel(state, id) > 0;

// --- Market ------------------------------------------------------------------------

/** What the market pays per unit. Feedstock isn't bought back; research isn't sold. */
export const SELL_PRICE: Partial<Record<StockId, number>> = {
  'enriched-u': 140,
  mo99: 420,
  pu239: 110,
  u233: 150,
  transmuted: 90,
  tritium: 3_000,
  'dt-fuel': 9_000,
  he3: 14_000,
  antimatter: 300_000,
};

export interface MarketItem {
  id: string;
  name: string;
  cost: number;
  clearance: number;
  /** Stock delivered to the accelerator stores. */
  stock?: StockId;
  amount?: number;
  /** Stock consumed as part of the price (fuel fabrication). */
  consumes?: { stock: StockId; amount: number };
  blurb: string;
}

/**
 * Things the plant buys. `fuel-*` items arrive as an assembly in the pool rack
 * (the game layer handles the `purchased` event; the sim only takes payment).
 */
export const MARKET: MarketItem[] = [
  {
    id: 'fuel-assembly',
    name: 'Fresh fuel assembly',
    cost: 18_000,
    clearance: 1,
    blurb: 'Delivered to the pool rack in Fuel Rod Storage.',
  },
  {
    id: 'fuel-fab',
    name: 'Fabricate an assembly',
    cost: 4_000,
    clearance: 1,
    consumes: { stock: 'enriched-u', amount: 40 },
    blurb: 'From 40 kg of your own enriched uranium. Delivered to the pool rack.',
  },
  {
    id: 'depleted-u',
    name: 'Depleted uranium · 100 kg',
    cost: 600,
    clearance: 1,
    stock: 'depleted-u',
    amount: 100,
    blurb: 'Feed for enrichment and plutonium breeding.',
  },
  {
    id: 'mo-targets',
    name: 'Molybdenum targets · 10',
    cost: 900,
    clearance: 1,
    stock: 'mo-targets',
    amount: 10,
    blurb: 'Mo-98 targets for Mo-99 production.',
  },
  {
    id: 'thorium',
    name: 'Thorium · 20 kg',
    cost: 800,
    clearance: 3,
    stock: 'thorium',
    amount: 20,
    blurb: 'Blanket material for U-233 breeding.',
  },
  {
    id: 'lithium-6',
    name: 'Lithium-6 · 5 kg',
    cost: 4_000,
    clearance: 4,
    stock: 'lithium-6',
    amount: 5,
    blurb: 'Breeding blanket for tritium.',
  },
  {
    id: 'deuterium',
    name: 'Deuterium · 10 units',
    cost: 5_000,
    clearance: 6,
    stock: 'deuterium',
    amount: 10,
    blurb: 'Heavy hydrogen for D-T fuel pellets.',
  },
];

export const MARKET_BY_ID = new Map(MARKET.map((m) => [m.id, m]));

/** Research data and credits to file a clearance review from level n to n + 1. */
export function clearanceCost(level: number): { research: number; credits: number } {
  return { research: 60 * level * level, credits: 15_000 * level };
}

// --- Contracts -----------------------------------------------------------------------

interface DeliverTemplate {
  stock: StockId;
  tier: number;
  client: string;
  min: number;
  max: number;
  /** Reward per unit, credits (well above market). */
  rate: number;
  unit: string;
  name: string;
}

const DELIVER: DeliverTemplate[] = [
  {
    stock: 'mo99',
    tier: 1,
    client: 'Regional hospital network',
    min: 4,
    max: 12,
    rate: 700,
    unit: 'batches',
    name: 'Mo-99',
  },
  {
    stock: 'enriched-u',
    tier: 1,
    client: 'Fuel fabricator',
    min: 5,
    max: 20,
    rate: 260,
    unit: 'kg',
    name: 'enriched uranium',
  },
  {
    stock: 'research',
    tier: 1,
    client: 'University consortium',
    min: 30,
    max: 90,
    rate: 120,
    unit: 'data',
    name: 'research data',
  },
  {
    stock: 'pu239',
    tier: 2,
    client: 'National laboratory',
    min: 10,
    max: 40,
    rate: 190,
    unit: 'g',
    name: 'plutonium-239',
  },
  {
    stock: 'u233',
    tier: 3,
    client: 'Thorium reactor startup',
    min: 10,
    max: 30,
    rate: 260,
    unit: 'g',
    name: 'uranium-233',
  },
  {
    stock: 'transmuted',
    tier: 3,
    client: 'Waste agency',
    min: 4,
    max: 12,
    rate: 200,
    unit: 'kg',
    name: 'transmuted waste',
  },
  {
    stock: 'tritium',
    tier: 4,
    client: 'Fusion research centre',
    min: 1,
    max: 4,
    rate: 5_000,
    unit: 'g',
    name: 'tritium',
  },
  {
    stock: 'dt-fuel',
    tier: 6,
    client: 'Fusion pilot plant',
    min: 2,
    max: 6,
    rate: 15_000,
    unit: 'pellets',
    name: 'D-T fuel',
  },
  {
    stock: 'he3',
    tier: 7,
    client: 'Aerospace consortium',
    min: 1,
    max: 3,
    rate: 25_000,
    unit: 'g',
    name: 'helium-3',
  },
  {
    stock: 'antimatter',
    tier: 8,
    client: 'Deep-space propulsion lab',
    min: 1,
    max: 2,
    rate: 500_000,
    unit: 'ng',
    name: 'antimatter',
  },
];

export function createEconState(): EconState {
  return {
    credits: START_CREDITS,
    earned: 0,
    price: GRID_PRICE,
    upgrades: {},
    contracts: [],
    nextContractAt: 0,
    nextContractId: 1,
    completed: 0,
  };
}

function makeContract(state: PlantState, rng: Rng): Contract {
  const e = state.econ;
  const id = e.nextContractId++;
  const tier = state.accel.clearance;
  // One in three is a grid dispatch request; the rest are deliveries of something unlocked.
  if (rng.next() < 0.33) {
    const target = Math.round(rng.range(1080, 1170) / 10) * 10;
    const hours = 2 + Math.floor(rng.next() * 4);
    return {
      id,
      kind: 'grid',
      client: 'Grid operator',
      title: `Hold ${target} MWe net for ${hours} h`,
      stock: null,
      amount: hours * 3600,
      target,
      progress: 0,
      reward: Math.round((hours * 3_500 + (target - 1000) * 40) / 100) * 100,
      expires: state.time + OFFER_LIFETIME_S,
      deadline: 0,
      window: hours * 3600 * 3,
      status: 'offered',
    };
  }
  const options = DELIVER.filter((d) => d.tier <= tier);
  const t = options[Math.floor(rng.next() * options.length)]!;
  const amount = Math.round(rng.range(t.min, t.max));
  return {
    id,
    kind: 'deliver',
    client: t.client,
    title: `Deliver ${amount} ${t.unit} of ${t.name}`,
    stock: t.stock,
    amount,
    target: 0,
    progress: 0,
    reward: Math.round((amount * t.rate) / 100) * 100,
    expires: state.time + OFFER_LIFETIME_S,
    deadline: 0,
    window: (12 + Math.floor(rng.next() * 3) * 6) * 3600,
    status: 'offered',
  };
}

/** Grid sales, contract generation, progress, payment and expiry. */
export const economySystem: SimSystem = {
  id: 'economy',
  step(state, ctx) {
    const e = state.econ;
    e.price = gridPrice(state.time);
    const net = state.netOutput;
    const mwh = (net * ctx.dt) / 3600;
    const cash = net >= 0 ? mwh * e.price : mwh * e.price * IMPORT_PREMIUM;
    e.credits += cash;
    if (cash > 0) e.earned += cash;

    if (state.time >= e.nextContractAt) {
      e.nextContractAt = state.time + CONTRACT_INTERVAL_S;
      if (e.contracts.filter((c) => c.status === 'offered').length < MAX_OFFERS) {
        const c = makeContract(state, ctx.rng);
        e.contracts.push(c);
        ctx.emit({ type: 'contractOffered', id: c.id });
      }
    }

    for (const c of e.contracts) {
      if (c.status === 'offered') {
        if (state.time >= c.expires) c.status = 'expired';
        continue;
      }
      if (c.status !== 'active') continue;
      if (c.kind === 'deliver' && c.stock && state.accel.stock[c.stock] >= c.amount) {
        state.accel.stock[c.stock] -= c.amount;
        c.progress = c.amount;
        complete(state, c, ctx.emit);
      } else if (c.kind === 'grid') {
        if (net >= c.target) c.progress = Math.min(c.amount, c.progress + ctx.dt);
        if (c.progress >= c.amount) complete(state, c, ctx.emit);
      }
      if (c.status === 'active' && state.time >= c.deadline) {
        c.status = 'failed';
        ctx.emit({ type: 'contractFailed', id: c.id, title: c.title });
      }
    }
    // Keep finished contracts out of the save once they're old news.
    if (e.contracts.length > 12)
      e.contracts = e.contracts.filter((c) => c.status === 'offered' || c.status === 'active');
  },
};

function complete(state: PlantState, c: Contract, emit: (e: SimEvent) => void) {
  c.status = 'done';
  state.econ.credits += c.reward;
  state.econ.earned += c.reward;
  state.econ.completed += 1;
  emit({ type: 'contractCompleted', id: c.id, title: c.title, reward: c.reward });
}

/** Economy commands. Returns true if the command was one of ours. */
export function applyEconCommand(state: PlantState, cmd: PlantCommand, emit: (e: SimEvent) => void): boolean {
  const e = state.econ;
  const a = state.accel;
  const reject = (reason: string) => {
    emit({ type: 'commandRejected', command: cmd.type, reason });
    return true;
  };
  const afford = (credits: number, research = 0) => {
    if (e.credits < credits)
      return reject(`Needs ${Math.ceil(credits - e.credits).toLocaleString('en-US')} more credits.`);
    if (a.stock.research < research)
      return reject(`Needs ${Math.ceil(research - a.stock.research)} more research data.`);
    return false;
  };

  switch (cmd.type) {
    case 'acceptContract': {
      const c = e.contracts.find((x) => x.id === cmd.id);
      if (!c || c.status !== 'offered') return reject('That offer is no longer open.');
      if (e.contracts.filter((x) => x.status === 'active').length >= MAX_ACTIVE)
        return reject(`At most ${MAX_ACTIVE} contracts at once.`);
      c.status = 'active';
      c.deadline = state.time + c.window;
      emit({ type: 'contractAccepted', id: c.id, title: c.title });
      return true;
    }
    case 'declineContract': {
      const c = e.contracts.find((x) => x.id === cmd.id);
      if (c && c.status === 'offered') c.status = 'expired';
      return true;
    }
    case 'buyUpgrade': {
      const u = UPGRADE_BY_ID.get(cmd.id);
      if (!u) return reject('Unknown upgrade.');
      const lvl = e.upgrades[u.id] ?? 0;
      const next = u.levels[lvl];
      if (!next) return reject('Already fully upgraded.');
      if (next.clearance > a.clearance) return reject(`Needs clearance L${next.clearance}.`);
      if (afford(next.cost, next.research)) return true;
      e.credits -= next.cost;
      a.stock.research -= next.research ?? 0;
      e.upgrades[u.id] = lvl + 1;
      emit({ type: 'purchased', item: u.id, level: lvl + 1 });
      return true;
    }
    case 'buyItem': {
      const m = MARKET_BY_ID.get(cmd.id);
      if (!m) return reject('Unknown item.');
      if (m.clearance > a.clearance) return reject(`Needs clearance L${m.clearance}.`);
      if (m.consumes && a.stock[m.consumes.stock] < m.consumes.amount)
        return reject(`Needs ${m.consumes.amount} ${m.consumes.stock}.`);
      if (afford(m.cost)) return true;
      e.credits -= m.cost;
      if (m.consumes) a.stock[m.consumes.stock] -= m.consumes.amount;
      if (m.stock) a.stock[m.stock] += m.amount ?? 0;
      emit({ type: 'purchased', item: m.id, level: 0 });
      return true;
    }
    case 'sell': {
      const price = SELL_PRICE[cmd.stock];
      if (!price) return reject('The market doesn’t buy that.');
      const amount = Math.min(Math.floor(cmd.amount), a.stock[cmd.stock]);
      if (amount <= 0) return reject('Nothing to sell.');
      a.stock[cmd.stock] -= amount;
      const credits = amount * price;
      e.credits += credits;
      e.earned += credits;
      emit({ type: 'sold', stock: cmd.stock, amount, credits });
      return true;
    }
    case 'clearanceReview': {
      if (a.clearance >= 8) return reject('Already at the highest clearance.');
      const cost = clearanceCost(a.clearance);
      if (afford(cost.credits, cost.research)) return true;
      e.credits -= cost.credits;
      a.stock.research -= cost.research;
      a.clearance = clamp(a.clearance + 1, 1, 8);
      emit({ type: 'clearanceRaised', level: a.clearance });
      return true;
    }
    case 'grantCredits':
      e.credits += cmd.amount;
      return true;
    default:
      return false;
  }
}
