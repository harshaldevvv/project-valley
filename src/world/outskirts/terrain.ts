import { OUT } from '../../content/data/outskirts';

/** Distance (m) from the flat outskirts plateau; 0 inside it. Plain maths, used by the terrain height and the scatter. */
export function plateauDist(x: number, z: number) {
  const dx = Math.max(OUT.x0 - x, x - OUT.x1, 0);
  const dz = Math.max(OUT.z0 - z, z - OUT.z1, 0);
  return Math.hypot(dx, dz);
}
const smooth = (t: number) => t * t * (3 - 2 * t);
/** 0 on the plateau, rising to 1 over OUT.blend m: multiplies the hill height so the outskirts lie flat. */
export const hillFactor = (x: number, z: number) => smooth(Math.min(1, plateauDist(x, z) / OUT.blend));
/** Inside the walkable plateau, `pad` m in from its edge. */
export const inPlateau = (x: number, z: number, pad = 0) => x > OUT.x0 + pad && x < OUT.x1 - pad && z > OUT.z0 + pad && z < OUT.z1 - pad;
