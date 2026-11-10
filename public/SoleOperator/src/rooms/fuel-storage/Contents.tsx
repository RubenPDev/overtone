import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { hook, targetUnderHook } from '../../game/crane';
import { logistics, player } from '../../game/runtime';
import { POOL_SLOTS, isFresh, type Assembly } from '../../logistics';
import { Baked } from '../../scene/Baked';
import { SeatedNpc, StandingNpc, WalkingNpc } from '../../scene/Npc';
import { FloorText, GlowDecal, WorldText } from '../../scene/parts';
import { AlarmBeacon, EyewashStation, Extinguisher, Pipe, SecurityCamera, Terminal } from '../../scene/props';
import { hazardTexture } from '../../scene/textures';
import { pushToast } from '../../state/hud';
import { useLogistics } from '../../state/logistics';
import { useMode } from '../../state/mode';
import { PALETTE } from '../../styles/palette';
import type { RoomContentsProps } from '../../world/types';
import {
  CRANE,
  POOL,
  POOL_CENTER,
  POOL_DOCK,
  POOL_FLOOR_Y,
  POOL_WATER_Y,
  PROPS,
  RACK_TOP_Y,
  WORKERS,
  slotPosition,
} from './index';

const ASSEMBLY_H = 1.5;

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d9e6ec';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(40,70,90,0.35)';
  g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 128);
    g.moveTo(0, i);
    g.lineTo(128, i);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** The sunken pool: tiled pit, rack lattice, water surface, coping and railing. */
