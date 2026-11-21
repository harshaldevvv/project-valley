// node tools/audit/attachcheck.mjs #here   headless attachment + extended magazine check through the real inventory UI.
// For each gun: give it with its attachments and extended magazine, open the inventory (Tab), right-click each
// attachment and click "Mount on <gun>", drag the extended magazine onto the gun, then check: ADS FOV (optic), shot noise
// radius (suppressor), magazine capacity, and the attachment parts on the first- and third-person models. Guns go in two
// rounds of three (primary / secondary / sidearm); each round is saved, the page reloaded and the save loaded, and the
// attachments, magazine and model parts must come back. Screenshots: docs/audit/screenshots/wip/attcheck_<gun>_<view>.png.
// Exit code 1 on any failure. URL=... overrides the dev server address.
import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';

const URL = process.env.URL ?? 'http://localhost:5188/?play';
const OUT = 'docs/audit/screenshots/wip';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push('console: ' + m.text().slice(0, 300)));
let navs = 0;
page.on('framenavigated', (f) => f === page.mainFrame() && navs++); // more than one per goto/reload = a Vite full reload (another session saved a file)
const fails = [];
const check = (ok, what) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + what);
  if (!ok) fails.push(what);
};
const wait = (ms) => page.waitForTimeout(ms);
const ready = async () => {
  await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30 && window.__gp.ctx.game.loadout, null, { timeout: 240000 });
  await wait(1500);
  // The game's own module instances (Vite serves each source file once, so these are the ones the UI uses).
  await page.evaluate(async () => {
    const [inv, items, weapons, screen] = await Promise.all(['/src/systems/inventory.ts', '/src/content/data/items.ts', '/src/content/data/weapons.ts', '/src/ui/inventory/screen.ts'].map((u) => import(u)));
    window.__invTools = { newItem: inv.newItem, remove: inv.removeItem, ITEMS: items.ITEMS, weaponDefs: weapons.weaponDefs, itemName: screen.itemName };
  });
  await page.evaluate(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; g.teleport(0, 40, 0); g.setLook(0, 0); });
};

// gun, weapon slot index, mounts in order (the rifle swaps red dot -> scope to test replacement), extended mag (null = none)
const ROUNDS = [
  [
    ['rifle_a', 0, ['red_dot', 'suppressor', 'scope_4x'], 'mag_rifle_ext'],
    ['shotgun_a', 1, ['red_dot'], 'mag_shotgun_ext'],
    ['pistol_a', 2, ['red_dot', 'suppressor'], 'mag_pistol_ext'],
  ],
  [
    ['smg_a', 0, ['red_dot', 'suppressor'], 'mag_smg_ext'],
    ['bolt_a', 1, ['scope_4x', 'suppressor'], 'mag_bolt_ext'],
    ['revolver_a', 2, ['red_dot'], null], // a cylinder holds six: no extended speedloader
  ],
];
const SLOTS = ['primary', 'secondary', 'sidearm'];

/** Put the round's guns in their slots (base magazine full) and their attachments + extended mags in the bag. */
const setup = (round) =>
  page.evaluate((round) => {
    const g = window.__gp, lo = g.ctx.game.loadout, inv = window.__invTools;
    for (const s of ['primary', 'secondary', 'sidearm']) delete lo.equipment[s];
    // clear room: drop everything in the player grids except the starting bag itself
    for (const { grid } of lo.playerGrids()) for (const gi of [...grid.contents]) inv.remove(grid, gi.item);
    const out = [];
    for (const [id, slot, mounts, ext] of round) {
      const gun = inv.newItem(id);
      lo.equipment[['primary', 'secondary', 'sidearm'][slot]] = gun;
      const base = inv.weaponDefs[id].magazines[0];
      gun.mag = inv.newItem(base, 1, { rounds: inv.ITEMS[base].capacity });
      for (const a of new Set(mounts)) out.push(lo.give(inv.newItem(a)));
      if (ext) out.push(lo.give(inv.newItem(ext, 1, { rounds: inv.ITEMS[ext].capacity })));
    }
    g.ctx.game.events.emit('inventoryChanged', {});
    return out;
  }, round);

/** Screen box of the first item tile showing `defId`'s icon (in the player's bag, or in an equipment slot). */
const tileBox = async (defId, where) => {
  const sel = where === 'slot' ? `.inv-slot[data-slot="${defId.slot}"] .inv-item` : `.inv-player .inv-item:has(img[src$="/icons/${defId}.png"])`;
  const el = page.locator(sel).first();
  if (!(await el.count())) return null;
  return el.boundingBox();
};

const inventory = async (open) => {
  const isOpen = () => page.evaluate(() => !document.querySelector('.inv-root')?.hidden);
  if ((await isOpen()) !== open) await page.keyboard.press('Tab');
  await wait(300);
  return (await isOpen()) === open;
};

