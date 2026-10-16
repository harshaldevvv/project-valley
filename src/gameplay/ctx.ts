import type { Object3D, Vector3 } from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import type { Game } from '../core/game';
import type { AudioApi, DebugApi } from '../core/contracts';
import { keys, type KeyAction } from '../content/data/input';

/**
 * Shared gameplay context: one object every gameplay module reads, so modules stay decoupled
 * from install order. Other teams' APIs are probed once at install (they may not exist yet in M1).
 */

/** Returns the API if its owner installed it, else null (core puts a throwing Proxy in empty slots). */
export function probe<K extends keyof Game>(game: Game, k: K, member: string): Game[K] | null {
  try {
    const api = game[k] as unknown as Record<string, unknown>;
    return api[member] !== undefined ? game[k] : null;
  } catch {
    return null;
  }
}

const noopDebug: DebugApi = { action() {}, tune() {}, toggle() {}, watch() {} };

export type Zone = 'head' | 'body' | 'limb';
export type { FxSurface as Surface } from '../content/data/fx';
import type { FxSurface as Surface } from '../content/data/fx';

export interface HitInfo {
  point: Vector3;
  dir: Vector3; // normalized travel direction
  zone: Zone;
  /** Damage before zone multipliers (falloff already applied). */
  damage: number;
  headMul: number;
  weaponId: string;
  distance: number;
  melee?: { stagger: number; push: number; hitstop: number };
}
export interface HitResult {
  damage: number;
  kill: boolean;
  zone: Zone;
}
/** Anything a bullet or blade can hit. Registered per collider handle. */
export interface Hittable {
  kind: 'zombie' | 'target' | 'vehicle';
  surface: Surface;
  zone(collider: Collider, point: Vector3): Zone;
  hit(info: HitInfo): HitResult | null;
}

/** Keyboard (engine Input) + mouse buttons (Input doesn't track them yet) behind the data keymap. */
export class Controls {
  private mHeld = new Set<string>();
  private mPressed = new Set<string>();
  /** Debug/test look injection (pointer lock may not engage under automation). */
  lookDx = 0;
  lookDy = 0;

  constructor(private game: Game) {
    const canvas = game.renderer.domElement;
    addEventListener('mousedown', (e) => {
      if (e.target !== canvas && !document.pointerLockElement) return; // clicks on menus aren't shots
      const c = 'Mouse' + e.button;
      this.mHeld.add(c);
      this.mPressed.add(c);
    });
    addEventListener('mouseup', (e) => this.mHeld.delete('Mouse' + e.button));
    addEventListener('blur', () => this.mHeld.clear());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private code(a: KeyAction) {
    return keys[a];
  }
  down(a: KeyAction) {
    const c = this.code(a);
    if (c.startsWith('Mouse')) return !this.game.input.blocked && this.mHeld.has(c);
    return this.game.input.down(c);
  }
  pressed(a: KeyAction) {
    const c = this.code(a);
    if (c.startsWith('Mouse')) return !this.game.input.blocked && this.mPressed.has(c);
    return this.game.input.justPressed(c);
  }
  /** Raw key code helpers for test hooks. */
  press(code: string, held: boolean) {
    if (held) {
      this.mHeld.add(code);
      this.mPressed.add(code);
    } else this.mHeld.delete(code);
  }
  takeLook(): [number, number] {
    const [x, y] = this.game.input.takeMouse();
    const d: [number, number] = [x + this.lookDx, y + this.lookDy];
    this.lookDx = this.lookDy = 0;
    return d;
  }
  endTick() {
    this.mPressed.clear();
  }
}

export interface Ctx {
  game: Game;
  debug: DebugApi;
  controls: Controls;
  hits: Map<number, Hittable>;
  /** Fire-and-forget sound; silent until the engine installs audio. */
  sfx(id: string, pos?: Vector3, opts?: { volume?: number; pitchJitter?: number }): void;
  loopSfx(id: string, follow: Object3D, opts?: { volume?: number }): ReturnType<AudioApi['loop']> | null;
  /** Seeded random 0..1 for sim code. */
  rand(): number;
}

export function createCtx(game: Game) {
  const audio = probe(game, 'audio', 'play');
  const debug = probe(game, 'debug', 'action') ?? noopDebug;
  return <Partial<Ctx>>{
    game,
    debug,
    controls: new Controls(game),
    hits: new Map(),
    sfx(id, pos, opts) {
      if (!audio) return;
      try {
        audio.play(id, pos, opts);
      } catch (e) {
        console.warn('audio.play', id, e);
      }
    },
    loopSfx(id, follow, opts) {
      if (!audio) return null;
      try {
        return audio.loop(id, follow, opts);
      } catch {
        return null;
      }
    },
    rand: game.rng.next,
  };
}
