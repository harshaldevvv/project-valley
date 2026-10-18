import { BufferAttribute, BufferGeometry, LineSegments, Vector3, type InstancedBufferGeometry, type InstancedMesh, type Mesh } from 'three';
import { LineBasicNodeMaterial } from 'three/webgpu';
import type { Game } from '../core/game';
import { look } from '../content/data/input';
import { cameraFeel } from '../content/data/player';
import { fxTuning } from '../content/data/fx';
import { sounds } from '../content/data/sounds';
import { yard, type StationId } from '../content/data/yard';
import { createDebugPanel } from '../ui/debug/panel';
import { installMenu } from '../ui/menu/menu';
import { createAudio } from './audio';
import { installPost, type Post } from './post';
import { createTimeOfDay, TIME_PRESETS } from './timeofday';
import { createSky } from './sky';
import { detectGpu } from './gpuinfo';
import { menuText } from '../content/text/ui';
import { createClock, type Clock } from './clock';
import { createLamps } from './lamps';

/**
 * engine-builder: installs game.debug (F1 panel), game.audio (Web Audio), post-processing (FXAA, render scale),
 * time of day, the physics collider view and the title/pause menu. Call before the world and gameplay installs.
 * Extra engine handles are returned (and exposed as window.engine for console use).
 */
const BASE_SENSITIVITY = look.sensitivity;

/** Where "teleport to station" puts the player: just outside the station's south edge, facing north into it. */
export function stationSpot(id: StationId | 'spawn'): { p: Vector3; yaw: number } {
  if (id === 'spawn') return { p: new Vector3(yard.spawn.x, 0.1, yard.spawn.z), yaw: yard.spawn.yaw };
  const s = yard.stations[id];
  const z = 'targetDistances' in s ? s.z + 2 : s.z + s.d / 2 + 1.5;
  return { p: new Vector3(s.x, 0.1, z), yaw: 0 };
}

