import { safeGet, safeSet } from './progress.js';

/* What happens on the site, sent to our own counter at stats.overtone.games.

   Each browser gets a random ID the first time it visits, kept in localStorage.
   It isn't tied to a name, an account or an IP address; it only lets the counter
   tell one browser's visits and plays from another's, so returns and per-puzzle
   numbers are real people rather than guesses.

   Nothing is sent until someone actually touches the page, so link previews and
   crawlers that run scripts never count. Each event has its own ID and waits in an
   outbox in localStorage until the server says it has it; sending one twice is
   harmless, since the server keeps only the first, so anything in doubt is resent.

   Opening the site with ?nostats stops this browser sending anything (for our own
   devices); ?stats turns it back on. Nothing is ever sent from the dev server. */

export const STATS_URL = 'https://stats.overtone.games';

const LIVE_HOSTS = new Set(['overtone.games', 'www.overtone.games']);
const OUTBOX = 'overtone:outbox';
const OUTBOX_MAX = 200;
const SESSION_IDLE_MS = 30 * 60 * 1000; // a new visit after half an hour away
const FLUSH_DELAY_MS = 1500;

function enabled() {
  if (import.meta.env.DEV || typeof window === 'undefined') return false;
  if (!LIVE_HOSTS.has(window.location.hostname)) return false;
  if (navigator.webdriver) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('nostats')) safeSet('overtone:noStats', '1');
  if (params.has('stats')) safeSet('overtone:noStats', '');
  return !safeGet('overtone:noStats');
}

const ON = enabled();

/** Whether this browser sends stats; the privacy page's switch. */
export function statsEnabled() {
  return !safeGet('overtone:noStats');
}
export function setStatsEnabled(on) {
  safeSet('overtone:noStats', on ? '' : '1');
  if (!on) safeSet(OUTBOX, ''); // and anything not yet sent stays unsent
}
/** This browser's ID, if it has one yet, so someone can ask for its records to go. */
export function statsId() {
  return safeGet('overtone:uid');
}

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function browserId() {
  let id = safeGet('overtone:uid');
  if (!id) { id = randomId(); safeSet('overtone:uid', id); }
  return id;
}

/* A visit is one sitting: it carries on across reloads in the same tab, and ends
   after half an hour with nothing happening. */
function sessionId() {
  const now = Date.now();
  let id = null;
  let last = 0;
  try {
    id = sessionStorage.getItem('overtone:sid');
    last = Number(sessionStorage.getItem('overtone:sidAt')) || 0;
  } catch { /* storage blocked: every page is its own visit */ }
  if (!id || now - last > SESSION_IDLE_MS) id = randomId();
  try {
    sessionStorage.setItem('overtone:sid', id);
    sessionStorage.setItem('overtone:sidAt', String(now));
  } catch { /* as above */ }
  return id;
}

const SOURCES = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'x'],
  [/(^|\.)facebook\.com$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)discord(app)?\.com$/, 'discord'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)news\.ycombinator\.com$/, 'hackernews'],
  [/(^|\.)bsky\.app$/, 'bluesky'],
  [/(^|\.)threads\.net$/, 'threads'],
];

/** How this visit arrived: a word for the kind of place, and the site it came from. */
function arrival() {
  const params = new URLSearchParams(window.location.search);
  let host = '';
  try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch { host = ''; }
  if (host === window.location.hostname) host = '';
  let source = 'direct';
  if (params.get('via') === 'share') source = 'shared';
  else if (params.get('utm_source')) source = params.get('utm_source').toLowerCase().slice(0, 24);
  else if (host) source = SOURCES.find(([pattern]) => pattern.test(host))?.[1] ?? 'other';
  return { source, referrer: host.slice(0, 80) };
}

function deviceKind() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const short = Math.min(window.screen.width, window.screen.height);
  if (!coarse) return 'desktop';
  return short >= 600 ? 'tablet' : 'phone';
}

/* What's the same for every event in a page load: the device, and how it arrived. */
function context() {
  const { source, referrer } = arrival();
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''; } catch { tz = ''; }
  return {
    device: deviceKind(),
    screen: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    tz,
    lang: (navigator.language || '').slice(0, 16),
    source,
    referrer,
    landing: window.location.pathname.slice(0, 64),
    standalone: !!window.matchMedia?.('(display-mode: standalone)').matches,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    langs: (navigator.languages || []).slice(0, 4).join(',').slice(0, 60),
  };
}

/* Chrome-family browsers will say which phone model and system version they're on if
   asked; the plain user agent no longer does. It arrives a moment later, in time for
   the first batch. */
function askDevice() {
  const hints = navigator.userAgentData?.getHighEntropyValues;
  if (!hints) return;
  hints.call(navigator.userAgentData, ['model', 'platformVersion']).then((h) => {
    if (h.model) ctx.model = String(h.model).slice(0, 40);
    if (h.platformVersion) ctx.platformVersion = String(h.platformVersion).slice(0, 20);
  }).catch(() => {});
}

