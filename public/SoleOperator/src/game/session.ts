import type { GameSpeed } from '../core/clock';
import { bus } from '../core/events';
import {
  SAVE_VERSION,
  defaultStorage,
  latestSave,
  writeSave,
  type SaveData,
  type SaveSlot,
} from '../core/save';
import { FIRST_OBJECTIVE } from '../objectives/definitions';
import type { ObjectiveProgress } from '../objectives/runner';
import { START_ROOM, getRoom } from '../rooms/registry';
import { RECIPE_BY_ID, type AlarmId } from '../sim';
import { useApp } from '../state/app';
import { pushToast, useHud, type HudObjective } from '../state/hud';
import { useWorld } from '../state/world';
import { arrivalPoint } from '../world/geometry';
import { initialLogistics } from '../logistics';
import { logistics, objectives, player, session, simHost, syncLogistics } from './runtime';
import { exitMode } from './modes';
import { placeInRoom } from './worldController';

const storage = defaultStorage();
const AUTOSAVE_MS = 120_000;
let autosaveTimer: ReturnType<typeof setInterval> | null = null;
/** Speed to restore when a menu that paused the game closes. */
let speedBeforePause: GameSpeed = 1;

// --- Speed / pause -------------------------------------------------------------

export function setSpeed(speed: GameSpeed) {
  simHost.setSpeed(speed);
  useHud.setState({ speed });
}

export function togglePause() {
  if (simHost.speed === 0) setSpeed(speedBeforePause || 1);
  else {
    speedBeforePause = simHost.speed;
    setSpeed(0);
  }
}

/** Menus (pause, map) freeze the plant and the player; closing them restores the previous speed. */
export function openMenu(overlay: 'pause' | 'map') {
  if (useApp.getState().overlay === null) {
    speedBeforePause = simHost.speed;
    simHost.setSpeed(0);
  }
  player.locked = true;
  useApp.getState().setOverlay(overlay);
}

export function closeMenu() {
  useApp.getState().setOverlay(null);
  simHost.setSpeed(useHud.getState().speed === 0 ? 0 : speedBeforePause);
  if (useWorld.getState().transition.phase === 'idle') player.locked = false;
}

// --- New / continue / save -------------------------------------------------------

function resetCommon() {
  player.path = [];
  player.stamina = 1;
  player.focus = 0.88;
  player.locked = false;
  exitMode();
  useWorld.setState({ near: null, waypoint: null });
  useHud.setState({ toasts: [] });
}

export function newGame() {
  session.seed = `unit-1-${Date.now().toString(36)}`;
  simHost.reset(session.seed);
  player.dose = 0;
  logistics.state = initialLogistics();
  syncLogistics();
  resetCommon();
  placeInRoom(START_ROOM);
  objectives.load({ active: null, step: 0, completed: [] });
  objectives.start(FIRST_OBJECTIVE);
  setSpeed(1);
  startAutosave();
  useApp.getState().setScreen('game');
  pushToast(
    { level: 'info', text: 'Shift started · Unit 1', detail: 'You are the only licensed operator on site.' },
    5000,
  );
}

export function hasSave(): boolean {
  return latestSave(storage) !== null;
}

export function continueGame(): boolean {
  const found = latestSave(storage);
  if (!found) return false;
  const d = found.data;
  session.seed = d.seed;
  simHost.restore(d.sim);
  resetCommon();
  player.focus = d.world.focus;
  player.dose = d.world.dose;
  logistics.state = structuredClone(d.logistics);
  syncLogistics();
  placeInRoom(d.world.room, { position: d.world.player, facing: player.yaw });
  objectives.load(d.objectives);
  setSpeed(1);
  startAutosave();
  useApp.getState().setScreen('game');
  pushToast({ level: 'info', text: 'Save loaded', detail: new Date(d.savedAt).toLocaleString() });
  return true;
}

export function saveGame(slot: SaveSlot): boolean {
  const space = useWorld.getState().space;
  // In a corridor, save at the door of the room the player came from.
  const world =
    space.kind === 'room'
      ? { room: space.room, player: { ...player.pos } }
      : (() => {
          const room = getRoom(space.from);
          const door = room.doorways.find((d) => d.corridor === space.corridor);
          return {
            room: space.from,
            player: door ? arrivalPoint(room, door.id).position : room.spawn.position,
          };
        })();
  const data: SaveData = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    seed: session.seed,
    sim: simHost.snapshot(),
    world: { ...world, focus: player.focus, dose: player.dose },
    objectives: objectives.save(),
    logistics: saveLogistics(world.room),
  };
  const ok = writeSave(storage, slot, data);
  if (ok) bus.emit('game/saved', { slot, auto: slot === 'auto' });
  return ok;
}

