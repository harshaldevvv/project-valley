// node tools/audit/attshots.mjs   headless: mount attachments on the sandbox guns and screenshot TP / FP hip / FP ADS.
// docs/audit/screenshots/wip/att_<gun>_<what>_<view>.png ; logs the shot noise radius and the sound id used.
import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';
const OUT = 'docs/audit/screenshots/wip';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.addInitScript(() => {
  window.__ev = [];
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { window.__ev.push(this.buffer ? +this.buffer.duration.toFixed(2) : -1); return st.apply(this, a); };
});
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2500);
await page.mouse.click(480, 270);
await page.evaluate(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; g.sandbox(); g.teleport(0, 40, 0); g.setLook(0, 0); window.__noise = []; g.ctx.game.events.on('noise', (e) => window.__noise.push(e.radius)); });
const cases = [
  ['rifle_a', 0, { optic: 'scope_4x' }, 'scope'],
  ['rifle_a', 0, { optic: 'red_dot', muzzle: 'suppressor' }, 'dot_supp'],
  ['pistol_a', 2, { optic: 'red_dot', muzzle: 'suppressor' }, 'dot_supp'],
  ['rifle_a', 0, { optic: 'red_dot' }, 'ext'],
  ['rifle_a', 0, {}, 'none'],
];
for (const [ci, [id, slot, att, tag]] of cases.entries()) {
  if (process.env.CASE && Number(process.env.CASE) !== ci) continue;
  await page.evaluate(([slot, att]) => { const w = window.__gp.ctx.weapons; w.select(3); w.select(slot); const it = w.loadout.equipped(['primary', 'secondary', 'sidearm'][slot === 2 ? 2 : 0]); it.attach = Object.keys(att).length ? att : undefined; }, [slot, att]);
  await page.waitForTimeout(1800);
  await page.evaluate(() => { const g = window.__gp; g.ctx.rig.mode = 'tp'; });
  await page.waitForTimeout(500);
  await page.evaluate((ext) => { const w = window.__gp.ctx.weapons; if (w.item?.mag) w.item.mag.defId = ext ? 'mag_rifle_ext' : w.item.mag.defId; }, tag === 'ext' && id === 'rifle_a');
  // orbit camera to the front-right of the hero so the gun parts are in view
  await page.evaluate(() => {
    const g = window.__gp, rig = g.ctx.rig; if (!rig.__r) rig.__r = rig.render;
    rig.render = () => { const p = g.ctx.player, cam = g.ctx.game.camera, y = p.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
      cam.position.set(p.curr.x + fx * 1.2 + rx * 0.9, p.curr.y + 1.3, p.curr.z + fz * 1.2 + rz * 0.9); cam.lookAt(p.curr.x + fx * 0.3, p.curr.y + 1.15, p.curr.z + fz * 0.3); cam.updateMatrixWorld(true); };
    g.mouse(2, true);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/att_${id}_${tag}_tp.png` });
  await page.evaluate(() => { const g = window.__gp; g.mouse(2, false); g.ctx.rig.render = g.ctx.rig.__r; });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__gp.mouse(2, true)); await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/att_${id}_${tag}_tp_ads.png` });
  await page.evaluate(() => window.__gp.mouse(2, false)); await page.waitForTimeout(500);
  await page.evaluate(() => { window.__gp.ctx.rig.mode = 'fp'; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/att_${id}_${tag}_fp.png` });
  await page.evaluate(() => window.__gp.mouse(2, true)); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/att_${id}_${tag}_fp_ads.png` });
  const fov = await page.evaluate(() => window.__gp.ctx.game.camera.fov);
  await page.evaluate(() => { window.__ev.length = 0; window.__noise.length = 0; window.__gp.mouse(0, true); });
  await page.waitForTimeout(90);
  await page.evaluate(() => window.__gp.mouse(0, false));
  await page.waitForTimeout(300);
  console.log(id, tag, 'fov', fov.toFixed(1), 'noise radii', JSON.stringify(await page.evaluate(() => window.__noise.slice(0, 3))), 'audio durs', JSON.stringify(await page.evaluate(() => window.__ev.slice(0, 4))));
  await page.evaluate(() => window.__gp.mouse(2, false)); await page.waitForTimeout(500);
}
console.log('errors', errs.slice(0, 6));
await browser.close();
