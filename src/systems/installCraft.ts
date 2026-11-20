import { AdditiveBlending, BoxGeometry, Box3, ConeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PointLight, Vector3 } from 'three';
import { RECIPES } from '../content/data/crafting';
import { WARMTH } from '../content/data/survival';
import { BINOCULARS, CAMPFIRE, LIGHT, PUMPS, RADIO } from '../content/data/tools';
import { BUILDINGS } from '../content/data/outskirts';
import { Group as PGroup, groups } from '../engine/physics';
import { flashlightControl } from '../engine/flashlight';
import * as fuel from './fuel';
import { insideAny } from './warmth';
import type { ItemInstance, RecipeDef } from '../content/data/types';
import { campText, craftText } from '../content/text/crafting';
import { radioLines, radioStation } from '../content/text/radio';
import { itemText } from '../content/text/items';
import type { Game } from '../core/game';
import { assetUrl } from '../engine/assetUrl';
import { gltfLoader } from '../engine/assets';
import { CraftScreen, recipeName } from '../ui/inventory/craft';
import { check, perform, type Station } from './crafting';
import { newItem, newItems } from './inventory';
import type { Loadout } from './loadout';
import { worldHooks } from './worldHooks';
import { questBus } from './questBus';
import { POIS } from '../content/data/pois';
import { radioAt } from '../content/text/radio';

/**
 * World side of the survival layer: campfires (lay from a kit, light, feed, warm, cook), the crafting panel and its timed
 * job, the radio and binoculars. Rules are pure (crafting.ts, warmth.ts); numbers are data (data/tools.ts).
 * Save slice 'worldtools' (version 1): { camps, radio }.
 */
export interface Camp {
  id: string;
  x: number;
  y: number;
  z: number;
  lit: boolean;
  /** Seconds of burn left. */
  fuel: number;
}
/** Save slice 'worldtools': v1 = camps + radio; v2 adds pump reserves, light charge and car fuel (v1 loads with defaults). */
export const WORLDTOOLS_VERSION = 2;
export interface WorldToolsSave {
  camps: Camp[];
  radio: number;
  pumps?: number[];
  charge?: number;
  carFuel?: number[];
}
export function migrateWorldTools(d: WorldToolsSave, version: number): Required<WorldToolsSave> {
  return {
    camps: d.camps ?? [],
    radio: d.radio ?? 0,
    pumps: version < 2 || !d.pumps ? PUMPS.spots.map(() => PUMPS.reserveLiters) : d.pumps,
    charge: version < 2 || d.charge === undefined ? LIGHT.startSeconds : d.charge,
    carFuel: version < 2 || !d.carFuel ? [] : d.carFuel,
  };
}

