/* ============================================================
   Junctions — the traffic.

   A deterministic simulation: the same city, the same rush hour and the
   same junctions always play out the same way, so everyone's run of a
   day is comparable, and a day can be checked to be solvable before
   anyone sees it.

   Each street is a lane each way. Cars follow the one ahead, and wait at
   the stop line until their junction lets them across, which it only does
   when there's room on the street they're turning into. So one slow
   junction backs up into the next, which is how a jam spreads.
   ============================================================ */

import { DX, DY, ROAD_W, rng } from './city.js';

export const DT = 0.1;          // seconds per step
export const CAR_GAP = 7;       // metres a car takes up in a queue, bumper to bumper
const HEAT_LAG = 6;             // seconds the heat map takes to follow a change
export const JUNCTION_R = ROAD_W / 2; // where the stop line sits: the edge of the junction
const STREET_SPEED = 12;        // m/s
const HIGHWAY_SPEED = 18;
const LANE_OFFSET = ROAD_W / 4; // drive on the right, in the middle of the lane
// Roads onto the plate carry on out of sight, so arrivals have somewhere to queue
// before they're on screen; the highway's on-ramp more so.
const OFF_PLATE = { street: 40, entrance: 90 };

/* The kinds of junction, what each costs, and how quickly it lets cars across. */
export const TYPES = ['giveway', 'lights', 'roundabout', 'flyover'];
export const COST = { giveway: 0, lights: 2, roundabout: 3, flyover: 5 };

// Turns, as a change of heading: straight, right, back (never), left.
const STRAIGHT = 0;
const RIGHT = 1;
const LEFT = 3;
const turnOf = (inH, outH) => (outH - inH + 4) % 4;

// How long a car takes to cross, which is also how long it's drawn crossing.
const CROSS = { [STRAIGHT]: 1.3, [RIGHT]: 1.1, [LEFT]: 1.7 };
// Give-way: one car at a time over the whole junction, so a left turn holds everyone.
const GIVEWAY_GAP = { [STRAIGHT]: 1.9, [RIGHT]: 1.6, [LEFT]: 2.5 };
// Lights: green for each pair of opposite approaches in turn, with an all-red
// between. They sense traffic, so green stays while it's used and changes once
// the other way has someone waiting.
const MIN_GREEN = 3;
const MAX_GREEN = 14;
const ALL_RED = 1;
// Both opposite approaches go at once, a car a lane at a time: strong where two
// busy streams cross, but anyone arriving on red waits, however quiet it is.
const LIGHTS_GAP = { [STRAIGHT]: 0.8, [RIGHT]: 1.0, [LEFT]: 1.2 };
const STARTUP = 0.6; // the first car off a fresh green is slow to go
// Each green opens with a left-turn arrow: left turners go first while the
// traffic facing them waits, so one car turning left can't block a lane all green.
const LEAD = 2.2;
const SENSOR = 25; // how far back from the stop line the lights see a car coming
// Roundabout: arms are a quarter turn apart, and traffic goes round anticlockwise.
// Entering means waiting for a gap in what's already going round, so traffic that
// turns every which way flows, but one heavy stream starves the entrance after it.
const SECTOR = 0.85;
const ENTRY_GAP = 1.6; // seconds clear of anyone coming round past an entrance
const RING_FOLLOW = 0.6; // seconds behind the car ahead on the ring
const RING_SLOW = 14;    // metres before the ring that cars ease off
const RING_SPEED = 7;    // and how fast they roll on
const ROUNDABOUT_GAP = 1.6;
const ROUNDABOUT_HOLD = 3;
// Flyover: the through road's straight traffic goes over the top, free. Right turns
// peel off on slip ramps round the corners. Everything else (the cross road going
// straight, and left turns) meets at ground level under the deck and gives way.
const FLYOVER_STRAIGHT_GAP = 0.9;
const SLIP_GAP = 1.0;
const UNDER_GAP = { [STRAIGHT]: 1.7, [LEFT]: 2.3 };

/* Town vehicles that never come or go: they drive round and round inside, queueing
   and giving way like everyone else. They're traffic, but not part of the rush,
   so they're never counted as stuck and the run doesn't wait for them. */
