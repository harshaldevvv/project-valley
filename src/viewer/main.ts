import { AnimationMixer, Box3, Vector3, Color, DirectionalLight, GridHelper, Group, HemisphereLight, LoopOnce, LoopRepeat, PerspectiveCamera, Scene, SkeletonHelper, type AnimationAction, type AnimationClip, type Mesh, type Object3D } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import manifest from '../../public/assets/models/manifest.json';
import { gltfLoader } from '../engine/assets';
import { paletteCharacterMaterial, paletteMaterial } from '../engine/palette';
import { assetUrl } from '../engine/assetUrl';
import { createOutfit, type Outfit } from '../gameplay/outfit/outfit';
import { OUTFIT_PARTS, OUTFIT_PRESETS, OUTFIT_SLOTS } from '../content/data/outfit';
import { OUTFIT_PART_NAMES, OUTFIT_PRESET_NAMES, OUTFIT_SLOT_NAMES } from '../content/text/outfit';

/**
 * Character viewer (dev tool, /viewer.html): pick a model, play any of its clips with crossfade, hold items in the right
 * hand, orbit the camera, toggle skeleton and wireframe. `window.__viewer` is the scripting API used by the audit
 * screenshots: load(id), play(name), setTime(s), cam('front'|'side'|'back'|'three'|'face'), attach(slot, id).
 */
type Entry = { url: string };
const M = manifest as Record<string, Entry>;
const ids = Object.keys(M).filter((k) => /^(chr_survivor|chr_hero|chr_body|zmb_)/.test(k) && !k.endsWith('_parts'));
let outfit: Outfit | null = null;
const q = new URLSearchParams(location.search);
const side = document.getElementById('side')!;
const stage = document.getElementById('stage')!;
const hud = document.getElementById('hud')!;

const renderer = new WebGPURenderer({ antialias: true });
await renderer.init();
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.prepend(renderer.domElement);
const scene = new Scene();
scene.background = new Color('#1b2128');
scene.add(new HemisphereLight('#dfe8f2', '#4a4338', 2.4));
const key = new DirectionalLight('#fff2dc', 2.6);
key.position.set(2.5, 4, 3);
scene.add(key, new GridHelper(6, 12, '#2f3a44', '#232b33'));
const camera = new PerspectiveCamera(35, 1, 0.05, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);
const resize = () => {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
addEventListener('resize', resize);
resize();

const root = new Group();
scene.add(root);
let model: Object3D | null = null;
let mixer: AnimationMixer | null = null;
let clips: AnimationClip[] = [];
let action: AnimationAction | null = null;
let helper: SkeletonHelper | null = null;
let speed = 1;
let loop = true;
let current = '';
const held = new Map<string, Object3D>();

async function load(id: string) {
  const gltf = await gltfLoader.loadAsync(assetUrl(M[id].url));
  if (model) root.remove(model);
  held.clear();
  model = skeletonClone(gltf.scene);
  const mat = /^chr_/.test(id) ? await paletteCharacterMaterial() : await paletteMaterial();
  model.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    if (/_LOD[1-9]$/.test(m.name) || m.name.includes('_COL_')) {
      m.visible = false;
      return;
    }
    const own = m.material as { map?: unknown; vertexColors?: boolean };
    if (!own.map && !own.vertexColors) m.material = mat;
    m.frustumCulled = false;
  });
  root.add(model);
  clips = gltf.animations;
  mixer = new AnimationMixer(model);
  action = null;
  if (helper) scene.remove(helper);
  helper = new SkeletonHelper(model);
  helper.visible = false;
  scene.add(helper);
  const box = new Box3().setFromObject(model);
  controls.target.set(0, (box.max.y - box.min.y) * 0.5, 0);
  outfit?.dispose();
  outfit = null;
  if (id === 'chr_body_a') outfit = createOutfit(model, (await gltfLoader.loadAsync(assetUrl(M.chr_body_a_parts.url))).scene);
  build(id);
  const idle = clips.find((c) => /^(idle|z_idle)$/.test(c.name)) ?? clips[0];
  if (idle) play(idle.name);
  hud.textContent = `${id} - ${clips.length} clips`;
}

