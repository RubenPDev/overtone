import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { simHost } from '../game/runtime';
import { MAX_FIELD } from '../sim';
import { PALETTE } from '../styles/palette';
import { glow, std } from './materials';

/**
 * The accelerator beamline, built along local +x from x0 to x1 at (y, z).
 * Superconducting magnet string: blue dipoles with chrome flanges and cyan
 * interconnect rings, orange quadrupoles, stands, a chrome beam pipe, a cryo
 * line, and the beam itself glowing with the circulating current.
 *
 * Every repeated part is one InstancedMesh, so a 425 m tunnel is ~12 draw calls.
 */
const UNIT = 9;
const DIPOLE = 5.2;
const QUAD = 1.3;

const X_AXIS_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

interface Part {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  mats: THREE.Matrix4[];
  shadow?: boolean;
}

function along(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), X_AXIS_Q, new THREE.Vector3(sx, sy, sz));
}

function InstancedPart({ part }: { part: Part }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    part.mats.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [part]);
  if (!part.mats.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[part.geo, part.mat, part.mats.length]}
      castShadow={part.shadow}
      receiveShadow
    />
  );
}

export function Beamline({
  x0,
  x1,
  y = 1.25,
  z = 0,
  skip = [],
}: {
  x0: number;
  x1: number;
  y?: number;
  z?: number;
  skip?: [number, number][];
}) {
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const parts = useMemo(() => {
    const blocked = (x: number) => skip.some(([a, b]) => x > a - 1 && x < b + 1);
    const p: Record<string, Part> = {
      dipole: {
        geo: new THREE.CylinderGeometry(0.55, 0.55, 1, 28),
        mat: std({ color: '#2f6fd0', roughness: 0.28, metalness: 0.45 }),
        mats: [],
        shadow: true,
      },
      band: {
        geo: new THREE.CylinderGeometry(0.565, 0.565, 1, 28),
        mat: std({ color: '#16233a', roughness: 0.4, metalness: 0.5 }),
        mats: [],
      },
      flange: {
        geo: new THREE.CylinderGeometry(0.66, 0.66, 1, 28),
        mat: std({ color: '#dfe7ee', roughness: 0.12, metalness: 0.92 }),
        mats: [],
      },
      ring: { geo: new THREE.TorusGeometry(0.62, 0.035, 8, 40), mat: glow(PALETTE.cyan, 2.4), mats: [] },
      quad: {
        geo: new THREE.CylinderGeometry(0.62, 0.62, 1, 28),
        mat: std({ color: '#e8742a', roughness: 0.35, metalness: 0.35 }),
        mats: [],
        shadow: true,
      },
      bellows: {
        geo: new THREE.CylinderGeometry(0.28, 0.28, 1, 16),
        mat: std({ color: '#b9c3cc', roughness: 0.25, metalness: 0.9 }),
        mats: [],
      },
      stand: {
        geo: new THREE.BoxGeometry(1, 1, 1),
        mat: std({ color: '#2b333d', roughness: 0.6, metalness: 0.3 }),
        mats: [],
        shadow: true,
      },
      plate: {
        geo: new THREE.BoxGeometry(1, 1, 1),
        mat: std({ color: PALETTE.gantry, roughness: 0.5, metalness: 0.2 }),
        mats: [],
      },
    };
    for (let ux = x0; ux + UNIT <= x1 + 0.01; ux += UNIT) {
      const d0 = ux + 0.6;
      const dc = d0 + DIPOLE / 2;
      const qc = d0 + DIPOLE + 0.7 + QUAD / 2;
      if (!blocked(dc)) {
        p.dipole!.mats.push(along(dc, y, z, 1, DIPOLE, 1));
        p.band!.mats.push(along(dc, y, z, 1, 0.35, 1));
        for (const fx of [d0, d0 + DIPOLE]) {
          p.flange!.mats.push(along(fx, y, z, 1, 0.16, 1));
          p.ring!.mats.push(
            new THREE.Matrix4().compose(
              new THREE.Vector3(fx + (fx === d0 ? -0.12 : 0.12), y, z),
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
              new THREE.Vector3(1, 1, 1),
            ),
          );
        }
        for (const sx of [d0 + 1.2, d0 + DIPOLE - 1.2]) {
          p.stand!.mats.push(
            new THREE.Matrix4().compose(
              new THREE.Vector3(sx, (y - 0.5) / 2, z),
              new THREE.Quaternion(),
              new THREE.Vector3(0.45, y - 0.5, 0.7),
            ),
          );
          p.plate!.mats.push(
            new THREE.Matrix4().compose(
              new THREE.Vector3(sx, 0.03, z),
              new THREE.Quaternion(),
              new THREE.Vector3(0.9, 0.06, 1.1),
            ),
          );
        }
        p.bellows!.mats.push(along(d0 + DIPOLE + 0.35, y, z, 1, 0.7, 1));
      }
      if (!blocked(qc)) {
        p.quad!.mats.push(along(qc, y, z, 1, QUAD, 1));
        for (const fx of [qc - QUAD / 2, qc + QUAD / 2])
          p.flange!.mats.push(along(fx, y, z, 0.98, 0.12, 0.98));
        p.stand!.mats.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(qc, (y - 0.5) / 2, z),
            new THREE.Quaternion(),
            new THREE.Vector3(0.45, y - 0.5, 0.7),
          ),
        );
        p.plate!.mats.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(qc, 0.03, z),
            new THREE.Quaternion(),
            new THREE.Vector3(0.9, 0.06, 1.1),
          ),
        );
        p.bellows!.mats.push(along(qc + QUAD / 2 + 0.9, y, z, 1, 1.8, 1));
      }
    }
    return Object.values(p);
  }, [x0, x1, y, z, skip]);

  const len = x1 - x0;
  const mid = (x0 + x1) / 2;
  const pipe = useMemo(() => std({ color: '#d5dde5', roughness: 0.15, metalness: 0.9 }), []);
  const cryo = useMemo(() => std({ color: '#eef2f5', roughness: 0.4, metalness: 0.2 }), []);

  // The beam brightens with the circulating current.
  useFrame(() => {
    const a = simHost.state.accel;
    const k = 0.15 + 3.2 * Math.min(1, a.current / 2.8) * (a.beamOn ? 1 : 0);
    beamMat.current?.color.set('#c9f6ff').multiplyScalar(k);
  });

  return (
    <group>
      {parts.map((part, i) => (
        <InstancedPart key={i} part={part} />
      ))}
      <mesh position={[mid, y, z]} quaternion={X_AXIS_Q} material={pipe} userData={{ noBake: true }}>
        <cylinderGeometry args={[0.13, 0.13, len, 12]} />
      </mesh>
      <mesh position={[mid, y, z]} quaternion={X_AXIS_Q} userData={{ noBake: true }}>
        <cylinderGeometry args={[0.045, 0.045, len, 6]} />
        <meshBasicMaterial ref={beamMat} color="#c9f6ff" toneMapped={false} />
      </mesh>
      <mesh
        position={[mid, y + 0.95, z - 0.3]}
        quaternion={X_AXIS_Q}
        material={cryo}
        userData={{ noBake: true }}
      >
        <cylinderGeometry args={[0.1, 0.1, len, 10]} />
      </mesh>
    </group>
  );
}

