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
}
