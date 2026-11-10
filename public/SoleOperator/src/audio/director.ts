import { bus } from '../core/events';
import { drone } from '../game/drone';
import { hook } from '../game/crane';
import { machine } from '../game/refuel';
import { logistics, player, simHost } from '../game/runtime';
import { useApp } from '../state/app';
import { useHud } from '../state/hud';
import { useMode } from '../state/mode';
import { useWorld } from '../state/world';
import { getCorridor } from '../world/facility';
import type { Space } from '../world/spaces';
import type { Vec2 } from '../world/types';
import { Bed, engine, type Place, type SpaceAcoustics } from './engine';
import * as S from './sounds';

/**
 * Maps the game onto sound. Three layers:
 *  1. Space beds: each room and corridor kind has an ambience mix (hum, air,
 *     pumps, water, cryo…) and an acoustic (reverb size). Crossfaded on change.
 *  2. Machines: loops that follow live state every frame (rod drives, crane,
 *     cart, refuelling machine, drone, footsteps, the alarm klaxon).
 *  3. Events: one-shots for bus events (scram, latches, purchases, objectives).
 *
 * Rooms added later register their mix in SPACE_MIX (see "How to add sound"
 * in the README); machines they own can be driven from their own useFrame via
 * the exported helpers.
 */

type BedKey = 'hum' | 'air' | 'pump' | 'water' | 'cryo' | 'rf' | 'magnet' | 'turbine' | 'condenser' | 'drips';

