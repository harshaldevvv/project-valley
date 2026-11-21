import { AdditiveBlending, Color, Fog, InstancedMesh, PlaneGeometry } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { cameraPosition, cameraViewMatrix, fract, instanceIndex, positionLocal, sin, time, uniform, vec3 } from 'three/tsl';
import type { Game } from '../core/game';
import type { Post } from './post';

/**
 * Weather: rain showers. `weather.rain` (0..1) eases toward a target that follows a deterministic per-day schedule
 * (about one day in three has a shower of 2-5 game hours) or the debug override. Rain draws as shader-driven streaks
 * around the camera (one instanced draw), pulls the fog in, dims and desaturates the grade, and fades in a rain loop
 * (engine/atmosphere.ts reads `weather.rain`).
 * Fog: `weather.fog` (0..1) is a morning ground mist on about one day in four (04:00 to 08:30-10:00) or the debug
 * override; it pulls the fog in to ~120 m, greys the fog colour and hazes the sky dome (sky.ts reads `weather.haze`).
 * At night the grade desaturates so moonlight reads as night, not as a dim day.
 */
export const weather = { rain: 0, target: 0, override: null as null | boolean, fog: 0, fogOverride: null as null | boolean, haze: 0 };

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

/** Mist target 0/1 for a day + hour (schedule only). */
export function scheduledFog(day: number, hours: number) {
  if (hash(day * 2.3 + 9.1) > 0.25) return 0;
  return hours >= 4 && hours < 8.5 + hash(day * 4.9) * 1.5 ? 1 : 0;
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
  mat.positionNode = center.add(right.mul(positionLocal.x).mul(0.011)).add(vec3(0, positionLocal.y.mul(0.32), 0));
  const light = uniform(1); // scene light level: streaks are additive, so at night they must dim with the world
  mat.colorNode = vec3(0.62, 0.7, 0.8).mul(light);
  mat.opacityNode = amount.mul(h(5).mul(0.5).add(0.3)).mul(0.85);
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), mat, 2400);
  mesh.name = 'rain';
  mesh.frustumCulled = false;
  mesh.visible = false;
  game.scene.add(mesh);

  // The world replaces scene.fog after this installs (yard/lighting.ts), so the live Fog is read every frame and its
  // clear-weather range captured the first time each Fog object is seen.
  let fogObj: Fog | null = null;
  let near0 = 90, far0 = 430;
  const sat0 = post.look.saturation.value;
  const con0 = post.look.contrast.value;
  const grey = new Color();
  game.addSystem({
    name: 'weather',
    render(_a, dt) {
      weather.target = (weather.override ?? scheduledRain(game.time.day, game.time.hours) === 1) ? 1 : 0;
      weather.rain += (weather.target - weather.rain) * Math.min(1, dt * 0.25); // ~12 s to fade
      if (Math.abs(weather.rain - weather.target) < 0.003) weather.rain = weather.target;
      const r = weather.rain;
      const fogTarget = (weather.fogOverride ?? scheduledFog(game.time.day, game.time.hours) === 1) ? 1 : 0;
      weather.fog += (fogTarget - weather.fog) * Math.min(1, dt * 0.08); // ~40 s: mist creeps in and lifts
      if (Math.abs(weather.fog - fogTarget) < 0.003) weather.fog = fogTarget;
      const f = weather.fog;
      const night = game.time.night;
      weather.haze = Math.max(f, 0.35 * r);
      amount.value = r;
      light.value = 1 - 0.7 * night;
      mesh.visible = r > 0.01;
      const fog = game.scene.fog instanceof Fog ? game.scene.fog : null;
      if (fog && fog !== fogObj) {
        fogObj = fog;
        near0 = fog.near;
        far0 = fog.far;
      }
      if (fog) {
        fog.near = near0 * (1 - 0.7 * r) * (1 - 0.9 * f);
        fog.far = far0 * (1 - 0.6 * r) * (1 - 0.72 * f);
        // grey the fog toward its own luminance (time of day writes the colour from scene.background ~10x/s)
        const bg = game.scene.background;
        if (bg instanceof Color) {
          const l = bg.r * 0.2126 + bg.g * 0.7152 + bg.b * 0.0722;
          fog.color.copy(bg).lerp(grey.setRGB(l, l, l), 0.55 * weather.haze);
        }
      }
      post.look.saturation.value = sat0 * (1 - 0.28 * r) * (1 - 0.15 * f) * (1 - 0.3 * night);
      post.look.contrast.value = con0 * (1 - 0.06 * r);
      game.renderer.toneMappingExposure = 1 - 0.22 * r;
    },
  });
  (window as unknown as { __weather: typeof weather }).__weather = weather; // debug / tests
  return weather;
}
