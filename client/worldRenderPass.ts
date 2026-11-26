import {Texture} from 'three';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';

export class WorldRenderPass extends RenderPass {
  override render(...args: Parameters<RenderPass['render']>) {
    const [renderer] = args;
    const clearColor = renderer.autoClearColor;
    // The texture sky writes every color pixel. Depth and stencil still need their clears.
    if (this.scene.background instanceof Texture && !renderer.xr.isPresenting) {
      renderer.autoClearColor = false;
    }
    try {
      super.render(...args);
    } finally {
      renderer.autoClearColor = clearColor;
    }
  }
}
