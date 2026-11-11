import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createThrottle } from '../../core/clock';
import { drone, resetDrone, updateDrone } from '../../game/drone';
import { simHost } from '../../game/runtime';
import { MAX_FIELD, RECIPE_BY_ID, STOCK_LABEL, type PlantState } from '../../sim';
import { Baked } from '../../scene/Baked';
import { Beamline, CryomoduleString } from '../../scene/Beamline';
import { glow, std } from '../../scene/materials';
import { FloorText, GlowDecal, WorldText } from '../../scene/parts';
import { AlarmBeacon, Extinguisher, Pipe, SecurityCamera, Terminal } from '../../scene/props';
import { hazardTexture } from '../../scene/textures';
import { PALETTE } from '../../styles/palette';
import type { RoomContentsProps } from '../../world/types';
import { BEAM_Y, BEAM_Z, CAVITY_X, DETECTOR, HALF_LENGTH, SHUTTLE, TARGET_VESSEL, specFor } from './index';

const FONT = '"Oxanium", "Rajdhani", sans-serif';
const RING_PURPLE = '#a58cff';

/** A floating holographic panel (additive, unlit) redrawn from the sim a couple of times a second. */
function HoloPanel({
  position,
  rotation = [0, 0, 0],
  width,
  height,
  draw,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
  draw: (g: CanvasRenderingContext2D, s: Readonly<PlantState>, w: number, h: number) => void;
}) {
  const { canvas, tex, mat, throttle } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.round((512 * height) / width);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(1.8, 1.8, 1.8),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    return { canvas, tex, mat, throttle: createThrottle(2) };
  }, [width, height]);
  useEffect(() => () => (tex.dispose(), mat.dispose()), [tex, mat]);
  useFrame((_, dt) => {
    if (!throttle(dt)) return;
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, canvas.width, canvas.height);
    draw(g, simHost.state, canvas.width, canvas.height);
    tex.needsUpdate = true;
  });
  return (
    <mesh position={position} rotation={rotation} material={mat} userData={{ noBake: true }}>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
}

function holoFrame(g: CanvasRenderingContext2D, w: number, h: number, title: string, color = '#5fe3ff') {
  g.fillStyle = 'rgba(40,140,180,0.32)';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = color;
  g.font = `700 30px ${FONT}`;
  g.fillText(title, 18, 42);
}

const drawRf = (g: CanvasRenderingContext2D, s: Readonly<PlantState>, w: number, h: number) => {
  const cav = s.accel.cavities;
  let worst = 0;
  cav.forEach((c, i) => {
    if (c.field < cav[worst]!.field) worst = i;
  });
  const bad = cav[worst]!.field < MAX_FIELD * 0.95;
  holoFrame(
    g,
    w,
    h,
    bad ? `RF CAVITY ${String(worst + 1).padStart(2, '0')} DETUNED` : 'RF CAVITIES IN TUNE',
    bad ? '#ffb35c' : '#6dffb6',
  );
  const bw = (w - 60) / cav.length;
  cav.forEach((c, i) => {
    const f = c.field / MAX_FIELD;
    const x = 30 + i * bw;
    const bh = (h - 120) * f;
    g.fillStyle =
      f > 0.95 ? 'rgba(109,255,182,0.7)' : f > 0.85 ? 'rgba(255,179,92,0.8)' : 'rgba(255,90,80,0.85)';
    g.fillRect(x + 6, h - 50 - bh, bw - 12, bh);
    g.fillStyle = '#cfefff';
    g.font = `600 20px ${FONT}`;
    g.fillText(String(i + 1).padStart(2, '0'), x + bw / 2 - 11, h - 22);
  });
  g.fillStyle = '#cfefff';
  g.font = `600 22px ${FONT}`;
  g.fillText(
    `${s.accel.energy.toFixed(2)} GeV · ${s.accel.current.toFixed(2)} mA · loss ${(s.accel.loss * 100).toFixed(2)}%`,
    18,
    76,
  );
};

const drawTarget = (g: CanvasRenderingContext2D, s: Readonly<PlantState>, w: number, h: number) => {
  const a = s.accel;
  const r = a.recipe ? RECIPE_BY_ID.get(a.recipe) : null;
  holoFrame(g, w, h, r ? r.name.toUpperCase() : 'TARGET IDLE', r ? '#5fe3ff' : '#a58cff');
  g.fillStyle = '#cfefff';
  g.font = `600 24px ${FONT}`;
  const p = a.energy * a.current;
  g.fillText(`${p.toFixed(2)} MW on target`, 18, 84);
  if (r) {
    g.fillText(`${STOCK_LABEL[r.stock]}: ${Math.floor(a.stock[r.stock])} ${r.unit}`, 18, 120);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(18, 140, w - 36, 16);
    g.fillStyle = '#5fe3ff';
    g.fillRect(18, 140, (w - 36) * a.progress, 16);
  } else {
    g.fillText(a.beamOn ? 'Beam circulating · select a run' : 'Beam off', 18, 120);
  }
};

