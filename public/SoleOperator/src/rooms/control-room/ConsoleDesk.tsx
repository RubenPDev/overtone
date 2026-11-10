import { useMemo } from 'react';
import * as THREE from 'three';
import { glow, std } from '../../scene/materials';
import { PALETTE } from '../../styles/palette';

let screenTex: THREE.CanvasTexture | null = null;
/** One shared "busy console" screen texture: traces and a grid. */
function screenTexture() {
  if (screenTex) return screenTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = '#06202a';
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = 'rgba(95,227,255,0.18)';
  for (let x = 0; x < 256; x += 32) g.strokeRect(x, 0, 32, 160);
  const trace = (color: string, amp: number, f: number, y0: number) => {
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= 256; x += 4)
      g.lineTo(x, y0 + Math.sin(x * f) * amp + Math.sin(x * f * 2.7) * amp * 0.3);
    g.stroke();
  };
  trace('#5fe3ff', 18, 0.05, 60);
  trace('#6dffb6', 10, 0.09, 112);
  screenTex = new THREE.CanvasTexture(c);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  return screenTex;
}

let screenMat: THREE.MeshBasicMaterial | null = null;

/** Placeholder control desk: local +z faces the seated operator. Materials are shared so desks bake together. */
export function ConsoleDesk({ x, z, yaw, seed = 0 }: { x: number; z: number; yaw: number; seed?: number }) {
  const m = useMemo(
    () => ({
      desk: std({ color: PALETTE.desk, roughness: 0.6 }),
      base: std({ color: '#c3cbd4', roughness: 0.7 }),
      frame: std({ color: '#1b222b', roughness: 0.5 }),
      screen: (screenMat ??= new THREE.MeshBasicMaterial({
        map: screenTexture(),
        color: new THREE.Color(1.6, 1.6, 1.6),
        toneMapped: false,
      })),
      trim: std({ color: PALETTE.trim, emissive: PALETTE.trim, emissiveIntensity: 0.3 }),
      mug: std({ color: ['#f4f6f8', '#d7261e', '#2f6fb0', '#f2b81f'][seed % 4]!, roughness: 0.4 }),
      paper: std({ color: '#f1f3f5', roughness: 0.9 }),
      keys: std({ color: '#2a3038', roughness: 0.6 }),
      lamp: glow('#ffd9a0', 2),
    }),
    [seed],
  );
  const side = seed % 2 ? 1 : -1;
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.38, -0.05]} material={m.base} castShadow receiveShadow>
        <boxGeometry args={[2.5, 0.76, 0.85]} />
      </mesh>
      <mesh position={[0, 0.79, 0.05]} material={m.desk} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.06, 1.05]} />
      </mesh>
      <mesh position={[0, 0.74, 0.58]} material={m.trim}>
        <boxGeometry args={[2.7, 0.04, 0.02]} />
      </mesh>
      {[-0.82, 0, 0.82].map((sx, i) => (
        <group key={sx} position={[sx, 1.18, -0.28]} rotation={[-0.12, (i - 1) * -0.25, 0]}>
          <mesh material={m.frame} castShadow>
            <boxGeometry args={[0.78, 0.5, 0.05]} />
          </mesh>
          <mesh position={[0, 0, 0.03]} material={m.screen}>
            <planeGeometry args={[0.7, 0.42]} />
          </mesh>
        </group>
      ))}
      {/* Desk clutter: keyboard, coffee mug, papers and a small lamp. */}
      <mesh position={[0, 0.83, 0.22]} material={m.keys}>
        <boxGeometry args={[0.6, 0.025, 0.2]} />
      </mesh>
      <mesh position={[side * 0.95, 0.88, 0.25]} material={m.mug} castShadow>
        <cylinderGeometry args={[0.055, 0.05, 0.13, 12]} />
      </mesh>
      <mesh position={[-side * 0.85, 0.825, 0.3]} rotation={[0, 0.3 * side, 0]} material={m.paper}>
        <boxGeometry args={[0.3, 0.012, 0.4]} />
      </mesh>
      <group position={[-side * 1.18, 0.82, -0.3]}>
        <mesh position={[0, 0.22, 0]} material={m.frame}>
          <cylinderGeometry args={[0.015, 0.02, 0.44, 6]} />
        </mesh>
        <mesh position={[0, 0.44, 0.06]} rotation={[0.6, 0, 0]} material={m.lamp}>
          <coneGeometry args={[0.08, 0.1, 10, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}
