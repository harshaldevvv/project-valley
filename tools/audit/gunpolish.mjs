// node tools/audit/gunpolish.mjs [ads|reload|audio|all] #here   headless gun polish audit, one gun at a time.
//  ads:    first-person ADS per optic (irons, red_dot, scope_4x where it fits): the sight point (iron SOCKET_sight, the red
//          dot lens, the scope axis) in camera space must sit on the eye line (|x|,|y| under ADS_TOL m) and the barrel must
//          point along the view (under 1 deg). Screenshot gp_ads_<gun>_<optic>.png.
//  reload: tactical reload filmed in first person and two third-person views (front-right, left side): frames at fixed
//          fractions of the reload, contact sheet gp_reload_<gun>_<view>.png. Logs the left hand's distance to the gun's
//          own magazine point at mag-in (first person) so a hand miles off the gun shows as a number too.
//  audio:  fire 2 shots and a reload per gun with AudioBufferSourceNode.start hooked; every buffer started is mapped back
//          to its file (fetch -> decodeAudioData), so synthesized fallbacks show as "synth". Each gun needs its shot file,
//          its tail file, a mag-out and a mag-in file (and the cycle sound for pump / bolt guns).
// GUNS=pistol_a,rifle_a limits the guns. URL=... overrides the dev server. Exit code 1 on any failure.
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch } from './browser.mjs';

const URL = process.env.URL ?? 'http://localhost:5188/?play';
const OUT = 'docs/audit/screenshots/wip';
const TMP = `${OUT}/_gp_tmp`;
const MODE = process.argv[2] ?? 'all';
const ADS_TOL = 0.004; // m off the eye line at ~0.3-0.5 m: under ~0.5 deg
mkdirSync(TMP, { recursive: true });
const GUNS = [
  ['pistol_a', 2],
  ['revolver_a', 2],
  ['smg_a', 0],
  ['rifle_a', 0],
  ['shotgun_a', 1],
  ['bolt_a', 1],
].filter(([g]) => !process.env.GUNS || process.env.GUNS.split(',').includes(g));
// expected audio per gun: shot sound id -> its file stem, tail stem, cycle stem
const AUDIO = {
  pistol_a: { shot: /pistol_(1911|ppq)/, tail: /pistol_tail/, out: /reload_out_pistol/, in: /reload_in_pistol/, chamber: /bolt_cock|drawKnife1/ },
  revolver_a: { shot: /pistol_(1911|ppq)/, tail: /rifle_tail/, out: /metalLatch/, in: /impactPlate_light/, chamber: /metalLatch/ },
  smg_a: { shot: /pistol_(1911|ppq)/, tail: /pistol_tail/, out: /reload_out_ar/, in: /reload_in_ar/, chamber: /bolt_cock|drawKnife1/ },
  rifle_a: { shot: /rifle_(ak|ar15|sks2)/, tail: /rifle_tail/, out: /reload_out_ar/, in: /reload_in_ar/, chamber: /bolt_cock|drawKnife1/ },
  shotgun_a: { shot: /shotgun_(nova|m12)/, tail: /shotgun_tail/, cycle: /bolt_cock/, out: /metalLatch/, in: /impactPlate_light/, chamber: /bolt_cock/ },
  bolt_a: { shot: /rifle_(sks2|ak)/, tail: /rifle_tail/, cycle: /bolt_cock|drawKnife2/, out: /metalLatch/, in: /reload_in_ar/, chamber: /bolt_cock|drawKnife2/ },
};

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push('console: ' + m.text().slice(0, 300)));
let navs = 0;
page.on('framenavigated', (f) => f === page.mainFrame() && navs++);
await page.addInitScript(() => {
  // buffer -> file: Response.arrayBuffer remembers its URL, decodeAudioData carries it to the AudioBuffer
  const abUrl = new WeakMap();
  window.__bufFile = new WeakMap();
  const rab = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = function () { const u = this.url; return rab.call(this).then((ab) => (abUrl.set(ab, u), ab)); };
  const dec = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (ab, ...rest) {
    const u = abUrl.get(ab);
    return dec.call(this, ab, ...rest).then((b) => (u && window.__bufFile.set(b, u.split('/').slice(-2).join('/')), b));
  };
  window.__audio = [];
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    window.__audio.push(this.buffer ? (window.__bufFile.get(this.buffer) ?? `synth(${this.buffer.duration.toFixed(2)}s)`) : 'none');
    return st.apply(this, a);
  };
});
const fails = [];
const check = (ok, what) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + what);
  if (!ok) fails.push(what);
};
const wait = (ms) => page.waitForTimeout(ms);
const ready = async () => {
  for (let i = 0; ; i++) {
    try {
      return await ready1();
    } catch (e) {
      if (i >= 3) throw e;
      console.log('!!! page reloaded while booting; waiting again');
    }
  }
};
const ready1 = async () => {
  await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30 && window.__gp.ctx.game.loadout, null, { timeout: 240000 });
  await wait(1500);
  await page.evaluate(async () => {
    // the game's own module instances: after an HMR update the game imports '<file>?t=...', so use the newest URL loaded
    const live = (f) => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.split('?')[0].endsWith(f)).pop() ?? f;
    const [inv, items, weapons] = await Promise.all(['/src/systems/inventory.ts', '/src/content/data/items.ts', '/src/content/data/weapons.ts'].map((u) => import(live(u))));
    window.__invTools = { newItem: inv.newItem, remove: inv.removeItem, ITEMS: items.ITEMS, weaponDefs: weapons.weaponDefs, fpArms: weapons.fpArms };
  });
  await page.mouse.click(480, 270); // a user gesture so the AudioContext runs
  await page.evaluate(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; g.teleport(0, 40, 0); g.setLook(0, 0); });
};

