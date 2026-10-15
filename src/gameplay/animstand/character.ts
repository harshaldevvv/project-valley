import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  AnimationUtils,
  BoxGeometry,
  CapsuleGeometry,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  Object3D,
  Quaternion,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hasAsset } from '../../engine/assets';
import { loadModel, type ModelInstance } from '../../engine/models';
import { paintGeometry, paletteMaterial } from '../../engine/palette';

/**
 * Character visuals for the player, zombies and the animation stand.
 * Uses engine `loadModel(id)` (skinned GLB: root, mixer, actions, sockets) when it exists and the asset is built;
 * otherwise a 3-mesh placeholder (body, head, arms) posed procedurally from the same clip names.
 */
/** Real (built) model instance from the engine, or null when the asset isn't built yet (we use our own posable placeholder). */
export async function tryLoadModel(id: string): Promise<ModelInstance | null> {
  if (!hasAsset(id)) return null;
  const proto = await loadModel(id);
  return proto.placeholder ? null : proto.create();
}

export interface Pose {
  walkPhase: number;
  speed01: number; // 0 idle .. 1 jog .. 1.6 sprint
  crouch: number; // 0..1
  armRaise: number; // 0..1 (zombie reach / aim)
  lean: number; // rad forward
  headBack: number; // rad, headshot snap
  flinch: number; // rad side twist
  fall: number; // 0..1 death topple
  swing: number; // -1..1 melee arc
  hold: 'none' | 'pistol' | 'rifle' | 'knife';
  holster: number; // 0 drawn .. 1 holstered (weapon lowered out of view)
  kick: number; // recoil kick 0..1
  aimPitch: number; // rad, arms follow the view pitch when holding a weapon
}
export const newPose = (): Pose => ({
  walkPhase: 0, speed01: 0, crouch: 0, armRaise: 0, lean: 0, headBack: 0, flinch: 0, fall: 0, swing: 0, hold: 'none', holster: 0, kick: 0, aimPitch: 0,
});

export interface Character {
  root: Object3D; // feet at origin, faces -Z
  hand: Object3D; // SOCKET_hand_R (weapon parent)
  skinned: boolean;
  mixer: AnimationMixer | null;
  actions: Map<string, AnimationAction>;
  clips: string[];
  /** Placeholder parts (null when skinned). */
  /** Survivors have separate arms (armL set) for two-handed holds; zombies share one merged arms mesh. */
  parts: { body: Object3D; head: Object3D; arms: Object3D; armL: Object3D | null; legs: Object3D } | null;
  pose: Pose;
}

const SURVIVOR_CLIPS = ['idle', 'walk', 'run', 'sprint', 'crouch_idle', 'crouch_walk', 'jump', 'fall', 'land', 'aim_pistol', 'aim_rifle', 'fire_pistol', 'fire_rifle', 'reload_pistol', 'reload_rifle', 'melee_swing', 'shove', 'hit_react', 'death', 'drive_sit', 'interact_search', 'draw_pistol', 'draw_rifle', 'holster', 'holster_rifle', 'melee_heavy'];
const ZOMBIE_CLIPS = ['z_idle', 'z_walk', 'z_run', 'z_attack', 'z_grab', 'z_hit', 'z_stagger', 'z_death', 'z_crawl'];
export const clipNames = (kind: 'survivor' | 'zombie') => (kind === 'survivor' ? SURVIVOR_CLIPS : ZOMBIE_CLIPS);

const geoCache = new Map<string, BufferGeometry[]>();
function placeholderGeos(kind: 'survivor' | 'zombie') {
  let g = geoCache.get(kind);
  if (g) return g;
  const s = kind === 'zombie' ? 'zombie_skin' : 'skin_3';
  const c = kind === 'zombie' ? 'cloth_grey' : 'cloth_olive';
  const p = kind === 'zombie' ? 'leather_brown' : 'cloth_denim';
  // Body: torso (pivot at hips, y=0.95) — legs are a separate mesh so they can stride.
  const body = paintGeometry(new CapsuleGeometry(0.22, 0.42, 4, 10).translate(0, 0.36, 0), c);
  const head = paintGeometry(new SphereGeometry(0.13, 12, 8).translate(0, 0.12, 0), s);
  const armL = paintGeometry(new BoxGeometry(0.1, 0.62, 0.1).translate(-0.3, -0.27, 0), c);
  const armR = paintGeometry(new BoxGeometry(0.1, 0.62, 0.1).translate(0.3, -0.27, 0), c);
  const handL = paintGeometry(new BoxGeometry(0.09, 0.1, 0.09).translate(-0.3, -0.62, 0), s);
  const handR = paintGeometry(new BoxGeometry(0.09, 0.1, 0.09).translate(0.3, -0.62, 0), s);
  const legL = paintGeometry(new BoxGeometry(0.15, 0.92, 0.17).translate(-0.11, -0.46, 0), p);
  const legR = paintGeometry(new BoxGeometry(0.15, 0.92, 0.17).translate(0.11, -0.46, 0), p);
  g = kind === 'zombie' ? [body, head, mergeGeometries([armL, armR, handL, handR])!, legL, legR] : [body, head, mergeGeometries([armR, handR])!, legL, legR, mergeGeometries([armL, handL])!];
  geoCache.set(kind, g);
  return g;
}

