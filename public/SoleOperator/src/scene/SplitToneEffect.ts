import { BlendFunction, Effect } from 'postprocessing';
import * as THREE from 'three';

const fragment = /* glsl */ `
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float amount;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float l = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 tint = mix(shadowTint, highlightTint, smoothstep(0.1, 0.7, l));
  // Normalise the tint to unit luminance so the grade shifts hue without darkening.
  tint /= max(dot(tint, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
  vec3 graded = inputColor.rgb * tint;
  outputColor = vec4(mix(inputColor.rgb, graded, amount), inputColor.a);
}
`;

/** Light teal-shadows / orange-highlights grade, applied after tone mapping. */
export class SplitToneEffect extends Effect {
  constructor({ shadow = '#5f8f9a', highlight = '#a3826b', amount = 0.22 } = {}) {
    super('SplitToneEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['shadowTint', new THREE.Uniform(new THREE.Color(shadow).convertSRGBToLinear().multiplyScalar(1.25))],
        [
          'highlightTint',
          new THREE.Uniform(new THREE.Color(highlight).convertSRGBToLinear().multiplyScalar(1.6)),
        ],
        ['amount', new THREE.Uniform(amount)],
      ]),
    });
  }
}
