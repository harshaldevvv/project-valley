import { Box3, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Game } from '../../core/game';
import { pfWorldMaterial } from '../../engine/palette';
import type { Surface } from '../surfaces';
import { groundHeight } from './ground';
import type { Kit } from './kit';
import { loadPfGeometry } from './pfModels';

/**
 * Set dressing from the Polyfork catalog (CC BY 4.0, CREDITS.md), instanced per model so a whole field of junk costs
 * a draw call per type: abandoned cars, roadblocks, fence runs, poles, hay, graves. Solid ones get a rotated box
 * collider from their bounding box. A checkpoint sits outside the south gate; the gate approach itself stays clear.
 */
type Spot = { x: number; z: number; yaw: number; s?: number };
const DRESS: Record<string, { surface: Surface; solid: boolean; at: Spot[] }> = {
  car_hatch: { surface: 'metal', solid: true, at: [{ x: -48, z: 74, yaw: 0.6 }, { x: 78, z: -38, yaw: 2.2 }] },
  car_pickup: { surface: 'metal', solid: true, at: [{ x: 30, z: -76, yaw: -0.4 }, { x: -22, z: 52, yaw: 1.5 }] },
  car_jeep: { surface: 'metal', solid: true, at: [{ x: 84, z: 18, yaw: 0.2 }, { x: -86, z: -64, yaw: 2.9 }] },
  car_cruiser: { surface: 'metal', solid: true, at: [{ x: -9, z: 113, yaw: 0.25 }, { x: 14, z: 118, yaw: -0.3 }] },
  barricade_police: { surface: 'wood', solid: true, at: [{ x: -6.5, z: 108, yaw: 0.1 }, { x: 6.5, z: 108, yaw: -0.15 }, { x: 0, z: 112, yaw: 3.14 }] },
  barrier_jersey: { surface: 'concrete', solid: true, at: [{ x: -11, z: 106, yaw: 1.4 }, { x: 11, z: 106, yaw: 1.7 }, { x: -13, z: 103, yaw: 0.2 }, { x: 13, z: 103, yaw: -0.2 }] },
  barricade_field: { surface: 'wood', solid: true, at: [{ x: 38, z: -40, yaw: 0.4 }, { x: -52, z: 22, yaw: -0.8 }] },
  cone: { surface: 'rubber', solid: false, at: [{ x: -3, z: 103, yaw: 0 }, { x: 3, z: 103, yaw: 0 }, { x: -2, z: 106, yaw: 0 }, { x: 2.5, z: 106.5, yaw: 0 }, { x: 40, z: 22, yaw: 0 }, { x: 43, z: 24, yaw: 0 }] },
  firewood: { surface: 'wood', solid: true, at: [{ x: -76, z: 66, yaw: 0.2 }, { x: -64, z: -32, yaw: -0.4 }] },
  hay_bale: { surface: 'dirt', solid: true, at: [{ x: -63, z: 70, yaw: 0.4 }, { x: -61, z: 71.5, yaw: 1.2 }, { x: -62, z: 70.5, yaw: 0 }, { x: -78, z: 70, yaw: 0.9 }] },
  utility_pole: { surface: 'wood', solid: true, at: [{ x: 20, z: 96, yaw: 0 }, { x: 60, z: 96, yaw: 0 }, { x: 96, z: 60, yaw: 1.57 }, { x: 96, z: 20, yaw: 1.57 }] },
  stump: { surface: 'wood', solid: true, at: [{ x: -58, z: -46, yaw: 0.5 }, { x: 62, z: 78, yaw: 2 }, { x: -34, z: 80, yaw: 1 }] },
  trolley: { surface: 'metal', solid: false, at: [{ x: 70, z: -66, yaw: 1 }, { x: 62, z: -57, yaw: 2.5 }] },
  mailbox: { surface: 'metal', solid: true, at: [{ x: -66, z: 74, yaw: 0 }] },
  bus_shelter: { surface: 'metal', solid: true, at: [{ x: 8, z: 98, yaw: 3.14 }] },
  rubble: { surface: 'concrete', solid: false, at: [{ x: -80, z: 40, yaw: 0.3 }, { x: 52, z: 72, yaw: 2.4 }, { x: 90, z: -28, yaw: 1.1 }] },
  grave: { surface: 'dirt', solid: false, at: [{ x: -80, z: -30, yaw: 0 }, { x: -78.5, z: -30.5, yaw: 0.15 }, { x: -77, z: -30, yaw: -0.1 }, { x: -75.5, z: -30.6, yaw: 0.05 }] },
  trash_can: { surface: 'metal', solid: false, at: [{ x: 11, z: 98, yaw: 0 }, { x: 62, z: -70, yaw: 0 }] },
};
/** Straight fence runs: key, from x,z, to x,z. The model's own length sets the spacing. */
const RUNS: [string, number, number, number, number][] = [
  ['fence_board', -82, 56, -82, 78],
  ['fence_barbed', -30, 110, -14, 110],
  ['fence_barbed', 14, 110, 30, 110],
];

const dressSpots = Object.values(DRESS).flatMap((d) => d.at.map((a) => ({ x: a.x, z: a.z })));
/** True when x,z is under a dressing piece (the grass scatter keeps clear of them). */
export const underDress = (x: number, z: number, pad = 1.2) => dressSpots.some((a) => Math.hypot(x - a.x, z - a.z) < 1.8 + pad);

export async function buildDress(game: Game, kit: Kit) {
  const mat = await pfWorldMaterial();
  const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), p = new Vector3(), sc = new Vector3();
  const place = async (key: string, surface: Surface, solid: boolean, spots: Spot[]) => {
    const g = await loadPfGeometry(key);
    if (!g || !spots.length) return;
    g.geo.computeBoundingBox();
    const bb = g.geo.boundingBox as Box3;
    const size = bb.getSize(new Vector3());
    const inst = new InstancedMesh(g.geo, mat, spots.length);
    inst.name = `dress_${key}_x${spots.length}`;
    spots.forEach((a, i) => {
      const s = a.s ?? 1;
      q.setFromAxisAngle(up, a.yaw);
      sc.setScalar(s);
      p.set(a.x, groundHeight(a.x, a.z) - 0.03, a.z);
      inst.setMatrixAt(i, m.compose(p, q, sc));
      if (solid) {
        const c = bb.getCenter(new Vector3()).multiplyScalar(s).applyAxisAngle(up, a.yaw);
        kit.cuboid((size.x / 2) * s * 0.9, (size.y / 2) * s, (size.z / 2) * s * 0.9, a.x + c.x, p.y + c.y, a.z + c.z, a.yaw, surface);
      }
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    game.scene.add(inst);
  };
  for (const [key, d] of Object.entries(DRESS)) await place(key, d.surface, d.solid, d.at);
  for (const [key, x0, z0, x1, z1] of RUNS) {
    const g = await loadPfGeometry(key);
    if (!g) continue;
    g.geo.computeBoundingBox();
    const sz = (g.geo.boundingBox as Box3).getSize(new Vector3());
    const len = Math.max(sz.x, sz.z) * 0.98;
    const total = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.floor(total / len));
    const yaw = Math.atan2(-(z1 - z0), x1 - x0) + (sz.x >= sz.z ? 0 : Math.PI / 2);
    const spots: Spot[] = Array.from({ length: n }, (_, i) => ({ x: x0 + ((x1 - x0) * (i + 0.5)) / n, z: z0 + ((z1 - z0) * (i + 0.5)) / n, yaw }));
    await place(key, 'wood', false, spots);
  }
}
