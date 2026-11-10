import { describe, expect, it } from 'vitest';

/**
 * Architecture guard: the simulation is pure TypeScript. It must never import
 * React, Three, zustand or anything from the rendering/UI side of the app, so it
 * stays deterministic, testable in Node and swappable for a WASM module.
 */
const sources = import.meta.glob<string>(['./**/*.ts', '!./**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const FORBIDDEN = [
  /from\s+['"]react/,
  /from\s+['"]three/,
  /from\s+['"]@react-three\//,
  /from\s+['"]zustand/,
  /from\s+['"]postprocessing/,
  /from\s+['"]\.\.\/(scene|hud|app|state|rooms|world|dev)\b/,
  /\bwindow\./,
  /\bdocument\./,
  /\blocalStorage\b/,
  /\bMath\.random\(/,
  /\bDate\.now\(/,
  /\bperformance\.now\(/,
];

describe('sim architecture', () => {
  it('has no React/Three/DOM/non-deterministic imports or calls', () => {
    const offences: string[] = [];
    for (const [file, raw] of Object.entries(sources)) {
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      for (const rule of FORBIDDEN) if (rule.test(src)) offences.push(`${file}: ${rule}`);
    }
    expect(offences).toEqual([]);
  });
});
