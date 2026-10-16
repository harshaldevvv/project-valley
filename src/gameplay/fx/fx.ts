import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Vector3,
} from 'three';
import type { Scene } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fxTuning as T, impacts, type BurstDef, type FxSurface } from '../../content/data/fx';

/**
 * Pooled hit/shot effects (principles §4, docs/research/vfx-impact-effects.md). Tier-1 CPU pools, one InstancedMesh
 * each, all unlit, zero allocations per shot, ≤ 10 draws:
 *   chips (opaque, incl. velocity-stretched sparks) · smoke/mist (translucent) · bullet decals · blood decals ·
 *   corpse blood pools · tracers (additive core + sheath) · casings · impact stars · muzzle flash · melee trail.
 * Plus one always-present PointLight (adding lights recompiles shaders).
 * Simulation pauses during melee hitstop (`freeze`), so the burst "pops" on release.
 */
const CHIPS = 256;
const SMOKE = 48;
const DECALS = 64;
const BLOOD = 32;
const TRACERS = 16;
const CASINGS = 32;
const STARS = 8;

const _m = new Matrix4();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const _v = new Vector3();
const _n = new Vector3();
const _z = new Vector3(0, 0, 1);
const _c = new Color();
const HIDE = new Matrix4().makeScale(0, 0, 0);

const rnd = (a: number, b: number) => a + Math.random() * (b - a); // cosmetic only, never sim state

/** Ring-buffered particle pool: position, velocity, life, size, gravity, spin, stretch. */
class Pool {
  readonly mesh: InstancedMesh;
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  max: Float32Array;
  size: Float32Array;
  grav: Float32Array;
  spin: Float32Array;
  stretch: Float32Array;
  next = 0;
  hiWater = 0;
  constructor(readonly n: number, mesh: InstancedMesh) {
    this.mesh = mesh;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.size = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.stretch = new Float32Array(n);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      mesh.setMatrixAt(i, HIDE);
      mesh.setColorAt(i, _c.set('#ffffff'));
    }
  }
  spawn(p: Vector3, v: Vector3, life: number, size: number, grav: number, color: Color, stretch = 0) {
    const i = this.next;
    this.next = (i + 1) % this.n;
    p.toArray(this.pos, i * 3);
    v.toArray(this.vel, i * 3);
    this.life[i] = this.max[i] = life;
    this.size[i] = size;
    this.grav[i] = grav;
    this.spin[i] = Math.random() * 6;
    this.stretch[i] = stretch;
    this.mesh.setColorAt(i, color);
    this.mesh.instanceColor!.needsUpdate = true;
    return i;
  }
}

