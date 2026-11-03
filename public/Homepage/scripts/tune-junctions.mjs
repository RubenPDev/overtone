/**
 * Works out Junctions days ahead of time into src/games/junctions/days.json,
 * on every core. Each day takes from a couple of seconds to half a minute.
 *
 *   node scripts/tune-junctions.mjs 1 365
 *
 * Days already in the file are kept unless --redo is given; run it with --redo
 * after any change to the city or the traffic, since that changes every day.
 * Or name just the days to redo, say the ones check-junctions flags:
 *
 *   node scripts/tune-junctions.mjs --days=4,10,13
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../src/games/junctions/days.json', import.meta.url));

if (isMainThread) {
  const [from = 1, to = 60] = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number);
  const redo = process.argv.includes('--redo');
  const days = new Map(JSON.parse(readFileSync(FILE, 'utf8')).map((d) => [d.n, d]));
  const named = process.argv.find((a) => a.startsWith('--days='));
  const todo = [];
  if (named) todo.push(...named.slice('--days='.length).split(',').map(Number));
  else for (let n = from; n <= to; n++) if (redo || !days.has(n)) todo.push(n);
  console.log(`${todo.length} days to tune on ${availableParallelism()} cores`);

  const save = () => writeFileSync(FILE, `[\n${[...days.values()].sort((a, b) => a.n - b.n).map((d) => JSON.stringify(d)).join(',\n')}\n]\n`);
  // Saved every so often rather than after every day: a dev server watching the
  // file reloads the game on each save.
  const SAVE_EVERY = 25;
  let unsaved = 0;
  let running = 0;
  const started = Date.now();
  await new Promise((resolve) => {
    const next = () => {
      if (!todo.length && !running) { save(); resolve(); return; }
      while (todo.length && running < availableParallelism()) {
        const n = todo.shift();
        running++;
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: n });
        w.on('message', (day) => {
          if (day) days.set(n, day);
          else console.log(`#${n}: no puzzle found`);
          if (++unsaved >= SAVE_EVERY) { save(); unsaved = 0; }
          console.log(`#${n} done (${days.size} in file, ${Math.round((Date.now() - started) / 1000)}s)`);
        });
        w.on('exit', () => { running--; next(); });
      }
    };
    next();
  });
} else {
  const { tune } = await import('../src/games/junctions/puzzles.js');
  parentPort.postMessage(tune(workerData));
}