export async function installEngine(game: Game) {
  let menu: ReturnType<typeof installMenu> | null = null; // created last; the debug panel's relock reads it
  // --- debug panel -------------------------------------------------------------------------
  const panel = createDebugPanel(game.events, () => {
    if (menu?.mode === 'playing') void game.renderer.domElement.requestPointerLock()?.catch?.(() => {});
  });
  game.debug = panel;

  // --- audio -------------------------------------------------------------------------------
  const audio = createAudio();
  game.audio = audio.api;
  game.addSystem({
    name: 'audio',
    render() {
      game.perf.begin('audio');
      audio.update(game.camera);
      game.perf.end('audio');
    },
  });

  // --- post + time of day ------------------------------------------------------------------
  const post = installPost(game);
  const tod = createTimeOfDay(game);
  // game.time is live from install; the running clock (clock.ts) is created at start, once the world and saves exist.
  let clock: Clock | null = null;
  game.time = {
    get hours() {
      return clock ? clock.hours : tod.hours;
    },
    get night() {
      return tod.night;
    },
    get day() {
      return clock ? clock.day : 1;
    },
  };
  const setHours = (h: number) => (clock ? clock.set(h) : tod.set(h));
  createSky(game, tod);

  // --- teleport ----------------------------------------------------------------------------
  const teleport = (id: StationId | 'spawn') => {
    const { p, yaw } = stationSpot(id);
    try {
      game.player.teleport(p, yaw);
    } catch (e) {
      console.warn('teleport: player not installed', e);
    }
  };
  game.debug.action('Teleport', 'Spawn', () => teleport('spawn'));
  const sentence = (t: string) => t[0] + t.slice(1).toLowerCase();
  for (const id of Object.keys(yard.stations) as StationId[]) game.debug.action('Teleport', sentence(yard.stations[id].label), () => teleport(id));

  // --- time ----------------------------------------------------------------------------------
  const timeBind = {
    get hours() {
      return game.time.hours;
    },
    set hours(h: number) {
      setHours(h);
    },
    get x20_speed() {
      return clock?.fast ?? false;
    },
    set x20_speed(v: boolean) {
      if (clock) clock.fast = v;
    },
  };
  game.debug.tune('Time', timeBind, 'hours', 0, 24, 0.1);
  game.debug.toggle('Time', timeBind, 'x20_speed');
  game.debug.watch('Time', 'day / time', () => `day ${game.time.day}  ${String(Math.floor(game.time.hours)).padStart(2, '0')}:${String(Math.floor((game.time.hours % 1) * 60)).padStart(2, '0')}  night ${game.time.night.toFixed(2)}`);
  for (const [name, h] of Object.entries(TIME_PRESETS)) game.debug.action('Time', name, () => setHours(h));

  // --- render --------------------------------------------------------------------------------
  const colliders = physicsLines(game);
  const renderBind = {
    get shadows() {
      return post.settings.shadows;
    },
    set shadows(v: boolean) {
      post.settings.shadows = v;
      post.apply();
    },
    get fxaa() {
      return post.settings.fxaa;
    },
    set fxaa(v: boolean) {
      post.settings.fxaa = v;
      post.apply();
    },
    get renderScale() {
      return post.settings.renderScale;
    },
    set renderScale(v: number) {
      post.settings.renderScale = v;
      post.apply();
    },
    get colliders() {
      return colliders.enabled;
    },
    set colliders(v: boolean) {
      colliders.enabled = v;
    },
  };
  game.debug.toggle('Render', renderBind, 'shadows');
  game.debug.toggle('Render', renderBind, 'fxaa');
  game.debug.tune('Render', renderBind, 'renderScale', 0.5, 1, 0.05);
  game.debug.toggle('Render', renderBind, 'colliders');
  game.debug.watch('Render', 'draws / tris', () => {
    const r = game.renderer.info.render;
    return `${r.drawCalls} / ${(r.triangles / 1000).toFixed(1)}k`;
  });

  // --- perf ----------------------------------------------------------------------------------
  game.debug.action('Perf', 'Toggle overlay (F3)', () => game.perf.toggleOverlay());
  game.debug.action('Perf', 'Reset stats', () => game.perf.reset());
  game.debug.watch('Perf', 'frame', () => {
    const s = game.perf.snapshot();
    return `p50 ${s.p50.toFixed(1)}  p95 ${s.p95.toFixed(1)}  p99 ${s.p99.toFixed(1)} ms`;
  });

  // --- audio debug ---------------------------------------------------------------------------
  const volBind = {
    get master() {
      return audio.settings.master;
    },
    set master(v: number) {
      audio.settings.master = v;
      audio.applyVolumes();
    },
  };
  game.debug.tune('Audio', volBind, 'master', 0, 1, 0.05);
  const ids = Object.keys(sounds);
  let next = 0;
  let last = '';
  game.debug.action('Audio', 'Play next sound', () => {
    last = ids[next++ % ids.length];
    game.audio.play(last);
  });
  game.debug.action('Audio', 'Play 3D at 10 m', () => {
    const p = game.camera.getWorldDirection(new Vector3()).multiplyScalar(10).add(game.camera.position);
    game.audio.play(last || 'zombie_groan', p);
  });
  game.debug.watch('Audio', 'last / voices', () => `${last || '-'} / ${audio.voices} (${audio.ctx.state})`);

  // --- menu ----------------------------------------------------------------------------------
  menu = installMenu(game, {
    applySettings(s) {
      cameraFeel.fovHip = s.fov;
      look.sensitivity = BASE_SENSITIVITY * s.sensitivity;
      cameraFeel.shake = s.shake;
      Object.assign(post.settings, { fxaa: s.fxaa, renderScale: s.renderScale, shadows: s.shadows });
      post.apply();
      audio.settings.master = s.volume;
      audio.applyVolumes();
      fxTuning.reduceFlashing = s.reduceFlashing;
      fxTuning.gore = s.gore;
    },
    stations: [
      { id: 'spawn', label: 'Spawn', go: () => teleport('spawn') },
      ...(Object.keys(yard.stations) as StationId[]).map((id) => ({ id, label: yard.stations[id].label, go: () => teleport(id) })),
    ],
  });

  // Warm-up before the loop starts (behind the title): first physics step + every pipeline compiled.
  const start = game.start;
  game.start = async () => {
    // World data exists now (installed after the engine). Lamps add fixed lights, so create them before warm-up.
    const { lampHeads } = await import('../world/yard/poles');
    createLamps(game, tod, lampHeads);
    clock = createClock(game, tod); // also registers the 'world.time' save slice
    await warmup(game, post);
    // After boot, so 135 sound files don't share bandwidth with the models; until a buffer lands, play() uses a synth.
    void audio.preload();
    return start();
  };

  // Which GPU (QA-075): label in the F3 overlay; on integrated graphics a one-time menu note.
  void detectGpu(game.renderer).then((gpu) => {
    game.perf.extra.gpu = gpu.label + (gpu.integrated ? ' (integrated)' : '');
    if (gpu.integrated) menu?.showNote('igpu', menuText.igpuNote);
  });

  const engine = { audio, post, tod, menu, panel, setTimeOfDay: setHours, get clock() { return clock; } };
  (window as unknown as { engine: typeof engine }).engine = engine;
  return engine;
}

