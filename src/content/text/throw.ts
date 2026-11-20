/** Player-facing text for the throw action (gameplay/throwables). */
export const throwText = {
  none: 'Nothing to throw',
  selected: (name: string, n: number) => `${name} x${n}`,
  hint: (name: string, n: number) => `N: aim and throw ${name} (x${n})   M: switch`,
  tooShort: 'Hold N to aim, release to throw',
};
