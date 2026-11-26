import type { Object3D } from 'three';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';

/** Only visible points and lines need a visibility override in the normal/depth pass. */
export class WorldOcclusionPass extends SSAOPass {
  private readonly hiddenPrimitives: Object3D[] = [];
  private readonly hidePrimitive = (object: Object3D & { isPoints?: boolean; isLine?: boolean }) => {
    if (object.isPoints || object.isLine) {
      this.hiddenPrimitives.push(object);
      object.visible = false;
    }
  };

  overrideVisibility() {
    this.scene.traverseVisible(this.hidePrimitive);
  }

  restoreVisibility() {
    for (const primitive of this.hiddenPrimitives) primitive.visible = true;
    this.hiddenPrimitives.length = 0;
  }

  override renderOverride(...args: Parameters<SSAOPass['renderOverride']>) {
    const scene = this.scene;
    const background = scene.background;
    const updateMatrices = scene.matrixWorldAutoUpdate;
    // The preceding world pass populated the matrices. Sky pixels have clear depth
    // and are ignored by SSAO, so there's no need to draw the background a second time.
    scene.matrixWorldAutoUpdate = false;
    scene.background = null;
    try {
      super.renderOverride(...args);
    } finally {
      scene.background = background;
      scene.matrixWorldAutoUpdate = updateMatrices;
    }
  }
}
