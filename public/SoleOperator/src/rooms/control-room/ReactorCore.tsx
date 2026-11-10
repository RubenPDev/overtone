import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { machine } from '../../game/refuel';
import { simHost } from '../../game/runtime';
import { GlowDecal, WorldText } from '../../scene/parts';
import { hazardTexture } from '../../scene/textures';
import { useHud } from '../../state/hud';
import { useMode } from '../../state/mode';
import { PALETTE } from '../../styles/palette';
import { PLINTH_RADIUS, TANK_RADIUS } from './index';
import {
  CORE_RADIUS,
  CORE_Y,
  DRIVE_RING_R,
  DRIVE_RING_Y,
  ROD_RETRACTED_T,
  cassetteGeometry,
  coreFaces,
} from './coreGeometry';

const TANK_BOTTOM = 0.5;
const TANK_TOP = 7.1;
const TUBULAR = 80;
const RADIAL = 8;
const up = new THREE.Vector3(0, 1, 0);
const CYAN = new THREE.Color(PALETTE.cyan);
const AMBER = new THREE.Color(PALETTE.amber);

/** How far along its path a rod's tip is for an insertion (0 = out, 1 = in the port). */
export function rodTipT(insertion: number) {
  return ROD_RETRACTED_T + (1 - ROD_RETRACTED_T) * insertion;
}

/**
 * The reactor: a dodecahedral core of 12 fuel cells in a glass cylinder of
 * water. Each control rod slides along its guide tube from the drive ring
 * into its port; rods, tips, port glow and cassettes all follow the sim in
 * useFrame. Only cell burn-up colours and rod selection re-render (rarely).
 */
