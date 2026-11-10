import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { player } from '../game/runtime';
import { PALETTE } from '../styles/palette';
import { getNode } from '../world/facility';
import type { CorridorFrame } from '../world/spaces';
import { Baked } from './Baked';
import { Beamline } from './Beamline';
import { glow, std } from './materials';
import { FloorText, GlowDecal, WorldText } from './parts';
import { floorTexture } from './textures';

const BACK_H = 5.4;
const FRONT_H = 0.8;
const RING = '#a58cff';

/**
 * A 425 m stretch of accelerator tunnel. Local frame: +x along the walk, local z
 * is the corridor's lateral axis; the beamline runs on the back side, the walkway
 * in front. A vaulted ceiling panel arches over the magnets, with light strips,
 * cable trays and sector markers. Static parts are baked; repeated beamline
 * parts are instanced, so the whole segment is a few dozen draw calls.
 */
export function RingTunnel({ frame }: { frame: CorridorFrame }) {
  const L = frame.length;
  const yaw = -Math.atan2(frame.dir.z, frame.dir.x);
  const b = frame.backSide; // local z sign of the back side
  const { width, beam } = frame.profile;
  const half = width / 2;
  const zOf = (f: number) => -b * f; // front coordinate → local z
  const from = getNode(frame.from);
  const to = getNode(frame.to);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (light.current) light.current.position.set(player.pos.x, 3.4, player.pos.z);
  });

  const mats = useMemo(() => {
    const map = floorTexture().clone();
    map.needsUpdate = true;
    map.repeat.set((L + 6) / 2, width / 2);
    return {
      floor: new THREE.MeshStandardMaterial({ color: '#3a4352', map, roughness: 0.75 }),
      wall: std({ color: '#c5ccd6', roughness: 0.85 }),
      vault: new THREE.MeshStandardMaterial({ color: '#b9c1cc', roughness: 0.8, side: THREE.DoubleSide }),
      slab: std({ color: '#1d242d', roughness: 1 }),
      trim: std({ color: RING, roughness: 0.5, emissive: RING, emissiveIntensity: 0.4 }),
      tray: std({ color: '#8e9aa6', roughness: 0.4, metalness: 0.7 }),
      gantry: std({ color: PALETTE.gantry, roughness: 0.55 }),
    };
  }, [L, width]);
  const lamp = glow('#e8f6ff', 2.4);
  const accent = glow(RING, 1.8);
  const dash = glow(PALETTE.hazard, 1.1);
  const lamps = Array.from({ length: Math.floor(L / 12) + 1 }, (_, i) => i * 12);
  const markers = Array.from({ length: Math.floor(L / 50) }, (_, i) => (i + 1) * 50).filter(
    (t) => t < L - 10,
  );
  const cables = [
    ['#d84a3a', 3.5],
    ['#4fbf6a', 3.72],
    ['#f2b81f', 3.94],
    ['#4f8ff0', 4.16],
  ] as const;
  const beamZ = zOf(beam ?? -2.2);

  return (
    <group>
      <pointLight ref={light} color="#e2ddff" intensity={22} distance={14} decay={1.5} />
      <group rotation={[0, yaw, 0]}>
        <Baked>
          <mesh position={[L / 2, -0.78, 0]} material={mats.slab}>
            <boxGeometry args={[L + 6, 1.5, width + 0.9]} />
          </mesh>
          <mesh position={[L / 2, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.floor} receiveShadow>
            <planeGeometry args={[L + 6, width]} />
          </mesh>
          <mesh position={[L / 2, BACK_H / 2, b * (half + 0.2)]} material={mats.wall} receiveShadow>
            <boxGeometry args={[L + 6, BACK_H, 0.4]} />
          </mesh>
          <mesh position={[L / 2, FRONT_H / 2, -b * (half + 0.2)]} material={mats.wall}>
            <boxGeometry args={[L + 6, FRONT_H, 0.4]} />
          </mesh>
          <mesh position={[L / 2, FRONT_H + 0.03, -b * (half + 0.2)]} material={mats.trim}>
            <boxGeometry args={[L + 6, 0.06, 0.44]} />
          </mesh>
          <mesh position={[L / 2, 2.3, b * (half - 0.02)]} material={mats.trim}>
            <boxGeometry args={[L + 6, 0.08, 0.04]} />
          </mesh>
          {cables.map(([c, y]) => (
            <mesh
              key={c}
              position={[L / 2, y, b * (half - 0.12)]}
              material={std({ color: c, roughness: 0.6 })}
            >
              <boxGeometry args={[L + 6, 0.11, 0.14]} />
            </mesh>
          ))}
          <mesh position={[L / 2, 3.3, b * (half - 0.28)]} material={mats.tray}>
            <boxGeometry args={[L + 6, 0.05, 0.5]} />
          </mesh>
          {lamps.map((t) => (
            <group key={t}>
              <mesh position={[t, BACK_H - 0.25, b * (half - 0.08)]} material={lamp}>
                <boxGeometry args={[2.4, 0.08, 0.12]} />
              </mesh>
              <mesh position={[t + 6, 0.02, zOf(-0.95)]} material={accent}>
                <boxGeometry args={[1.6, 0.02, 0.06]} />
              </mesh>
              <GlowDecal x={t} z={zOf(0.6)} radius={3.6} color="#d9e4ff" intensity={0.26} />
              <GlowDecal x={t + 6} z={beamZ} radius={2.6} color={PALETTE.cyan} intensity={0.3} />
            </group>
          ))}
          {Array.from({ length: Math.floor((L + 4) / 2.5) }, (_, i) => -2 + i * 2.5).map((t) => (
            <mesh
              key={`d${t}`}
              position={[t, 0.012, zOf(-1.15)]}
              rotation={[-Math.PI / 2, 0, 0]}
              material={dash}
            >
              <planeGeometry args={[1.2, 0.12]} />
            </mesh>
          ))}
          {markers.map((t) => (
            <FloorText
              key={t}
              position={[t, 0.02, zOf(1.8)]}
              fontSize={0.42}
              color="#c8b8ff"
              fillOpacity={0.35}
            >
              {`${frame.corridor} · ${t} m`}
            </FloorText>
          ))}
          {[
            { t: -3, node: from },
            { t: L + 3, node: to },
          ].map(({ t, node }) => (
            <group key={node.id} position={[t, 0, 0]}>
              {[zOf(frame.profile.walkMin - 0.3), zOf(frame.profile.walkMax + 0.3)].map((z) => (
                <mesh key={z} position={[0, 1.9, z]} material={mats.gantry}>
                  <boxGeometry args={[0.25, 3.8, 0.22]} />
                </mesh>
              ))}
              <GlowDecal
                x={t > 0 ? -1.6 : 1.6}
                z={zOf(1.4)}
                radius={3}
                color={node.accent}
                intensity={0.55}
              />
            </group>
          ))}
        </Baked>
        {/* Vaulted ceiling panel over the magnet string (open toward the camera). */}
        <mesh
          position={[L / 2, BACK_H - 2.6, b * (half - 3.2)]}
          rotation={[0, 0, Math.PI / 2]}
          material={mats.vault}
        >
          <cylinderGeometry
            args={[3.2, 3.2, L + 6, 24, 1, true, b > 0 ? Math.PI * 0.5 : Math.PI, Math.PI * 0.5]}
          />
        </mesh>
        <Beamline x0={-3} x1={L + 3} z={beamZ} />
        <group position={[8, 3.6, b * (half - 0.01)]} rotation={[0, b > 0 ? Math.PI : 0, 0]}>
          <WorldText
            fontSize={0.46}
            color="#c8b8ff"
          >{`RING ${frame.corridor} · ${to.short} ${L} m →`}</WorldText>
        </group>
      </group>
    </group>
  );
}
