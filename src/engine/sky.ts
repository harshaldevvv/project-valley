import { BackSide, Color, Fog, Mesh, SphereGeometry, Vector3 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { cameraPosition, dot, float, floor, fract, max, mix, normalize, positionWorld, pow, sin, smoothstep, step, uniform, vec3, vec2, time, mx_fractal_noise_float } from 'three/tsl';
import type { Game } from '../core/game';
import type { TimeOfDay } from './timeofday';
import { weather } from './weather';

/**
 * Sky dome (TSL): horizon→zenith gradient, sun glow + disc, at night a pale moon disc (the directional light is the
 * moon then) and a star field. One draw, follows the camera, no fog/depth write. Horizon colour = scene fog colour,
 * so distant terrain melts into the sky.   createSky(game, tod)
 */
export function createSky(game: Game, tod: TimeOfDay) {
  const horizon = uniform(new Color());
  const zenith = uniform(new Color());
  const sunDir = uniform(new Vector3(0, 1, 0));
  const sunCol = uniform(new Color());
  const night = uniform(0);
  const haze = uniform(0); // mist / rain: the dome fades to the fog colour, most at the horizon

  const dir = normalize(positionWorld.sub(cameraPosition));
  const up = max(dir.y, 0);
  const base = mix(horizon, zenith, pow(up, 0.55));
  const d = max(dot(dir, sunDir), 0);
  const day = float(1).sub(night);
  // warm glow around the sun, wider near the horizon; at night a faint halo round the moon
  const glow = sunCol.mul(pow(d, 8).mul(0.35).add(pow(d, 90).mul(0.9))).mul(day.mul(0.9).add(0.12));
  // sun disc ~1.3° (HDR so it blooms through the tonemapper), moon ~1.0° pale
  const sunDisc = smoothstep(0.99972, 0.99985, d).mul(day).mul(12);
  const moonDisc = smoothstep(0.99983, 0.9999, d).mul(night).mul(1.6);
  const disc = sunCol.mul(sunDisc).add(vec3(0.85, 0.9, 1).mul(moonDisc));
  // stars: hashed lattice on the view direction, faded near the horizon
  const cell = floor(dir.mul(600));
  const n = fract(sin(dot(cell, vec3(12.9898, 78.233, 45.164))).mul(43758.5453));
  const bright = fract(n.mul(173.13)); // per-star magnitude
  const stars = step(0.9986, n).mul(bright.mul(bright).mul(1.4).add(0.1)).mul(smoothstep(0.6, 1, night)).mul(smoothstep(0.03, 0.3, dir.y));

  // clouds: fractal noise on a flat layer projected from the view direction, drifting with the wind; lit warm on the
  // sun side, grey-blue underneath; at night they only dim the stars.
  const cp = vec2(dir.x, dir.z).div(dir.y.max(0.04).add(0.22)).mul(1.1).add(vec2(time.mul(0.006), time.mul(0.002)));
  const cn = mx_fractal_noise_float(vec3(cp.x, cp.y, time.mul(0.004)), 5, 2.0, 0.5).mul(0.5).add(0.5);
  const cover = smoothstep(0.5, 0.78, cn).mul(smoothstep(0.0, 0.16, dir.y));
  const lit = pow(d, 3).mul(0.8).add(0.35);
  const cloudCol = mix(vec3(0.5, 0.56, 0.66), sunCol.mul(1.15).add(0.25), lit.min(1)).mul(day.mul(0.85).add(0.1));
  const sky = base.add(glow);
  const withClouds = mix(sky, cloudCol, cover.mul(0.82));

  const mat = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
  const clear = float(1).sub(cover).mul(float(1).sub(haze));
  const dome = withClouds.add(disc.mul(clear)).add(stars.mul(clear));
  mat.colorNode = mix(dome, horizon, haze.mul(float(1).sub(smoothstep(0.0, 0.9, up).mul(0.35))));
  mat.name = 'sky';
  const mesh = new Mesh(new SphereGeometry(450, 32, 16), mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.castShadow = mesh.receiveShadow = false;
  game.scene.add(mesh);

  game.addSystem({
    name: 'sky',
    render() {
      mesh.position.copy(game.camera.position);
      const fog = game.scene.fog instanceof Fog ? game.scene.fog.color : (game.scene.background as Color | null);
      if (fog) horizon.value.copy(fog);
      zenith.value.copy(tod.zenith);
      sunDir.value.copy(game.sunDir);
      sunCol.value.copy(game.sun.color);
      night.value = tod.night;
      haze.value = weather.haze;
    },
  });
  return mesh;
}
