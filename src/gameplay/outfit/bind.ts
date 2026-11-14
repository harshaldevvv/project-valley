import type { Object3D } from 'three';
import { ITEM_PARTS, OUTFIT_SLOTS, SLOT_TO_OUTFIT, partsById, type OutfitSlot } from '../../content/data/outfit';
import type { SlotName } from '../../content/data/types';
import { assetUrl } from '../../engine/assetUrl';
import { gltfLoader } from '../../engine/assets';
import manifest from '../../../public/assets/models/manifest.json';
import type { Game } from '../../core/game';
import type { Viewmodel } from '../weapons/viewmodel';
import { probe } from '../ctx';
import { createOutfit, type OutfitState } from './outfit';

/** Hero only (`?hero=1`): the worn inventory items drive the visible outfit. The loadout is saved already, so the look is too. */
export async function bindOutfit(game: Game, character: Object3D, vm?: Viewmodel) {
  const url = (manifest as Record<string, { url: string }>).chr_hero_a_parts.url;
  const outfit = createOutfit(character, (await gltfLoader.loadAsync(assetUrl(url))).scene);
  const sync = () => {
    const lo = probe(game, 'loadout', 'equipped');
    if (!lo) return;
    const next: OutfitState = {};
    for (const [inv, slot] of Object.entries(SLOT_TO_OUTFIT)) {
      const it = lo.equipped(inv as SlotName);
      const part = it && ITEM_PARTS[it.defId];
      if (part) next[slot as OutfitSlot] = { id: part[0], tint: part[1] };
    }
    for (const slot of OUTFIT_SLOTS) {
      const want = next[slot], have = outfit.state[slot];
      if (want?.id !== have?.id || want?.tint !== have?.tint) outfit.equip(slot, want?.id ?? null, want?.tint ?? 0);
    }
    fp(outfit.state);
  };
  // first-person arms follow the outfit: sleeve = jacket colour (the hero's grey tee otherwise), hands = gloves
  const fp = (st: OutfitState) => {
    const col = (slot: OutfitSlot) => { const e = st[slot]; return e ? partsById(e.id)!.tints[e.tint] : null; };
    vm?.setLook(col('jacket') ?? '#6b7078', col('hands') ?? '#1d1f22');
  };
  sync();
  fp(outfit.state);
  game.events.on('inventoryChanged', sync);
  game.events.on('playerRespawned', sync);
  return outfit;
}
