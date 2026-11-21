import type { VehicleDef } from './types';

/** Driving feel that VehicleDef doesn't carry. */
export interface VehicleFeel {
  /** Steering at top speed as a fraction of maxSteerDeg (speed-sensitive steering). */
  steerAtSpeed: number;
  steerRate: number; // rad/s toward the target angle
  handbrakeForce: number;
  reverseKmh: number;
  idleRate: number; // engine loop playback rate at idle
  maxRate: number; // ... at top speed
  hornNoise: number; // m
  /** Damage dealt to a zombie per m/s of impact speed (150 HP shambler dies at ≈ 30 km/h). */
  rammingDamage: number;
  /** Zombie hits on the car: attackDamage × this (≈ 15–20 s for 3 attackers to kill the engine). */
  zombieDamageMul: number;
  /** Bullets that hit the car: weapon damage × this. */
  bulletDamageMul: number;
  /** Item that repairs the car to 100 % (and revives a dead engine), and the hold time. */
  repairItem: string;
  repairSeconds: number;
  /** Stability (QA-056): centre-of-mass drop below the chassis centre (m), roll damping (1/s), max roll rate (rad/s),
   * righting assist (rad/s²), extra damping in the air, auto-flip after this long on its side and slow (s). */
  comDrop: number;
  rollDamp: number;
  maxRollRate: number;
  rightingRate: number;
  airAngDamp: number;
  autoFlipS: number;
  engineNoise: number;
  /** Gearbox (drive feel, not a sim): top of each gear as a fraction of top speed, engine force × per gear, torque cut on a shift (s). */
  gears: number[];
  gearForce: number[];
  shiftCutS: number;
  /** Steering returns to centre this fast (rad/s) when you let go (faster than steering in). */
  steerReturnRate: number;
  /** Front share of the brake force (front-biased like a real car). */
  brakeFront: number;
  /** Tyre scrub: speed bled per (m/s of sideways slide) per second, as a fraction. */
  scrub: number;
  /** Body lean (cosmetic weight transfer, the wheels stay planted): degrees per g, cap, spring frequency (Hz), damping ratio. */
  leanPitchPerG: number;
  leanRollPerG: number;
  leanMaxDeg: number;
  leanHz: number;
  leanDamp: number;
  /** Skid sound: sideways slide (m/s) where the squeal starts and where it is full. */
  skidSlipMin: number;
  skidSlipFull: number;
  /** Crash: horizontal speed lost within 0.12 s above this (km/h) hurts the car (hp per km/h over) and shakes the camera. */
  crashMinKmh: number;
  crashHpPerKmh: number;
  /** Landing: a vertical speed above this (m/s) thumps (sound + camera). */
  landMinVy: number;
  /** Zombie hit: car speed kept (fraction), shove band below the lethal hit (from this m/s), corpse launch (m/s up + per m/s of car speed). */
  zombieHitKeep: number;
  zombieShoveMin: number;
  zombieLift: number;
  zombieLiftPerMs: number;
  /** Chase camera */
  camDist: number;
  camHeight: number;
  camLag: number; // s
  /** Heading follow lag (s): the camera trails the car's turn so you see it rotate. */
  camYawLag: number;
  /** Extra distance at top speed (m), look-ahead at top speed (m). */
  camDistAtSpeed: number;
  camLookAhead: number;
  /** FOV: base, extra at top speed, extra per g of forward acceleration, smoothing (s). */
  fovBase: number;
  fovAtSpeed: number;
  fovPerG: number;
  fovLag: number;
  doorReach: number;
  fallbackSize: [number, number, number];
}

/** One row per car model. A second car = a new row here + its model id; it spawns on the track automatically. */
export const vehicles: Record<string, VehicleDef & VehicleFeel> = {
  pickup_a: {
    id: 'pickup_a',
    model: 'veh_pickup_pf', // Polyfork pickup (CC BY 4.0, CREDITS.md); the original procedural truck is still in public/assets/models/veh/veh_pickup_a.glb
    massKg: 1600,
    halfExtents: [0.95, 0.55, 2.4],
    wheelRadius: 0.34,
    suspensionRest: 0.35,
    suspensionStiffness: 30,
    suspensionDamping: 4.4,
    frictionSlip: 2.2,
    engineForce: 5200,
    brakeForce: 62, // ≈ 0.9 g from 60 km/h (80 was 1.17 g: too grippy for a pickup)
    maxSteerDeg: 32,
    topSpeedKmh: 110,
    trunk: { w: 8, h: 5 },
    fuelLiters: 70,
    hp: 1000,
    steerAtSpeed: 0.25,
    steerRate: 2.5,
    handbrakeForce: 160,
    reverseKmh: 25,
    idleRate: 0.7,
    maxRate: 1.9,
    hornNoise: 60,
    rammingDamage: 18,
    zombieDamageMul: 3,
    bulletDamageMul: 0.25,
    repairItem: 'repair_kit',
    repairSeconds: 4,
    comDrop: 0.25,
    rollDamp: 3,
    maxRollRate: 1.2,
    rightingRate: 4,
    airAngDamp: 4,
    autoFlipS: 2,
    engineNoise: 30,
    gears: [0.22, 0.42, 0.66, 1],
    gearForce: [1, 0.8, 0.62, 0.48],
    shiftCutS: 0.16,
    steerReturnRate: 4.5,
    brakeFront: 0.6,
    scrub: 0.02,
    leanPitchPerG: 3,
    leanRollPerG: 4,
    leanMaxDeg: 5,
    leanHz: 1.8,
    leanDamp: 0.45,
    skidSlipMin: 1.6,
    skidSlipFull: 5,
    crashMinKmh: 12,
    crashHpPerKmh: 6,
    landMinVy: 2.5,
    zombieHitKeep: 0.9,
    zombieShoveMin: 1.5,
    zombieLift: 2.4,
    zombieLiftPerMs: 0.32,
    camDist: 7.5,
    camHeight: 2.8,
    camLag: 0.12,
    camYawLag: 0.22,
    camDistAtSpeed: 1.4,
    camLookAhead: 3,
    fovBase: 70,
    fovAtSpeed: 12,
    fovPerG: 4,
    fovLag: 0.25,
    doorReach: 2.6,
    fallbackSize: [1.9, 1.6, 5],
  },
};
