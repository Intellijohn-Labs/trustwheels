/*
 * Browser-only persistence (IndexedDB) standing in for the API + Postgres.
 * "vehicles" holds one record per vehicle (photos included); "collections" holds
 * every other dataset as one array per key.
 */

const DB_NAME = "trust-wheels";
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

/** Drop the cached connection so the next call opens a fresh one. */
function resetDb(db?: IDBDatabase) {
  dbPromise = null;
  try {
    db?.close();
  } catch {
    // already closed
  }
}

export function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("vehicles")) db.createObjectStore("vehicles", { keyPath: "id" });
      if (!db.objectStoreNames.contains("collections")) db.createObjectStore("collections");
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgrading the schema, or the browser killing the connection
      // (common on mobile when backgrounded): never reuse this handle afterwards.
      db.onversionchange = () => resetDb(db);
      db.onclose = () => resetDb(db);
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new DOMException("IndexedDB open blocked", "InvalidStateError"));
    };
  });
  return dbPromise;
}

function isStaleConnectionError(e: unknown) {
  return (
    e instanceof DOMException &&
    (e.name === "InvalidStateError" || /closing|closed/i.test(e.message))
  );
}

/** Opens a transaction, reconnecting and retrying once if the cached connection is stale. */
async function beginTx(store: string, mode: IDBTransactionMode): Promise<IDBTransaction> {
  const db = await openDb();
  try {
    return db.transaction(store, mode);
  } catch (e) {
    if (!isStaleConnectionError(e)) throw e;
    resetDb(db);
    return (await openDb()).transaction(store, mode);
  }
}

/** Re-validate the connection when the tab wakes from the background. */
export async function revalidateDb() {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  if (!db) return;
  try {
    db.transaction("collections", "readonly").abort();
  } catch (e) {
    if (isStaleConnectionError(e)) resetDb(db);
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void revalidateDb();
  });
  window.addEventListener("pageshow", () => void revalidateDb());
}

export async function tx<T>(
  store: "vehicles" | "collections",
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const t = await beginTx(store, mode);
  return new Promise((resolve, reject) => {
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new DOMException("Transaction aborted", "AbortError"));
  });
}

export function getKey<T>(key: string) {
  return tx<T>("collections", "readonly", (s) => s.get(key) as IDBRequest<T>);
}

export function putKey(key: string, value: unknown) {
  return tx("collections", "readwrite", (s) => void s.put(value, key));
}
