import {
  AnimationMixer,
  DataTexture,
  FloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Matrix4,
  Mesh,
  RGBAFormat,
  Sphere,
  type SkinnedMesh,
} from 'three';
import { Frustum, MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, If, attribute, cos, float, int, ivec2, mat4, normalGeometry, normalLocal, positionGeometry, sin, textureLoad, uniform, vec3, vec4 } from 'three/tsl';
import type { Game } from '../core/game';
import { entries, gltfLoader } from './assets';
import { paletteMaterial } from './palette';

/**
 * GPU-skinned crowds (principles §13: one draw per archetype per LOD, baked bone texture).
 * Every clip of a skinned GLB is baked once at `fps` into a float texture of bone matrices. Instances are
 * plain data (position, yaw, clip, time); the vertex shader skins from the texture, so the CPU never touches
 * a skeleton. Up to 3 draws per crowd (LOD0/1/2) + shadow draws for LOD0/1, whatever the count.
 *
 *   const crowd = await createCrowd(game, 'zmb_shambler_a', { max: 64 });   // null if the model isn't built
 *   createCrowd(game, 'zmb_worker_a', { clipsFrom: 'zmb_shambler_a' })     // variant borrows clips by bone name
 *   const i = crowd.add();
 *   crowd.set(i, x, y, z, yaw);                  // each render frame (interpolated values)
 *   crowd.play(i, 'z_walk', { fade: 0.25, timeScale: 1.2 });
 *   crowd.play(i, 'z_death', { loop: false });  crowd.finished(i)
 *   crowd.setSpeed(i, 0.05);                    // hitstop; 1 = normal
 *   crowd.setTilt(i, 0.3, 0);                   // whole-body lean (replaces bone-level head snap/flinch)
 *   crowd.remove(i);
 *
 * - Animation advances in a render-phase system (frozen while game.paused). Clip changes crossfade.
 * - Per-instance CPU frustum culling (+4 m margin so near shadows don't pop); LOD by camera distance
 *   (default 15 / 40 m); LOD2 casts no shadow.
 * - Limits: no per-bone procedural offsets (use setTilt) and no attachments to bones (sockets) yet.
 * - Cost model: CPU O(instances) per frame for packing (~1 µs each); GPU skins 3 matrices x 4 influences per vertex.
 */
export interface CrowdPlayOpts {
  fade?: number;
  loop?: boolean;
  timeScale?: number;
  restart?: boolean;
}
export interface Crowd {
  readonly clips: string[];
  readonly count: number;
  duration(clip: string): number;
  add(): number;
  remove(i: number): void;
  set(i: number, x: number, y: number, z: number, yaw: number): void;
  play(i: number, clip: string, opts?: CrowdPlayOpts): void;
  setSpeed(i: number, s: number): void;
  /** Whole-body tilt about the feet (rad): pitch + = lean back (headshot snap, stagger), roll = sideways flinch. */
  setTilt(i: number, pitch: number, roll?: number): void;
  setVisible(i: number, v: boolean): void;
  /** Current clip and its time (s). */
  clip(i: number): string;
  time(i: number): number;
  /** Non-looping clip reached its end. */
  finished(i: number): boolean;
  readonly meshes: Mesh[];
}

