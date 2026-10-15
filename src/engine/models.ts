import {
  AnimationMixer,
  Box3,
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Object3D,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type SkinnedMesh,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { entries, gltfLoader } from './assets';
import { paletteMaterial } from './palette';

/**
 * Models that are not plain static props: animated characters/zombies, weapons with sockets, vehicles with wheels.
 *
 *   const proto = await loadModel('zmb_shambler_a');          // cached per id
 *   const z = proto.create();                                   // independent copy (SkeletonUtils.clone)
 *   scene.add(z.root);  z.actions.get('z_walk')?.play();  z.mixer.update(dt) each frame
 *   z.sockets.get('hand_R')?.add(weaponRoot);                   // empties named SOCKET_<name>
 *   const car = (await loadModel('veh_pickup_a', [2, 1.9, 5.3])).create();
 *   car.wheels.get('FL')!.node.rotation.x += spin;             // WHEEL_FL/FR/RL/RR; offset = rest position in root space
 *
 * - Only `<id>_LOD0` is kept (ponytail: no LOD switching for unique models; add when crowds of them exist).
 * - `<id>_COL_*` meshes are removed and returned as `colliders` (boxes in root space).
 * - Every mesh gets the shared palette material; MeshStandardNodeMaterial skins SkinnedMesh on WebGPU and WebGL2.
 * - Ids not in the manifest return a placeholder with the same shape: capsule (chr_/zmb_, with SOCKET_hand_R),
 *   box + 4 wheels (veh_), box with muzzle/grip/support/mag sockets (wpn_), else a box. Never throws.
 */
export interface ModelInstance {
  root: Object3D;
  mixer: AnimationMixer;
  actions: Map<string, AnimationAction>;
  sockets: Map<string, Object3D>;
  wheels: Map<string, { node: Object3D; offset: Vector3 }>;
}
export interface ModelProto {
  id: string;
  placeholder: boolean;
  clips: AnimationClip[];
  colliders: Box3[];
  create(): ModelInstance;
}

const cache = new Map<string, Promise<ModelProto>>();

export function loadModel(id: string, fallbackSize: [number, number, number] = [1, 1, 1]): Promise<ModelProto> {
  let p = cache.get(id);
  if (!p) {
    p = (id in entries ? fromGltf(id) : Promise.resolve(placeholder(id, fallbackSize))).catch((e) => {
      console.warn(`model "${id}" failed to load (${e}); using a placeholder`);
      return placeholder(id, fallbackSize);
    });
    cache.set(id, p);
  }
  return p;
}

function proto(id: string, template: Object3D, clips: AnimationClip[], colliders: Box3[], isPlaceholder: boolean): ModelProto {
  return {
    id,
    placeholder: isPlaceholder,
    clips,
    colliders,
    create() {
      const root = skeletonClone(template);
      root.updateMatrixWorld(true);
      const sockets = new Map<string, Object3D>();
      const wheels = new Map<string, { node: Object3D; offset: Vector3 }>();
      root.traverse((o) => {
        if (o.name.startsWith('SOCKET_')) sockets.set(o.name.slice(7), o);
        else if (o.name.startsWith('WHEEL_')) wheels.set(o.name.slice(6), { node: o, offset: o.getWorldPosition(new Vector3()) });
      });
      const mixer = new AnimationMixer(root);
      const actions = new Map<string, AnimationAction>();
      for (const c of clips) actions.set(c.name, mixer.clipAction(c));
      return { root, mixer, actions, sockets, wheels };
    },
  };
}

async function fromGltf(id: string): Promise<ModelProto> {
  const [gltf, mat] = await Promise.all([gltfLoader.loadAsync(entries[id].url), paletteMaterial()]);
  const scene = gltf.scene;
  scene.name = id;
  scene.updateMatrixWorld(true);
  const colliders: Box3[] = [];
  const drop: Object3D[] = [];
  scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    if (m.name.includes('_COL_')) {
      colliders.push(new Box3().setFromObject(m));
      drop.push(m);
    } else if (/_LOD[1-9]$/.test(m.name)) drop.push(m);
    else {
      m.material = mat;
      m.castShadow = m.receiveShadow = true;
      if ((m as SkinnedMesh).isSkinnedMesh) m.frustumCulled = false; // bind-pose bounds don't follow the animation
    }
  });
  for (const o of drop) o.removeFromParent();
  return proto(id, scene, gltf.animations, colliders, false);
}

let phMat: MeshStandardNodeMaterial | null = null;
function placeholder(id: string, [w, h, d]: [number, number, number]): ModelProto {
  console.warn(`model "${id}" not built yet — using a placeholder`);
  phMat ??= new MeshStandardNodeMaterial({ color: '#c040c0', roughness: 0.9 });
  const root = new Group();
  root.name = id;
  const add = (geo: BoxGeometry | CapsuleGeometry | CylinderGeometry, parent: Object3D = root) => {
    const m = new Mesh(geo, phMat!);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const empty = (name: string, x: number, y: number, z: number, parent: Object3D = root) => {
    const o = new Object3D();
    o.name = name;
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  let box = new Box3(new Vector3(-w / 2, 0, -d / 2), new Vector3(w / 2, h, d / 2));

  if (id.startsWith('chr_') || id.startsWith('zmb_')) {
    const r = 0.28;
    const H = Math.max(h, 1.8);
    add(new CapsuleGeometry(r, H - 2 * r, 4, 10).translate(0, H / 2, 0));
    empty('SOCKET_hand_R', 0.32, H * 0.55, -0.15);
    empty('SOCKET_hand_L', -0.32, H * 0.55, -0.15);
    empty('SOCKET_head', 0, H * 0.92, 0);
    box = new Box3(new Vector3(-r, 0, -r), new Vector3(r, H, r));
  } else if (id.startsWith('veh_')) {
    const wr = Math.min(0.4, h * 0.22);
    add(new BoxGeometry(w, h - wr, d).translate(0, wr + (h - wr) / 2, 0));
    for (const [n, sx, sz] of [['FL', -1, -1], ['FR', 1, -1], ['RL', -1, 1], ['RR', 1, 1]] as const) {
      const wheel = empty(`WHEEL_${n}`, (sx * w) / 2, wr, (sz * d) / 2 - sz * wr * 1.6);
      add(new CylinderGeometry(wr, wr, 0.25, 12).rotateZ(Math.PI / 2), wheel);
    }
  } else if (id.startsWith('wpn_')) {
    // Weapons: origin at the grip (art bible), barrel along -Z.
    add(new BoxGeometry(w, h, d).translate(0, h / 4, -d / 2 + 0.05));
    empty('SOCKET_grip', 0, 0, 0);
    empty('SOCKET_muzzle', 0, h / 2, -d + 0.05);
    empty('SOCKET_support', 0, h / 4, -d * 0.55);
    empty('SOCKET_mag', 0, -h / 4, -0.08);
    box = new Box3(new Vector3(-w / 2, -h / 4, -d + 0.05), new Vector3(w / 2, (3 * h) / 4, 0.05));
  } else {
    add(new BoxGeometry(w, h, d).translate(0, h / 2, 0));
  }
  return proto(id, root, [], [box], true);
}
