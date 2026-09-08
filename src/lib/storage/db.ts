/**
 * A tiny keyed store over IndexedDB, with a localStorage fallback.
 *
 * The fallback is not paranoia: IndexedDB is unavailable or throws on open in
 * some private-browsing and embedded-webview contexts, and losing a journal
 * to that would be worse than losing indexing.
 */

const DB_NAME = 'logline';
const DB_VERSION = 1;
const STORE = 'entries';
const LS_PREFIX = 'logline:entry:';

export interface Keyed {
  id: string;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

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
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function lsAll<T extends Keyed>(): T[] {
  const out: T[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(LS_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (raw) out.push(JSON.parse(raw) as T);
    }
  } catch {
    /* storage blocked — an empty journal beats a crash */
  }
  return out;
}

export async function put<T extends Keyed>(value: T): Promise<void> {
  const db = await openDb();
  if (!db) {
    localStorage.setItem(LS_PREFIX + value.id, JSON.stringify(value));
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function all<T extends Keyed>(): Promise<T[]> {
  const db = await openDb();
  if (!db) return lsAll<T>();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => resolve([]);
  });
}

export async function remove(id: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    localStorage.removeItem(LS_PREFIX + id);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** True when records live in IndexedDB rather than the localStorage fallback. */
export async function isDurable(): Promise<boolean> {
  return (await openDb()) !== null;
}
