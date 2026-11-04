/* ============================================================
   Junctions — daily puzzles.

   A day is a city, a budget and a rush hour. The city and the mix of
   trips come from the puzzle number; how heavy the rush is gets tuned
   by search: as heavy as it can be while some choice of junctions within
   the budget still runs it with perfect flow, and heavy enough that
   leaving every junction as a give-way doesn't clear it. So every day is
   proven possible, and none can be done by doing nothing.

   The search takes a few seconds, so days are worked out ahead of time
   into days.json; a day past the end of that file is worked out on the
   spot, the same way.
   ============================================================ */

import { devMode } from '../../lib/devMode.js';
import { buildCity, rng } from './city.js';
import { CLEAR_SHARE, COST, TYPES, buildNetwork, buildTrips, costOf, simulate } from './sim.js';

export const LAUNCH_UTC = Date.UTC(2026, 10, 2); // 2 Nov 2026

export function todayNumber(now = new Date()) {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(1, Math.floor((midnight - LAUNCH_UTC) / 86400000) + 1);
}

export function dateForNumber(n) {
  return new Date(LAUNCH_UTC + (n - 1) * 86400000);
}

const PREVIEW_DAYS = 30;

/** The newest puzzle that can be played: today, or further ahead in developer mode. */
export function lastNumber() {
  return todayNumber() + (devMode() ? PREVIEW_DAYS : 0);
}

/** Today's puzzle lives at the plain URL. */
export function puzzlePath(n) {
  return n === todayNumber() ? '/junctions' : `/junctions/${n}`;
}

/* ------------------------------------------------------------------
   Tuning a day.
------------------------------------------------------------------ */

const MIN_DEMAND = 24;
const MAX_DEMAND = 150;
const BEAM = 3; // how many of the best sets the search carries forward each round
export const GEN = 2;        // the traffic generator new days are made with
const BUDGETS = [6, 8, 10];
const MAX_PERFECT = 3;       // a day may have a small family of perfect layouts, no more
const VARIANTS = 40;

/** How good a run is, for the search: perfect first, then how much got through. */
function value(score, cost) {
  return (score.perfect ? 10 : 0) + score.cleared * 5 + (1 - score.peak) - cost * 0.001;
}

/**
 * The best junctions this search can find within the budget. From the given
 * start it makes single changes, keeping the few best sets each round rather
 * than only the best, since the upgrade that helps most alone isn't always
 * part of the best set; then it tries giving up each upgrade to build again.
 */
export function improve(world, demand, budget, start = {}, gen = GEN) {
  const { city, net } = world;
  const trips = buildTrips(city, net, city.seed, demand, gen);
  const ids = city.nodes.filter((n) => n.kind === 'junction').map((n) => n.id);
  const seen = new Map();
  const judge = (config) => {
    const key = ids.map((id) => config[id] ?? '').join(',');
    if (!seen.has(key)) {
      const score = simulate(city, net, trips, config);
      seen.set(key, { config, score, v: value(score, costOf(config)) });
    }
    return seen.get(key);
  };

  const climb = (from) => {
    let best = judge(from);
    let beam = [best];
    for (let round = 0; round < 12; round++) {
      const next = new Map();
      for (const at of beam) {
        for (const id of ids) {
          for (const type of TYPES) {
            if ((at.config[id] ?? 'giveway') === type) continue;
            const config = { ...at.config, [id]: type };
            if (type === 'giveway') delete config[id];
            if (costOf(config) > budget) continue;
            const tried = judge(config);
            if (tried.v > at.v + 1e-9) next.set(tried, true);
          }
        }
      }
      if (!next.size) break;
      beam = [...next.keys()].sort((a, b) => b.v - a.v).slice(0, BEAM);
      if (beam[0].v > best.v) best = beam[0];
    }
    return best;
  };

  // Climb, then see whether giving up any one upgrade lets a better set be built.
  let best = climb({ ...start });
  for (let pass = 0; pass < 2; pass++) {
    let better = null;
    for (const id of Object.keys(best.config)) {
      const without = { ...best.config };
      delete without[id];
      const tried = climb(without);
      if (tried.v > best.v + 1e-9 && (!better || tried.v > better.v)) better = tried;
    }
    if (!better) break;
    best = better;
  }
  return { config: best.config, score: best.score };
}

/** The city and its lanes for a day; cheap, and the same every time. */
export function worldFor(n, variant = 0) {
  const city = buildCity(n * 31 + variant * 100003);
  return { city, net: buildNetwork(city) };
}

function budgetFor(n, variant) {
  const rand = rng(n * 977 + variant);
  return 6 + Math.floor(rand() * 3) * 2; // 6, 8 or 10
}

