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
import { simHost } from '../game/runtime';
import { VALVE_RATE, updateWeld, weld } from '../game/tanks';
import { adjustWeight, job, updateAnalyze, updateFit, updateService } from '../game/turbine';

/**
 * Runs the active control mode every frame: held keys drive rods, the crane
 * or the refuelling machine. Nothing here causes React renders except the
 * throttled refuel readout.
 */
export function ModeDriver() {
  const throttle = useMemo(() => createThrottle(10), []);
  const tuneThrottle = useMemo(() => createThrottle(10), []);
  const tune = useMemo(() => ({ acc: 0, acc2: 0, hold: 0 }), []);
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
      // Hold X for a second: scram (or, once scrammed, reset the scram).
      if (!menu && isDown('KeyX')) {
        tune.hold += dt;
        if (tune.hold >= 1) {
          tune.hold = -10; // one action per hold
          bus.emit('cmd/sim', { type: simHost.state.scrammed ? 'resetScram' : 'scram' });
        }
      } else tune.hold = 0;
      if (throttle(dt)) {
        const h = Math.max(0, tune.hold);
        if (Math.abs(useMode.getState().hold - h) > 0.01) useMode.setState({ hold: h });
      }
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
    } else if (mode.kind === 'analyze' || mode.kind === 'service' || mode.kind === 'balance') {
      const holdE = !menu && modeInput.armed && isDown('KeyE');
      if (mode.kind === 'analyze') updateAnalyze(dt, mode.bearing, holdE);
      if (mode.kind === 'service') updateService(dt, holdE);
      if (mode.kind === 'balance') {
        // Hold A/D to swing the weight round the rotor (Shift = fine), W/S to change its mass.
        const fine = isDown('ShiftLeft', 'ShiftRight') ? 0.25 : 1;
        const turn = (isDown('KeyD', 'ArrowRight') ? 1 : 0) - (isDown('KeyA', 'ArrowLeft') ? 1 : 0);
        const grow = (isDown('KeyW', 'ArrowUp') ? 1 : 0) - (isDown('KeyS', 'ArrowDown') ? 1 : 0);
        if (!menu && (turn || grow)) {
          tune.acc += turn * 80 * fine * dt;
          tune.acc2 += grow * 50 * fine * dt;
          const da = Math.trunc(tune.acc);
          const dm = Math.trunc(tune.acc2);
          if (da || dm) {
            adjustWeight(da, dm);
            tune.acc -= da;
            tune.acc2 -= dm;
          }
        }
        updateFit(dt);
      }
      if (throttle(dt)) {
        const j = useMode.getState().job;
        if (Math.abs(j.progress - job.progress) > 0.005 || j.fitting !== job.fitting)
          useMode.setState({ job: { progress: job.progress, fitting: job.fitting } });
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
