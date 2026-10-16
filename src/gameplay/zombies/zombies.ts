import { BufferAttribute, BufferGeometry, Frustum, LineBasicMaterial, LineSegments, Matrix4, Object3D, Sphere, Vector3 } from 'three';
import type { Collider, KinematicCharacterController, RigidBody } from '@dimforge/rapier3d-compat';
import { Group, groups } from '../../engine/physics';
import { horde as HD, senses as SN, zombieDefs, zombieMix, type ZombieDef } from '../../content/data/zombies';
import { hasAsset } from '../../engine/assets';
import { yard } from '../../content/data/yard';
import { yardSpawns } from '../../world/yard/spawns';
import type { Ctx, HitInfo, HitResult, Hittable, Zone } from '../ctx';
import { AnimationController, applyPose, makeCharacter, newPose, type Character } from '../animstand/character';
import { createCrowd, type Crowd } from '../../engine/crowd';
import { CrowdAnim } from './crowdAnim';
import { newSenseState, sightRate, updateSenses, type SenseState } from './senses';

/**
 * Shamblers (principles §4 reaction ladder, §6 senses/tokens/telegraphs/anti-cheese).
 * Kinematic capsule (+ head sensor) moved by a Rapier KCC with direct steering + separation (no navmesh in M1).
 */
const MOVE_FILTER = Group.STATIC | Group.TERRAIN | Group.VEHICLE | Group.BUILD | Group.PLAYER;
const LOS_FILTER = Group.STATIC | Group.TERRAIN | Group.BUILD | Group.VEHICLE;
const CAPSULE_HH = 0.45;
const CAPSULE_R = 0.3;
const HEAD_Y = 1.62;

type Mode = 'move' | 'windup' | 'recover' | 'stagger' | 'climb' | 'dead';

const _v = new Vector3();
const _w = new Vector3();
const _to = new Vector3();
const _o = new Vector3();
const _proj = new Matrix4();
const _frustum = new Frustum();
const _sphere = new Sphere(new Vector3(), 1.2);

export class Zombie {
  readonly prev = new Vector3();
  readonly curr = new Vector3();
  readonly vel = new Vector3();
  readonly push = new Vector3();
  readonly lastKnown = new Vector3();
  readonly wander = new Vector3();
  readonly home = new Vector3();
  yaw = 0;
  prevYaw = 0;
  hp: number;
  legHp: number;
  crawler = false;
  sense: SenseState = newSenseState();
  mode: Mode = 'move';
  modeT = 0;
  token = false;
  hitstop = 0;
  flinch = 0;
  headSnap = 0;
  staggerHits = 0; // light melee: stagger on the 2nd hit within 1 s
  lastMeleeT = -9;
  dmgLog: { t: number; amt: number }[] = [];
  groanT: number;
  losT = 0;
  seen = false;
  sight = 0;
  stuckT = 0;
  wanderT = 0;
  fallDir = 0;
  deadT = 0;
  walkPhase = 0;
  climb: { from: Vector3; to: Vector3; t: number } | null = null;
  anim: AnimationController | CrowdAnim | null = null;
  lastClip = '';
  /** Capsule centre above the feet (scaled per variant). */
  get capY() {
    return CAPSULE_HH * (this.def.scale ?? 1) + CAPSULE_R;
  }
  readonly fling = new Vector3();
  groundY = 0;
  lastCarHit = -9;
  pushDecay = 0.25;
  grounded = false;
  animAcc = 0;
  shadow = true;
  bones: { head: Object3D | null; spine: Object3D | null } | null = null;

  constructor(
    readonly id: number,
    readonly def: ZombieDef,
    readonly ch: Character,
    readonly body: RigidBody,
    readonly capsule: Collider,
    readonly head: Collider,
    groan: number,
  ) {
    this.hp = def.hp;
    this.legHp = def.legHp;
    this.groanT = groan;
    if (ch.skinned) this.anim = new AnimationController(ch);
  }
  get alive() {
    return this.mode !== 'dead';
  }
  get staggered() {
    return this.mode === 'stagger';
  }
}

export class Zombies {
  list: Zombie[] = [];
  private kcc: KinematicCharacterController;
  private nextId = 1;
  private noises: { pos: Vector3; radius: number }[] = [];
  private time = 0;
  private lines: LineSegments;
  private linePos = new Float32Array(30 * 8 * 3);
  private lineCol = new Float32Array(30 * 8 * 3);
  kills = 0;
  private lastWindup = -9;
  private tickN = 0;
  private ray;

