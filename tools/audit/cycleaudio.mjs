// node tools/audit/cycleaudio.mjs   headless: hammer the trigger with the shotgun and the hunting rifle, log every audio source start
// (time since the first shot, buffer duration / playback rate = audible length) so pump / bolt cycle sounds can be checked against the shots.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.addInitScript(() => {
  window.__ev = [];
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    window.__ev.push({ t: performance.now(), when: a[0] ?? 0, dur: this.buffer ? +(this.buffer.duration / this.playbackRate.value).toFixed(3) : -1 });
    return st.apply(this, a);
  };
});
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2500);
await page.mouse.click(320, 180);
await page.evaluate(() => { const g = window.__gp; g.ctx.player.godMode = true; g.sandbox(); g.ctx.rig.mode = 'fp'; });
for (const [id, slotName, mag, slot, cap] of [['shotgun_a', 'primary', 'mag_shotgun_a', 0, 6], ['bolt_a', 'primary', 'mag_bolt_a', 0, 5]]) {
  await page.evaluate(([id, slotName, mag, slot, cap]) => {
    const w = window.__gp.ctx.weapons, lo = w.loadout;
    const inst = { uid: 2e6 + Math.floor(Math.random() * 1e5), defId: id, count: 1, durability: 1, rounds: 1, mag: { uid: 3e6 + Math.floor(Math.random() * 1e5), defId: mag, count: 1, rounds: cap - 1 } };
    const orig = lo.equipped.bind(lo); lo.equipped = (s) => (s === slotName ? inst : orig(s));
    w.select(3); w.select(slot);
  }, [id, slotName, mag, slot, cap]);
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window.__ev.length = 0; });
  for (let i = 0; i < 70; i++) { await page.evaluate(() => window.__gp.mouse(0, true)); await page.waitForTimeout(25); await page.evaluate(() => window.__gp.mouse(0, false)); await page.waitForTimeout(25); }
  const ev = await page.evaluate(() => window.__ev.map((e) => ({ t: e.t, dur: e.dur })));
  const t0 = ev[0].t;
  console.log(id, ev.map((e) => `${((e.t - t0) / 1000).toFixed(2)}s:${e.dur}`).join('  '));
  await page.waitForTimeout(3000);
}
await browser.close();
