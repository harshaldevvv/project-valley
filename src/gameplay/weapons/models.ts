import { Box3, BoxGeometry, CylinderGeometry, Group, Mesh, Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hasAsset } from '../../engine/assets';
import { loadModel } from '../../engine/models';
import { paintGeometry, paletteMaterial } from '../../engine/palette';

/**
 * Weapon models: pipeline GLB (wpn_*) when built, else a tiny merged placeholder in gun-metal.
 * Origin at the grip, barrel toward -Z. `muzzle` is a child at the barrel tip.
 */
export interface WeaponModel {
  root: Object3D;
  muzzle: Object3D;
  /** Magazine part (hidden between mag-out and mag-in). */
  mag: Object3D | null;
  /** Height of the sight line above the grip origin (FP ADS centres this). */
  sightY: number;
  /** Support-hand point (handguard), grip-local; null for one-handed. */
  support: Object3D | null;
}

type Kind = 'pistol' | 'rifle' | 'knife';

function placeholder(kind: Kind) {
  const parts =
    kind === 'pistol'
      ? [
          paintGeometry(new BoxGeometry(0.035, 0.05, 0.2).translate(0, 0.06, -0.06), 'metal_gun'),
          paintGeometry(new BoxGeometry(0.03, 0.11, 0.05).rotateX(0.25).translate(0, 0, 0.01), 'plastic_black'),
        ]
      : kind === 'rifle'
        ? [
            paintGeometry(new BoxGeometry(0.05, 0.08, 0.42).translate(0, 0.05, -0.12), 'metal_gun'),
            paintGeometry(new CylinderGeometry(0.012, 0.012, 0.36, 6).rotateX(Math.PI / 2).translate(0, 0.07, -0.51), 'metal_dark'),
            paintGeometry(new BoxGeometry(0.045, 0.09, 0.26).translate(0, 0.03, 0.22), 'wood_dark'),
            paintGeometry(new BoxGeometry(0.03, 0.09, 0.04).rotateX(0.3).translate(0, -0.02, 0.03), 'wood_dark'),
            paintGeometry(new BoxGeometry(0.035, 0.035, 0.18).translate(0, 0.09, -0.36), 'wood_dark'),
          ]
        : [
            paintGeometry(new BoxGeometry(0.025, 0.03, 0.11).translate(0, 0, 0.02), 'leather_brown'),
            paintGeometry(new BoxGeometry(0.006, 0.035, 0.18).translate(0, 0.004, -0.13), 'metal_bare'),
          ];
  return mergeGeometries(parts)!;
}

export async function makeWeaponModel(id: string, modelId: string, kind: Kind): Promise<WeaponModel> {
  const root = new Group();
  root.name = id;
  const mat = await paletteMaterial();
  let mag: Object3D | null = null;
  let tipZ: number;
  let tipY: number;
  if (hasAsset(modelId)) {
    const m = (await loadModel(modelId)).create();
    root.add(m.root);
    mag = m.root.getObjectByName('MAG') ?? null;
    const b = new Box3().setFromObject(m.root);
    const sight = m.sockets.get('sight');
    const sightY = sight ? sight.position.y : b.max.y - 0.01;
    const sock = m.sockets.get('muzzle') ?? m.sockets.get('tip');
    root.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = true; });
    const support = m.sockets.get('support') ?? null;
    if (sock) return { root, muzzle: sock, mag, sightY, support };
    const muzzle = new Object3D();
    muzzle.position.set(0, (b.max.y + b.min.y) / 2 + 0.02, b.min.z);
    root.add(muzzle);
    return { root, muzzle, mag, sightY, support };
  } else {
    const m = new Mesh(placeholder(kind), mat);
    root.add(m);
    if (kind !== 'knife') {
      mag = new Mesh(paintGeometry(new BoxGeometry(0.025, kind === 'rifle' ? 0.16 : 0.08, 0.05), 'metal_dark'), mat);
      mag.position.set(0, kind === 'rifle' ? -0.05 : -0.03, kind === 'rifle' ? -0.15 : 0.005);
      if (kind === 'rifle') mag.rotation.x = 0.25;
      root.add(mag);
    }
    tipZ = kind === 'pistol' ? -0.16 : kind === 'rifle' ? -0.69 : -0.22;
    tipY = kind === 'pistol' ? 0.065 : kind === 'rifle' ? 0.07 : 0;
  }
  root.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = true; });
  const muzzle = new Object3D();
  muzzle.position.set(0, tipY, tipZ);
  root.add(muzzle);
  return { root, muzzle, mag, sightY: tipY + 0.03, support: null };
}
