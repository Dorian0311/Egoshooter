import { HalfFloatType, LinearFilter, PerspectiveCamera, RedFormat, UnsignedByteType, type Object3D } from 'three';
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
    if (this.camera instanceof PerspectiveCamera) {
      // The sampling loop uses clip X, Y and W only. Include the two lens offsets for asymmetric views.
      this.ssaoMaterial.fragmentShader = this.ssaoMaterial.fragmentShader.replace(
        'cameraProjectionMatrix * vec4( samplePoint, 1.0 )',
        `vec4(vec2(cameraProjectionMatrix[0][0], cameraProjectionMatrix[1][1]) * samplePoint.xy
          + cameraProjectionMatrix[2].xy * samplePoint.z, 0.0, -samplePoint.z)`,
      );
    }
    // Both fullscreen targets contain a single occlusion factor. Scene depth lives on the normal target.
    for (const target of [this.ssaoRenderTarget, this.blurRenderTarget]) {
      target.texture.format = RedFormat;
      target.depthBuffer = false;
    }
    this.copyMaterial.uniforms.scalarInput = { value: true };
    this.copyMaterial.fragmentShader = 'uniform bool scalarInput;\n' + this.copyMaterial.fragmentShader.replace(
      'opacity * texel', 'opacity * (scalarInput ? vec4(texel.rrr, 1.0) : texel)',
    );
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

  override render(...args: Parameters<SSAOPass['render']>) {
    this.copyMaterial.uniforms.scalarInput.value = this.output !== SSAOPass.OUTPUT.Normal;
    super.render(...args);
  }

  setNormalPrecision(fullPrecision: boolean) {
    const target = this.normalRenderTarget;
    const type = fullPrecision ? HalfFloatType : UnsignedByteType;
    if (target.texture.type === type) return;
    // Normals are already encoded in [0,1]. Scene depth uses its own 24-bit texture.
    target.dispose();
    target.texture.type = type;
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
