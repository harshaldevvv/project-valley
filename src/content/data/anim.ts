/**
 * Animation data. Measured clip facts are written by the Blender retarget pipeline (tools/blender/retarget.py) into
 * ./anim/<asset>.json on every `npm run assets:build`; don't hand-edit those. Runtime tunables live below.
 *
 * Locomotion clips are in place, start at the left heel-strike (phase 0) and loop seamlessly. Play them at
 * timeScale = actualSpeed / clip.speed (clamped by `speedMatchClamp`) so planted feet don't skate.
 */
import survivorMeta from './anim/chr_survivor_a.json';
import zombieMeta from './anim/zmb_shambler_a.json';

export interface ClipMeta {
  /** Authored ground speed, m/s (loops only). */
  speed?: number;
  /** Loop length, s. */
  cycle?: number;
  /** Travel direction in the body frame: [x right, y forward]. */
  dir?: number[];
  /** One-shot length, s. */
  duration?: number;
  /** Turn-in-place: body yaw change over the clip, degrees (+ = left). Apply it to the capsule when the clip ends. */
  turn_deg?: number;
  /** Upper-body layer clip: mask it to spine, chest, neck, head, shoulders, arms, hands (+ SOCKET_*). */
  upperBody?: boolean;
  /** Loops: phase offset added to the shared phase so this clip's heel strikes line up with the survivor set. */
  phase?: number;
  source?: string;
}

export const clipMeta: Record<string, Record<string, ClipMeta>> = {
  chr_survivor_a: survivorMeta as Record<string, ClipMeta>,
  zmb_shambler_a: zombieMeta as Record<string, ClipMeta>, // the zmb_* variants play these clips (same skeleton)
};

export const anim = {
  /** timeScale band for speed matching; outside it the next blend node takes over. */
  speedMatchClamp: [0.8, 1.25] as [number, number],
  /** Per model: leg length / survivor leg length (clip ground speeds are measured on the survivor). chr_hero_pf 0.81 / 0.845 m. */
  strideScale: { chr_hero_pf: 0.96 } as Record<string, number>,
  /** Per model and clip, overrides strideScale where the measured foot travel differs (tools/audit/footratio.mjs:
   *  hero crouch_walk feet travel 0.88 of the body speed at 0.96). */
  strideScaleClip: { chr_hero_pf: { crouch_walk: 0.85, pf_run: 1 } } as Record<string, Record<string, number>>,
  /** Clips native to a model (not in the survivor meta), measured with tools/audit/clipmeasure.mjs on that model. */
  nativeMeta: {
    // Polyfork run: 5.56 m/s, high knees, 0.7 m arm swing; left strike at 0.025 vs the survivor run's 0.908
    pf_run: { speed: 5.56, cycle: 0.917, dir: [0, 1], phase: 0.117 },
  } as Record<string, ClipMeta>,
  /** Per model: blend node -> native clip that plays in its place (A5: pf_run sprints with real arm swing; the survivor
   *  jog clip at ts 1.55 swung the arms 0.15 m). pf_walk (0.86 m/s) and pf_idle (≈ ours) lost the compare. */
  nodeSwap: { chr_hero_pf: { sprint: 'pf_run' } } as Record<string, Record<string, string>>,
  /** 1D forward blend nodes (clip names; speeds come from clipMeta). */
  survivorForward: ['idle', 'walk', 'run', 'sprint'],
  survivorCrouch: ['crouch_idle', 'crouch_walk'],
  /** 2D aim/strafe set: [forward, back, left, right] per gait. */
  survivorStrafeWalk: ['walk', 'walk_back', 'strafe_left', 'strafe_right'],
  survivorStrafeRun: ['run', 'run_back', 'run_strafe_left', 'run_strafe_right'],
  survivorIdles: ['idle', 'idle_b', 'idle_c'],
  /** Aimed 2D set, orientation warping: forward/back clips cover ±warpFwdDeg around their axis (keyboard diagonals
   *  play forward/back with the hips twisted 45°), strafe clips the rest; clips cross-fade over warpBlendDeg at the edges. */
  warpFwdDeg: 52.5,
  warpBlendDeg: 10,
  /** Zombie gait pools for spawn variety (pick one per instance, random start phase, timeScale 0.85–1.15). */
  zombieWalks: ['z_walk', 'z_walk_b', 'z_walk_c', 'z_walk_d', 'z_walk_limp', 'z_walk_limp_r', 'z_walk_drag', 'z_walk_drag_r', 'z_walk_drunk', 'z_walk_old', 'z_walk_bent'],
  zombieRuns: ['z_run', 'z_run_b'],
  zombieIdles: ['z_idle', 'z_idle_b', 'z_idle_c'],
  zombieTimeScale: [0.85, 1.15] as [number, number],
};

