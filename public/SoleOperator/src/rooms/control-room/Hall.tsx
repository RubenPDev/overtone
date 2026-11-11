import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { player } from '../../game/runtime';
import { glow, std } from '../../scene/materials';
import { PALETTE } from '../../styles/palette';
import {
  DESKS,
  GALLERY_DEPTH,
  GALLERY_Y,
  HALL,
  INNER_R,
  LANE_HALF,
  LOOP_ANGLES,
  LOOP_R,
  OUTER_R,
  RAIL_R,
  STAFF_DESK_ANGLES,
} from './index';

/**
 * The core hall around the reactor: the control rod drive stack rising out of
 * the tank, coolant loops, cables to the galleries, the console rings with
 * their crew, the tiered galleries on the back walls and the railing ring.
 * Repeated parts are instanced (one draw call per kind) and the long runs of
 * tube are merged, so the hall stays cheap despite its size.
 */

const CORE_ORANGE = '#ff8a2a';

// Deterministic jitter so the hall looks the same every visit.
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

interface Inst {
  p: [number, number, number];
  s: [number, number, number];
  ry?: number;
  rx?: number;
}

/** One InstancedMesh of unit boxes (or a given geometry) placed by a list. */
function instanced(list: Inst[], material: THREE.Material, geometry: THREE.BufferGeometry = UNIT_BOX) {
  const im = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length));
  im.count = list.length;
  const d = new THREE.Object3D();
  list.forEach((b, i) => {
    d.position.set(...b.p);
    d.rotation.set(b.rx ?? 0, b.ry ?? 0, 0);
    d.scale.set(...b.s);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

// --- Drive stack ---------------------------------------------------------------------------------

export const TIERS = [
  { y: 9.2, h: 2.6, r: 5.4 },
  { y: 12.0, h: 2.2, r: 4.6 },
  { y: 14.4, h: 3.0, r: 5.8 },
  { y: 17.6, h: 2.2, r: 4.4 },
  { y: 20.0, h: 2.8, r: 3.8 },
  { y: 23.0, h: 2.4, r: 3.1 },
  { y: 25.6, h: 4.0, r: 2.4 },
];

/**
 * Drive stack, coolant loops and cables. When the Operator walks behind the
 * stack (from the camera's point of view) it fades to a ghost, so the tower
 * never hides the player.
 */
export function CoreStack() {
  const built = useMemo(() => {
    const r = rng(17);
    const mats = {
      steel: new THREE.MeshStandardMaterial({ color: '#5d6874', roughness: 0.42, metalness: 0.75 }),
      dark: new THREE.MeshStandardMaterial({ color: '#20272f', roughness: 0.55, metalness: 0.6 }),
      darker: new THREE.MeshStandardMaterial({ color: '#151a20', roughness: 0.6, metalness: 0.5 }),
      rail: new THREE.MeshStandardMaterial({ color: PALETTE.gantry, roughness: 0.45, metalness: 0.4 }),
      band: new THREE.MeshBasicMaterial({
        color: new THREE.Color(CORE_ORANGE).multiplyScalar(2.2),
        toneMapped: false,
      }),
      lamp: new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.amber).multiplyScalar(2.3),
        toneMapped: false,
      }),
      cable: new THREE.MeshStandardMaterial({ color: '#11161b', roughness: 0.8, metalness: 0.2 }),
    };
    const group = new THREE.Group();
    // Solid parts are collected per material and merged: one draw call per material.
    const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const mesh = (
      g: THREE.BufferGeometry,
      m: THREE.Material,
      p: [number, number, number] = [0, 0, 0],
      rotX = 0,
    ) => {
      if (rotX) g.rotateX(rotX);
      g.translate(...p);
      const list = parts.get(m) ?? [];
      list.push(g.index ? g.toNonIndexed() : g);
      parts.set(m, list);
    };
    const modules: Inst[] = [];
    const greebles: Inst[] = [];
    const lamps: Inst[] = [];
    const posts: Inst[] = [];
    for (const [ti, t] of TIERS.entries()) {
      mesh(new THREE.CylinderGeometry(t.r, t.r * 1.04, t.h, 48), ti % 2 ? mats.steel : mats.dark, [
        0,
        t.y + t.h / 2,
        0,
      ]);
      mesh(new THREE.CylinderGeometry(t.r + 0.06, t.r + 0.06, 0.2, 48), mats.band, [0, t.y + t.h * 0.3, 0]);
      mesh(new THREE.CylinderGeometry(t.r + 0.9, t.r + 0.9, 0.16, 48), mats.darker, [0, t.y, 0]);
      mesh(new THREE.TorusGeometry(t.r + 0.9, 0.045, 5, 64), mats.rail, [0, t.y + 1.05, 0], Math.PI / 2);
      const n = Math.round(t.r * 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const ry = -a + Math.PI / 2;
        const ring = (rr: number): [number, number] => [Math.cos(a) * rr, Math.sin(a) * rr];
        const [x, z] = ring(t.r + 0.32);
        if (i % 3 === 0) modules.push({ p: [x, t.y + t.h * 0.55, z], s: [1.2, t.h * 0.7, 0.6], ry });
        else
          greebles.push({
            p: [x, t.y + t.h * (0.3 + r() * 0.5), z],
            s: [0.3 + r() * 0.5, 0.2 + r() * 0.7, 0.36],
            ry,
          });
        if (i % 3 === 0 && r() > 0.3) {
          const [lx, lz] = ring(t.r + 0.63);
          lamps.push({ p: [lx, t.y + t.h * 0.62, lz], s: [0.46, 0.16, 0.04], ry });
        }
        if (i % 2 === 0) {
          const [px, pz] = ring(t.r + 0.9);
          posts.push({ p: [px, t.y + 0.55, pz], s: [0.06, 1.1, 0.06] });
        }
      }
    }
    group.add(
      instanced(modules, mats.steel),
      instanced(greebles, mats.dark),
      instanced(posts, mats.rail),
      instanced(lamps, mats.lamp),
    );
    // Crown: drive mechanism stack and the cable head.
    mesh(new THREE.CylinderGeometry(1.4, 2.2, 4.4, 32), mats.steel, [0, 31.8, 0]);
    mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.5, 32), mats.dark, [0, 34.2, 0]);
    mesh(new THREE.CylinderGeometry(2.62, 2.62, 0.12, 32), mats.band, [0, 33.9, 0]);
    // Collar where the stack meets the drive ring above the tank.
    mesh(new THREE.CylinderGeometry(3.6, 4.4, 0.8, 48), mats.dark, [0, 8.85, 0]);

    // Coolant loops: from floor pedestals up and over into the stack, with glowing collars.
    const loopGeos: THREE.BufferGeometry[] = [];
    const collars: Inst[] = [];
    const pedestals: Inst[] = [];
    for (const a of LOOP_ANGLES) {
      const d = (rr: number, y: number) => new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
      const curve = new THREE.CatmullRomCurve3([
        d(LOOP_R, 0.9),
        d(LOOP_R + 0.8, 4.5),
        d(LOOP_R - 0.2, 8.6),
        d(6.8, 11.4),
        d(4.8, 12.8),
      ]);
      loopGeos.push(new THREE.TubeGeometry(curve, 36, 0.55, 12));
      for (const t of [0.2, 0.45, 0.7]) {
        const p = curve.getPointAt(t);
        const q = new THREE.Object3D();
        q.position.copy(p);
        q.lookAt(curve.getPointAt(t + 0.02));
        collars.push({ p: [p.x, p.y, p.z], s: [1, 1, 1], ry: q.rotation.y, rx: q.rotation.x });
      }
      const pp = d(LOOP_R, 0);
      pedestals.push({ p: [pp.x, 0.5, pp.z], s: [2.0, 1.0, 2.0], ry: -a });
    }
    const loops = new THREE.Mesh(mergeGeometries(loopGeos), mats.steel);
    group.add(loops);
    group.add(instanced(collars, mats.band, new THREE.TorusGeometry(0.68, 0.08, 6, 18)));
    group.add(instanced(pedestals, mats.dark));

    // Cables from the stack out to the back walls, sagging under their weight.
    const cableGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 34; i++) {
      const a = Math.PI * (0.62 + r() * 0.9); // toward the back walls (−x / −z)
      const t = TIERS[2 + Math.floor(r() * 4)]!;
      const p0 = new THREE.Vector3(Math.cos(a) * t.r, t.y + r() * t.h, Math.sin(a) * t.r);
      const dir = new THREE.Vector2(Math.cos(a), Math.sin(a));
      const reach = Math.min(dir.x < 0 ? (HALL - 0.3) / -dir.x : 99, dir.y < 0 ? (HALL - 0.3) / -dir.y : 99);
      const p2 = new THREE.Vector3(dir.x * reach, 14 + r() * 13, dir.y * reach);
      const mid = p0.clone().lerp(p2, 0.5);
      mid.y = Math.min(p0.y, p2.y) - 4 - r() * 6;
      cableGeos.push(
        new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p2), 24, 0.08 + r() * 0.12, 5),
      );
    }
    group.add(new THREE.Mesh(mergeGeometries(cableGeos), mats.cable));

    for (const [mat, list] of parts) group.add(new THREE.Mesh(mergeGeometries(list), mat));
    const fadeable = Object.values(mats);
    return { group, fadeable };
  }, []);

  const fade = useMemo(() => ({ v: 1 }), []);
  useFrame((_, dt) => {
    // "Behind" = further from the camera than the core and within the stack's screen width.
    const p = player.pos;
    const behind = p.x + p.z < -2 && Math.abs(p.x - p.z) < 15;
    const target = behind ? 0.16 : 1;
    if (Math.abs(fade.v - target) < 0.002) return;
    fade.v += (target - fade.v) * (1 - Math.exp(-dt * 6));
    const solid = fade.v > 0.98;
    for (const m of built.fadeable) {
      if (m.transparent === solid) {
        m.transparent = !solid;
        m.depthWrite = solid;
        m.needsUpdate = true;
      }
      m.opacity = solid ? 1 : fade.v;
    }
  });

  return <primitive object={built.group} />;
}

