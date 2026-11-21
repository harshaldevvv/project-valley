// node tools/audit/questchain.mjs #here   headless quest-chain playthrough (one headless browser, no mouse lock).
// New game -> plays every quest in data order from the first objective to the reward, through game actions only:
// travel (teleport to the place), loot (take from the world container the item is in), use / read (timed item use),
// craft (the crafting job), interact (pumps, campfire, car filler cap: the same onInteract the E key calls), talk (the
// NPC dialogue, choices picked like the 1-9 keys), kill (zombies spawned at the place, killed through the normal death
// path), wait (time runs fast). Then every recipe a quest-reward manual unlocks: locked without it, craftable with it. Logs each step and every dead end: an item the player cannot get in the world, a missing
// line of text, an objective that never ticks, a reward not granted. A dead end is unblocked with the debug skip so the
// rest of the chain is still checked. Then: save mid-quest, reload the page, load, compare. Exit 1 on any dead end.
// URL=... overrides the dev server address.
import { launch } from './browser.mjs';

const URL = process.env.URL ?? 'http://localhost:5188/?play';
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text().slice(0, 300)));
const dead = [];
const log = (s) => console.log(s);
const findings = [];
const finding = (q, what) => {
  log(`  FINDING ${q}: ${what}`);
  findings.push(`${q}: ${what}`);
};
const deadEnd = (q, what) => {
  log(`  DEAD END ${q}: ${what}`);
  dead.push(`${q}: ${what}`);
};