/** Equip only `id` in its slot (mag 3 rounds short of full, chambered) with spare magazines in the bag, and draw it. */
const equip = async (id, slot, attach) => {
  await page.evaluate(([id, slot, attach]) => {
    const g = window.__gp, lo = g.ctx.game.loadout, inv = window.__invTools;
    for (const s of ['primary', 'secondary', 'sidearm']) delete lo.equipment[s];
    for (const { grid } of lo.playerGrids()) for (const gi of [...grid.contents]) inv.remove(grid, gi.item);
    const gun = inv.newItem(id);
    const base = inv.weaponDefs[id].magazines[0];
    gun.mag = inv.newItem(base, 1, { rounds: inv.ITEMS[base].capacity - 3 });
    gun.rounds = 1;
    if (attach) gun.attach = attach;
    lo.equipment[['primary', 'secondary', 'sidearm'][slot]] = gun;
    for (let i = 0; i < 3; i++) lo.give(inv.newItem(base, 1, { rounds: inv.ITEMS[base].capacity }));
    g.ctx.game.events.emit('inventoryChanged', {});
    g.ctx.weapons.select(3);
  }, [id, slot, attach ?? null]);
  await wait(700);
  await page.evaluate((slot) => window.__gp.ctx.weapons.select(slot), slot);
  await wait(1600);
};

const fpView = () => page.evaluate(() => { const g = window.__gp; if (g.ctx.rig.__r) g.ctx.rig.render = g.ctx.rig.__r; g.ctx.rig.mode = 'fp'; g.setLook(0, 0); });
const tpView = (side) => page.evaluate((side) => {
  const g = window.__gp, rig = g.ctx.rig;
  rig.mode = 'tp';
  if (!rig.__r) rig.__r = rig.render;
  // side 'r': front-right of the hero; 'l': the hero's left side, a little in front (the support hand's side)
  rig.render = () => {
    const p = g.ctx.player, cam = g.ctx.game.camera, y = p.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
    const [f, r] = side === 'r' ? [1.1, 0.85] : [0.5, -1.45];
    cam.position.set(p.curr.x + fx * f + rx * r, p.curr.y + 1.4, p.curr.z + fz * f + rz * r);
    cam.lookAt(p.curr.x + fx * 0.25, p.curr.y + 1.2, p.curr.z + fz * 0.25);
    cam.updateMatrixWorld(true);
  };
}, side);

// ------------------------------------------------------------------ ADS
const OPTIC_H = { red_dot: 0.024, scope_4x: 0.035 }; // aim point above SOCKET_sight (attachParts.buildOptic)
const measureAds = () =>
  page.evaluate((OPTIC_H) => {
    const w = window.__gp.ctx.weapons, cam = window.__gp.ctx.game.camera, it = w.item;
    const m = w.models.get(it.defId).fp;
    cam.updateMatrixWorld(true);
    const V = cam.position.constructor;
    const inv = cam.matrixWorldInverse.clone().copy(cam.matrixWorld).invert();
    const opt = it.attach?.optic;
    const part = opt ? (m.root.userData.attParts ?? []).find((o) => o.name === 'ATT_optic') : null;
    const sight = m.sockets.get('sight');
    const p = part ? part.localToWorld(new V(0, OPTIC_H[opt], 0)) : sight.localToWorld(new V(0, window.__invTools.fpArms.ironLift?.[it.defId] ?? 0, 0)); // irons: eye height over SOCKET_sight (data)
    p.applyMatrix4(inv);
    const muz = m.muzzle.localToWorld(new V(0, 0, 0)).applyMatrix4(inv);
    // barrel direction = the gun root's -Z in camera space
    const o = m.root.localToWorld(new V(0, 0, 0)), f = m.root.localToWorld(new V(0, 0, -1));
    const dir = f.sub(o).normalize().transformDirection(inv);
    const ang = (Math.acos(Math.min(1, -dir.z)) * 180) / Math.PI;
    return { x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(3), muzY: +muz.y.toFixed(4), barrelDeg: +ang.toFixed(2), fov: +cam.fov.toFixed(1), ads: +w.adsEased.toFixed(2) };
  }, OPTIC_H);

