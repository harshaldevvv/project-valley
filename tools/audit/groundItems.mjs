// node tools/audit/groundItems.mjs <tag> [x,z]   headless: lays one item per distinct ground model in rows beside the player
// (scale check against the hero), then drops items the normal way on a slope / step to check floating.
// Prints per-item world bbox size and gap between bbox bottom and the ground ray. Shots: docs/audit/screenshots/wip/<tag>_*.png
import { launch } from './browser.mjs';
const [tag = 'gi', at = '-2,135'] = process.argv.slice(2);
const [AX, AZ] = at.split(',').map(Number);
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
const keys = await page.evaluate(async ([AX, AZ]) => {
  const g = window.__gp, game = g.ctx.game, lo = game.loadout;
  g.ctx.player.godMode = true;
  g.teleport(AX, AZ, 0);
  const { ITEMS, PICKUP_MODELS } = await import('/src/content/data/items.ts');
  const { pickupModelId } = await import('/src/ui/inventory/pickups.ts');
  const seen = new Map();
  for (const d of Object.values(ITEMS)) {
    const k = PICKUP_MODELS.files[d.id] ? 'own:' + d.id : pickupModelId(d);
    if (!seen.has(k)) seen.set(k, d.id);
  }
  window.__giKeys = [...seen.entries()];
  return window.__giKeys.length;
}, [AX, AZ]);
console.log('distinct ground models', keys);
await page.waitForTimeout(1500);
// lay them out in rows of 10, 0.9 m apart, 2.5 m in front (+x side) of the player, page by page of 30
const all = await page.evaluate(() => window.__giKeys);
const report = [];
for (let pg = 0; pg * 30 < (process.env.SKIP_ROWS ? 0 : all.length); pg++) {
  const r = await page.evaluate(async ([pg, AX, AZ]) => {
    const g = window.__gp, game = g.ctx.game, lo = game.loadout, cam = game.camera;
    const { newItem } = await import('/src/systems/inventory.ts');
    lo.pickups.length = 0;
    game.events.emit('inventoryChanged', {});
    const P = game.player.position;
    const list = window.__giKeys.slice(pg * 30, pg * 30 + 30);
    list.forEach(([k, id], i) => {
      const it = newItem(id);
      lo.pickups.push({ item: it, x: AX - 4 + (i % 10) * 0.9, y: P.y, z: AZ - 2.2 - Math.floor(i / 10) * 0.9 });
    });
    game.events.emit('inventoryChanged', {});
    g.ctx.rig.override = () => { cam.position.set(AX + 0.05, P.y + 2.6, AZ + 1.6); cam.lookAt(AX + 0.05, P.y, AZ - 3.1); if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); } return true; };
    await new Promise((res) => setTimeout(res, 2500));
    const { Box3, Vector3 } = await import('/node_modules/.vite/deps/three.js').catch(() => ({}));
    const rows = [];
    for (const o of game.scene.children) {
      if (!o.name?.startsWith('pickup_')) continue;
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      o.updateMatrixWorld(true);
      o.traverse((m) => {
        if (!m.isMesh) return;
        m.geometry.computeBoundingBox?.();
        const b = m.geometry.boundingBox; if (!b) return;
        for (const cx of [b.min.x, b.max.x]) for (const cy of [b.min.y, b.max.y]) for (const cz of [b.min.z, b.max.z]) {
          const v = { x: cx, y: cy, z: cz }, e = m.matrixWorld.elements;
          const wx = e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12], wy = e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13], wz = e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14];
          mn = [Math.min(mn[0], wx), Math.min(mn[1], wy), Math.min(mn[2], wz)]; mx = [Math.max(mx[0], wx), Math.max(mx[1], wy), Math.max(mx[2], wz)];
        }
      });
      rows.push({ id: o.name.slice(7), size: mx.map((v, i) => +(v - mn[i]).toFixed(2)), bottom: +(mn[1] - o.position.y).toFixed(3) });
    }
    return rows;
  }, [pg, AX, AZ]);
  report.push(...r);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}${tag}_rows${pg}.png` });
}
for (const r of report) console.log(r.id.padEnd(22), JSON.stringify(r.size), 'bottom', r.bottom);
// floating: a real drop (lo.drop at dropPosition) while airborne, and one with the player's feet height forced 1 m high
const fl = await page.evaluate(async ([AX, AZ]) => {
  const g = window.__gp, game = g.ctx.game, lo = game.loadout;
  const { newItem } = await import('/src/systems/inventory.ts');
  lo.pickups.length = 0; game.events.emit('inventoryChanged', {});
  g.ctx.rig.override = null;
  g.teleport(AX, AZ, 0);
  await new Promise((r) => setTimeout(r, 800));
  const groundY = game.player.position.y;
  const out = [];
  const at = lo.dropPosition();
  lo.drop(newItem('canned_beans'), { x: at.x, y: at.y + 1.0, z: at.z });
  lo.drop(newItem('rifle_a'), { x: at.x + 0.5, y: at.y + 0.4, z: at.z });
  game.events.emit('inventoryChanged', {});
  await new Promise((r) => setTimeout(r, 500));
  for (const p of lo.pickups) out.push({ id: p.item.defId, y: +(p.y - groundY).toFixed(3) });
  return out;
}, [AX, AZ]);
console.log('airborne drops, y above ground (want ~0):', JSON.stringify(fl));
// floating: real drops (give into a full-less inventory is not reliable) -> lo.drop at dropPosition in a few spots
await page.evaluate(() => { window.__gp.ctx.rig.override = null; });
console.log('errors', JSON.stringify(errs.slice(0, 5)));
await browser.close();