/** Shuttle stop: platform, rail and a parked pod. */
function ShuttleStop() {
  const m = useMemo(
    () => ({
      deck: std({ color: '#3a4350', roughness: 0.7, metalness: 0.3 }),
      edge: new THREE.MeshStandardMaterial({ map: hazardStripes(), roughness: 0.6 }),
      rail: std({ color: '#c3ccd6', roughness: 0.2, metalness: 0.9 }),
      pod: std({ color: '#e9eef2', roughness: 0.3, metalness: 0.4 }),
      podDark: std({ color: '#1b222b', roughness: 0.4, metalness: 0.5 }),
      window: glow(PALETTE.cyan, 1.6),
      stripe: glow(RING_PURPLE, 2),
    }),
    [],
  );
  return (
    <group>
      <mesh position={[SHUTTLE.x, 0.15, 5.8]} material={m.deck} receiveShadow>
        <boxGeometry args={[6.8, 0.3, 2.4]} />
      </mesh>
      <mesh position={[SHUTTLE.x, 0.31, 4.62]} material={m.edge}>
        <boxGeometry args={[6.8, 0.02, 0.25]} />
      </mesh>
      {[6.0, 6.6].map((z) => (
        <mesh key={z} position={[0, 0.34, z]} rotation={[0, 0, Math.PI / 2]} material={m.rail}>
          <cylinderGeometry args={[0.05, 0.05, HALF_LENGTH * 2, 8]} />
        </mesh>
      ))}
      <group position={[SHUTTLE.x, 0.95, 6.3]}>
        <mesh material={m.pod} castShadow>
          <capsuleGeometry args={[0.55, 3.2, 6, 16]} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} material={m.pod} castShadow>
          <capsuleGeometry args={[0.6, 2.6, 6, 16]} />
        </mesh>
        <mesh position={[0, 0.2, -0.52]} material={m.window}>
          <boxGeometry args={[2.6, 0.32, 0.05]} />
        </mesh>
        <mesh position={[0, -0.25, -0.58]} material={m.stripe}>
          <boxGeometry args={[3.2, 0.06, 0.04]} />
        </mesh>
        <mesh position={[0, -0.62, 0]} material={m.podDark}>
          <boxGeometry args={[3.4, 0.16, 0.8]} />
        </mesh>
      </group>
      <WorldText position={[SHUTTLE.x, 3.2, 6.9]} rotation={[0, Math.PI, 0]} fontSize={0.36} color="#c8b8ff">
        RING SHUTTLE
      </WorldText>
      <GlowDecal x={SHUTTLE.x} z={5.4} radius={3.4} color={RING_PURPLE} intensity={0.35} />
    </group>
  );
}

let stripesCache: THREE.Texture | null = null;
function hazardStripes() {
  if (stripesCache) return stripesCache;
  const t = hazardTexture().clone();
  t.needsUpdate = true;
  t.repeat.set(14, 0.5);
  return (stripesCache = t);
}

