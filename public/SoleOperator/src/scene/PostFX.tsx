import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useMemo } from 'react';
import { useApp } from '../state/app';
import { SplitToneEffect } from './SplitToneEffect';

/**
 * Bloom on emissives, AgX tone mapping, teal/orange split tone and a vignette.
 * Low quality drops bloom and MSAA but keeps the grade so the look holds.
 */
export function PostFX() {
  const high = useApp((s) => s.settings.quality === 'high');
  const grade = useMemo(() => new SplitToneEffect(), []);
  return (
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass={false}>
      <>
        {high && (
          <Bloom
            mipmapBlur
            intensity={0.95}
            luminanceThreshold={0.9}
            luminanceSmoothing={0.25}
            radius={0.72}
          />
        )}
      </>
      <ToneMapping mode={ToneMappingMode.AGX} />
      <primitive object={grade} dispose={null} />
      <Vignette offset={0.28} darkness={0.72} />
    </EffectComposer>
  );
}
