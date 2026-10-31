/* Anonymous totals. The only things stored are counts: per (game, puzzle, event),
   per country, and per (day, metric, key). No IPs, IDs or per-person records, and
   no table links one count to another. Each browser remembers what it has already
   reported, so uniques need no ID. Counts can be faked by anyone determined, which
   is fine for gauging interest but rules out leaderboards. */

// The site's own catalogue, so the launch date and puzzle order can't drift apart.
// Changing melodies.js means redeploying this Worker too.
import { dateForNumber, melodyForNumber, todayNumber } from '../../../public/Homepage/src/games/cadence/melodies.js';
import { DASHBOARD_HTML } from './dashboard.js';

const ALLOWED_ORIGINS = new Set(['https://overtone.games', 'https://www.overtone.games']);
const GAMES = new Set(['cadence']);
const EVENTS = new Set([
  'started', 'played', 'solved', 'assisted',
  'tries1', 'tries2', 'tries3', 'tries4-5', 'tries6+',
]);

// Every allowed metric and key is listed, which keeps the table small whatever gets sent.
const METRICS = {
  visitor: ['new', 'returning'],
  source: ['direct', 'shared', 'google', 'reddit', 'x', 'facebook', 'instagram', 'tiktok', 'discord', 'youtube', 'hackernews', 'other'],
  device: ['mobile', 'desktop'],
  active: ['new', 'd1', 'd2-6', 'd7-29', 'd30+'],
  funnel: ['started', 'solved'],
  streak: ['1', '2-3', '4-6', '7-13', '14-29', '30+'],
  share: ['sheet', 'copy'],
  lesson: ['solved', 'skipped'],
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
}

const utcDay = () => new Date().toISOString().slice(0, 10);

function bumpDaily(env, metric, key) {
  return env.DB.prepare(
    `INSERT INTO daily (day, metric, key, n) VALUES (?1, ?2, ?3, 1)
     ON CONFLICT (day, metric, key) DO UPDATE SET n = n + 1`
  ).bind(utcDay(), metric, key);
}

const accepted = (request) => new Response(null, { status: 204, headers: corsHeaders(request) });
const rejected = (request) => new Response('Bad report', { status: 400, headers: corsHeaders(request) });

async function readBody(request) {
  try { return (await request.json()) ?? {}; } catch { return null; }
}

async function recordEvent(request, env) {
  const body = await readBody(request);
  if (!body) return rejected(request);

  // At most one row per game, per event, per puzzle that has actually been released.
  const { game, puzzle, event } = body;
  if (!GAMES.has(game) || !EVENTS.has(event) || !Number.isInteger(puzzle) || puzzle < 1 || puzzle > todayNumber()) {
    return rejected(request);
  }

  const writes = [env.DB.prepare(
    `INSERT INTO counts (game, puzzle, event, n) VALUES (?1, ?2, ?3, 1)
     ON CONFLICT (game, puzzle, event) DO UPDATE SET n = n + 1`
  ).bind(game, puzzle, event)];
  if (event === 'played') writes.push(bumpDaily(env, 'plays', puzzle === todayNumber() ? 'today' : 'archive'));
  await env.DB.batch(writes);

  return accepted(request);
}

async function recordPlayer(request, env) {
  // Cloudflare works this out from the connection. XX means it couldn't tell.
  const country = /^[A-Z][A-Z0-9]$/.test(request.cf?.country ?? '') ? request.cf.country : 'XX';

  await env.DB.prepare(
    `INSERT INTO players (country, n) VALUES (?1, 1)
     ON CONFLICT (country) DO UPDATE SET n = n + 1`
  ).bind(country).run();

  return accepted(request);
}

async function recordDaily(request, env) {
  const body = await readBody(request);
  if (!body || !Object.hasOwn(METRICS, body.metric ?? '') || !METRICS[body.metric].includes(body.key)) return rejected(request);
  await bumpDaily(env, body.metric, body.key).run();
  return accepted(request);
}

async function readStats(request, env) {
  const [counts, players, daily] = await env.DB.batch([
    env.DB.prepare('SELECT game, puzzle, event, n FROM counts'),
    env.DB.prepare('SELECT country, n FROM players ORDER BY n DESC, country'),
    env.DB.prepare('SELECT day, metric, key, n FROM daily ORDER BY day'),
  ]);

  const countries = {};
  let total = 0;
  for (const { country, n } of players.results) {
    countries[country] = n;
    total += n;
  }

  // Every released puzzle gets a row, so one nobody has played shows as zeros.
  const today = todayNumber();
  const out = { today, generated: new Date().toISOString(), players: { total, countries }, daily: [] };
  for (const game of GAMES) {
    out[game] = {};
    for (let puzzle = 1; puzzle <= today; puzzle++) {
      const row = { date: dateForNumber(puzzle).toISOString().slice(0, 10) };
      for (const event of EVENTS) row[event] = 0;
      // These totals are public, so today's answer stays hidden until tomorrow.
      if (puzzle < today) row.title = melodyForNumber(puzzle).title;
      out[game][puzzle] = row;
    }
  }
  for (const { game, puzzle, event, n } of counts.results) {
    if (out[game]?.[puzzle]) out[game][puzzle][event] = n;
  }
  for (const { day, metric, key, n } of daily.results) {
    let entry = out.daily[out.daily.length - 1];
    if (entry?.day !== day) out.daily.push(entry = { day });
    (entry[metric] ??= {})[key] = n;
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', ...corsHeaders(request) },
  });
}

const WRITES = { '/event': recordEvent, '/player': recordPlayer, '/track': recordDaily };

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'POST' && WRITES[pathname]) {
      if (!ALLOWED_ORIGINS.has(request.headers.get('Origin'))) return new Response('Forbidden', { status: 403 });
      return WRITES[pathname](request, env);
    }
    if (request.method === 'GET' && pathname === '/stats') return readStats(request, env);
    if (request.method === 'GET' && pathname === '/') {
      return new Response(DASHBOARD_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
      });
    }
    return new Response('Not found', { status: 404 });
  },
};