const ready = async () => {
  await page.waitForFunction(() => window.__gp && window.__quests && window.__npc && window.__craft && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
  await page.waitForTimeout(800);
};
const ev = (f, a) => page.evaluate(f, a);

// In-page helpers (installed once per page load).
const helpers = async () =>
  ev(async () => {
    const [pois, crafting, qtext, items] = await Promise.all([
      import('/src/content/data/pois.ts'),
      import('/src/content/data/crafting.ts'),
      import('/src/content/text/quests.ts'),
      import('/src/content/text/items.ts'),
    ]);
    const g = window.__gp, game = g.ctx.game, lo = game.loadout;
    const H = (window.__qc = {
      POIS: pois.POIS,
      RECIPES: crafting.RECIPES,
      qtext,
      itemText: items.itemText,
      q: () => window.__quests.quests,
      count: (id) => lo.countAll(id),
      place: (id) => pois.POIS.find((p) => p.id === id),
      tp(x, z) {
        if (g.ctx.player.inVehicle) g.ctx.vehicles.exit();
        g.teleport(x, z, 0);
      },
      /** Containers (world, not the player) holding an item, nearest the place first. */
      holders(id) {
        const out = [];
        for (const c of lo.containers.values()) if (c.grid.contents.some((gi) => gi.item.defId === id)) out.push(c.id);
        return out;
      },
      /** Items no quest needs: what a player drops when the pack is full. */
      keep: new Set(),
      dropped: [],
      /** Put an item in the pack; when it does not fit, drop things no quest needs (like a player would) and retry. */
      stow(item) {
        lo.give(item);
        for (let k = 0; k < 12 && lo.pickups.some((p) => p.item === item); k++) {
          let junk = null;
          for (const { grid } of lo.playerGrids()) for (const gi of grid.contents) if (!junk && !H.keep.has(gi.item.defId)) junk = gi;
          if (!junk) return false;
          lo.detach(junk.item);
          lo.drop(junk.item);
          H.dropped.push(`${junk.item.defId}x${junk.item.count}`);
          const p = lo.pickups.find((p) => p.item === item);
          lo.pickups.splice(lo.pickups.indexOf(p), 1);
          lo.give(item);
        }
        lo.changed();
        return !lo.pickups.some((p) => p.item === item);
      },
      /** Pick up items lying on the ground (rewards that did not fit land at the player's feet). */
      pickUp(id, n) {
        let got = 0;
        for (const p of [...lo.pickups]) {
          if (p.item.defId !== id || got >= n) continue;
          lo.pickups.splice(lo.pickups.indexOf(p), 1);
          if (!H.stow(p.item)) return got;
          got += p.item.count;
        }
        return got;
      },
      /** Take up to n of an item out of a world container into the pack (the inventory drag, minus the UI). */
      loot(cid, id, n = 99) {
        const c = lo.containers.get(cid);
        if (!c) return 0;
        let got = 0;
        for (const gi of [...c.grid.contents]) {
          if (gi.item.defId !== id || got >= n) continue;
          c.grid.contents.splice(c.grid.contents.indexOf(gi), 1);
          got += gi.item.count;
          H.stow(gi.item);
        }
        c.searched = true;
        lo.changed();
        return got;
      },
      findItem(id) {
        let found = null;
        for (const { grid } of lo.playerGrids()) for (const gi of grid.contents) if (!found && gi.item.defId === id) found = gi.item;
        if (!found) for (const it of Object.values(lo.equipment)) if (it && it.defId === id) found = it;
        return found;
      },
      /** The E key on whatever interaction is in reach and offering a prompt (optional text filter). */
      interact(match) {
        const p = g.ctx.player.curr;
        const near = game.interact.all
          .filter((i) => {
            const pos = typeof i.position === 'function' ? i.position() : i.position;
            if (!pos || Math.hypot(pos.x - p.x, pos.z - p.z) > (i.radius ?? 2) + 0.3) return false;
            const t = typeof i.prompt === 'function' ? i.prompt() : i.prompt;
            return t && (!match || String(t).toLowerCase().includes(match));
          })
          .map((i) => {
            const pos = typeof i.position === 'function' ? i.position() : i.position;
            return { i, d: Math.hypot(pos.x - p.x, pos.z - p.z), t: String(typeof i.prompt === 'function' ? i.prompt() : i.prompt) };
          })
          .sort((a, b) => a.d - b.d);
        if (!near.length) return null;
        near[0].i.onInteract();
        return near[0].t;
      },
      interactAt(x, z, match) {
        H.tp(x, z);
        return H.interact(match);
      },
    });
    return Object.keys(H).length;
  });

/** Wait (game time runs) until fn() in the page is truthy or the timeout passes. */
const until = async (fn, arg, ms = 15000) => {
  try {
    await page.waitForFunction(fn, arg, { timeout: ms, polling: 200 });
    return true;
  } catch {
    return false;
  }
};

/** Timed use of an item through the loadout (the survival system finishes it and fires itemUsed). */
const useItem = (id) =>
  ev(async (id) => {
    const lo = window.__gp.ctx.game.loadout;
    const it = window.__qc.findItem(id);
    if (!it) return 'not carried';
    if (!lo.beginUse(it)) return 'refused: ' + (lo.useRefusal ?? '?');
    const t0 = performance.now();
    while (lo.using && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 100));
    return lo.using ? 'use never finished' : 'ok';
  }, id);

/** Get an item into the pack from the world: already carried, else a container that has it. Returns where it came from. */
const obtain = async (quest, id, n) => {
  const have = await ev(([id]) => window.__qc.count(id), [id]);
  if (have >= n) return 'carried';
  let got = have;
  const ground = await ev(([id, k]) => window.__qc.pickUp(id, k), [id, n - have]);
  if (ground) {
    got += ground;
    finding(quest, `${id} was on the ground (pack full when it was given): picked up ${ground}`);
    if (got >= n) return 'picked up from the ground';
  }
  const holders = await ev(([id]) => window.__qc.holders(id), [id]);
  for (const cid of holders) {
    if (got >= n) break;
    await unlockKeyed(quest, cid);
    got += await ev(([cid, id, k]) => window.__qc.loot(cid, id, k), [cid, id, n - got]);
  }
  if (got >= n) return `looted from ${holders.slice(0, 3).join(', ')}`;
  const where = await ev(() => ({ ground: window.__gp.ctx.game.loadout.pickups.map((p) => p.item.defId), worn: Object.values(window.__gp.ctx.game.loadout.equipment).map((i) => i?.defId) }));
  deadEnd(quest, `needs ${n} x ${id}, only ${got} reachable (carried ${have}, in ${holders.length} containers; ground ${where.ground.join(',')}; worn ${where.worn.join(',')}): given by debug`);
  await ev(([id, k]) => {
    for (let i = 0; i < k; i++) window.__gp.give(id);
  }, [id, n - got]);
  return 'debug give';
};

