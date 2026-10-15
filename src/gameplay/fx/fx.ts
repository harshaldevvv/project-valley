import {
  AdditiveBlending,
  BoxGeometry,
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
import type { Surface } from '../ctx';

/**
 * Pooled hit/shot effects (principles §4): one InstancedMesh each for particles, decals and tracers,
 * one muzzle-flash mesh and one always-present point light (adding/removing lights recompiles shaders).
 * Zero allocations per shot: everything is ring-buffer recycled.
 */
const PARTICLES = 256;
const DECALS = 64;
const TRACERS = 16;
const SMOKE = 48;

const SURFACE_FX: Record<Surface, { color: string; n: number; speed: number; size: number; grav: number; life: number }> = {
  flesh: { color: '#7a0f0c', n: 10, speed: 2.6, size: 0.05, grav: 9, life: 0.5 },
  wood: { color: '#8a6a44', n: 8, speed: 3.5, size: 0.045, grav: 9, life: 0.6 },
  metal: { color: '#ffd27a', n: 9, speed: 7, size: 0.025, grav: 6, life: 0.22 }, // sparks
  dirt: { color: '#6b5a42', n: 10, speed: 2.4, size: 0.06, grav: 7, life: 0.7 },
  concrete: { color: '#a29c90', n: 9, speed: 3, size: 0.045, grav: 8, life: 0.5 },
};
const DECAL_COLOR: Record<Surface, string> = { flesh: '#4a0806', wood: '#2a2018', metal: '#3a3a3a', dirt: '#2c251b', concrete: '#2b2b2b' };

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const _v = new Vector3();
const _z = new Vector3(0, 0, 1);
const _c = new Color();

export class Fx {
  private parts: InstancedMesh;
  private pPos = new Float32Array(PARTICLES * 3);
  private pVel = new Float32Array(PARTICLES * 3);
  private pLife = new Float32Array(PARTICLES);
  private pMax = new Float32Array(PARTICLES);
  private pSize = new Float32Array(PARTICLES);
  private pGrav = new Float32Array(PARTICLES);
  private pSpin = new Float32Array(PARTICLES);
  private pNext = 0;
  private decals: InstancedMesh;
  private dNext = 0;
  private tracers: InstancedMesh;
  private tFrom = new Float32Array(TRACERS * 3);
  private tDir = new Float32Array(TRACERS * 3);
  private tLen = new Float32Array(TRACERS);
  private tLife = new Float32Array(TRACERS);
  private tNext = 0;
  private smokeMesh: InstancedMesh;
  private sPos = new Float32Array(SMOKE * 3);
  private sVel = new Float32Array(SMOKE * 3);
  private sLife = new Float32Array(SMOKE);
  private sNext = 0;
  readonly flash: Mesh;
  readonly light: PointLight;
  private flashT = 0;
  private lightT = 0;

  constructor(scene: Scene) {
    const hide = new Matrix4().makeScale(0, 0, 0);
    this.parts = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: '#ffffff' }), PARTICLES);
    this.parts.instanceMatrix.setUsage(DynamicDrawUsage);
    this.parts.frustumCulled = false;
    for (let i = 0; i < PARTICLES; i++) {
      this.parts.setMatrixAt(i, hide);
      this.parts.setColorAt(i, _c.set('#fff'));
    }
    this.decals = new InstancedMesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
      DECALS,
    );
    this.decals.frustumCulled = false;
    for (let i = 0; i < DECALS; i++) {
      this.decals.setMatrixAt(i, hide);
      this.decals.setColorAt(i, _c.set('#000'));
    }
    // Tracer: a thin stretched quad pair (box), additive.
    this.tracers = new InstancedMesh(
      new BoxGeometry(1, 1, 1).translate(0, 0, -0.5),
      new MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }),
      TRACERS,
    );
    this.tracers.frustumCulled = false;
    for (let i = 0; i < TRACERS; i++) this.tracers.setMatrixAt(i, hide);

    // Smoke: soft grey, translucent, its own pool so chips/sparks stay opaque.
    this.smokeMesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial({ color: '#d8d4cc', transparent: true, opacity: 0.14, depthWrite: false }),
      SMOKE,
    );
    this.smokeMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.smokeMesh.frustumCulled = false;
    for (let i = 0; i < SMOKE; i++) this.smokeMesh.setMatrixAt(i, hide);
    // Flash: two crossed quads stretched along the barrel + a small disc facing back down it.
    const a = new PlaneGeometry(0.5, 1).translate(0, 0.5, 0).rotateX(-Math.PI / 2); // lies along -Z… flipped below
    const b = a.clone().rotateZ(Math.PI / 2);
    const c = new PlaneGeometry(0.6, 0.6);
    const flashGeo = mergeGeometries([a, b, c])!;
    flashGeo.rotateY(Math.PI); // stretch toward +Z = the shot direction after setFromUnitVectors
    this.flash = new Mesh(
      flashGeo,
      new MeshBasicMaterial({ color: '#ffcf70', transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    );
    this.flash.visible = false;
    this.light = new PointLight('#ffb050', 0, 6, 2);
    this.light.castShadow = false;
    scene.add(this.parts, this.decals, this.tracers, this.smokeMesh, this.flash, this.light);
  }

  private spawn(p: Vector3, vx: number, vy: number, vz: number, life: number, size: number, grav: number, color: Color) {
    const i = this.pNext;
    this.pNext = (i + 1) % PARTICLES;
    this.pPos[i * 3] = p.x;
    this.pPos[i * 3 + 1] = p.y;
    this.pPos[i * 3 + 2] = p.z;
    this.pVel[i * 3] = vx;
    this.pVel[i * 3 + 1] = vy;
    this.pVel[i * 3 + 2] = vz;
    this.pLife[i] = this.pMax[i] = life;
    this.pSize[i] = size;
    this.pGrav[i] = grav;
    this.pSpin[i] = Math.random() * 6; // cosmetic only
    this.parts.setColorAt(i, color);
  }

  /** Burst along the surface normal (sparks / chips / dust / blood). */
  impact(p: Vector3, n: Vector3, surface: Surface, scale = 1) {
    const f = SURFACE_FX[surface];
    _c.set(f.color);
    for (let k = 0; k < f.n * scale; k++) {
      const s = f.speed * (0.4 + Math.random() * 0.8);
      this.spawn(
        p,
        (n.x + (Math.random() - 0.5) * 1.3) * s,
        (n.y + (Math.random() - 0.5) * 1.3 + 0.3) * s,
        (n.z + (Math.random() - 0.5) * 1.3) * s,
        f.life * (0.6 + Math.random() * 0.6),
        f.size * (0.6 + Math.random() * 0.8),
        f.grav,
        _c,
      );
    }
    // Dust puff for non-flesh surfaces (translucent smoke pool).
    if (surface !== 'flesh' && surface !== 'metal') this.smoke(p, n, 3);
  }

  /** Brass casing ejected to the right of the gun. */
  shell(p: Vector3, right: Vector3, up: Vector3, rifle: boolean) {
    _c.set(rifle ? '#c9a03a' : '#d2b04c');
    const s = 2 + Math.random();
    this.spawn(p, right.x * s + up.x * 1.5, right.y * s + up.y * 1.5 + 1.2, right.z * s + up.z * 1.5, 0.7, rifle ? 0.035 : 0.025, 9.8, _c);
  }

  /** Muzzle smoke wisp: a few translucent puffs drifting up and forward. */
  smoke(p: Vector3, dir: Vector3, n = 2) {
    for (let k = 0; k < n; k++) {
      const i = this.sNext;
      this.sNext = (i + 1) % SMOKE;
      p.toArray(this.sPos, i * 3);
      this.sVel[i * 3] = dir.x * (0.5 + k * 0.4) + (Math.random() - 0.5) * 0.2;
      this.sVel[i * 3 + 1] = dir.y * 0.5 + 0.25 + Math.random() * 0.15;
      this.sVel[i * 3 + 2] = dir.z * (0.5 + k * 0.4) + (Math.random() - 0.5) * 0.2;
      this.sLife[i] = 0.7 + Math.random() * 0.3;
    }
  }

  /** Muzzle flash ≤ 33 ms, light decays in 50 ms. `size` ~0.25 pistol / 0.4 rifle. */
  muzzle(p: Vector3, dir: Vector3, size: number) {
    this.flash.position.copy(p);
    this.flash.quaternion.setFromUnitVectors(_z, dir);
    this.flash.rotateZ(Math.random() * Math.PI);
    this.flash.scale.set(size, size, size);
    this.flash.visible = true;
    this.flashT = 0.033;
    this.light.position.copy(p);
    this.light.intensity = 6;
    this.lightT = 0.05;
  }

  /** Bullet streak from `from` along `dir` for `len` m (rifles). */
  tracer(from: Vector3, dir: Vector3, len: number) {
    const i = this.tNext;
    this.tNext = (i + 1) % TRACERS;
    from.toArray(this.tFrom, i * 3);
    dir.toArray(this.tDir, i * 3);
    this.tLen[i] = len;
    this.tLife[i] = 0.06;
  }

  /** Pooled decal (oldest recycled), flat on the surface. */
  decal(p: Vector3, n: Vector3, surface: Surface, size = 0.12) {
    const i = this.dNext;
    this.dNext = (i + 1) % DECALS;
    _q.setFromUnitVectors(_z, n);
    _p.copy(p).addScaledVector(n, 0.01);
    _s.set(size, size, 1);
    _m.compose(_p, _q, _s);
    this.decals.setMatrixAt(i, _m);
    this.decals.setColorAt(i, _c.set(DECAL_COLOR[surface]));
    this.decals.instanceMatrix.needsUpdate = true;
    this.decals.instanceColor!.needsUpdate = true;
  }

  update(dt: number) {
    if (this.flashT > 0 && (this.flashT -= dt) <= 0) this.flash.visible = false;
    if (this.lightT > 0) {
      this.lightT -= dt;
      this.light.intensity = Math.max(0, (this.lightT / 0.05) * 6);
    }
    let any = false;
    for (let i = 0; i < PARTICLES; i++) {
      if (this.pLife[i] <= 0) continue;
      any = true;
      this.pLife[i] -= dt;
      const j = i * 3;
      if (this.pLife[i] <= 0) {
        _m.makeScale(0, 0, 0);
        this.parts.setMatrixAt(i, _m);
        continue;
      }
      this.pVel[j + 1] -= this.pGrav[i] * dt;
      this.pPos[j] += this.pVel[j] * dt;
      this.pPos[j + 1] += this.pVel[j + 1] * dt;
      this.pPos[j + 2] += this.pVel[j + 2] * dt;
      if (this.pPos[j + 1] < 0.01 && this.pGrav[i] > 0) {
        this.pPos[j + 1] = 0.01;
        this.pVel[j] *= 0.5;
        this.pVel[j + 2] *= 0.5;
        this.pVel[j + 1] *= -0.3;
      }
      const t = this.pLife[i] / this.pMax[i];
      const grow = this.pGrav[i] < 0 ? 1 + (1 - t) * 2.5 : 0.4 + 0.6 * t; // smoke grows, chips shrink
      const sz = this.pSize[i] * grow;
      this.pSpin[i] += dt * 8;
      _q.setFromAxisAngle(_v.set(0.3, 1, 0.2).normalize(), this.pSpin[i]);
      _m.compose(_p.set(this.pPos[j], this.pPos[j + 1], this.pPos[j + 2]), _q, _s.set(sz, sz, sz));
      this.parts.setMatrixAt(i, _m);
    }
    if (any) {
      this.parts.instanceMatrix.needsUpdate = true;
      this.parts.instanceColor!.needsUpdate = true;
    }
    let anyS = false;
    for (let i = 0; i < SMOKE; i++) {
      if (this.sLife[i] <= 0) continue;
      anyS = true;
      this.sLife[i] -= dt;
      const j = i * 3;
      if (this.sLife[i] <= 0) {
        _m.makeScale(0, 0, 0);
      } else {
        const damp = Math.max(0, 1 - dt * 2.5);
        this.sVel[j] *= damp;
        this.sVel[j + 2] *= damp;
        this.sPos[j] += this.sVel[j] * dt;
        this.sPos[j + 1] += this.sVel[j + 1] * dt;
        this.sPos[j + 2] += this.sVel[j + 2] * dt;
        const age = 1 - this.sLife[i];
        const sz = 0.03 + age * 0.14;
        _q.setFromAxisAngle(_v.set(0.3, 1, 0.2).normalize(), i + age);
        _m.compose(_p.set(this.sPos[j], this.sPos[j + 1], this.sPos[j + 2]), _q, _s.set(sz, sz, sz));
      }
      this.smokeMesh.setMatrixAt(i, _m);
    }
    if (anyS) this.smokeMesh.instanceMatrix.needsUpdate = true;
    let anyT = false;
    for (let i = 0; i < TRACERS; i++) {
      if (this.tLife[i] <= 0) continue;
      anyT = true;
      this.tLife[i] -= dt;
      if (this.tLife[i] <= 0) {
        _m.makeScale(0, 0, 0);
      } else {
        _v.fromArray(this.tDir, i * 3);
        _p.fromArray(this.tFrom, i * 3);
        // Streak travels: head moves 60 % of the path per 30 ms.
        const k = 1 - this.tLife[i] / 0.06;
        _p.addScaledVector(_v, this.tLen[i] * k * 0.7);
        _q.setFromUnitVectors(_z, _v.negate());
        _m.compose(_p, _q, _s.set(0.02, 0.02, Math.min(this.tLen[i] * 0.3, 12)));
      }
      this.tracers.setMatrixAt(i, _m);
    }
    if (anyT) this.tracers.instanceMatrix.needsUpdate = true;
  }
}

declare module '../ctx' {
  interface Ctx {
    fx: Fx;
  }
}
