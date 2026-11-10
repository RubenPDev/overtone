import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { simHost } from '../../game/runtime';
import { weld } from '../../game/tanks';
import { Baked } from '../../scene/Baked';
import { glow, std } from '../../scene/materials';
import { StandingNpc, WalkingNpc } from '../../scene/Npc';
import { FloorText, GlowDecal, WorldText } from '../../scene/parts';
import { AlarmBeacon, EyewashStation, Extinguisher, Pipe, SecurityCamera, Terminal } from '../../scene/props';
import { TANK_CAPACITY, VALVE_CLOSED } from '../../sim';
import { useHud } from '../../state/hud';
import { useMode } from '../../state/mode';
import { PALETTE } from '../../styles/palette';
import type { RoomContentsProps } from '../../world/types';
import { PROPS, TANK_H, TANK_R, TANKS, WORKERS, type TankSpot } from './index';

const HEADER_Y = 6.4;
const G = 9.8;

const M = {
  shell: () => std({ color: '#c9d1d9', roughness: 0.32, metalness: 0.65 }),
  band: () => std({ color: '#a9b3bd', roughness: 0.4, metalness: 0.7 }),
  dome: () => std({ color: '#d5dce3', roughness: 0.3, metalness: 0.6 }),
  plinth: () => std({ color: '#7d8895', roughness: 0.9 }),
  rail: () => std({ color: PALETTE.gantry, roughness: 0.5, metalness: 0.3 }),
  dark: () => std({ color: '#262d36', roughness: 0.5, metalness: 0.4 }),
  pipe: () => std({ color: '#5e8fc4', roughness: 0.35, metalness: 0.5 }),
  white: () => std({ color: '#e9eef2', roughness: 0.45 }),
  orange: () => std({ color: PALETTE.trim, roughness: 0.5 }),
  motor: () => std({ color: '#3d5a7a', roughness: 0.45, metalness: 0.5 }),
};

/** World position of a point on a tank's shell, `a` radians round from its service side. */
function shellPoint(t: TankSpot, a: number, y: number, r = TANK_R) {
  const phi = t.face + a;
  return new THREE.Vector3(t.x + Math.sin(phi) * r, y, t.z + Math.cos(phi) * r);
}

// --- Static tank structure (baked) --------------------------------------------------------------

