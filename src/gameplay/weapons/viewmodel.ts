import { AnimationAction, AnimationClip, BufferAttribute, Color, DoubleSide, Euler, LoopOnce, LoopRepeat, Material, Matrix4, MeshStandardMaterial, Object3D, Quaternion, Vector3, type AnimationMixer, type SkinnedMesh } from 'three';
import { hasAsset } from '../../engine/assets';
import { loadModel } from '../../engine/models';
import { fpArms as F } from '../../content/data/weapons';
import type { WeaponModel } from './models';

/**
 * First-person arms (chr_arms_fp, QA-006). The rig hangs from the camera with an identity transform; weapons sit in
 * SOCKET_weapon / SOCKET_knife with identity. Base = idle↔ads blend; one-shots (fire, reload, draw, holster, knife,
 * shove, interact) override it, scaled to gameplay timings. Left-arm-only clips (shove, interact) play over a copy of
 * the base with its *_L tracks stripped. Code adds sway/bob/kick on a pivot (ADS fire has no clip).
 */
const _wq = new Quaternion();
const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _t = new Vector3(), _u = new Vector3(), _p = new Vector3(), _n = new Vector3();
const _pole = new Vector3();
const _q1 = new Quaternion(), _q2 = new Quaternion(), _q3 = new Quaternion();

