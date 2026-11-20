import type { InstancedMesh, Mesh, Sphere } from 'three';
import type { Game } from '../../core/game';

/**
 * Distance culling for the heavy outskirts content. The frustum test alone keeps every chunk, crop field and grass cell in
 * front of the camera, even those behind the yard wall or a kilometre of fog away, so the triangle count at the spawn used
 * to include the whole outskirts. Each chunk is hidden once its bounding sphere is farther than its range:
 * grass 70 m, crop fields 150 m, building/prop chunks 260 m (160 m while the camera is inside the walled yard).
 */
export function installOutskirtsCull(game: Game) {
  const items: { mesh: Mesh; centre: Sphere['center']; radius: number; range: number; yardRange: number }[] = [];
  game.scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const n = m.name;
    const range = /^grass_/.test(n) ? 70 : /^crop_/.test(n) ? 150 : /^outskirts_/.test(n) ? 260 : /^treecell_/.test(n) ? 230 : 0;
    if (!range) return;
    const inst = m as InstancedMesh;
    if (inst.isInstancedMesh && !inst.boundingSphere) inst.computeBoundingSphere();
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const s = (inst.isInstancedMesh ? inst.boundingSphere : m.geometry.boundingSphere) as Sphere;
    items.push({ mesh: m, centre: s.center, radius: s.radius, range, yardRange: Math.min(range, /^outskirts_/.test(n) ? 160 : /^treecell_/.test(n) ? 200 : range) });
  });
  const cam = game.camera.position;
  game.addSystem({
    name: 'outskirts-cull',
    render() {
      const inYard = Math.abs(cam.x) < 99 && Math.abs(cam.z) < 99;
      for (const it of items) {
        const d = Math.hypot(cam.x - it.centre.x, cam.z - it.centre.z) - it.radius;
        it.mesh.visible = d < (inYard ? it.yardRange : it.range);
      }
    },
  });
}
