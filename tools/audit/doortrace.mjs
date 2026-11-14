import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { window.__gp.ctx.player.godMode = true; window.__gp.teleport(-66.6, -37.4, Math.PI / 2); window.__gp.setLook(Math.PI / 2, -0.05); });
await page.waitForTimeout(600); await page.keyboard.press('KeyE'); await page.waitForTimeout(1200);
await page.keyboard.down('KeyW');
const tr = [];
for (let i = 0; i < 8; i++) { await page.waitForTimeout(500); tr.push(await gp(() => { const p = window.__gp.ctx.player.curr; return [+p.x.toFixed(2), +p.z.toFixed(2)]; })); }
await page.keyboard.up('KeyW');
const hits = await gp(() => { const { R, world } = window.game.phys; const out = []; world.forEachCollider((c) => { const t = c.translation(); if (Math.abs(t.x + 68) < 2.5 && Math.abs(t.z + 37.4) < 2.5 && t.y < 3) { const hs = c.halfExtents ? c.halfExtents() : null; out.push([+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2), hs ? [hs.x, hs.y, hs.z].map((v) => +v.toFixed(2)) : c.shape.type]); } }); return out; });
console.log(JSON.stringify(tr)); console.log(JSON.stringify(hits)); await browser.close();