export async function makeCharacter(kind: 'survivor' | 'zombie', modelId: string, clipsFrom?: string): Promise<Character> {
  const m = await tryLoadModel(modelId);
  if (m) {
    const actions = m.actions;
    // Mesh-only variants play another model's clips (identical skeletons bind by bone name)
    if (!actions.size && clipsFrom && hasAsset(clipsFrom)) for (const clip of (await loadModel(clipsFrom)).clips) actions.set(clip.name, m.mixer.clipAction(clip));
    let hand: Object3D | undefined = m.sockets.get('hand_R');
    if (!hand) m.root.traverse((o) => { if (!hand && o.name === 'SOCKET_hand_R') hand = o; });
    if (!hand) {
      hand = new Object3D();
      hand.position.set(0.3, 1.0, -0.2);
      m.root.add(hand);
    }
    m.root.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = true; });
    return { root: m.root, hand, skinned: true, mixer: m.mixer, actions, clips: [...actions.keys()], parts: null, pose: newPose() };
  }
  const mat = await paletteMaterial();
  const [bodyG, headG, armsG, legLG, legRG, armLG] = placeholderGeos(kind);
  const root = new Group();
  root.name = `${kind}_placeholder`;
  const hips = new Group(); // torso pivots here
  hips.position.y = 0.95;
  const body = new Mesh(bodyG, mat);
  const head = new Mesh(headG, mat);
  head.position.y = 0.86;
  const arms = new Mesh(armsG, mat);
  arms.position.y = 0.72; // shoulders
  const legs = new Group();
  legs.position.y = 0.95;
  const legL = new Mesh(legLG, mat);
  const legR = new Mesh(legRG, mat);
  legs.add(legL, legR);
  hips.add(body);
  body.add(head, arms);
  const armL = armLG ? new Mesh(armLG, mat) : null;
  if (armL) {
    armL.position.y = 0.72;
    armL.castShadow = true;
    body.add(armL);
  }
  root.add(hips, legs);
  for (const o of [body, head, arms, legL, legR]) o.castShadow = true;
  // Right hand socket at the end of the right arm; weapons hang here and point -Z.
  const hand = new Object3D();
  hand.name = 'SOCKET_hand_R';
  hand.position.set(0.3, -0.62, 0);
  arms.add(hand);
  return { root, hand, skinned: false, mixer: null, actions: new Map(), clips: [], parts: { body, head, arms, armL, legs }, pose: newPose() };
}

/** Procedural pose for the placeholder rig (zero allocations). */
export function applyPose(ch: Character) {
  const P = ch.parts;
  if (!P) return;
  const p = ch.pose;
  const s = Math.min(1.6, p.speed01);
  const stride = Math.sin(p.walkPhase) * 0.55 * Math.min(1, s);
  const legs = P.legs.children;
  legs[0].rotation.x = stride;
  legs[1].rotation.x = -stride;
  const hips = P.body.parent!;
  const crouchDrop = p.crouch * 0.4;
  hips.position.y = 0.95 - crouchDrop + Math.abs(Math.cos(p.walkPhase)) * 0.03 * s;
  P.legs.position.y = 0.95 - crouchDrop;
  legs[0].rotation.x += p.crouch * 0.9;
  legs[1].rotation.x += p.crouch * 0.4;
  hips.rotation.x = -p.lean - s * 0.12 - p.crouch * 0.3;
  hips.rotation.y = p.flinch + p.swing * 0.5;
  P.head.rotation.x = p.headBack - hips.rotation.x * 0.5;
  // Arms: hanging/swinging, raised for reach/aim, lowered while holstering.
  let armX = -stride * 0.6;
  // +X rotation swings the hanging arm forward (character faces -Z)
  if (p.hold !== 'none') armX = Math.PI / 2 - 0.05 - p.holster * 1.1 + p.kick * 0.25;
  armX = armX + (Math.PI / 2 - armX) * p.armRaise;
  if (p.hold === 'knife') armX += p.swing * 0.4;
  if (p.hold !== 'none') armX += p.aimPitch * (1 - p.holster);
  P.arms.rotation.x = armX - hips.rotation.x; // aim stays level when the torso leans
  P.arms.rotation.z = 0;
  if (P.armL) {
    // Left arm: supports the gun (rifle: reaches the handguard, pistol: two-hand grip), else mirrors the stride
    const two = p.hold === 'rifle' || p.hold === 'pistol';
    P.armL.rotation.x = two ? armX - hips.rotation.x - (p.hold === 'rifle' ? 0.15 : 0) : (p.hold === 'knife' ? stride * 0.6 : armX - hips.rotation.x);
    P.armL.rotation.y = 0;
    P.armL.rotation.z = two ? (p.hold === 'rifle' ? 0.5 : 0.4) * (1 - p.holster) : 0;
    P.arms.rotation.z = p.hold === 'pistol' ? -0.2 * (1 - p.holster) : 0;
  }
}