  constructor(private ctx: Ctx) {
    const { world } = ctx.game.phys;
    this.ray = new ctx.game.phys.R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    this.kcc = world.createCharacterController(0.02);
    this.kcc.enableAutostep(0.3, 0.2, false);
    this.kcc.enableSnapToGround(0.3);
    this.kcc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    ctx.game.events.on('noise', (e) => this.noises.push({ pos: e.position, radius: e.radius }));
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.linePos, 3));
    g.setAttribute('color', new BufferAttribute(this.lineCol, 3));
    this.lines = new LineSegments(g, new LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 10;
    this.lines.visible = false;
    ctx.game.scene.add(this.lines);
  }

  get alive() {
    let n = 0;
    for (const z of this.list) if (z.alive) n++;
    return n;
  }

  /** Random points inside the pen (environment's yardSpawns.penZombies circle). */
  async spawnInPen(n: number) {
    const c = yardSpawns.penZombies ?? { x: yard.stations.pen.x, z: yard.stations.pen.z, radius: 8 };
    for (let i = 0; i < n; i++) {
      if (this.alive >= HD.maxAlive) {
        this.ctx.game.events.emit('toast', { text: `Zombie cap (${HD.maxAlive}) reached` });
        return;
      }
      const a = this.ctx.rand() * Math.PI * 2;
      const r = Math.sqrt(this.ctx.rand()) * c.radius;
      await this.spawn(new Vector3(c.x + Math.cos(a) * r, 0.05, c.z + Math.sin(a) * r), this.ctx.rand() * Math.PI * 2, this.pickVariant());
    }
  }

  /** Weighted variant from data/zombies zombieMix (seeded RNG); variants whose model isn't built fall back to the shambler. */
  pickVariant() {
    let total = 0;
    for (const k in zombieMix) total += zombieMix[k];
    let r = this.ctx.rand() * total;
    for (const k in zombieMix) {
      r -= zombieMix[k];
      if (r <= 0) return hasAsset(zombieDefs[k]?.model ?? '') ? k : 'shambler';
    }
    return 'shambler';
  }

  async spawn(at: Vector3, yaw = 0, defId = 'shambler') {
    const def = zombieDefs[defId];
    const { R, world } = this.ctx.game.phys;
    // Ground height under the spawn point
    const down = world.castRay(new R.Ray({ x: at.x, y: at.y + 3, z: at.z }, { x: 0, y: -1, z: 0 }), 10, true, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.ZOMBIE, Group.STATIC | Group.TERRAIN | Group.BUILD));
    if (down) at.y = at.y + 3 - down.timeOfImpact + 0.02;
    // GPU crowd (engine, one draw per archetype per LOD) when available; else a skinned/placeholder character
    const crowd = await this.crowdFor(def);
    let ch: Character;
    let ca: CrowdAnim | null = null;
    if (crowd) {
      ch = { root: new Object3D(), hand: new Object3D(), skinned: true, mixer: null, actions: new Map(), clips: crowd.clips, parts: null, pose: newPose() };
      ca = new CrowdAnim(crowd, crowd.add());
    } else {
      ch = await makeCharacter('zombie', def.model, def.clipsFrom);
      this.ctx.game.scene.add(ch.root);
    }
    const s = def.scale ?? 1;
    const capY = CAPSULE_HH * s + CAPSULE_R;
    const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(at.x, at.y + capY, at.z));
    const capsule = world.createCollider(R.ColliderDesc.capsule(CAPSULE_HH * s, CAPSULE_R).setCollisionGroups(groups(Group.ZOMBIE, 0xffff & ~Group.VEHICLE)), body); // cars plough through; Vehicles.contacts() deals the damage
    const head = world.createCollider(
      R.ColliderDesc.ball(0.15 * s).setTranslation(0, HEAD_Y * s - capY, 0).setSensor(true).setCollisionGroups(groups(Group.ZOMBIE, 0xffff)),
      body,
    );
    const z = new Zombie(this.nextId++, def, ch, body, capsule, head, HD.groanMin + this.ctx.rand() * (HD.groanMax - HD.groanMin));
    z.curr.copy(at);
    z.prev.copy(at);
    z.home.copy(at);
    z.wander.copy(at);
    z.yaw = z.prevYaw = yaw;
    if (ca) z.anim = ca;
    this.list.push(z);
    const hittable: Hittable = {
      kind: 'zombie',
      surface: 'flesh',
      zone: (c: Collider, p: Vector3): Zone => (c === z.head ? 'head' : p.y - z.curr.y < (z.crawler ? 0.3 : 0.85 * s) ? 'limb' : 'body'),
      hit: (info) => this.damage(z, info),
    };
    this.ctx.hits.set(capsule.handle, hittable);
    this.ctx.hits.set(head.handle, hittable);
    return z;
  }

  killAll() {
    for (const z of this.list) if (z.alive) this.die(z, new Vector3(0, 0, 1), false);
  }

  /** Remove every zombie (corpses too). */
  clear() {
    for (const z of this.list) this.remove(z);
    this.list.length = 0;
  }

  private remove(z: Zombie) {
    const { world } = this.ctx.game.phys;
    this.ctx.hits.delete(z.capsule.handle);
    this.ctx.hits.delete(z.head.handle);
    world.removeRigidBody(z.body);
    z.ch.root.removeFromParent();
    if (z.anim instanceof CrowdAnim) z.anim.crowd.remove(z.anim.i);
  }

  // ------------------------------------------------------------- damage
  damage(z: Zombie, info: HitInfo): HitResult | null {
    if (!z.alive) return null;
    const mul = info.zone === 'head' ? info.headMul : z.def.zoneMul[info.zone];
    const dmg = info.damage * mul;
    z.hp -= dmg;
    z.dmgLog.push({ t: this.time, amt: dmg });
    if (z.dmgLog.length > 12) z.dmgLog.shift();
    z.flinch = z.def.flinchTime;
    if (info.zone === 'head') z.headSnap = 0.25;
    if (info.zone === 'limb') {
      z.legHp -= dmg;
      if (!z.crawler && z.legHp <= z.def.legHp * 0.5) {
        z.crawler = true;
        this.ctx.sfx('zombie_hurt', z.curr);
      }
    }
    if (info.melee) z.hitstop = Math.max(z.hitstop, z.hp <= 0 ? info.melee.hitstop * 2.5 : info.melee.hitstop);
    // Being shot from afar: turn toward the shooter and go looking (anti-sniping cheese), never instant detection.
    if (z.sense.awareness !== 'detected' && !HD.passive) {
      z.lastKnown.copy(this.ctx.player.curr);
      z.sense.awareness = 'searching';
      z.sense.searchLeft = SN.searchS;
      z.sense.suspicion = Math.max(z.sense.suspicion, 0.8);
    }
    if (z.hp <= 0) {
      this.die(z, info.dir, !!info.melee);
      return { damage: dmg, kill: true, zone: info.zone };
    }
    this.ctx.sfx('zombie_hurt', z.curr, { pitchJitter: 0.1, volume: 0.7 });
    // Stagger ladder: 30 % max HP within 1.5 s, or melee stagger rule
    let recent = 0;
    for (const d of z.dmgLog) if (this.time - d.t <= z.def.staggerWindow) recent += d.amt;
    let stagger = recent >= z.def.staggerFrac * z.def.hp ? z.def.staggerTime : 0;
    if (info.melee) {
      if (info.melee.stagger > 0) stagger = Math.max(stagger, info.melee.stagger);
      z.staggerHits = this.time - z.lastMeleeT <= 1 ? z.staggerHits + 1 : 1;
      z.lastMeleeT = this.time;
      if (z.staggerHits >= 2) stagger = Math.max(stagger, z.def.staggerTime);
      if (info.melee.push > 0) z.push.copy(info.dir).setY(0).normalize().multiplyScalar(info.melee.push / 0.25);
    }
    if (stagger > 0) this.stagger(z, stagger);
    return { damage: dmg, kill: false, zone: info.zone };
  }

  /** Hit by a car (or thrown): damage by speed, then thrown along `vel` (m/s); dead ones fly as a ragdoll-lite. */
  fling(z: Zombie, vel: Vector3, damage: number, from: string) {
    if (!z.alive || this.time - z.lastCarHit < 0.5) return;
    z.lastCarHit = this.time;
    _w.copy(z.curr).setY(z.curr.y + 1);
    _o.copy(vel).normalize();
    this.damage(z, { point: _w, dir: _o, zone: 'body', damage: damage / z.def.zoneMul.body, headMul: 1, weaponId: from, distance: 0, melee: { stagger: 1.2, push: 0, hitstop: 0 } });
    z.groundY = z.curr.y;
    if (!z.alive) z.fling.copy(vel);
    else {
      z.push.set(vel.x, 0, vel.z);
      z.pushDecay = 0.6;
      z.vel.y = Math.max(z.vel.y, vel.y);
      z.grounded = false;
    }
  }

  stagger(z: Zombie, t: number) {
    if (!z.alive || z.mode === 'climb') return;
    this.releaseToken(z);
    z.mode = 'stagger';
    z.modeT = t;
    z.anim?.oneshot('z_stagger');
  }

  die(z: Zombie, dir: Vector3, melee: boolean) {
    if (!z.alive) return;
    this.releaseToken(z);
    z.mode = 'dead';
    z.deadT = z.def.corpseTime;
    z.hp = 0;
    this.kills++;
    // Fall along the shot direction (ragdoll-lite)
    z.fallDir = Math.atan2(-dir.x, -dir.z) + Math.PI;
    z.capsule.setEnabled(false);
    z.head.setEnabled(false);
    this.ctx.hits.delete(z.capsule.handle);
    this.ctx.hits.delete(z.head.handle);
    this.ctx.sfx('zombie_death', z.curr, { pitchJitter: 0.1 });
    if (z.fling.lengthSq() === 0) this.ctx.fx.bloodPool(z.curr);
    z.anim?.oneshot('z_death', 0.1, true);
    if (melee) this.ctx.game.events.emit('noise', { position: z.curr.clone(), radius: 5, source: 'melee_kill' });
  }

  private releaseToken(z: Zombie) {
    z.token = false;
  }

  private tokensInUse() {
    let n = 0;
    for (const z of this.list) if (z.token) n++;
    return n;
  }

  // ------------------------------------------------------------- sim
  step(dt: number) {
    this.time += dt;
    this.tickN++;
    const p = this.ctx.player;
    const playerTarget = !p.dead;
    const stance = p.crouched ? SN.stanceCrouch : 1;
    const noises = this.noises;
    for (let i = 0; i < this.list.length; i++) {
      const z = this.list[i];
      z.prev.copy(z.curr);
      z.prevYaw = z.yaw;
      if (!z.alive) {
        z.hitstop = Math.max(0, z.hitstop - dt); // a killing blow's hitstop still has to run out
        if (z.fling.lengthSq() > 0) {
          // Ragdoll-lite: thrown bodies fly on a ballistic arc until they hit the ground
          z.fling.y -= 18 * dt;
          z.curr.addScaledVector(z.fling, dt);
          if (z.curr.y <= z.groundY) {
            z.curr.y = z.groundY;
            z.fling.set(0, 0, 0);
            this.ctx.fx.bloodPool(z.curr);
          }
        }
        if ((z.deadT -= dt) <= 0) {
          this.remove(z);
          this.list.splice(i--, 1);
        }
        continue;
      }
      if (HD.passive && (z.sense.awareness !== 'unaware' || z.token)) {
        z.sense.awareness = 'unaware';
        z.sense.suspicion = 0;
        this.releaseToken(z);
        if (z.mode === 'windup') z.mode = 'move';
      }
      // Hitstop: only the target slows down (to 0.05×)
      let zdt = dt;
      if (z.hitstop > 0) {
        z.hitstop -= dt;
        zdt = dt * 0.05;
      }
      z.flinch = Math.max(0, z.flinch - zdt);
      z.headSnap = Math.max(0, z.headSnap - zdt);

      // --- senses
      _to.subVectors(p.curr, z.curr);
      const dist = Math.hypot(_to.x, _to.z);
      if ((z.losT -= dt) <= 0) {
        z.losT = 1 / SN.losHz + (z.id % 6) * 0.004; // staggered across zombies
        z.sight = 0;
        if (playerTarget && !HD.passive && dist < SN.rangeDay) {
          const fwdX = -Math.sin(z.yaw);
          const fwdZ = -Math.cos(z.yaw);
          const cos = (fwdX * _to.x + fwdZ * _to.z) / Math.max(1e-3, dist);
          const ang = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
          const rate = dist < 1.2 ? 4 : Math.max(sightRate(dist, ang, stance, p.speed01), dist < SN.nearRange ? SN.nearRate : 0);
          z.seen = rate > 0 && this.los(z, p.curr, p.eyeHeight - 0.2);
          z.sight = z.seen ? rate : 0;
        } else z.seen = false;
      }
      let heard = false;
      if (!HD.passive)
        for (const n of noises) {
          const d = n.pos.distanceTo(z.curr);
          if (d < n.radius) {
            heard = true;
            // Imprecise for far sounds: the zombie searches around where it came from
            z.lastKnown.copy(n.pos);
            z.lastKnown.x += (this.ctx.rand() - 0.5) * d * 0.1;
            z.lastKnown.z += (this.ctx.rand() - 0.5) * d * 0.1;
          }
        }
      const before = z.sense.awareness;
      updateSenses(z.sense, z.sight, heard && z.sense.awareness !== 'detected', dt);
      if (z.seen) z.lastKnown.copy(p.curr);
      if (z.sense.awareness === 'detected' && before !== 'detected') this.ctx.sfx('zombie_alert', z.curr, { pitchJitter: 0.1 });
      if (!playerTarget && z.sense.awareness === 'detected') {
        z.sense.awareness = 'searching';
        z.sense.searchLeft = 5;
      }

      // --- vocals: always audible (groans 4–10 s)
      if ((z.groanT -= dt) <= 0) {
        z.groanT = HD.groanMin + this.ctx.rand() * (HD.groanMax - HD.groanMin);
        if (z.mode === 'move') this.ctx.sfx('zombie_groan', z.curr, { pitchJitter: 0.12, volume: z.sense.awareness === 'detected' ? 1 : 0.7 });
      }

      this.think(z, zdt, dist);
    }
    noises.length = 0;
  }

  private los(z: Zombie, target: Vector3, h: number) {
    const { R, world } = this.ctx.game.phys;
    const ox = z.curr.x;
    const oy = z.curr.y + (z.crawler ? 0.4 : HEAD_Y * (z.def.scale ?? 1));
    const oz = z.curr.z;
    _w.set(target.x - ox, target.y + h - oy, target.z - oz);
    const d = _w.length();
    _w.divideScalar(d);
    this.ray.origin = _o.set(ox, oy, oz);
    this.ray.dir = _w;
    const hit = world.castRay(this.ray, d - 0.3, true, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.ZOMBIE, LOS_FILTER));
    return !hit;
  }

  private think(z: Zombie, dt: number, dist: number) {
    const p = this.ctx.player;
    const d = z.def;
    _v.set(0, 0, 0); // desired velocity
    let face: Vector3 | null = null;
    z.modeT -= dt;

    switch (z.mode) {
      case 'stagger':
        if (z.modeT <= 0) z.mode = 'move';
        break;
      case 'windup':
        face = p.curr;
        if (z.modeT <= 0) {
          // Strike lands only if still in reach, in front, with no wall between (never through walls)
          const fwdX = -Math.sin(z.yaw);
          const fwdZ = -Math.cos(z.yaw);
          _w.subVectors(p.curr, z.curr);
          const inFront = (fwdX * _w.x + fwdZ * _w.z) / Math.max(1e-3, Math.hypot(_w.x, _w.z)) > 0.4;
          const reach = dist <= d.attackRange + 0.35 && Math.abs(_w.y) < 1.4;
          const miss = p.sprinting && this.ctx.rand() < d.sprintMissChance;
          if (reach && inFront && !miss && this.los(z, p.curr, 1.0) && !this.ctx.melee?.invulnerable) {
            if (p.damage(d.attackDamage, z.curr)) this.ctx.sfx('melee_hit', p.curr, { volume: 0.8 });
          } else this.ctx.sfx('melee_swing', z.curr, { volume: 0.6 });
          z.mode = 'recover';
          z.modeT = d.attackRecover;
        }
        break;
      case 'recover':
        if (z.modeT <= 0) {
          z.mode = 'move';
          this.releaseToken(z);
        }
        break;
      case 'climb': {
        const c = z.climb!;
        c.t += dt / d.climbTime;
        const t = Math.min(1, c.t);
        // Rise first (70 %), then pull over onto the top
        const up = Math.min(1, t / 0.7);
        const over = Math.max(0, (t - 0.7) / 0.3);
        z.curr.set(c.from.x + (c.to.x - c.from.x) * over, c.from.y + (c.to.y - c.from.y) * up, c.from.z + (c.to.z - c.from.z) * over);
        z.body.setNextKinematicTranslation({ x: z.curr.x, y: z.curr.y + z.capY, z: z.curr.z });
        if (t >= 1) {
          z.climb = null;
          z.mode = 'move';
          z.capsule.setEnabled(true);
        }
        return;
      }
      case 'move': {
        const s = z.sense.awareness;
        const speed = z.crawler ? d.crawl : d.chase;
        if (s === 'detected') {
          face = p.curr;
          // Ask for an attack token on approach; holders close in, the rest circle (Doom tokens)
          if (!z.token && dist < d.circleRadius + 1 && this.tokensInUse() < HD.attackTokens) z.token = true;
          if (z.token && dist > d.circleRadius + 3) z.token = false;
          if (dist <= d.attackRange && Math.abs(p.curr.y - z.curr.y) < 1.4) {
            if (z.token && this.time - this.lastWindup >= HD.attackSpacing && !HD.passive) {
              this.lastWindup = this.time;
              // Telegraph: windup with an audio cue ≥ 0.3 s before the hit lands
              z.mode = 'windup';
              z.modeT = d.attackWindup;
              this.ctx.sfx('zombie_attack', z.curr, { pitchJitter: 0.08 });
              z.anim?.oneshot('z_attack');
              break;
            }
          }
          if (!z.token && dist < d.circleRadius + 0.6) {
            // No token: circle at 1.5–2.5 m and growl
            _w.subVectors(z.curr, p.curr).setY(0).normalize();
            const tangent = (z.id & 1 ? 1 : -1) * 0.6;
            _v.set(-_w.z * tangent, 0, _w.x * tangent).addScaledVector(_w, (d.circleRadius - dist) * 1.5);
            if (_v.lengthSq() > speed * speed) _v.setLength(speed);
          } else {
            _v.subVectors(p.curr, z.curr).setY(0);
            if (_v.lengthSq() > 0.01) _v.setLength(speed);
          }
        } else if (s === 'searching') {
          _v.subVectors(z.lastKnown, z.curr).setY(0);
          const dl = _v.length();
          if (dl > 1.5) _v.setLength(speed * 0.8);
          else this.wanderAround(z, z.lastKnown, dt, d.walk);
          face = null;
        } else if (s === 'suspicious') {
          face = z.lastKnown.lengthSq() > 0 ? z.lastKnown : p.curr; // head-turn toward the stimulus
          if (z.seen) z.lastKnown.copy(p.curr);
        } else {
          this.wanderAround(z, z.home, dt, d.walk);
        }
        break;
      }
    }

    // Separation from neighbours (cheap O(n²), n ≤ 30)
    if (z.mode === 'move') {
      for (const o of this.list) {
        if (o === z || !o.alive) continue;
        const dx = z.curr.x - o.curr.x;
        const dz = z.curr.z - o.curr.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.81 && d2 > 1e-6) {
          const k = (0.9 - Math.sqrt(d2)) * 3;
          _v.x += (dx / Math.sqrt(d2)) * k;
          _v.z += (dz / Math.sqrt(d2)) * k;
        }
      }
    }
    // Shove push-back decays over ~0.25 s
    _v.add(z.push);
    z.push.multiplyScalar(Math.max(0, 1 - dt / z.pushDecay));
    if (z.push.lengthSq() < 0.01) z.pushDecay = 0.25;

    // Turn toward travel or the target
    const fx = face ? face.x - z.curr.x : _v.x;
    const fz = face ? face.z - z.curr.z : _v.z;
    if (fx * fx + fz * fz > 1e-4 && z.mode !== 'stagger') {
      const want = Math.atan2(-fx, -fz);
      let dy = want - z.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const maxT = d.turnRate * dt;
      z.yaw += Math.max(-maxT, Math.min(maxT, dy));
    }

    // Integrate with the KCC (gravity always). Zombies > 12 m away move at 30 Hz (every other tick, double step):
    // halves the character-controller cost of a crowd; the 30 Hz steps aren't visible at that range.
    z.vel.x = _v.x;
    z.vel.z = _v.z;
    if (dist > 12 && z.mode === 'move') {
      if ((this.tickN + z.id) & 1) return;
      dt *= 2;
    }
    z.vel.y = Math.max(-20, z.vel.y - 18 * dt);
    _w.set(z.vel.x * dt, z.vel.y * dt, z.vel.z * dt);
    const want = Math.hypot(_w.x, _w.z);
    // Standing still on the ground: skip the character-controller query (most idle zombies)
    if (want < 1e-5 && z.grounded) {
      z.vel.y = 0;
      return;
    }
    const { R } = this.ctx.game.phys;
    this.kcc.computeColliderMovement(z.capsule, _w, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.ZOMBIE, MOVE_FILTER));
    const m = this.kcc.computedMovement();
    z.curr.x += m.x;
    z.curr.y += m.y;
    z.curr.z += m.z;
    z.grounded = this.kcc.computedGrounded();
    if (z.grounded) z.vel.y = 0;
    z.body.setNextKinematicTranslation({ x: z.curr.x, y: z.curr.y + z.capY, z: z.curr.z });
    z.walkPhase += (Math.hypot(m.x, m.z) / 0.7) * Math.PI;

    // Blocked while chasing/searching: climb onto vehicles and low walls (anti-cheese), 1.5–2 s
    if (z.mode === 'move' && want > 0.005 && Math.hypot(m.x, m.z) < want * 0.3 && z.sense.awareness !== 'unaware') {
      z.stuckT += dt;
      if (z.stuckT > 0.4) this.tryClimb(z);
    } else z.stuckT = 0;
  }

  private wanderAround(z: Zombie, center: Vector3, dt: number, _speed: number) {
    if ((z.wanderT -= dt) <= 0) {
      z.wanderT = 4 + this.ctx.rand() * 4;
      const a = this.ctx.rand() * Math.PI * 2;
      const r = 1 + this.ctx.rand() * 3;
      z.wander.set(center.x + Math.cos(a) * r, z.curr.y, center.z + Math.sin(a) * r);
    }
    if (z.wander.distanceToSquared(z.curr) > 0.25) _v.subVectors(z.wander, z.curr).setY(0).setLength(z.def.walk);
  }

  private tryClimb(z: Zombie) {
    z.stuckT = 0;
    const { R, world } = this.ctx.game.phys;
    const fx = -Math.sin(z.yaw);
    const fz = -Math.cos(z.yaw);
    const px = z.curr.x + fx * 0.75;
    const pz = z.curr.z + fz * 0.75;
    const top = z.curr.y + z.def.climbMax + 0.3;
    const hit = world.castRay(new R.Ray({ x: px, y: top, z: pz }, { x: 0, y: -1, z: 0 }), z.def.climbMax + 0.3, true, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.ZOMBIE, LOS_FILTER));
    if (!hit) return;
    const h = top - hit.timeOfImpact - z.curr.y;
    if (h < 0.4 || h > z.def.climbMax) return;
    // Room to stand on top?
    const room = world.castRay(new R.Ray({ x: px, y: z.curr.y + h + 0.05, z: pz }, { x: 0, y: 1, z: 0 }), 1.6, true, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.ZOMBIE, LOS_FILTER));
    if (room) return;
    z.mode = 'climb';
    z.capsule.setEnabled(false);
    z.climb = { from: z.curr.clone(), to: new Vector3(px + fx * 0.2, z.curr.y + h + 0.03, pz + fz * 0.2), t: 0 };
    this.ctx.sfx('zombie_groan', z.curr, { volume: 0.8 });
  }

  private crowds = new Map<string, Promise<Crowd | null>>();
  /** One engine crowd per variant model; null (fallback path) if not built or the bake has no clips yet. */
  private crowdFor(def: ZombieDef): Promise<Crowd | null> {
    let p = this.crowds.get(def.model);
    if (!p) {
      const opts = { max: 32, clipsFrom: def.clipsFrom } as Parameters<typeof createCrowd>[2];
      p = createCrowd(this.ctx.game, def.model, opts)
        .then((c) => (c && c.clips.length ? c : null))
        .catch((e) => {
          console.warn('crowd', def.model, e);
          return null;
        });
      this.crowds.set(def.model, p);
    }
    return p;
  }

  /** Crowd-instanced zombie: clip choice + whole-body tilt reactions (no bone offsets on the GPU path). */
  private renderCrowd(z: Zombie, alpha: number, li: number, show: boolean) {
    const a = z.anim as CrowdAnim;
    const ch = z.ch;
    let dy = z.yaw - z.prevYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const yaw = z.alive ? z.prevYaw + dy * alpha : z.fallDir;
    ch.root.rotation.set(0, yaw, 0);
    const sp = Math.hypot(z.curr.x - z.prev.x, z.curr.z - z.prev.z) * 60;
    if (z.alive) {
      const clip = z.crawler ? 'z_crawl' : sp > 2.6 ? 'z_run' : sp > 0.1 ? 'z_walk' : 'z_idle';
      a.base(clip, 0.25, clip === 'z_walk' ? Math.min(1.6, Math.max(0.6, sp / 1.0)) : 1);
    }
    a.update();
    const p = ch.root.position;
    a.crowd.set(a.i, p.x, p.y, p.z, yaw);
    a.crowd.setSpeed(a.i, z.hitstop > 0 ? 0.05 : 1);
    const flinch = z.flinch > 0 ? Math.sin(z.flinch * 40) * z.flinch * 0.6 : 0;
    a.crowd.setTilt(a.i, z.alive ? z.headSnap * 0.8 + (z.mode === 'stagger' ? 0.18 : 0) : 0, flinch);
    if (show && z.alive && li < 30) li = this.senseLines(z, li);
    return li;
  }

  /** Senses debug: vision cone edges + LOS line + suspicion bar, coloured by state. */
  private senseLines(z: Zombie, li: number) {
    const ch = z.ch;
    const col = z.sense.awareness === 'detected' ? [1, 0.15, 0.1] : z.sense.awareness === 'suspicious' ? [1, 0.8, 0.1] : z.sense.awareness === 'searching' ? [1, 0.5, 0.1] : [0.3, 0.9, 0.4];
    const o = ch.root.position;
    const half = (SN.coneDeg / 2) * (Math.PI / 180);
    const r = SN.rangeDay * (0.2 + 0.8 * z.sense.suspicion);
    const yaw = ch.root.rotation.y;
    const base = li * 24;
    const seg = (k: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, c = col) => {
      this.linePos.set([ax, ay, az, bx, by, bz], base + k * 6);
      this.lineCol.set([...c, ...c], base + k * 6);
    };
    const y = o.y + 1.6;
    seg(0, o.x, y, o.z, o.x - Math.sin(yaw + half) * r, y, o.z - Math.cos(yaw + half) * r);
    seg(1, o.x, y, o.z, o.x - Math.sin(yaw - half) * r, y, o.z - Math.cos(yaw - half) * r);
    const p = this.ctx.player.position;
    if (z.seen) seg(2, o.x, y, o.z, p.x, p.y + 1.4, p.z, [1, 1, 1]);
    else seg(2, 0, -100, 0, 0, -100, 0);
    // suspicion bar above head
    seg(3, o.x - 0.4, o.y + 2.05, o.z, o.x - 0.4 + 0.8 * z.sense.suspicion, o.y + 2.05, o.z);
    return li + 1;
  }

  // ------------------------------------------------------------- render
  render(alpha: number, dt: number) {
    let li = 0;
    const show = HD.showSenses;
    const cam = this.ctx.game.camera;
    _proj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_proj);
    for (const z of this.list) {
      const ch = z.ch;
      ch.root.position.lerpVectors(z.prev, z.curr, alpha);
      if (z.anim instanceof CrowdAnim) {
        li = this.renderCrowd(z, alpha, li, show);
        continue;
      }
      // Skinned meshes aren't frustum-culled by the engine (bind-pose bounds), so cull per zombie here;
      // shadows only up close, animation rate by distance (principles §13: full < 20 m, 15 fps < 60 m, 7.5 fps beyond)
      _sphere.center.copy(ch.root.position).setY(ch.root.position.y + 0.9);
      const onScreen = _frustum.intersectsSphere(_sphere);
      const camDist = cam.position.distanceTo(_sphere.center);
      ch.root.visible = onScreen || camDist < 4; // near ones still cast shadows into view
      if (z.shadow !== camDist < HD.shadowDist) {
        z.shadow = camDist < HD.shadowDist;
        ch.root.traverse((o) => (o.castShadow = z.shadow));
      }
      const animStep = !onScreen ? 0 : camDist < 20 ? 0 : camDist < 60 ? 1 / 15 : 1 / 7.5;
      let dy = z.yaw - z.prevYaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      ch.root.rotation.set(0, z.prevYaw + dy * alpha, 0, 'YXZ');
      const pose = ch.pose;
      const sp = Math.hypot(z.curr.x - z.prev.x, z.curr.z - z.prev.z) * 60;
      const rdt = z.hitstop > 0 ? dt * 0.05 : dt;
      pose.walkPhase = z.walkPhase;
      pose.speed01 = Math.min(1, sp / 1.2);
      pose.hold = 'none';
      const reach = z.sense.awareness === 'detected' ? 0.75 : 0;
      const wind = z.mode === 'windup' ? 1 - z.modeT / z.def.attackWindup : 0;
      pose.armRaise += ((z.mode === 'windup' ? 1 : z.mode === 'recover' ? 0.3 : reach) - pose.armRaise) * Math.min(1, rdt * 10);
      pose.lean = z.mode === 'windup' ? -0.25 + wind * 0.6 : z.mode === 'recover' ? 0.35 : z.mode === 'stagger' ? -0.45 : 0.18;
      pose.headBack = z.headSnap > 0 ? z.headSnap * 3 : 0;
      pose.flinch = z.flinch > 0 ? Math.sin(z.flinch * 40) * z.flinch * 2 : 0;
      pose.crouch = z.crawler ? 1 : 0;
      if (z.crawler) pose.lean = 1.2;
      if (!z.alive) {
        pose.fall = Math.min(1, pose.fall + rdt * 2.5);
        ch.root.rotation.set(0, z.fallDir, 0, 'YXZ');
        if (!z.anim) ch.root.rotateX(-pose.fall * 1.5); // placeholder topple; skinned plays z_death
      } else pose.fall = 0;
      if (z.anim) {
        const clip = !z.alive ? '' : z.crawler ? 'z_crawl' : sp > 2.6 ? 'z_run' : sp > 0.1 ? 'z_walk' : 'z_idle';
        if (clip) z.anim.base(clip, 0.25, clip === 'z_walk' ? Math.min(1.6, Math.max(0.6, sp / 1.0)) : 1);
        z.lastClip = clip;
        z.animAcc += rdt;
        if (onScreen && z.animAcc >= animStep) {
          z.anim.update(z.animAcc);
          z.animAcc = 0;
        } else z.anim.restoreBones();
        // Procedural reactions on top of the clips: headshot snap, flinch twist, telegraph lean
        z.bones ??= { head: z.anim.bone('head'), spine: z.anim.bone('spine') };
        if (z.bones.head && z.headSnap > 0) z.bones.head.rotation.x -= z.headSnap * 3;
        if (z.bones.spine) {
          z.bones.spine.rotation.y += pose.flinch;
          if (z.mode === 'stagger') z.bones.spine.rotation.x -= 0.35;
        }
      } else applyPose(ch);
      if (show && z.alive && li < 30) li = this.senseLines(z, li);
    }
    this.lines.visible = show;
    if (show) {
      this.linePos.fill(0, li * 24);
      this.lines.geometry.attributes.position.needsUpdate = true;
      this.lines.geometry.attributes.color.needsUpdate = true;
      this.lines.geometry.setDrawRange(0, li * 8);
    }
  }
}

declare module '../ctx' {
  interface Ctx {
    zombies: Zombies;
  }
}