function TankStructure({ spot, index }: { spot: TankSpot; index: number }) {
  const hazard = glow(PALETTE.hazard, 1.0);
  const name = `T-${index + 1}`;
  return (
    <group>
      <group position={[spot.x, 0, spot.z]} rotation={[0, spot.face, 0]}>
        {/* Plinth with a hazard ring */}
        <mesh position={[0, 0.15, 0]} material={M.plinth()} receiveShadow>
          <cylinderGeometry args={[TANK_R + 0.35, TANK_R + 0.45, 0.3, 40]} />
        </mesh>
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={hazard}>
          <ringGeometry args={[TANK_R + 0.55, TANK_R + 0.7, 48]} />
        </mesh>
        {/* Shell, weld bands, dome */}
        <mesh position={[0, 0.3 + TANK_H / 2, 0]} material={M.shell()} castShadow receiveShadow>
          <cylinderGeometry args={[TANK_R, TANK_R, TANK_H, 40]} />
        </mesh>
        {[1.6, 3.4, 5.2, TANK_H - 0.05].map((y) => (
          <mesh key={y} position={[0, 0.3 + y, 0]} material={M.band()}>
            <cylinderGeometry args={[TANK_R + 0.03, TANK_R + 0.03, 0.08, 40]} />
          </mesh>
        ))}
        <mesh position={[0, 0.3 + TANK_H, 0]} scale={[1, 0.22, 1]} material={M.dome()} castShadow>
          <sphereGeometry args={[TANK_R, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {/* Roof handrail */}
        {Array.from({ length: 10 }, (_, k) => {
          const a = (k / 10) * Math.PI * 2;
          return (
            <mesh
              key={k}
              position={[Math.sin(a) * (TANK_R - 0.15), 0.3 + TANK_H + 0.5, Math.cos(a) * (TANK_R - 0.15)]}
              material={M.rail()}
            >
              <boxGeometry args={[0.05, 1.0, 0.05]} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.3 + TANK_H + 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.rail()}>
          <torusGeometry args={[TANK_R - 0.15, 0.03, 6, 40]} />
        </mesh>
        {/* Caged ladder on the right of the service side */}
        <group
          position={[Math.sin(0.75) * (TANK_R + 0.25), 0, Math.cos(0.75) * (TANK_R + 0.25)]}
          rotation={[0, 0.75, 0]}
        >
          {[-0.22, 0.22].map((x) => (
            <mesh key={x} position={[x, 0.3 + (TANK_H + 1) / 2, 0]} material={M.rail()}>
              <boxGeometry args={[0.05, TANK_H + 1, 0.05]} />
            </mesh>
          ))}
          {Array.from({ length: 13 }, (_, k) => (
            <mesh key={k} position={[0, 0.7 + k * 0.55, 0]} material={M.rail()}>
              <boxGeometry args={[0.44, 0.035, 0.035]} />
            </mesh>
          ))}
          {Array.from({ length: 6 }, (_, k) => (
            <mesh
              key={`c${k}`}
              position={[0, 2.8 + k * 0.95, 0.22]}
              rotation={[Math.PI / 2, 0, 0]}
              material={M.rail()}
            >
              <torusGeometry args={[0.3, 0.02, 4, 12, Math.PI]} />
            </mesh>
          ))}
        </group>
        {/* Sight-glass frame (the live fill is drawn separately) */}
        <group
          position={[Math.sin(-0.45) * (TANK_R + 0.12), 0, Math.cos(-0.45) * (TANK_R + 0.12)]}
          rotation={[0, -0.45, 0]}
        >
          <mesh position={[0, 0.3 + TANK_H / 2, -0.02]} material={M.dark()}>
            <boxGeometry args={[0.3, TANK_H - 0.6, 0.06]} />
          </mesh>
          {[0.75, TANK_H - 0.15].map((y) => (
            <mesh key={y} position={[0, y, 0.02]} material={M.band()}>
              <boxGeometry args={[0.34, 0.12, 0.12]} />
            </mesh>
          ))}
        </group>
        {/* Outlet nozzle toward the service station */}
        <mesh position={[0.9, 0.75, TANK_R + 0.35]} rotation={[Math.PI / 2, 0, 0]} material={M.pipe()}>
          <cylinderGeometry args={[0.16, 0.16, 0.8, 12]} />
        </mesh>
        <mesh position={[0.9, 0.75, TANK_R + 0.05]} rotation={[Math.PI / 2, 0, 0]} material={M.band()}>
          <cylinderGeometry args={[0.28, 0.28, 0.08, 16]} />
        </mesh>
        {/* Name and contents stencil */}
        <WorldText position={[0.35, 4.9, TANK_R + 0.14]} fontSize={1.15} color="#25313d" anchorX="center">
          {name}
        </WorldText>
        <WorldText position={[0.35, 4.05, TANK_R + 0.08]} fontSize={0.24} color="#25313d" anchorX="center">
          DEMINERALISED WATER · 2000 m³
        </WorldText>
      </group>
      {/* Pipe from the nozzle to the station, riser to the overhead header */}
      <ServicePipes spot={spot} />
    </group>
  );
}

function ServicePipes({ spot }: { spot: TankSpot }) {
  const st = spot.station;
  const along = spot.face === 0 ? 'z' : 'x';
  const nozzle = shellPoint(spot, 0, 0, TANK_R + 0.75);
  // Nozzle sits 0.9 m to the side (local +x) of the service side.
  const side = spot.face === 0 ? { x: 0.9, z: 0 } : { x: 0, z: -0.9 };
  const nx = nozzle.x + side.x;
  const nz = nozzle.z + side.z;
  const riser = { x: st.x + (spot.face === 0 ? 0.75 : 0), z: st.z + (spot.face === 0 ? 0 : -0.75) };
  return (
    <group>
      {along === 'z' ? (
        <>
          <Pipe
            axis="z"
            from={nz}
            to={st.z}
            y={0.75}
            offset={nx}
            r={0.14}
            color="#5e8fc4"
            band={PALETTE.cyan}
          />
          <Pipe
            axis="x"
            from={nx}
            to={riser.x}
            y={0.75}
            offset={st.z}
            r={0.14}
            color="#5e8fc4"
            band={PALETTE.cyan}
          />
        </>
      ) : (
        <>
          <Pipe
            axis="x"
            from={nx}
            to={st.x}
            y={0.75}
            offset={nz}
            r={0.14}
            color="#5e8fc4"
            band={PALETTE.cyan}
          />
          <Pipe
            axis="z"
            from={nz}
            to={riser.z}
            y={0.75}
            offset={st.x}
            r={0.14}
            color="#5e8fc4"
            band={PALETTE.cyan}
          />
        </>
      )}
      <mesh position={[riser.x, (0.75 + HEADER_Y) / 2, riser.z]} material={M.pipe()} castShadow>
        <cylinderGeometry args={[0.14, 0.14, HEADER_Y - 0.75, 12]} />
      </mesh>
      {/* Station pedestal and local panel */}
      <group position={[st.x, 0, st.z]} rotation={[0, spot.face, 0]}>
        <mesh position={[0, 0.55, 0]} material={M.dark()} castShadow>
          <boxGeometry args={[0.5, 1.1, 0.5]} />
        </mesh>
        <mesh position={[-0.75, 0.75, 0]} material={M.white()} castShadow>
          <boxGeometry args={[0.55, 1.5, 0.3]} />
        </mesh>
        <mesh position={[-0.75, 1.15, 0.16]} material={glow('#0d2a36', 1)}>
          <planeGeometry args={[0.42, 0.34]} />
        </mesh>
      </group>
    </group>
  );
}

/** Reserved pad for an upgrade tank: low plinth, hazard ring, bollards. */
function TankPad({ spot, index }: { spot: TankSpot; index: number }) {
  const hazard = glow(PALETTE.hazard, 1.0);
  return (
    <group position={[spot.x, 0, spot.z]}>
      <mesh position={[0, 0.1, 0]} material={M.plinth()} receiveShadow>
        <cylinderGeometry args={[TANK_R + 0.35, TANK_R + 0.45, 0.2, 40]} />
      </mesh>
      <mesh position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]} material={hazard}>
        <ringGeometry args={[TANK_R - 0.1, TANK_R + 0.1, 48]} />
      </mesh>
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2;
        return (
          <mesh
            key={k}
            position={[Math.sin(a) * (TANK_R + 0.25), 0.6, Math.cos(a) * (TANK_R + 0.25)]}
            material={M.rail()}
          >
            <cylinderGeometry args={[0.08, 0.08, 0.8, 8]} />
          </mesh>
        );
      })}
      <FloorText position={[0, 0.22, 0]} yaw={spot.face} fontSize={0.42} color="#f2b81f" fillOpacity={0.85}>
        {`T-${index + 1} · RESERVED`}
      </FloorText>
      <FloorText position={[0, 0.22, 0.7]} yaw={spot.face} fontSize={0.22} color="#c9d3dd" fillOpacity={0.7}>
        OPS TABLET · UPGRADES · WATER
      </FloorText>
    </group>
  );
}

