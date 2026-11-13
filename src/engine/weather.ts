import { AdditiveBlending, Fog, InstancedMesh, PlaneGeometry } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { cameraPosition, cameraViewMatrix, fract, instanceIndex, positionLocal, sin, time, uniform, vec3 } from 'three/tsl';
import type { Game } from '../core/game';
import type { Post } from './post';

/**
 * Weather: rain showers. `weather.rain` (0..1) eases toward a target that follows a deterministic per-day schedule
 * (about one day in three has a shower of 2-5 game hours) or the debug override. Rain draws as shader-driven streaks
 * around the camera (one instanced draw), pulls the fog in, dims and desaturates the grade, and fades in a rain loop
 * (engine/atmosphere.ts reads `weather.rain`).
 */
export const weather = { rain: 0, target: 0, override: null as null | boolean };

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/** Rain target 0/1 for a day + hour: schedule only (the override is applied by the caller). */
export function scheduledRain(day: number, hours: number) {
  if (hash(day * 3.1 + 0.5) > 0.36) return 0;
  const start = 6 + hash(day * 7.7) * 11; // 06:00-17:00
  const len = 2 + hash(day * 5.3) * 3; // 2-5 h
  return hours >= start && hours < start + len ? 1 : 0;
}

export function installWeather(game: Game, post: Post) {
  const amount = uniform(0);
  const SIZE = 28;
  const id = instanceIndex.toFloat();
  const h = (k: number) => fract(sin(id.mul(12.9898).add(k * 78.233)).mul(43758.5453));
  const base = vec3(h(1), h(2), h(3));
  const fall = time.mul(0.9).mul(h(4).mul(0.3).add(0.85)); // 1 box height per ~1.1 s
  const p = vec3(fract(base.x.sub(cameraPosition.x.div(SIZE)).add(time.mul(0.008))), fract(base.y.sub(fall).sub(cameraPosition.y.div(14))), fract(base.z.sub(cameraPosition.z.div(SIZE))));
  const center = cameraPosition.add(vec3(p.x.sub(0.5).mul(SIZE), p.y.sub(0.5).mul(14).add(2), p.z.sub(0.5).mul(SIZE)));
  const vm = cameraViewMatrix as any;
  const right = vec3(vm[0].x, vm[1].x, vm[2].x);
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
  // vertical streak, camera-facing in the horizontal plane
  mat.positionNode = center.add(right.mul(positionLocal.x).mul(0.008)).add(vec3(0, positionLocal.y.mul(0.32), 0));
  mat.colorNode = vec3(0.62, 0.7, 0.8);
  mat.opacityNode = amount.mul(h(5).mul(0.5).add(0.3)).mul(0.6);
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), mat, 2400);
  mesh.name = 'rain';
  mesh.frustumCulled = false;
  mesh.visible = false;
  game.scene.add(mesh);

  const fog = game.scene.fog instanceof Fog ? game.scene.fog : null;
  const near0 = fog?.near ?? 90, far0 = fog?.far ?? 430;
  const sat0 = post.look.saturation.value;
  const con0 = post.look.contrast.value;
  game.addSystem({
    name: 'weather',
    render(_a, dt) {
      weather.target = (weather.override ?? scheduledRain(game.time.day, game.time.hours) === 1) ? 1 : 0;
      weather.rain += (weather.target - weather.rain) * Math.min(1, dt * 0.25); // ~12 s to fade
      if (Math.abs(weather.rain - weather.target) < 0.003) weather.rain = weather.target;
      const r = weather.rain;
      amount.value = r;
      mesh.visible = r > 0.01;
      if (fog) {
        fog.near = near0 * (1 - 0.7 * r);
        fog.far = far0 * (1 - 0.6 * r);
      }
      post.look.saturation.value = sat0 * (1 - 0.28 * r);
      post.look.contrast.value = con0 * (1 - 0.06 * r);
      game.renderer.toneMappingExposure = 1 - 0.22 * r;
    },
  });
  (window as unknown as { __weather: typeof weather }).__weather = weather; // debug / tests
  return weather;
}