async function adsAudit(guns) {
  for (const [id, slot] of guns) {
    const optics = [null, 'red_dot'];
    const scopeFits = await page.evaluate(async (id) => {
      const a = await import('/src/content/data/attachments.ts');
      const d = a.attachDefs.scope_4x;
      return !d || !d.fits || d.fits.includes(id);
    }, id);
    if (scopeFits) optics.push('scope_4x');
    for (const opt of optics) {
      await equip(id, slot, opt ? { optic: opt } : null);
      await fpView();
      await wait(400);
      await page.evaluate(() => window.__gp.mouse(2, true));
      await wait(1200);
      const r = await measureAds();
      const tag = opt ?? 'irons';
      // the scope picture hides the arms: only its axis matters
      check(Math.abs(r.x) < ADS_TOL && Math.abs(r.y) < ADS_TOL, `${id} ${tag}: sight on the eye line (x ${(r.x * 1000).toFixed(1)} mm, y ${(r.y * 1000).toFixed(1)} mm at ${(-r.z * 100).toFixed(0)} cm; muzzle y ${(r.muzY * 1000).toFixed(1)} mm)`);
      check(r.barrelDeg < 1, `${id} ${tag}: barrel along the view (${r.barrelDeg} deg)`);
      await page.screenshot({ path: `${OUT}/gp_ads_${id}_${tag}.png` });
      await page.evaluate(() => window.__gp.mouse(2, false));
      await wait(400);
    }
  }
}

// ------------------------------------------------------------------ reload
const FRACS = [0.05, 0.18, 0.3, 0.4, 0.5, 0.6, 0.7, 0.82, 0.95];
async function filmReload(id, view) {
  await page.evaluate((fp) => {
    window.__audio.length = 0;
    // every frame of the reload: is the left elbow joint (where the arms mesh ends) inside the view frustum?
    const g = window.__gp, cam = g.ctx.game.camera, vm = g.ctx.weapons.vm;
    window.__elbow = { frames: 0, seen: 0 };
    const tick = () => {
      if (!g.ctx.weapons.reload) return;
      const fa = vm.socket('mag_L')?.parent?.parent;
      if (fp && fa) {
        const V = cam.position.constructor, e = fa.getWorldPosition(new V()).applyMatrix4(cam.matrixWorld.clone().invert());
        const tv = Math.tan((cam.fov * Math.PI) / 360);
        window.__elbow.frames++;
        if (e.z < -0.05 && Math.abs(e.y / e.z) < tv && Math.abs(e.x / e.z) < tv * cam.aspect) window.__elbow.seen++;
      }
      requestAnimationFrame(tick);
    };
    g.ctx.weapons.startReload();
    requestAnimationFrame(tick);
  }, view === 'fp');
  const files = [];
  let hand = null;
  for (const f of FRACS) {
    const k = await page.waitForFunction((f) => { const r = window.__gp.ctx.weapons.reload; return !r ? 1 : r.t / r.total >= f ? r.t / r.total : false; }, f, { timeout: 8000, polling: 'raf' }).then((h) => h.jsonValue());
    const file = `${TMP}/${id}_${view}_${String(Math.round(f * 100)).padStart(2, '0')}.png`;
    await page.screenshot({ path: file, clip: view === 'fp' ? { x: 180, y: 170, width: 600, height: 370 } : { x: 230, y: 70, width: 500, height: 400 } });
    files.push(file);
    if (view === 'fp' && k < 1) {
      // left hand to the gun's own magazine point while the magazine goes in
      const d = await page.evaluate(() => {
        const w = window.__gp.ctx.weapons, vm = w.vm, ev = window.__invTools.fpArms.reloadEvents[w.fpKind];
        const t = vm.shotTime(`fp_${w.fpKind}_reload`);
        const hand = vm.socket('mag_L')?.parent ?? vm.socket('support_L')?.parent;
        const m = w.models.get(w.item.defId).fp, ms = m.sockets?.get('mag') ?? m.mag;
        if (!hand || !ms || !ev) return null;
        const V = hand.position.constructor;
        const a = hand.getWorldPosition(new V()), b = ms.getWorldPosition(new V());
        return { t: +t.toFixed(2), near: t > ev.magIn - 0.12 && t < ev.magIn + 0.05, d: +a.distanceTo(b).toFixed(3) };
      });
      if (d?.near) hand = Math.min(hand ?? 9, d.d);
    }
  }
  await page.waitForFunction(() => !window.__gp.ctx.weapons.reload, null, { timeout: 8000 });
  execFileSync('python', ['tools/audit/sheet.py', `${OUT}/gp_reload_${id}_${view}.png`, '3', '0.8', ...files]);
  return { hand, elbow: await page.evaluate(() => window.__elbow), audio: await page.evaluate(() => window.__audio.slice()) };
}

