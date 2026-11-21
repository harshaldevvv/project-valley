import type { Object3D } from 'three';
import type { Game } from '../core/game';
import { FAR_CULL } from '../content/data/yard';

/**
 * Distance culling for small unique objects (yard station props, wall decals, parked vehicles): each is its own draw (plus
 * its shadow casts) and stays inside the frustum from far across the map, where it covers a few pixels. Hidden beyond its
 * distance from the camera, checked a few times a second. Only for objects nothing else shows or hides.
 */
const list: { o: Object3D; d2: number }[] = [];
let installed = false;

export function farCull(game: Game, o: Object3D, dist: number) {
  list.push({ o, d2: dist * dist });
  if (installed) return;
  installed = true;
  let t = FAR_CULL.interval;
  game.addSystem({
    name: 'farcull',
    render(_a, dt) {
      if ((t += dt) < FAR_CULL.interval) return;
      t = 0;
      const c = game.camera.position;
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (!e.o.parent) { list.splice(i, 1); continue; } // removed from the scene
        e.o.visible = e.o.position.distanceToSquared(c) < e.d2;
      }
    },
  });
}
