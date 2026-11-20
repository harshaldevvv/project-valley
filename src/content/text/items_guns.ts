/** Player-facing text for the items in data/items_guns.ts, merged into itemText. `short` is the grid-tile label (max 8 chars). */
type T = { name: string; short: string; description: string };
const t = (name: string, short: string, description: string): T => ({ name, short, description });

export const itemTextGuns: Record<string, T> = {
  shotgun_a: t('Pump Shotgun', 'Shotgun', 'Twelve gauge, six shells in the carrier. Devastating inside a room, a nuisance across a field.'),
  bolt_a: t('Hunting Rifle', 'Hunt Rif', 'Bolt action, walnut stock, a deer notch worn into the wood. One shot, then work the bolt. Make it count.'),
  smg_a: t('9 mm Submachine Gun', 'SMG', 'Compact and hungry. It will empty a magazine before you finish deciding to.'),
  revolver_a: t('.357 Revolver', 'Revolver', 'Six chambers and a hammer you cock with your thumb. Heavy kick, heavy answer.'),
  mag_shotgun_a: t('Shell Carrier (6)', 'Shells 6', 'A steel carrier holding six 12 gauge shells, loaded in one motion.'),
  mag_bolt_a: t('Stripper Clip (5)', 'Clip 5', 'Five .308 rounds on a brass clip that feeds the rifle in one push.'),
  mag_smg_a: t('9 mm Stick Magazine (30)', 'Mag SMG', 'Thirty rounds in a long curved box. Springs stiff, lips bent.'),
  mag_revolver_a: t('Speedloader (6)', 'Loader 6', 'A twist-release loader that drops six .357 rounds into the cylinder at once.'),
  ammo_12ga: t('12 Gauge Shells', '12 ga', 'Red plastic hulls, number four shot. Loose in a pocket they rattle.'),
  ammo_308: t('.308 Rounds', '.308', 'Boat-tail hunting rounds. Heavy for their size, and worth every gram.'),
  ammo_357: t('.357 Rounds', '.357', 'Fat brass cartridges for a revolver. They fit nothing else you own.'),
};
