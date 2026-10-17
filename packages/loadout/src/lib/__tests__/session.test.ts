import { describe, expect, it, vi } from 'vitest';
import { FLAG_KEY, isHardRefresh, openSession, readFlag, type KeyValueStore, type TabStorage } from '../session.js';
import type { Change } from '../types.js';
import { folder } from './helpers/drive.js';

function memoryTab(): TabStorage {
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

function memoryDb(): KeyValueStore {
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

const vault = folder({}, { name: 'Vault' }).handle;
const drive = folder().handle;
const location = { partition: '0000000000000000', titleId: '4D5307E6', contentType: '00007000', packageName: 'G' };
const queue: Change[] = [{ op: 'add', location }];
const state = { vault, drive, queue };
const DAY = 24 * 60 * 60 * 1000;

describe('isHardRefresh', () => {
  const now = 100_000;

  it('is true when a worker is registered but the page is not controlled (SE1.1)', () => {
    expect(isHardRefresh({ registered: true, controlled: false, flaggedAt: null, now })).toBe(true);
    expect(isHardRefresh({ registered: true, controlled: true, flaggedAt: null, now })).toBe(false);
    expect(isHardRefresh({ registered: false, controlled: false, flaggedAt: null, now })).toBe(false);
  });

  it('is true for a flag set less than 5 seconds ago, never one in the future (SE1.1)', () => {
    expect(isHardRefresh({ registered: false, controlled: false, flaggedAt: now, now })).toBe(true);
    expect(isHardRefresh({ registered: true, controlled: true, flaggedAt: now - 4_999, now })).toBe(true);
    expect(isHardRefresh({ registered: true, controlled: true, flaggedAt: now - 5_000, now })).toBe(false);
    expect(isHardRefresh({ registered: true, controlled: true, flaggedAt: now + 1, now })).toBe(false);
  });

  it('reads the flag as a time, or null (SE1.1)', () => {
    const tab = memoryTab();
    expect(readFlag(tab)).toBeNull();
    tab.setItem(FLAG_KEY, '1234');
    expect(readFlag(tab)).toBe(1234);
    tab.setItem(FLAG_KEY, 'junk');
    expect(readFlag(tab)).toBeNull();
  });
});

describe('openSession', () => {
  it('saves and loads the handles and queue (SE1.4, SE1.5)', async () => {
    const session = await openSession(memoryTab(), memoryDb(), { fresh: false });
    expect(await session.load()).toBeNull();
    await session.save(state);
    expect(await session.load()).toEqual(state);
  });

  it('keeps the record across a reload of the same tab (SE1.2)', async () => {
    const tab = memoryTab();
    const db = memoryDb();
    await (await openSession(tab, db, { fresh: false })).save(state);
    expect(await (await openSession(tab, db, { fresh: false })).load()).toEqual(state);
  });

  it('starts empty in a new tab, without touching other tabs (SE1.2, SE1.6)', async () => {
    const db = memoryDb();
    const first = memoryTab();
    await (await openSession(first, db, { fresh: false })).save(state);
    expect(await (await openSession(memoryTab(), db, { fresh: false })).load()).toBeNull();
    expect(await (await openSession(first, db, { fresh: false })).load()).toEqual(state);
  });

  it('starts fresh on a hard refresh, and stays fresh after a reload (SE1.3)', async () => {
    const tab = memoryTab();
    const db = memoryDb();
    await (await openSession(tab, db, { fresh: false })).save(state);
    expect(await (await openSession(tab, db, { fresh: true })).load()).toBeNull();
    expect(await (await openSession(tab, db, { fresh: false })).load()).toBeNull();
    expect(await db.keys()).toEqual([]);
  });

  it('clears the hard-refresh flag (SE1.2)', async () => {
    const tab = memoryTab();
    tab.setItem(FLAG_KEY, '1');
    await openSession(tab, memoryDb(), { fresh: true });
    expect(readFlag(tab)).toBeNull();
  });

  it('ignores a record that is not a session (SE1.4)', async () => {
    const db = memoryDb();
    const session = await openSession(memoryTab(), db, { fresh: false, newId: () => 'me' });
    for (const bad of [
      null,
      'text',
      { savedAt: 1, state: { vault, drive: 'x', queue } },
      { state: { vault, drive, queue: [{}] } },
    ]) {
      await db.set('session:me', bad);
      expect(await session.load()).toBeNull();
    }
  });

  it('clears the record (SE1.5)', async () => {
    const session = await openSession(memoryTab(), memoryDb(), { fresh: false });
    await session.save(state);
    await session.clear();
    expect(await session.load()).toBeNull();
  });

  it('deletes records of tabs not saved for 7 days (SE1.6)', async () => {
    const db = memoryDb();
    const now = 100 * DAY;
    await db.set('session:old', { savedAt: now - 8 * DAY, state });
    await db.set('session:recent', { savedAt: now - 6 * DAY, state });
    await db.set('other', 'kept');
    await openSession(memoryTab(), db, { fresh: false, now, newId: () => 'me' });
    expect((await db.keys()).sort()).toEqual(['other', 'session:recent']);
  });

  it('never rejects when storage fails (SE1.7)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fail = () => Promise.reject(new DOMException('No storage here.', 'InvalidStateError'));
    const broken: KeyValueStore = { get: fail, set: fail, delete: fail, keys: fail };
    const session = await openSession(memoryTab(), broken, { fresh: true });
    await expect(session.save(state)).resolves.toBeUndefined();
    await expect(session.load()).resolves.toBeNull();
    await expect(session.clear()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
