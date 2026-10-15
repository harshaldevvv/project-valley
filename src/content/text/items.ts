/** Player-facing item text, keyed by item id. `short` is the grid-tile label (max 8 chars). */
export const itemText: Record<string, { name: string; short: string; description: string }> = {
  pistol_a: {
    name: '9 mm Service Pistol',
    short: 'Pistol',
    description: 'Standard sidearm, county sheriff issue. Still has the evidence tag on the trigger guard.',
  },
  rifle_a: {
    name: 'AK-Pattern Rifle',
    short: 'AK',
    description: 'Loud, heavy, forgiving. It will keep firing long after you stop cleaning it.',
  },
  mag_pistol_a: {
    name: '9 mm Magazine (15)',
    short: 'Mag 9',
    description: 'Fifteen-round pistol magazine. Someone scratched a tally into the base plate and stopped at 31.',
  },
  mag_rifle_a: {
    name: '7.62 Magazine (30)',
    short: 'Mag 7.62',
    description: 'Thirty-round steel magazine. Dented, but the spring still argues back.',
  },
  ammo_9mm: {
    name: '9 mm Rounds',
    short: '9mm',
    description: 'Loose pistol ammunition. The closest thing the valley has to money.',
  },
  ammo_762: {
    name: '7.62x39 Rounds',
    short: '7.62',
    description: 'Rifle ammunition, mixed headstamps. Every shot tells someone where you are.',
  },
  knife_a: {
    name: 'Fixed-Blade Knife',
    short: 'Knife',
    description: 'Quiet, never jams, needs you uncomfortably close.',
  },
  bandage: {
    name: 'Bandage',
    short: 'Bandage',
    description: 'Sterile, still sealed. Stops bleeding, not bad decisions.',
  },
  canned_beans: {
    name: 'Canned Beans',
    short: 'Beans',
    description: 'Best before three summers ago. The can has not been told.',
  },
  water_bottle: {
    name: 'Bottle of Water',
    short: 'Water',
    description: 'Clear plastic, clear water. Rarer than it should be in a valley with a river.',
  },
  wood_planks: {
    name: 'Wood Planks',
    short: 'Planks',
    description: 'Pulled off a fence that no longer has anything to keep in.',
  },
  nails: {
    name: 'Box of Nails',
    short: 'Nails',
    description: 'Half full and rattling. Turns planks into a wall.',
  },
  scrap_metal: {
    name: 'Scrap Metal',
    short: 'Scrap',
    description: 'Car door, road sign, shelf. Ugly, heavy, and better than wood.',
  },
  backpack_small: {
    name: 'Small Backpack',
    short: 'Pack',
    description: 'School daypack, a name written inside the flap. More room, same shoulders.',
  },
  jacket_field: {
    name: 'Field Jacket',
    short: 'Jacket',
    description: 'Surplus olive drab with deep pockets. The name tape has been cut off.',
  },
  cloth_rag: {
    name: 'Cloth Rag',
    short: 'Rag',
    description: 'Half a flannel shirt. Bandage in a pinch, gun rag the rest of the time.',
  },
};
