import * as THREE from 'three';

/**
 * Shared material cache. Identical-looking materials are created once and
 * reused across every instance (desks, NPCs, props…), which keeps shader
 * state changes down and lets <Baked> merge meshes from different components.
 * Cached materials live for the whole session: never dispose them.
 */
const cache = new Map<string, THREE.Material>();

export interface StdParams {
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  flatShading?: boolean;
}

export function std(p: StdParams): THREE.MeshStandardMaterial {
  const key = `std|${p.color}|${p.roughness ?? 0.6}|${p.metalness ?? 0.1}|${p.emissive ?? ''}|${p.emissiveIntensity ?? 0}|${p.flatShading ? 1 : 0}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: p.color,
      roughness: p.roughness ?? 0.6,
      metalness: p.metalness ?? 0.1,
      flatShading: p.flatShading ?? false,
      ...(p.emissive ? { emissive: p.emissive, emissiveIntensity: p.emissiveIntensity ?? 1 } : {}),
    });
    cache.set(key, m);
  }
  return m;
}

/** Unlit glowing material (pushed past 1 so it blooms). */
export function glow(color: string, strength = 2.2): THREE.MeshBasicMaterial {
  const key = `glow|${color}|${strength}`;
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(strength),
      toneMapped: false,
    });
    cache.set(key, m);
  }
  return m;
}
