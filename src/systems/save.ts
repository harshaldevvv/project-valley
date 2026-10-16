import { SAVE } from '../content/data/save';
import { saveText } from '../content/text/ui';
import type { SaveApi, SaveSection, SaveSlotInfo } from '../core/contracts';
import type { KV } from './storage';

/**
 * Versioned, atomic saves (principles §12). Write protocol per slot:
 *   1 serialize every section  2 write a NEW generation record  3 read it back and compare SHA-256
 *   4 flip the slot's `current` pointer in a separate transaction  5 keep the last 3 generations.
 * A torn write can never damage the current save; load falls back to older generations automatically.
 */
export const SAVE_FORMAT = 2;

interface SaveFile {
  format: number;
  slot: string;
  savedAt: number;
  meta: { gameDay: number; playtimeS: number; label: string };
  sections: Record<string, { v: number; data: unknown }>;
}
interface GenRecord {
  json: string;
  hash: string;
}
interface SlotMeta {
  slot: string;
  current: number;
  gens: number[];
  next: number;
  info: SaveSlotInfo;
}

/** File-format migrations, one per version (v -> v+1). Section shapes migrate inside each section's load(). */
export const MIGRATIONS: Record<number, (f: SaveFile) => SaveFile> = {
  // v1 (pre-M2 dev saves) had no meta label. Stub that proves the chain runs.
  1: (f) => ({ ...f, format: 2, meta: { gameDay: f.meta?.gameDay ?? 1, playtimeS: f.meta?.playtimeS ?? 0, label: f.meta?.label ?? '' } }),
};

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface SaveHooks {
  toast(text: string): void;
  saved(slot: string): void;
  loaded(slot: string): void;
  /** Header info for the slot list. */
  info(): { gameDay: number; playtimeS: number };
}

export class SaveManager implements SaveApi {
  private sections = new Map<string, SaveSection>();
  private queue: Promise<unknown> = Promise.resolve();
  loading = false;

  constructor(private kv: KV, private hooks: SaveHooks) {}

  section(name: string, s: SaveSection) {
    this.sections.set(name, s);
  }

  /** All writes go through one queue, so two saves never interleave. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.queue.then(fn);
    this.queue = p.catch(() => {});
    return p;
  }

  save(slot: string): Promise<void> {
    return this.enqueue(async () => {
      const info = this.hooks.info();
      const file: SaveFile = { format: SAVE_FORMAT, slot, savedAt: Date.now(), meta: { ...info, label: slot }, sections: {} };
      for (const [name, s] of this.sections) file.sections[name] = { v: s.version, data: s.save() };
      await this.writeGeneration(slot, JSON.stringify(file), file.savedAt, info);
      this.hooks.saved(slot);
    });
  }

  private async writeGeneration(slot: string, json: string, savedAt: number, info: { gameDay: number; playtimeS: number }) {
    const hash = await sha256(json);
    const meta = (await this.kv.get<SlotMeta>('meta', slot)) ?? { slot, current: 0, gens: [], next: 1, info: { slot, savedAt, label: slot, ...info } };
    const gen = meta.next;
    const key = `${slot}:${gen}`;
    await this.kv.put('gens', key, { json, hash } satisfies GenRecord);
    const back = await this.kv.get<GenRecord>('gens', key);
    if (!back || (await sha256(back.json)) !== hash) throw new Error(`save "${slot}": read-back hash mismatch, current save kept`);
    const gens = [...meta.gens, gen];
    const dropped = gens.splice(0, Math.max(0, gens.length - SAVE.generations));
    await this.kv.put('meta', slot, { slot, current: gen, gens, next: gen + 1, info: { slot, savedAt, label: slot, ...info } } satisfies SlotMeta);
    for (const g of dropped) await this.kv.del('gens', `${slot}:${g}`);
  }

  load(slot: string): Promise<boolean> {
    return this.enqueue(async () => {
      const meta = await this.kv.get<SlotMeta>('meta', slot);
      if (!meta) return false;
      for (const gen of [...meta.gens].reverse()) {
        const file = await this.readValid(`${slot}:${gen}`);
        if (!file) continue;
        this.apply(file);
        if (gen !== meta.current || gen !== meta.gens[meta.gens.length - 1]) this.hooks.toast(saveText.fellBack);
        this.hooks.loaded(slot);
        return true;
      }
      this.hooks.toast(saveText.corrupt);
      return false;
    });
  }

  /** Hash + schema check, then migrate to the current format. Null = this generation is unusable. */
  private async readValid(key: string): Promise<SaveFile | null> {
    try {
      const rec = await this.kv.get<GenRecord>('gens', key);
      if (!rec || (await sha256(rec.json)) !== rec.hash) return null;
      let f = JSON.parse(rec.json) as SaveFile;
      while (f.format < SAVE_FORMAT) {
        const m = MIGRATIONS[f.format];
        if (!m) return null;
        f = m(f);
      }
      if (f.format !== SAVE_FORMAT || typeof f.sections !== 'object' || !f.sections) return null;
      return f;
    } catch {
      return null;
    }
  }

  /** Apply sections in the data-defined order (world before contents before player), then the rest. */
  private apply(f: SaveFile) {
    const order = [...SAVE.loadOrder, ...this.sections.keys()];
    this.loading = true;
    try {
      for (const name of new Set(order)) {
        const s = this.sections.get(name);
        const rec = f.sections[name];
        if (s && rec) s.load(rec.data, rec.v);
      }
    } finally {
      this.loading = false;
    }
  }

  async list(): Promise<SaveSlotInfo[]> {
    return (await this.kv.all<SlotMeta>('meta')).map((m) => m.info).sort((a, b) => b.savedAt - a.savedAt);
  }

  /** .zsave = gzip(JSON {zsave, slot, json, hash}). */
  exportSlot(slot: string): Promise<Blob> {
    return this.enqueue(async () => {
      const meta = await this.kv.get<SlotMeta>('meta', slot);
      const rec = meta && (await this.kv.get<GenRecord>('gens', `${slot}:${meta.current}`));
      if (!rec) throw new Error(`no save in slot "${slot}"`);
      const text = JSON.stringify({ zsave: 1, slot, ...rec });
      const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
      return new Response(stream).blob();
    });
  }

  importSlot(slot: string, file: Blob): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        const text = await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text();
        const z = JSON.parse(text) as { zsave: number; json: string; hash: string };
        if (z.zsave !== 1 || (await sha256(z.json)) !== z.hash) return false;
        const f = JSON.parse(z.json) as SaveFile;
        await this.writeGeneration(slot, z.json, f.savedAt ?? Date.now(), { gameDay: f.meta?.gameDay ?? 1, playtimeS: f.meta?.playtimeS ?? 0 });
        return true;
      } catch {
        return false;
      }
    });
  }
}
