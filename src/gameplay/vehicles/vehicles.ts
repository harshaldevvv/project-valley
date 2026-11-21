import { Group as Group3D, MathUtils, Quaternion, Vector3, type Object3D } from 'three';
import type { Collider, DynamicRayCastVehicleController, RigidBody } from '@dimforge/rapier3d-compat';
import { Group, groups } from '../../engine/physics';
import { loadModel, type ModelInstance } from '../../engine/models';
import { vehicles as VD, type VehicleFeel } from '../../content/data/vehicles';
import { FAR_CULL } from '../../content/data/yard';
import { farCull } from '../../engine/farcull';
import type { VehicleDef } from '../../content/data/types';
import { yardSpawns } from '../../world/yard/spawns';
import { probe, type Ctx } from '../ctx';
import type { Interactable } from '../../core/contracts';
import { vehicleText as T } from '../../content/text/vehicles';
import { VEHICLE_FUEL } from '../../content/data/tools';
import { burn } from '../../systems/fuel';
import { worldHooks } from '../../systems/worldHooks';
import { questBus } from '../../systems/questBus';

/**
 * Data-driven cars (one VehicleDef row = one car on the track): Rapier DynamicRayCastVehicleController,
 * enter/exit (F), throttle/brake/reverse, speed-sensitive steering, handbrake, horn (noise), flip reset,
 * chase camera, engine loop pitched by speed, trunk container + interactable, runs over zombies.
 */
