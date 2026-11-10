import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Static batching. Everything rendered inside <Baked> is merged, once after
 * mount, into one mesh per (material, shadow flags): hundreds of draw calls
 * become a handful. The originals stay in the tree (React owns them) but are
 * hidden, so they cost nothing to draw.
 *
 * Rules: children must not move after mount; troika text, custom shaders and
 * transparent materials are left as they are. Mark a mesh with
 * `userData.noBake = true` to keep it separate.
 */
export function Baked({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    const toLocal = new THREE.Matrix4().copy(group.matrixWorld).invert();

    const buckets = new Map<
      string,
      {
        material: THREE.Material;
        cast: boolean;
        receive: boolean;
        order: number;
        geos: THREE.BufferGeometry[];
      }
    >();
    const hidden: THREE.Mesh[] = [];

    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.noBake || !mesh.visible) return;
      const material = mesh.material as THREE.Material & { isDerivedMaterial?: boolean };
      // Additive blending doesn't depend on draw order, so additive transparents (glow decals) merge safely.
      const orderFree = material.blending === THREE.AdditiveBlending;
      if (Array.isArray(mesh.material) || (material.transparent && !orderFree) || material.isDerivedMaterial)
        return;
      if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial))
        return;
      const src = mesh.geometry;
      if ((src as THREE.InstancedBufferGeometry).isInstancedBufferGeometry) return; // troika text
      if (!src.getAttribute('position') || !src.getAttribute('normal') || !src.getAttribute('uv')) return;

      // World-space copy relative to the bake root, with a uniform attribute set.
      const keep = material.vertexColors
        ? ['position', 'normal', 'uv', 'color']
        : ['position', 'normal', 'uv'];
      if (material.vertexColors && !src.getAttribute('color')) return;
      const g = src.index ? src.toNonIndexed() : src.clone();
      for (const name of Object.keys(g.attributes)) if (!keep.includes(name)) g.deleteAttribute(name);
      g.morphAttributes = {};
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld));
      g.clearGroups();

      const key = `${material.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}|${mesh.renderOrder}`;
      let b = buckets.get(key);
      if (!b)
        buckets.set(
          key,
          (b = {
            material,
            cast: mesh.castShadow,
            receive: mesh.receiveShadow,
            order: mesh.renderOrder,
            geos: [],
          }),
        );
      b.geos.push(g);
      hidden.push(mesh);
    });

    const merged: THREE.Mesh[] = [];
    for (const b of buckets.values()) {
      const geo = b.geos.length === 1 ? b.geos[0]! : mergeGeometries(b.geos, false);
      if (b.geos.length > 1) b.geos.forEach((g) => g.dispose());
      if (!geo) continue;
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, b.material);
      m.castShadow = b.cast;
      m.receiveShadow = b.receive;
      m.renderOrder = b.order;
      m.matrixAutoUpdate = false;
      merged.push(m);
      group.add(m);
    }
    for (const mesh of hidden) mesh.visible = false;

    return () => {
      for (const m of merged) {
        group.remove(m);
        m.geometry.dispose();
      }
      for (const mesh of hidden) mesh.visible = true;
    };
  }, []);

  return <group ref={root}>{children}</group>;
}
