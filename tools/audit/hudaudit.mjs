// node tools/audit/hudaudit.mjs <tag> [sizes]   headless HUD screenshots at each viewport (default 1280x720,1920x1080):
// play (sandbox rifle), dialogue with Odell, inventory (Tab), journal (J), craft (G), build (B), pause (Esc).
// Also prints DOM elements that overlap each other or overflow their box (text cut off) per state.
import { launch } from './browser.mjs';
const [tag = 'hud', sizesArg = '1280x720,1920x1080'] = process.argv.slice(2);
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const ready = (page) => page.waitForFunction(() => window.__gp && window.__npc && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
const probe = (page) => page.evaluate(() => {
  // visible leaf-ish HUD boxes with text: report text overflow and pairwise overlap between separate top-level panels
  const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && r.width > 2 && r.height > 2; };
  const overflow = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.tagName === 'CANVAS' || !vis(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const s = getComputedStyle(el);
    if ((el.scrollWidth > el.clientWidth + 2 && s.overflowX !== 'visible') || (el.scrollHeight > el.clientHeight + 2 && s.overflowY !== 'visible' && s.overflowY !== 'auto' && s.overflowY !== 'scroll'))
      overflow.push(`${el.className || el.tagName}: "${el.textContent.trim().slice(0, 40)}" ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`);
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) overflow.push(`${el.className || el.tagName} off-screen "${el.textContent.trim().slice(0, 30)}" [${r.left|0},${r.top|0},${r.right|0},${r.bottom|0}]`);
  }
  // panels: fixed/absolute positioned visible elements whose parent is not positioned inside another such panel
  const panels = [...document.querySelectorAll('body *')].filter((el) => { const p = getComputedStyle(el).position; return (p === 'fixed' || p === 'absolute') && vis(el) && el.tagName !== 'CANVAS' && el.textContent.trim(); });
  const top = panels.filter((el) => !panels.some((o) => o !== el && o.contains(el)));
  const ov = [];
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
    const a = top[i].getBoundingClientRect(), b = top[j].getBoundingClientRect();
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 4 && h > 4) ov.push(`${(top[i].className || top[i].id || top[i].tagName).toString().slice(0, 30)} x ${(top[j].className || top[j].id || top[j].tagName).toString().slice(0, 30)} ${w | 0}x${h | 0}`);
  }
  return { overflow: overflow.slice(0, 12), overlap: ov.slice(0, 12) };
});
for (const size of sizesArg.split(',')) {
  const [W, H] = size.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto('http://localhost:5188/?play');
  await ready(page);
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const g = window.__gp; g.ctx.player.godMode = true; g.sandbox(); g.ctx.game.events.emit('toast', { text: 'You have materials. Press G to craft.' }); });
  await page.waitForTimeout(800);
  const shot = async (name) => { await page.screenshot({ path: `${out}${tag}_${W}_${name}.png` }); const p = await probe(page); console.log(`${W}x${H} ${name}`, JSON.stringify(p)); };
  await shot('play');
  await page.evaluate(() => { const g = window.__gp, n = window.__npc.live.find((x) => x.def.id === 'odell'); const r = n.root.rotation.y; g.teleport(n.root.position.x - Math.sin(r) * 2, n.root.position.z - Math.cos(r) * 2, 0); g.aimAt(n.root.position.x, n.root.position.y + 1.4, n.root.position.z); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__npc.talk('odell'); window.__gp.ctx.game.events.emit('toast', { text: 'New task. Press J to open the journal.' }); });
  await page.waitForTimeout(800);
  await shot('dialogue');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  for (const [k, name] of [['Tab', 'inventory'], ['KeyJ', 'journal'], ['KeyG', 'craft'], ['KeyB', 'build'], ['Escape', 'pause']]) {
    await page.keyboard.press(k); await page.waitForTimeout(900);
    await shot(name);
    await page.keyboard.press(k === 'Escape' ? 'Escape' : k); await page.waitForTimeout(600);
  }
  console.log('errors', JSON.stringify(errs.slice(0, 3)));
  await page.close();
}
await browser.close();
