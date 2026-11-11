import { useMemo } from 'react';
import * as THREE from 'three';
import { Baked } from '../../scene/Baked';
import { std } from '../../scene/materials';
import { SeatedNpc } from '../../scene/Npc';
import { FloorText, GlowDecal } from '../../scene/parts';
import {
  AlarmBeacon,
  Extinguisher,
  FirstAid,
  Pipe,
  SecurityCamera,
  Terminal,
  VendingMachine,
  WallClock,
  WaterCooler,
} from '../../scene/props';
import { hazardTexture } from '../../scene/textures';
import { PALETTE } from '../../styles/palette';
import type { RoomContentsProps } from '../../world/types';
import { ConsoleRings, CoreStack, FrontBanks, Galleries, RailRing } from './Hall';
import { CORE_BAY, HALL, INNER_R, OUTER_R, PROPS, RAIL_R, workstations } from './index';
import { HoloCore, OperatorStation } from './OperatorStation';
import { ReactorCore } from './ReactorCore';
import { RefuelMachine } from './RefuelMachine';
import { WallDisplay, drawCellMap, drawRods, makeOutputDrawer } from './WallDisplay';

function Plant({ x, z }: { x: number; z: number }) {
  const m = {
    pot: std({ color: '#e9edf1', roughness: 0.6 }),
    leaf: std({ color: '#4caf50', roughness: 0.8, flatShading: true }),
  };
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.35, 0]} material={m.pot} castShadow>
        <cylinderGeometry args={[0.32, 0.26, 0.7, 12]} />
      </mesh>
      {[
        [0, 1.0, 0, 0.38],
        [0.12, 1.45, 0.05, 0.3],
        [-0.1, 1.3, -0.08, 0.28],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px!, py!, pz!]} material={m.leaf} castShadow>
          <icosahedronGeometry args={[r!, 0]} />
        </mesh>
      ))}
    </group>
  );
}

function RadiationSign({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f2b81f';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#111';
    g.translate(128, 120);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 80, ((k * 120 - 30) * Math.PI) / 180, ((k * 120 + 30) * Math.PI) / 180);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#f2b81f';
    g.beginPath();
    g.arc(0, 0, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(0, 0, 14, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[1.6, 1.6]} />
      <meshStandardMaterial map={tex} roughness={0.6} />
    </mesh>
  );
}

/** Wall alarm panel: a grey cabinet with a row of status lamps. */
function AlarmPanel({ x, z }: { x: number; z: number }) {
  const m = useMemo(
    () => ({
      box: new THREE.MeshStandardMaterial({ color: '#cfd5dc', roughness: 0.5 }),
      lamp: [PALETTE.player, PALETTE.amber, '#ff4d4d', PALETTE.cyan].map(
        (c) =>
          new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.8), toneMapped: false }),
      ),
    }),
    [],
  );
  return (
    <group position={[x, 1.6, z]}>
      <mesh position={[0, 0, 0.12]} material={m.box} castShadow>
        <boxGeometry args={[1.2, 0.9, 0.24]} />
      </mesh>
      {m.lamp.map((mat, i) => (
        <mesh key={i} position={[-0.39 + i * 0.26, 0.18, 0.25]} material={mat}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 12]} />
        </mesh>
      ))}
      <mesh position={[0, -0.18, 0.25]}>
        <boxGeometry args={[0.5, 0.18, 0.03]} />
        <meshStandardMaterial color="#d7261e" />
      </mesh>
    </group>
  );
}

/** Painted docking bay for the transfer cart. */
function CartBay() {
  const hatch = useMemo(() => {
    const t = hazardTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(3, 0.4);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, transparent: true, opacity: 0.85 });
  }, []);
  const line = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.hazard).multiplyScalar(1.2),
        toneMapped: false,
      }),
    [],
  );
  const w = 1.8;
  const d = 2.6;
  return (
    <group position={[CORE_BAY.x, 0.012, CORE_BAY.z]}>
      {[
        [0, -d / 2, w, 0.08],
        [0, d / 2, w, 0.08],
        [-w / 2, 0, 0.08, d],
        [w / 2, 0, 0.08, d],
      ].map(([x, z, a, b], i) => (
        <mesh key={i} position={[x!, 0, z!]} rotation={[-Math.PI / 2, 0, 0]} material={line}>
          <planeGeometry args={[a!, b!]} />
        </mesh>
      ))}
      <mesh position={[0, 0, -d / 2 - 0.3]} rotation={[-Math.PI / 2, 0, 0]} material={hatch}>
        <planeGeometry args={[w, 0.45]} />
      </mesh>
      <FloorText
        position={[w / 2 + 0.45, 0.01, 0]}
        yaw={Math.PI / 2}
        fontSize={0.3}
        color="#f2b81f"
        fillOpacity={0.8}
      >
        {CORE_BAY.label}
      </FloorText>
      <GlowDecal x={0} z={0} radius={1.8} color={PALETTE.hazard} intensity={0.18} />
    </group>
  );
}

/**
 * Unit 1 core hall: the core tank and refuelling machine under the drive stack,
 * console rings with crew, the Reactor Operator Station and its holo core,
 * tiered galleries, wall screens, safety kit and lighting.
 */
