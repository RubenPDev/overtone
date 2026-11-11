import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { simHost } from '../../game/runtime';
import { job } from '../../game/turbine';
import { Baked } from '../../scene/Baked';
import { glow, std } from '../../scene/materials';
import { StandingNpc, WalkingNpc } from '../../scene/Npc';
import { GlowDecal, WorldText } from '../../scene/parts';
import { AlarmBeacon, Extinguisher, SecurityCamera, Terminal } from '../../scene/props';
import { SYNC_RPM, VIB_ALERT, VIB_GOOD } from '../../sim';
import { useHud } from '../../state/hud';
import { useMode } from '../../state/mode';
import { PALETTE } from '../../styles/palette';
import type { RoomContentsProps } from '../../world/types';
import { BEARINGS_X, CREW, PLINTH, PROPS, SHAFT_Y, SHAFT_Z, TRAIN } from './index';
import './turbine.css';

const ALONG_X: [number, number, number] = [0, 0, Math.PI / 2];
/** Where the semi-gantry's leg runs on the plinth (just behind the railing). */
const CRANE_LEG_Z = PLINTH.maxZ - 0.75;

const M = {
  white: () => std({ color: '#e4e9ee', roughness: 0.38, metalness: 0.2 }),
  dark: () => std({ color: '#29313b', roughness: 0.5, metalness: 0.45 }),
  darker: () => std({ color: '#1c232b', roughness: 0.55, metalness: 0.4 }),
  steel: () => std({ color: '#9aa6b2', roughness: 0.28, metalness: 0.75 }),
  orange: () => std({ color: PALETTE.trim, roughness: 0.5 }),
  yellow: () => std({ color: '#f2c230', roughness: 0.5, metalness: 0.2 }),
  blue: () => std({ color: '#2f6fd0', roughness: 0.42, metalness: 0.35 }),
  genBlue: () => std({ color: '#2b5f9e', roughness: 0.4, metalness: 0.4 }),
  plinth: () => std({ color: '#47525f', roughness: 0.9 }),
  pipe: () => std({ color: '#b9c2cc', roughness: 0.35, metalness: 0.55 }),
  column: () => std({ color: '#8d99a6', roughness: 0.5, metalness: 0.5 }),
  crate: () => std({ color: '#c9a36b', roughness: 0.85 }),
};

/** Radial-blade texture for the LP stages (thin lines round a disc edge). */
let bladeTex: THREE.CanvasTexture | null = null;
function bladeTexture() {
  if (bladeTex) return bladeTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9d2db';
  g.fillRect(0, 0, 256, 32);
  for (let i = 0; i < 256; i += 4) {
    g.fillStyle = i % 8 ? '#8e9aa6' : '#eef3f7';
    g.fillRect(i, 0, 1.6, 32);
  }
  bladeTex = new THREE.CanvasTexture(c);
  bladeTex.colorSpace = THREE.SRGBColorSpace;
  bladeTex.wrapS = THREE.RepeatWrapping;
  bladeTex.repeat.set(6, 1);
  return bladeTex;
}

