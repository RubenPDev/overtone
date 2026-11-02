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
  C5: 523.25, Cs5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99,
  G5: 783.99,
  G3: 196.00, A3: 220.00, B3: 246.94,
};

import { devMode } from '../../lib/devMode.js';

const N = NOTE;

/* The day the calendar starts. Puzzle 1 is this date, UTC. */
export const LAUNCH_UTC = Date.UTC(2026, 9, 26); // Oct 26, 2026

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
    gaps: [1, 1, 2, 1, 1, 2, 1, 1, 1.5, 0.5],
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
  /* From here on, appended only. A puzzle's tune is its place in this list, so
     inserting or reordering would change puzzles that have already been played. */
  {
    title: 'Korobeiniki',
    composer: 'trad.',
    notes: [N.E5, N.B4, N.C5, N.D5, N.C5, N.B4, N.A4, N.A4, N.C5, N.E5, N.D5, N.C5,
            N.B4, N.C5, N.D5, N.E5, N.C5, N.A4, N.A4],
    gaps: [1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1.5, 0.5, 1, 1, 1, 1],
    playback: 0.36,
    intro: 'A Russian folk song most people learned from falling blocks. One long, two short, all the way down.',
    solved: 'Long-short-short on every step, then the four even notes that settle it.',
  },
  {
    title: 'Happy Birthday to You',
    composer: 'Mildred & Patty Hill',
    notes: [N.G4, N.G4, N.A4, N.G4, N.C5, N.B4, N.G4, N.G4, N.A4, N.G4, N.D5, N.C5],
    gaps: [0.75, 0.25, 1, 1, 1, 2, 0.75, 0.25, 1, 1, 1],
    playback: 0.42,
    intro: 'A little hiccup before each line, and you have sung it more often than anything else here.',
    solved: 'That hiccup is a dotted note and its tiny pickup. Everyone sings it, nobody notices it.',
  },
  {
    title: 'Drunken Sailor',
    composer: 'trad.',
    notes: [N.A4, N.A4, N.A4, N.A4, N.A4, N.A4, N.A4, N.D4, N.F4, N.A4,
            N.G4, N.G4, N.G4, N.G4, N.G4, N.G4, N.G4, N.C4, N.E4, N.G4],
    gaps: [1, 0.5, 0.5, 1, 0.5, 0.5, 1, 1, 1, 1, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 1, 1],
    playback: 0.3,
    intro: 'A sea shanty that asks a question. One pitch for most of a line, so the stamping is all you have.',
    solved: 'A long and two short, twice, then three even steps up. Then the whole thing a step lower.',
  },
  {
    title: 'London Bridge Is Falling Down',
    composer: 'trad.',
    notes: [N.G4, N.A4, N.G4, N.F4, N.E4, N.F4, N.G4, N.D4, N.E4, N.F4, N.E4, N.F4, N.G4],
    gaps: [1.5, 0.5, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1],
    playback: 0.34,
    intro: 'A nursery rhyme with a lean at the start, then three little drops that each come to rest.',
    solved: 'A dotted start, then three-note groups that each land on a held note.',
  },
  {
    title: 'Funeral March',
    composer: 'Chopin',
    notes: [N.Bb4, N.Bb4, N.Bb4, N.Bb4, N.Cs5, N.C5, N.C5, N.Bb4, N.Bb4, N.A4, N.Bb4],
    gaps: [1, 0.75, 0.25, 2, 0.75, 0.25, 0.75, 0.25, 0.75, 0.25],
    playback: 0.55,
    intro: 'Slow, heavy, and nearly all one pitch. The limp in the step is the whole thing.',
    solved: 'Dum, dum-da-dum, then three limping pairs. It has been played at funerals and in cartoons ever since.',
  },
  {
    title: 'Row, Row, Row Your Boat',
    composer: 'trad.',
    notes: [N.C4, N.C4, N.C4, N.D4, N.E4, N.E4, N.D4, N.E4, N.F4, N.G4],
    gaps: [1.5, 1.5, 1, 0.5, 1.5, 1, 0.5, 1, 0.5],
    playback: 0.3,
    intro: 'Two even pulls, then it starts to rock. A round, if anyone joins in.',
    solved: 'Two long strokes, then long-short rocking all the way down the stream.',
  },
  {
    title: 'The Star-Spangled Banner',
    composer: 'John Stafford Smith',
    notes: [N.G4, N.E4, N.C4, N.E4, N.G4, N.C5, N.E5, N.D5, N.C5, N.E4, N.Fs4, N.G4],
    gaps: [0.75, 0.25, 1, 1, 1, 2, 0.75, 0.25, 1, 1, 1],
    playback: 0.42,
    intro: 'A dotted pickup, a climb up a chord in threes, and then the same pickup from the top.',
    solved: 'The tune was an old drinking song before it was an anthem. The dotted pickups are the giveaway.',
  },
  {
    title: 'Three Blind Mice',
    composer: 'trad.',
    notes: [N.E4, N.D4, N.C4, N.E4, N.D4, N.C4, N.G4, N.F4, N.F4, N.E4, N.G4, N.F4, N.F4, N.E4],
    gaps: [1.5, 1.5, 3, 1.5, 1.5, 3, 1.5, 1, 0.5, 3, 1.5, 1, 0.5],
    playback: 0.3,
    intro: 'A slow walk down, step by step, twice. Then a line with a little skip in it, twice.',
    solved: 'Three blind steps, then a skip that only appears in the second half.',
  },
  {
    title: 'Minuet in G',
    composer: 'Petzold',
    notes: [N.D5, N.G4, N.A4, N.B4, N.C5, N.D5, N.G4, N.G4, N.E5, N.C5, N.D5, N.E5, N.Fs5, N.G5, N.G4, N.G4],
    gaps: [1, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1],
    playback: 0.36,
    intro: 'A dance in threes for beginner pianists. One step, a quick run, then two plain beats.',
    solved: 'Long credited to Bach, it was probably by Christian Petzold. Step, run, two beats, twice.',
  },
  {
    title: 'Old MacDonald Had a Farm',
    composer: 'trad.',
    notes: [N.G4, N.G4, N.G4, N.D4, N.E4, N.E4, N.D4, N.B4, N.B4, N.A4, N.A4, N.G4],
    gaps: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1],
    playback: 0.32,
    intro: 'Almost entirely even, with one held note in the middle. The vowels at the end give it away.',
    solved: 'Six even notes, a held one, then the five vowels. The rhythm barely moves; the tune does.',
  },
  {
    title: 'Amazing Grace',
    composer: 'trad.',
    notes: [N.D4, N.G4, N.B4, N.G4, N.B4, N.A4, N.G4, N.E4, N.D4,
            N.D4, N.G4, N.B4, N.G4, N.B4, N.A4, N.D5],
    gaps: [1, 2, 0.5, 0.5, 2, 1, 2, 1, 2, 1, 2, 0.5, 0.5, 2, 1],
    playback: 0.42,
    intro: 'Slow, in threes. Long-short in every bar, with a little turn over the second note.',
    solved: 'A hymn tune that sways long-short, with one quick turn in each line.',
  },
  {
    title: 'Frère Jacques',
    composer: 'trad.',
    notes: [N.C4, N.D4, N.E4, N.C4, N.C4, N.D4, N.E4, N.C4, N.E4, N.F4, N.G4, N.E4, N.F4, N.G4,
            N.G4, N.A4, N.G4, N.F4, N.E4, N.C4],
    gaps: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 0.5, 0.5, 0.5, 0.5, 1],
    playback: 0.34,
    intro: 'Everything comes in pairs: an even four, three with a rest, then a quick ring.',
    solved: 'Each line twice: four even steps, three and a pause, then the bells.',
  },
  {
    title: 'Daisy Bell',
    composer: 'Harry Dacre',
    notes: [N.C5, N.A4, N.F4, N.C4, N.D4, N.E4, N.F4, N.D4, N.F4, N.C4],
    gaps: [3, 3, 3, 3, 1, 1, 1, 2, 1],
    playback: 0.3,
    intro: 'A waltz. Four names called slowly, then a quick question.',
    solved: 'Four long calls, then a waltz step and the answer. Built for a bicycle made for two.',
  },
  {
    title: 'Mary Had a Little Lamb',
    composer: 'trad.',
    notes: [N.E4, N.D4, N.C4, N.D4, N.E4, N.E4, N.E4, N.D4, N.D4, N.D4, N.E4, N.G4, N.G4],
    gaps: [1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1],
    playback: 0.33,
    intro: 'Seven even steps before anything holds. Then shorter groups, each ending long.',
    solved: 'Seven even notes and a held one, then three and three. Hard only because it is so plain.',
  },
  {
    title: 'Symphony No. 9 "From the New World" (Largo)',
    composer: 'Dvořák',
    notes: [N.E4, N.G4, N.G4, N.E4, N.D4, N.C4, N.D4, N.E4, N.G4, N.E4, N.D4],
    gaps: [1.5, 0.5, 2, 1.5, 0.5, 2, 1, 1, 1, 1],
    playback: 0.6,
    intro: 'Very slow, played on a cor anglais. Two drawn-out sighs, then four even steps.',
    solved: 'Long-short-held, twice, then even steps to a rest. Words were set to it later, as a song about going home.',
  },
  {
    title: 'Yankee Doodle',
    composer: 'trad.',
    notes: [N.C4, N.C4, N.D4, N.E4, N.C4, N.E4, N.D4, N.G3, N.C4, N.C4, N.D4, N.E4, N.C4, N.B3],
    gaps: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1],
    playback: 0.32,
    intro: 'Quick and dead even, until the very end. You are listening for where it stops.',
    solved: 'Thirteen quick notes and one that finally sits down. Riding on a pony.',
  },
  {
    title: 'God Save the King',
    composer: 'trad.',
    notes: [N.G4, N.G4, N.A4, N.Fs4, N.G4, N.A4, N.B4, N.B4, N.C5, N.B4, N.A4, N.G4, N.A4, N.G4, N.Fs4, N.G4],
    gaps: [1, 1, 1, 1.5, 0.5, 1, 1, 1, 1.5, 0.5, 1, 1, 1, 1, 1],
    playback: 0.42,
    intro: 'Slow, in threes, with one dotted step in each of the first two lines.',
    solved: 'Three steady beats, then long-short-beat, twice. Sung to several countries’ words.',
  },
  {
    title: 'Au clair de la lune',
    composer: 'trad.',
    notes: [N.C4, N.C4, N.C4, N.D4, N.E4, N.D4, N.C4, N.E4, N.D4, N.D4, N.C4],
    gaps: [1, 1, 1, 1, 2, 2, 1, 1, 1, 1],
    playback: 0.38,
    intro: 'A French lullaby. Four even notes, two long ones, then four more before it rests.',
    solved: 'Even, even, then two held notes in the middle. One of the first tunes ever recorded.',
  },
  {
    title: 'Symphony No. 94 "Surprise"',
    composer: 'Haydn',
    notes: [N.C4, N.C4, N.E4, N.E4, N.G4, N.G4, N.E4, N.F4, N.F4, N.D4, N.D4, N.B3, N.B3, N.G3],
    gaps: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    playback: 0.4,
    intro: 'Very quiet, very simple, in pairs. Something is about to happen.',
    solved: 'Pairs of quick notes, one held, more pairs. Then the orchestra crashes in, which is the surprise.',
  },
  {
    title: 'The More We Get Together',
    composer: 'trad.',
    notes: [N.G4, N.A4, N.G4, N.F4, N.E4, N.C4, N.C4, N.D4, N.G3, N.G3, N.E4, N.C4, N.C4],
    gaps: [1.5, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    playback: 0.3,
    intro: 'A waltz with one lilt at the start, then a lot of even counting.',
    solved: 'One long-short at the top, then even threes. The same tune as “Ach, du lieber Augustin”.',
  },
  {
    title: 'America the Beautiful',
    composer: 'Samuel A. Ward',
    notes: [N.G4, N.G4, N.E4, N.E4, N.G4, N.G4, N.D4, N.D4, N.E4, N.F4, N.G4, N.A4, N.B4, N.G4],
    gaps: [1, 1.5, 0.5, 1, 1, 1.5, 0.5, 1, 1, 1, 1, 1, 1],
    playback: 0.38,
    intro: 'A hymn tune. Two dotted steps, then a slow even climb.',
    solved: 'Long-short, twice, then the steady climb. It was a hymn tune before the words were added.',
  },
  {
    title: 'Alouette',
    composer: 'trad.',
    notes: [N.C4, N.D4, N.E4, N.E4, N.D4, N.C4, N.D4, N.E4, N.C4, N.G3],
    gaps: [1.5, 0.5, 1, 1, 0.5, 0.5, 0.5, 0.5, 1],
    playback: 0.36,
    intro: 'A French song with a lean on the first note, then a quick little patter.',
    solved: 'Long-short, two plain beats, then four quick ones. A song about plucking a lark.',
  },
  {
    title: 'O Canada',
    composer: 'Calixa Lavallée',
    notes: [N.E4, N.G4, N.G4, N.C4, N.D4, N.E4, N.F4, N.G4, N.A4, N.D4],
    gaps: [2, 1.5, 0.5, 3, 1, 1, 1, 1, 1],
    playback: 0.42,
    intro: 'A slow call of three notes, the last held long, then a steady climb of five.',
    solved: 'Held, dotted, held, then five even steps up and a long landing. An anthem since 1980.',
  },
  {
    title: 'This Old Man',
    composer: 'trad.',
    notes: [N.G4, N.E4, N.G4, N.G4, N.E4, N.G4, N.A4, N.G4, N.F4, N.E4, N.D4, N.E4, N.F4],
    gaps: [1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1],
    playback: 0.33,
    intro: 'Short, short, long, twice. Then a run of even steps down and back.',
    solved: 'Two short-short-longs, then seven even notes. Knick-knack.',
  },
  {
    title: 'Bridal Chorus',
    composer: 'Wagner',
    notes: [N.G4, N.C5, N.C5, N.C5, N.G4, N.D5, N.B4, N.C5],
    gaps: [1, 1.5, 0.5, 2, 1, 1.5, 0.5],
    playback: 0.5,
    intro: 'Slow and stately. A step up, a long-short, a long hold, twice.',
    solved: 'Here comes the bride: long-short-held, twice. From an opera, though few people who march to it know that.',
  },
  {
    title: 'Camptown Races',
    composer: 'Stephen Foster',
    notes: [N.G4, N.G4, N.E4, N.G4, N.A4, N.G4, N.E4, N.E4, N.D4, N.E4, N.D4],
    gaps: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 1.5, 0.5],
    playback: 0.34,
    intro: 'A quick patter of six, a short stop, then two little answers.',
    solved: 'Six quick, one longer, then the two answers, each a short note and a long one. Doo-dah.',
  },
  {
    title: 'Oh My Darling, Clementine',
    composer: 'trad.',
    notes: [N.F4, N.F4, N.F4, N.C4, N.A4, N.A4, N.A4, N.F4],
    gaps: [0.75, 0.25, 1, 1, 0.75, 0.25, 1],
    playback: 0.42,
    intro: 'A slow waltz with a hiccup at the start of each line. Two lines, almost the same.',
    solved: 'A dotted pickup, two even notes, twice. The hiccup is what makes it a lament.',
  },
  {
    title: 'My Bonnie Lies over the Ocean',
    composer: 'trad.',
    notes: [N.G4, N.E5, N.D5, N.C5, N.D5, N.C5, N.A4, N.G4, N.E4],
    gaps: [1, 1.5, 0.5, 1, 1, 1, 1, 1],
    playback: 0.38,
    intro: 'A waltz that leaps up on its second note, leans, then walks back down.',
    solved: 'One big leap, a long-short, and an even walk down to the sea.',
  },
  {
    title: 'La Marseillaise',
    composer: 'Rouget de Lisle',
    notes: [N.D4, N.D4, N.G4, N.G4, N.A4, N.A4, N.D5, N.B4],
    gaps: [0.75, 0.25, 1, 1, 1, 1, 1.5],
    playback: 0.42,
    intro: 'A snapped pickup, four marching steps, and a leap. A call to arms.',
    solved: 'Da-da DUM DUM DUM DUM, then the leap. Written in a single night in 1792.',
  },
  {
    title: 'Piano Sonata No. 16 (K. 545)',
    composer: 'Mozart',
    notes: [N.C5, N.E5, N.G5, N.B4, N.C5, N.D5, N.C5],
    gaps: [2, 1, 1, 1.5, 0.25, 0.25],
    playback: 0.4,
    intro: 'Seven notes. Up a chord, then a held note with a very quick twist at the end.',
    solved: 'A plain broken chord, then the little turn. Mozart called it a sonata for beginners.',
  },
  {
    title: 'Auld Lang Syne',
    composer: 'trad.',
    notes: [N.C4, N.F4, N.F4, N.F4, N.A4, N.G4, N.F4, N.G4],
    gaps: [1, 1.5, 0.5, 1, 1, 1.5, 0.5],
    playback: 0.42,
    intro: 'Sung at midnight, arms crossed. Long-short then two even steps, twice.',
    solved: 'Should old acquaintance: long-short, step, step, twice. Robert Burns wrote the words down in 1788.',
  },
  {
    title: 'Carol of the Bells',
    composer: 'Leontovych',
    notes: [N.Bb4, N.A4, N.Bb4, N.G4, N.Bb4, N.A4, N.Bb4, N.G4, N.Bb4, N.A4, N.Bb4, N.G4, N.Bb4, N.A4, N.Bb4, N.G4],
    gaps: [1, 0.5, 0.5, 1, 1, 0.5, 0.5, 1, 1, 0.5, 0.5, 1, 1, 0.5, 0.5],
    playback: 0.3,
    intro: 'Four notes, over and over. One, two-and, three. Count it like a bell.',
    solved: 'The same four-note figure four times. It was a Ukrainian New Year song before it was a carol.',
  },
  {
    title: 'O Tannenbaum',
    composer: 'trad.',
    notes: [N.C4, N.F4, N.F4, N.F4, N.G4, N.A4, N.A4, N.A4, N.A4, N.G4, N.A4, N.Bb4, N.E4, N.G4, N.F4],
    gaps: [1, 0.75, 0.25, 1.5, 0.5, 0.75, 0.25, 1.5, 0.5, 0.5, 0.5, 1, 1, 1],
    playback: 0.42,
    intro: 'A slow waltz with a hitch in it: a quick double note, then a long one, twice.',
    solved: 'Da-da-daa, da-da-daa, then a gentle walk home. A tree that stays green.',
  },
  {
    title: 'Deck the Halls',
    composer: 'trad.',
    notes: [N.G4, N.F4, N.E4, N.D4, N.C4, N.D4, N.E4, N.C4, N.D4, N.E4, N.F4, N.D4, N.E4, N.D4, N.C4, N.B3, N.C4],
    gaps: [1.5, 0.5, 1, 1, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 1.5, 0.5, 1, 1],
    playback: 0.32,
    intro: 'A dotted start and a steady walk down. Then the nonsense syllables, which are quicker.',
    solved: 'Down the scale, then five quick syllables and four slower. Fa-la-la.',
  },
  {
    title: 'Joy to the World',
    composer: 'Lowell Mason',
    notes: [N.C5, N.B4, N.A4, N.G4, N.F4, N.E4, N.D4, N.C4],
    gaps: [1, 0.75, 0.25, 1.5, 0.5, 1, 1],
    playback: 0.4,
    intro: 'Eight notes, straight down the scale. The pitches won’t help you; the hitch in the rhythm will.',
    solved: 'A whole scale down, with a dotted hitch near the top. Arranged from tunes in the style of Handel.',
  },
  {
    title: 'We Wish You a Merry Christmas',
    composer: 'trad.',
    notes: [N.C4, N.F4, N.F4, N.G4, N.F4, N.E4, N.D4, N.D4, N.D4, N.G4, N.G4, N.A4, N.G4, N.F4, N.E4, N.C4],
    gaps: [1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 1],
    playback: 0.34,
    intro: 'A waltz that bounces: two plain beats, four quick, then plain again. Said twice.',
    solved: 'Two steps, four quick, two steps, twice over. Figgy pudding comes later.',
  },
  {
    title: 'Silent Night',
    composer: 'Franz Xaver Gruber',
    notes: [N.G4, N.A4, N.G4, N.E4, N.G4, N.A4, N.G4, N.E4, N.D5, N.D5, N.B4, N.C5, N.C5, N.G4],
    gaps: [1.5, 0.5, 1, 3, 1.5, 0.5, 1, 3, 2, 1, 3, 2, 1],
    playback: 0.38,
    intro: 'A slow lullaby in a rocking six. Long-short-short, then a very long rest. Twice.',
    solved: 'Rocking, held, rocking, held, then two calm long-short pairs. First sung in 1818.',
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

/** The newest puzzle that can be played: today, or in developer mode far enough
    ahead that every tune in the list has had a day. */
export function lastNumber() {
  const today = todayNumber();
  return devMode() ? Math.max(today, MELODIES.length) : today;
}

/** Today's puzzle lives at the plain URL. */
export function puzzlePath(n) {
  return n === todayNumber() ? '/cadence' : `/cadence/${n}`;
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
 * Newest first, capped — the archive drawer scrolls through these. Starts at
 * the newest playable puzzle, so tunes whose day hasn't come stay hidden.
 */
export function archiveList(limit = 120) {
  const out = [];
  for (let n = lastNumber(); n >= 1 && out.length < limit; n--) out.push(puzzleForNumber(n));
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
