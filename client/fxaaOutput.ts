import {FXAAShader} from 'three/examples/jsm/shaders/FXAAShader.js';

// Apply the same linear-HDR FXAA before Three's normal final tone/color
// conversion, without writing and sampling another full-screen HDR target.
export const fxaaOutputShader={
 ...FXAAShader,name:'FXAAOutputShader',
 fragmentShader:FXAAShader.fragmentShader.replace(
  'gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );',
  `gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );
   #include <tonemapping_fragment>
   #include <colorspace_fragment>`,
 ),
};
