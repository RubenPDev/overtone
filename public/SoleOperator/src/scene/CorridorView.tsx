import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { player } from '../game/runtime';
import { PALETTE } from '../styles/palette';
import { getNode } from '../world/facility';
import { CORRIDOR_WIDTH, type CorridorFrame } from '../world/spaces';
import { FloorText, GlowDecal, WorldText, useEmissive } from './parts';
import { Baked } from './Baked';
import { Extinguisher, Pipe } from './props';
import { floorTexture } from './textures';

const BACK_H = 4.2;
const FRONT_H = 0.8;

/**
 * A long service corridor, built along its walking direction. Dim, with lamp
 * pools every 10 m and distance markers every 20 m. TODO(art): corridor props,
 * pipes, signage variety, occasional NPC traffic.
 */
export function CorridorView({ frame }: { frame: CorridorFrame }) {
  const L = frame.length;
  const yaw = -Math.atan2(frame.dir.z, frame.dir.x); // local +x → walking direction
  // Which lateral side faces away from the camera (that one gets the tall wall).
  const lateral = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const backSide = lateral.x + lateral.z > 0 ? -1 : 1;
  const half = CORRIDOR_WIDTH / 2;
  const to = getNode(frame.to);
  const from = getNode(frame.from);

  const mats = useMemo(() => {
    const map = floorTexture().clone();
    map.needsUpdate = true;
    map.repeat.set((L + 6) / 2, CORRIDOR_WIDTH / 2);
    return {
      floor: new THREE.MeshStandardMaterial({ color: '#3f4a58', map, roughness: 0.8 }),
      wall: new THREE.MeshStandardMaterial({ color: PALETTE.wallDark, roughness: 0.9 }),
      trim: new THREE.MeshStandardMaterial({
        color: PALETTE.trim,
        emissive: PALETTE.trim,
        emissiveIntensity: 0.3,
      }),
      slab: new THREE.MeshStandardMaterial({ color: '#1d242d', roughness: 1 }),
      gantry: new THREE.MeshStandardMaterial({ color: PALETTE.gantry, roughness: 0.55 }),
    };
  }, [L]);
  const lamp = useEmissive('#dff6ff', 2.4);
  const endLamp = useEmissive(to.accent, 2.4);

  const light = useRef<THREE.PointLight>(null);
  const local = useRef<THREE.Group>(null);
  useFrame(() => {
    // Follow light: the player carries a pool of light down the corridor.
    if (light.current) light.current.position.set(player.pos.x, 3.2, player.pos.z);
  });

  const lamps = Array.from({ length: Math.floor(L / 10) + 1 }, (_, i) => i * 10);
  const markers = Array.from({ length: Math.floor(L / 20) }, (_, i) => (i + 1) * 20).filter((t) => t < L - 5);

  return (
    <group>
      <pointLight ref={light} color="#ffd9b0" intensity={18} distance={13} decay={1.6} />
      <group ref={local} rotation={[0, yaw, 0]}>
        <Baked>
          <mesh position={[L / 2, -0.75, 0]} material={mats.slab}>
            <boxGeometry args={[L + 6, 1.5, CORRIDOR_WIDTH + 0.9]} />
          </mesh>
          <mesh
            position={[L / 2, -0.01, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={mats.floor}
            receiveShadow
          >
            <planeGeometry args={[L + 6, CORRIDOR_WIDTH]} />
          </mesh>
          {/* Back (tall) and front (cut) walls. */}
          <mesh position={[L / 2, BACK_H / 2, backSide * (half + 0.2)]} material={mats.wall} receiveShadow>
            <boxGeometry args={[L + 6, BACK_H, 0.4]} />
          </mesh>
          <mesh position={[L / 2, 2.3, backSide * (half - 0.02)]} material={mats.trim}>
            <boxGeometry args={[L + 6, 0.1, 0.04]} />
          </mesh>
          <mesh position={[L / 2, FRONT_H / 2, -backSide * (half + 0.2)]} material={mats.wall}>
            <boxGeometry args={[L + 6, FRONT_H, 0.4]} />
          </mesh>
          <mesh position={[L / 2, FRONT_H, -backSide * (half + 0.2)]} material={mats.trim}>
            <boxGeometry args={[L + 6, 0.06, 0.42]} />
          </mesh>

          {/* Service runs along the back wall, extinguishers every 50 m */}
          <Pipe
            axis="x"
            from={-3}
            to={L + 3}
            y={3.55}
            offset={backSide * (half - 0.12)}
            band={PALETTE.cyan}
          />
          <Pipe
            axis="x"
            from={-3}
            to={L + 3}
            y={3.15}
            offset={backSide * (half - 0.1)}
            r={0.08}
            color="#b7bfc8"
            band={PALETTE.trim}
          />
          {Array.from({ length: Math.floor(L / 50) }, (_, i) => (i + 1) * 50 - 25).map((t) => (
            <Extinguisher key={t} x={t} z={backSide * (half - 0.02)} yaw={backSide > 0 ? Math.PI : 0} />
          ))}
          {lamps.map((t) => (
            <group key={t}>
              <mesh position={[t, BACK_H - 0.4, backSide * (half - 0.05)]} material={lamp}>
                <boxGeometry args={[1.6, 0.08, 0.1]} />
              </mesh>
              <GlowDecal x={t} z={backSide * 0.6} radius={3.4} color="#bfe9ff" intensity={0.32} />
            </group>
          ))}
          {markers.map((t) => (
            <FloorText key={t} position={[t, 0.02, 0]} fontSize={0.42} color="#c9d3de" fillOpacity={0.25}>
              {`${frame.corridor} · ${t} m`}
            </FloorText>
          ))}

          {/* Ends: the way back and the way on. */}
          {[
            { t: -3, node: from },
            { t: L + 3, node: to },
          ].map(({ t, node }) => (
            <group key={node.id} position={[t, 0, 0]}>
              {[-half, half].map((z) => (
                <mesh key={z} position={[0, 1.9, z]} material={mats.gantry}>
                  <boxGeometry args={[0.25, 3.8, 0.22]} />
                </mesh>
              ))}
              <mesh position={[0, 3.9, 0]} material={node === to ? endLamp : mats.gantry}>
                <boxGeometry args={[0.25, 0.2, CORRIDOR_WIDTH + 0.4]} />
              </mesh>
              <GlowDecal x={t > 0 ? -1.6 : 1.6} z={0} radius={3} color={node.accent} intensity={0.55} />
            </group>
          ))}
          <group position={[6, 3.0, backSide * (half - 0.01)]} rotation={[0, backSide > 0 ? Math.PI : 0, 0]}>
            <WorldText
              fontSize={0.42}
              color="#f2b81f"
            >{`${frame.corridor} · ${to.name.toUpperCase()} ${L} m →`}</WorldText>
          </group>
        </Baked>
      </group>
    </group>
  );
}