// --- Live tank parts --------------------------------------------------------------------------

const DROPS = 56;
const SPARKS = 22;

/** Sight-glass fill, valve wheel, status lamp, leak spray, puddle and weld sparks for one tank. */
function TankLive({ spot, index }: { spot: TankSpot; index: number }) {
  const fill = useRef<THREE.Mesh>(null);
  const mark = useRef<THREE.Mesh>(null);
  const wheel = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.Mesh>(null);
  const flag = useRef<THREE.Mesh>(null);
  const drops = useRef<THREE.InstancedMesh>(null);
  const puddle = useRef<THREE.Mesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const st = useMemo(
    () => ({
      puddle: 0,
      spark: Array.from({ length: SPARKS }, () => ({ t: 1, v: new THREE.Vector3(), p: new THREE.Vector3() })),
    }),
    [],
  );
  const mats = useMemo(
    () => ({
      ok: glow('#6dffb6', 2.2),
      amber: glow(PALETTE.amber, 2.4),
      red: glow('#ff3b30', 2.8),
      off: glow('#3a1a18', 1),
      water: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#4fb6ff').multiplyScalar(1.3),
        toneMapped: false,
      }),
      drop: new THREE.MeshBasicMaterial({ color: '#cfeeff', transparent: true, opacity: 0.85 }),
      puddle: new THREE.MeshStandardMaterial({
        color: '#3d7fae',
        roughness: 0.05,
        metalness: 0.2,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
      spark: glow('#ffc070', 4),
    }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const glassH = TANK_H - 0.9;
  const glassBase = 0.75;

  useFrame((s, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = simHost.state.water.tanks[index];
    if (!t) return;
    const frac = t.level / TANK_CAPACITY;
    if (fill.current) {
      fill.current.scale.y = Math.max(0.001, frac);
      fill.current.position.y = glassBase + (glassH * frac) / 2;
    }
    if (mark.current) {
      mark.current.visible = t.leak > 0;
      mark.current.position.y = glassBase + glassH * t.leakHeight;
    }
    if (wheel.current) wheel.current.rotation.z = t.valve * Math.PI * 6;
    if (flag.current) flag.current.rotation.z = (1 - t.valve) * (Math.PI / 2);
    const time = s.clock.elapsedTime;
    if (lamp.current)
      lamp.current.material =
        t.leak > 0
          ? Math.sin(time * 6) > 0
            ? mats.red
            : mats.off
          : t.valve <= VALVE_CLOSED
            ? mats.amber
            : mats.ok;

    // Leak spray: droplets on ballistic arcs out of the hole while the water is above it.
    const head = frac - t.leakHeight;
    const spraying = t.leak > 0 && head > 0;
    const y0 = 0.3 + TANK_H * t.leakHeight;
    const hole = shellPoint(spot, t.leakAngle, y0, TANK_R + 0.02);
    const phi = spot.face + t.leakAngle;
    const out = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
    const v = 1.2 + 4.5 * Math.sqrt(Math.max(0, head));
    const fall = Math.sqrt((2 * y0) / G);
    if (drops.current) {
      drops.current.count = spraying ? DROPS : 0;
      if (spraying) {
        for (let k = 0; k < DROPS; k++) {
          const p = (time * 1.6 + k / DROPS) % 1;
          const tt = p * fall;
          const spread = ((k * 7) % 5) / 5 - 0.4;
          dummy.position.set(
            hole.x + out.x * v * tt + out.z * spread * tt * 0.6,
            y0 - 0.5 * G * tt * tt,
            hole.z + out.z * v * tt - out.x * spread * tt * 0.6,
          );
          // Stretch each drop along its velocity so the jet reads as a stream.
          const vy = -G * tt;
          const sc = 0.055 + 0.025 * Math.sin(k * 1.7);
          dummy.lookAt(
            dummy.position.x + out.x * v + out.z * spread * 0.6,
            dummy.position.y + vy,
            dummy.position.z + out.z * v - out.x * spread * 0.6,
          );
          dummy.scale.set(sc, sc, sc * (2.5 + 0.35 * Math.hypot(v, vy)));
          dummy.updateMatrix();
          drops.current.setMatrixAt(k, dummy.matrix);
        }
        drops.current.instanceMatrix.needsUpdate = true;
      }
    }
    // Puddle grows while it leaks, dries slowly after a repair.
    const target = t.leak > 0 ? Math.min(3.4, 1.0 + t.leak / 22) : 0;
    st.puddle += (target - st.puddle) * (1 - Math.exp(-dt * (target > st.puddle ? 0.25 : 0.03)));
    if (puddle.current) {
      puddle.current.visible = st.puddle > 0.05;
      const reach = Math.min(v * fall, 3.5) * 0.7 + 0.4;
      puddle.current.position.set(hole.x + out.x * reach, 0.016, hole.z + out.z * reach);
      puddle.current.scale.set(st.puddle, st.puddle * 0.8, 1);
    }

    // Weld sparks and arc flash at the hole while the player welds this tank.
    const welding = weld.active && weld.tank === index;
    if (sparks.current) {
      let alive = 0;
      for (const sp of st.spark) {
        if (sp.t >= 1 && welding && Math.random() < 0.5) {
          sp.t = 0;
          sp.p.copy(hole);
          sp.v.set(
            out.x * 1.5 + (Math.random() - 0.5) * 3,
            Math.random() * 2.5,
            out.z * 1.5 + (Math.random() - 0.5) * 3,
          );
        }
        if (sp.t < 1) {
          sp.t += dt * 2.2;
          sp.v.y -= G * dt;
          sp.p.addScaledVector(sp.v, dt);
          dummy.position.copy(sp.p);
          dummy.scale.setScalar(0.035 * (1 - sp.t));
          dummy.updateMatrix();
          sparks.current.setMatrixAt(alive++, dummy.matrix);
        }
      }
      sparks.current.count = alive;
      sparks.current.instanceMatrix.needsUpdate = true;
    }
    if (flash.current) {
      flash.current.visible = welding;
      if (welding) {
        flash.current.position.copy(hole).addScaledVector(out, 0.08);
        flash.current.scale.setScalar(0.18 + Math.random() * 0.22);
      }
    }
  });

  const glassA = -0.45;
  const station = spot.station;
  return (
    <group>
      {/* Sight glass fill and leak-height mark */}
      <group
        position={[
          shellPoint(spot, glassA, 0, TANK_R + 0.16).x,
          0,
          shellPoint(spot, glassA, 0, TANK_R + 0.16).z,
        ]}
        rotation={[0, spot.face + glassA, 0]}
      >
        <mesh ref={fill} position={[0, glassBase, 0.03]} material={mats.water}>
          <boxGeometry args={[0.14, glassH, 0.04]} />
        </mesh>
        <mesh ref={mark} position={[0, glassBase, 0.06]} material={mats.red}>
          <boxGeometry args={[0.32, 0.05, 0.02]} />
        </mesh>
      </group>
      {/* Status lamp on the roof */}
      <mesh ref={lamp} position={[spot.x, 0.3 + TANK_H + TANK_R * 0.22 + 0.15, spot.z]} material={mats.ok}>
        <sphereGeometry args={[0.18, 12, 8]} />
      </mesh>
      {/* Valve wheel on the station pedestal */}
      <group position={[station.x, 1.25, station.z]} rotation={[0, spot.face, 0]}>
        <group ref={wheel} position={[0, 0, 0.32]}>
          <mesh material={M.orange()}>
            <torusGeometry args={[0.36, 0.045, 8, 24]} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} rotation={[0, 0, (k * Math.PI) / 3]} material={M.orange()}>
              <boxGeometry args={[0.7, 0.05, 0.04]} />
            </mesh>
          ))}
          <mesh rotation={[Math.PI / 2, 0, 0]} material={M.dark()}>
            <cylinderGeometry args={[0.07, 0.07, 0.12, 10]} />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]} material={M.dark()}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
        </mesh>
        {/* Position flag: horizontal = open, vertical = closed */}
        <mesh ref={flag} position={[0, 0.32, 0.27]} material={M.rail()}>
          <boxGeometry args={[0.36, 0.06, 0.03]} />
        </mesh>
      </group>
      <instancedMesh
        ref={drops}
        args={[undefined, undefined, DROPS]}
        material={mats.drop}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 6, 4]} />
      </instancedMesh>
      <mesh
        ref={puddle}
        rotation={[-Math.PI / 2, 0, 0]}
        material={mats.puddle}
        visible={false}
        renderOrder={2}
      >
        <circleGeometry args={[1, 28]} />
      </mesh>
      <instancedMesh
        ref={sparks}
        args={[undefined, undefined, SPARKS]}
        material={mats.spark}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <mesh ref={flash} material={glow('#e8f4ff', 6)} visible={false}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
    </group>
  );
}