interface SpaceMix {
  acoustics: SpaceAcoustics;
  surface: 'grate' | 'concrete' | 'tile';
  /** Bed levels (0..1-ish, before the ambience volume). */
  beds: Partial<Record<BedKey, number>>;
  /** Random texture one-shots: average seconds between them. */
  texture?: { every: number; play: () => void };
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const around = (spread = 1): Place => ({ pan: rnd(-0.8, 0.8) * spread, gain: rnd(0.35, 0.8) });

/** Extra bed factories rooms can register (turbine hall, water containers). */
export const BED_FACTORIES: Partial<Record<BedKey, () => Bed>> = {
  hum: S.humBed,
  air: () => S.airBed(650),
  pump: S.pumpBed,
  water: S.waterBed,
  cryo: S.cryoBed,
  rf: S.rfBed,
  magnet: S.magnetBed,
};

export const SPACE_MIX: Record<string, SpaceMix> = {
  'control-room': {
    acoustics: 'hall',
    surface: 'tile',
    beds: { hum: 0.05, air: 0.09, pump: 0.16 },
    texture: {
      every: 5,
      play: () => {
        const r = Math.random();
        if (r < 0.55) S.sfx.keys(around());
        else if (r < 0.8) S.sfx.relay(around());
        else if (r < 0.97) S.sfx.knock(around(0.6));
        else S.sfx.pa();
      },
    },
  },
  'fuel-storage': {
    acoustics: 'hall',
    surface: 'grate',
    beds: { hum: 0.03, air: 0.07, water: 0.11 },
    texture: {
      every: 3.5,
      play: () => (Math.random() < 0.7 ? S.sfx.drip(around()) : S.sfx.knock(around(0.6))),
    },
  },
  ring: {
    acoustics: 'big-hall',
    surface: 'concrete',
    beds: { cryo: 0.11, rf: 0.03, magnet: 0.05, air: 0.04 },
    texture: {
      every: 6,
      play: () => (Math.random() < 0.6 ? S.sfx.hiss(around(), rnd(0.5, 1.4)) : S.sfx.knock(around(0.7))),
    },
  },
  'corridor:service': { acoustics: 'corridor', surface: 'tile', beds: { air: 0.08, hum: 0.02 } },
  'corridor:access': {
    acoustics: 'corridor',
    surface: 'concrete',
    beds: { air: 0.1, hum: 0.015 },
    texture: { every: 8, play: () => S.sfx.knock(around(0.5)) },
  },
  'corridor:ring': {
    acoustics: 'tunnel',
    surface: 'concrete',
    beds: { magnet: 0.06, cryo: 0.04, rf: 0.015, air: 0.03 },
    texture: { every: 9, play: () => S.sfx.hiss(around(), rnd(0.6, 1.6)) },
  },
};

function mixKey(space: Space): string {
  if (space.kind === 'room') {
    if (SPACE_MIX[space.room]) return space.room;
    return space.room.startsWith('ring-') ? 'ring' : 'control-room';
  }
  return `corridor:${getCorridor(space.corridor).kind ?? 'service'}`;
}

// --- Spatial helpers ------------------------------------------------------------------------

/** Stereo pan and distance gain for a point in the current room, relative to the Operator. */
export function placeAt(p: Vec2, reach = 9): Place {
  const dx = p.x - player.pos.x;
  const dz = p.z - player.pos.z;
  // Iso camera: screen-right is +x/−z.
  const screenX = (dx - dz) * Math.SQRT1_2;
  const d = Math.hypot(dx, dz);
  return { pan: Math.max(-0.9, Math.min(0.9, screenX / 14)), gain: 1 / (1 + (d / reach) ** 1.5) };
}

/** Sliding doors call this when they start to open or close. */
export function doorSound(open: boolean, at: Vec2) {
  const p = placeAt(at, 7);
  if ((p.gain ?? 1) > 0.08) S.sfx.door(open, p);
}

// --- State --------------------------------------------------------------------------------

const beds = new Map<BedKey, Bed>();
let currentMix: SpaceMix | null = null;
let textureIn = 4;
const machines: Partial<Record<'rods' | 'crane' | 'hoist' | 'cart' | 'hydraulic' | 'drone' | 'klaxon', Bed>> =
  {};
let stepAcc = 0;
let stepSide = 1;
let lastRods: number[] = [];
let lastCrane = { x: 0, z: 0 };
let lastHookPhase = 'idle';
let lastMachine = 0;
let lastDronePhase = 'docked';
let lastUiAt = 0;
let lastToastId = 0;
let duck = 1;

function machine_(key: keyof typeof machines, make: () => Bed): Bed {
  let b = machines[key];
  if (!b) machines[key] = b = make();
  return b;
}

function applyMix(mix: SpaceMix) {
  currentMix = mix;
  engine.setAcoustics(mix.acoustics);
  for (const [key, bed] of beds) {
    if (!(key in mix.beds)) {
      bed.stop(1.2);
      beds.delete(key);
    }
  }
  for (const [key, level] of Object.entries(mix.beds) as [BedKey, number][]) {
    let bed = beds.get(key);
    if (!bed) {
      const make = BED_FACTORIES[key];
      if (!make) continue;
      bed = make();
      beds.set(key, bed);
    }
    bed.level(level, 1.5);
  }
  textureIn = rnd(1, mix.texture?.every ?? 10);
}

function stopAll() {
  for (const bed of beds.values()) bed.stop(0.8);
  beds.clear();
  for (const k of Object.keys(machines) as (keyof typeof machines)[]) {
    machines[k]?.stop(0.3);
    delete machines[k];
  }
  currentMix = null;
}

function syncVolumes() {
  const a = useApp.getState().settings.audio;
  engine.setVolumes({ master: a.master, sfx: a.sfx, ambience: a.ambience * duck });
}

/** Mark a specific UI sound so the generic toast chime doesn't double it. */
function uiSound(fn: () => void) {
  lastUiAt = performance.now();
  fn();
}

// --- Per-frame update ----------------------------------------------------------------------

/** Called every frame from <AudioDriver> inside the canvas. */
export function updateAudio(dt: number) {
  if (!engine.ready) return;
  const app = useApp.getState();
  if (app.screen !== 'game') {
    if (currentMix) stopAll();
    return;
  }
  const world = useWorld.getState();
  const key = mixKey(world.space);
  const mix = SPACE_MIX[key]!;
  if (mix !== currentMix) applyMix(mix);

  const state = simHost.state;
  const room = world.space.kind === 'room' ? world.space.room : null;

  // Live bed parameters.
  const pump = beds.get('pump');
  if (pump && mix.beds.pump) {
    pump.level(mix.beds.pump * (0.25 + 0.75 * Math.min(1.2, state.coolantFlow)), 0.8);
    pump.set('turbulence', 0.08 + 0.25 * Math.min(1.2, state.thermalPower / 3700), 1);
    pump.pan(placeAt({ x: 0, z: 0 }, 30).pan ?? 0);
  }
  const rf = beds.get('rf');
  if (rf && mix.beds.rf)
    rf.level(mix.beds.rf * (state.accel.beamOn ? 0.3 + state.accel.current / 2.8 : 0.05), 1);

  // Texture one-shots.
  if (mix.texture && !app.overlay) {
    textureIn -= dt;
    if (textureIn <= 0) {
      mix.texture.play();
      textureIn = rnd(0.4, 1.6) * mix.texture.every;
    }
  }

  // Footsteps.
  const moving = !player.locked && world.transition.phase === 'idle' && player.speed > 0.3;
  if (moving) {
    const sprint = player.speed > 3.6;
    stepAcc += player.speed * dt;
    const stride = sprint ? 1.05 : 0.78;
    if (stepAcc >= stride) {
      stepAcc -= stride;
      stepSide = -stepSide;
      S.sfx.step(mix.surface, { pan: stepSide * 0.08, gain: 0.9 }, sprint);
    }
  } else stepAcc = 0.5;

  // Rod drives (heard in Reactor Control).
  let rodMotion = 0;
  state.rods.forEach((r, i) => {
    rodMotion += Math.abs(r.insertion - (lastRods[i] ?? r.insertion));
  });
  lastRods = state.rods.map((r) => r.insertion);
  if (room === 'control-room' && rodMotion > 1e-6 && !state.scrammed) {
    const b = machine_('rods', S.rodDriveBed);
    const n = Math.min(12, rodMotion / 0.0005);
    b.level(0.07 + 0.012 * n, 0.08);
    b.set('rate', 560 + n * 12, 0.1);
    b.pan(placeAt({ x: 0, z: 0 }).pan ?? 0);
  } else machines.rods?.level(0, 0.15);

  // Fuel crane bridge and hoist.
  const crane = logistics.state.crane;
  const craneMoved = Math.hypot(crane.x - lastCrane.x, crane.z - lastCrane.z);
  lastCrane = { x: crane.x, z: crane.z };
  if (room === 'fuel-storage') {
    const p = placeAt(crane, 14);
    if (craneMoved > 1e-4) {
      const b = machine_('crane', () => S.motorBed(120));
      b.level(0.09 * (p.gain ?? 1), 0.1);
      b.pan(p.pan ?? 0);
    } else machines.crane?.level(0, 0.25);
    if (hook.phase !== 'idle') {
      const b = machine_('hoist', () => S.motorBed(210));
      b.level(0.07 * (p.gain ?? 1), 0.08);
      b.set('rate', hook.phase === 'lowering' ? 190 : 230, 0.3);
      b.pan(p.pan ?? 0);
    } else machines.hoist?.level(0, 0.2);
    if (hook.phase !== lastHookPhase && hook.phase !== 'idle') S.sfx.chain(p);
  } else {
    machines.crane?.level(0, 0.2);
    machines.hoist?.level(0, 0.2);
  }
  lastHookPhase = hook.phase;

  // Transfer cart.
  const cart = logistics.state.cart;
  if (cart.attached && moving) {
    const b = machine_('cart', S.cartBed);
    b.level(0.05 + 0.03 * Math.min(1.5, player.speed / 3), 0.15);
  } else machines.cart?.level(0, 0.2);

  // Refuelling machine hydraulics.
  const mProg = machine.progress + (machine.capsule?.t ?? 0);
  const mode = useMode.getState().mode.kind;
  if (room === 'control-room' && mode === 'refuel' && Math.abs(mProg - lastMachine) > 1e-5) {
    machine_('hydraulic', S.hydraulicBed).level(0.09, 0.08);
  } else machines.hydraulic?.level(0, 0.25);
  lastMachine = mProg;

  // RF Station rail drone.
  if (room === 'ring-s1' && (drone.phase === 'out' || drone.phase === 'back')) {
    const b = machine_('drone', () => S.motorBed(330));
    const p = placeAt({ x: drone.x, z: -3.6 }, 16);
    b.level(0.05 * (p.gain ?? 1), 0.1);
    b.pan(p.pan ?? 0);
  } else machines.drone?.level(0, 0.3);
  if (room === 'ring-s1' && drone.phase === 'scan' && lastDronePhase !== 'scan')
    S.sfx.dronePing(placeAt({ x: drone.x, z: -3.6 }, 16));
  lastDronePhase = drone.phase;

  // Alarm klaxon: sounding while any alarm is unacknowledged.
  const acked = useHud.getState().acked;
  const unacked = state.alarms.some((a) => !acked.includes(a));
  if (unacked) machine_('klaxon', S.klaxonBed).level(0.27, 0.05);
  else machines.klaxon?.level(0, 0.3);
}

// --- Events -------------------------------------------------------------------------------

function onRing() {
  const s = useWorld.getState().space;
  return s.kind === 'room' ? s.room.startsWith('ring-') : getCorridor(s.corridor).kind === 'ring';
}
const inRoom = (id: string) => {
  const s = useWorld.getState().space;
  return s.kind === 'room' && s.room === id;
};

let installed = false;

/** Wire the director to the bus, the stores and the page. Call once. */
export function installAudio() {
  if (installed) return;
  installed = true;

  const unlock = () => engine.unlock();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? engine.suspend() : engine.resume()));
  document.addEventListener(
    'click',
    (e) => {
      const b = (e.target as HTMLElement | null)?.closest?.('button');
      if (b && !b.disabled) S.ui.click();
    },
    { capture: true },
  );

  engine.whenReady(syncVolumes);
  useApp.subscribe((s, prev) => {
    if (s.settings.audio !== prev.settings.audio) syncVolumes();
    if (s.overlay !== prev.overlay) {
      duck = s.overlay === 'pause' || s.overlay === 'map' || s.overlay === 'settings' ? 0.35 : 1;
      syncVolumes();
      if (prev.overlay === 'ops' && !s.overlay) S.ui.close();
    }
  });

  // The ring shuttle spools up as its transition starts.
  useWorld.subscribe((s, prev) => {
    if (
      s.transition.phase === 'out' &&
      prev.transition.phase !== 'out' &&
      s.transition.title === 'RING SHUTTLE'
    )
      S.shuttleRide();
  });

  // Generic chimes for toasts; specific sounds below take precedence.
  useHud.subscribe((s) => {
    const t = s.toasts[s.toasts.length - 1];
    if (!t || t.id <= lastToastId) return;
    lastToastId = t.id;
    if (performance.now() - lastUiAt < 300) return;
    if (t.level === 'info') S.ui.info();
    else if (t.level === 'ok') S.ui.ok();
    else if (t.level === 'warn') S.ui.warn();
  });

  bus.on('sim', (e) => {
    switch (e.type) {
      case 'scram':
        return uiSound(S.sfx.scram);
      case 'scramReset':
        return uiSound(() => S.sfx.relay());
      case 'cellLoaded':
      case 'cellUnloaded':
        if (inRoom('control-room')) uiSound(() => S.sfx.clunk(placeAt({ x: 0, z: 0 }, 20), 1.2));
        return;
      case 'commandRejected':
        return uiSound(S.ui.deny);
      case 'beamTrip':
        if (onRing()) uiSound(() => S.sfx.beamTrip());
        return;
      case 'beamStarted':
        if (onRing()) uiSound(() => S.sfx.beamStart());
        return;
      case 'cavityTuned':
        return uiSound(() => S.sfx.lock());
      case 'contractCompleted':
      case 'sold':
      case 'purchased':
        return uiSound(S.ui.cash);
      case 'clearanceRaised':
        return uiSound(S.ui.complete);
    }
  });
  bus.on('objective/step', () => uiSound(S.ui.step));
  bus.on('objective/completed', () => uiSound(S.ui.complete));
  bus.on('fuel/craned', (e) => {
    const p = placeAt(logistics.state.crane, 14);
    S.sfx.clunk(p, 0.8);
    if (e.from === 'pool' || e.to === 'pool') S.sfx.splash(p);
  });
  bus.on('cart/docked', () => {
    const c = logistics.state.cart;
    const p = placeAt(c, 10);
    S.sfx.clunk(p);
    S.sfx.hiss(p, 0.6);
  });
  bus.on('cart/attached', () => S.sfx.relay(placeAt(logistics.state.cart, 10)));
  bus.on('cart/parked', () => S.sfx.clunk(placeAt(logistics.state.cart, 10), 0.7));
  bus.on('mode/changed', (e) => (e.mode === 'walk' ? S.ui.close() : S.sfx.relay()));
  bus.on('ui/opened', (e) => uiSound(e.panel === 'scanner' ? S.ui.scan : S.ui.open));
  bus.on('game/saved', (e) => {
    if (!e.auto) uiSound(S.ui.save);
  });
}
