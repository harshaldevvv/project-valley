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
    // the gate stands open: both leaves swung back inside, flat against the road verge
    kit.place({ id: 'env_gate_chainlink_a', size: [3, 2.2, 0.08], x: sx * 2.9, z: h - 1.6, yaw: Math.PI / 2 });
  }
  // Invisible ceiling along the whole perimeter (QA-082): a 12 m tall blocker on the wall line, so nothing in
  // the yard (berm, ramp, stacked crates, roofs, built stairs) can be used to climb or jump over the wall.
  const H = 12;
  for (const [x, z, hx, hz] of [[0, -h, h, 0.15], [-h, 0, 0.15, h], [h, 0, 0.15, h]]) kit.cuboid(hx, H / 2, hz, x, H / 2, z);
  // south side: the gate is open to the outskirts, so the blocker leaves a 6.4 m gap (with a lintel above 5 m)
  const gap = GATE_HALF - 0.8;
  for (const sx of [-1, 1]) kit.cuboid((h - gap) / 2, H / 2, 0.15, sx * (gap + (h - gap) / 2), H / 2, h);
  kit.cuboid(gap, (H - 5) / 2, 0.15, 0, 5 + (H - 5) / 2, h);

  // Corner pillars hide the segment overlaps.
  for (const [cx, cz] of [[-h, -h], [h, -h], [-h, h], [h, h]]) kit.box(0.7, 3.3, 0.7, 'concrete_dark', cx, 0, cz, 0, false, 0.5);
}
