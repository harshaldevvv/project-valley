/**
 * Player settings persisted in localStorage (best effort: private windows / blocked storage just use defaults).
 *   const s = loadSettings();  s.fov = 80;  saveSettings(s);
 * Applied by installMenu() to the live data tables (cameraFeel, look), the post pipeline and audio.
 */
export interface Settings {
  fov: number; // third-person hip FOV, degrees
  sensitivity: number; // multiplier on data/input look.sensitivity
  shake: number; // 0..1
  renderScale: number; // 0.5..1
  shadows: boolean;
  fxaa: boolean;
  volume: number; // master 0..1
  music: number; // background music 0..1
  ambience: number; // wind, birds, crickets, distant sounds 0..1
  bgMuted: boolean; // mutes music + ambience, keeps game sounds
  reduceFlashing: boolean; // accessibility: no muzzle light, fewer/dimmer flashes
  gore: 'full' | 'reduced' | 'off';
}

const KEY = 'pv.settings.v1';
export const DEFAULT_SETTINGS: Settings = { fov: 70, sensitivity: 1, shake: 0.7, renderScale: 1, shadows: true, fxaa: true, volume: 0.8, music: 0.4, ambience: 0.6, bgMuted: false, reduceFlashing: false, gore: 'full' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* storage unavailable or corrupt: defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
