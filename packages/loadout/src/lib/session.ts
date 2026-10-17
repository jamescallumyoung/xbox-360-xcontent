// Surviving a reload (docs/lib-design.md, SE1; docs/features.md, §1).

import type { Change } from './types.js';

/** What `sessionStorage` offers that the session uses. */
export type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A small async key-value store: IndexedDB in the app (`app/idb.ts`). */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** What survives a reload: both folders' handles, and the queue. */
export interface SavedSession {
  vault: FileSystemDirectoryHandle;
  drive: FileSystemDirectoryHandle;
  queue: Change[];
}

/**
 * The tab's saved state. None of its methods reject: storage that fails (a
 * private window, a full disk) only means nothing survives a reload (SE1.7).
 */
export interface Session {
  load(): Promise<SavedSession | null>;
  save(state: SavedSession): Promise<void>;
  clear(): Promise<void>;
}

/** The `sessionStorage` key holding the time Cmd/Ctrl+Shift+R was pressed (SE1.1). */
export const FLAG_KEY = 'loadout.fresh-start';
/** The `sessionStorage` key holding this tab's ID: present on a reload, absent in a new tab (SE1.2). */
const TAB_KEY = 'loadout.tab';
/** Records are keyed `session:<tab ID>`. */
const PREFIX = 'session:';
/** How long the hard-refresh flag counts for. */
const FLAG_LIFETIME = 5000;
/** Records of tabs not saved for this long are deleted (SE1.6). */
const RECORD_LIFETIME = 7 * 24 * 60 * 60 * 1000;

/** The time the hard-refresh flag was set, or `null`. */
export function readFlag(tab: TabStorage): number | null {
  const raw = tab.getItem(FLAG_KEY);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * True after a hard refresh: browsers bypass service workers on one, so an
 * active registration with an uncontrolled page means one. The keyboard flag
 * covers the rare case where the worker isn't active yet (SE1.1).
 */
export function isHardRefresh(input: {
  registered: boolean;
  controlled: boolean;
  flaggedAt: number | null;
  now: number;
}): boolean {
  if (input.registered && !input.controlled) return true;
  const { flaggedAt, now } = input;
  return flaggedAt !== null && now >= flaggedAt && now - flaggedAt < FLAG_LIFETIME;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function isChange(value: unknown): value is Change {
  return isObject(value) && (value['op'] === 'add' || value['op'] === 'remove') && isObject(value['location']);
}

function isSession(value: unknown): value is SavedSession {
  if (!isObject(value)) return false;
  const { vault, drive, queue } = value;
  const isDirectory = (h: unknown) => isObject(h) && h['kind'] === 'directory';
  return isDirectory(vault) && isDirectory(drive) && Array.isArray(queue) && queue.every(isChange);
}

/** Runs a storage call, logging a failure instead of rejecting (SE1.7). */
async function safely<T>(call: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await call();
  } catch (error) {
    console.warn('Loadout could not use its saved session.', error);
    return fallback;
  }
}

/**
 * Opens the tab's session. A new tab, or `fresh`, starts with nothing saved
 * (SE1.2, SE1.3). Each tab has its own record (SE1.6).
 */
export async function openSession(
  tab: TabStorage,
  db: KeyValueStore,
  options: { fresh: boolean; now?: number; newId?: () => string },
): Promise<Session> {
  const now = options.now ?? Date.now();
  const previous = tab.getItem(TAB_KEY);
  if (previous !== null && options.fresh) await safely(() => db.delete(`${PREFIX}${previous}`), undefined);
  let id = previous;
  if (id === null || options.fresh) {
    id = (options.newId ?? (() => crypto.randomUUID()))();
    tab.setItem(TAB_KEY, id);
  }
  tab.removeItem(FLAG_KEY);
  const key = `${PREFIX}${id}`;

  // Records of tabs long gone (SE1.6).
  await safely(async () => {
    for (const other of await db.keys()) {
      if (other === key || !other.startsWith(PREFIX)) continue;
      const record = await db.get(other);
      const savedAt = isObject(record) && typeof record['savedAt'] === 'number' ? record['savedAt'] : 0;
      if (now - savedAt > RECORD_LIFETIME) await db.delete(other);
    }
  }, undefined);

  return {
    load: () =>
      safely(async () => {
        const value = await db.get(key);
        if (!isObject(value) || !isSession(value['state'])) return null;
        return value['state'];
      }, null),
    save: (state) => safely(() => db.set(key, { savedAt: Date.now(), state }), undefined),
    clear: () => safely(() => db.delete(key), undefined),
  };
}
