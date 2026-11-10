import { bus } from '../core/events';
import { bearingFocus } from '../rooms/turbine-hall';
import { stage } from '../scene/stage';
import { MAX_WEIGHT_G } from '../sim';
import { pushToast } from '../state/hud';
import { useMode } from '../state/mode';
import { simHost } from './runtime';

export const ANALYZE_SECONDS = 3;
export const SERVICE_SECONDS = 4;
export const FIT_SECONDS = 2.6;

/**
 * Turbine hall jobs. Hold-to-act progress lives here (read by visuals every
 * frame) and is mirrored to the mode store at ~10 Hz for the panels.
 */
export const job = {
  progress: 0,
  /** Balance weight being fitted: the crew is at the rotor and it's on turning gear. */
  fitting: false,
  pending: null as null | { angle: number; mass: number },
};

export function selectBearing(delta: number) {
  const m = useMode.getState().mode;
  if (m.kind !== 'analyze') return;
  const bearing = (m.bearing + delta + 4) % 4;
  job.progress = 0;
  stage.focus = bearingFocus(bearing);
  useMode.setState({ mode: { ...m, bearing } });
}

/** Hold E at a bearing: run the vibration analysis. */
export function updateAnalyze(dt: number, bearing: number, holdE: boolean) {
  const a = useMode.getState().analysis;
  if (a && a.bearing === bearing) return;
  if (!holdE) {
    job.progress = Math.max(0, job.progress - dt);
    return;
  }
  job.progress += dt / ANALYZE_SECONDS;
  if (job.progress >= 1) {
    job.progress = 0;
    useMode.setState({ analysis: { bearing, at: simHost.state.time } });
    bus.emit('turbine/analyzed', { bearing });
  }
}

/** Hold E at feed pump B: grease the motor bearings. */
export function updateService(dt: number, holdE: boolean) {
  if (!holdE) {
    job.progress = Math.max(0, job.progress - dt);
    return;
  }
  job.progress += dt / SERVICE_SECONDS;
  if (job.progress >= 1) {
    job.progress = 0;
    bus.emit('cmd/sim', { type: 'serviceFeedPump' });
  }
}

/** Balance station: adjust the trial weight with held keys. */
export function adjustWeight(dAngle: number, dMass: number) {
  const m = useMode.getState().mode;
  if (m.kind !== 'balance' || job.fitting) return;
  const angle = (((m.angle + dAngle) % 360) + 360) % 360;
  const mass = Math.max(0, Math.min(MAX_WEIGHT_G, m.mass + dMass));
  if (angle !== m.angle || mass !== m.mass) useMode.setState({ mode: { ...m, angle, mass } });
}

/** E at the balance station: the crew fits the weight, then the rotor spins back up. */
export function startFit() {
  const m = useMode.getState().mode;
  if (m.kind !== 'balance' || job.fitting) return;
  job.fitting = true;
  job.progress = 0;
  job.pending = { angle: Math.round(m.angle), mass: Math.round(m.mass) };
}

export function updateFit(dt: number) {
  if (!job.fitting || !job.pending) return;
  job.progress += dt / FIT_SECONDS;
  if (job.progress >= 1) {
    const w = job.pending;
    job.fitting = false;
    job.pending = null;
    job.progress = 0;
    bus.emit('cmd/sim', { type: 'fitBalanceWeight', angle: w.angle, mass: w.mass });
    useMode.setState((s) => ({
      trials: [...s.trials.slice(-5), { angle: w.angle, mass: w.mass, vib: null }],
    }));
  }
}

// Fill in the trial's result when the sim reports it.
bus.on('sim', (e) => {
  if (e.type !== 'weightFitted') return;
  useMode.setState((s) => {
    const trials = [...s.trials];
    const last = trials[trials.length - 1];
    if (last && last.vib === null) trials[trials.length - 1] = { ...last, vib: e.vibration };
    return { trials };
  });
});

/** Local desk: reset a vibration trip once the rotor is balanced. */
export function deskReset() {
  if (!simHost.state.turbine.tripped) {
    pushToast({ level: 'info', text: 'Turbine B on line', detail: 'Nothing to reset.' });
    return;
  }
  bus.emit('cmd/sim', { type: 'resetTurbine' });
}
