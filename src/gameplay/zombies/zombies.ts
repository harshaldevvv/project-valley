import { BufferAttribute, BufferGeometry, Frustum, LineBasicMaterial, LineSegments, Matrix4, Object3D, Sphere, Vector3 } from 'three';
import type { Collider, KinematicCharacterController, RigidBody } from '@dimforge/rapier3d-compat';
import { Group, groups } from '../../engine/physics';
import { aiLod as LOD, crawlClips as CC, deathFall as DF, doorBash as DB, hitReact as HR, horde as HD, senses as SN, steer as ST, zombieDefs, zombieMix, type ZombieDef } from '../../content/data/zombies';
import { flashlightControl } from '../../engine/flashlight';
import { doorHandles, type DoorHandle } from '../../world/yard/doors';
import { hasAsset } from '../../engine/assets';
import { fxTuning } from '../../content/data/fx';
import { anim as A, clipMeta } from '../../content/data/anim';
const ZM = clipMeta.zmb_shambler_a;
import { surfaceOf } from '../../world/surfaces';
import { vehicleText } from '../../content/text/vehicles';
import { yard } from '../../content/data/yard';
import { yardSpawns } from '../../world/yard/spawns';
import { POI_SPAWN, poiZombieZones } from '../../content/data/pois';
import { footprints } from '../../world/outskirts/footprints';
import type { Ctx, HitInfo, HitResult, Hittable, Zone } from '../ctx';
import { AnimationController, applyPose, makeCharacter, newPose, type Character } from '../animstand/character';
import { createCrowd, type Crowd } from '../../engine/crowd';
import { CrowdAnim } from './crowdAnim';
import { HordeNight } from './hordeNight';
import { newSenseState, sightRate, updateSenses, type SenseState } from './senses';
import { ARCH_AI } from '../../content/data/zombie_arch';
import { chaseMul, hearingMul, pickArchetype, spawnHp, suspicionMul, windupMul, zoneCount } from './archetypes';

/**
 * Shamblers (principles §4 reaction ladder, §6 senses/tokens/telegraphs/anti-cheese).
 * Kinematic capsule (+ head sensor) moved by a Rapier KCC with direct steering + separation (no navmesh in M1).
 */
const MOVE_FILTER = Group.STATIC | Group.TERRAIN | Group.VEHICLE | Group.BUILD | Group.PLAYER;
const LOS_FILTER = Group.STATIC | Group.TERRAIN | Group.BUILD | Group.VEHICLE;
const CAPSULE_HH = 0.45;
const CAPSULE_R = 0.3;
const HEAD_Y = 1.62;