/** Swing bone `bone` (world) so the direction to `from` points at `to`, keeping its roll. */
function aim(bone: Object3D, child: Object3D, to: Vector3) {
  bone.updateWorldMatrix(true, false);
  child.getWorldPosition(_n);
  bone.getWorldPosition(_u);
  _q1.setFromUnitVectors(_n.sub(_u).normalize(), _p.copy(to).sub(_u).normalize());
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(_q1);
  (bone.parent ? bone.parent.getWorldQuaternion(_q3).invert() : _q3.identity()).multiply(_q2);
  bone.quaternion.copy(_q3);
  bone.updateWorldMatrix(false, true);
}
/** Two-bone IK for the left arm: elbow keeps the side it had in the clip, pulled toward `pole` (world dir) when given. */
function reach(A: Object3D, B: Object3D, C: Object3D, target: Vector3, pole?: Vector3) {
  A.updateWorldMatrix(true, true);
  A.getWorldPosition(_a); B.getWorldPosition(_b); C.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  const d = Math.min(Math.max(_a.distanceTo(target), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  _u.copy(target).sub(_a).normalize();
  _p.copy(_b).sub(_a);
  _p.addScaledVector(_u, -_p.dot(_u));
  if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0);
  _p.normalize();
  if (pole) {
    _p.add(pole);
    _p.addScaledVector(_u, -_p.dot(_u));
    if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0);
    _p.normalize();
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _t.copy(_a).addScaledVector(_u, a).addScaledVector(_p, h); // new elbow
  const tip = _c.copy(_a).addScaledVector(_u, d);
  const elbow = _t.clone();
  aim(A, B, elbow);
  aim(B, C, tip);
}
const _we = new Euler();

export type FpKind = 'pistol' | 'rifle' | 'knife';

interface Held {
  pivot: Object3D; // under SOCKET_mag_L
  weaponMag: Object3D | null;
}

export class Viewmodel {
  /** Child of the camera; code-driven sway/bob/kick go here. */
  readonly pivot = new Object3D();
  private mixer!: AnimationMixer;
  private clips = new Map<string, AnimationClip>();
  private actions = new Map<string, AnimationAction>();
  private noL = new Map<string, AnimationAction>();
  private sockets = new Map<string, Object3D>();
  socket(name: string) {
    return this.sockets.get(name) ?? null;
  }
  private kind: FpKind = 'rifle';
  private idle: AnimationAction | null = null;
  private ads: AnimationAction | null = null;
  private idleNoL: AnimationAction | null = null;
  private adsNoL: AnimationAction | null = null;
  private shot: AnimationAction | null = null;
  private shotW = 0;
  private leftOnly = false;
  private held = new Map<string, Held>();
  private support = new Map<string, Object3D | null>(); // per gun: its SOCKET_support (the left-hand point)
  private weaponRoots = new Map<string, Object3D>();
  ready = false;

  async init(camera: Object3D) {
    camera.add(this.pivot);
    if (!hasAsset(F.model)) return;
    const proto = await loadModel(F.model);
    if (proto.placeholder) return;
    const m = proto.create();
    m.root.traverse((o) => {
      o.castShadow = false;
      o.frustumCulled = false;
    });
    this.splitHands(m.root);
    this.pivot.add(m.root);
    this.mixer = m.mixer;
    for (const c of proto.clips) {
      this.clips.set(c.name, c);
      this.actions.set(c.name, m.actions.get(c.name)!);
    }
    for (const [k, v] of m.sockets) this.sockets.set(k, v);
    this.ready = true;
  }

  private armMesh: SkinnedMesh | null = null;
  private armMat: Material | null = null;
  private look: Material[] = [];
  /** Two draw groups on the arms mesh: 0 = forearm/sleeve, 1 = hand and fingers, so sleeves and gloves can be recoloured. */
  private splitHands(root: Object3D) {
    root.traverse((o) => {
      const mesh = o as SkinnedMesh;
      if (this.armMesh || !mesh.isSkinnedMesh || !mesh.geometry.index) return;
      const g = mesh.geometry;
      const handBone = mesh.skeleton.bones.map((b) => /hand|finger|thumb/.test(b.name));
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      const handness = (v: number) => {
        let h = 0;
        for (let k = 0; k < 4; k++) if (handBone[si.getComponent(v, k)]) h += sw.getComponent(v, k);
        return h;
      };
      const idx = g.index!.array, arm: number[] = [], hand: number[] = [];
      for (let i = 0; i < idx.length; i += 3) {
        const h = (handness(idx[i]) + handness(idx[i + 1]) + handness(idx[i + 2])) / 3;
        (h > 0.5 ? hand : arm).push(idx[i], idx[i + 1], idx[i + 2]);
      }
      g.setIndex(new BufferAttribute(idx instanceof Uint32Array ? new Uint32Array([...arm, ...hand]) : new Uint16Array([...arm, ...hand]), 1));
      g.clearGroups();
      g.addGroup(0, arm.length, 0);
      g.addGroup(arm.length, hand.length, 1);
      this.armMesh = mesh;
      this.armMat = mesh.material as Material;
      this.armMat.side = DoubleSide; // the open wrist / elbow ends are seen from inside at steep pitch: never see-through
      mesh.material = this.look = [this.armMat, this.armMat];
    });
  }
  /** Recolour the sleeve and/or the hands (css colours); null restores the original look. */
  setLook(sleeve: string | null, glove: string | null) {
    if (!this.armMesh || !this.armMat) return;
    const mk = (c: string | null, old: Material | undefined) => {
      if (old && old !== this.armMat) old.dispose();
      return c ? new MeshStandardMaterial({ color: new Color(c), roughness: 0.9, side: DoubleSide }) : this.armMat!;
    };
    this.look = [mk(sleeve, this.look[0]), mk(glove, this.look[1])];
    this.armMesh.material = this.look;
  }

  /** Parent a first-person weapon model into the right hand (identity) and prepare its held-magazine double. */
  attach(id: string, kind: FpKind, w: WeaponModel) {
    const sock = this.sockets.get(kind === 'knife' ? 'knife' : 'weapon');
    if (!sock) return;
    sock.add(w.root);
    w.root.position.set(0, 0, 0);
    w.root.rotation.set(0, 0, 0);
    this.support.set(id, w.sockets?.get('support') ?? null);
    this.weaponRoots.set(id, w.root);
    const magL = this.sockets.get('mag_L');
    const wMagSock = w.sockets?.get('mag');
    if (kind === 'knife' || !magL || !w.mag || !wMagSock) return;
    // local = inverse(weapon SOCKET_mag) * MAG, both relative to the weapon root
    w.root.updateMatrixWorld(true);
    const inv = new Matrix4().copy(w.root.matrixWorld).invert();
    const sockRel = new Matrix4().multiplyMatrices(inv, wMagSock.matrixWorld);
    const magRel = new Matrix4().multiplyMatrices(inv, w.mag.matrixWorld);
    const pivot = new Object3D();
    const copy = w.mag.clone();
    copy.matrixAutoUpdate = true;
    new Matrix4().copy(sockRel).invert().multiply(magRel).decompose(copy.position, copy.quaternion, copy.scale);
    pivot.add(copy);
    pivot.visible = false;
    magL.add(pivot);
    this.held.set(id, { pivot, weaponMag: w.mag });
  }

  /** Switch the base pose to a weapon class. */
  setKind(kind: FpKind) {
    if (!this.ready || (kind === this.kind && this.idle)) return;
    this.kind = kind;
    for (const a of [this.idle, this.ads, this.idleNoL, this.adsNoL]) a?.stop();
    this.idle = this.base(`fp_${kind}_idle`, false);
    this.ads = kind === 'knife' ? null : this.base(`fp_${kind}_ads`, false);
    this.idleNoL = this.base(`fp_${kind}_idle`, true);
    this.adsNoL = kind === 'knife' ? null : this.base(`fp_${kind}_ads`, true);
  }

  private base(name: string, stripL: boolean) {
    let a = stripL ? this.noL.get(name) : this.actions.get(name);
    if (!a && stripL) {
      const c = this.clips.get(name);
      if (!c) return null;
      const clip = c.clone();
      clip.name = name + '_noL';
      clip.tracks = clip.tracks.filter((t) => !/_L(\.|$)/.test(t.name.split('.')[0] + '.'));
      a = this.mixer.clipAction(clip);
      this.noL.set(name, a);
    }
    if (!a) return null;
    a.setLoop(LoopRepeat, Infinity).play();
    a.setEffectiveWeight(0);
    return a;
  }

  /** One-shot clip scaled to last `seconds` (or played at `timeScale`); fire/reload/draw/holster/knife/shove/interact. */
  play(name: string, opts: { seconds?: number; timeScale?: number; leftOnly?: boolean } = {}) {
    if (!this.ready) return;
    const a = this.actions.get(name);
    if (!a) return;
    if (this.shot && this.shot !== a) this.shot.stop();
    const dur = this.clips.get(name)!.duration;
    a.reset().setLoop(LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = opts.seconds ? dur / Math.max(0.05, opts.seconds) : (opts.timeScale ?? 1);
    a.play();
    this.shot = a;
    this.shotW = Math.max(this.shotW, 0.5);
    this.leftOnly = !!opts.leftOnly;
  }

  stop() {
    this.shot?.stop();
    this.shot = null;
    this.shotW = 0;
    for (const h of this.held.values()) {
      h.pivot.visible = false;
      if (h.weaponMag) h.weaponMag.visible = true;
    }
  }

  /** Time (s, authored) into the current one-shot, or -1. */
  shotTime(name: string) {
    return this.shot && this.shot.getClip().name === name ? this.shot.time : -1;
  }

  /** Magazine choreography from reload clip events (data: fpArms.reloadEvents). */
  private magChoreo(id: string) {
    const ev = F.reloadEvents[this.kind];
    const held = this.held.get(id);
    if (!ev || !held) return;
    const t = this.shotTime(`fp_${this.kind}_reload`);
    let state: 'in' | 'hand' | 'gone' = 'in'; // where the magazine is: in the gun, in the left hand, dropped
    if (t >= 0) {
      if (t >= ev.magIn) state = 'in';
      else if (t >= ev.magGrab) state = 'hand';
      else if (t >= ev.magDrop) state = 'gone';
      else if (t >= ev.magOut) state = 'hand';
    }
    held.pivot.visible = state === 'hand';
    if (held.weaponMag) held.weaponMag.visible = state === 'in';
  }

  update(dt: number, ads: number, itemId: string | null, pump = 0) {
    if (!this.ready) return;
    const fadeK = Math.min(1, dt / F.fade);
    if (this.shot) {
      const done = !this.shot.isRunning() || this.shot.time >= this.shot.getClip().duration - 1e-3;
      this.shotW += ((done ? 0 : 1) - this.shotW) * fadeK;
      if (done && this.shotW < 0.02) {
        this.shot.stop();
        this.shot = null;
        this.leftOnly = false;
      }
    }
    const sw = this.shot ? this.shotW : 0;
    const shotWeight = this.leftOnly ? 1 : sw; // left-only clips own the left arm fully; the right keeps the base
    this.shot?.setEffectiveWeight(shotWeight);
    const baseW = this.leftOnly ? 0 : 1 - sw;
    const noLW = this.leftOnly ? 1 : 0;
    this.idle?.setEffectiveWeight(baseW * (1 - ads));
    this.ads?.setEffectiveWeight(baseW * ads);
    this.idleNoL?.setEffectiveWeight(noLW * (this.ads ? 1 - ads : 1));
    this.adsNoL?.setEffectiveWeight(noLW * ads);
    if (!this.ads) this.idle?.setEffectiveWeight(baseW);
    this.mixer.update(dt);
    // Wrist re-pose (data: fpArms.wrist, radians in hand-bone space) applied after the clips, so the grip fingers follow.
    const wr = itemId ? F.wrist[itemId] : undefined;
    const hand = this.sockets.get('weapon')?.parent;
    if (wr && hand) hand.quaternion.multiply(_wq.setFromEuler(_we.set(wr[0], wr[1], wr[2])));
    if (itemId) this.leftHand(itemId, pump, ads);
    if (itemId) this.magChoreo(itemId);
  }

  /**
   * The arm clips put the left hand on the AK's handguard. Other long guns carry their own SOCKET_support; the hand is
   * moved by the difference (two-bone IK on the left arm) so it sits on the shotgun pump, rifle stock or SMG handguard.
   * `pump` (0..1..0) slides the hand back along the barrel and forward again (pump / bolt cycle).
   */
  private leftHand(itemId: string, pump: number, ads: number) {
    const sock = this.support.get(itemId), root = this.weaponRoots.get(itemId);
    const hand = this.sockets.get('support_L')?.parent, grip = this.sockets.get('support_L');
    if (!sock || !root || !hand || !grip || this.kind !== 'rifle' || this.leftOnly) return;
    // Reload / draw / holster clips move the left hand on purpose: the correction fades out under them (no pop at the end)
    const w = this.shot && /reload|draw|holster/.test(this.shot.getClip().name) ? 1 - this.shotW : 1;
    if (w < 0.01) return;
    const off = F.support[itemId] ?? [0, 0, 0];
    const hip = w * (1 - ads); // the roll and elbow pull are hip-only: the ADS clip already shows the hand on the handguard
    const roll = (F.supportRoll[itemId] ?? F.supportRoll.default) * hip;
    const forearm = hand.parent, upper = forearm?.parent;
    if (!forearm || !upper) return;
    this.pivot.updateMatrixWorld(true);
    const ref = F.supportRef;
    hand.getWorldPosition(_t); // where the clip put the hand: on the reference rifle's handguard
    _c.set(ref[0], ref[1], ref[2]).applyMatrix4(root.matrixWorld); // that point in the current gun's frame
    sock.getWorldPosition(_a);
    _a.sub(_c); // gun's own support point minus the reference point, in world space
    _b.set(off[0], off[1], off[2] + pump * F.pumpTravel).applyQuaternion(root.getWorldQuaternion(_q2)); // data offset + pump slide (metres: transformDirection would normalise it to 1 m)
    const shift = _a.add(_b).multiplyScalar(w);
    if (shift.lengthSq() < 1e-6 && Math.abs(roll) < 1e-3 && F.supportElbowDown * hip <= 1e-3) return;
    const target = _t.clone().add(shift);
    // Roll the hand around the barrel through the grip point: the clip's hand wraps the far side of the handguard, hidden
    // behind the gun; rolled under it, the palm and fingers show from the eye (data: fpArms.supportRoll)
    const handQ = hand.getWorldQuaternion(new Quaternion());
    if (Math.abs(roll) >= 1e-3) {
      const gp = grip.getWorldPosition(new Vector3()).add(shift);
      _wq.setFromAxisAngle(_u.set(0, 0, 1).transformDirection(root.matrixWorld), roll);
      target.sub(gp).applyQuaternion(_wq).add(gp);
      handQ.premultiply(_wq);
    }
    // Elbow pulled down (camera space) so the forearm rises from below the frame instead of ending in view (fpArms.supportElbowDown)
    const pole = F.supportElbowDown * hip > 1e-3 ? _pole.set(0, -1, 0).transformDirection(this.pivot.parent!.matrixWorld).multiplyScalar(F.supportElbowDown * hip) : undefined;
    reach(upper, forearm, hand, target, pole);
    forearm.getWorldQuaternion(_q3).invert();
    hand.quaternion.copy(_q3.multiply(handQ));
    hand.updateWorldMatrix(false, true);
  }
}
