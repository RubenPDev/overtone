import React from 'react';

const PITCH = 60;

// A Facet board mid-solve: c is a corner button, x the centre, numbers its colours.
const LAYOUT = [
  ['c', 2, 1, 2, 'c'],
  [4, 0, 0, 0, 4],
  [1, 0, 'x', 0, 3],
  [4, 0, 0, 0, 1],
  ['c', 3, 2, 3, 'c'],
];

/** Decoration for the homepage, built from the game's own blocks. */
export default function CandyBoard() {
  return (
    <div className="hero__art" aria-hidden="true">
      <div className="fc-board">
        <div className="fc-plate" />
        {LAYOUT.flatMap((cells, row) => cells.map((cell, col) => {
          const tone = cell === 'c' ? 'fc-control' : cell === 'x' ? 'fc-centre fc-tone-centre' : `fc-tone-${cell}`;
          return (
            <div
              key={`${row}-${col}`}
              className={`fc-block ${tone}`}
              style={{
                transform: `translate3d(${col * PITCH}px,${row * PITCH}px,0)`,
                zIndex: (col + row) * PITCH,
              }}
            >
              <div className="fc-face" />
            </div>
          );
        }))}
      </div>
    </div>
  );
}
