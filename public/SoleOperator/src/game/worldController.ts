import { bus } from '../core/events';
import { getRoom, isRoomBuilt, preloadRoom } from '../rooms/registry';
import { useHud } from '../state/hud';
import { useWorld, type Arrival } from '../state/world';
import { getCorridor, getNode, otherEnd } from '../world/facility';
import { arrivalPoint } from '../world/geometry';
import { corridorFrame, type Space } from '../world/spaces';
import { cartEnteredRoom } from './cart';
import { player } from './runtime';

const FADE_MS = 380;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let busy = false;

/** Fade out, swap the mounted space, fade in. Input is locked throughout. */
async function transition(title: string, subtitle: string, swap: () => Promise<void> | void) {
  if (busy) return;
  busy = true;
  player.locked = true;
  player.path = [];
  useWorld.setState({ transition: { phase: 'out', title, subtitle }, near: null });
  await wait(FADE_MS);
  await swap();
  useWorld.setState((s) => ({ transition: { ...s.transition, phase: 'in' } }));
  await wait(FADE_MS + 200);
  useWorld.setState((s) => ({ transition: { ...s.transition, phase: 'idle' } }));
  player.locked = false;
  busy = false;
}

function mount(space: Space, arrival: Arrival) {
  player.pos = { ...arrival.position };
  player.yaw = arrival.facing;
  if (space.kind === 'room') cartEnteredRoom(space.room);
  useWorld.setState((s) => ({ space, arrival, spaceVersion: s.spaceVersion + 1 }));
  useHud.setState({
    graphPos:
      space.kind === 'room' ? { room: space.room } : { corridor: space.corridor, from: space.from, t: 0 },
  });
}

export function currentRoomId(): string | null {
  const s = useWorld.getState().space;
  return s.kind === 'room' ? s.room : null;
}

/** Walked into an open door's stub: go into its corridor. */
export function enterCorridor(corridorId: string) {
  const fromId = currentRoomId();
  if (!fromId) return;
  const from = getRoom(fromId);
  const frame = corridorFrame(corridorId, from);
  const to = getNode(frame.to);
  void preloadRoom(to.id); // fetch the next room's code while the player walks
  void transition(`CORRIDOR ${corridorId}`, `${frame.length} m to ${to.name}`, () => {
    bus.emit('room/left', { room: fromId });
    mount(
      { kind: 'corridor', corridor: corridorId, from: fromId },
      {
        position: { x: frame.dir.x * 1.5, z: frame.dir.z * 1.5 },
        facing: Math.atan2(frame.dir.x, frame.dir.z),
      },
    );
    bus.emit('corridor/entered', { corridor: corridorId, from: fromId, to: to.id });
  });
}

/** Reached either end of a corridor (or teleported): load the room and stand at its door. */
export function arrive(roomId: string, viaCorridor: string | null) {
  if (!isRoomBuilt(roomId)) return;
  const room = getRoom(roomId);
  const door = viaCorridor ? room.doorways.find((d) => d.corridor === viaCorridor) : undefined;
  const arrival = door ? arrivalPoint(room, door.id) : room.spawn;
  void transition(room.name.toUpperCase(), `Unit 1 · Level ${room.level}`, async () => {
    await preloadRoom(roomId);
    mount({ kind: 'room', room: roomId }, arrival);
    bus.emit('room/entered', { room: roomId });
  });
}

export function teleport(roomId: string) {
  arrive(roomId, null);
}

/** Puts the player in a room instantly (new game / continue), no fade. */
export function placeInRoom(roomId: string, arrival?: Arrival) {
  mount({ kind: 'room', room: roomId }, arrival ?? getRoom(roomId).spawn);
}

/** Label for the far end of the corridor currently walked. */
export function corridorDestination(): string | null {
  const s = useWorld.getState().space;
  return s.kind === 'corridor' ? otherEnd(getCorridor(s.corridor), s.from) : null;
}

bus.on('cmd/teleport', ({ room }) => teleport(room));
