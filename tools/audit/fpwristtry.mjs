// node tools/audit/fpwristtry.mjs <slot> '<json>' '<json>' ...   headless: first-person variants of fpArms data, one crop per variant.
// Each json is merged into fpArms (one level deep), e.g. '{"supportRoll":{"default":0.8}}'. Optional env GUN=<defId> puts that
// gun in the primary slot first. Writes docs/audit/screenshots/wip/wristtry_<i>.png (+ _ads when ADS=1).
import { launch } from './browser.mjs';
const slot = +(process.argv[2] || 0), vars = process.argv.slice(3);
const b = await launch(); const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.evaluate(([s, gun]) => {
  const g = window.__gp; g.ctx.player.godMode = true; g.sandbox();
  if (gun) { const lo = g.ctx.weapons.loadout, eq = lo.equipped; const it = { uid: 9e6, defId: gun, count: 1, durability: 1, rounds: 5 }; lo.equipped = (k) => (k === 'secondary' ? it : eq(k)); s = 1; }
  g.ctx.weapons.select(s); g.ctx.rig.mode = 'fp'; g.teleport(0, 0, 0); g.setLook(0, -0.05);
}, [slot, process.env.GUN || '']);
await page.waitForTimeout(2000);
const base = await page.evaluate(async () => { const m = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => /data\/weapons\.ts/.test(n)) || '/src/content/data/weapons.ts'); return JSON.stringify(m.fpArms); });
let i = 0;
for (const v of vars) {
  await page.evaluate(async ([v, base]) => {
    const m = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => /data\/weapons\.ts/.test(n)) || '/src/content/data/weapons.ts'); const b = JSON.parse(base), p = JSON.parse(v);
    for (const k of Object.keys(p)) m.fpArms[k] = typeof p[k] === 'object' && !Array.isArray(p[k]) ? { ...b[k], ...p[k] } : p[k];
  }, [v, base]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `docs/audit/screenshots/wip/wristtry_${i}.png`, clip: { x: 400, y: 300, width: 720, height: 420 } });
  if (process.env.ADS) {
    await page.evaluate(() => window.__gp.mouse(2, true)); await page.waitForTimeout(700);
    await page.screenshot({ path: `docs/audit/screenshots/wip/wristtry_${i}_ads.png`, clip: { x: 280, y: 200, width: 720, height: 520 } });
    await page.evaluate(() => window.__gp.mouse(2, false)); await page.waitForTimeout(500);
  }
  console.log(i++, v);
}
await b.close();
