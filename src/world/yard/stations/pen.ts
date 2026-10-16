import { CylinderGeometry, Group, Quaternion, Vector3 } from 'three';
import { loadAsset } from '../../../engine/assets';
import { Group as G, groups } from '../../../engine/physics';
import { tagCollider } from '../../surfaces';
import { yard } from '../../../content/data/yard';
import { worldText } from '../../../content/text/ui';
import type { Kit } from '../kit';
import { plateSign, stationSign } from '../signs';

const S = yard.stations.pen; // 24 x 24 at (40,-15); gate on the west side (faces spawn)
const PANEL = 3;
const GATE_OPEN = (95 * Math.PI) / 180; // swings into the pen
const GATE_SPEED = 3; // rad/s


/**
 * The pen gate: its own object (not instanced) hinged at its north end, with a kinematic collider that follows
 * the leaf, and an instant "Open gate"/"Close gate" interactable (QA-055).
 */
async function buildGate(kit: Kit, hingeX: number, hingeZ: number) {
  const { game } = kit;
  const proto = await loadAsset('env_gate_chainlink_a', [3, 2.2, 0.08]);
  const pivot = new Group();
  pivot.name = 'pen_gate';
  pivot.position.set(hingeX, 0, hingeZ);
  const leaf = proto.lod.clone();
  leaf.rotation.y = Math.PI / 2; // panel's local X runs along world -Z, front faces spawn (west)
  leaf.position.set(0, 0, PANEL / 2);
  pivot.add(leaf);
  game.scene.add(pivot);

  const { R, world } = game.phys;
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(hingeX, 0, hingeZ));
  const leafQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
  const c = new Vector3();
  for (const b of proto.colliders) {
    c.addVectors(b.min, b.max).multiplyScalar(0.5).applyQuaternion(leafQ).add(leaf.position);
    const col = world.createCollider(
      R.ColliderDesc.cuboid((b.max.x - b.min.x) / 2, (b.max.y - b.min.y) / 2, (b.max.z - b.min.z) / 2)
        .setTranslation(c.x, c.y, c.z).setRotation(leafQ).setCollisionGroups(groups(G.STATIC, 0xffff)),
      body,
    );
    tagCollider(col.handle, 'chainlink');
  }

  let open = false, angle = 0;
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  game.interact.register({
    position: new Vector3(hingeX - 0.6, 1.2, hingeZ + PANEL / 2),
    radius: 2.5,
    prompt: () => (open ? worldText.gateClose : worldText.gateOpen),
    holdSeconds: () => 0,
    onInteract: () => {
      open = !open;
    },
  });
  game.addSystem({
    name: 'pen-gate',
    step(dt) {
      const target = open ? GATE_OPEN : 0;
      if (angle === target) return;
      angle = target > angle ? Math.min(target, angle + GATE_SPEED * dt) : Math.max(target, angle - GATE_SPEED * dt);
      body.setNextKinematicRotation(q.setFromAxisAngle(up, angle));
    },
    render() {
      pivot.rotation.y = angle;
    },
  });
}

export async function buildPen(kit: Kit) {
  const { x, z } = S;
  const hw = S.w / 2, hd = S.d / 2;
  kit.pad(S.w + 1, S.d + 1, x, z, 'mud', 0.03, 0.5);

  const n = S.w / PANEL;
  for (let i = 0; i < n; i++) {
    const o = -hw + PANEL / 2 + i * PANEL;
    kit.place({ id: 'env_fence_chainlink_a', size: [3, 2.2, 0.08], x: x + o, z: z - hd }); // north
    kit.place({ id: 'env_fence_chainlink_a', size: [3, 2.2, 0.08], x: x + o, z: z + hd }); // south
    kit.place({ id: 'env_fence_chainlink_a', size: [3, 2.2, 0.08], x: x + hw, z: z + o, yaw: Math.PI / 2 }); // east
    if (i === n / 2 - 1) await buildGate(kit, x - hw, z + o - PANEL / 2); // west, facing spawn
    else kit.place({ id: 'env_fence_chainlink_a', size: [3, 2.2, 0.08], x: x - hw, z: z + o, yaw: Math.PI / 2 }); // west
  }
  // Corner posts.
  for (const [cx, cz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) kit.box(0.14, 2.5, 0.14, 'metal_bare', x + cx, 0, z + cz);

  // A little cover inside: barrels and a concrete block, so pathing isn't a featureless square.
  for (const [bx, bz, sw] of [[4, -6, 'rust'], [4.7, -5.5, 'rust_dark'], [-5, 5, 'paint_red_faded']] as const) {
    kit.paint(new CylinderGeometry(0.3, 0.3, 0.9, 10).translate(x + bx, 0.45, z + bz), sw);
    kit.cuboid(0.3, 0.45, 0.3, x + bx, 0.45, z + bz, 0, 'metal');
  }
  kit.box(2, 0.8, 0.8, 'concrete', x + 5, 0, z + 4, 0.4, true);

  // Warning notice beside the gate, station sign further out.
  plateSign(kit, { title: 'DANGER', sub: 'INFECTED INSIDE - KEEP GATE SHUT', bg: '#b3122a', fg: '#e6e3da' }, x - hw - 0.12, z - 4.6, Math.PI / 2, 1.8, false); // wired to the fence: nothing sticks out into the track run-off (QA-040)
  stationSign(kit, 'pen', x - 3, z + hd + 3.5); // south side, clear of the west run-off
}
