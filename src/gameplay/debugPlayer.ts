import { Vector3 } from 'three';
import type { Input } from '../engine/input';
import { Group, groups, type Physics } from '../engine/physics';

/**
 * M0 test player: Rapier kinematic capsule + third-person orbit camera numbers from
 * principles §2 (jog 3.5, sprint 5.75 m/s, coyote 100 ms, jump buffer 120 ms).
 * ponytail: placeholder until M1's real controller (acceleration curves, stamina, vault, camera collision).
 */
const JOG = 3.5;
const SPRINT = 5.75;
const JUMP_V = 5.2;
const COYOTE = 0.1;
const BUFFER = 0.12;
const SENS = 0.0022;
const RADIUS = 0.3;
const HALF = 0.6; // capsule half-height (total 1.8 m)

export class DebugPlayer {
  yaw = 0;
  pitch = -0.2;
  readonly prev = new Vector3();
  readonly curr = new Vector3();
  private vy = 0;
  private sinceGround = 0;
  private sinceJump = 1;
  private body;
  private collider;
  private ctrl;
  private move = new Vector3();

  constructor(phys: Physics, spawn: Vector3) {
    const { R, world } = phys;
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z));
    this.collider = world.createCollider(
      R.ColliderDesc.capsule(HALF, RADIUS).setCollisionGroups(groups(Group.PLAYER, 0xffff & ~Group.PLAYER)),
      this.body,
    );
    this.ctrl = world.createCharacterController(0.02);
    this.ctrl.enableAutostep(0.4, 0.2, true);
    this.ctrl.enableSnapToGround(0.3);
    this.ctrl.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.curr.copy(spawn);
    this.prev.copy(spawn);
  }

  step(dt: number, input: Input) {
    const [mx, my] = input.takeMouse();
    this.yaw -= mx * SENS;
    this.pitch = Math.max(-1.2, Math.min(0.6, this.pitch - my * SENS));

    const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const speed = input.down('ShiftLeft') && f > 0 ? SPRINT : JOG;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    this.move.set(-sin * f + cos * s, 0, -cos * f - sin * s);
    if (this.move.lengthSq() > 0) this.move.normalize().multiplyScalar(speed * dt);

    this.sinceGround += dt;
    this.sinceJump = input.justPressed('Space') ? 0 : this.sinceJump + dt;
    if (this.sinceJump <= BUFFER && this.sinceGround <= COYOTE) {
      this.vy = JUMP_V;
      this.sinceJump = this.sinceGround = 1;
    }
    this.vy -= 9.81 * dt;
    this.move.y = this.vy * dt;

    this.ctrl.computeColliderMovement(this.collider, this.move);
    const m = this.ctrl.computedMovement();
    const t = this.body.translation();
    this.prev.copy(this.curr);
    this.curr.set(t.x + m.x, t.y + m.y, t.z + m.z);
    this.body.setNextKinematicTranslation(this.curr);
    if (this.ctrl.computedGrounded()) {
      this.sinceGround = 0;
      if (this.vy < 0) this.vy = 0;
    }
  }

  /** Interpolated feet position for rendering. */
  renderPos(alpha: number, out: Vector3) {
    return out.lerpVectors(this.prev, this.curr, alpha).setY(out.y - HALF - RADIUS);
  }
}
