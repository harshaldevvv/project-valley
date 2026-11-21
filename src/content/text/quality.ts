/** Graphics quality control in Settings (data/quality.ts holds the presets). */
export const qualityText = {
  label: 'Graphics quality',
  auto: 'Auto',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  /** Notes under the control; {q} is a preset name (shown bold). */
  autoPicked: 'Auto chose {q} for this computer. It watches frame times while you play and only ever steps down.',
  autoPick: "Auto's pick",
  manual: 'Fixed at {q}. Render scale, shadows and effects below follow it; change any of them to fine-tune.',
  custom: '{q}, adjusted by you. Pick a preset again to reset the options below.',
  autoOff: 'You changed a graphics option, so Auto is off: {q}, adjusted by you. Pick Auto to let it choose again.',
  steppedDown: 'Graphics lowered to {q} to keep the game smooth. Change it in Settings.',
};
