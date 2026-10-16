import { MathUtils, Quaternion, Vector3 } from 'three';
import type { Collider, DynamicRayCastVehicleController, RigidBody } from '@dimforge/rapier3d-compat';
import { Group, groups } from '../../engine/physics';
import { loadModel, type ModelInstance } from '../../engine/models';
import { vehicles as VD, type VehicleFeel } from '../../content/data/vehicles';
import type { VehicleDef } from '../../content/data/types';
import { yardSpawns } from '../../world/yard/spawns';
import { probe, type Ctx } from '../ctx';

/**
 * Data-driven cars (one VehicleDef row = one car on the track): Rapier DynamicRayCastVehicleController,
 * enter/exit (F), throttle/brake/reverse, speed-sensitive steering, handbrake, horn (noise), flip reset,
 * chase camera, engine loop pitched by speed, trunk container + interactable, runs over zombies.
 */
type Def = VehicleDef & VehicleFeel;
const WHEELS = ['FL', 'FR', 'RL', 'RR'] as const;
const _q = new Quaternion();
const _v = new Vector3();
const _w = new Vector3();
const _f = new Vector3();
const _cam = new Vector3();
const _look = new Vector3();
const _p = new Vector3();

export class Car {
  readonly prevPos = new Vector3();
  readonly currPos = new Vector3();
  readonly prevQuat = new Quaternion();
  readonly currQuat = new Quaternion();
  steer = 0;
  speed = 0; // m/s along forward (+ = forward)
  engine: { setVolume(v: number): void; setRate(r: number): void; stop(): void } | null = null;
  noiseT = 0;
  wheelSpin = [0, 0, 0, 0];
  readonly trunkPos = new Vector3();
  readonly doorPos = new Vector3();
  readonly trunkId: string;
  cy: number; // chassis centre height above the model origin
  constructor(
    readonly n: number,
    readonly def: Def,
    readonly model: ModelInstance,
    readonly body: RigidBody,
    readonly collider: Collider,
    readonly vc: DynamicRayCastVehicleController,
    cy: number,
  ) {
    this.trunkId = `veh_${n}_trunk`;
    this.cy = cy;
  }
}

export class Vehicles {
  list: Car[] = [];
  driving: Car | null = null;
  private camYaw = 0;
  private camPitch = 0;
  private lookIdle = 0;
  private camPos = new Vector3();
  private ray: InstanceType<Ctx['game']['phys']['R']['Ray']> | null = null;

  constructor(private ctx: Ctx) {}

  async init() {
    let i = 0;
    for (const def of Object.values(VD)) {
      const s = yardSpawns.car;
      // Extra cars park 6 m to the side of the first
      await this.spawn(def, new Vector3(s.x + i * 6, s.y, s.z), s.yaw, i);
      i++;
    }
  }