/** Warm evening sky for the tall windows. */
let skyTex: THREE.CanvasTexture | null = null;
function skyTexture() {
  if (skyTex) return skyTex;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#29466e');
  grad.addColorStop(0.45, '#8a8fb0');
  grad.addColorStop(0.75, '#f0a868');
  grad.addColorStop(1, '#ffd29a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  return skyTex;
}

// --- Structure ----------------------------------------------------------------------------------

function Plinth() {
  const w = PLINTH.maxX - PLINTH.minX;
  const d = PLINTH.maxZ - PLINTH.minZ;
  const cx = (PLINTH.minX + PLINTH.maxX) / 2;
  const cz = (PLINTH.minZ + PLINTH.maxZ) / 2;
  const hazard = glow(PALETTE.hazard, 1.0);
  // Gaps in the railing where the stations are.
  const gaps = [
    ...BEARINGS_X.map((x) => [x - 0.9, x + 0.9]),
    [PROPS.balanceStation.x - 1.3, PROPS.balanceStation.x + 1.3],
  ];
  const posts: number[] = [];
  for (let x = PLINTH.minX + 0.3; x <= PLINTH.maxX - 0.3; x += 1.9)
    if (!gaps.some(([a, b]) => x > a! && x < b!)) posts.push(x);
  const runs: [number, number][] = [];
  let start = PLINTH.minX + 0.3;
  for (const [a, b] of [...gaps].sort((p, q) => p[0]! - q[0]!)) {
    if (a! > start) runs.push([start, a!]);
    start = Math.max(start, b!);
  }
  runs.push([start, PLINTH.maxX - 0.3]);
  const rz = PLINTH.maxZ - 0.15;
  return (
    <group>
      <mesh position={[cx, PLINTH.h / 2, cz]} material={M.plinth()} receiveShadow castShadow>
        <boxGeometry args={[w, PLINTH.h, d]} />
      </mesh>
      <mesh
        position={[cx, PLINTH.h + 0.004, PLINTH.maxZ - 0.12]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={hazard}
      >
        <planeGeometry args={[w, 0.14]} />
      </mesh>
      {posts.map((x) => (
        <mesh key={x} position={[x, PLINTH.h + 0.55, rz]} material={M.yellow()}>
          <boxGeometry args={[0.06, 1.1, 0.06]} />
        </mesh>
      ))}
      {runs.map(([a, b]) =>
        [0.6, 1.1].map((y) => (
          <mesh key={`${a},${y}`} position={[(a + b) / 2, PLINTH.h + y, rz]} material={M.yellow()}>
            <boxGeometry args={[b - a, 0.05, 0.05]} />
          </mesh>
        )),
      )}
    </group>
  );
}

function HpTurbine() {
  const { x0, x1, r } = TRAIN.hp;
  const cx = (x0 + x1) / 2;
  const len = x1 - x0;
  return (
    <group position={[0, 0, SHAFT_Z]}>
      <mesh position={[cx, SHAFT_Y, 0]} rotation={ALONG_X} material={M.white()} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, len, 32]} />
      </mesh>
      {[x0 - 0.5, x1 + 0.5].map((x, i) => (
        <mesh
          key={x}
          position={[x, SHAFT_Y, 0]}
          rotation={[0, 0, i ? -Math.PI / 2 : Math.PI / 2]}
          material={M.white()}
          castShadow
        >
          <cylinderGeometry args={[r * 0.55, r, 1.0, 32]} />
        </mesh>
      ))}
      {/* Horizontal joint flange */}
      <mesh position={[cx, SHAFT_Y, 0]} material={M.steel()}>
        <boxGeometry args={[len + 0.4, 0.14, r * 2 + 0.25]} />
      </mesh>
      {/* Steam chests with orange bands */}
      {[x0 + 2, x1 - 2.2].map((x) => (
        <group key={x} position={[x, SHAFT_Y + r - 0.2, 0]}>
          <mesh position={[0, 1.3, 0]} material={M.white()} castShadow>
            <cylinderGeometry args={[0.62, 0.62, 2.6, 24]} />
          </mesh>
          {[0.55, 1.25, 1.95].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={M.orange()}>
              <cylinderGeometry args={[0.66, 0.66, 0.32, 24]} />
            </mesh>
          ))}
          <mesh position={[0, 2.75, 0]} material={M.steel()}>
            <cylinderGeometry args={[0.4, 0.62, 0.3, 24]} />
          </mesh>
        </group>
      ))}
      <WorldText position={[cx, SHAFT_Y + 0.4, r + 0.02]} fontSize={0.8} color="#2a3540">
        HP
      </WorldText>
    </group>
  );
}

/** Steam crossovers from the HP turbine up and over to the LP casings, plus the main steam lines. */
function SteamPipes() {
  const y = 8.2;
  const r = 0.5;
  const zc = SHAFT_Z - 0.6;
  const seg = (a: THREE.Vector3, b: THREE.Vector3, rad = r, key?: string) => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return (
      <mesh key={key} position={mid} quaternion={q} material={M.pipe()} castShadow>
        <cylinderGeometry args={[rad, rad, len, 18]} />
      </mesh>
    );
  };
  const v = (x: number, yy: number, z: number) => new THREE.Vector3(x, yy, z);
  const xHp = TRAIN.hp.x1 - 1.2;
  const xA = (TRAIN.lpA.x0 + TRAIN.lpA.x1) / 2;
  const xB = (TRAIN.lpB.x0 + TRAIN.lpB.x1) / 2;
  return (
    <group>
      {seg(v(xHp, SHAFT_Y + 1.5, zc), v(xHp, y, zc), r, 'up')}
      {seg(v(xHp, y, zc), v(xB, y, zc), r, 'run')}
      {seg(v(xA, y, zc), v(xA, SHAFT_Y + 2.6, zc), r * 0.9, 'dA')}
      {seg(v(xB, y, zc), v(xB, SHAFT_Y + 2.7, zc), r * 0.9, 'dB')}
      {[xHp, xA, xB].map((x) => (
        <mesh key={x} position={[x, y, zc]} material={M.pipe()}>
          <sphereGeometry args={[r * 1.08, 16, 10]} />
        </mesh>
      ))}
      {/* Main steam lines from the back wall into the steam chests */}
      {[TRAIN.hp.x0 + 2, TRAIN.hp.x1 - 2.2].map((x, i) => (
        <group key={x}>
          {seg(v(x, SHAFT_Y + 4.7, SHAFT_Z), v(x, 9.4 - i * 0.6, SHAFT_Z), 0.32, `m${i}`)}
          {seg(v(x, 9.4 - i * 0.6, SHAFT_Z), v(x, 9.4 - i * 0.6, -11.6), 0.32, `n${i}`)}
        </group>
      ))}
      {/* Moisture separator reheater on its frame */}
      <mesh position={[-6.5, 7.0, -9.2]} rotation={ALONG_X} material={M.yellow()} castShadow>
        <cylinderGeometry args={[0.9, 0.9, 6, 24]} />
      </mesh>
      {[-9, -4].map((x) => (
        <mesh key={x} position={[x, 3.3, -9.2]} material={M.column()}>
          <boxGeometry args={[0.3, 6.6, 0.3]} />
        </mesh>
      ))}
      {seg(v(-3.5, 7, -9.2), v(-1, 8.2, zc), 0.3, 'msr')}
    </group>
  );
}

