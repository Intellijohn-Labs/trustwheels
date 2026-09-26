/*
 * Browser-only persistence (IndexedDB) standing in for the API + Postgres.
 * "vehicles" holds one record per vehicle (photos included); "collections" holds
 * every other dataset as one array per key.
 */

const DB_NAME = "trust-wheels";
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("vehicles")) db.createObjectStore("vehicles", { keyPath: "id" });
      if (!db.objectStoreNames.contains("collections")) db.createObjectStore("collections");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function tx<T>(
  store: "vehicles" | "collections",
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export function getKey<T>(key: string) {
  return tx<T>("collections", "readonly", (s) => s.get(key) as IDBRequest<T>);
}

export function putKey(key: string, value: unknown) {
  return tx("collections", "readwrite", (s) => void s.put(value, key));
}