  async spawn(def: Def, at: Vector3, yaw: number, n: number) {
    const { R, world } = this.ctx.game.phys;
    const model = (await loadModel(def.model, def.fallbackSize)).create();
    this.ctx.game.scene.add(model.root);
    const [hx, hy, hz] = def.halfExtents;
    const cy = def.wheelRadius + 0.12 + hy; // chassis centre above the ground at rest
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(at.x, at.y + cy + 0.3, at.z)
        .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
        .setLinearDamping(0.05)
        .setAngularDamping(0.8)
        .setCcdEnabled(true),
    );
    const m = def.massKg;
    const collider = world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz)
        .setMassProperties(m, { x: 0, y: -hy * 0.6, z: 0 }, { x: (m / 12) * (4 * hy * hy + 4 * hz * hz), y: (m / 12) * (4 * hx * hx + 4 * hz * hz), z: (m / 12) * (4 * hx * hx + 4 * hy * hy) }, { x: 0, y: 0, z: 0, w: 1 })
        .setFriction(0.4)
        .setCollisionGroups(groups(Group.VEHICLE, 0xffff)),
      body,
    );
    const vc = world.createVehicleController(body);
    vc.indexUpAxis = 1;
    (vc as unknown as { setIndexForwardAxis: number }).setIndexForwardAxis = 2;
    for (let k = 0; k < 4; k++) {
      const name = WHEELS[k];
      const wheel = model.wheels.get(name);
      // Wheel centre in model space (model data), else from the chassis box
      const wx = wheel ? wheel.offset.x : (k % 2 ? 1 : -1) * (hx - 0.05);
      const wz = wheel ? wheel.offset.z : (k < 2 ? -1 : 1) * (hz - def.wheelRadius * 1.6);
      const wy = (wheel ? wheel.offset.y : def.wheelRadius) + def.suspensionRest - cy;
      vc.addWheel({ x: wx, y: wy, z: wz }, { x: 0, y: -1, z: 0 }, { x: 1, y: 0, z: 0 }, def.suspensionRest, def.wheelRadius);
      vc.setWheelSuspensionStiffness(k, def.suspensionStiffness);
      vc.setWheelSuspensionCompression(k, def.suspensionDamping * 0.8);
      vc.setWheelSuspensionRelaxation(k, def.suspensionDamping);
      vc.setWheelFrictionSlip(k, def.frictionSlip);
      vc.setWheelMaxSuspensionTravel(k, 0.3);
      vc.setWheelMaxSuspensionForce(k, m * 30);
      vc.setWheelSideFrictionStiffness(k, 1);
    }
    const car = new Car(n, def, model, body, collider, vc, cy);
    this.syncState(car);
    car.prevPos.copy(car.currPos);
    car.prevQuat.copy(car.currQuat);
    this.list.push(car);
    this.ctx.hits.set(collider.handle, { kind: 'vehicle', surface: 'metal', zone: () => 'body', hit: () => null });

    // Trunk container + interactables (door + trunk)
    const inv = probe(this.ctx.game, 'inventory', 'registerContainer');
    try {
      inv?.registerContainer(car.trunkId, 'trunk_pickup');
    } catch (e) {
      console.warn('registerContainer', e);
    }
    this.ctx.game.interact.register({
      position: car.trunkPos,
      radius: 1.8,
      prompt: () => (this.driving ? null : 'Open trunk'),
      holdSeconds: () => 0.4,
      onInteract: () => {
        this.ctx.sfx('car_door', car.trunkPos);
        const api = probe(this.ctx.game, 'inventory', 'openContainer');
        if (api) api.openContainer(car.trunkId);
        else this.ctx.game.events.emit('toast', { text: 'Trunk: inventory not installed yet' });
      },
    });
    this.ctx.game.interact.register({
      position: car.doorPos,
      radius: def.doorReach,
      prompt: () => (this.driving ? null : 'Drive'), // E or F (QA-027: one key glyph)
      onInteract: () => this.enter(car),
    });
    return car;
  }

  private syncState(car: Car) {
    const t = car.body.translation();
    const r = car.body.rotation();
    car.currQuat.set(r.x, r.y, r.z, r.w);
    car.currPos.set(t.x, t.y, t.z);
    // Model origin = chassis centre - cy (in car space)
    _v.set(0, -car.cy, 0).applyQuaternion(car.currQuat);
    car.currPos.add(_v);
    // Door (left, front half) and trunk (rear) points in world space
    const [hx, , hz] = car.def.halfExtents;
    const door = car.model.sockets.get('door_L');
    if (door) door.getWorldPosition(car.doorPos);
    else car.doorPos.set(-hx - 0.4, 1, -hz * 0.15).applyQuaternion(car.currQuat).add(car.currPos);
    const trunk = car.model.sockets.get('trunk');
    if (trunk) trunk.getWorldPosition(car.trunkPos);
    else car.trunkPos.set(0, 1, hz + 0.4).applyQuaternion(car.currQuat).add(car.currPos);
  }

  enter(car: Car) {
    const p = this.ctx.player;
    if (this.driving || p.dead) return;
    this.driving = car;
    p.inVehicle = true;
    p.collider.setEnabled(false);
    this.ctx.weapons.cancelReload();
    this.ctx.sfx('car_door', car.doorPos);
    this.ctx.sfx('car_start', car.currPos);
    car.engine = this.ctx.loopSfx('car_engine_loop', car.model.root, { volume: 0.6 });
    this.camYaw = 0;
    this.camPitch = 0;
    this.camPos.copy(this.ctx.game.camera.position);
    this.ctx.rig.override = (dt) => this.chaseCam(dt);
  }

  exit() {
    const car = this.driving;
    if (!car) return;
    const p = this.ctx.player;
    // Out the driver door; if blocked, the other side, else the roof
    const [hx] = car.def.halfExtents;
    const { R, world } = this.ctx.game.phys;
    const spots = [-(hx + 0.8), hx + 0.8];
    let out: Vector3 | null = null;
    for (const sx of spots) {
      _v.set(sx, 1.0, 0).applyQuaternion(car.currQuat).add(car.currPos);
      const hit = world.castRay(new R.Ray({ x: _v.x, y: _v.y + 1, z: _v.z }, { x: 0, y: -1, z: 0 }), 4, true, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.PLAYER, Group.STATIC | Group.TERRAIN | Group.BUILD | Group.VEHICLE));
      if (hit && hit.timeOfImpact > 0.8) {
        out = new Vector3(_v.x, _v.y + 1 - hit.timeOfImpact + 0.05, _v.z);
        break;
      }
    }
    out ??= car.currPos.clone().setY(car.currPos.y + car.cy * 2 + 0.5);
    p.inVehicle = false;
    p.collider.setEnabled(true);
    _f.set(0, 0, -1).applyQuaternion(car.currQuat);
    p.teleport(out, Math.atan2(-_f.x, -_f.z));
    car.engine?.stop();
    car.engine = null;
    this.ctx.sfx('car_door', car.doorPos);
    for (let k = 0; k < 4; k++) {
      car.vc.setWheelEngineForce(k, 0);
      car.vc.setWheelBrake(k, car.def.brakeForce * 0.3);
    }
    this.driving = null;
    this.ctx.rig.override = null;
  }

  flipReset(car: Car) {
    const t = car.body.translation();
    _f.set(0, 0, -1).applyQuaternion(car.currQuat);
    const yaw = Math.atan2(-_f.x, -_f.z);
    car.body.setTranslation({ x: t.x, y: t.y + 1.5, z: t.z }, true);
    car.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  step(dt: number) {
    const c = this.ctx.controls;
    const p = this.ctx.player;
    // Enter with F near a door (E also works through the interactable)
    if (!p.inVehicle && c.pressed('vehicle')) {
      for (const car of this.list)
        if (car.doorPos.distanceTo(p.curr) < car.def.doorReach + 0.5) {
          this.enter(car);
          break;
        }
    } else if (this.driving && c.pressed('vehicle')) this.exit();

    for (const car of this.list) {
      car.prevPos.copy(car.currPos);
      car.prevQuat.copy(car.currQuat);
      const d = car.def;
      const lv = car.body.linvel();
      _f.set(0, 0, -1).applyQuaternion(car.currQuat);
      car.speed = lv.x * _f.x + lv.y * _f.y + lv.z * _f.z;
      const top = d.topSpeedKmh / 3.6;
      let engine = 0;
      let brake = 0;
      let hand = false;
      let steerIn = 0;
      if (car === this.driving) {
        const fwd = c.down('forward');
        const back = c.down('back');
        steerIn = (c.down('left') ? 1 : 0) - (c.down('right') ? 1 : 0);
        hand = c.down('handbrake');
        if (fwd) engine = car.speed < top ? d.engineForce : 0;
        if (back) {
          if (car.speed > 1) brake = d.brakeForce;
          else engine = car.speed > -d.reverseKmh / 3.6 ? -d.engineForce * 0.6 : 0;
        }
        if (!fwd && !back) brake = d.brakeForce * 0.04; // engine braking
        if (c.pressed('horn')) {
          this.ctx.sfx('car_horn', car.currPos);
          this.ctx.game.events.emit('noise', { position: car.currPos.clone(), radius: d.hornNoise, source: 'horn' });
        }
        if (c.pressed('flipReset')) this.flipReset(car);
        if ((car.noiseT -= dt) <= 0) {
          car.noiseT = 1;
          this.ctx.game.events.emit('noise', { position: car.currPos.clone(), radius: d.engineNoise, source: 'engine' });
        }
        const k = Math.min(1, Math.abs(car.speed) / top);
        car.engine?.setRate(d.idleRate + (d.maxRate - d.idleRate) * (fwd || back ? Math.max(k, 0.25) : k));
        car.engine?.setVolume(0.45 + 0.4 * k);
      }
      // Speed-sensitive steering, rate-limited
      const maxSteer = MathUtils.degToRad(d.maxSteerDeg) * (1 + (d.steerAtSpeed - 1) * Math.min(1, Math.abs(car.speed) / top));
      const want = steerIn * maxSteer;
      car.steer += MathUtils.clamp(want - car.steer, -d.steerRate * dt, d.steerRate * dt);
      for (let k = 0; k < 4; k++) {
        const front = k < 2;
        car.vc.setWheelSteering(k, front ? car.steer : 0);
        car.vc.setWheelEngineForce(k, front ? 0 : engine); // rear-wheel drive
        car.vc.setWheelBrake(k, hand && !front ? d.handbrakeForce : brake);
        car.vc.setWheelSideFrictionStiffness(k, hand && !front ? 0.35 : 1);
      }
      car.vc.updateVehicle(dt, undefined, groups(Group.VEHICLE, Group.STATIC | Group.TERRAIN | Group.BUILD));
      this.syncState(car);
      if (Math.abs(car.speed) > 2.5) this.contacts(car, dt);
    }
  }

  /**
   * Zombie contacts (QA-004): zombie capsules don't block cars, so this decides what happens.
   * - In the car's path at speed: damage by speed (lethal from ~30 km/h) and throw them forward/up.
   * - Standing on a moving car (they climb on parked ones): thrown off sideways.
   */
  private contacts(car: Car, dt: number) {
    const [hx, hy, hz] = car.def.halfExtents;
    const d = car.def;
    const sp = Math.abs(car.speed);
    _q.copy(car.currQuat).invert();
    _f.set(0, 0, Math.sign(car.speed) * -1).applyQuaternion(car.currQuat);
    const reach = hz + 0.5 + sp * dt * 2; // look ahead so fast cars never tunnel past
    for (const z of this.ctx.zombies.list) {
      if (!z.alive) continue;
      _v.subVectors(z.curr, car.currPos).applyQuaternion(_q); // car space, y from the car's base
      if (Math.abs(_v.x) > hx + 0.45 || Math.abs(_v.z) > reach) continue;
      if (_v.y > 0.6 && _v.y < car.cy + hy + 1.2) {
        // Riding on top: off you go, to the side the zombie is on
        _w.set(Math.sign(_v.x || 1) * (2 + sp * 0.4), 2.5, 0).applyQuaternion(car.currQuat).addScaledVector(_f, sp * 0.5);
        this.ctx.zombies.fling(z, _w, sp * d.rammingDamage * 0.3, d.id);
        continue;
      }
      if (_v.y > 0.6 || sp < 4) continue;
      // Hit by the front/rear: throw along the travel direction and up
      // Thrown ahead of the bumper (faster than the car, so it doesn't end up under it) and off to its side
      _w.copy(_f).multiplyScalar(sp * 1.2).setY(1.5 + sp * 0.25);
      _p.set(Math.sign(_v.x || 1) * sp * 0.25, 0, 0).applyQuaternion(car.currQuat);
      _w.add(_p);
      this.ctx.zombies.fling(z, _w, sp * d.rammingDamage, d.id);
      _p.copy(z.curr).setY(z.curr.y + 1);
      this.ctx.sfx('melee_hit', _p, { volume: 1 });
      this.ctx.fx.impact(_p, _f, 'flesh', _f, 2);
      if (car === this.driving) this.ctx.rig.addTrauma(0.25);
      // The bump costs the car a little speed
      const lv = car.body.linvel();
      car.body.setLinvel({ x: lv.x * 0.92, y: lv.y, z: lv.z * 0.92 }, true);
    }
  }

  private chaseCam(dt: number) {
    const car = this.driving;
    if (!car) return false;
    const cam = this.ctx.game.camera;
    const d = car.def;
    // Mouse orbits; it drifts back behind the car after a second of no input
    const [mx, my] = this.ctx.controls.takeLook();
    if (mx || my) this.lookIdle = 0;
    else this.lookIdle += dt;
    this.camYaw -= mx * 0.003;
    this.camPitch = MathUtils.clamp(this.camPitch - my * 0.003, -0.5, 0.6);
    if (this.lookIdle > 1) {
      this.camYaw *= Math.max(0, 1 - dt * 2);
      this.camPitch *= Math.max(0, 1 - dt * 2);
    }
    const root = car.model.root;
    _f.set(0, 0, -1).applyQuaternion(root.quaternion).setY(0).normalize();
    const yaw = Math.atan2(-_f.x, -_f.z) + this.camYaw;
    _cam.set(Math.sin(yaw) * d.camDist, d.camHeight + this.camPitch * d.camDist, Math.cos(yaw) * d.camDist).add(root.position);
    // Lag (critically damped feel) + keep out of walls with a ray from the car
    this.camPos.lerp(_cam, 1 - Math.exp(-dt / d.camLag));
    _look.copy(root.position).setY(root.position.y + 1.4);
    const { R, world } = this.ctx.game.phys;
    _v.subVectors(this.camPos, _look);
    const len = _v.length();
    _v.divideScalar(len);
    this.ray ??= new R.Ray(_look, _v);
    this.ray.origin = _look;
    this.ray.dir = _v;
    const hit = world.castRay(this.ray, len, true, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.PLAYER, Group.STATIC | Group.TERRAIN | Group.BUILD), car.collider);
    cam.position.copy(hit ? _w.copy(_look).addScaledVector(_v, Math.max(0.5, hit.timeOfImpact - 0.2)) : this.camPos);
    cam.lookAt(_look);
    const fov = 70 + Math.min(12, Math.abs(car.speed) * 0.35);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    return true;
  }

  render(alpha: number) {
    for (const car of this.list) {
      const root = car.model.root;
      root.position.lerpVectors(car.prevPos, car.currPos, alpha);
      root.quaternion.slerpQuaternions(car.prevQuat, car.currQuat, alpha);
      // Wheels: suspension travel, steering, spin
      for (let k = 0; k < 4; k++) {
        const w = car.model.wheels.get(WHEELS[k]);
        if (!w) continue;
        const susp = car.vc.wheelSuspensionLength(k) ?? car.def.suspensionRest;
        const conn = car.vc.wheelChassisConnectionPointCs(k);
        if (conn) w.node.position.set(w.offset.x, conn.y + car.cy - susp, w.offset.z);
        car.wheelSpin[k] -= (car.speed / car.def.wheelRadius) / 60;
        w.node.rotation.set(car.wheelSpin[k], k < 2 ? car.steer : 0, 0, 'YXZ');
      }
    }
    // Keep the PlayerView in the driver seat
    if (this.driving) {
      const p = this.ctx.player;
      const seat = this.driving.model.sockets.get('driver');
      if (seat) seat.getWorldPosition(p.position);
      else p.position.copy(this.driving.model.root.position);
      p.eye.copy(p.position).setY(p.position.y + 1.2);
      p.curr.copy(p.position);
      p.prev.copy(p.position);
      p.body.setNextKinematicTranslation({ x: p.position.x, y: p.position.y + 1, z: p.position.z });
    }
  }
}

declare module '../ctx' {
  interface Ctx {
    vehicles: Vehicles;
  }
}
