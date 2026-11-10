/**
 * The game catalogue.
 *
 * Adding a game means appending an object here — nothing else in the app
 * needs to change. `glyph` picks which mark GameCard draws; `storageKey`
 * is the localStorage namespace that game writes its progress under, and
 * must match what the game itself uses. `morph` says the game has an element
 * named mark-<id> for the card's mark to turn into on the way in.
 */

import { tx } from '../lib/i18n.js';

export const GAMES = [
  {
    id: 'cadence',
    name: 'Cadence',
    tagline: tx('Play the rhythm you already know'),
    description: tx('A new melody every day. The notes are handed to you one tap at a time — the rhythm is the puzzle. Tap at any speed; only the pattern counts.'),
    href: '/cadence',
    glyph: 'pad',
    accent: '105 255 208',
    status: 'live',
    storageKey: 'cadence',
    morph: true,
    launched: '2026-11-01',
  },
  {
    id: 'facet',
    name: 'Facet',
    tagline: tx('Find the shortest route'),
    description: tx('A scrambled block of colour, and a par that was proven before you started. Swap and turn until the ring matches its centre and every outer row is one colour, in as few moves as you can.'),
    href: '/facet',
    glyph: 'facet',
    accent: '214 140 255',
    status: 'live',
    storageKey: 'facet',
    launched: '2026-10-31',
  },
  {
    id: 'junctions',
    name: 'Junctions',
    tagline: tx('Keep the rush hour moving'),
    description: tx('A small town, a highway and a rush hour on its way. Spend a tight budget on lights, roundabouts and flyovers, then watch the traffic run. Get every car through, or do it without a single street going red.'),
    href: '/junctions',
    glyph: 'junction',
    accent: '255 230 106',
    status: 'live',
    storageKey: 'junctions',
    launched: '2026-11-02',
  },
  {
    // A separate app (public/SoleOperator), so `external` makes its links full
    // page loads instead of in-app routes, and drops the daily badges and streak.
    id: 'sole-operator',
    name: 'Sole Operator',
    tagline: tx('Run the whole plant yourself'),
    description: tx('One nuclear power plant, seven rooms, a kilometre of corridor and nobody else on shift who can do your job. Balance the core, swap the fuel and keep the turbines turning.'),
    href: '/sole-operator/',
    external: true,
    glyph: 'core',
    accent: '95 227 255',
    status: 'live',
    storageKey: null,
    launched: '2026-11-10',
  },
];

export const LIVE_GAMES = GAMES.filter((g) => g.status === 'live');