const PATROLS = ['taxi', 'police', 'ambulance'];
const PATROL_TURNS = 600; // junctions planned ahead for each, far more than a run reaches
// One rush-hour car in this many is a lorry. Only its look changes.
const TRUCK_EVERY = 9;

/* ------------------------------------------------------------------
   The lanes and the routes over them.
------------------------------------------------------------------ */

/**
 * Turns the street plan into one-way lanes. A lane runs from the stop line
 * of one junction to the stop line of the next, offset to the right of the
 * road's centre, and knows the heading it travels in.
 */
export function buildNetwork(city) {
  const points = [...city.nodes, ...city.portals];
  const lanes = [];
  const byNodes = new Map();
  const add = (from, to, heading, highway, offPlate = 0) => {
    const a = points[from];
    const b = points[to];
    const nx = -DY[heading];
    const ny = DX[heading];
    const offset = -LANE_OFFSET; // right-hand side: rotate the heading a quarter turn clockwise
    const back = (p) => (p.kind && p.links ? JUNCTION_R : 0);
    const x0 = a.x + DX[heading] * (back(a) - offPlate) - nx * offset;
    const y0 = a.y + DY[heading] * (back(a) - offPlate) - ny * offset;
    const x1 = b.x - DX[heading] * back(b) - nx * offset;
    const y1 = b.y - DY[heading] * back(b) - ny * offset;
    const lane = {
      id: lanes.length, from, to, heading,
      x0, y0, x1, y1,
      len: Math.hypot(x1 - x0, y1 - y0),
      speed: highway ? HIGHWAY_SPEED : STREET_SPEED,
      portal: null,
      offPlate, // metres of the lane, from its start, that are off the plate
    };
    lane.cap = Math.max(1, Math.floor(lane.len / CAR_GAP));
    lanes.push(lane);
    byNodes.set(`${from}>${to}`, lane);
    return lane;
  };
  for (const road of city.roads) {
    const highway = road.portal === 'entrance' || road.portal === 'exit';
    const there = add(road.a, road.b, road.heading, highway);
    const back = add(road.b, road.a, (road.heading + 2) % 4, highway, road.portal ? OFF_PLATE[road.portal] ?? 0 : 0);
    if (road.portal) {
      there.portal = 'out';  // leaving the plate
      back.portal = 'in';    // arriving on it
    }
  }
  // The highway is one-way: in at the entrance, out at the exit.
  const usable = lanes.filter((l) => {
    const p = city.portals.find((q) => q.id === l.from || q.id === l.to);
    if (!p) return true;
    if (p.kind === 'entrance') return l.portal === 'in';
    if (p.kind === 'exit') return l.portal === 'out';
    return true;
  });
  usable.forEach((l, i) => { l.id = i; });

  const outOf = new Map();
  for (const l of usable) {
    if (!outOf.has(l.from)) outOf.set(l.from, []);
    outOf.get(l.from).push(l);
  }
  return { lanes: usable, outOf, points };
}

/**
 * The quickest way from one lane to another by free-flow time, with a little
 * per-driver noise so that not everyone piles down the same street.
 */
function route(net, fromLane, toLane, rand) {
  const n = net.lanes.length;
  const cost = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  cost[fromLane] = 0;
  for (;;) {
    let best = -1;
    for (let i = 0; i < n; i++) if (!done[i] && cost[i] < Infinity && (best < 0 || cost[i] < cost[best])) best = i;
    if (best < 0 || best === toLane) break;
    done[best] = 1;
    const lane = net.lanes[best];
    for (const next of net.outOf.get(lane.to) ?? []) {
      if (next.to === lane.from) continue; // no U-turns
      const turn = turnOf(lane.heading, next.heading);
      const turnCost = turn === LEFT ? 3 : turn === RIGHT ? 1 : 0;
      const c = cost[best] + (next.len / next.speed) * (0.85 + rand() * 0.3) + turnCost;
      if (c < cost[next.id]) { cost[next.id] = c; prev[next.id] = best; }
    }
  }
  if (cost[toLane] === Infinity) return null;
  const path = [];
  for (let i = toLane; i >= 0; i = prev[i]) path.unshift(i);
  return path;
}

/* ------------------------------------------------------------------
   The rush hour: who wants to go where, and when they set off.
------------------------------------------------------------------ */