/** A locked container a quest key opens (data/quests.ts QUEST_KEYS): stand at it and press E like a player, then check
 *  it opened and the key was used up. A dead end if the key is not carried by now (the quest order should have given it). */
const unlockKeyed = async (quest, cid) => {
  const r = await ev(async ([cid]) => {
    const { QUEST_KEYS } = await import('/src/content/data/quests.ts');
    const key = QUEST_KEYS[cid];
    const lo = window.__gp.ctx.game.loadout;
    const c = lo.containers.get(cid);
    if (!key || !c?.locked) return null;
    const keys = lo.count(key);
    if (!keys) return { err: `${cid} is locked and the key ${key} is not carried` };
    const pl = window.__gp.ctx.game.places.containers.find((p) => p.id === cid);
    if (!pl) return { err: `${cid} has no world placement` };
    let said = null;
    for (const [dx, dz] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9], [0, 0]]) {
      window.__qc.tp(pl.position.x + dx, pl.position.z + dz);
      await new Promise((res) => setTimeout(res, 250));
      if ((said = window.__qc.interact('unlock'))) break;
    }
    if (!said) return { err: `no unlock prompt at ${cid} while carrying ${key}` };
    if (window.__gp.ctx.game.inventory.isOpen) window.__gp.ctx.game.inventory.toggle(); // the E key opened the locker screen
    return { said, locked: c.locked, keys: lo.count(key), key };
  }, [cid]);
  if (!r) return;
  if (r.err) return deadEnd(quest, r.err);
  log(`    unlock: "${r.said}" -> locked ${r.locked}, ${r.key} left ${r.keys}`);
  if (r.locked) deadEnd(quest, `${cid} still locked after using the key`);
  if (r.keys) finding(quest, `${r.key} was not used up`);
};

const craft = async (quest, recipe) => {
  const r = await ev(([id]) => {
    const r = window.__qc.RECIPES.find((x) => x.id === id);
    return r ? { inputs: r.inputs, tools: r.tools ?? [], station: r.station ?? null, seconds: r.seconds } : null;
  }, [recipe]);
  if (!r) return deadEnd(quest, `recipe ${recipe} does not exist`);
  for (const inp of r.inputs) log(`    input ${inp.item} x${inp.count}: ${await obtain(quest, inp.item, inp.count)}`);
  for (const alt of r.tools) {
    const has = await ev(([alt]) => alt.some((t) => window.__qc.count(t) > 0), [alt]);
    if (!has) log(`    tool ${alt[0]}: ${await obtain(quest, alt[0], 1)}`);
  }
  const before = await ev(() => window.__quests.quests.serialize());
  const ok = await ev(([id]) => {
    const r = window.__qc.RECIPES.find((x) => x.id === id);
    window.__craft.screen.hooks.begin(r, null);
    return true;
  }, [recipe]);
  if (!ok) return;
  await page.waitForTimeout((r.seconds + 1.5) * 1000);
  return before;
};