// --- Plant equipment ----------------------------------------------------------------------------

function TreatmentSkid() {
  const s = PROPS.skid;
  const len = s.maxZ - s.minZ - 1.4;
  const cz = (s.minZ + s.maxZ) / 2;
  return (
    <group>
      <mesh position={[(s.minX + s.maxX) / 2, 0.08, cz]} material={M.dark()} receiveShadow>
        <boxGeometry args={[s.maxX - s.minX, 0.16, s.maxZ - s.minZ]} />
      </mesh>
      {/* Frame posts */}
      {[s.minX + 0.4, s.minX + 2.9].flatMap((x) =>
        [s.minZ + 0.4, cz, s.maxZ - 0.4].map((z) => (
          <mesh key={`${x},${z}`} position={[x, 1.35, z]} material={M.rail()}>
            <boxGeometry args={[0.1, 2.5, 0.1]} />
          </mesh>
        )),
      )}
      {/* Reverse-osmosis pressure vessels, two stacks of three */}
      {[s.minX + 1.0, s.minX + 2.3].flatMap((x) =>
        [0.7, 1.35, 2.0].map((y) => (
          <group key={`${x},${y}`}>
            <mesh position={[x, y, cz]} rotation={[Math.PI / 2, 0, 0]} material={M.white()} castShadow>
              <cylinderGeometry args={[0.26, 0.26, len, 16]} />
            </mesh>
            {[cz - len / 2, cz + len / 2].map((z) => (
              <mesh key={z} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]} material={M.pipe()}>
                <cylinderGeometry args={[0.29, 0.29, 0.12, 16]} />
              </mesh>
            ))}
          </group>
        )),
      )}
      {/* Cartridge filters */}
      {[s.minZ + 1.2, s.minZ + 2.3].map((z) => (
        <group key={z} position={[s.maxX - 1.2, 0, z]}>
          <mesh position={[0, 1.0, 0]} material={M.shell()} castShadow>
            <cylinderGeometry args={[0.32, 0.32, 1.7, 16]} />
          </mesh>
          <mesh position={[0, 1.9, 0]} scale={[1, 0.4, 1]} material={M.shell()}>
            <sphereGeometry args={[0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
      {/* Chemical dosing tanks */}
      {[
        [s.maxZ - 1.0, '#2f7fd8'],
        [s.maxZ - 2.3, '#e9eef2'],
      ].map(([z, c]) => (
        <group key={String(z)} position={[s.maxX - 1.1, 0, z as number]}>
          <mesh position={[0, 0.75, 0]} material={std({ color: c as string, roughness: 0.55 })} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 1.3, 18]} />
          </mesh>
          <mesh position={[0, 1.5, 0]} material={M.dark()}>
            <cylinderGeometry args={[0.18, 0.18, 0.2, 10]} />
          </mesh>
        </group>
      ))}
      {/* Control cabinet with a lit screen, facing the hall */}
      <group position={[s.maxX - 1.0, 0, cz + 0.2]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 1.0, 0]} material={M.white()} castShadow>
          <boxGeometry args={[1.2, 2.0, 0.5]} />
        </mesh>
        <mesh position={[0, 1.35, 0.26]} material={glow('#5fe3ff', 1.0)}>
          <planeGeometry args={[0.8, 0.5]} />
        </mesh>
      </group>
      <Pipe
        axis="z"
        from={s.minZ + 0.3}
        to={s.maxZ - 0.3}
        y={2.65}
        offset={s.minX + 1.65}
        r={0.12}
        color="#5e8fc4"
        band={PALETTE.cyan}
      />
      <WorldText
        position={[s.minX - 0.02, 2.9, cz]}
        rotation={[0, -Math.PI / 2, 0]}
        fontSize={0.34}
        color="#f2b81f"
      >
        RO TREATMENT TRAIN
      </WorldText>
    </group>
  );
}

