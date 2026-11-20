/** Player-facing text for the items in data/items_attach.ts, merged into itemText. `short` is the grid-tile label (max 8 chars). */
type T = { name: string; short: string; description: string };
const t = (name: string, short: string, description: string): T => ({ name, short, description });

export const itemTextAttach: Record<string, T> = {
  red_dot: t('Red Dot Sight', 'Red Dot', 'A small reflex sight with a worn lens. Right click it in the bag to mount it on a gun.'),
  scope_4x: t('4x Scope', 'Scope 4x', 'Four times magnification, a thin reticle and a lot of eye relief. Fits the long guns.'),
  suppressor: t('Suppressor', 'Silencer', 'A threaded can of baffles. Shots carry a fraction as far and the muzzle flash all but vanishes.'),
  mag_rifle_ext: t('7.62 Extended Magazine (45)', 'Mag 45', 'Forty-five rounds in a longer steel magazine. Sticks out of the gun like a dare.'),
  mag_pistol_ext: t('9 mm Extended Magazine (25)', 'Mag 25', 'Twenty-five rounds, with a plate on the bottom to keep the gun from tipping forward.'),
  mag_smg_ext: t('9 mm Extended Magazine (50)', 'Mag 50', 'Fifty rounds of trouble in a long curved box.'),
};

export const attachText = {
  attach: (gun: string) => `Mount on ${gun}`,
  detach: (att: string) => `Remove ${att}`,
  mounted: (att: string, gun: string) => `${att} mounted on ${gun}`,
  removed: (att: string) => `${att} removed`,
  slot: { optic: 'Optic', muzzle: 'Muzzle' } as Record<string, string>,
  row: 'Mounted',
};
