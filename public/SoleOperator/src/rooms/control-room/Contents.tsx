import { useMemo } from 'react';
import * as THREE from 'three';
import { SeatedNpc } from '../../scene/Npc';
import { GlowDecal } from '../../scene/parts';
import { PALETTE } from '../../styles/palette';
import type { RoomContentsProps } from '../../world/types';
import { ConsoleDesk } from './ConsoleDesk';
import { DESK_ANGLES_DEG, DESK_RADIUS, workstations } from './index';
import { ReactorCore } from './ReactorCore';
import { WallDisplay, drawCellMap, makeOutputDrawer } from './WallDisplay';

function Plant({ x, z }: { x: number; z: number }) {
  const m = useMemo(
    () => ({
      pot: new THREE.MeshStandardMaterial({ color: '#e9edf1', roughness: 0.6 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#4caf50', roughness: 0.8, flatShading: true }),
    }),
    [],
  );
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.35, 0]} material={m.pot} castShadow>
        <cylinderGeometry args={[0.32, 0.26, 0.7, 12]} />
      </mesh>
      {[
        [0, 1.0, 0, 0.38],
        [0.12, 1.45, 0.05, 0.3],
        [-0.1, 1.3, -0.08, 0.28],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px!, py!, pz!]} material={m.leaf} castShadow>
          <icosahedronGeometry args={[r!, 0]} />
        </mesh>
      ))}
    </group>
  );
}

function RadiationSign({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f2b81f';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#111';
    g.translate(128, 120);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 80, ((k * 120 - 30) * Math.PI) / 180, ((k * 120 + 30) * Math.PI) / 180);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#f2b81f';
    g.beginPath();
    g.arc(0, 0, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(0, 0, 14, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[1.6, 1.6]} />
      <meshStandardMaterial map={tex} roughness={0.6} />
    </mesh>
  );
}

/** Reactor Control Room, greybox: core, console ring, staff, wall screens and the lighting. */
export default function ControlRoomContents(_: RoomContentsProps) {
  const outputDrawer = useMemo(() => makeOutputDrawer(), []);
  return (
    <group>
      <ReactorCore />

      {DESK_ANGLES_DEG.map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const dir = { x: Math.cos(a), z: Math.sin(a) };
        return (
          <group key={deg}>
            <ConsoleDesk x={dir.x * DESK_RADIUS} z={dir.z * DESK_RADIUS} yaw={Math.atan2(dir.x, dir.z)} />
            <GlowDecal
              x={dir.x * (DESK_RADIUS + 0.4)}
              z={dir.z * (DESK_RADIUS + 0.4)}
              radius={2.6}
              color={PALETTE.amber}
              intensity={0.22}
            />
            <GlowDecal
              x={dir.x * (DESK_RADIUS - 0.1)}
              z={dir.z * (DESK_RADIUS - 0.1)}
              radius={1.6}
              color={PALETTE.cyan}
              intensity={0.22}
            />
            {workstations[i]!.staff && (
              <SeatedNpc
                x={workstations[i]!.position.x}
                z={workstations[i]!.position.z}
                yaw={workstations[i]!.facing}
                seed={i}
              />
            )}
          </group>
        );
      })}

      {/* Wall screens on the two back walls */}
      <WallDisplay
        width={9}
        height={3.4}
        draw={drawCellMap}
        position={[-15.75, 4.4, 8.6]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <WallDisplay
        width={9}
        height={3.4}
        draw={outputDrawer}
        position={[8.6, 4.4, -15.75]}
        rotation={[0, 0, 0]}
      />
      <RadiationSign position={[-8.5, 4.6, -15.76]} rotation={[0, 0, 0]} />
      <RadiationSign position={[-15.76, 4.6, -8.5]} rotation={[0, Math.PI / 2, 0]} />

      {[
        [-14.6, -14.6],
        [-14.6, 3.2],
        [3.2, -14.6],
        [-14.6, 14.4],
        [14.4, -14.6],
        [14.4, 14.4],
      ].map(([x, z]) => (
        <Plant key={`${x},${z}`} x={x!} z={z!} />
      ))}

      {/* Warm lamp pools: two real lights for the key bounce, decals for the rest. */}
      <pointLight position={[-10, 6.5, -10]} color="#ffc48a" intensity={22} distance={18} decay={1.4} />
      <pointLight position={[10, 6.5, 10]} color="#ffc48a" intensity={16} distance={16} decay={1.4} />
      {[
        [-10, -10],
        [10, 10],
        [-10, 10],
        [10, -10],
      ].map(([x, z]) => (
        <GlowDecal key={`${x},${z}`} x={x!} z={z!} radius={6} color={PALETTE.amber} intensity={0.2} />
      ))}
      {/* Walkway lines from each door to the core */}
      {[
        [-12, 0, 8, 0.12],
        [0, -12, 0.12, 8],
        [12, 0, 8, 0.12],
        [0, 12, 0.12, 8],
      ].map(([x, z, w, d]) => (
        <mesh key={`${x},${z}`} position={[x!, 0.015, z!]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w!, d!]} />
          <meshBasicMaterial
            color={new THREE.Color(PALETTE.cyan).multiplyScalar(0.9)}
            toneMapped={false}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
    </group>
  );
}
