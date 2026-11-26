import type { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

export function skipRedundantSmaaClears(pass: Pick<SMAAPass, 'fsQuad' | 'materialWeights' | 'materialBlend'>) {
  for (const material of [pass.materialWeights, pass.materialBlend]) {
    material.depthTest = false;
    material.depthWrite = false;
  }
  const quad = pass.fsQuad, draw = quad.render.bind(quad);
  quad.render = renderer => {
    // The edge shader discards pixels. Only the subsequent two full writes can skip the clear.
    if (quad.material !== pass.materialWeights && quad.material !== pass.materialBlend) {
      draw(renderer);
      return;
    }
    const previous = renderer.autoClear;
    renderer.autoClear = false;
    try { draw(renderer); } finally { renderer.autoClear = previous; }
  };
}
