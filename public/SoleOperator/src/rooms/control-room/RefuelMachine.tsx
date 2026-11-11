import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { isFresh } from '../../logistics';
import { machine } from '../../game/refuel';
import { useMode } from '../../state/mode';
import { Baked } from '../../scene/Baked';
import { fresnelGlass } from '../../scene/materials';
import { PALETTE } from '../../styles/palette';
import { CORE_BAY } from './index';
import { ARM_HOME, DRIVE_RING_Y, faceForCell } from './coreGeometry';

const ARM_BASE = new THREE.Vector3(0, DRIVE_RING_Y - 0.15, 0);
const up = new THREE.Vector3(0, 1, 0);

/** Transfer chute: t = 0 at the cart bay hopper, t = 1 at the machine above the core. */
export const CHUTE = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(CORE_BAY.x, 2.35, CORE_BAY.z),
    new THREE.Vector3(CORE_BAY.x, 6.2, CORE_BAY.z),
    new THREE.Vector3(CORE_BAY.x - 1.2, 9.4, CORE_BAY.z - 0.2),
    new THREE.Vector3(3.2, 10.2, 0.4),
    new THREE.Vector3(0.9, 9.4, 0.1),
    new THREE.Vector3(ARM_HOME.x + 0.2, ARM_HOME.y + 0.6, ARM_HOME.z),
  ],
  false,
  'centripetal',
);

/** Where the arm's gripper should be for the machine's phase and progress. */
function effectorTarget(out: THREE.Vector3): { holding: boolean; atFace: number } {
  const refuelling = useMode.getState().mode.kind === 'refuel';
  if (!refuelling) {
    out.copy(ARM_HOME);
    return { holding: false, atFace: 0 };
  }
  const curve = faceForCell(machine.cell).armCurve;
  const p = machine.progress;
  if (machine.phase === 'extract') {
    if (p < 0.4) out.copy(curve.getPointAt(p / 0.4));
    else if (p < 0.55) out.copy(curve.getPointAt(1)).addScaledVector(up, Math.sin(p * 90) * 0.02);
    else if (p < 0.85) out.copy(curve.getPointAt(1 - (p - 0.55) / 0.3));
    else out.copy(ARM_HOME);
    return { holding: p >= 0.55, atFace: p < 0.85 ? Math.min(1, p / 0.4) : 0 };
  }
  if (machine.phase === 'load' && machine.arm) {
    if (p < 0.45) out.copy(curve.getPointAt(p / 0.45));
    else if (p < 0.7) out.copy(curve.getPointAt(1));
    else out.copy(curve.getPointAt(1 - (p - 0.7) / 0.3));
    return { holding: p < 0.7, atFace: p < 0.7 ? Math.min(1, p / 0.45) : 0 };
  }
  out.copy(ARM_HOME);
  return { holding: false, atFace: 0 };
}

/**
 * The refuelling machine: a telescoping arm hung from the drive-ring hub that
 * reaches any cell, and a glass transfer chute down to the cart bay. Driven by
 * game/refuel.ts; drawn here every frame.
 */