/**
 * AnimationController for skinned characters: locomotion crossfade by speed, crouch set, additive upper-body overlays
 * (aim/fire/reload), one-shots. Missing clips are skipped (asset-builder delivers them over time).
 */
const UPPER = /spine|chest|neck|head|shoulder|clavicle|arm|hand|finger|thumb|index|socket/i;
export class AnimationController {
  private current: AnimationAction | null = null;
  private overlays = new Map<string, AnimationAction>();
  private oneShot: AnimationAction | null = null;
  private hold = false;

  constructor(private ch: Character) {
    const mixer = ch.mixer;
    if (!mixer) return;
    const idle = ch.actions.get('idle')?.getClip();
    for (const name of ['aim_pistol', 'aim_rifle', 'fire_pistol', 'fire_rifle', 'reload_pistol', 'reload_rifle', 'draw_pistol', 'draw_rifle', 'holster', 'holster_rifle']) {
      const a = ch.actions.get(name);
      if (!a || !idle) continue;
      const clip = upperOnly(a.getClip());
      // aim_* is relative to idle; fire/reload/draw/holster are relative to their aim pose so they stack on it
      const ref = name.startsWith('aim_') ? idle : (ch.actions.get(name.includes('pistol') || name === 'holster' ? 'aim_pistol' : 'aim_rifle')?.getClip() ?? idle);
      AnimationUtils.makeClipAdditive(clip, 0, upperOnly(ref));
      const act = mixer.clipAction(clip);
      act.blendMode = 2501; // AdditiveAnimationBlendMode
      act.setEffectiveWeight(0);
      act.play();
      this.overlays.set(name, act);
    }
  }

  /** Base locomotion/state clip with crossfade. */
  base(name: string, fade = 0.2, timeScale = 1, force = false) {
    const a = this.ch.actions.get(name);
    if (!a) return;
    if (this.hold && !force) return;
    if (this.hold && this.oneShot) {
      // leaving a held pose (respawn): fade it out
      this.oneShot.fadeOut(fade);
      this.oneShot = null;
      this.hold = false;
      this.current = null;
    }
    a.timeScale = timeScale;
    if (a === this.current) return;
    a.reset().setLoop(LoopRepeat, Infinity).play();
    if (this.current) a.crossFadeFrom(this.current, fade, true);
    this.current = a;
  }

  /** Overlay weight 0..1 (aim) or restart (fire/reload). */
  overlay(name: string, weight: number, restart = false) {
    const a = this.overlays.get(name);
    if (!a) return;
    a.setEffectiveWeight(weight);
    if (restart) a.reset().setLoop(LoopOnce, 1).play();
  }

  /** Full-body one-shot (death, shove, melee); returns to base afterwards unless `hold` (death). */
  oneshot(name: string, fade = 0.1, hold = false) {
    const a = this.ch.actions.get(name);
    if (!a) return;
    if (this.oneShot && this.oneShot !== a) this.oneShot.fadeOut(fade);
    a.reset().setLoop(LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    if (this.current) a.crossFadeFrom(this.current, fade, false);
    this.oneShot = a;
    this.hold = hold;
  }

  /**
   * A bone gameplay rotates on top of the clips (aim pitch, flinch). Its clip pose is restored before each mixer
   * update, so offsets never accumulate on bones a clip doesn't key.
   */
  bone(name: string): Object3D | null {
    const b = this.ch.root.getObjectByName(name) ?? null;
    if (b) this.procedural.push({ bone: b, q: b.quaternion.clone() });
    return b;
  }
  private procedural: { bone: Object3D; q: Quaternion }[] = [];
  /** Put procedural bones back to their clip pose (frames where the mixer isn't stepped). */
  restoreBones() {
    for (const p of this.procedural) p.bone.quaternion.copy(p.q);
  }

  update(dt: number) {
    for (const p of this.procedural) p.bone.quaternion.copy(p.q);
    this.updateMixer(dt);
    for (const p of this.procedural) p.q.copy(p.bone.quaternion);
  }

  private updateMixer(dt: number) {
    if (this.oneShot && !this.hold && !this.oneShot.isRunning() && this.current) {
      this.current.reset().play().crossFadeFrom(this.oneShot, 0.15, false);
      this.oneShot = null;
    }
    this.ch.mixer?.update(dt);
  }
}

function upperOnly(clip: AnimationClip) {
  const c = clip.clone();
  c.tracks = c.tracks.filter((t) => UPPER.test(t.name.split('.')[0]));
  return c;
}
