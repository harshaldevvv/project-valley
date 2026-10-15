/**
 * Player feel numbers (principles §2, §4). All live-tunable from the F1 debug menu ("Player", "Camera", "Feel").
 */
export const movement = {
  walk: 1.6, // m/s (unused by default input; kept for gamepad half-tilt)
  jog: 3.5,
  sprint: 5.75,
  crouch: 1.5,
  adsMul: 0.6,
  accelTime: 0.13, // s, 0 -> jog
  stopTime: 0.1, // s, jog -> 0
  sprintRamp: 0.25, // s, jog -> sprint
  airControl: 0.25,
  gravity: 18, // m/s² (snappier than 9.81 for a character; bullets use 9.81)
  jumpVelocity: 4.6, // ≈0.6 m hop: obstacles over that need a vault
  coyote: 0.1,
  jumpBuffer: 0.12,
  // Capsule: radius + half-height; crouch lowers it.
  radius: 0.3,
  halfHeight: 0.6, // standing total 1.8 m
  crouchHalfHeight: 0.3, // crouched total 1.2 m
  eyeStand: 1.62,
  eyeCrouch: 1.05,
  maxSlopeDeg: 50,
  stepHeight: 0.55, // QA-003: the house foundation lip is 0.5 m
  // Vault: obstacles 0.5–1.3 m tall, ≤ 0.6 m thick, 0.4–0.6 s.
  vaultMin: 0.5,
  vaultMax: 1.3,
  vaultMaxThick: 0.6,
  vaultTime: 0.5,
  vaultReach: 0.8, // how far ahead the obstacle may be
  // Footsteps: stride length (m) per step sound + noise radius per gait (principles §6 hearing table).
  stride: 1.4,
  noiseSprint: 15,
  noiseJog: 8,
  noiseWalk: 4,
  noiseCrouch: 2,
  landNoise: 6,
  hardLandSpeed: 7, // fall speed for the landing dip + sound
};

export const stamina = {
  max: 100,
  sprintPerSec: 12,
  jump: 10,
  vault: 10,
  shove: 15,
  melee: 12,
  regenPerSec: 20,
  regenDelay: 1.0,
  exhaustedUntil: 30, // at 0: no sprint until back to this
};

export const health = {
  max: 100,
  respawnDelay: 3,
  hitIframes: 0.35, // s of invulnerability after taking a hit
};

export const cameraFeel = {
  // Third person (principles §2)
  shoulderX: 0.5,
  shoulderY: 0.15,
  shoulderXAds: 0.65, // ADS pulls the camera further over the shoulder so the head clears the reticle
  armHip: 2.6,
  armAds: 1.2,
  fovHip: 70,
  fovAdsMul: 0.8, // irons ×0.8 (TP ADS uses 55° via this * 70 ≈ 56)
  collisionRadius: 0.2,
  easeOut: 0.3, // s to ease back out after a collision snap-in
  shoulderSwap: 0.2, // s
  collapseIn: 0.6, // m camera-to-eye: below this the TP camera switches to the eye (QA-001)
  collapseOut: 0.8, // hysteresis
  deathCamHeight: 4.5,
  // First person
  fovFp: 85,
  headBob: true,
  headBobAmp: 0.025, // m
  swayLag: 0.07, // s weapon sway lag
  // Juice (principles §4)
  shake: 0.7, // 0..1 slider, default 70 %
  traumaDecay: 1.5, // per s
  maxShakeDeg: 3,
  fovKickRecover: 0.12, // s
  hurtTrauma: 0.4,
};
