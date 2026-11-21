// node tools/audit/clipmeasure.mjs [clip,...]   headless: sample a hero clip on a cloned skeleton (FK only) and report
// duration, root (hips) travel, ground speed implied by the planted foot (body frame), contact fraction, foot height
// range and arm swing (hand fore-aft range). Compare our retargeted clips with the Polyfork native ones.
import { launch } from './browser.mjs';
const clips = (process.argv[2] ?? 'idle,pf_idle,walk,pf_walk,run,pf_run').split(',');
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
const res = await page.evaluate((clips) => {
  const ch = window.__gp.ctx.playerChar;
  const r2 = ch.root.clone();
  r2.position.set(0, 0, 0); r2.rotation.set(0, 0, 0);
  const find = (n) => { let r = null; r2.traverse((o) => { if (!r && o.name === n) r = o; }); return r; };
  const B = { hips: find('Hips'), lf: find('LeftFoot'), rf: find('RightFoot'), lh: find('LeftHand'), rh: find('RightHand') };
  const V = r2.position.constructor, v = new V();
  const out = {};
  for (const name of clips) {
    const act = ch.actions.get(name);
    if (!act) { out[name] = 'missing'; continue; }
    const clip = act.getClip();
    const m = new ch.mixer.constructor(r2);
    const a = m.clipAction(clip); a.play();
    const N = 120, T = clip.duration, rows = [];
    for (let i = 0; i <= N; i++) {
      m.setTime((T * i) / N); r2.updateMatrixWorld(true);
      const row = {};
      for (const [k, b] of Object.entries(B)) { b.getWorldPosition(v); row[k] = [v.x, v.y, v.z]; }
      rows.push(row);
    }
    m.stopAllAction(); m.uncacheRoot(r2);
    const hipTravel = Math.hypot(rows[N].hips[0] - rows[0].hips[0], rows[N].hips[2] - rows[0].hips[2]);
    const feet = ['lf', 'rf'].map((f) => {
      const ys = rows.map((r) => r[f][1]); const minY = Math.min(...ys), maxY = Math.max(...ys);
      let sp = 0, n = 0;
      for (let i = 1; i <= N; i++) {
        if (rows[i][f][1] > minY + 0.03 || rows[i - 1][f][1] > minY + 0.03) continue;
        const dx = rows[i][f][0] - rows[i - 1][f][0] - (rows[i].hips[0] - rows[i - 1].hips[0]);
        const dz = rows[i][f][2] - rows[i - 1][f][2] - (rows[i].hips[2] - rows[i - 1].hips[2]);
        sp += Math.hypot(dx, dz) / (T / N); n++;
      }
      let strike = -1;
      for (let i = 1; i <= N && strike < 0; i++) if (rows[i][f][1] <= minY + 0.03 && rows[i - 1][f][1] > minY + 0.03) strike = i / N;
      return { speed: n ? +(sp / n).toFixed(2) : 0, contact: +(n / N).toFixed(2), lift: +(maxY - minY).toFixed(3), strike: +strike.toFixed(3) };
    });
    const swing = ['lh', 'rh'].map((h) => { const zs = rows.map((r) => r[h][2] - r.hips[2]); return +(Math.max(...zs) - Math.min(...zs)).toFixed(2); });
    out[name] = { dur: +T.toFixed(3), hipTravel: +hipTravel.toFixed(2), feet, armSwing: swing };
  }
  return out;
}, clips);
for (const [k, v] of Object.entries(res)) console.log(k.padEnd(9), JSON.stringify(v));
await browser.close();
