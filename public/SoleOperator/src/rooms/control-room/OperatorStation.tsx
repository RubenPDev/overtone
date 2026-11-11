import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { simHost } from '../../game/runtime';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Baked } from '../../scene/Baked';
import { glow, std } from '../../scene/materials';
import { useMode } from '../../state/mode';
import { PALETTE } from '../../styles/palette';
import { STATION } from './index';
import { WallDisplay, drawCellMap, drawRods } from './WallDisplay';

/**
 * The Reactor Operator Station (after the console concept): a horseshoe desk
 * with glass touch surfaces, a curved wall of monitors under a status light
 * bar, annunciator towers, a bank of 12 rod drive levers that follow the real
 * rods, the master bank lever, and SCRAM under a flip guard. A holographic
 * core floats over the desk (see HoloCore).
 *
 * Local frame: origin where the Operator stands; local -z points at the core.
 */

const A0 = -1.25;
const A1 = 1.25;
const C = {
  cyan: PALETTE.cyan,
  amber: PALETTE.amber,
  red: '#ff4d4d',
  green: '#6dffb6',
  hazard: PALETTE.hazard,
};

/** Annular sector (angles from local -z), extruded upward. */
function sectorGeometry(r0: number, r1: number, a0: number, a1: number, h: number, y: number) {
  const s = new THREE.Shape();
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    if (i) s.lineTo(Math.sin(a) * r1, Math.cos(a) * r1);
    else s.moveTo(Math.sin(a) * r1, Math.cos(a) * r1);
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n;
    s.lineTo(Math.sin(a) * r0, Math.cos(a) * r0);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: n });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Arc (torus segment) at radius r between angles a0..a1 (from local -z), at height y. */
function arcGeometry(r: number, a0: number, a1: number, tube: number, y: number) {
  const t = new THREE.TorusGeometry(r, tube, 6, 48, a1 - a0);
  t.rotateX(Math.PI / 2);
  t.rotateY(Math.PI / 2 - a0);
  t.translate(0, y, 0);
  return t;
}

const polar = (a: number, r: number): [number, number] => [Math.sin(a) * r, -Math.cos(a) * r];

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function uiBg(g: CanvasRenderingContext2D, w: number, h: number) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#0b2230');
  gr.addColorStop(1, '#06121b');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(95,227,255,0.08)';
  for (let x = 0; x < w; x += 16) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
}

const trendTex = (color: string, seed: number) =>
  canvasTex(256, 150, (g) => {
    uiBg(g, 256, 150);
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      g.strokeStyle = k ? 'rgba(255,179,92,0.8)' : color;
      g.lineWidth = k ? 1.5 : 2.5;
      for (let x = 0; x <= 240; x += 4)
        g.lineTo(x + 8, 90 - Math.sin(x / 22 + seed + k) * 18 - Math.sin(x / 7 + seed) * 4 - k * 24);
      g.stroke();
    }
  });

const annunTex = () =>
  canvasTex(128, 256, (g) => {
    uiBg(g, 128, 256);
    let s = 3;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 3; x++) {
        const v = r();
        g.fillStyle =
          v > 0.93 ? 'rgba(255,77,77,0.85)' : v > 0.82 ? 'rgba(255,179,92,0.8)' : 'rgba(109,255,182,0.25)';
        g.fillRect(8 + x * 39, 16 + y * 26, 33, 20);
      }
  });

const deskUiTex = () =>
  canvasTex(512, 128, (g) => {
    g.fillStyle = '#071119';
    g.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 8; i++) {
      g.strokeStyle = 'rgba(95,227,255,0.55)';
      g.lineWidth = 2;
      g.strokeRect(12 + i * 62, 18, 50, 34);
      g.fillStyle = i % 3 ? 'rgba(95,227,255,0.2)' : 'rgba(255,179,92,0.3)';
      g.fillRect(15 + i * 62, 21, 44 * ((i * 37) % 10) * 0.1 + 6, 28);
    }
    g.strokeStyle = '#6dffb6';
    g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x < 512; x += 4) g.lineTo(x, 92 + Math.sin(x / 15) * 10 * Math.sin(x / 100));
    g.stroke();
  });

