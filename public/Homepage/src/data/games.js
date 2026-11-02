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
    glyph: 'ring',
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
    id: 'interval',
    name: 'Interval',
    tagline: 'Name the distance',
    description:
      'Two notes, one gap. Six guesses to name it. Starts with octaves and fifths, ' +
      'ends somewhere far less comfortable.',
    href: '/interval',
    glyph: 'steps',
    accent: '179 209 255',
    status: 'soon',
    storageKey: 'interval',
  },
  {
    id: 'canon',
    name: 'Canon',
    tagline: 'Rebuild it by ear',
    description:
      'Hear a short phrase once, then reconstruct it note by note. ' +
      'The melody never repeats itself for you.',
    href: '/canon',
    glyph: 'arcs',
    accent: '255 230 106',
    status: 'soon',
    storageKey: 'canon',
  },
];

export const LIVE_GAMES = GAMES.filter((g) => g.status === 'live');