export function ReactorCore() {
  const faces = useMemo(() => coreFaces(), []);
  const cellTone = useHud((s) =>
    s.sim
      ? s.sim.cells
          .map((c) => (!c.loaded ? 'e' : c.burnup > 0.9 ? 'h' : c.burnup < 0.15 ? 'f' : 'o'))
          .join('')
      : '',
  );
  const selected = useMode((s) =>
    s.mode.kind === 'rods'
      ? s.mode.bank
        ? -2
        : s.mode.selected
      : s.mode.kind === 'refuel'
        ? s.refuel.cell
        : -1,
  );
  const rodMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const tips = useRef<(THREE.Mesh | null)[]>([]);
  const drives = useRef<(THREE.Mesh | null)[]>([]);
  const cassettes = useRef<(THREE.Mesh | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const water = useRef<THREE.MeshStandardMaterial>(null);

  const m = useMemo(() => {
    const hz = hazardTexture().clone();
    hz.needsUpdate = true;
    hz.repeat.set(26, 1);
    return {
      plinth: new THREE.MeshStandardMaterial({ color: '#36404c', roughness: 0.6, metalness: 0.35 }),
      hazard: new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.3, metalness: 0.8 }),
      steelDark: new THREE.MeshStandardMaterial({
        color: PALETTE.steelDark,
        roughness: 0.45,
        metalness: 0.7,
      }),
      guide: new THREE.MeshStandardMaterial({
        color: '#6f8796',
        roughness: 0.2,
        metalness: 0.3,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
      gantry: new THREE.MeshStandardMaterial({ color: PALETTE.gantry, roughness: 0.5, metalness: 0.25 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#d6f6ff',
        transparent: true,
        opacity: 0.12,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        envMapIntensity: 1.6,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      surface: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(1.4),
        transparent: true,
        opacity: 0.5,
        toneMapped: false,
        depthWrite: false,
      }),
      core: new THREE.MeshStandardMaterial({
        color: '#9fc9d8',
        roughness: 0.3,
        metalness: 0.55,
        flatShading: true,
        emissive: '#1f6f88',
        emissiveIntensity: 0.5,
      }),
      edge: new THREE.LineBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(2.2),
        toneMapped: false,
      }),
      portEmpty: new THREE.MeshBasicMaterial({ color: '#16222b' }),
      driveCap: new THREE.MeshStandardMaterial({
        color: '#d8423a',
        roughness: 0.4,
        emissive: '#d8423a',
        emissiveIntensity: 0.35,
      }),
      tip: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.hazard).multiplyScalar(2.2),
        toneMapped: false,
      }),
    };
  }, []);

  // Per-rod materials so the selected rod can glow; per-port materials so each port's glow follows its rod.
  const rodMats = useMemo(
    () =>
      faces.map(
        () =>
          new THREE.MeshStandardMaterial({
            color: '#e4ecf3',
            roughness: 0.2,
            metalness: 0.75,
            emissive: '#000000',
          }),
      ),
    [faces],
  );
  const portMats = useMemo(
    () => faces.map(() => new THREE.MeshBasicMaterial({ color: CYAN.clone(), toneMapped: false })),
    [faces],
  );
  const cassetteMats = useMemo(
    () => ({
      f: new THREE.MeshStandardMaterial({
        color: '#e7fbff',
        emissive: '#8ff0ff',
        emissiveIntensity: 0.55,
        roughness: 0.3,
        metalness: 0.4,
        side: THREE.DoubleSide,
      }),
      o: new THREE.MeshStandardMaterial({
        color: '#8fb6c6',
        emissive: '#2a8fae',
        emissiveIntensity: 0.35,
        roughness: 0.35,
        metalness: 0.5,
        side: THREE.DoubleSide,
      }),
      h: new THREE.MeshStandardMaterial({
        color: '#d7a46e',
        emissive: '#ff8a2a',
        emissiveIntensity: 0.6,
        roughness: 0.4,
        metalness: 0.4,
        side: THREE.DoubleSide,
      }),
    }),
    [],
  );

  const coreGeo = useMemo(() => new THREE.DodecahedronGeometry(CORE_RADIUS, 0), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(coreGeo), [coreGeo]);
  const guideGeos = useMemo(
    () => faces.map((f) => new THREE.TubeGeometry(f.rodCurve, TUBULAR, 0.12, RADIAL, false)),
    [faces],
  );
  const rodGeos = useMemo(
    () => faces.map((f) => new THREE.TubeGeometry(f.rodCurve, TUBULAR, 0.08, RADIAL, false)),
    [faces],
  );
  const cassetteGeos = useMemo(() => faces.map((f) => cassetteGeometry(f)), [faces]);

  // Selection glow (re-render only when the selection changes).
  rodMats.forEach((mat, i) => {
    const on = selected === -2 || faces[i]!.cell === selected;
    mat.emissive.set(on ? PALETTE.cyan : '#000000');
    mat.emissiveIntensity = on ? 0.9 : 0;
  });

  useFrame((state) => {
    const s = simHost.state;
    const refuelling = useMode.getState().mode.kind === 'refuel';
    const powerFactor = Math.min(1.5, s.thermalPower / 3700);

    faces.forEach((f, i) => {
      const rod = s.rods[f.cell]!;
      const t = rodTipT(rod.insertion);
      // Draw the rod tube only from the drive down to the tip.
      rodGeos[i]!.setDrawRange(0, Math.round(t * TUBULAR) * RADIAL * 6);
      const tip = tips.current[i];
      if (tip) {
        tip.position.copy(f.rodCurve.getPointAt(Math.min(t, 0.999)));
        tip.quaternion.setFromUnitVectors(up, f.rodCurve.getTangentAt(Math.min(t, 0.999)));
      }
      const drive = drives.current[i];
      if (drive) drive.position.y = DRIVE_RING_Y + 0.45 + (1 - rod.insertion) * 0.4;

      // Port glow: brighter as the rod withdraws and the cell works harder.
      const cell = s.cells[f.cell]!;
      const hot = cell.loaded && cell.burnup > 0.9;
      const glow = cell.loaded ? (0.5 + 2.8 * (1 - rod.insertion)) * (0.4 + 0.6 * powerFactor) : 0.05;
      portMats[i]!.color.copy(hot ? AMBER : CYAN).multiplyScalar(glow);

      // Cassette: present when the cell is loaded, except while the arm is carrying it away or seating a new one.
      const cas = cassettes.current[i];
      if (cas) {
        let visible = cell.loaded;
        if (refuelling && machine.cell === f.cell) {
          if (machine.phase === 'extract' && machine.progress > 0.55) visible = false;
          if (machine.phase === 'load' && machine.progress > 0.7) visible = true;
        }
        cas.visible = visible;
      }
    });

    const flicker = 1 + Math.sin(state.clock.elapsedTime * 7.3) * 0.015;
    if (light.current) light.current.intensity = (30 + 60 * powerFactor) * flicker;
    if (water.current) water.current.emissiveIntensity = (0.3 + 0.55 * powerFactor) * flicker;
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

      {/* Core, cassettes and ports */}
      <group position={[0, CORE_Y, 0]}>
        <mesh geometry={coreGeo} material={m.core} castShadow />
        <lineSegments geometry={edgeGeo} material={m.edge} />
      </group>
      {faces.map((f, i) => (
        <mesh
          key={`c${i}`}
          ref={(el) => void (cassettes.current[i] = el)}
          geometry={cassetteGeos[i]}
          material={cassetteMats[(cellTone[f.cell] ?? 'o') as 'f' | 'o' | 'h'] ?? cassetteMats.o}
        />
      ))}
      {faces.map((f, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal);
        const empty = cellTone[f.cell] === 'e';
        return (
          <group key={`p${i}`} position={f.center.clone().addScaledVector(f.normal, 0.09)} quaternion={q}>
            <mesh material={empty ? m.portEmpty : portMats[i]}>
              <torusGeometry args={[0.3, 0.055, 8, 24]} />
            </mesh>
            <mesh material={m.steelDark}>
              <circleGeometry args={[0.2, 20]} />
            </mesh>
          </group>
        );
      })}

      {/* Rods: guide tube (full path) + rod (drawn down to its tip) + tip + drive */}
      {faces.map((f, i) => (
        <group key={`r${i}`}>
          <mesh geometry={guideGeos[i]} material={m.guide} renderOrder={1} />
          <mesh
            ref={(el) => void (rodMeshes.current[i] = el)}
            geometry={rodGeos[i]}
            material={rodMats[i]}
            castShadow
          />
          <mesh ref={(el) => void (tips.current[i] = el)} material={m.tip}>
            <cylinderGeometry args={[0.13, 0.13, 0.34, 12]} />
          </mesh>
          <mesh position={[f.drive.x, DRIVE_RING_Y + 0.2, f.drive.z]} material={m.steelDark} castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.55, 12]} />
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
          opacity={0.26}
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
        intensity={60}
        distance={30}
        decay={1.2}
      />
      <GlowDecal x={0} z={0} radius={13} color={PALETTE.cyan} intensity={0.45} />
      <GlowDecal x={0} z={0} radius={7.5} color={PALETTE.cyan} intensity={0.55} y={0.52} />
      <WorldText
        position={[0, 0.03, PLINTH_RADIUS + 0.7]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.32}
        color="#f2b81f"
        fillOpacity={0.75}
      >
        REACTOR CORE · 12-CELL DODECAHEDRAL
      </WorldText>
    </group>
  );
}
