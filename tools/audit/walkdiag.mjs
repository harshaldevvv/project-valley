// node tools/audit/walkdiag.mjs   headless: walk forward on flat ground, log speed dips; then fire guns and log played buffers.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text().slice(0, 200)));
await page.addInitScript(() => {
  window.__played = [];
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    window.__played.push({ t: performance.now(), dur: this.buffer ? +this.buffer.duration.toFixed(2) : -1, loop: this.loop });
    return st.apply(this, a);
  };
});
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(640, 360);
await page.evaluate(() => {
  const g = window.__gp;
  g.ctx.player.godMode = true;
  window.__spd = [];
  const p = g.ctx.player;
  const orig = p.step.bind(p);
  p.step = (dt) => {
    orig(dt);
    window.__spd.push([+Math.hypot(p.vel.x, p.vel.z).toFixed(2), +p.curr.x.toFixed(2), +p.curr.z.toFixed(2), p.grounded ? 1 : 0]);
  };
});
for (const [key, ms] of [['w', 6000], ['a', 2500], ['s', 3000], ['d', 2500]]) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(400);
}
const spd = await page.evaluate(() => window.__spd);
// Dips: speed falls below 60% of its running max while a key is held and then recovers
let dips = 0;
const dipAt = [];
for (let i = 5; i < spd.length - 5; i++) {
  const prev = Math.max(...spd.slice(i - 5, i).map((s) => s[0]));
  const next = Math.max(...spd.slice(i + 1, i + 6).map((s) => s[0]));
  if (prev > 2 && next > 2 && spd[i][0] < prev * 0.6) {
    dips++;
    dipAt.push(spd[i]);
  }
}
console.log('ticks', spd.length, 'dips', dips, JSON.stringify(dipAt.slice(0, 15)));
console.log('ungrounded ticks', spd.filter((s) => !s[3]).length);
// Stalls: velocity says moving but the position barely changes (blocked by something)
let stalls = 0;
const stallAt = [];
for (let i = 1; i < spd.length; i++) {
  const d = Math.hypot(spd[i][1] - spd[i - 1][1], spd[i][2] - spd[i - 1][2]);
  if (spd[i][0] > 2 && d < spd[i][0] * (1 / 60) * 0.4) {
    stalls++;
    stallAt.push(spd[i]);
  }
}
console.log('stalls', stalls, JSON.stringify(stallAt.slice(0, 10)));

// Guns
const before = await page.evaluate(() => window.__played.length);
await page.evaluate(() => window.__gp.sandbox());
await page.waitForTimeout(800);
const perSlot = [];
for (const slot of [0, 1]) {
  await page.evaluate((s) => window.__gp.ctx.weapons.select(s), slot);
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8; i++) {
    const n0 = await page.evaluate(() => [window.__gp.ctx.weapons.shotsFired, window.__played.length]);
    await page.evaluate(() => { const w = window.__gp.ctx.weapons; if (w.item?.mag && w.item.mag.rounds < 3) w.item.mag.rounds = 30; window.__gp.mouse(0, true); });
    await page.waitForTimeout(70);
    await page.evaluate(() => window.__gp.mouse(0, false));
    await page.waitForTimeout(260);
    const n1 = await page.evaluate(() => [window.__gp.ctx.weapons.shotsFired, window.__played.length, window.__gp.ctx.weapons.def?.id]);
    perSlot.push(`${n1[2]}:${n1[0] - n0[0]}shots/${n1[1] - n0[1]}snd`);
  }
}
console.log(perSlot.join(' '));
const info = await page.evaluate((b) => ({ played: window.__played.slice(b).filter((x) => !x.loop).map((x) => x.dur), shots: window.__gp.ctx.weapons.shotsFired, state: window.__gp.ctx.game.audio ? 'ok' : 'none' }), before);
console.log('shots', info.shots, 'played durations', JSON.stringify(info.played));
console.log('errors', JSON.stringify([...new Set(errs)].slice(0, 12)));
await browser.close();