let ctx = null;
let engaged = false;
let flushTimer = 0;
let sending = false;

function readOutbox() {
  try { return JSON.parse(safeGet(OUTBOX) || '[]'); } catch { return []; }
}
function writeOutbox(events) {
  safeSet(OUTBOX, JSON.stringify(events.slice(-OUTBOX_MAX)));
}

function send(events, beacon = false) {
  if (!events.length) return Promise.resolve(true);
  const body = JSON.stringify({ uid: browserId(), engaged, ctx, events });
  // text/plain needs no CORS preflight, so each batch is a single request.
  if (beacon && navigator.sendBeacon) {
    const ok = navigator.sendBeacon(`${STATS_URL}/e`, new Blob([body], { type: 'text/plain' }));
    return Promise.resolve(ok);
  }
  return fetch(`${STATS_URL}/e`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
    keepalive: true,
  }).then((res) => res.ok).catch(() => false); // offline or blocked: never the player's problem
}

/* Sends what's waiting. Leaving the page uses a beacon, which can't say whether it
   arrived, so those stay in the outbox and go again (harmlessly) next time. */
function flush(beacon = false) {
  clearTimeout(flushTimer);
  if (!engaged && !beacon) return;
  const batch = readOutbox().slice(0, 50);
  if (!batch.length) return;
  if (beacon) { send(batch, true); return; }
  if (sending) { scheduleFlush(); return; }
  sending = true;
  send(batch).then((ok) => {
    sending = false;
    if (!ok) return;
    const sent = new Set(batch.map((e) => e.id));
    const left = readOutbox().filter((e) => !sent.has(e.id));
    writeOutbox(left);
    if (left.length) scheduleFlush();
  });
}

function scheduleFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flush(), FLUSH_DELAY_MS);
}

/** Records one thing that happened. `game` and `puzzle` say where, `data` the details. */
export function track(type, { game = null, puzzle = null, today = null, data = null } = {}) {
  if (!ON || !statsEnabled()) return;
  const outbox = readOutbox();
  outbox.push({ id: randomId(), sid: sessionId(), type, game, puzzle, today, data, at: Date.now() });
  writeOutbox(outbox);
  if (outbox.length >= 20) flush();
  else scheduleFlush();
}

/* How long the page was on screen, sent as it's hidden, so a visit's length is
   real time looked at rather than a tab left open in the background. */
let shownAt = 0;
function onVisibility() {
  if (document.visibilityState === 'visible') { shownAt = Date.now(); return; }
  if (shownAt) {
    track('hide', { data: { ms: Date.now() - shownAt } });
    shownAt = 0;
  }
  // A page that's never touched still says it was looked at, but marked as such.
  flush(true);
}

function onEngage() {
  if (engaged) return;
  engaged = true;
  ENGAGE_EVENTS.forEach((type) => window.removeEventListener(type, onEngage, true));
  track('engage');
  flush();
}
const ENGAGE_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'];

function init() {
  browserId();
  ctx = context();
  askDevice();
  shownAt = document.visibilityState === 'visible' ? Date.now() : 0;
  ENGAGE_EVENTS.forEach((type) => window.addEventListener(type, onEngage, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => flush(true));
  // Anything left from last time goes as soon as this visit counts.
  if (readOutbox().length) scheduleFlush();
}
if (ON) init();

/* ---------- what the site reports ---------- */

function theme() {
  return document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    ? 'dark' : 'light';
}

/** Each page shown, the first one included. */
export function reportVisit(view, puzzle = null) {
  track('view', { game: ['cadence', 'facet', 'junctions'].includes(view) ? view : null, puzzle, data: { view, theme: theme() } });
}

/** An attempt begins: the first tap, move or run. */
export function reportStart(game, puzzle, { today = false, data = null } = {}) {
  track('start', { game, puzzle, today, data });
}

/**
 * An attempt ends. `outcome` is missed, solved or assisted; `attempt` counts this
 * browser's tries on the puzzle up to its first solve, and `replay` marks one after it.
 */
export function reportFinish(game, puzzle, { today = false, outcome, attempt = null, replay = false, ms = null, ...details }) {
  track('finish', { game, puzzle, today, data: { outcome, attempt, replay, ms, ...details } });
}

/** An attempt given up part way, by starting over. */
export function reportAbandon(game, puzzle, data = null) {
  track('abandon', { game, puzzle, data });
}

export function reportHint(game, puzzle) {
  track('hint', { game, puzzle });
}

export function reportShare(game, method) {
  track('share', { game, data: { method } });
}

export function reportLike(game) {
  track('like', { game });
}

/** How a game's lesson went: finished, skipped (and at which step), or solved. */
export function reportLesson(game, outcome, step = null) {
  track('lesson', { game, data: { outcome, step } });
}
