import { createGame } from './core/game';
import { installEngine } from './engine/install';
import { installGameplay } from './gameplay/index';
import { installSystems } from './systems/index';
import { loading, nextPaint, prefetchModels } from './ui/loading/loading';
import { buildYard } from './world/yard/index';

// Project Valley — M1 "the Yard": a tiny sandbox with a station for every mechanic.
// Install order matters: engine APIs first, then the world (fills game.places), then systems
// (containers, inventory, loadout), then gameplay (player, weapons, zombies, vehicles).
// The loading screen (index.html + ui/loading) covers everything until the first warm frame is done.

try {
  const models = prefetchModels(); // downloads in parallel with renderer + physics start-up
  const game = await createGame();
  const engine = await installEngine(game);
  await models;
  loading.phase(0.88, 'Building the yard');
  await buildYard(game);
  await installSystems(game);
  await installGameplay(game);
  loading.phase(0.94, 'Compiling shaders (the first visit takes a few seconds)');
  await nextPaint();
  await game.start();
  loading.done();
  engine.startAtmosphere(); // music + ambience load after the loading screen
  (window as unknown as { game: typeof game }).game = game; // console/debug + Playwright access
} catch (err) {
  loading.fail(err);
}
