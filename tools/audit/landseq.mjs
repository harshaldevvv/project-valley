// node tools/audit/landseq.mjs <tag> [dropM]   headless: drop the hero from dropM (default 2.5 m) and from a normal jump; per-frame
// camera height and hips height around the landing (printed as a compact table), plus a burst of side-view frames
// -> docs/audit/screenshots/wip/<tag>_<case>_<i>.png and <tag>_<case>_strip.png
import sharp from 'sharp';
import { launch } from './browser.mjs';
const [tag = 'land', drop = '2.5'] = process.argv.slice(2);
const DIR = 'docs/audit/screenshots/wip';
const b = await launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(640, 360);
await page.evaluate(() => {
  const g = window.__gp; g.ctx.player.godMode = true; g.sandbox(); g.teleport(0, 0, 0); g.setLook(0, -0.05);
  // per-frame log: time, grounded, camera y offset from the feet, hips y offset from the feet
  let hips = null; g.ctx.playerChar.root.traverse((o) => { if (!hips && /hips/i.test(o.name) && o.isBone) hips = o; });
  g.__log = []; const V = g.ctx.game.camera.position.constructor, v = new V();
  const tick = () => { const p = g.ctx.player; hips.getWorldPosition(v); g.__log.push([performance.now(), p.grounded ? 1 : 0, g.ctx.game.camera.position.y - p.position.y, v.y - p.position.y, p.position.y]); if (g.__log.length > 4000) g.__log.shift(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
async function run(name, start, view) {
  await page.evaluate(([view]) => {
    const g = window.__gp, rig = g.ctx.rig;
    rig.mode = view === 'fp' ? 'fp' : 'tp';
    rig.override = view === 'side' ? () => {
      const p = g.ctx.player, cam = g.ctx.game.camera;
      cam.position.set(p.position.x + 2.6, Math.max(p.position.y, 0) + 1.0, p.position.z - 0.4);
      cam.lookAt(p.position.x, Math.max(p.position.y, 0) + 0.9, p.position.z);
      return true;
    } : null;
    g.teleport(0, 0, 0); g.setLook(0, -0.05);
  }, [view]);
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__gp.__log.length = 0; });
  await start();
  // wait until airborne then grounded again
  await page.waitForFunction(() => window.__gp.__log.some((r) => !r[1]), null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => { const l = window.__gp.__log; const i = l.findIndex((r) => !r[1]); return i >= 0 && l.slice(i).some((r) => r[1]); }, null, { timeout: 5000 });
  const files = [];
  for (let i = 0; i < 10; i++) {
    const f = `${DIR}/${tag}_${name}_${view}_${i}.png`;
    await page.screenshot({ path: f, clip: view === 'side' ? { x: 390, y: 60, width: 500, height: 640 } : { x: 0, y: 0, width: 1280, height: 720 } });
    files.push(f);
  }
  const W = view === 'side' ? 160 : 256, H = view === 'side' ? 205 : 144;
  const tiles = await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(W, H).png().toBuffer(), left: i * W, top: 0 })));
  await sharp({ create: { width: W * 10, height: H, channels: 3, background: '#000' } }).composite(tiles).png().toFile(`${DIR}/${tag}_${name}_${view}_strip.png`);
  const log = await page.evaluate(() => window.__gp.__log.slice());
  const li = log.findIndex((r, i) => i > 0 && r[1] && !log[i - 1][1]);
  const t0 = log[li][0], base = log.slice(-5).reduce((s, r) => s + r[2], 0) / 5, hb = log.slice(-5).reduce((s, r) => s + r[3], 0) / 5;
  const rows = log.slice(Math.max(0, li - 3), li + 40).filter((_, k) => k % 2 === 0).map((r) => `${Math.round(r[0] - t0)}ms cam${((r[2] - base) * 100).toFixed(1)} hips${((r[3] - hb) * 100).toFixed(1)}`);
  console.log(`${name}/${view} (cm vs settled):`, rows.join(' | '));
  await page.evaluate(() => { window.__gp.ctx.rig.override = null; });
}
const dropStart = () => page.evaluate((h) => { const g = window.__gp, V = g.ctx.game.camera.position.constructor; g.ctx.player.teleport(new V(0, h, 0), 0); }, +drop);
const jumpStart = async () => { await page.keyboard.press('Space'); };
for (const view of ['side', 'fp']) {
  await run('drop', dropStart, view);
  await run('jump', jumpStart, view);
}
await b.close();
