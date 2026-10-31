/* Anonymous totals. The only things stored are a count for each (game, puzzle,
   event) and a count of players for each country: no IPs, IDs or timestamps.
   Each browser reports itself as a new player once, so uniques need no ID.
   Counts can be faked by anyone determined, which is fine for curiosity but
   rules out leaderboards. */

const ALLOWED_ORIGINS = new Set(['https://overtone.games', 'https://www.overtone.games']);
const GAMES = new Set(['cadence']);
const EVENTS = new Set(['played', 'solved', 'assisted']);

// Keep in step with LAUNCH_UTC in src/games/cadence/melodies.js.
const LAUNCH_UTC = Date.UTC(2026, 9, 26);

function todayNumber() {
  return Math.floor((Date.now() - LAUNCH_UTC) / 86400000) + 1;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
}

async function recordEvent(request, env) {
  if (!ALLOWED_ORIGINS.has(request.headers.get('Origin'))) {
    return new Response('Forbidden', { status: 403 });
  }

  let body;
  try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  // Checking every field keeps the table small whatever gets sent: at most
  // one row per game, per event, per puzzle that has actually been released.
  const { game, puzzle, event } = body ?? {};
  if (!GAMES.has(game) || !EVENTS.has(event) || !Number.isInteger(puzzle) || puzzle < 1 || puzzle > todayNumber()) {
    return new Response('Bad event', { status: 400, headers: corsHeaders(request) });
  }

  await env.DB.prepare(
    `INSERT INTO counts (game, puzzle, event, n) VALUES (?1, ?2, ?3, 1)
     ON CONFLICT (game, puzzle, event) DO UPDATE SET n = n + 1`
  ).bind(game, puzzle, event).run();

  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

async function recordPlayer(request, env) {
  if (!ALLOWED_ORIGINS.has(request.headers.get('Origin'))) {
    return new Response('Forbidden', { status: 403 });
  }

  // Cloudflare works this out from the connection. XX means it couldn't tell.
  const country = /^[A-Z][A-Z0-9]$/.test(request.cf?.country ?? '') ? request.cf.country : 'XX';

  await env.DB.prepare(
    `INSERT INTO players (country, n) VALUES (?1, 1)
     ON CONFLICT (country) DO UPDATE SET n = n + 1`
  ).bind(country).run();

  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

async function readStats(request, env) {
  const [counts, players] = await env.DB.batch([
    env.DB.prepare('SELECT game, puzzle, event, n FROM counts'),
    env.DB.prepare('SELECT country, n FROM players ORDER BY n DESC, country'),
  ]);

  const countries = {};
  let total = 0;
  for (const { country, n } of players.results) {
    countries[country] = n;
    total += n;
  }

  // Every released puzzle gets a row, so one nobody has played shows as zeros.
  const out = { players: { total, countries } };
  for (const game of GAMES) {
    out[game] = {};
    for (let puzzle = 1; puzzle <= todayNumber(); puzzle++) {
      out[game][puzzle] = { played: 0, solved: 0, assisted: 0 };
    }
  }
  for (const { game, puzzle, event, n } of counts.results) {
    if (out[game]?.[puzzle]) out[game][puzzle][event] = n;
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', ...corsHeaders(request) },
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/event' && request.method === 'POST') return recordEvent(request, env);
    if (pathname === '/player' && request.method === 'POST') return recordPlayer(request, env);
    if (pathname === '/stats' && request.method === 'GET') return readStats(request, env);
    return new Response('Not found', { status: 404 });
  },
};
