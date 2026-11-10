import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { isDown } from '../game/input';
import { player } from '../game/runtime';
import { arrive, enterCorridor } from '../game/worldController';
import { useApp } from '../state/app';
import { useWorld } from '../state/world';
import { PALETTE } from '../styles/palette';
import { rectContains, slideMove } from '../world/geometry';
import type { Interactable } from '../world/types';
import { glowTexture } from './textures';
import { stage } from './stage';

const WALK_SPEED = 4.2; // m/s: 140 m of corridor ≈ 33 s, as on the map
const SPRINT_SPEED = 7;
const S = Math.SQRT1_2;

/** Screen-relative WASD → ground direction for the fixed iso camera. */
function keyboardDir(): { x: number; z: number } | null {
  let x = 0;
  let z = 0;
  if (isDown('KeyW', 'ArrowUp')) ((x -= S), (z -= S));
  if (isDown('KeyS', 'ArrowDown')) ((x += S), (z += S));
  if (isDown('KeyD', 'ArrowRight')) ((x += S), (z -= S));
  if (isDown('KeyA', 'ArrowLeft')) ((x -= S), (z += S));
  const len = Math.hypot(x, z);
  return len > 0 ? { x: x / len, z: z / len } : null;
}

function angleLerp(a: number, b: number, t: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

/** The Operator: movement, placeholder walk cycle, selection ring, interact detection and space triggers. */
export function Player({
  interactables,
  coreAt,
}: {
  interactables: Interactable[];
  coreAt?: { x: number; z: number };
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const phase = useRef(0);
  const fired = useRef(false);
  const carrying = useWorld((s) => s.carrying);

  const mats = useMemo(
    () => ({
      vest: new THREE.MeshStandardMaterial({ color: '#ff8a2a', roughness: 0.7 }),
      stripe: new THREE.MeshStandardMaterial({
        color: '#e8eef2',
        emissive: '#cfd8df',
        emissiveIntensity: 0.35,
      }),
      trousers: new THREE.MeshStandardMaterial({ color: '#2b3a52', roughness: 0.85 }),
      skin: new THREE.MeshStandardMaterial({ color: '#e0b48c', roughness: 0.8 }),
      hat: new THREE.MeshStandardMaterial({ color: PALETTE.hazard, roughness: 0.4 }),
      boot: new THREE.MeshStandardMaterial({ color: '#1b1f24', roughness: 0.9 }),
      ring: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.player).multiplyScalar(2.2),
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
      }),
      shadow: new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: '#000000',
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
      fuel: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(2),
        toneMapped: false,
      }),
      fuelCase: new THREE.MeshStandardMaterial({ color: '#9aa6b2', metalness: 0.6, roughness: 0.35 }),
    }),
    [],
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const layout = stage.layout;
    const g = root.current;
    if (!layout || !g) return;
    const menuOpen = useApp.getState().overlay !== null;

    // --- Movement -----------------------------------------------------------
    let dir: { x: number; z: number } | null = null;
    if (!player.locked && !menuOpen) {
      const k = keyboardDir();
      if (k) {
        dir = k;
        player.path = [];
      } else if (player.path.length) {
        const next = player.path[0]!;
        const dx = next.x - player.pos.x;
        const dz = next.z - player.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.15) player.path.shift();
        else dir = { x: dx / dist, z: dz / dist };
      }
    }

    const sprinting = !!dir && isDown('ShiftLeft', 'ShiftRight') && player.stamina > 0.02;
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    player.stamina = THREE.MathUtils.clamp(player.stamina + (sprinting ? -0.16 : 0.09) * dt, 0, 1);

    if (dir) {
      const step = speed * dt;
      const next = player.path[0];
      const remaining = next ? Math.hypot(next.x - player.pos.x, next.z - player.pos.z) : Infinity;
      const s = Math.min(step, remaining);
      const moved = slideMove(layout, player.pos, { x: dir.x * s, z: dir.z * s });
      const actual = Math.hypot(moved.x - player.pos.x, moved.z - player.pos.z);
      if (actual < s * 0.2 && player.path.length) player.path = []; // blocked: give up the click target
      player.pos = moved;
      player.speed = actual / dt;
      player.yaw = angleLerp(player.yaw, Math.atan2(dir.x, dir.z), 1 - Math.exp(-dt * 14));
    } else {
      player.speed = 0;
    }

    g.position.set(player.pos.x, 0, player.pos.z);
    body.current!.rotation.y = player.yaw;

    // --- Placeholder walk / idle animation -------------------------------------
    const moving = player.speed > 0.2;
    phase.current += dt * (moving ? player.speed * 2.3 : 1.6);
    const swing = moving ? Math.sin(phase.current) * Math.min(0.75, player.speed * 0.13) : 0;
    legL.current!.rotation.x = swing;
    legR.current!.rotation.x = -swing;
    armL.current!.rotation.x = carrying ? -1.1 : -swing * 0.8;
    armR.current!.rotation.x = carrying ? -1.1 : swing * 0.8;
    body.current!.position.y = moving
      ? Math.abs(Math.sin(phase.current)) * 0.06
      : Math.sin(phase.current) * 0.012;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.06;
    ring.current!.scale.setScalar(pulse);

    // --- Nearest interactable (store write only when it changes) ----------------
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of interactables) {
      const d = Math.hypot(it.position.x - player.pos.x, it.position.z - player.pos.z);
      if (d <= it.radius && d < bestD) ((best = it), (bestD = d));
    }
    if (useWorld.getState().near?.id !== best?.id) useWorld.setState({ near: best });

    // --- Space triggers (door stubs, corridor ends) ------------------------------
    if (!player.locked && !fired.current) {
      for (const t of layout.triggers) {
        if (!rectContains(t.rect, player.pos)) continue;
        fired.current = true;
        if (t.action.type === 'enterCorridor') enterCorridor(t.action.corridor);
        else arrive(t.action.room, t.action.corridor);
        break;
      }
    }

    // --- Dose placeholder: rises near the core. TODO(sim): move dosimetry into the sim. ---
    if (coreAt && !menuOpen) {
      const d = Math.hypot(player.pos.x - coreAt.x, player.pos.z - coreAt.z);
      player.dose += dt * 0.006 * Math.max(0, 1 - d / 12) ** 2;
    }
  });

  return (
    <group ref={root}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} material={mats.shadow}>
        <planeGeometry args={[1.5, 1.5]} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={mats.ring}>
        <ringGeometry args={[0.58, 0.68, 48]} />
      </mesh>
      <group ref={body}>
        {/* Legs pivot at the hip. */}
        {[
          [legL, -0.13],
          [legR, 0.13],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.9, 0]}>
            <mesh position={[0, -0.42, 0]} material={mats.trousers} castShadow>
              <boxGeometry args={[0.2, 0.8, 0.24]} />
            </mesh>
            <mesh position={[0, -0.84, 0.05]} material={mats.boot} castShadow>
              <boxGeometry args={[0.22, 0.12, 0.34]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.22, 0]} material={mats.vest} castShadow>
          <boxGeometry args={[0.52, 0.66, 0.32]} />
        </mesh>
        <mesh position={[0, 1.1, 0.165]} material={mats.stripe}>
          <boxGeometry args={[0.53, 0.06, 0.01]} />
        </mesh>
        <mesh position={[0, 1.32, 0.165]} material={mats.stripe}>
          <boxGeometry args={[0.53, 0.06, 0.01]} />
        </mesh>
        {[
          [armL, -0.33],
          [armR, 0.33],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 1.5, 0]}>
            <mesh position={[0, -0.3, 0]} material={mats.vest} castShadow>
              <boxGeometry args={[0.14, 0.6, 0.16]} />
            </mesh>
            <mesh position={[0, -0.64, 0]} material={mats.skin}>
              <boxGeometry args={[0.12, 0.1, 0.12]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.72, 0]} material={mats.skin} castShadow>
          <sphereGeometry args={[0.19, 16, 12]} />
        </mesh>
        <mesh position={[0, 1.82, 0]} material={mats.hat} castShadow>
          <sphereGeometry args={[0.215, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 1.82, 0.04]} material={mats.hat}>
          <cylinderGeometry args={[0.27, 0.27, 0.03, 20]} />
        </mesh>
        {carrying && (
          <group position={[0, 1.05, 0.42]}>
            <mesh material={mats.fuelCase} castShadow>
              <boxGeometry args={[0.34, 0.34, 0.5]} />
            </mesh>
            <mesh position={[0, 0.18, 0]} material={mats.fuel}>
              <boxGeometry args={[0.22, 0.02, 0.4]} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

/** Click target pin and a dashed line from the player to it. */
export function MoveIndicator() {
  const pin = useRef<THREE.Mesh>(null);
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mat = new THREE.LineDashedMaterial({
      color: new THREE.Color(PALETTE.cyan).multiplyScalar(1.6),
      dashSize: 0.35,
      gapSize: 0.25,
      toneMapped: false,
      transparent: true,
      opacity: 0.85,
    });
    return new THREE.Line(geo, mat);
  }, []);

  useFrame((state) => {
    const target = player.path.at(-1);
    const visible = !!target;
    line.visible = visible;
    if (pin.current) pin.current.visible = visible;
    if (!target) return;
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, player.pos.x, 0.05, player.pos.z);
    pos.setXYZ(1, target.x, 0.05, target.z);
    pos.needsUpdate = true;
    line.computeLineDistances();
    pin.current!.position.set(target.x, 0.04, target.z);
    pin.current!.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 6) * 0.12);
  });

  return (
    <>
      <primitive object={line} />
      <mesh ref={pin} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.36, 32]} />
        <meshBasicMaterial color={new THREE.Color(PALETTE.cyan).multiplyScalar(2)} toneMapped={false} />
      </mesh>
    </>
  );
}
