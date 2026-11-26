import { LinearFilter, type Object3D } from 'three';
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

  constructor(...args: ConstructorParameters<typeof SSAOPass>) {
    super(...args);
    this.ssaoRenderTarget.texture.minFilter = LinearFilter;
    this.ssaoRenderTarget.texture.magFilter = LinearFilter;
    // Linear sampling combines adjacent texels. The paired taps and the center
    // reproduce the original uniform five-by-five box, including clamped edges.
    this.blurMaterial.fragmentShader = /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      void main() {
        vec2 texel = 1.0 / resolution;
        vec2 center = gl_FragCoord.xy * texel;
        float sum = 0.0;
        for (int y = -1; y <= 1; ++y) {
          for (int x = -1; x <= 1; ++x) {
            vec2 offset = vec2(float(x), float(y)) * 1.5 * texel;
            float weight = (x == 0 ? 1.0 : 2.0) * (y == 0 ? 1.0 : 2.0);
            sum += texture2D(tDiffuse, center + offset).r * weight;
          }
        }
        gl_FragColor = vec4(vec3(sum / 25.0), 1.0);
      }
    `;
  }

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