/** LP B: covered by its dark hood. */
function LpB() {
  const { x0, x1, r } = TRAIN.lpB;
  const cx = (x0 + x1) / 2;
  const len = x1 - x0;
  return (
    <group position={[cx, SHAFT_Y, SHAFT_Z]}>
      <mesh rotation={ALONG_X} material={M.dark()} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, len, 32, 1, false, 0, Math.PI]} />
      </mesh>
      <mesh rotation={ALONG_X} material={M.darker()}>
        <cylinderGeometry args={[r * 0.98, r * 0.98, len - 0.02, 32, 1, false, Math.PI, Math.PI]} />
      </mesh>
      {[-len / 2, len / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.dark()}>
          <cylinderGeometry args={[r + 0.1, r + 0.1, 0.2, 32]} />
        </mesh>
      ))}
      {[-2.6, 0, 2.6].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]} rotation={ALONG_X} material={M.steel()}>
          <cylinderGeometry args={[r + 0.04, r + 0.04, 0.12, 32, 1, false, 0, Math.PI]} />
        </mesh>
      ))}
      <WorldText position={[0, 0.9, r + 0.03]} fontSize={0.6} color="#c9d3dd">
        LP B
      </WorldText>
    </group>
  );
}

/** LP A lower casing trough (the rotor is drawn live). */
function LpATrough() {
  const { x0, x1, r } = TRAIN.lpA;
  const cx = (x0 + x1) / 2;
  const len = x1 - x0;
  return (
    <group position={[cx, SHAFT_Y, SHAFT_Z]}>
      <mesh rotation={ALONG_X} material={M.darker()} receiveShadow>
        <cylinderGeometry args={[r + 0.25, r + 0.25, len, 32, 1, true, Math.PI, Math.PI]} />
      </mesh>
      <mesh position={[0, 0, 0]} material={M.steel()}>
        <boxGeometry args={[len + 0.3, 0.14, r * 2 + 0.8]} />
      </mesh>
      {[-len / 2, len / 2].map((x) => (
        <mesh key={x} position={[x, -r / 2, 0]} material={M.dark()}>
          <boxGeometry args={[0.25, r, r * 2 + 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

function Generator() {
  const { x0, x1, r } = TRAIN.gen;
  const cx = (x0 + x1) / 2;
  const len = x1 - x0;
  return (
    <group position={[cx, SHAFT_Y + 0.2, SHAFT_Z]}>
      <mesh rotation={ALONG_X} material={M.white()} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, len, 36]} />
      </mesh>
      {[-len / 2 + 0.9, len / 2 - 0.9].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={ALONG_X} material={M.genBlue()}>
          <cylinderGeometry args={[r + 0.05, r + 0.05, 0.5, 36]} />
        </mesh>
      ))}
      {[-len / 2 - 0.35, len / 2 + 0.35].map((x, i) => (
        <mesh
          key={x}
          position={[x, 0, 0]}
          rotation={[0, 0, i ? -Math.PI / 2 : Math.PI / 2]}
          material={M.white()}
          castShadow
        >
          <cylinderGeometry args={[r * 0.7, r, 0.7, 36]} />
        </mesh>
      ))}
      {/* Hydrogen coolers on top */}
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} position={[x, r + 0.35, 0]} material={M.white()} castShadow>
          <boxGeometry args={[2.2, 0.7, 1.6]} />
        </mesh>
      ))}
      <mesh position={[0, -r + 0.1, 0]} material={M.dark()}>
        <boxGeometry args={[len, 0.6, r * 2.2]} />
      </mesh>
      <WorldText position={[0, 0.3, r + 0.03]} fontSize={0.42} color="#2a3540">
        GEN B · 612 MVA
      </WorldText>
    </group>
  );
}

function Exciter() {
  const { x0, x1, r } = TRAIN.exciter;
  return (
    <group position={[(x0 + x1) / 2, SHAFT_Y, SHAFT_Z]}>
      <mesh rotation={ALONG_X} material={M.dark()} castShadow>
        <cylinderGeometry args={[r + 0.2, r + 0.2, x1 - x0, 28]} />
      </mesh>
      <mesh position={[(x1 - x0) / 2 + 0.05, 0, 0]} rotation={ALONG_X} material={M.orange()}>
        <cylinderGeometry args={[r, r, 0.3, 28]} />
      </mesh>
    </group>
  );
}

function BearingPedestal({ x }: { x: number }) {
  return (
    <group position={[x, 0, SHAFT_Z]}>
      <mesh position={[0, PLINTH.h + (SHAFT_Y - PLINTH.h - 0.35) / 2, 0]} material={M.dark()} castShadow>
        <boxGeometry args={[0.9, SHAFT_Y - PLINTH.h - 0.35, 1.5]} />
      </mesh>
      <mesh position={[0, SHAFT_Y, 0]} rotation={ALONG_X} material={M.steel()} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.8, 20]} />
      </mesh>
      <mesh position={[0, SHAFT_Y + 0.35, 0]} material={M.dark()}>
        <boxGeometry args={[0.85, 0.4, 1.2]} />
      </mesh>
    </group>
  );
}

