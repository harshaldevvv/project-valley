// Sound log audit: one HEADLESS 960x540 browser (never visible, no pointer lock) on its own dev server (:5196).
// Hooks game.audio.play / loop (everything ctx.sfx / ctx.loopSfx reaches) plus every AudioBufferSourceNode start, and
// logs per sound: id, file chosen, volume, distance to the listener, 2D or 3D, and the estimated level at the ear
// (file RMS dBFS + 20 log10(def volume x call volume x distance gain)). Ambience layers (atmosphere.ts) are logged
// through the gain targets they set. Scripted run: footsteps on grass/road/wood/metal, jump+land, doors, looting,
// crafting, every gun (fire + reload), melee, zombie idle/chase/attack/death, driving, rain, night, UI.
//   node tools/audit/soundlog.mjs [label]      (label: before | after, default run)
//   writes docs/audit/soundlog-<label>.md (per-id table); the raw log goes to $TEMP/soundlog-<label>.json
//   env URL to reuse a running server instead of starting vite on :5196.
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';

const label = process.argv[2] || 'run';
const PORT = 5196;
let vite = null;
let URL = process.env.URL;
if (!URL) {
  vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore', windowsHide: true });
  URL = `http://localhost:${PORT}/?play`;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
}
const stopVite = () => {
  if (!vite) return;
  try { execSync(`taskkill /PID ${vite.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  vite = null;
};
process.on('exit', stopVite);

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push((e.stack || String(e)).slice(0, 300)));
page.on('console', (m) => m.type() === 'warning' && /audio/.test(m.text()) && errs.push('warn: ' + m.text().slice(0, 200)));
await page.routeWebSocket(/.*/, () => {}); // no HMR reloads from other sessions' edits mid-run

// ---------- Web Audio taps (before any game code runs) ----------
await page.addInitScript(() => {
  const SL = (window.__sl = { ctx: null, starts: [], amb: [], meta: new Map(), scen: 'boot' });
  const AC = window.AudioContext;
  window.AudioContext = class extends AC { constructor(...a) { super(...a); SL.ctx = this; } };
  // fetch -> ArrayBuffer -> AudioBuffer: remember each buffer's file and loudness
  const abUrl = new WeakMap();
  const f0 = window.fetch;
  window.fetch = async (...a) => {
    const r = await f0(...a);
    const u = String(a[0]?.url ?? a[0]);
    const m = u.match(/assets\/audio\/(.+?)(\?|$)/);
    if (m) {
      const ab0 = r.arrayBuffer.bind(r);
      r.arrayBuffer = async () => { const ab = await ab0(); abUrl.set(ab, decodeURIComponent(m[1])); return ab; };
    }
    return r;
  };
  const dec0 = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (ab, ...rest) {
    const file = abUrl.get(ab);
    return dec0.call(this, ab, ...rest).then((b) => {
      const d = b.getChannelData(0);
      let peak = 0, sum = 0, n = 0;
      for (let i = 0; i < d.length; i++) { const x = Math.abs(d[i]); if (x > peak) peak = x; }
      const gate = peak * 0.03; // ~-30 dB under the peak: the active part only
      for (let i = 0; i < d.length; i++) { const x = d[i]; if (Math.abs(x) > gate) { sum += x * x; n++; } }
      SL.meta.set(b, { file: file ?? '?', dur: +b.duration.toFixed(2), peakDb: +(20 * Math.log10(peak || 1e-9)).toFixed(1), rmsDb: +(10 * Math.log10(sum / Math.max(1, n) || 1e-12)).toFixed(1) });
      return b;
    });
  };
  // every source start: which file (or SYNTH for the procedural placeholder)
  const st0 = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    const m = this.buffer ? SL.meta.get(this.buffer) : null;
    SL.starts.push({ file: m ? m.file : 'SYNTH', loop: this.loop, rate: +this.playbackRate.value.toFixed(3), src: this });
    return st0.apply(this, a);
  };
  // ambience layers: a looping source connected to a gain whose target is then set (atmosphere.ts layer())
  const c0 = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dst, ...rest) {
    if (this instanceof AudioBufferSourceNode && dst instanceof GainNode && this.buffer) {
      const m = SL.meta.get(this.buffer);
      if (m) dst.gain.__file = m.file;
    }
    return c0.call(this, dst, ...rest);
  };
  const tat0 = AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime = function (v, ...rest) {
    if (this.__file) SL.amb.push({ s: SL.scen, file: this.__file, level: +v.toFixed(3) });
    return tat0.call(this, v, ...rest);
  };
});

await page.goto(URL);
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2000);
const fps = await page.evaluate(async () => { const t0 = performance.now(), k0 = window.__gp.ctx.game.tick; let f = 0; await new Promise((r) => { const s = () => (++f < 60 ? requestAnimationFrame(s) : r()); requestAnimationFrame(s); }); const dt = (performance.now() - t0) / 1000; return { fps: +(60 / dt).toFixed(1), simRate: +((window.__gp.ctx.game.tick - k0) / dt / 60).toFixed(2) }; });
console.log('frame rate', JSON.stringify(fps));
await page.keyboard.press('Shift'); // a key gesture resumes the AudioContext (no click: no pointer lock)
await page.waitForTimeout(300);

// ---------- in-page log + helpers ----------
await page.evaluate(async () => {
  const SL = window.__sl;
  const g = window.__gp.ctx;
  const { sounds } = await import('/src/content/data/sounds.ts');
  SL.sounds = sounds;
  SL.log = [];
  g.player.godMode = true;
  const V3 = g.player.curr.constructor;
  const cam = g.game.camera;
  const lp = new V3();
  const audio = g.game.audio;
  const surfAt = (p) => {
    const { R, world } = g.game.phys;
    const hit = world.castRay(new R.Ray({ x: p.x, y: p.y + 0.3, z: p.z }, { x: 0, y: -1, z: 0 }), 1, true, undefined, undefined, g.player.collider);
    return hit ? window.__gp.surfaceOf(hit.collider.handle, p.x, p.z) ?? 'unknown' : 'none';
  };
  const rec = (kind, id, pos, opts) => {
    const def = sounds[id];
    cam.getWorldPosition(lp);
    const twoD = !pos || !!opts?.twoD;
    const d = pos && !twoD ? lp.distanceTo(pos) : 0;
    const ui = twoD && def && def.maxDistance <= 1;
    let drop = '';
    if (!def) drop = 'unknown-id';
    else if (SL.ctx && SL.ctx.state !== 'running' && !def.priority) drop = 'ctx-suspended';
    else if (pos && !twoD && d > def.maxDistance && !def.priority) drop = 'out-of-range';
    const n0 = SL.starts.length;
    return { n0, e: { s: SL.scen, t: +(g.game.tick / 60).toFixed(2), kind, id, file: '', tail: '', vol: def ? +(def.volume * (opts?.volume ?? 1)).toFixed(3) : 0, jitter: opts?.pitchJitter ?? def?.jitter ?? 0, nFiles: def ? def.files.length : 0, d: +d.toFixed(1), mode: twoD ? (ui ? '2D-ui' : '2D') : '3D', ref: def?.refDistance ?? 0, max: def?.maxDistance ?? 0, drop, surface: /^footstep|jump_land/.test(id) ? surfAt(g.player.curr) : '' } };
  };
  const fin = ({ n0, e }) => {
    const ss = SL.starts.slice(n0);
    if (ss[0]) e.file = ss[0].file;
    if (ss[1]) e.tail = ss[1].file;
    SL.log.push(e);
  };
  const play0 = audio.play.bind(audio);
  audio.play = (id, pos, opts) => { const r = rec('play', id, pos, opts); try { return play0(id, pos, opts); } finally { fin(r); } };
  const loop0 = audio.loop.bind(audio);
  audio.loop = (id, obj, opts) => {
    const r = rec('loop', id, obj.getWorldPosition(new V3()), opts);
    try { return loop0(id, obj, opts); } finally { fin(r); }
  };
  // helpers
  const held = g.game.input.held;
  SL.key = (code, on) => (on ? held.add(code) : held.delete(code));
  SL.keysOff = () => ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ShiftLeft', 'KeyC'].forEach((k) => held.delete(k));
  SL.tp = (x, y, z, yaw = 0) => { g.player.teleport(new V3(x, y, z), yaw); window.__gp.setLook(yaw, -0.1); };
  // find walkable points per surface: grid ray down from 40 m around the yard
  SL.findSurfaces = () => {
    const { R, world } = g.game.phys;
    const found = {};
    const p0 = g.player.curr;
    for (let r = 0; r < 260; r += 3) for (let a = 0; a < 6.283; a += 3 / Math.max(3, r)) {
      const x = p0.x + Math.cos(a) * r, z = p0.z + Math.sin(a) * r;
      const hit = world.castRay(new R.Ray({ x, y: 60, z }, { x: 0, y: -1, z: 0 }), 120, true);
      if (!hit || hit.collider.isSensor()) continue;
      const s = window.__gp.surfaceOf(hit.collider.handle, x, z);
      const y = 60 - hit.timeOfImpact;
      if (!s || found[s]) continue;
      // need 3 m of the same surface ahead (+x) at the same height to walk on
      let ok = true;
      for (const dx of [1, 2, 3]) {
        const h2 = world.castRay(new R.Ray({ x: x + dx, y: y + 3, z }, { x: 0, y: -1, z: 0 }), 6, true);
        if (!h2 || window.__gp.surfaceOf(h2.collider.handle, x + dx, z) !== s || Math.abs(3 - h2.timeOfImpact) > 0.3) ok = false;
      }
      // and headroom
      const up = world.castRay(new R.Ray({ x, y: y + 0.2, z }, { x: 0, y: 1, z: 0 }), 2.2, true);
      if (ok && !up) found[s] = [x, y + 0.05, z];
    }
    return found;
  };
  SL.interactables = (re) => g.game.interact.all.filter((i) => { try { return re.test(i.prompt() || ''); } catch { return false; } });
  SL.nearestInter = (reSrc) => {
    const re = new RegExp(reSrc, 'i');
    const p = g.player.curr;
    let best = null;
    for (const i of g.game.interact.all) {
      let t = '';
      try { t = i.prompt() || ''; } catch {}
      if (!re.test(t)) continue;
      if (!best || i.position.distanceTo(p) < best.position.distanceTo(p)) best = i;
    }
    return best;
  };
  SL.equip = (id, slotName, magId, slot, cap) => {
    // reuse the sandbox's own item in that slot: change what it is in place (the loadout keeps its object)
    const w = g.weapons;
    const it = w.loadout.equipped(slot === 3 ? 'melee' : 'primary');
    if (!it) return 'no item';
    it.defId = id;
    it.durability = 1;
    if (magId) { it.rounds = 1; it.mag = { uid: 3e6 + Math.floor(Math.random() * 1e5), defId: magId, count: 1, rounds: cap - 1 }; }
    w.item = null; w.reload = null; w.switchPhase = 'none'; w.slot = -1;
    w.select(slot === 3 ? 3 : 0); // no current item: select() equips at once (draw only)
    return w.item?.defId;
  };

});

const ev = (f, a) => page.evaluate(f, a);
// waits are in sim time (ticks at 60 Hz): headless frames can be slow, wall-clock waits drift out of their scenario
const wait = async (ms) => {
  const [t0, w0] = await ev(() => [window.__gp.ctx.game.tick, performance.now()]);
  const n = Math.max(1, Math.round((ms * 60) / 1000));
  // a UI screen pauses the sim (game.paused): fall back to wall-clock time then
  await page.waitForFunction(([t0, n, w0, ms]) => window.__gp.ctx.game.tick >= t0 + n || ((window.__gp.ctx.game.paused || window.__gp.ctx.game.input.blocked) && performance.now() >= w0 + ms), [t0, n, w0, ms], { timeout: 120000, polling: 16 });
};
const scen = (s) => ev((s) => (window.__sl.scen = s), s);
const hold = async (code, ms) => { await ev((c) => window.__sl.key(c, true), code); await wait(ms); await ev((c) => window.__sl.key(c, false), code); };

const want = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k); // ONLY=guns,zombies runs those sections only
// ---------- 1. footsteps per surface ----------
if (want('walk')) {
var surf = await ev(() => window.__sl.findSurfaces());
console.log('surfaces found', JSON.stringify(surf));
for (const s of ['grass', 'concrete', 'wood', 'metal', 'dirt']) {
  if (!surf[s]) continue;
  await scen('walk_' + s);
  const [x, y, z] = surf[s];
  // walk; blocked by a wall (no step logged)? try the next heading
  for (let k = 0; k < 4; k++) {
    await ev(([x, y, z, yaw]) => window.__sl.tp(x, y, z, yaw), [x, y, z, -Math.PI / 2 + (k * Math.PI) / 2]);
    await wait(700);
    await hold('KeyW', 2500);
    if (await ev((sc) => window.__sl.log.some((e) => e.s === sc && /^footstep/.test(e.id) && e.surface === sc.slice(5)), 'walk_' + s)) break;
  }
  await wait(300);
}
}
// ---------- 2. jump + land (grass) ----------
if (want('jump')) {
if (typeof surf !== 'undefined' && surf.grass) {
  await scen('jump');
  await ev(([x, y, z]) => window.__sl.tp(x, y, z, 0), surf.grass);
  await wait(600);
  for (let i = 0; i < 2; i++) { await hold('Space', 120); await wait(1300); }
}
}
// ---------- 3. doors ----------
if (want('door')) {
await ev(() => window.__gp.teleport(0, 0, 0));
await wait(500);
await scen('door');
// the two nearest door interactables (yard hinge doors creak; placed build doors), each opened then closed
const doorIdx = await ev(() => {
  const g = window.__gp.ctx, p = g.player.curr;
  return g.game.interact.all.map((i, k) => { let t = ''; try { t = i.prompt() || ''; } catch {} return [k, t, i.position.distanceTo(p)]; })
    .filter(([, t]) => /door/i.test(t)).sort((a, b) => a[2] - b[2]).slice(0, 2).map(([k]) => k);
});
for (const k of doorIdx) {
  await ev((k) => { const p = window.__gp.ctx.game.interact.all[k].position; window.__sl.tp(p.x + 1.2, p.y - 1, p.z, Math.PI / 2); }, k);
  await wait(500);
  for (let i = 0; i < 2; i++) { await ev((k) => window.__gp.ctx.game.interact.all[k].onInteract(), k); await wait(1200); }
}
}
// ---------- 4. looting ----------
if (want('loot')) {
await scen('loot');
const lootTexts = await ev(() => [...new Set(window.__gp.ctx.game.interact.all.map((i) => { try { return i.prompt() || ''; } catch { return ''; } }))].slice(0, 40));
console.log('prompts', JSON.stringify(lootTexts));
for (const re of ['^(search|rummage) ', '^pry open']) {
  await ev((re) => { const i = window.__sl.nearestInter(re); if (i) { const p = i.position; window.__sl.tp(p.x + 1.2, p.y - 1, p.z, Math.PI / 2); } }, re);
  await wait(500);
  await ev((re) => window.__sl.nearestInter(re)?.onInteract(), re);
  await wait(1200);
  await page.keyboard.press('Tab'); // closes the container screen (Escape would open the pause menu)
  await wait(400);
}
}
// ---------- 5. crafting + UI ----------
if (want('ui')) {
await scen('ui');
for (const k of ['Tab', 'Tab', 'KeyB', 'KeyB', 'KeyK', 'KeyK']) { await page.keyboard.press(k); await wait(500); }
await scen('craft');
await page.keyboard.press('KeyG');
await wait(600);
await ev(() => { const b = [...document.querySelectorAll('button')].find((b) => /craft/i.test(b.textContent || '') && !b.disabled); b?.click(); });
await wait(3000);
await page.keyboard.press('KeyG');
await wait(500);

}
// ---------- 6. guns: fire + reload each ----------
if (want('guns')) {
await ev(() => { window.__gp.sandbox(); window.__gp.ctx.rig.mode = 'fp'; window.__gp.teleport(0, 0, 0); });
await wait(800);
for (const [id, slotName, mag, slot, cap] of [['pistol_a', 'secondary', 'mag_pistol_a', 1, 15], ['rifle_a', 'primary', 'mag_rifle_a', 0, 30], ['shotgun_a', 'primary', 'mag_shotgun_a', 0, 6], ['bolt_a', 'primary', 'mag_bolt_a', 0, 5], ['revolver_a', 'secondary', 'mag_revolver_a', 1, 6], ['smg_a', 'primary', 'mag_smg_a', 0, 30]]) {
  await scen('gun_' + id);
  await ev((a) => window.__sl.equip(...a), [id, slotName, mag, slot, cap]);
  await wait(3500);
  for (let i = 0; i < 3; i++) { await ev(() => window.__gp.mouse(0, true)); await wait(60); await ev(() => window.__gp.mouse(0, false)); await wait(700); }
  console.log('weapon', id, JSON.stringify(await ev(() => { const w = window.__gp.ctx.weapons; return { item: w.item?.defId, slot: w.slot, phase: w.switchPhase, rounds: w.item?.rounds, mag: w.item?.mag?.rounds }; })));
  await page.keyboard.press('KeyR');
  await wait(4000);
}
// dry fire: empty pistol
await scen('dry_fire');
await ev((a) => window.__sl.equip(...a), ['pistol_a', 'secondary', 'mag_pistol_a', 1, 1]);
await wait(3000);
for (let i = 0; i < 3; i++) { await ev(() => window.__gp.mouse(0, true)); await wait(60); await ev(() => window.__gp.mouse(0, false)); await wait(400); }

}
// ---------- 7. zombies: idle -> chase -> attack -> melee -> death ----------
if (want('zombies')) {
await scen('zombie_idle');
await ev(() => { const g = window.__gp.ctx; for (const z of g.zombies.list) z.hp = 0; window.__gp.spawn(3); });
await wait(1500);
await ev(() => { const g = window.__gp.ctx; const z = g.zombies.list.find((z) => z.alive); if (z) { const p = z.curr; window.__gp.teleport(p.x + 22, p.z, Math.PI / 2); } });
await wait(9000);
await scen('zombie_chase');
await ev(() => { const g = window.__gp.ctx; const z = g.zombies.list.find((z) => z.alive); if (z) { const p = z.curr; window.__gp.teleport(p.x + 9, p.z, Math.PI / 2); window.__gp.faceZombie(); } });
await wait(5000);
await scen('zombie_attack');
await wait(5000);
await scen('melee');
for (const [id] of [['knife_a'], ['crowbar_a'], ['hammer_a']]) {
  await ev((id) => window.__sl.equip(id, 'melee', null, 3), id);
  await wait(3000);
  for (let i = 0; i < 3; i++) { await ev(() => window.__gp.faceZombie()); await ev(() => window.__gp.mouse(0, true)); await wait(60); await ev(() => window.__gp.mouse(0, false)); await wait(700); }
}
await scen('zombie_death');
await ev(() => window.__sl.equip('rifle_a', 'primary', 'mag_rifle_a', 0, 30));
await wait(3000);
for (let i = 0; i < 25; i++) {
  const n = await ev(() => { const d = window.__gp.faceZombie(1.6); return d; });
  if (n < 0) break;
  await ev(() => window.__gp.mouse(0, true)); await wait(60); await ev(() => window.__gp.mouse(0, false)); await wait(300);
}
await wait(1500);

}
// ---------- 8. driving ----------
if (want('drive')) {
await scen('drive');
const hasCar = await ev(() => {
  const g = window.__gp.ctx, car = g.vehicles.list[0];
  if (!car) return false;
  for (const z of g.zombies.list) z.hp = 0;
  const p = car.currPos;
  window.__gp.teleport(p.x + 2, p.z, 0);
  g.vehicles.enter(car);
  return true;
});
if (hasCar) {
  await wait(1500);
  await hold('KeyW', 4000);
  await ev(() => window.__sl.key('KeyD', true)); await hold('KeyW', 1500); await ev(() => window.__sl.key('KeyD', false));
  await hold('KeyS', 1500);
  await hold('KeyH', 400);
  await wait(800);
  await page.keyboard.press('KeyF');
  await wait(1500);
}
}
// ---------- 9. rain, 10. night ----------
if (want('weather')) {
await scen('rain');
await ev(() => { window.__weather.override = true; });
await wait(8000);
await ev(() => { window.__weather.override = false; });
await scen('night');
await ev(() => {
  const t = window.__gp.ctx.game.time;
  const fake = { day: 3, hours: 23, night: 1 };
  for (const k of ['day', 'hours', 'night']) Object.defineProperty(t, k, { get: () => fake[k], configurable: true });
});
await wait(9000);

}
// ---------- collect ----------
const out = await ev(() => {
  const SL = window.__sl;
  const meta = {};
  for (const m of SL.meta.values()) meta[m.file] = m;
  const synthIds = Object.keys(SL.sounds).filter((k) => !SL.sounds[k].files.length || SL.sounds[k].files.every((f) => meta[f] === undefined && false));
  return { log: SL.log, amb: SL.amb, meta, ctxState: SL.ctx?.state, noFile: Object.keys(SL.sounds).filter((k) => !SL.sounds[k].files.length), defs: SL.sounds, synthIds };
});
await browser.close();
stopVite();

// ---------- report ----------
const dbAt = (e) => {
  const m = out.meta[e.file];
  if (!m || e.drop) return null;
  const distGain = e.mode === '3D' ? e.ref / (e.ref + 1.2 * (Math.max(e.d, e.ref) - e.ref)) : 1;
  return m.rmsDb + 20 * Math.log10(Math.max(1e-6, e.vol * distGain));
};
const ids = {};
for (const e of out.log) {
  const r = (ids[e.id] ||= { id: e.id, n: 0, files: new Set(), scen: new Set(), modes: new Set(), dmin: 1e9, dmax: 0, dbs: [], jitter: e.jitter, nFiles: e.nFiles, drops: new Set(), synth: 0, surfaces: new Set() });
  r.n++; if (e.file) r.files.add(e.file); r.scen.add(e.s); r.modes.add(e.mode); r.dmin = Math.min(r.dmin, e.d); r.dmax = Math.max(r.dmax, e.d);
  if (e.drop) r.drops.add(e.drop); if (e.file === 'SYNTH') r.synth++; if (e.surface) r.surfaces.add(e.surface);
  const db = dbAt(e); if (db !== null) r.dbs.push(db);
}
const rows = Object.values(ids).sort((a, b) => a.id.localeCompare(b.id));
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
let md = `# Sound log: ${label}\n\nGenerated by \`node tools/audit/soundlog.mjs ${label}\` (headless, ${new Date().toISOString().slice(0, 16)}Z). AudioContext: ${out.ctxState}.\n\n`;
md += 'Level = file RMS (dBFS, active part) + 20 log10(def volume x call volume x distance gain): what reaches the ear before the bus gains. Variants = distinct files heard / files in the table.\n\n';
md += '| id | plays | scenarios | 2D/3D | dist m | level dB (mean) | variants | jitter | notes |\n|---|---|---|---|---|---|---|---|---|\n';
for (const r of rows) {
  const mean = r.dbs.length ? r.dbs.reduce((a, b) => a + b, 0) / r.dbs.length : NaN;
  const notes = [r.synth ? `SYNTH x${r.synth}` : '', r.drops.size ? 'dropped: ' + [...r.drops].join(',') : '', r.surfaces.size ? 'on: ' + [...r.surfaces].join(',') : ''].filter(Boolean).join('; ');
  md += `| ${r.id} | ${r.n} | ${[...r.scen].join(' ')} | ${[...r.modes].join(',')} | ${r.dmin === 1e9 ? '-' : fmt(r.dmin) + (r.dmax > r.dmin + 0.5 ? '-' + fmt(r.dmax) : '')} | ${fmt(mean)} | ${r.files.size}/${r.nFiles} | ${r.jitter} | ${notes} |\n`;
}
const ambRows = {};
for (const a of out.amb) { const k = a.s + ' ' + a.file; ambRows[k] = Math.max(ambRows[k] ?? 0, a.level); }
md += '\n## Ambience layer targets (max level per scenario)\n\n| scenario | file | max target |\n|---|---|---|\n';
for (const [k, v] of Object.entries(ambRows)) { const [s, f] = k.split(' '); md += `| ${s} | ${f} | ${v} |\n`; }
md += `\n## Ids with no file (synth placeholder only)\n\n${out.noFile.join(', ') || 'none'}\n`;
const played = new Set(rows.map((r) => r.id));
md += `\n## Ids in the table never heard in this run\n\n${Object.keys(out.defs).filter((k) => !played.has(k)).join(', ')}\n`;
md += `\n## File loudness (decoded)\n\n| file | dur s | peak dB | RMS dB |\n|---|---|---|---|\n`;
for (const m of Object.values(out.meta).sort((a, b) => a.file.localeCompare(b.file))) md += `| ${m.file} | ${m.dur} | ${m.peakDb} | ${m.rmsDb} |\n`;
if (errs.length) md += `\n## Page errors / audio warnings\n\n${[...new Set(errs)].slice(0, 20).map((e) => '- ' + e.replace(/\n/g, ' ')).join('\n')}\n`;
mkdirSync('docs/audit', { recursive: true });
writeFileSync(`${process.env.TMPDIR || process.env.TEMP || '.'}/soundlog-${label}.json`, JSON.stringify({ log: out.log, amb: out.amb, meta: out.meta }, null, 1));
writeFileSync(`docs/audit/soundlog-${label}.md`, md);
console.log(md.split('\n## File loudness')[0]);
process.exit(0);
