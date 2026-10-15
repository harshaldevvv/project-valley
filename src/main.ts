import { createGame } from './core/game';
import { installEngine } from './engine/install';
import { installGameplay } from './gameplay/index';
import { installSystems } from './systems/index';
import { buildYard } from './world/yard/index';

// Project Valley — M1 "the Yard": a tiny sandbox with a station for every mechanic.
// Install order matters: engine APIs first, then the world (fills game.places), then systems
// (containers, inventory, loadout), then gameplay (player, weapons, zombies, vehicles).

const game = await createGame();
await installEngine(game);
await buildYard(game);
await installSystems(game);
await installGameplay(game);
await game.start();

(window as unknown as { game: typeof game }).game = game; // console/debug + Playwright access
