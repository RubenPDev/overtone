/**
 * Keyboard state outside React. Held keys are polled in useFrame; one-shot
 * actions are dispatched to listeners. Rebinding later = editing KEYMAP.
 */
export type Action =
  | 'interact'
  | 'map'
  | 'pause'
  | 'speed1'
  | 'speed2'
  | 'speed3'
  | 'togglePause'
  | 'inspect'
  | 'refuel'
  | 'rods'
  | 'tablet'
  | 'dev';

export const KEYMAP: Record<string, Action> = {
  KeyE: 'interact',
  KeyM: 'map',
  Escape: 'pause',
  Digit1: 'speed1',
  Digit2: 'speed2',
  Digit3: 'speed3',
  KeyP: 'togglePause',
  Space: 'togglePause',
  KeyQ: 'inspect',
  KeyR: 'refuel',
  KeyF: 'rods',
  KeyT: 'tablet',
  Backquote: 'dev',
};

/** Display labels for the hotkey bar. */
export const KEY_LABEL: Partial<Record<Action, string>> = {
  interact: 'E',
  map: 'M',
  inspect: 'Q',
  refuel: 'R',
  rods: 'F',
  tablet: 'T',
  pause: 'ESC',
};

const held = new Set<string>();
const listeners = new Set<(a: Action) => void>();

export function isDown(...codes: string[]): boolean {
  return codes.some((c) => held.has(c));
}

export function onAction(fn: (a: Action) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function fireAction(a: Action) {
  for (const fn of listeners) fn(a);
}

function typingInField(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

let installed = false;
export function installInput() {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (typingInField(e)) return;
    held.add(e.code);
    const a = KEYMAP[e.code];
    if (a && !e.repeat) {
      if (e.code === 'Space' || e.code === 'Backquote') e.preventDefault();
      fireAction(a);
    }
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
}

const S = Math.SQRT1_2;

/** Screen-relative WASD/arrows → ground direction for the fixed iso camera (W = screen up). */
export function keyboardDir(): { x: number; z: number } | null {
  let x = 0;
  let z = 0;
  if (isDown('KeyW', 'ArrowUp')) ((x -= S), (z -= S));
  if (isDown('KeyS', 'ArrowDown')) ((x += S), (z += S));
  if (isDown('KeyD', 'ArrowRight')) ((x += S), (z -= S));
  if (isDown('KeyA', 'ArrowLeft')) ((x -= S), (z += S));
  const len = Math.hypot(x, z);
  return len > 0 ? { x: x / len, z: z / len } : null;
}
