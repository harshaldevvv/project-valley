// node tools/audit/interiorlight.mjs [tag] [name,name...]   headless lighting check of every *_in view in poiviews.json:
// day (13:00), night (23:00) flashlight off, night flashlight on. Screenshots wip/il_<tag>_<name>_<mode>.png, one contact
// sheet wip/il_<tag>_sheet.png (rows = rooms, cols = day / night off / night on) and per shot mean luma + % near-black
// (luma < 14 of 255) + % blown (luma > 245). Needs the dev server on 5188.
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { launch } from './browser.mjs';
const tag = process.argv[2] ?? 'run';
const only = process.argv[3]?.split(',');
const OUT = 'docs/audit/screenshots/wip';
const views = Object.entries(JSON.parse(readFileSync(new URL('./poiviews.json', import.meta.url), 'utf8')))
  .filter(([n, v]) => n.includes('_in') && v.length <= 5 && (!only || only.includes(n)));
const MODES = [['day', 13, false], ['night', 23, false], ['flash', 23, true]];
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.routeWebSocket(/.*/, () => {});
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2500);
await page.mouse.click(480, 270);
await page.evaluate(() => { const g = window.__gp.ctx; g.player.godMode = true; const zs = g.zombies; zs.updatePoiSpawns = () => {}; zs.clear(); for (const z of zs.poiZones) z.list = []; });
// The flashlight is toggled with the real L key: a dynamic import of flashlight.ts can return a second module copy (Vite adds
// ?t= to edited modules), whose switch the game never reads. State is read off the scene's flashlight SpotLight.
const beamOn = () => page.evaluate(() => { let on = false; window.__gp.ctx.game.scene.traverse((o) => { if (o.isSpotLight && Math.abs(o.angle - Math.PI / 6.2) < 1e-3) on = o.intensity > 0; }); return on; });
async function setFlash(want) {
  for (let i = 0; i < 3 && (await beamOn()) !== want; i++) { await page.keyboard.press('KeyL'); await page.waitForTimeout(400); }
}
async function luma(file) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  // middle 80% x 70% only: skip the HUD along the edges
  const x0 = info.width * 0.1 | 0, x1 = info.width * 0.9 | 0, y0 = info.height * 0.12 | 0, y1 = info.height * 0.82 | 0;
  let s = 0, dark = 0, hot = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = data[y * info.width + x]; s += v; n++; if (v < 14) dark++; if (v > 245) hot++; }
  return { mean: Math.round(s / n), dark: Math.round((dark / n) * 100), hot: Math.round((hot / n) * 100) };
}
const rows = [], files = [];
for (const [name, [x, z, yaw, pitch]] of views) {
  await page.evaluate(([x, z, yaw, pitch]) => { window.__gp.ctx.rig.override = null; window.__gp.teleport(x, z, yaw); window.__gp.setLook(yaw, pitch); }, [x, z, yaw, pitch]);
  await page.waitForTimeout(2000);
  const row = { name };
  for (const [mode, hour, flash] of MODES) {
    await page.evaluate(([hour, x, z, yaw, pitch]) => {
      window.engine.setTimeOfDay(hour);
      window.__gp.teleport(x, z, yaw); window.__gp.setLook(yaw, pitch);
    }, [hour, x, z, yaw, pitch]);
    await setFlash(flash);
    await page.waitForTimeout(1300);
    const f = `${OUT}/il_${tag}_${name}_${mode}.png`;
    await page.screenshot({ path: f });
    files.push(f);
    const l = await luma(f);
    row[mode] = `${l.mean}/${l.dark}%/${l.hot}%`;
  }
  rows.push(row);
}
await setFlash(false);
await browser.close();
// contact sheet: 3 columns at half size, a label strip per row
const W = 480, H = 270, LBL = 22;
const comp = [];
for (let i = 0; i < files.length; i++) {
  const r = Math.floor(i / 3), c = i % 3;
  comp.push({ input: await sharp(files[i]).resize(W, H).toBuffer(), left: c * W, top: r * (H + LBL) + LBL });
}
for (let r = 0; r < rows.length; r++) {
  const t = `${rows[r].name}   day ${rows[r].day}   night ${rows[r].night}   flash ${rows[r].flash}   (mean luma / near-black / blown)`;
  const svg = `<svg width="${W * 3}" height="${LBL}"><rect width="100%" height="100%" fill="#111"/><text x="6" y="16" font-family="sans-serif" font-size="14" fill="#eee">${t}</text></svg>`;
  comp.push({ input: Buffer.from(svg), left: 0, top: r * (H + LBL) });
}
await sharp({ create: { width: W * 3, height: rows.length * (H + LBL), channels: 3, background: '#000' } }).composite(comp).png().toFile(`${OUT}/il_${tag}_sheet.png`);
console.table(rows);
console.log('sheet', `${OUT}/il_${tag}_sheet.png`, 'errors', errs.slice(0, 5));
