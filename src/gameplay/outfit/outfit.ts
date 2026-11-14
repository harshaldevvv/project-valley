import { Color, MeshStandardMaterial, Skeleton, SkinnedMesh, type Bone, type Group, type Object3D } from 'three';
import { OUTFIT_SLOTS, partsById, type OutfitSlot } from '../../content/data/outfit';

/**
 * Visual outfit for a rigged character. `parts` is the scene of chr_hero_a_parts.glb: skinned meshes named `part_<id>` on the
 * same bone names as the hero. equip() rebinds a copy of the mesh onto the live character's skeleton, so it plays every clip.
 * State is plain data ({ slot: { id, tint } }) so it can be saved.
 */
export type OutfitState = Partial<Record<OutfitSlot, { id: string; tint: number }>>;

export interface Outfit {
  state: OutfitState;
  equip(slot: OutfitSlot, id: string | null, tint?: number): void;
  setState(s: OutfitState): void;
  dispose(): void;
}

export function createOutfit(character: Object3D, parts: Group): Outfit {
  const bones = new Map<string, Bone>();
  let host: SkinnedMesh | null = null;
  character.traverse((o) => {
    if ((o as Bone).isBone) bones.set(o.name, o as Bone);
    if (!host && (o as SkinnedMesh).isSkinnedMesh) host = o as SkinnedMesh;
  });
  const hostMesh = host as SkinnedMesh | null;
  const src = new Map<string, SkinnedMesh>();
  parts.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh && o.name.startsWith('part_')) src.set(o.name.slice(5), o as SkinnedMesh);
  });
  const worn = new Map<OutfitSlot, SkinnedMesh>();
  const state: OutfitState = {};

  const remove = (slot: OutfitSlot) => {
    const m = worn.get(slot);
    if (m) {
      m.removeFromParent();
      (m.material as MeshStandardMaterial).dispose();
      worn.delete(slot);
    }
    delete state[slot];
  };
  const equip = (slot: OutfitSlot, id: string | null, tint = 0) => {
    remove(slot);
    if (!id || !hostMesh) return;
    const part = partsById(id), s = src.get(id);
    if (!part || !s || part.slot !== slot) return;
    const skel = new Skeleton(s.skeleton.bones.map((b) => bones.get(b.name)!), s.skeleton.boneInverses);
    const mat = new MeshStandardMaterial({ color: new Color(part.tints[tint % part.tints.length]), roughness: part.rough, metalness: part.metal ?? 0 });
    const m = new SkinnedMesh(s.geometry, mat);
    m.name = 'outfit_' + id;
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    m.matrix.copy(hostMesh.matrix);
    hostMesh.parent!.add(m);
    m.bind(skel, s.bindMatrix);
    worn.set(slot, m);
    state[slot] = { id, tint };
  };
  return {
    state,
    equip,
    setState(next) {
      for (const slot of OUTFIT_SLOTS) {
        const e = next[slot];
        equip(slot, e?.id ?? null, e?.tint ?? 0);
      }
    },
    dispose() {
      for (const slot of OUTFIT_SLOTS) remove(slot);
    },
  };
}