// --- Console rings ---------------------------------------------------------------------------------

function screenTexture(kind: number) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 80);
  gr.addColorStop(0, '#0b2a3a');
  gr.addColorStop(1, '#061520');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 80);
  g.strokeStyle = 'rgba(95,227,255,.9)';
  g.lineWidth = 2;
  if (kind === 0) {
    g.beginPath();
    g.arc(64, 40, 24, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle = i === 6 ? '#ffb35c' : 'rgba(95,227,255,.7)';
      g.fillRect(64 + Math.cos(a) * 32 - 2, 40 + Math.sin(a) * 32 - 2, 4, 4);
    }
  } else if (kind === 1) {
    g.beginPath();
    for (let x = 0; x < 128; x += 3) g.lineTo(x, 40 + Math.sin(x / 9) * 12 * Math.sin(x / 35));
    g.stroke();
    g.strokeStyle = 'rgba(109,255,182,.8)';
    g.beginPath();
    for (let x = 0; x < 128; x += 3) g.lineTo(x, 62 - x * 0.12);
    g.stroke();
  } else {
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i === 5 ? '#ffb35c' : 'rgba(95,227,255,.8)';
      const h = 14 + ((i * 37) % 44);
      g.fillRect(8 + i * 13, 72 - h, 8, h);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Desks, screens and seated crew round both rings: a handful of instanced draw calls. */
export function ConsoleRings() {
  const group = useMemo(() => {
    const r = rng(5);
    const g = new THREE.Group();
    const body: Inst[] = [];
    const top: Inst[] = [];
    const backs: Inst[] = [];
    const scr: Inst[][] = [[], [], []];
    const coat: Inst[] = [];
    const legs: Inst[] = [];
    const heads: Inst[] = [];
    const chairs: Inst[] = [];
    const strip: Inst[] = [];
    for (const [k, d] of DESKS.entries()) {
      const R = d.ring === 'inner' ? INNER_R : OUTER_R;
      const ry = d.yaw; // local -z → core
      const out = (dr: number, side = 0) => {
        const x = Math.cos(d.angle) * (R + dr) - Math.sin(d.angle) * side;
        const z = Math.sin(d.angle) * (R + dr) + Math.cos(d.angle) * side;
        return [x, z] as const;
      };
      const [bx, bz] = out(0.25);
      body.push({ p: [bx, 0.42, bz], s: [1.85, 0.84, 0.8], ry });
      const [tx, tz] = out(0.25);
      top.push({ p: [tx, 0.86, tz], s: [1.95, 0.05, 0.95], ry });
      const [lx, lz] = out(0.68);
      strip.push({ p: [lx, 0.05, lz], s: [1.7, 0.03, 0.03], ry });
      for (let s = -1; s <= 1; s++) {
        const [sx, sz] = out(-0.05, s * 0.6);
        backs.push({ p: [sx, 1.3, sz], s: [0.56, 0.38, 0.04], ry });
        const [px, pz] = out(-0.02, s * 0.6);
        scr[(k + s + 3) % 3]!.push({ p: [px, 1.3, pz], s: [0.5, 0.33, 1], ry });
      }
      const staffed = STAFF_DESK_ANGLES.some((a) => Math.abs(a - d.angle) < 1e-6);
      const [cx, cz] = out(1.05);
      if (staffed) continue;
      if (r() > 0.42) {
        coat.push({ p: [cx, 1.05, cz], s: [0.48, 0.62, 0.32], ry });
        legs.push({ p: [cx, 0.42, cz], s: [0.36, 0.5, 0.5], ry });
        heads.push({ p: [cx, 1.55, cz], s: [0.24, 0.27, 0.24], ry });
      }
      chairs.push({ p: [cx, 0.5, cz + 0], s: [0.5, 0.08, 0.5], ry });
    }
    const screenMats = [0, 1, 2].map(
      (k) =>
        new THREE.MeshBasicMaterial({
          map: screenTexture(k),
          color: new THREE.Color(1.35, 1.35, 1.35),
          toneMapped: false,
        }),
    );
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateY(Math.PI); // screens face away from the core, toward their crew
    g.add(
      instanced(body, std({ color: '#2b333c', roughness: 0.5, metalness: 0.5 })),
      instanced(top, std({ color: '#c9d1d9', roughness: 0.4, metalness: 0.2 })),
      instanced(backs, std({ color: '#151a20', roughness: 0.5, metalness: 0.5 })),
      instanced(strip, glow(PALETTE.cyan, 1.4)),
      instanced(chairs, std({ color: '#262d35', roughness: 0.7 })),
      instanced(coat, std({ color: '#e8ecef', roughness: 0.7, metalness: 0.05 })),
      instanced(legs, std({ color: '#2c3440', roughness: 0.8, metalness: 0.1 })),
      instanced(heads, std({ color: '#c4936c', roughness: 0.8, metalness: 0.05 })),
      ...scr.map((list, k) => instanced(list, screenMats[k]!, plane)),
    );
    for (const m of g.children as THREE.Mesh[]) m.receiveShadow = true;
    (g.children[0] as THREE.Mesh).castShadow = true; // desk bodies
    return g;
  }, []);
  return <primitive object={group} />;
}

// --- Railing ring and floor marks -------------------------------------------------------------------

/** Yellow railing round the core floor, with gaps where the lanes come in. */
export function RailRing() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const gap = Math.asin((LANE_HALF + 0.4) / RAIL_R);
    const posts: Inst[] = [];
    const arcs: THREE.BufferGeometry[] = [];
    for (let q = 0; q < 4; q++) {
      const a0 = (q * Math.PI) / 2 + gap;
      const a1 = ((q + 1) * Math.PI) / 2 - gap;
      for (const y of [0.6, 1.1]) {
        const t = new THREE.TorusGeometry(RAIL_R, 0.04, 5, 48, a1 - a0);
        t.rotateX(Math.PI / 2);
        t.rotateY(-a0);
        t.translate(0, y, 0);
        arcs.push(t);
      }
      const n = Math.floor(((a1 - a0) * RAIL_R) / 1.6);
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        posts.push({ p: [Math.cos(a) * RAIL_R, 0.55, Math.sin(a) * RAIL_R], s: [0.07, 1.1, 0.07] });
      }
      // glowing kerb under the rail
      const k = new THREE.TorusGeometry(RAIL_R, 0.03, 4, 48, a1 - a0);
      k.rotateX(Math.PI / 2);
      k.rotateY(-a0);
      k.translate(0, 0.03, 0);
      g.add(new THREE.Mesh(k, glow(PALETTE.amber, 1.6)));
    }
    const railMat = std({ color: PALETTE.gantry, roughness: 0.45, metalness: 0.4 });
    g.add(new THREE.Mesh(mergeGeometries(arcs), railMat), instanced(posts, railMat));
    // Faint cyan ring between the console rings (the walkway).
    const walk = new THREE.Mesh(
      new THREE.RingGeometry((INNER_R + OUTER_R) / 2 - 0.04, (INNER_R + OUTER_R) / 2 + 0.04, 128),
      glow(PALETTE.cyan, 0.7),
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.y = 0.012;
    g.add(walk);
    return g;
  }, []);
  return <primitive object={group} />;
}