function play(name: string, fade = 0.2) {
  const clip = clips.find((c) => c.name === name);
  if (!clip || !mixer) return;
  const next = mixer.clipAction(clip);
  next.reset();
  next.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
  next.clampWhenFinished = !loop;
  next.timeScale = speed;
  if (action && action !== next) next.crossFadeFrom(action, fade, false);
  next.play();
  action = next;
  current = name;
  document.querySelectorAll('[data-clip]').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.clip === name));
}

const GROUPS: [string, RegExp][] = [
  ['Locomotion', /^(idle|walk|run|sprint|crouch|strafe|turn|jump|land|fall|z_(idle|walk|run|crawl))/],
  ['Rifle', /rifle/],
  ['Pistol', /pistol/],
  ['Melee and shove', /melee|shove|z_(attack|grab)/],
  ['Items and interact', /bandage|eat|drink|interact|drive/],
  ['Reactions', /hit|death|stagger/],
];
function build(id: string) {
  const g = (t: string) => `<h2>${t}</h2>`;
  const btn = (c: AnimationClip) => `<button data-clip="${c.name}">${c.name}</button>`;
  const groups = GROUPS.map(([t, re]) => {
    const c = clips.filter((x) => re.test(x.name));
    return c.length ? g(t) + `<div class="grid">${c.map(btn).join('')}</div>` : '';
  }).join('');
  const holds = ['none', 'wpn_rifle_a', 'wpn_pistol_a', 'wpn_knife_a', 'wpn_crowbar_a', 'wpn_hammer_a'];
  side.innerHTML = `<h1>Character viewer</h1>${g('Model')}<select id="model">${ids.map((i) => `<option ${i === id ? 'selected' : ''}>${i}</option>`).join('')}</select>
  ${g('Camera')}<div class="grid">${['front', 'side', 'back', 'three', 'face', 'hand', 'handL'].map((c) => `<button data-cam="${c}">${c}</button>`).join('')}</div>
  ${g('Playback')}<label>speed <input id="speed" type="range" min="0.1" max="2" step="0.05" value="${speed}"><span id="sv">${speed}x</span></label>
  <label><input id="loop" type="checkbox" ${loop ? 'checked' : ''}> loop</label><label><input id="skel" type="checkbox"> skeleton</label><label><input id="wire" type="checkbox"> wireframe</label>
  ${g('Hold (right hand)')}<div class="grid">${holds.map((w) => `<button data-hold="${w}">${w.replace('wpn_', '').replace('_a', '')}</button>`).join('')}</div>
  ${outfit ? wardrobe() : ''}
  ${groups}${g('All clips')}<div class="grid">${clips.map(btn).join('')}</div>`;
  (side.querySelector('#model') as HTMLSelectElement).onchange = (e) => void load((e.target as HTMLSelectElement).value);
  side.querySelectorAll('[data-clip]').forEach((b) => ((b as HTMLElement).onclick = () => play((b as HTMLElement).dataset.clip!)));
  side.querySelectorAll('[data-cam]').forEach((b) => ((b as HTMLElement).onclick = () => cam((b as HTMLElement).dataset.cam!)));
  side.querySelectorAll('[data-wear]').forEach((b) => ((b as HTMLElement).onclick = () => wear((b as HTMLElement).dataset.wear!)));
  side.querySelectorAll('[data-hold]').forEach((b) => ((b as HTMLElement).onclick = () => void attach('hand_R', (b as HTMLElement).dataset.hold!)));
  const sp = side.querySelector('#speed') as HTMLInputElement;
  sp.oninput = () => {
    speed = +sp.value;
    (side.querySelector('#sv') as HTMLElement).textContent = `${speed}x`;
    if (action) action.timeScale = speed;
  };
  (side.querySelector('#loop') as HTMLInputElement).onchange = (e) => {
    loop = (e.target as HTMLInputElement).checked;
    play(current);
  };
  (side.querySelector('#skel') as HTMLInputElement).onchange = (e) => {
    if (helper) helper.visible = (e.target as HTMLInputElement).checked;
  };
  (side.querySelector('#wire') as HTMLInputElement).onchange = (e) =>
    model?.traverse((o) => {
      const m = (o as Mesh).material as { wireframe?: boolean } | undefined;
      if (m && 'wireframe' in m) m.wireframe = (e.target as HTMLInputElement).checked;
    });
}