function Condenser() {
  const c = PROPS.condenser;
  const w = c.maxX - c.minX;
  const d = c.maxZ - c.minZ;
  const h = 2.8;
  return (
    <group position={[(c.minX + c.maxX) / 2, 0, (c.minZ + c.maxZ) / 2]}>
      <mesh
        position={[0, h / 2, 0]}
        material={std({ color: '#9aa4ae', roughness: 0.6, metalness: 0.35 })}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {Array.from({ length: Math.floor(w / 0.9) }, (_, i) => -w / 2 + 0.45 + i * 0.9).map((x) => (
        <mesh key={x} position={[x, h / 2, d / 2 + 0.04]} material={M.column()}>
          <boxGeometry args={[0.08, h - 0.2, 0.08]} />
        </mesh>
      ))}
      <mesh position={[0, h + 0.06, 0]} material={M.dark()}>
        <boxGeometry args={[w + 0.2, 0.12, d + 0.2]} />
      </mesh>
      <WorldText position={[0, h - 0.55, d / 2 + 0.1]} fontSize={0.5} color="#1f2a35">
        CONDENSER B
      </WorldText>
      {/* Cooling water pipes out toward the cooling chambers */}
      {[-w / 2 + 1.5, -w / 2 + 3.2].map((x) => (
        <group key={x}>
          <mesh
            position={[x, 0.9, d / 2 + 1.0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={M.blue()}
            castShadow
          >
            <cylinderGeometry args={[0.42, 0.42, 2.0, 20]} />
          </mesh>
          <mesh position={[x, 0.9, d / 2 + 0.05]} rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
            <cylinderGeometry args={[0.55, 0.55, 0.12, 20]} />
          </mesh>
        </group>
      ))}
      {/* Stair to the condenser top */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          position={[w / 2 + 0.7, 0.23 + i * 0.46, -d / 2 + 0.6 + i * 0.45]}
          material={M.yellow()}
        >
          <boxGeometry args={[1.1, 0.08, 0.4]} />
        </mesh>
      ))}
    </group>
  );
}

function FeedPump({ x, z, id }: { x: number; z: number; id: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.14, 0]} material={M.dark()} receiveShadow>
        <boxGeometry args={[2.6, 0.28, 1.6]} />
      </mesh>
      <mesh position={[0.55, 1.0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.blue()} castShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.75, 28]} />
      </mesh>
      <mesh position={[0.55, 1.95, 0]} material={M.blue()} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.9, 16]} />
      </mesh>
      <mesh position={[0.55, 1.0, 0.95]} rotation={[Math.PI / 2, 0, 0]} material={M.blue()}>
        <cylinderGeometry args={[0.3, 0.3, 0.9, 16]} />
      </mesh>
      <mesh position={[-0.6, 0.85, 0]} rotation={[0, 0, Math.PI / 2]} material={M.genBlue()} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 1.2, 22]} />
      </mesh>
      <mesh position={[-0.05, 0.85, 0]} material={M.orange()}>
        <boxGeometry args={[0.3, 0.55, 0.62]} />
      </mesh>
      <WorldText position={[-0.6, 1.55, 0]} rotation={[0, Math.PI / 4, 0]} fontSize={0.26} color="#e8eef4">
        {`FP-${id}`}
      </WorldText>
    </group>
  );
}

/** The LP A upper hood, lifted off for the blade inspection and set on skids. */
function RemovedHood() {
  const { x, z, len } = PROPS.hood;
  const r = TRAIN.lpA.r + 0.25;
  return (
    <group position={[x, 0.35, z]}>
      <mesh rotation={ALONG_X} material={M.dark()} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.75, r * 0.75, len, 32, 1, false, 0, Math.PI]} />
      </mesh>
      <mesh rotation={ALONG_X} material={M.darker()}>
        <cylinderGeometry args={[r * 0.72, r * 0.72, len - 0.05, 32, 1, true, 0, Math.PI]} />
      </mesh>
      {[-len / 3, len / 3].map((dx) => (
        <mesh key={dx} position={[dx, -0.2, 0]} material={std({ color: '#7a5a3a', roughness: 0.9 })}>
          <boxGeometry args={[0.4, 0.3, r * 1.8]} />
        </mesh>
      ))}
      {[-len / 4, len / 4].map((dx) => (
        <mesh key={`l${dx}`} position={[dx, r * 0.75 + 0.15, 0]} material={M.yellow()}>
          <torusGeometry args={[0.2, 0.05, 6, 12]} />
        </mesh>
      ))}
    </group>
  );
}

