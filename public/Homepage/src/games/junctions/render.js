/* ============================================================
   Junctions — drawing the city.

   A little diorama: a tile of grass with earth showing at its edges,
   streets laid across it, and a town of soft, simple buildings that cast
   soft shadows. It's seen from the south-east corner, tilted like Facet's
   board, and drawn on a canvas so a few hundred cars stay smooth. Anything
   that never changes is drawn once and copied after that.
   ============================================================ */

import { DX, DY, HIGHWAY_W, ROAD_W, SIZE } from './city.js';
import { JUNCTION_R, RED } from './sim.js';

const TILT = (52 * Math.PI) / 180;
const COS_T = Math.cos(TILT);
const SIN_T = Math.sin(TILT);
const PLATE_DEPTH = 9;
const TALLEST = 30;                // room left above the plate for the tallest tower
const ROAD_TOP = 0.4;
const LOT_TOP = 0.7;               // the kerb: lots stand a little above the street
const ROUNDABOUT_R = ROAD_W * 0.58;
const BRIDGE_H = 4.4;              // the deck's height over the road it crosses
const BRIDGE_REACH = ROAD_W * 1.9; // from the junction's centre to where each ramp meets the road
const BRIDGE_FLAT = ROAD_W / 2 + 2;
const HEAT_W = 2.8;                // the coloured stripe down the middle of each lane
const SUN = [0.5, 0.2];            // which way shadows fall, per metre of height

/* Cars are the site's candy, top and side. */
const CANDY = [
  ['#69ffd0', '#2fc4a0'],
  ['#ff9c9f', '#ec6f78'],
  ['#9cc4ff', '#6f93e0'],
  ['#ffe66a', '#efb03e'],
  ['#d68cff', '#a765dc'],
];
/* The town is softer: plaster walls, coloured roofs, tinted glass. */
const WALLS = ['#fff3e3', '#ffd9c7', '#cfe2f7', '#d7f0c8', '#ecd6f5', '#ffeab0'];
const ROOFS = ['#ef8f7f', '#7fa9cf', '#6cc2a9', '#c890bf'];
const GLASS = ['#a9d8ee', '#a7e6d2', '#bccbf5', '#c9e3f2'];
const AWNINGS = ['#ff9c9f', '#69d6b4', '#9cc4ff', '#ffd36a'];
const LEAVES = ['#8fd9a0', '#a8df8a', '#73cdb0'];

/* Heat runs mint, butter, then orange as a street fills. Red is kept for a street
   that has actually jammed, so it means the same on the board as in the score. */
const HEAT = [[63, 211, 174], [255, 216, 90], [255, 166, 77]];
const JAMMED = [255, 92, 108];
function heatColour(h) {
  const u = h / RED;
  if (u >= 1) return `rgb(${JAMMED.join(',')})`;
  const [a, b] = u < 0.5 ? [HEAT[0], HEAT[1]] : [HEAT[1], HEAT[2]];
  const f = u < 0.5 ? Math.max(0, u) * 2 : (u - 0.5) * 2;
  // Clear streets sit back a little; the warmer a street gets, the more it shows.
  return `rgba(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(',')},${(0.62 + Math.min(1, u) * 0.38).toFixed(2)})`;
}

/* ---------- colour ---------- */

function rgbOf(c) {
  if (c.startsWith('#')) return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const m = c.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
function mix(a, b, t) {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
}

function toHsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h / 6, s, l];
}
function fromHsl([h, s, l]) {
  const f = (n) => {
    const k2 = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k2 - 3, 9 - k2, 1))));
  };
  return `rgb(${f(0)},${f(8)},${f(4)})`;
}

function readTheme(el) {
  const css = getComputedStyle(el);
  const v = (name) => css.getPropertyValue(name).trim();
  const dim = parseFloat(v('--jn-dim')) || 0;
  const shade = v('--jn-shade');
  // In the evening a colour keeps its hue but gets darker and a little dustier: a
  // pastel darkened at full strength would turn neon.
  const evening = (c) => {
    const [h, s, l] = toHsl(rgbOf(c));
    return fromHsl([h, s * 0.58, l * (1 - dim)]);
  };
  // A colour toned for the theme, with the shades of its lit and shaded sides.
  const tint = (c) => {
    const t = dim ? evening(c) : c;
    return { top: t, left: mix(t, shade, 0.16), right: mix(t, shade, 0.34), base: mix(t, shade, 0.3) };
  };
  return {
    tint,
    grass: v('--jn-grass'), grass2: v('--jn-grass-2'), grassSide: v('--jn-grass-side'),
    soil: v('--jn-soil'), soil2: v('--jn-soil-2'),
    road: v('--jn-road'), roadSide: v('--jn-road-side'), mark: v('--jn-mark'),
    walk: v('--jn-walk'), walkSide: v('--jn-walk-side'),
    bridge: v('--jn-bridge'), bridgeSide: v('--jn-bridge-side'),
    glass: v('--jn-glass'), window: v('--jn-window'), frame: v('--jn-frame'), trunk: v('--jn-trunk'),
    castShadow: v('--jn-cast'), unit: v('--jn-unit'),
    shadow: v('--shadow'), ink: v('--ink'), ink3: v('--ink-3'), sheet: v('--sheet'),
  };
}