export const RUSH = 150;   // seconds of cars setting off
export const DRAIN = 30;   // and this long after for the last of them to get through

/* Each day's traffic has a character, so a different junction is the crux each day:
   most cars heading into town, or out of it, one busy route across town, a stream
   passing straight through on the highway, or a bit of everything. One street also
   pulls more than the rest, the way a stadium or a market would. */
const CHARACTERS = {
  in: () => ({ inbound: [0.55, 0.7], outbound: [0.08, 0.15], through: [0.03, 0.08] }),
  out: () => ({ inbound: [0.1, 0.18], outbound: [0.5, 0.65], through: [0.03, 0.08] }),
  across: () => ({ inbound: [0.12, 0.2], outbound: [0.1, 0.18], through: [0.03, 0.08] }),
  through: () => ({ inbound: [0.2, 0.3], outbound: [0.12, 0.2], through: [0.3, 0.42] }),
  mixed: () => ({ inbound: [0.35, 0.45], outbound: [0.22, 0.32], through: [0.08, 0.15] }),
};
export const CHARACTER_NAMES = Object.keys(CHARACTERS);

/** The day's character, from its seed: the same for everyone, every time. */
export function characterOf(seed) {
  const rand = rng(seed * 6151 + 29);
  return CHARACTER_NAMES[Math.floor(rand() * CHARACTER_NAMES.length)];
}

/**
 * Trips for the day. Most come off the highway into town or leave town for it,
 * some cross town from street to street, some pass straight through. `demand`
 * scales how many there are; the day's mix and timing come from the seed.
 * `gen` 1 is the first generator, kept so the days played with it never change.
 */
export function buildTrips(city, net, seed, demand, gen = 1) {
  const rand = rng(seed * 104729 + 3);
  const inLane = (portal) => net.lanes.find((l) => l.from === portal.id && l.portal === 'in');
  const outLane = (portal) => net.lanes.find((l) => l.to === portal.id && l.portal === 'out');
  const streets = city.streetPortals;
  const pairs = [];
  let weight;
  let share;
  let busyRoute = null; // the one busy street-to-street route, on a day across town
  if (gen === 1) {
    weight = streets.map(() => 0.5 + rand());
    share = { inbound: 0.4 + rand() * 0.15, outbound: 0.25 + rand() * 0.1, through: 0.08 + rand() * 0.07 };
  } else {
    const between = ([a, b]) => a + rand() * (b - a);
    const ranges = CHARACTERS[characterOf(seed)]();
    share = { inbound: between(ranges.inbound), outbound: between(ranges.outbound), through: between(ranges.through) };
    weight = streets.map(() => 0.3 + rand() * rand() * 1.6);
    weight[Math.floor(rand() * streets.length)] *= 2.6; // the street everyone's going to
    if (characterOf(seed) === 'across' && streets.length > 1) {
      const a = Math.floor(rand() * streets.length);
      busyRoute = [a, (a + 1 + Math.floor(rand() * (streets.length - 1))) % streets.length];
    }
  }
  share.cross = Math.max(0.08, 1 - share.inbound - share.outbound - share.through);
  const total = weight.reduce((a, b) => a + b, 0);
  streets.forEach((s, i) => {
    pairs.push({ from: city.entrance, to: s, w: share.inbound * weight[i] / total });
    pairs.push({ from: s, to: city.exit, w: share.outbound * weight[i] / total });
    streets.forEach((t, j) => {
      if (i === j) return;
      // Across town, most of the street-to-street traffic takes the one route.
      const w = busyRoute ? (busyRoute[0] === i && busyRoute[1] === j ? share.cross * 0.6 : share.cross * 0.4 / (streets.length * (streets.length - 1)))
        : share.cross * weight[i] * weight[j] / (total * total);
      pairs.push({ from: s, to: t, w });
    });
  });
  pairs.push({ from: city.entrance, to: city.exit, w: share.through });

  // The rush builds to a peak just past half way, then eases off.
  const peak = 0.45 + rand() * 0.2;
  const rate = (t) => {
    const u = t / RUSH;
    return u < peak ? 0.35 + 0.65 * (u / peak) : 0.35 + 0.65 * ((1 - u) / (1 - peak));
  };
  const trips = [];
  const perSecond = demand / 60; // demand is cars a minute at the peak
  for (const pair of pairs) {
    const lambda = perSecond * pair.w;
    if (lambda <= 0) continue;
    let t = 0;
    for (;;) {
      // Thinned arrivals: draw at the peak rate, keep each in proportion to the rate then.
      t += -Math.log(1 - rand()) / lambda;
      if (t >= RUSH) break;
      if (rand() > rate(t)) continue;
      const path = route(net, inLane(pair.from).id, outLane(pair.to).id, rand);
      if (!path) continue;
      // How long the trip takes on empty streets, to judge later whether it's running late.
      const free = path.reduce((sum, id) => sum + net.lanes[id].len / net.lanes[id].speed, 0) + (path.length - 1) * CROSS[STRAIGHT];
      trips.push({ t, path, free, tone: Math.floor(rand() * 5) });
    }
  }
  trips.sort((a, b) => a.t - b.t);
  trips.forEach((trip, i) => { trip.id = i; });
  return trips;
}

