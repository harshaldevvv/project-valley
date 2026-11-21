import { QUEST, QUESTS, type Objective, type QuestDef } from '../content/data/quests';

/**
 * Quest rules, pure: the world is reached through `QuestEnv` (where the player is, what is carried, what time it is),
 * so it runs in tests and its state is plain JSON. Objectives of a quest are done in order; the first unfinished one is
 * "current". Counted and polled objectives (go to, collect, fuel, survive) are checked every tick; the rest wait for a
 * `report()` of the matching thing happening (a kill, an item used, a recipe finished, a note read, a named signal).
 */
export interface Place {
  x: number;
  z: number;
  radius: number;
}
export interface QuestEnv {
  pos(): { x: number; z: number };
  /** Carried and worn count of an item. */
  count(item: string): number;
  /** Litres of fuel in carried jerrycans. */
  fuel(): number;
  /** In-game hours since day 1, 00:00 (fractional). */
  hours(): number;
  place(id: string): Place | undefined;
  give(item: string, count: number): void;
}

export type QuestEvent =
  | { type: 'started'; quest: string }
  | { type: 'step'; quest: string; index: number }
  | { type: 'progress'; quest: string; index: number; n: number; of: number }
  | { type: 'done'; quest: string }
  | { type: 'note'; id: string };

export type Report =
  | { type: 'kill'; x: number; z: number }
  | { type: 'use'; item: string }
  | { type: 'craft'; recipe: string }
  | { type: 'note'; id: string }
  | { type: 'give'; npc: string; item: string }
  | { type: 'event'; name: string; poi?: string };

