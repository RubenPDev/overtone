/* ============================================================
   Junctions — the city.

   Every day's city is grown from its puzzle number: a lattice of streets
   with a few links knocked out, a highway coming in on one side and
   leaving on another, and a handful of streets running off the plate
   into the rest of town. Everything is in metres, on a flat plane with
   x running east and y running south.
   ============================================================ */

/** A small, fast, seeded generator, so a seed always grows the same city. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const COLS = 4;
export const ROWS = 4;
export const SPACING = 64;   // between junctions
export const MARGIN = 38;    // from the outer junctions to the plate's edge
export const ROAD_W = 18;    // a two-way street; the highway is wider
export const HIGHWAY_W = 20;
export const SIZE = SPACING * (COLS - 1) + MARGIN * 2;

/* Headings, and the way out from a junction in each: north, east, south, west. */
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

const nodeId = (c, r) => r * COLS + c;

/**
 * The street plan. `nodes` are the lattice points that still have streets
 * (junctions, where three or four meet, and bends, where two do); `portals`
 * are where streets leave the plate; `roads` join any two of them.
 */
export function buildCity(seed) {
  const rand = rng(seed * 7919 + 17);
  const pick = (list) => list[Math.floor(rand() * list.length)];

  const nodes = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      nodes.push({ id: nodeId(c, r), c, r, x: MARGIN + c * SPACING, y: MARGIN + r * SPACING, links: [null, null, null, null] });
    }
  }

  // Every lattice link to begin with, then knock a few out.
  const links = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1) links.push([nodeId(c, r), nodeId(c + 1, r), 1]);
      if (r < ROWS - 1) links.push([nodeId(c, r), nodeId(c, r + 1), 2]);
    }
  }
  const live = new Set(links.map((_, i) => i));
  const degree = (id) => links.filter((l, i) => live.has(i) && (l[0] === id || l[1] === id)).length;
  const connected = () => {
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) {
      const id = stack.pop();
      links.forEach((l, i) => {
        if (!live.has(i)) return;
        const other = l[0] === id ? l[1] : l[1] === id ? l[0] : null;
        if (other !== null && !seen.has(other)) { seen.add(other); stack.push(other); }
      });
    }
    return seen.size === nodes.length;
  };
  const cuts = 3 + Math.floor(rand() * 3);
  for (let tries = 0, done = 0; done < cuts && tries < 60; tries++) {
    const i = Math.floor(rand() * links.length);
    if (!live.has(i)) continue;
    live.delete(i);
    const [a, b] = links[i];
    if (degree(a) < 2 || degree(b) < 2 || !connected()) live.add(i);
    else done++;
  }

  // Ways off the plate: one per outer junction side, from which a few are opened.
  const exits = [];
  for (const n of nodes) {
    if (n.r === 0) exits.push([n.id, 0]);
    if (n.c === COLS - 1) exits.push([n.id, 1]);
    if (n.r === ROWS - 1) exits.push([n.id, 2]);
    if (n.c === 0) exits.push([n.id, 3]);
  }
  // The highway comes in on one side and leaves on another, never the same one.
  const inSide = Math.floor(rand() * 4);
  const outSide = (inSide + 1 + Math.floor(rand() * 3)) % 4;
  const middle = (side) => exits.filter(([id, h]) => h === side && isMiddle(nodes[id], side));
  const onRamp = pick(middle(inSide));
  const offRamp = pick(middle(outSide));
  const taken = new Set([onRamp, offRamp].map(([id, h]) => `${id}:${h}`));
  const streets = [];
  const want = 3 + Math.floor(rand() * 3);
  for (let tries = 0; streets.length < want && tries < 80; tries++) {
    const e = pick(exits);
    const key = `${e[0]}:${e[1]}`;
    if (taken.has(key)) continue;
    // A corner taking two ways off looks like a spill; keep them apart.
    if ([...taken].some((k) => k.split(':')[0] === String(e[0]))) continue;
    taken.add(key);
    streets.push(e);
  }

  const portals = [];
  const addPortal = ([id, h], kind) => {
    const n = nodes[id];
    const p = { id: nodes.length + portals.length, kind, heading: h, x: n.x + DX[h] * MARGIN, y: n.y + DY[h] * MARGIN, node: id };
    portals.push(p);
    return p;
  };
  const entrance = addPortal(onRamp, 'entrance');
  const exit = addPortal(offRamp, 'exit');
  const streetPortals = streets.map((e) => addPortal(e, 'street'));

  const roads = [];
  for (const i of live) {
    const [a, b, h] = links[i];
    roads.push({ a, b, heading: h, width: ROAD_W });
    nodes[a].links[h] = b;
    nodes[b].links[(h + 2) % 4] = a;
  }
  for (const p of portals) {
    roads.push({ a: p.node, b: p.id, heading: p.heading, width: p.kind === 'street' ? ROAD_W : HIGHWAY_W, portal: p.kind });
    nodes[p.node].links[p.heading] = p.id;
  }

  for (const n of nodes) {
    const ways = n.links.filter((l) => l !== null).length;
    n.kind = ways >= 3 ? 'junction' : 'bend';
  }

  const { lots, buildings, trees } = buildBlocks(nodes, live, links, rand);
  return { seed, nodes, portals, roads, entrance, exit, streetPortals, lots, buildings, trees };
}

function isMiddle(n, side) {
  return side % 2 === 0 ? n.c > 0 && n.c < COLS - 1 : n.r > 0 && n.r < ROWS - 1;
}

/**
 * What fills the spaces between streets. Each space is a lot with a pavement
 * round it: each lattice cell is one, a missing street lets two run together,
 * and the rim round the outside is a row of smaller ones. Inside the town the
 * lots take blocks of flats or now and then a park; round the rim, houses; in
 * the corners, a few trees.
 */
