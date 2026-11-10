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

/**
 * Cheap glass: unlit, transparent, brighter at grazing angles (fresnel rim).
 * Large transparent surfaces drawn with lit PBR materials cost every light and
 * the shadow map per layer per pixel; this costs almost nothing.
 */
export function fresnelGlass(
  color = '#d6f6ff',
  base = 0.04,
  rim = 0.55,
  side: THREE.Side = THREE.FrontSide,
): THREE.ShaderMaterial {
  const key = `glass|${color}|${base}|${rim}|${side}`;
  let m = cache.get(key) as THREE.ShaderMaterial | undefined;
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uBase: { value: base }, uRim: { value: rim } },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          // Orthographic camera: every view ray is parallel to -Z.
          if (projectionMatrix[3][3] == 1.0) vV = vec3(0.0, 0.0, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uBase;
        uniform float uRim;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
          gl_FragColor = vec4(uColor * (1.0 + f * 1.5), uBase + uRim * f);
        }`,
      transparent: true,
      depthWrite: false,
      side,
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
