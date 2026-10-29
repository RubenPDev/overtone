/* ============================================================
   Cadence — puzzle data
   Every tune here must be in the public domain. The rule that
   matters when adding one: the RHYTHM has to carry the tune's
   identity. Melodies famous for their pitches (Für Elise, Ode to
   Joy, Moonlight Sonata) are unsolvable in this format, because
   the game hands the player the pitches for free.
   ============================================================ */

export const NOTE = {
  C4: 261.63, Cs4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23,
  Fs4: 369.99, G4: 392.00, Gs4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, G5: 783.99,
};

const N = NOTE;

/* The day the calendar starts. Puzzle 1 is this date, UTC. */
export const LAUNCH_UTC = Date.UTC(2026, 10, 1); // 1 Nov 2026

export const MELODIES = [
  {
    title: 'Symphony No. 5',
    composer: 'Beethoven',
    notes: [N.G4, N.G4, N.G4, N.Eb4, N.F4, N.F4, N.F4, N.D4],
    gaps: [0.5, 0.5, 0.5, 3, 0.5, 0.5, 0.5],
    playback: 0.42,
    intro: 'Two pitches, eight notes. The rhythm is carrying the entire tune here — which is the whole idea.',
    solved: 'Three shorts and a long, twice. Two pitches only, and you still knew it instantly.',
  },
  {
    title: 'Shave and a Haircut',
    composer: 'trad.',
    notes: [N.C4, N.G4, N.G4, N.A4, N.G4, N.B4, N.C5],
    gaps: [1, 0.5, 0.5, 1, 2, 1],
    playback: 0.36,
    intro: 'Seven notes. You have knocked this one on a door before.',
    solved: 'The six-note knock and its two-note answer. The gap before the last pair is the whole joke.',
  },
  {
    title: 'When the Saints Go Marching In',
    composer: 'trad.',
    notes: [N.C4, N.E4, N.F4, N.G4, N.C4, N.E4, N.F4, N.G4, N.C4, N.E4, N.F4, N.G4, N.E4, N.C4],
    gaps: [1, 1, 1, 4, 1, 1, 1, 4, 1, 1, 1, 2, 2],
    playback: 0.32,
    intro: 'Longer, and the pitches climb. Three quick steps, then somewhere to rest.',
    solved: 'Three quick notes and a long one, three times over, then the walk home.',
  },
  {
    title: 'La Cucaracha',
    composer: 'trad.',
    notes: [N.C4, N.C4, N.C4, N.F4, N.A4, N.C4, N.C4, N.C4, N.F4, N.A4],
    gaps: [0.5, 0.5, 0.5, 1, 2, 0.5, 0.5, 0.5, 1],
    playback: 0.34,
    intro: 'A triplet of quick notes, then two that take their time. Said twice.',
    solved: 'Three short, two long, repeated. The pattern is the phrase.',
  },
  {
    title: 'William Tell Overture (finale)',
    composer: 'Rossini',
    notes: [N.G4, N.G4, N.C5, N.G4, N.G4, N.C5, N.G4, N.G4, N.C5, N.C5, N.C5],
    gaps: [0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5],
    playback: 0.3,
    intro: 'A gallop. Two short and one long, over and over, until it isn’t.',
    solved: 'Da-da-dum, three times, then the run that breaks the pattern.',
  },
  {
    title: 'Jingle Bells',
    composer: 'Pierpont',
    notes: [N.E4, N.E4, N.E4, N.E4, N.E4, N.E4, N.E4, N.G4, N.C4, N.D4, N.E4],
    gaps: [1, 2, 1, 2, 1, 1, 1, 1, 1.5, 0.5],
    playback: 0.33,
    intro: 'Mostly one pitch for the first seven notes, so you are listening to gaps alone.',
    solved: 'Two short-long pairs, then the climb. The held notes are what you recognise.',
  },
  {
    title: 'In the Hall of the Mountain King',
    composer: 'Grieg',
    notes: [N.E4, N.Fs4, N.G4, N.A4, N.B4, N.G4, N.B4, N.Bb4, N.Fs4, N.Bb4, N.A4, N.F4, N.A4],
    gaps: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5],
    playback: 0.55,
    intro: 'Almost all of it is even, which is what makes it hard. Listen for the three notes that linger.',
    solved: 'A creeping climb, then two little echoes, each ending on a held note. The trolls come later.',
  },
  {
    title: 'Eine kleine Nachtmusik',
    composer: 'Mozart',
    notes: [N.G4, N.D4, N.G4, N.D4, N.G4, N.D4, N.G4, N.B4, N.D5],
    gaps: [1.5, 0.5, 1.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    playback: 0.42,
    intro: 'Nine notes. Two jumps with a breath before each, then a quick run up the chord.',
    solved: 'Long-short, long-short, then the arpeggio. The rests are where all the snap comes from.',
  },
  {
    title: 'Rondo alla Turca',
    composer: 'Mozart',
    notes: [N.B4, N.A4, N.Gs4, N.A4, N.C5, N.D5, N.C5, N.B4, N.C5, N.E5, N.F5, N.E5, N.Eb5, N.E5],
    gaps: [0.5, 0.5, 0.5, 0.5, 2, 0.5, 0.5, 0.5, 0.5, 2, 0.5, 0.5, 0.5],
    playback: 0.38,
    intro: 'Quick little turns, each one landing on a note and then stopping dead.',
    solved: 'Four quick notes and a landing, three times, each one a step higher.',
  },
  {
    title: 'Symphony No. 40',
    composer: 'Mozart',
    notes: [N.Eb4, N.D4, N.D4, N.Eb4, N.D4, N.D4, N.Eb4, N.D4, N.D4, N.Bb4,
            N.Bb4, N.A4, N.G4, N.G4, N.F4, N.Eb4],
    gaps: [0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 2, 0.5, 0.5, 1, 0.5, 0.5],
    playback: 0.36,
    intro: 'A sigh, said three times, a leap, and then the same sigh walking back down.',
    solved: 'Da-da-dum, da-da-dum, da-da-dum — up. One of the most anxious openings Mozart wrote.',
  },
  {
    title: 'Swan Lake',
    composer: 'Tchaikovsky',
    notes: [N.E5, N.A4, N.B4, N.C5, N.D5, N.E5, N.C5, N.E5, N.C5, N.E5, N.A4, N.C5, N.A4, N.F4, N.C5, N.A4],
    gaps: [2, 0.5, 0.5, 0.5, 0.5, 1.5, 0.5, 1.5, 0.5, 1.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    playback: 0.5,
    intro: 'One held note, a climb, and then a limping long-short figure. Take it slowly.',
    solved: 'The oboe’s theme: held, climbing, then long-short until it sinks home.',
  },
  {
    title: 'Can-Can (Galop infernal)',
    composer: 'Offenbach',
    notes: [N.C4, N.D4, N.F4, N.E4, N.D4, N.G4, N.G4, N.G4, N.A4, N.E4, N.F4, N.D4,
            N.D4, N.D4, N.F4, N.E4, N.D4],
    gaps: [2, 0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.5, 0.5],
    playback: 0.32,
    intro: 'A long one, a scurry, two stamps, another scurry. Fast once you find it.',
    solved: 'Scurry, stamp, stamp, scurry. Your feet probably got there before your head did.',
  },
  {
    title: 'The Entertainer',
    composer: 'Joplin',
    notes: [N.D4, N.Eb4, N.E4, N.C5, N.E4, N.C5, N.E4, N.C5, N.C5, N.D5, N.Eb5, N.E5, N.C5, N.D5, N.E5],
    gaps: [0.5, 0.5, 0.5, 1, 0.5, 1, 0.5, 3.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    playback: 0.36,
    intro: 'Syncopated. The high notes arrive a fraction early and hang on.',
    solved: 'Short-long, short-long, then a high note held over the bar line. That push is ragtime.',
  },
  {
    title: 'Greensleeves',
    composer: 'trad.',
    notes: [N.A4, N.C5, N.D5, N.E5, N.F5, N.E5, N.D5, N.B4, N.G4, N.A4, N.B4, N.C5, N.A4],
    gaps: [1, 2, 1, 1.5, 0.5, 1, 2, 1, 1.5, 0.5, 1, 2],
    playback: 0.3,
    intro: 'A lilt in threes: long-short, over and over, with a little skip in the middle of each phrase.',
    solved: 'Long-short in every bar, and the dotted skip that keeps it swaying.',
  },
];

/*
  Difficulty is a score built from four things: more notes and more
  distinct gap lengths make it harder; a big ratio between the longest and
  shortest gap makes it easier (the long notes stand out); and a tune made
  mostly of one gap length is harder, because the few odd ones are easy to miss.
*/
const TIERS = [
  [10, 'breezy'],
  [14, 'gentle'],
  [17.6, 'steady'],
  [19.3, 'tricky'],
  [21, 'devious'],
  [Infinity, 'crazy'],
];

export function difficultyOf(melody) {
  const g = melody.gaps;
  const ratio = Math.max(...g) / Math.min(...g);
  const counts = new Map();
  for (const x of g) counts.set(x, (counts.get(x) || 0) + 1);
  const evenness = Math.max(...counts.values()) / g.length;
  const score = melody.notes.length + 3 * counts.size - 4 * Math.log2(ratio) + 6 * evenness;
  return TIERS.find(([max]) => score < max)[1];
}

/**
 * One word for the shape of the rhythm, shown beside the difficulty for
 * puzzles not played yet. It describes the feel without naming the tune.
 * The first rule that matches wins.
 */
export function characterOf(melody) {
  const g = melody.gaps;
  const lo = Math.min(...g);
  const hi = Math.max(...g);
  const count = (test) => g.filter((a, k) => test(a, g[k + 1], g[k + 2], g[k + 3])).length;

  let run = 1, longestRun = 1;
  for (let k = 1; k < g.length; k++) {
    run = g[k] === g[k - 1] ? run + 1 : 1;
    longestRun = Math.max(longestRun, run);
  }

  // short-long-short-long: the accent keeps landing ahead of the beat
  if (count((a, b, c, d) => a === lo && c === lo && b === 2 * lo && d === 2 * lo)) return 'syncopated';
  // dotted long-short pairs, more than once
  if (count((a, b) => a === 3 * b) >= 2) return 'lilting';
  // a long stretch of identical gaps
  if (longestRun >= 5) return 'creeping';
  // short-short-long, more than once
  if (count((a, b, c) => a === b && c === 2 * a) >= 2) return 'galloping';
  // quick runs that stop dead on a held note
  if (hi / lo >= 4 && g.every((x, k) => x !== hi || g[k - 1] === lo)) return 'stop-start';
  return 'bouncy';
}

export function todayNumber(now = new Date()) {
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((utcMidnight - LAUNCH_UTC) / 86400000) + 1;
}

export function dateForNumber(n) {
  return new Date(LAUNCH_UTC + (n - 1) * 86400000);
}

/** Until the catalogue is 365 long, the list cycles. */
export function melodyForNumber(n) {
  const i = ((n - 1) % MELODIES.length + MELODIES.length) % MELODIES.length;
  return MELODIES[i];
}

export function puzzleForNumber(n) {
  return {
    number: n,
    date: dateForNumber(n),
    melody: melodyForNumber(n),
  };
}

/**
 * Newest first, capped — the archive drawer scrolls through these. Every tune
 * in the catalogue is listed even if its calendar day hasn't come round yet
 * (including before launch), so the list never shows fewer than MELODIES.
 */
export function archiveList(limit = 120) {
  const newest = Math.max(todayNumber(), MELODIES.length);
  const out = [];
  for (let n = newest; n >= 1 && out.length < limit; n--) out.push(puzzleForNumber(n));
  return out;
}

/* ------------------------------------------------------------------
   Pitch -> colour. Computed rather than tabulated, so any note added
   later gets a sensible hue without touching a lookup table.
------------------------------------------------------------------ */

const STOPS = [
  [29, 158, 117],   // teal
  [93, 202, 171],   // mint
  [55, 138, 221],   // blue
  [127, 119, 221],  // violet
  [212, 83, 126],   // pink
  [216, 90, 48],    // coral
];

export const NEUTRAL = [136, 135, 128];

export function hueFor(freq) {
  const semitones = 12 * Math.log2(freq / NOTE.C4);
  const t = Math.min(1, Math.max(0, semitones / 24)); // C4..C6 spans the ramp
  const pos = t * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(pos));
  const f = pos - i;
  return [
    Math.round(STOPS[i][0] + (STOPS[i + 1][0] - STOPS[i][0]) * f),
    Math.round(STOPS[i][1] + (STOPS[i + 1][1] - STOPS[i][1]) * f),
    Math.round(STOPS[i][2] + (STOPS[i + 1][2] - STOPS[i][2]) * f),
  ];
}
