// Drive-feel audit: one headless 960x540 browser (never visible, no pointer lock). Enters the pickup and runs an
// autopilot inside the sim step over seven scenarios, logging speed, yaw rate, slip, pitch/roll, chassis bounce and
// the chase-camera offset per tick/frame, then prints a metrics table and writes frame strips.
//   node tools/audit/drivefeel.mjs [label]        (label: before | after | ..., default 'run')
//   env URL (default http://localhost:5191/?play), OUT (default docs/audit/screenshots/wip)
// Scenarios 1-5 and 7 run on a flat test pad the audit builds 300 m above the yard (no world clutter, repeatable);
// off-road runs on the real outskirts terrain.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { launch } from './browser.mjs';

const label = process.argv[2] || 'run';
const URL = process.env.URL || 'http://localhost:5191/?play';
const OUT = process.env.OUT || 'docs/audit/screenshots/wip';
const TMP = `${OUT}/_drive_tmp`;
mkdirSync(TMP, { recursive: true });

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push((e.stack || String(e)).slice(0, 300)));
await page.routeWebSocket(/.*/, () => {}); // no HMR reloads from other sessions' edits mid-run
await page.goto(URL);
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);

// ---------- in-page harness ----------
await page.evaluate(() => {
  const g = window.__gp.ctx;
  const { R, world } = g.game.phys;
  const V = g.vehicles;
  const car = V.list[0];
  const PY = 300; // pad height
  const STATIC = (1 << 16) | 0xffff;
  // three.js classes from live objects (same module instance as the renderer)
  let anyMesh = null, Mat = null;
  g.game.scene.traverse((o) => {
    if (!anyMesh && o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh) anyMesh = o;
    if (!Mat && o.isMesh && o.material && /^MeshStandard/.test(o.material.type)) Mat = o.material.constructor;
  });
  const Mesh = anyMesh.constructor;
  const Geo = anyMesh.geometry.constructor;
  const Attr = anyMesh.geometry.attributes.position.constructor;
  const box = (w, h, d) => {
    const x = w / 2, y = h / 2, z = d / 2;
    const P = [], N = [], I = [];
    const face = (n, u, v) => {
      const b = P.length / 3;
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        P.push(n[0] * x + u[0] * su * x + v[0] * sv * x, n[1] * y + u[1] * su * y + v[1] * sv * y, n[2] * z + u[2] * su * z + v[2] * sv * z);
        N.push(...n);
      }
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    face([1, 0, 0], [0, 0, -1], [0, 1, 0]); face([-1, 0, 0], [0, 0, 1], [0, 1, 0]);
    face([0, 1, 0], [1, 0, 0], [0, 0, -1]); face([0, -1, 0], [1, 0, 0], [0, 0, 1]);
    face([0, 0, 1], [1, 0, 0], [0, 1, 0]); face([0, 0, -1], [-1, 0, 0], [0, 1, 0]);
    const geo = new Geo();
    geo.setAttribute('position', new Attr(new Float32Array(P), 3));
    geo.setAttribute('normal', new Attr(new Float32Array(N), 3));
    geo.setIndex(I);
    return geo;
  };
  const solid = (cx, cy, cz, w, h, d, color, rotZ = 0) => {
    const m = new Mesh(box(w, h, d), new Mat({ color, roughness: 0.9, metalness: 0 }));
    m.position.set(cx, cy, cz);
    m.rotation.z = rotZ;
    m.frustumCulled = false;
    g.game.scene.add(m);
    const q = { x: 0, y: 0, z: Math.sin(rotZ / 2), w: Math.cos(rotZ / 2) };
    world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(cx, cy, cz).setRotation(q).setFriction(0.9).setCollisionGroups(STATIC));
  };
  // Pad 700 x 400, lanes along +x; stripes every 10 m so motion reads in the frames
  solid(250, PY - 0.5, 0, 700, 1, 400, '#6d6a62');
  for (let x = -90; x < 600; x += 10) solid(x, PY + 0.005, 0, 0.4, 0.01, 400, x % 50 === 0 ? '#e0d8c0' : '#8a867c');
  // Bump lane z=60: curb 0.15 m at x=40, ramp (12 deg, top ~0.8 m) at x=90
  solid(40, PY + 0.075, 60, 0.5, 0.15, 8, '#b8b2a4');
  solid(90, PY + 0.35, 60, 4, 0.7, 8, '#a07850', 0.21);
  // Wall lane z=120: wall at x=60
  solid(60, PY + 1.5, 120, 1, 3, 14, '#7a4a3a');

  g.zombies.updatePoiSpawns = () => {}; // no streamed spawns during the audit
  const df = (window.__df = { phys: [], cam: [], sfx: [], snaps: [], scen: null, t0: 0, done: false, notes: [] });
  // Sound log
  const sfx0 = g.sfx.bind(g);
  g.sfx = (id, pos, opts) => { df.sfx.push({ s: df.scen, t: +(g.game.tick / 60 - df.t0).toFixed(2), id }); return sfx0(id, pos, opts); };
  const loop0 = g.loopSfx.bind(g);
  g.loopSfx = (id, obj, opts) => {
    const h = loop0(id, obj, opts);
    df.loops = df.loops || {};
    const rec = (df.loops[id] = { rate: 1, vol: 0 });
    return { ...h, setRate: (r) => ((rec.rate = r), h.setRate(r)), setVolume: (v) => ((rec.vol = v), h.setVolume(v)), stop: () => h.stop() };
  };
  const held = g.game.input.held;
  const key = (code, on) => (on ? held.add(code) : held.delete(code));
  const keysOff = () => ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'].forEach((k) => held.delete(k));

  const cy = car.def.wheelRadius + 0.12 + car.def.halfExtents[1];
  const place = (x, y, z, yaw) => {
    car.body.setTranslation({ x, y: y + cy + 0.15, z }, true);
    car.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    car.steer = 0;
    car.hp = car.def.hp;
    car.fuel = car.def.fuelLiters;
    V.resync(car);
    V.camHead = yaw;
    // Only the scenario's own zombie may stand on the pad (streamed spawns land on it: the player is up here)
    for (let i = g.zombies.list.length - 1; i >= 0; i--) {
      const z = g.zombies.list[i];
      if (z !== S.zombie.z && z.curr.y > PY - 20) { g.zombies.remove(z); g.zombies.list.splice(i, 1); }
    }
    // Chase camera starts settled behind the car (no swing across the map from the last scenario)
    V.camPos.set(x - Math.sin(yaw) * car.def.camDist * -1, y + cy + car.def.camHeight, z - Math.cos(yaw) * car.def.camDist * -1);
  };
  const EAST = -Math.PI / 2; // forward = (-sin yaw, 0, -cos yaw) = +x
  const heading = () => { const f = { x: 0, y: 0, z: -1 }; const q = car.currQuat; const v = new car.currPos.constructor(0, 0, -1).applyQuaternion(q); return Math.atan2(v.z, v.x); };
  const kmh = () => car.speed * 3.6;
  // Hold a target speed with bang-bang throttle
  const cruise = (target) => { key('KeyW', kmh() < target); key('KeyS', false); };

  // ---------- scenarios (autopilot runs inside the sim step: frame-rate independent) ----------
  const S = {};
  S.accel = { setup: () => place(-60, PY, 0, EAST), step: (t, m) => {
    key('KeyW', true);
    const k = kmh();
    if (!m.t30 && k >= 30) m.t30 = t, df.snaps.push(1);
    if (!m.t60 && k >= 60) { m.t60 = t; m.x60 = car.currPos.x + 60; df.snaps.push(2); }
    if (t > 0.3 && df.snaps.length === 0) df.snaps.push(0);
    if (m.t60 && t > m.t60 + 0.8) { df.snaps.push(3); return true; }
    return t > 14;
  } };
  S.turn = { setup: () => place(-60, PY, -100, EAST), step: (t, m) => {
    if (!m.phase) { cruise(30); if (t > 1.5 && Math.abs(kmh() - 30) < 2.5) { m.phase = 1; m.ts = t; m.h0 = heading(); m.p0 = car.currPos.clone(); df.snaps.push(0); } return t > 10; }
    cruise(30); key('KeyD', true);
    let dh = heading() - m.h0; while (dh < -Math.PI) dh += 2 * Math.PI; while (dh > Math.PI) dh -= 2 * Math.PI;
    m.dh = dh;
    if (!m.s1 && Math.abs(dh) > 0.6) m.s1 = 1, df.snaps.push(1);
    if (!m.s2 && Math.abs(dh) > 1.1) m.s2 = 1, df.snaps.push(2);
    if (Math.abs(dh) >= Math.PI / 2) { m.t90 = t - m.ts; m.p1 = car.currPos.clone(); df.snaps.push(3); return true; }
    return t - m.ts > 10;
  } };
  S.brake = { setup: () => place(-60, PY, 0, EAST), step: (t, m) => {
    if (!m.phase) { key('KeyW', true); if (kmh() >= 60) { m.phase = 1; m.ts = t; m.x0 = car.currPos.x; m.h0 = heading(); keysOff(); key('KeyS', true); df.snaps.push(0); } return t > 14; }
    key('KeyS', true);
    if (!m.s1 && t - m.ts > 0.25) m.s1 = 1, df.snaps.push(1);
    if (!m.s2 && t - m.ts > 0.7) m.s2 = 1, df.snaps.push(2);
    if (kmh() < 1) { if (!m.tStop) { m.tStop = t - m.ts; m.dist = car.currPos.x - m.x0; } }
    if (m.tStop && t - m.ts > m.tStop + 1.0) { df.snaps.push(3); keysOff(); return true; }
    return t - m.ts > 8;
  } };
  S.bump = { setup: () => place(-20, PY, 60, EAST), step: (t, m) => {
    cruise(40);
    const x = car.currPos.x;
    if (!m.s0 && x > 36) m.s0 = 1, df.snaps.push(0);
    if (!m.s1 && x > 86) m.s1 = 1, df.snaps.push(1);
    if (!m.s2 && x > 95) m.s2 = 1, df.snaps.push(2);
    if (!m.s3 && x > 106) m.s3 = 1, df.snaps.push(3);
    return x > 130 || t > 14;
  } };
  S.offroad = { setup: () => {
    // Outskirts hills east of the yard; ground from a ray
    const x = 130, z = -60;
    const TERRAIN = (0xffff << 16) | 2; // ray hits the terrain group only (tree canopies don't count)
    const hit = world.castRay(new R.Ray({ x, y: 100, z }, { x: 0, y: -1, z: 0 }), 200, true, undefined, TERRAIN);
    place(x, hit ? 100 - hit.timeOfImpact : 10, z, EAST);
  }, step: (t, m) => {
    key('KeyW', true);
    if (t > 0.5 && !m.s0) m.s0 = 1, df.snaps.push(0);
    if (t > 2.5 && !m.s1) m.s1 = 1, df.snaps.push(1);
    if (t > 4.5 && !m.s2) m.s2 = 1, df.snaps.push(2);
    if (t > 6.5 && !m.s3) m.s3 = 1, df.snaps.push(3);
    return t > 7;
  } };
  S.wall = { setup: () => place(10, PY, 120, EAST), step: (t, m) => {
    if (!m.hit) cruise(40); else keysOff();
    const k = kmh();
    if (!m.s0 && car.currPos.x > 45) m.s0 = 1, df.snaps.push(0);
    if (!m.hit && t > 0.5 && m.prevK > 25 && k < m.prevK - 4) { m.hit = t; m.vIn = m.prevK; m.hp0 = m.hpPrev; df.snaps.push(1); }
    m.prevK = k; m.hpPrev = car.hp;
    if (m.hit && !m.s2 && t > m.hit + 0.15) m.s2 = 1, df.snaps.push(2);
    if (m.hit && t > m.hit + 1.2) { m.vOut = k; m.hp1 = car.hp; df.snaps.push(3); return true; }
    return t > 10;
  } };
  S.zombie = { setup: async () => {
    place(-10, PY, -160, EAST);
    window.__gp.data.horde.passive = true;
    await g.zombies.spawn(new car.currPos.constructor(45, PY + 0.5, -160), Math.PI / 2, 'shambler');
    S.zombie.z = g.zombies.list[g.zombies.list.length - 1];
  }, step: (t, m) => {
    const z = S.zombie.z;
    cruise(40);
    if (!m.hit && z && z.alive && car.currPos.x < 38) { z.curr.set(45, z.curr.y, -160); z.prev.copy(z.curr); } // pinned in the lane until impact
    if (!m.s0 && car.currPos.x > 38) m.s0 = 1, df.snaps.push(0);
    if (!m.hit && z && (!z.alive || z.lastCarHit > 0)) { m.hit = t; m.vIn = kmh(); m.zAlive = z.alive; m.zhp = z.hp; df.snaps.push(1); m.zy0 = z.curr.y; m.zx0 = z.curr.x; }
    if (m.hit) {
      m.vMin = Math.min(m.vMin ?? 999, kmh());
      m.flyMax = Math.max(m.flyMax || 0, z.curr.y - m.zy0);
      m.throwDist = Math.hypot(z.curr.x - m.zx0, z.curr.z + 160);
      if (!m.s2 && t > m.hit + 0.25) m.s2 = 1, df.snaps.push(2);
      if (t > m.hit + 1.2) { m.vOut = kmh(); m.zAlive2 = z.alive; df.snaps.push(3); return true; }
    }
    return t > 10;
  } };

  // Samplers
  const _qi = car.currQuat.clone();
  const _o = car.currPos.clone();
  let lastDir = null;
  const chase0 = V.chaseCam;
  V.chaseCam = function (dt) {
    const r = chase0.call(this, dt);
    if (df.scen && r) {
      const cam = g.game.camera;
      const root = car.model.root;
      _qi.copy(root.quaternion).invert();
      _o.copy(cam.position).sub(root.position).applyQuaternion(_qi);
      const dir = cam.getWorldDirection(cam.position.clone());
      const turn = lastDir ? (Math.acos(Math.min(1, dir.dot(lastDir))) * 180) / Math.PI : 0;
      lastDir = dir;
      df.cam.push({ s: df.scen, t: +(g.game.tick / 60 - df.t0).toFixed(3), dt, back: +_o.z.toFixed(3), up: +_o.y.toFixed(3), side: +_o.x.toFixed(3), fov: +cam.fov.toFixed(2), turnDeg: +turn.toFixed(3), trauma: +g.rig.trauma.toFixed(3) });
    }
    return r;
  };
  let prevVy = 0;
  const step0 = V.step.bind(V);
  let cur = null, m = null, tStart = 0;
  V.step = (dt) => {
    if (cur && !df.busy) {
      const t = g.game.tick / 60 - tStart;
      let end = false;
      // First 0.5 s: hands off while the suspension settles (car.speed still holds the last scenario's value)
      try { end = t < 0.5 ? (keysOff(), false) : cur.step(t - 0.5, m); } catch (e) { df.notes.push(String(e)); end = true; }
      if (end) { keysOff(); df.result[df.scen] = JSON.parse(JSON.stringify(m)); cur = null; df.scen = null; }
    }
    step0(dt);
    if (df.scen) {
      const lv = car.body.linvel(), av = car.body.angvel();
      const q = car.currQuat;
      _qi.copy(q).invert();
      const vl = new car.currPos.constructor(lv.x, lv.y, lv.z).applyQuaternion(_qi); // car space: -z forward, x right
      const sp = Math.hypot(vl.x, vl.z);
      const slip = sp > 2 ? (Math.atan2(vl.x, -vl.z) * 180) / Math.PI : 0;
      const up = new car.currPos.constructor(0, 1, 0).applyQuaternion(q);
      const fw = new car.currPos.constructor(0, 0, -1).applyQuaternion(q);
      const rt = new car.currPos.constructor(1, 0, 0).applyQuaternion(q);
      let c = 0; for (let k = 0; k < 4; k++) if (car.vc.wheelIsInContact(k)) c++;
      df.phys.push({ s: df.scen, t: +(g.game.tick / 60 - df.t0).toFixed(3), kmh: +(car.speed * 3.6).toFixed(2), yawRate: +((av.y * 180) / Math.PI).toFixed(2), slip: +slip.toFixed(2), pitch: +((Math.asin(fw.y) * 180) / Math.PI).toFixed(2), roll: +((Math.asin(rt.y) * 180) / Math.PI).toFixed(2), ay: +((lv.y - prevVy) / dt).toFixed(2), vy: +lv.y.toFixed(3), y: +car.currPos.y.toFixed(3), x: +car.currPos.x.toFixed(2), z: +car.currPos.z.toFixed(2), contacts: c, steer: +((car.steer * 180) / Math.PI).toFixed(2), rate: df.loops && df.loops.car_engine_loop ? +df.loops.car_engine_loop.rate.toFixed(3) : 0, skid: df.loops && df.loops.car_skid_loop ? +df.loops.car_skid_loop.vol.toFixed(3) : 0, hp: +car.hp.toFixed(1), leanP: car.lean ? +((car.lean.p * 180) / Math.PI).toFixed(2) : 0, leanR: car.lean ? +((car.lean.r * 180) / Math.PI).toFixed(2) : 0, gear: car.gear ?? 0 });
      prevVy = lv.y;
    }
  };
  df.result = {};
  df.run = async (name) => {
    df.busy = true;
    keysOff();
    await S[name].setup();
    df.snaps = [];
    df.busy = false;
    m = {}; cur = S[name]; tStart = g.game.tick / 60; df.t0 = tStart; df.scen = name; lastDir = null;
  };
  // Enter the car (godmode so passers-by don't interrupt)
  g.player.godMode = true;
  V.enter(car);
});

