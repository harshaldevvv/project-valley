import { BufferAttribute, Color, Material, MeshStandardMaterial, Skeleton, SkinnedMesh, type Bone, type Group, type Object3D } from 'three';
import { OUTFIT_SLOTS, partsById, type BodyRegion, type OutfitSlot } from '../../content/data/outfit';

/**
 * Visual outfit for a rigged character with the underwear base body (chr_body_a).
 * - `parts` is the scene of chr_body_a_parts.glb: skinned meshes named `part_<id>` on the same bone names as the body. equip()
 *   rebinds a copy of the mesh onto the live character's skeleton, so every garment plays every clip.
 * - The base body is split into regions (head, torso, arms, hands, legs, feet) as draw groups of one mesh; a worn garment hides
 *   the regions it covers, so skin never shows through clothes.
 * State is plain data ({ slot: { id, tint } }) so it can be saved.
 */
export type OutfitState = Partial<Record<OutfitSlot, { id: string; tint: number }>>;

export interface Outfit {
  state: OutfitState;
  equip(slot: OutfitSlot, id: string | null, tint?: number): void;
  setState(s: OutfitState): void;
  dispose(): void;
}

const REGIONS: BodyRegion[] = ['head', 'torso', 'arms', 'hands', 'legs', 'feet'];
const regionOf = (bone: string): number => {
  if (/Hand/.test(bone)) return 3;
  if (/^(Head|Neck)$/.test(bone)) return 0;
  if (/(Arm|ForeArm)$/.test(bone)) return 2;
  if (/(UpLeg|Leg)$/.test(bone)) return 4;
  if (/(Foot|ToeBase)$/.test(bone)) return 5;
  return 1; // hips, spine, shoulders
};

/** Splits a skinned mesh into one draw group per body region (triangles go to the region of their dominant bones). */
function splitRegions(mesh: SkinnedMesh): Material[] | null {
  const g = mesh.geometry;
  if (!g.index || Array.isArray(mesh.material)) return null;
  const bones = mesh.skeleton.bones.map((b) => regionOf(b.name));
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const vReg = new Uint8Array(si.count);
  for (let v = 0; v < si.count; v++) {
    const acc = new Float32Array(REGIONS.length);
    for (let k = 0; k < 4; k++) acc[bones[si.getComponent(v, k)]] += sw.getComponent(v, k);
    let best = 0;
    for (let r = 1; r < acc.length; r++) if (acc[r] > acc[best]) best = r;
    vReg[v] = best;
  }
  const idx = g.index.array;
  const lists: number[][] = REGIONS.map(() => []);
  for (let i = 0; i < idx.length; i += 3) {
    const c = [vReg[idx[i]], vReg[idx[i + 1]], vReg[idx[i + 2]]];
    const r = c[0] === c[1] || c[0] === c[2] ? c[0] : c[1] === c[2] ? c[1] : c[0];
    lists[r].push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const all = lists.flat();
  g.setIndex(new BufferAttribute(idx instanceof Uint32Array ? new Uint32Array(all) : new Uint16Array(all), 1));
  g.clearGroups();
  let at = 0;
  lists.forEach((l, r) => {
    g.addGroup(at, l.length, r);
    at += l.length;
  });
  const base = mesh.material as Material;
  const mats = REGIONS.map(() => base.clone());
  mesh.material = mats;
  return mats;
}

export function createOutfit(character: Object3D, parts: Group): Outfit {
  const bones = new Map<string, Bone>();
  const skinned: SkinnedMesh[] = [];
  character.traverse((o) => {
    if ((o as Bone).isBone) bones.set(o.name, o as Bone);
    if ((o as SkinnedMesh).isSkinnedMesh) skinned.push(o as SkinnedMesh);
  });
  const hostMesh = skinned.find((m) => /_LOD0$/.test(m.name)) ?? skinned[0] ?? null;
  const bodyMats: Material[][] = [];
  for (const m of skinned) {
    if (m.userData.regions) {
      bodyMats.push(m.userData.regions as Material[]);
      continue;
    }
    const mats = splitRegions(m);
    if (mats) {
      m.userData.regions = mats;
      bodyMats.push(mats);
    }
  }
  const src = new Map<string, SkinnedMesh>();
  parts.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh && o.name.startsWith('part_')) src.set(o.name.slice(5), o as SkinnedMesh);
  });
  const worn = new Map<OutfitSlot, SkinnedMesh>();
  const state: OutfitState = {};

  const applyHides = () => {
    const hidden = new Set<BodyRegion>();
    for (const slot of worn.keys()) for (const r of partsById(state[slot]!.id)?.hides ?? []) hidden.add(r);
    for (const mats of bodyMats) REGIONS.forEach((r, i) => (mats[i].visible = !hidden.has(r)));
  };
  const remove = (slot: OutfitSlot) => {
    const m = worn.get(slot);
    if (m) {
      m.removeFromParent();
      (m.material as Material).dispose();
      worn.delete(slot);
    }
    delete state[slot];
  };
  const equip = (slot: OutfitSlot, id: string | null, tint = 0) => {
    remove(slot);
    if (id && hostMesh) {
      const part = partsById(id), s = src.get(id);
      if (part && s && part.slot === slot) {
        const skel = new Skeleton(s.skeleton.bones.map((b) => bones.get(b.name)!), s.skeleton.boneInverses);
        // textured or vertex-coloured parts keep their own look and only multiply by the tint; plain parts take the swatch colour
        const own = s.material as MeshStandardMaterial;
        const textured = !!own.map || !!s.geometry.attributes.color;
        const mat = textured ? own.clone() : new MeshStandardMaterial({ roughness: part.rough, metalness: part.metal ?? 0 });
        mat.color = new Color(part.tints[tint % part.tints.length]);
        if (textured) (mat as MeshStandardMaterial).vertexColors = !!s.geometry.attributes.color;
        const m = new SkinnedMesh(s.geometry, mat);
        m.name = 'outfit_' + id;
        m.frustumCulled = false;
        m.matrixAutoUpdate = false;
        m.matrix.copy(hostMesh.matrix);
        hostMesh.parent!.add(m);
        m.bind(skel, s.bindMatrix);
        worn.set(slot, m);
        state[slot] = { id, tint };
      }
    }
    applyHides();
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
      applyHides();
    },
  };
}
