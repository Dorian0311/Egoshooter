/**
 * "Surface" materials: MeshStandard/MeshPhysical materials extended with UV-free,
 * object-space procedural detail so that procedurally modelled parts (with arbitrary UVs)
 * still get believable, consistent surfaces:
 *
 *  - albedo & roughness variation from 3D noise (object space, so it is stable per model)
 *  - triplanar tiling detail normal maps (cloth weave, leather grain, cast texture, …)
 *  - procedural noise bump
 *  - procedural wood grain along a chosen axis
 *  - soft sprayed camouflage from 3D noise (up to two extra colours)
 *  - dust that settles on lower parts and upward-facing surfaces
 *  - edge wear on convex edges (uses the `aEdge` attribute written by bake.ts)
 *  - cavity darkening on concave creases (also from `aEdge`)
 *
 * All parameters are plain numbers/colours so assets stay declarative.
 */
import * as THREE from 'three';
import { detailTexture, type DetailKind } from './textures';

export interface SurfaceParams {
  color: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  /** Multiplicative albedo variation amount (0..0.5). */
  colorVar?: number;
  /** Noise frequency for colour variation in cycles per metre. */
  varScale?: number;
  /** Roughness variation amount (0..0.5). */
  roughVar?: number;

  detail?: DetailKind;
  /** Metres covered by one tile of the detail texture. */
  detailSize?: number;
  /** Detail normal strength (0..2). */
  detailStrength?: number;

  /** Procedural bump amplitude (0..1) and frequency (cycles per metre). */
  bump?: number;
  bumpScale?: number;

  /** Procedural wood grain. axis is the long grain direction in object space. */
  wood?: { axis: [number, number, number]; dark: THREE.ColorRepresentation; ringFreq?: number; figure?: number };

  /** Soft sprayed camouflage. */
  camo?: {
    colors: [THREE.ColorRepresentation] | [THREE.ColorRepresentation, THREE.ColorRepresentation];
    /** Blotch frequency in cycles per metre (e.g. 0.6 for tank-sized patches). */
    scale: number;
    /** Coverage of each extra colour (0..1). */
    coverage?: [number, number?];
    /** Edge softness (0 = hard, 0.15 = soft spray). */
    softness?: number;
    seed?: number;
  };

  /** Dust amount (0..1), height (m) below which dust accumulates, and colour. */
  dust?: number;
  dustHeight?: number;
  dustColor?: THREE.ColorRepresentation;

  /** Edge wear (0..1): convex edges reveal wearColor with wearMetalness/wearRoughness. */
  wear?: number;
  wearColor?: THREE.ColorRepresentation;
  wearMetalness?: number;
  wearRoughness?: number;

  /** Concave crease darkening (0..1). */
  cavity?: number;

  /** Physical extras (switches to MeshPhysicalMaterial when any is set). */
  sheen?: number;
  sheenColor?: THREE.ColorRepresentation;
  sheenRoughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;

  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  vertexColors?: boolean;
  /** Optional name for debugging / merge grouping. */
  name?: string;
}

const VERT_PARS = /* glsl */ `
attribute vec2 aEdge;
varying vec3 vSrfPos;
varying vec3 vSrfNrm;
varying vec2 vSrfEdge;
`;
const VERT_MAIN = /* glsl */ `
vSrfPos = transformed;
vSrfNrm = objectNormal;
vSrfEdge = aEdge;
`;

