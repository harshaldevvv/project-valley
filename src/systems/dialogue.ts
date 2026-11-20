import { DIALOGUE_BY_ID, type Choice, type Cond, type Effect } from '../content/data/npc';
import type { Objective } from '../content/data/quests';

/**
 * Dialogue rules, pure: a conversation is a walk through the graph in data/npc.ts. The world is reached through
 * `DialogueEnv` (the pack, flags, quests), so it runs in tests. `entry` picks the first node whose conditions hold; a
 * choice is shown only when its `when` conditions hold; effects run in order and then the conversation moves on.
 */
export interface DialogueEnv {
  count(item: string): number;
  take(item: string, n: number): void;
  give(item: string, n: number): void;
  flag(name: string): boolean;
  setFlag(name: string): void;
  questStatus(id: string): 'locked' | 'active' | 'done';
  /** The current objective of every active quest (for 'giving' conditions). */
  objectives(): Objective[];
  /** An item was handed to an NPC for a quest. */
  hand(npc: string, item: string, n: number): void;
  openTrade(npc: string): void;
}

export function holds(c: Cond, env: DialogueEnv, npc: string): boolean {
  if ('has' in c) return env.count(c.has.item) >= c.has.count;
  if ('flag' in c) return env.flag(c.flag) !== !!c.not;
  if ('quest' in c) return env.questStatus(c.quest) === c.status;
  return c.giving === npc && env.objectives().some((o) => o.type === 'give' && o.npc === c.giving);
}

export class Dialogue {
  node: string | null = null;
  constructor(private npc: string, private dialogueId: string, private env: DialogueEnv) {}

  get def() {
    return DIALOGUE_BY_ID[this.dialogueId];
  }

  /** Start (or restart) the conversation at the first entry whose conditions hold. */
  start() {
    const e = this.def.entry.find((x) => (x.when ?? []).every((c) => holds(c, this.env, this.npc)));
    this.node = e?.node ?? null;
    return this.node;
  }

  /** Choices the player can pick right now. */
  choices(): Choice[] {
    if (!this.node) return [];
    return this.def.nodes[this.node].choices.filter((c) => (c.when ?? []).every((w) => holds(w, this.env, this.npc)));
  }

  private run(e: Effect) {
    if ('give' in e) this.env.give(e.give.item, e.give.count);
    else if ('take' in e) this.env.take(e.take.item, e.take.count);
    else if ('set' in e) this.env.setFlag(e.set);
    else if ('hand' in e) {
      if (this.env.count(e.hand.item) < e.hand.count) return;
      this.env.take(e.hand.item, e.hand.count);
      this.env.hand(this.npc, e.hand.item, e.hand.count);
    } else this.env.openTrade(this.npc);
  }

  /** Pick a choice by id; returns the new node id, or null when the conversation ended. */
  choose(id: string): string | null {
    const c = this.choices().find((x) => x.id === id);
    if (!c) return this.node;
    for (const e of c.effects ?? []) this.run(e);
    this.node = c.next === 'end' ? null : c.next;
    return this.node;
  }
}
