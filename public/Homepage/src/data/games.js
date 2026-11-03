/**
 * The game catalogue.
 *
 * Adding a game means appending an object here — nothing else in the app
 * needs to change. `glyph` picks which mark GameCard draws; `storageKey`
 * is the localStorage namespace that game writes its progress under, and
 * must match what the game itself uses. `morph` says the game has an element
 * named mark-<id> for the card's mark to turn into on the way in.
 */

export const GAMES = [
  {
    id: 'cadence',
    name: 'Cadence',
    tagline: 'Play the rhythm you already know',
    description:
      'A new melody every day. The notes are handed to you one tap at a time — ' +
      'the rhythm is the puzzle. Tap at any speed; only the pattern counts.',
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
    tagline: 'Find the shortest route',
    description:
      'A scrambled block of colour, and a par that was proven before you started. ' +
      'Swap and turn until the ring matches its centre and every outer row is one colour, ' +
      'in as few moves as you can.',
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
    tagline: 'Keep the rush hour moving',
    description:
      'A small town, a highway and a rush hour on its way. Spend a tight budget on lights, ' +
      'roundabouts and flyovers, then watch the traffic run. Clear it, or clear it without a single street going red.',
    href: '/junctions',
    glyph: 'junction',
    accent: '255 230 106',
    status: 'live',
    storageKey: 'junctions',
    launched: '2026-11-02',
  },
];

export const LIVE_GAMES = GAMES.filter((g) => g.status === 'live');
