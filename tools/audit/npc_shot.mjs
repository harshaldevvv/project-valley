// node tools/audit/npc_shot.mjs #here   headless: each NPC close up, a conversation, the trade screen, head look-at.
import { launch } from './browser.mjs';
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && /npc|model/i.test(m.text()) && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__npc && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
console.log('npcs', await page.evaluate(() => window.__npc.live.map((n) => `${n.def.id}@${n.root.position.x.toFixed(1)},${n.root.position.z.toFixed(1)}`).join(' ')));
for (const id of ['odell', 'eli', 'hollis', 'wren']) {
  await page.evaluate(({ id }) => {
    const g = window.__gp, n = window.__npc.live.find((x) => x.def.id === id);
    if (!n) return;
    g.ctx.player.godMode = true;
    // stand 4 m in front of the NPC (its front is where its body faces), looking at it
    const r = n.root.rotation.y, fx = -Math.sin(r), fz = -Math.cos(r);
    const px = n.root.position.x + fx * 3.6, pz = n.root.position.z + fz * 3.6;
    g.teleport(px, pz, 0);
    g.aimAt(n.root.position.x, n.root.position.y + 1.4, n.root.position.z);
  }, { id });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: out + `npc_${id}.png` });
}
// head look-at: stand to the side of Odell and compare the head's world direction at 3 m and 30 m
console.log('head', await page.evaluate(async () => {
  const g = window.__gp, n = window.__npc.live.find((x) => x.def.id === 'odell');
  const dir = () => { const v = new g.ctx.game.camera.position.constructor(); n.head.getWorldDirection(v); return +Math.atan2(v.x, v.z).toFixed(2); };
  const r = n.root.rotation.y;
  g.teleport(n.root.position.x + 4, n.root.position.z, 0);
  await new Promise((x) => setTimeout(x, 1500));
  const near = dir();
  g.teleport(n.root.position.x + 40, n.root.position.z, 0);
  await new Promise((x) => setTimeout(x, 1500));
  return JSON.stringify({ near, far: dir(), bodyYaw: +r.toFixed(2) });
}));
// conversation and trade
await page.evaluate(() => { const g = window.__gp, n = window.__npc.live.find((x) => x.def.id === 'odell'); g.teleport(n.root.position.x, n.root.position.z - 3, 0); g.aimAt(n.root.position.x, n.root.position.y + 1.4, n.root.position.z); });
await page.waitForTimeout(800);
await page.evaluate(() => window.__npc.talk('odell'));
await page.waitForTimeout(500);
await page.screenshot({ path: out + 'npc_dialogue.png' });
await page.keyboard.press('Digit2'); // trade (first visit: choice 2)
await page.waitForTimeout(500);
await page.evaluate(() => { const lo = window.__gp.ctx.game.loadout; for (const [id, n] of [['cash', 120], ['bandage', 3], ['wood_planks', 8], ['scrap_metal', 5]]) window.__gp.give(id); });
await page.screenshot({ path: out + 'npc_trade.png' });
console.log('trade open', await page.evaluate(() => window.__npc.ui.tradeOpen), 'stock', await page.evaluate(() => window.__npc.trader.stock.length));
await page.keyboard.press('Escape');
console.log('errors', JSON.stringify(errs.slice(0, 6)));
await browser.close();