/** One objective, played. */
async function play(quest, o) {
  if (o.type === 'goto') {
    const p = await ev(([id]) => window.__qc.place(id), [o.poi]);
    if (!p) return deadEnd(quest, `place ${o.poi} is not in POIS`);
    await ev(([x, z]) => window.__qc.tp(x, z), [p.x, p.z]);
    await page.waitForTimeout(700);
  } else if (o.type === 'use') {
    log(`    ${o.item}: ${await obtain(quest, o.item, 1)}`);
    for (let i = 0; i < (o.count ?? 1); i++) log(`    use ${o.item}: ${await useItem(o.item)}`);
    if (o.item === 'flashlight_a') await ev(() => window.__gp.flashlight.set(false));
  } else if (o.type === 'read') {
    log(`    ${o.note}: ${await obtain(quest, o.note, 1)}`);
    const hasText = await ev(([id]) => !!window.__qc.qtext.noteText[id]?.body, [o.note]);
    if (!hasText) deadEnd(quest, `note ${o.note} has no text`);
    log(`    read ${o.note}: ${await useItem(o.note)}`);
  } else if (o.type === 'collect') {
    log(`    ${o.item} x${o.count}: ${await obtain(quest, o.item, o.count)}`);
  } else if (o.type === 'craft') {
    await craft(quest, o.recipe);
  } else if (o.type === 'give') {
    log(`    ${o.item}: ${await obtain(quest, o.item, o.count ?? 1)}`);
    const res = await ev(async ([npc, item]) => {
      const n = window.__gp.ctx.game ? window.__npc.live.find((l) => l.def.id === npc) : null;
      if (!n) return { err: `npc ${npc} not spawned` };
      window.__qc.tp(n.pos.x + 1.2, n.pos.z);
      await new Promise((r) => setTimeout(r, 400));
      const prompt = window.__qc.interact('talk to');
      if (!prompt) return { err: `no talk prompt next to ${npc}` };
      const ui = window.__npc.ui;
      const said = [];
      // pick the choice that hands the item; the 1-9 keys call the same pick()
      for (let k = 0; k < 6 && ui.convo?.d.node; k++) {
        const d = ui.convo.d;
        said.push(d.node + ':' + (document.querySelector('.dlg-say')?.textContent?.slice(0, 40) ?? ''));
        const ch = d.choices();
        const i = ch.findIndex((c) => (c.effects ?? []).some((e) => e.hand?.item === item));
        if (i < 0) break;
        document.querySelectorAll('.dlg-choice')[i].click();
        await new Promise((r) => setTimeout(r, 50));
      }
      if (ui.isOpen) ui.closeAll?.();
      return { said };
    }, [o.npc, o.item]);
    if (res.err) deadEnd(quest, res.err);
    else log(`    talk: ${res.said.join(' | ')}`);
    // flag hand-off (data/npc.ts `show`): an NPC with a twin vanishes here once the flag is set, and its twin is talkable
    const hand = await ev(async ([npc]) => {
      const api = window.__npc;
      const me = api.live.find((l) => l.def.id === npc);
      if (!me?.def.show) return null;
      await new Promise((r) => setTimeout(r, 400)); // a few frames for the npc system to apply the flag
      const twins = api.live.filter((l) => l !== me && l.def.show?.flag === me.def.show.flag);
      const flag = api.flags.has(me.def.show.flag);
      const prompt = window.__qc.interact('talk to'); // null when she is gone; a hit opens a talk, closed again
      if (api.ui.isOpen) api.ui.closeAll?.();
      return { flag, flagName: me.def.show.flag, visible: me.root.visible, prompt, twins: twins.map((t) => t.def.id), wantShown: flag !== !!me.def.show.not };
    }, [o.npc]);
    if (hand) {
      log(`    hand-off: ${hand.flagName}=${hand.flag}, ${o.npc} visible ${hand.visible}, talk prompt ${hand.prompt ? 'yes' : 'none'}, twins ${hand.twins.join(',')}`);
      if (!hand.wantShown && (hand.visible || hand.prompt)) deadEnd(quest, `${o.npc} still there after ${hand.flagName} was set`);
      if (!hand.twins.length) deadEnd(quest, `${o.npc} has a show flag but no twin NPC`);
    }
  } else if (o.type === 'kill') {
    const p = o.poi ? await ev(([id]) => window.__qc.place(id), [o.poi]) : null;
    const n = await ev(async ([x, z, k]) => {
      const zs = window.__gp.ctx.zombies;
      const pc = window.__gp.ctx.player.curr;
      const at = x === null ? { x: pc.x, z: pc.z } : { x, z };
      let killed = 0;
      for (let i = 0; i < k; i++) {
        const z = await zs.spawn(pc.clone().set(at.x + 6 + i, pc.y, at.z + 4), 0);
        if (!z) continue;
        zs.die(z, pc.clone().set(0, 0, 1), false);
        killed++;
      }
      return killed;
    }, [p?.x ?? null, p?.z ?? null, o.count]);
    log(`    killed ${n}`);
  } else if (o.type === 'survive') {
    // the clock has no fast-forward hook outside the F1 panel: move the objective's start back by the hours to wait
    await ev(([q, h]) => (window.__quests.quests.state[q].n -= h), [quest, o.hours]);
    log(`    waited ${o.hours} h (time skipped)`);
  } else if (o.type === 'fuel') {
    log(`    jerrycan: ${await obtain(quest, 'jerrycan', 1)}`);
    const pumps = await ev(async () => (await import('/src/content/data/tools.ts')).PUMPS.spots);
    let said = null;
    for (const s of pumps) {
      if ((said = await ev(([x, z]) => window.__qc.interactAt(x + 0.8, z, 'jerrycan'), [s.x, s.z]))) break;
    }
    log(`    pump: ${said}`);
    await page.waitForTimeout(500);
  } else if (o.type === 'event') {
    if (o.name === 'refuel') {
      const said = await ev(async () => {
        const cars = window.__gp.ctx.vehicles.list;
        for (const c of cars) {
          c.fuel = Math.min(c.fuel, c.def.fuelLiters - 8);
          const t = c.trunkPos;
          window.__qc.tp(t.x, t.z);
          await new Promise((r) => setTimeout(r, 300));
          const s = window.__qc.interact('refuel');
          if (s) return s;
        }
        return null;
      });
      log(`    car filler: ${said}`);
    } else if (o.name === 'campfire_lit') {
      log(`    campfire_kit: ${await obtain(quest, 'campfire_kit', 1)}`);
      log(`    place: ${await useItem('campfire_kit')}`);
      for (const ign of ['matches', 'lighter']) if (await ev(([i]) => window.__qc.count(i), [ign])) break;
      const said = await ev(() => {
        const c = window.__craft.camps().at(-1);
        if (!c) return 'no camp placed';
        window.__qc.tp(c.x + 1, c.z);
        return window.__qc.interact('campfire') ?? 'no prompt at the camp';
      });
      log(`    light: ${said}`);
    } else if (o.name === 'radio') {
      const p = o.poi ? await ev(([id]) => window.__qc.place(id), [o.poi]) : null;
      if (p) await ev(([x, z]) => window.__qc.tp(x, z), [p.x, p.z]);
      log(`    radio: ${await obtain(quest, 'radio_handheld', 1)}`);
      log(`    use radio: ${await useItem('radio_handheld')}`);
    } else deadEnd(quest, `no game action known for event ${o.name}`);
  }
}

