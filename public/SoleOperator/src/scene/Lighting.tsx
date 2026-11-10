import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useApp } from '../state/app';
import { stage } from './stage';

/**
 * Shared base lighting: cool sky fill, warm bounce, and one shadow-casting key
 * light that follows the mounted space. Rooms add their own accent lights
 * (core glow, lamps) and floor glow decals in their Contents.
 */
export function Lighting() {
  const shadows = useApp((s) => s.settings.quality === 'high');
  const key = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    const l = key.current;
    if (!l) return;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.03;
    l.shadow.radius = 4;
  }, []);

  // Fit the shadow camera around whatever space is mounted (cheap; runs every frame but only writes on change).
  const fitted = useRef('');
  useFrame(() => {
    const l = key.current;
    const f = stage.layout?.frame;
    if (!l || !f) return;
    const sig = `${f.minX},${f.maxX},${f.minZ},${f.maxZ}`;
    if (sig === fitted.current) return;
    fitted.current = sig;
    const cx = (f.minX + f.maxX) / 2;
    const cz = (f.minZ + f.maxZ) / 2;
    const r = Math.min(60, Math.max(f.maxX - f.minX, f.maxZ - f.minZ) * 0.75);
    l.position.set(cx - 14, 30, cz - 6);
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = 90;
    cam.updateProjectionMatrix();
  });

  return (
    <>
      <hemisphereLight args={['#a9c9e0', '#3a2a20', 0.75]} />
      <ambientLight intensity={0.12} color="#9fb6cc" />
      <directionalLight ref={key} intensity={1.15} color="#ffe6cc" castShadow={shadows} />
    </>
  );
}
