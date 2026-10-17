// The session's key-value store, in IndexedDB: the only browser storage that can
// hold folder handles. Checked by hand, not unit-tested (docs/lib-design.md, SE1).
// Failures reject; the session turns them into "nothing saved" (SE1.7).

import type { KeyValueStore } from '../lib/session.js';

const DB_NAME = 'loadout';
const STORE = 'kv';

export function idbStore(): KeyValueStore {
  let opened: Promise<IDBDatabase> | undefined;
  const open = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB failed to open.'));
      };
    }));
  // Resolves when the transaction commits, so a write has landed before a reload.
  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const transaction = (await open()).transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    return new Promise<T>((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve(request.result);
      };
      transaction.onerror = transaction.onabort = () => {
        reject(transaction.error ?? request.error ?? new Error('IndexedDB transaction failed.'));
      };
    });
  };
  return {
    get: (key) => run('readonly', (store) => store.get(key)),
    set: async (key, value) => {
      await run('readwrite', (store) => store.put(value, key));
    },
    delete: async (key) => {
      await run('readwrite', (store) => store.delete(key));
    },
    keys: async () => (await run('readonly', (store) => store.getAllKeys())).map(String),
  };
}
