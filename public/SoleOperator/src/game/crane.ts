import { bus } from '../core/events';
import { craneAtCask, craneAtSlot, POOL_SLOTS, slotName, isFresh } from '../logistics';
import { CASK_TOP_Y, CRANE, POOL_DOCK, POOL_WATER_Y, RACK_TOP_Y, slotPosition } from '../rooms/fuel-storage';
import { pushToast } from '../state/hud';
import { useMode } from '../state/mode';
import { cartDockedAt } from './cart';
import { logistics, syncLogistics } from './runtime';

export const CRANE_SPEED = 2.6; // m/s for bridge + trolley
const HOOK_SPEED = 3.2; // m/s up/down

type Target =
  { kind: 'slot'; index: number; y: number } | { kind: 'cask'; y: number } | { kind: 'none'; y: number };

/** Transient hook state (the hook's x/z live in logistics.state.crane so they're saved). */
export const hook = {
  y: CRANE.hookTopY,
  phase: 'idle' as 'idle' | 'lowering' | 'raising',
  target: { kind: 'none', y: POOL_WATER_Y } as Target,
};

/** What's directly under the hook right now. */
export function targetUnderHook(): Target {
  const { x, z } = logistics.state.crane;
  for (let i = 0; i < POOL_SLOTS; i++) {
    const p = slotPosition(i);
    if (Math.abs(p.x - x) < 0.65 && Math.abs(p.z - z) < 0.7) return { kind: 'slot', index: i, y: RACK_TOP_Y };
  }
  if (cartDockedAt('fuel-storage', POOL_DOCK.id) && Math.hypot(POOL_DOCK.x - x, POOL_DOCK.z - z) < 0.8)
    return { kind: 'cask', y: CASK_TOP_Y };
  return { kind: 'none', y: POOL_WATER_Y - 0.4 };
}

export function describeTarget(t: Target): string {
  const s = logistics.state;
  if (t.kind === 'slot') {
    const a = s.pool[t.index];
    return `Slot ${slotName(t.index)} · ${a ? `${a.id} ${isFresh(a) ? 'fresh' : `spent ${Math.round(a.burnup * 100)}%`}` : 'empty'}`;
  }
  if (t.kind === 'cask') return `Transfer cask · ${s.cart.cask.length}/2 loaded`;
  return 'Open water';
}

/** E in crane mode: lower the hook, grab or release at the bottom, raise again. */
export function startCraneCycle() {
  if (hook.phase !== 'idle') return;
  hook.target = targetUnderHook();
  hook.phase = 'lowering';
  useMode.setState({ crane: { target: describeTarget(hook.target), busy: true } });
}

function actAtBottom() {
  const s = logistics.state;
  const t = hook.target;
  const res = t.kind === 'slot' ? craneAtSlot(s, t.index) : t.kind === 'cask' ? craneAtCask(s) : null;
  if (!res) {
    pushToast({
      level: 'info',
      text: 'Nothing under the hook',
      detail: 'Line up over a rack slot or the cask.',
    });
    return;
  }
  if (!res.ok) {
    pushToast({ level: 'warn', text: 'Crane', detail: res.reason });
    return;
  }
  const a = res.placed ?? res.picked!;
  bus.emit('fuel/craned', {
    assembly: a.id,
    burnup: a.burnup,
    from: res.placed ? 'hook' : res.where,
    to: res.placed ? res.where : 'hook',
  });
}

/** Per-frame crane update: move the hook in the requested direction and run the lower/raise cycle. */
export function updateCrane(dt: number, dir: { x: number; z: number } | null) {
  const c = logistics.state.crane;
  if (hook.phase === 'idle' && dir) {
    c.x = Math.min(CRANE.maxX, Math.max(CRANE.minX, c.x + dir.x * CRANE_SPEED * dt));
    c.z = Math.min(CRANE.maxZ, Math.max(CRANE.minZ, c.z + dir.z * CRANE_SPEED * dt));
  }
  if (hook.phase === 'lowering') {
    hook.y -= HOOK_SPEED * dt;
    if (hook.y <= hook.target.y) {
      hook.y = hook.target.y;
      actAtBottom();
      syncLogistics();
      hook.phase = 'raising';
    }
  } else if (hook.phase === 'raising') {
    hook.y += HOOK_SPEED * dt;
    if (hook.y >= CRANE.hookTopY) {
      hook.y = CRANE.hookTopY;
      hook.phase = 'idle';
      useMode.setState({ crane: { target: describeTarget(targetUnderHook()), busy: false } });
    }
  }
}