/* ------------------------------------------------------------------
   The run.
------------------------------------------------------------------ */

const sideOf = (heading) => heading % 2; // 0: north-south, 1: east-west

/**
 * A run of the rush hour with the junctions set as given (an object from node
 * id to type; anything missing is give-way). Call step() until it's done.
 */
export function createRun(city, net, trips, junctions) {
  const lanes = net.lanes.map((l) => ({ ...l, cars: [], heat: 0, peak: 0 }));
  const nodes = new Map();
  for (const n of city.nodes) {
    const incoming = lanes.filter((l) => l.to === n.id);
    nodes.set(n.id, {
      id: n.id,
      // A flyover's deck runs along the road that carries on both sides (render.js agrees).
      axis: n.links && n.links[1] !== null && n.links[3] !== null ? 1 : 0,
      type: n.kind === 'junction' ? junctions[n.id] ?? 'giveway' : 'bend',
      incoming,
      busyUntil: 0,
      nextFree: new Map(incoming.map((l) => [l.id, 0])),
      circle: [], // cars on a roundabout: { arm, exit, at, sectors }
      green: 0,   // lights: which way is green (0 north-south, 1 east-west), null for all-red
      lastGreen: 0,
      phaseAt: 0,
    });
  }
  const sources = new Map(); // lane id -> waiting trips
  for (const l of lanes) if (l.portal === 'in') sources.set(l.id, []);
  placePatrols(lanes, net, city.seed);

  const run = {
    t: 0,
    total: trips.length,
    arrived: 0,
    cars: 0,
    done: false,
    lanes,
    nodes,
    sources,
    peakHeat: 0,
    next: 0,
    // Car-seconds spent moving and waiting, rush-hour cars only, for the flow score.
    movingTime: 0,
    waitingTime: 0,
  };

  const tailRoom = (lane) => {
    const last = lane.cars[lane.cars.length - 1];
    return !last || last.pos >= CAR_GAP;
  };

  /* Room for one more on a roundabout: the car ahead only needs to be on its way
     round, not off it, since cars follow each other round the ring. */
  const ringRoom = (lane) => {
    const last = lane.cars[lane.cars.length - 1];
    return tailRoom(lane) || (last.hold > 0 && last.crossing.dur - last.hold >= RING_FOLLOW);
  };

  const admit = (node, lane, car, nextLane, gap) => {
    lane.cars.shift();
    const turn = turnOf(lane.heading, nextLane.heading);
    const ahead = nextLane.cars[nextLane.cars.length - 1];
    car.lane = nextLane.id;
    car.ri += 1;
    car.pos = 0;
    car.hold = CROSS[turn];
    if (node.type === 'roundabout') {
      // Round the ring, easing off behind anyone ahead going the same way.
      car.hold = 0.5 + SECTOR * sectorsFor(turn);
      if (ahead && ahead.hold > 0) car.hold = Math.max(car.hold, ahead.hold + CAR_GAP / nextLane.speed);
    }
    car.crossing = { from: lane.id, turn, dur: car.hold };
    car.waiting = 0;
    car.since = 0;
    nextLane.cars.push(car);
    node.nextFree.set(lane.id, run.t + gap);
    return turn;
  };

  // Can this approach's front car go now?
  const controllers = {
    giveway(node, ready) {
      if (run.t < node.busyUntil) return;
      // First come, first served, as at a four-way stop.
      let best = null;
      for (const r of ready) if (!best || r.car.since < best.car.since) best = r;
      if (!best) return;
      const turn = admit(node, best.lane, best.car, best.next, 0);
      node.busyUntil = run.t + GIVEWAY_GAP[turn];
    },

    lights(node, ready) {
      const since = run.t - node.phaseAt;
      if (node.green === null) {
        if (since >= ALL_RED) { node.green = 1 - node.lastGreen; node.phaseAt = run.t; }
      } else if (since >= MIN_GREEN) {
        // A car stuck behind a full street ahead isn't using its green.
        const going = (l) => {
          const head = l.cars[0];
          if (!head || head.hold > 0 || head.pos < l.len - SENSOR) return false;
          return head.pos < l.len - 0.01 || ready.some((r) => r.lane === l);
        };
        const used = node.incoming.some((l) => sideOf(l.heading) === node.green && going(l));
        const wanted = node.incoming.some((l) => sideOf(l.heading) !== node.green
          && l.cars.length && l.cars[0].pos >= l.len - 0.01);
        if (wanted && (!used || since >= MAX_GREEN)) {
          node.lastGreen = node.green;
          node.green = null;
          node.phaseAt = run.t;
        }
      }
      const green = node.green;
      const sinceGreen = run.t - node.phaseAt;
      for (const r of ready) {
        if (run.t < node.nextFree.get(r.lane.id)) continue;
        const turn = turnOf(r.lane.heading, r.next.heading);
        if (green === null) {
          // Amber: a left turner already waiting in the junction gets away.
          if (turn !== LEFT || r.car.sneaked || sideOf(r.lane.heading) !== node.lastGreen) continue;
          r.car.sneaked = true;
        } else {
          if (sideOf(r.lane.heading) !== green || sinceGreen < STARTUP) continue;
          const arrow = sinceGreen < STARTUP + LEAD;
          if (turn === LEFT && !arrow && opposingComing(node, r.lane, ready)) continue;
          if (turn !== LEFT && arrow && opposingTurnsLeft(node, r.lane)) continue;
        }
        admit(node, r.lane, r.car, r.next, LIGHTS_GAP[turn]);
      }
    },

    roundabout(node, ready) {
      node.circle = node.circle.filter((c) => run.t < c.at + c.sectors * c.per);
      for (const r of ready) {
        if (run.t < node.nextFree.get(r.lane.id)) continue;
        if (node.circle.length >= ROUNDABOUT_HOLD) return;
        const arm = (r.lane.heading + 2) % 4;
        // Give way to anything about to come round past this arm.
        const blocked = node.circle.some((c) => {
          const k = Math.floor((run.t - c.at) / c.per);
          const nextArm = (c.arm - (k + 1) + 8) % 4;
          const untilThere = c.at + (k + 1) * c.per - run.t;
          return nextArm === arm && nextArm !== c.exit && untilThere < ENTRY_GAP;
        });
        if (blocked) continue;
        const sectors = sectorsFor(admit(node, r.lane, r.car, r.next, ROUNDABOUT_GAP));
        node.circle.push({ arm, exit: r.next.heading, at: run.t, sectors, per: (r.car.hold - 0.5) / sectors });
      }
    },

    flyover(node, ready) {
      let under = null;
      for (const r of ready) {
        if (run.t < node.nextFree.get(r.lane.id)) continue;
        const turn = turnOf(r.lane.heading, r.next.heading);
        if (turn === STRAIGHT && sideOf(r.lane.heading) === node.axis) admit(node, r.lane, r.car, r.next, FLYOVER_STRAIGHT_GAP);
        else if (turn === RIGHT) admit(node, r.lane, r.car, r.next, SLIP_GAP);
        else if (!under || r.car.since < under.car.since) under = r;
      }
      // Under the deck it's a give-way: one at a time, first come first served.
      if (under && run.t >= node.busyUntil) {
        const turn = admit(node, under.lane, under.car, under.next, 0);
        node.busyUntil = run.t + UNDER_GAP[turn];
      }
    },

    bend(node, ready) {
      for (const r of ready) {
        if (run.t < node.nextFree.get(r.lane.id)) continue;
        admit(node, r.lane, r.car, r.next, 0.8);
      }
    },
  };

  /* Whether the car at the front facing this lane is waiting to turn left across it. */
  function opposingTurnsLeft(node, lane) {
    const opposite = node.incoming.find((l) => l.heading === (lane.heading + 2) % 4);
    const head = opposite?.cars[0];
    if (!head || head.hold > 0 || head.pos < opposite.len - 0.01) return false;
    const next = lanes[head.path[head.ri + 1]];
    return !!next && turnOf(opposite.heading, next.heading) === LEFT;
  }

  /* A left turn waits for oncoming traffic: a car on its way to the line, or one
     at it that's free to go. One stuck behind a full street isn't coming. */
  function opposingComing(node, lane, ready) {
    const opposite = node.incoming.find((l) => l.heading === (lane.heading + 2) % 4);
    if (!opposite || !opposite.cars.length) return false;
    const head = opposite.cars[0];
    if (head.hold > 0 || head.pos < opposite.len - 30) return false;
    if (head.pos < opposite.len - 0.01) return true;
    return ready.some((r) => r.lane === opposite);
  }

  run.step = function step() {
    if (run.done) return;
    const t = run.t;

    // New trips join the queue at their way onto the plate.
    while (run.next < trips.length && trips[run.next].t <= t) {
      const trip = trips[run.next++];
      sources.get(trip.path[0]).push(trip);
    }
    for (const [laneId, queue] of sources) {
      const lane = lanes[laneId];
      if (queue.length && tailRoom(lane)) {
        const trip = queue.shift();
        lane.cars.push({
          path: trip.path, ri: 0, lane: laneId, pos: 0, hold: 0, waiting: 0, since: 0,
          trip, tone: trip.tone, crossing: null, id: trip.id,
          kind: trip.id % TRUCK_EVERY === TRUCK_EVERY - 1 ? 'truck' : 'car',
        });
        run.cars++;
      }
    }

    // Move everyone along: the front car up to its stop line, the rest up to the car ahead.
    for (const lane of lanes) {
      const cars = lane.cars;
      const ring = nodes.get(lane.to)?.type === 'roundabout';
      let stopped = 0;
      let moving = 0;
      let flowing = 0;
      let held = 0;
      for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        const counts = !car.trip.patrol;
        if (car.hold > 0) { car.hold -= DT; moving++; if (counts) flowing++; continue; }
        const limit = i === 0 ? lane.len : cars[i - 1].pos - CAR_GAP;
        const before = car.pos;
        // Coming up to a roundabout, cars ease off to roll on rather than stop.
        const speed = ring && car.pos > lane.len - RING_SLOW ? RING_SPEED : lane.speed;
        car.pos = Math.max(car.pos, Math.min(car.pos + speed * DT, limit));
        const moved = car.pos - before;
        // Heat and flow are about the rush, so town vehicles don't count towards either.
        if (moved < speed * DT * 0.25) { car.waiting += DT; if (counts) { stopped++; held++; } } else { moving++; car.waiting = 0; if (counts) flowing++; }
      }
      // Heat is the share of the street taken up by a standing queue; cars that
      // can't even get onto the plate count too.
      const backlog = lane.portal === 'in' ? sources.get(lane.id).length : 0;
      // Cars that can't even get onto the plate are waiting too.
      run.movingTime += flowing * DT;
      run.waitingTime += (held + backlog) * DT;
      const raw = Math.min(1, stopped / Math.max(5, lane.cap) + backlog / 6);
      lane.heat += (raw - lane.heat) * (DT / HEAT_LAG);
      if (lane.heat > lane.peak) lane.peak = lane.heat;
      if (lane.peak > run.peakHeat) run.peakHeat = lane.peak;
    }

    // Leaving the plate.
    for (const lane of lanes) {
      if (lane.portal !== 'out') continue;
      while (lane.cars.length && lane.cars[0].pos >= lane.len - 0.01 && lane.cars[0].hold <= 0) {
        lane.cars.shift();
        run.arrived++;
        run.cars--;
      }
    }

    // Each junction lets across whoever it can.
    for (const node of nodes.values()) {
      const ready = [];
      for (const lane of node.incoming) {
        const car = lane.cars[0];
        if (!car || car.hold > 0 || car.pos < lane.len - 0.01) continue;
        if (!car.since) car.since = t;
        const next = lanes[car.path[car.ri + 1]];
        if (next && (node.type === 'roundabout' ? ringRoom(next) : tailRoom(next))) ready.push({ lane, car, next });
      }
      // Town vehicles slip across without taking a turn, so they never hold up the rush.
      const rush = [];
      for (const r of ready) {
        if (r.car.trip.patrol) admit(node, r.lane, r.car, r.next, 0);
        else rush.push(r);
      }
      // Lights keep their own time, so they're asked even when no one's ready.
      if (rush.length || node.type === 'lights') controllers[node.type](node, rush);
    }

    run.t = t + DT;
    const allIn = run.next >= trips.length && [...sources.values()].every((q) => q.length === 0);
    if ((allIn && run.cars === 0) || run.t >= RUSH + DRAIN) run.done = true;
  };

  return run;
}

