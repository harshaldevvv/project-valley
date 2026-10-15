/** Player-facing container text, keyed by container id. `searchVerb` shows on the hold-E prompt. */
export const containerText: Record<string, { name: string; searchVerb: string }> = {
  crate_wood: { name: 'Wooden Crate', searchVerb: 'Pry open' },
  cabinet_metal: { name: 'Metal Cabinet', searchVerb: 'Search' },
  duffel: { name: 'Duffel Bag', searchVerb: 'Rummage' },
  weapon_rack: { name: 'Weapon Rack', searchVerb: 'Check' },
  trunk_pickup: { name: 'Pickup Truck Bed', searchVerb: 'Search' },
};
