import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { std } from './materials';

const COATS = ['#eef2f5', '#e6ebef', '#f3f5f7'];
const HAIR = ['#2b2018', '#5a3b22', '#151515', '#8c6239', '#c9c3b8'];
const SKIN = ['#e0b48c', '#c68d63', '#8d5a3b', '#f1c9a5', '#a8714d'];
const OVERALLS = '#2f6fb0';

export type Outfit = 'scientist' | 'worker';

/**
 * Seated placeholder scientist. TODO(npc): replace with the NPC system
 * (schedules, walking to the cafeteria, reacting to alarms).
 */
export function SeatedNpc({
  x,
  z,
  yaw,
  seed,
  outfit = 'scientist',
}: {
  x: number;
  z: number;
  yaw: number;
  seed: number;
  outfit?: Outfit;
}) {
  const head = useRef<THREE.Mesh>(null);
  const mats = useMemo(
    () => ({
      coat: std({ color: outfit === 'worker' ? OVERALLS : COATS[seed % COATS.length]!, roughness: 0.8 }),
      trousers: std({ color: '#2a2f38', roughness: 0.9 }),
      skin: std({ color: SKIN[seed % SKIN.length]!, roughness: 0.8 }),
      hair: std({ color: HAIR[(seed * 3) % HAIR.length]!, roughness: 0.9 }),
      chair: std({ color: '#2d3540', roughness: 0.7 }),
    }),
    [seed, outfit],
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
      <mesh ref={head} position={[0, 1.44, 0]} material={mats.skin} castShadow userData={{ noBake: true }}>
        <sphereGeometry args={[0.18, 14, 10]} />
      </mesh>
      <mesh position={[0, 1.53, -0.03]} material={mats.hair}>
        <sphereGeometry args={[0.185, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
      </mesh>
    </group>
  );
}

interface FigureRefs {
  body: RefObject<THREE.Group | null>;
  head: RefObject<THREE.Mesh | null>;
  legL: RefObject<THREE.Group | null>;
  legR: RefObject<THREE.Group | null>;
  armL: RefObject<THREE.Group | null>;
  armR: RefObject<THREE.Group | null>;
}

function useFigureRefs(): FigureRefs {
  return {
    body: useRef<THREE.Group>(null),
    head: useRef<THREE.Mesh>(null),
    legL: useRef<THREE.Group>(null),
    legR: useRef<THREE.Group>(null),
    armL: useRef<THREE.Group>(null),
    armR: useRef<THREE.Group>(null),
  };
}

/** A standing figure: scientist in a lab coat, or technician in overalls and hard hat. */
function StandingFigure({
  seed,
  outfit,
  refs,
  clipboard,
}: {
  seed: number;
  outfit: Outfit;
  refs: FigureRefs;
  clipboard?: boolean;
}) {
  const m = useMemo(
    () => ({
      top: new THREE.MeshStandardMaterial({
        color: outfit === 'worker' ? OVERALLS : COATS[seed % COATS.length],
        roughness: 0.8,
      }),
      legs: new THREE.MeshStandardMaterial({
        color: outfit === 'worker' ? '#27598f' : '#2a2f38',
        roughness: 0.85,
      }),
      skin: new THREE.MeshStandardMaterial({ color: SKIN[seed % SKIN.length], roughness: 0.8 }),
      hair: new THREE.MeshStandardMaterial({ color: HAIR[(seed * 3) % HAIR.length], roughness: 0.9 }),
      hat: new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.4 }),
      stripe: new THREE.MeshStandardMaterial({
        color: '#f2b81f',
        emissive: '#f2b81f',
        emissiveIntensity: 0.25,
      }),
      boot: new THREE.MeshStandardMaterial({ color: '#1b1f24', roughness: 0.9 }),
      clip: new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 0.7 }),
    }),
    [seed, outfit],
  );
  return (
    <group ref={refs.body}>
      {[-0.12, 0.12].map((lx, i) => (
        <group key={lx} ref={i === 0 ? refs.legL : refs.legR} position={[lx, 0.88, 0]}>
          <mesh position={[0, -0.42, 0]} material={m.legs} castShadow>
            <boxGeometry args={[0.19, 0.8, 0.22]} />
          </mesh>
          <mesh position={[0, -0.84, 0.05]} material={m.boot}>
            <boxGeometry args={[0.21, 0.11, 0.32]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.2, 0]} material={m.top} castShadow>
        <boxGeometry args={[0.5, 0.68, 0.3]} />
      </mesh>
      {outfit === 'worker' && (
        <mesh position={[0, 1.16, 0.155]} material={m.stripe}>
          <boxGeometry args={[0.51, 0.06, 0.01]} />
        </mesh>
      )}
      {[-0.31, 0.31].map((ax, i) => (
        <group key={ax} ref={i === 0 ? refs.armL : refs.armR} position={[ax, 1.48, 0]}>
          <mesh position={[0, -0.3, 0]} material={m.top} castShadow>
            <boxGeometry args={[0.13, 0.6, 0.15]} />
          </mesh>
          <mesh position={[0, -0.63, 0]} material={m.skin}>
            <boxGeometry args={[0.11, 0.09, 0.11]} />
          </mesh>
        </group>
      ))}
      <mesh ref={refs.head} position={[0, 1.7, 0]} material={m.skin} castShadow>
        <sphereGeometry args={[0.18, 14, 10]} />
      </mesh>
      {outfit === 'worker' ? (
        <mesh position={[0, 1.8, 0]} material={m.hat}>
          <sphereGeometry args={[0.205, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ) : (
        <mesh position={[0, 1.79, -0.03]} material={m.hair}>
          <sphereGeometry args={[0.185, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
        </mesh>
      )}
      {clipboard && (
        <mesh position={[0.18, 1.08, 0.3]} rotation={[-0.6, 0, 0]} material={m.clip}>
          <boxGeometry args={[0.24, 0.32, 0.02]} />
        </mesh>
      )}
    </group>
  );
}

/** Standing NPC idling in place: shifts weight, looks around, maybe reads a clipboard. */
export function StandingNpc({
  x,
  z,
  yaw,
  seed,
  outfit = 'worker',
  clipboard = false,
}: {
  x: number;
  z: number;
  yaw: number;
  seed: number;
  outfit?: Outfit;
  clipboard?: boolean;
}) {
  const refs = useFigureRefs();
  useFrame((s) => {
    const t = s.clock.elapsedTime + seed * 2.3;
    if (refs.head.current) refs.head.current.rotation.y = Math.sin(t * 0.45) * 0.5;
    if (refs.body.current) refs.body.current.position.y = Math.sin(t * 1.3) * 0.008;
    if (clipboard && refs.armR.current) refs.armR.current.rotation.x = -1.0 + Math.sin(t * 0.8) * 0.05;
  });
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <StandingFigure seed={seed} outfit={outfit} refs={refs} clipboard={clipboard} />
    </group>
  );
}

/**
 * NPC walking a loop of waypoints, pausing at each. A preview of the NPC system.
 * TODO(npc): navmesh paths, schedules, avoiding the player.
 */
export function WalkingNpc({
  path,
  seed,
  outfit = 'worker',
  speed = 1.25,
  pause = 2.5,
}: {
  path: { x: number; z: number }[];
  seed: number;
  outfit?: Outfit;
  speed?: number;
  pause?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const refs = useFigureRefs();
  const st = useRef({ i: 0, x: path[0]!.x, z: path[0]!.z, wait: 0, yaw: 0, phase: 0 });
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    const target = path[(s.i + 1) % path.length]!;
    let moving = false;
    if (s.wait > 0) s.wait -= dt;
    else {
      const dx = target.x - s.x;
      const dz = target.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) {
        s.i = (s.i + 1) % path.length;
        s.wait = pause;
      } else {
        const step = Math.min(d, speed * dt);
        s.x += (dx / d) * step;
        s.z += (dz / d) * step;
        const want = Math.atan2(dx, dz);
        s.yaw += Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw)) * (1 - Math.exp(-dt * 8));
        moving = true;
      }
    }
    s.phase += dt * (moving ? speed * 5.5 : 0);
    const swing = moving ? Math.sin(s.phase) * 0.45 : 0;
    if (refs.legL.current) refs.legL.current.rotation.x = swing;
    if (refs.legR.current) refs.legR.current.rotation.x = -swing;
    if (refs.armL.current) refs.armL.current.rotation.x = -swing * 0.7;
    if (refs.armR.current) refs.armR.current.rotation.x = swing * 0.7;
    if (root.current) {
      root.current.position.set(s.x, moving ? Math.abs(Math.sin(s.phase)) * 0.04 : 0, s.z);
      root.current.rotation.y = s.yaw;
    }
  });
  return (
    <group ref={root}>
      <StandingFigure seed={seed} outfit={outfit} refs={refs} />
    </group>
  );
}