export function RefuelMachine() {
  const mast = useRef<THREE.Mesh>(null);
  const grip = useRef<THREE.Group>(null);
  const held = useRef<THREE.Mesh>(null);
  const capsule = useRef<THREE.Group>(null);
  const capsuleCore = useRef<THREE.MeshBasicMaterial>(null);
  const eff = useMemo(() => ARM_HOME.clone(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);

  const m = useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: '#c3ccd6', roughness: 0.25, metalness: 0.85 }),
      dark: new THREE.MeshStandardMaterial({ color: PALETTE.steelDark, roughness: 0.4, metalness: 0.7 }),
      yellow: new THREE.MeshStandardMaterial({ color: PALETTE.gantry, roughness: 0.5, metalness: 0.3 }),
      glass: fresnelGlass('#d8f7ff', 0.06, 0.55),
      cassette: new THREE.MeshStandardMaterial({
        color: '#9fc0cf',
        emissive: '#2a8fae',
        emissiveIntensity: 1.3,
        metalness: 0.4,
        roughness: 0.35,
      }),
    }),
    [],
  );
  const chuteGeo = useMemo(() => new THREE.TubeGeometry(CHUTE, 90, 0.26, 12, false), []);
  const rings = useMemo(() => Array.from({ length: 9 }, (_, i) => (i + 0.5) / 9), []);

  useFrame((_, dt) => {
    const { holding, atFace } = effectorTarget(goal);
    eff.lerp(goal, 1 - Math.exp(-dt * 12));

    // Telescoping mast from the hub to the gripper.
    const d = eff.clone().sub(ARM_BASE);
    const len = Math.max(0.2, d.length());
    if (mast.current) {
      mast.current.position.copy(ARM_BASE).addScaledVector(d, 0.5);
      mast.current.scale.set(1, len, 1);
      mast.current.quaternion.setFromUnitVectors(up, d.clone().normalize());
    }
    if (grip.current) {
      grip.current.position.copy(eff);
      // Turn the gripper to face the cell as it gets close.
      const f = faceForCell(machine.cell);
      const q = new THREE.Quaternion().setFromUnitVectors(up, f.normal.clone().negate());
      grip.current.quaternion.slerpQuaternions(new THREE.Quaternion(), q, atFace);
    }
    if (held.current) {
      held.current.visible = holding;
      const a = machine.phase === 'load' ? machine.arm : null;
      m.cassette.emissive.set(
        a && isFresh(a) ? '#8ff0ff' : machine.phase === 'extract' ? '#ff8a2a' : '#2a8fae',
      );
    }

    // Capsule in the chute.
    const cap = machine.capsule;
    if (capsule.current) {
      capsule.current.visible = !!cap;
      if (cap) {
        const t = THREE.MathUtils.clamp(cap.t, 0, 1);
        capsule.current.position.copy(CHUTE.getPointAt(t));
        capsule.current.quaternion.setFromUnitVectors(up, CHUTE.getTangentAt(t));
        capsuleCore.current?.color.set(isFresh(cap.a) ? PALETTE.cyan : PALETTE.amber).multiplyScalar(2.4);
      }
    }
  });

  return (
    <group>
      {/* Arm */}
      <mesh ref={mast} material={m.yellow} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 1, 12]} />
      </mesh>
      <mesh position={ARM_BASE} material={m.yellow} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.35, 16]} />
      </mesh>
      <group ref={grip}>
        <mesh material={m.dark} castShadow>
          <boxGeometry args={[0.7, 0.26, 0.7]} />
        </mesh>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, -0.2, 0]} material={m.yellow}>
            <boxGeometry args={[0.07, 0.32, 0.18]} />
          </mesh>
        ))}
        <mesh ref={held} position={[0, -0.36, 0]} material={m.cassette} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.14, 5]} />
        </mesh>
      </group>

      {/* Transfer chute: glass tube with steel collars, a hopper over the bay and a support post */}
      <Baked>
        <mesh geometry={chuteGeo} material={m.glass} renderOrder={5} />
        {rings.map((t) => {
          const p = CHUTE.getPointAt(t);
          const q = new THREE.Quaternion().setFromUnitVectors(up, CHUTE.getTangentAt(t));
          return (
            <mesh key={t} position={p} quaternion={q} material={m.dark}>
              <cylinderGeometry args={[0.32, 0.32, 0.12, 14]} />
            </mesh>
          );
        })}
        <mesh position={[CORE_BAY.x, 2.25, CORE_BAY.z]} material={m.dark} castShadow>
          <cylinderGeometry args={[0.32, 0.55, 0.4, 14, 1, true]} />
        </mesh>
        <mesh position={[CORE_BAY.x + 1.2, 4.6, CORE_BAY.z]} material={m.yellow} castShadow>
          <boxGeometry args={[0.24, 9.2, 0.24]} />
        </mesh>
        <mesh position={[CORE_BAY.x + 0.6, 6.2, CORE_BAY.z]} material={m.yellow}>
          <boxGeometry args={[1.2, 0.16, 0.16]} />
        </mesh>
      </Baked>

      <group ref={capsule} visible={false}>
        <mesh material={m.steel}>
          <capsuleGeometry args={[0.18, 0.5, 6, 12]} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.19, 0.19, 0.12, 12]} />
          <meshBasicMaterial ref={capsuleCore} color={PALETTE.cyan} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
