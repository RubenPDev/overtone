/* Overtone's stats. The site sends what happens on it (pages shown, attempts started
   and finished, hints, shares, lessons) under a random per-browser ID, and this keeps
   it in D1. Nobody's IP address is stored: Cloudflare's guess at the country, region,
   time zone and network is kept instead. The dashboard and its data need STATS_KEY,
   set with `npx wrangler secret put STATS_KEY`; only the like count is public. */

// The site's own catalogues, so launch dates and puzzle order can't drift apart.
// Changing melodies.js, or any game's launch date, means redeploying this Worker too.
import * as cadence from '../../../public/Homepage/src/games/cadence/melodies.js';
import * as facet from '../../../public/Homepage/src/games/facet/solver.js';
import * as junctions from '../../../public/Homepage/src/games/junctions/puzzles.js';
import JUNCTION_DAYS from '../../../public/Homepage/src/games/junctions/days.json';
import DASHBOARD_HTML from './dashboard.html';

const ALLOWED_ORIGINS = new Set(['https://overtone.games', 'https://www.overtone.games']);
const GAMES = { cadence, facet, junctions };
const TYPES = new Set(['view', 'engage', 'hide', 'start', 'finish', 'abandon', 'hint', 'share', 'like', 'lesson']);
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_EVENTS = 50;
const MAX_DATA = 1500;   // characters of JSON per event
const LATE_MS = 7 * 86400000; // an event queued offline can arrive up to a week late
const MAX_RANGE_DAYS = 120;

// Crawlers and link previews that run scripts. They rarely touch a page, which
// keeps them out anyway, but there's no reason to store them at all.
const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|embedly|whatsapp|telegram|vkshare|pingdom|uptime|monitor|python|curl|wget|httpclient|java\/|go-http|axios|node-fetch/i;

const DAY = (ts) => new Date(ts).toISOString().slice(0, 10);
const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);

function osOf(ua) {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}

function browserOf(ua) {
  // Apps that open links in their own browser say so, and that's worth knowing.
  if (/Instagram/.test(ua)) return 'Instagram app';
  if (/FBAN|FBAV/.test(ua)) return 'Facebook app';
  if (/Reddit/i.test(ua)) return 'Reddit app';
  if (/TikTok|musical_ly|BytedanceWebview/.test(ua)) return 'TikTok app';
  if (/Twitter/.test(ua)) return 'X app';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox|FxiOS/.test(ua)) return 'Firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
  if (/Safari/.test(ua)) return 'Safari';
  return 'Other';
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
}

const accepted = (request) => new Response(null, { status: 204, headers: corsHeaders(request) });
const rejected = (request) => new Response('Bad report', { status: 400, headers: corsHeaders(request) });

async function readBody(request) {
  try { return (await request.json()) ?? {}; } catch { return null; }
}

/** Whether a puzzle number is one that's been released in that game. */
function released(game, puzzle) {
  return Number.isInteger(puzzle) && puzzle >= 1 && puzzle <= GAMES[game].todayNumber();
}

