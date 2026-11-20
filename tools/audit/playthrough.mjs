// node tools/audit/playthrough.mjs #here   headless new-player playthrough + save/reload round trip.
// New game (fresh browser profile) -> finish the first 3 quests through the debug hooks -> change inventory, warmth,
// car fuel, NPC flags, horde schedule -> quick save -> reload the page -> load the quick save -> assert all of it came
// back and nothing logged a console error. Exit code 1 on any failure. URL=... overrides the dev server address.
import { launch } from './browser.mjs';

const URL = process.env.URL ?? 'http://localhost:5188/?play';
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errs = [];
page.on('crash', () => console.log('PAGE CRASHED'));
page.on('close', () => console.log('page closed'));
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text().slice(0, 300)));
const fails = [];
const check = (ok, what) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + what);
  if (!ok) fails.push(what);
};

const ready = async () => {
  await page.waitForFunction(() => window.__gp && window.__quests && window.__npc && window.__craft && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
  await page.waitForTimeout(800);
};

/** Everything the round trip must keep, as plain JSON. */
const snapshot = () =>
  page.evaluate(() => {
    const g = window.__gp, game = g.ctx.game, lo = game.loadout, q = window.__quests.quests;
    const inv = {};
    for (const { grid } of lo.playerGrids()) for (const gi of grid.contents) inv[gi.item.defId] = (inv[gi.item.defId] ?? 0) + gi.item.count;
    const horde = g.ctx.zombies.horde.state;
    return {
      inv,
      quests: Object.fromEntries(Object.entries(q.state).map(([id, s]) => [id, `${s.status}:${s.step}`])),
      warmth: Math.round(game.survival.warmth),
      fuel: g.ctx.vehicles.list.map((c) => +c.fuel.toFixed(1)),
      flags: [...window.__npc.flags].sort(),
      horde: { phase: horde.phase, day: horde.day, done: [...horde.done] },
      day: game.time.day,
    };
  });

console.log('--- new game');
await page.goto(URL);
await ready();
const first3 = await page.evaluate(() => window.__quests.quests.defs.slice(0, 3).map((d) => d.id));
console.log('first quests', first3.join(', '));
const qres = await page.evaluate((ids) => {
  const q = window.__quests.quests;
  for (const id of ids) for (let i = 0; i < 20 && q.state[id].status !== 'done'; i++) {
    if (q.state[id].status === 'locked') q.tick();
    q.skip(id);
  }
  q.tick();
  return ids.map((id) => q.state[id].status);
}, first3);
check(qres.every((s) => s === 'done'), `first 3 quests done (${qres.join(',')})`);

// change the state a save must carry
await page.evaluate(() => {
  const g = window.__gp, game = g.ctx.game;
  for (const id of ['frag_grenade', 'red_dot', 'jerrycan', 'scrap_metal']) g.give(id);
  const s = game.survival;
  if (typeof s.adjust === 'function') s.adjust({ warmth: -37 });
  g.ctx.vehicles.list.forEach((c, i) => (c.fuel = Math.min(c.def.fuelLiters, 3.5 + i)));
  window.__npc.flags.add('playthrough_flag');
  g.ctx.zombies.horde.state.done.push(3);
});
await page.waitForTimeout(600); // let the hints poll and a sim tick run
const before = await snapshot();
console.log('before', JSON.stringify(before));
check(before.warmth < 90, `warmth moved (${before.warmth})`);
check(before.fuel.length > 0, `cars present (${before.fuel.length})`);

const hint = await page.evaluate(() => ({ text: document.getElementById('pv-hint')?.textContent ?? '', seen: JSON.parse(localStorage.getItem('pv.hints.v1') ?? '[]') }));
check(hint.seen.length > 0 && hint.text.length > 0, `first-time hint shown (${hint.seen.join(',')}: "${hint.text}")`);

console.log('--- save, reload, load');
await page.evaluate(() => window.__gp.ctx.game.save.save('quick'));
await page.reload();
await ready();
const loaded = await page.evaluate(() => window.__gp.ctx.game.save.load('quick'));
check(loaded === true, 'quick save loads');
await page.waitForTimeout(800);
const after = await snapshot();
console.log('after ', JSON.stringify(after));

for (const [id, n] of Object.entries(before.inv)) check(after.inv[id] === n, `inventory ${id} x${n} (got ${after.inv[id] ?? 0})`);
check(Object.keys(after.inv).length === Object.keys(before.inv).length, 'no extra inventory items');
check(JSON.stringify(after.quests) === JSON.stringify(before.quests), 'quest states identical');
check(Math.abs(after.warmth - before.warmth) <= 2, `warmth kept (${before.warmth} -> ${after.warmth})`);
check(JSON.stringify(after.fuel) === JSON.stringify(before.fuel), `car fuel kept (${before.fuel} -> ${after.fuel})`);
check(JSON.stringify(after.flags) === JSON.stringify(before.flags), `npc flags kept (${after.flags})`);
check(after.horde.done.includes(3) && after.horde.phase === before.horde.phase, `horde schedule kept (${JSON.stringify(after.horde)})`);
check(after.day === before.day, `day kept (${before.day} -> ${after.day})`);

// a save made while a horde is on loads as a finished night (its zombies are not saved), with the normal spawn cap back
const hz = await page.evaluate(async () => {
  const g = window.__gp, h = g.ctx.zombies.horde, save = g.ctx.game.save;
  h.state = { phase: 'on', day: 6, done: [3] };
  g.ctx.zombies.hordeOn = true;
  await save.save('manual-3');
  h.state = { phase: 'idle', day: 0, done: [] };
  const ok = await save.load('manual-3');
  return { ok, state: JSON.parse(JSON.stringify(h.state)), hordeOn: g.ctx.zombies.hordeOn };
});
check(hz.ok && hz.state.phase === 'idle' && hz.state.done.includes(6) && hz.state.done.includes(3) && !hz.hordeOn, `mid-horde save loads as done (${JSON.stringify(hz)})`);

// the settings toggles exist and the pause card lists the onboarding keys
const menu = await page.evaluate(() => {
  const card = document.querySelector('#menu .mn-card');
  return { keys: [...(card?.querySelectorAll('kbd') ?? [])].map((k) => k.textContent) };
});
for (const k of ['G', 'J', 'N', 'M', 'Z', 'L', 'E', 'Tab']) check(menu.keys.includes(k), `pause card shows ${k}`);

// Settings: the horde and capture-mouse toggles persist with the other settings
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.click('#menu [data-act=settings]');
await page.waitForTimeout(400);
const toggles = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#menu .mn-settings label.row.toggle')];
  const find = (t) => rows.find((r) => r.textContent.includes(t))?.querySelector('input');
  const horde = find('Horde'), cap = find('Capture mouse');
  if (!horde || !cap) return { missing: true };
  const was = { horde: horde.checked, cap: cap.checked };
  horde.click();
  const s = JSON.parse(localStorage.getItem('pv.settings.v1') ?? '{}');
  horde.click();
  return { was, savedHorde: s.hordeNight };
});
check(!toggles.missing && toggles.was.horde === true && toggles.was.cap === false && toggles.savedHorde === false, `settings toggles (${JSON.stringify(toggles)})`);

check(errs.length === 0, `no console errors${errs.length ? ': ' + JSON.stringify(errs.slice(0, 5)) : ''}`);
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL OK');
process.exit(fails.length ? 1 : 0);