async function reloadAudit(guns) {
  for (const [id, slot] of guns) {
    for (const view of ['fp', 'tpr', 'tpl']) {
      await equip(id, slot);
      if (view === 'fp') await fpView();
      else await tpView(view === 'tpr' ? 'r' : 'l');
      await wait(600);
      const r = await filmReload(id, view);
      if (view === 'fp') {
        console.log(`     ${id}: left hand to the gun's magazine point at mag-in: ${r.hand === null ? 'n/a' : (r.hand * 100).toFixed(1) + ' cm'}`);
        // a frame or two while the dip eases in is fine
        check(r.elbow.frames > 20 && r.elbow.seen <= 3, `${id}: left elbow (cut end of the arms mesh) out of view through the reload (${r.elbow.seen}/${r.elbow.frames} frames in view)`);
      }
      check(true, `${id} ${view}: reload filmed -> gp_reload_${id}_${view}.png`);
    }
  }
}

// ------------------------------------------------------------------ audio
async function audioAudit(guns) {
  for (const [id, slot] of guns) {
    await equip(id, slot);
    await fpView();
    await wait(300);
    const span = await page.evaluate((id) => 60000 / window.__invTools.weaponDefs[id].rpm, id);
    await page.evaluate(() => (window.__audio.length = 0));
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.__gp.mouse(0, true));
      await wait(60);
      await page.evaluate(() => window.__gp.mouse(0, false));
      await wait(Math.max(700, span + 150));
    }
    const shots = await page.evaluate(() => window.__audio.splice(0));
    await page.evaluate(() => window.__gp.ctx.weapons.startReload());
    await page.waitForFunction(() => !window.__gp.ctx.weapons.reload, null, { timeout: 8000 });
    await wait(200);
    const rel = await page.evaluate(() => window.__audio.splice(0));
    // empty reload (chamber and magazine empty): the chamber sound plays at the end
    await page.evaluate(() => { const w = window.__gp.ctx.weapons; w.item.rounds = 0; w.item.mag.rounds = 0; w.startReload(); });
    await page.waitForFunction(() => !window.__gp.ctx.weapons.reload, null, { timeout: 8000 });
    await wait(200);
    const chamber = await page.evaluate(() => window.__audio.splice(0));
    const exp = AUDIO[id];
    console.log(`     ${id} shots: ${shots.join(', ')}`);
    console.log(`     ${id} reload: ${rel.join(', ')}`);
    check(shots.filter((f) => exp.shot.test(f)).length >= 2, `${id}: shot file played for both shots`);
    check(shots.some((f) => exp.tail.test(f)), `${id}: tail file played`);
    if (exp.cycle) check(shots.some((f) => exp.cycle.test(f)), `${id}: cycle (pump / bolt) sound played`);
    check(rel.some((f) => exp.out.test(f)) && rel.some((f) => exp.in.test(f)), `${id}: its own reload out + in sounds played`);
    console.log(`     ${id} empty reload: ${chamber.join(', ')}`);
    check(chamber.some((f) => exp.chamber.test(f)), `${id}: chamber sound after an empty reload`);
    check(![...shots, ...rel].some((f) => f.startsWith('synth') || f === 'none'), `${id}: no synthesized fallback sounds`);
  }
}

await page.goto(URL);
await ready();
const run = async (fn) => {
  for (let attempt = 1; ; attempt++) {
    const n0 = navs, f0 = fails.length;
    try {
      await fn();
      if (navs === n0) return;
    } catch (e) {
      await wait(1500).catch(() => {}); // the navigation event can trail the error
      if ((navs === n0 && !/context was destroyed|navigat|reading 'ctx'/.test(String(e))) || attempt >= 5) throw e;
    }
    if (attempt >= 5) return;
    console.log(`!!! page reloaded by the dev server; retrying (attempt ${attempt + 1})`);
    fails.length = f0;
    errs.length = 0; // errors from the page being torn down by the reload
    await page.goto(URL);
    await ready();
  }
};
// one gun at a time, so a dev-server reload only repeats that gun
for (const [mode, fn] of [['ads', adsAudit], ['reload', reloadAudit], ['audio', audioAudit]])
  if (MODE === mode || MODE === 'all') for (const g of GUNS) await run(() => fn([g]));
rmSync(TMP, { recursive: true, force: true });
check(errs.length === 0, `no console errors (${errs.length})`);
for (const e of errs.slice(0, 8)) console.log('   ', e);
console.log(fails.length ? `${fails.length} FAILED` : 'ALL OK');
await browser.close();
process.exit(fails.length ? 1 : 0);