async function collect(request, env) {
  const ua = request.headers.get('User-Agent') || '';
  if (!ua || BOT_UA.test(ua)) return accepted(request);

  const body = await readBody(request);
  if (!body || !ID.test(body.uid ?? '') || !Array.isArray(body.events)) return rejected(request);
  const { uid } = body;
  const now = Date.now();

  const writes = [];
  let first = now;
  for (const ev of body.events.slice(0, MAX_EVENTS)) {
    if (!ev || !TYPES.has(ev.type) || !ID.test(ev.id ?? '')) continue;
    const game = Object.hasOwn(GAMES, ev.game ?? '') ? ev.game : null;
    // A puzzle that isn't out yet can only come from developer mode, which never counts.
    if (ev.puzzle != null && (!game || !released(game, ev.puzzle))) continue;
    const ts = Number.isFinite(ev.at) ? Math.min(now, Math.max(now - LATE_MS, Math.round(ev.at))) : now;
    const data = ev.data == null ? null : JSON.stringify(ev.data);
    if (data && data.length > MAX_DATA) continue;
    first = Math.min(first, ts);
    // Browsers resend anything they're unsure arrived; the event's ID keeps it to one row.
    writes.push(env.DB.prepare(
      `INSERT OR IGNORE INTO events (eid, ts, day, uid, sid, type, game, puzzle, today, data)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    ).bind(ev.id, ts, DAY(ts), uid, ID.test(ev.sid ?? '') ? ev.sid : null, ev.type, game, ev.puzzle ?? null, ev.today ? 1 : 0, data));
  }
  if (!writes.length) return accepted(request);

  // Where and what from the first visit; whether they've ever engaged, and when last seen, from any.
  const ctx = body.ctx && typeof body.ctx === 'object' ? body.ctx : {};
  const cf = request.cf ?? {};
  writes.unshift(env.DB.prepare(
    `INSERT INTO visitors (uid, first_ts, last_ts, first_day, engaged, country, region, ip_tz, network,
                           tz, device, os, browser, lang, screen, source, referrer, landing)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
     ON CONFLICT (uid) DO UPDATE SET
       first_ts = MIN(first_ts, excluded.first_ts),
       first_day = MIN(first_day, excluded.first_day),
       last_ts = MAX(last_ts, excluded.last_ts),
       engaged = MAX(engaged, excluded.engaged)`
  ).bind(
    uid, first, now, DAY(first), body.engaged ? 1 : 0,
    clip(cf.country, 2), clip(cf.region, 60), clip(cf.timezone, 60), clip(cf.asOrganization, 80),
    clip(ctx.tz, 60), clip(ctx.device, 12), osOf(ua), browserOf(ua), clip(ctx.lang, 16), clip(ctx.screen, 12),
    clip(ctx.source, 24), clip(ctx.referrer, 80), clip(ctx.landing, 64),
  ));
  await env.DB.batch(writes);
  return accepted(request);
}

/* ---------- reading, with the key ---------- */

async function authorised(request, env) {
  if (!env.STATS_KEY) return false;
  const given = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(env.STATS_KEY);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

/** What each game has released so far, so the dashboard can name and date puzzles. */
function catalog() {
  const budgets = new Map(JUNCTION_DAYS.map((d) => [d.n, d.budget]));
  const out = {};
  for (const [game, mod] of Object.entries(GAMES)) {
    const today = mod.todayNumber();
    const puzzles = {};
    for (let n = 1; n <= today; n++) {
      const p = { date: mod.dateForNumber(n).toISOString().slice(0, 10) };
      if (game === 'cadence') p.title = cadence.melodyForNumber(n).title;
      if (game === 'junctions') p.budget = budgets.get(n) ?? null;
      puzzles[n] = p;
    }
    out[game] = { today, puzzles };
  }
  return out;
}

/* Every event in the range, and the browsers behind them. The browser IDs stay here:
   the dashboard gets a row number for each instead. Fine into the tens of thousands
   of events; past that it wants totals worked out in SQL. */
async function readStats(request, env) {
  if (!(await authorised(request, env))) return new Response('Key needed', { status: 401 });
  const url = new URL(request.url);
  const days = Math.min(MAX_RANGE_DAYS, Math.max(1, parseInt(url.searchParams.get('days') || '30', 10) || 30));
  const now = new Date();
  const since = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * 86400000;

  const [visitors, events] = await env.DB.batch([
    env.DB.prepare(
      `SELECT * FROM visitors WHERE uid IN (SELECT DISTINCT uid FROM events WHERE ts >= ?1)`
    ).bind(since),
    env.DB.prepare(
      `SELECT ts, uid, sid, type, game, puzzle, today, data FROM events WHERE ts >= ?1 ORDER BY ts`
    ).bind(since),
  ]);

  const index = new Map();
  const vs = visitors.results.map((v, i) => {
    index.set(v.uid, i);
    return [v.first_ts, v.last_ts, v.engaged, v.country, v.region, v.ip_tz, v.network, v.tz,
      v.device, v.os, v.browser, v.lang, v.screen, v.source, v.referrer, v.landing];
  });
  const visits = new Map();
  const es = [];
  for (const e of events.results) {
    const vid = index.get(e.uid);
    if (vid === undefined) continue;
    let data = null;
    try { data = e.data ? JSON.parse(e.data) : null; } catch { data = null; }
    if (e.sid && !visits.has(e.sid)) visits.set(e.sid, visits.size);
    es.push([e.ts, vid, e.type, e.game, e.puzzle, e.today, data, e.sid ? visits.get(e.sid) : null]);
  }

  return new Response(JSON.stringify({ generated: Date.now(), since, days, catalog: catalog(), visitors: vs, events: es }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/* The one number the site itself shows: browsers that tapped a heart. */
async function readLikes(request, env) {
  const { likes } = await env.DB.prepare(
    `SELECT COUNT(DISTINCT uid) AS likes FROM events WHERE type = 'like'`
  ).first();
  return new Response(JSON.stringify({ likes }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', ...corsHeaders(request) },
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'POST' && pathname === '/e') {
      if (!ALLOWED_ORIGINS.has(request.headers.get('Origin'))) return new Response('Forbidden', { status: 403 });
      return collect(request, env);
    }
    if (request.method === 'GET' && pathname === '/stats') return readStats(request, env);
    if (request.method === 'GET' && pathname === '/likes') return readLikes(request, env);
    if (request.method === 'GET' && pathname === '/') {
      return new Response(DASHBOARD_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Robots-Tag': 'noindex',
          'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'",
        },
      });
    }
    return new Response('Not found', { status: 404 });
  },
};