const slotName = (id: string) => OUTFIT_PARTS.find((p) => p.id === id)!.slot;
function wardrobe() {
  return `<h2>Wardrobe</h2><h2>Looks</h2><div class="grid">${Object.keys(OUTFIT_PRESETS).map((k) => `<button data-wear="look:${k}">${OUTFIT_PRESET_NAMES[k]}</button>`).join('')}</div>` + OUTFIT_SLOTS.map((sl) => {
    const parts = OUTFIT_PARTS.filter((p) => p.slot === sl);
    if (!parts.length) return '';
    const row = parts.map((p) => `<button data-wear="${p.id}:0">${OUTFIT_PART_NAMES[p.id]}</button>`).join('');
    const tints = parts.map((p) => p.tints.map((c, i) => `<button data-wear="${p.id}:${i}" title="${p.id}" style="background:${c};width:18px;height:18px;padding:0"></button>`).join('')).join('');
    return `<h2>${OUTFIT_SLOT_NAMES[sl]}</h2><div class="grid">${row}<button data-wear="${sl}:none">none</button></div><div class="grid">${tints}</div>`;
  }).join('') + `<div class="grid"><button data-wear="all:none">strip all</button></div>`;
}
function wear(spec: string) {
  if (!outfit) return;
  const [id, arg] = spec.split(':');
  if (id === 'all') return outfit.setState({});
  if (id === 'look') {
    const st: Record<string, { id: string; tint: number }> = {};
    for (const [sl, [pid, tint]] of Object.entries(OUTFIT_PRESETS[arg])) st[sl] = { id: pid, tint };
    return outfit.setState(st);
  }
  if (arg === 'none') return outfit.equip(id as never, null);
  outfit.equip(slotName(id), id, +arg);
}

async function attach(slot: string, wid: string) {
  if (!model) return;
  held.get(slot)?.removeFromParent();
  held.delete(slot);
  if (wid === 'none') return;
  const sock = model.getObjectByName('SOCKET_hand_R') ?? model.getObjectByName('hand_R') ?? model.getObjectByName('RightHand');
  if (!sock) return;
  const g = await gltfLoader.loadAsync(assetUrl(M[wid].url));
  const w = g.scene;
  const mat = await paletteMaterial();
  w.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    if (/_LOD[1-9]$/.test(m.name) || m.name.includes('_COL_')) m.visible = false;
    else m.material = mat;
  });
  sock.add(w);
  held.set(slot, w);
}

function cam(view: string) {
  if (view === 'hand' || view === 'handL') {
    // close-up of a hand (from the front-right of the character, slightly above) for checking grips
    const sock = model?.getObjectByName(view === 'hand' ? 'SOCKET_hand_R' : 'SOCKET_hand_L');
    if (sock) {
      sock.updateWorldMatrix(true, false);
      const p = new Vector3().setFromMatrixPosition(sock.matrixWorld);
      controls.target.copy(p);
      camera.position.set(p.x + (view === 'hand' ? 0.45 : -0.45), p.y + 0.18, p.z - 0.45);
      controls.update();
      return;
    }
  }
  const t = controls.target;
  const face = view === 'face';
  const d = face ? 0.9 : 3.6;
  const y = face ? t.y * 1.78 : t.y;
  const dirs: Record<string, [number, number]> = { front: [0, -1], side: [1, 0], back: [0, 1], three: [0.7, -0.7], face: [0.3, -1] }; // characters face -Z
  const [x, z] = dirs[view] ?? dirs.three;
  camera.position.set(t.x + x * d, y + (view === 'three' ? 0.5 : 0), t.z + z * d);
  controls.target.set(t.x, y, t.z);
  controls.update();
}

const api = {
  ids,
  load,
  play,
  cam,
  attach,
  wear,
  get outfit() {
    return outfit?.state;
  },
  setTime: (s: number) => {
    if (action) {
      action.paused = true;
      action.time = s;
      mixer?.update(0);
    }
  },
  get clips() {
    return clips.map((c) => c.name);
  },
  get current() {
    return current;
  },
  ready: false,
};
(window as unknown as { __viewer: typeof api }).__viewer = api;
let last = performance.now();
renderer.setAnimationLoop(() => {
  const n = performance.now();
  mixer?.update(Math.min(0.05, (n - last) / 1000));
  last = n;
  controls.update();
  renderer.render(scene, camera);
});
const want = q.get('model');
await load(want && ids.includes(want) ? want : 'chr_survivor_a');
cam('three');
api.ready = true;
