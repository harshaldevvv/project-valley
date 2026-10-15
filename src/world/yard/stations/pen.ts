import { CylinderGeometry } from 'three';
import { yard } from '../../../content/data/yard';
import type { Kit } from '../kit';
import { plateSign, stationSign } from '../signs';

const S = yard.stations.pen; // 24 x 24 at (40,-15); gate on the west side (faces spawn)
const PANEL = 3;

export function buildPen(kit: Kit) {
  const { x, z } = S;
  const hw = S.w / 2, hd = S.d / 2;
  kit.pad(S.w + 1, S.d + 1, x, z, 'mud', 0.03, 0.5);

  const n = S.w / PANEL;
  for (let i = 0; i < n; i++) {
    const o = -hw + PANEL / 2 + i * PANEL;
    kit.place({ id: 'env_fence_chainlink_a', size: [3, 2.2, 0.08], x: x + o, z: z - hd }); // north
    kit.place({ id: 'env_fence_chainlink_a', size: [3, 2.2, 0.08], x: x + o, z: z + hd }); // south
    kit.place({ id: 'env_fence_chainlink_a', size: [3, 2.2, 0.08], x: x + hw, z: z + o, yaw: Math.PI / 2 }); // east
    const gate = i === n / 2 - 1;
    kit.place({ id: gate ? 'env_gate_chainlink_a' : 'env_fence_chainlink_a', size: [3, 2.2, 0.08], x: x - hw, z: z + o, yaw: Math.PI / 2 }); // west (front faces spawn)
  }
  // Corner posts.
  for (const [cx, cz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) kit.box(0.14, 2.5, 0.14, 'metal_dark', x + cx, 0, z + cz);

  // A little cover inside: barrels and a concrete block, so pathing isn't a featureless square.
  for (const [bx, bz, sw] of [[4, -6, 'rust'], [4.7, -5.5, 'rust_dark'], [-5, 5, 'paint_red_faded']] as const) {
    kit.paint(new CylinderGeometry(0.3, 0.3, 0.9, 10).translate(x + bx, 0.45, z + bz), sw);
    kit.cuboid(0.3, 0.45, 0.3, x + bx, 0.45, z + bz);
  }
  kit.box(2, 0.8, 0.8, 'concrete', x + 5, 0, z + 4, 0.4, true);

  // Warning notice beside the gate, station sign further out.
  plateSign(kit, { title: 'DANGER', sub: 'INFECTED INSIDE - KEEP GATE SHUT', bg: '#b3122a', fg: '#e6e3da' }, x - hw - 0.4, z - 4.6, Math.PI / 2, 1.8);
  stationSign(kit, 'pen', x - hw - 4, z + hd - 2);
}
