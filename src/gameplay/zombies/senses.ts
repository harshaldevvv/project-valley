import { senses as S } from '../../content/data/zombies';

/**
 * Zombie perception (principles §6), pure: Unaware -> Suspicious -> Detected -> Searching.
 * Never jumps straight to Detected: hearing only raises suspicion and sends the zombie to look.
 */
export type Awareness = 'unaware' | 'suspicious' | 'detected' | 'searching';

export interface SenseState {
  awareness: Awareness;
  suspicion: number; // 0..1
  unseen: number; // s since the player was last seen while detected
  searchLeft: number; // s
}

export const newSenseState = (): SenseState => ({ awareness: 'unaware', suspicion: 0, unseen: 0, searchLeft: 0 });

/**
 * Suspicion gain per second from sight. 0 when outside the cone or range.
 * `stance` 1 standing / 0.6 crouched; `speed01` 0 = still .. 1 = jogging or faster.
 */
export function sightRate(dist: number, angleDeg: number, stance: number, speed01: number, night = false) {
  const range = (night ? S.rangeNight : S.rangeDay) * stance * (0.7 + 0.3 * Math.min(1, speed01));
  if (dist > range || angleDeg > S.coneDeg / 2) return 0;
  const t = dist / range;
  return 1 / (S.buildNear + (S.buildFar - S.buildNear) * t);
}

/** Advance awareness one step. `sight` = rate from sightRate (0 if no LOS); `heard` = a noise reached it this step. */
export function updateSenses(s: SenseState, sight: number, heard: boolean, dt: number): SenseState {
  if (sight > 0) {
    s.suspicion = Math.min(1, s.suspicion + sight * dt);
    s.unseen = 0;
  } else if (s.awareness !== 'detected') {
    s.suspicion = Math.max(0, s.suspicion - S.decay * dt);
  }
  if (heard && s.awareness !== 'detected') {
    s.suspicion = Math.min(0.95, Math.max(s.suspicion, S.suspiciousAt) + S.hearingBump * 0.5);
    s.awareness = 'searching';
    s.searchLeft = S.searchS;
  }

  switch (s.awareness) {
    case 'unaware':
      if (s.suspicion >= S.suspiciousAt) s.awareness = 'suspicious';
      break;
    case 'suspicious':
      if (s.suspicion >= 1) s.awareness = 'detected';
      else if (s.suspicion <= 0) s.awareness = 'unaware';
      break;
    case 'detected':
      if (sight <= 0) {
        s.unseen += dt;
        if (s.unseen >= S.loseSightS) {
          s.awareness = 'searching';
          s.searchLeft = S.searchS;
          s.suspicion = 0.6;
        }
      }
      break;
    case 'searching':
      if (s.suspicion >= 1) s.awareness = 'detected';
      else if ((s.searchLeft -= dt) <= 0) {
        s.awareness = 'unaware';
        s.suspicion = 0;
      }
      break;
  }
  return s;
}
