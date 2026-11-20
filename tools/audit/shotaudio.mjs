// node tools/audit/shotaudio.mjs   headless: fire each gun, log AudioBufferSource starts (duration, panner or not) and audio warnings.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const warns = [];
page.on('console', (m) => /audio/i.test(m.text()) && warns.push(m.text().slice(0, 160)));
await page.addInitScript(() => {
  window.__played = [];
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    window.__played.push({ dur: this.buffer ? +this.buffer.duration.toFixed(2) : -1, when: +(a[0] ?? 0).toFixed(3) });
    return st.apply(this, a);
  };
});
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2500);
await page.mouse.click(480, 270);
await page.evaluate(() => { const g = window.__gp; g.ctx.player.godMode = true; g.sandbox(); g.ctx.rig.mode = 'fp'; });
for (const slot of [0, 2, 3]) {
  await page.evaluate((s) => { window.__gp.ctx.weapons.select(s); window.__played.length = 0; }, slot);
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__played.length = 0; window.__gp.mouse(0, true); });
  await page.waitForTimeout(120);
  await page.evaluate(() => window.__gp.mouse(0, false));
  await page.waitForTimeout(600);
  console.log('slot', slot, JSON.stringify(await page.evaluate(() => window.__played.map((p) => p.dur))));
}
console.log('ctx', await page.evaluate(() => window.__gp.ctx.game.audio ? 'audio api present' : 'none'), 'warnings', warns);
await browser.close();