interface ClipInfo {
  name: string;
  start: number; // first row
  frames: number; // rows - 1
  duration: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- @types/three TSL generics are too narrow for helpers
type Node = any;
const FPS = 30;
const _m = new Matrix4();
const _frustum = new Frustum();
const _sphere = new Sphere();
const _pv = new Matrix4();

export async function createCrowd(
  game: Game,
  modelId: string,
  opts: { max?: number; lodDistances?: [number, number]; castShadow?: boolean; clipsFrom?: string } = {},
): Promise<Crowd | null> {
  if (!(modelId in entries)) return null;
  const max = opts.max ?? 64;
  const [lod1, lod2] = opts.lodDistances ?? [15, 40];
  const clipSrc = opts.clipsFrom && opts.clipsFrom in entries ? opts.clipsFrom : null;
  const [gltf, palette, clipGltf] = await Promise.all([
    gltfLoader.loadAsync(entries[modelId].url),
    paletteMaterial(),
    clipSrc ? gltfLoader.loadAsync(entries[clipSrc].url) : null,
  ]);
  // Clips bind by bone name, so a mesh+skeleton-only variant can borrow another model's clips (same joint names).
  const animations = clipGltf?.animations ?? gltf.animations;
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const lods: SkinnedMesh[] = [];
  scene.traverse((o) => {
    const m = /_LOD(\d)$/.exec(o.name);
    if (m && (o as SkinnedMesh).isSkinnedMesh) lods[Number(m[1])] = o as SkinnedMesh;
  });
  if (!lods[0]) {
    console.warn(`crowd: ${modelId} has no skinned LOD0`);
    return null;
  }
  const bones = lods[0].skeleton.bones;
  const inverses = lods[0].skeleton.boneInverses;
  const B = bones.length;

  // --- bake -----------------------------------------------------------------------------------
  const clips: ClipInfo[] = [];
  let rows = 0;
  for (const c of animations) {
    const frames = Math.max(1, Math.round(c.duration * FPS));
    clips.push({ name: c.name, start: rows, frames, duration: Math.max(c.duration, 1 / FPS) });
    rows += frames + 1;
  }
  if (!rows) rows = 1; // no clips: one bind-pose row
  const data = new Float32Array(B * 4 * rows * 4);
  const mixer = new AnimationMixer(scene);
  const writeRow = (row: number) => {
    scene.updateMatrixWorld(true);
    for (let b = 0; b < B; b++) {
      _m.multiplyMatrices(bones[b].matrixWorld, inverses[b]);
      data.set(_m.elements, (row * B * 4 + b * 4) * 4);
    }
  };
  if (!animations.length) writeRow(0);
  animations.forEach((c, ci) => {
    mixer.stopAllAction();
    const a = mixer.clipAction(c);
    a.play();
    const info = clips[ci];
    for (let k = 0; k <= info.frames; k++) {
      a.time = Math.min((k / info.frames) * c.duration, c.duration);
      mixer.update(0);
      writeRow(info.start + k);
    }
  });
  mixer.stopAllAction();
  const boneTex = new DataTexture(data, B * 4, rows, RGBAFormat, FloatType);
  boneTex.needsUpdate = true;
  const byName = new Map(clips.map((c) => [c.name, c]));

  // --- per-LOD meshes ---------------------------------------------------------------------------
  const xformArr: Float32Array[] = [];
  const animArr: Float32Array[] = [];
  const tiltArr: Float32Array[] = [];
  const meshes = lods.filter(Boolean).map((src, li) => {
    // remap this LOD's skin indices onto LOD0's bone order when the skeletons differ
    const sb = src.skeleton.bones;
    if (sb !== bones && sb.some((b, i) => b !== bones[i])) {
      const map = sb.map((b) => Math.max(0, bones.indexOf(b)));
      const si = src.geometry.getAttribute('skinIndex');
      for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) si.setComponent(i, k, map[si.getComponent(i, k)]);
    }
    const geo = new InstancedBufferGeometry();
    geo.index = src.geometry.index;
    for (const [k, v] of Object.entries(src.geometry.attributes)) geo.setAttribute(k, v);
    const xf = new Float32Array(max * 4);
    const an = new Float32Array(max * 4);
    xformArr.push(xf);
    animArr.push(an);
    geo.setAttribute('crowdXform', new InstancedBufferAttribute(xf, 4));
    geo.setAttribute('crowdAnim', new InstancedBufferAttribute(an, 4));
    const tl = new Float32Array(max * 2);
    tiltArr.push(tl);
    geo.setAttribute('crowdTilt', new InstancedBufferAttribute(tl, 2));
    geo.instanceCount = 0;

    // Root-space skinning: pre * Σ w·Bone * post * p, pre/post fold in the mesh node TRS (meshopt dequant) and bind matrix.
    const pre = uniform(new Matrix4().multiplyMatrices(src.matrixWorld, src.bindMatrixInverse));
    const post = uniform(src.bindMatrix.clone());
    const xform = attribute('crowdXform', 'vec4');
    const anim = attribute('crowdAnim', 'vec4'); // rowA, fracA, rowB, weightB
    const skinIndex = attribute('skinIndex', 'uvec4');
    const skinWeight = attribute('skinWeight', 'vec4');
    const boneMat = (row: Node, bone: Node) => {
      const x = bone.mul(4);
      return mat4(
        textureLoad(boneTex, ivec2(x, row)),
        textureLoad(boneTex, ivec2(x.add(1), row)),
        textureLoad(boneTex, ivec2(x.add(2), row)),
        textureLoad(boneTex, ivec2(x.add(3), row)),
      );
    };
    const rowA = int(anim.x);
    const rowB = int(anim.z);
    const fA = anim.y;
    const wB = anim.w;
    // Clip A interpolated between its two nearest baked frames; clip B (the fade-out source) is only fetched
    // while a crossfade is running, so a steady walker costs 2 matrix fetches per influence, not 3.
    const C = ['x', 'y', 'z', 'w'] as const;
    const skinFn = Fn(() => {
      const m: Node = mat4(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0).toVar();
      for (const c of C) {
        const bi = int(skinIndex[c]);
        m.addAssign(boneMat(rowA, bi).mul(float(1).sub(fA)).add(boneMat(rowA.add(1), bi).mul(fA)).mul(skinWeight[c]));
      }
      If(wB.greaterThan(0.001), () => {
        const b: Node = mat4(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0).toVar();
        for (const c of C) b.addAssign(boneMat(rowB, int(skinIndex[c])).mul(skinWeight[c]));
        m.assign(m.mul(float(1).sub(wB)).add(b.mul(wB)));
      });
      return m;
    });
    const skin = skinFn().toVar();
    const full = pre.mul(skin).mul(post);
    const local = full.mul(vec4(positionGeometry, 1)).xyz;
    const yaw = xform.w;
    const cy = cos(yaw);
    const sy = sin(yaw);
    // whole-body tilt about the feet: pitch around X (+ = lean back), then roll around Z, then yaw
    const tilt = attribute('crowdTilt', 'vec2');
    const cp = cos(tilt.x);
    const sp = sin(tilt.x);
    const cr = cos(tilt.y);
    const sr = sin(tilt.y);
    const rot = (v0: Node) => {
      const v1 = vec3(v0.x, v0.y.mul(cp).sub(v0.z.mul(sp)), v0.y.mul(sp).add(v0.z.mul(cp)));
      const v = vec3(v1.x.mul(cr).sub(v1.y.mul(sr)), v1.x.mul(sr).add(v1.y.mul(cr)), v1.z);
      return vec3(v.x.mul(cy).add(v.z.mul(sy)), v.y, v.z.mul(cy).sub(v.x.mul(sy)));
    };

    const mat = new CrowdMaterial({ map: palette.map, roughness: 0.85, metalness: 0 });
    mat.name = `crowd_${modelId}_LOD${li}`;
    mat.positionNode = rot(local).add(xform.xyz); // also used by the shadow pass
    mat.crowdNormal = rot(full.mul(vec4(normalGeometry, 0)).xyz).normalize();
    const mesh = new Mesh(geo, mat);
    mesh.name = mat.name;
    mesh.frustumCulled = false; // culled per instance on the CPU
    mesh.castShadow = (opts.castShadow ?? true) && li === 0; // shadows only within the LOD0 radius
    mesh.receiveShadow = true;
    game.scene.add(mesh);
    return mesh;
  });