// --- Galleries -------------------------------------------------------------------------------------

/**
 * Tiered galleries on the two back walls (the front walls are cut away for the
 * camera): floors, railings, light strips, columns, lit windows and doors,
 * and a few crew at consoles up on the first two levels.
 */
export function Galleries() {
  const group = useMemo(() => {
    const r = rng(29);
    const g = new THREE.Group();
    const floors: Inst[] = [];
    const posts: Inst[] = [];
    const rails: Inst[] = [];
    const strips: Inst[] = [];
    const winCool: Inst[] = [];
    const winWarm: Inst[] = [];
    const cols: Inst[] = [];
    const desks: Inst[] = [];
    const crew: Inst[] = [];
    const D = GALLERY_DEPTH;
    // Each wall described by: along-axis, fixed coord, and a function placing (u, depth offset).
    const walls = [
      { put: (u: number, d: number): [number, number] => [u, -HALL + d], ry: 0, from: -HALL, to: HALL },
      {
        put: (u: number, d: number): [number, number] => [-HALL + d, u],
        ry: Math.PI / 2,
        from: -HALL + D,
        to: HALL,
      },
    ];
    for (const w of walls) {
      const len = w.to - w.from;
      const mid = (w.from + w.to) / 2;
      for (const [lv, y] of GALLERY_Y.entries()) {
        const [fx, fz] = w.put(mid, D / 2);
        floors.push({ p: [fx, y - 0.18, fz], s: [len, 0.36, D], ry: w.ry });
        const [rx, rz] = w.put(mid, D - 0.05);
        rails.push({ p: [rx, y + 1.05, rz], s: [len, 0.06, 0.06], ry: w.ry });
        rails.push({ p: [rx, y + 0.55, rz], s: [len, 0.05, 0.05], ry: w.ry });
        const [sx, sz] = w.put(mid, D + 0.01);
        strips.push({ p: [sx, y - 0.3, sz], s: [len, 0.08, 0.04], ry: w.ry });
        for (let u = w.from + 0.8; u < w.to; u += 1.6) {
          const [px, pz] = w.put(u, D - 0.05);
          posts.push({ p: [px, y + 0.55, pz], s: [0.06, 1.1, 0.06], ry: w.ry });
        }
        for (let u = w.from + 1.5; u < w.to - 1; u += 3) {
          if (r() < 0.25) continue;
          const [wx, wz] = w.put(u, 0.03);
          (r() > 0.68 ? winWarm : winCool).push({
            p: [wx, y + 1.7, wz],
            s: [1.6, 2.2 + r() * 0.8, 0.04],
            ry: w.ry,
          });
        }
        if (lv < 2)
          for (let u = w.from + 4; u < w.to - 3; u += 4.5 + r() * 3) {
            const [dx, dz] = w.put(u, 1.0);
            desks.push({ p: [dx, y + 0.45, dz], s: [1.6, 0.9, 0.7], ry: w.ry });
            if (r() > 0.4) {
              const [cx, cz] = w.put(u, 1.9);
              crew.push({ p: [cx, y + 0.9, cz], s: [0.45, 1.6, 0.3], ry: w.ry });
            }
          }
      }
      for (let u = w.from + 3.75; u < w.to; u += 7.5) {
        const [cx, cz] = w.put(u, D - 0.3);
        cols.push({ p: [cx, 13.5, cz], s: [0.55, 27, 0.55], ry: w.ry });
      }
    }
    g.add(
      instanced(floors, std({ color: '#2a323c', roughness: 0.6, metalness: 0.5 })),
      instanced(posts, std({ color: PALETTE.gantry, roughness: 0.45, metalness: 0.4 })),
      instanced(rails, std({ color: PALETTE.gantry, roughness: 0.45, metalness: 0.4 })),
      instanced(strips, glow('#cfe6ff', 1.5)),
      instanced(winCool, glow('#8fb6d8', 1.0)),
      instanced(winWarm, glow('#ffc890', 1.3)),
      instanced(cols, std({ color: '#3a444f', roughness: 0.5, metalness: 0.5 })),
      instanced(desks, std({ color: '#3a444f', roughness: 0.5, metalness: 0.4 })),
      instanced(crew, std({ color: '#e8ecef', roughness: 0.7, metalness: 0.05 })),
    );
    return g;
  }, []);
  return <primitive object={group} />;
}

