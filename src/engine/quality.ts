import type { InstancedMesh } from 'three';
import { uniform } from 'three/tsl';
import type { Game } from '../core/game';
import { AUTO_QUALITY, QUALITY, QUALITY_ORDER, type QualityId } from '../content/data/quality';
import { NPC_FEEL } from '../content/data/npc';
import { horde } from '../content/data/zombies';

/**
 * Graphics quality levers that are not post settings (data/quality.ts holds the numbers):
 *   applyQuality(game, 'low')     // shadow map + extent, grass/foliage density, far-cull scale, NPC draw distance, lamp lights
 *   startAutoQuality(game, () => playing, (id) => ...)   // steps down while p95 frame time > 18 ms
 * World builders register what thins out: thinByQuality('grass', mesh) (instances in random order; full count kept in userData).
 */
export const qualityHooks = {
  grass: [] as InstancedMesh[],
  foliage: [] as InstancedMesh[],
  /** Grass shrink-to-nothing distance (m), read by the grass vertex shader. */
  grassFar: uniform(QUALITY.high.grassFar),
  /** Multiplies every farCull() distance (engine/farcull.ts). */
  farCullScale: 1,
  /** Real street-lamp point lights in use (engine/lamps.ts, at most its REAL_LIGHTS). */
  lampLights: QUALITY.high.lampLights,
  /** Fog distance multiplier (engine/weather.ts applies it on top of rain/fog weather). */
  viewDist: 1,
  current: null as QualityId | null,
};

const BASE = { npcDraw: NPC_FEEL.drawDistance, far: 600 };

const thin = (list: InstancedMesh[], f: number) => {
  for (const m of list) {
    const full = (m.userData.fullCount as number | undefined) ?? (m.userData.fullCount = m.count);
    m.count = Math.max(0, Math.round(full * f));
  }
};

/** Registers an instanced mesh whose instances (in random order) the preset thins, and thins it to the current preset. */
export function thinByQuality(kind: 'grass' | 'foliage', m: InstancedMesh) {
  qualityHooks[kind].push(m);
  if (qualityHooks.current) thin([m], QUALITY[qualityHooks.current][kind]);
}

export function applyQuality(game: Game, id: QualityId) {
  const q = QUALITY[id];
  const sun = game.sun;
  if (sun.shadow.mapSize.x !== q.shadowMap) sun.shadow.mapSize.set(q.shadowMap, q.shadowMap); // the shadow node resizes its map
  const cam = sun.shadow.camera;
  if (cam.right !== q.shadowExtent) {
    Object.assign(cam, { left: -q.shadowExtent, right: q.shadowExtent, top: q.shadowExtent, bottom: -q.shadowExtent });
    cam.updateProjectionMatrix();
  }
  qualityHooks.viewDist = q.viewDist;
  const far = BASE.far * q.viewDist;
  if (game.camera.far !== far) {
    game.camera.far = far;
    game.camera.updateProjectionMatrix();
  }
  horde.shadowDist = q.zombieShadowDist;
  NPC_FEEL.drawDistance = BASE.npcDraw * q.npcDraw;
  qualityHooks.farCullScale = q.farCull;
  qualityHooks.lampLights = q.lampLights;
  qualityHooks.grassFar.value = q.grassFar;
  thin(qualityHooks.grass, q.grass);
  thin(qualityHooks.foliage, q.foliage);
  qualityHooks.current = id;
  game.perf.extra.quality = id;
}

export const lowerQuality = (id: QualityId): QualityId | null => QUALITY_ORDER[QUALITY_ORDER.indexOf(id) + 1] ?? null;

/** Auto-pick on/off: off under automation unless `?autoquality`; `?noautoquality` always off. */
export function autoQualityAllowed() {
  const p = new URLSearchParams(location.search);
  if (p.has('noautoquality')) return false;
  return p.has('autoquality') || !navigator.webdriver;
}

/** p95 of a list of frame times (ms). */
export function p95(ms: number[]) {
  if (!ms.length) return 0;
  const s = [...ms].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(0.95 * s.length))];
}

/**
 * Measures frame times while `playing()`; after AUTO_QUALITY.windowS of samples, if p95 is over the limit, calls
 * stepDown() (which applies the next lower preset and returns it, or null at the bottom) and measures again; stops once
 * the p95 fits or nothing is lower. stop() ends it early (the player picked a preset).
 */
export function startAutoQuality(game: Game, playing: () => boolean, stepDown: () => QualityId | null) {
  const A = AUTO_QUALITY;
  let samples: number[] = [];
  let settle = A.settleS;
  let last = performance.now();
  let done = false;
  game.addSystem({
    name: 'autoQuality',
    render() {
      const now = performance.now();
      const ms = now - last;
      last = now;
      if (done || !playing() || document.visibilityState !== 'visible' || ms > A.maxFrameMs) return;
      if (settle > 0) {
        settle -= ms / 1000;
        return;
      }
      samples.push(ms);
      if (samples.reduce((a, b) => a + b, 0) < A.windowS * 1000) return;
      const p = p95(samples);
      samples = [];
      game.perf.extra.autoQuality = `p95 ${p.toFixed(1)} ms`;
      if (p <= A.p95LimitMs || !stepDown()) done = true;
      else settle = A.settleS;
    },
  });
  return { stop: () => (done = true) };
}
