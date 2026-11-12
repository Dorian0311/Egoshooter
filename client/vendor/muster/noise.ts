/**
 * Small deterministic noise toolkit for procedural textures and geometry.
 * Everything is seedable and periodic variants tile seamlessly.
 */

/** Mulberry32 PRNG — deterministic, fast. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 1440662683 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Periodic 2D value noise in [0,1]. `period` in lattice cells (integer). */
export function valueNoise2(x: number, y: number, period: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const x0 = mod(xi, period), x1 = mod(xi + 1, period);
  const y0 = mod(yi, period), y1 = mod(yi + 1, period);
  const u = fade(xf), v = fade(yf);
  return lerp(
    lerp(hash2(x0, y0, seed), hash2(x1, y0, seed), u),
    lerp(hash2(x0, y1, seed), hash2(x1, y1, seed), u),
    v,
  );
}

/** Periodic fBm over [0,1)^2 domain; u,v in [0,1). Result roughly in [0,1]. */
export function fbm2(u: number, v: number, baseFreq: number, octaves: number, seed = 0, gain = 0.5): number {
  let amp = 1, sum = 0, norm = 0, f = baseFreq;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2(u * f, v * f, f, seed + o * 31);
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

/** 3D value noise in [0,1] (non-periodic). */
export function valueNoise3(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/** 3D fBm, result roughly in [0,1]. */
export function fbm3(x: number, y: number, z: number, octaves = 4, seed = 0): number {
  let amp = 1, sum = 0, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise3(x * f, y * f, z * f, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** Periodic Worley (cellular) noise F1 distance in [0,~1]. */
export function worley2(u: number, v: number, cells: number, seed = 0): number {
  const x = u * cells, y = v * cells;
  const xi = Math.floor(x), yi = Math.floor(y);
  let best = 9;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy;
      const px = cx + hash2(mod(cx, cells), mod(cy, cells), seed);
      const py = cy + hash2(mod(cx, cells), mod(cy, cells), seed + 101);
      const d = Math.hypot(px - x, py - y);
      if (d < best) best = d;
    }
  }
  return Math.min(1, best);
}
