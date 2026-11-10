import type { ThreeEvent } from '@react-three/fiber';
import { Suspense, useLayoutEffect, useMemo } from 'react';
import { player } from '../game/runtime';
import { getRoom, isRoomBuilt, roomContents } from '../rooms/registry';
import { useApp } from '../state/app';
import { useWorld } from '../state/world';
import { StraightLineNavigator, rectCenter } from '../world/geometry';
import {
  buildCorridorSpace,
  buildRoomSpace,
  corridorFrame,
  type BuiltSpace,
  type CorridorFrame,
} from '../world/spaces';
import type { RoomDefinition } from '../world/types';
import { CorridorView } from './CorridorView';
import { InteractPrompt } from './InteractPrompt';
import { MoveIndicator, Player } from './Player';
import { RoomShell } from './RoomShell';
import { stage } from './stage';

/** Invisible floor catcher for click-to-move. */
function ClickFloor({ space }: { space: BuiltSpace }) {
  const nav = useMemo(() => new StraightLineNavigator(space), [space]);
  const f = space.frame;
  const c = rectCenter(f);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || player.locked || useApp.getState().overlay) return;
    e.stopPropagation();
    const path = nav.findPath(player.pos, { x: e.point.x, z: e.point.z });
    if (path) player.path = path;
  };
  return (
    <mesh position={[c.x, 0, c.z]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onDown} visible={false}>
      <planeGeometry args={[f.maxX - f.minX + 20, f.maxZ - f.minZ + 20]} />
    </mesh>
  );
}

function useMountStage(space: BuiltSpace, corridor: CorridorFrame | null) {
  // Layout effect: the stage must be current before the first frame of the new space renders.
  useLayoutEffect(() => {
    stage.layout = space;
    stage.corridor = corridor;
    stage.version += 1;
  }, [space, corridor]);
}

function RoomSpace({ room }: { room: RoomDefinition }) {
  const space = useMemo(() => buildRoomSpace(room, isRoomBuilt), [room]);
  useMountStage(space, null);
  const Contents = roomContents(room);
  const core = room.id === 'control-room' ? { x: 0, z: 0 } : undefined;
  return (
    <group>
      <RoomShell room={room} />
      <Suspense fallback={null}>
        <Contents room={room} />
      </Suspense>
      <ClickFloor space={space} />
      <Player interactables={room.interactables} coreAt={core} />
      <MoveIndicator />
      <InteractPrompt />
    </group>
  );
}

function CorridorSpace({ corridor, from }: { corridor: string; from: string }) {
  const frame = useMemo(() => corridorFrame(corridor, getRoom(from)), [corridor, from]);
  const space = useMemo(() => buildCorridorSpace(frame), [frame]);
  useMountStage(space, frame);
  return (
    <group>
      <CorridorView frame={frame} />
      <ClickFloor space={space} />
      <Player interactables={[]} />
      <MoveIndicator />
    </group>
  );
}

/**
 * Mounts exactly one space: the current room (plus its corridor stubs) or the
 * corridor being walked. Everything else is unmounted, so its meshes, lights
 * and textures are released.
 */
export function SpaceStage() {
  const space = useWorld((s) => s.space);
  const version = useWorld((s) => s.spaceVersion);
  return space.kind === 'room' ? (
    <RoomSpace key={version} room={getRoom(space.room)} />
  ) : (
    <CorridorSpace key={version} corridor={space.corridor} from={space.from} />
  );
}