export default function ControlRoomContents(_: RoomContentsProps) {
  const outputDrawer = useMemo(() => makeOutputDrawer(), []);
  const W = HALL - 0.3; // wall face
  return (
    <group>
      <ReactorCore />
      <RefuelMachine />
      <CoreStack />
      <ConsoleRings />
      <RailRing />
      <Galleries />
      <FrontBanks />
      <OperatorStation />
      <HoloCore />
      {workstations
        .filter((w) => w.staff)
        .map((w, i) => (
          <SeatedNpc key={w.id} x={w.position.x} z={w.position.z} yaw={w.facing} seed={i + 1} />
        ))}

      {/* Everything static in here is merged into a few draw calls. */}
      <Baked>
        <CartBay />
        <Terminal x={PROPS.pedestal.x} z={PROPS.pedestal.z} yaw={Math.PI / 4} screen={PALETTE.amber} />

        {/* Big screens on the back walls, under the first gallery */}
        <WallDisplay
          width={12}
          height={4.6}
          draw={drawCellMap}
          position={[-W, 4.0, 13]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <WallDisplay
          width={11}
          height={4.6}
          draw={drawRods}
          position={[-W, 4.0, -15]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <WallDisplay
          width={12}
          height={4.6}
          draw={outputDrawer}
          position={[14, 4.0, -W]}
          rotation={[0, 0, 0]}
        />
        <RadiationSign position={[-27, 4.6, -HALL + 0.24]} rotation={[0, 0, 0]} />

        {/* Safety and amenities */}
        <AlarmPanel x={PROPS.alarmPanel.x} z={PROPS.alarmPanel.z} />
        <VendingMachine {...PROPS.vending} />
        <WaterCooler {...PROPS.cooler} />
        {PROPS.extinguishers.map((e, i) => (
          <Extinguisher key={i} {...e} />
        ))}
        <FirstAid x={PROPS.firstAid.x} z={PROPS.firstAid.z} />

        {/* Service pipes along the back walls, just under the first gallery */}
        <Pipe axis="z" from={-HALL + 0.4} to={HALL - 0.4} y={6.9} offset={-HALL + 0.5} band={PALETTE.cyan} />
        <Pipe
          axis="z"
          from={-HALL + 0.4}
          to={HALL - 0.4}
          y={7.3}
          offset={-HALL + 0.45}
          r={0.1}
          color="#b7bfc8"
          band={PALETTE.trim}
        />
        <Pipe axis="x" from={-HALL + 0.4} to={HALL - 0.4} y={6.9} offset={-HALL + 0.5} band={PALETTE.cyan} />
        <Pipe
          axis="x"
          from={-HALL + 0.4}
          to={HALL - 0.4}
          y={7.3}
          offset={-HALL + 0.45}
          r={0.1}
          color="#b7bfc8"
          band={PALETTE.player}
        />

        {PROPS.plants.map(([x, z]) => (
          <Plant key={`${x},${z}`} x={x} z={z} />
        ))}
        <FloorText
          position={[RAIL_R + 1.2, 0.02, -3.4]}
          yaw={Math.PI / 2}
          fontSize={0.42}
          color="#f2b81f"
          fillOpacity={0.6}
        >
          REACTOR · RESTRICTED · DOSE CONTROLLED
        </FloorText>
      </Baked>

      {/* Animated props stay out of the bake. */}
      <AlarmBeacon x={PROPS.alarmPanel.x + 1.15} z={-HALL} y={2.35} />
      <AlarmBeacon x={-HALL} z={-6} y={4.6} yaw={Math.PI / 2} />
      <WallClock x={PROPS.clock.x} z={PROPS.clock.z + 0.02} y={5.7} />
      <SecurityCamera x={-HALL + 0.4} z={27} y={6.6} yaw={Math.PI / 2} />
      <SecurityCamera x={27} z={-HALL + 0.4} y={6.6} yaw={0} />

      {/* Warm light from the stack's bands onto the floor and galleries; decals do the rest. */}
      <pointLight position={[0, 15, 0]} color="#ffb070" intensity={150} distance={48} decay={1.15} />
      <Baked>
        {[45, 135, 225, 315].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const r = (INNER_R + OUTER_R) / 2;
          return (
            <GlowDecal
              key={deg}
              x={Math.cos(a) * r}
              z={Math.sin(a) * r}
              radius={9}
              color={PALETTE.amber}
              intensity={0.2}
            />
          );
        })}
        <GlowDecal x={0} z={0} radius={13} color="#ff9a4a" intensity={0.14} />
        <GlowDecal x={-24} z={-24} radius={10} color="#cfe6ff" intensity={0.12} />
      </Baked>
      {/* Lane lines from each door in to the railing */}
      {[
        [-(HALL + RAIL_R) / 2, 0, HALL - RAIL_R, 0.12],
        [0, -(HALL + RAIL_R) / 2, 0.12, HALL - RAIL_R],
        [(HALL + RAIL_R) / 2, 0, HALL - RAIL_R, 0.12],
        [0, (HALL + RAIL_R) / 2, 0.12, HALL - RAIL_R],
      ].map(([x, z, w, d]) => (
        <mesh key={`${x},${z}`} position={[x!, 0.015, z!]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w!, d!]} />
          <meshBasicMaterial
            color={new THREE.Color(PALETTE.cyan).multiplyScalar(0.9)}
            toneMapped={false}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
    </group>
  );
}