/**
 * Kills first-use hitches (QA: ~0.5 s first world.step, >50 ms compiles when new things come into view):
 * - one physics step builds the broadphase for all static colliders;
 * - every object is temporarily made visible, unculled and non-empty, then compiled (compileAsync) and drawn
 *   once through the real renderFrame, so colour, shadow and post pipelines all exist before play.
 */
async function warmup(game: Game, post: Post) {
  const t0 = performance.now();
  game.phys.world.step();
  const t1 = performance.now();
  const restore: (() => void)[] = [];
  game.scene.traverse((o) => {
    const { visible, frustumCulled } = o;
    o.visible = true;
    o.frustumCulled = false;
    const inst = o as InstancedMesh;
    const geo = (o as Mesh).geometry as InstancedBufferGeometry | undefined;
    if (inst.isInstancedMesh && inst.count === 0) {
      inst.count = 1;
      restore.push(() => (inst.count = 0));
    } else if (geo?.isInstancedBufferGeometry && geo.instanceCount === 0) {
      geo.instanceCount = 1;
      restore.push(() => (geo.instanceCount = 0));
    }
    restore.push(() => {
      o.visible = visible;
      o.frustumCulled = frustumCulled;
    });
  });
  // ponytail: no compileAsync pass — measured 3–5 s for everything forced visible vs ~1–3 s for one synchronous
  // frame (pipelines are created on first draw either way). post.compileAsync() exists if load-time compile matters.
  void post;
  const t2 = performance.now();
  game.renderFrame();
  // WebGPU compiles lazily in the GPU process; wait for the warm frame so the stall lands here, not in play.
  const device = (game.renderer.backend as { device?: GPUDevice }).device;
  await device?.queue.onSubmittedWorkDone();
  const t3 = performance.now();
  for (const r of restore) r();
  console.info(`engine warm-up: physics ${(t1 - t0).toFixed(0)} ms, first frame ${(t3 - t2).toFixed(0)} ms`);
}

/** Rapier debugRender as line segments, refreshed every 30 frames while enabled (debug only: ~180k verts in the Yard). */
function physicsLines(game: Game) {
  const mat = new LineBasicNodeMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });
  const geo = new BufferGeometry(); // never empty: WebGPU warns about a missing position attribute
  geo.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(8), 4));
  const lines = new LineSegments(geo, mat);
  lines.name = 'physics_debug';
  lines.frustumCulled = false;
  lines.visible = false;
  game.scene.add(lines);
  let cap = 0;
  let frame = 0;
  const state = { enabled: false };
  game.addSystem({
    name: 'physDebug',
    render() {
      lines.visible &&= state.enabled;
      if (!state.enabled || ++frame % 30) return;
      const { vertices, colors } = game.phys.world.debugRender();
      const n = vertices.length / 3;
      if (n > cap) {
        cap = Math.ceil(n * 1.5);
        lines.geometry.dispose();
        lines.geometry = new BufferGeometry();
        lines.geometry.setAttribute('position', new BufferAttribute(new Float32Array(cap * 3), 3));
        lines.geometry.setAttribute('color', new BufferAttribute(new Float32Array(cap * 4), 4));
      }
      const pos = lines.geometry.getAttribute('position') as BufferAttribute;
      const col = lines.geometry.getAttribute('color') as BufferAttribute;
      (pos.array as Float32Array).set(vertices);
      (col.array as Float32Array).set(colors);
      pos.needsUpdate = col.needsUpdate = true;
      lines.geometry.setDrawRange(0, n);
      lines.visible = n > 0;
    },
  });
  return state;
}
