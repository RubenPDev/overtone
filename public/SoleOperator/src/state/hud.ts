import { create } from 'zustand';
import type { GameSpeed } from '../core/clock';
import type { ToastLevel } from '../core/events';
import {
  averageInsertion,
  coreStatus,
  type AccelState,
  type Criticality,
  type EconState,
  type WaterState,
  type PlantState,
  type Stability,
} from '../sim';
import type { GraphPosition } from '../world/facility';

/** The slice of plant state the HUD shows, copied from the sim a few times per second. */
export interface HudSim {
  tick: number;
  time: number;
  thermalPower: number;
  output: number;
  coreTemp: number;
  pressure: number;
  reactivity: number;
  keff: number;
  rodsIn: number;
  rods: number[];
  cells: { loaded: boolean; burnup: number }[];
  coolantFlow: number;
  turbineVibration: number;
  scrammed: boolean;
  alarms: string[];
  criticality: Criticality;
  stability: Stability;
  netOutput: number;
  /** Accelerator snapshot (copied, so the HUD never holds live sim objects). */
  accel: AccelState;
  econ: EconState;
  water: WaterState;
}

export function toHudSim(s: Readonly<PlantState>): HudSim {
  return {
    tick: s.tick,
    time: s.time,
    thermalPower: s.thermalPower,
    output: s.output,
    coreTemp: s.coreTemp,
    pressure: s.pressure,
    reactivity: s.reactivity,
    keff: s.keff,
    rodsIn: averageInsertion(s),
    rods: s.rods.map((r) => r.insertion),
    cells: s.cells.map((c) => ({ loaded: c.loaded, burnup: c.burnup })),
    coolantFlow: s.coolantFlow,
    turbineVibration: s.turbineVibration,
    scrammed: s.scrammed,
    alarms: [...s.alarms],
    netOutput: s.netOutput,
    accel: {
      ...s.accel,
      cavities: s.accel.cavities.map((c) => ({ ...c })),
      stock: { ...s.accel.stock },
      detuned: [...s.accel.detuned],
    },
    econ: {
      ...s.econ,
      upgrades: { ...s.econ.upgrades },
      contracts: s.econ.contracts.map((c) => ({ ...c })),
    },
    water: { ...s.water, tanks: s.water.tanks.map((t) => ({ ...t })) },
    ...coreStatus(s),
  };
}

export interface HudPlayer {
  x: number;
  z: number;
  yaw: number;
  stamina: number;
  focus: number;
  dose: number;
}

export interface HudObjective {
  title: string;
  kind: 'main' | 'side';
  steps: { text: string; detail?: string; state: 'done' | 'active' | 'todo' }[];
  target: { room: string; interactable?: string } | null;
}

export interface Toast {
  id: number;
  text: string;
  detail?: string;
  level: ToastLevel;
}

interface HudState {
  sim: HudSim | null;
  player: HudPlayer;
  graphPos: GraphPosition;
  objective: HudObjective | null;
  speed: GameSpeed;
  toasts: Toast[];
  /** Alarms acknowledged at the alarm panel (beacons go steady instead of spinning). */
  acked: string[];
  /** Handheld scanner readout on (Q). */
  scanner: boolean;
}

export const useHud = create<HudState>()(() => ({
  sim: null,
  player: { x: 0, z: 0, yaw: 0, stamina: 1, focus: 0.88, dose: 0 },
  graphPos: { room: 'control-room' },
  objective: null,
  speed: 1,
  toasts: [],
  acked: [],
  scanner: false,
}));

let toastId = 0;
export function pushToast(t: Omit<Toast, 'id'>, ms = 4200): void {
  const id = ++toastId;
  useHud.setState((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
  setTimeout(() => useHud.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), ms);
}