function MakeupPump({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.12, 0]} material={M.dark()} receiveShadow>
        <boxGeometry args={[2.2, 0.24, 1.2]} />
      </mesh>
      {/* Motor with cooling fins */}
      <mesh position={[-0.45, 0.72, 0]} rotation={[0, 0, Math.PI / 2]} material={M.motor()} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 1.0, 20]} />
      </mesh>
      {Array.from({ length: 7 }, (_, k) => (
        <mesh
          key={k}
          position={[-0.85 + k * 0.13, 0.72, 0]}
          rotation={[0, 0, Math.PI / 2]}
          material={M.motor()}
        >
          <cylinderGeometry args={[0.47, 0.47, 0.04, 20]} />
        </mesh>
      ))}
      {/* Coupling guard */}
      <mesh position={[0.25, 0.65, 0]} material={M.orange()}>
        <boxGeometry args={[0.4, 0.45, 0.5]} />
      </mesh>
      {/* Volute and pipes */}
      <mesh position={[0.75, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} material={M.pipe()} castShadow>
        <cylinderGeometry args={[0.48, 0.48, 0.42, 20]} />
      </mesh>
      <mesh position={[0.75, (1.1 + HEADER_Y) / 2, 0]} material={M.pipe()} castShadow>
        <cylinderGeometry args={[0.13, 0.13, HEADER_Y - 1.1, 12]} />
      </mesh>
      <mesh position={[0.75, 0.65, 1.2]} rotation={[Math.PI / 2, 0, 0]} material={M.pipe()}>
        <cylinderGeometry args={[0.16, 0.16, 1.9, 12]} />
      </mesh>
    </group>
  );
}

