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
  source?: string;
}

export const clipMeta: Record<string, Record<string, ClipMeta>> = {
  chr_survivor_a: survivorMeta as Record<string, ClipMeta>,
  zmb_shambler_a: zombieMeta as Record<string, ClipMeta>, // the zmb_* variants play these clips (same skeleton)
};

export const anim = {
  /** timeScale band for speed matching; outside it the next blend node takes over. */
  speedMatchClamp: [0.8, 1.25] as [number, number],
  /** 1D forward blend nodes (clip names; speeds come from clipMeta). */
  survivorForward: ['idle', 'walk', 'run', 'sprint'],
  survivorCrouch: ['crouch_idle', 'crouch_walk'],
  /** 2D aim/strafe set: [forward, back, left, right] per gait. */
  survivorStrafeWalk: ['walk', 'walk_back', 'strafe_left', 'strafe_right'],
  survivorStrafeRun: ['run', 'run_back', 'run_strafe_left', 'run_strafe_right'],
  survivorIdles: ['idle', 'idle_b', 'idle_c'],
  /** Zombie gait pools for spawn variety (pick one per instance, random start phase, timeScale 0.85–1.15). */
  zombieWalks: ['z_walk', 'z_walk_b', 'z_walk_c', 'z_walk_d', 'z_walk_limp', 'z_walk_limp_r', 'z_walk_drag', 'z_walk_drag_r', 'z_walk_drunk', 'z_walk_old', 'z_walk_bent'],
  zombieRuns: ['z_run', 'z_run_b'],
  zombieIdles: ['z_idle', 'z_idle_b', 'z_idle_c'],
  zombieTimeScale: [0.85, 1.15] as [number, number],
};
