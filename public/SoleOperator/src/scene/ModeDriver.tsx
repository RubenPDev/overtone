import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { createThrottle } from '../core/clock';
import { bus } from '../core/events';
import { updateCrane } from '../game/crane';
import { isDown, keyboardDir } from '../game/input';
import { installModeKeys, modeInput, setRodDrive } from '../game/modes';
import { publishRefuel, updateRefuel } from '../game/refuel';
import { useApp } from '../state/app';
import { useMode } from '../state/mode';
import { VALVE_RATE, updateWeld, weld } from '../game/tanks';

/**
 * Runs the active control mode every frame: held keys drive rods, the crane
 * or the refuelling machine. Nothing here causes React renders except the
 * throttled refuel readout.
 */
export function ModeDriver() {
  const throttle = useMemo(() => createThrottle(10), []);
  const tuneThrottle = useMemo(() => createThrottle(10), []);
  const tune = useMemo(() => ({ acc: 0 }), []);
  useEffect(() => installModeKeys(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const mode = useMode.getState().mode;
    const menu = useApp.getState().overlay !== null;
    if (!modeInput.armed && !isDown('KeyE')) modeInput.armed = true;

    if (mode.kind === 'rods') {
      const up = !menu && isDown('KeyW', 'ArrowUp');
      const down = !menu && isDown('KeyS', 'ArrowDown');
      const dir = up === down ? 0 : up ? -1 : 1;
      const rods = mode.bank ? Array.from({ length: 12 }, (_, i) => i) : [mode.selected];
      setRodDrive(dir, rods);
    } else if (mode.kind === 'crane') {
      updateCrane(dt, menu ? null : keyboardDir());
    } else if (mode.kind === 'rf') {
      // Hold W/S to sweep the selected cavity's frequency (Shift = fine). Sent to the sim at 10 Hz.
      const up = !menu && isDown('KeyW', 'ArrowUp');
      const down = !menu && isDown('KeyS', 'ArrowDown');
      const rate = isDown('ShiftLeft', 'ShiftRight') ? 1.5 : 7;
      tune.acc += (up ? rate : 0) * dt - (down ? rate : 0) * dt;
      if (tuneThrottle(dt) && Math.abs(tune.acc) > 1e-4) {
        bus.emit('cmd/sim', { type: 'tuneCavity', cavity: mode.cavity, deltaKHz: tune.acc });
        tune.acc = 0;
      }
    } else if (mode.kind === 'tanks') {
      // Hold W/S to open/close the outlet valve (sent at 10 Hz); hold E to weld a patch.
      const up = !menu && isDown('KeyW', 'ArrowUp');
      const down = !menu && isDown('KeyS', 'ArrowDown');
      tune.acc += ((up ? 1 : 0) - (down ? 1 : 0)) * VALVE_RATE * dt;
      if (tuneThrottle(dt) && Math.abs(tune.acc) > 1e-4) {
        bus.emit('cmd/sim', { type: 'turnValve', tank: mode.tank, delta: tune.acc });
        tune.acc = 0;
      }
      updateWeld(dt, mode.tank, !menu && modeInput.armed && isDown('KeyE'));
      if (throttle(dt) && Math.abs(useMode.getState().weld - weld.progress) > 0.005)
        useMode.setState({ weld: weld.progress });
    } else if (mode.kind === 'refuel') {
      updateRefuel(dt, !menu && modeInput.armed && isDown('KeyE'), !menu && isDown('KeyS', 'ArrowDown'));
      if (throttle(dt)) publishRefuel();
    }
  });
  return null;
}
