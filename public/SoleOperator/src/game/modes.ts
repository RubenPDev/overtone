import { bus } from '../core/events';
import { getRoom } from '../rooms/registry';
import { stage } from '../scene/stage';
import { useMode, type Mode } from '../state/mode';
import { describeTarget, hook, targetUnderHook } from './crane';
import { player, simHost } from './runtime';
import { selectRefuelCell, startRefuel, stopRefuel } from './refuel';
import { startCraneCycle } from './crane';
import { currentRoomId, shuttleTo } from './worldController';
import { CAVITY_COUNT, RECIPES } from '../sim';
import { sectorId } from '../rooms/ring';
import { pushToast } from '../state/hud';
import { tankFocus } from '../rooms/water-containers';
import { selectTank, weld } from './tanks';

/** Rods being driven by held W/S in rod mode (released when the key or selection changes). */
const rodDrive = { dir: 0 as -1 | 0 | 1, rods: [] as number[] };

/**
 * The E press that opens a mode must not also act inside it. Machine keys stay
 * disarmed until E has been released once after entering.
 */
export const modeInput = { armed: true };

export function enterMode(mode: Mode) {
  modeInput.armed = false;
  const roomId = currentRoomId();
  const focus = roomId && mode.kind !== 'walk' ? getRoom(roomId).focus?.[mode.kind] : undefined;
  stage.focus = mode.kind === 'tanks' ? tankFocus(mode.tank) : (focus ?? null);
  player.path = [];
  if (mode.kind === 'refuel') startRefuel(mode.cell);
  if (mode.kind === 'crane')
    useMode.setState({ crane: { target: describeTarget(targetUnderHook()), busy: hook.phase !== 'idle' } });
  useMode.setState({ mode });
  bus.emit('mode/changed', { mode: mode.kind });
}

export function exitMode() {
  const m = useMode.getState().mode;
  if (m.kind === 'walk') return;
  if (m.kind === 'refuel') stopRefuel();
  if (m.kind === 'rods') setRodDrive(0, []);
  if (m.kind === 'tanks') weld.progress = 0;
  stage.focus = null;
  useMode.setState({ mode: { kind: 'walk' } });
  bus.emit('mode/changed', { mode: 'walk' });
}

export function inMode() {
  return useMode.getState().mode.kind !== 'walk';
}

/** Start/stop driving rods: dir -1 = withdraw, +1 = insert, 0 = hold where they are. */
export function setRodDrive(dir: -1 | 0 | 1, rods: number[]) {
  const same =
    dir === rodDrive.dir &&
    rods.length === rodDrive.rods.length &&
    rods.every((r, i) => r === rodDrive.rods[i]);
  if (same) return;
  // Stop whatever was moving.
  if (rodDrive.dir !== 0)
    for (const r of rodDrive.rods)
      bus.emit('cmd/sim', { type: 'setRodTarget', rod: r, insertion: simHost.state.rods[r]!.insertion });
  rodDrive.dir = dir;
  rodDrive.rods = rods;
  if (dir !== 0)
    for (const r of rods) bus.emit('cmd/sim', { type: 'setRodTarget', rod: r, insertion: dir > 0 ? 1 : 0 });
}

const ROD_KEYS = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
  'Minus',
  'Equal',
];

/** One-shot keys inside control modes. Returns an uninstall function. */
export function installModeKeys(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const m = useMode.getState().mode;
    if (m.kind === 'rods') {
      const pick = ROD_KEYS.indexOf(e.code);
      let selected = m.selected;
      if (pick >= 0) selected = pick;
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') selected = (m.selected + 11) % 12;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') selected = (m.selected + 1) % 12;
      else if (e.code === 'KeyB') return useMode.setState({ mode: { ...m, bank: !m.bank } });
      else return;
      useMode.setState({ mode: { ...m, selected, bank: false } });
    } else if (m.kind === 'crane') {
      if (e.code === 'KeyE' && modeInput.armed) startCraneCycle();
    } else if (m.kind === 'refuel') {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') selectRefuelCell(-1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') selectRefuelCell(1);
    } else if (m.kind === 'rf') {
      const pick = ROD_KEYS.indexOf(e.code);
      let cavity = m.cavity;
      if (pick >= 0 && pick < CAVITY_COUNT) cavity = pick;
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA')
        cavity = (m.cavity + CAVITY_COUNT - 1) % CAVITY_COUNT;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') cavity = (m.cavity + 1) % CAVITY_COUNT;
      else return;
      useMode.setState({ mode: { ...m, cavity } });
    } else if (m.kind === 'production') {
      const n = RECIPES.length;
      if (e.code === 'ArrowUp' || e.code === 'KeyW')
        useMode.setState({ mode: { ...m, index: (m.index + n - 1) % n } });
      else if (e.code === 'ArrowDown' || e.code === 'KeyS')
        useMode.setState({ mode: { ...m, index: (m.index + 1) % n } });
      else if (e.code === 'KeyE' && modeInput.armed) {
        const r = RECIPES[m.index]!;
        const current = simHost.state.accel.recipe;
        bus.emit('cmd/sim', { type: 'selectRecipe', recipe: current === r.id ? null : r.id });
      } else if (e.code === 'KeyB')
        bus.emit('cmd/sim', { type: 'accelBeam', on: !simHost.state.accel.beamOn });
    } else if (m.kind === 'tanks') {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') selectTank(-1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') selectTank(1);
    } else if (m.kind === 'shuttle') {
      if (e.code === 'ArrowUp' || e.code === 'KeyW')
        useMode.setState({ mode: { ...m, index: (m.index + 7) % 8 } });
      else if (e.code === 'ArrowDown' || e.code === 'KeyS')
        useMode.setState({ mode: { ...m, index: (m.index + 1) % 8 } });
      else if (e.code === 'KeyE' && modeInput.armed) rideShuttle(m.index + 1);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

/** Ring shuttle: ride to sector k (1-8). */
export function rideShuttle(k: number) {
  const here = currentRoomId();
  const target = sectorId(k);
  if (here === target) {
    pushToast({ level: 'info', text: 'Ring shuttle', detail: 'You are already in this sector.' });
    return;
  }
  exitMode();
  shuttleTo(target);
}
