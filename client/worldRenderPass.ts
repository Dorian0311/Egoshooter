import {Texture} from 'three';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {createWorldSkeletonUpdates} from './worldSkeletonUpdates';

export class WorldRenderPass extends RenderPass {
  readonly skeletonUpdates=createWorldSkeletonUpdates();
  groupActorUpdates=false;
  afterWorld?: () => void;
  override render(...args: Parameters<RenderPass['render']>) {
    const [renderer] = args;
    const clearColor = renderer.autoClearColor;
    // The texture sky writes every color pixel. Depth and stencil still need their clears.
    if (this.scene.background instanceof Texture && !renderer.xr.isPresenting) {
      renderer.autoClearColor = false;
    }
    try {
      if(this.groupActorUpdates&&!renderer.xr.isPresenting)this.skeletonUpdates.begin();
      try{super.render(...args);}finally{this.skeletonUpdates.end();}
      this.afterWorld?.();
    } finally {
      renderer.autoClearColor = clearColor;
    }
  }
}
