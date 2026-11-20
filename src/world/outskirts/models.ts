import { Box3, BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gltfLoader } from '../../engine/assets';
import { pfUrl } from '../yard/pfModels';
import { PF_FILES } from './modelFiles';

/**
 * Polyfork models at their native size (the catalog is authored in metres), one merged vertex-coloured geometry each,
 * re-based so the footprint centre sits at the origin and the lowest point at y = 0. Cached per key. `null` when the
 * key or the file is missing, so a bad name never stops the world from building.
 */
export interface Pfm {
  geo: BufferGeometry; // position / normal / color, non-indexed
  size: Vector3;
  centre: Vector3; // bbox centre (after re-basing), for colliders
}
const cache = new Map<string, Promise<Pfm | null>>();

export function loadPfm(key: string): Promise<Pfm | null> {
  let p = cache.get(key);
  if (!p) cache.set(key, (p = load(key)));
  return p;
}

async function load(key: string): Promise<Pfm | null> {
  const file = PF_FILES[key];
  if (!file) {
    console.warn(`outskirts: unknown Polyfork model "${key}"`);
    return null;
  }
  try {
    const g = await gltfLoader.loadAsync(pfUrl(file));
    g.scene.updateMatrixWorld(true);
    const geos: BufferGeometry[] = [];
    g.scene.traverse((c) => {
      const m = c as import('three').Mesh;
      if (!m.isMesh) return;
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const n = geo.getAttribute('position').count;
      if (!geo.getAttribute('color')) {
        const col = (m.material as { color?: { r: number; g: number; b: number } }).color ?? { r: 0.6, g: 0.6, b: 0.6 };
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
        geo.setAttribute('color', new BufferAttribute(arr, 3));
      }
      for (const a of Object.keys(geo.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'color') geo.deleteAttribute(a);
      // colour must be a plain float vec3 for merging (some files use normalised ints or vec4)
      const col = geo.getAttribute('color');
      if (col.itemSize !== 3 || !(col.array instanceof Float32Array)) {
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = col.getX(i); arr[i * 3 + 1] = col.getY(i); arr[i * 3 + 2] = col.getZ(i); }
        geo.setAttribute('color', new BufferAttribute(arr, 3));
      }
      if (!geo.getAttribute('normal')) geo.computeVertexNormals();
      geos.push(geo.index ? geo.toNonIndexed() : geo);
    });
    const merged = geos.length ? mergeGeometries(geos, false) : null;
    if (!merged) return null;
    merged.computeBoundingBox();
    const bb = merged.boundingBox as Box3;
    merged.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    merged.computeBoundingBox();
    const b2 = merged.boundingBox as Box3;
    return { geo: merged, size: b2.getSize(new Vector3()), centre: b2.getCenter(new Vector3()) };
  } catch (e) {
    console.warn(`outskirts: model ${file} failed to load`, e);
    return null;
  }
}
