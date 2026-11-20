import type { Game } from '../../core/game';
import { yard } from '../../content/data/yard';
import { buildAiTrees } from './aiTrees';
import { buildBirds } from './birds';
import { buildFireLights } from './fires';
import { buildTracks } from './tracks';
import { buildWornGround } from './worn';
import { buildCabin, buildCabinLoot, buildFarm, buildShop } from './cabin';
import { buildClutter } from './clutter';
import { buildDoors } from './doors';
import { buildDress } from './dress';
import { buildGenProps } from './genProps';
import { installFlashlight } from '../../engine/flashlight';
import { buildGround } from './ground';
import { buildMotes } from './motes';
import { buildWallDecals } from './wallDecals';
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
import { buildOutskirts } from '../outskirts';
import { installOutskirtsCull } from '../outskirts/cull';

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
  await buildCabin(kit);
  await buildCabinLoot(kit);
  await buildShop(kit);
  await buildFarm(kit);
  buildDoors(kit);
  await buildGenProps(kit);
  await buildDress(game, kit);
  await buildOutskirts(kit, game);
  for (const p of lightPoles) kit.place(p);
  await kit.finish();
  finishSigns(kit);
  placeYardHouse(game);
  buildClutter(game);
  buildMotes(game);
  installFlashlight(game);
  buildBirds(game);
  await buildWornGround(game);
  await buildTracks(game);
  buildFireLights(game, [[-15.5, 0.7, 11.5]], [[-69.0, 1.9, -33.8], [62.2, 1.9, -59.4], [-67.2, 1.9, 64.2]]);
  await buildAiTrees(game);
  await buildWallDecals(game);
  buildLampPools(game);
  installOutskirtsCull(game);
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
