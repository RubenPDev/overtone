/**
 * The game catalogue.
 *
 * Adding a game means appending an object here — nothing else in the app
 * needs to change. `glyph` picks which mark GameCard draws; `storageKey`
 * is the localStorage namespace that game writes its progress under, and
 * must match what the game itself uses.
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
    accent: '29 158 117',
    status: 'live',
    storageKey: 'cadence',
    launched: '2026-11-01',
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
    accent: '127 119 221',
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
    accent: '216 90 48',
    status: 'soon',
    storageKey: 'canon',
  },
];

export const LIVE_GAMES = GAMES.filter((g) => g.status === 'live');
