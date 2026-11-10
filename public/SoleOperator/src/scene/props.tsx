import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { player, simHost } from '../game/runtime';
import { useHud } from '../state/hud';
import { PALETTE } from '../styles/palette';
import { glow as sharedGlow, std } from './materials';
import { WorldText } from './parts';

/**
 * Environment props shared by rooms. Each takes a room-local position and,
 * for wall-mounted ones, a yaw that turns local +z to face into the room.
 */
type Placed = { x: number; z: number; yaw?: number; y?: number };

const glow = (c: string, k = 2.2) => sharedGlow(c, k);

/** Shared (cached) standard material, so identical props batch together inside <Baked>. */
function useStd(color: string, roughness = 0.6, metalness = 0.1) {
  return std({ color, roughness, metalness });
}

/** Coffee vending machine with a glowing front. */
export function VendingMachine({ x, z, yaw = 0 }: Placed) {
  const body = useStd('#a3312c', 0.5, 0.2);
  const dark = useStd('#1b2027', 0.4, 0.3);
  const front = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#ffe7c2');
    grd.addColorStop(1, '#ffb35c');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = '#7a2a1a';
    g.font = 'bold 26px sans-serif';
    g.fillText('COFFEE', 18, 44);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = ['#5a3a22', '#2b1a10', '#c08850', '#e8d8c0'][i]!;
      g.beginPath();
      g.arc(34 + (i % 2) * 60, 100 + Math.floor(i / 2) * 60, 18, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.4, 1.4, 1.4), toneMapped: false });
  }, []);
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.0, 0]} material={body} castShadow receiveShadow>
        <boxGeometry args={[1.1, 2.0, 0.85]} />
      </mesh>
      <mesh position={[-0.12, 1.25, 0.43]} material={front}>
        <planeGeometry args={[0.62, 1.2]} />
      </mesh>
      <mesh position={[0.36, 1.2, 0.44]} material={dark}>
        <boxGeometry args={[0.18, 0.5, 0.04]} />
      </mesh>
      <mesh position={[0, 0.45, 0.44]} material={dark}>
        <boxGeometry args={[0.5, 0.3, 0.06]} />
      </mesh>
    </group>
  );
}

/** Water cooler with a blue bottle. */
export function WaterCooler({ x, z, yaw = 0 }: Placed) {
  const body = useStd('#e9edf1', 0.5);
  const bottle = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#7fd0ff',
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
        clearcoat: 1,
      }),
    [],
  );
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.55, 0]} material={body} castShadow>
        <boxGeometry args={[0.45, 1.1, 0.45]} />
      </mesh>
      <mesh position={[0, 1.38, 0]} material={bottle} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.55, 14]} />
      </mesh>
      <mesh position={[0, 0.85, 0.23]} material={glow(PALETTE.cyan, 1.2)}>
        <boxGeometry args={[0.1, 0.06, 0.02]} />
      </mesh>
    </group>
  );
}

/**
 * Wall-mounted rotating alarm beacon. A backplate sits flush on the wall
 * (local z = 0, local +z out of the wall), a short arm holds the housing, and
 * the red lens points straight out from the wall. Dim when all is well, spins
 * while an alarm is unacknowledged, glows steady once acknowledged.
 */