const FRAG_PARS = /* glsl */ `
uniform mat3 normalMatrix;
varying vec3 vSrfPos;
varying vec3 vSrfNrm;
varying vec2 vSrfEdge;
uniform float uSrfColorVar;
uniform float uSrfVarScale;
uniform float uSrfRoughVar;
uniform float uSrfDust;
uniform float uSrfDustHeight;
uniform vec3 uSrfDustColor;
uniform float uSrfWear;
uniform vec3 uSrfWearColor;
uniform float uSrfWearMetal;
uniform float uSrfWearRough;
uniform float uSrfCavity;
#ifdef SRF_DETAIL
uniform sampler2D uSrfDetail;
uniform float uSrfDetailScale;
uniform float uSrfDetailStrength;
#endif
#ifdef SRF_BUMP
uniform float uSrfBump;
uniform float uSrfBumpScale;
#endif
#ifdef SRF_WOOD
uniform vec3 uSrfWoodAxis;
uniform vec3 uSrfWoodDark;
uniform float uSrfWoodRing;
uniform float uSrfWoodFigure;
#endif
#ifdef SRF_CAMO
uniform vec3 uSrfCamo1;
uniform vec3 uSrfCamo2;
uniform float uSrfCamoScale;
uniform vec2 uSrfCamoCover;
uniform float uSrfCamoSoft;
uniform float uSrfCamoSeed;
#endif

float srfHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float srfNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(srfHash(i), srfHash(i + vec3(1,0,0)), f.x), mix(srfHash(i + vec3(0,1,0)), srfHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(srfHash(i + vec3(0,0,1)), srfHash(i + vec3(1,0,1)), f.x), mix(srfHash(i + vec3(0,1,1)), srfHash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float srfFbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * srfNoise(p); p = p * 2.03 + vec3(17.1, 3.7, 9.2); a *= 0.5; }
  return s / 0.9375;
}
vec3 srfBumpNormal(vec3 surfPos, vec3 surfNorm, float h, float scale) {
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1);
  vec2 dh = vec2(dFdx(h), dFdy(h)) * scale;
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

// Computes shared factors once; injected right after <color_fragment>.
const FRAG_COLOR = /* glsl */ `
vec3 srfN = normalize(vSrfNrm);
float srfVarN = srfFbm(vSrfPos * uSrfVarScale);
float srfFine = srfNoise(vSrfPos * uSrfVarScale * 7.3 + 5.0);
#ifdef SRF_WOOD
{
  vec3 ax = normalize(uSrfWoodAxis);
  vec3 q = vSrfPos - ax * dot(vSrfPos, ax);
  float along = dot(vSrfPos, ax);
  float warp = srfFbm(vSrfPos * vec3(14.0) + ax * 2.0) * uSrfWoodFigure;
  float rings = fract(length(q) * uSrfWoodRing + warp * 2.2 + along * 0.6);
  // thin darker latewood lines on a lighter earlywood ground
  float late = smoothstep(0.72, 0.9, rings) * (1.0 - smoothstep(0.93, 1.0, rings));
  // fine straight pore streaks running along the grain
  float streak = srfNoise(vec3(q * 1400.0) + ax * along * 6.0);
  float broad = srfFbm(vec3(q * 60.0) + ax * along * 1.5);
  float woodT = clamp(0.55 * late + 0.25 * streak * streak + 0.3 * (broad - 0.5), 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSrfWoodDark, woodT * 0.6);
}
#endif
#ifdef SRF_CAMO
{
  vec3 cp = vSrfPos * uSrfCamoScale + vec3(uSrfCamoSeed);
  float c1 = srfFbm(cp);
  float c2 = srfFbm(cp * 1.37 + vec3(41.0, 7.0, 13.0));
  float s = max(uSrfCamoSoft, 0.001);
  float m1 = smoothstep(1.0 - uSrfCamoCover.x - s, 1.0 - uSrfCamoCover.x + s, c1);
  float m2 = smoothstep(1.0 - uSrfCamoCover.y - s, 1.0 - uSrfCamoCover.y + s, c2) * (1.0 - m1);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSrfCamo1, m1);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSrfCamo2, m2);
}
#endif
diffuseColor.rgb *= mix(1.0 - uSrfColorVar, 1.0 + uSrfColorVar, srfVarN) * mix(0.97, 1.03, srfFine);
// cavity darkening
float srfCav = clamp(vSrfEdge.y, 0.0, 1.0) * uSrfCavity;
diffuseColor.rgb *= 1.0 - 0.55 * srfCav;
// edge wear on convex edges, broken up by noise
float srfWearN = srfNoise(vSrfPos * 70.0) * 0.6 + srfNoise(vSrfPos * 190.0) * 0.4;
float srfWear = uSrfWear * smoothstep(0.35, 0.75, clamp(vSrfEdge.x, 0.0, 1.0) * (0.35 + 1.1 * srfWearN));
diffuseColor.rgb = mix(diffuseColor.rgb, uSrfWearColor, srfWear);
// dust: lower parts and upward-facing surfaces
float srfDustMask = 0.0;
if (uSrfDust > 0.0) {
  float low = 1.0 - smoothstep(0.0, max(uSrfDustHeight, 0.01), vSrfPos.y);
  float up = smoothstep(0.35, 0.95, srfN.y);
  float breakup = smoothstep(0.3, 0.8, srfFbm(vSrfPos * uSrfVarScale * 2.1 + 3.3));
  srfDustMask = clamp(uSrfDust * (0.75 * low + 0.45 * up) * (0.35 + 0.65 * breakup), 0.0, 0.85);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSrfDustColor, srfDustMask);
}
`;

const FRAG_ROUGH = /* glsl */ `
roughnessFactor = clamp(roughnessFactor * mix(1.0 - uSrfRoughVar, 1.0 + uSrfRoughVar, srfVarN), 0.03, 1.0);
roughnessFactor = mix(roughnessFactor, uSrfWearRough, srfWear);
roughnessFactor = mix(roughnessFactor, 0.97, srfDustMask);
`;
const FRAG_METAL = /* glsl */ `
metalnessFactor = mix(metalnessFactor, uSrfWearMetal, srfWear);
metalnessFactor = mix(metalnessFactor, 0.0, srfDustMask);
`;

const FRAG_NORMAL = /* glsl */ `
#ifdef SRF_DETAIL
{
  vec3 bw = pow(abs(srfN), vec3(4.0));
  bw /= (bw.x + bw.y + bw.z);
  vec3 p = vSrfPos * uSrfDetailScale;
  vec3 tx = texture2D(uSrfDetail, p.zy).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(uSrfDetail, p.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(uSrfDetail, p.xy).xyz * 2.0 - 1.0;
  tx.xy *= uSrfDetailStrength; ty.xy *= uSrfDetailStrength; tz.xy *= uSrfDetailStrength;
  // whiteout blend (Ben Golus), object space
  vec3 nx = vec3(tx.xy + srfN.zy, abs(tx.z) * abs(srfN.x));
  vec3 ny = vec3(ty.xy + srfN.xz, abs(ty.z) * abs(srfN.y));
  vec3 nz = vec3(tz.xy + srfN.xy, abs(tz.z) * abs(srfN.z));
  nx.z *= sign(srfN.x); ny.z *= sign(srfN.y); nz.z *= sign(srfN.z);
  vec3 objN = normalize(nx.zyx * bw.x + ny.xzy * bw.y + nz.xyz * bw.z);
  // fade detail with distance to avoid shimmer
  float srfFade = 1.0 - smoothstep(0.35, 1.0, length(fwidth(p)) * 1.2);
  vec3 dn = normalize(normalMatrix * objN);
  #ifdef DOUBLE_SIDED
    dn *= faceDirection;
  #endif
  normal = normalize(mix(normal, dn, srfFade));
}
#endif
#ifdef SRF_BUMP
{
  float h = srfFbm(vSrfPos * uSrfBumpScale);
  float fade = 1.0 - smoothstep(0.4, 1.2, length(fwidth(vSrfPos * uSrfBumpScale)));
  normal = srfBumpNormal(-vViewPosition, normal, h, uSrfBump * 0.02 * fade);
}
#endif
`;

let materialSerial = 0;

/** Create a surface material. Returns MeshPhysicalMaterial if physical extras are used. */
export function surface(p: SurfaceParams): THREE.MeshStandardMaterial {
  const physical = p.sheen !== undefined || p.clearcoat !== undefined;
  const common: THREE.MeshStandardMaterialParameters = {
    color: new THREE.Color(p.color),
    roughness: p.roughness ?? 0.7,
    metalness: p.metalness ?? 0,
    side: p.side ?? THREE.FrontSide,
    transparent: p.transparent ?? false,
    opacity: p.opacity ?? 1,
    vertexColors: p.vertexColors ?? false,
  };
  const mat: THREE.MeshStandardMaterial = physical
    ? new THREE.MeshPhysicalMaterial({
        ...common,
        sheen: p.sheen ?? 0,
        sheenColor: new THREE.Color(p.sheenColor ?? 0xffffff),
        sheenRoughness: p.sheenRoughness ?? 0.8,
        clearcoat: p.clearcoat ?? 0,
        clearcoatRoughness: p.clearcoatRoughness ?? 0.3,
      })
    : new THREE.MeshStandardMaterial(common);
  mat.name = p.name ?? `surface-${materialSerial++}`;

  const u = {
    uSrfColorVar: { value: p.colorVar ?? 0.06 },
    uSrfVarScale: { value: p.varScale ?? 3.0 },
    uSrfRoughVar: { value: p.roughVar ?? 0.12 },
    uSrfDust: { value: p.dust ?? 0 },
    uSrfDustHeight: { value: p.dustHeight ?? 0.8 },
    uSrfDustColor: { value: new THREE.Color(p.dustColor ?? 0x9a8a72) },
    uSrfWear: { value: p.wear ?? 0 },
    uSrfWearColor: { value: new THREE.Color(p.wearColor ?? 0x4a4845) },
    uSrfWearMetal: { value: p.wearMetalness ?? 0.6 },
    uSrfWearRough: { value: p.wearRoughness ?? 0.45 },
    uSrfCavity: { value: p.cavity ?? 0.35 },
    uSrfDetail: { value: p.detail ? detailTexture(p.detail) : null },
    uSrfDetailScale: { value: 1 / (p.detailSize ?? 0.02) },
    uSrfDetailStrength: { value: p.detailStrength ?? 1 },
    uSrfBump: { value: p.bump ?? 0 },
    uSrfBumpScale: { value: p.bumpScale ?? 200 },
    uSrfWoodAxis: { value: new THREE.Vector3(...(p.wood?.axis ?? [0, 0, 1])) },
    uSrfWoodDark: { value: new THREE.Color(p.wood?.dark ?? 0x3a2414) },
    uSrfWoodRing: { value: p.wood?.ringFreq ?? 160 },
    uSrfWoodFigure: { value: p.wood?.figure ?? 0.6 },
    uSrfCamo1: { value: new THREE.Color(p.camo?.colors[0] ?? 0x000000) },
    uSrfCamo2: { value: new THREE.Color(p.camo?.colors[1] ?? p.camo?.colors[0] ?? 0x000000) },
    uSrfCamoScale: { value: p.camo?.scale ?? 0.5 },
    uSrfCamoCover: {
      value: new THREE.Vector2(p.camo?.coverage?.[0] ?? 0.3, p.camo?.colors[1] ? (p.camo?.coverage?.[1] ?? 0.25) : 0),
    },
    uSrfCamoSoft: { value: p.camo?.softness ?? 0.06 },
    uSrfCamoSeed: { value: p.camo?.seed ?? 3.0 },
  };

  mat.defines = mat.defines ?? {};
  if (p.detail) mat.defines.SRF_DETAIL = '';
  if (p.bump) mat.defines.SRF_BUMP = '';
  if (p.wood) mat.defines.SRF_WOOD = '';
  if (p.camo) mat.defines.SRF_CAMO = '';

  mat.userData.surface = { params: p, uniforms: u };
  mat.customProgramCacheKey = () => 'srf-v1';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + FRAG_ROUGH)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + FRAG_METAL)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL);
  };
  return mat;
}

/** Update a surface material's parameter at runtime (e.g. dust slider in the harness). */
export function setSurfaceUniform(mat: THREE.Material, name: string, value: number | THREE.Color) {
  const u = mat.userData?.surface?.uniforms?.[name];
  if (!u) return;
  if (value instanceof THREE.Color) u.value.copy(value);
  else u.value = value;
}
