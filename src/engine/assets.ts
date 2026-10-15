import { Box3, LOD, Mesh, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import manifest from '../../public/assets/models/manifest.json';
import { paletteMaterial } from './palette';

/**
 * Loads pipeline GLBs (see tools/build-assets.mjs) into a prototype per asset:
 * - `<id>_LODn` meshes become a THREE.LOD (distances scale with object size),
 * - the placeholder "palette" material is swapped for the one shared palette material,
 * - `<id>_COL_*` meshes are removed from the render graph and returned as collider boxes.
 * Callers clone `lod` per placement (or feed geometry to instancing later).
 */
export type AssetId = keyof typeof manifest;
export interface AssetProto {
  lod: LOD;
  colliders: Box3[];
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<AssetProto>>();

export function loadAsset(id: AssetId): Promise<AssetProto> {
  let p = cache.get(id);
  if (!p) cache.set(id, (p = build(id)));
  return p;
}

async function build(id: AssetId): Promise<AssetProto> {
  const [gltf, mat] = await Promise.all([loader.loadAsync(manifest[id].url), paletteMaterial()]);
  const lods: Mesh[] = [];
  const colliders: Box3[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o: Object3D) => {
    if (!(o as Mesh).isMesh) return;
    const mesh = o as Mesh;
    if (mesh.name.includes('_COL_')) colliders.push(new Box3().setFromObject(mesh));
    else if (/_LOD\d$/.test(mesh.name)) lods[Number(mesh.name.slice(-1))] = mesh;
  });
  const lod = new LOD();
  lod.name = id;
  const size = colliders[0]?.getSize(new Vector3()).length() ?? 1;
  lods.forEach((m, i) => {
    m.material = mat;
    m.castShadow = i === 0;
    m.receiveShadow = true;
    m.removeFromParent();
    m.position.set(0, 0, 0);
    lod.addLevel(m, i === 0 ? 0 : size * (i === 1 ? 12 : 35));
  });
  return { lod, colliders };
}
