import {DepthTexture, NearestFilter, ShaderMaterial, UnsignedIntType, type WebGLRenderer, type WebGLRenderTarget} from 'three';

// Hardware depth is planar in screen space. Compare its two-sided extrapolation
// to the center before choosing tangents, so silhouettes do not mix surfaces.
const reconstructNormal = /* glsl */ `
  ivec2 size = textureSize(tDepth, 0);
  ivec2 pixel = clamp(ivec2(screenPosition * vec2(size)), ivec2(0), size - 1);
  float z = texelFetch(tDepth, pixel, 0).r;
  vec2 uv = (vec2(pixel) + 0.5) / vec2(size);
  vec3 center = getViewPosition(uv, z, getViewZ(z));
  vec3 axis[2];
  for (int i = 0; i < 2; i++) {
    ivec2 dir = i == 0 ? ivec2(1, 0) : ivec2(0, 1);
    ivec2 left = max(ivec2(0), pixel - dir), right = min(size - 1, pixel + dir);
    float l = texelFetch(tDepth, left, 0).r, r = texelFetch(tDepth, right, 0).r;
    float ll = texelFetch(tDepth, max(ivec2(0), pixel - 2 * dir), 0).r;
    float rr = texelFetch(tDepth, min(size - 1, pixel + 2 * dir), 0).r;
    float leftError = all(equal(left, pixel)) || l == 1.0 ? 1e20 : abs(2.0 * l - ll - z);
    float rightError = all(equal(right, pixel)) || r == 1.0 ? 1e20 : abs(2.0 * r - rr - z);
    if (min(leftError, rightError) >= 1e20) return normalize(-center);
    bool chooseRight = rightError <= leftError;
    ivec2 neighbour = chooseRight ? right : left;
    float depth = chooseRight ? r : l;
    vec3 p = getViewPosition((vec2(neighbour) + 0.5) / vec2(size), depth, getViewZ(depth));
    axis[i] = chooseRight ? p - center : center - p;
  }
  vec3 normal = cross(axis[0], axis[1]);
  return dot(normal, normal) > 1e-15 ? normalize(normal) : normalize(-center);`;

export function createDepthReconstructedMaterial(reference: ShaderMaterial) {
  const lookup = 'return unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );';
  if (!reference.fragmentShader.includes(lookup)) return;
  return new ShaderMaterial({
    defines: {...reference.defines}, uniforms: reference.uniforms, vertexShader: reference.vertexShader,
    fragmentShader: reference.fragmentShader.replace(lookup, reconstructNormal), blending: reference.blending,
    depthTest: reference.depthTest, depthWrite: reference.depthWrite,
  });
}

export function setWorldDepthTexture(target: WebGLRenderTarget, enabled: boolean) {
  if (!!target.depthTexture === enabled) return;
  target.dispose();
  target.depthTexture = enabled ? new DepthTexture(target.width, target.height, UnsignedIntType) : null;
  if (target.depthTexture) target.depthTexture.minFilter = target.depthTexture.magFilter = NearestFilter;
}

/** Check only on allocation/resize, before drawing the world. Retain the ordinary depth buffer on failure. */
export function validateWorldDepthTexture(renderer: WebGLRenderer, target: WebGLRenderTarget) {
  if (!target.depthTexture) return;
  const previous = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel();
  const gl = renderer.getContext();
  try {
    renderer.setRenderTarget(target);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) setWorldDepthTexture(target, false);
  } finally {
    renderer.setRenderTarget(previous, face, level);
  }
}
