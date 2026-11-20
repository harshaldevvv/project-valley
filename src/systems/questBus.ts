/**
 * A tiny event bus for things quests care about that the game events do not carry (a recipe finished, a campfire lit,
 * a car refuelled, a note read). Emitters (crafting, vehicles, radio) call `emit`; the quest layer listens.
 * Names used: 'craft' {recipe}, 'campfire_lit', 'campfire_placed', 'refuel', 'pump', 'radio' {poi}, 'note' {id}.
 */
export type QuestSignal = { name: string; data?: Record<string, unknown> };
type Fn = (s: QuestSignal) => void;
const subs = new Set<Fn>();
export const questBus = {
  emit(name: string, data?: Record<string, unknown>) {
    for (const f of [...subs]) f({ name, data });
  },
  on(f: Fn) {
    subs.add(f);
    return () => subs.delete(f);
  },
};