/** Every layout the budget allows, as {junction: type} with give-ways left out. */
export function layoutsWithin(ids, budget) {
  const out = [];
  const config = {};
  (function place(i, cost) {
    if (cost > budget) return;
    if (i === ids.length) { out.push({ ...config }); return; }
    for (const type of TYPES) {
      if (type === 'giveway') delete config[ids[i]]; else config[ids[i]] = type;
      place(i + 1, cost + COST[type]);
    }
    delete config[ids[i]];
  })(0, 0);
  return out;
}

/* What someone might build without reading this town at all: one kind of junction
   on the busiest crossings, or roundabouts at the highway first. A day that any of
   these wins isn't a puzzle. */
function recipes(world, trips, budget) {
  const { city, net } = world;
  const ids = city.nodes.filter((x) => x.kind === 'junction').map((x) => x.id);
  const through = new Map(ids.map((id) => [id, 0]));
  for (const trip of trips) for (const laneId of trip.path) { const to = net.lanes[laneId].to; if (through.has(to)) through.set(to, through.get(to) + 1); }
  const busiest = [...ids].sort((a, b) => through.get(b) - through.get(a));
  const nearest = (p) => [...ids].sort((a, b) => Math.hypot(city.nodes[a].x - p.x, city.nodes[a].y - p.y) - Math.hypot(city.nodes[b].x - p.x, city.nodes[b].y - p.y))[0];
  const highwayFirst = [...new Set([nearest(city.entrance), nearest(city.exit), ...busiest])];
  const fill = (order, type) => {
    const config = {};
    let cost = 0;
    for (const id of order) if (cost + COST[type] <= budget) { config[id] = type; cost += COST[type]; }
    return config;
  };
  return [fill(busiest, 'roundabout'), fill(busiest, 'lights'), fill(busiest, 'flyover'), fill(highwayFirst, 'roundabout')];
}

/**
 * Every perfect layout for a town at a given rush hour, by trying them all. It's a
 * few thousand runs at most, which is what makes a day provable.
 */
export function perfectLayouts(world, demand, budget, gen = GEN) {
  const { city, net } = world;
  const trips = buildTrips(city, net, city.seed, demand, gen);
  const ids = city.nodes.filter((x) => x.kind === 'junction').map((x) => x.id);
  const perfect = layoutsWithin(ids, budget).filter((config) => simulate(city, net, trips, config).perfect);
  return { perfect, trips };
}

const kinds = (config) => new Set(Object.values(config)).size;

/**
 * Works out a day from scratch, and proves it's a puzzle: a town, a budget, and
 * the heaviest rush hour that some layout runs perfectly, where trying every
 * layout finds no more than a few that do, none of them a recipe, and doing
 * nothing leaves cars stuck. The first pass also insists that the answer mixes
 * kinds of junction; only a town where nothing does is let off that.
 */
export function tune(n) {
  for (const mixed of [true, false]) {
    for (let variant = 0; variant < VARIANTS; variant++) {
      const world = worldFor(n, variant);
      const junctionCount = world.city.nodes.filter((x) => x.kind === 'junction').length;
      if (junctionCount < 4) continue;
      const first = budgetFor(n, variant);
      for (const budget of [first, ...BUDGETS.filter((b) => b !== first)]) {
        // Search the demand: perfect is possible below it, not above.
        let lo = MIN_DEMAND;
        let hi = MAX_DEMAND;
        let edge = null;
        let start = {};
        for (let i = 0; i < 6; i++) {
          const mid = Math.round((lo + hi) / 2);
          const { config, score } = improve(world, mid, budget, start);
          if (score.perfect) { lo = mid; edge = mid; start = config; } else hi = mid;
        }
        if (!edge) continue;
        // At the edge only a few layouts work; nudge the rush up until no more than a few do.
        for (let demand = edge; demand <= edge + 8; demand += 2) {
          const { perfect, trips } = perfectLayouts(world, demand, budget);
          if (!perfect.length) break;
          if (perfect.length > MAX_PERFECT) continue;
          if (mixed && perfect.some((c) => kinds(c) < 2)) break;
          const nothing = simulate(world.city, world.net, trips, {});
          if (nothing.cleared >= CLEAR_SHARE) break; // doing nothing would nearly do
          if (recipes(world, trips, budget).some((c) => simulate(world.city, world.net, trips, c).perfect)) break;
          const cheapest = [...perfect].sort((a, b) => costOf(a) - costOf(b))[0];
          return { n, variant, budget, demand, gen: GEN, solution: cheapest, answers: perfect.length };
        }
      }
    }
  }
  return null;
}

/** Everything the game needs for day n, given its tuning. */
export function dayFrom(t) {
  const world = worldFor(t.n, t.variant);
  const trips = buildTrips(world.city, world.net, world.city.seed, t.demand, t.gen ?? 1);
  return { ...t, ...world, trips };
}

export { COST, TYPES };
