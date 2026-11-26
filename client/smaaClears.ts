import type { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

export function skipRedundantSmaaClears(pass: Pick<SMAAPass, 'fsQuad' | 'materialWeights' | 'materialBlend'>) {
  const noEdges = new Float32Array(4);
  for (const material of [pass.materialWeights, pass.materialBlend]) {
    material.depthTest = false;
    material.depthWrite = false;
  }
  const quad = pass.fsQuad, draw = quad.render.bind(quad);
  quad.render = renderer => {
    // The edge shader discards smooth pixels. Their mask must be zero even when
    // the scene clears to a bright sky color. Clear only this colour attachment.
    if (quad.material !== pass.materialWeights && quad.material !== pass.materialBlend) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      renderer.state.buffers.color.setMask(true);
      gl.clearBufferfv(gl.COLOR, 0, noEdges);
    }
    const previous = renderer.autoClear;
    renderer.autoClear = false;
    try { draw(renderer); } finally { renderer.autoClear = previous; }
  };
}
