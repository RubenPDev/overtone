import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GlowDecal, useEmissive } from '../../scene/parts';
import { useWorld } from '../../state/world';
import { PALETTE } from '../../styles/palette';
import type { RoomContentsProps } from '../../world/types';
import { RACK_ROWS } from './index';

const SLOT_PITCH = 1.0;

/**
 * Fuel Rod Storage, placeholder: three rack rows of assemblies and one fresh
 * assembly marked ready. TODO(room): full art, refuelling machine, inventory.
 */
export default function FuelStorageContents(_: RoomContentsProps) {
  const carrying = useWorld((s) => s.carrying);
  const m = useMemo(
    () => ({
      frame: new THREE.MeshStandardMaterial({ color: PALETTE.gantry, roughness: 0.5, metalness: 0.25 }),
      bed: new THREE.MeshStandardMaterial({ color: '#2b343f', roughness: 0.7 }),
      assembly: new THREE.MeshStandardMaterial({ color: '#9aa6b2', roughness: 0.35, metalness: 0.6 }),
    }),
    [],
  );
  const ready = useEmissive('#8dff6a', 2.2);
  const fresh = useEmissive(PALETTE.cyan, 3);
  const pulse = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (pulse.current) pulse.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 4) * 0.08);
  });

  return (
    <group>
      {RACK_ROWS.map((row, r) => {
        const slots = Math.floor((row.z1 - row.z0) / SLOT_PITCH);
        return (
          <group key={r} position={[row.x, 0, 0]}>
            <mesh position={[0, 0.25, (row.z0 + row.z1) / 2]} material={m.bed} castShadow receiveShadow>
              <boxGeometry args={[row.width, 0.5, row.z1 - row.z0]} />
            </mesh>
            {[row.z0, row.z1].map((z) => (
              <mesh key={z} position={[0, 1.1, z]} material={m.frame} castShadow>
                <boxGeometry args={[row.width + 0.2, 2.2, 0.16]} />
              </mesh>
            ))}
            <mesh position={[0, 2.2, (row.z0 + row.z1) / 2]} material={m.frame}>
              <boxGeometry args={[row.width + 0.2, 0.14, row.z1 - row.z0]} />
            </mesh>
            {Array.from({ length: slots }, (_, i) => {
              const z = row.z0 + 0.5 + i * SLOT_PITCH;
              const isFresh = r === 1 && i === Math.floor(slots / 2);
              if (isFresh && carrying) return null; // taken
              return (
                <group key={i} position={[0, 0, z]}>
                  <mesh position={[0, 1.05, 0]} material={m.assembly} castShadow>
                    <boxGeometry args={[0.42, 1.1, 0.42]} />
                  </mesh>
                  <mesh position={[0, 1.62, 0]} material={isFresh ? fresh : ready}>
                    <boxGeometry args={[0.3, 0.04, 0.3]} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
      {!carrying && (
        <mesh ref={pulse} position={[RACK_ROWS[1]!.x, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.05, 40]} />
          <meshBasicMaterial color={new THREE.Color(PALETTE.cyan).multiplyScalar(2)} toneMapped={false} />
        </mesh>
      )}
      <pointLight position={[-1, 5.5, 0]} color="#c8ffb0" intensity={20} distance={20} decay={1.4} />
      <GlowDecal x={-1} z={0} radius={10} color="#a8f05a" intensity={0.22} />
      {RACK_ROWS.map((row) => (
        <GlowDecal
          key={row.x}
          x={row.x}
          z={(row.z0 + row.z1) / 2}
          radius={4}
          color="#8dff6a"
          intensity={0.18}
        />
      ))}
      <GlowDecal x={RACK_ROWS[1]!.x} z={0} radius={2.2} color={PALETTE.cyan} intensity={0.5} />
    </group>
  );
}
