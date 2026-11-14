import { BoxGeometry, Group, Mesh, Quaternion, Vector3 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { Group as G, groups } from '../../engine/physics';
import { worldText } from '../../content/text/ui';
import { tagCollider } from '../surfaces';
import { cabin, farm, shop } from './cabin';
import type { Kit } from './kit';

/**
 * Doors you can open on the three interiors: a hinged plank leaf with a kinematic collider that follows it, an instant
 * "Open door"/"Close door" interaction (E), a creak, and a swing at 3 rad/s. Same pattern as the pen gate. Doors start
 * closed. The leaf swings outward, away from the room.
 *   hinge: world x,z of the hinge post; dir: unit vector along the closed leaf; out: outward normal
 */
interface DoorDef { hx: number; hz: number; dx: number; dz: number; ox: number; oz: number; w: number }
const H = 2.05, T = 0.07, OPEN = 1.75;
const DOORS: DoorDef[] = [
  // cabin: east wall (x = -68), gap z -37.9 .. -36.9 (wall() opening a 1.1..2.1 from z0 = -39)
  { hx: -68, hz: -36.92, dx: 0, dz: -1, ox: 1, oz: 0, w: 0.98 },
  // shop: side door in the east wall (x = 70.5), gap z -62.65 .. -61.65
  { hx: 70.5, hz: -61.67, dx: 0, dz: -1, ox: 1, oz: 0, w: 0.98 },
  // farm: south door (z = 65), gap x -70.6 .. -69.6
  { hx: -69.62, hz: 65, dx: -1, dz: 0, ox: 0, oz: 1, w: 0.98 },
];
void cabin; void shop; void farm;

export function buildDoors(kit: Kit) {
  const { game } = kit;
  const { R, world } = game.phys;
  const wood = new MeshStandardNodeMaterial({ color: '#5d4a33', roughness: 0.9, metalness: 0 });
  const dark = new MeshStandardNodeMaterial({ color: '#2b2118', roughness: 0.8, metalness: 0.3 });
  const up = new Vector3(0, 1, 0);
  for (const d of DOORS) {
    // leaf local +X runs along the closed direction: yaw0 solves (cos y, -sin y) = (dx, dz)
    const yaw0 = Math.atan2(-d.dz, d.dx);
    // swing toward the outside: pick the sign whose opened leaf points along the outward normal
    const dirAt = (y: number) => [Math.cos(y), -Math.sin(y)];
    const s = dirAt(yaw0 + OPEN)[0] * d.ox + dirAt(yaw0 + OPEN)[1] * d.oz > dirAt(yaw0 - OPEN)[0] * d.ox + dirAt(yaw0 - OPEN)[1] * d.oz ? 1 : -1;
    const pivot = new Group();
    pivot.position.set(d.hx, 0, d.hz);
    pivot.rotation.y = yaw0;
    const leaf = new Mesh(new BoxGeometry(d.w, H, T), wood);
    leaf.position.set(d.w / 2, H / 2, 0);
    leaf.castShadow = leaf.receiveShadow = true;
    const handle = new Mesh(new BoxGeometry(0.1, 0.05, 0.14), dark);
    handle.position.set(d.w - 0.12, 1.0, 0);
    for (const [y, h] of [[0.35, 0.12], [1.0, 0.12], [1.7, 0.12]] as const) {
      const band = new Mesh(new BoxGeometry(d.w * 0.96, h, T + 0.01), dark); // iron straps
      band.position.set(d.w / 2, y, 0);
      pivot.add(band);
    }
    pivot.add(leaf, handle);
    game.scene.add(pivot);

    const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(d.hx, 0, d.hz).setRotation(new Quaternion().setFromAxisAngle(up, yaw0)));
    const col = world.createCollider(
      R.ColliderDesc.cuboid(d.w / 2, H / 2, T / 2 + 0.02).setTranslation(d.w / 2, H / 2, 0).setCollisionGroups(groups(G.STATIC, 0xffff)),
      body,
    );
    tagCollider(col.handle, 'wood');

    // player standing on the leaf's footprint (segment from the hinge, thickness + capsule radius)?
    const inLeaf = (yaw: number) => {
      const p = game.player.position;
      const lx = Math.cos(yaw), lz = -Math.sin(yaw);
      const rx = p.x - d.hx, rz = p.z - d.hz;
      const t = Math.min(d.w, Math.max(0, rx * lx + rz * lz));
      return Math.hypot(rx - lx * t, rz - lz * t) < 0.45;
    };
    let open = false, angle = 0;
    const q = new Quaternion();
    const mid = new Vector3(d.hx + d.dx * d.w * 0.5, 1.1, d.hz + d.dz * d.w * 0.5);
    game.interact.register({
      position: mid,
      radius: 2.2,
      prompt: () => (open ? worldText.doorClose : worldText.doorOpen),
      holdSeconds: () => 0,
      onInteract: () => {
        open = !open;
        game.audio.play('door_creak', mid, { pitchJitter: 0.08 });
      },
    });
    game.addSystem({
      name: 'door',
      step(dt) {
        const target = open ? s * OPEN : 0;
        if (angle === target) {
          // at rest: solid again, unless the player is standing where the leaf is (closing onto them): wait until clear
          if (!col.isEnabled() && !inLeaf(yaw0 + angle)) col.setEnabled(true);
          return;
        }
        col.setEnabled(false); // a swinging leaf never shoves the player or traps them against the wall
        angle = target > angle ? Math.min(target, angle + 3 * dt) : Math.max(target, angle - 3 * dt);
        body.setNextKinematicRotation(q.setFromAxisAngle(up, yaw0 + angle));
      },
      render() {
        pivot.rotation.y = yaw0 + angle;
      },
    });
  }
}
