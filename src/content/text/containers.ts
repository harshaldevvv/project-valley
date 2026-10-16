/** Player-facing container text, keyed by container id. `searchVerb` shows on the hold-E prompt. */
export const containerText: Record<string, { name: string; searchVerb: string }> = {
  crate_wood: { name: 'Wooden Crate', searchVerb: 'Pry open' },
  cabinet_metal: { name: 'Metal Cabinet', searchVerb: 'Search' },
  duffel: { name: 'Duffel Bag', searchVerb: 'Rummage' },
  weapon_rack: { name: 'Weapon Rack', searchVerb: 'Check' },
  cabinet_locked: { name: 'Locked Cabinet', searchVerb: 'Search' },
  body_survivor: { name: 'Dead Survivor', searchVerb: 'Search' },
  body_zombie: { name: 'Body', searchVerb: 'Search' },
  body_zombie_soldier: { name: 'Soldier Body', searchVerb: 'Search' },
  trunk_pickup: { name: 'Pickup Truck Bed', searchVerb: 'Search' },
};
