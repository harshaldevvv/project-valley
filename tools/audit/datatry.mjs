// node tools/audit/datatry.mjs <module> <export> <view tp|side|fp> <action none|ads|throw> '<json>' ...   headless data variants.
// <module> is a regex for the data file (e.g. 'data/throwables'), <export> the object to patch; each json is merged into it
// (objects one level deep, arrays replaced). Env GUN=<defId> holds that gun (else unarmed), EVAL='<js expr>' prints a value
// per variant (window.__gp is `g`). Writes docs/audit/screenshots/wip/datatry_<i>.png (view-cropped).
import { launch } from './browser.mjs';
const [mod, exp, view = 'fp', action = 'none', ...vars] = process.argv.slice(2);
const b = await launch(); const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(640, 360);
await page.evaluate(([gun, view]) => {
  const g = window.__gp; g.ctx.player.godMode = true;
  let uid = 3e6; const slots = {};
  const magOf = { pistol_a: 'mag_pistol_a', rifle_a: 'mag_rifle_a', shotgun_a: 'mag_shotgun_a', bolt_a: 'mag_bolt_a', revolver_a: 'mag_revolver_a', smg_a: 'mag_smg_a' };
  if (gun) slots.primary = { uid: uid++, defId: gun, count: 1, durability: 1, rounds: 1, mag: { uid: uid++, defId: magOf[gun], count: 1, rounds: 5 } };
  g.ctx.weapons.loadout = { equipped: (s) => slots[s] ?? null, takeMagazine: (w) => ({ uid: uid++, defId: magOf[w.defId], count: 1, rounds: 6 }), give: () => {}, consume: () => 0, count: () => 99, using: null, cancelUse: () => false };
  g.ctx.weapons.sandbox = true;
  g.ctx.weapons.select(0);
  const rig = g.ctx.rig; rig.mode = view === 'fp' ? 'fp' : 'tp';
  rig.override = view === 'side' ? () => {
    const p = g.ctx.player, cam = g.ctx.game.camera;
    const d = g.ctx.playerChar.root.getWorldDirection(cam.position.clone());
    const fx = -d.x, fz = -d.z, rx = -fz, rz = fx;
    cam.position.set(p.position.x + rx * 1.6 + fx * 0.9, p.position.y + 1.35, p.position.z + rz * 1.6 + fz * 0.9);
    cam.lookAt(p.position.x + fx * 0.35, p.position.y + 1.25, p.position.z + fz * 0.35);
    if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
    return true;
  } : null;
  g.teleport(0, 0, 0); g.setLook(0, -0.05);
}, [process.env.GUN || '', view]);
await page.waitForTimeout(2200);
if (action === 'ads') await page.evaluate(() => window.__gp.mouse(2, true));
if (action === 'throw') await page.keyboard.down('n');
await page.waitForTimeout(900);
const find = (mod) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => new RegExp(mod).test(n));
const base = await page.evaluate(async ([mod, exp, f]) => { const m = await import(eval(f)(mod)); return JSON.stringify(m[exp]); }, [mod, exp, find.toString()]);
const CROP = { tp: { x: 120, y: 120, width: 800, height: 600 }, side: { x: 340, y: 60, width: 600, height: 640 }, fp: { x: 380, y: 140, width: 900, height: 580 } };
let i = 0;
for (const v of vars.length ? vars : ['{}']) {
  await page.evaluate(async ([mod, exp, f, v, base]) => {
    const m = await import(eval(f)(mod)); const bb = JSON.parse(base), p = JSON.parse(v), o = m[exp];
    for (const k of Object.keys(bb)) if (!(k in p)) o[k] = typeof bb[k] === 'object' && !Array.isArray(bb[k]) ? { ...o[k], ...bb[k] } : bb[k];
    for (const k of Object.keys(p)) { if (typeof p[k] === 'object' && !Array.isArray(p[k])) Object.assign(o[k], p[k]); else o[k] = p[k]; }
  }, [mod, exp, find.toString(), v, base]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `docs/audit/screenshots/wip/datatry_${i}.png`, clip: CROP[view] });
  if (process.env.EVAL) console.log(i, JSON.stringify(await page.evaluate((e) => { const g = window.__gp; return eval(e); }, process.env.EVAL)));
  console.log(i++, v);
}
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await b.close();
