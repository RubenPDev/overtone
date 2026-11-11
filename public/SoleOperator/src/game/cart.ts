import { bus } from '../core/events';
import { nearestFree, type SpaceLayout } from '../world/geometry';
import { isFresh } from '../logistics';
import { getRoom, isRoomBuilt } from '../rooms/registry';
import { pushToast } from '../state/hud';
import { useWorld } from '../state/world';
import type { Interactable } from '../world/types';
import { logistics, player, syncLogistics } from './runtime';

/** How far in front of the Operator the cart rides while pushed. */
export const CART_OFFSET = 1.35;
export const CART_SPEED = 3.0;
export const CART_SPRINT = 4.6;
const DOCK_SNAP = 1.8;

export function cartAttached() {
  return logistics.state.cart.attached;
}

export function caskSummary(): string {
  const cask = logistics.state.cart.cask;
  if (!cask.length) return 'Cask empty';
  return cask.map((a) => `${a.id} ${isFresh(a) ? 'fresh' : 'spent'}`).join(' · ');
}

/** The cart as an interactable in the current room (push when parked, park when pushing). */
export function cartInteractable(roomId: string | null): Interactable | null {
  const c = logistics.state.cart;
  if (c.attached)
    return {
      id: 'cart',
      kind: 'cart',
      verb: 'PARK',
      label: 'Transfer cart',
      detail: caskSummary(),
      position: { ...player.pos },
      promptHeight: 2.3,
      radius: 99,
      action: { type: 'message', text: '' },
    };
  if (!roomId || c.room !== roomId) return null;
  // Handle side: behind the cart relative to its heading.
  return {
    id: 'cart',
    kind: 'cart',
    verb: 'PUSH',
    label: 'Transfer cart',
    detail: caskSummary(),
    position: { x: c.x - Math.sin(c.yaw) * 1.25, z: c.z - Math.cos(c.yaw) * 1.25 },
    promptHeight: 1.9,
    radius: 1.3,
    action: { type: 'message', text: '' },
  };
}

export function attachCart() {
  const c = logistics.state.cart;
  c.attached = true;
  c.bay = null;
  // Face the cart so pushing starts in the direction it was parked.
  player.yaw = c.yaw;
  player.path = [];
  bus.emit('cart/attached', { room: c.room });
  syncLogistics();
}

export function parkCart() {
  const space = useWorld.getState().space;
  if (space.kind !== 'room') {
    pushToast({
      level: 'info',
      text: 'Keep moving',
      detail: 'The corridor is too narrow to leave the cart in.',
    });
    return;
  }
  const c = logistics.state.cart;
  c.attached = false;
  c.room = space.room;
  const room = getRoom(space.room);
  const bay = (room.cartBays ?? []).find((b) => Math.hypot(b.x - c.x, b.z - c.z) < DOCK_SNAP);
  if (bay) {
    c.x = bay.x;
    c.z = bay.z;
    c.yaw = bay.yaw;
    c.bay = bay.id;
    const fresh = c.cask.filter(isFresh).length;
    bus.emit('cart/docked', { room: room.id, bay: bay.id, fresh, spent: c.cask.length - fresh });
    pushToast({ level: 'ok', text: `Cart docked · ${bay.label.toLowerCase()}`, detail: caskSummary() });
  } else {
    bus.emit('cart/parked', { room: room.id });
  }
  syncLogistics();
}

/** Called every frame while pushing: the cart rides in front of the Operator. */
export function followPlayer() {
  const c = logistics.state.cart;
  c.x = player.pos.x + Math.sin(player.yaw) * CART_OFFSET;
  c.z = player.pos.z + Math.cos(player.yaw) * CART_OFFSET;
  c.yaw = player.yaw;
}

/** On entering a room while pushing, the cart comes along. */
/** A cart parked (outside a bay) where the room's furniture now stands is nudged to free floor. */
export function settleParkedCart(roomId: string, layout: SpaceLayout) {
  const c = logistics.state.cart;
  if (c.attached || c.bay || c.room !== roomId) return;
  const free = nearestFree(layout, { x: c.x, z: c.z }, 0.85);
  if (free && (free.x !== c.x || free.z !== c.z)) {
    c.x = free.x;
    c.z = free.z;
    syncLogistics();
  }
}

export function cartEnteredRoom(roomId: string) {
  const c = logistics.state.cart;
  if (!c.attached || !isRoomBuilt(roomId)) return;
  c.room = roomId;
  followPlayer();
  syncLogistics();
}

export function cartDockedAt(roomId: string, bayId: string) {
  const c = logistics.state.cart;
  return !c.attached && c.room === roomId && c.bay === bayId;
}
