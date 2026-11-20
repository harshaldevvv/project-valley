// node tools/audit/fpshots.mjs [state]   headless: first-person viewmodel screenshots for each weapon at pitch -60/0/+60.
// state: idle (default) | ads | reload | sprint. Output: docs/audit/screenshots/wip/fp_<weapon>_<pitch>[_state].png
import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';
const OUT = 'docs/audit/screenshots/wip';
mkdirSync(OUT, { recursive: true });
const state = process.argv[2] ?? 'idle';
const only = process.argv[3]; // optional weapon filter
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(480, 270);
await page.evaluate(() => {
  const g = window.__gp;
  g.ctx.player.godMode = true;
  g.data.horde.passive = true;
  g.sandbox();
  g.ctx.rig.mode = 'fp';
});
if (process.env.WRIST) {
  const w = process.env.WRIST.split(',').map(Number);
  await page.evaluate(async (w) => { const m = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => /content\/data\/weapons\.ts/.test(n))); m.fpArms.wrist.knife_a = w; }, w);
}
const weapons = [
  ['rifle', 0, null],
  ['pistol', 2, null],
  ['knife', 3, 'knife_a'],
  ['crowbar', 3, 'crowbar_a'],
  ['hammer', 3, 'hammer_a'],
];
for (const [name, slot, melee] of weapons) {
  if (only && only !== name) continue;
  await page.evaluate(([slot, melee]) => {
    const w = window.__gp.ctx.weapons;
    if (melee) w.loadout.equipped('melee').defId = melee;
    w.select(slot);
  }, [slot, melee]);
  await page.waitForTimeout(1500);
  for (const pitch of [-60, 0, 60]) {
    await page.evaluate(([pitch, state]) => {
      const g = window.__gp;
      g.ctx.rig.mode = 'fp';
      g.setLook(0, (pitch * Math.PI) / 180);
      g.mouse(2, state === 'ads');
      if (state === 'sprint') g.ctx.player.sprinting = true;
    }, [pitch, state]);
    if (state === 'swing') {
      await page.evaluate(() => window.__gp.mouse(0, true));
      await page.waitForTimeout(160);
      await page.screenshot({ path: `${OUT}/fp_${name}_${pitch}_swing.png` });
      await page.evaluate(() => window.__gp.mouse(0, false));
      await page.waitForTimeout(900);
      continue;
    }
    if (state === 'reload') {
      await page.evaluate(() => { const w = window.__gp.ctx.weapons; if (w.item?.mag) w.item.mag.rounds = 3; w.startReload?.(); w.controls?.press?.('KeyR', true); });
      await page.keyboard.press('r');
      await page.waitForTimeout(700);
    } else await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/fp_${name}_${pitch}${state === 'idle' ? '' : '_' + state}.png` });
  }
  await page.evaluate(() => window.__gp.mouse(2, false));
  await page.waitForTimeout(500);
}
console.log('errors', errs.slice(0, 5));
await browser.close();
