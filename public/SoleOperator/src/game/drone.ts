import { bus } from '../core/events';
import { CAVITY_X } from '../rooms/ring';
import { pushToast } from '../state/hud';
import { simHost } from './runtime';

export const DRONE_DOCK_X = -18.5;
const SPEED = 3.2; // m/s along the rail
const SCAN_SECONDS = 3;

/**
 * The RF Station's rail drone: flies along the overhead rail to the weakest
 * cavity, scans it, reports, and returns to its dock. Updated from the RF
 * Station's useFrame (it parks if you leave the room mid-flight).
 */
export const drone = {
  x: DRONE_DOCK_X,
  phase: 'docked' as 'docked' | 'out' | 'scan' | 'back',
  target: DRONE_DOCK_X,
  cavity: -1,
  t: 0,
};

export function launchDrone() {
  if (drone.phase !== 'docked') {
    pushToast({ level: 'info', text: 'Rail drone busy', detail: 'It is already out on the rail.' });
    return;
  }
  const cav = simHost.state.accel.cavities;
  let worst = 0;
  cav.forEach((c, i) => {
    if (c.field < cav[worst]!.field) worst = i;
  });
  drone.cavity = worst;
  drone.target = CAVITY_X[worst]!;
  drone.phase = 'out';
  pushToast({ level: 'info', text: 'Rail drone launched', detail: 'Scanning the cryomodule string.' });
}

export function resetDrone() {
  drone.x = DRONE_DOCK_X;
  drone.phase = 'docked';
}

export function updateDrone(dt: number) {
  const step = SPEED * dt;
  if (drone.phase === 'out' || drone.phase === 'back') {
    const goal = drone.phase === 'out' ? drone.target : DRONE_DOCK_X;
    const d = goal - drone.x;
    if (Math.abs(d) <= step) {
      drone.x = goal;
      if (drone.phase === 'out') {
        drone.phase = 'scan';
        drone.t = SCAN_SECONDS;
      } else drone.phase = 'docked';
    } else drone.x += Math.sign(d) * step;
  } else if (drone.phase === 'scan') {
    drone.t -= dt;
    if (drone.t <= 0) {
      const c = simHost.state.accel.cavities[drone.cavity]!;
      const n = String(drone.cavity + 1).padStart(2, '0');
      bus.emit('drone/scanned', { room: 'ring-s1', cavity: drone.cavity });
      pushToast(
        {
          level: c.field < 29 ? 'warn' : 'ok',
          text: `Scan · cavity ${n}`,
          detail: `Detune ${c.detune > 0 ? '+' : ''}${c.detune.toFixed(1)} kHz · field ${c.field.toFixed(1)} MV/m${c.field < 29 ? ' · retune at the RF console' : ''}`,
        },
        7000,
      );
      drone.phase = 'back';
    }
  }
}
