import React, { useEffect, useRef, useState } from 'react';
import { devMode, setDevMode } from '../lib/devMode.js';

const PITCH = 60;

// A Facet board mid-solve: c is a corner button, x the centre, numbers its colours.
const LAYOUT = [
  ['c', 2, 1, 2, 'c'],
  [4, 0, 0, 0, 4],
  [1, 0, 'x', 0, 3],
  [4, 0, 0, 0, 1],
  ['c', 3, 2, 3, 'c'],
];

/* The bottom tile, where the game keeps its heart. Eight quick taps there switch
   developer mode, which opens future puzzles in the archives. */
const SECRET = { row: 4, col: 4, taps: 8, withinMs: 1500 };

/** Decoration for the homepage, built from the game's own blocks. */
export default function CandyBoard() {
  const taps = useRef({ count: 0, at: 0 });
  const [pressed, setPressed] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);

  const tap = () => {
    const now = Date.now();
    const t = taps.current;
    t.count = now - t.at < SECRET.withinMs ? t.count + 1 : 1;
    t.at = now;
    setPressed(true);
    setTimeout(() => setPressed(false), 110);
    if (t.count < SECRET.taps) return;
    t.count = 0;
    const on = !devMode();
    setDevMode(on);
    setNote(on
      ? 'Developer mode on until you leave: every Cadence tune and 30 days of Facet are in the archives.'
      : 'Developer mode off.');
  };

  return (
    <div className="hero__art">
      <div className="fc-board" aria-hidden="true">
        <div className="fc-plate" />
        {LAYOUT.flatMap((cells, row) => cells.map((cell, col) => {
          const secret = row === SECRET.row && col === SECRET.col;
          const tone = cell === 'c' ? 'fc-control' : cell === 'x' ? 'fc-centre fc-tone-centre' : `fc-tone-${cell}`;
          return (
            <div
              key={`${row}-${col}`}
              className={`fc-block ${tone}${secret ? ' is-secret' : ''}${secret && pressed ? ' is-pressed' : ''}`}
              style={{
                transform: `translate3d(${col * PITCH}px,${row * PITCH}px,0)`,
                zIndex: (col + row) * PITCH,
              }}
              onClick={secret ? tap : undefined}
            >
              <div className="fc-face" />
            </div>
          );
        }))}
      </div>
      {note && <p className="hero__secret" role="status">{note}</p>}
    </div>
  );
}