function Pool() {
  const w = POOL.maxX - POOL.minX;
  const d = POOL.maxZ - POOL.minZ;
  const depth = -POOL_FLOOR_Y;
  const m = useMemo(() => {
    const tiles = tileTexture();
    const wallTiles = tiles.clone();
    wallTiles.needsUpdate = true;
    wallTiles.repeat.set(w / 1, depth / 1);
    const floorTiles = tiles.clone();
    floorTiles.needsUpdate = true;
    floorTiles.repeat.set(w / 1, d / 1);
    const hz = hazardTexture().clone();
    hz.needsUpdate = true;
    hz.repeat.set(20, 0.25);
    return {
      wall: new THREE.MeshStandardMaterial({
        map: wallTiles,
        color: '#9fd4e6',
        roughness: 0.4,
        side: THREE.DoubleSide,
      }),
      floor: new THREE.MeshStandardMaterial({ map: floorTiles, color: '#8fc6d8', roughness: 0.5 }),
      rack: new THREE.MeshStandardMaterial({ color: '#3f5563', roughness: 0.5, metalness: 0.6 }),
      water: new THREE.MeshStandardMaterial({
        color: '#2bb6e0',
        transparent: true,
        opacity: 0.42,
        roughness: 0.08,
        metalness: 0,
        emissive: '#0f6f8f',
        emissiveIntensity: 0.35,
        depthWrite: false,
      }),
      coping: new THREE.MeshStandardMaterial({ color: '#c9d1d9', roughness: 0.6 }),
      hazard: new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6 }),
      rail: new THREE.MeshStandardMaterial({ color: PALETTE.hazard, roughness: 0.5, metalness: 0.3 }),
    };
  }, [w, d, depth]);

  // Railing on three sides; the +x side is open at the cask dock.
  const rails: { x0: number; z0: number; x1: number; z1: number }[] = [
    { x0: POOL.minX, z0: POOL.maxZ + 0.15, x1: POOL.maxX, z1: POOL.maxZ + 0.15 },
    { x0: POOL.minX - 0.15, z0: POOL.minZ, x1: POOL.minX - 0.15, z1: POOL.maxZ },
    { x0: POOL.minX, z0: POOL.minZ - 0.15, x1: POOL.maxX, z1: POOL.minZ - 0.15 },
    { x0: POOL.maxX + 0.15, z0: POOL.minZ, x1: POOL.maxX + 0.15, z1: POOL_DOCK.z - 1.4 },
    { x0: POOL.maxX + 0.15, z0: POOL_DOCK.z + 1.4, x1: POOL.maxX + 0.15, z1: POOL.maxZ },
  ];

  return (
    <group>
      {/* Pit walls (inner faces) and floor */}
      <mesh position={[POOL_CENTER.x, POOL_FLOOR_Y / 2, POOL.minZ]} material={m.wall}>
        <planeGeometry args={[w, depth]} />
      </mesh>
      <mesh
        position={[POOL.minX, POOL_FLOOR_Y / 2, POOL_CENTER.z]}
        rotation={[0, Math.PI / 2, 0]}
        material={m.wall}
      >
        <planeGeometry args={[d, depth]} />
      </mesh>
      <mesh
        position={[POOL_CENTER.x, POOL_FLOOR_Y / 2, POOL.maxZ]}
        rotation={[0, Math.PI, 0]}
        material={m.wall}
      >
        <planeGeometry args={[w, depth]} />
      </mesh>
      <mesh
        position={[POOL.maxX, POOL_FLOOR_Y / 2, POOL_CENTER.z]}
        rotation={[0, -Math.PI / 2, 0]}
        material={m.wall}
      >
        <planeGeometry args={[d, depth]} />
      </mesh>
      <mesh
        position={[POOL_CENTER.x, POOL_FLOOR_Y, POOL_CENTER.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={m.floor}
      >
        <planeGeometry args={[w, d]} />
      </mesh>

      {/* Rack lattice on the bottom */}
      {Array.from({ length: POOL_SLOTS }, (_, i) => {
        const p = slotPosition(i);
        return (
          <group key={i} position={[p.x, POOL_FLOOR_Y, p.z]}>
            {[
              [-0.42, -0.42],
              [0.42, -0.42],
              [-0.42, 0.42],
              [0.42, 0.42],
            ].map(([x, z]) => (
              <mesh key={`${x},${z}`} position={[x!, 0.8, z!]} material={m.rack}>
                <boxGeometry args={[0.07, 1.6, 0.07]} />
              </mesh>
            ))}
            <mesh position={[0, 1.6, 0]} material={m.rack}>
              <boxGeometry args={[0.95, 0.06, 0.95]} />
            </mesh>
          </group>
        );
      })}

      {/* Coping with hazard edge, then the water */}
      {[
        [POOL_CENTER.x, POOL.minZ - 0.15, w + 0.6, 0.3],
        [POOL_CENTER.x, POOL.maxZ + 0.15, w + 0.6, 0.3],
        [POOL.minX - 0.15, POOL_CENTER.z, 0.3, d],
        [POOL.maxX + 0.15, POOL_CENTER.z, 0.3, d],
      ].map(([x, z, a, b], i) => (
        <mesh
          key={i}
          position={[x!, 0.0, z!]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={m.hazard}
          receiveShadow
        >
          <planeGeometry args={[a!, b!]} />
        </mesh>
      ))}
      <mesh
        position={[POOL_CENTER.x, POOL_WATER_Y, POOL_CENTER.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={m.water}
        renderOrder={3}
      >
        <planeGeometry args={[w, d]} />
      </mesh>
      {rails.map((r, i) => {
        const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
        const alongX = Math.abs(r.x1 - r.x0) > Math.abs(r.z1 - r.z0);
        const posts = Math.max(2, Math.round(len / 1.6) + 1);
        return (
          <group key={i}>
            <mesh position={[(r.x0 + r.x1) / 2, 1.0, (r.z0 + r.z1) / 2]} material={m.rail} castShadow>
              <boxGeometry args={alongX ? [len, 0.06, 0.06] : [0.06, 0.06, len]} />
            </mesh>
            <mesh position={[(r.x0 + r.x1) / 2, 0.55, (r.z0 + r.z1) / 2]} material={m.rail}>
              <boxGeometry args={alongX ? [len, 0.04, 0.04] : [0.04, 0.04, len]} />
            </mesh>
            {Array.from({ length: posts }, (_, k) => {
              const t = k / (posts - 1);
              return (
                <mesh
                  key={k}
                  position={[r.x0 + (r.x1 - r.x0) * t, 0.5, r.z0 + (r.z1 - r.z0) * t]}
                  material={m.rail}
                >
                  <boxGeometry args={[0.06, 1.0, 0.06]} />
                </mesh>
              );
            })}
          </group>
        );
      })}

      {/* Underwater light: the pool glows, spent fuel adds Cherenkov blue */}
      <pointLight
        position={[POOL_CENTER.x, -1.4, POOL_CENTER.z]}
        color="#5fe3ff"
        intensity={45}
        distance={16}
        decay={1.3}
      />
      <GlowDecal
        x={POOL_CENTER.x}
        z={POOL_CENTER.z}
        y={POOL_FLOOR_Y + 0.02}
        radius={7}
        color="#5fe3ff"
        intensity={0.6}
      />
      <GlowDecal x={POOL_CENTER.x} z={POOL_CENTER.z} y={0.01} radius={9} color="#5fe3ff" intensity={0.16} />
    </group>
  );
}

/** One fuel assembly: a tall square bundle with a glowing top (green = fresh, cyan = spent). */
function AssemblyMesh({ a, position }: { a: Assembly; position?: [number, number, number] }) {
  const m = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: '#b8c4cf', roughness: 0.3, metalness: 0.7 }),
      cap: new THREE.MeshBasicMaterial({
        color: new THREE.Color(isFresh(a) ? '#8dff6a' : PALETTE.cyan).multiplyScalar(isFresh(a) ? 2.2 : 2.8),
        toneMapped: false,
      }),
    }),
    [a],
  );
  return (
    <group position={position}>
      <mesh position={[0, -ASSEMBLY_H / 2, 0]} material={m.body} castShadow>
        <boxGeometry args={[0.42, ASSEMBLY_H, 0.42]} />
      </mesh>
      <mesh position={[0, 0.03, 0]} material={m.cap}>
        <boxGeometry args={[0.3, 0.06, 0.3]} />
      </mesh>
      <mesh position={[0, 0.12, 0]} material={m.body}>
        <boxGeometry args={[0.12, 0.14, 0.12]} />
      </mesh>
    </group>
  );
}

