// In-memory stand-ins for sessionStorage and IndexedDB.

import type { KeyValueStore, TabStorage } from '../../session.js';

export function memoryTab(): TabStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

export function memoryDb(): KeyValueStore {
  const items = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(items.get(key)),
    set: (key, value) => {
      items.set(key, value);
      return Promise.resolve();
    },
    delete: (key) => {
      items.delete(key);
      return Promise.resolve();
    },
    keys: () => Promise.resolve([...items.keys()]),
  };
}
