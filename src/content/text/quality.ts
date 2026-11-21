/** Graphics quality control in Settings (data/quality.ts holds the presets). */
export const qualityText = {
  label: 'Graphics quality',
  auto: 'Auto',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  /** Shown under the control while Auto is on; {q} is the preset it picked. */
  autoPicked: 'Auto picked {q}. It measures the first 30 s of play and steps down if frames are slow.',
  manual: 'Picking a preset sets render scale, shadows and effects below; you can still change them one by one.',
  steppedDown: 'Graphics lowered to {q} to keep the game smooth. Change it in Settings.',
};
