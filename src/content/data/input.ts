/**
 * Gameplay keymap (KeyboardEvent.code). Rebindable later; read through this table, never hard-coded.
 * Mouse buttons use the pseudo-codes 'Mouse0' (LMB) and 'Mouse2' (RMB).
 * Hotbar 5–9 belongs to systems; Tab/B to systems; F1/F3 to engine.
 */
export const keys = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  crouch: 'KeyC',
  jump: 'Space',
  fire: 'Mouse0',
  aim: 'Mouse2',
  reload: 'KeyR',
  fireMode: 'KeyX',
  primary: 'Digit1',
  secondary: 'Digit2',
  sidearm: 'Digit3',
  melee: 'Digit4',
  shove: 'KeyV',
  throwAim: 'KeyN', // hold to aim the selected throwable (arc preview), release to throw
  throwCycle: 'KeyM',
  interact: 'KeyE',
  vehicle: 'KeyF',
  horn: 'KeyH', // in a vehicle; on foot H opens the help overlay
  help: 'KeyH',
  camera: 'KeyT',
  shoulder: 'KeyQ',
  handbrake: 'Space',
  flipReset: 'KeyR', // in a vehicle
};
export type KeyAction = keyof typeof keys;

/** Mouse look. */
export const look = {
  sensitivity: 0.0022, // rad per mouse count
  adsSensitivityMul: 0.75,
  pitchMin: -1.35,
  pitchMax: 1.2,
};

/**
 * Pointer lock switch. OFF during development: the game never captures the mouse, the cursor stays free to leave the
 * window, and moving the mouse over the game view turns the camera. Turn `enabled` on for production (normal FPS mouse
 * capture). `?lock=1` turns it on for one session, `?lock=0` off.
 */
export const pointerLock = {
  enabled: false,
};
const lockParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lock') : null;
if (lockParam === '1') pointerLock.enabled = true;
if (lockParam === '0') pointerLock.enabled = false;