export function OperatorStation() {
  const selected = useMode((s) => (s.mode.kind === 'rods' ? (s.mode.bank ? -2 : s.mode.selected) : -1));

  const m = useMemo(() => {
    const deskUi = deskUiTex();
    const screen = (t: THREE.Texture) =>
      new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.2, 1.2, 1.2), toneMapped: false });
    return {
      gun: std({ color: '#1d242d', roughness: 0.45, metalness: 0.55 }),
      shell: std({ color: '#e6ebf0', roughness: 0.38, metalness: 0.2 }),
      face: std({ color: '#3a444f', roughness: 0.5, metalness: 0.4 }),
      seam: std({ color: '#20272f', roughness: 0.5, metalness: 0.5 }),
      panelDark: std({ color: '#11171e', roughness: 0.3, metalness: 0.6 }),
      glass: std({ color: '#0a1a24', roughness: 0.08, metalness: 0.6 }),
      trim: std({ color: PALETTE.trim, roughness: 0.5, metalness: 0.2 }),
      steelBright: std({ color: '#c9d2db', roughness: 0.25, metalness: 0.85 }),
      knob: std({ color: '#2b333c', roughness: 0.4, metalness: 0.5 }),
      hazard: std({ color: C.hazard, roughness: 0.45, metalness: 0.2 }),
      black: std({ color: '#15181c', roughness: 0.5 }),
      deskUi: screen(deskUi),
      trendA: screen(trendTex(C.cyan, 3)),
      trendB: screen(trendTex(C.amber, 2)),
      trendC: screen(trendTex(C.green, 1)),
      annun: screen(annunTex()),
      cyan: glow(C.cyan, 2.2),
      cyanSoft: glow(C.cyan, 1.5),
      amber: glow(C.amber, 1.6),
      amberHot: glow(C.amber, 3),
      green: glow(C.green, 1.8),
      red: glow(C.red, 2),
      guard: new THREE.MeshStandardMaterial({
        color: '#ffd6d6',
        roughness: 0.05,
        transparent: true,
        opacity: 0.35,
      }),
    };
  }, []);

  const geo = useMemo(
    () => ({
      cabinet: sectorGeometry(1.05, 1.95, A0, A1, 0.7, 0.06),
      face: sectorGeometry(1.04, 1.12, A0, A1, 0.66, 0.08),
      top: sectorGeometry(0.98, 2.0, A0, A1, 0.05, 0.76),
      glass: sectorGeometry(1.12, 1.62, A0 + 0.08, A1 - 0.08, 0.008, 0.815),
      uiL: sectorGeometry(1.18, 1.56, A0 + 0.1, -0.42, 0.004, 0.826),
      uiR: sectorGeometry(1.18, 1.56, 0.42, A1 - 0.1, 0.004, 0.826),
      riser: sectorGeometry(1.85, 2.05, A0, A1, 0.55, 0.81),
      lip: arcGeometry(0.985, A0, A1, 0.025, 0.79),
      kick: arcGeometry(1.07, A0, A1, 0.012, 0.03),
      edge: arcGeometry(1.95, A0, A1, 0.015, 0.83),
      bar: arcGeometry(2.18, -1.2, 1.2, 0.03, 2.74),
    }),
    [],
  );

  const monitors = [
    { a: -0.92, mat: m.annun, w: 0.62, h: 0.95, y: 1.75 },
    { a: -0.55, mat: m.trendA, w: 1.0, h: 0.6, y: 1.58 },
    { a: 0.55, mat: m.trendB, w: 1.0, h: 0.6, y: 1.58 },
    { a: 0.92, mat: m.annun, w: 0.62, h: 0.95, y: 1.75 },
    { a: -0.36, mat: m.trendC, w: 1.25, h: 0.62, y: 2.32 },
  ];

  return (
    <group position={[STATION.op.x, 0, STATION.op.z]} rotation={[0, STATION.yaw, 0]}>
      <group position={[0, 0.82, -1.22]}>
        <LeverBank selected={selected} steel={m.steelBright} knob={m.knob} />
      </group>
      <Baked>
        <mesh geometry={geo.cabinet} material={m.gun} castShadow receiveShadow />
        <mesh geometry={geo.face} material={m.face} />
        <mesh geometry={geo.top} material={m.shell} castShadow receiveShadow />
        <mesh geometry={geo.glass} material={m.glass} />
        <mesh geometry={geo.uiL} material={m.deskUi} />
        <mesh geometry={geo.uiR} material={m.deskUi} />
        <mesh geometry={geo.riser} material={m.gun} castShadow />
        <mesh geometry={geo.lip} material={m.trim} />
        <mesh geometry={geo.kick} material={m.cyan} />
        <mesh geometry={geo.edge} material={m.cyanSoft} />
        <mesh geometry={geo.bar} material={m.gun} />
        {/* Panel seams and LED slits on the Operator's side of the desk */}
        {Array.from({ length: 15 }, (_, i) => {
          const a = A0 + 0.05 + (i / 14) * (A1 - A0 - 0.1);
          const [x, z] = polar(a, 1.035);
          return (
            <group key={i} position={[x, 0, z]} rotation={[0, -a, 0]}>
              <mesh position={[0, 0.42, 0]} material={m.seam}>
                <boxGeometry args={[0.012, 0.6, 0.012]} />
              </mesh>
              {i % 2 === 1 && (
                <mesh position={[0.05, 0.62, 0]} material={i === 7 ? m.amberHot : m.cyan}>
                  <boxGeometry args={[0.1, 0.012, 0.01]} />
                </mesh>
              )}
            </group>
          );
        })}
        {/* Monitor wall: the two centre screens are live (rod positions, core map) */}
        {monitors.map((s, i) => {
          const r = s.y > 2 ? 2.12 : 1.98;
          const [x, z] = polar(s.a, r);
          return (
            <group key={i} position={[x, s.y, z]} rotation={[0, -s.a, 0]}>
              <group rotation={[s.y > 2 ? 0.18 : -0.08, 0, 0]}>
                <mesh material={m.panelDark}>
                  <boxGeometry args={[s.w + 0.06, s.h + 0.06, 0.05]} />
                </mesh>
                <mesh position={[0, 0, 0.027]} material={s.mat}>
                  <planeGeometry args={[s.w, s.h]} />
                </mesh>
                <mesh position={[0, -s.h / 2 - 0.035, 0.03]} material={m.cyanSoft}>
                  <boxGeometry args={[s.w * 0.9, 0.012, 0.012]} />
                </mesh>
              </group>
            </group>
          );
        })}
        {[
          { a: -0.18, draw: drawCellMap },
          { a: 0.18, draw: drawRods },
        ].map(({ a, draw }) => {
          const [x, z] = polar(a, 1.98);
          return (
            <group key={a} position={[x, 1.58, z]} rotation={[-0.08, -a, 0]}>
              <WallDisplay width={0.7} height={0.5} draw={draw} position={[0, 0, 0]} rotation={[0, 0, 0]} />
            </group>
          );
        })}
        {(() => {
          const [x, z] = polar(0.36, 2.12);
          return (
            <group position={[x, 2.32, z]} rotation={[0.18, -0.36, 0]}>
              <WallDisplay
                width={1.25}
                height={0.62}
                draw={drawRods}
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
              />
            </group>
          );
        })()}
        {/* Status light bar */}
        {Array.from({ length: 26 }, (_, i) => {
          const a = -1.15 + (i / 25) * 2.3;
          const [x, z] = polar(a, 2.18);
          return (
            <mesh
              key={i}
              position={[x, 2.78, z]}
              rotation={[0, -a, 0]}
              material={i === 13 ? m.amberHot : i % 9 === 4 ? m.green : m.cyanSoft}
            >
              <boxGeometry args={[0.14, 0.035, 0.035]} />
            </mesh>
          );
        })}
        {/* Annunciator towers at the back corners */}
        {[-1, 1].map((side) => {
          const a = side * 1.3;
          const [x, z] = polar(a, 2.3);
          return (
            <group key={side} position={[x, 0, z]} rotation={[0, -a, 0]}>
              <mesh position={[0, 1.15, 0]} material={m.gun} castShadow>
                <boxGeometry args={[0.55, 2.3, 0.45]} />
              </mesh>
              <mesh position={[0, 2.32, 0]} material={m.gun}>
                <boxGeometry args={[0.57, 0.05, 0.47]} />
              </mesh>
              <mesh position={[0, 2.31, 0.235]} material={m.trim}>
                <boxGeometry args={[0.58, 0.02, 0.02]} />
              </mesh>
              <mesh position={[0, 1.65, 0.231]} material={m.annun}>
                <planeGeometry args={[0.42, 0.95]} />
              </mesh>
              <mesh position={[0, 1.06, 0.235]} material={side < 0 ? m.green : m.amber}>
                <boxGeometry args={[0.4, 0.02, 0.02]} />
              </mesh>
              <mesh position={[0.27, 1.15, 0.2]} material={m.cyanSoft}>
                <boxGeometry args={[0.03, 2.1, 0.03]} />
              </mesh>
            </group>
          );
        })}
        {/* Rod drive lever bank plate (the levers themselves are live, below) */}
        <group position={[0, 0.82, -1.22]}>
          <mesh position={[0, 0.05, 0]} rotation={[-0.32, 0, 0]} material={m.panelDark}>
            <boxGeometry args={[1.25, 0.14, 0.34]} />
          </mesh>
          <mesh position={[0, 0.13, 0.15]} rotation={[-0.32, 0, 0]} material={m.amber}>
            <boxGeometry args={[1.27, 0.015, 0.02]} />
          </mesh>
        </group>
        {/* Master bank lever */}
        <group position={[0.82, 0.86, -1.2]} rotation={[-0.2, 0, 0]}>
          <mesh position={[0, -0.03, 0]} material={m.panelDark}>
            <boxGeometry args={[0.22, 0.06, 0.3]} />
          </mesh>
          <mesh position={[0, 0.13, 0]} material={m.steelBright}>
            <cylinderGeometry args={[0.014, 0.014, 0.28, 8]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} material={m.hazard}>
            <cylinderGeometry args={[0.03, 0.03, 0.12, 12]} />
          </mesh>
        </group>
        {/* SCRAM under a flip guard */}
        <group position={[-0.82, 0.83, -1.18]}>
          <mesh position={[0, 0.02, 0]} material={m.black}>
            <cylinderGeometry args={[0.11, 0.12, 0.05, 20]} />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.amber}>
            <torusGeometry args={[0.115, 0.012, 5, 28]} />
          </mesh>
          <mesh position={[0, 0.095, 0]} material={m.red}>
            <sphereGeometry args={[0.075, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <group position={[0, 0.05, -0.12]} rotation={[-1.15, 0, 0]}>
            <mesh position={[0, 0, 0.125]} material={m.guard}>
              <boxGeometry args={[0.26, 0.012, 0.25]} />
            </mesh>
          </group>
        </group>
        {/* Keyboards and a trackball */}
        <mesh position={[-0.38, 0.835, -1.42]} rotation={[0, 0.18, 0]} material={m.knob}>
          <boxGeometry args={[0.42, 0.018, 0.14]} />
        </mesh>
        <mesh position={[0.38, 0.835, -1.42]} rotation={[0, -0.18, 0]} material={m.knob}>
          <boxGeometry args={[0.42, 0.018, 0.14]} />
        </mesh>
        {/* Operator chair, pushed aside */}
        <group position={[-0.65, 0, 0.1]} rotation={[0, -0.7, 0]}>
          <mesh position={[0, 0.06, 0]} material={m.gun}>
            <cylinderGeometry args={[0.28, 0.28, 0.04, 5]} />
          </mesh>
          <mesh position={[0, 0.28, 0]} material={m.steelBright}>
            <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
          </mesh>
          <mesh position={[0, 0.5, 0]} material={m.knob} castShadow>
            <boxGeometry args={[0.5, 0.08, 0.48]} />
          </mesh>
          <mesh position={[0, 0.86, 0.23]} rotation={[-0.12, 0, 0]} material={m.knob} castShadow>
            <boxGeometry args={[0.48, 0.62, 0.07]} />
          </mesh>
        </group>
        {/* Hologram emitter in the desk */}
        <group position={[0, 0.82, -1.7]}>
          <mesh material={m.panelDark}>
            <cylinderGeometry args={[0.2, 0.24, 0.04, 28]} />
          </mesh>
          <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.cyan}>
            <torusGeometry args={[0.19, 0.01, 5, 40]} />
          </mesh>
        </group>
      </Baked>
    </group>
  );
}

