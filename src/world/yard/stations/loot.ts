import { CylinderGeometry, Vector3 } from 'three';
import { yard } from '../../../content/data/yard';
import { loadModel } from '../../../engine/models';
import type { Kit, Placement } from '../kit';
import { stationSign } from '../signs';

const S = yard.stations.loot; // x -47..-23, z -24..-6
const CRATE: [number, number, number] = [1.08, 0.6, 0.62];

/** Container placements (type = container def id). Fronts face south, toward the approach from spawn. */
const containers: (Placement & { type: string })[] = [
  { type: 'crate_wood', id: 'prop_crate_wood_a', size: CRATE, x: S.x - 8, z: S.z - 4, yaw: Math.PI + 0.1 },
  { type: 'crate_wood', id: 'prop_crate_wood_a', size: CRATE, x: S.x - 6.2, z: S.z - 4.3, yaw: Math.PI - 0.2 },
  // stacked exactly on the first one (crate is 0.6 m tall)
  { type: 'crate_wood', id: 'prop_crate_wood_a', size: CRATE, x: S.x - 8, z: S.z - 4, y: CRATE[1] + 0.005, yaw: Math.PI + 0.1 },
  { type: 'cabinet_metal', id: 'prop_cabinet_metal_a', size: [0.9, 1.8, 0.5], x: S.x - 0.6, z: S.z - 6.9, yaw: Math.PI },
  { type: 'cabinet_metal', id: 'prop_cabinet_metal_a', size: [0.9, 1.8, 0.5], x: S.x + 0.6, z: S.z - 6.9, yaw: Math.PI },
  // locked: needs a lockpick (QA-058; systems defines 'cabinet_locked')
  { type: 'cabinet_locked', id: 'prop_cabinet_metal_a', size: [0.9, 1.8, 0.5], x: S.x + 1.8, z: S.z - 6.9, yaw: Math.PI },
  { type: 'duffel', id: 'prop_duffel_bag_a', size: [0.8, 0.35, 0.4], x: S.x + 6.5, z: S.z - 2.8, y: 0.14, yaw: Math.PI + 0.5 },
];

export async function buildLoot(kit: Kit) {
  const { x, z } = S;
  kit.pad(S.w, S.d, x, z);

  // Back wall behind the cabinets (a corner of an old depot) + a lean-to roof.
  kit.box(8, 2.6, 0.25, 'concrete', x, 0, z - 7.6, 0, true);
  kit.box(0.25, 2.6, 4, 'concrete', x - 3.9, 0, z - 5.6, 0, true);
  kit.box(8.4, 0.08, 2.2, 'rust', x, 2.6, z - 6.6, 0, false);

  for (const c of containers) {
    const object = await kit.one(c);
    kit.game.places.containers.push({ id: `loot_${c.type}_${kit.game.places.containers.length}`, type: c.type, object, position: new Vector3(c.x, c.y ?? 0, c.z) });
  }

  // Dead survivor slumped by the depot wall (searchable body, QA-058): chr_survivor_a frozen at the end of its
  // death clip. No collider (players step over it; the interact point is the chest).
  {
    const proto = await loadModel('chr_survivor_a', [0.6, 1.8, 0.4]);
    const inst = proto.create();
    const bx = x + 5.2, bz = z - 5.8;
    inst.root.position.set(bx, 0.04, bz);
    inst.root.rotation.y = -2.2;
    const clip = proto.clips.find((c) => /death/i.test(c.name));
    const a = clip && inst.mixer.clipAction(clip);
    if (a && clip) {
      a.play();
      inst.mixer.setTime(clip.duration * 0.98);
    }
    inst.root.updateMatrixWorld(true);
    kit.game.scene.add(inst.root);
    kit.game.places.containers.push({ id: 'loot_body_survivor', type: 'body_survivor', object: inst.root, position: new Vector3(bx, 0.3, bz) });
  }

  // Set dressing: pallets (one under the duffel), barrels, tyres.
  const pallet = (px: number, pz: number, yaw: number, y = 0) => {
    kit.box(1.2, 0.14, 1.0, 'wood_raw', px, y, pz, yaw, true, 0.7);
  };
  pallet(x + 6.5, z - 2.8, 0.5);
  pallet(x + 8.5, z - 4.6, -0.1);
  pallet(x + 8.5, z - 4.6, 0.05, 0.14);
  const barrel = (bx: number, bz: number, sw: string) => {
    kit.paint(new CylinderGeometry(0.3, 0.3, 0.9, 10).translate(bx, 0.45, bz), sw);
    kit.cuboid(0.3, 0.45, 0.3, bx, 0.45, bz, 0, 'metal');
  };
  barrel(x - 10.4, z + 6.8, 'rust');
  barrel(x - 9.7, z + 7.4, 'paint_blue_faded');
  barrel(x - 10.5, z + 7.6, 'rust_dark');
  kit.place({ id: 'env_tire_stack_a', size: [0.8, 0.9, 0.8], x: x + 10.3, z: z + 6.8 });
  kit.place({ id: 'env_tire_stack_a', size: [0.8, 0.9, 0.8], x: x + 10.5, z: z + 5.8 });

  stationSign(kit, 'loot', x + 7, z + 9.6);
}