/** Mimic board above the ops panel: one level bar per tank, live. */
function ReserveBoard() {
  const count = useHud((s) => s.sim?.water.tanks.length ?? 4);
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useMemo(
    () => ({
      ok: glow('#4fb6ff', 1.6),
      low: glow(PALETTE.amber, 1.8),
      leak: glow('#ff3b30', 2.2),
      off: glow('#556270', 0.8),
    }),
    [],
  );
  useFrame(() => {
    const tanks = simHost.state.water.tanks;
    bars.current.forEach((b, i) => {
      const t = tanks[i];
      if (!b || !t) return;
      const f = t.level / TANK_CAPACITY;
      b.scale.y = Math.max(0.01, f);
      b.position.y = 2.15 + (1.3 * f) / 2;
      b.material =
        t.leak > 0 ? mats.leak : t.valve <= VALVE_CLOSED ? mats.off : f < 0.35 ? mats.low : mats.ok;
    });
  });
  const { x, z } = PROPS.panel;
  return (
    <group position={[x, 0, z - 0.45]}>
      <mesh position={[0, 2.85, -0.05]} material={M.dark()}>
        <boxGeometry args={[2.2, 1.7, 0.08]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i}>
          <mesh position={[-0.8 + i * 0.32, 2.8, 0]} material={glow('#122029', 1)}>
            <planeGeometry args={[0.2, 1.3]} />
          </mesh>
          {i < count && (
            <mesh
              ref={(m) => {
                bars.current[i] = m;
              }}
              position={[-0.8 + i * 0.32, 2.8, 0.01]}
              material={mats.ok}
            >
              <planeGeometry args={[0.16, 1.3]} />
            </mesh>
          )}
        </group>
      ))}
      <WorldText position={[0, 3.55, 0.01]} fontSize={0.16} color="#9fb0c2">
        RESERVE · T-1 … T-6
      </WorldText>
    </group>
  );
}

