import type RAPIER from '@dimforge/rapier3d-compat';
import { BoxGeometry, Group as ThreeGroup, Mesh, MeshBasicMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { BUILD, BUILD_PIECES } from '../../content/data/build';
import type { BuildPieceDef } from '../../content/data/types';
import { yard } from '../../content/data/yard';
import type { BuildApi } from '../../core/contracts';
import type { Game } from '../../core/game';
import { hasAsset, loadAsset } from '../../engine/assets';
import { paintGeometry, paletteMaterial } from '../../engine/palette';
import { Group, groups } from '../../engine/physics';
import { canRemove, pieceDef, refundOf, slotOf, snapToHit, type Area, type Piece } from '../../systems/build';
import { newItems } from '../../systems/inventory';
import type { Loadout } from '../../systems/loadout';
import { itemName, itemShort } from '../inventory/screen';
import './build.css';

/**
 * Build mode (B): ghost preview, snapping (rules in systems/build.ts), place/remove, doors.
 * Pieces are plain data (`pieces`); this file owns their meshes, Rapier colliders and door interactables.
 */
const T = {
  title: 'Build mode',
  hint: '<kbd>LMB</kbd> place <kbd>R</kbd> rotate <kbd>X</kbd> remove <kbd>Wheel</kbd>/<kbd>1–8</kbd> piece <kbd>B</kbd> exit',
  free: 'Free building',
  area: 'Build here only (build pad)',
  occupied: 'Something is already there',
  support: 'Needs support',
  need: 'Need',
  holds: 'Remove what rests on it first',
  refund: 'Salvaged',
  open: 'Open door',
  close: 'Close door',
  names: {
    wood_foundation: 'Foundation', wood_wall: 'Wall', wood_doorway: 'Doorway', wood_door: 'Door', wood_window: 'Window',
    wood_floor: 'Floor', wood_stairs: 'Stairs', wood_roof: 'Roof',
  } as Record<string, string>,
};

/** Box parts (local, origin at base centre, walls run along X) for procedural placeholders until the Blender kit lands. */
type Part = { size: [number, number, number]; at: [number, number, number]; swatch: string };
function partsFor(d: BuildPieceDef): Part[] {
  const [w, h, dd] = d.size;
  const t = dd;
  switch (d.kind) {
    case 'doorway': {
      const ow = 1.1, oh = 2.2, side = (w - ow) / 2;
      return [
        { size: [side, h, t], at: [-(ow + side) / 2, h / 2, 0], swatch: 'wood_raw' },
        { size: [side, h, t], at: [(ow + side) / 2, h / 2, 0], swatch: 'wood_raw' },
        { size: [ow, h - oh, t], at: [0, (h + oh) / 2, 0], swatch: 'wood_raw' },
      ];
    }
    case 'window': {
      const ow = 1.2, y0 = 1.0, y1 = 2.0, side = (w - ow) / 2;
      return [
        { size: [side, h, t], at: [-(ow + side) / 2, h / 2, 0], swatch: 'wood_raw' },
        { size: [side, h, t], at: [(ow + side) / 2, h / 2, 0], swatch: 'wood_raw' },
        { size: [ow, y0, t], at: [0, y0 / 2, 0], swatch: 'wood_raw' },
        { size: [ow, h - y1, t], at: [0, (h + y1) / 2, 0], swatch: 'wood_raw' },
      ];
    }
    case 'stairs': {
      const n = 6;
      const steps: Part[] = [];
      for (let i = 0; i < n; i++) {
        const sh = (h / n) * (i + 1);
        steps.push({ size: [w * 0.6, sh, dd / n], at: [0, sh / 2, dd / 2 - (dd / n) * (i + 0.5)], swatch: 'wood_dark' });
      }
      return steps; // rises toward -Z (north) at rot 0
    }
    case 'roof': // flat placeholder slab with a small overhang (per-cell slopes leave gaps); the kit model replaces it
      return [{ size: [w + 0.3, 0.25, dd + 0.3], at: [0, 0.125, 0], swatch: 'roof_shingle' }];
    case 'foundation':
      return [{ size: [w, h, dd], at: [0, h / 2, 0], swatch: 'wood_dark' }];
    default:
      return [{ size: [w, h, dd], at: [0, h / 2, 0], swatch: d.kind === 'floor' ? 'plywood' : 'wood_raw' }];
  }
}

interface Live {
  root: Object3D;
  body: RAPIER.RigidBody | null;
  unreg?: () => void;
}

const DOOR_HALF = (d: BuildPieceDef) => d.size[0] / 2;

export function installBuildMode(game: Game, lo: Loadout, sfx: (id: string, at?: Vector3) => void) {
  const { R, world } = game.phys;
  const b = yard.stations.build;
  const area: Area = { x0: b.x - b.w / 2, z0: b.z - b.d / 2, x1: b.x + b.w / 2, z1: b.z + b.d / 2 };
  const pieces: Piece[] = [];
  const live = new Map<number, Live>();
  const byCollider = new Map<number, Piece>();
  let uid = 1;
  let active = false;
  let sel = 0;
  let turns = 0;
  let clickQueued = false;
  let wheel = 0;
  let message = '';
  let messageUntil = 0;

  // ---------- meshes ----------
  async function partsObject(d: BuildPieceDef): Promise<{ obj: Object3D; boxes: Part[] }> {
    if (hasAsset(d.model)) {
      const proto = await loadAsset(d.model, d.size);
      const boxes: Part[] = proto.colliders.map((bx) => {
        const s = bx.getSize(new Vector3());
        const c = bx.getCenter(new Vector3());
        return { size: [s.x, s.y, s.z], at: [c.x, c.y, c.z], swatch: '' };
      });
      return { obj: proto.lod.clone(), boxes };
    }
    const mat = await paletteMaterial();
    const parts = partsFor(d);
    const g = new ThreeGroup();
    for (const p of parts) {
      const m = new Mesh(paintGeometry(new BoxGeometry(...p.size), p.swatch), mat);
      m.position.set(...p.at);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    return { obj: g, boxes: parts };
  }

  const ghostMat = new MeshBasicMaterial({ color: '#5ec478', transparent: true, opacity: 0.42, depthWrite: false });
  const ghosts = new Map<string, Object3D>();
  let ghost: Object3D | null = null;
  function ghostFor(d: BuildPieceDef): Object3D {
    let g = ghosts.get(d.id);
    if (!g) {
      const holder = new ThreeGroup();
      holder.name = `ghost_${d.id}`;
      g = holder;
      ghosts.set(d.id, g);
      void partsObject(d).then(({ obj }) => {
        obj.traverse((o) => {
          const m = o as Mesh;
          if (m.isMesh) {
            m.material = ghostMat;
            m.castShadow = false;
            m.receiveShadow = false;
          }
        });
        holder.add(obj);
      });
    }
    return g;
  }

  // ---------- placement ----------
  const yawQ = (yaw: number) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);

  function spawn(p: Piece) {
    const d = pieceDef(p.defId);
    const root = new ThreeGroup();
    root.name = `build_${p.defId}_${p.uid}`;
    const l: Live = { root, body: null };
    live.set(p.uid, l);
    const isDoor = d.kind === 'door';
    const hingeOffset = isDoor ? DOOR_HALF(d) : 0;
    // Doors: the root is the hinge; the leaf sits +half width along local X.
    const hinge = new Vector3(-hingeOffset, 0, 0).applyQuaternion(yawQ(p.rot));
    root.position.set(p.x + hinge.x, p.y, p.z + hinge.z);
    root.rotation.y = p.rot + (p.open ? (BUILD.doorSwingDeg * Math.PI) / 180 : 0);
    game.scene.add(root);
    void partsObject(d).then(({ obj, boxes }) => {
      if (!live.has(p.uid)) return; // removed while loading
      obj.position.x = hingeOffset;
      root.add(obj);
      const q = root.quaternion;
      const body = world.createRigidBody(
        R.RigidBodyDesc.fixed().setTranslation(root.position.x, root.position.y, root.position.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      );
      for (const bx of boxes) {
        const c = world.createCollider(
          R.ColliderDesc.cuboid(bx.size[0] / 2, bx.size[1] / 2, bx.size[2] / 2)
            .setTranslation(bx.at[0] + hingeOffset, bx.at[1], bx.at[2])
            .setCollisionGroups(groups(Group.BUILD, 0xffff)),
          body,
        );
        byCollider.set(c.handle, p);
      }
      l.body = body;
    });
    if (isDoor) {
      const at = new Vector3(p.x, p.y + 1.1, p.z);
      l.unreg = game.interact.register({
        position: at,
        radius: 2.2,
        prompt: () => (p.open ? T.close : T.open),
        holdSeconds: () => 0,
        onInteract: () => {
          p.open = !p.open;
          const yaw = p.rot + (p.open ? (BUILD.doorSwingDeg * Math.PI) / 180 : 0);
          root.rotation.y = yaw;
          const q = yawQ(yaw);
          l.body?.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
          sfx('crate_open', at);
        },
      });
    }
  }

  function despawn(p: Piece) {
    const l = live.get(p.uid);
    if (!l) return;
    live.delete(p.uid);
    l.root.removeFromParent();
    l.unreg?.();
    if (l.body) {
      for (let i = 0; i < l.body.numColliders(); i++) byCollider.delete(l.body.collider(i).handle);
      world.removeRigidBody(l.body);
    }
  }

  function addPiece(defId: string, x: number, y: number, z: number, rot: number, paid: boolean) {
    const p: Piece = { uid: uid++, defId, x, y, z, rot, paid };
    pieces.push(p);
    spawn(p);
    return p;
  }

  function removePiece(p: Piece) {
    const k = pieces.indexOf(p);
    if (k >= 0) pieces.splice(k, 1);
    despawn(p);
  }

  // ---------- look-at ----------
  const _dir = new Vector3();
  function look(): { point: Vector3; piece: Piece | null } {
    const o = game.camera.position;
    game.camera.getWorldDirection(_dir);
    const ray = new R.Ray({ x: o.x, y: o.y, z: o.z }, { x: _dir.x, y: _dir.y, z: _dir.z });
    const hit = world.castRay(ray, BUILD.reach, true, undefined, groups(0xffff, Group.TERRAIN | Group.STATIC | Group.BUILD));
    if (hit) {
      const t = hit.timeOfImpact;
      return { point: new Vector3(o.x + _dir.x * t, o.y + _dir.y * t, o.z + _dir.z * t), piece: byCollider.get(hit.collider.handle) ?? null };
    }
    // Nothing within reach (looking level or up): aim at a point placeDistance ahead, on the ground plane if closer.
    let t = BUILD.placeDistance;
    if (_dir.y < -1e-3) t = Math.min(t, -o.y / _dir.y);
    return { point: new Vector3(o.x + _dir.x * t, Math.max(0, o.y + _dir.y * t), o.z + _dir.z * t), piece: null };
  }

  function say(text: string, sound?: string) {
    message = text;
    messageUntil = performance.now() + 1800;
    if (sound) sfx(sound);
    game.events.emit('toast', { text });
  }

  const affordable = (d: BuildPieceDef) => BUILD.freeBuilding || d.cost.every((c) => lo.count(c.item) >= c.count);

  function tryPlace() {
    const d = BUILD_PIECES[sel];
    const at = look();
    const s = snapToHit(d.id, at.point, turns, pieces, area);
    if (!s.valid) return say(s.reason === 'area' ? T.area : s.reason === 'occupied' ? T.occupied : T.support, 'build_invalid');
    if (!affordable(d)) return say(`${T.need} ${d.cost.map((c) => `${c.count} ${itemName(c.item)}`).join(', ')}`, 'build_invalid');
    if (!BUILD.freeBuilding) for (const c of d.cost) lo.consume(c.item, c.count);
    addPiece(d.id, s.x, s.y, s.z, s.rot, !BUILD.freeBuilding);
    sfx('build_place', new Vector3(s.x, s.y, s.z));
  }

  function tryRemove() {
    const at = look();
    const p = at?.piece;
    if (!p) return;
    if (!canRemove(p, pieces)) return say(T.holds, 'build_invalid');
    removePiece(p);
    const refund = refundOf(p);
    for (const r of refund) for (const it of newItems(r.item, r.count)) lo.give(it);
    if (refund.length) say(`${T.refund}: ${refund.map((r) => `${r.count} ${itemName(r.item)}`).join(', ')}`);
    sfx('build_remove', new Vector3(p.x, p.y, p.z));
  }

  // ---------- UI bar ----------
  const bar = document.createElement('div');
  bar.className = 'build-bar';
  bar.hidden = true;
  game.ui.appendChild(bar);
  let barKey = '';
  function drawBar() {
    const msg = performance.now() < messageUntil ? message : '';
    const key = `${sel}|${msg}|${BUILD.freeBuilding}|${BUILD_PIECES.map((d) => +affordable(d)).join('')}`;
    if (key === barKey) return;
    barKey = key;
    const cards = BUILD_PIECES.map((d, i) => {
      const cost = BUILD.freeBuilding ? T.free : d.cost.map((c) => `${c.count} ${itemShort(c.item)}`).join(' · ');
      return `<div class="bp${i === sel ? ' sel' : ''}${affordable(d) ? '' : ' poor'}"><span class="k">${i + 1}</span><b>${T.names[d.id] ?? d.id}</b><small>${cost}</small></div>`;
    }).join('');
    bar.innerHTML = `<div class="bt">${T.title}${BUILD.freeBuilding ? ` <em>${T.free}</em>` : ''}</div><div class="bps">${cards}</div><div class="bh">${msg ? `<span class="msg">${msg}</span>` : T.hint}</div>`;
  }

  // ---------- input ----------
  addEventListener('mousedown', (e) => {
    // Same rule as gameplay's fire button: canvas clicks or pointer-locked clicks (not clicks on DOM UI).
    if (active && e.button === 0 && !game.input.blocked && (e.target === game.renderer.domElement || document.pointerLockElement)) clickQueued = true;
  });
  addEventListener('wheel', (e) => {
    if (active && !game.input.blocked) wheel += Math.sign(e.deltaY);
  }, { passive: true });

  /** BuildApi plus sandbox/test hooks (debug menu, Playwright). */
  const api: BuildApi & { pieces: Piece[]; clear(): void; select(i: number): void; rotate(): void; placeLooked(): void; removeLooked(): void } = {
    get active() {
      return active;
    },
    pieces,
    toggle() {
      active = !active;
      bar.hidden = !active;
      turns = 0;
      if (ghost) ghost.visible = false;
      barKey = '';
      sfx(active ? 'ui_open' : 'ui_close');
    },
    place(pieceDefId: string, position: Vector3, rotY: number) {
      const s = slotOf(pieceDefId, position.x, position.y, position.z, rotY);
      addPiece(pieceDefId, s.x, s.y, s.z, s.rot, true); // world-placed pieces salvage like paid ones
    },
    clear() {
      for (const p of [...pieces]) removePiece(p);
    },
    rotate: () => void (turns = (turns + 1) % 4),
    placeLooked: () => tryPlace(),
    removeLooked: () => tryRemove(),
    select(i: number) {
      sel = ((i % BUILD_PIECES.length) + BUILD_PIECES.length) % BUILD_PIECES.length;
    },
  };

  game.addSystem({
    name: 'build',
    step() {
      const inp = game.input;
      if (inp.justPressed('KeyB')) {
        let inVehicle = false;
        try {
          inVehicle = game.player.inVehicle;
        } catch {
          /* no player yet */
        }
        if (!inVehicle || active) api.toggle();
      }
      if (!active) {
        clickQueued = false;
        wheel = 0;
        return;
      }
      for (let i = 0; i < BUILD_PIECES.length; i++) if (inp.justPressed(`Digit${i + 1}`)) (api.select(i), (turns = 0));
      if (wheel) (api.select(sel + wheel), (wheel = 0), (turns = 0));
      if (inp.justPressed('KeyR')) api.rotate();
      if (inp.justPressed('KeyX')) tryRemove();
      if (clickQueued) (tryPlace(), (clickQueued = false));

      // Ghost.
      const d = BUILD_PIECES[sel];
      const g = ghostFor(d);
      if (ghost !== g) {
        ghost?.removeFromParent();
        ghost = g;
        game.scene.add(g);
      }
      const at = inp.blocked ? null : look();
      g.visible = !!at;
      if (at) {
        const s = snapToHit(d.id, at.point, turns, pieces, area);
        const ok = s.valid && affordable(d);
        ghostMat.color.set(ok ? '#5ec478' : '#d64a40');
        ghostMat.opacity = s.reason === 'occupied' ? 0.16 : 0.42; // don't shout over a piece you just placed
        const hinge = d.kind === 'door' ? new Vector3(-DOOR_HALF(d), 0, 0).applyQuaternion(yawQ(s.rot)) : new Vector3();
        g.position.set(s.x + hinge.x, s.y, s.z + hinge.z);
        g.rotation.y = s.rot;
        // Door ghost: leaf offset matches spawn().
        const child = g.children[0];
        if (child) child.position.x = d.kind === 'door' ? DOOR_HALF(d) : 0;
      }
      drawBar();
    },
  });

  return api;
}
