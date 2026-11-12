/**
 * Procedural, seamlessly tiling detail textures generated at startup (no external files).
 * Detail maps are tangent-space normal maps (RGB) with a height copy in alpha.
 */
import * as THREE from 'three';
import { fbm2, valueNoise2, worley2 } from './noise';

export type DetailKind = 'twill' | 'plain' | 'webbing' | 'leather' | 'cast' | 'fine' | 'knit' | 'wood' | 'soil';

const cache = new Map<string, THREE.DataTexture>();
let maxAnisotropy = 8;
export function setMaxAnisotropy(n: number) {
  maxAnisotropy = n;
  for (const t of cache.values()) {
    t.anisotropy = n;
    t.needsUpdate = true;
  }
}

function heightToNormalTexture(h: Float32Array, size: number, strength: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sobel gradient
      const dx =
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[i + 3] = Math.round(Math.min(1, Math.max(0, at(x, y))) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Thread cross-section profile: 1 at centre, 0 at the edges. */
const thread = (t: number) => Math.sqrt(Math.max(0, Math.sin(Math.PI * t)));

function weaveHeight(size: number, threads: number, pattern: (i: number, j: number) => boolean, fuzz: number, seed: number) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const fx = u * threads, fy = v * threads;
      const i = Math.floor(fx), j = Math.floor(fy);
      const lx = fx - i, ly = fy - j;
      const warpUp = pattern(i, j);
      // warp threads run along v (vertical), weft along u (horizontal)
      const warp = thread(lx) * (0.55 + 0.45 * thread(ly));
      const weft = thread(ly) * (0.55 + 0.45 * thread(lx));
      let val = warpUp ? 0.35 + 0.65 * warp : 0.35 + 0.65 * weft;
      const lower = warpUp ? weft * 0.35 : warp * 0.35;
      val = Math.max(val, lower);
      val += (fbm2(u, v, threads * 2, 3, seed) - 0.5) * fuzz;
      h[y * size + x] = val;
    }
  }
  return h;
}

function build(kind: DetailKind): THREE.DataTexture {
  const size = 512;
  switch (kind) {
    case 'twill': {
      // 2/2 twill, as used for wool serge / field uniform cloth
      const h = weaveHeight(size, 64, (i, j) => ((i + j) & 3) < 2, 0.25, 11);
      return heightToNormalTexture(h, size, 2.2);
    }
    case 'plain': {
      const h = weaveHeight(size, 64, (i, j) => ((i + j) & 1) === 0, 0.2, 23);
      return heightToNormalTexture(h, size, 2.0);
    }
    case 'webbing': {
      const h = weaveHeight(size, 32, (i, j) => ((i + j) & 1) === 0, 0.15, 37);
      // add ribs along u
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        h[y * size + x] = h[y * size + x] * 0.8 + 0.2 * thread(((x / size) * 16) % 1);
      }
      return heightToNormalTexture(h, size, 2.4);
    }
    case 'leather': {
      const h = new Float32Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const c = worley2(u, v, 48, 5);
        const c2 = worley2(u, v, 110, 9);
        h[y * size + x] = 0.55 * Math.pow(c, 0.6) + 0.25 * c2 + 0.2 * fbm2(u, v, 8, 4, 3);
      }
      return heightToNormalTexture(h, size, 1.6);
    }
    case 'cast': {
      // Cast armour / cast iron: soft irregular pitting
      const h = new Float32Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const a = fbm2(u, v, 6, 5, 71);
        const pits = 1 - Math.pow(1 - worley2(u, v, 40, 77), 3);
        h[y * size + x] = 0.7 * a + 0.3 * pits;
      }
      return heightToNormalTexture(h, size, 3.0);
    }
    case 'fine': {
      // Fine paint texture / orange peel
      const h = new Float32Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        h[y * size + x] = fbm2(u, v, 32, 3, 91) * 0.7 + valueNoise2(u * 128, v * 128, 128, 93) * 0.3;
      }
      return heightToNormalTexture(h, size, 1.2);
    }
    case 'knit': {
      const h = new Float32Array(size * size);
      const n = 48;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const fx = u * n, fy = v * n * 0.75;
        const lx = fx % 1, ly = fy % 1;
        const vshape = thread(Math.abs(((lx * 2) % 1) - ly * 0.5 - 0.25) * 2 % 1);
        h[y * size + x] = 0.7 * vshape + 0.3 * fbm2(u, v, 32, 2, 111);
      }
      return heightToNormalTexture(h, size, 1.8);
    }
    case 'soil': {
      // Compacted earth: fine sand grains, small embedded grit and soft undulation
      const h = new Float32Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const undul = fbm2(u, v, 4, 4, 151);
        const grit = 1 - worley2(u, v, 60, 157);
        const sand = valueNoise2(u * 256, v * 256, 256, 163);
        h[y * size + x] = 0.45 * undul + 0.35 * Math.pow(grit, 3) + 0.2 * sand;
      }
      return heightToNormalTexture(h, size, 2.6);
    }
    case 'wood': {
      // Tangent-space pore streaks along v
      const h = new Float32Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const streak = valueNoise2(u * 96, v * 3, 96, 131);
        const pores = valueNoise2(u * 256, v * 24, 256, 137);
        h[y * size + x] = 0.6 * streak + 0.4 * pores;
      }
      return heightToNormalTexture(h, size, 1.0);
    }
  }
}

/** Cached, tiling detail normal texture (RGB normal, A height). */
export function detailTexture(kind: DetailKind): THREE.DataTexture {
  let t = cache.get(kind);
  if (!t) {
    t = build(kind);
    cache.set(kind, t);
  }
  return t;
}

/**
 * Draw a decal (markings, insignia, numbers) onto a transparent canvas texture.
 * `draw` receives a 2D context sized `px` × `px * aspect`.
 */
export function canvasTexture(
  px: number,
  aspect: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = Math.round(px * aspect);
  const ctx = c.getContext('2d')!;
  draw(ctx, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