/** Cable trays and lighting along the back wall; hazard line along the beamline. */
function HallDressing({ sector }: { sector: number }) {
  const cables = [
    ['#d84a3a', 4.6],
    ['#4fbf6a', 4.85],
    ['#f2b81f', 5.1],
    ['#4f8ff0', 5.35],
  ] as const;
  const lamp = glow('#e8f6ff', 2.4);
  const dash = glow(PALETTE.hazard, 1.1);
  return (
    <group>
      {cables.map(([c, y]) => (
        <mesh key={c} position={[0, y, -6.78]} material={std({ color: c, roughness: 0.6 })}>
          <boxGeometry args={[HALF_LENGTH * 2, 0.12, 0.16]} />
        </mesh>
      ))}
      <mesh position={[0, 4.35, -6.7]} material={std({ color: '#9aa6b2', roughness: 0.4, metalness: 0.7 })}>
        <boxGeometry args={[HALF_LENGTH * 2, 0.06, 0.5]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => -19.25 + i * 5.5).map((x) => (
        <group key={x}>
          <mesh position={[x, 6.1, -6.72]} material={lamp}>
            <boxGeometry args={[2.2, 0.08, 0.12]} />
          </mesh>
          <GlowDecal x={x} z={-1.5} radius={3.2} color="#cfe8ff" intensity={0.22} />
        </group>
      ))}
      {Array.from({ length: 22 }, (_, i) => -21 + i * 2).map((x) => (
        <mesh
          key={x}
          position={[x + 0.5, 0.015, BEAM_Z + 1.25]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={dash}
        >
          <planeGeometry args={[1.0, 0.12]} />
        </mesh>
      ))}
      <WorldText
        position={[-6, 3.0, -6.76]}
        fontSize={2.4}
        color="#c8b8ff"
        fillOpacity={0.22}
        letterSpacing={0.1}
      >
        {`S${sector}`}
      </WorldText>
      <Pipe
        axis="x"
        from={-HALF_LENGTH}
        to={HALF_LENGTH}
        y={5.95}
        offset={-6.6}
        r={0.12}
        band={RING_PURPLE}
      />
      <Extinguisher x={-2} z={-6.78} yaw={0} />
      {Array.from({ length: 6 }, (_, i) => -18 + i * 7.5).map((x) => (
        <GlowDecal key={`b${x}`} x={x} z={BEAM_Z} radius={2.4} color={PALETTE.cyan} intensity={0.3} />
      ))}
    </group>
  );
}

/** RF Station: the cryomodule string, waveguides, the RF console and the rail drone. */
function RfStation() {
  const droneRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(1.4),
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => resetDrone(), []);
  useFrame((_, dt) => {
    updateDrone(Math.min(dt, 0.1));
    const d = droneRef.current;
    if (d) d.position.x = drone.x;
    if (beamRef.current) beamRef.current.visible = drone.phase === 'scan';
  });
  const rail = std({ color: '#c3ccd6', roughness: 0.2, metalness: 0.9 });
  const body = std({ color: '#e9eef2', roughness: 0.3, metalness: 0.4 });
  return (
    <group>
      <Baked>
        <CryomoduleStringStatic />
        <Terminal x={5} z={-1.8} yaw={0} screen={PALETTE.amber} />
        {/* Klystron cabinets in the RF gallery along the back wall */}
        {CAVITY_X.map((x) => (
          <group key={x}>
            <mesh position={[x, 4.9, -6.2]} material={std({ color: '#dfe5eb', roughness: 0.5 })} castShadow>
              <boxGeometry args={[2.2, 1.6, 1.0]} />
            </mesh>
            <mesh position={[x + 0.7, 5.3, -5.68]} material={glow(PALETTE.amber, 1.6)}>
              <boxGeometry args={[0.4, 0.12, 0.02]} />
            </mesh>
          </group>
        ))}
        {/* Drone rail above the cryomodules */}
        <mesh position={[0, 4.4, BEAM_Z + 0.9]} rotation={[0, 0, Math.PI / 2]} material={rail}>
          <cylinderGeometry args={[0.06, 0.06, 40, 8]} />
        </mesh>
        <mesh position={[-18.5, 0.6, -1.9]} material={std({ color: '#2b333d', roughness: 0.6 })}>
          <boxGeometry args={[1.2, 1.2, 0.9]} />
        </mesh>
      </Baked>
      <CryomoduleString xs={CAVITY_X} y={BEAM_Y} z={BEAM_Z} />
      {/* Rail drone */}
      <group ref={droneRef} position={[drone.x, 4.05, BEAM_Z + 0.9]}>
        <mesh material={body} castShadow>
          <boxGeometry args={[0.7, 0.32, 0.5]} />
        </mesh>
        <mesh position={[0, -0.2, 0]} material={glow(PALETTE.cyan, 2.5)}>
          <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
        </mesh>
        <mesh
          ref={beamRef}
          position={[0, -1.35, -0.45]}
          rotation={[0.35, 0, 0]}
          material={beamMat}
          visible={false}
        >
          <coneGeometry args={[0.9, 2.4, 20, 1, true]} />
        </mesh>
      </group>
      <HoloPanel position={[5, 3.1, -1.6]} rotation={[-0.1, 0, 0]} width={3.2} height={1.8} draw={drawRf} />
    </group>
  );
}

/** Static parts of the cryomodule string live in <CryomoduleString>; this is a hook point for extra bake-able dressing. */
function CryomoduleStringStatic() {
  return (
    <group>
      {CAVITY_X.map((x) => (
        <mesh
          key={x}
          position={[x, 0.35, BEAM_Z]}
          material={std({ color: '#2b333d', roughness: 0.6, metalness: 0.3 })}
        >
          <boxGeometry args={[2.6, 0.7, 1.2]} />
        </mesh>
      ))}
    </group>
  );
}