  // --- instance state (plain data) ---------------------------------------------------------------
  const S = {
    used: new Uint8Array(max),
    vis: new Uint8Array(max),
    pos: new Float32Array(max * 4), // x y z yaw
    tilt: new Float32Array(max * 2), // pitch roll
    clipA: new Int16Array(max).fill(-1),
    tA: new Float32Array(max),
    loopA: new Uint8Array(max),
    clipB: new Int16Array(max).fill(-1),
    tB: new Float32Array(max),
    loopB: new Uint8Array(max),
    fade: new Float32Array(max), // remaining fade time
    fadeDur: new Float32Array(max),
    scale: new Float32Array(max), // clip timeScale
    speed: new Float32Array(max), // hitstop multiplier
  };
  let live = 0;
  const free: number[] = [];
  for (let i = max - 1; i >= 0; i--) free.push(i);

  const rowAt = (ci: number, t: number, loop: boolean, out: { row: number; frac: number }) => {
    if (ci < 0) {
      out.row = 0;
      out.frac = 0;
      return;
    }
    const c = clips[ci];
    let u = loop ? (t % c.duration) / c.duration : Math.min(t / c.duration, 1);
    if (u < 0) u += 1;
    const f = u * c.frames;
    const k = Math.min(Math.floor(f), c.frames - 1);
    out.row = c.start + k;
    out.frac = Math.min(1, f - k);
  };
  const ra = { row: 0, frac: 0 };
  const rb = { row: 0, frac: 0 };

