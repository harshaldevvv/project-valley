import { AnimationAction, AnimationClip, LoopOnce, LoopRepeat, Matrix4, Object3D, type AnimationMixer } from 'three';
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
    this.pivot.add(m.root);
    this.mixer = m.mixer;
    for (const c of proto.clips) {
      this.clips.set(c.name, c);
      this.actions.set(c.name, m.actions.get(c.name)!);
    }
    for (const [k, v] of m.sockets) this.sockets.set(k, v);
    this.ready = true;
  }

  /** Parent a first-person weapon model into the right hand (identity) and prepare its held-magazine double. */
  attach(id: string, kind: FpKind, w: WeaponModel) {
    const sock = this.sockets.get(kind === 'knife' ? 'knife' : 'weapon');
    if (!sock) return;
    sock.add(w.root);
    w.root.position.set(0, 0, 0);
    w.root.rotation.set(0, 0, 0);
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

  update(dt: number, ads: number, itemId: string | null) {
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
    if (itemId) this.magChoreo(itemId);
  }
}