/** Spark-light flicker on the floor while welding (a decal, not a real light). */
function WeldGlow() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const m = useMode.getState().mode;
    const on = weld.active && m.kind === 'tanks';
    ref.current.visible = on;
    if (on) {
      const t = TANKS[weld.tank]!;
      const tank = simHost.state.water.tanks[weld.tank];
      const p = shellPoint(t, tank?.leakAngle ?? 0, 0, TANK_R + 1);
      ref.current.position.set(p.x, 0.03, p.z);
      ref.current.scale.setScalar(0.8 + Math.random() * 0.5);
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={3}>
      <circleGeometry args={[2.2, 24]} />
      <meshBasicMaterial
        color="#9fd8ff"
        transparent
        opacity={0.22}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function WaterContainersContents(_: RoomContentsProps) {
  const count = useHud((s) => s.sim?.water.tanks.length ?? 4);
  const installed = TANKS.slice(0, count);
  const pads = TANKS.slice(count);
  return (
    <group>
      {installed.map((t, i) => (
        <TankLive key={i} spot={t} index={i} />
      ))}
      <WeldGlow />
      <ReserveBoard />
      <StandingNpc
        x={WORKERS.skid.x}
        z={WORKERS.skid.z}
        yaw={WORKERS.skid.yaw}
        seed={11}
        outfit="worker"
        clipboard
      />
      <WalkingNpc path={WORKERS.patrol} seed={14} outfit="worker" />
      <AlarmBeacon x={-17} z={-9} y={4.6} yaw={Math.PI / 2} />
      <AlarmBeacon x={-8} z={-15} y={8.2} />
      <SecurityCamera x={16.4} z={-14.6} y={7.2} yaw={0} />

      {/* Static structure: rebuilt (and re-baked) only when a tank is installed. */}
      <Baked key={count}>
        {installed.map((t, i) => (
          <TankStructure key={i} spot={t} index={i} />
        ))}
        {pads.map((t, k) => (
          <TankPad key={k} spot={t} index={count + k} />
        ))}
        <TreatmentSkid />
        {PROPS.pumps.map((p) => (
          <MakeupPump key={p.x} x={p.x} z={p.z} />
        ))}
        <Terminal x={PROPS.panel.x - 0.55} z={PROPS.panel.z} yaw={0} screen={PALETTE.cyan} />
        <Terminal x={PROPS.panel.x + 0.55} z={PROPS.panel.z} yaw={0} screen="#4fb6ff" />
        <WorldText position={[PROPS.panel.x, 2.0, PROPS.panel.z + 0.45]} fontSize={0.2} color="#f2b81f">
          WATER OPS
        </WorldText>

        {/* Overhead make-up headers: back row, west pads, and the drop to the pumps */}
        <Pipe
          axis="x"
          from={-12}
          to={15.5}
          y={HEADER_Y}
          offset={TANKS[0]!.station.z}
          r={0.2}
          color="#5e8fc4"
          band={PALETTE.cyan}
        />
        <Pipe
          axis="z"
          from={TANKS[0]!.station.z}
          to={10}
          y={HEADER_Y}
          offset={-9.3}
          r={0.2}
          color="#5e8fc4"
          band={PALETTE.cyan}
        />
        <Pipe
          axis="z"
          from={TANKS[0]!.station.z}
          to={11.6}
          y={HEADER_Y}
          offset={5.6}
          r={0.2}
          color="#5e8fc4"
          band={PALETTE.cyan}
        />
        <Pipe
          axis="x"
          from={3.5}
          to={8}
          y={HEADER_Y}
          offset={11.6}
          r={0.16}
          color="#5e8fc4"
          band={PALETTE.player}
        />
        <Pipe
          axis="x"
          from={-16.6}
          to={16.6}
          y={7.9}
          offset={-14.6}
          r={0.12}
          color="#b7bfc8"
          band={PALETTE.trim}
        />

        {/* Floor: drains in front of the tanks, flow arrows, safety kit */}
        {TANKS.slice(0, 4).map((t) => (
          <mesh
            key={t.x}
            position={[t.x - 1.4, 0.011, t.z + TANK_R + 1.1]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={M.dark()}
          >
            <planeGeometry args={[0.9, 0.5]} />
          </mesh>
        ))}
        <FloorText position={[0, 0.02, -2.2]} fontSize={0.36} color="#7fc8ff" fillOpacity={0.5}>
          MAKE-UP → REACTOR CONTROL · C-3
        </FloorText>
        <EyewashStation x={PROPS.eyewash.x} z={PROPS.eyewash.z} yaw={-Math.PI / 2} />
        <Extinguisher x={PROPS.extinguisher.x} z={PROPS.extinguisher.z} yaw={Math.PI / 2} />
      </Baked>

      <pointLight position={[0, 7.5, 1]} color="#e6f2ff" intensity={60} distance={30} decay={1.2} />
      <Baked>
        <GlowDecal x={-4} z={-4} radius={8} color="#bfe0ff" intensity={0.22} />
        <GlowDecal x={8} z={4} radius={7} color="#bfe0ff" intensity={0.2} />
        <GlowDecal
          x={PROPS.panel.x}
          z={PROPS.panel.z + 1}
          radius={2.6}
          color={PALETTE.cyan}
          intensity={0.25}
        />
        {installed.map((t) => (
          <GlowDecal
            key={t.x + t.z}
            x={t.station.x}
            z={t.station.z + (t.face === 0 ? 0.8 : 0)}
            radius={1.8}
            color="#4fb6ff"
            intensity={0.18}
          />
        ))}
      </Baked>
    </group>
  );
}
