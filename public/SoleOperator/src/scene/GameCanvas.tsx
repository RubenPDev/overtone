import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useApp } from '../state/app';
import { PALETTE } from '../styles/palette';
import { IsoCamera } from './IsoCamera';
import { Lighting } from './Lighting';
import { PostFX } from './PostFX';
import { SimDriver } from './SimDriver';
import { SpaceStage } from './SpaceStage';

/** The 3D view. `flat` because tone mapping happens in the post stack (AgX). */
export default function GameCanvas() {
  const high = useApp((s) => s.settings.quality === 'high');
  return (
    <Canvas
      orthographic
      flat
      shadows={high ? { type: THREE.PCFShadowMap } : false}
      dpr={high ? [1, 2] : [1, 1.25]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ position: [60, 50, 60], zoom: 30, near: 1, far: 400 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <color attach="background" args={[PALETTE.void]} />
      <SimDriver />
      <IsoCamera />
      <Lighting />
      <SpaceStage />
      <PostFX />
    </Canvas>
  );
}