/**
 * RF cryomodule string for the RF Station: open-sided cryostats showing golden
 * elliptical cavity cells. Each cavity's cells and status lamp follow its field
 * (gold and green when tuned, orange and amber when detuned).
 */
export function CryomoduleString({ xs, y = 1.25, z = 0 }: { xs: number[]; y?: number; z?: number }) {
  const cells = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  const CELLS = 7;
  const LEN = 3.3;
  const geo = useMemo(
    () => ({
      // Open on the camera side (up and toward +z) so the golden cells show through.
      shell: new THREE.CylinderGeometry(0.78, 0.78, LEN, 32, 1, true, Math.PI * 0.5, Math.PI * 1.4),
      cap: new THREE.CylinderGeometry(0.82, 0.82, 0.18, 32),
      cell: new THREE.SphereGeometry(1, 20, 14),
      lamp: new THREE.SphereGeometry(0.08, 10, 8),
      guide: new THREE.BoxGeometry(0.42, 1, 0.34),
    }),
    [],
  );
  const mats = useMemo(
    () => ({
      shell: new THREE.MeshStandardMaterial({
        color: '#eef2f5',
        roughness: 0.35,
        metalness: 0.3,
        side: THREE.DoubleSide,
      }),
      cap: std({ color: '#dfe7ee', roughness: 0.12, metalness: 0.92 }),
      cell: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.18,
        metalness: 0.85,
        emissive: '#5a3a08',
        emissiveIntensity: 0.6,
      }),
      lamp: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      guide: std({ color: PALETTE.trim, roughness: 0.45, metalness: 0.3 }),
      ring: glow(PALETTE.cyan, 2.4),
    }),
    [],
  );
  const c = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const m = cells.current;
    const l = lamps.current;
    if (!m || !l) return;
    let k = 0;
    xs.forEach((x, i) => {
      for (let j = 0; j < CELLS; j++) {
        const cx = x - LEN / 2 + 0.35 + (j * (LEN - 0.7)) / (CELLS - 1);
        m.setMatrixAt(
          k,
          new THREE.Matrix4().compose(
            new THREE.Vector3(cx, y, z),
            new THREE.Quaternion(),
            new THREE.Vector3(0.22, 0.5, 0.5),
          ),
        );
        m.setColorAt(k++, c.set('#ffd27a'));
      }
      l.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x + 1.1, y + 0.86, z + 0.5));
      l.setColorAt(i, c.set(PALETTE.player));
    });
    m.instanceMatrix.needsUpdate = true;
    l.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    l.computeBoundingSphere();
  }, [xs, y, z, c]);

  // Cavity health shown on the cells and lamps, refreshed a few times a second.
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const m = cells.current;
    const l = lamps.current;
    if (!m || !l) return;
    const cav = simHost.state.accel.cavities;
    xs.forEach((_, i) => {
      const f = (cav[i]?.field ?? MAX_FIELD) / MAX_FIELD;
      const tuned = f > 0.95;
      c.set(tuned ? '#ffd27a' : f > 0.85 ? '#ffb060' : '#ff7a4a');
      for (let j = 0; j < CELLS; j++) m.setColorAt(i * CELLS + j, c);
      l.setColorAt(
        i,
        c.set(tuned ? PALETTE.player : f > 0.85 ? PALETTE.amber : '#ff4d4d').multiplyScalar(2.2),
      );
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (l.instanceColor) l.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {xs.map((x) => (
        <group key={x}>
          <mesh
            position={[x, y, z]}
            quaternion={X_AXIS_Q}
            geometry={geo.shell}
            material={mats.shell}
            castShadow
          />
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh
                position={[x + (s * LEN) / 2, y, z]}
                quaternion={X_AXIS_Q}
                geometry={geo.cap}
                material={mats.cap}
              />
              <mesh
                position={[x + s * (LEN / 2 + 0.12), y, z]}
                rotation={[0, Math.PI / 2, 0]}
                material={mats.ring}
              >
                <torusGeometry args={[0.8, 0.035, 8, 40]} />
              </mesh>
            </group>
          ))}
          {/* Waveguide dropping from the RF gallery to the coupler */}
          <mesh
            position={[x, y + 2.0, z - 0.1]}
            scale={[1, 2.4, 1]}
            geometry={geo.guide}
            material={mats.guide}
            castShadow
          />
          <mesh
            position={[x, y + 3.25, z - 0.9]}
            scale={[1, 0.34, 4.6]}
            rotation={[0, 0, 0]}
            geometry={geo.guide}
            material={mats.guide}
          />
        </group>
      ))}
      <instancedMesh ref={cells} args={[geo.cell, mats.cell, xs.length * CELLS]} />
      <instancedMesh ref={lamps} args={[geo.lamp, mats.lamp, xs.length]} />
    </group>
  );
}