// --- Front walls: instrument cabinet banks ----------------------------------------------------------

/** Cabinet runs along the two front walls (lanes kept clear), with racks of status LEDs that blink. */
export function FrontBanks() {
  const built = useMemo(() => {
    const r = rng(41);
    const g = new THREE.Group();
    const cab: Inst[] = [];
    const trims: Inst[] = [];
    const leds: Inst[][] = [[], [], []];
    const trays: Inst[] = [];
    const vents: Inst[] = [];
    const tops: Inst[] = [];
    const lamps: Inst[] = [];
    const grates: Inst[] = [];
    const depth = 0.7;
    const at = HALL - 0.2 - depth / 2;
    for (const wall of ['+x', '+z'] as const) {
      for (let u = -HALL + 2.6; u < HALL - 2.6; u += 1.05) {
        if (Math.abs(u) < LANE_HALF + 1.2) continue;
        const [x, z] = wall === '+x' ? [at, u] : [u, at];
        const ry = wall === '+x' ? -Math.PI / 2 : Math.PI; // fronts face the hall
        cab.push({ p: [x, 1.1, z], s: [1.0, 2.2, depth], ry });
        const fx = wall === '+x' ? at - depth / 2 - 0.01 : u;
        const fz = wall === '+x' ? u : at - depth / 2 - 0.01;
        trims.push({ p: [fx, 2.05, fz], s: [0.96, 0.05, 0.02], ry });
        // The camera sees backs and tops: vents, a status strip, the odd lamp.
        const bx = wall === '+x' ? at + depth / 2 + 0.01 : u;
        const bz = wall === '+x' ? u : at + depth / 2 + 0.01;
        vents.push({ p: [bx, 1.35, bz], s: [0.7, 0.9, 0.02], ry });
        tops.push({ p: [x, 2.21, z], s: [0.9, 0.02, 0.08], ry });
        if (r() > 0.7) lamps.push({ p: [x, 2.3, z], s: [0.12, 0.14, 0.12] });
        for (let k = 0; k < 6; k++)
          if (r() > 0.25) {
            const lx = wall === '+x' ? fx : fx - 0.3 + r() * 0.6;
            const lz = wall === '+x' ? fz - 0.3 + r() * 0.6 : fz;
            leds[r() > 0.86 ? 1 : r() > 0.7 ? 2 : 0]!.push({
              p: [lx, 0.6 + k * 0.22, lz],
              s: [0.12, 0.03, 0.02],
              ry,
            });
          }
      }
      for (let u = -HALL + 3; u < HALL - 3; u += 2.4) {
        if (Math.abs(u) < LANE_HALF + 1) continue;
        const gr = HALL - 4.2;
        grates.push({
          p: wall === '+x' ? [gr, 0.008, u] : [u, 0.008, gr],
          s: wall === '+x' ? [1.4, 0.01, 2.0] : [2.0, 0.01, 1.4],
        });
      }
      const [tx, tz] = wall === '+x' ? [at, 0] : [0, at];
      trays.push({
        p: [tx, 2.6, tz],
        s: wall === '+x' ? [0.5, 0.08, HALL * 2 - 4] : [HALL * 2 - 4, 0.08, 0.5],
      });
    }
    const ledMats = [glow(PALETTE.player, 1.8), glow('#ff4d4d', 2.2), glow(PALETTE.amber, 2)];
    g.add(
      instanced(cab, std({ color: '#262e37', roughness: 0.5, metalness: 0.5 })),
      instanced(trims, glow(PALETTE.cyan, 1.2)),
      instanced(trays, std({ color: '#8e9aa6', roughness: 0.4, metalness: 0.7 })),
      instanced(vents, std({ color: '#4a5562', roughness: 0.6, metalness: 0.5 })),
      instanced(tops, glow(PALETTE.cyan, 1.3)),
      instanced(lamps, glow(PALETTE.amber, 2.2)),
      instanced(grates, std({ color: '#1b2128', roughness: 0.85, metalness: 0.4 })),
      ...leds.map((l, i) => instanced(l, ledMats[i]!)),
    );
    for (const m of g.children as THREE.Mesh[]) m.receiveShadow = true;
    return { g, ledMats };
  }, []);
  // A slow shimmer on the LED racks: three phases, cheap (material colour only).
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    built.ledMats.forEach((m, i) => {
      const base = [PALETTE.player, '#ff4d4d', PALETTE.amber][i]!;
      m.color.set(base).multiplyScalar(1.4 + 0.8 * Math.max(0, Math.sin(t * (1.3 + i) + i * 2)));
    });
  });
  return <primitive object={built.g} />;
}