console.log('--- new game');
await page.goto(URL);
await ready();
await helpers();
const defs = await ev(() => window.__quests.quests.defs.map((d) => ({ id: d.id, requires: d.requires, objectives: d.objectives, rewards: d.rewards })));
log(`${defs.length} quests: ${defs.map((d) => d.id).join(', ')}`);
await ev(() => {
  const H = window.__qc;
  // record every reward the quest system hands out and whether it is in the pack, worn or on the ground afterwards
  const q = window.__quests.quests, lo = window.__gp.ctx.game.loadout;
  const all = (id) => {
    let n = 0;
    const walk = (it) => {
      if (!it) return;
      if (it.defId === id) n += it.count;
      for (const g of [...(it.contents ? [{ contents: it.contents }] : []), ...(it.pockets ?? []).map((c) => ({ contents: c }))]) for (const gi of g.contents) walk(gi.item);
    };
    for (const it of Object.values(lo.equipment)) walk(it);
    for (const p of lo.pickups) walk(p.item);
    return n;
  };
  H.rewards = [];
  const give = q.env.give;
  q.env.give = (item, count) => {
    const before = all(item);
    give(item, count);
    H.rewards.push({ item, count, got: all(item) - before });
  };
  /** What the quests from `from` on still need (a player keeps those and drops the rest when the pack is full). */
  H.setKeep = (from) => {
    H.keep.clear();
    for (const d of window.__quests.quests.defs.slice(from))
      for (const o of d.objectives) {
        for (const k of ['item', 'note']) if (o[k]) H.keep.add(o[k]);
        const r = o.recipe && H.RECIPES.find((x) => x.id === o.recipe);
        if (r) for (const i of [...r.inputs.map((x) => x.item), ...(r.tools ?? []).flat()]) H.keep.add(i);
        if (o.type === 'fuel' || o.name === 'refuel') H.keep.add('jerrycan');
        if (o.name === 'campfire_lit') for (const i of ['campfire_kit', 'matches', 'lighter']) H.keep.add(i);
        if (o.name === 'radio') H.keep.add('radio_handheld');
      }
  };
});