const scenarios = ['accel', 'turn', 'brake', 'bump', 'offroad', 'wall', 'zombie'];
for (const s of scenarios) {
  await page.evaluate((s) => window.__df.run(s), s);
  // Let the car settle 1.5 s after placing (suspension at rest) is part of the scenario start; poll for snaps
  let shot = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const st = await page.evaluate(() => ({ scen: window.__df.scen, snaps: window.__df.snaps.length }));
    while (shot < st.snaps && shot < 4) {
      await page.screenshot({ path: `${TMP}/${s}_${shot}.png` });
      shot++;
    }
    if (!st.scen) break;
    await page.waitForTimeout(40);
  }
  if (shot < 4) for (; shot < 4; shot++) await page.screenshot({ path: `${TMP}/${s}_${shot}.png` });
  await page.waitForTimeout(400);
}
const data = await page.evaluate(() => ({ phys: window.__df.phys, cam: window.__df.cam, sfx: window.__df.sfx, result: window.__df.result, notes: window.__df.notes }));
await browser.close();

// ---------- metrics ----------
const P = (s) => data.phys.filter((r) => r.s === s);
const C = (s) => data.cam.filter((r) => r.s === s);
const max = (a, f) => a.reduce((m, r) => Math.max(m, f(r)), -Infinity);
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length));
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
const sounds = (s) => [...new Set(data.sfx.filter((r) => r.s === s).map((r) => r.id))].join(',');
const camStats = (s) => {
  const c = C(s);
  return { camBackMin: r2(Math.min(...c.map((r) => r.back))), camBackMax: r2(max(c, (r) => r.back)), camSideMax: r2(max(c, (r) => Math.abs(r.side))), camTurnMaxDegPerFrame: r2(max(c, (r) => r.turnDeg)), fovMin: r2(Math.min(...c.map((r) => r.fov))), fovMax: r2(max(c, (r) => r.fov)), traumaMax: r2(max(c, (r) => r.trauma)) };
};
// Settle time: last time |pitch rate| > 4 deg/s after a given t
const settle = (a, from) => {
  let last = from;
  for (let i = 1; i < a.length; i++) if (a[i].t > from && Math.abs((a[i].pitch - a[i - 1].pitch) / (a[i].t - a[i - 1].t || 1 / 60)) > 4) last = a[i].t;
  return last - from;
};
const res = data.result;
const M = {};
{
  const p = P('accel'), r = res.accel || {};
  const rate = p.filter((x) => x.kmh > 1);
  M.accel = { t0to30: r2(r.t30), t0to60: r2(r.t60), bodySquatDeg: r2(max(p, (x) => x.leanP)), gearsUsed: max(p, (x) => x.gear) + 1, pitchMinSquatDeg: r2(Math.min(...p.map((x) => x.pitch))), pitchMaxDeg: r2(max(p, (x) => x.pitch)), engineRate: `${r2(rate[0]?.rate)}→${r2(rate[rate.length - 1]?.rate)}`, ...camStats('accel'), sounds: sounds('accel') };
}
{
  const p = P('turn'), r = res.turn || {};
  const tp = p.filter((x) => Math.abs(x.steer) > 1);
  const chord = r.p0 && r.p1 ? Math.hypot(r.p1.x - r.p0.x, r.p1.z - r.p0.z) : null;
  M.turn = { t90: r2(r.t90), radiusM: r2(chord ? chord / Math.SQRT2 : null), yawRateMax: r2(max(tp, (x) => Math.abs(x.yawRate))), slipMaxDeg: r2(max(tp, (x) => Math.abs(x.slip))), rollMaxDeg: r2(max(tp, (x) => Math.abs(x.roll))), bodyRollMaxDeg: r2(max(tp, (x) => Math.abs(x.leanR))), kmhMin: r2(Math.min(...tp.map((x) => x.kmh))), skidVolMax: r2(max(p, (x) => x.skid)), ...camStats('turn'), sounds: sounds('turn') };
}
{
  const p = P('brake'), r = res.brake || {};
  const b = p.filter((x) => r.ts !== undefined && x.t >= r.ts);
  M.brake = { stopTimeS: r2(r.tStop), stopDistM: r2(r.dist), decelG: r2(r.tStop ? 60 / 3.6 / r.tStop / 9.81 : null), noseDiveDeg: r2(max(b, (x) => -x.pitch)), bodyDiveDeg: r2(max(b, (x) => -x.leanP)), yawDriftMax: r2(max(b, (x) => Math.abs(x.yawRate))), pitchSettleS: r2(settle(b, r.ts + (r.tStop || 0))), skidVolMax: r2(max(b, (x) => x.skid)), ...camStats('brake'), sounds: sounds('brake') };
}
{
  const p = P('bump');
  const after = p.filter((x) => x.x > 92);
  M.bump = { ayMax: r2(max(p, (x) => Math.abs(x.ay))), airTimeS: r2(p.filter((x) => x.contacts === 0).length / 60), pitchMaxDeg: r2(max(p, (x) => Math.abs(x.pitch))), landingSettleS: r2(settle(after, after.find((x) => x.contacts === 4 && x.x > 96)?.t ?? 0)), pitchRmsAfterLanding: r2(rms(after.map((x) => x.pitch))), ...camStats('bump'), sounds: sounds('bump') };
}
{
  const p = P('offroad');
  M.offroad = { kmhAvg: r2(p.reduce((s, x) => s + x.kmh, 0) / Math.max(1, p.length)), kmhMax: r2(max(p, (x) => x.kmh)), distM: r2(p.length ? Math.hypot(p[p.length - 1].x - p[0].x, p[p.length - 1].z - p[0].z) : 0), pitchRms: r2(rms(p.map((x) => x.pitch))), rollRms: r2(rms(p.map((x) => x.roll))), wheelContactPct: r2((100 * p.reduce((s, x) => s + x.contacts, 0)) / Math.max(1, p.length * 4)), ayRms: r2(rms(p.map((x) => x.ay))), ...camStats('offroad'), sounds: sounds('offroad') };
}
{
  const r = res.wall || {};
  M.wall = { kmhIn: r2(r.vIn), bodyPitchMaxDeg: r2(max(P('wall'), (x) => Math.abs(x.leanP))), kmhAfter: r2(r.vOut), carDamage: r2((r.hp0 ?? 0) - (r.hp1 ?? 0)), ...camStats('wall'), sounds: sounds('wall') };
}
{
  const r = res.zombie || {};
  M.zombie = { kmhIn: r2(r.vIn), kmhMinAfterHit: r2(r.vMin), kmhAfter: r2(r.vOut), killed: r.zAlive2 === false, flyHeightM: r2(r.flyMax), throwDistM: r2(r.throwDist), ...camStats('zombie'), sounds: sounds('zombie') };
}
writeFileSync(`${OUT}/drive_metrics_${label}.json`, JSON.stringify({ label, metrics: M, notes: data.notes, errors: errs }, null, 1));
writeFileSync(`${TMP}/samples_${label}.json`, JSON.stringify({ phys: data.phys, cam: data.cam, sfx: data.sfx }));
for (const [k, v] of Object.entries(M)) console.log(k.padEnd(8), JSON.stringify(v));
if (data.notes.length) console.log('notes', data.notes);
if (errs.length) console.log('page errors', errs.slice(0, 5));

// ---------- frame strips (4 frames per scenario, 480x270 each) ----------
for (const s of scenarios) {
  const ins = [0, 1, 2, 3].flatMap((i) => ['-i', `${TMP}/${s}_${i}.png`]);
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...ins, '-filter_complex', '[0]scale=480:-1[a];[1]scale=480:-1[b];[2]scale=480:-1[c];[3]scale=480:-1[d];[a][b][c][d]hstack=4', `${OUT}/drive_${s}_${label}.png`]);
  } catch (e) {
    console.log('strip failed', s, String(e).slice(0, 200));
  }
}
rmSync(TMP + '/' + 'x', { force: true });
console.log('strips', scenarios.map((s) => `${OUT}/drive_${s}_${label}.png`).join(' '));
