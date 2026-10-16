import type { Game } from '../../core/game';
import { yard } from '../../content/data/yard';
import { buildGround } from './ground';
import { placeYardHouse } from './house';
import { Kit } from './kit';
import { setupLighting } from './lighting';
import { lightPoles } from './poles';
import { buildLampPools } from './pools';
import { finishSigns } from './signs';
import { buildAnim } from './stations/anim';
import { buildBuildPad } from './stations/build';
import { buildLoot } from './stations/loot';
import { buildPen } from './stations/pen';
import { buildRange } from './stations/range';
import { buildTrack } from './stations/track';
import { buildWalls } from './walls';

/** environment-builder: builds the Yard (ground, walls, station areas, signage, props) and fills game.places. */
export async function buildYard(game: Game): Promise<void> {
  setupLighting(game);
  const kit = new Kit(game);
  buildGround(kit);
  buildWalls(kit);
  buildPaths(kit);
  await buildLoot(kit);
  await buildRange(kit);
  await buildPen(kit);
  buildBuildPad(kit);
  await buildAnim(kit);
  buildTrack(kit);
  for (const p of lightPoles) kit.place(p);
  await kit.finish();
  finishSigns(kit);
  placeYardHouse(game);
  buildLampPools(game);
}

/** Gravel paths from the spawn hub to every station, plus the hub itself. */
function buildPaths(kit: Kit) {
  const { x, z } = yard.spawn;
  kit.pad(7, 7, x, z, 'concrete', 0.04, 0.7);
  const s = yard.stations;
  const ends: [number, number][] = [
    [s.loot.x + 7, s.loot.z + 9], // loot sign
    [s.range.x, s.range.z + 6], // range platform
    [s.pen.x - s.pen.w / 2 - 3, s.pen.z - 1.5], // pen gate
    [s.build.x + s.build.w / 2, s.build.z - s.build.d / 2], // build pad corner
    [s.anim.x, s.anim.z - 4.5], // anim viewing spot
    [s.track.x - s.track.w / 2, s.track.z - s.track.d / 2 + 4], // track sign
  ];
  for (const [ex, ez] of ends) kit.strip(x, z, ex, ez, 3, 0.025, 'rock', 0.3);
}
