// node tools/audit/handaudit.mjs <tag> [items] [views]   headless hands/joints audit of the player hero per held item.
// items: unarmed,knife_a,pistol_a,rifle_a,shotgun_a,revolver_a,smg_a,bolt_a,throw (default all)
// views: tp (over the shoulder), side (camera override, right side), fp (first person)  (default all)
// States per item: idle, walk, sprint, crouch, aim, reload (mid-clip), melee, and with STATES=...,fire the pump/bolt cycle after a shot; (knife/unarmed LMB, guns shove V).
// Writes docs/audit/screenshots/wip/<tag>_<item>_<view>_<state>.png and a contact sheet <tag>_<item>_sheet.png.
import sharp from 'sharp';
import { launch } from './browser.mjs';
const ALL = ['unarmed', 'knife_a', 'pistol_a', 'rifle_a', 'shotgun_a', 'revolver_a', 'smg_a', 'bolt_a', 'throw'];
const [tag = 'ha', itemsArg = '', viewsArg = ''] = process.argv.slice(2);
const items = itemsArg ? itemsArg.split(',') : ALL;
const views = viewsArg ? viewsArg.split(',') : ['tp', 'side', 'fp'];
const STATES = (process.env.STATES || 'idle,walk,sprint,crouch,aim,reload,melee').split(',');
const DIR = 'docs/audit/screenshots/wip';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto(`http://localhost:${process.env.PORT ?? '5188'}/?play`);
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
const wait = (ms) => page.waitForTimeout(ms);
await gp(() => {
  const g = window.__gp;
  g.ctx.player.godMode = true;
  // Mutable loadout: each item goes into its own slot (alternating primary/secondary so select() always switches)
  let uid = 2e6;
  const slots = {};
  const magOf = { pistol_a: 'mag_pistol_a', rifle_a: 'mag_rifle_a', shotgun_a: 'mag_shotgun_a', bolt_a: 'mag_bolt_a', revolver_a: 'mag_revolver_a', smg_a: 'mag_smg_a' };
  g.__slots = slots;
  g.__put = (slot, defId) => {
    for (const k of Object.keys(slots)) delete slots[k];
    if (!defId) return;
    if (defId === 'knife_a') slots[slot] = { uid: uid++, defId, count: 1, durability: 1 };
    else slots[slot] = { uid: uid++, defId, count: 1, durability: 1, rounds: 1, mag: { uid: uid++, defId: magOf[defId], count: 1, rounds: 5 } };
  };
  g.ctx.weapons.loadout = {
    equipped: (s) => slots[s] ?? null,
    takeMagazine: (w) => ({ uid: uid++, defId: magOf[w.defId], count: 1, rounds: 6 }),
    give: () => {}, consume: () => 0, count: () => 99, using: null, cancelUse: () => false,
  };
  g.ctx.weapons.sandbox = true;
});
let flip = 0;
const SLOTI = { primary: 0, secondary: 1, melee: 3 };
async function equip(item) {
  if (item === 'unarmed' || item === 'throw') {
    await gp(() => { const w = window.__gp.ctx.weapons; window.__gp.__put(null); w.item = null; w.def = null; if (w.reload) w.cancelReload(); });
    await wait(900);
    return;
  }
  const slot = item === 'knife_a' ? 'melee' : (flip++ % 2 ? 'secondary' : 'primary');
  await gp(([s, d, i]) => { window.__gp.__put(s, d); window.__gp.ctx.weapons.select(i); }, [slot, item, SLOTI[slot]]);
  await wait(1700);
}
async function setView(v) {
  await gp((v) => {
    const g = window.__gp, rig = g.ctx.rig;
    rig.mode = v === 'fp' ? 'fp' : 'tp';
    rig.override = v === 'side' ? () => {
      const p = g.ctx.player, cam = g.ctx.game.camera;
      const d = g.ctx.playerChar.root.getWorldDirection(cam.position.clone());
      const fx = -d.x, fz = -d.z, rx = -fz, rz = fx; // model +Z is its back: camera on the hero's right, a little in front
      cam.position.set(0, 0, 0);
      const h = p.crouched ? 0.95 : 1.25;
      cam.position.set(p.position.x + rx * 1.6 + fx * 0.9, p.position.y + h + 0.1, p.position.z + rz * 1.6 + fz * 0.9);
      cam.lookAt(p.position.x + fx * 0.35, p.position.y + h, p.position.z + fz * 0.35);
      if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
      return true;
    } : null;
  }, v);
  await wait(400);
}
const reset = async () => {
  for (const k of ['w', 'Shift', 'n']) await page.keyboard.up(k);
  await gp(() => { window.__gp.mouse(2, false); window.__gp.mouse(0, false); });
  if (await gp(() => window.__gp.ctx.player.crouched)) { await page.keyboard.press('c'); await wait(400); }
};
const spot = () => gp(() => { const g = window.__gp; g.teleport(0, 0, 0); g.setLook(0, -0.05); });
const shot = (n) => page.screenshot({ path: `${DIR}/${tag}_${n}.png` });
const CROP = { tp: { left: 120, top: 120, width: 800, height: 600 }, side: { left: 340, top: 60, width: 600, height: 640 }, fp: { left: 380, top: 200, width: 900, height: 520 } };
for (const item of items) {
  for (const v of views) {
    await setView('tp');
    await equip(item);
    await setView(v);
    for (const st of STATES) {
      await reset();
      await spot();
      await wait(250);
      const n = `${item}_${v}_${st}`;
      if (st === 'idle') { await wait(500); await shot(n); }
      else if (st === 'walk') { await page.keyboard.down('w'); await wait(1100); await shot(n); }
      else if (st === 'sprint') { await page.keyboard.down('Shift'); await page.keyboard.down('w'); await wait(1300); await shot(n); }
      else if (st === 'crouch') { await page.keyboard.press('c'); await wait(900); await shot(n); }
      else if (st === 'aim') {
        if (item === 'throw') await page.keyboard.down('n'); else await gp(() => window.__gp.mouse(2, true));
        await wait(800); await shot(n);
        if (item === 'throw') { await gp(() => window.__gp.ctx.player.setLook(window.__gp.ctx.player.yaw, 0.6)); }
      }
      else if (st === 'reload') {
        if (item === 'unarmed' || item === 'throw' || item === 'knife_a') continue;
        await gp(() => { const w = window.__gp.ctx.weapons; if (w.item?.mag) w.item.mag.rounds = 0; if (w.item) w.item.rounds = 0; });
        await page.keyboard.press('r');
        const t = await gp(() => window.__gp.ctx.weapons.reload?.total ?? 2);
        await wait(t * 450); await shot(n + '_a');
        await wait(t * 300); await shot(n);
        await wait(t * 400);
      }
      else if (st === 'fire') {
        if (['unarmed', 'throw', 'knife_a'].includes(item)) continue;
        await gp(() => window.__gp.mouse(0, true)); await wait(50); await gp(() => window.__gp.mouse(0, false));
        await wait(Number(process.env.FIREMS || 330)); await shot(n); await wait(900);
      }
      else if (st === 'melee') {
        if (item === 'knife_a' || item === 'unarmed') { await gp(() => window.__gp.mouse(0, true)); await wait(60); await gp(() => window.__gp.mouse(0, false)); await wait(150); }
        else { await page.keyboard.press('v'); await wait(170); }
        await shot(n); await wait(700);
      }
    }
  }
  await reset();
  // contact sheet: rows = views, columns = states
  const W = 300;
  const tiles = [];
  let row = 0;
  for (const v of views) {
    let col = 0;
    for (const st of STATES) {
      const f = `${DIR}/${tag}_${item}_${v}_${st}.png`;
      try {
        const c = CROP[v];
        const buf = await sharp(f).extract(c).resize(W, Math.round((W * c.height) / c.width)).png().toBuffer();
        tiles.push({ input: buf, left: col * W, top: row * 360 });
      } catch { /* state skipped */ }
      col++;
    }
    row++;
  }
  await sharp({ create: { width: W * STATES.length, height: 360 * views.length, channels: 3, background: '#202020' } }).composite(tiles).png().toFile(`${DIR}/${tag}_${item}_sheet.png`);
  console.log('sheet', item);
}
console.log('errors', JSON.stringify(errs.slice(0, 6)));
await browser.close();