let saved = false;
for (const [qi, d] of defs.entries()) {
  await ev(([i]) => window.__qc.setKeep(i), [qi]);
  log(`\n=== ${d.id}`);
  const txt = await ev(([id]) => {
    const t = window.__qc.qtext.questText[id];
    return t ? { title: t.title, n: t.objectives?.length ?? 0 } : null;
  }, [d.id]);
  if (!txt?.title) deadEnd(d.id, 'quest has no title text');
  else if (txt.n !== d.objectives.length) deadEnd(d.id, `text has ${txt.n} objective lines for ${d.objectives.length} objectives`);
  const st = await ev(([id]) => window.__quests.quests.state[id].status, [d.id]);
  if (st !== 'active') {
    deadEnd(d.id, `not active when its requirements (${d.requires.join(',') || 'none'}) are done (status ${st})`);
    continue;
  }
  await ev(() => (window.__qc.rewards = []));
  for (let i = 0; i < d.objectives.length; i++) {
    const o = d.objectives[i];
    const s = await ev(([id]) => window.__quests.quests.state[id], [d.id]);
    if (s.status !== 'active' || s.step > i) {
      log(`  [${i}] ${o.type} ${o.poi ?? o.item ?? o.recipe ?? o.note ?? o.name ?? ''}: already ticked`);
      continue;
    }
    log(`  [${i}] ${o.type} ${JSON.stringify(o)}`);
    await play(d.id, o);
    const ticked = await until(([id, i]) => {
      const s = window.__quests.quests.state[id];
      return s.status === 'done' || s.step > i;
    }, [d.id, i], 6000);
    if (!ticked) {
      deadEnd(d.id, `objective ${i} (${o.type}) never ticked`);
      await ev(([id]) => window.__quests.quests.skip(id), [d.id]);
    } else log(`  [${i}] ticked`);
    // save in the middle of the chain once, to check the round trip later
    if (!saved && d.id === 'maple' && i === 1) {
      saved = true;
      await ev(() => window.__gp.ctx.game.save.save('manual-2'));
      log('  (saved to manual-2 mid-quest)');
    }
  }
  const after = await ev(([id]) => ({ status: window.__quests.quests.state[id].status, rewards: window.__qc.rewards }), [d.id]);
  if (after.status !== 'done') deadEnd(d.id, `status ${after.status} after every objective`);
  // rewards land in the pack (or worn), or on the ground at the player's feet when it is full
  for (const r of d.rewards) {
    const g = after.rewards.find((x) => x.item === r.item);
    if (!g || g.got < r.count) deadEnd(d.id, `reward ${r.item} x${r.count} not granted (${g ? '+' + g.got : 'never given'})`);
  }
  log(`  done; rewards ${d.rewards.map((r) => `${r.item} x${r.count}`).join(', ')}`);
}