/** Target Station: extraction line, shielded target vessel, feed loader and the production console. */
function TargetStation() {
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((s) => {
    const a = simHost.state.accel;
    const on = a.beamOn && a.recipe !== null;
    coreMat.current?.color
      .set(on ? PALETTE.cyan : '#25404c')
      .multiplyScalar(on ? 2.4 + Math.sin(s.clock.elapsedTime * 6) * 0.3 : 1);
  });
  const steel = std({ color: '#5a6672', roughness: 0.4, metalness: 0.7 });
  const band = std({ color: PALETTE.hazard, roughness: 0.5 });
  const blue = std({ color: '#2f6fd0', roughness: 0.28, metalness: 0.45 });
  const pipe = std({ color: '#d5dde5', roughness: 0.15, metalness: 0.9 });
  const v = TARGET_VESSEL;
  // Extraction line: leaves the ring at x = -3 and bends toward the vessel.
  const from = new THREE.Vector3(-3, BEAM_Y, BEAM_Z);
  const to = new THREE.Vector3(v.x - v.r * 0.7, BEAM_Y + 0.3, v.z - v.r * 0.7);
  const mid = from.clone().lerp(to, 0.5);
  const dir = to.clone().sub(from);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <group>
      <Baked>
        <mesh position={[v.x, 1.6, v.z]} material={steel} castShadow receiveShadow>
          <cylinderGeometry args={[v.r, v.r + 0.2, 3.2, 32]} />
        </mesh>
        {[0.5, 2.7].map((y) => (
          <mesh key={y} position={[v.x, y, v.z]} material={band}>
            <cylinderGeometry args={[v.r + 0.05, v.r + 0.05, 0.16, 32]} />
          </mesh>
        ))}
        <mesh
          position={[v.x, 3.35, v.z]}
          material={std({ color: '#3a4350', roughness: 0.5, metalness: 0.6 })}
        >
          <cylinderGeometry args={[v.r - 0.4, v.r, 0.3, 32]} />
        </mesh>
        <mesh position={mid} quaternion={q} material={pipe}>
          <cylinderGeometry args={[0.14, 0.14, dir.length(), 12]} />
        </mesh>
        <mesh position={from.clone().lerp(to, 0.3)} quaternion={q} material={blue} castShadow>
          <boxGeometry args={[0.9, 1.6, 0.9]} />
        </mesh>
        {/* Feed loader */}
        <mesh
          position={[v.x + 2.6, 0.9, v.z + 1.4]}
          material={std({ color: PALETTE.gantry, roughness: 0.5 })}
          castShadow
        >
          <boxGeometry args={[1.2, 1.8, 1.2]} />
        </mesh>
        <mesh position={[v.x + 1.7, 1.5, v.z + 0.9]} rotation={[0, 0.5, 0.6]} material={pipe}>
          <cylinderGeometry args={[0.12, 0.12, 1.6, 10]} />
        </mesh>
        <Terminal x={0.5} z={3.6} yaw={Math.PI} screen={PALETTE.cyan} />
        <WorldText position={[v.x, 3.9, v.z + v.r + 0.02]} fontSize={0.34} color="#f2b81f">
          TARGET VESSEL T-1
        </WorldText>
      </Baked>
      {/* Glowing window ring: lit while a production run is on target */}
      <mesh position={[v.x, 1.9, v.z]} userData={{ noBake: true }}>
        <cylinderGeometry args={[v.r + 0.02, v.r + 0.02, 0.35, 32, 1, true]} />
        <meshBasicMaterial ref={coreMat} color={PALETTE.cyan} toneMapped={false} />
      </mesh>
      <HoloPanel
        position={[0.5, 3.0, 4.4]}
        rotation={[0, Math.PI, 0]}
        width={3.0}
        height={1.6}
        draw={drawTarget}
      />
    </group>
  );
}