  const nLod = meshes.length;
  const counts = new Int32Array(nLod);
  game.addSystem({
    name: 'crowd',
    render(_alpha, frameDt) {
      game.perf.begin('crowd');
      const dt = game.paused ? 0 : frameDt;
      const cam = game.camera;
      _pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_pv);
      counts.fill(0);
      const cx = cam.position.x;
      const cz = cam.position.z;
      for (let i = 0; i < max; i++) {
        if (!S.used[i]) continue;
        const sp = S.speed[i] * dt;
        S.tA[i] += sp * S.scale[i];
        if (S.fade[i] > 0) {
          S.fade[i] = Math.max(0, S.fade[i] - sp);
          S.tB[i] += sp * S.scale[i];
        }
        if (!S.vis[i]) continue;
        const x = S.pos[i * 4];
        const y = S.pos[i * 4 + 1];
        const z = S.pos[i * 4 + 2];
        const d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
        _sphere.center.set(x, y + 0.9, z);
        _sphere.radius = 1.3;
        if (d2 > 16 && !_frustum.intersectsSphere(_sphere)) continue;
        const l = Math.min(nLod - 1, d2 < lod1 * lod1 ? 0 : d2 < lod2 * lod2 ? 1 : 2);
        const o = counts[l]++ * 4;
        const xf = xformArr[l];
        xf[o] = x;
        xf[o + 1] = y;
        xf[o + 2] = z;
        xf[o + 3] = S.pos[i * 4 + 3];
        rowAt(S.clipA[i], S.tA[i], S.loopA[i] === 1, ra);
        const fading = S.fade[i] > 0 && S.clipB[i] >= 0;
        if (fading) rowAt(S.clipB[i], S.tB[i], S.loopB[i] === 1, rb);
        const tl = tiltArr[l];
        tl[(o >> 1)] = S.tilt[i * 2];
        tl[(o >> 1) + 1] = S.tilt[i * 2 + 1];
        const an = animArr[l];
        an[o] = ra.row;
        an[o + 1] = ra.frac;
        an[o + 2] = fading ? rb.row : ra.row;
        an[o + 3] = fading ? S.fade[i] / S.fadeDur[i] : 0;
      }
      for (let l = 0; l < nLod; l++) {
        const g = meshes[l].geometry as InstancedBufferGeometry;
        g.instanceCount = counts[l];
        meshes[l].visible = counts[l] > 0;
        if (counts[l]) {
          (g.getAttribute('crowdXform') as InstancedBufferAttribute).needsUpdate = true;
          (g.getAttribute('crowdAnim') as InstancedBufferAttribute).needsUpdate = true;
          (g.getAttribute('crowdTilt') as InstancedBufferAttribute).needsUpdate = true;
        }
      }
      game.perf.end('crowd');
    },
  });

  const crowd: Crowd = {
    clips: clips.map((c) => c.name),
    get count() {
      return live;
    },
    meshes,
    duration: (clip) => byName.get(clip)?.duration ?? 0,
    add() {
      const i = free.pop();
      if (i === undefined) throw new Error(`crowd ${modelId}: max ${max} instances`);
      S.used[i] = S.vis[i] = 1;
      S.clipA[i] = S.clipB[i] = -1;
      S.tA[i] = S.tB[i] = S.fade[i] = 0;
      S.scale[i] = S.speed[i] = 1;
      live++;
      return i;
    },
    remove(i) {
      if (!S.used[i]) return;
      S.used[i] = 0;
      free.push(i);
      live--;
    },
    set(i, x, y, z, yaw) {
      S.pos[i * 4] = x;
      S.pos[i * 4 + 1] = y;
      S.pos[i * 4 + 2] = z;
      S.pos[i * 4 + 3] = yaw;
    },
    play(i, clip, o = {}) {
      const ci = clips.findIndex((c) => c.name === clip);
      if (ci < 0) return;
      S.scale[i] = o.timeScale ?? 1;
      if (ci === S.clipA[i] && !o.restart) return;
      const fade = o.fade ?? 0.2;
      if (S.clipA[i] >= 0 && fade > 0) {
        S.clipB[i] = S.clipA[i];
        S.tB[i] = S.tA[i];
        S.loopB[i] = S.loopA[i];
        S.fade[i] = S.fadeDur[i] = fade;
      } else S.fade[i] = 0;
      S.clipA[i] = ci;
      S.tA[i] = 0;
      S.loopA[i] = (o.loop ?? true) ? 1 : 0;
    },
    setTilt(i, pitch, roll = 0) {
      S.tilt[i * 2] = pitch;
      S.tilt[i * 2 + 1] = roll;
    },
    setSpeed: (i, s) => void (S.speed[i] = s),
    setVisible: (i, v) => void (S.vis[i] = v ? 1 : 0),
    clip: (i) => clips[S.clipA[i]]?.name ?? '',
    time: (i) => S.tA[i],
    finished: (i) => S.clipA[i] >= 0 && !S.loopA[i] && S.tA[i] >= clips[S.clipA[i]].duration,
  };
  return crowd;
}

/** Palette material whose vertex stage is the crowd skinning (positionNode) and whose normals are skinned too. */
class CrowdMaterial extends MeshStandardNodeMaterial {
  crowdNormal: Node | null = null;
  setupPosition(builder: Parameters<MeshStandardNodeMaterial['setupPosition']>[0]) {
    const p = super.setupPosition(builder);
    if (this.crowdNormal) normalLocal.assign(this.crowdNormal);
    return p;
  }
}