// Recipe unlocks: a readable quest reward (a manual) that is the only tool a recipe accepts (field manual -> IFAK) must make that recipe craftable.
const unlocks = await ev(async ([rewards]) => {
  const { ITEMS } = await import('/src/content/data/items.ts');
  const book = (id) => rewards.includes(id) && ITEMS[id]?.use?.action === 'read';
  return window.__qc.RECIPES.filter((r) => (r.tools ?? []).some((g) => g.length === 1 && book(g[0]))).map((r) => ({ id: r.id, tool: r.tools.find((g) => g.length === 1 && book(g[0]))[0], out: r.outputs[0]?.item }));
}, [defs.flatMap((d) => d.rewards.map((r) => r.item))]);
if (!unlocks.length) finding('unlock', 'no quest reward unlocks a recipe');
for (const u of unlocks) {
  log(`\n=== recipe unlock: ${u.id} (needs ${u.tool})`);
  await ev(([t, out]) => (window.__qc.keep.add(t), window.__qc.keep.add(out)), [u.tool, u.out]);
  // the inputs are not what is checked here: put them in the pack (stowing, dropping junk if full)
  const inputs = await ev(([id]) => window.__qc.RECIPES.find((r) => r.id === id).inputs, [u.id]);
  for (const i of inputs)
    await ev(async ([item, n]) => {
      const { newItems } = await import('/src/systems/inventory.ts');
      window.__qc.keep.add(item);
      const short = n - window.__qc.count(item);
      if (short > 0) for (const it of newItems(item, short)) window.__qc.stow(it);
    }, [i.item, i.count]);
  // the gate: without the manual the recipe reports it as a missing tool
  const gate = () =>
    ev(async ([id, t]) => {
      const { check } = await import('/src/systems/crafting.ts');
      const r = window.__qc.RECIPES.find((x) => x.id === id);
      return check(window.__gp.ctx.game.loadout, r, new Set(), null).some((m) => m.kind === 'tool' && m.any.includes(t));
    }, [u.id, u.tool]);
  const carried = await ev(([t]) => window.__qc.count(t), [u.tool]);
  if (!carried && !(await gate())) deadEnd('unlock', `${u.id} is craftable without ${u.tool}`);
  // a full pack leaves the reward at the player's feet: pick it up like a player would
  const has = carried || (await ev(([t]) => window.__qc.pickUp(t, 1), [u.tool]));
  if (!has) {
    deadEnd('unlock', `${u.tool} is not carried after its quest, so ${u.id} stays locked`);
    continue;
  }
  if (await gate()) deadEnd('unlock', `${u.id} still asks for ${u.tool} while it is carried`);
  const made = () => ev(([o]) => window.__qc.count(o) + window.__gp.ctx.game.loadout.pickups.filter((p) => p.item.defId === o).reduce((s, p) => s + p.item.count, 0), [u.out]);
  const before = await made();
  await craft('unlock', u.id);
  const after = await made();
  if (after <= before) deadEnd('unlock', `crafting ${u.id} with ${u.tool} made nothing (${before} -> ${after})`);
  else log(`  locked without ${u.tool}: ${carried ? 'not checked (already carried)' : 'yes'}; crafted ${u.out}: ${before} -> ${after}`);
}