/** A cart being pushed through a corridor is saved parked next to the player in the room they left. */
function saveLogistics(room: string) {
  const l = structuredClone(logistics.state);
  if (l.cart.attached) l.cart.room = room;
  return l;
}

function startAutosave() {
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = setInterval(() => {
    if (useApp.getState().screen === 'game') saveGame('auto');
  }, AUTOSAVE_MS);
}

export function quitToTitle() {
  exitMode();
  saveGame('auto');
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = null;
  simHost.setSpeed(0);
  useApp.getState().setScreen('title');
}

// --- Bus → HUD wiring ------------------------------------------------------------

const ALARM_TEXT: Record<AlarmId, string> = {
  'core-temp-high': 'Core temperature high',
  'pressure-high': 'Primary pressure high',
  'power-high': 'Thermal power above 110%',
  'turbine-vibration': 'Turbine B vibration rising',
};

bus.on('sim', (e) => {
  switch (e.type) {
    case 'alarm':
      return pushToast({ level: 'alarm', text: ALARM_TEXT[e.alarm] }, 6000);
    case 'alarmCleared':
      return pushToast({ level: 'ok', text: `${ALARM_TEXT[e.alarm]} · cleared` });
    case 'scram':
      return pushToast({ level: 'alarm', text: 'Reactor scram', detail: 'All rods inserted.' }, 6000);
    case 'scramReset':
      return pushToast({ level: 'ok', text: 'Scram reset', detail: 'Rod drives unlatched.' });
    case 'commandRejected':
      return pushToast({ level: 'warn', text: 'Command refused', detail: e.reason });
    case 'cellLoaded':
      return pushToast({
        level: 'ok',
        text: `Cell ${String(e.cell + 1).padStart(2, '0')} loaded`,
        detail: `${e.assembly} seated`,
      });
    case 'cellSpent':
      return pushToast({
        level: 'warn',
        text: `Cell ${String(e.cell + 1).padStart(2, '0')} spent`,
        detail: 'Burn-up past 98%.',
      });
    case 'beamTrip':
      return pushToast({ level: 'alarm', text: 'Accelerator beam trip', detail: e.reason }, 6000);
    case 'beamStarted':
      return pushToast({ level: 'ok', text: 'Beam on', detail: 'Injecting from the linac.' });
    case 'beamStopped':
      return pushToast({ level: 'info', text: 'Beam off', detail: 'Ring cryo and magnets stay powered.' });
    case 'cavityDetuned':
      return pushToast({
        level: 'warn',
        text: `RF cavity ${String(e.cavity + 1).padStart(2, '0')} detuned`,
        detail: 'Field below 90%. Beam loss rising.',
      });
    case 'cavityTuned':
      return pushToast({ level: 'ok', text: `Cavity ${String(e.cavity + 1).padStart(2, '0')} on resonance` });
    case 'productionStarted':
      return pushToast({
        level: 'ok',
        text: 'Production run started',
        detail: RECIPE_BY_ID.get(e.recipe)?.name,
      });
    case 'feedExhausted':
      return pushToast({
        level: 'warn',
        text: 'Run stopped · out of feedstock',
        detail: RECIPE_BY_ID.get(e.recipe)?.name,
      });
  }
});

bus.on('toast', (t) => pushToast(t));
bus.on('objective/completed', () => pushToast({ level: 'ok', text: 'Objective complete' }, 5000));
bus.on('room/entered', () => saveGame('auto'));

function toHudObjective(p: ObjectiveProgress): HudObjective | null {
  if (!p.active) return null;
  return {
    title: p.active.title,
    kind: p.active.kind,
    steps: p.active.steps.map((s, i) => ({
      text: s.text,
      detail: s.detail,
      state: i < p.step ? 'done' : i === p.step ? 'active' : 'todo',
    })),
    target: p.active.steps[p.step]?.target ?? null,
  };
}

objectives.onChange((p) => useHud.setState({ objective: toHudObjective(p) }));
