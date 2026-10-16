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
  tool_box: { name: 'Tool Box', searchVerb: 'Open' },
  medical_cabinet: { name: 'Medicine Cabinet', searchVerb: 'Search' },
  military_crate: { name: 'Military Crate', searchVerb: 'Pry open' },
  wardrobe: { name: 'Wardrobe', searchVerb: 'Search' },
  food_cupboard: { name: 'Cupboard', searchVerb: 'Search' },
  car_trunk: { name: 'Car Trunk', searchVerb: 'Search' },
  death_bag: { name: 'Your Bag', searchVerb: 'Recover' },
  trunk_pickup: { name: 'Pickup Truck Bed', searchVerb: 'Search' },
};