/** Right-click the attachment in the bag and click "Mount on <gun name>". */
const mountViaMenu = async (att, gunName) => {
  const b = await tileBox(att);
  if (!b) return `no ${att} tile in the bag`;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { button: 'right' });
  await wait(150);
  const btn = page.locator('.inv-menu:not([hidden]) button', { hasText: `Mount on ${gunName}` });
  if (!(await btn.count())) return `no "Mount on ${gunName}" in the menu (${(await page.locator('.inv-menu button').allTextContents()).join(' | ')})`;
  await btn.first().click();
  await wait(200);
  return null;
};

/** Drag the extended magazine tile onto the gun in its equipment slot. */
const insertViaDrag = async (mag, slot) => {
  const a = await tileBox(mag);
  const b = await tileBox({ slot }, 'slot');
  if (!a || !b) return `no tile (${mag}: ${!!a}, gun in ${slot}: ${!!b})`;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2 - a.x - a.width / 2) * i) / 10, a.y + a.height / 2 + ((b.y + b.height / 2 - a.y - a.height / 2) * i) / 10);
  await wait(100);
  await page.mouse.up();
  await wait(200);
  return null;
};

/** Draw the gun, then measure: ADS FOV, shot noise radius, magazine capacity, attachment parts on both models. */
const measure = async (slot) => {
  await page.evaluate((slot) => { const w = window.__gp.ctx.weapons; w.select(3); }, slot);
  await wait(900);
  await page.evaluate((slot) => window.__gp.ctx.weapons.select(slot), slot);
  await wait(1800);
  await page.evaluate(() => window.__gp.mouse(2, true));
  await wait(1000);
  const fov = await page.evaluate(() => window.__gp.ctx.game.camera.fov);
  await page.evaluate(() => { window.__noise = []; window.__gp.mouse(0, true); });
  await wait(80);
  await page.evaluate(() => window.__gp.mouse(0, false));
  await wait(250);
  await page.evaluate(() => window.__gp.mouse(2, false));
  await wait(400);
  return page.evaluate(() => {
    const w = window.__gp.ctx.weapons, inv = window.__invTools, it = w.item;
    const m = w.models.get(it.defId);
    const parts = (wm) => (wm.root.userData.attParts ?? []).filter((o) => o.parent).length;
    return {
      gun: it.defId,
      attach: { ...(it.attach ?? {}) },
      mag: it.mag?.defId ?? null,
      cap: it.mag ? inv.ITEMS[it.mag.defId].capacity : 0,
      magScale: m.tp.mag ? +m.tp.mag.scale.y.toFixed(2) : null,
      tpParts: parts(m.tp),
      fpParts: parts(m.fp),
      noise: window.__noise[0] ?? null,
      fov: 0,
    };
  }).then((r) => ({ ...r, fov: +fov.toFixed(1) }));
};

const shots = async (id, tag) => {
  await page.evaluate(() => {
    const g = window.__gp, rig = g.ctx.rig;
    rig.mode = 'tp';
    if (!rig.__r) rig.__r = rig.render;
    rig.render = () => { const p = g.ctx.player, cam = g.ctx.game.camera, y = p.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
      cam.position.set(p.curr.x + fx * 1.1 + rx * 0.8, p.curr.y + 1.35, p.curr.z + fz * 1.1 + rz * 0.8); cam.lookAt(p.curr.x + fx * 0.3, p.curr.y + 1.2, p.curr.z + fz * 0.3); cam.updateMatrixWorld(true); };
  });
  await wait(900);
  await page.screenshot({ path: `${OUT}/attcheck_${id}_${tag}_tp.png` });
  await page.evaluate(() => { const g = window.__gp; g.mouse(2, false); g.ctx.rig.render = g.ctx.rig.__r; g.ctx.rig.mode = 'fp'; });
  await wait(900);
  await page.screenshot({ path: `${OUT}/attcheck_${id}_${tag}_fp.png` });
  await page.evaluate(() => { window.__gp.ctx.rig.mode = 'tp'; });
  await wait(300);
};

const hookNoise = () => page.evaluate(() => {
  window.__noise = [];
  window.__gp.ctx.game.events.on('noise', (e) => e.source === 'shot' && window.__noise.push(+e.radius.toFixed(1)));
});

const NAMES = { rifle_a: '', shotgun_a: '', pistol_a: '', smg_a: '', bolt_a: '', revolver_a: '' };

await page.goto(URL);
await ready();
await page.evaluate(() => {
  window.__noise = [];
  window.__gp.ctx.game.events.on('noise', (e) => e.source === 'shot' && window.__noise.push(+e.radius.toFixed(1)));
});
Object.assign(NAMES, await page.evaluate((ids) => Object.fromEntries(ids.map((i) => [i, window.__invTools.itemName(i)])), Object.keys(NAMES)));