export function AlarmBeacon({ x, z, y = 4.5, yaw = 0 }: Placed) {
  const spinner = useRef<THREE.Group>(null);
  const lens = useRef<THREE.MeshBasicMaterial>(null);
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  const housing = useStd('#2a3038', 0.5, 0.4);
  const plate = useStd('#9aa6b2', 0.4, 0.6);
  useFrame((st, dt) => {
    const { sim, acked } = useHud.getState();
    const alarms = sim?.alarms ?? [];
    const unacked = alarms.some((a) => !acked.includes(a));
    const active = alarms.length > 0;
    if (spinner.current) spinner.current.rotation.z += dt * (unacked ? 7 : 0);
    const k = active ? (unacked ? 2.6 : 1.4 + Math.sin(st.clock.elapsedTime * 3) * 0.3) : 0.25;
    lens.current?.color.set('#ff3b30').multiplyScalar(k);
    if (beam.current) beam.current.opacity = unacked ? 0.3 : 0;
  });
  // Cylinders are built along +y; this turns them to point out of the wall (+z).
  const outward: [number, number, number] = [Math.PI / 2, 0, 0];
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      {/* Backplate flush with the wall, with four bolt heads */}
      <mesh position={[0, 0, 0.02]} material={plate}>
        <boxGeometry args={[0.36, 0.36, 0.04]} />
      </mesh>
      {[-0.13, 0.13].flatMap((bx) =>
        [-0.13, 0.13].map((by) => (
          <mesh key={`${bx},${by}`} position={[bx, by, 0.045]} rotation={outward} material={housing}>
            <cylinderGeometry args={[0.02, 0.02, 0.02, 6]} />
          </mesh>
        )),
      )}
      {/* Arm and housing */}
      <mesh position={[0, 0, 0.1]} rotation={outward} material={housing}>
        <cylinderGeometry args={[0.07, 0.09, 0.12, 12]} />
      </mesh>
      <mesh position={[0, 0, 0.2]} rotation={outward} material={housing}>
        <cylinderGeometry args={[0.15, 0.15, 0.08, 16]} />
      </mesh>
      {/* Red lens dome pointing out of the wall */}
      <mesh position={[0, 0, 0.3]} rotation={outward}>
        <cylinderGeometry args={[0.12, 0.13, 0.14, 16]} />
        <meshBasicMaterial ref={lens} color="#ff3b30" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.375]} rotation={outward}>
        <sphereGeometry args={[0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#ff8a80" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      {/* Rotating light sweep around the lens axis */}
      <group ref={spinner} position={[0, 0, 0.32]}>
        <mesh position={[0.9, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.38, 1.6, 16, 1, true]} />
          <meshBasicMaterial
            ref={beam}
            color="#ff5040"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Wall-mounted security camera that watches the Operator when nearby, and sweeps otherwise. */
export function SecurityCamera({ x, z, y = 6.4, yaw = 0, range = 22 }: Placed & { range?: number }) {
  const head = useRef<THREE.Group>(null);
  const led = useRef<THREE.MeshBasicMaterial>(null);
  const body = useStd('#e4e8ec', 0.4, 0.2);
  const dark = useStd('#20262d', 0.4, 0.3);
  useFrame((s, dt) => {
    const h = head.current;
    if (!h) return;
    const dx = player.pos.x - x;
    const dz = player.pos.z - z;
    let goal: number;
    let pitch = 0.5;
    if (Math.hypot(dx, dz) < range) {
      // Yaw in the mount's frame (mount local +z faces into the room).
      goal = Math.atan2(dx, dz) - yaw;
      pitch = Math.atan2(y - 1.2, Math.hypot(dx, dz));
    } else goal = Math.sin(s.clock.elapsedTime * 0.4) * 0.7;
    goal = Math.atan2(Math.sin(goal), Math.cos(goal));
    h.rotation.y += (goal - h.rotation.y) * (1 - Math.exp(-dt * 3));
    h.rotation.x += (pitch - h.rotation.x) * (1 - Math.exp(-dt * 3));
    led.current?.color.set('#ff2a2a').multiplyScalar(Math.sin(s.clock.elapsedTime * 4) > 0 ? 2.5 : 0.3);
  });
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.1, 0.05]} material={dark}>
        <boxGeometry args={[0.12, 0.3, 0.12]} />
      </mesh>
      <group ref={head} position={[0, -0.05, 0.18]}>
        <mesh position={[0, 0, 0.18]} material={body} castShadow>
          <boxGeometry args={[0.26, 0.24, 0.55]} />
        </mesh>
        <mesh position={[0, 0, 0.47]} rotation={[Math.PI / 2, 0, 0]} material={dark}>
          <cylinderGeometry args={[0.08, 0.08, 0.06, 12]} />
        </mesh>
        <mesh position={[0.09, 0.08, 0.46]}>
          <sphereGeometry args={[0.025, 8, 6]} />
          <meshBasicMaterial ref={led} color="#ff2a2a" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Red extinguisher on a wall bracket with a sign above. */
export function Extinguisher({ x, z, yaw = 0 }: Placed) {
  const red = useStd('#d7261e', 0.4, 0.2);
  const dark = useStd('#1d1f22', 0.5);
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.75, 0.16]} material={red} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.55, 12]} />
      </mesh>
      <mesh position={[0, 1.08, 0.16]} material={dark}>
        <cylinderGeometry args={[0.05, 0.07, 0.12, 8]} />
      </mesh>
      <mesh position={[0, 1.65, 0.03]}>
        <planeGeometry args={[0.36, 0.36]} />
        <meshStandardMaterial color="#d7261e" />
      </mesh>
      <WorldText position={[0, 1.65, 0.04]} fontSize={0.09} color="#ffffff">
        FIRE
      </WorldText>
    </group>
  );
}

/** Green first-aid cabinet. */
export function FirstAid({ x, z, yaw = 0 }: Placed) {
  const box = useStd('#2fa35a', 0.5);
  const white = useStd('#f4f6f8', 0.5);
  return (
    <group position={[x, 1.5, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0, 0.1]} material={box} castShadow>
        <boxGeometry args={[0.7, 0.55, 0.2]} />
      </mesh>
      <mesh position={[0, 0, 0.21]} material={white}>
        <boxGeometry args={[0.32, 0.09, 0.01]} />
      </mesh>
      <mesh position={[0, 0, 0.21]} material={white}>
        <boxGeometry args={[0.09, 0.32, 0.01]} />
      </mesh>
    </group>
  );
}