function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper = [];
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function createRenderer(canvas, day) {
  const screen = canvas.getContext('2d');
  let ctx = screen; // the shape helpers draw here; cached pieces are drawn offscreen
  const { city, net } = day;
  const points = net.points;
  let theme = readTheme(canvas);
  let k = 1;
  let ox = 0;
  let oy = 0;
  let dpr = 1;
  let ground = null;
  const sprites = new Map();

  const P = (x, y, z = 0) => {
    const u = (x - y) / Math.SQRT2;
    const v = (x + y - SIZE) / Math.SQRT2;
    return [ox + u * k, oy + v * k * COS_T - z * k * SIN_T];
  };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // On a wide screen the whole plate shows. On a narrow one the board fits to its
    // streets instead, so they're as big as they can be; the plate's corners, with
    // only houses and trees on them, can run off the edges.
    const narrow = w < 600;
    const focus = narrow
      ? [
        ...city.nodes.flatMap((n) => [[n.x - ROAD_W, n.y - ROAD_W], [n.x + ROAD_W, n.y + ROAD_W], [n.x + ROAD_W, n.y - ROAD_W], [n.x - ROAD_W, n.y + ROAD_W]]),
        ...city.portals.map((p) => [p.x + DX[p.heading] * 14, p.y + DY[p.heading] * 14]),
      ]
      : [[0, 0], [SIZE, 0], [SIZE, SIZE], [0, SIZE]];
    const us = focus.map(([x, y]) => (x - y) / Math.SQRT2);
    const vs = focus.map(([x, y]) => ((x + y - SIZE) / Math.SQRT2) * COS_T);
    const above = (narrow ? TALLEST * 0.6 : TALLEST) * SIN_T;
    const below = (narrow ? 0 : PLATE_DEPTH) * SIN_T;
    const across = Math.max(...us) - Math.min(...us);
    const tall = Math.max(...vs) - Math.min(...vs) + above + below;
    k = Math.min((w * (narrow ? 1 : 0.97)) / across, (h * 0.97) / tall);
    ox = w / 2 - ((Math.max(...us) + Math.min(...us)) / 2) * k;
    oy = h / 2 - ((Math.max(...vs) + Math.min(...vs)) / 2) * k + ((above - below) * k) / 2;
    ground = null;
    sprites.clear();
  }

  function setTheme() {
    theme = readTheme(canvas);
    ground = null;
    sprites.clear();
  }

  /* ---------- shapes ---------- */

  const path = (pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  const fill = (pts, colour) => { path(pts); ctx.fillStyle = colour; ctx.fill(); };
  const flat = (pts, z, colour) => fill(pts.map(([x, y]) => P(x, y, z)), colour);

  /** A wall, a little darker at its foot, as light settles. */
  function wall(pts, colour, foot) {
    path(pts);
    const top = Math.min(...pts.map((p) => p[1]));
    const bottom = Math.max(...pts.map((p) => p[1]));
    const g = ctx.createLinearGradient(0, bottom, 0, top);
    g.addColorStop(0, foot);
    g.addColorStop(0.35, colour);
    g.addColorStop(1, colour);
    ctx.fillStyle = g;
    ctx.fill();
  }

  /** A solid on the ground, any footprint: the sides that face the viewer, then its top. */
  function solid(pts, z0, z1, c) {
    const n = pts.length;
    const cx = pts.reduce((s, p) => s + p[0], 0) / n;
    const cy = pts.reduce((s, p) => s + p[1], 0) / n;
    const low = pts.map(([x, y]) => P(x, y, z0));
    const high = pts.map(([x, y]) => P(x, y, z1));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      let nx = pts[j][1] - pts[i][1];
      let ny = -(pts[j][0] - pts[i][0]);
      const mx = (pts[i][0] + pts[j][0]) / 2 - cx;
      const my = (pts[i][1] + pts[j][1]) / 2 - cy;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      if (nx + ny <= 0) continue;
      fill([low[i], low[j], high[j], high[i]], ny >= nx ? c.left : c.right);
    }
    fill(high, c.top);
  }

  /** An upright box: its south and east walls, its top, and a light edge along the top. */
  function box(x0, y0, x1, y1, z0, z1, c) {
    wall([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], c.left, mix(c.left, c.base, 0.6));
    wall([P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)], c.right, mix(c.right, c.base, 0.6));
    fill([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], c.top);
    ctx.beginPath();
    const a = P(x0, y1, z1); const b = P(x1, y1, z1); const d = P(x1, y0, z1);
    ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...d);
    ctx.strokeStyle = mix(c.top, '#ffffff', 0.5);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  function rounded(x0, y0, x1, y1, r, steps = 5) {
    const pts = [];
    const corners = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
    for (const [cx, cy, a0] of corners) {
      for (let i = 0; i <= steps; i++) {
        const a = ((a0 + (90 * i) / steps) * Math.PI) / 180;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    }
    return pts;
  }

  function circle(cx, cy, r, steps = 24) {
    return Array.from({ length: steps }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
  }

  function strip(x0, y0, x1, y1, w) {
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (-(y1 - y0) / len) * (w / 2);
    const ny = ((x1 - x0) / len) * (w / 2);
    return [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
  }

  /** Draws something that never changes into a canvas of its own once, then copies it. */
  function cached(key, reach, paint) {
    let s = sprites.get(key);
    if (!s) {
      const pts = reach.map(([x, y, z]) => P(x, y, z));
      const minX = Math.floor(Math.min(...pts.map((p) => p[0]))) - 3;
      const minY = Math.floor(Math.min(...pts.map((p) => p[1]))) - 3;
      const w = Math.ceil(Math.max(...pts.map((p) => p[0]))) + 3 - minX;
      const h = Math.ceil(Math.max(...pts.map((p) => p[1]))) + 3 - minY;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      const was = ctx;
      ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, -minX * dpr, -minY * dpr);
      paint();
      ctx = was;
      s = { c, minX, minY, w, h };
      sprites.set(key, s);
    }
    ctx.drawImage(s.c, s.minX, s.minY, s.w, s.h);
  }
  const boxReach = (x0, y0, x1, y1, z) => [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];

  /* ---------- the ground: the tile, its lots and streets, and shadows ---------- */

  const isNode = (p) => !!p.links;

  function drawGround() {
    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    ctx = off.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTile();
    drawStreets();
    drawLots();
    drawShadows();
    ctx = screen;
    ground = off;
  }

  /** Grass on top, a band of turf, then earth down to the bottom. */
  function drawTile() {
    const outline = rounded(0, 0, SIZE, SIZE, 24, 8);
    ctx.save();
    ctx.shadowColor = theme.shadow;
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 16;
    fill(outline.map(([x, y]) => P(x, y, -PLATE_DEPTH)), theme.soil2);
    ctx.restore();
    for (let z = -PLATE_DEPTH; z < 0; z += 0.5) {
      const colour = z >= -1.6 ? theme.grassSide : z >= -PLATE_DEPTH * 0.55 ? theme.soil : theme.soil2;
      fill(outline.map(([x, y]) => P(x, y, z)), colour);
    }
    const top = outline.map(([x, y]) => P(x, y, 0));
    path(top);
    const xs = top.map((p) => p[0]);
    const ys = top.map((p) => p[1]);
    const g = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    g.addColorStop(0, theme.grass);
    g.addColorStop(1, theme.grass2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  /** Each lot is a pavement kerb with grass inside it. */
  function drawLots() {
    const walk = { top: theme.walk, left: theme.walkSide, right: theme.walkSide };
    for (const lot of city.lots) {
      solid(rounded(lot.x0, lot.y0, lot.x1, lot.y1, 4), 0, LOT_TOP, walk);
      flat(rounded(lot.x0 + 2.2, lot.y0 + 2.2, lot.x1 - 2.2, lot.y1 - 2.2, 3), LOT_TOP + 0.01, lot.park ? theme.grass2 : theme.grass);
    }
  }

  function drawStreets() {
    const road = { top: theme.road, left: theme.roadSide, right: theme.roadSide };
    for (const r of city.roads) {
      const a = points[r.a];
      const b = points[r.b];
      solid(strip(a.x, a.y, b.x, b.y, r.width), 0, ROAD_TOP, road);
    }
    for (const n of city.nodes) {
      solid(rounded(n.x - ROAD_W / 2, n.y - ROAD_W / 2, n.x + ROAD_W / 2, n.y + ROAD_W / 2, 3), 0, ROAD_TOP, road);
    }
    // A soft dashed line down the middle of each street, short of the junctions.
    for (const r of city.roads) {
      const a = points[r.a];
      const b = points[r.b];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const start = isNode(a) ? JUNCTION_R + 3 : 0;
      const end = len - (isNode(b) ? JUNCTION_R + 3 : 0);
      for (let d = start; d < end - 2; d += 8) {
        const e = Math.min(end, d + 4);
        flat(strip(a.x + ux * d, a.y + uy * d, a.x + ux * e, a.y + uy * e, 0.7), ROAD_TOP + 0.01, theme.mark);
      }
    }
    // The highway's way in and out: a broad arrow painted on each.
    for (const p of [city.entrance, city.exit]) {
      const n = points[p.node];
      const h = p === city.entrance ? (p.heading + 2) % 4 : p.heading;
      const mx = (n.x + p.x) / 2 + DX[p.heading] * 4;
      const my = (n.y + p.y) / 2 + DY[p.heading] * 4;
      const nx = -DY[h];
      const ny = DX[h];
      const tip = [mx + DX[h] * 6, my + DY[h] * 6];
      flat([tip, [mx - DX[h] * 2 + nx * 5, my - DY[h] * 2 + ny * 5], [mx - DX[h] * 2 - nx * 5, my - DY[h] * 2 - ny * 5]], ROAD_TOP + 0.02, theme.mark);
    }
  }

  /** Each building's shadow, cast down and away from the light onto the ground. */
  function drawShadows() {
    for (const b of city.buildings) {
      const h = b.height + (b.type === 'house' ? 2.5 : b.type === 'tower' ? 2 : 0.5);
      const foot = rect(b.x0, b.y0, b.x1, b.y1);
      const cast = foot.map(([x, y]) => [x + SUN[0] * h, y + SUN[1] * h]);
      flat(hull([...foot, ...cast]), LOT_TOP + 0.02, theme.castShadow);
    }
  }

  /* ---------- lanes, and what's built at each junction ---------- */

  /* Which way a flyover's bridge runs: along the road that goes straight through
     (1 east-west, 0 north-south), east-west where both do. */
  const axisOf = (n) => (n.links[1] !== null && n.links[3] !== null ? 1 : 0);

  /** How high a flyover lifts a point on the road it carries; `axis` limits it to roads one way. */
  function rampZ(types, x, y, axis = null) {
    for (const n of city.nodes) {
      if (types[n.id] !== 'flyover') continue;
      const a = axisOf(n);
      if (axis !== null && axis !== a) continue;
      const along = a === 1 ? Math.abs(x - n.x) : Math.abs(y - n.y);
      const across = a === 1 ? Math.abs(y - n.y) : Math.abs(x - n.x);
      if (across > ROAD_W / 2 + 0.5 || along >= BRIDGE_REACH) continue;
      return along <= BRIDGE_FLAT ? BRIDGE_H : BRIDGE_H * (1 - (along - BRIDGE_FLAT) / (BRIDGE_REACH - BRIDGE_FLAT));
    }
    return 0;
  }

  function laneAt(lane, s) {
    const ux = (lane.x1 - lane.x0) / lane.len;
    const uy = (lane.y1 - lane.y0) / lane.len;
    return [lane.x0 + ux * s, lane.y0 + uy * s];
  }

  /* Each lane's colour, as a stripe down its middle; where it climbs a flyover,
     the deck draws it instead. Each stretch is one strip, so it has no seams. */
  function drawHeat(run, types, usePeak) {
    for (const lane of run.lanes) {
      const colour = heatColour(usePeak ? lane.peak : lane.heat);
      let from = null;
      for (let s = lane.offPlate; ; s += 1) {
        const end = s >= lane.len;
        const [x, y] = laneAt(lane, Math.min(s, lane.len));
        const onRamp = !end && rampZ(types, x, y, lane.heading % 2) > 0;
        if (from === null && !onRamp && !end) from = s;
        if (from !== null && (onRamp || end)) {
          const [x0, y0] = laneAt(lane, from);
          const [x1, y1] = laneAt(lane, Math.min(s, lane.len));
          flat(strip(x0, y0, x1, y1, HEAT_W), ROAD_TOP + 0.02, colour);
          from = null;
        }
        if (end) break;
      }
    }
  }

  /** Lights at each stop line, a roundabout's ring, and a soft hint where you can build. */
  function drawJunctions(run, types, hover) {
    for (const n of city.nodes) {
      if (n.kind !== 'junction') continue;
      const type = types[n.id] ?? 'giveway';
      const live = run?.nodes.get(n.id);
      if (type === 'roundabout') flat(circle(n.x, n.y, ROUNDABOUT_R + 4), ROAD_TOP + 0.03, theme.road);
      if (type === 'lights') {
        for (const l of net.lanes) {
          if (l.to !== n.id) continue;
          const ux = (l.x1 - l.x0) / l.len;
          const uy = (l.y1 - l.y0) / l.len;
          const w = ROAD_W / 4 - 0.8;
          const green = live ? live.green : 0;
          const colour = green === null ? '#ffd85a' : l.heading % 2 === green ? '#3fd3ae' : '#ff6f6f';
          flat(strip(l.x1 - uy * w, l.y1 + ux * w, l.x1 + uy * w, l.y1 - ux * w, 1.4), ROAD_TOP + 0.04, colour);
        }
      }
      if (!run && type === 'giveway') flat(circle(n.x, n.y, ROAD_W * 0.36, 28), ROAD_TOP + 0.04, `rgba(${rgbOf(theme.mark).join(',')},0.22)`);
      if (n.id === hover) {
        path(circle(n.x, n.y, ROAD_W * 0.6, 32).map(([x, y]) => P(x, y, ROAD_TOP + 0.05)));
        ctx.strokeStyle = theme.ink;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ---------- the town ---------- */

  /** A window: a pale frame with the glass set in it. On the south wall (y fixed) or the east (x fixed). */
  function windowAt(onSouth, at, a0, z0, w, h, glass = theme.window) {
    const q = (a, z) => (onSouth ? P(a, at, z) : P(at, a, z));
    fill([q(a0 - 0.18, z0 - 0.18), q(a0 + w + 0.18, z0 - 0.18), q(a0 + w + 0.18, z0 + h + 0.18), q(a0 - 0.18, z0 + h + 0.18)], theme.frame);
    fill([q(a0, z0), q(a0 + w, z0), q(a0 + w, z0 + h), q(a0, z0 + h)], glass);
  }

  function house(b) {
    const walls = theme.tint(WALLS[b.tone]);
    const roof = theme.tint(ROOFS[b.accent]);
    const { x0, y0, x1, y1, height: h } = b;
    const base = LOT_TOP;
    box(x0, y0, x1, y1, base, h, walls);
    // A door and windows on the south wall, a window or two on the east.
    const doorAt = x0 + (x1 - x0) * (0.3 + b.extras * 0.4) - 0.7;
    fill([P(doorAt, y1, base), P(doorAt + 1.4, y1, base), P(doorAt + 1.4, y1, base + 2.2), P(doorAt, y1, base + 2.2)], mix(roof.top, '#4a3a4a', 0.35));
    for (let x = x0 + 1.2; x < x1 - 2; x += 2.8) {
      if (Math.abs(x + 0.6 - (doorAt + 0.7)) < 1.8) continue;
      windowAt(true, y1, x, base + 1.4, 1.2, 1.2);
    }
    for (let y = y0 + 1.4; y < y1 - 2; y += 3) windowAt(false, x1, y, base + 1.4, 1.2, 1.2);

    const o = 0.9;
    const ze = h - 0.2;
    const fascia = mix(roof.right, '#000000', 0.08);
    if (x1 - x0 >= y1 - y0) {
      const m = (y0 + y1) / 2;
      const rise = Math.min(3.4, (y1 - y0) * 0.5);
      fill([P(x0 - o, y0 - o, ze), P(x1 + o, y0 - o, ze), P(x1 + o, m, h + rise), P(x0 - o, m, h + rise)], mix(roof.top, '#ffffff', 0.12));
      if (b.chimney) box(x0 + (x1 - x0) * 0.25, m - 1.8, x0 + (x1 - x0) * 0.25 + 1.2, m - 0.6, h, h + rise + 1, theme.tint('#d9a79a'));
      fill([P(x1, y0, ze), P(x1, y1, ze), P(x1, m, h + rise)], walls.right);
      fill([P(x0 - o, y1 + o, ze), P(x1 + o, y1 + o, ze), P(x1 + o, m, h + rise), P(x0 - o, m, h + rise)], roof.left);
      fill([P(x0 - o, y1 + o, ze), P(x1 + o, y1 + o, ze), P(x1 + o, y1 + o, ze - 0.35), P(x0 - o, y1 + o, ze - 0.35)], fascia);
      fill([P(x1 + o, y1 + o, ze), P(x1 + o, m, h + rise), P(x1 + o, m, h + rise - 0.35), P(x1 + o, y1 + o, ze - 0.35)], fascia);
    } else {
      const m = (x0 + x1) / 2;
      const rise = Math.min(3.4, (x1 - x0) * 0.5);
      fill([P(x0 - o, y0 - o, ze), P(x0 - o, y1 + o, ze), P(m, y1 + o, h + rise), P(m, y0 - o, h + rise)], mix(roof.top, '#ffffff', 0.12));
      if (b.chimney) box(m - 1.8, y0 + (y1 - y0) * 0.25, m - 0.6, y0 + (y1 - y0) * 0.25 + 1.2, h, h + rise + 1, theme.tint('#d9a79a'));
      fill([P(x0, y1, ze), P(x1, y1, ze), P(m, y1, h + rise)], walls.left);
      fill([P(x1 + o, y0 - o, ze), P(x1 + o, y1 + o, ze), P(m, y1 + o, h + rise), P(m, y0 - o, h + rise)], roof.right);
      fill([P(x1 + o, y0 - o, ze), P(x1 + o, y1 + o, ze), P(x1 + o, y1 + o, ze - 0.35), P(x1 + o, y0 - o, ze - 0.35)], fascia);
      fill([P(x1 + o, y1 + o, ze), P(m, y1 + o, h + rise), P(m, y1 + o, h + rise - 0.35), P(x1 + o, y1 + o, ze - 0.35)], fascia);
    }
  }

  /** Small boxes on a flat roof: plant, a stair head, a water tank. */
  function rooftop(b, x0, y0, x1, y1, z) {
    const unit = theme.tint(theme.unit);
    const w = x1 - x0;
    const d = y1 - y0;
    const ax = x0 + w * (0.2 + b.extras * 0.3);
    const ay = y0 + d * 0.25;
    box(ax, ay, ax + Math.min(3, w * 0.25), ay + Math.min(2.4, d * 0.25), z, z + 1.4, unit);
    if (b.extras > 0.4) {
      const bx = x0 + w * 0.62;
      const by = y0 + d * (0.45 + b.extras * 0.2);
      box(bx, by, bx + Math.min(2.2, w * 0.2), by + Math.min(2.2, d * 0.2), z, z + 1.1, unit);
    }
  }

  function flats(b) {
    const walls = theme.tint(WALLS[b.tone]);
    const { x0, y0, x1, y1, height: h } = b;
    const base = LOT_TOP;
    box(x0, y0, x1, y1, base, h, walls);
    // A ribbon of windows along each floor, and a glass door at the foot.
    const band = (onSouth, a0, a1, z) => {
      const q = (a, zz) => (onSouth ? P(a, y1, zz) : P(x1, a, zz));
      fill([q(a0, z), q(a1, z), q(a1, z + 1.3), q(a0, z + 1.3)], theme.window);
      ctx.strokeStyle = theme.frame;
      ctx.lineWidth = 0.8;
      for (let a = a0 + 2.6; a < a1 - 0.5; a += 2.6) {
        ctx.beginPath(); ctx.moveTo(...q(a, z)); ctx.lineTo(...q(a, z + 1.3)); ctx.stroke();
      }
    };
    for (let z = base + 3.4; z < h - 1.6; z += 3.2) {
      band(true, x0 + 1.2, x1 - 1.2, z);
      band(false, y0 + 1.2, y1 - 1.2, z);
    }
    const mid = (x0 + x1) / 2;
    fill([P(mid - 1.2, y1, base), P(mid + 1.2, y1, base), P(mid + 1.2, y1, base + 2.4), P(mid - 1.2, y1, base + 2.4)], theme.glass);
    // A parapet round a slightly sunken roof, with plant on it.
    flat(rect(x0 + 0.7, y0 + 0.7, x1 - 0.7, y1 - 0.7), h, mix(walls.top, '#000000', 0.05));
    rooftop(b, x0 + 0.7, y0 + 0.7, x1 - 0.7, y1 - 0.7, h);
  }

  function tower(b) {
    const glass = theme.tint(GLASS[b.tone % GLASS.length]);
    const trim = theme.tint(WALLS[b.tone]);
    const { x0, y0, x1, y1, height: h } = b;
    const base = LOT_TOP;
    // A plaster ground floor, glass above, and floor lines across the glass.
    box(x0, y0, x1, y1, base, base + 3, trim);
    box(x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3, base + 3, h, glass);
    ctx.strokeStyle = `rgba(255,255,255,0.45)`;
    ctx.lineWidth = 0.7;
    for (let z = base + 6; z < h - 0.5; z += 3.2) {
      ctx.beginPath();
      ctx.moveTo(...P(x0 + 0.3, y1 - 0.3, z)); ctx.lineTo(...P(x1 - 0.3, y1 - 0.3, z)); ctx.lineTo(...P(x1 - 0.3, y0 + 0.3, z));
      ctx.stroke();
    }
    for (let x = x0 + 3; x < x1 - 1; x += 3) {
      ctx.beginPath(); ctx.moveTo(...P(x, y1 - 0.3, base + 3)); ctx.lineTo(...P(x, y1 - 0.3, h)); ctx.stroke();
    }
    for (let y = y0 + 3; y < y1 - 1; y += 3) {
      ctx.beginPath(); ctx.moveTo(...P(x1 - 0.3, y, base + 3)); ctx.lineTo(...P(x1 - 0.3, y, h)); ctx.stroke();
    }
    fill([P((x0 + x1) / 2 - 1.3, y1, base), P((x0 + x1) / 2 + 1.3, y1, base), P((x0 + x1) / 2 + 1.3, y1, base + 2.4), P((x0 + x1) / 2 - 1.3, y1, base + 2.4)], theme.glass);
    // A crown on top, and on some a mast.
    box(x0 + 1.4, y0 + 1.4, x1 - 1.4, y1 - 1.4, h, h + 2, trim);
    rooftop(b, x0 + 2, y0 + 2, x1 - 2, y1 - 2, h + 2);
    if (b.extras > 0.55) {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      ctx.strokeStyle = trim.right;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(...P(cx, cy, h + 2)); ctx.lineTo(...P(cx, cy, h + 7)); ctx.stroke();
      const [tx, ty] = P(cx, cy, h + 7);
      ctx.fillStyle = '#ff8a8a';
      ctx.beginPath(); ctx.arc(tx, ty, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function shop(b) {
    const walls = theme.tint(WALLS[b.tone]);
    const { x0, y0, x1, y1, height: h } = b;
    const base = LOT_TOP;
    box(x0, y0, x1, y1, base, h, walls);
    // Shop windows under a striped awning along the front.
    fill([P(x0 + 1, y1, base + 0.5), P(x1 - 1, y1, base + 0.5), P(x1 - 1, y1, base + 2.8), P(x0 + 1, y1, base + 2.8)], theme.window);
    for (let y = y0 + 1.5; y < y1 - 2; y += 3.4) windowAt(false, x1, y, base + 1.2, 1.8, 1.6);
    const stripe = theme.tint(AWNINGS[b.accent]);
    const white = theme.tint('#ffffff');
    const step = 1.3;
    let i = 0;
    for (let x = x0 + 0.6; x < x1 - 0.6; x += step, i++) {
      const e = Math.min(x1 - 0.6, x + step);
      fill([P(x, y1, base + 3.6), P(e, y1, base + 3.6), P(e, y1 + 1.8, base + 2.9), P(x, y1 + 1.8, base + 2.9)], i % 2 ? white.top : stripe.top);
      fill([P(x, y1 + 1.8, base + 2.9), P(e, y1 + 1.8, base + 2.9), P(e, y1 + 1.8, base + 2.4), P(x, y1 + 1.8, base + 2.4)], i % 2 ? white.left : stripe.left);
    }
    flat(rect(x0 + 0.6, y0 + 0.6, x1 - 0.6, y1 - 0.6), h, mix(walls.top, '#000000', 0.05));
    rooftop(b, x0 + 0.6, y0 + 0.6, x1 - 0.6, y1 - 0.6, h);
  }

  const BUILD = { house, flats, tower, shop };

  /** A tree: round and leafy, or every third one a pine. */
  function tree(t, i, base = LOT_TOP) {
    const [sx, sy] = P(t.x + 1.4, t.y + 0.6, base);
    ctx.fillStyle = theme.castShadow;
    ctx.beginPath();
    ctx.ellipse(sx, sy, t.r * k * 1.2, t.r * k * 1.2 * COS_T, 0, 0, Math.PI * 2);
    ctx.fill();
    const trunk = theme.tint(theme.trunk);
    solid(rect(t.x - 0.45, t.y - 0.45, t.x + 0.45, t.y + 0.45), base, base + t.r * 0.9, trunk);
    const leaf = theme.tint(LEAVES[i % LEAVES.length]);
    if (i % 3 === 0) {
      // Two stacked cones, lit on the left.
      for (const [r, z0, z1] of [[t.r * 1.25, base + t.r * 0.6, base + t.r * 2.6], [t.r * 0.9, base + t.r * 1.7, base + t.r * 3.4]]) {
        const [cx, cy] = P(t.x, t.y, z0);
        const [ax, ay] = P(t.x, t.y, z1);
        const rx = r * k;
        const ry = r * k * COS_T;
        const arc = (a0, a1) => Array.from({ length: 9 }, (_, j) => {
          const a = a0 + ((a1 - a0) * j) / 8;
          return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
        });
        fill([[ax, ay], ...arc(Math.PI, Math.PI / 2)], leaf.top);
        fill([[ax, ay], ...arc(Math.PI / 2, 0)], leaf.right);
      }
      return;
    }
    const [cx, cy] = P(t.x, t.y, base + t.r * 1.7);
    const r = t.r * 1.25 * k;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = leaf.right;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, cy - r * 0.22, r * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = leaf.top;
    ctx.fill();
  }

  function island(n) {
    solid(circle(n.x, n.y, ROUNDABOUT_R - 4, 20), ROAD_TOP, 1.2, theme.tint(theme.grass2));
    tree({ x: n.x, y: n.y, r: 2.2 }, 1, 1.2);
  }

  /** A little give-way sign on a post at the junction's near corner. */
  function yieldSign(n) {
    const x = n.x + ROAD_W / 2 + 1.4;
    const y = n.y + ROAD_W / 2 + 1.4;
    const pole = theme.tint('#b9bfcc');
    solid(rect(x - 0.18, y - 0.18, x + 0.18, y + 0.18), LOT_TOP, LOT_TOP + 3.6, pole);
    const [cx, cy] = P(x, y, LOT_TOP + 4.2);
    const s = Math.max(4, 1.3 * k);
    fill([[cx - s, cy - s * 0.65], [cx + s, cy - s * 0.65], [cx, cy + s * 0.95]], '#ff6f7d');
    fill([[cx - s * 0.5, cy - s * 0.36], [cx + s * 0.5, cy - s * 0.36], [cx, cy + s * 0.42]], '#ffffff');
  }

  /**
   * The flyover: the east-west road climbs a ramp each side and crosses the
   * north-south one on a deck, held up on two piers.
   */
  function bridge(n) {
    const deck = theme.tint(theme.bridge);
    const side = theme.tint(theme.bridgeSide);
    const a = axisOf(n);
    const lift = (x, y) => Math.max(ROAD_TOP, rampZ({ [n.id]: 'flyover' }, x, y));
    // A point `t` along the bridge and `s` across it, towards the viewer.
    const at = (t, s) => (a === 1 ? [n.x + t, n.y + s] : [n.x + s, n.y + t]);
    for (const sx of [-1, 1]) {
      const [cx, cy] = at(sx * (ROAD_W / 2 + 1.6), 0);
      const [hx, hy] = a === 1 ? [1, ROAD_W / 2 - 1.5] : [ROAD_W / 2 - 1.5, 1];
      box(cx - hx, cy - hy, cx + hx, cy + hy, ROAD_TOP, BRIDGE_H - 0.9, side);
    }
    const w = HIGHWAY_W / 2;
    const ts = Array.from({ length: 33 }, (_, i) => -BRIDGE_REACH + (i / 32) * BRIDGE_REACH * 2);
    const Q = (t, s, dz) => { const [x, y] = at(t, s); return P(x, y, lift(...at(t, 0)) + dz); };
    // The near side, as one shape under the deck's edge, then the deck.
    fill([...ts.map((t) => Q(t, w, 0)), ...ts.slice().reverse().map((t) => { const [x, y] = at(t, w); return P(x, y, Math.max(0, lift(...at(t, 0)) - 1)); })], side.left);
    fill([...ts.map((t) => Q(t, -w, 0.01)), ...ts.slice().reverse().map((t) => Q(t, w, 0.01))], deck.top);
    for (let i = 2; i < ts.length - 3; i += 4) {
      const [x0, y0] = at(ts[i], 0);
      const [x1, y1] = at(ts[i + 2], 0);
      fill(strip(x0, y0, x1, y1, 0.7).map(([x, y]) => P(x, y, lift(x, y) + 0.02)), theme.mark);
    }
  }

  /** The heat on a flyover's deck, which the stripes on the ground can't show. */
  function deckHeat(n, run, types, usePeak) {
    const a = axisOf(n);
    for (const lane of run.lanes) {
      if (lane.heading % 2 !== a || Math.abs(a === 1 ? lane.y0 - n.y : lane.x0 - n.x) > ROAD_W / 2) continue;
      const along = [];
      for (let s = lane.offPlate; s <= lane.len; s += 1.5) {
        const [x, y] = laneAt(lane, Math.min(s, lane.len));
        if (Math.abs(a === 1 ? x - n.x : y - n.y) < BRIDGE_REACH + 1) along.push([x, y]);
      }
      if (along.length < 2) continue;
      const lift = ([x, y], side) => {
        const [sx, sy] = a === 1 ? [x, y + side * (HEAT_W / 2)] : [x + side * (HEAT_W / 2), y];
        return P(sx, sy, Math.max(ROAD_TOP, rampZ(types, x, y, a)) + 0.03);
      };
      fill([...along.map((q) => lift(q, -1)), ...along.slice().reverse().map((q) => lift(q, 1))], heatColour(usePeak ? lane.peak : lane.heat));
    }
  }

  /* ---------- cars ---------- */

  function carPoint(run, c) {
    const lane = run.lanes[c.lane];
    const ux = (lane.x1 - lane.x0) / lane.len;
    const uy = (lane.y1 - lane.y0) / lane.len;
    if (c.hold > 0 && c.crossing) {
      // Across the junction: a curve from where it stopped to where it's going.
      const from = run.lanes[c.crossing.from];
      const t = 1 - c.hold / c.crossing.dur;
      const node = city.nodes[lane.from];
      const type = run.nodes.get(node.id)?.type;
      if (type === 'roundabout') {
        const a0 = Math.atan2(from.y1 - node.y, from.x1 - node.x);
        let a1 = Math.atan2(lane.y0 - node.y, lane.x0 - node.x);
        while (a1 > a0) a1 -= Math.PI * 2; // round anticlockwise
        const a = a0 + (a1 - a0) * t;
        // Swing round from the street onto the ring and back off it, rather than turning on the spot.
        const fu = [(from.x1 - from.x0) / from.len, (from.y1 - from.y0) / from.len];
        const on = Math.min(1, t / 0.2);
        const off = Math.max(0, (t - 0.8) / 0.2);
        const dx = (fu[0] * (1 - on) + Math.sin(a) * on) * (1 - off) + ux * off;
        const dy = (fu[1] * (1 - on) - Math.cos(a) * on) * (1 - off) + uy * off;
        return { x: node.x + Math.cos(a) * ROUNDABOUT_R, y: node.y + Math.sin(a) * ROUNDABOUT_R, dx, dy, node, type, from };
      }
      const s = 1 - t;
      const cx = node.x + (from.x1 - node.x + lane.x0 - node.x) * 0.15;
      const cy = node.y + (from.y1 - node.y + lane.y0 - node.y) * 0.15;
      const x = s * s * from.x1 + 2 * s * t * cx + t * t * lane.x0;
      const y = s * s * from.y1 + 2 * s * t * cy + t * t * lane.y0;
      const dx = 2 * s * (cx - from.x1) + 2 * t * (lane.x0 - cx) || ux;
      const dy = 2 * s * (cy - from.y1) + 2 * t * (lane.y0 - cy) || uy;
      return { x, y, dx, dy, node, type, from };
    }
    return { x: lane.x0 + ux * c.pos, y: lane.y0 + uy * c.pos, dx: ux, dy: uy };
  }

  function footprint(p, len, wide, ahead = 0) {
    const l = Math.hypot(p.dx, p.dy) || 1;
    const ux = p.dx / l;
    const uy = p.dy / l;
    const x = p.x + ux * ahead;
    const y = p.y + uy * ahead;
    const hl = len / 2;
    const hw = wide / 2;
    return [
      [x + ux * hl - uy * hw, y + uy * hl + ux * hw],
      [x + ux * hl + uy * hw, y + uy * hl - ux * hw],
      [x - ux * hl + uy * hw, y - uy * hl - ux * hw],
      [x - ux * hl - uy * hw, y - uy * hl + ux * hw],
    ];
  }

  /** A soft shadow, a low body, and a glass cabin set back from the bonnet. */
  function car(p, z, tone) {
    flat(footprint({ ...p, x: p.x + 0.7, y: p.y + 0.3 }, 6.6, 4.2), z + 0.01, theme.castShadow);
    const [top, side] = CANDY[tone];
    const paint = theme.tint(top);
    const under = theme.tint(side);
    // As long as a queue allows (cars stand 7 m apart), and a little wide, to read at a glance.
    solid(footprint(p, 6.2, 3.8), z + 0.3, z + 1.6, { top: paint.top, left: under.top, right: under.left });
    solid(footprint(p, 3.3, 3.3, -0.8), z + 1.6, z + 2.7, { top: paint.top, left: theme.glass, right: mix(theme.glass, '#000000', 0.12) });
  }

  /** Buildings, trees, cars and anything else that stands up, back to front. */
  function drawStanding(run, types, showPeak) {
    const items = [];
    city.buildings.forEach((b, i) => {
      items.push({
        depth: b.x1 + b.y1 - 6,
        draw: () => cached(`b${i}`, boxReach(b.x0 - 2, b.y0 - 2, b.x1 + 3, b.y1 + 3, b.height + 9), () => BUILD[b.type](b)),
      });
    });
    city.trees.forEach((t, i) => {
      const r = t.r * 1.6 + 2;
      items.push({ depth: t.x + t.y, draw: () => cached(`t${i}`, boxReach(t.x - r, t.y - r, t.x + r, t.y + r, t.r * 4 + 3), () => tree(t, i)) });
    });
    for (const n of city.nodes) {
      if (n.kind !== 'junction') continue;
      const type = types[n.id] ?? 'giveway';
      if (type === 'giveway') {
        items.push({ depth: n.x + n.y + ROAD_W + 2, draw: () => cached(`y${n.id}`, boxReach(n.x + 6, n.y + 6, n.x + 14, n.y + 14, 7), () => yieldSign(n)) });
      }
      if (type === 'roundabout') {
        items.push({ depth: n.x + n.y - 2, draw: () => cached(`r${n.id}`, boxReach(n.x - 10, n.y - 10, n.x + 10, n.y + 10, 9), () => island(n)) });
      }
      if (type === 'flyover') {
        items.push({
          depth: n.x + n.y,
          draw: () => {
            cached(`f${n.id}`, boxReach(n.x - BRIDGE_REACH, n.y - ROAD_W, n.x + BRIDGE_REACH, n.y + ROAD_W, BRIDGE_H + 1), () => bridge(n));
            if (run) deckHeat(n, run, types, showPeak);
          },
        });
      }
    }
    if (run) {
      for (const lane of run.lanes) {
        for (const c of lane.cars) {
          if (c.hold <= 0 && c.pos < lane.offPlate) continue; // not on the plate yet
          const p = carPoint(run, c);
          let z = ROAD_TOP;
          let depth = p.x + p.y;
          if (p.type === 'flyover') {
            // Straight across east-west goes over the deck; anything else, under it.
            const over = p.from.heading % 2 === axisOf(p.node) && p.from.heading === lane.heading;
            if (over) { z += BRIDGE_H; depth = p.node.x + p.node.y + 1; } else depth = p.node.x + p.node.y - 1;
          } else {
            const lift = rampZ(types, p.x, p.y, lane.heading % 2);
            if (lift > 0) {
              z += lift;
              const n = city.nodes.find((q) => types[q.id] === 'flyover' && axisOf(q) === lane.heading % 2
                && Math.hypot(q.x - p.x, q.y - p.y) < BRIDGE_REACH + ROAD_W);
              if (n) depth = n.x + n.y + 1;
            }
          }
          items.push({ depth, draw: () => car(p, z, c.tone) });
        }
      }
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();
  }

  /* ---------- labels ---------- */

  /* Sized with the board, so on a phone a tag stays a tag and doesn't cover the town. */
  function label(text, x, y, bg, ink) {
    const s = Math.max(0.55, Math.min(1, k / 2.6));
    ctx.save();
    ctx.font = `800 ${Math.round(18 * s)}px Nunito, system-ui, sans-serif`;
    const w = ctx.measureText(text).width + 34 * s;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 15 * s, w, 30 * s, 10 * s);
    ctx.fill();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  function drawHighwayTags() {
    for (const p of [city.entrance, city.exit]) {
      const [x, y] = P(p.x + DX[p.heading] * 9, p.y + DY[p.heading] * 9, 0);
      label(p === city.entrance ? 'Highway in' : 'Highway out', x, y, theme.sheet, theme.ink3);
    }
  }

  function drawBacklog(run) {
    for (const [laneId, queue] of run.sources) {
      if (queue.length < 2) continue;
      const lane = run.lanes[laneId];
      const [wx, wy] = laneAt(lane, lane.offPlate + 4);
      const [x, y] = P(wx, wy, 9);
      label(`+${queue.length} waiting`, x, y, `rgb(${JAMMED.join(',')})`, '#fff');
    }
  }

  function draw({ run, types, hover, showPeak }) {
    if (!ground) drawGround();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(ground, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (run) drawHeat(run, types, showPeak);
    drawJunctions(run, types, hover);
    drawStanding(run, types, showPeak);
    drawHighwayTags();
    if (run && !showPeak) drawBacklog(run);
  }

  /** How big a junction's tap target is on screen: generous, but short of its neighbours. */
  function reach() {
    return Math.max(34, ROAD_W * 1.9 * k);
  }

  /** Where a junction sits on the canvas, for anything placed over it. */
  function at(id) {
    const n = city.nodes[id];
    return P(n.x, n.y, ROAD_TOP);
  }

  return { resize, setTheme, draw, reach, at };
}
