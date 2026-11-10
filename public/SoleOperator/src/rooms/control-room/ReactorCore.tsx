import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { simHost } from '../../game/runtime';
import { useHud } from '../../state/hud';
import { PALETTE } from '../../styles/palette';
import { GlowDecal, WorldText } from '../../scene/parts';
import { hazardTexture } from '../../scene/textures';
import { PLINTH_RADIUS, TANK_RADIUS } from './index';
import { CORE_RADIUS, CORE_Y, DRIVE_RING_R, DRIVE_RING_Y, buildCoreFaces } from './coreGeometry';

const TANK_BOTTOM = 0.5;
const TANK_TOP = 7.1;
const up = new THREE.Vector3(0, 1, 0);

/**
 * The reactor: a dodecahedral core of 12 fuel cells in a glass cylinder of
 * water, one control rod per port curving up to the drive ring. Rods and port
 * glow read the sim directly in useFrame; only cell warnings re-render (5 Hz max).
 */
export function ReactorCore() {
  const faces = useMemo(() => buildCoreFaces(), []);
  const hotCells = useHud((s) =>
    s.sim ? s.sim.cells.map((c) => (!c.loaded ? 'e' : c.burnup > 0.9 ? 'h' : 'o')).join('') : '',
  );
  const collars = useRef<(THREE.Mesh | null)[]>([]);
  const drives = useRef<(THREE.Mesh | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const water = useRef<THREE.MeshStandardMaterial>(null);

  const m = useMemo(() => {
    const hz = hazardTexture().clone();
    hz.needsUpdate = true;
    hz.repeat.set(26, 1);
    return {
      plinth: new THREE.MeshStandardMaterial({ color: '#2a323c', roughness: 0.7, metalness: 0.3 }),
      hazard: new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.35, metalness: 0.7 }),
      steelDark: new THREE.MeshStandardMaterial({ color: PALETTE.steelDark, roughness: 0.5, metalness: 0.6 }),
      rod: new THREE.MeshStandardMaterial({ color: '#c9d3dd', roughness: 0.25, metalness: 0.8 }),
      gantry: new THREE.MeshStandardMaterial({ color: PALETTE.gantry, roughness: 0.5, metalness: 0.25 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#cdf3ff',
        transparent: true,
        opacity: 0.14,
        roughness: 0.05,
        metalness: 0,
        clearcoat: 1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      surface: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(1.4),
        transparent: true,
        opacity: 0.55,
        toneMapped: false,
        depthWrite: false,
      }),
      core: new THREE.MeshStandardMaterial({
        color: '#b9dce8',
        roughness: 0.35,
        metalness: 0.45,
        flatShading: true,
        emissive: '#1f6f88',
        emissiveIntensity: 0.55,
      }),
      edge: new THREE.LineBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(2.2),
        toneMapped: false,
      }),
      port: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(3),
        toneMapped: false,
      }),
      portHot: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.amber).multiplyScalar(3),
        toneMapped: false,
      }),
      portEmpty: new THREE.MeshBasicMaterial({ color: '#1a2630' }),
      driveCap: new THREE.MeshStandardMaterial({
        color: '#d8423a',
        roughness: 0.4,
        emissive: '#d8423a',
        emissiveIntensity: 0.3,
      }),
    };
  }, []);

  const coreGeo = useMemo(() => new THREE.DodecahedronGeometry(CORE_RADIUS, 0), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(coreGeo), [coreGeo]);
  const rodGeos = useMemo(
    () => faces.map((f) => new THREE.TubeGeometry(f.rodCurve, 48, 0.075, 8, false)),
    [faces],
  );

  useFrame((state) => {
    const s = simHost.state;
    // Collar slides along the first part of each rod path with insertion (0 = out at the drive, 1 = in the port).
    faces.forEach((f, i) => {
      const rod = s.rods[f.cell]!;
      const collar = collars.current[i];
      if (collar) {
        const t = THREE.MathUtils.lerp(0.42, 0.02, rod.insertion);
        collar.position.copy(f.rodCurve.getPointAt(t));
        collar.quaternion.setFromUnitVectors(up, f.rodCurve.getTangentAt(t));
      }
      const drive = drives.current[i];
      if (drive) drive.position.y = DRIVE_RING_Y + 0.35 + (1 - rod.insertion) * 0.35;
    });
    // Cherenkov glow breathes with thermal power.
    const p = Math.min(1.6, s.thermalPower / 3700);
    const flicker = 1 + Math.sin(state.clock.elapsedTime * 7.3) * 0.015;
    if (light.current) light.current.intensity = (14 + 38 * p) * flicker;
    if (water.current) water.current.emissiveIntensity = (0.25 + 0.55 * p) * flicker;
  });

  return (
    <group>
      {/* Plinth with hazard band */}
      <mesh position={[0, 0.25, 0]} material={m.plinth} receiveShadow castShadow>
        <cylinderGeometry args={[PLINTH_RADIUS, PLINTH_RADIUS + 0.1, 0.5, 64]} />
      </mesh>
      <mesh position={[0, 0.25, 0]} material={m.hazard}>
        <cylinderGeometry args={[PLINTH_RADIUS + 0.02, PLINTH_RADIUS + 0.12, 0.42, 64, 1, true]} />
      </mesh>

      {/* Core and ports */}
      <group position={[0, CORE_Y, 0]}>
        <mesh geometry={coreGeo} material={m.core} castShadow />
        <lineSegments geometry={edgeGeo} material={m.edge} />
      </group>
      {faces.map((f, i) => {
        const state = hotCells[f.cell] ?? 'o';
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal);
        return (
          <group key={i} position={f.center.clone().addScaledVector(f.normal, 0.02)} quaternion={q}>
            <mesh material={state === 'h' ? m.portHot : state === 'e' ? m.portEmpty : m.port}>
              <torusGeometry args={[0.36, 0.06, 8, 24]} />
            </mesh>
            <mesh material={m.steelDark}>
              <circleGeometry args={[0.24, 20]} />
            </mesh>
          </group>
        );
      })}

      {/* Rods, collars (insertion indicator) and drives */}
      {faces.map((f, i) => (
        <group key={i}>
          <mesh geometry={rodGeos[i]} material={m.rod} castShadow />
          <mesh ref={(el) => void (collars.current[i] = el)} material={m.steel}>
            <cylinderGeometry args={[0.14, 0.14, 0.32, 10]} />
          </mesh>
          <mesh position={[f.drive.x, DRIVE_RING_Y + 0.2, f.drive.z]} material={m.steelDark} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.5, 12]} />
          </mesh>
          <mesh
            ref={(el) => void (drives.current[i] = el)}
            position={[f.drive.x, DRIVE_RING_Y + 0.5, f.drive.z]}
            material={m.driveCap}
          >
            <cylinderGeometry args={[0.2, 0.2, 0.16, 12]} />
          </mesh>
        </group>
      ))}

      {/* Water column, surface and glass */}
      <mesh position={[0, (TANK_BOTTOM + 6.5) / 2, 0]} renderOrder={2}>
        <cylinderGeometry args={[TANK_RADIUS - 0.08, TANK_RADIUS - 0.08, 6.5 - TANK_BOTTOM, 64, 1, true]} />
        <meshStandardMaterial
          ref={water}
          color="#1b8db3"
          emissive={PALETTE.cyan}
          emissiveIntensity={0.5}
          transparent
          opacity={0.3}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 6.5, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.surface} renderOrder={3}>
        <ringGeometry args={[0.35, TANK_RADIUS - 0.08, 64]} />
      </mesh>
      <mesh position={[0, (TANK_BOTTOM + TANK_TOP) / 2, 0]} material={m.glass} renderOrder={4}>
        <cylinderGeometry args={[TANK_RADIUS, TANK_RADIUS, TANK_TOP - TANK_BOTTOM, 64, 1, true]} />
      </mesh>
      {[TANK_BOTTOM + 0.08, TANK_TOP].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.steel} castShadow>
          <torusGeometry args={[TANK_RADIUS + 0.04, 0.1, 8, 64]} />
        </mesh>
      ))}

      {/* Gantry and drive ring */}
      {[0, 1, 2, 3].map((k) => {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        const r = TANK_RADIUS + 0.45;
        return (
          <mesh
            key={k}
            position={[Math.cos(a) * r, (0.5 + DRIVE_RING_Y) / 2, Math.sin(a) * r]}
            material={m.gantry}
            castShadow
          >
            <boxGeometry args={[0.32, DRIVE_RING_Y - 0.5, 0.32]} />
          </mesh>
        );
      })}
      <mesh position={[0, DRIVE_RING_Y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.steelDark} castShadow>
        <torusGeometry args={[DRIVE_RING_R, 0.28, 10, 72]} />
      </mesh>
      <mesh position={[0, DRIVE_RING_Y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.gantry}>
        <torusGeometry args={[TANK_RADIUS + 0.45, 0.12, 6, 72]} />
      </mesh>
      {[0, 1].map((k) => (
        <mesh
          key={k}
          position={[0, DRIVE_RING_Y, 0]}
          rotation={[0, (k * Math.PI) / 2 + Math.PI / 4, 0]}
          material={m.steelDark}
        >
          <boxGeometry args={[DRIVE_RING_R * 2, 0.18, 0.3]} />
        </mesh>
      ))}
      <mesh position={[0, DRIVE_RING_Y, 0]} material={m.steel}>
        <cylinderGeometry args={[0.6, 0.6, 0.5, 20]} />
      </mesh>

      {/* Cherenkov light spilling onto the floor */}
      <pointLight
        ref={light}
        position={[0, CORE_Y, 0]}
        color={PALETTE.cyan}
        intensity={40}
        distance={26}
        decay={1.3}
      />
      <GlowDecal x={0} z={0} radius={13} color={PALETTE.cyan} intensity={0.42} />
      <GlowDecal x={0} z={0} radius={7.5} color={PALETTE.cyan} intensity={0.55} y={0.52} />
      <WorldText
        position={[0, 0.03, PLINTH_RADIUS + 0.7]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.32}
        color="#f2b81f"
        fillOpacity={0.7}
      >
        REACTOR CORE · 12-CELL DODECAHEDRAL
      </WorldText>
    </group>
  );
}