export interface QState {
  status: 'locked' | 'active' | 'done';
  /** Index of the current objective. */
  step: number;
  /** Counter for the current objective (kills, uses), or the start time in hours for a survive objective. */
  n: number;
}
export interface QuestSave {
  state: Record<string, QState>;
  tracked: string | null;
  /** Notes read, in order. */
  notes: string[];
  /** Quest items the player has held at least once (so a lost note is not placed twice). */
  seen: string[];
}
export const QUEST_SAVE_VERSION = 1;

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export class Quests {
  state: Record<string, QState> = {};
  tracked: string | null = null;
  notes: string[] = [];
  seen = new Set<string>();
  private listeners: ((e: QuestEvent) => void)[] = [];

  constructor(private env: QuestEnv, private defs: QuestDef[] = QUESTS) {
    for (const q of defs) this.state[q.id] = { status: 'locked', step: 0, n: 0 };
    this.unlock();
  }

  on(f: (e: QuestEvent) => void) {
    this.listeners.push(f);
  }
  private emit(e: QuestEvent) {
    for (const f of this.listeners) f(e);
  }

  def(id: string) {
    return this.defs.find((q) => q.id === id)!;
  }
  active() {
    return this.defs.filter((q) => this.state[q.id].status === 'active');
  }
  done() {
    return this.defs.filter((q) => this.state[q.id].status === 'done');
  }
  current(id: string): Objective | null {
    const s = this.state[id];
    return s?.status === 'active' ? this.def(id).objectives[s.step] : null;
  }

  /** Start every quest whose requirements are done; keeps the tracker on something active. */
  private unlock() {
    for (const q of this.defs) {
      const s = this.state[q.id];
      if (s.status !== 'locked' || !q.requires.every((r) => this.state[r]?.status === 'done')) continue;
      s.status = 'active';
      s.step = 0;
      s.n = 0;
      this.initObjective(q);
      this.emit({ type: 'started', quest: q.id });
      this.check(q);
    }
    if (!this.tracked || this.state[this.tracked]?.status !== 'active') this.tracked = (this.active().find((q) => !q.side) ?? this.active()[0])?.id ?? null;
  }

  private initObjective(q: QuestDef) {
    const o = q.objectives[this.state[q.id].step];
    this.state[q.id].n = o?.type === 'survive' ? this.env.hours() : 0;
  }

  /** The place the current objective points at, if any (HUD arrow and distance). */
  target(id: string): (Place & { poi: string }) | null {
    const o = this.current(id);
    if (!o?.poi) return null;
    const p = this.env.place(o.poi);
    return p ? { ...p, poi: o.poi } : null;
  }

  /** Progress of the current objective as [n, of] when it counts something. */
  counter(id: string): [number, number] | null {
    const o = this.current(id);
    const s = this.state[id];
    if (!o) return null;
    if (o.type === 'kill') return [Math.min(s.n, o.count), o.count];
    if (o.type === 'use' && (o.count ?? 1) > 1) return [Math.min(s.n, o.count!), o.count!];
    if (o.type === 'collect') return [Math.min(this.env.count(o.item), o.count), o.count];
    if (o.type === 'fuel') return [Math.min(Math.round(this.env.fuel()), o.liters), o.liters];
    if (o.type === 'survive') return [Math.min(Math.round(((this.env.hours() - s.n) / o.hours) * 100), 100), 100];
    return null;
  }

  private advance(q: QuestDef) {
    const s = this.state[q.id];
    this.emit({ type: 'step', quest: q.id, index: s.step });
    s.step++;
    s.n = 0;
    if (s.step >= q.objectives.length) {
      s.status = 'done';
      for (const r of q.rewards) this.env.give(r.item, r.count);
      this.emit({ type: 'done', quest: q.id });
      this.unlock();
      return;
    }
    this.initObjective(q);
    this.check(q);
  }

  /** Re-evaluate the polled objective of one quest (go to, collect, fuel, survive, a note already read). */
  private check(q: QuestDef) {
    const s = this.state[q.id];
    if (s.status !== 'active') return;
    const o = q.objectives[s.step];
    if (!o) return;
    let ok = false;
    if (o.type === 'goto') {
      const p = this.env.place(o.poi);
      ok = !!p && dist(this.env.pos(), p) <= (o.radius ?? p.radius * QUEST.gotoFraction);
    } else if (o.type === 'collect') ok = this.env.count(o.item) >= o.count;
    else if (o.type === 'fuel') ok = this.env.fuel() >= o.liters;
    else if (o.type === 'survive') ok = this.env.hours() - s.n >= o.hours;
    // a note read before this objective came up still counts (it may have been dropped since: notes are placed once)
    else if (o.type === 'read') ok = this.notes.includes(o.note);
    if (ok) this.advance(q);
  }

  /** Call every tick (cheap). */
  tick() {
    for (const q of this.active()) this.check(q);
  }

  /** Something happened: advance any active quest whose current objective is exactly that. */
  report(r: Report) {
    if (r.type === 'note' && !this.notes.includes(r.id)) {
      this.notes.push(r.id);
      this.emit({ type: 'note', id: r.id });
    }
    for (const q of this.active()) {
      const s = this.state[q.id];
      const o = q.objectives[s.step];
      if (!o) continue;
      let hit = false;
      if (r.type === 'kill' && o.type === 'kill') {
        const area = o.poi ? this.env.place(o.poi) : null;
        if (!area || dist(r, area) <= area.radius * QUEST.killAreaFraction) {
          s.n++;
          this.emit({ type: 'progress', quest: q.id, index: s.step, n: Math.min(s.n, o.count), of: o.count });
          hit = s.n >= o.count;
        }
      } else if (r.type === 'use' && o.type === 'use' && o.item === r.item) {
        const area = o.poi ? this.env.place(o.poi) : null;
        if (!area || dist(this.env.pos(), area) <= area.radius) {
          s.n++;
          hit = s.n >= (o.count ?? 1);
          if (!hit) this.emit({ type: 'progress', quest: q.id, index: s.step, n: s.n, of: o.count ?? 1 });
        }
      } else if (r.type === 'give' && o.type === 'give') hit = o.npc === r.npc && o.item === r.item;
      else if (r.type === 'craft' && o.type === 'craft') hit = o.recipe === r.recipe;
      else if (r.type === 'note' && o.type === 'read') hit = o.note === r.id;
      else if (r.type === 'event' && o.type === 'event' && o.name === r.name) {
        const area = o.poi ? this.env.place(o.poi) : null;
        hit = !area || (r.poi ? r.poi === o.poi : dist(this.env.pos(), area) <= area.radius);
      }
      if (hit) this.advance(q);
    }
  }

  /** Debug and tests: finish the current objective as if it were done. */
  skip(id: string) {
    if (this.state[id]?.status === 'active') this.advance(this.def(id));
  }

  track(id: string) {
    if (this.state[id]?.status === 'active') this.tracked = id;
  }

  /** Remember the quest items that have been in the pack, so a note is never placed twice. */
  markSeen(item: string) {
    this.seen.add(item);
  }

  serialize(): QuestSave {
    return JSON.parse(JSON.stringify({ state: this.state, tracked: this.tracked, notes: this.notes, seen: [...this.seen] }));
  }

  /** Quests added after the save was made start locked and unlock normally; ones removed since are ignored. */
  load(d: QuestSave, _version = QUEST_SAVE_VERSION) {
    for (const q of this.defs) {
      const s = d.state?.[q.id];
      this.state[q.id] = !s || (s.status !== 'active' && s.status !== 'done') ? { status: 'locked', step: 0, n: 0 } : s.status === 'done' ? { status: 'done', step: q.objectives.length, n: 0 } : { status: 'active', step: Math.min(Math.max(0, s.step | 0), q.objectives.length - 1), n: s.n ?? 0 };
    }
    // A quest cannot be active or done unless what it requires is done (a quest was reordered in data): demote it.
    for (const q of this.defs) if (this.state[q.id].status !== 'locked' && !q.requires.every((r) => this.state[r].status === 'done')) this.state[q.id] = { status: 'locked', step: 0, n: 0 };
    this.tracked = d.tracked && this.state[d.tracked]?.status === 'active' ? d.tracked : null;
    this.notes = (d.notes ?? []).filter((n) => typeof n === 'string');
    this.seen = new Set(d.seen ?? []);
    this.unlock();
  }
}
