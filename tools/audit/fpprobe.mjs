import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
console.log(await page.evaluate(async () => {
  const m = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => /content\/data\/weapons\.ts/.test(n)));
  const w = window.__gp.ctx.weapons; window.__gp.sandbox(); w.select(3);
  const hand = w.vm.sockets.get('weapon').parent;
  await new Promise((r) => setTimeout(r, 1000));
  const q0 = hand.quaternion.toArray().map((v) => +v.toFixed(3));
  m.fpArms.wrist.knife_a = [1.2, 0, 0];
  await new Promise((r) => setTimeout(r, 1000));
  const q1 = hand.quaternion.toArray().map((v) => +v.toFixed(3));
  return JSON.stringify({ q0, q1, wrist: m.fpArms.wrist, item: w.item?.defId, vmReady: w.vm.ready, sockets: [...w.vm.sockets.keys()] });
}));
await browser.close();
