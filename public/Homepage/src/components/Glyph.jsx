import React, { useMemo } from 'react';

const SIZE = 64;
const C = SIZE / 2;

/* The ring is generated from the same maths the game's oscilloscope uses:
   a base radius, a sharpened wave, and an uneven term that varies peak
   height without disturbing the baseline circle. */
function ringPath(seed = 1, points = 180, base = 20, amp = 5.2) {
  const pts = [];
  for (let k = 0; k < points; k++) {
    const a = (k / points) * Math.PI * 2 - Math.PI / 2;
    const wave =
      Math.sin(a * 3 * seed) * 0.7 +
      Math.sin(a * 5 * seed + 1.3) * 0.3;
    const sharp = Math.sign(wave) * Math.pow(Math.abs(wave), 1.6);
    const uneven =
      1 + 0.34 * (Math.sin(a * 2 + 0.9) * 0.62 + Math.sin(a * 3 - 1.7) * 0.46);
    const r = base + sharp * amp * uneven;
    pts.push(`${(C + Math.cos(a) * r).toFixed(2)} ${(C + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

function Steps() {
  const bars = [10, 18, 14, 26, 22, 34];
  return (
    <g>
      {bars.map((h, i) => (
        <line
          key={i}
          x1={12 + i * 8}
          y1={C + 14}
          x2={12 + i * 8}
          y2={C + 14 - h}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

function Arcs() {
  return (
    <g>
      <path d="M10 42 Q22 16 34 42" />
      <path d="M22 46 Q34 20 46 46" opacity="0.6" />
      <path d="M34 50 Q46 24 58 50" opacity="0.32" />
    </g>
  );
}

/* The game's 3x3 face at its isometric tilt, with the fixed centre filled in. */
function Face() {
  const cells = [-14.5, -4.5, 5.5];
  return (
    <g transform={`translate(${C} ${C}) scale(1 0.62) rotate(45)`}>
      {cells.flatMap((y, r) => cells.map((x, c) => {
        const centre = r === 1 && c === 1;
        return (
          <rect
            key={`${r}-${c}`}
            x={x}
            y={y}
            width="9"
            height="9"
            rx="2"
            vectorEffect="non-scaling-stroke"
            fill={centre ? 'currentColor' : 'none'}
          />
        );
      }))}
    </g>
  );
}

export default function Glyph({ kind = 'ring', className }) {
  const d = useMemo(() => ringPath(kind === 'ring' ? 1 : 2), [kind]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      <circle cx={C} cy={C} r="27" strokeWidth="0.5" opacity="0.3" />
      {kind === 'ring' && <path d={d} />}
      {kind === 'steps' && <Steps />}
      {kind === 'arcs' && <Arcs />}
      {kind === 'facet' && <Face />}
    </svg>
  );
}
