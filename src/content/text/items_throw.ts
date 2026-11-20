/** Player-facing text for the items in data/items_throw.ts, merged into itemText. `short` is the grid-tile label (max 8 chars). */
type T = { name: string; short: string; description: string };
const t = (name: string, short: string, description: string): T => ({ name, short, description });

export const itemTextThrow: Record<string, T> = {
  frag_grenade: t('Frag Grenade', 'Frag', 'Three seconds from the pin to the blast. Throw it, then get behind something.'),
  molotov: t('Molotov Cocktail', 'Molotov', 'A bottle of fuel with a rag for a wick. It breaks on impact and the ground burns for ten seconds.'),
  glass_bottle: t('Glass Bottle', 'Bottle', 'Empty and loud. Thrown, it shatters and everything nearby comes to see what that was.'),
  flare: t('Road Flare', 'Flare', 'Burns red for half a minute and draws every ear and eye within reach. Throw it far from where you stand.'),
  fuel_can: t('Fuel Can', 'Fuel', 'A dented can, still sloshing. Enough to fill two bottles.'),
};
