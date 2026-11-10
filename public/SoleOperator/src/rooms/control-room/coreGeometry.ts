import * as THREE from 'three';

export const CORE_RADIUS = 1.7;
export const CORE_Y = 3.4;
export const DRIVE_RING_Y = 8.4;
export const DRIVE_RING_R = 3.0;
/** Radius at which rods run up the inside of the tank wall. */
const WALL_R = 2.72;
/** Fraction of the rod path still filled by rod when fully withdrawn. */
export const ROD_RETRACTED_T = 0.5;

export interface CoreFace {
  /** Cell index 0–11 (shown as 01–12). */
  cell: number;
  center: THREE.Vector3;
  normal: THREE.Vector3;
  /** The face's five corners (world space, in order around the face). */
  corners: THREE.Vector3[];
  /** Rod path from its drive on the ring (t = 0) down the tank wall and into the port (t = 1). */
  rodCurve: THREE.CatmullRomCurve3;
  drive: THREE.Vector3;
  /** Refuelling arm path from its home above the core (t = 0) to the cassette (t = 1). */
  armCurve: THREE.CatmullRomCurve3;
}

/** Arm home position: above the core, just over the water. */
export const ARM_HOME = new THREE.Vector3(0, 7.25, 0);

/**
 * Derives the 12 pentagonal faces of the core (centre, normal, corners) from
 * three's DodecahedronGeometry, assigns each a drive slot on the ring above the
 * tank, and builds the rod and refuelling-arm paths. Cell 07 lands on the face
 * most turned toward the camera, as in the reference.
 */
function build(): CoreFace[] {
  const geo = new THREE.DodecahedronGeometry(CORE_RADIUS, 0);
  const pos = geo.getAttribute('position');
  const groups = new Map<string, { normal: THREE.Vector3; verts: THREE.Vector3[] }>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    // Round to a coarse grid; `+ 0` turns -0 into 0 so both halves of a face share a key.
    const key = n
      .toArray()
      .map((v) => Math.round(v * 20) + 0)
      .join(',');
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { normal: n, verts: [] }));
    g.verts.push(a.clone(), b.clone(), c.clone());
  }
  geo.dispose();

  const lift = new THREE.Vector3(0, CORE_Y, 0);
  const raw = [...groups.values()].map((g) => {
    const uniq: THREE.Vector3[] = [];
    for (const v of g.verts) if (!uniq.some((u) => u.distanceToSquared(v) < 1e-6)) uniq.push(v);
    const center = uniq.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(uniq.length);
    // Order the corners around the face normal.
    const ref = new THREE.Vector3().subVectors(uniq[0]!, center).normalize();
    const side = new THREE.Vector3().crossVectors(g.normal, ref);
    const corners = uniq
      .map((v) => {
        const d = new THREE.Vector3().subVectors(v, center);
        return { v, ang: Math.atan2(d.dot(side), d.dot(ref)) };
      })
      .sort((p, q) => p.ang - q.ang)
      .map((x) => x.v.clone().add(lift));
    return { normal: g.normal, center: center.add(lift), corners };
  });

  const sorted = raw
    .map((f) => ({ ...f, az: Math.atan2(f.normal.z, f.normal.x) }))
    .sort((p, q) => p.az - q.az || p.normal.y - q.normal.y);
  const az0 = sorted[0]!.az;

  const view = new THREE.Vector3(1, -0.15, 1).normalize();
  let front = 0;
  sorted.forEach((f, i) => {
    if (f.normal.dot(view) > sorted[front]!.normal.dot(view)) front = i;
  });

  return sorted.map((f, i) => {
    const slotAz = az0 + (i / 12) * Math.PI * 2;
    const radial = new THREE.Vector3(Math.cos(slotAz), 0, Math.sin(slotAz));
    const drive = radial.clone().multiplyScalar(DRIVE_RING_R).setY(DRIVE_RING_Y);
    const out = (d: number) => f.center.clone().addScaledVector(f.normal, d);
    const approach = out(0.95);
    // Down the wall at the slot's azimuth, across to the face, straight into the port.
    const top = radial
      .clone()
      .multiplyScalar(WALL_R + 0.12)
      .setY(7.0);
    const wall = radial
      .clone()
      .multiplyScalar(WALL_R)
      .setY(THREE.MathUtils.clamp(approach.y, 0.9, 6.2));
    const rodCurve = new THREE.CatmullRomCurve3(
      [drive, top, wall, approach, out(0.3), out(-0.12)],
      false,
      'centripetal',
      0.4,
    );
    const faceAz = Math.atan2(f.normal.z, f.normal.x);
    const armSide = new THREE.Vector3(
      Math.cos(faceAz) * 2.3,
      Math.max(approach.y, 6.6),
      Math.sin(faceAz) * 2.3,
    );
    const armCurve = new THREE.CatmullRomCurve3(
      [ARM_HOME.clone(), armSide, approach, out(0.2)],
      false,
      'centripetal',
    );
    return {
      cell: (i - front + 6 + 12) % 12,
      center: f.center,
      normal: f.normal.clone(),
      corners: f.corners,
      rodCurve,
      drive,
      armCurve,
    };
  });
}

let cache: CoreFace[] | null = null;
/** The 12 core faces (built once). */
export function coreFaces(): CoreFace[] {
  return (cache ??= build());
}

export function faceForCell(cell: number): CoreFace {
  return coreFaces().find((f) => f.cell === cell)!;
}

/** Pentagonal cassette plate for a face, slightly raised and inset (world space). */
export function cassetteGeometry(f: CoreFace, inset = 0.84, lift = 0.05): THREE.BufferGeometry {
  const c = f.center.clone().addScaledVector(f.normal, lift);
  const pts = f.corners.map((v) => c.clone().lerp(v.clone().addScaledVector(f.normal, lift), inset));
  const positions: number[] = [];
  for (let i = 0; i < 5; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % 5]!;
    positions.push(c.x, c.y, c.z, p.x, p.y, p.z, q.x, q.y, q.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals(); // winding may face either way: cassette materials are double-sided
  return g;
}

/** A free-floating cassette (for the arm and capsule), centred at the origin facing +y. */
export function looseCassetteGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.62, 0.62, 0.16, 5);
  return g;
}
