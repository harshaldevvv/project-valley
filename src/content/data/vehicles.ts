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
  engineNoise: number;
  /** Chase camera */
  camDist: number;
  camHeight: number;
  camLag: number; // s
  doorReach: number;
  fallbackSize: [number, number, number];
}

/** One row per car model. A second car = a new row here + its model id; it spawns on the track automatically. */
export const vehicles: Record<string, VehicleDef & VehicleFeel> = {
  pickup_a: {
    id: 'pickup_a',
    model: 'veh_pickup_a',
    massKg: 1600,
    halfExtents: [0.95, 0.55, 2.5],
    wheelRadius: 0.38,
    suspensionRest: 0.35,
    suspensionStiffness: 30,
    suspensionDamping: 4.4,
    frictionSlip: 2.2,
    engineForce: 5200,
    brakeForce: 80,
    maxSteerDeg: 32,
    topSpeedKmh: 110,
    trunk: { w: 8, h: 5 },
    fuelLiters: 70,
    hp: 1000,
    steerAtSpeed: 0.35,
    steerRate: 2.5,
    handbrakeForce: 160,
    reverseKmh: 25,
    idleRate: 0.7,
    maxRate: 1.9,
    hornNoise: 60,
    rammingDamage: 18,
    engineNoise: 30,
    camDist: 7.5,
    camHeight: 2.8,
    camLag: 0.15,
    doorReach: 2.6,
    fallbackSize: [1.9, 1.6, 5],
  },
};