function LubeSkid() {
  const l = PROPS.lube;
  const w = l.maxX - l.minX;
  const d = l.maxZ - l.minZ;
  return (
    <group position={[(l.minX + l.maxX) / 2, 0, (l.minZ + l.maxZ) / 2]}>
      <mesh position={[0, 0.9, 0]} material={M.yellow()} castShadow receiveShadow>
        <boxGeometry args={[w, 1.8, d]} />
      </mesh>
      <mesh position={[0, 1.85, 0]} material={M.dark()}>
        <boxGeometry args={[w + 0.1, 0.1, d + 0.1]} />
      </mesh>
      {[
        [-1.2, -1],
        [0, -1],
        [-1.2, 0.6],
      ].map(([dx, dz]) => (
        <mesh key={`${dx},${dz}`} position={[dx!, 2.35, dz!]} material={M.blue()} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.9, 18]} />
        </mesh>
      ))}
      <WorldText
        position={[-w / 2 - 0.01, 1.1, 0.4]}
        rotation={[0, -Math.PI / 2, 0]}
        fontSize={0.42}
        color="#2a2310"
      >
        LUBE OIL
      </WorldText>
      <mesh position={[-w / 2 + 0.5, 1.2, -d / 2 - 0.6]} material={M.pipe()}>
        <cylinderGeometry args={[0.12, 0.12, 2.4, 10]} />
      </mesh>
    </group>
  );
}

/** Back wall: tall windows on an evening sky, steel columns, the crane rail. */
function BackWall() {
  const sky = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: skyTexture(),
        color: new THREE.Color(1.15, 1.1, 1.05),
        toneMapped: false,
      }),
    [],
  );
  const z = -11.93;
  const xs = Array.from({ length: 9 }, (_, i) => -22.5 + i * 5.6);
  return (
    <group>
      {xs.map((x) => (
        <group key={x}>
          <mesh position={[x, 7.3, z]} material={sky}>
            <planeGeometry args={[4.0, 5.4]} />
          </mesh>
          {[-1, 0, 1].map((k) => (
            <mesh key={k} position={[x + k * 1.33, 7.3, z + 0.05]} material={M.darker()}>
              <boxGeometry args={[0.07, 5.4, 0.06]} />
            </mesh>
          ))}
          {[5.5, 7.3, 9.1].map((y) => (
            <mesh key={y} position={[x, y, z + 0.05]} material={M.darker()}>
              <boxGeometry args={[4.0, 0.07, 0.06]} />
            </mesh>
          ))}
          <mesh position={[x, 4.5, z + 0.12]} material={M.column()}>
            <boxGeometry args={[4.3, 0.18, 0.25]} />
          </mesh>
        </group>
      ))}
      {[...xs.map((x) => x - 2.8), xs[xs.length - 1]! + 2.8].map((x) => (
        <mesh key={x} position={[x, 5.5, -11.75]} material={M.column()} castShadow>
          <boxGeometry args={[0.5, 11, 0.5]} />
        </mesh>
      ))}
      {/* Semi-gantry crane rails: high on the back wall, and along the plinth top */}
      <mesh position={[0, 9.6, -11.45]} material={M.yellow()}>
        <boxGeometry args={[55, 0.35, 0.4]} />
      </mesh>
      <mesh position={[(PLINTH.minX + PLINTH.maxX) / 2, PLINTH.h + 0.06, CRANE_LEG_Z]} material={M.steel()}>
        <boxGeometry args={[PLINTH.maxX - PLINTH.minX - 0.4, 0.12, 0.18]} />
      </mesh>
    </group>
  );
}

// --- Live parts ---------------------------------------------------------------------------------