type Mode = 'move' | 'windup' | 'recover' | 'stagger' | 'climb' | 'scream' | 'charge_windup' | 'charge' | 'bash' | 'dead';
const STEER_FILTER = Group.STATIC | Group.BUILD | Group.VEHICLE;
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const _v = new Vector3();
const _w = new Vector3();
const _to = new Vector3();
const _o = new Vector3();
const _tg = new Vector3();
const _kt = new Vector3(); // kinematic translation scratch (no per-call object)
const seeThrough = (c: Collider) => (surfaceOf(c.handle) as string | null) !== 'chainlink';
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
  flash = 0; // seconds of white hit flash left
  flinch = 0;
  headSnap = 0;
  /** Location flinch (crowd bend): peak pitch/roll/twist, pivot and hit height, start time and length (sim s). */
  bend = { pitch: 0, roll: 0, twist: 0, pivot: 0, hitY: 0, at: -9, dur: 0.2 };
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
  gait = { walk: 'z_walk', run: 'z_run', idle: 'z_idle', k: 1 };
  walkSpeed = 0.5;
  settled = false;
  headKill = false;
  /** Screamer: seconds until it can scream again. */
  screamCd = 0;
  /** Heard a noise: head-turn time left before it moves, and whether it was loud enough to come at a run. */
  reactT = 0;
  urgent = false;
  /** Obstacle steering: next whisker check, chosen swerve (rad), the eased one, preferred side and how long it is kept. */
  steerT = 0;
  swerve = 0;
  swerveNow = 0;
  side = 0;
  sideT = 0;
  blockedT = 0;
  /** Attack windup length this swing (off-view swings are longer). */
  windupLen = 0.6;
  /** Brute charge: cooldown, locked direction, metres left. */
  chargeCd = 0;
  readonly chargeDir = new Vector3();
  chargeLeft = 0;
  /** Door being bashed; heading for a doorway this step. */
  door: DoorHandle | null = null;
  viaDoor = false;
  /** Capsule centre above the feet (scaled per variant). */
  get capY() {
    return CAPSULE_HH * (this.def.scale ?? 1) + CAPSULE_R;
  }
  readonly fling = new Vector3();
  groundY = 0;
  lastCarHit = -9;
  /** Thrown corpse tumble: one head-over-heels flip spread over the predicted air time (s elapsed, s total). */
  spinT = 0;
  spinDur = 0;
  pushDecay = 0.25;
  grounded = false;
  animAcc = 0;
  shadow = true;
  /** AI level of detail (data aiLod): ticks until the next think, dt summed meanwhile, the current think/move rates, and the
   *  planned per-tick move (and turn) followed between move queries. */
  /** Body and colliders freed (Zombies.remove ran). */
  removed = false;
  thinkWait = 0;
  lodAcc = 0;
  thinkEvery = 1;
  kccEvery = 1;
  readonly glide = new Vector3();
  glideN = 0;
  yawGlide = 0;
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
  private doorHits = new Map<DoorHandle, number>();
  private time = 0;
  private lines: LineSegments;
  private linePos = new Float32Array(30 * 8 * 3);
  private lineCol = new Float32Array(30 * 8 * 3);
  kills = 0;
  /** Player knocked down by a brute: seconds left, and whether this module set `locked` (so it only clears its own). */
  private knockT = 0;
  private knockLocked = false;
  /** Horde night lite (hordeNight.ts): streaming zone spawns pause while it is on. */
  hordeOn = false;
  horde!: HordeNight;
  private lastWindup = -9;
  /** When the last swing lands (sim s): swings are spaced by when they land, not only when they start. */
  private lastLand = -9;
  /** Doors in the world (for audits). */
  get doors() {
    return doorHandles;
  }
  private bags = new Map<string, string[]>();
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
    this.horde = new HordeNight(ctx, this);
  }

  /** Remove one zombie now (dawn burns the horde off). */
  dismiss(z: Zombie) {
    this.remove(z);
    const k = this.list.indexOf(z);
    if (k >= 0) this.list.splice(k, 1);
  }

  get alive() {
    let n = 0;
    for (const z of this.list) if (z.alive) n++;
    return n;
  }

  /** 0 day .. 1 night, from the engine clock (0 when there is none, as in tests). */
  night01() {
    try {
      return this.ctx.game.time.night;
    } catch {
      return 0;
    }
  }

  /** The brute's hit: no control for a moment and a heavy camera kick. */
  private knockPlayer(seconds: number) {
    const p = this.ctx.player;
    this.knockT = Math.max(this.knockT, seconds);
    if (!p.locked) {
      p.locked = true;
      this.knockLocked = true;
    }
    this.ctx.rig.trauma = Math.max(this.ctx.rig.trauma, ARCH_AI.brute.trauma);
    this.ctx.rig.kick(6, 5);
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


  /** Streaming outskirts population (data/pois.ts zones + POI_SPAWN): fills zones near the player out of sight, empties far ones. */
  private poiZones = poiZombieZones.map((z) => ({ ...z, list: [] as Zombie[], killed: 0, cool: 0 }));
  private poiT = 0;
  private poiBusy = false;
  private poiFrustum = new Frustum();
  private poiM = new Matrix4();
  private poiInv = new Matrix4();
  private poiS = new Sphere(new Vector3(), 2.5);
  /** Zombies of the outskirts zones alive right now (for tests and the perf overlay). */
  get poiAlive() {
    let n = 0;
    for (const z of this.poiZones) for (const q of z.list) if (q.alive) n++;
    return n;
  }
  updatePoiSpawns(dt: number) {
    if (this.hordeOn) return;
    this.poiT += dt;
    if (this.poiT < POI_SPAWN.interval) return;
    this.poiT = 0;
    const p = this.ctx.player;
    if (p.dead) return;
    const px = p.curr.x, pz = p.curr.z;
    for (const zone of this.poiZones) {
      zone.list = zone.list.filter((q) => {
        if (q.alive) return true;
        zone.killed++;
        return false;
      });
      if (zone.cool > 0) zone.cool -= POI_SPAWN.interval;
      const d = Math.hypot(zone.x - px, zone.z - pz);
      if (d > POI_SPAWN.despawn) {
        for (const q of zone.list) {
          this.remove(q);
          const k = this.list.indexOf(q);
          if (k >= 0) this.list.splice(k, 1);
        }
        zone.list = [];
        if (zone.killed > 0) { zone.cool = POI_SPAWN.respawnS; zone.killed = 0; } // cleared zones refill after a while
      }
    }
    if (this.poiBusy) return;
    const cam = this.ctx.game.camera;
    cam.updateMatrixWorld();
    this.poiFrustum.setFromProjectionMatrix(this.poiM.multiplyMatrices(cam.projectionMatrix, this.poiInv.copy(cam.matrixWorld).invert())); // fresh inverse: the renderer's copy is a frame old after a teleport
    const dist = (zn: { x: number; z: number }) => Math.hypot(zn.x - px, zn.z - pz);
    const night = this.night01();
    const want = (zn: { count: number; tier: number }) => zoneCount(zn.count * (POI_SPAWN.tierScale[zn.tier] ?? 1), night); // fewer by day, more at night
    if (this.alive >= HD.maxAlive || this.poiAlive >= POI_SPAWN.cap) {
      // full: free the farthest populated zone (out of sight) for a nearer one that is short of zombies
      const needy = this.poiZones.filter((zn) => zn.cool <= 0 && dist(zn) < POI_SPAWN.activate + zn.radius && zn.list.length + zn.killed < want(zn)).sort((a, b) => dist(a) - dist(b))[0];
      const far = this.poiZones.filter((zn) => zn.list.length && (!needy || dist(zn) > dist(needy) + 40) && !zn.list.some((q) => { this.poiS.center.set(q.curr.x, q.curr.y + 1, q.curr.z); return this.poiFrustum.intersectsSphere(this.poiS); })).sort((a, b) => dist(b) - dist(a))[0];
      if (needy && far) {
        for (const q of far.list) { this.remove(q); const k = this.list.indexOf(q); if (k >= 0) this.list.splice(k, 1); }
        far.list = [];
      }
      return;
    }
    for (const zone of this.poiZones) {
      if (zone.cool > 0 || Math.hypot(zone.x - px, zone.z - pz) > POI_SPAWN.activate + zone.radius) continue;
      if (zone.list.length + zone.killed >= want(zone)) continue;
      for (let tries = 0; tries < 12; tries++) {
        const a = this.ctx.rand() * Math.PI * 2, r = Math.sqrt(this.ctx.rand()) * zone.radius;
        const x = zone.x + Math.cos(a) * r, z = zone.z + Math.sin(a) * r;
        if (Math.hypot(x - px, z - pz) < POI_SPAWN.minFromPlayer) continue;
        if (zone.radius > 3 && footprints.some((f) => Math.hypot(x - f.x, z - f.z) < f.r)) continue; // not inside a prop; the small zones are inside buildings on purpose
        this.poiS.center.set(x, 1, z);
        if (this.poiFrustum.intersectsSphere(this.poiS)) continue; // never pop in view
        this.poiBusy = true;
        const soldier = zone.soldier && this.ctx.rand() < zone.soldier && hasAsset(zombieDefs.pfz_soldier?.model ?? '') ? 'pfz_soldier' : null; // army sites: dead soldiers
        this.spawn(new Vector3(x, 0.05, z), this.ctx.rand() * Math.PI * 2, soldier ?? this.pickVariant(zone.tier, night))
          .then((zb) => zone.list.push(zb))
          .catch(() => undefined)
          .finally(() => (this.poiBusy = false));
        return; // one per check keeps the frame cost flat
      }
    }
  }

  /** Weighted variant from data/zombies zombieMix (seeded RNG); variants whose model isn't built fall back to the shambler. */
  pickVariant(tier = 1, night = this.night01()) {
    // a special archetype first (data/zombie_arch.ts ARCH_SPAWN: by tier and time of day), if its model is built
    const special = pickArchetype(this.ctx.rand(), tier, night);
    if (special && hasAsset(zombieDefs[special]?.model ?? '')) return special;
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
      R.ColliderDesc.ball(0.15 * s).setTranslation(0, (def.headY ?? HEAD_Y) * s - capY, 0).setSensor(true).setCollisionGroups(groups(Group.ZOMBIE, 0xffff)),
      body,
    );
    const z = new Zombie(this.nextId++, def, ch, body, capsule, head, HD.groanMin + this.ctx.rand() * (HD.groanMax - HD.groanMin));
    // Gait variety (mocap pools): one walk/run/idle per zombie + a playback factor; movement speeds follow the clips
    // QA-093: shuffle bags per pool, so a batch covers the gaits evenly before any repeats
    const pick = (pool: string[]) => {
      const key = pool.join();
      let bag = this.bags.get(key);
      if (!bag?.length) {
        bag = [...pool];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.ctx.rand() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        this.bags.set(key, bag);
      }
      return bag.pop()!;
    };
    const has = (c: string) => ch.clips.includes(c) || ch.actions.has(c);
    const walks = A.zombieWalks.filter(has);
    const runs = A.zombieRuns.filter(has);
    const idles = A.zombieIdles.filter(has);
    z.gait.walk = walks.length ? pick(walks) : 'z_walk';
    z.gait.run = runs.length ? pick(runs) : 'z_run';
    z.gait.idle = idles.length ? pick(idles) : 'z_idle';
    z.gait.k = A.zombieTimeScale[0] + this.ctx.rand() * (A.zombieTimeScale[1] - A.zombieTimeScale[0]);
    z.walkSpeed = (ZM[z.gait.walk]?.speed ?? def.walk) * z.gait.k;
    z.hp = spawnHp(def.hp, this.night01()); // tougher by day
    if (def.startsCrawling) z.crawler = true;
    z.curr.copy(at);
    z.prev.copy(at);
    z.home.copy(at);
    z.wander.copy(at);
    z.yaw = z.prevYaw = yaw;
    z.thinkWait = z.id % 3; // a batch spawned together doesn't think on the same ticks
    if (ca) z.anim = ca;
    this.list.push(z);
    const hittable: Hittable = {
      kind: 'zombie',
      surface: 'flesh',
      zone: (c: Collider, p: Vector3): Zone => {
        if (c === z.head) return 'head';
        // The body capsule overlaps and shadows the lower half of the head ball: a capsule hit within the head's height band is a head hit
        if (z.alive && Math.abs(p.y - (z.curr.y + (def.headY ?? HEAD_Y) * s)) <= 0.14 * s) return 'head'; // the capsule is wider than the head: judge by height
        return p.y - z.curr.y < (z.crawler ? 0.3 : 0.85 * s) ? 'limb' : 'body';
      },
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
    for (const zn of this.poiZones) zn.list = []; // else walking away from the zone later removes these bodies again
  }

  private remove(z: Zombie) {
    // Twice would panic Rapier (removeRigidBody on a freed handle), which poisons the physics world for the session
    if (z.removed) return;
    z.removed = true;
    const { world } = this.ctx.game.phys;
    this.ctx.hits.delete(z.capsule.handle);
    this.ctx.hits.delete(z.head.handle);
    if (z.settled) this.ctx.game.events.emit('corpseRemoved', { id: z.id });
    world.removeRigidBody(z.body);
    z.ch.root.removeFromParent();
    if (z.anim instanceof CrowdAnim) z.anim.crowd.remove(z.anim.i);
  }

  // ------------------------------------------------------------- damage
  damage(z: Zombie, info: HitInfo): HitResult | null {
    if (!z.alive) return null;
    const mul = info.zone === 'head' ? info.headMul * (z.def.helmetMul ?? 1) : z.def.zoneMul[info.zone];
    const dmg = info.damage * mul;
    z.hp -= dmg;
    z.dmgLog.push({ t: this.time, amt: dmg });
    if (z.dmgLog.length > 12) z.dmgLog.shift();
    z.flinch = z.def.flinchTime;
    if (info.zone === 'head') z.headSnap = 0.25;
    this.hitBend(z, info);
    if (info.zone === 'limb') {
      z.legHp -= dmg;
      if (!z.crawler && z.legHp <= z.def.legHp * 0.5) {
        z.crawler = true;
        this.ctx.sfx('zombie_hurt', z.curr);
      }
    }
    z.flash = 0.11; // every hit (bullet or melee) flashes the body white
    if (info.melee) z.hitstop = Math.max(z.hitstop, z.hp <= 0 ? info.melee.hitstop * 2.5 : info.melee.hitstop);
    // Being shot from afar: turn toward the shooter and go looking (anti-sniping cheese), never instant detection.
    if (z.sense.awareness !== 'detected' && !HD.passive) {
      z.lastKnown.copy(this.ctx.player.curr);
      z.sense.awareness = 'searching';
      z.sense.searchLeft = SN.searchS;
      z.sense.suspicion = Math.max(z.sense.suspicion, 0.8);
    }
    if (z.hp <= 0) {
      if (info.zone === 'head' && !info.melee) {
        // Headshot kill: crunch, skull marker (HUD reads res.headKill), head gore pop, instant drop
        this.ctx.sfx('hit_head', info.point, { volume: 1 });
        this.ctx.sfx('melee_hit', info.point, { volume: 0.8, pitchJitter: 0.15 });
        this.ctx.fx.impact(info.point, _o.copy(info.dir).negate().setY(0.6).normalize(), 'flesh', info.dir, fxTuning.headPopScale);
        z.headKill = true;
      }
      // Death reactions: a heavy body or leg hit from a gun blows the corpse backwards off its feet (short ballistic hop,
      // the same ragdoll-lite as car hits); headshots just drop (instant, no hop).
      if (!info.melee && !z.headKill && info.damage >= 30 && info.distance < 14 && this.ctx.rand() < 0.75) {
        z.fling.set(info.dir.x, 0, info.dir.z).setLength(2.6 + this.ctx.rand() * 1.6);
        z.fling.y = 1.6 + this.ctx.rand() * 1.0;
      }
      this.die(z, info.dir, !!info.melee);
      return { damage: dmg, kill: true, zone: info.zone };
    }
    this.ctx.sfx('zombie_hurt', z.curr, { pitchJitter: 0.1, volume: 0.7 });
    // A heavy bullet that does not kill still shoves the zombie back a step
    if (!info.melee && info.damage >= 30) z.push.copy(info.dir).setY(0).normalize().multiplyScalar(5 + this.ctx.rand() * 3);
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

  /** Location flinch: bend above the zone's pivot along the shot (model space), twist from an off-centre hit. */
  private hitBend(z: Zombie, info: HitInfo) {
    const hy = info.point.y - z.curr.y;
    const leg = info.zone === 'limb' && hy < HR.legBelow;
    const k = info.zone === 'head' ? HR.head : leg ? HR.leg : info.zone === 'limb' ? HR.arm : HR.body;
    const s = info.melee ? HR.meleeStrength : Math.min(HR.strength[1], Math.max(HR.strength[0], info.damage / HR.dmgRef));
    // shot direction in the model's frame (the crowd shader's yaw, inverted); +z local = toward the zombie's back
    const cy = Math.cos(z.yaw), sy = Math.sin(z.yaw);
    const lx = info.dir.x * cy - info.dir.z * sy;
    const lz = info.dir.x * sy + info.dir.z * cy;
    const b = z.bend;
    const rx = info.point.x - z.curr.x, rz = info.point.z - z.curr.z;
    b.pitch = k.pitch * s * lz;
    // sideways: pushed along the shot; a leg hit sags toward the hit leg instead (roll + moves the top toward -x)
    b.roll = leg ? -HR.leg.roll * s * Math.sign(rx * cy - rz * sy || 1) : -Math.abs(k.pitch) * s * lx;
    const tq = (rz * info.dir.x - rx * info.dir.z) * HR.twist * s;
    b.twist = info.zone === 'head' || leg ? 0 : Math.max(-HR.twistMax, Math.min(HR.twistMax, tq));
    b.pivot = k.pivot * (z.def.scale ?? 1);
    b.hitY = Math.max(0.05, hy);
    b.at = this.time;
    b.dur = k.dur;
  }

  /** Hit by a car (or thrown): damage by speed, then thrown along `vel` (m/s); dead ones fly as a ragdoll-lite. */
  fling(z: Zombie, vel: Vector3, damage: number, from: string) {
    if (!z.alive || this.time - z.lastCarHit < 0.5) return;
    z.lastCarHit = this.time;
    _w.copy(z.curr).setY(z.curr.y + 1);
    _o.copy(vel).normalize();
    this.damage(z, { point: _w, dir: _o, zone: 'body', damage: damage / z.def.zoneMul.body, headMul: 1, weaponId: from, distance: 0, melee: { stagger: 1.2, push: 0, hitstop: 0 } });
    z.groundY = z.curr.y;
    if (!z.alive) {
      z.fling.copy(vel);
      z.spinT = 0;
      z.spinDur = vel.y > 3 ? (2 * vel.y) / 18 : 0; // ballistic air time at the fling gravity below; small throws don't flip
    }
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
    if (z.crawler) z.anim?.oneshot(CC.stagger, 0.15, false, 0, CC.staggerSpeed);
    else z.anim?.oneshot('z_stagger');
  }

  die(z: Zombie, dir: Vector3, melee: boolean, quiet = false) {
    if (!z.alive) return;
    this.releaseToken(z);
    z.mode = 'dead';
    z.deadT = z.def.corpseTime;
    // Corpse cap: the oldest goes first
    let corpses = 0;
    let oldest: Zombie | null = null;
    for (const o of this.list) {
      if (o.alive || o === z || o.deadT <= 0) continue;
      corpses++;
      if (!oldest || o.deadT < oldest.deadT) oldest = o;
    }
    if (oldest && corpses >= HD.maxCorpses) oldest.deadT = 0;
    z.hp = 0;
    this.kills++;
    // Fall along the shot direction (ragdoll-lite)
    z.fallDir = z.crawler ? z.yaw : Math.atan2(-dir.x, -dir.z) + Math.PI; // a crawler is already lying along its heading
    z.capsule.setEnabled(false);
    z.head.setEnabled(false);
    this.ctx.hits.delete(z.capsule.handle);
    this.ctx.hits.delete(z.head.handle);
    if (!quiet) this.ctx.sfx('zombie_death', z.curr, { pitchJitter: 0.1 });
    if (z.fling.lengthSq() === 0) this.groundPool(this.torso(z, _o)); // under the torso, not the feet
    if (z.crawler) z.anim?.oneshot(CC.death, 0.15, true, CC.deathHoldAt, CC.deathSpeed); // already prone: stop crawling where it lies
    else z.anim?.oneshot('z_death', z.headKill ? 0.04 : 0.1, true, z.def.deathHoldAt, z.headKill ? fxTuning.headKillDeathSpeed : z.fling.lengthSq() > 0 ? DF.flungSpeed : DF.speed[0] + this.ctx.rand() * (DF.speed[1] - DF.speed[0])); // each fall plays at its own speed
    if (melee) this.ctx.game.events.emit('noise', { position: z.curr.clone(), radius: 5, source: 'melee_kill' });
  }

  /** Torso point of a corpse (it falls along fallDir; the feet stay at curr). */
  private torso(z: Zombie, out: Vector3) {
    return out.set(z.curr.x - Math.sin(z.fallDir) * 0.75, z.curr.y, z.curr.z - Math.cos(z.fallDir) * 0.75);
  }

  /** Blood pool only on roughly flat ground: centre + 4 points 0.35 m out must agree in height (QA-044). */
  private groundPool(at: Vector3) {
    const { R, world } = this.ctx.game.phys;
    const filt = groups(Group.ZOMBIE, Group.STATIC | Group.TERRAIN | Group.BUILD);
    let y0 = NaN;
    for (let k = 0; k < 5; k++) {
      const x = at.x + (k === 1 ? 0.35 : k === 2 ? -0.35 : 0);
      const z = at.z + (k === 3 ? 0.35 : k === 4 ? -0.35 : 0);
      const hit = world.castRayAndGetNormal(new R.Ray({ x, y: at.y + 1, z }, { x: 0, y: -1, z: 0 }), 2, true, R.QueryFilterFlags.EXCLUDE_SENSORS, filt);
      if (!hit || hit.normal.y < 0.9) return;
      const y = at.y + 1 - hit.timeOfImpact;
      if (k === 0) y0 = y;
      else if (Math.abs(y - y0) > fxTuning.poolFlatTol) return;
    }
    this.ctx.fx.bloodPool(_tg.set(at.x, y0, at.z));
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
    this.updatePoiSpawns(dt);
    this.horde.step(dt);
    this.time += dt;
    this.tickN++;
    const p = this.ctx.player;
    const playerTarget = !p.dead;
    const stance = p.crouched ? SN.stanceCrouch : 1;
    const noises = this.noises;
    const night = this.night01();
    const lit = flashlightControl.on && night > 0.2 && !p.inVehicle ? night : 0;
    const beamCos = Math.cos((SN.beamHalfDeg * Math.PI) / 180);
    if (this.knockT > 0 && (this.knockT -= dt) <= 0 && this.knockLocked) {
      p.locked = false; // only the lock this module took
      this.knockLocked = false;
    }
    for (let i = 0; i < this.list.length; i++) {
      const z = this.list[i];
      z.prev.copy(z.curr);
      z.prevYaw = z.yaw;
      z.flash = Math.max(0, z.flash - dt);
      if (!z.alive) {
        z.hitstop = Math.max(0, z.hitstop - dt); // a killing blow's hitstop still has to run out
        if (z.fling.lengthSq() > 0) {
          // Ragdoll-lite: thrown bodies fly on a ballistic arc until they hit the ground
          z.fling.y -= 18 * dt;
          z.curr.addScaledVector(z.fling, dt);
          z.spinT += dt;
          if (z.curr.y <= z.groundY) {
            z.curr.y = z.groundY;
            z.fling.set(0, 0, 0);
            this.groundPool(this.torso(z, _o)); // under the torso, not the feet
          }
        }
        // Corpse settled (not flying, death pose held): it becomes a searchable body (systems listens, QA-058)
        if (!z.settled && z.deadT > 0 && z.fling.lengthSq() === 0 && z.def.corpseTime - z.deadT > 1.2) {
          z.settled = true;
          this.torso(z, _o);
          this.ctx.game.events.emit('zombieKilled', { id: z.id, variant: z.def.id, position: _o.clone() });
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
        if (playerTarget && !HD.passive && dist < Math.max(SN.rangeDay, SN.rangeNight * (lit ? SN.lightRangeMul : 1), lit ? SN.beamRange : 0)) {
          const fwdX = -Math.sin(z.yaw);
          const fwdZ = -Math.cos(z.yaw);
          const cos = (fwdX * _to.x + fwdZ * _to.z) / Math.max(1e-3, dist);
          const ang = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
          // a lit lamp at night is seen from further, crouched or not
          const eff = lit ? dist / (1 + (SN.lightRangeMul - 1) * lit) : dist;
          let rate = dist < 1.2 ? 4 : Math.max(sightRate(eff, ang, lit ? 1 : stance, lit ? 1 : p.speed01, night) * suspicionMul(night), dist < SN.nearRange ? SN.nearRate : 0);
          // the beam lands on it: it notices the light whichever way it faces
          if (lit && dist < SN.beamRange && (-Math.sin(p.yaw) * -_to.x + -Math.cos(p.yaw) * -_to.z) / Math.max(1e-3, dist) > beamCos)
            rate = Math.max(rate, SN.beamRate * lit * (1 - (0.5 * dist) / SN.beamRange));
          z.seen = rate > 0 && this.los(z, p.curr, p.eyeHeight - 0.2);
          z.sight = z.seen ? rate : 0;
        } else z.seen = false;
      }
      let heard = false;
      if (!HD.passive)
        for (const n of noises) {
          const d = n.pos.distanceTo(z.curr);
          if (d < n.radius * hearingMul(night)) {
            heard = true;
            if (z.sense.awareness !== 'detected') {
              if (z.sense.awareness === 'unaware' || z.sense.awareness === 'suspicious') z.reactT = SN.hearReact[0] + this.ctx.rand() * (SN.hearReact[1] - SN.hearReact[0]);
              if (n.radius >= 20 && d < n.radius * SN.urgentFrac) z.urgent = true;
            }
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

      // AI level of detail (aiLod): far walkers think every Nth tick with the summed dt; between, they follow their planned move
      // (chargers stay full rate: the charge locks its line from where it stands and faces; rare, one per pack)
      const lodOk = z.mode === 'move' && z.hitstop <= 0 && z.push.lengthSq() === 0 && !z.def.charge;
      const tE = !lodOk || dist < LOD.thinkNearM ? 1 : dist < LOD.thinkFarM ? LOD.midEvery : LOD.farEvery;
      z.thinkEvery = tE;
      z.kccEvery = !lodOk || dist < LOD.kccNearM ? 1 : Math.max(tE, LOD.kccMidEvery);
      z.lodAcc += zdt;
      if (tE > 1 && z.thinkWait > 0) {
        z.thinkWait--;
        z.yaw += z.yawGlide;
        this.glide(z);
        continue;
      }
      z.thinkWait = tE - 1;
      const tdt = z.lodAcc;
      z.lodAcc = 0;
      this.think(z, tdt, dist);
    }
    noises.length = 0;
  }

  /** One tick along the move planned by the last character-controller query (AI level of detail). */
  private glide(z: Zombie) {
    if (z.glideN <= 0 || z.mode !== 'move') {
      z.glideN = 0;
      return;
    }
    z.glideN--;
    z.curr.add(z.glide);
    z.body.setNextKinematicTranslation(_kt.set(z.curr.x, z.curr.y + z.capY, z.curr.z));
    z.walkPhase += (Math.hypot(z.glide.x, z.glide.z) / 0.7) * Math.PI;
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
    const filt = this.ctx.player.inVehicle ? LOS_FILTER & ~Group.VEHICLE : LOS_FILTER; // they see the driver through the glass
    // They see through chain-link (wire mesh), not through walls
    const hit = world.castRay(this.ray, d - 0.3, true, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.ZOMBIE, filt), undefined, undefined, seeThrough);
    return !hit;
  }

  private think(z: Zombie, dt: number, dist: number) {
    const p = this.ctx.player;
    // Driver in a car: the target is the closest point on the car body, the reach is to its surface (QA-050)
    const car = p.inVehicle ? this.ctx.vehicles.driving : null;
    const tgt = car ? _tg : p.curr;
    const rd = car ? this.ctx.vehicles.surfaceDist(car, z.curr, _tg) - CAPSULE_R : dist;
    const d = z.def;
    _v.set(0, 0, 0); // desired velocity
    let face: Vector3 | null = null;
    z.modeT -= dt;
    if (z.screamCd > 0) z.screamCd -= dt;
    if (z.chargeCd > 0) z.chargeCd -= dt;
    z.viaDoor = false;
    let moveSpeed = 0; // the wanted speed this step (charge: wall check after the move)

    switch (z.mode) {
      case 'stagger':
        if (z.modeT <= 0) z.mode = 'move';
        break;
      case 'windup':
        // tracks the player for the first part of the swing, then commits: a late sidestep or backstep dodges it
        if (1 - z.modeT / z.windupLen < HD.windupTrack) face = tgt;
        if (z.modeT <= 0) {
          // Strike lands only if still in reach, in front, with no wall between (never through walls)
          const fwdX = -Math.sin(z.yaw);
          const fwdZ = -Math.cos(z.yaw);
          _w.subVectors(tgt, z.curr);
          const inFront = (fwdX * _w.x + fwdZ * _w.z) / Math.max(1e-3, Math.hypot(_w.x, _w.z)) > 0.4;
          const reach = rd <= d.attackRange + 0.35 && Math.abs(_w.y) < 1.6;
          if (car) {
            // QA-050: zombies beat on the car; once its engine is dead they drag the driver out
            if (reach && inFront) {
              this.ctx.sfx('impact_metal', z.curr, { volume: 0.9, pitchJitter: 0.1 });
              if (car.dead) {
                this.ctx.vehicles.exit();
                this.ctx.game.events.emit('toast', { text: vehicleText.draggedOut });
                if (p.damage(d.attackDamage, z.curr)) this.ctx.survival?.zombieHit(d.attackDamage, 'body');
              } else this.ctx.vehicles.damageCar(car, d.attackDamage * car.def.zombieDamageMul);
            } else this.ctx.sfx('melee_swing', z.curr, { volume: 0.6 });
          } else {
            const miss = p.sprinting && this.ctx.rand() < d.sprintMissChance;
            if (reach && inFront && !miss && this.los(z, p.curr, 1.0) && !this.ctx.melee?.invulnerable) {
              if (p.damage(d.attackDamage, z.curr)) {
                this.ctx.sfx('melee_hit', p.curr, { volume: 0.8 });
                this.ctx.survival?.zombieHit(d.attackDamage, z.crawler ? 'limb' : 'body'); // M2: wounds / infection rolls
                if (d.knockdownS) this.knockPlayer(d.knockdownS); // brute
              }
            } else this.ctx.sfx('melee_swing', z.curr, { volume: 0.6 });
          }
          z.mode = 'recover';
          z.modeT = d.attackRecover * (1 + (this.ctx.rand() * 2 - 1) * HD.recoverJitter); // no lock-step volleys
        }
        break;
      case 'recover':
        if (z.modeT <= 0) {
          z.mode = 'move';
          this.releaseToken(z);
        }
        break;
      case 'scream':
        // Screamer: stands and screams (a telegraph), then everyone in range hears where the player is
        face = tgt;
        if (z.modeT <= 0) {
          const sc = d.scream!;
          this.ctx.sfx('zombie_alert', z.curr, { pitchJitter: 0.05, volume: 1 });
          this.ctx.sfx('zombie_attack', z.curr, { pitchJitter: 0.05, volume: 1 });
          this.ctx.game.events.emit('noise', { position: tgt.clone().setY(0), radius: sc.radius, source: 'scream' });
          z.mode = 'move';
          z.screamCd = sc.cooldownS;
        }
        break;
      case 'charge_windup':
        // Brute: plants its feet and roars (the telegraph), then commits to a straight line
        face = tgt;
        if (z.modeT <= 0) {
          const ch = d.charge!;
          z.chargeDir.subVectors(tgt, z.curr).setY(0).normalize();
          z.chargeLeft = Math.min(ch.maxDist, dist + 3);
          z.mode = 'charge';
          z.modeT = 0;
          this.ctx.sfx('zombie_attack', z.curr, { pitchJitter: 0.05, volume: 1 });
        }
        break;
      case 'charge': {
        const ch = d.charge!;
        moveSpeed = ch.speed;
        _v.copy(z.chargeDir).multiplyScalar(ch.speed);
        face = _tg.copy(z.curr).add(z.chargeDir);
        _w.subVectors(p.curr, z.curr);
        const ahead = _w.x * z.chargeDir.x + _w.z * z.chargeDir.z;
        const side = Math.abs(_w.x * z.chargeDir.z - _w.z * z.chargeDir.x);
        if (!car && !p.dead && ahead > -0.2 && ahead < 1.3 && side < 0.85 && Math.abs(_w.y) < 1.4) {
          // ran into the player
          if (!this.ctx.melee?.invulnerable && p.damage(ch.damage, z.curr)) {
            this.ctx.sfx('melee_hit', p.curr, { volume: 1 });
            this.ctx.survival?.zombieHit(ch.damage, 'body');
            this.knockPlayer(d.knockdownS ?? 0.9);
          }
          z.mode = 'recover';
          z.modeT = ch.recoverS;
          _v.set(0, 0, 0);
          break;
        }
        if ((z.chargeLeft -= ch.speed * dt) <= 0) {
          z.mode = 'recover'; // winded: the window to punish it
          z.modeT = ch.recoverS;
        }
        break;
      }
      case 'bash': {
        // Bangs on a closed door; after doorBash.hits blows it bursts open
        const dr = z.door;
        if (!dr || !dr.closed() || z.sense.awareness === 'unaware') {
          z.mode = 'move';
          z.door = null;
          break;
        }
        face = _tg.set(dr.x, z.curr.y, dr.z);
        if (z.modeT <= 0) {
          z.modeT = DB.every * (0.85 + this.ctx.rand() * 0.3);
          z.anim?.oneshot('z_attack');
          this.ctx.sfx('impact_wood', _tg, { volume: 1, pitchJitter: 0.15 });
          this.ctx.game.events.emit('noise', { position: _tg.clone(), radius: 14, source: 'door_bash' });
          const n = (this.doorHits.get(dr) ?? 0) + 1;
          this.doorHits.set(dr, n);
          if (n >= DB.hits) {
            dr.force();
            this.doorHits.delete(dr);
            z.mode = 'move';
            z.door = null;
          }
        }
        break;
      }
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
        const speed = (z.crawler ? d.crawl : d.chase * z.gait.k) * chaseMul(this.night01());
        if (s === 'detected') {
          face = tgt;
          if (d.scream && z.screamCd <= 0 && !car && dist > 4) {
            z.mode = 'scream';
            z.modeT = d.scream.windupS;
            z.anim?.oneshot('z_grab');
            break;
          }
          // Brute: a bull charge from mid range, telegraphed by a roar
          const ch = d.charge;
          if (ch && z.chargeCd <= 0 && !car && !z.crawler && z.seen && dist >= ch.range[0] && dist <= ch.range[1] && Math.abs(tgt.y - z.curr.y) < 1) {
            z.mode = 'charge_windup';
            z.modeT = ch.windupS;
            z.chargeCd = ch.cooldownS;
            this.releaseToken(z);
            this.ctx.sfx('zombie_alert', z.curr, { pitchJitter: 0.04, volume: 1 });
            z.anim?.oneshot('z_grab');
            break;
          }
          // Ask for an attack token on approach; holders close in, the rest circle (Doom tokens)
          if (!z.token && dist < d.circleRadius + 1 && this.tokensInUse() < HD.attackTokens) z.token = true;
          if (z.token && dist > d.circleRadius + 3) z.token = false;
          if (rd <= d.attackRange && Math.abs(tgt.y - z.curr.y) < 1.6) {
            const wl = d.attackWindup * windupMul(this.night01());
            if (z.token && this.time - this.lastWindup >= HD.attackSpacing && this.time + wl >= this.lastLand + HD.attackSpacing && !HD.passive) {
              this.lastWindup = this.time;
              // Telegraph: windup with an audio cue ≥ 0.3 s before the hit lands
              z.mode = 'windup';
              z.modeT = d.attackWindup * windupMul(this.night01());
              // a swing from outside the player's view gets a longer telegraph (it is heard, not seen)
              const lx = -Math.sin(p.yaw), lz = -Math.cos(p.yaw);
              const offView = (lx * (z.curr.x - p.curr.x) + lz * (z.curr.z - p.curr.z)) / Math.max(1e-3, dist) < Math.cos((HD.offViewDeg * Math.PI) / 180);
              if (offView && !car) z.modeT *= HD.offViewWindupMul;
              z.windupLen = z.modeT;
              this.lastLand = this.time + z.modeT;
              this.ctx.sfx('zombie_attack', z.curr, { pitchJitter: 0.08 });
              if (z.crawler) z.anim?.oneshot(CC.attack, 0.1, false, 0, CC.attackSpeed); // lunge along the ground, never up onto the knees
              else z.anim?.oneshot('z_attack');
              break;
            }
          }
          if (!z.token && !car && dist < d.circleRadius + 0.6) {
            // No token: circle at 1.5–2.5 m and growl
            _w.subVectors(z.curr, p.curr).setY(0).normalize();
            const tangent = (z.id & 1 ? 1 : -1) * 0.6;
            _v.set(-_w.z * tangent, 0, _w.x * tangent).addScaledVector(_w, (d.circleRadius - dist) * 1.5);
            if (_v.lengthSq() > speed * speed) _v.setLength(speed);
          } else {
            _v.subVectors(this.doorWaypoint(z, tgt) ?? tgt, z.curr).setY(0);
            if (_v.lengthSq() > 0.01) _v.setLength(rd < 0.2 ? 0 : speed);
          }
          if (!car) this.spreadOut(z, dist, speed);
          moveSpeed = speed;
        } else if (s === 'searching') {
          if (z.reactT > 0) {
            // heard something: the head turns first, then it goes
            z.reactT -= dt;
            face = z.lastKnown;
            break;
          }
          const goal = this.doorWaypoint(z, z.lastKnown) ?? z.lastKnown;
          _v.subVectors(goal, z.curr).setY(0);
          const dl = Math.hypot(z.lastKnown.x - z.curr.x, z.lastKnown.z - z.curr.z);
          if (dl > 1.5) _v.setLength(z.urgent ? speed : speed * 0.8); // a gunshot or a scream close by: it comes at a run
          else {
            z.urgent = false;
            this.wanderAround(z, z.lastKnown, dt, z.walkSpeed);
          }
          moveSpeed = Math.hypot(_v.x, _v.z);
          face = null;
        } else if (s === 'suspicious') {
          face = z.lastKnown.lengthSq() > 0 ? z.lastKnown : p.curr; // head-turn toward the stimulus
          if (z.seen) z.lastKnown.copy(p.curr);
        } else {
          z.urgent = false;
          this.wanderAround(z, z.home, dt, z.walkSpeed);
        }
        if (z.mode === 'move') this.avoid(z, dt, s === 'detected' ? rd : Math.hypot(z.lastKnown.x - z.curr.x, z.lastKnown.z - z.curr.z), s !== 'unaware' && tgt.y - z.curr.y > 0.8);
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
    z.yawGlide = 0;
    if (fx * fx + fz * fz > 1e-4 && z.mode !== 'stagger') {
      const want = Math.atan2(-fx, -fz);
      let dy = want - z.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const maxT = d.turnRate * dt;
      const turn = Math.max(-maxT, Math.min(maxT, dy));
      // thinking every Nth tick: the turn is spread over the ticks until the next think
      const tE = z.mode === 'move' ? z.thinkEvery : 1;
      z.yaw += turn / tE;
      if (tE > 1) z.yawGlide = turn / tE;
    }

    // Integrate with the KCC (gravity always). Level of detail (aiLod): beyond kccNearM walkers query every kE ticks; the query
    // covers the whole window and the result is spread evenly over its ticks (glide), so they still move every tick.
    z.vel.x = _v.x;
    z.vel.z = _v.z;
    const kE = z.mode === 'move' ? z.kccEvery : 1;
    if (kE > 1 && z.glideN > 0) {
      this.glide(z);
      return;
    }
    z.glideN = 0;
    if (kE > 1) dt = (dt * kE) / z.thinkEvery; // the window this query covers (think may already sum kE ticks)
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
    z.grounded = this.kcc.computedGrounded();
    if (z.grounded) z.vel.y = 0;
    if (kE > 1) {
      z.glide.set(m.x / kE, m.y / kE, m.z / kE);
      z.glideN = kE;
      this.glide(z); // this tick's share
    } else {
      z.curr.x += m.x;
      z.curr.y += m.y;
      z.curr.z += m.z;
      z.body.setNextKinematicTranslation(_kt.set(z.curr.x, z.curr.y + z.capY, z.curr.z));
      z.walkPhase += (Math.hypot(m.x, m.z) / 0.7) * Math.PI;
    }

    // Charging brute ran into a wall: it stands stunned (the reward for baiting it)
    if (z.mode === 'charge' && moveSpeed > 0 && Math.hypot(m.x, m.z) < want * 0.35) {
      this.ctx.sfx('impact_concrete', z.curr, { volume: 1 });
      this.ctx.rig.trauma = Math.max(this.ctx.rig.trauma, dist < 8 ? 0.35 : 0.1);
      this.stagger(z, d.charge!.wallStunS);
      return;
    }
    // Blocked while chasing/searching: a closed door in the way gets bashed; otherwise climb onto vehicles and low walls (anti-cheese)
    if (z.mode === 'move' && want > 0.005 && Math.hypot(m.x, m.z) < want * 0.3 && z.sense.awareness !== 'unaware') {
      z.stuckT += dt;
      if (z.stuckT > 0.4 && !this.tryBash(z) && !p.inVehicle) this.tryClimb(z); // beat on an occupied car instead of climbing it
    } else z.stuckT = 0;
    // Sliding along an obstacle for a long time (a long fence): try to climb it toward the target
    if (z.mode === 'move' && z.blockedT > ST.climbAfterS && z.sense.awareness === 'detected' && !p.inVehicle) {
      z.blockedT = 0;
      if (!this.tryBash(z)) this.tryClimb(z, Math.atan2(-(tgt.x - z.curr.x), -(tgt.z - z.curr.z)));
    }
  }

  private wanderAround(z: Zombie, center: Vector3, dt: number, _speed: number) {
    if ((z.wanderT -= dt) <= 0) {
      z.wanderT = 4 + this.ctx.rand() * 4;
      const a = this.ctx.rand() * Math.PI * 2;
      const r = 1 + this.ctx.rand() * 3;
      z.wander.set(center.x + Math.cos(a) * r, z.curr.y, center.z + Math.sin(a) * r);
    }
    if (z.wander.distanceToSquared(z.curr) > 0.25) _v.subVectors(z.wander, z.curr).setY(0).setLength(z.walkSpeed);
  }

  /** Spread round the player: engaged zombies push apart along the ring (tangentially) to at least steer.minArc. */
  private spreadOut(z: Zombie, dist: number, speed: number) {
    if (dist > ST.ringR || dist < 0.3) return;
    const P = this.ctx.player.curr;
    const bz = Math.atan2(z.curr.x - P.x, z.curr.z - P.z);
    let n = 0;
    for (const o of this.list) if (o !== z && o.alive && o.sense.awareness === 'detected' && Math.hypot(o.curr.x - P.x, o.curr.z - P.z) < ST.ringR) n++;
    if (!n) return;
    const minArc = Math.min(ST.minArc, (Math.PI * 2) / (n + 1));
    let push = 0;
    for (const o of this.list) {
      if (o === z || !o.alive || o.sense.awareness !== 'detected') continue;
      const od = Math.hypot(o.curr.x - P.x, o.curr.z - P.z);
      if (od > ST.ringR) continue;
      const dA = wrapA(bz - Math.atan2(o.curr.x - P.x, o.curr.z - P.z));
      if (Math.abs(dA) < minArc) push += (dA === 0 ? (z.id > o.id ? 1 : -1) : Math.sign(dA)) * (1 - Math.abs(dA) / minArc) * (od < dist ? 1 : 0.5); // the one behind gives way more
    }
    if (!push) return;
    const rx = (z.curr.x - P.x) / dist, rz = (z.curr.z - P.z) / dist;
    const k = Math.max(-1.2, Math.min(1.2, push)) * ST.arcGain * speed;
    _v.x += rz * k;
    _v.z += -rx * k;
    const l = Math.hypot(_v.x, _v.z);
    if (l > speed * 1.15) _v.multiplyScalar((speed * 1.15) / l);
  }

  /** The goal is on the other side of a door near this zombie: walk to the doorway first (open or shut). */
  private doorWaypoint(z: Zombie, goal: Vector3): Vector3 | null {
    let best: DoorHandle | null = null;
    let bd = 9;
    for (const dr of doorHandles) {
      const d = Math.hypot(dr.x - z.curr.x, dr.z - z.curr.z);
      if (d > bd || Math.hypot(dr.x - goal.x, dr.z - goal.z) > 16) continue;
      const sz = (z.curr.x - dr.x) * dr.nx + (z.curr.z - dr.z) * dr.nz;
      const sg = (goal.x - dr.x) * dr.nx + (goal.z - dr.z) * dr.nz;
      if (sz * sg >= 0 || Math.abs(sz) < 0.35) continue; // same side, or already in the doorway
      best = dr;
      bd = d;
    }
    if (!best) return null;
    const sz = Math.sign((z.curr.x - best.x) * best.nx + (z.curr.z - best.z) * best.nz);
    z.viaDoor = true; // no whisker swerve: the jambs and the leaf would turn it away from the doorway
    if (bd < 1.0) {
      if (best.closed()) {
        // at the shut door: bang on it
        if (z.sense.awareness !== 'unaware' && z.mode === 'move') {
          z.mode = 'bash';
          z.modeT = 0.3;
          z.door = best;
        }
        return _o.set(best.x, z.curr.y, best.z);
      }
      return _o.set(best.x - best.nx * sz * 1.2, z.curr.y, best.z - best.nz * sz * 1.2); // open: walk on through
    }
    return _o.set(best.x + best.nx * sz * 0.6, z.curr.y, best.z + best.nz * sz * 0.6);
  }

  /** Stuck at a closed door while hunting: start bashing it. */
  private tryBash(z: Zombie) {
    if (z.sense.awareness === 'unaware') return false;
    for (const dr of doorHandles) {
      if (!dr.closed() || Math.hypot(dr.x - z.curr.x, dr.z - z.curr.z) > DB.near) continue;
      z.stuckT = 0;
      z.mode = 'bash';
      z.modeT = 0.3;
      z.door = dr;
      return true;
    }
    return false;
  }

  /** Whisker steering: a capsule-wide cast along the wanted heading; blocked, it swerves to the first clear angle,
   *  keeping the side it chose (no flip-flop), and eases the swerve so the turn reads as walking round, not jitter. */
  private avoid(z: Zombie, dt: number, goalDist: number, goalAbove: boolean) {
    const sp = Math.hypot(_v.x, _v.z);
    if ((z.sideT -= dt) <= 0) z.side = 0;
    if (sp < 0.05 || goalDist < 1.6 || goalAbove || z.viaDoor) {
      z.swerve = z.swerveNow = 0;
      z.blockedT = 0;
      return;
    }
    const base = Math.atan2(_v.x, _v.z);
    if ((z.steerT -= dt) <= 0) {
      z.steerT = 1 / ST.hz + (z.id % 5) * 0.004;
      const look = Math.min(ST.look, goalDist - 0.6);
      if (this.clearAt(z, base, look)) {
        z.swerve = 0;
      } else {
        let found = 0;
        const sides = z.side ? [z.side, -z.side] : this.ctx.rand() < 0.5 ? [1, -1] : [-1, 1];
        // prefer the side whose first swerve is open
        if (!z.side && this.clearAt(z, base + sides[1] * ST.angles[0], look) && !this.clearAt(z, base + sides[0] * ST.angles[0], look)) sides.reverse();
        outer: for (const sd of sides)
          for (const a of ST.angles)
            if (this.clearAt(z, base + sd * a, look)) {
              found = sd * a;
              z.side = sd;
              break outer;
            }
        z.swerve = found;
        if (found) z.sideT = ST.holdS;
      }
    }
    if (z.swerve) z.blockedT += dt;
    else z.blockedT = Math.max(0, z.blockedT - dt * 2);
    z.swerveNow += (z.swerve - z.swerveNow) * Math.min(1, dt * 10);
    if (Math.abs(z.swerveNow) > 1e-3) {
      const a = base + z.swerveNow;
      _v.set(Math.sin(a) * sp, 0, Math.cos(a) * sp);
    }
  }

  private shapeBall: unknown = null;
  /** Is the heading `a` (atan2(x, z)) free of static props, buildings and cars for `look` m, capsule-wide? */
  private clearAt(z: Zombie, a: number, look: number) {
    if (look <= 0.05) return true;
    const { R, world } = this.ctx.game.phys;
    this.shapeBall ??= new R.Ball(CAPSULE_R * 1.05);
    const filt = this.ctx.player.inVehicle ? STEER_FILTER & ~Group.VEHICLE : STEER_FILTER;
    const hit = world.castShape(
      { x: z.curr.x, y: z.curr.y + ST.probeY, z: z.curr.z }, { x: 0, y: 0, z: 0, w: 1 }, { x: Math.sin(a), y: 0, z: Math.cos(a) }, this.shapeBall as InstanceType<typeof R.Ball>, 0, look, true,
      R.QueryFilterFlags.EXCLUDE_SENSORS, groups(Group.ZOMBIE, filt), z.capsule,
    );
    return !hit;
  }

  private tryClimb(z: Zombie, yaw = z.yaw) {
    z.stuckT = 0;
    const { R, world } = this.ctx.game.phys;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
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

  /** Builds every spawnable variant's crowd up front (clip bake, buffers) so the first horde does not stall a frame for ~100 ms. */
  async warmCrowds() {
    const ids = Object.keys(zombieMix).filter((k) => zombieDefs[k]);
    await Promise.all(ids.map((k) => this.crowdFor(zombieDefs[k])));
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
      // Speed-matched gait: walk while wandering/searching slowly, run when chasing; timeScale = speed / authored speed
      const g = z.gait;
      const runCut = ((ZM[g.walk]?.speed ?? 0.5) * g.k + (ZM[g.run]?.speed ?? 1.27)) / 2;
      const clip = z.crawler ? 'z_crawl' : sp > runCut ? g.run : sp > 0.05 ? g.walk : g.idle;
      const ref = ZM[clip]?.speed;
      const ts = ref && ref > 0.05 ? Math.max(0.6, Math.min(1.6, sp / ref)) : g.k;
      a.base(clip, 0.3, ts, (ZM[clip]?.cycle ?? 1) * ((z.id * 0.6180339) % 1));
    }
    a.update();
    const p = ch.root.position;
    a.crowd.set(a.i, p.x, p.y, p.z, yaw);
    a.crowd.setSpeed(a.i, a.frozen ? 0 : z.hitstop > 0 ? 0.05 : 1);
    a.crowd.setFlash(a.i, Math.min(1, z.flash * 9));
    a.crowd.setTilt(a.i, !z.alive ? 0 : z.mode === 'stagger' ? HR.staggerLean : z.mode === 'scream' || z.mode === 'charge_windup' ? HR.roarLean : z.mode === 'charge' ? HR.chargeLean : 0, 0); // roar: reared back, charge: head down
    // location flinch: fast ease-in, ease-out back (dead bodies keep none: the death clip owns the pose)
    const b = z.bend;
    const age = this.time - b.at;
    const env = !z.alive || age >= b.dur ? 0 : age < HR.rise ? Math.sin((age / HR.rise) * Math.PI * 0.5) : (1 - (age - HR.rise) / (b.dur - HR.rise)) ** 2;
    a.crowd.setBend(a.i, b.pitch * env, b.roll * env, b.twist * env, b.pivot, z.flash > 0 ? b.hitY : 0);
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
        // Car-thrown corpse: one full flip about the hips while airborne, ending upright into the death pose
        if (z.spinDur > 0 && z.fling.lengthSq() > 0) {
          const k = Math.min(1, z.spinT / z.spinDur);
          ch.root.position.y += 0.9;
          ch.root.rotateX(-Math.PI * 2 * (k * k * (3 - 2 * k)));
          ch.root.translateY(-0.9);
        }
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
