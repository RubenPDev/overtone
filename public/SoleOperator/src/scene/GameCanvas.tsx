import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useApp } from '../state/app';
import { PALETTE } from '../styles/palette';
import { AdaptiveResolution } from './AdaptiveResolution';
import { IsoCamera } from './IsoCamera';
import { Lighting } from './Lighting';
import { PostFX } from './PostFX';
import { ModeDriver } from './ModeDriver';
import { SimDriver } from './SimDriver';
import { SpaceStage } from './SpaceStage';

/** The 3D view. `flat` because tone mapping happens in the post stack (AgX). */
export default function GameCanvas() {
  const high = useApp((s) => s.settings.quality === 'high');
  // Never render more than 1.5x; on Low, never above 1x. The governor may go lower still.
  const maxDpr = Math.min(window.devicePixelRatio || 1, high ? 1.5 : 1);
  return (
    <Canvas
      orthographic
      flat
      shadows={high ? { type: THREE.PCFShadowMap } : false}
      dpr={maxDpr}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ position: [60, 50, 60], zoom: 30, near: 1, far: 400 }}
      onContextMenu={(e) => e.preventDefault()}
      onCreated={({ gl, scene }) => {
        // Dev-only handle for profiling (draw calls, triangles, programs).
        if (import.meta.env.DEV) Object.assign(window, { __soleGL: gl, __soleScene: scene });
      }}
    >
      <color attach="background" args={[PALETTE.void]} />
      <SimDriver />
      <AdaptiveResolution max={maxDpr} />
      <ModeDriver />
      <IsoCamera />
      <Lighting />
      <SpaceStage />
      <PostFX />
    </Canvas>
  );
}