log(`\nitems dropped to make room: ${await ev(() => window.__qc.dropped.join(', ') || 'none')}`);
console.log('\n--- save round trip (mid-quest save made during maple)');
const snap = () =>
  ev(() => {
    const g = window.__gp, lo = g.ctx.game.loadout, q = window.__quests.quests;
    const inv = {};
    for (const { grid } of lo.playerGrids()) for (const gi of grid.contents) inv[gi.item.defId] = (inv[gi.item.defId] ?? 0) + gi.item.count;
    const car = g.ctx.vehicles.list[0];
    const t = car?.body.translation();
    const w = window.__weather ?? {};
    return {
      inv, q: Object.fromEntries(Object.entries(q.state).map(([id, s]) => [id, `${s.status}:${s.step}`])), notes: [...q.notes], tracked: q.tracked,
      car: t ? [t.x, t.z, car.fuel] : null, day: g.ctx.game.time.day, hours: g.ctx.game.time.hours, rain: w.target ?? null, fog: w.fogOverride ?? null,
    };
  });
// move a car (and give it some fuel) so the round trip has something to keep
await ev(() => {
  const car = window.__gp.ctx.vehicles.list[0];
  if (!car) return;
  const t = car.body.translation();
  car.body.setTranslation({ x: t.x + 4, y: t.y + 0.05, z: t.z - 3 }, true);
  car.fuel = 7.5;
  window.__gp.ctx.vehicles.resync?.(car);
});
await page.waitForTimeout(1500);
await ev(() => window.__gp.ctx.game.save.save('quick'));
const end = await snap();
await page.reload();
await ready();
await helpers();
const okLoad = await ev(() => window.__gp.ctx.game.save.load('quick'));
await page.waitForTimeout(800);
const back = await snap();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
if (!okLoad) dead.push('save: quick save did not load');
const near = (a, b, tol) => a !== null && b !== null && a.every((v, i) => Math.abs(v - b[i]) <= tol);
if (!near(end.car, back.car, 0.6)) dead.push(`save: car moved/fuel not kept (${JSON.stringify(end.car)} -> ${JSON.stringify(back.car)})`);
if (end.day !== back.day || Math.abs(end.hours - back.hours) > 0.25) dead.push(`save: time of day not kept (day ${end.day} ${end.hours.toFixed(2)} h -> day ${back.day} ${back.hours.toFixed(2)} h)`);
if (end.rain !== back.rain) dead.push(`save: weather not kept (rain target ${end.rain} -> ${back.rain})`);
log(`car ${JSON.stringify(end.car)} -> ${JSON.stringify(back.car)}; time day ${end.day} ${end.hours.toFixed(2)} -> ${back.day} ${back.hours.toFixed(2)}; rain ${end.rain} -> ${back.rain}`);
for (const k of ['inv', 'q', 'notes', 'tracked']) if (!same(end[k], back[k])) dead.push(`save: ${k} changed over save/reload (${JSON.stringify(end[k]).slice(0, 200)} -> ${JSON.stringify(back[k]).slice(0, 200)})`);
const mid = await ev(async () => {
  const ok = await window.__gp.ctx.game.save.load('manual-2');
  const q = window.__quests.quests;
  return { ok, maple: q.state.maple, done: q.done().map((d) => d.id) };
});
log(`mid-quest load: ${JSON.stringify(mid)}`);
if (!mid.ok || mid.maple.status !== 'active' || mid.maple.step !== 2) dead.push(`save: mid-quest save came back as ${JSON.stringify(mid.maple)}`);

if (errs.length) dead.push(`console errors: ${JSON.stringify(errs.slice(0, 5))}`);
await browser.close();
if (findings.length) console.log(`\n${findings.length} FINDINGS (playable, but worth a look):\n- ${findings.join('\n- ')}`);
console.log(dead.length ? `\n${dead.length} DEAD ENDS / FAILURES:\n- ${dead.join('\n- ')}` : '\nALL QUESTS PLAYABLE, SAVE ROUND TRIP OK');
process.exit(dead.length ? 1 : 0);
