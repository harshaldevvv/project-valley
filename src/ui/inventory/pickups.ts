import { BoxGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { ItemInstance } from '../../content/data/types';
import type { Game } from '../../core/game';
import { defOf } from '../../systems/inventory';
import type { Loadout } from '../../systems/loadout';
import { inventoryText } from '../../content/text/ui';
import { itemName } from './screen';

/**
 * World view of dropped items: a small box per pickup (footprint-sized, item swatch colour) plus an
 * "Pick up <item>" interactable. Diffed against loadout.pickups whenever the inventory changes.
 */
const CELL_M = 0.1; // world size of one grid cell for the placeholder box
const unit = new BoxGeometry(1, 1, 1);
const mats = new Map<string, MeshStandardMaterial>();
const mat = (c: string) => mats.get(c) ?? (mats.set(c, new MeshStandardMaterial({ color: c, roughness: 0.8 })), mats.get(c)!);

export function createPickupView(game: Game, lo: Loadout, onPickedUp: (item: ItemInstance, ok: boolean) => void) {
  const live = new Map<ItemInstance, { mesh: Mesh; unreg: () => void }>();

  function sync() {
    const now = new Set(lo.pickups.map((p) => p.item));
    for (const [item, v] of live)
      if (!now.has(item)) {
        v.mesh.removeFromParent();
        v.unreg();
        live.delete(item);
      }
    for (const p of lo.pickups) {
      if (live.has(p.item)) continue;
      const d = defOf(p.item);
      const hgt = d.kind === 'backpack' || d.kind === 'clothing' ? 0.18 : 0.07;
      const mesh = new Mesh(unit, mat(d.iconSwatch ?? '#777'));
      mesh.scale.set(d.w * CELL_M + 0.04, hgt, d.h * CELL_M + 0.04);
      mesh.position.set(p.x, p.y + hgt / 2, p.z);
      mesh.rotation.y = (p.item.uid * 1.7) % Math.PI;
      mesh.castShadow = true;
      mesh.name = `pickup_${p.item.defId}`;
      game.scene.add(mesh);
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
      live.set(p.item, { mesh, unreg });
    }
  }
  return { sync };
}