/** Analogue wall clock driven by game time. */
export function WallClock({ x, z, y = 5.6, yaw = 0 }: Placed) {
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  const face = useStd('#f4f6f8', 0.4);
  const rim = useStd('#2a3038', 0.4, 0.4);
  const hand = useStd('#1b1f24', 0.5);
  useFrame(() => {
    const t = simHost.state.time % 86400;
    if (minute.current) minute.current.rotation.z = -((t % 3600) / 3600) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -((t % 43200) / 43200) * Math.PI * 2;
  });
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.04]} material={rim}>
        <cylinderGeometry args={[0.55, 0.55, 0.08, 32]} />
      </mesh>
      <mesh position={[0, 0, 0.085]} material={face}>
        <circleGeometry args={[0.49, 32]} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh
          key={i}
          position={[Math.sin((i / 12) * Math.PI * 2) * 0.42, Math.cos((i / 12) * Math.PI * 2) * 0.42, 0.09]}
          material={hand}
        >
          <boxGeometry args={[0.03, 0.03, 0.01]} />
        </mesh>
      ))}
      <group ref={hour} position={[0, 0, 0.1]}>
        <mesh position={[0, 0.14, 0]} material={hand}>
          <boxGeometry args={[0.04, 0.28, 0.01]} />
        </mesh>
      </group>
      <group ref={minute} position={[0, 0, 0.11]}>
        <mesh position={[0, 0.2, 0]} material={hand}>
          <boxGeometry args={[0.025, 0.4, 0.01]} />
        </mesh>
      </group>
    </group>
  );
}

/** A straight run of pipe with coloured bands and wall brackets. Axis 'x' or 'z'. */
export function Pipe({
  from,
  to,
  y,
  offset,
  axis,
  r = 0.14,
  color = '#8d99a6',
  band = PALETTE.cyan,
}: {
  from: number;
  to: number;
  y: number;
  /** Fixed coordinate on the other axis. */
  offset: number;
  axis: 'x' | 'z';
  r?: number;
  color?: string;
  band?: string;
}) {
  const mat = useStd(color, 0.35, 0.7);
  const bandMat = useStd(band, 0.5, 0.2);
  const len = to - from;
  const mid = (from + to) / 2;
  const pos = (a: number): [number, number, number] => (axis === 'x' ? [a, y, offset] : [offset, y, a]);
  const rot: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
  const bands = Array.from(
    { length: Math.max(1, Math.floor(Math.abs(len) / 4)) },
    (_, i) => from + (i + 0.5) * (len / Math.max(1, Math.floor(Math.abs(len) / 4))),
  );
  return (
    <group>
      <mesh position={pos(mid)} rotation={rot} material={mat} castShadow>
        <cylinderGeometry args={[r, r, Math.abs(len), 12]} />
      </mesh>
      {bands.map((b) => (
        <mesh key={b} position={pos(b)} rotation={rot} material={bandMat}>
          <cylinderGeometry args={[r * 1.08, r * 1.08, 0.18, 12]} />
        </mesh>
      ))}
    </group>
  );
}

/** Generic wall terminal / desk console with a lit screen. */
export function Terminal({
  x,
  z,
  yaw = 0,
  screen = PALETTE.cyan,
  desk = true,
}: Placed & { screen?: string; desk?: boolean }) {
  const body = useStd('#d9dee4', 0.55);
  const dark = useStd('#1b222b', 0.45, 0.3);
  const scr = useMemo(() => glow(screen, 1.1), [screen]);
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {desk && (
        <mesh position={[0, 0.45, 0]} material={body} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.9, 0.7]} />
        </mesh>
      )}
      <mesh position={[0, 1.02, -0.05]} rotation={[-0.5, 0, 0]} material={dark} castShadow>
        <boxGeometry args={[0.95, 0.12, 0.6]} />
      </mesh>
      <mesh position={[0, 1.08, -0.04]} rotation={[-0.5 - Math.PI / 2, 0, 0]} material={scr}>
        <planeGeometry args={[0.8, 0.48]} />
      </mesh>
      <mesh position={[0, 1.42, -0.32]} material={dark} castShadow>
        <boxGeometry args={[0.9, 0.55, 0.06]} />
      </mesh>
      <mesh position={[0, 1.42, -0.285]} material={scr}>
        <planeGeometry args={[0.8, 0.45]} />
      </mesh>
    </group>
  );
}

/** Wall-mounted eyewash / safety shower station with its green sign. */
export function EyewashStation({ x, z, yaw = 0 }: Placed) {
  const green = useStd('#1fa65a', 0.45);
  const steel = useStd('#c3ccd6', 0.3, 0.8);
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.05, 0.25]} material={steel}>
        <cylinderGeometry args={[0.035, 0.035, 2.1, 8]} />
      </mesh>
      <mesh position={[0, 1.0, 0.42]} material={green} castShadow>
        <cylinderGeometry args={[0.2, 0.12, 0.12, 16]} />
      </mesh>
      <mesh position={[0, 2.25, 0.5]} material={green}>
        <cylinderGeometry args={[0.28, 0.2, 0.12, 16]} />
      </mesh>
      <mesh position={[0, 2.2, 0.32]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
      </mesh>
      <mesh position={[0, 2.9, 0.02]}>
        <planeGeometry args={[0.8, 0.45]} />
        <meshStandardMaterial color="#1fa65a" />
      </mesh>
      <WorldText position={[0, 2.92, 0.03]} fontSize={0.1} color="#ffffff" maxWidth={0.7} textAlign="center">
        EYEWASH · SHOWER
      </WorldText>
    </group>
  );
}