type Def = VehicleDef & VehicleFeel;
const WHEELS = ['FL', 'FR', 'RL', 'RR'] as const;
const _q = new Quaternion();
const _lq = new Quaternion();
const _v = new Vector3();
const _w = new Vector3();
const _f = new Vector3();
const _cam = new Vector3();
const _look = new Vector3();
const _p = new Vector3();
const UPV = new Vector3(0, 1, 0);

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
  readonly hoodPos = new Vector3();
  readonly trunkId: string;
  hp: number;
  /** Litres in the tank (data/tools.ts VEHICLE_FUEL). At 0 the engine stalls: no power, no engine sound. */
  fuel: number;
  stalledToast = false;
  smokeT = 0;
  tipped = false;
  tippedT = 0;
  /** Drive feel state: gear, upshift torque cut, engine rpm 0..1, skid loop, crash/landing detection, body lean spring. */
  gear = 0;
  shiftT = 0;
  rpm = 0;
  skid: { setVolume(v: number): void; setRate(r: number): void; stop(): void } | null = null;
  skidVol = 0;
  readonly prevVel = new Vector3();
  crashAcc = 0;
  crashT = 0;
  noCrashT = 0;
  airT = 0;
  airVy = 0;
  accLong = 0; // m/s², + = speeding up (smoothed)
  accLat = 0; // m/s², + = toward the car's right
  readonly lean = { p: 0, r: 0, vp: 0, vr: 0 }; // rad, rad/s
  /** Pivot holding everything but the wheels (cosmetic lean); null if the model keeps its wheels inside the body. */
  bodyPivot: Object3D | null = null;
  /** Rotation of the pivot's parent relative to the model root (identity for most models). */
  readonly hostQ = new Quaternion();
  get dead() {
    return this.hp <= 0;
  }
  get empty() {
    return this.fuel <= 0;
  }
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
    this.hp = def.hp;
    this.fuel = def.fuelLiters * VEHICLE_FUEL.startFraction;
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
  private camHead = 0; // trailing heading of the chase camera (rad)
  private fov = 70;
  /** Car interactables (interact gives them priority when the crosshair is on a car, QA-070). */
  readonly prompts = new Set<Interactable>();
  private registerPrompt(i: Interactable) {
    this.prompts.add(i);
    this.ctx.game.interact.register(i);
  }
  private enteredTick = -1;
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
    // Saves keep fuel through systems' 'worldtools' section (gameplay/saves.ts is not touched)
    worldHooks.carFuel = {
      get: () => this.list.map((c) => +c.fuel.toFixed(2)),
      set: (a) => this.list.forEach((c, k) => typeof a[k] === 'number' && (c.fuel = Math.min(c.def.fuelLiters, Math.max(0, a[k])))),
    };
  }

  async spawn(def: Def, at: Vector3, yaw: number, n: number) {
    const { R, world } = this.ctx.game.phys;
    const model = (await loadModel(def.model, def.fallbackSize)).create();
    this.ctx.game.scene.add(model.root);
    farCull(this.ctx.game, model.root, FAR_CULL.vehicle);
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
        .setMassProperties(m, { x: 0, y: -hy - def.comDrop, z: 0 } /* low centre of mass (QA-056) */, { x: (m / 12) * (4 * hy * hy + 4 * hz * hz), y: (m / 12) * (4 * hx * hx + 4 * hz * hz), z: (m / 12) * (4 * hx * hx + 4 * hy * hy) }, { x: 0, y: 0, z: 0, w: 1 })
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
    // Cosmetic weight transfer: the body leans on a pivot, the wheels stay planted
    const wheelNodes = new Set([...model.wheels.values()].map((w) => w.node));
    const holdsWheel = (o: Object3D) => {
      let h = false;
      o.traverse((c) => void (h ||= wheelNodes.has(c)));
      return h;
    };
    // The pivot goes under the wheels' common parent (GLBs nest everything under one node); the lean is turned into
    // that node's frame, so it always pitches/rolls about the car's own axes
    const parents = new Set([...wheelNodes].map((w) => w.parent));
    const host = parents.size === 1 ? [...parents][0]! : model.root;
    const movable = host.children.filter((ch) => !holdsWheel(ch));
    if (movable.length) {
      const pivot = new Group3D();
      host.add(pivot);
      for (const ch of movable) pivot.attach(ch);
      car.bodyPivot = pivot;
      for (let o: Object3D | null = host; o && o !== model.root; o = o.parent) car.hostQ.premultiply(o.quaternion);
    }
    this.syncState(car);
    car.prevPos.copy(car.currPos);
    car.prevQuat.copy(car.currQuat);
    this.list.push(car);
    this.ctx.hits.set(collider.handle, {
      kind: 'vehicle',
      surface: 'metal',
      zone: () => 'body',
      hit: (info) => {
        const dmg = info.damage * def.bulletDamageMul;
        this.damageCar(car, dmg);
        return { damage: dmg, kill: false, zone: 'body' };
      },
    });

    // Trunk container + interactables (door + trunk)
    const inv = probe(this.ctx.game, 'inventory', 'registerContainer');
    try {
      inv?.registerContainer(car.trunkId, 'trunk_pickup');
    } catch (e) {
      console.warn('registerContainer', e);
    }
    this.registerPrompt({
      position: car.trunkPos,
      radius: 1.8,
      prompt: () => (this.driving ? null : T.openTrunk),
      holdSeconds: () => 0.4,
      onInteract: () => {
        this.ctx.sfx('car_door', car.trunkPos);
        const api = probe(this.ctx.game, 'inventory', 'openContainer');
        if (api) api.openContainer(car.trunkId);
        else this.ctx.game.events.emit('toast', { text: T.trunkUnavailable });
      },
    });
    // Repair at the hood with a repair kit (systems item); hidden when the car is at full HP
    const kits = () => {
      const lo = probe(this.ctx.game, 'loadout', 'count');
      try {
        return lo ? lo.count(car.def.repairItem) : 0;
      } catch {
        return 0;
      }
    };
    this.registerPrompt({
      position: car.hoodPos,
      radius: 2,
      prompt: () => (this.driving || car.hp >= car.def.hp ? null : kits() > 0 ? T.repairWithKit : T.repairNeedsKit),
      holdSeconds: () => (kits() > 0 ? car.def.repairSeconds : 0),
      onInteract: () => {
        if (kits() <= 0) {
          this.ctx.game.events.emit('toast', { text: T.needsKit });
          return;
        }
        const lo = probe(this.ctx.game, 'loadout', 'consume');
        if (lo && lo.consume(car.def.repairItem, 1) < 1) return;
        car.hp = car.def.hp; // also revives a dead engine; smoke stops below
        car.smokeT = 0;
        this.ctx.playerAnim?.oneshot('interact_search', 0.1);
        this.ctx.sfx('build_place', car.hoodPos);
        this.ctx.game.events.emit('toast', { text: T.repaired });
      },
    });
    // Refuel from carried jerrycans, standing at the car (rear, by the filler cap)
    const space = () => car.def.fuelLiters - car.fuel;
    this.registerPrompt({
      position: car.trunkPos,
      radius: 2.2,
      prompt: () => (this.driving || space() < 0.5 ? null : worldHooks.fuelCarried() > 0 ? T.refuel(Math.round(Math.min(space(), worldHooks.fuelCarried()))) : T.refuelNeedsCan),
      holdSeconds: () => (worldHooks.fuelCarried() > 0 ? VEHICLE_FUEL.refuelSeconds : 0),
      onInteract: () => {
        const got = worldHooks.takeFuel(space());
        if (got <= 0) {
          this.ctx.game.events.emit('toast', { text: T.noFuelCarried });
          return;
        }
        car.fuel = Math.min(car.def.fuelLiters, car.fuel + got);
        car.stalledToast = false;
        questBus.emit('refuel');
        this.ctx.playerAnim?.oneshot('interact_search', 0.1);
        this.ctx.sfx('search_rustle', car.trunkPos);
        this.ctx.game.events.emit('toast', { text: T.refueled(Math.round(got)) });
      },
    });
    this.registerPrompt({
      position: car.doorPos,
      radius: def.doorReach,
      prompt: () => (this.driving ? null : T.drive), // E or F (QA-027: one key glyph)
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
    // Hood: front of the chassis (no socket on the pickup yet)
    car.hoodPos.set(0, car.cy + car.def.halfExtents[1], -hz - 0.3).applyQuaternion(car.currQuat).add(car.currPos);
    const trunk = car.model.sockets.get('trunk');
    if (trunk) trunk.getWorldPosition(car.trunkPos);
    else car.trunkPos.set(0, 1, hz + 0.4).applyQuaternion(car.currQuat).add(car.currPos);
  }

  enter(car: Car) {
    const p = this.ctx.player;
    if (this.driving || p.dead) return;
    this.driving = car;
    this.enteredTick = this.ctx.game.tick; // the E that got you in mustn't also get you out
    p.inVehicle = true;
    p.collider.setEnabled(false);
    this.ctx.weapons.finishReload();
    this.ctx.sfx('car_door', car.doorPos);
    this.ctx.sfx('car_start', car.currPos);
    car.engine = this.ctx.loopSfx('car_engine_loop', car.model.root, { volume: 0.6 });
    car.skid = this.ctx.loopSfx('car_skid_loop', car.model.root, { volume: 0 });
    car.skid?.setVolume(0);
    car.skidVol = 0;
    _f.set(0, 0, -1).applyQuaternion(car.currQuat);
    this.camHead = Math.atan2(-_f.x, -_f.z);
    this.fov = this.ctx.game.camera.fov;
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
    car.skid?.stop();
    car.skid = null;
    this.ctx.sfx('car_door', car.doorPos);
    for (let k = 0; k < 4; k++) {
      car.vc.setWheelEngineForce(k, 0);
      car.vc.setWheelBrake(k, car.def.brakeForce * 0.3);
    }
    this.driving = null;
    this.ctx.rig.override = null;
  }

  /**
   * Put the car back on its wheels on clear ground (QA-039): keep its heading (from the nose, or the roof if it
   * stands on its tail), find the ground under it, and if the chassis box would overlap anything, try spots in
   * rings of 3 and 6 m around it.
   */
  flipReset(car: Car) {
    const { R, world } = this.ctx.game.phys;
    const t = car.body.translation();
    _f.set(0, 0, -1).applyQuaternion(car.currQuat);
    if (Math.abs(_f.y) > 0.8) _f.set(0, 1, 0).applyQuaternion(car.currQuat); // nose up/down: the roof gives the heading
    const yaw = Math.atan2(-_f.x, -_f.z);
    const rot = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    const [hx, hy, hz] = car.def.halfExtents;
    const box = new R.Cuboid(hx + 0.1, hy, hz + 0.1);
    const ground = groups(Group.VEHICLE, Group.STATIC | Group.TERRAIN | Group.BUILD);
    const spots: [number, number][] = [[0, 0]];
    for (const r of [3, 6]) for (let k = 0; k < 8; k++) spots.push([Math.cos((k / 8) * Math.PI * 2) * r, Math.sin((k / 8) * Math.PI * 2) * r]);
    let best: { x: number; y: number; z: number } | null = null;
    for (const [dx, dz] of spots) {
      const x = t.x + dx;
      const z = t.z + dz;
      const down = world.castRay(new R.Ray({ x, y: t.y + 12, z }, { x: 0, y: -1, z: 0 }), 40, true, R.QueryFilterFlags.EXCLUDE_SENSORS, ground, car.collider);
      if (!down) continue;
      const y = t.y + 12 - down.timeOfImpact + car.cy + 0.25;
      let blocked = false;
      world.intersectionsWithShape({ x, y, z }, rot, box, () => ((blocked = true), false), R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.VEHICLE, Group.STATIC | Group.BUILD | Group.VEHICLE), car.collider);
      if (!blocked) {
        best = { x, y, z };
        break;
      }
    }
    best ??= { x: t.x, y: t.y + 2, z: t.z };
    car.body.setTranslation(best, true);
    car.body.setRotation(rot, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.syncState(car);
    car.prevPos.copy(car.currPos);
    car.prevQuat.copy(car.currQuat);
    this.calm(car);
  }

  /** After a teleport: forget the last velocity so the jump isn't read as a crash or a landing. */
  private calm(car: Car) {
    car.prevVel.set(0, 0, 0);
    car.crashAcc = car.crashT = car.airT = car.airVy = 0;
    car.noCrashT = 0.3;
  }

  /**
   * Anti-roll (QA-056): damp roll/pitch angular velocity (more in the air), a righting torque on the wheels, and an
   * auto-flip assist when the car lies on its side, slow, for `autoFlipS`.
   */
  private stabilise(car: Car, contacts: number, dt: number) {
    const d = car.def;
    const av = car.body.angvel();
    _q.copy(car.currQuat).invert();
    _v.set(av.x, av.y, av.z).applyQuaternion(_q); // car space: x = pitch, z = roll
    const k = contacts === 0 ? d.airAngDamp : d.rollDamp;
    _v.x *= Math.max(0, 1 - k * 0.5 * dt);
    _v.z *= Math.max(0, 1 - k * dt);
    _v.z = MathUtils.clamp(_v.z, -d.maxRollRate, d.maxRollRate);
    // Righting: roll angle from the car's up vector
    _w.set(0, 1, 0).applyQuaternion(car.currQuat);
    const rightX = _f.set(1, 0, 0).applyQuaternion(car.currQuat).y; // >0: tilted onto its left side
    if (_w.y > 0.3) _v.z -= rightX * d.rightingRate * dt;
    _v.applyQuaternion(car.currQuat);
    car.body.setAngvel({ x: _v.x, y: _v.y, z: _v.z }, true);
    _f.set(0, 0, -1).applyQuaternion(car.currQuat);
    car.tipped = _w.y < 0.6;
    if (car.tipped && Math.abs(car.speed) < 1.5 && car.body.linvel().y > -1) {
      car.tippedT += dt;
      if (car.tippedT > d.autoFlipS) {
        this.flipReset(car);
        car.tippedT = 0;
      }
    } else car.tippedT = 0;
  }

  /** After a teleport (save load): render state = body state, no interpolation jump. */
  resync(car: Car) {
    this.syncState(car);
    car.prevPos.copy(car.currPos);
    car.prevQuat.copy(car.currQuat);
    this.calm(car);
  }

  /** A crash: `kmh` of horizontal speed lost in a short window. Sound by severity, hp over the threshold, camera jolt. */
  private crash(car: Car, kmh: number) {
    const d = car.def;
    if (kmh < d.crashMinKmh * 0.5) return;
    const sev = Math.min(1, kmh / 60);
    this.ctx.sfx('car_crash', car.currPos, { volume: 0.35 + 0.65 * sev });
    if (kmh > d.crashMinKmh) this.damageCar(car, (kmh - d.crashMinKmh) * d.crashHpPerKmh);
    car.lean.vp -= 1.2 * sev; // body pitches into the hit
    if (car === this.driving) {
      this.ctx.rig.addTrauma(0.15 + 0.55 * sev);
      this.ctx.rig.kick(0, -(1.5 + 4 * sev)); // head lurches forward
    }
    this.ctx.game.events.emit('noise', { position: car.currPos.clone(), radius: 20 + 40 * sev, source: 'engine' });
  }

  /**
   * Feel layer after the vehicle update (fixed step): accelerations for the lean and FOV, crash and landing detection,
   * tyre scrub and the skid loop, body lean spring.
   */
  private feel(car: Car, contacts: number, braking: boolean, hand: boolean, launching: boolean, dt: number) {
    const d = car.def;
    const lv = car.body.linvel();
    _q.copy(car.currQuat).invert();
    _w.set(lv.x - car.prevVel.x, lv.y - car.prevVel.y, lv.z - car.prevVel.z);
    const dvh = Math.hypot(_w.x, _w.z);
    _w.divideScalar(dt).applyQuaternion(_q);
    const a = Math.min(1, dt * 12); // ticks are noisy: smooth over ~80 ms
    car.accLong += (MathUtils.clamp(-_w.z, -40, 40) - car.accLong) * a;
    car.accLat += (MathUtils.clamp(_w.x, -40, 40) - car.accLat) * a;
    // Crash: speed lost within 0.12 s of a big one-tick change (brakes give ~0.15 m/s per tick, a wall 2+)
    car.noCrashT = Math.max(0, car.noCrashT - dt);
    if (car.crashT > 0) {
      car.crashAcc += dvh;
      if ((car.crashT -= dt) <= 0) this.crash(car, car.crashAcc * 3.6);
    } else if (dvh > 0.9 && car.noCrashT <= 0) {
      car.crashAcc = dvh;
      car.crashT = 0.12;
    }
    // Landing thump after real air time
    if (contacts === 0) {
      car.airT += dt;
      car.airVy = Math.min(car.airVy, lv.y);
    } else {
      if (car.airT > 0.15 && -car.airVy > d.landMinVy) {
        const s = Math.min(1, 0.25 + (-car.airVy - d.landMinVy) / 5);
        this.ctx.sfx('car_land', car.currPos, { volume: 0.5 + 0.5 * s });
        if (car === this.driving) {
          this.ctx.rig.addTrauma(0.1 + 0.3 * s);
          this.ctx.rig.kick(0, -1.5 * s);
        }
        car.lean.vp -= 0.6 * s; // nose slaps down
      }
      car.airT = 0;
      car.airVy = 0;
    }
    // Sideways slide: scrub a little speed, squeal
    _v.set(lv.x, lv.y, lv.z).applyQuaternion(_q);
    const lat = Math.abs(_v.x);
    const sp = Math.abs(car.speed);
    let vx = lv.x;
    let vz = lv.z;
    if (contacts >= 2 && lat > 1) {
      const f = Math.max(0, 1 - d.scrub * lat * dt);
      vx *= f;
      vz *= f;
      car.body.setLinvel({ x: vx, y: lv.y, z: vz }, true);
    }
    let skid = 0;
    if (contacts >= 2 && car === this.driving) {
      skid = MathUtils.smoothstep(lat, d.skidSlipMin, d.skidSlipFull);
      if (braking && sp > 8) skid = Math.max(skid, 0.45 * Math.min(1, (sp - 8) / 10));
      if (hand && sp > 3) skid = Math.max(skid, 0.75);
      if (launching && sp < 4) skid = Math.max(skid, 0.35 * (1 - sp / 4)); // wheelspin chirp off the line
    }
    car.skidVol += (skid - car.skidVol) * Math.min(1, dt * (skid > car.skidVol ? 14 : 6));
    car.skid?.setVolume(car.skidVol);
    car.skid?.setRate(0.85 + 0.2 * car.skidVol + 0.1 * Math.min(1, sp / 20));
    car.prevVel.set(vx, lv.y, vz);
    // Body lean spring toward the weight-transfer target (nose up on throttle, down on brakes, rolls out of a turn)
    const L = car.lean;
    const D2R = Math.PI / 180;
    const cap = d.leanMaxDeg * D2R;
    const tp = contacts ? MathUtils.clamp((car.accLong / 9.81) * d.leanPitchPerG * D2R, -cap, cap) : 0;
    const tr = contacts ? MathUtils.clamp((car.accLat / 9.81) * d.leanRollPerG * D2R, -cap, cap) : 0;
    const w = 2 * Math.PI * d.leanHz;
    L.vp += (w * w * (tp - L.p) - 2 * d.leanDamp * w * L.vp) * dt;
    L.vr += (w * w * (tr - L.r) - 2 * d.leanDamp * w * L.vr) * dt;
    L.p = MathUtils.clamp(L.p + L.vp * dt, -cap * 1.5, cap * 1.5);
    L.r = MathUtils.clamp(L.r + L.vr * dt, -cap * 1.5, cap * 1.5);
  }

  /** Car damage (zombie hits, bullets). At 0 the engine dies: no drive, black smoke (QA-050). */
  damageCar(car: Car, amount: number) {
    if (car.dead) return;
    car.hp = Math.max(0, car.hp - amount);
    if (car.dead) {
      car.engine?.stop();
      car.engine = null;
      this.ctx.sfx('impact_metal', car.currPos, { volume: 1 });
      if (car === this.driving) this.ctx.game.events.emit('toast', { text: T.engineDestroyed });
    }
  }

  /** Distance from a point to the car's chassis box (horizontal), and the closest point on it into `out`. */
  surfaceDist(car: Car, p: Vector3, out?: Vector3) {
    // Closest point on the chassis box in 3D (works upright or on its side), distance measured horizontally
    const [hx, hy, hz] = car.def.halfExtents;
    _q.copy(car.currQuat).invert();
    _v.subVectors(p, car.currPos).applyQuaternion(_q);
    _w.set(Math.max(-hx, Math.min(hx, _v.x)), Math.max(car.cy - hy, Math.min(car.cy + hy, _v.y)), Math.max(-hz, Math.min(hz, _v.z)));
    _w.applyQuaternion(car.currQuat).add(car.currPos);
    if (out) out.set(_w.x, p.y, _w.z);
    return Math.hypot(p.x - _w.x, p.z - _w.z);
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
    } else if (this.driving && (c.pressed('vehicle') || c.pressed('interact')) && this.ctx.game.tick > this.enteredTick) this.exit(); // E or F (QA-059)

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
        const run = !car.dead && !car.empty;
        // Gearbox: gear from speed, force falls per gear, a short torque cut on each upshift
        const sf = Math.max(0, car.speed) / top;
        let gear = 0;
        while (gear < d.gears.length - 1 && sf > d.gears[gear]) gear++;
        if (gear < car.gear && sf > d.gears[gear] * 0.85) gear = car.gear; // hysteresis: the shift's torque cut mustn't drop it straight back (gear hunting up hills)
        if (gear > car.gear) car.shiftT = d.shiftCutS;
        car.gear = gear;
        car.shiftT = Math.max(0, car.shiftT - dt);
        if (fwd && run) engine = car.speed < top ? d.engineForce * d.gearForce[gear] * (car.shiftT > 0 ? 0.15 : 1) : 0;
        if (back) {
          if (car.speed > 1) brake = d.brakeForce;
          else if (run) engine = car.speed > -d.reverseKmh / 3.6 ? -d.engineForce * 0.6 : 0;
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
        // Fuel: idle burn while the engine runs, more with the pedal down; empty = stall
        if (!car.dead && !car.empty) {
          car.fuel = Math.max(0, car.fuel - burn(VEHICLE_FUEL.idleLPerS, VEHICLE_FUEL.driveLPerS, fwd || back ? 1 : 0, dt));
          if (car.empty && !car.stalledToast) {
            car.stalledToast = true;
            this.ctx.game.events.emit('toast', { text: T.outOfFuel });
          }
        }
        // Engine pitch: rpm climbs through each gear and drops on the shift, plus a rise with road speed
        const k = Math.min(1, Math.abs(car.speed) / top);
        const lo = car.gear ? d.gears[car.gear - 1] : 0;
        const inGear = MathUtils.clamp((k - lo) / (d.gears[car.gear] - lo), 0, 1);
        const rpmWant = run ? (fwd || back ? 0.3 + 0.7 * inGear : 0.1 + 0.5 * inGear) : 0;
        car.rpm += (rpmWant - car.rpm) * Math.min(1, dt * (car.shiftT > 0 ? 20 : 7));
        car.engine?.setRate(d.idleRate + (d.maxRate - d.idleRate) * (0.55 * car.rpm + 0.45 * k));
        car.engine?.setVolume(car.empty || car.dead ? 0 : 0.45 + 0.4 * k);
      }
      // Speed-sensitive steering, rate-limited
      // Speed-sensitive steering; none in the air (QA-056)
      let contacts = 0;
      for (let k = 0; k < 4; k++) if (car.vc.wheelIsInContact(k)) contacts++;
      const maxSteer = contacts === 0 ? 0 : MathUtils.degToRad(d.maxSteerDeg) * (1 + (d.steerAtSpeed - 1) * Math.min(1, Math.abs(car.speed) / top));
      const want = steerIn * maxSteer;
      const centring = Math.abs(want) < Math.abs(car.steer) || want * car.steer < 0; // letting go or counter-steering: faster
      const sr = centring ? d.steerReturnRate : d.steerRate;
      car.steer += MathUtils.clamp(want - car.steer, -sr * dt, sr * dt);
      for (let k = 0; k < 4; k++) {
        const front = k < 2;
        car.vc.setWheelSteering(k, front ? car.steer : 0);
        car.vc.setWheelEngineForce(k, front ? 0 : engine); // rear-wheel drive
        car.vc.setWheelBrake(k, hand && !front ? d.handbrakeForce : brake * 2 * (front ? d.brakeFront : 1 - d.brakeFront));
        car.vc.setWheelSideFrictionStiffness(k, hand && !front ? 0.35 : 1);
      }
      car.vc.updateVehicle(dt, undefined, groups(Group.VEHICLE, Group.STATIC | Group.TERRAIN | Group.BUILD));
      this.stabilise(car, contacts, dt);
      this.feel(car, contacts, brake > d.brakeForce * 0.5, hand, engine > 0 && car.gear === 0, dt);
      // Damaged engine smokes from the hood: grey under 35 %, black when dead
      if (car.hp < d.hp * 0.35 && (car.smokeT -= dt) <= 0) {
        car.smokeT = car.dead ? 0.12 : 0.25;
        _p.set(0, car.cy + d.halfExtents[1] + 0.1, -d.halfExtents[2] + 0.6).applyQuaternion(car.currQuat).add(car.currPos);
        this.ctx.fx.smokePuff(_p, UPV, 1, car.dead ? '#2a2826' : '#7a7670', 4); // bigger than muzzle wisps so it reads at chase-cam distance
      }
      this.syncState(car);
      if (Math.abs(car.speed) > d.zombieShoveMin) this.contacts(car, dt);
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
      if (_v.y > 0.6) continue;
      if (sp < 4) {
        // Slow bump: shoved aside and a little hurt, never driven through
        _w.set(Math.sign(_v.x || 1) * (1.5 + sp * 0.5), 0.8, 0).applyQuaternion(car.currQuat).addScaledVector(_f, sp);
        this.ctx.zombies.fling(z, _w, sp * d.rammingDamage * 0.25, d.id);
        continue;
      }
      // Hit by the front/rear: throw along the travel direction and up
      // Thrown ahead of the bumper (faster than the car, so it doesn't end up under it) and off to its side
      _w.copy(_f).multiplyScalar(sp * 1.25).setY(d.zombieLift + sp * d.zombieLiftPerMs);
      _p.set(Math.sign(_v.x || 1) * sp * 0.25, 0, 0).applyQuaternion(car.currQuat);
      _w.add(_p);
      this.ctx.zombies.fling(z, _w, sp * d.rammingDamage, d.id);
      _p.copy(z.curr).setY(z.curr.y + 1);
      this.ctx.sfx('melee_hit', _p, { volume: 1 });
      this.ctx.sfx('car_crash', _p, { volume: 0.3 }); // bumper thunk under the flesh hit
      this.ctx.fx.impact(_p, _f, 'flesh', _f, 2);
      if (car === this.driving) {
        this.ctx.rig.addTrauma(0.15 + Math.min(0.35, sp * 0.015));
        this.ctx.rig.kick(1.5, -1.5);
      }
      // The bump costs the car some speed (felt through the lean), and isn't read as a crash
      const lv = car.body.linvel();
      car.body.setLinvel({ x: lv.x * d.zombieHitKeep, y: lv.y, z: lv.z * d.zombieHitKeep }, true);
      car.prevVel.set(lv.x * d.zombieHitKeep, lv.y, lv.z * d.zombieHitKeep);
      car.lean.vp -= 0.25;
      car.noCrashT = 0.2;
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
    // The heading trails the car's (shortest way round), so a turn shows the car rotating in frame
    const carYaw = Math.atan2(-_f.x, -_f.z);
    const dh = carYaw - this.camHead;
    this.camHead += Math.atan2(Math.sin(dh), Math.cos(dh)) * (1 - Math.exp(-dt / d.camYawLag));
    const k = Math.min(1, Math.abs(car.speed) / (d.topSpeedKmh / 3.6));
    const dist = d.camDist + d.camDistAtSpeed * k;
    const yaw = this.camHead + this.camYaw;
    _cam.set(Math.sin(yaw) * dist, d.camHeight + this.camPitch * dist, Math.cos(yaw) * dist).add(root.position);
    // Lag (critically damped feel) + keep out of walls with a ray from the car
    this.camPos.lerp(_cam, 1 - Math.exp(-dt / d.camLag));
    _look.copy(root.position).setY(root.position.y + 1.4).addScaledVector(_f, d.camLookAhead * k * (car.speed < 0 ? -1 : 1));
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
    // FOV: wider with speed and under hard acceleration, smoothed; impact kicks (rig.kick) ride on top
    const fovWant = d.fovBase + d.fovAtSpeed * k + d.fovPerG * Math.min(1, Math.max(0, car.accLong) / 9.81);
    this.fov += (fovWant - this.fov) * (1 - Math.exp(-dt / d.fovLag));
    const fov = this.fov + this.ctx.rig.fovKick;
    if (Math.abs(cam.fov - fov) > 0.02) {
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
      if (car.bodyPivot) {
        // lean in car space, conjugated into the host frame: hostQ⁻¹ · lean · hostQ
        _q.setFromAxisAngle(_v.set(1, 0, 0), car.lean.p).multiply(_lq.setFromAxisAngle(_v.set(0, 0, 1), car.lean.r));
        car.bodyPivot.quaternion.copy(car.hostQ).invert().multiply(_q).multiply(car.hostQ);
      }
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
