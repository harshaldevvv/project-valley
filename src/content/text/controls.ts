/** Rows for the H help overlay: [keys, action]. */
export const controlsHelp: { group: string; rows: [keys: string, action: string][] }[] = [
  {
    group: 'Movement',
    rows: [
      ['W A S D', 'Move'],
      ['Shift', 'Sprint'],
      ['C', 'Crouch'],
      ['Space', 'Jump / vault'],
      ['T', 'Switch camera'],
      ['Q', 'Swap shoulder'],
    ],
  },
  {
    group: 'Combat',
    rows: [
      ['LMB', 'Fire'],
      ['RMB', 'Aim'],
      ['R', 'Reload'],
      ['X', 'Fire mode'],
      ['V', 'Shove'],
      ['1–4', 'Weapons'],
      ['5–9', 'Hotbar'],
    ],
  },
  {
    group: 'Interact',
    rows: [
      ['E', 'Interact (hold to search)'],
      ['Tab', 'Inventory'],
    ],
  },
  {
    group: 'Build',
    rows: [
      ['B', 'Build mode'],
      ['Mouse wheel', 'Select piece'],
      ['LMB', 'Place piece'],
      ['R', 'Rotate piece'],
      ['X', 'Remove piece'],
    ],
  },
  {
    group: 'Vehicle',
    rows: [
      ['F', 'Enter / exit'],
      ['W A S D', 'Drive'],
      ['Space', 'Handbrake'],
      ['H', 'Horn'],
    ],
  },
  {
    group: 'System',
    rows: [
      ['H', 'This help'],
      ['F1', 'Debug menu'],
      ['F3', 'Performance stats'],
    ],
  },
];
