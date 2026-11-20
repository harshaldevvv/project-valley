import { Skeleton, SkinnedMesh, type Bone, type Object3D } from 'three';
import { PF_DEFAULT_HIDDEN, PF_FP_COLOURS, PF_FP_SKIN, PF_HIDES_HAIR, PF_INV_SLOTS, PF_ITEM_PARTS, PF_SLOT_HIDES, type PfSlot } from '../../content/data/heroParts';
import { heroLook } from '../../content/data/player';
import type { SlotName } from '../../content/data/types';
import { assetUrl } from '../../engine/assetUrl';
import { gltfLoader } from '../../engine/assets';
import manifest from '../../../public/assets/models/manifest.json';
import type { Game } from '../../core/game';
import type { Viewmodel } from '../weapons/viewmodel';
import { probe } from '../ctx';

/**
 * Outfit for the Polyfork hero (chr_hero_pf): worn inventory items show Polyfork parts (hats, coats, rigs, gloves, packs) from
 * chr_hero_pf_parts.glb. Every Polyfork character shares one skeleton, so a part is rebound onto the hero's live bones by name
 * and plays every clip. The hero's own slot mesh (chr_hero_pf_COAT etc.) is hidden while a part replaces it.
 */
export async function bindPfOutfit(game: Game, character: Object3D, id: string, vm?: Viewmodel) {
  const url = (manifest as Record<string, { url: string }>)[`${id}_parts`]?.url;
  if (!url) return null;
  const lib = (await gltfLoader.loadAsync(assetUrl(url))).scene;
  const parts = new Map<string, SkinnedMesh>();
  lib.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh && o.name.startsWith('pfpart_')) parts.set(o.name.slice(7), o as SkinnedMesh);
  });
  const bones = new Map<string, Bone>();
  const own = new Map<string, Object3D>(); // slot mesh name suffix (COAT, HAIR...) -> mesh
  let host: SkinnedMesh | null = null;
  character.traverse((o) => {
    if ((o as Bone).isBone) bones.set(o.name, o as Bone);
    if ((o as SkinnedMesh).isSkinnedMesh && o.name.startsWith(id + '_')) {
      own.set(o.name.slice(id.length + 1), o);
      host ??= o as SkinnedMesh;
    }
  });
  if (!host) return null;
  const hostMesh = host as SkinnedMesh;
  const worn = new Map<PfSlot, { part: string; mesh: SkinnedMesh }>();

  const wear = (slot: PfSlot, part: string | null) => {
    const cur = worn.get(slot);
    if (cur?.part === part) return;
    if (cur) {
      cur.mesh.removeFromParent();
      worn.delete(slot);
    }
    if (!part) return;
    const src = parts.get(part);
    if (!src) return;
    // Same skeleton everywhere: map the library's bones to the hero's by name, keep the library's inverse bind matrices.
    const sk = new Skeleton(src.skeleton.bones.map((b) => bones.get(b.name) ?? b), src.skeleton.boneInverses);
    const m = new SkinnedMesh(src.geometry, src.material);
    m.name = `${id}_part_${part}`;
    m.bind(sk, hostMesh.bindMatrix);
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    m.userData.solid = m.material; // near-body fade (index.ts) swaps solid/faded
    m.userData.faded = (hostMesh.userData.faded as unknown) ?? m.material;
    hostMesh.parent!.add(m);
    worn.set(slot, { part, mesh: m });
  };

  const sync = () => {
    const lo = probe(game, 'loadout', 'equipped');
    const want = new Map<PfSlot, string>();
    if (lo) {
      for (const inv of PF_INV_SLOTS) {
        const it = lo.equipped(inv as SlotName);
        const part = it && PF_ITEM_PARTS[it.defId];
        if (part) want.set(part.split('_')[0] as PfSlot, part);
      }
    }
    const slots = Object.keys(PF_SLOT_HIDES) as PfSlot[];
    for (const s of slots) wear(s, want.get(s) ?? null);
    // Hero meshes: hidden by default ones, by worn parts, and the hair under a full helmet
    const hidden = new Set(PF_DEFAULT_HIDDEN);
    for (const [s, w] of worn) {
      for (const h of PF_SLOT_HIDES[s]) hidden.add(h);
      if (PF_HIDES_HAIR.has(w.part)) hidden.add('HAIR');
    }
    // The hero's own backpack is the school bag: show it instead of a duplicate part
    if (worn.get('back')?.part === 'back_school' && own.has('BACKPACK')) {
      worn.get('back')!.mesh.visible = false;
      hidden.delete('BACKPACK');
    }
    for (const [k, o] of own) o.visible = !hidden.has(k);
    // First-person arms: sleeve from the coat (hero shirt otherwise), hands from the gloves (bare skin otherwise)
    const coat = worn.get('coat')?.part;
    const hands = worn.get('hands')?.part;
    vm?.setLook((coat && PF_FP_COLOURS[coat]) || heroLook.fpSleeve, (hands && PF_FP_COLOURS[hands]) || PF_FP_SKIN);
  };
  sync();
  game.events.on('inventoryChanged', sync);
  game.events.on('playerRespawned', sync);
  return { sync, worn };
}