function buildBlocks(nodes, live, links, rand) {
  const lots = [];
  const buildings = [];
  const trees = [];
  const roadAt = new Set([...live].map((i) => `${links[i][0]}-${links[i][1]}`));
  const has = (a, b) => roadAt.has(`${Math.min(a, b)}-${Math.max(a, b)}`);
  const half = ROAD_W / 2 + 1;
  const INSET = 2.5; // pavement between a lot's edge and what stands on it

  const grove = (x0, y0, x1, y1, count) => {
    for (let i = 0; i < count; i++) {
      trees.push({ x: x0 + 4 + rand() * (x1 - x0 - 8), y: y0 + 4 + rand() * (y1 - y0 - 8), r: 2.4 + rand() * 1.4 });
    }
  };

  const place = (x0, y0, x1, y1, type, height) => {
    buildings.push({
      x0, y0, x1, y1, type, height,
      tone: Math.floor(rand() * 6),
      accent: Math.floor(rand() * 4),
      chimney: rand() < 0.5,
      extras: rand(), // where rooftop odds and ends go
    });
  };

  const fill = (x0, y0, x1, y1, kind) => {
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 8 || h < 8) return;
    if (kind === 'town' && rand() < 0.2) {
      lots.push({ x0, y0, x1, y1, park: true });
      grove(x0 + INSET, y0 + INSET, x1 - INSET, y1 - INSET, 4 + Math.floor(rand() * 4));
      return;
    }
    lots.push({ x0, y0, x1, y1 });
    const bx0 = x0 + INSET;
    const by0 = y0 + INSET;
    const bw = w - INSET * 2;
    const bh = h - INSET * 2;

    if (kind === 'rim') {
      // A row of houses, each standing back a little on its own plot.
      const alongX = bw >= bh;
      const long = alongX ? bw : bh;
      const parts = Math.max(1, Math.round(long / 16));
      const span = long / parts;
      for (let i = 0; i < parts; i++) {
        const a0 = (alongX ? bx0 : by0) + i * span + 1.5;
        const a1 = (alongX ? bx0 : by0) + (i + 1) * span - 1.5;
        if (alongX) place(a0, by0 + 1.5, a1, by0 + bh - 1.5, 'house', 4 + rand() * 1.5);
        else place(bx0 + 1.5, a0, bx0 + bw - 1.5, a1, 'house', 4 + rand() * 1.5);
      }
      return;
    }

    // In town, a grid of plots of about twenty metres, each its own building or a few trees.
    const cols = Math.max(1, Math.round(bw / 20));
    const rows = Math.max(1, Math.round(bh / 20));
    const pw = bw / cols;
    const ph = bh / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px0 = bx0 + c * pw + 1.5;
        const py0 = by0 + r * ph + 1.5;
        const px1 = bx0 + (c + 1) * pw - 1.5;
        const py1 = by0 + (r + 1) * ph - 1.5;
        const roll = rand();
        if (roll < 0.3) {
          // A tower stands in the middle of its plot.
          const m = Math.min(px1 - px0, py1 - py0) * 0.18;
          place(px0 + m, py0 + m, px1 - m, py1 - m, 'tower', 16 + rand() * 10);
        } else if (roll < 0.62) place(px0, py0, px1, py1, 'flats', 8 + rand() * 6);
        else if (roll < 0.8) place(px0, py0, px1, py1, 'shop', 4.5 + rand());
        else if (roll < 0.9) place(px0 + 2, py0 + 2, px1 - 2, py1 - 2, 'house', 4.5 + rand());
        else grove(px0, py0, px1, py1, 2 + Math.floor(rand() * 2));
      }
    }
  };

  // Interior cells; a cell whose dividing street is gone merges with its neighbour.
  const merged = new Set();
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      if (merged.has(`${c},${r}`)) continue;
      let c1 = c + 1;
      let r1 = r + 1;
      const a = nodeId(c + 1, r);
      const b = nodeId(c + 1, r + 1);
      if (c + 2 < COLS && !has(a, b) && !merged.has(`${c + 1},${r}`)) { merged.add(`${c + 1},${r}`); c1 = c + 2; }
      else {
        const d = nodeId(c, r + 1);
        if (r + 2 < ROWS && !has(d, b) && !merged.has(`${c},${r + 1}`)) { merged.add(`${c},${r + 1}`); r1 = r + 2; }
      }
      fill(MARGIN + c * SPACING + half, MARGIN + r * SPACING + half, MARGIN + c1 * SPACING - half, MARGIN + r1 * SPACING - half, 'town');
    }
  }

  // The rim, between the outer streets and the plate's edge, and its corners.
  const edge = 4;
  const inner = MARGIN - half;
  for (let c = 0; c < COLS - 1; c++) {
    const x0 = MARGIN + c * SPACING + half;
    const x1 = MARGIN + (c + 1) * SPACING - half;
    fill(x0, edge, x1, inner, 'rim');
    fill(x0, SIZE - inner, x1, SIZE - edge, 'rim');
  }
  for (let r = 0; r < ROWS - 1; r++) {
    const y0 = MARGIN + r * SPACING + half;
    const y1 = MARGIN + (r + 1) * SPACING - half;
    fill(edge, y0, inner, y1, 'rim');
    fill(SIZE - inner, y0, SIZE - edge, y1, 'rim');
  }
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const x0 = cx ? SIZE - inner : edge + 6;
    const y0 = cy ? SIZE - inner : edge + 6;
    const x1 = cx ? SIZE - edge - 6 : inner;
    const y1 = cy ? SIZE - edge - 6 : inner;
    grove(x0, y0, x1, y1, 2);
  }
  return { lots, buildings, trees };
}