/** Ring of world-space decal quads that fade (shrink) over their last seconds. */
class Decals {
  readonly mesh: InstancedMesh;
  private age: Float32Array;
  private mats: Float32Array; // 16 per slot: the full-size matrix
  private next = 0;
  constructor(private n: number, mat: MeshBasicMaterial) {
    this.mesh = new InstancedMesh(new PlaneGeometry(1, 1), mat, n);
    this.mesh.frustumCulled = false;
    this.age = new Float32Array(n).fill(1e9);
    this.mats = new Float32Array(n * 16);
    for (let i = 0; i < n; i++) {
      this.mesh.setMatrixAt(i, HIDE);
      this.mesh.setColorAt(i, _c.set('#000'));
    }
  }
  add(p: Vector3, n: Vector3, size: number, color: string) {
    const i = this.next;
    this.next = (i + 1) % this.n;
    _q.setFromUnitVectors(_z, n);
    _q.multiply(_q2.setFromAxisAngle(_z, Math.random() * Math.PI * 2)); // random roll
    _p.copy(p).addScaledVector(n, 0.005);
    _m.compose(_p, _q, _s.set(size, size, 1));
    _m.toArray(this.mats, i * 16);
    this.age[i] = 0;
    this.mesh.setMatrixAt(i, _m);
    this.mesh.setColorAt(i, _c.set(color));
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }
  update(dt: number) {
    let dirty = false;
    for (let i = 0; i < this.n; i++) {
      const a = (this.age[i] += dt);
      if (a < T.decalLife - T.decalFade || a > T.decalLife + 1) continue;
      dirty = true;
      const k = Math.max(0, 1 - (a - (T.decalLife - T.decalFade)) / T.decalFade);
      _m.fromArray(this.mats, i * 16);
      _m.scale(_s.set(k, k, 1));
      this.mesh.setMatrixAt(i, k > 0 ? _m : HIDE);
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Fx {
  private chips: Pool;
  private smoke: Pool;
  private casings: Pool;
  private casingGround = new Float32Array(CASINGS);
  private casingBounced = new Uint8Array(CASINGS);
  private casingRest = new Float32Array(CASINGS);
  private lastTink = 0;
  private decals: Decals;
  private blood: Decals;
  private pools: InstancedMesh;
  private poolPos = new Float32Array(T.poolMax * 3);
  private poolAge = new Float32Array(T.poolMax).fill(-1);
  private poolR = new Float32Array(T.poolMax);
  private poolNext = 0;
  private tracers: InstancedMesh; // 2 instances per tracer: core + sheath
  private tFrom = new Float32Array(TRACERS * 3);
  private tDir = new Float32Array(TRACERS * 3);
  private tLen = new Float32Array(TRACERS);
  private tAge = new Float32Array(TRACERS).fill(1e9);
  private tNext = 0;
  private stars: InstancedMesh;
  private starLife = new Float32Array(STARS);
  private starNext = 0;
  readonly flash: Mesh;
  private flashGeos: BufferGeometry[];
  readonly light: PointLight;
  private flashT = 0;
  private lightT = 0;
  private lastFlash = -9;
  private time = 0;
  private freezeT = 0;
  // melee trail (ribbon of base/tip samples)
  private trail: Mesh;
  private trailPos: Float32Array;
  private trailCol: Float32Array;
  private trailN = 0;
  private trailFadeT = 0;
  private trailActive = false;
  /** Called on a casing's first ground contact (sound). */
  onCasingLand: ((p: Vector3) => void) | null = null;

  constructor(scene: Scene) {
    this.chips = new Pool(CHIPS, new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: '#ffffff' }), CHIPS));
    this.smoke = new Pool(SMOKE, new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: T.smokeOpacity, depthWrite: false }), SMOKE));
    this.casings = new Pool(CASINGS, new InstancedMesh(new BoxGeometry(0.4, 0.4, 1.2), new MeshBasicMaterial({ color: '#ffffff' }), CASINGS));
    const decalMat = () => new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decals = new Decals(DECALS, decalMat());
    this.blood = new Decals(BLOOD, decalMat());
    // Corpse blood pools: flat octagons, grow under the body
    this.pools = new InstancedMesh(new CircleGeometry(1, 8).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: '#3d0705', transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), T.poolMax);
    this.pools.frustumCulled = false;
    for (let i = 0; i < T.poolMax; i++) this.pools.setMatrixAt(i, HIDE);
    // Tracers: unit box stretched along +Z from its origin; additive, colour = brightness
    this.tracers = new InstancedMesh(new BoxGeometry(1, 1, 1).translate(0, 0, 0.5), new MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: AdditiveBlending, depthWrite: false }), TRACERS * 2);
    this.tracers.frustumCulled = false;
    for (let i = 0; i < TRACERS * 2; i++) {
      this.tracers.setMatrixAt(i, HIDE);
      this.tracers.setColorAt(i, _c.set(i % 2 ? '#40361f' : '#fff2c8')); // sheath ≈ 25 % of the core
    }
    this.stars = new InstancedMesh(starGeometry(4, 1, 0.25), new MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }), STARS);
    this.stars.frustumCulled = false;
    for (let i = 0; i < STARS; i++) this.stars.setMatrixAt(i, HIDE);
    // Muzzle flash: 3 variants of crossed quads + a star disc, stretched toward +Z (the shot direction)
    this.flashGeos = [4, 5, 6].map((pts) => flashGeometry(pts));
    this.flash = new Mesh(this.flashGeos[0], new MeshBasicMaterial({ color: '#ffcf70', transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    this.flash.visible = false;
    this.flash.frustumCulled = false;
    this.light = new PointLight('#ffb050', 0, T.lightRange, 2);
    this.light.castShadow = false;
    // Melee trail ribbon
    const n = T.trailSamples;
    this.trailPos = new Float32Array(n * 2 * 3);
    this.trailCol = new Float32Array(n * 2 * 3);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.trailPos, 3).setUsage(DynamicDrawUsage));
    g.setAttribute('color', new BufferAttribute(this.trailCol, 3).setUsage(DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setIndex(idx);
    this.trail = new Mesh(g, new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    this.trail.frustumCulled = false;
    this.trail.visible = false;
    scene.add(this.chips.mesh, this.smoke.mesh, this.casings.mesh, this.decals.mesh, this.blood.mesh, this.pools, this.tracers, this.stars, this.flash, this.light, this.trail);
  }

  /** Pause particle simulation (melee hitstop). */
  freeze(t: number) {
    this.freezeT = Math.max(this.freezeT, t);
  }

  private burst(b: BurstDef, p: Vector3, n: Vector3, shot: Vector3 | null, scale: number) {
    const gore = T.gore;
    let count = Math.round(rnd(b.count[0], b.count[1] + 0.99) * scale);
    if (b.color.includes('#7a0f0c') && gore === 'reduced') count = Math.ceil(count / 2);
    const pool = b.pool === 'chips' ? this.chips : this.smoke;
    const cone = Math.tan((b.cone * Math.PI) / 360);
    for (let k = 0; k < count; k++) {
      _n.copy(n);
      if (shot && b.alongShot) _n.lerp(shot, b.alongShot).normalize();
      _v.set(_n.x + (Math.random() - 0.5) * 2 * cone, _n.y + (Math.random() - 0.5) * 2 * cone + (b.upBias ?? 0), _n.z + (Math.random() - 0.5) * 2 * cone)
        .normalize()
        .multiplyScalar(rnd(b.speed[0], b.speed[1]));
      _c.set(b.color[(Math.random() * b.color.length) | 0]);
      const size = Math.min(b.pool === 'smoke' ? T.smokeMaxSize : 1, rnd(b.size[0], b.size[1]));
      pool.spawn(p, _v, rnd(b.life[0], b.life[1]), size, b.gravity, _c, b.stretch ?? 0);
    }
  }

  /** Layered impact by surface (data/fx.ts impacts): chips/sparks, puff, optional star, decal. */
  impact(p: Vector3, n: Vector3, surface: FxSurface, shotDir: Vector3 | null = null, scale = 1) {
    let def = impacts[surface];
    if (surface === 'flesh' && T.gore === 'off') def = impacts.dirt; // dust puffs replace blood
    for (const b of def.bursts) this.burst(b, p, n, shotDir, scale);
    if (def.star) this.star(p, def.star);
  }

  /** Surface decal at a hit (bullet pool, or blood pool for flesh). */
  decal(p: Vector3, n: Vector3, surface: FxSurface, size?: number) {
    const d = impacts[surface].decal;
    if (d.pool === 'blood' && T.gore === 'off') return;
    (d.pool === 'blood' ? this.blood : this.decals).add(p, n, size ?? rnd(d.size[0], d.size[1]) * rnd(0.8, 1.2), d.color);
  }

  /** 1-frame white impact star (metal, blunt hits). */
  star(p: Vector3, size: number) {
    const i = this.starNext;
    this.starNext = (i + 1) % STARS;
    _q.setFromAxisAngle(_v.set(Math.random(), Math.random(), Math.random()).normalize(), Math.random() * 6);
    _m.compose(p, _q, _s.set(size, size, size));
    this.stars.setMatrixAt(i, _m);
    this.stars.instanceMatrix.needsUpdate = true;
    this.starLife[i] = 1 / 60;
  }

  /** Brass casing: fake ballistic arc, one bounce on `groundY`, rest 3 s, shrink; tink on first contact. */
  casing(p: Vector3, right: Vector3, up: Vector3, back: Vector3, groundY: number, hull = false) {
    _v.copy(right).multiplyScalar(rnd(1.5, 2.5)).addScaledVector(up, rnd(1, 2)).addScaledVector(back, rnd(0, 0.5));
    _v.x += rnd(-0.3, 0.3);
    _v.y += rnd(-0.3, 0.3);
    _v.z += rnd(-0.3, 0.3);
    _c.set(hull ? '#a83a2a' : '#c9a24a');
    const i = this.casings.spawn(p, _v, T.casingRest + 2, 0.015, 9.8, _c); // 1.2 cm ×1.5 for readability
    this.casings.spin[i] = rnd(10, 25);
    this.casingGround[i] = groundY;
    this.casingBounced[i] = 0;
    this.casingRest[i] = 0;
  }

  /** Muzzle smoke wisp (translucent pool). */
  smokePuff(p: Vector3, dir: Vector3, n = 1) {
    _c.set('#d8d4cc');
    for (let k = 0; k < n; k++) {
      _v.copy(dir).multiplyScalar(0.4 + k * 0.3);
      _v.x += rnd(-0.1, 0.1);
      _v.y += rnd(0.3, 0.6);
      _v.z += rnd(-0.1, 0.1);
      this.smoke.spawn(p, _v, rnd(0.6, 1.2), 0.05, -0.2, _c);
    }
  }

  /**
   * Muzzle flash ≤ 33 ms: random variant, roll and length ×0.8–1.2; light peak 3 decaying in 50 ms.
   * Reduce flashing: no light, flash at most ~3×/s at half brightness.
   */
  muzzle(p: Vector3, dir: Vector3, len: number, ads: boolean) {
    if (T.reduceFlashing && this.time - this.lastFlash < 0.34) return;
    this.lastFlash = this.time;
    this.flash.geometry = this.flashGeos[(Math.random() * this.flashGeos.length) | 0];
    this.flash.position.copy(p);
    this.flash.quaternion.setFromUnitVectors(_z, dir);
    this.flash.rotateZ(Math.random() * Math.PI * 2);
    const l = len * rnd(0.8, 1.2) * (ads ? T.adsFlashScale : 1);
    this.flash.scale.set(len * rnd(0.9, 1.1) * (ads ? T.adsFlashScale : 1), len * rnd(0.9, 1.1) * (ads ? T.adsFlashScale : 1), l);
    if (ads) this.flash.position.y -= T.adsFlashDrop;
    (this.flash.material as MeshBasicMaterial).color.set(T.reduceFlashing ? '#806838' : '#ffcf70');
    this.flash.visible = true;
    this.flashT = T.flashMs / 1000;
    if (T.reduceFlashing) return;
    this.light.position.copy(p);
    this.light.color.setHSL(0.08 + rnd(-0.05, 0.05) * 0.1, 1, 0.6);
    this.light.intensity = T.lightPeak;
    this.lightT = T.lightMs / 1000;
  }

  /** Tracer streak flying from `from` toward `to` at a visual speed; never starts within 4 m of the camera. */
  tracer(from: Vector3, to: Vector3, cam: Vector3) {
    _v.subVectors(to, from);
    let len = _v.length();
    if (len < 1) return;
    _v.divideScalar(len);
    // Skip the part near the lens
    const t = Math.max(0, _p.subVectors(cam, from).dot(_v));
    _p.copy(from).addScaledVector(_v, t);
    const camD = _p.distanceTo(cam);
    let start = 0;
    if (camD < T.tracerMinCamDist) start = t + Math.sqrt(T.tracerMinCamDist ** 2 - camD * camD);
    len -= start;
    if (len < 1) return;
    const i = this.tNext;
    this.tNext = (i + 1) % TRACERS;
    _p.copy(from).addScaledVector(_v, start);
    _p.toArray(this.tFrom, i * 3);
    _v.toArray(this.tDir, i * 3);
    this.tLen[i] = len;
    this.tAge[i] = 0;
  }

  /** Blood pool under a corpse: grows to 0.6–1.0 m over 5 s; the oldest is recycled. */
  bloodPool(p: Vector3) {
    if (T.gore === 'off') return;
    const i = this.poolNext;
    this.poolNext = (i + 1) % T.poolMax;
    p.toArray(this.poolPos, i * 3);
    this.poolAge[i] = 0;
    this.poolR[i] = rnd(T.poolRadius[0], T.poolRadius[1]);
  }

  /** Melee trail: call begin at the active window, sample (blade base, tip) every frame, end afterwards. */
  trailBegin() {
    this.trailN = 0;
    this.trailActive = true;
    this.trailFadeT = 0;
    this.trail.visible = true;
  }
  trailSample(base: Vector3, tip: Vector3) {
    if (!this.trailActive) return;
    const n = T.trailSamples;
    // shift the ring (14 samples, cheap)
    this.trailPos.copyWithin(6, 0, (n - 1) * 6);
    base.toArray(this.trailPos, 0);
    tip.toArray(this.trailPos, 3);
    this.trailN = Math.min(n, this.trailN + 1);
  }
  trailEnd() {
    if (this.trailActive) this.trailFadeT = T.trailFade;
    this.trailActive = false;
  }

  private stepPool(pool: Pool, dt: number, kind: 'chips' | 'smoke' | 'casings') {
    let any = false;
    for (let i = 0; i < pool.n; i++) {
      if (pool.life[i] <= 0) continue;
      any = true;
      pool.life[i] -= dt;
      if (pool.life[i] <= 0) {
        pool.mesh.setMatrixAt(i, HIDE);
        continue;
      }
      const j = i * 3;
      const P = pool.pos;
      const V = pool.vel;
      if (kind === 'smoke') {
        const damp = Math.max(0, 1 - dt * 2.5);
        V[j] *= damp;
        V[j + 2] *= damp;
      } else V[j + 1] -= pool.grav[i] * dt;
      P[j] += V[j] * dt;
      P[j + 1] += V[j + 1] * dt;
      P[j + 2] += V[j + 2] * dt;
      let sz = pool.size[i];
      const t = pool.life[i] / pool.max[i];
      if (kind === 'casings') {
        if (P[j + 1] <= this.casingGround[i] + 0.01 && V[j + 1] < 0) {
          P[j + 1] = this.casingGround[i] + 0.01;
          if (!this.casingBounced[i]) {
            this.casingBounced[i] = 1;
            V[j] *= T.casingBounce;
            V[j + 2] *= T.casingBounce;
            V[j + 1] *= -T.casingBounce;
            pool.spin[i] *= 0.3;
            if (this.time - this.lastTink > T.casingCooldown) {
              this.lastTink = this.time;
              _p.set(P[j], P[j + 1], P[j + 2]);
              this.onCasingLand?.(_p);
            }
          } else {
            V[j] = V[j + 1] = V[j + 2] = 0;
            pool.spin[i] = 0;
          }
        }
        pool.stretch[i] += dt * pool.spin[i]; // reuse as spin angle
        if (pool.life[i] < 0.3) sz *= pool.life[i] / 0.3;
        _q.setFromAxisAngle(_v.set(0.2, 1, 0.4).normalize(), pool.stretch[i]);
        _m.compose(_p.set(P[j], P[j + 1], P[j + 2]), _q, _s.set(sz, sz, sz));
        pool.mesh.setMatrixAt(i, _m);
        continue;
      }
      if (kind === 'chips' && P[j + 1] < 0.01 && pool.grav[i] > 0) {
        P[j + 1] = 0.01;
        V[j] *= 0.4;
        V[j + 2] *= 0.4;
        V[j + 1] *= -0.25;
      }
      if (kind === 'smoke') sz = Math.min(sz * (1 + (1 - t) * 2), T.smokeMaxSize); // grows ×1 → ×3, capped at 0.4 m
      else sz *= 0.4 + 0.6 * t;
      if (kind === 'chips' && pool.stretch[i] > 0) {
        // Sparks / splinters: a thin box stretched along the velocity
        _v.set(V[j], V[j + 1], V[j + 2]);
        const sp = _v.length();
        _q.setFromUnitVectors(_z, sp > 1e-3 ? _v.divideScalar(sp) : _z);
        _m.compose(_p.set(P[j], P[j + 1], P[j + 2]), _q, _s.set(sz, sz, Math.max(sz, sp * pool.stretch[i])));
      } else {
        pool.spin[i] += dt * 8;
        _q.setFromAxisAngle(_v.set(0.3, 1, 0.2).normalize(), pool.spin[i]);
        _m.compose(_p.set(P[j], P[j + 1], P[j + 2]), _q, _s.set(sz, sz, sz));
      }
      pool.mesh.setMatrixAt(i, _m);
    }
    if (any) pool.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    this.time += dt;
    // Flash + light are not frozen (they belong to the gun, not the impact)
    if (this.flashT > 0 && (this.flashT -= dt) <= 0) this.flash.visible = false;
    if (this.lightT > 0) {
      this.lightT -= dt;
      this.light.intensity = Math.max(0, (this.lightT / (T.lightMs / 1000)) * T.lightPeak);
    }
    let sdt = dt;
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      sdt = 0;
    }
    this.stepPool(this.chips, sdt, 'chips');
    this.stepPool(this.smoke, sdt, 'smoke');
    this.stepPool(this.casings, dt, 'casings');
    this.decals.update(dt);
    this.blood.update(dt);
    // Stars live one frame
    let anyS = false;
    for (let i = 0; i < STARS; i++) {
      if (this.starLife[i] <= 0) continue;
      anyS = true;
      if ((this.starLife[i] -= dt) <= 0) this.stars.setMatrixAt(i, HIDE);
    }
    if (anyS) this.stars.instanceMatrix.needsUpdate = true;
    // Blood pools grow (ease-out) over poolGrow s
    let anyP = false;
    for (let i = 0; i < T.poolMax; i++) {
      if (this.poolAge[i] < 0 || this.poolAge[i] > T.poolGrow + 1) continue;
      anyP = true;
      this.poolAge[i] += dt;
      const k = 1 - (1 - Math.min(1, this.poolAge[i] / T.poolGrow)) ** 3;
      const r = this.poolR[i] * k;
      _m.compose(_p.fromArray(this.poolPos, i * 3).setY(this.poolPos[i * 3 + 1] + 0.012), _q.identity(), _s.set(r, 1, r));
      this.pools.setMatrixAt(i, _m);
    }
    if (anyP) this.pools.instanceMatrix.needsUpdate = true;
    // Tracers: head travels at tracerSpeed, streak length fixed; core + sheath instances
    let anyT = false;
    for (let i = 0; i < TRACERS; i++) {
      const L = this.tLen[i];
      if (this.tAge[i] > L / T.tracerSpeed + 0.05) continue;
      anyT = true;
      this.tAge[i] += dt;
      const head = this.tAge[i] * T.tracerSpeed;
      if (head - T.tracerLength > L) {
        this.tracers.setMatrixAt(i * 2, HIDE);
        this.tracers.setMatrixAt(i * 2 + 1, HIDE);
        continue;
      }
      const a = Math.max(0, head - T.tracerLength);
      const b = Math.min(L, head);
      _v.fromArray(this.tDir, i * 3);
      _p.fromArray(this.tFrom, i * 3).addScaledVector(_v, a);
      _q.setFromUnitVectors(_z, _v);
      const len = Math.max(0.01, b - a);
      _m.compose(_p, _q, _s.set(T.tracerCore, T.tracerCore, len));
      this.tracers.setMatrixAt(i * 2, _m);
      _m.compose(_p, _q, _s.set(T.tracerSheath, T.tracerSheath, len));
      this.tracers.setMatrixAt(i * 2 + 1, _m);
    }
    if (anyT) this.tracers.instanceMatrix.needsUpdate = true;
    // Trail: colour fades from newest (bright) to oldest; whole trail fades after the window
    if (this.trail.visible) {
      if (!this.trailActive) {
        this.trailFadeT -= dt;
        if (this.trailFadeT <= 0) this.trail.visible = false;
      }
      const fade = this.trailActive ? 1 : Math.max(0, this.trailFadeT / T.trailFade);
      const n = T.trailSamples;
      for (let i = 0; i < n; i++) {
        const k = i < this.trailN ? (1 - i / n) * 0.45 * fade : 0;
        for (let e = 0; e < 2; e++) this.trailCol.set([k, k, k * 0.95], (i * 2 + e) * 3);
        if (i >= this.trailN) for (let e = 0; e < 2; e++) this.trailPos.copyWithin((i * 2 + e) * 3, 0, 3);
      }
      const g = this.trail.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.color.needsUpdate = true;
    }
  }
}

/** Muzzle flash: `pts` crossed quads around the barrel (length along +Z) + a star disc facing back. */
function flashGeometry(pts: number) {
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < Math.min(3, pts - 1); k++) {
    parts.push(new PlaneGeometry(0.45, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2).rotateZ((k * Math.PI) / Math.min(3, pts - 1)));
  }
  parts.push(starGeometry(pts, 0.6, 0.2));
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
}

/** Flat star in the XY plane. */
function starGeometry(points: number, outer: number, inner: number) {
  const v: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a0 = (i / (points * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (points * 2)) * Math.PI * 2;
    const r0 = i % 2 ? inner : outer;
    const r1 = i % 2 ? outer : inner;
    v.push(0, 0, 0, Math.cos(a0) * r0 * 0.5, Math.sin(a0) * r0 * 0.5, 0, Math.cos(a1) * r1 * 0.5, Math.sin(a1) * r1 * 0.5, 0);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(v.length).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array((v.length / 3) * 2), 2));
  return g;
}

declare module '../ctx' {
  interface Ctx {
    fx: Fx;
  }
}
