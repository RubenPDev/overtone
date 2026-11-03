/**
 * Replays every day in src/games/junctions/days.json: its stored answer must
 * still run with perfect flow, and doing nothing must still fail. Run it after
 * any change to the city or the traffic; if it fails, re-tune with
 *
 *   node scripts/tune-junctions.mjs 1 <last day> --redo
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dayFrom, todayNumber } from '../src/games/junctions/puzzles.js';
import { CLEAR_SHARE, simulate } from '../src/games/junctions/sim.js';

const days = JSON.parse(readFileSync(fileURLToPath(new URL('../src/games/junctions/days.json', import.meta.url)), 'utf8'));
let bad = 0;
for (const tuning of days) {
  const day = dayFrom(tuning);
  const best = simulate(day.city, day.net, day.trips, tuning.solution);
  const nothing = simulate(day.city, day.net, day.trips, {});
  if (!best.perfect) { bad++; console.log(`#${tuning.n}: the stored answer no longer runs perfectly`); }
  if (nothing.cleared >= CLEAR_SHARE) { bad++; console.log(`#${tuning.n}: doing nothing now clears it`); }
}
const last = days.at(-1)?.n ?? 0;
const ahead = last - todayNumber();
console.log(`${days.length} days checked, ${bad} problems. The file runs to #${last}, ${ahead} days from today.`);
if (ahead < 60) console.log('Fewer than 60 days left: tune more soon.');
process.exit(bad ? 1 : 0);