const FLAME = new ConeGeometry(0.18, 0.6, 8).translate(0, 0.3, 0);
const flameMat = new MeshBasicMaterial({ color: '#ff9b3a', transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
const logMat = new MeshStandardMaterial({ color: '#4a3220', roughness: 0.9 });
const _p = new Vector3();
const _b = new Box3();

export function installCraft(
  game: Game,
  lo: Loadout,
  deps: { sfx(id: string, at?: Vector3): void; toast(t: string): void; screens: Set<string> },
) {
  const feet = () => {
    try {
      const p = game.player.position;
      return new Vector3(p.x, p.y, p.z);
    } catch {
      return new Vector3(game.camera.position.x, 0, game.camera.position.z);
    }
  };
  const nameOf = (id: string) => itemText[id]?.name ?? id;

  // ---------------- campfires ----------------
  const camps = new Map<string, { rec: Camp; root: Group; flame: Mesh; unreg: () => void }>();
  let campN = 0;
  let model: Object3D | null = null;
  const modelReady = gltfLoader.loadAsync(assetUrl('assets/models/pf/campfire-4390aa.glb')).then(
    (g) => {
      const o = g.scene;
      o.updateMatrixWorld(true);
      _b.setFromObject(o);
      const k = 0.5 / Math.max(_b.max.y - _b.min.y, 1e-3);
      o.scale.multiplyScalar(k);
      o.updateMatrixWorld(true);
      _b.setFromObject(o);
      o.position.set(-(_b.min.x + _b.max.x) / 2, -_b.min.y, -(_b.min.z + _b.max.z) / 2);
      const holder = new Group();
      holder.add(o);
      model = holder;
    },
    () => void 0,
  );
  const light = new PointLight(CAMPFIRE.light.color, 0, CAMPFIRE.light.distance, 1.6);
  light.castShadow = false;
  game.scene.add(light);

  const igniter = () => CAMPFIRE.igniters.find((i) => lo.count(i.item) > 0) ?? null;

  function spawnCamp(rec: Camp) {
    const root = new Group();
    root.name = rec.id;
    root.position.set(rec.x, rec.y, rec.z);
    const flame = new Mesh(FLAME, flameMat);
    flame.position.y = 0.12;
    root.add(flame);
    // Logs placeholder until the model arrives (or if it never does).
    const logs = new Group();
    for (let i = 0; i < 3; i++) {
      const l = new Mesh(new BoxGeometry(0.7, 0.1, 0.1), logMat);
      l.position.y = 0.06;
      l.rotation.y = (i * Math.PI) / 3;
      logs.add(l);
    }
    root.add(logs);
    void modelReady.then(() => {
      if (!model || !camps.has(rec.id)) return;
      logs.removeFromParent();
      root.add(model.clone(true));
    });
    game.scene.add(root);
    const unreg = game.interact.register({
      position: new Vector3(rec.x, rec.y + 0.4, rec.z),
      radius: CAMPFIRE.reach,
      prompt: () => {
        if (!rec.lit) {
          const ig = igniter();
          return ig ? campText.lightWith(nameOf(ig.item)) : campText.noLight;
        }
        return lo.count('wood_planks') > 0 && rec.fuel < CAMPFIRE.maxSeconds - CAMPFIRE.plankSeconds ? campText.addPlank : null;
      },
      holdSeconds: () => CAMPFIRE.lightSeconds,
      onInteract() {
        if (!rec.lit) {
          const ig = igniter();
          if (!ig) return deps.sfx('build_invalid');
          if (ig.consumed) lo.consume(ig.item, 1);
          rec.lit = true;
          rec.fuel = CAMPFIRE.burnSeconds;
          questBus.emit('campfire_lit');
          deps.toast(campText.lit);
          deps.sfx('item_pickup', root.position);
        } else if (lo.count('wood_planks') > 0 && rec.fuel < CAMPFIRE.maxSeconds - CAMPFIRE.plankSeconds) {
          lo.consume('wood_planks', 1);
          rec.fuel += CAMPFIRE.plankSeconds;
          deps.sfx('search_rustle', root.position);
        } else deps.toast(campText.full);
      },
    });
    camps.set(rec.id, { rec, root, flame, unreg });
  }
  function removeCamp(id: string) {
    const c = camps.get(id);
    if (!c) return;
    c.root.removeFromParent();
    c.unreg();
    camps.delete(id);
  }
  function placeCamp() {
    if (camps.size >= CAMPFIRE.max) return false;
    const p = feet();
    try {
      const fw = game.player.forward;
      const len = Math.hypot(fw.x, fw.z) || 1;
      p.x += (fw.x / len) * CAMPFIRE.placeAhead;
      p.z += (fw.z / len) * CAMPFIRE.placeAhead;
    } catch {
      /* no player: lay it at the feet */
    }
    spawnCamp({ id: `camp_${Date.now().toString(36)}_${campN++}`, x: p.x, y: p.y, z: p.z, lit: false, fuel: 0 });
    return true;
  }
  /** Nearest lit fire within `r` metres (null if none). */
  const litNear = (pos: { x: number; y: number; z: number }, r: number) => {
    let best: Camp | null = null;
    let bd = r;
    for (const { rec } of camps.values()) {
      if (!rec.lit) continue;
      const d = Math.hypot(rec.x - pos.x, rec.z - pos.z);
      if (d <= bd) (bd = d), (best = rec);
    }
    return best;
  };
  worldHooks.fireNear = () => !!litNear(feet(), WARMTH.fireRadius);
  worldHooks.stations = () => {
    const s = new Set<Station>();
    if (litNear(feet(), CAMPFIRE.stationRadius)) s.add('campfire');
    return s;
  };

  // ---------------- fuel: carried cans, pumps ----------------
  worldHooks.takeFuel = (max) => fuel.draw(lo, max);
  worldHooks.fuelCarried = () => fuel.carried(lo);
  const pumps = PUMPS.spots.map(() => PUMPS.reserveLiters);
  PUMPS.spots.forEach((spot, i) => {
    game.interact.register({
      position: new Vector3(spot.x, 1.0, spot.z),
      radius: PUMPS.reach,
      prompt: () => (pumps[i] <= 0 ? campText.pumpDry : fuel.cans(lo).length === 0 ? campText.pumpNeedsCan : fuel.space(lo) < 0.5 ? null : campText.pumpFill(Math.round(Math.min(pumps[i], fuel.space(lo))), Math.round(pumps[i]))),
      holdSeconds: () => (pumps[i] > 0 && fuel.space(lo) >= 0.5 ? PUMPS.fillSeconds : 0),
      onInteract() {
        const put = fuel.fill(lo, Math.min(pumps[i], fuel.space(lo)));
        if (put <= 0) return deps.sfx('build_invalid');
        pumps[i] -= put;
        questBus.emit('pump');
        deps.sfx('search_rustle');
        deps.toast(campText.pumped(Math.round(put)));
      },
    });
  });

  // ---------------- light: items, battery ----------------
  let charge = LIGHT.startSeconds;
  const lightItems = () => {
    const have = new Set<string>();
    for (const it of Object.values(lo.equipment)) if (it && LIGHT.items.includes(it.defId)) have.add(it.defId);
    for (const id of lo.hotbar) if (id && LIGHT.items.includes(id) && lo.count(id) > 0) have.add(id);
    return have.size > 0;
  };
  flashlightControl.available = () => lightItems() && (charge > 0 || lo.count(LIGHT.batteryItem) > 0);
  const rawSet = flashlightControl.set.bind(flashlightControl);
  flashlightControl.set = (v: boolean) => {
    rawSet(v);
    if (flashlightControl.on) questBus.emit('light_on'); // the L key and the hotbar both count for quests
  };
  flashlightControl.denied = () => deps.toast(!lightItems() ? campText.noLight2 : campText.noBattery);
  let warned = false;

  // ---------------- shelter (indoors or under a roof) ----------------
  let sheltered = false;
  let shelterT = 0;
  let ray: InstanceType<typeof game.phys.R.Ray> | null = null;
  const roofFilter = groups(PGroup.PLAYER, PGroup.STATIC | PGroup.BUILD);
  function checkShelter() {
    const p = feet();
    let under = insideAny(p.x, p.z, BUILDINGS, 0.1);
    if (!under) {
      try {
        ray ??= new game.phys.R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
        ray.origin = { x: p.x, y: p.y + 2.1, z: p.z };
        ray.dir = { x: 0, y: 1, z: 0 };
        under = !!game.phys.world.castRay(ray, WARMTH.roofCheckM, true, undefined, roofFilter);
      } catch {
        /* physics not ready */
      }
    }
    sheltered = under;
  }
  worldHooks.sheltered = () => sheltered;

  // ---------------- crafting job ----------------
  const bar = document.createElement('div');
  bar.className = 'cr-bar';
  bar.hidden = true;
  bar.innerHTML = '<span></span><i><b></b></i>';
  game.ui.appendChild(bar);
  const barText = bar.firstElementChild as HTMLElement;
  const barFill = bar.querySelector('b') as HTMLElement;
  let job: { r: RecipeDef; target: ItemInstance | null; t: number } | null = null;

  const screen = new CraftScreen(lo, {
    sfx: deps.sfx,
    onOpenChange: (open) => game.events.emit('uiScreen', { name: 'crafting', open }),
    stations: () => worldHooks.stations(),
    begin: (r, target) => {
      if (job) return;
      lo.cancelUse();
      job = { r, target, t: 0 };
      deps.sfx('search_rustle');
    },
  }, game.ui);
  game.events.on('inventoryChanged', () => screen.refresh());
  const cancelJob = () => {
    if (!job) return;
    job = null;
    deps.toast(craftText.interrupted);
  };
  game.events.on('playerDamaged', cancelJob);
  game.events.on('playerDied', () => {
    job = null;
    screen.close();
  });
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyG' || e.repeat) return;
    if (screen.isOpen) return screen.close();
    if (game.input.blocked || deps.screens.size > 0 || job) return;
    screen.open();
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && screen.isOpen) screen.close();
  });

  // ---------------- radio ----------------
  let radioIdx = 0;
  const card = document.createElement('div');
  card.className = 'radio-card';
  game.ui.appendChild(card);
  let cardT = 0;
  function playRadio() {
    // At a place the radio picks up that place's broadcast first, then the general list
    const at = feet();
    const poi = POIS.find((p) => Math.hypot(p.x - at.x, p.z - at.z) <= p.radius);
    const local = poi && radioAt[poi.id];
    const line = local ? local[0] : radioLines[radioIdx % radioLines.length];
    if (!local) radioIdx++;
    questBus.emit('radio', { poi: poi?.id });
    card.innerHTML = '';
    const head = document.createElement('small');
    head.textContent = radioStation;
    const body = document.createElement('div');
    body.textContent = line;
    card.append(head, body);
    card.classList.add('on');
    cardT = RADIO.cardSeconds;
  }

  game.events.on('itemUsed', (e) => {
    const action = (e.use as { action?: string } | undefined)?.action;
    if (action === 'radio') playRadio();
    else if (action === 'light') flashlightControl.toggle();
    else if (action === 'campfire') {
      if (placeCamp()) deps.toast(campText.placed);
      else {
        deps.toast(campText.tooFar);
        lo.give(newItem('campfire_kit'));
      }
    }
  });

  // ---------------- binoculars (hold Z while carrying them) ----------------
  let zoom = 1;
  let baseFov = 0;
  let lastFov = -1;
  let late = false;

  // ---------------- tick ----------------
  game.addSystem({
    name: 'craft',
    step(dt) {
      for (const [id, c] of [...camps]) {
        if (!c.rec.lit) continue;
        if ((c.rec.fuel -= dt) <= 0) {
          c.rec.lit = false;
          c.rec.fuel = 0;
          deps.toast(campText.died);
          void id;
        }
      }
      if (job) {
        const miss = check(lo, job.r, worldHooks.stations(), job.target);
        if (miss.length) {
          job = null;
          deps.toast(craftText.noStation);
        } else if ((job.t += dt) >= job.r.seconds) {
          const { r, target } = job;
          job = null;
          const made = perform(lo, r, worldHooks.stations(), target);
          if (made) {
            deps.sfx('item_pickup');
            questBus.emit('craft', { recipe: r.id });
            deps.toast(r.repair && target ? craftText.repaired(nameOf(target.defId)) : craftText.made(made.length ? nameOf(made[0].defId) : recipeName(r)));
          }
        }
      }
      bar.hidden = !job;
      if (job) {
        barText.textContent = `${craftText.crafting}: ${recipeName(job.r)}`;
        barFill.style.width = `${Math.min(100, (job.t / job.r.seconds) * 100)}%`;
      }
      if (cardT > 0 && (cardT -= dt) <= 0) card.classList.remove('on');
      if ((shelterT -= dt) <= 0) {
        shelterT = 0.25;
        checkShelter();
      }
      if (flashlightControl.on) {
        if (!lightItems()) flashlightControl.on = false;
        else {
          if (charge <= 0) {
            if (lo.consume(LIGHT.batteryItem, 1) > 0) {
              charge = LIGHT.batterySeconds;
              warned = false;
              deps.toast(campText.newBattery);
            } else {
              flashlightControl.on = false;
              deps.toast(campText.lightDead);
            }
          }
          charge = Math.max(0, charge - dt);
          if (!warned && charge < LIGHT.warnSeconds && lo.count(LIGHT.batteryItem) === 0) {
            warned = true;
            deps.toast(campText.lightLow);
          }
        }
      }
      if (!late) {
        late = true;
        // Registered from inside a tick so it runs after the camera rig (which sets the FOV each frame).
        game.addSystem({
          name: 'binoculars',
          render(_a, rdt) {
            const cam = game.camera;
            const want = game.input.down(BINOCULARS.key) && lo.count(BINOCULARS.item) > 0 && !screen.isOpen ? 1 / BINOCULARS.zoom : 1;
            zoom += (want - zoom) * Math.min(1, rdt * 12);
            if (Math.abs(zoom - 1) < 0.002 && want === 1) {
              zoom = 1;
              lastFov = -1;
              return;
            }
            if (Math.abs(cam.fov - lastFov) > 1e-3) baseFov = cam.fov; // the rig wrote a new base
            cam.fov = baseFov * zoom;
            lastFov = cam.fov;
            cam.updateProjectionMatrix();
          },
        });
      }
    },
    render(_a, dt) {
      // Flames flicker; one pooled light follows the nearest lit fire.
      const t = performance.now() / 1000;
      let nearest: Camp | null = null;
      let bd = 60;
      const cp = game.camera.position;
      for (const { rec, flame } of camps.values()) {
        flame.visible = rec.lit;
        if (!rec.lit) continue;
        const s = 0.85 + 0.25 * Math.sin(t * 13 + rec.x) * Math.sin(t * 7.3 + rec.z);
        flame.scale.set(s, 0.8 + 0.4 * s, s);
        const d = Math.hypot(rec.x - cp.x, rec.z - cp.z);
        if (d < bd) (bd = d), (nearest = rec);
      }
      if (nearest) {
        _p.set(nearest.x, nearest.y + 0.7, nearest.z);
        light.position.copy(_p);
        light.intensity = CAMPFIRE.light.intensity * (0.9 + 0.2 * Math.sin(t * 17) * Math.sin(t * 5.1));
      } else light.intensity = 0;
      void dt;
    },
  });

  // ---------------- saves and debug ----------------
  const api = {
    screen,
    litNear,
    serialize: (): WorldToolsSave => ({ camps: [...camps.values()].map((c) => ({ ...c.rec })), radio: radioIdx, pumps: [...pumps], charge, carFuel: worldHooks.carFuel.get() }),
    load(save: WorldToolsSave, version = WORLDTOOLS_VERSION) {
      const d = migrateWorldTools(save, version);
      for (const id of [...camps.keys()]) removeCamp(id);
      for (const c of d.camps) spawnCamp({ ...c });
      radioIdx = d.radio;
      d.pumps.forEach((l, i) => i < pumps.length && (pumps[i] = l));
      charge = d.charge;
      if (d.carFuel.length) worldHooks.carFuel.set(d.carFuel);
      flashlightControl.on = false;
      job = null;
    },
    placeCamp,
    camps: () => [...camps.values()].map((c) => c.rec),
    pumps,
    charge: () => charge,
    recipes: RECIPES.length,
  };
  try {
    const dbg = game.debug;
    dbg.action('Items', 'Give camp and craft kit', () => {
      for (const [id, n] of [['campfire_kit', 1], ['cooking_pot', 1], ['lighter', 1], ['cloth_rag', 12], ['wood_planks', 8], ['dirty_water', 2], ['canned_soup', 2], ['multitool', 1], ['antiseptic', 2], ['purification_tablets', 3]] as const)
        for (const it of newItems(id, n)) lo.give(it);
    });
  } catch {
    /* debug menu not installed */
  }
  return api;
}
