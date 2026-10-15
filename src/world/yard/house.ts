import { Vector3 } from 'three';
import type { Game } from '../../core/game';
import { BUILD } from '../../content/data/build';

/**
 * Prebuilt 2x2-cell wooden demo house on the build pad, placed through game.build.place so the player
 * can deconstruct (X) and rebuild it piece by piece. Cells have edges on world multiples of BUILD.grid.
 * Position = piece base centre; walls on a cell edge (rotY 0 = runs along X, PI/2 = along Z).
 */
const G = BUILD.grid;
const X0 = -51, Z0 = 24; // north-west corner of the house (on grid lines), inside the build pad
const WALL_Y = BUILD.foundationTop;
const ROOF_Y = BUILD.foundationTop + BUILD.storey;
const Q = Math.PI / 2;

type Piece = [def: string, x: number, y: number, z: number, rotY: number];
const c = (i: number) => i * G + G / 2; // cell centre offset

export const yardHouse: Piece[] = [
  // foundations
  ...[0, 1].flatMap((i) => [0, 1].map((j): Piece => ['wood_foundation', X0 + c(i), 0, Z0 + c(j), 0])),
  // north + west walls
  ['wood_wall', X0 + c(0), WALL_Y, Z0, 0],
  ['wood_window', X0 + c(1), WALL_Y, Z0, 0],
  ['wood_wall', X0, WALL_Y, Z0 + c(0), Q],
  ['wood_wall', X0, WALL_Y, Z0 + c(1), Q],
  // south wall (window faces the pad)
  ['wood_wall', X0 + c(0), WALL_Y, Z0 + 2 * G, 0],
  ['wood_window', X0 + c(1), WALL_Y, Z0 + 2 * G, 0],
  // east wall with the doorway + door (faces the open pad and spawn)
  ['wood_wall', X0 + 2 * G, WALL_Y, Z0 + c(0), Q],
  ['wood_doorway', X0 + 2 * G, WALL_Y, Z0 + c(1), Q],
  ['wood_door', X0 + 2 * G, WALL_Y, Z0 + c(1), Q],
  // roof: north row turned 180 deg so the two rows meet in a gable ridge
  ...[0, 1].flatMap((i) => [0, 1].map((j): Piece => ['wood_roof', X0 + c(i), ROOF_Y, Z0 + c(j), j === 0 ? Math.PI : 0])),
];

/** Places the house once systems has installed game.build (deferred to the first sim tick). */
export function placeYardHouse(game: Game) {
  let done = false;
  game.addSystem({
    name: 'yard-house',
    step() {
      if (done) return;
      done = true;
      try {
        for (const [def, x, y, z, r] of yardHouse) game.build.place(def, new Vector3(x, y, z), r);
      } catch (e) {
        console.warn('yard house not placed: game.build.place unavailable yet', e);
      }
    },
  });
}