/** Procedural pass after the mixer (gameplay/player/bodyPost.ts), live-tunable from F1 → Animation. */
export const animPost = {
  // Aim offsets: pitch/yaw split over spine, chest, neck (research §3.7)
  aimPitchSplit: [0.25, 0.45, 0.3] as [number, number, number],
  aimYawSplit: [0.3, 0.4, 0.3] as [number, number, number],
  aimPitchMaxDeg: 60,
  aimYawMaxDeg: 70,
  headLookDeg: 70,
  headPitchDeg: 40,
  // Lean (§3.8)
  leanTurn: 0.035, // roll rad per (m/s · rad/s)
  leanMaxDeg: 12,
  leanAccel: 0.012, // pitch rad per m/s²
  leanAccelMaxDeg: 8,
  leanHalflife: 0.15,
  // Foot IK + pelvis (§3.3)
  footIK: false,
  footIKMaxSpeed: 5,
  footIKReach: 0.3,
  pelvisMax: 0.25,
  pelvisHalflife: 0.06,
  // Foot locking: a foot that touches down is pinned in the world (two-bone IK) until it lifts, so the short
  // contact of the retargeted clips doesn't glide (tools/audit/footratio.mjs)
  footLock: true,
  footLockEnterH: 0.03, // m above the foot's lowest height in the clip: below this the foot counts as planted
  footLockExitExtra: 0.03, // m extra before a planted foot counts as lifted
  footLockMaxErr: 0.15, // m: safety release when the pinned foot drifts this far from where the clip wants it
  footLockMinHold: 0.07, // s a lock holds before the toe-off test runs (the landing glide is still fast)
  footLockReleaseSpeed: 1.6, // m/s: the clip's foot moving this fast over the ground = toe-off, release
  footLockMinSpeed: 0.2, // m/s body speed
  footLockMaxSpeed: 7.5,
  footLockInHL: 0.015, // s weight half-life when planting (near instant)
  footLockOutHL: 0.05, // s when lifting: the foot catches up with the clip over ~3 frames
  // Reactions: second-order springs (overshoot a little, then settle)
  reactHz: 4.5, // spring frequency for flinch + landing dip
  reactDamping: 0.45, // 1 = no overshoot
  flinchDeg: 9, // upper-body snap away from a hit (scaled by damage, cap ×1.6)
  landDipPerMps: 0.02, // m of pelvis dip per m/s of fall speed (0.012 read as ~1.5 cm on a hop; audit A10)
  landDipMax: 0.11,
  hitClipMaxSpeed: 0.5, // m/s: above this a hit is procedural only (the full-body clip would freeze the legs)
  landClipMaxSpeed: 1.5, // m/s horizontal: same for the hard-landing clip
  landClipMinFall: 6.5, // m/s fall: softer landings (a standing hop lands at ~4.6) get the procedural dip only, not the deep land squat (audit A10)
  accelSmoothHL: 0.04, // s: speed is smoothed before differentiating for the acceleration lean
  // Third-person melee swing layered on the hero's clip (driven by melee.swingVis: -1 wind-up .. +1 follow-through)
  meleeTwistDeg: 28, // chest + spine yaw at full wind-up / follow-through (light)
  meleeTwistHeavyDeg: 40,
  meleeArmDeg: 38, // right upper arm horizontal arc on top
  meleeDropDeg: 14, // chop: the arm drops through the follow-through
  meleeSwingHL: 0.03, // s smoothing (no pop when the wind-up starts)
  meleePauseLight: 0.07, // s the hero's swing stalls on contact (was hitstop × 0.7 ≈ 0.03, invisible)
  meleePauseHeavy: 0.1,
  // Turn in place (§3.5): threshold, the upper body absorbs the rest
  turnTriggerDeg: 80,
  // Third-person support hand (audit A13): the rifle clips put the left hand at the AK's mag well; two-bone IK moves the
  // wrist to the held gun's SOCKET_support (handguard / pump) plus this offset (gun-local m: x right, y up, z back)
  tpSupportOffset: [-0.02, -0.09, 0.03] as [number, number, number],
  tpSupportPole: [-0.4, -1, 0] as [number, number, number], // elbow pulled down and out (body space: x right, y up, z forward)
  tpSupportProtractDeg: 24, // left clavicle swung forward so the arm reaches further down the handguard
  tpSupportReach: 0.97, // share of the arm's length the wrist may be from the shoulder (a slight elbow bend stays)
  tpSupportMaxBack: 0.16, // m the wrist may slide back from the socket toward the receiver when the arm is short
  tpSupportLowReady: 1, // weight with the gun lowered (1 = the hand stays on the handguard), the raised gun is always 1
};