/* Each patrol starts part way along its own street inside town and has a long,
   fixed wander planned: at every junction it carries on another way, never back
   the way it came and never out of town, so the same day always plays the same. */
function placePatrols(lanes, net, seed) {
  const rand = rng(seed * 7919 + 11);
  const inside = lanes.filter((l) => !l.portal);
  if (!inside.length) return;
  const taken = new Set();
  PATROLS.forEach((kind, i) => {
    let lane = inside[Math.floor(rand() * inside.length)];
    for (let k = 0; taken.has(lane.id) && k < inside.length; k++) lane = inside[(lane.id + k + 1) % inside.length] ?? inside[0];
    taken.add(lane.id);
    const path = [lane.id];
    let at = lane;
    for (let step = 0; step < PATROL_TURNS; step++) {
      const ways = (net.outOf.get(at.to) ?? []).filter((n) => !n.portal);
      const onward = ways.filter((n) => n.to !== at.from);
      const choices = onward.length ? onward : ways;
      if (!choices.length) break;
      at = lanes[choices[Math.floor(rand() * choices.length)].id];
      path.push(at.id);
    }
    lane.cars.push({
      path, ri: 0, lane: lane.id, pos: lane.len * (0.3 + 0.4 * rand()), hold: 0, waiting: 0, since: 0,
      trip: { patrol: true, t: 0, free: Infinity }, tone: i % 5, crossing: null, id: -1 - i, kind,
    });
  });
}

