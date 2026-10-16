/**
 * Save storage: a tiny key-value interface with an IndexedDB backend (the game) and an in-memory one (tests).
 * Two object stores: 'gens' (one record per save generation) and 'meta' (one record per slot: the `current` pointer).
 */
export type StoreName = 'gens' | 'meta';
export interface KV {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put(store: StoreName, key: string, value: unknown): Promise<void>;
  del(store: StoreName, key: string): Promise<void>;
  all<T>(store: StoreName): Promise<T[]>;
}

export function memoryKV(): KV & { raw: Record<StoreName, Map<string, unknown>> } {
  const raw = { gens: new Map<string, unknown>(), meta: new Map<string, unknown>() };
  return {
    raw,
    get: async (s, k) => structuredClone(raw[s].get(k)) as never,
    put: async (s, k, v) => void raw[s].set(k, structuredClone(v)),
    del: async (s, k) => void raw[s].delete(k),
    all: async (s) => [...raw[s].values()].map((v) => structuredClone(v)) as never,
  };
}

export function indexedKV(dbName = 'project-valley-saves'): KV {
  const open = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('gens');
      req.result.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // One transaction per call: a put completes (oncomplete = durable) before the next step of the protocol runs.
  const run = <T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void) =>
    open.then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction(store, mode);
          const req = fn(tx.objectStore(store));
          tx.oncomplete = () => resolve(req ? (req.result as T) : (undefined as T));
          tx.onerror = tx.onabort = () => reject(tx.error);
        }),
    );
  return {
    get: (s, k) => run(s, 'readonly', (st) => st.get(k)),
    put: (s, k, v) => run(s, 'readwrite', (st) => void st.put(v, k)),
    del: (s, k) => run(s, 'readwrite', (st) => void st.delete(k)),
    all: (s) => run(s, 'readonly', (st) => st.getAll()),
  };
}
