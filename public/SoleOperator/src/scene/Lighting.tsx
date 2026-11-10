import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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
  const gl = useThree((s) => s.gl);

  // Shadow map refresh at half the frame rate (still 60 Hz at 120 fps): the shadow
  // pass redraws every caster, and nothing in the scene moves fast enough to show it.
  const shadowFrame = useRef(0);
  const shadowVersion = useRef(-1);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame(() => {
    shadowFrame.current += 1;
    if (shadowFrame.current % 2 === 0 || shadowVersion.current !== stage.version) {
      gl.shadowMap.needsUpdate = true;
      shadowVersion.current = stage.version;
    }
  });

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
      <hemisphereLight args={['#cfe4f2', '#4a3c30', 1.05]} />
      <ambientLight intensity={0.22} color="#b8cadb" />
      <directionalLight ref={key} intensity={1.6} color="#fff0dd" castShadow={shadows} />
      <SceneEnvironment />
    </>
  );
}

/**
 * A soft studio environment generated on the GPU (no download): fills shadows
 * with a little light and gives metal and glass something to reflect.
 */
function SceneEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.42;
    room.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}
