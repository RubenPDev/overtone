import React from 'react';

/* Each game's mark is a small piece of its own board, made of the same candy:
   lit from the top left, with a darker side showing below. */

/* Cadence: the pad you tap, from above, with its inner ring and the six dots round it. */
function Pad() {
  const dots = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return [32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14];
  });
  return (
    <>
      <defs>
        <radialGradient id="glyph-pad" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".55" stopColor="#d9fff2" />
          <stop offset="1" stopColor="#93ecd2" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="35" r="19" fill="#2aa889" opacity=".55" />
      <circle cx="32" cy="32" r="19" fill="url(#glyph-pad)" />
      <circle cx="32" cy="32" r="8.5" fill="none" stroke="#27413e" strokeOpacity=".28" strokeWidth="1.4" />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill="#27413e" fillOpacity=".45" />
      ))}
    </>
  );
}

/* Facet: its 3x3 face at the board's tilt, one block from solved. Each block is
   its top over its side, drawn back to front. */
const TONES = {
  teal: ['#69ffd0', '#2fc4a0'],
  pink: ['#ff9c9f', '#ec6f78'],
  yellow: ['#ffe66a', '#efb03e'],
  centre: ['#45e6b4', '#1f8f6e'],
};
const FACE = [
  ['teal', 'teal', 'yellow'],
  ['teal', 'centre', 'teal'],
  ['pink', 'teal', 'teal'],
];

function Face() {
  const pitch = 13.5;
  const size = 11.5;
  const depth = 2.6;
  const start = -pitch - size / 2;
  return (
    <g transform="translate(32 34) scale(1 .62) rotate(45)">
      {FACE.flatMap((row, r) => row.map((tone, c) => {
        const [top, side] = TONES[tone];
        const x = start + c * pitch;
        const y = start + r * pitch;
        return (
          <g key={`${r}-${c}`}>
            <rect x={x + depth} y={y + depth} width={size} height={size} rx="3.4" fill={side} />
            <rect x={x} y={y} width={size} height={size} rx="3.4" fill={top} />
          </g>
        );
      }))}
    </g>
  );
}

export default function Glyph({ kind, className }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      {kind === 'pad' && <Pad />}
      {kind === 'facet' && <Face />}
    </svg>
  );
}