/** The 12 rod drive levers and their lit collars, instanced; each leans with its rod's insertion. */
function LeverBank({
  selected,
  steel,
  knob,
}: {
  selected: number;
  steel: THREE.Material;
  knob: THREE.Material;
}) {
  const built = useMemo(() => {
    const collar = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const mk = (g: THREE.BufferGeometry, mat: THREE.Material) => {
      const im = new THREE.InstancedMesh(g, mat, 12);
      im.frustumCulled = false;
      return im;
    };
    const stems = mk(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), steel);
    const knobs = mk(new THREE.BoxGeometry(0.06, 0.022, 0.03), knob);
    const collars = mk(new THREE.TorusGeometry(0.022, 0.006, 5, 14), collar);
    const d = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      d.position.set(-0.55 + i * 0.1, 0.125, -0.02);
      d.rotation.set(Math.PI / 2 - 0.32, 0, 0);
      d.updateMatrix();
      collars.setMatrixAt(i, d.matrix);
    }
    return {
      stems,
      knobs,
      collars,
      d,
      off: new THREE.Matrix4(),
      m: new THREE.Matrix4(),
      c: new THREE.Color(),
    };
  }, [steel, knob]);
  useFrame(() => {
    const { stems, knobs, collars, d, off, m, c } = built;
    const rods = simHost.state.rods;
    for (let i = 0; i < 12; i++) {
      d.position.set(-0.55 + i * 0.1, 0.12, -0.02);
      d.rotation.set(-0.6 + (rods[i]?.insertion ?? 0) * 0.9, 0, 0);
      d.updateMatrix();
      stems.setMatrixAt(i, m.multiplyMatrices(d.matrix, off.makeTranslation(0, 0.08, 0)));
      knobs.setMatrixAt(i, m.multiplyMatrices(d.matrix, off.makeTranslation(0, 0.165, 0)));
      const on = selected === i || selected === -2;
      collars.setColorAt(i, c.set(on ? PALETTE.cyan : PALETTE.amber).multiplyScalar(on ? 2.2 : 1.6));
    }
    stems.instanceMatrix.needsUpdate = true;
    knobs.instanceMatrix.needsUpdate = true;
    if (collars.instanceColor) collars.instanceColor.needsUpdate = true;
  });
  return (
    <group>
      <primitive object={built.stems} />
      <primitive object={built.knobs} />
      <primitive object={built.collars} />
    </group>
  );
}