/** LP rotor A: double-flow blade stages that spin with the turbine, the balance weight, and B3's shake. */
function LpRotor() {
  const spin = useRef<THREE.Group>(null);
  const shake = useRef<THREE.Group>(null);
  const weight = useRef<THREE.Mesh>(null);
  const st = useMemo(() => ({ speed: 0 }), []);
  const { x0, x1 } = TRAIN.lpA;
  const cx = (x0 + x1) / 2;
  const len = x1 - x0;
  const stages = useMemo(() => {
    const out: { x: number; r: number }[] = [];
    for (let k = 0; k < 6; k++) {
      const r = 1.05 + k * 0.24;
      const dx = 0.5 + k * 0.72;
      out.push({ x: -dx, r }, { x: dx, r });
    }
    return out;
  }, []);
  const mats = useMemo(() => {
    const tex = bladeTexture();
    return {
      blades: new THREE.MeshStandardMaterial({ color: '#dfe6ec', map: tex, roughness: 0.3, metalness: 0.75 }),
      hub: std({ color: '#7f8b97', roughness: 0.3, metalness: 0.8 }),
      weight: glow(PALETTE.amber, 2),
    };
  }, []);
  useFrame((s, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = simHost.state.turbine;
    // Visual speed: ~1.6 rev/s at 3,000 rpm (the real 50 rev/s would strobe); stopped on turning gear while fitting.
    const target = job.fitting ? 0 : (t.rpm / SYNC_RPM) * Math.PI * 2 * 1.6;
    st.speed += (target - st.speed) * (1 - Math.exp(-dt * (job.fitting ? 2.5 : 0.8)));
    if (spin.current) spin.current.rotation.x += st.speed * dt;
    if (shake.current) {
      const amp = Math.max(0, (t.bearings[2] ?? 0) - 1.4) * 0.0045 * (t.rpm / SYNC_RPM);
      const time = s.clock.elapsedTime;
      shake.current.position.y = Math.sin(time * 53) * amp;
      shake.current.position.z = Math.cos(time * 53) * amp * 0.7;
    }
    if (weight.current) {
      const w = t.weight;
      weight.current.visible = !!w;
      if (w) {
        const a = (w.angle * Math.PI) / 180;
        const r = stages[stages.length - 1]!.r + 0.02;
        weight.current.position.set(len / 2 - 0.5, Math.sin(a) * r, Math.cos(a) * r);
        weight.current.rotation.x = -a;
        weight.current.scale.setScalar(0.6 + w.mass / 200);
      }
    }
  });
  return (
    <group position={[cx, SHAFT_Y, SHAFT_Z]}>
      <group ref={shake}>
        <group ref={spin}>
          <mesh rotation={ALONG_X} material={mats.hub}>
            <cylinderGeometry args={[0.45, 0.45, len + 3, 20]} />
          </mesh>
          {stages.map((g) => (
            <mesh key={g.x} position={[g.x, 0, 0]} rotation={ALONG_X} material={mats.blades} castShadow>
              <cylinderGeometry args={[g.r, g.r * 0.92, 0.2, 48, 1]} />
            </mesh>
          ))}
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={ALONG_X} material={mats.hub}>
              <cylinderGeometry args={[0.95, 0.95, 0.22, 32]} />
            </mesh>
          ))}
          <mesh ref={weight} material={mats.weight} visible={false}>
            <boxGeometry args={[0.22, 0.12, 0.16]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Shaft segments between machines (spin is invisible on a plain shaft, so these are static), and B3's lamp. */
function BearingLamps() {
  const lamps = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useMemo(
    () => ({ ok: glow('#6dffb6', 2.2), warn: glow(PALETTE.amber, 2.4), bad: glow('#ff3b30', 2.8) }),
    [],
  );
  useFrame((s) => {
    const b = simHost.state.turbine.bearings;
    lamps.current.forEach((m, i) => {
      if (!m) return;
      const v = b[i] ?? 0;
      m.material =
        v > VIB_ALERT
          ? Math.sin(s.clock.elapsedTime * 7) > 0
            ? mats.bad
            : mats.warn
          : v > VIB_GOOD
            ? mats.warn
            : mats.ok;
    });
  });
  return (
    <group>
      {BEARINGS_X.map((x, i) => (
        <mesh
          key={x}
          ref={(m) => {
            lamps.current[i] = m;
          }}
          position={[x, SHAFT_Y + 0.62, SHAFT_Z + 0.62]}
          material={mats.ok}
        >
          <sphereGeometry args={[0.1, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}

/** Generator stator ring glow (pulses gently with load) and feed pump B running hot. */
function LiveGlows() {
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const heat = useRef<THREE.MeshBasicMaterial>(null);
  const heatDecal = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const st = simHost.state;
    const load = Math.max(0, Math.min(1.1, st.output / 1200));
    const time = s.clock.elapsedTime;
    ring.current?.color
      .set(PALETTE.cyan)
      .multiplyScalar(0.6 + 1.8 * load * (0.85 + 0.15 * Math.sin(time * 2)));
    const fp = st.turbine.feedPump;
    const hot = Math.max(0, Math.min(1, (fp.temp - 70) / 25));
    if (heat.current) heat.current.opacity = hot * (0.25 + 0.08 * Math.sin(time * 9));
    if (heatDecal.current) {
      heatDecal.current.visible = hot > 0.05;
      heatDecal.current.scale.setScalar(0.8 + hot * 0.6 + 0.05 * Math.sin(time * 5));
    }
  });
  const g = TRAIN.gen;
  const pump = PROPS.feedPumps[1]!;
  return (
    <group>
      <mesh position={[g.x0 + 0.1, SHAFT_Y + 0.2, SHAFT_Z]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[g.r + 0.08, 0.07, 8, 48]} />
        <meshBasicMaterial ref={ring} color={PALETTE.cyan} toneMapped={false} />
      </mesh>
      <mesh position={[pump.x - 0.6, 0.85, pump.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.62, 0.62, 1.3, 22]} />
        <meshBasicMaterial
          ref={heat}
          color="#ff6a2a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={heatDecal}
        position={[pump.x - 0.4, 0.03, pump.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <circleGeometry args={[1.6, 24]} />
        <meshBasicMaterial
          color="#ff7a3a"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Semi-gantry crane over the turbine train: the bridge runs on a back-wall rail
 * and one leg on the plinth, so it never crosses the walkway in front. It
 * travels slowly along the hall, trolley and hook drifting.
 */
function GantryCrane() {
  const crane = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const span = CRANE_LEG_Z + 11.3;
  const zMid = (CRANE_LEG_Z - 11.3) / 2;
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (crane.current) crane.current.position.x = Math.sin(t * 0.05) * 18;
    if (trolley.current) trolley.current.position.z = zMid + Math.sin(t * 0.09 + 1) * (span / 2 - 1.6);
  });
  return (
    <group ref={crane}>
      {[-0.7, 0.7].map((dx) => (
        <mesh key={dx} position={[dx, 9.95, zMid]} material={M.yellow()} castShadow>
          <boxGeometry args={[0.45, 0.75, span]} />
        </mesh>
      ))}
      <mesh position={[0, 9.85, -11.3]} material={M.yellow()}>
        <boxGeometry args={[3.0, 0.5, 0.8]} />
      </mesh>
      {/* Leg down to the plinth rail, with a diagonal brace */}
      {[-0.9, 0.9].map((dx) => (
        <mesh
          key={`leg${dx}`}
          position={[dx, (PLINTH.h + 9.7) / 2, CRANE_LEG_Z]}
          material={M.yellow()}
          castShadow
        >
          <boxGeometry args={[0.32, 9.7 - PLINTH.h, 0.32]} />
        </mesh>
      ))}
      <mesh position={[0, PLINTH.h + 0.3, CRANE_LEG_Z]} material={M.dark()}>
        <boxGeometry args={[2.6, 0.5, 0.7]} />
      </mesh>
      <mesh position={[0, 8.6, CRANE_LEG_Z - 1.1]} rotation={[0.9, 0, 0]} material={M.yellow()}>
        <boxGeometry args={[0.18, 2.8, 0.18]} />
      </mesh>
      <group ref={trolley}>
        <mesh position={[0, 10.45, 0]} material={M.dark()}>
          <boxGeometry args={[2.0, 0.5, 1.6]} />
        </mesh>
        <mesh position={[0, 8.3, 0]} material={M.steel()}>
          <cylinderGeometry args={[0.025, 0.025, 4.0, 4]} />
        </mesh>
        <mesh position={[0, 6.2, 0]} material={M.yellow()}>
          <boxGeometry args={[0.45, 0.6, 0.3]} />
        </mesh>
        <mesh position={[0, 5.75, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
          <torusGeometry args={[0.18, 0.05, 6, 12, Math.PI * 1.3]} />
        </mesh>
      </group>
    </group>
  );
}

// --- Callouts -------------------------------------------------------------------------------

function Callout({
  at,
  tone,
  title,
  children,
}: {
  at: [number, number, number];
  tone: 'ok' | 'warn' | 'bad' | 'info';
  title: string;
  children: ReactNode;
}) {
  return (
    <Html position={at} zIndexRange={[1, 0]} pointerEvents="none" center={false}>
      <div className={`callout is-${tone}`}>
        <i className="callout__icon">{tone === 'ok' ? '✓' : tone === 'info' ? 'i' : '!'}</i>
        <div>
          <b>{title}</b>
          <span>{children}</span>
        </div>
      </div>
    </Html>
  );
}

function Callouts() {
  // Machine panels carry the detail while a control mode is open.
  const walking = useMode((s) => s.mode.kind === 'walk');
  const b3 = useHud((s) => Math.round((s.sim?.turbine.bearings[2] ?? 0) * 10) / 10);
  const fpTemp = useHud((s) => Math.round(s.sim?.turbine.feedPump.temp ?? 0));
  const fpTrip = useHud((s) => s.sim?.turbine.feedPump.tripped ?? false);
  // Turbine B carries half the unit's output (A and B share the steam).
  const mva = useHud((s) => Math.round((s.sim?.output ?? 0) / 2 / 0.98));
  const tripped = useHud((s) => s.sim?.turbine.tripped ?? false);
  const flow = useHud((s) => Math.round(Math.min(1, s.sim?.coolantFlow ?? 1) * 98));
  const balanced = useHud((s) => s.sim?.turbine.balanced ?? true);
  const pump = PROPS.feedPumps[1]!;
  if (!walking) return null;
  return (
    <group>
      <Callout
        at={[BEARINGS_X[2]!, SHAFT_Y + 2.6, SHAFT_Z]}
        tone={b3 > VIB_ALERT ? 'bad' : b3 > VIB_GOOD ? 'warn' : 'ok'}
        title="BEARING B3 · SHAFT"
      >
        Vibration {b3.toFixed(1)} mm/s{b3 > VIB_GOOD ? ' · inspect' : ''}
      </Callout>
      <Callout
        at={[TRAIN.lpA.x0 + 2, SHAFT_Y + 3.2, SHAFT_Z]}
        tone={balanced ? 'info' : 'warn'}
        title="LP ROTOR A · BLADES"
      >
        {balanced ? 'Hood off for inspection · 2 crew' : 'Out of balance · fit weights with the crew'}
      </Callout>
      <Callout
        at={[pump.x, 2.6, pump.z]}
        tone={fpTrip ? 'bad' : fpTemp > 80 ? 'warn' : 'ok'}
        title="FEED PUMP MOTOR B"
      >
        {fpTrip
          ? 'Tripped · service and let it cool'
          : `Winding ${fpTemp} °C${fpTemp > 80 ? ' · service due' : ''}`}
      </Callout>
      <Callout
        at={[(TRAIN.gen.x0 + TRAIN.gen.x1) / 2, SHAFT_Y + 3.2, SHAFT_Z]}
        tone={tripped ? 'bad' : 'ok'}
        title="GENERATOR B"
      >
        {tripped ? 'Tripped · reset at the local desk' : `${mva} MVA · stable`}
      </Callout>
      <Callout
        at={[PROPS.condenser.minX + 2, 3.4, PROPS.condenser.maxZ + 0.6]}
        tone="ok"
        title="COOLING WATER OUT"
      >
        Flow {flow}% · to cooling chambers
      </Callout>
    </group>
  );
}

export default function TurbineHallContents(_: RoomContentsProps) {
  const crate = M.crate();
  return (
    <group>
      <LpRotor />
      <BearingLamps />
      <LiveGlows />
      <GantryCrane />
      <Callouts />
      {CREW.rotor.map((c, i) => (
        <StandingNpc key={i} x={c.x} z={c.z} yaw={c.yaw} seed={20 + i} outfit="worker" clipboard={i === 0} />
      ))}
      <StandingNpc x={CREW.lube.x} z={CREW.lube.z} yaw={CREW.lube.yaw} seed={23} outfit="worker" />
      <WalkingNpc path={CREW.patrol} seed={24} outfit="worker" />
      <AlarmBeacon x={-28} z={-9} y={6} yaw={Math.PI / 2} />
      <AlarmBeacon x={14} z={-12} y={3.6} />
      <SecurityCamera x={-27.6} z={10.6} y={7.5} yaw={Math.PI / 2} />

      <Baked>
        <Plinth />
        <HpTurbine />
        <SteamPipes />
        <LpATrough />
        <LpB />
        <Generator />
        <Exciter />
        {BEARINGS_X.map((x) => (
          <BearingPedestal key={x} x={x} />
        ))}
        {/* Plain shaft runs between machines */}
        {[
          [TRAIN.hp.x1 + 0.6, TRAIN.lpA.x0 - 0.3],
          [TRAIN.lpA.x1 + 1.5, TRAIN.lpB.x0],
          [TRAIN.lpB.x1, TRAIN.gen.x0 - 0.7],
        ].map(([a, b]) => (
          <mesh key={a} position={[(a! + b!) / 2, SHAFT_Y, SHAFT_Z]} rotation={ALONG_X} material={M.steel()}>
            <cylinderGeometry args={[0.38, 0.38, b! - a!, 18]} />
          </mesh>
        ))}
        <Condenser />
        {PROPS.feedPumps.map((p) => (
          <FeedPump key={p.id} x={p.x} z={p.z} id={p.id} />
        ))}
        <RemovedHood />
        <LubeSkid />
        <BackWall />
        {/* Hall lettering on the west wall */}
        <WorldText position={[-27.95, 8.2, -3]} rotation={[0, Math.PI / 2, 0]} fontSize={3.4} color="#7a8796">
          B
        </WorldText>
        <WorldText
          position={[-27.95, 6.3, -3]}
          rotation={[0, Math.PI / 2, 0]}
          fontSize={0.6}
          color={PALETTE.trim}
        >
          TURBINE HALL
        </WorldText>
        {/* Local desk */}
        <Terminal x={PROPS.desk.x - 0.55} z={PROPS.desk.z} yaw={0} screen={PALETTE.amber} />
        <Terminal x={PROPS.desk.x + 0.55} z={PROPS.desk.z} yaw={0} screen={PALETTE.cyan} />
        <WorldText position={[PROPS.desk.x, 2.05, PROPS.desk.z + 0.4]} fontSize={0.2} color="#f2b81f">
          TURBINE B · LOCAL
        </WorldText>
        {/* Crates and the red tool chest */}
        {PROPS.crates.map(([x, z], i) => (
          <mesh
            key={i}
            position={[x, i === 2 ? 1.3 : 0.45, z]}
            rotation={[0, i * 0.3, 0]}
            material={crate}
            castShadow
          >
            <boxGeometry args={[1.2, 0.9, 1.0]} />
          </mesh>
        ))}
        <mesh position={[12.9, 0.45, 10.4]} material={std({ color: '#d8352a', roughness: 0.5 })} castShadow>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
        </mesh>
        <Extinguisher x={-27.7} z={8.5} yaw={Math.PI / 2} />
      </Baked>

      <pointLight position={[-6, 8.5, 2]} color="#ffe2c0" intensity={70} distance={34} decay={1.1} />
      <pointLight position={[14, 8, 3]} color="#dfe9ff" intensity={45} distance={28} decay={1.2} />
      <Baked>
        {Array.from({ length: 9 }, (_, i) => -22.5 + i * 5.6).map((x) => (
          <GlowDecal key={x} x={x + 1.5} z={-7.5} radius={3.6} color="#ffb877" intensity={0.22} />
        ))}
        <GlowDecal x={-4} z={4} radius={8} color="#ffd8b0" intensity={0.16} />
        <GlowDecal x={12} z={6} radius={7} color="#d8e4ff" intensity={0.15} />
        <GlowDecal
          x={PROPS.desk.x}
          z={PROPS.desk.z + 1}
          radius={2.4}
          color={PALETTE.amber}
          intensity={0.22}
        />
      </Baked>
    </group>
  );
}
