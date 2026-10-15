import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import { Input } from '../engine/input';
import { FixedLoop } from '../engine/loop';
import { paletteMaterial } from '../engine/palette';
import { Perf } from '../engine/perf';
import { createPhysics, type Physics } from '../engine/physics';
import { createRenderer, type Backend } from '../engine/renderer';
import { createRng, type Rng } from '../engine/rng';
import type { AudioApi, BuildApi, DebugApi, Interactable, InteractApi, InventoryUi, LoadoutApi, Places, PlayerView } from './contracts';
import { EventBus } from './events';

/**
 * The game context (service locator, principles §13). Created once; each team's install function
 * adds its systems and fills its API slot. Order of install (main.ts):
 *   engine extras -> world (yard) -> systems -> gameplay  -> start()
 */
export interface GameSystem {
  name: string; // also the perf-overlay label
  /** Fixed 60 Hz sim step. */
  step?(dt: number, tick: number): void;
  /** Once per rendered frame; alpha = interpolation factor between the last two sim states. */
  render?(alpha: number, frameDt: number): void;
}

export interface Game {
  renderer: WebGPURenderer;
  backend: Backend;
  scene: Scene;
  camera: PerspectiveCamera;
  sun: DirectionalLight;
  phys: Physics;
  input: Input;
  perf: Perf;
  rng: Rng;
  events: EventBus;
  /** Root for DOM UI layered over the canvas. */
  ui: HTMLElement;
  places: Places;
  /** Sim tick counter. */
  tick: number;
  addSystem(s: GameSystem): void;
  // API slots, filled by their owners during install (see contracts.ts).
  debug: DebugApi;
  audio: AudioApi;
  interact: InteractApi;
  player: PlayerView;
  loadout: LoadoutApi;
  inventory: InventoryUi;
  build: BuildApi;
  start(): Promise<void>;
}

const missing = (name: string) =>
  new Proxy({}, { get: (_t, k) => { throw new Error(`game.${name}.${String(k)} used before its owner installed it`); } });

export async function createGame(): Promise<Game> {
  const { renderer, backend } = await createRenderer(document.body);
  const [phys] = await Promise.all([createPhysics(), paletteMaterial()]);

  const scene = new Scene();
  scene.background = new Color('#9fb0b4');
  scene.fog = new Fog('#9fb0b4', 60, 260);
  scene.add(new HemisphereLight('#dfe8ea', '#5b5240', 1.1));
  const sun = new DirectionalLight('#fff1d8', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const camera = new PerspectiveCamera(70, innerWidth / Math.max(1, innerHeight), 0.05, 600);
  addEventListener('resize', () => {
    if (!innerWidth || !innerHeight) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const ui = document.createElement('div');
  ui.id = 'ui';
  ui.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;font-family:system-ui,sans-serif;color:#e8ecef';
  document.body.appendChild(ui);

  const perf = new Perf(renderer, backend);
  const input = new Input(renderer.domElement);
  const events = new EventBus();
  const openScreens = new Set<string>();
  events.on('uiScreen', ({ name, open }) => {
    if (open) openScreens.add(name);
    else openScreens.delete(name);
    input.blocked = openScreens.size > 0;
  });

  const systems: GameSystem[] = [];
  const interactables: Interactable[] = [];
  const game: Game = {
    renderer, backend, scene, camera, sun, phys, input, perf, events, ui,
    rng: createRng(1),
    places: { containers: [], targets: [] },
    tick: 0,
    addSystem: (s) => systems.push(s),
    debug: missing('debug') as DebugApi,
    audio: missing('audio') as AudioApi,
    interact: {
      all: interactables,
      register(i) {
        interactables.push(i);
        return () => {
          const k = interactables.indexOf(i);
          if (k >= 0) interactables.splice(k, 1);
        };
      },
    },
    player: missing('player') as PlayerView,
    loadout: missing('loadout') as LoadoutApi,
    inventory: missing('inventory') as InventoryUi,
    build: missing('build') as BuildApi,
    async start() {
      const loop = new FixedLoop({
        step(dt, tick) {
          game.tick = tick;
          for (const s of systems) {
            if (!s.step) continue;
            perf.begin(s.name);
            s.step(dt, tick);
            perf.end(s.name);
          }
          perf.begin('physics');
          phys.world.step();
          perf.end('physics');
          events.drain();
          input.endTick();
        },
        render(alpha, frameDt) {
          for (const s of systems) s.render?.(alpha, frameDt);
          // Shadow camera follows the view so the 80 m shadow box covers what we see.
          sun.target.position.set(camera.position.x, 0, camera.position.z);
          sun.position.set(camera.position.x + 30, 60, camera.position.z + 20);
          perf.begin('render');
          renderer.render(scene, camera);
          perf.end('render');
          perf.frame(frameDt);
        },
      });
      await renderer.compileAsync(scene, camera); // warm pipelines (no first-use hitch)
      renderer.setAnimationLoop((t) => loop.frame(t));
    },
  };
  return game;
}
