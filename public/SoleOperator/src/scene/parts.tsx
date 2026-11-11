import { Text } from '@react-three/drei';
import { useMemo, type ComponentProps } from 'react';
import * as THREE from 'three';
import oxanium700 from '@fontsource/oxanium/files/oxanium-latin-700-normal.woff?url';
import { glowTexture } from './textures';

/** Bundled font for in-world text (troika needs woff/ttf, not woff2). Avoids troika's CDN default. */
export const WORLD_FONT = oxanium700;

type TextProps = ComponentProps<typeof Text>;

/** In-world label in the game font. */
export function WorldText(props: TextProps) {
  return <Text font={WORLD_FONT} anchorX="center" anchorY="middle" letterSpacing={0.08} {...props} />;
}

/** Text painted flat on the floor. `yaw` rotates it about the vertical axis. */
export function FloorText({
  yaw = 0,
  position,
  ...rest
}: TextProps & { yaw?: number; position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <WorldText rotation={[-Math.PI / 2, 0, 0]} {...rest} />
    </group>
  );
}

/**
 * A pool of light faked with an additive decal on the floor. Much cheaper than a
 * real light, so rooms use these generously and keep real point lights to a few.
 */
export function GlowDecal({
  x,
  z,
  radius,
  color,
  intensity = 1,
  y = 0.02,
}: {
  x: number;
  z: number;
  radius: number;
  color: string;
  intensity?: number;
  y?: number;
}) {
  // Colour × intensity lives in vertex colours so every decal shares one material,
  // and <Baked> can merge all of a room's decals into a single additive draw call.
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(radius * 2, radius * 2);
    const c = new THREE.Color(color).multiplyScalar(intensity);
    const n = g.getAttribute('position').count;
    g.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3),
    );
    return g;
  }, [radius, color, intensity]);
  return (
    <mesh
      position={[x, y, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geo}
      material={decalMaterial()}
      renderOrder={1}
    />
  );
}

let decalMat: THREE.MeshBasicMaterial | null = null;
function decalMaterial() {
  return (decalMat ??= new THREE.MeshBasicMaterial({
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
}

/** Emissive material that blooms: colour pushed past 1 and excluded from tone mapping. */
export function useEmissive(color: string, strength = 2.5) {
  return useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(strength),
        toneMapped: false,
      }),
    [color, strength],
  );
}
