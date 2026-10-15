/** Seeded PRNG (mulberry32). Sim code uses this, never Math.random, so runs are reproducible. */
export function createRng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, maxInclusive: number) => min + Math.floor(next() * (maxInclusive - min + 1)),
  };
}
export type Rng = ReturnType<typeof createRng>;
