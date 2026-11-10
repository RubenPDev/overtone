import { useMemo } from 'react';
import * as THREE from 'three';
import { isRoomBuilt } from '../rooms/registry';
import { PALETTE } from '../styles/palette';
import { FACING_VEC, STUB_LENGTH, doorPosition } from '../world/geometry';
import { doorState, type DoorState } from '../world/spaces';
import type { Doorway, Facing, RoomDefinition } from '../world/types';
import { FloorText, GlowDecal, WorldText, useEmissive } from './parts';
import { fadeTexture, floorTexture, hazardTexture } from './textures';

const WALL_T = 0.45;
const FRONT_H = 0.9;
const DOOR_H = 3.8;

/** Back walls (-x, -z) are full height; front walls (+x, +z) are cut low so the camera sees in. */
const isBack = (f: Facing) => f === '-x' || f === '-z';

function useShellMaterials() {
  return useMemo(() => {
    const floorMap = floorTexture().clone();
    floorMap.needsUpdate = true;
    return {
      floorMap,
      wall: new THREE.MeshStandardMaterial({ color: PALETTE.wallLight, roughness: 0.85 }),
      wallDark: new THREE.MeshStandardMaterial({ color: PALETTE.wallDark, roughness: 0.9 }),
      trim: new THREE.MeshStandardMaterial({
        color: PALETTE.trim,
        roughness: 0.6,
        emissive: PALETTE.trim,
        emissiveIntensity: 0.25,
      }),
      gantry: new THREE.MeshStandardMaterial({ color: PALETTE.gantry, roughness: 0.55, metalness: 0.2 }),
      slab: new THREE.MeshStandardMaterial({ color: '#1d242d', roughness: 1 }),
      plate: new THREE.MeshStandardMaterial({ color: '#141b23', roughness: 0.6 }),
      hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.7 }),
    };
  }, []);
}

type Mats = ReturnType<typeof useShellMaterials>;

/** Splits a wall span into solid segments around its doorways. */
function wallSegments(from: number, to: number, holes: { c: number; w: number }[]) {
  const segs: [number, number][] = [];
  let cur = from;
  for (const h of [...holes].sort((a, b) => a.c - b.c)) {
    if (h.c - h.w / 2 > cur) segs.push([cur, h.c - h.w / 2]);
    cur = Math.max(cur, h.c + h.w / 2);
  }
  if (cur < to) segs.push([cur, to]);
  return segs;
}

function Wall({ room, facing, mats }: { room: RoomDefinition; facing: Facing; mats: Mats }) {
  const b = room.bounds;
  const back = isBack(facing);
  const alongX = facing === '+z' || facing === '-z';
  const H = back ? room.wallHeight : FRONT_H;
  const line =
    facing === '+x'
      ? b.maxX + WALL_T / 2
      : facing === '-x'
        ? b.minX - WALL_T / 2
        : facing === '+z'
          ? b.maxZ + WALL_T / 2
          : b.minZ - WALL_T / 2;
  const [from, to] = alongX ? [b.minX - WALL_T, b.maxX + WALL_T] : [b.minZ - WALL_T, b.maxZ + WALL_T];
  const doors = room.doorways.filter((d) => d.facing === facing);
  const holes = doors.map((d) => {
    const p = doorPosition(b, d);
    return { c: alongX ? p.x : p.z, w: d.width };
  });
  const inward = -Math.sign(FACING_VEC[facing].x + FACING_VEC[facing].z); // toward room centre, along the wall normal

  const box = (
    a: number,
    c: number,
    y0: number,
    y1: number,
    depth: number,
    offset: number,
    mat: THREE.Material,
    key: string,
  ) => {
    const len = c - a;
    const mid = (a + c) / 2;
    const n = line + inward * offset;
    const pos: [number, number, number] = alongX ? [mid, (y0 + y1) / 2, n] : [n, (y0 + y1) / 2, mid];
    const size: [number, number, number] = alongX ? [len, y1 - y0, depth] : [depth, y1 - y0, len];
    return (
      <mesh key={key} position={pos} material={mat} castShadow={back} receiveShadow>
        <boxGeometry args={size} />
      </mesh>
    );
  };

  return (
    <group>
      {wallSegments(from, to, holes).map(([a, c], i) => (
        <group key={i}>
          {box(a, c, 0, H, WALL_T, 0, mats.wall, 'w')}
          {back && box(a, c, 0, 1.1, 0.08, WALL_T / 2 + 0.04, mats.wallDark, 'band')}
          {back && box(a, c, 2.55, 2.7, 0.06, WALL_T / 2 + 0.03, mats.trim, 'trim')}
          {!back && box(a, c, H - 0.08, H, WALL_T + 0.02, 0, mats.trim, 'cap')}
        </group>
      ))}
      {back &&
        holes.map((h, i) => box(h.c - h.w / 2, h.c + h.w / 2, DOOR_H, H, WALL_T, 0, mats.wall, `lintel${i}`))}
    </group>
  );
}

