import { LOCKPICK } from '../content/data/containers';
import type { Rng } from '../engine/rng';

/**
 * Lockpick minigame rules, pure. The pick sits at an angle 0..180° across the top of the lock; a hidden
 * sweet spot decides how far the cylinder may turn. Turning past what the pick allows = stress -> the pick snaps.
 */
export interface LockState {
  /** Hidden sweet-spot angle and half-width, degrees. */
  sweet: number;
  half: number;
  /** Current pick angle, degrees (0 = right, 180 = left). */
  pick: number;
  /** Cylinder turn 0..1 (1 = open). */
  turn: number;
  /** Seconds of forcing. */
  stress: number;
}

export function newLock(difficulty: number, rng: Rng): LockState {
  const half = LOCKPICK.sweetHalfDeg[difficulty] ?? LOCKPICK.sweetHalfDeg[1];
  return { sweet: rng.range(10 + half, 170 - half), half, pick: 90, turn: 0, stress: 0 };
}

/** How far the cylinder may turn (0..1) at the current pick angle. */
export function allowedTurn(s: LockState): number {
  const err = Math.abs(s.pick - s.sweet);
  return err <= s.half ? 1 : Math.max(0, 1 - (err - s.half) / LOCKPICK.falloffDeg);
}

/** Advance; returns 'open' when the cylinder completes, 'broke' when the pick snaps (state resets for the next pick). */
export function stepLock(s: LockState, dt: number, turning: boolean): 'open' | 'broke' | null {
  if (!turning) {
    s.turn = Math.max(0, s.turn - LOCKPICK.returnSpeed * dt);
    s.stress = Math.max(0, s.stress - dt);
    return null;
  }
  const allowed = allowedTurn(s);
  if (s.turn < allowed) s.turn = Math.min(allowed, s.turn + LOCKPICK.turnSpeed * dt);
  else if (allowed < 1) {
    s.stress += dt;
    if (s.stress >= LOCKPICK.stressSeconds) {
      s.stress = 0;
      s.turn = 0;
      return 'broke';
    }
  }
  return s.turn >= 1 ? 'open' : null;
}
