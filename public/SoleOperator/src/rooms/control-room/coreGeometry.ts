import * as THREE from 'three';

export const CORE_RADIUS = 1.7;
export const CORE_Y = 3.4;
export const DRIVE_RING_Y = 8.4;
export const DRIVE_RING_R = 3.0;
const PORT_OFFSET = 0.06;

export interface CoreFace {
  /** Cell index 0–11 (shown as 01–12). */
  cell: number;
  center: THREE.Vector3;
  normal: THREE.Vector3;
  /** Rod path: leaves the port perpendicular to the face, then curves up to its drive. */
  rodCurve: THREE.CatmullRomCurve3;
  drive: THREE.Vector3;
}

/**
 * Derives the 12 pentagonal faces of the core (centre + outward normal) from
 * three's DodecahedronGeometry, assigns each a drive slot on the ring above the
 * tank, and builds the rod path for it. Cell 07 ends up on the face most turned
 * toward the camera, as in the reference.
 */
export function buildCoreFaces(): CoreFace[] {
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
    const key = n
      .toArray()
      .map((v) => v.toFixed(2))
      .join(',');
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { normal: n, verts: [] }));
    g.verts.push(a.clone(), b.clone(), c.clone());
  }
  geo.dispose();

  const raw = [...groups.values()].map((g) => {
    const uniq: THREE.Vector3[] = [];
    for (const v of g.verts) if (!uniq.some((u) => u.distanceToSquared(v) < 1e-6)) uniq.push(v);
    const center = uniq.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(uniq.length);
    return { normal: g.normal, center };
  });

  // Drive slots: 12 evenly spaced around the ring, assigned in azimuth order (lower faces first on ties).
  const sorted = raw
    .map((f) => ({ ...f, az: Math.atan2(f.normal.z, f.normal.x) }))
    .sort((p, q) => p.az - q.az || p.normal.y - q.normal.y);
  const az0 = sorted[0]!.az;

  // Cell numbering: rotate so index 6 lands on the face most facing the camera (+x +z, slightly down).
  const view = new THREE.Vector3(1, -0.15, 1).normalize();
  let front = 0;
  sorted.forEach((f, i) => {
    if (f.normal.dot(view) > sorted[front]!.normal.dot(view)) front = i;
  });

  return sorted.map((f, i) => {
    const slotAz = az0 + (i / 12) * Math.PI * 2;
    const drive = new THREE.Vector3(
      Math.cos(slotAz) * DRIVE_RING_R,
      DRIVE_RING_Y,
      Math.sin(slotAz) * DRIVE_RING_R,
    );
    const center = f.center.clone().add(new THREE.Vector3(0, CORE_Y, 0));
    const out = (d: number) => center.clone().addScaledVector(f.normal, d);
    const radial = new THREE.Vector3(Math.cos(slotAz), 0, Math.sin(slotAz));
    const p1 = out(0.9);
    const p2 = radial
      .clone()
      .multiplyScalar(CORE_RADIUS + 1.25)
      .setY(Math.max(p1.y, CORE_Y - 0.4) + 0.4);
    const p3 = radial
      .clone()
      .multiplyScalar(DRIVE_RING_R * 0.92)
      .setY(CORE_Y + CORE_RADIUS + 1.6);
    const rodCurve = new THREE.CatmullRomCurve3([out(PORT_OFFSET), p1, p2, p3, drive], false, 'centripetal');
    return { cell: (i - front + 6 + 12) % 12, center, normal: f.normal.clone(), rodCurve, drive };
  });
}
