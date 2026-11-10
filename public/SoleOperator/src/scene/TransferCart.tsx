import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { logistics } from '../game/runtime';
import { isFresh } from '../logistics';
import { useLogistics } from '../state/logistics';
import { PALETTE } from '../styles/palette';
import { hazardTexture } from './textures';

/**
 * Fuel transfer cart: a low flatbed with a shielded cask. The cask's two
 * indicator windows show what's inside (cyan = fresh, amber = spent).
 * Position comes from the live logistics state every frame.
 */
export function TransferCart() {
  const root = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  const cask = useLogistics((s) => s.cart.cask);
  const attached = useLogistics((s) => s.cart.attached);
  const last = useRef({ x: 0, z: 0 });

  const m = useMemo(() => {
    const hz = hazardTexture().clone();
    hz.needsUpdate = true;
    hz.repeat.set(6, 0.5);
    return {
      bed: new THREE.MeshStandardMaterial({ color: '#3b4654', roughness: 0.6, metalness: 0.4 }),
      edge: new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6 }),
      cask: new THREE.MeshStandardMaterial({ color: '#c9d1da', roughness: 0.3, metalness: 0.85 }),
      band: new THREE.MeshStandardMaterial({ color: PALETTE.trim, roughness: 0.5 }),
      wheel: new THREE.MeshStandardMaterial({ color: '#15191e', roughness: 0.9 }),
      handle: new THREE.MeshStandardMaterial({ color: PALETTE.gantry, roughness: 0.5 }),
      off: new THREE.MeshBasicMaterial({ color: '#1a242c' }),
      fresh: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(2.4),
        toneMapped: false,
      }),
      spent: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.amber).multiplyScalar(2.4),
        toneMapped: false,
      }),
    };
  }, []);

  useFrame((state) => {
    const c = logistics.state.cart;
    const g = root.current;
    if (!g) return;
    g.position.set(c.x, 0, c.z);
    g.rotation.y = c.yaw;
    // Roll the wheels by distance travelled.
    const moved = Math.hypot(c.x - last.current.x, c.z - last.current.z);
    last.current = { x: c.x, z: c.z };
    if (wheels.current && moved < 1) wheels.current.children.forEach((w) => (w.rotation.x += moved / 0.18));
    if (beacon.current)
      beacon.current.color
        .set(attached ? PALETTE.amber : PALETTE.player)
        .multiplyScalar(attached ? 1.5 + Math.sin(state.clock.elapsedTime * 8) * 1.2 : 1.6);
  });

  const slot = (i: number) => {
    const a = cask[i];
    return a ? (isFresh(a) ? m.fresh : m.spent) : m.off;
  };

  return (
    <group ref={root}>
      <mesh position={[0, 0.42, 0]} material={m.bed} castShadow receiveShadow>
        <boxGeometry args={[1.25, 0.22, 1.9]} />
      </mesh>
      <mesh position={[0, 0.42, 0]} material={m.edge}>
        <boxGeometry args={[1.28, 0.12, 1.93]} />
      </mesh>
      <group ref={wheels}>
        {[
          [-0.55, -0.7],
          [0.55, -0.7],
          [-0.55, 0.7],
          [0.55, 0.7],
        ].map(([x, z]) => (
          <mesh
            key={`${x},${z}`}
            position={[x!, 0.18, z!]}
            rotation={[0, 0, Math.PI / 2]}
            material={m.wheel}
            castShadow
          >
            <cylinderGeometry args={[0.18, 0.18, 0.12, 14]} />
          </mesh>
        ))}
      </group>
      {/* Shielded cask */}
      <mesh position={[0, 1.0, 0]} material={m.cask} castShadow>
        <cylinderGeometry args={[0.48, 0.52, 1.0, 20]} />
      </mesh>
      {[0.68, 1.32].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={m.band}>
          <cylinderGeometry args={[0.535, 0.535, 0.08, 20]} />
        </mesh>
      ))}
      <mesh position={[0, 1.53, 0]} material={m.bed}>
        <cylinderGeometry args={[0.36, 0.46, 0.08, 20]} />
      </mesh>
      {/* Contents windows (face the handle, i.e. -z local) */}
      {[0, 1].map((i) => (
        <mesh key={i} position={[-0.16 + i * 0.32, 1.0, -0.5]} material={slot(i)}>
          <boxGeometry args={[0.18, 0.36, 0.04]} />
        </mesh>
      ))}
      {/* Push handle at the back */}
      <mesh position={[0, 1.05, -1.02]} rotation={[0, 0, Math.PI / 2]} material={m.handle} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.0, 8]} />
      </mesh>
      {[-0.48, 0.48].map((x) => (
        <mesh key={x} position={[x, 0.78, -0.98]} rotation={[0.2, 0, 0]} material={m.handle}>
          <boxGeometry args={[0.05, 0.6, 0.05]} />
        </mesh>
      ))}
      <mesh position={[0.5, 0.65, 0.88]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshBasicMaterial ref={beacon} color={PALETTE.player} toneMapped={false} />
      </mesh>
    </group>
  );
}