function sectorsFor(turn) {
  return turn === RIGHT ? 1 : turn === STRAIGHT ? 2 : 3;
}

/* ------------------------------------------------------------------
   Scoring.
------------------------------------------------------------------ */

/* A day is cleared when every car gets through, and perfect when no street goes red
   on the way. When a day is made, doing nothing must leave far more stuck: at most
   this share through, so the first try is never nearly there. */
export const CLEAR_SHARE = 0.9;
export const RED = 0.7;          // heat at which a street shows red

/* A car still out there is stuck once it's well past the time its trip takes
   on empty streets; one that set off lately and is on its way is fine. */
const lateBy = (trip, t) => t - trip.t - (trip.free * 1.5 + 12);

/** Cars running badly late: on the plate, or still waiting to get onto it. */
export function stuckCars(run) {
  let stuck = 0;
  for (const lane of run.lanes) for (const car of lane.cars) if (lateBy(car.trip, run.t) > 0) stuck++;
  for (const queue of run.sources.values()) for (const trip of queue) if (lateBy(trip, run.t) > 0) stuck++;
  return stuck;
}

/** How a finished run went. */
export function scoreRun(run) {
  const stuck = stuckCars(run);
  const cleared = run.total ? 1 - stuck / run.total : 1;
  const perfect = stuck === 0 && run.peakHeat < RED;
  const timed = run.movingTime + run.waitingTime;
  return {
    cleared,
    stuck,
    // The share of the time rush-hour cars spent moving rather than waiting.
    flow: timed ? run.movingTime / timed : 1,
    peak: run.peakHeat,
    perfect,
    solved: stuck === 0,
    time: run.t,
  };
}

/** Plays a whole run without drawing it. */
export function simulate(city, net, trips, junctions) {
  const run = createRun(city, net, trips, junctions);
  while (!run.done) run.step();
  return scoreRun(run);
}

export function costOf(junctions) {
  return Object.values(junctions).reduce((sum, type) => sum + COST[type], 0);
}