// --- Holographic core ---------------------------------------------------------------------------

const HR = 0.42; // vessel radius at walk scale
const HH = 0.55; // vessel height
const CELL_R = HR * 0.66;
const CELL_W = HR * 0.17;
const ROD_TOP = HH * 1.28;
const CELL_TOP = HH * 0.93;
const CELL_SPAN = HH * 0.86;
const BLUE = new THREE.Color('#3aa8ff');
const WARM = new THREE.Color('#ffb066');

function additive(
  color: THREE.ColorRepresentation,
  opacity: number,
  extra: THREE.MeshBasicMaterialParameters = {},
) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    ...extra,
  });
}

const cellAngle = (i: number) => (i / 12) * Math.PI * 2;

/**
 * Live holographic core over the operator desk: vessel, flux field, the 12 fuel
 * cells coloured by power, and every control rod at its real depth. In rod
 * control it swells into the working view and turns the selected rod toward
 * the camera. Repeated parts are instanced with per-instance colour, so the
 * whole hologram is about fifteen draw calls.
 */
export function HoloCore() {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const scan = useRef<THREE.Mesh>(null);
  const selEdges = useRef<THREE.LineSegments>(null);
  const mode = useMode((s) => s.mode);
  const focused = mode.kind === 'rods';
  const sel = mode.kind === 'rods' ? (mode.bank ? -2 : mode.selected) : -1;
  const st = useMemo(() => ({ scale: 1, lift: 0, psi: 0 }), []);

  const built = useMemo(() => {
    const tex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d')!);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const fluxT = tex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,220,140,1)');
      gr.addColorStop(0.35, 'rgba(255,120,60,0.7)');
      gr.addColorStop(0.7, 'rgba(60,170,255,0.35)');
      gr.addColorStop(1, 'rgba(60,170,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
    const coneT = tex(4, 64, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, 'rgba(95,227,255,0)');
      gr.addColorStop(1, 'rgba(95,227,255,1)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 64);
    });
    const line = (color: THREE.ColorRepresentation, k: number, opacity: number) =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(k),
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
    const mats = {
      edges: line(C.cyan, 1.6, 0.55),
      wire: line(C.cyan, 1.2, 0.12),
      cellEdges: line('#58b8ff', 1.4, 0.55),
      selEdges: line(C.cyan, 2.8, 1),
      shell: additive('#3fb8e6', 0.04),
      ring: glow(C.cyan, 2.4),
      flux: additive('#ffffff', 0.22, { map: fluxT }),
      fluxMid: additive('#ffffff', 0.35, { map: fluxT }),
      cone: additive(C.cyan, 0.12, { map: coneT }),
      cell: additive('#ffffff', 0.12),
      core: additive('#ffffff', 0.55),
      rod: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.2,
        metalness: 0.9,
        emissive: '#1b3a48',
        emissiveIntensity: 0.6,
      }),
      tip: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      head: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.6 }),
    };
    const at = (i: number): [number, number] => [
      Math.sin(cellAngle(i)) * CELL_R,
      Math.cos(cellAngle(i)) * CELL_R,
    ];

    // Static frame: vessel lines, rings and the tick ring merged.
    const vesselEdges = new THREE.EdgesGeometry(new THREE.CylinderGeometry(HR, HR, HH, 36, 6, true), 1);
    vesselEdges.translate(0, HH / 2, 0);
    const vesselWire = new THREE.WireframeGeometry(
      new THREE.CylinderGeometry(HR * 1.001, HR * 1.001, HH, 36, 10, true),
    );
    vesselWire.translate(0, HH / 2, 0);
    const rings = [0, HH].map((y) => {
      const t = new THREE.TorusGeometry(HR, HR * 0.012, 5, 56);
      t.rotateX(Math.PI / 2);
      t.translate(0, y, 0);
      return t;
    });
    const ticks = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      const l = i % 6 ? 0.06 : 0.14;
      const b = new THREE.BoxGeometry(HR * 0.008, HR * 0.004, HR * l);
      b.rotateY(a);
      b.translate(Math.sin(a) * HR * (1.18 + l / 2), 0, Math.cos(a) * HR * (1.18 + l / 2));
      return b;
    });
    const cellEdgeGeos = Array.from({ length: 12 }, (_, i) => {
      const e = new THREE.EdgesGeometry(new THREE.CylinderGeometry(CELL_W, CELL_W, CELL_SPAN, 6));
      e.rotateY(cellAngle(i));
      e.translate(at(i)[0], HH * 0.5, at(i)[1]);
      return e;
    });

    // Instanced parts.
    const d = new THREE.Object3D();
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, place: (i: number) => void) => {
      const im = new THREE.InstancedMesh(geo, mat, 12);
      for (let i = 0; i < 12; i++) {
        d.position.set(0, 0, 0);
        d.rotation.set(0, 0, 0);
        d.scale.set(1, 1, 1);
        place(i);
        d.updateMatrix();
        im.setMatrixAt(i, d.matrix);
        im.setColorAt(i, new THREE.Color('#ffffff'));
      }
      im.frustumCulled = false;
      return im;
    };
    const cells = inst(new THREE.CylinderGeometry(CELL_W, CELL_W, CELL_SPAN, 6, 1, true), mats.cell, (i) => {
      d.position.set(at(i)[0], HH * 0.5, at(i)[1]);
      d.rotation.y = cellAngle(i);
    });
    const cores = inst(
      new THREE.CylinderGeometry(CELL_W * 0.35, CELL_W * 0.35, HH * 0.8, 8),
      mats.core,
      (i) => d.position.set(at(i)[0], HH * 0.5, at(i)[1]),
    );
    const rodGeo = new THREE.CylinderGeometry(CELL_W * 0.42, CELL_W * 0.42, 1, 10);
    rodGeo.translate(0, -0.5, 0); // hangs down from its top
    const rods = inst(rodGeo, mats.rod, (i) => d.position.set(at(i)[0], ROD_TOP, at(i)[1]));
    const tips = inst(new THREE.SphereGeometry(CELL_W * 0.5, 8, 6), mats.tip, (i) =>
      d.position.set(at(i)[0], CELL_TOP, at(i)[1]),
    );
    const heads = inst(new THREE.BoxGeometry(CELL_W * 1.3, HH * 0.08, CELL_W * 1.3), mats.head, (i) => {
      d.position.set(at(i)[0], ROD_TOP + HH * 0.04, at(i)[1]);
      d.rotation.y = cellAngle(i);
    });

    return {
      mats,
      at,
      frame: {
        lines: new THREE.LineSegments(mergeGeometries([vesselEdges]), mats.edges),
        wire: new THREE.LineSegments(vesselWire, mats.wire),
        cellLines: new THREE.LineSegments(mergeGeometries(cellEdgeGeos), mats.cellEdges),
        rings: new THREE.Mesh(mergeGeometries(rings), mats.ring),
        ticks: new THREE.Mesh(mergeGeometries(ticks), mats.ring),
      },
      selEdgeGeo: new THREE.EdgesGeometry(
        new THREE.CylinderGeometry(CELL_W * 1.08, CELL_W * 1.08, CELL_SPAN, 6),
      ),
      cells,
      cores,
      rods,
      tips,
      heads,
      tmp: {
        m: new THREE.Matrix4(),
        c: new THREE.Color(),
        p: new THREE.Vector3(),
        q: new THREE.Quaternion(),
        s: new THREE.Vector3(1, 1, 1),
      },
    };
  }, []);

  useFrame((s, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const sim = simHost.state;
    // Grow and rise in rod control; spin slowly otherwise, or turn the selected rod to the camera.
    const k = 1 - Math.exp(-dt * 3);
    st.scale += ((focused ? 3.2 : 1) - st.scale) * k;
    st.lift += ((focused ? 0.32 : 0) - st.lift) * k;
    if (root.current) {
      root.current.scale.setScalar(st.scale);
      root.current.position.y = 0.86 + st.lift;
    }
    if (focused && sel >= 0) {
      const target = Math.PI / 4 - cellAngle(sel);
      const dd = Math.atan2(Math.sin(target - st.psi), Math.cos(target - st.psi));
      st.psi += dd * (1 - Math.exp(-dt * 4));
    } else st.psi += dt * 0.15;
    if (spin.current) spin.current.rotation.y = st.psi;
    if (scan.current) scan.current.position.y = HH * (0.5 + 0.42 * Math.sin(s.clock.elapsedTime * 0.9));
    if (selEdges.current) {
      selEdges.current.visible = sel >= 0;
      if (sel >= 0) {
        const [x, z] = built.at(sel);
        selEdges.current.position.set(x, HH * 0.5, z);
        selEdges.current.rotation.y = cellAngle(sel);
      }
    }

    const { m, c, p, q, s: sc } = built.tmp;
    const avg = sim.cells.reduce((a, cl) => a + cl.power, 0) / 12 || 1;
    for (let i = 0; i < 12; i++) {
      const on = sel === i || sel === -2;
      const ins = sim.rods[i]?.insertion ?? 0;
      const tip = CELL_TOP - ins * CELL_SPAN;
      const [x, z] = built.at(i);
      p.set(x, ROD_TOP, z);
      sc.set(1, Math.max(0.001, ROD_TOP - tip), 1);
      m.compose(p, q.identity(), sc);
      built.rods.setMatrixAt(i, m);
      built.rods.setColorAt(i, c.set(on ? '#dffcff' : '#c9d4de').multiplyScalar(on ? 1.8 : 1));
      p.set(x, tip, z);
      sc.set(1, 1, 1);
      m.compose(p, q, sc);
      built.tips.setMatrixAt(i, m);
      built.tips.setColorAt(i, c.set(on ? C.cyan : C.amber).multiplyScalar(on ? 4 : 2.6));
      built.heads.setColorAt(i, c.set(on ? C.cyan : '#36414d').multiplyScalar(on ? 1.8 : 1));
      const cell = sim.cells[i];
      const pw = cell?.loaded ? Math.min(1, cell.power / (avg * 1.4)) : 0;
      // Additive: the colour's brightness is its opacity.
      built.cells.setColorAt(
        i,
        c
          .copy(BLUE)
          .lerp(WARM, pw)
          .multiplyScalar(on ? 1.8 : 1),
      );
      built.cores.setColorAt(
        i,
        c
          .copy(BLUE)
          .lerp(WARM, pw)
          .multiplyScalar(cell?.loaded ? 0.45 + pw * 0.45 : 0.05),
      );
    }
    for (const im of [built.rods, built.tips, built.heads, built.cells, built.cores]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group position={[STATION.holo.x, 0, STATION.holo.z]}>
      <mesh position={[0, 1.0, 0]} material={built.mats.cone}>
        <cylinderGeometry args={[0.36, 0.17, 0.3, 32, 1, true]} />
      </mesh>
      <group ref={root} position={[0, 0.86, 0]}>
        <group ref={spin} position={[0, 0.18, 0]}>
          <primitive object={built.frame.lines} />
          <primitive object={built.frame.wire} />
          <primitive object={built.frame.cellLines} />
          <primitive object={built.frame.rings} />
          <primitive object={built.frame.ticks} />
          <mesh position={[0, HH / 2, 0]} material={built.mats.shell}>
            <cylinderGeometry args={[HR, HR, HH, 40, 1, true]} />
          </mesh>
          {[0.25, 0.5, 0.75].map((f) => (
            <mesh
              key={f}
              position={[0, HH * f, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              material={f === 0.5 ? built.mats.fluxMid : built.mats.flux}
            >
              <circleGeometry args={[HR * 0.95, 40]} />
            </mesh>
          ))}
          <primitive object={built.cells} />
          <primitive object={built.cores} />
          <primitive object={built.rods} />
          <primitive object={built.tips} />
          <primitive object={built.heads} />
          <lineSegments
            ref={selEdges}
            geometry={built.selEdgeGeo}
            material={built.mats.selEdges}
            visible={false}
          />
          <mesh ref={scan} rotation={[Math.PI / 2, 0, 0]} material={built.mats.ring}>
            <torusGeometry args={[HR * 1.04, HR * 0.008, 5, 56]} />
          </mesh>
          {focused &&
            Array.from({ length: 12 }, (_, i) => {
              const [x, z] = built.at(i);
              return (
                <Html
                  key={i}
                  position={[x, ROD_TOP + HH * 0.18, z]}
                  center
                  zIndexRange={[2, 0]}
                  pointerEvents="none"
                >
                  <div className={`holo-tag${sel === i || sel === -2 ? ' is-sel' : ''}`}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                </Html>
              );
            })}
        </group>
      </group>
    </group>
  );
}
