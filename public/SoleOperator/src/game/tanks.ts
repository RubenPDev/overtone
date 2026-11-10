import { bus } from '../core/events';
import { tankFocus } from '../rooms/water-containers';
import { stage } from '../scene/stage';
import { VALVE_CLOSED } from '../sim';
import { pushToast } from '../state/hud';
import { useMode } from '../state/mode';
import { simHost } from './runtime';

export const WELD_SECONDS = 3.5;
/** Valve stroke rate while W/S is held (fraction per second). */
export const VALVE_RATE = 0.4;

/** Weld patch in progress (read by the tank visuals for sparks). */
export const weld = { tank: -1, progress: 0, active: false };
let hinted = 0;

const name = (i: number) => `T-${i + 1}`;

/** Worst tank to open the ops panel on: leaking first, then lowest. */
export function worstTank(): number {
  const tanks = simHost.state.water.tanks;
  let best = 0;
  tanks.forEach((t, i) => {
    const b = tanks[best]!;
    if ((t.leak > 0 && b.leak === 0) || (t.leak > 0 === b.leak > 0 && t.level < b.level)) best = i;
  });
  return best;
}

export function selectTank(delta: number) {
  const m = useMode.getState().mode;
  if (m.kind !== 'tanks') return;
  const n = simHost.state.water.tanks.length;
  const tank = (m.tank + delta + n) % n;
  weld.progress = 0;
  stage.focus = tankFocus(tank);
  useMode.setState({ mode: { ...m, tank } });
}

/** Hold E to weld a patch on the selected tank (valve must be closed, tank leaking). */
export function updateWeld(dt: number, tank: number, holdE: boolean) {
  const t = simHost.state.water.tanks[tank];
  weld.tank = tank;
  weld.active = false;
  if (!t || !holdE) {
    weld.progress = Math.max(0, weld.progress - dt * 0.5);
    return;
  }
  const now = performance.now();
  if (t.leak <= 0) {
    if (now > hinted) {
      hinted = now + 4000;
      pushToast({ level: 'info', text: `${name(tank)} is sound`, detail: 'No leak to patch on this tank.' });
    }
    return;
  }
  if (t.valve > VALVE_CLOSED) {
    if (now > hinted) {
      hinted = now + 4000;
      pushToast({
        level: 'warn',
        text: 'Valve still open',
        detail: `Hold S to close ${name(tank)}'s outlet before welding.`,
      });
    }
    return;
  }
  weld.active = true;
  weld.progress += dt / WELD_SECONDS;
  if (weld.progress >= 1) {
    weld.progress = 0;
    weld.active = false;
    bus.emit('cmd/sim', { type: 'repairTank', tank });
  }
}