/** Detector Hall: concentric detector layers round the collision point. */
function DetectorHall() {
  const layers = [
    [3.4, '#ff7ad9', 0.7],
    [2.6, '#4f8ff0', 1.2],
    [1.8, '#d9e2ea', 1.8],
  ] as const;
  return (
    <group>
      <Baked>
        {layers.map(([r, c, len]) => (
          <mesh
            key={r}
            position={[DETECTOR.x, BEAM_Y, BEAM_Z]}
            rotation={[0, 0, Math.PI / 2]}
            material={std({ color: c, roughness: 0.35, metalness: 0.5 })}
            castShadow
          >
            <cylinderGeometry args={[r, r, len, 40, 1, true]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[DETECTOR.x + s * 0.95, BEAM_Y, BEAM_Z]}
            rotation={[0, 0, Math.PI / 2]}
            material={std({ color: '#2b333d', roughness: 0.5, metalness: 0.5 })}
          >
            <cylinderGeometry args={[3.5, 3.5, 0.22, 40]} />
          </mesh>
        ))}
        <Terminal x={9} z={-1.6} yaw={0} screen="#ff7ad9" />
      </Baked>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[DETECTOR.x + s * 1.07, BEAM_Y, BEAM_Z]}
          rotation={[0, Math.PI / 2, 0]}
          material={glow('#ff7ad9', 2.2)}
          userData={{ noBake: true }}
        >
          <torusGeometry args={[3.45, 0.05, 8, 60]} />
        </mesh>
      ))}
    </group>
  );
}

/** Injector Linac: a straight copper accelerating structure with klystrons. */
function Linac() {
  const copper = std({ color: '#c87a45', roughness: 0.3, metalness: 0.85 });
  return (
    <Baked>
      <mesh position={[0, BEAM_Y, BEAM_Z]} rotation={[0, 0, Math.PI / 2]} material={copper} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 30, 20]} />
      </mesh>
      {Array.from({ length: 30 }, (_, i) => -14.5 + i).map((x) => (
        <mesh key={x} position={[x, BEAM_Y, BEAM_Z]} rotation={[0, 0, Math.PI / 2]} material={copper}>
          <cylinderGeometry args={[0.5, 0.5, 0.12, 20]} />
        </mesh>
      ))}
      {[-10, 0, 10].map((x) => (
        <mesh
          key={x}
          position={[x, 1.1, -6.1]}
          material={std({ color: '#dfe5eb', roughness: 0.5 })}
          castShadow
        >
          <boxGeometry args={[3, 2.2, 1.2]} />
        </mesh>
      ))}
    </Baked>
  );
}

/** Beam Dump: a massive shielded block taking the beam when it's dumped. */
function BeamDump() {
  return (
    <Baked>
      <mesh
        position={[13, 1.8, -4.4]}
        material={std({ color: '#7d8590', roughness: 0.9 })}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[8, 3.6, 5.2]} />
      </mesh>
      <mesh position={[9, 1.25, -4.4]} material={std({ color: '#3a4350', roughness: 0.4, metalness: 0.7 })}>
        <boxGeometry args={[0.1, 1.6, 1.6]} />
      </mesh>
      <WorldText position={[13, 2.6, -1.78]} fontSize={0.5} color="#ff9a4a">
        BEAM DUMP · KEEP CLEAR
      </WorldText>
    </Baked>
  );
}

/** Contents for every ring sector chamber, picked by the sector's station type. */
export default function RingSectorContents({ room }: RoomContentsProps) {
  const spec = specFor(room.id)!;
  const skip: [number, number][] =
    spec.station === 'rf'
      ? [[-16.5, 16.5]]
      : spec.station === 'detector'
        ? [[-4.5, 4.5]]
        : spec.station === 'linac'
          ? [[-15.5, 15.5]]
          : spec.station === 'dump'
            ? [[8.5, 22]]
            : [];
  return (
    <group>
      <Baked>
        <HallDressing sector={spec.sector} />
        <ShuttleStop />
        <FloorText position={[-2, 0.02, 1.4]} yaw={0} fontSize={0.42} color="#c8b8ff" fillOpacity={0.4}>
          {`${spec.name.toUpperCase()} · RING LEVEL B4`}
        </FloorText>
      </Baked>
      <Beamline x0={-HALF_LENGTH} x1={HALF_LENGTH} y={BEAM_Y} z={BEAM_Z} skip={skip} />
      {spec.station === 'rf' && <RfStation />}
      {spec.station === 'target' && <TargetStation />}
      {spec.station === 'detector' && <DetectorHall />}
      {spec.station === 'linac' && <Linac />}
      {spec.station === 'dump' && <BeamDump />}
      <AlarmBeacon x={-HALF_LENGTH} z={-5.6} y={3.4} yaw={Math.PI / 2} />
      <SecurityCamera x={18} z={-6.6} y={5.6} yaw={0} />
      <pointLight position={[0, 5, 1]} color="#dfe9ff" intensity={55} distance={34} decay={1.2} />
    </group>
  );
}
