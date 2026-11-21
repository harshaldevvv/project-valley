import { Box3, Group, Mesh, type Material, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { INVENTORY, PICKUP_MODELS } from '../../content/data/items';
import { Group as PGroup, groups } from '../../engine/physics';
import type { ItemDef, ItemInstance } from '../../content/data/types';
import type { Game } from '../../core/game';
import { assetUrl } from '../../engine/assetUrl';
import { gltfLoader } from '../../engine/assets';
import { loadModel } from '../../engine/models';
import { defOf } from '../../systems/inventory';
import type { Loadout } from '../../systems/loadout';
import { inventoryText } from '../../content/text/ui';
import { itemName } from './screen';

/**
 * World view of dropped items: a model per pickup (the item's own model, else a generic from PICKUP_MODELS),
 * laid flat on the ground with a small yaw, plus a "Pick up <item>" interactable.
 * Diffed against loadout.pickups whenever the inventory changes.
 */
export function pickupModelId(d: ItemDef) {
  return d.model ?? PICKUP_MODELS.byItem[d.id] ?? PICKUP_MODELS.byKind[d.kind] ?? PICKUP_MODELS.fallback;
}

const tints = new Map<string, Material>();
/**
 * Swatch-coloured material for generic models (QA-088). Multiplying the palette texture doesn't read: the generic
 * pack's texels are dark olive, so blue * olive is still olive. A flat swatch colour does; one material per colour.
 */
function tinted(color: string) {
  let m = tints.get(color);
  if (!m) tints.set(color, (m = new MeshStandardMaterial({ color, roughness: 0.85 })));
  return m;
}

/** Own Polyfork models (PICKUP_MODELS.files): one load per file, scaled so the longest side is `size` metres. */
const ownFiles = new Map<string, Promise<Object3D | null>>();
function loadOwn(file: string) {
  let p = ownFiles.get(file);
  if (!p) {
    p = gltfLoader.loadAsync(assetUrl(`assets/models/item/${file}.glb`)).then((g) => g.scene, (e) => (console.warn(`item model ${file} failed to load`, e), null));
    ownFiles.set(file, p);
  }
  return p;
}
function scaledTo(src: Object3D, size: number) {
  const o = src.clone(true);
  o.updateMatrixWorld(true);
  new Box3().setFromObject(o).getSize(_size);
  o.scale.multiplyScalar(size / Math.max(_size.x, _size.y, _size.z, 1e-3));
  return o;
}

const _box = new Box3();
const _size = new Vector3();

/** Rotate so the thinnest axis points up (lying flat), then sit it on y=0, centred. */
function layFlat(obj: Object3D) {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj).getSize(_size);
  if (_size.x < _size.y && _size.x <= _size.z) obj.rotation.z = Math.PI / 2;
  else if (_size.z < _size.y && _size.z < _size.x) obj.rotation.x = Math.PI / 2;
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  const c = _box.getCenter(new Vector3());
  obj.position.set(-c.x, -_box.min.y, -c.z);
}

export function createPickupView(game: Game, lo: Loadout, onPickedUp: (item: ItemInstance, ok: boolean) => void) {
  const live = new Map<ItemInstance, { root: Object3D; unreg: () => void }>();

  // Drops are placed at the player's feet height, but they land ahead of and around the player: off a porch edge,
  // on a slope, while airborne. Snap each new pickup down (or up a step) onto the surface under it once.
  let ray: InstanceType<Game['phys']['R']['Ray']> | null = null;
  const surfaceY = (x: number, y: number, z: number): number | null => {
    try {
      const R = game.phys.R;
      ray ??= new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
      ray.origin = { x, y: y + INVENTORY.dropSnapUp, z };
      const hit = game.phys.world.castRay(ray, INVENTORY.dropSnapUp + INVENTORY.dropSnapDown, true, undefined, groups(PGroup.PLAYER, PGroup.STATIC | PGroup.TERRAIN | PGroup.BUILD | PGroup.VEHICLE));
      return hit ? y + INVENTORY.dropSnapUp - hit.timeOfImpact : null;
    } catch {
      return null; // physics not up yet
    }
  };

  function sync() {
    const now = new Set(lo.pickups.map((p) => p.item));
    for (const [item, v] of live)
      if (!now.has(item)) {
        v.root.removeFromParent();
        v.unreg();
        live.delete(item);
      }
    for (const p of lo.pickups) {
      if (live.has(p.item)) continue;
      const d = defOf(p.item);
      const sy = surfaceY(p.x, p.y, p.z);
      if (sy !== null) p.y = sy;
      const root = new Group();
      root.name = `pickup_${d.id}`;
      root.position.set(p.x, p.y, p.z);
      root.rotation.y = ((p.item.uid * 2.39996) % (Math.PI * 2)) - Math.PI; // stable "random" yaw per item
      game.scene.add(root);
      const fallback: [number, number, number] = [d.w * 0.1 + 0.04, 0.08, d.h * 0.1 + 0.04];
      const own = PICKUP_MODELS.files[d.id];
      if (own) {
        void loadOwn(own.file).then((scene) => {
          if (!scene || live.get(p.item)?.root !== root) return; // missing file, or picked up while loading
          const inner = scaledTo(scene, own.size);
          inner.traverse((o) => {
            if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
          });
          const holder = new Group();
          holder.add(inner);
          if (!own.upright) layFlat(inner);
          else {
            inner.updateMatrixWorld(true);
            _box.setFromObject(inner);
            const c = _box.getCenter(new Vector3());
            inner.position.set(-c.x, -_box.min.y, -c.z);
          }
          root.add(holder);
        });
      } else
      void loadModel(pickupModelId(d), fallback).then((proto) => {
        if (live.get(p.item)?.root !== root) return; // picked up while loading
        const inner = proto.create().root;
        inner.traverse((o) => {
          const m = o as Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          if ((PICKUP_MODELS.tintKinds.includes(d.kind) || PICKUP_MODELS.tintModels.includes(pickupModelId(d))) && d.iconSwatch) m.material = tinted(d.iconSwatch);
        });
        const holder = new Group();
        holder.add(inner);
        layFlat(inner);
        root.add(holder);
      });
      const item = p.item;
      const unreg = game.interact.register({
        // Raised to hip height: the interact picker measures from the chest and wants things in view,
        // so a point on the floor loses to any nearby crate (QA-022).
        position: new Vector3(p.x, p.y + 0.9, p.z),
        radius: 1.8,
        prompt: () => `${inventoryText.pickUp} ${itemName(item.defId)}${item.count > 1 ? ` (${item.count})` : ''}`,
        holdSeconds: () => 0,
        onInteract: () => onPickedUp(item, lo.pickUp(item)),
      });
      live.set(p.item, { root, unreg });
    }
  }
  return { sync };
}