const runRound = async (ri, round) => {
  console.log(`--- round ${ri + 1}: ${round.map((r) => r[0]).join(', ')}`);
  await setup(round);
  const before = {};
  for (const [id, slot] of round) before[id] = await measure(slot);
  check(await inventory(true), 'inventory opens');
  for (const [id, slot, mounts, ext] of round) {
    for (const a of mounts) {
      const err = await mountViaMenu(a, NAMES[id]);
      check(!err, `${id}: mount ${a} through the menu${err ? ' — ' + err : ''}`);
    }
    if (ext) {
      const err = await insertViaDrag(ext, SLOTS[slot]);
      check(!err, `${id}: drag ${ext} onto the gun${err ? ' — ' + err : ''}`);
    }
  }
  // the rifle's red dot went back to the bag when the scope replaced it
  if (round[0][0] === 'rifle_a') check(!!(await tileBox('red_dot')), 'rifle_a: replaced red dot is back in the bag');
  await page.screenshot({ path: `${OUT}/attcheck_inventory_round${ri + 1}.png` });
  check(await inventory(false), 'inventory closes');

  const after = {};
  for (const [id, slot, mounts, ext] of round) {
    const b = before[id], a = (after[id] = await measure(slot));
    const want = {};
    for (const m of mounts) want[m === 'suppressor' ? 'muzzle' : 'optic'] = m;
    console.log(`     ${id} before ${JSON.stringify(b)}`);
    console.log(`     ${id} after  ${JSON.stringify(a)}`);
    check(JSON.stringify(a.attach) === JSON.stringify(want), `${id}: attach ${JSON.stringify(a.attach)} = ${JSON.stringify(want)}`);
    check(a.fov < b.fov - 1, `${id}: optic zooms the ADS view (fov ${b.fov} -> ${a.fov})`);
    if (want.muzzle) check(a.noise !== null && b.noise !== null && a.noise < b.noise * 0.5, `${id}: suppressor cuts shot noise (${b.noise} -> ${a.noise})`);
    const n = Object.keys(want).length;
    check(a.tpParts === n && a.fpParts === n, `${id}: ${n} attachment part(s) on both models (tp ${a.tpParts}, fp ${a.fpParts})`);
    if (ext) {
      check(a.mag === ext && a.cap > b.cap, `${id}: extended magazine in (${b.mag} ${b.cap} -> ${a.mag} ${a.cap})`);
      check(a.magScale === null || a.magScale > 1, a.magScale === null ? `${id}: no separate magazine model on this gun, nothing to lengthen` : `${id}: magazine model lengthened (${a.magScale})`);
    }
    await shots(id, 'mounted');
  }

  console.log('--- save, reload, load');
  await page.evaluate(() => window.__gp.ctx.game.save.save('quick'));
  await page.reload();
  await ready();
  const loaded = await page.evaluate(() => window.__gp.ctx.game.save.load('quick'));
  check(loaded === true, 'quick save loads');
  await wait(1500);
  await page.evaluate(() => {
    window.__noise = [];
    window.__gp.ctx.game.events.on('noise', (e) => e.source === 'shot' && window.__noise.push(+e.radius.toFixed(1)));
  });
  for (const [id, slot] of round) {
    const a = after[id], r = await measure(slot);
    check(r.gun === id, `${id}: back in its slot after load (${r.gun})`);
    check(JSON.stringify(r.attach) === JSON.stringify(a.attach), `${id}: attachments survive the reload (${JSON.stringify(r.attach)})`);
    check(r.mag === a.mag && r.cap === a.cap, `${id}: magazine survives (${r.mag} ${r.cap})`);
    check(r.tpParts === a.tpParts && r.fpParts === a.fpParts, `${id}: model parts rebuilt after load (tp ${r.tpParts}, fp ${r.fpParts})`);
    check(Math.abs(r.fov - a.fov) < 1, `${id}: ADS fov the same after load (${r.fov})`);
    if (ri === 1 || id === 'rifle_a') await shots(id, 'loaded');
  }
};
// A Vite full reload (another session saving a source file) restarts the game mid-round: redo that round, up to 3 tries.
for (const [ri, round] of ROUNDS.entries()) {
  for (let attempt = 1; ; attempt++) {
    const n0 = navs, f0 = fails.length;
    try {
      await runRound(ri, round);
      if (navs === n0 + 1) break; // only our own save/reload
    } catch (e) {
      if (navs === n0 || attempt >= 3) throw e;
    }
    if (attempt >= 3) break;
    console.log(`!!! page reloaded by the dev server during round ${ri + 1}; retrying (attempt ${attempt + 1})`);
    fails.length = f0;
    await page.goto(URL);
    await ready();
    await hookNoise();
  }
}

check(errs.length === 0, `no console errors (${errs.length})`);
for (const e of errs.slice(0, 8)) console.log('   ', e);
console.log(fails.length ? `${fails.length} FAILED` : 'ALL OK');
await browser.close();
process.exit(fails.length ? 1 : 0);
