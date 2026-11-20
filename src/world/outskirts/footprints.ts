import { CLEAR_RECTS, ROADS } from '../../content/data/outskirts';

/** Circles under placed models and buildings (filled by buildOutskirts); scatter code keeps trees and grass clear of them. */
export const footprints: { x: number; z: number; r: number }[] = [];

const segDist = (x: number, z: number, ax: number, az: number, bx: number, bz: number) => {
  const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
  const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
  return Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
};
/** Distance from x,z to the nearest road centreline minus that road's half width. */
export const roadClearance = (x: number, z: number) => Math.min(...ROADS.map((r) => segDist(x, z, r.ax, r.az, r.bx, r.bz) - r.w / 2));
export const inClearRect = (x: number, z: number, pad = 0) => CLEAR_RECTS.some(([x0, x1, z0, z1]) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad);
/** True when x,z is under a footprint (+pad) or on a road. */
export const underOutskirts = (x: number, z: number, pad = 0.6) => footprints.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + pad) || roadClearance(x, z) < pad;
