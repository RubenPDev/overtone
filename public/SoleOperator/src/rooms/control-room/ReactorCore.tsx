import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { machine } from '../../game/refuel';
import { simHost } from '../../game/runtime';
import { Baked } from '../../scene/Baked';
import { fresnelGlass } from '../../scene/materials';
import { GlowDecal, WorldText } from '../../scene/parts';
import { hazardTexture } from '../../scene/textures';
import { useMode } from '../../state/mode';
import { PALETTE } from '../../styles/palette';
import { PLINTH_RADIUS, TANK_RADIUS } from './index';
import { CORE_RADIUS, CORE_Y, DRIVE_RING_R, DRIVE_RING_Y, ROD_RETRACTED_T, coreFaces } from './coreGeometry';

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
  const tips = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const ports = useRef<THREE.InstancedMesh>(null);
  const cassettes = useRef<THREE.InstancedMesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const water = useRef<THREE.MeshBasicMaterial>(null);

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
      // Unlit transparents: the camera zooms right onto the tank, so these cover most of the screen.
      guide: new THREE.MeshBasicMaterial({
        color: '#8fb3c4',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
      gantry: new THREE.MeshStandardMaterial({ color: PALETTE.gantry, roughness: 0.5, metalness: 0.25 }),
      glass: fresnelGlass('#d6f6ff', 0.03, 0.5),
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
  // Ports, tips, drive caps and cassettes are instanced: 4 draw calls instead of 48.
  const inst = useMemo(() => {
    const portMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const casMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#1f7f9a',
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.45,
    });
    // Cassette = unit pentagonal prism, placed and turned to match each face's corners.
    const casBase = faces.map((f) => {
      const yAxis = f.normal.clone();
      const zAxis = f.corners[0]!.clone().sub(f.center).normalize();
      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
      const r = f.corners[0]!.distanceTo(f.center) * 0.84;
      const m4 = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
      m4.scale(new THREE.Vector3(r, 1, r));
      m4.setPosition(f.center.clone().addScaledVector(f.normal, 0.05));
      return m4;
    });
    const portBase = faces.map((f) =>
      new THREE.Matrix4().compose(
        f.center.clone().addScaledVector(f.normal, 0.09),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    return {
      portMat,
      casMat,
      casBase,
      portBase,
      hidden: new THREE.Matrix4().makeScale(0, 0, 0),
      tipGeo: new THREE.CylinderGeometry(0.13, 0.13, 0.34, 12),
      capGeo: new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12),
      portGeo: new THREE.TorusGeometry(0.3, 0.055, 8, 24),
      casGeo: new THREE.CylinderGeometry(1, 1, 0.07, 5),
      tmp: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      v: new THREE.Vector3(),
      one: new THREE.Vector3(1, 1, 1),
      c: new THREE.Color(),
    };
  }, [faces]);

  const coreGeo = useMemo(() => new THREE.DodecahedronGeometry(CORE_RADIUS, 0), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(coreGeo), [coreGeo]);
  // All 12 guide tubes in one transparent mesh.
  const guideGeo = useMemo(
    () =>
      mergeGeometries(faces.map((f) => new THREE.TubeGeometry(f.rodCurve, TUBULAR, 0.12, RADIAL, false)))!,
    [faces],
  );
  const rodGeos = useMemo(
    () => faces.map((f) => new THREE.TubeGeometry(f.rodCurve, TUBULAR, 0.08, RADIAL, false)),
    [faces],
  );

  useLayoutEffect(() => {
    for (const mesh of [ports.current, cassettes.current]) {
      if (!mesh) continue;
      for (let i = 0; i < faces.length; i++) mesh.setColorAt(i, inst.c.set('#ffffff'));
    }
    faces.forEach((_, i) => {
      ports.current?.setMatrixAt(i, inst.portBase[i]!);
      cassettes.current?.setMatrixAt(i, inst.casBase[i]!);
    });
  }, [faces, inst]);

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
      const tt = Math.min(t, 0.999);
      inst.q.setFromUnitVectors(up, f.rodCurve.getTangentAt(tt));
      tips.current?.setMatrixAt(i, inst.tmp.compose(f.rodCurve.getPointAt(tt, inst.v), inst.q, inst.one));
      inst.v.set(f.drive.x, DRIVE_RING_Y + 0.45 + (1 - rod.insertion) * 0.4, f.drive.z);
      caps.current?.setMatrixAt(i, inst.tmp.makeTranslation(inst.v));

      // Port glow: brighter as the rod withdraws and the cell works harder.
      const cell = s.cells[f.cell]!;
      const hot = cell.loaded && cell.burnup > 0.9;
      const glow = cell.loaded ? (0.5 + 2.8 * (1 - rod.insertion)) * (0.4 + 0.6 * powerFactor) : 0.05;
      ports.current?.setColorAt(
        i,
        cell.loaded ? inst.c.copy(hot ? AMBER : CYAN).multiplyScalar(glow) : inst.c.set('#16222b'),
      );

      // Cassette: present when the cell is loaded, except while the arm is carrying it away or seating a new one.
      let visible = cell.loaded;
      if (refuelling && machine.cell === f.cell) {
        if (machine.phase === 'extract' && machine.progress > 0.55) visible = false;
        if (machine.phase === 'load' && machine.progress > 0.7) visible = true;
      }
      const cas = cassettes.current;
      if (cas) {
        cas.setMatrixAt(i, visible ? inst.casBase[i]! : inst.hidden);
        cas.setColorAt(i, inst.c.set(hot ? '#e0a066' : cell.burnup < 0.15 ? '#e7fbff' : '#8fb6c6'));
      }
    });
    for (const mesh of [tips.current, caps.current, ports.current, cassettes.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    const flicker = 1 + Math.sin(state.clock.elapsedTime * 7.3) * 0.015;
    if (light.current) light.current.intensity = (30 + 60 * powerFactor) * flicker;
    if (water.current)
      water.current.color.setRGB(0.12, 0.55, 0.78).multiplyScalar((0.75 + 0.45 * powerFactor) * flicker);
  });

  return (
    <Baked>
      {/* Plinth with hazard band */}
      <mesh position={[0, 0.25, 0]} material={m.plinth} receiveShadow castShadow>
        <cylinderGeometry args={[PLINTH_RADIUS, PLINTH_RADIUS + 0.1, 0.5, 64]} />
      </mesh>
      <mesh position={[0, 0.25, 0]} material={m.hazard}>
        <cylinderGeometry args={[PLINTH_RADIUS + 0.05, PLINTH_RADIUS + 0.15, 0.42, 64, 1, true]} />
      </mesh>

      {/* Core, cassettes and ports */}
      <group position={[0, CORE_Y, 0]}>
        <mesh geometry={coreGeo} material={m.core} castShadow />
        <lineSegments geometry={edgeGeo} material={m.edge} />
      </group>
      <instancedMesh
        ref={cassettes}
        args={[inst.casGeo, inst.casMat, faces.length]}
        frustumCulled={false}
        userData={{ noBake: true }}
      />
      <instancedMesh
        ref={ports}
        args={[inst.portGeo, inst.portMat, faces.length]}
        frustumCulled={false}
        userData={{ noBake: true }}
      />
      {faces.map((f, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal);
        return (
          <mesh
            key={`p${i}`}
            position={f.center.clone().addScaledVector(f.normal, 0.1)}
            quaternion={q}
            material={m.steelDark}
          >
            <circleGeometry args={[0.2, 20]} />
          </mesh>
        );
      })}

      {/* Rods: guide tube (full path) + rod (drawn down to its tip) + tip + drive */}
      <mesh geometry={guideGeo} material={m.guide} renderOrder={1} />
      <instancedMesh
        ref={tips}
        args={[inst.tipGeo, m.tip, faces.length]}
        frustumCulled={false}
        userData={{ noBake: true }}
      />
      <instancedMesh
        ref={caps}
        args={[inst.capGeo, m.driveCap, faces.length]}
        frustumCulled={false}
        userData={{ noBake: true }}
      />
      {faces.map((f, i) => (
        <group key={`r${i}`}>
          <mesh
            ref={(el) => void (rodMeshes.current[i] = el)}
            userData={{ noBake: true }}
            geometry={rodGeos[i]}
            material={rodMats[i]}
            castShadow
          />
          <mesh position={[f.drive.x, DRIVE_RING_Y + 0.2, f.drive.z]} material={m.steelDark} castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.55, 12]} />
          </mesh>
        </group>
      ))}

      {/* Water column, surface and glass */}
      <mesh position={[0, (TANK_BOTTOM + 6.5) / 2, 0]} renderOrder={2}>
        <cylinderGeometry args={[TANK_RADIUS - 0.08, TANK_RADIUS - 0.08, 6.5 - TANK_BOTTOM, 64, 1, true]} />
        <meshBasicMaterial
          ref={water}
          color="#2aa6cf"
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
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
    </Baked>
  );
}
