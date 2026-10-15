import { yard } from '../../content/data/yard';
import type { Kit, Placement } from './kit';

const SEG = 4; // env_wall_concrete_a is 4 m long
const SIZE: [number, number, number] = [4, 3, 0.3];
const GATE_HALF = 4; // south gate opening x ∈ [-4, 4]

/** Perimeter wall segments around ±yard.half (plain data: swap to engine instancing in one place). */
export const wallPlacements: Placement[] = [];
for (let o = -yard.half + SEG / 2; o < yard.half; o += SEG) {
  const h = yard.half;
  wallPlacements.push({ id: 'env_wall_concrete_a', size: SIZE, x: o, z: -h, yaw: Math.PI }); // north (fronts face inward)
  wallPlacements.push({ id: 'env_wall_concrete_a', size: SIZE, x: h, z: o, yaw: Math.PI / 2 }); // east
  wallPlacements.push({ id: 'env_wall_concrete_a', size: SIZE, x: -h, z: o, yaw: -Math.PI / 2 }); // west
  if (Math.abs(o) > GATE_HALF) wallPlacements.push({ id: 'env_wall_concrete_a', size: SIZE, x: o, z: h }); // south
}

export function buildWalls(kit: Kit) {
  for (const p of wallPlacements) kit.place(p);
  // South gate: two concrete pillars and a closed pair of chain-link gates (the "way out" for later milestones).
  const h = yard.half;
  for (const sx of [-1, 1]) {
    kit.box(0.8, 3.6, 0.8, 'concrete', sx * (GATE_HALF - 0.4), 0, h, 0, true);
    kit.box(0.9, 0.15, 0.9, 'concrete_dark', sx * (GATE_HALF - 0.4), 3.6, h);
    kit.place({ id: 'env_gate_chainlink_a', size: [3, 2.2, 0.08], x: sx * 1.5, z: h, yaw: Math.PI });
  }
  // Corner pillars hide the segment overlaps.
  for (const [cx, cz] of [[-h, -h], [h, -h], [-h, h], [h, h]]) kit.box(0.7, 3.3, 0.7, 'concrete_dark', cx, 0, cz, 0, false, 0.5);
}
