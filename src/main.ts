import {
  CapsuleGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from 'three';
import { loadAsset } from './engine/assets';
import { Input } from './engine/input';
import { FixedLoop } from './engine/loop';
import { paintGeometry, paletteMaterial } from './engine/palette';
import { Perf } from './engine/perf';
import { createPhysics, Group, groups } from './engine/physics';
import { createRenderer } from './engine/renderer';
import { createRng } from './engine/rng';
import { DebugPlayer } from './gameplay/debugPlayer';

// M0 test yard: palette-shaded ground, pipeline crates with Rapier colliders, a kinematic test
// player and the perf overlay. Click to capture the mouse; WASD, Shift sprint, Space jump, F3 stats.

const { renderer, backend } = await createRenderer(document.body);
const perf = new Perf(renderer, backend);
const [phys, mat, crate] = await Promise.all([createPhysics(), paletteMaterial(), loadAsset('prop_crate_wood_a')]);
const { R, world } = phys;

const scene = new Scene();
scene.background = new Color('#9fb0b4');
scene.fog = new Fog('#9fb0b4', 40, 220);
scene.add(new HemisphereLight('#dfe8ea', '#5b5240', 1.1));
const sun = new DirectionalLight('#fff1d8', 2.4);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 150 });
scene.add(sun, sun.target);

const ground = new Mesh(paintGeometry(new PlaneGeometry(400, 400).rotateX(-Math.PI / 2), 'grass'), mat);
ground.receiveShadow = true;
scene.add(ground);
world.createCollider(
  R.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0).setCollisionGroups(groups(Group.TERRAIN, 0xffff)),
);

// Crates: a few stacks + scattered ones, all from the Blender pipeline.
const rng = createRng(7);
const box = crate.colliders[0];
const half = box.getSize(new Vector3()).multiplyScalar(0.5);
const placeCrate = (x: number, y: number, z: number, rotY: number) => {
  const c = crate.lod.clone();
  c.position.set(x, y, z);
  c.rotation.y = rotY;
  scene.add(c);
  world.createCollider(
    R.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setTranslation(x, y + half.y, z)
      .setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) })
      .setCollisionGroups(groups(Group.STATIC, 0xffff)),
  );
};
for (let i = 0; i < 40; i++) placeCrate(rng.range(-30, 30), 0, rng.range(-30, 30), rng.range(0, Math.PI));
for (let s = 0; s < 3; s++) placeCrate(6, half.y * 2 * s, -6, 0); // a climbable stack

const player = new DebugPlayer(phys, new Vector3(0, 2, 8));
const body = new Mesh(paintGeometry(new CapsuleGeometry(0.3, 1.2, 4, 10), 'cloth_olive'), mat);
body.castShadow = true;
scene.add(body);

const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  if (!innerWidth || !innerHeight) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(Math.max(1, innerWidth), Math.max(1, innerHeight));
});

const input = new Input(renderer.domElement);
const feet = new Vector3();
const pivot = new Vector3();
const loop = new FixedLoop({
  step(dt) {
    perf.begin('sim');
    player.step(dt, input);
    input.endTick();
    perf.end('sim');
    perf.begin('physics');
    world.step();
    perf.end('physics');
  },
  render(alpha, frameDt) {
    player.renderPos(alpha, feet);
    body.position.set(feet.x, feet.y + 0.9, feet.z);
    body.rotation.y = player.yaw;
    // Over-the-shoulder camera: pivot at head height, shoulder offset 0.5 m, arm 2.6 m (principles §2).
    pivot.set(feet.x, feet.y + 1.65, feet.z);
    const cp = Math.cos(player.pitch);
    camera.position.set(
      pivot.x + Math.sin(player.yaw) * 2.6 * cp + Math.cos(player.yaw) * 0.5,
      pivot.y - Math.sin(player.pitch) * 2.6 + 0.15,
      pivot.z + Math.cos(player.yaw) * 2.6 * cp - Math.sin(player.yaw) * 0.5,
    );
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    sun.position.set(feet.x + 30, 50, feet.z + 20);
    sun.target.position.copy(feet);

    perf.begin('render');
    renderer.render(scene, camera);
    perf.end('render');
    perf.frame(frameDt);
  },
});

await renderer.compileAsync(scene, camera); // warm pipelines before the first frame (no hitch)
renderer.setAnimationLoop((t) => loop.frame(t));
