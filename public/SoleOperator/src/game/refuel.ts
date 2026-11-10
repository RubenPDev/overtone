import { bus } from '../core/events';
import { caskCapacity, caskReceive, caskTakeFresh, type Assembly } from '../logistics';
import { pushToast } from '../state/hud';
import { useMode, type RefuelPhase } from '../state/mode';
import { logistics, player, simHost, syncLogistics } from './runtime';

const cellName = (c: number) => String(c + 1).padStart(2, '0');
/** Seconds for the transfer capsule to run the chute between the cart and the machine. */
export const CHUTE_SECONDS = 1.6;
/** Seconds of holding E per machine phase at full focus. */
const PHASE_SECONDS = 2.8;

/**
 * The refuelling machine at the core. The player drives it phase by phase:
 * rod in (hold S) → extract the spent assembly (hold E) → load the fresh one (hold E).
 * The arm, cassette and chute capsule are drawn from this state every frame.
 */
export const machine = {
  cell: 6,
  phase: 'insert-rod' as RefuelPhase,
  progress: 0,
  /** Assembly in the arm's gripper. */
  arm: null as Assembly | null,
  /** Capsule in the transfer chute: t = 0 at the cart, 1 at the machine. */
  capsule: null as null | { a: Assembly; t: number; dir: 1 | -1 },
  rodHeld: false,
};

export function startRefuel(cell: number) {
  machine.cell = cell;
  machine.progress = 0;
  machine.arm = null;
  machine.capsule = null;
  machine.rodHeld = false;
  machine.phase = 'insert-rod';
  publish();
}

export function selectRefuelCell(delta: number) {
  if (machine.phase !== 'insert-rod' || machine.rodHeld) return;
  machine.cell = (machine.cell + delta + 12) % 12;
  publish();
}

export function stopRefuel() {
  if (machine.rodHeld) releaseRod();
  // An assembly left in the arm goes back to the cask so nothing is ever lost.
  if (machine.arm) caskReceive(logistics.state, machine.arm);
  if (machine.capsule) caskReceive(logistics.state, machine.capsule.a);
  machine.arm = null;
  machine.capsule = null;
  syncLogistics();
}

function releaseRod() {
  const rod = simHost.state.rods[machine.cell]!;
  bus.emit('cmd/sim', { type: 'setRodTarget', rod: machine.cell, insertion: rod.insertion });
  machine.rodHeld = false;
}

function sendFreshUp() {
  const fresh = caskTakeFresh(logistics.state);
  syncLogistics();
  if (!fresh) {
    pushToast({
      level: 'warn',
      text: 'No fresh assembly in the cask',
      detail: 'Bring one from Fuel Rod Storage.',
    });
    return;
  }
  machine.capsule = { a: fresh, t: 0, dir: 1 };
}

function publish() {
  useMode.setState({
    refuel: {
      phase: machine.phase,
      progress: machine.progress,
      busy: !!machine.capsule,
      cell: machine.cell,
      armLoaded: !!machine.arm,
    },
  });
}

/** Per-frame machine update. */
export function updateRefuel(dt: number, holdE: boolean, holdS: boolean) {
  const s = simHost.state;
  const cell = machine.cell;
  const rod = s.rods[cell]!;
  const cellState = s.cells[cell]!;

  // Capsule travel in the chute.
  const cap = machine.capsule;
  if (cap) {
    cap.t += (cap.dir * dt) / CHUTE_SECONDS;
    if (cap.dir === 1 && cap.t >= 1) {
      machine.arm = cap.a;
      machine.capsule = null;
    } else if (cap.dir === -1 && cap.t <= 0) {
      caskReceive(logistics.state, cap.a);
      syncLogistics();
      machine.capsule = null;
      pushToast({
        level: 'ok',
        text: `${cap.a.id} in the cask`,
        detail: 'Spent assembly shielded on the cart.',
      });
      if (machine.phase === 'load') sendFreshUp();
    }
  }

  const rate = (1 / PHASE_SECONDS) * (0.6 + 0.4 * player.focus);
  switch (machine.phase) {
    case 'insert-rod': {
      if (holdS && !machine.rodHeld) {
        bus.emit('cmd/sim', { type: 'setRodTarget', rod: cell, insertion: 1 });
        machine.rodHeld = true;
      } else if (!holdS && machine.rodHeld) releaseRod();
      if (rod.insertion >= 0.999) {
        machine.rodHeld = false;
        if (cellState.loaded) machine.phase = 'extract';
        else {
          machine.phase = 'load';
          sendFreshUp();
        }
      }
      break;
    }
    case 'extract': {
      if (holdE && logistics.state.cart.cask.length >= caskCapacity(logistics.state)) {
        pushToast({ level: 'warn', text: 'Cask full', detail: 'No room for the spent assembly.' });
        machine.progress = 0;
        break;
      }
      machine.progress = holdE ? machine.progress + dt * rate : Math.max(0, machine.progress - dt * 0.6);
      if (machine.progress >= 1) {
        const spent: Assembly = {
          id: cellState.assembly ?? `FA-${cellName(cell)}`,
          burnup: cellState.burnup,
        };
        bus.emit('cmd/sim', { type: 'unloadCell', cell });
        machine.capsule = { a: spent, t: 1, dir: -1 };
        machine.progress = 0;
        machine.phase = 'load';
      }
      break;
    }
    case 'load': {
      if (!machine.arm) break;
      machine.progress = holdE ? machine.progress + dt * rate : Math.max(0, machine.progress - dt * 0.6);
      if (machine.progress >= 1) {
        bus.emit('cmd/sim', { type: 'loadCell', cell, assembly: machine.arm.id, burnup: machine.arm.burnup });
        machine.arm = null;
        machine.progress = 0;
        machine.phase = 'done';
        pushToast(
          {
            level: 'info',
            text: `Rod ${cellName(cell)} is fully inserted`,
            detail: 'Fresh fuel is hot. Withdraw it slowly from the operator console (F).',
          },
          7000,
        );
      }
      break;
    }
    case 'done':
      break;
  }
}

export function publishRefuel() {
  publish();
}
