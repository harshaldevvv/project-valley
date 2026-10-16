import { BufferGeometry, ExtrudeGeometry, Shape, Vector3 } from 'three';
import { yard } from '../../../content/data/yard';
import type { Kit } from '../kit';
import { plateSign, stationSign, text } from '../signs';

const S = yard.stations.range; // firing line z=-12, lane x -15..15, runs north to the wall

/** Wedge prism (cross-section in Z/Y) extruded across X from x0 to x1: berms and ramps. */
export function wedge(x0: number, x1: number, profile: [z: number, y: number][]): BufferGeometry {
  const shape = new Shape(profile.map(([z, y]) => ({ x: z, y })) as never);
  // Shape is in XY; extrude along +Z then rotate so shape-X -> world Z and extrusion -> world X.
  return new ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false })
    .rotateY(-Math.PI / 2)
    .translate(x1, 0, 0);
}

/** Column centre (x offset from the lane centre) per target distance. Sight lines from the bench checked. */
const LANE_X: Record<number, number> = { 5: -4.25, 25: 0.1, 80: 9.75 };

export async function buildRange(kit: Kit) {
  const half = S.w / 2;
  const far = -yard.half + 0.4; // inner face of the north wall
  const front = S.z;

  // Firing platform (behind the line), firing line, gravel lane.
  kit.pad(S.w, 6, S.x, front + 3);
  kit.strip(S.x - half, front, S.x + half, front, 0.2, 0.05, 'hazard_yellow', 0.8);
  kit.pad(S.w, front - far, S.x, (front + far) / 2, 'dirt', 0.02, 0.4);

  // Side walls (stop strays into the loot/pen stations) and the earth berm behind the 80 m targets.
  for (const sx of [-1, 1]) kit.box(0.3, 2.4, front - 2 - far, 'concrete', S.x + sx * (half + 0.15), 0, (front - 2 + far) / 2, 0, true);
  const berm = kit.paint(wedge(S.x - half, S.x + half, [[far, 0], [far + 6, 0], [far + 1.6, 4.5], [far, 4.5]]), 'dirt');
  kit.hull(berm, 'dirt');

  // Bench at the firing line, weapon rack beside it.
  kit.place({ id: 'env_bench_shooting_a', size: [2, 0.9, 0.8], x: S.x, z: front + 0.6 });
  const rack = { id: 'prop_weapon_rack_a', size: [1.6, 1.6, 0.5] as [number, number, number], x: S.x - 4, z: front + 3.5, yaw: Math.PI };
  const rackObj = await kit.model(rack); // keeps the GUNS part (always visible: the rack refills)
  kit.game.places.containers.push({ id: 'range_weapon_rack', type: 'weapon_rack', object: rackObj, position: new Vector3(rack.x, 0, rack.z) });

  // Targets: plate (left) + dummy (right) at each distance, distance line and marker post.
  for (const d of S.targetDistances) {
    const tz = front - d;
    // Staggered columns (QA-043): 5 m left, 25 m centre, 80 m right, so no target hides another from the bench.
    const col = LANE_X[d] ?? 0;
    for (const [kind, id, dx, depth] of [['plate', 'prop_target_plate_a', col - 1.25, 0.3], ['dummy', 'prop_target_dummy_a', col + 1.25, 0.4]] as const) {
      const size: [number, number, number] = kind === 'plate' ? [0.92, 1.88, 0.34] : [0.6, 1.8, depth];
      const object = kind === 'plate' ? await kit.model({ id, size, x: S.x + dx, z: tz, yaw: Math.PI }) : await kit.one({ id, size, x: S.x + dx, z: tz, yaw: Math.PI });
      // Plates hang from the gallows bar: mechanics swings userData.hinge.rotation.x (the PLATE part node,
      // pivot on the bar; negative = bottom kicks downrange).
      if (kind === 'plate') object.userData.hinge = object.getObjectByName('PLATE') ?? null;
      kit.game.places.targets.push({ id: `range_${kind}_${d}`, object, distance: d, kind });
    }
    kit.strip(S.x - half, tz + 1, S.x + half, tz + 1, 0.15, 0.04, 'paint_white_faded', 0.7);
    plateSign(kit, { title: `${d} m` }, S.x - half + 1.2, tz + 1.4, Math.PI);
    plateSign(kit, { title: `${d} m` }, S.x + half - 1.2, tz + 1.4, Math.PI);
  }

  // "LANE 1" plate on the shooter's side of the bench.
  text({ title: 'LANE 1', bg: '#c9a744', fg: '#262626' }, 0.6, 0.3, S.x, 0.6, front + 0.6, Math.PI, -0.41);

  stationSign(kit, 'range', S.x + 7, front + 5.5);
}
