import { AdditiveBlending, ConeGeometry, DoubleSide, Mesh, SpotLight, Vector3 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { float, positionLocal, pow, smoothstep, uniform, vec3 } from 'three/tsl';
import type { Game } from '../core/game';
import { Group, groups } from './physics';

/**
 * Flashlight (L): a warm spotlight from the camera along the view direction. One SpotLight lives in the scene from the
 * start (adding lights recompiles shaders), intensity 0 while off. It ramps smoothly and flickers very slightly.
 * Stronger at night; by day it barely shows, so it is only useful in the dark.
 */
/**
 * The beam's switch, shared with the systems layer (which knows about items and batteries): `available()` says whether a
 * light source and charge exist (default: always), `denied()` is called when turning on is refused.
 */
export const flashlightControl = {
  on: false,
  available: (): boolean => true,
  denied: (): void => undefined,
  set(v: boolean) {
    if (v && !this.available()) return this.denied(), (this.on = false);
    this.on = v;
  },
  toggle() {
    this.set(!this.on);
  },
};

export function installFlashlight(game: Game) {
  const light = new SpotLight('#ffe9c4', 0, 46, Math.PI / 6.2, 0.55, 1.5);
  light.castShadow = false;
  game.scene.add(light, light.target);
  const state = { on: false, level: 0 };
  // Visible beam (fog in the cone): an open cone from the lens, brightest near the source and along the axis, fading to
  // nothing at the far end and the edges; additive, no depth write, so it reads as lit haze. Cost: one draw.
  const LEN = 15, RAD = LEN * Math.tan(Math.PI / 6.2) * 0.92;
  const coneGeo = new ConeGeometry(RAD, LEN, 24, 1, true).translate(0, -LEN / 2, 0).rotateX(-Math.PI / 2); // apex at origin, opens toward -Z... rotated below
  const beam = uniform(0);
  const along = positionLocal.z.div(LEN); // 0 at the lens .. 1 at the far end (after the rotation, +Z toward the target)
  const beamMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false });
  beamMat.colorNode = vec3(1.0, 0.9, 0.7);
  beamMat.opacityNode = beam.mul(pow(float(1).sub(along.abs().clamp(0, 1)), 1.6)).mul(smoothstep(0.0, 0.08, along.abs()));
  const cone = new Mesh(coneGeo, beamMat);
  cone.frustumCulled = false;
  cone.renderOrder = 5;
  cone.visible = false;
  game.scene.add(cone);
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyL' && !e.repeat && !game.input.blocked) flashlightControl.toggle();
  });
  const fwd = new Vector3();
  // Five rays per frame, the view axis and four inside the cone (static, buildings, terrain, cars, zombies; never the player):
  // the beam starts in front of the first wall instead of behind it, and its intensity is capped by the distance to the
  // nearest lit surface, so a wall or a car 1-5 m away is lit, not blown out to white (cap K * s^decay, the light's own falloff).
  const { R, world } = game.phys;
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  const right = new Vector3(), up = new Vector3(), dir = new Vector3();
  const SPREAD = Math.tan(Math.PI / 6.2) * 0.5; // half way to the cone edge
  const PROBES: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const RAY_FILTER = groups(Group.PROJECTILE, Group.STATIC | Group.BUILD | Group.TERRAIN | Group.VEHICLE | Group.ZOMBIE);
  const OFFSET = 2.8, REACH = 16, CAP_K = 16, MAX_I = 420; // CAP_K: a near wall gets about the light a wall 10 m out gets (420 / 10^1.5)
  let cap = MAX_I;
  let t = 0;
  game.addSystem({
    name: 'flashlight',
    render(_a, dt) {
      t += dt;
      state.on = flashlightControl.on;
      const goal = state.on ? 1 : 0;
      state.level += (goal - state.level) * Math.min(1, dt * 14);
      if (state.level < 0.01) {
        light.intensity = 0;
        cone.visible = false;
        return;
      }
      const cam = game.camera;
      cam.getWorldDirection(fwd);
      ray.origin = cam.position;
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      let d = REACH, axis = REACH;
      for (const [a, b] of PROBES) {
        ray.dir = dir.copy(fwd).addScaledVector(right, a * SPREAD).addScaledVector(up, b * SPREAD).normalize();
        const hit = world.castRay(ray, REACH, true, undefined, RAY_FILTER);
        const h = hit ? hit.timeOfImpact : REACH;
        if (a === 0 && b === 0) axis = h;
        d = Math.min(d, h);
      }
      const off = Math.min(OFFSET, Math.max(0.15, axis - 0.6)); // ahead of the camera so the third-person body is not blown out, never past the wall
      const goalCap = Math.min(MAX_I, CAP_K * Math.pow(Math.max(0.4, d - off), 1.5));
      cap += (goalCap - cap) * Math.min(1, dt * 10); // eased so walking up to a wall dims the spot smoothly
      light.position.copy(cam.position).addScaledVector(fwd, off);
      light.position.y -= 0.12;
      light.target.position.copy(cam.position).addScaledVector(fwd, 14);
      const flicker = 1 + 0.03 * Math.sin(t * 37) * Math.sin(t * 11);
      const dark = 0.35 + 0.65 * game.time.night; // dim by day so it does not look like a second sun
      light.intensity = cap * state.level * flicker * dark;
      // beam: positioned at the lens, pointing along the view; stronger at night
      cone.visible = true;
      cone.position.copy(cam.position).addScaledVector(fwd, OFFSET); // the haze keeps its old start: pulled in near a wall its bright apex would fill the lens
      cone.position.y -= 0.12;
      cone.lookAt(light.target.position);
      beam.value = state.level * (0.02 + 0.07 * game.time.night) * flicker;
    },
  });
  return state;
}
