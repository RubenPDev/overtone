import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const COATS = ['#eef2f5', '#e6ebef', '#f3f5f7'];
const HAIR = ['#2b2018', '#5a3b22', '#151515', '#8c6239', '#c9c3b8'];
const SKIN = ['#e0b48c', '#c68d63', '#8d5a3b', '#f1c9a5', '#a8714d'];

/**
 * Seated placeholder scientist. TODO(npc): replace with the NPC system
 * (schedules, walking to the cafeteria, reacting to alarms).
 */
export function SeatedNpc({ x, z, yaw, seed }: { x: number; z: number; yaw: number; seed: number }) {
  const head = useRef<THREE.Mesh>(null);
  const mats = useMemo(
    () => ({
      coat: new THREE.MeshStandardMaterial({ color: COATS[seed % COATS.length], roughness: 0.8 }),
      trousers: new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.9 }),
      skin: new THREE.MeshStandardMaterial({ color: SKIN[seed % SKIN.length], roughness: 0.8 }),
      hair: new THREE.MeshStandardMaterial({ color: HAIR[(seed * 3) % HAIR.length], roughness: 0.9 }),
      chair: new THREE.MeshStandardMaterial({ color: '#2d3540', roughness: 0.7 }),
    }),
    [seed],
  );

  useFrame((s) => {
    if (head.current) head.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.5 + seed * 1.7) * 0.25;
  });

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {/* Chair */}
      <mesh position={[0, 0.45, -0.05]} material={mats.chair} castShadow>
        <boxGeometry args={[0.55, 0.08, 0.55]} />
      </mesh>
      <mesh position={[0, 0.8, -0.32]} material={mats.chair} castShadow>
        <boxGeometry args={[0.55, 0.65, 0.08]} />
      </mesh>
      <mesh position={[0, 0.22, -0.05]} material={mats.chair}>
        <cylinderGeometry args={[0.04, 0.04, 0.44, 8]} />
      </mesh>
      {/* Body, seated: thighs forward, torso upright. */}
      <mesh position={[0, 0.55, 0.12]} material={mats.trousers} castShadow>
        <boxGeometry args={[0.42, 0.16, 0.46]} />
      </mesh>
      <mesh position={[0, 0.27, 0.34]} material={mats.trousers}>
        <boxGeometry args={[0.38, 0.5, 0.14]} />
      </mesh>
      <mesh position={[0, 0.95, -0.04]} material={mats.coat} castShadow>
        <boxGeometry args={[0.5, 0.66, 0.3]} />
      </mesh>
      {[-0.3, 0.3].map((ax) => (
        <mesh key={ax} position={[ax, 0.92, 0.14]} rotation={[-1.0, 0, 0]} material={mats.coat} castShadow>
          <boxGeometry args={[0.13, 0.55, 0.14]} />
        </mesh>
      ))}
      <mesh ref={head} position={[0, 1.44, 0]} material={mats.skin} castShadow>
        <sphereGeometry args={[0.18, 14, 10]} />
      </mesh>
      <mesh position={[0, 1.53, -0.03]} material={mats.hair}>
        <sphereGeometry args={[0.185, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
      </mesh>
    </group>
  );
}
