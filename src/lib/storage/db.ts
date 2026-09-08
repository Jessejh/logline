/**
 * A tiny keyed store over IndexedDB, with a localStorage fallback.
 *
 * The fallback is not paranoia: IndexedDB is unavailable or throws on open in
 * some private-browsing and embedded-webview contexts, and losing a journal
 * to that would be worse than losing indexing.
 *
 * Two stores: the journal entries, and the single profile record that carries
 * credits and owned upgrades. They are kept apart so that listing the journal
 * cannot return the profile, and so that clearing one never touches the other.
 */

const DB_NAME = 'logline';
/** 2 added the profile store alongside the original entries store. */
const DB_VERSION = 2;

export const ENTRIES = 'entries';
export const PROFILE = 'profile';
export type Store = typeof ENTRIES | typeof PROFILE;

const STORES: Store[] = [ENTRIES, PROFILE];

export interface Keyed {
  id: string;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function lsKey(store: Store, id: string): string {
  return `logline:${store}:${id}`;
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let idb: IDBFactory | undefined;
    try {
      idb = indexedDB;
    } catch {
      resolve(null);
      return;
    }
    if (!idb) {
      resolve(null);
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = idb.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      // Additive only: an existing v1 database keeps its entries untouched and
      // simply gains the profile store.
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

/**
 * Before the profile store existed, fallback entries were written under a
 * singular prefix with no store segment. Still read, so a journal written by
 * an older build in a browser without IndexedDB survives this change.
 */
const LEGACY_ENTRY_PREFIX = 'logline:entry:';

function lsAll<T extends Keyed>(store: Store): T[] {
  const out: T[] = [];
  const prefixes = store === ENTRIES ? [`logline:${store}:`, LEGACY_ENTRY_PREFIX] : [`logline:${store}:`];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!prefixes.some((p) => key?.startsWith(p))) continue;
      const raw = localStorage.getItem(key!);
      if (raw) out.push(JSON.parse(raw) as T);
    }
  } catch {
    /* storage blocked — an empty journal beats a crash */
  }
  return out;
}

export async function put<T extends Keyed>(store: Store, value: T): Promise<void> {
  const db = await openDb();
  if (!db) {
    localStorage.setItem(lsKey(store, value.id), JSON.stringify(value));
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function all<T extends Keyed>(store: Store): Promise<T[]> {
  const db = await openDb();
  if (!db) return lsAll<T>(store);
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => resolve([]);
  });
}

export async function get<T extends Keyed>(store: Store, id: string): Promise<T | null> {
  const db = await openDb();
  if (!db) {
    try {
      const raw = localStorage.getItem(lsKey(store, id));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function remove(store: Store, id: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    localStorage.removeItem(lsKey(store, id));
    // An entry written by an older build lives under the legacy key, and a
    // delete that silently left it behind would resurrect it on next load.
    if (store === ENTRIES) localStorage.removeItem(LEGACY_ENTRY_PREFIX + id);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** True when records live in IndexedDB rather than the localStorage fallback. */
export async function isDurable(): Promise<boolean> {
  return (await openDb()) !== null;
}