/** Assemblies racked in the pool (re-renders only when something is moved). */
function RackedAssemblies() {
  const pool = useLogistics((s) => s.pool);
  return (
    <group>
      {pool.map((a, i) => {
        if (!a) return null;
        const p = slotPosition(i);
        return (
          <group key={a.id}>
            <AssemblyMesh a={a} position={[p.x, RACK_TOP_Y, p.z]} />
            {!isFresh(a) && (
              <GlowDecal
                x={p.x}
                z={p.z}
                y={POOL_FLOOR_Y + 0.03}
                radius={1.2}
                color={PALETTE.cyan}
                intensity={0.5}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/** Overhead bridge crane: rails, bridge, trolley, cable, hook block and whatever it's holding. */
function BridgeCrane() {
  const bridge = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Mesh>(null);
  const hookBlock = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Mesh>(null);
  const holding = useLogistics((s) => s.holding);
  const m = useMemo(() => {
    const hz = hazardTexture().clone();
    hz.needsUpdate = true;
    hz.repeat.set(10, 0.5);
    return {
      yellow: new THREE.MeshStandardMaterial({ color: PALETTE.gantry, roughness: 0.45, metalness: 0.35 }),
      hazard: new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a323c', roughness: 0.5, metalness: 0.6 }),
      cable: new THREE.MeshStandardMaterial({ color: '#1b1f24', roughness: 0.6, metalness: 0.4 }),
      marker: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(2),
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
      }),
    };
  }, []);
  const span = CRANE.railZ[1] - CRANE.railZ[0];
  const railX0 = CRANE.minX - 1.6;
  const railX1 = CRANE.maxX + 1.6;

  useFrame((s) => {
    const c = logistics.state.crane;
    if (bridge.current) bridge.current.position.x = c.x;
    if (trolley.current) trolley.current.position.z = c.z;
    const top = CRANE.railY - 0.35;
    if (cable.current) {
      const len = Math.max(0.1, top - hook.y);
      cable.current.scale.y = len;
      cable.current.position.y = top - len / 2;
    }
    if (hookBlock.current) hookBlock.current.position.y = hook.y;
    // Target marker on the water / cask while the crane is being driven.
    const mk = marker.current;
    if (mk) {
      const active = useMode.getState().mode.kind === 'crane';
      const t = active ? targetUnderHook() : null;
      mk.visible = !!t;
      if (t) {
        mk.position.set(c.x, (t.kind === 'cask' ? t.y : POOL_WATER_Y) + 0.03, c.z);
        mk.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 5) * 0.08);
        m.marker.color
          .set(t.kind === 'none' ? '#8aa0b0' : PALETTE.cyan)
          .multiplyScalar(t.kind === 'none' ? 1 : 2);
      }
    }
  });

  return (
    <group>
      {/* Runway rails on columns (static, baked) */}
      <Baked>
        {CRANE.railZ.map((z) => (
          <group key={z}>
            <mesh position={[(railX0 + railX1) / 2, CRANE.railY, z]} material={m.yellow} castShadow>
              <boxGeometry args={[railX1 - railX0, 0.35, 0.35]} />
            </mesh>
            {[railX0 + 0.2, railX1 - 0.2].map((x) => (
              <mesh key={x} position={[x, CRANE.railY / 2, z]} material={m.yellow} castShadow>
                <boxGeometry args={[0.32, CRANE.railY, 0.32]} />
              </mesh>
            ))}
          </group>
        ))}
      </Baked>
      {/* Bridge (moves in x) carrying the trolley (moves in z) */}
      <group ref={bridge}>
        <mesh
          position={[0, CRANE.railY + 0.35, (CRANE.railZ[0] + CRANE.railZ[1]) / 2]}
          material={m.yellow}
          castShadow
        >
          <boxGeometry args={[0.55, 0.45, span + 0.6]} />
        </mesh>
        <mesh
          position={[0.29, CRANE.railY + 0.35, (CRANE.railZ[0] + CRANE.railZ[1]) / 2]}
          material={m.hazard}
        >
          <boxGeometry args={[0.02, 0.3, span + 0.6]} />
        </mesh>
        <group ref={trolley}>
          <mesh position={[0, CRANE.railY + 0.05, 0]} material={m.dark} castShadow>
            <boxGeometry args={[0.9, 0.4, 0.8]} />
          </mesh>
          <mesh ref={cable} material={m.cable}>
            <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
          </mesh>
          <group ref={hookBlock}>
            <mesh position={[0, 0.25, 0]} material={m.yellow} castShadow>
              <boxGeometry args={[0.38, 0.3, 0.38]} />
            </mesh>
            {[-0.16, 0.16].map((x) => (
              <mesh key={x} position={[x, 0.02, 0]} material={m.dark}>
                <boxGeometry args={[0.05, 0.22, 0.14]} />
              </mesh>
            ))}
            {holding && <AssemblyMesh a={holding} position={[0, -0.12, 0]} />}
          </group>
        </group>
      </group>
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} material={m.marker} visible={false}>
        <ringGeometry args={[0.38, 0.5, 32]} />
      </mesh>
    </group>
  );
}

/** Radiation portal monitor at the entrance: flashes and logs a reading as you walk through. */
function PortalMonitor() {
  const { x, z } = PROPS.portal;
  const lamp = useRef<THREE.MeshBasicMaterial>(null);
  const state = useRef({ inside: false, flash: 0 });
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9dee4', roughness: 0.5 }), []);
  useFrame((_, dt) => {
    const s = state.current;
    const inside = Math.abs(player.pos.x - x) < 0.5 && Math.abs(player.pos.z - z) < 2.1;
    if (inside && !s.inside) {
      s.flash = 1.2;
      pushToast({
        level: 'ok',
        text: 'Portal monitor · clean',
        detail: `Contamination below threshold · ${(0.01 + player.dose * 0.002).toFixed(3)} µSv/h`,
      });
    }
    s.inside = inside;
    s.flash = Math.max(0, s.flash - dt);
    lamp.current?.color.set(s.flash > 0 ? PALETTE.player : '#4a6a78').multiplyScalar(s.flash > 0 ? 2.5 : 1);
  });
  return (
    <group position={[x, 0, z]}>
      {[-2.3, 2.3].map((pz) => (
        <mesh key={pz} position={[0, 1.15, pz]} material={m} castShadow>
          <boxGeometry args={[0.45, 2.3, 0.35]} />
        </mesh>
      ))}
      <mesh position={[0, 2.4, 0]} material={m} castShadow>
        <boxGeometry args={[0.45, 0.3, 4.95]} />
      </mesh>
      <mesh position={[-0.24, 2.4, 0]}>
        <boxGeometry args={[0.02, 0.14, 3.6]} />
        <meshBasicMaterial ref={lamp} color="#4a6a78" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Large dry-storage casks along the front wall. */
function DryCask({ x, z }: { x: number; z: number }) {
  const m = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: '#aeb8c2', roughness: 0.35, metalness: 0.75 }),
      band: new THREE.MeshStandardMaterial({ color: PALETTE.hazard, roughness: 0.5 }),
    }),
    [],
  );
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.2, 0]} material={m.body} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.95, 2.4, 24]} />
      </mesh>
      {[0.5, 1.9].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={m.band}>
          <cylinderGeometry args={[0.97, 0.97, 0.12, 24]} />
        </mesh>
      ))}
    </group>
  );
}

