import type { ComponentType } from 'react';

/**
 * Ground-plane coordinates in metres. +x is screen down-right, +z is screen
 * down-left, so -x / -z walls are the "back" walls the camera sees in full.
 * Room-local: the origin is the centre of the room's floor.
 */
export interface Vec2 {
  x: number;
  z: number;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Unit directions a wall (and its doorway) can face, outward from the room. */
export type Facing = '+x' | '-x' | '+z' | '-z';

export interface Doorway {
  id: string;
  /** Which wall the door is in (outward direction). */
  facing: Facing;
  /** Offset along the wall from its centre, metres. */
  offset?: number;
  width: number;
  /** Corridor id in the facility graph (e.g. 'C-1'). */
  corridor: string;
  /** Short sign text painted over or in front of the door. */
  sign: string;
}

/** What happens when the player presses E on an interactable. Handled in game/interactions.ts. */
export type InteractAction =
  /** Inspect a core cell; with the transfer cart docked and fresh fuel in its cask, start refuelling. */
  | { type: 'corePort'; cell: number }
  /** Operator console: rod control mode. */
  | { type: 'rodControl' }
  /** Fuel crane console: crane control mode. */
  | { type: 'crane' }
  /** Fuel inventory terminal: list the pool. */
  | { type: 'inventory' }
  | { type: 'talk'; line: string }
  /** Vending machine: coffee restores focus. */
  | { type: 'vending' }
  /** Water cooler: restores stamina. */
  | { type: 'water' }
  /** Alarm panel: acknowledge active alarms. */
  | { type: 'alarmPanel' }
  | { type: 'message'; text: string; detail?: string };

/** A floor bay where the transfer cart docks (snaps in when parked nearby). */
export interface CartBay {
  id: string;
  label: string;
  x: number;
  z: number;
  /** Cart heading when docked (radians, 0 = facing +z). */
  yaw: number;
}

export interface Interactable {
  id: string;
  /** 'console', 'core', 'npc', 'rack'… used for the prompt verb and objective matching. */
  kind: string;
  /** Prompt verb, e.g. 'TALK', 'INSPECT'. */
  verb: string;
  label: string;
  detail?: string;
  position: Vec2;
  /** World-space height for the floating prompt. */
  promptHeight?: number;
  radius: number;
  action: InteractAction;
}

export interface Workstation {
  id: string;
  position: Vec2;
  /** Yaw in radians: the direction the seated person faces. */
  facing: number;
  role: string;
  /** Who sits here by default (placeholder until NPC schedules exist). */
  staff?: string;
}

export interface SpawnPoint {
  position: Vec2;
  facing: number;
}

/** Static collision shapes, room-local. */
export type Obstacle = { kind: 'circle'; x: number; z: number; r: number } | { kind: 'rect'; rect: Rect };

export interface RoomContentsProps {
  room: RoomDefinition;
}

/**
 * A playable room. One folder in src/rooms per room exports one of these;
 * registering it in src/rooms/registry.ts is the only other change needed.
 */
export interface RoomDefinition {
  /** Must match the node id in world/facility.ts. */
  id: string;
  name: string;
  level: string;
  /** Floor rectangle, room-local metres. */
  bounds: Rect;
  wallHeight: number;
  doorways: Doorway[];
  spawn: SpawnPoint;
  interactables: Interactable[];
  workstations: Workstation[];
  obstacles: Obstacle[];
  /** Floor lettering, e.g. 'CONTROL ROOM 01'. */
  floorLabel?: string;
  /** Parts of the floor cut away (pits, pools). The room's Contents draws what's below. */
  floorHoles?: Rect[];
  /** Docking bays for the fuel transfer cart. */
  cartBays?: CartBay[];
  /** Where the camera looks (and how close) while a control mode is active in this room. */
  focus?: Partial<Record<'rods' | 'crane' | 'refuel', { x: number; z: number; zoom: number }>>;
  /** Lazy-loaded scene contents (props, lights, NPCs). The shell (floor, walls, doors) is generic. */
  load: () => Promise<{ default: ComponentType<RoomContentsProps> }>;
}
