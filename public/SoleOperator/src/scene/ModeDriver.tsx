import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { createThrottle } from '../core/clock';
import { updateCrane } from '../game/crane';
import { isDown, keyboardDir } from '../game/input';
import { installModeKeys, modeInput, setRodDrive } from '../game/modes';
import { publishRefuel, updateRefuel } from '../game/refuel';
import { useApp } from '../state/app';
import { useMode } from '../state/mode';

/**
 * Runs the active control mode every frame: held keys drive rods, the crane
 * or the refuelling machine. Nothing here causes React renders except the
 * throttled refuel readout.
 */
export function ModeDriver() {
  const throttle = useMemo(() => createThrottle(10), []);
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
    } else if (mode.kind === 'refuel') {
      updateRefuel(dt, !menu && modeInput.armed && isDown('KeyE'), !menu && isDown('KeyS', 'ArrowDown'));
      if (throttle(dt)) publishRefuel();
    }
  });
  return null;
}