/** Fuel Rod Storage: spent-fuel pool with an overhead crane, cask dock, terminals, workers and safety kit. */
export default function FuelStorageContents(_: RoomContentsProps) {
  const dockLine = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.hazard).multiplyScalar(1.2),
        toneMapped: false,
      }),
    [],
  );
  return (
    <group>
      <RackedAssemblies />
      <BridgeCrane />
      <StandingNpc
        x={WORKERS.standing.x}
        z={WORKERS.standing.z}
        yaw={WORKERS.standing.yaw}
        seed={5}
        outfit="worker"
        clipboard
      />
      <WalkingNpc path={WORKERS.patrol} seed={8} outfit="worker" />
      <AlarmBeacon x={-14} z={6} y={4.0} yaw={Math.PI / 2} />
      <AlarmBeacon x={-1.2} z={-11} y={4.0} />
      <SecurityCamera x={-13.6} z={9.5} y={6.0} yaw={Math.PI / 2} />
      <SecurityCamera x={12.8} z={-10.6} y={6.0} yaw={0} />

      {/* Everything static below is merged into a few draw calls. */}
      <Baked>
        <Pool />

        {/* Cask dock */}
        <group position={[POOL_DOCK.x, 0.012, POOL_DOCK.z]}>
          {[
            [0, -1.3, 1.8, 0.08],
            [0, 1.3, 1.8, 0.08],
            [-0.9, 0, 0.08, 2.6],
            [0.9, 0, 0.08, 2.6],
          ].map(([x, z, a, b], i) => (
            <mesh key={i} position={[x!, 0, z!]} rotation={[-Math.PI / 2, 0, 0]} material={dockLine}>
              <planeGeometry args={[a!, b!]} />
            </mesh>
          ))}
          <FloorText
            position={[1.3, 0.01, 0]}
            yaw={Math.PI / 2}
            fontSize={0.3}
            color="#f2b81f"
            fillOpacity={0.8}
          >
            {POOL_DOCK.label}
          </FloorText>
        </group>

        {/* Terminals and staff */}
        <Terminal
          x={PROPS.craneConsole.x}
          z={PROPS.craneConsole.z}
          yaw={Math.PI / 2}
          screen={PALETTE.amber}
        />
        <WorldText
          position={[PROPS.craneConsole.x, 2.15, PROPS.craneConsole.z]}
          rotation={[0, Math.PI / 4, 0]}
          fontSize={0.22}
          color="#f2b81f"
        >
          CRANE CONTROL
        </WorldText>
        <Terminal x={PROPS.inventoryDesk.x} z={PROPS.inventoryDesk.z} yaw={0} screen="#8dff6a" />
        <Terminal x={PROPS.inventoryDesk.x + 1.1} z={PROPS.inventoryDesk.z} yaw={0} screen={PALETTE.cyan} />
        <SeatedNpc
          x={WORKERS.seated.x}
          z={WORKERS.seated.z}
          yaw={WORKERS.seated.yaw}
          seed={3}
          outfit="worker"
        />

        {/* Safety, storage and services */}
        <EyewashStation x={PROPS.eyewash.x} z={PROPS.eyewash.z} yaw={0} />
        <Extinguisher x={PROPS.extinguisher.x} z={PROPS.extinguisher.z} yaw={Math.PI / 2} />
        <PortalMonitor />
        {PROPS.casks.map(([x, z]) => (
          <DryCask key={`${x},${z}`} x={x} z={z} />
        ))}
        <Pipe axis="z" from={-10.6} to={10.6} y={6.95} offset={-13.5} band={PALETTE.cyan} />
        <Pipe axis="x" from={-13.6} to={13.6} y={6.95} offset={-10.5} band={PALETTE.player} />
        <Pipe
          axis="x"
          from={-13.6}
          to={13.6}
          y={6.5}
          offset={-10.55}
          r={0.09}
          color="#b7bfc8"
          band={PALETTE.trim}
        />
      </Baked>

      {/* One warm light plus the pool light; decals fake the rest. */}
      <pointLight position={[3, 6, 3]} color="#ffd9b0" intensity={55} distance={26} decay={1.2} />
      <Baked>
        <GlowDecal x={6} z={4} radius={7} color={PALETTE.amber} intensity={0.26} />
        <GlowDecal x={-6} z={6} radius={6} color={PALETTE.amber} intensity={0.24} />
        <GlowDecal
          x={PROPS.inventoryDesk.x}
          z={PROPS.inventoryDesk.z + 1}
          radius={2.4}
          color="#8dff6a"
          intensity={0.2}
        />
      </Baked>
    </group>
  );
}
