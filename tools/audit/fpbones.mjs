// node tools/audit/fpbones.mjs   headless: dump the FP arms skeleton (bone names, parents) and socket parents.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
console.log(await page.evaluate(() => {
  const vm = window.__gp.ctx.weapons.vm;
  const out = [];
  vm.pivot.traverse((o) => { if (o.isBone || o.name.startsWith('SOCKET')) out.push(`${o.name} <- ${o.parent?.name} pos=${o.position.toArray().map((v) => v.toFixed(3))}`); });
  return out.join('\n');
}));
await browser.close();
