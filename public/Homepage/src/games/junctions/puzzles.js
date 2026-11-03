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
export function improve(world, demand, budget, start = {}) {
  const { city, net } = world;
  const trips = buildTrips(city, net, city.seed, demand);
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
  return 8 + Math.floor(rand() * 3) * 2; // 8, 10 or 12
}

/**
 * Works out a day from scratch: the city, its budget, and the heaviest rush
 * hour that some junctions within the budget run perfectly. Returns a solution
 * too, which is the proof.
 */
export function tune(n) {
  for (let variant = 0; variant < 24; variant++) {
    const world = worldFor(n, variant);
    const junctionCount = world.city.nodes.filter((x) => x.kind === 'junction').length;
    if (junctionCount < 5) continue;
    for (let budget = budgetFor(n, variant); budget <= 14; budget += 2) {
      // Search the demand: perfect is possible below it, not above.
      let lo = MIN_DEMAND;
      let hi = MAX_DEMAND;
      let found = null;
      let start = {};
      for (let i = 0; i < 6; i++) {
        const mid = Math.round((lo + hi) / 2);
        const { config, score } = improve(world, mid, budget, start);
        if (score.perfect) { lo = mid; found = { demand: mid, config }; start = config; } else hi = mid;
      }
      if (!found) continue;
      const trips = buildTrips(world.city, world.net, world.city.seed, found.demand);
      const nothing = simulate(world.city, world.net, trips, {});
      if (nothing.cleared >= CLEAR_SHARE) continue; // doing nothing would do: give more to spend
      return { n, variant, budget, demand: found.demand, solution: found.config };
    }
  }
  return null;
}

/** Everything the game needs for day n, given its tuning. */
export function dayFrom(t) {
  const world = worldFor(t.n, t.variant);
  const trips = buildTrips(world.city, world.net, world.city.seed, t.demand);
  return { ...t, ...world, trips };
}

export { COST, TYPES };