function DoorDressing({
  room,
  door,
  state,
  mats,
}: {
  room: RoomDefinition;
  door: Doorway;
  state: DoorState;
  mats: Mats;
}) {
  const p = doorPosition(room.bounds, door);
  const f = FACING_VEC[door.facing];
  const back = isBack(door.facing);
  const yaw = -Math.atan2(f.z, f.x); // local +x → outward
  const postH = back ? DOOR_H : FRONT_H + 0.35;
  const half = door.width / 2 + 0.12;
  const stubLen = state === 'open' ? STUB_LENGTH : 6;
  const lamp = useEmissive(
    state === 'open' ? PALETTE.cyan : state === 'locked' ? '#ff4d4d' : PALETTE.amber,
    2.2,
  );
  const stubMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: state === 'open' ? PALETTE.floor : PALETTE.floorDark,
        alphaMap: fadeTexture(),
        transparent: true,
        depthWrite: false,
        roughness: 0.9,
      }),
    [state],
  );

  return (
    <group position={[p.x, 0, p.z]} rotation={[0, yaw, 0]}>
      {/* Frame posts (local z is along the wall). */}
      {[-half, half].map((z) => (
        <mesh key={z} position={[0, postH / 2, z]} material={mats.gantry} castShadow>
          <boxGeometry args={[WALL_T + 0.12, postH, 0.22]} />
        </mesh>
      ))}
      {back && (
        <mesh position={[0, DOOR_H + 0.1, 0]} material={mats.gantry}>
          <boxGeometry args={[WALL_T + 0.12, 0.2, door.width + 0.46]} />
        </mesh>
      )}
      {/* Status lamp over the door. */}
      <mesh position={[-WALL_T / 2 - 0.05, back ? DOOR_H + 0.45 : FRONT_H + 0.5, 0]} material={lamp}>
        <boxGeometry args={[0.08, 0.14, 0.9]} />
      </mesh>

      {/* Sign: on the wall above back doors, on the floor inside front doors. */}
      {back ? (
        <group position={[-WALL_T / 2 - 0.03, DOOR_H + 1.1, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh material={mats.plate}>
            <planeGeometry args={[door.width + 1.6, 0.8]} />
          </mesh>
          <WorldText position={[0, 0, 0.01]} fontSize={0.36} color={state === 'open' ? '#f2b81f' : '#8a96a3'}>
            {door.sign}
          </WorldText>
        </group>
      ) : (
        <FloorText
          position={[-1.8, 0.03, 0]}
          yaw={Math.PI / 2}
          fontSize={0.55}
          color="#f2b81f"
          fillOpacity={0.55}
        >
          {door.sign}
        </FloorText>
      )}

      {/* Corridor stub fading into the dark. */}
      <mesh
        position={[stubLen / 2, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={stubMat}
        receiveShadow
      >
        <planeGeometry args={[stubLen, door.width + 0.6]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[stubLen / 2, 0.5, s * (door.width / 2 + 0.5)]} material={stubMat}>
          <boxGeometry args={[stubLen, 1, 0.3]} />
        </mesh>
      ))}
      {state === 'open' &&
        [2.5, 6, 9.5].map((x, i) => (
          <GlowDecal key={x} x={x} z={0} radius={2.2} color={PALETTE.cyan} intensity={0.5 - i * 0.14} />
        ))}

      {/* Shutter for sealed / locked doors. */}
      {state !== 'open' && (
        <group>
          <mesh position={[0, (back ? DOOR_H : FRONT_H) / 2, 0]} material={mats.hazard} castShadow>
            <boxGeometry args={[0.2, back ? DOOR_H : FRONT_H, door.width]} />
          </mesh>
          <FloorText
            position={[back ? -1.6 : -3.0, 0.03, 0]}
            yaw={Math.PI / 2}
            fontSize={0.34}
            color={state === 'locked' ? '#ff7a7a' : '#ffb35c'}
          >
            {state === 'locked' ? 'LOCKED · CLEARANCE L8' : 'SEALED · NOT YET BUILT'}
          </FloorText>
        </group>
      )}
    </group>
  );
}

/** Generic room shell from a RoomDefinition: slab, floor, cutaway walls, doorways and stubs. */
export function RoomShell({ room }: { room: RoomDefinition }) {
  const mats = useShellMaterials();
  const b = room.bounds;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  mats.floorMap.repeat.set(w / 2, d / 2);

  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.floor,
        map: mats.floorMap,
        roughness: 0.78,
        metalness: 0.05,
      }),
    [mats.floorMap],
  );

  return (
    <group>
      {/* Base slab: the room reads as a solid block floating in the dark. */}
      <mesh position={[cx, -0.75, cz]} material={mats.slab}>
        <boxGeometry args={[w + WALL_T * 2, 1.5, d + WALL_T * 2]} />
      </mesh>
      <mesh position={[cx, -0.01, cz]} rotation={[-Math.PI / 2, 0, 0]} material={floorMat} receiveShadow>
        <planeGeometry args={[w, d]} />
      </mesh>
      {(['-x', '-z', '+x', '+z'] as Facing[]).map((f) => (
        <Wall key={f} room={room} facing={f} mats={mats} />
      ))}
      {room.doorways.map((door) => (
        <DoorDressing
          key={door.id}
          room={room}
          door={door}
          state={doorState(room, door, isRoomBuilt)}
          mats={mats}
        />
      ))}
      {room.floorLabel && (
        <FloorText
          position={[b.minX + w * 0.24, 0.02, b.maxZ - 1.8]}
          fontSize={0.95}
          color="#c9d3de"
          fillOpacity={0.16}
          letterSpacing={0.3}
        >
          {room.floorLabel}
        </FloorText>
      )}
    </group>
  );
}
