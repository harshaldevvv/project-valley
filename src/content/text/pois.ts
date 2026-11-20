/** Player-facing names and one-line hooks for the outskirts' points of interest, keyed by poi id (data/pois.ts). */
export const poiText: Record<string, { name: string; hook: string }> = {
  checkpoint: { name: 'Gate Checkpoint', hook: 'The army set up here and never left.' },
  fuel: { name: 'Route 9 Fuel Stop', hook: 'The pumps are dry. The shelves are not.' },
  maple: { name: 'Maple Street', hook: 'Porch lights still on. Nobody home.' },
  school: { name: 'Westside School', hook: 'The bus never left. The children did.' },
  farm: { name: 'Hollow Creek Farm', hook: 'Half the valley ate from these fields.' },
  diner: { name: 'Crossroads Diner', hook: 'Open 24 hours, once.' },
  camp: { name: 'Pinewood Camp', hook: 'Campers came to wait it out.' },
  crash: { name: 'Medevac Crash Site', hook: 'It went down carrying the cure, or so the radio said.' },
  town: { name: 'Dunmore', hook: 'Main Street kept its lights on longer than anyone.' },
  police: { name: 'Dunmore Police', hook: 'The armory door held. The officers did not.' },
  bus: { name: 'Broken-Down Bus', hook: 'Somebody got out and ran.' },
  stand: { name: 'Hunting Stand', hook: 'Best view in the west. Worst place to be seen.' },
  memorial: { name: 'Roadside Memorial', hook: 'Fresh candles. Fresher tracks.' },
  ranger: { name: 'Ranger Ridge', hook: 'See everything. Be seen by everything.' },
  outpost: { name: 'Camp Harlan', hook: 'The army held the fence. Then the fence held the army.' },
};

/** Danger label printed on the entrance sign, by tier. */
export const tierLabel: Record<number, string> = { 1: 'Low risk', 2: 'Dangerous', 3: 'Extreme danger' };
