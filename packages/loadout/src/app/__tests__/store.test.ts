import { describe, expect, it, vi } from 'vitest';
import { folder, pullable, type Entry, type TestFolder } from '../../lib/__tests__/helpers/drive.js';
import { header } from '../../lib/__tests__/helpers/header.js';
import { memoryDb, memoryTab } from '../../lib/__tests__/helpers/memory.js';
import { openSession, type Session } from '../../lib/session.js';
import type { PackageLocation } from '../../lib/types.js';
import { LoadoutStore } from '../store.js';

const PUB = '0000000000000000';
const GOD = `${PUB}/4D5307E6/00007000`;
const at = (packageName: string, contentType = '00007000', titleId = '4D5307E6'): PackageLocation => ({
  partition: PUB,
  titleId,
  contentType,
  packageName,
});

const vaultOf = (tree: Record<string, Entry>) => folder(tree, { name: 'Vault', mode: 'read' });

async function newStore(session?: Session) {
  const store = new LoadoutStore({ pollMs: null, toastMs: 10 });
  await store.start(session ?? (await openSession(memoryTab(), memoryDb(), { fresh: false })));
  return store;
}

/** A store past setup, with both folders scanned. */
async function ready(vaultTree: Record<string, Entry>, driveTree: Record<string, Entry> = {}, session?: Session) {
  const vault = vaultOf(vaultTree);
  const drive = folder(driveTree);
  const store = await newStore(session);
  await store.pick('vault', vault.handle);
  await store.pick('drive', drive.handle);
  await store.continue();
  return { store, vault, drive };
}

const names = (f: TestFolder) => f.list().filter((p) => !p.endsWith('/'));

describe('setup', () => {
  it('checks a picked folder and says why it is or is not usable (ST1.1)', async () => {
    const store = await newStore();
    await store.pick('vault', vaultOf({ [`${GOD}/G`]: header() }).handle);
    expect(store.vault).toMatchObject({ name: 'Vault', status: 'valid', message: 'Partition root with 1 partition.' });
    await store.pick('vault', vaultOf({}).handle);
    expect(store.vault).toMatchObject({
      status: 'invalid',
      message: 'This folder is empty. The vault needs at least one partition.',
    });
    await store.pick('drive', folder().handle);
    expect(store.drive).toMatchObject({ status: 'valid', message: 'Empty folder. Titles will be copied here.' });
    await store.pick('drive', folder({ 'notes.txt': 'x', [`${PUB}/`]: null }).handle);
    expect(store.drive).toMatchObject({
      status: 'invalid',
      message: "This folder holds things that aren't partitions (notes.txt). Choose the Content folder inside it.",
    });
  });

  it('ignores the result of a pick that has been replaced (ST1.2)', async () => {
    const store = await newStore();
    const slow = vaultOf({}).handle;
    const { promise: gate, resolve: release } = Promise.withResolvers<undefined>();
    const original = slow.entries.bind(slow);
    // Listing waits for the gate, so this pick finishes after the next one.
    const delayed = async function* () {
      await gate;
      yield* original();
    };
    vi.spyOn(slow, 'entries').mockImplementation(delayed as unknown as typeof original);
    const good = vaultOf({ [`${GOD}/G`]: header() });
    const first = store.pick('vault', slow);
    await store.pick('vault', good.handle);
    release(undefined);
    await first;
    expect(store.vault).toMatchObject({ status: 'valid' });
    expect(store.vault?.handle).toBe(good.handle);
  });

  it('clears one side, so a refused pick cannot leave a valid folder behind (ST1.1a)', async () => {
    const store = await newStore();
    await store.pick('vault', vaultOf({ [`${GOD}/G`]: header() }).handle);
    await store.pick('drive', folder().handle);
    store.clearSelection('vault');
    expect(store.vault).toBeNull();
    expect(store.canContinue).toBe(false);
  });

  it('allows continuing only when both folders are valid (ST1.3)', async () => {
    const store = await newStore();
    expect(store.canContinue).toBe(false);
    await store.pick('vault', vaultOf({ [`${GOD}/G`]: header() }).handle);
    expect(store.canContinue).toBe(false);
    await store.pick('drive', folder().handle);
    expect(store.canContinue).toBe(true);
  });

  it('scans both folders, saves the session and shows Discover (ST1.4)', async () => {
    const session = await openSession(memoryTab(), memoryDb(), { fresh: false });
    const { store } = await ready(
      { [`${GOD}/G`]: header({ displayName: 'Halo 3' }) },
      { [`${PUB}/58410A1F/000D0000/A`]: header() },
      session,
    );
    expect(store.phase).toBe('ready');
    expect(store.page).toBe('discover');
    expect(store.scanning).toBe(false);
    expect(store.vaultTitles.map((t) => t.name)).toEqual(['Halo 3']);
    expect(store.driveTitles.map((t) => t.titleId)).toEqual(['58410A1F']);
    expect(await session.load()).toMatchObject({ queue: [] });
  });

  it('runs one Continue at a time, ignoring picks meanwhile (ST1.4)', async () => {
    const store = await newStore();
    const vault = vaultOf({ [`${GOD}/G`]: header() });
    await store.pick('vault', vault.handle);
    await store.pick('drive', folder().handle);
    const first = store.continue();
    expect(store.scanning).toBe(true);
    const second = store.continue();
    await store.pick('vault', vaultOf({}).handle);
    await Promise.all([first, second]);
    expect(store.phase).toBe('ready');
    expect(store.vault?.handle).toBe(vault.handle);
    expect(store.scanning).toBe(false);
  });

  it('stays on the welcome screen when a scan fails (ST1.5)', async () => {
    const store = await newStore();
    const vault = vaultOf({ [`${GOD}/G`]: header() });
    await store.pick('vault', vault.handle);
    await store.pick('drive', folder().handle);
    vi.spyOn(vault.handle, 'entries').mockImplementation(() => {
      throw new DOMException('Unreadable.', 'NotReadableError');
    });
    await store.continue();
    expect(store.phase).toBe('welcome');
    expect(store.scanning).toBe(false);
    expect(store.vault).toMatchObject({ status: 'invalid' });
  });

  it('stays on the welcome screen when a folder fails to open (ST1.5)', async () => {
    const store = await newStore();
    const drive = pullable(folder().handle);
    await store.pick('vault', vaultOf({ [`${GOD}/G`]: header() }).handle);
    await store.pick('drive', drive.handle);
    drive.pull();
    await store.continue();
    expect(store.phase).toBe('welcome');
    expect(store.drive).toMatchObject({
      status: 'invalid',
      message: "The folder can't be found. Is the drive plugged in?",
    });
  });
});

describe('queue', () => {
  it('queues an add only when the package can be added, and toggles it off (ST1.6)', async () => {
    const { store } = await ready({ [`${GOD}/A`]: header(), [`${GOD}/B`]: header() }, { [`${GOD}/B`]: header() });
    store.toggleAdd(at('B'));
    expect(store.queue).toEqual([]);
    store.toggleAdd(at('A'));
    expect(store.queue).toEqual([{ op: 'add', location: at('A') }]);
    store.toggleAdd(at('A'));
    expect(store.queue).toEqual([]);
  });

  it('refuses queue changes and reset while applying (ST1.7, ST1.20)', async () => {
    const { store } = await ready({ [`${GOD}/A`]: header(), [`${GOD}/B`]: header() }, { [`${GOD}/X`]: header() });
    store.toggleAdd(at('A'));
    const running = store.startApply();
    store.toggleAdd(at('B'));
    store.requestRemove(at('X'));
    store.undo({ op: 'add', location: at('A') });
    store.requestReset();
    await store.reset();
    expect(store.queue).toEqual([{ op: 'add', location: at('A') }]);
    expect(store.confirmingReset).toBe(false);
    expect(store.phase).toBe('ready');
    await running;
    expect(store.queue).toEqual([]);
  });

  it('queues a removal silently only when the vault has the same package (ST1.8)', async () => {
    const { store } = await ready(
      { [`${GOD}/SAME`]: header(), [`${GOD}/DIFF`]: header({ contentId: '01'.repeat(20) }) },
      { [`${GOD}/SAME`]: header(), [`${GOD}/DIFF`]: header({ contentId: '02'.repeat(20) }), [`${GOD}/ONLY`]: header() },
    );
    store.requestRemove(at('SAME'));
    expect(store.queue).toEqual([{ op: 'remove', location: at('SAME') }]);
    expect(store.pendingRemoval).toBeNull();
    store.requestRemove(at('DIFF'));
    expect(store.pendingRemoval).toEqual({ location: at('DIFF'), risk: 'mismatch' });
    store.cancelPendingRemoval();
    store.requestRemove(at('ONLY'));
    expect(store.pendingRemoval).toEqual({ location: at('ONLY'), risk: 'not-in-vault' });
    store.requestRemove(at('SAME'));
    expect(store.queue).toEqual([]);
  });

  it('does nothing for a removal of a package not on the drive (ST1.8)', async () => {
    const { store } = await ready({ [`${GOD}/A`]: header() });
    store.requestRemove(at('A'));
    expect(store.queue).toEqual([]);
    expect(store.pendingRemoval).toBeNull();
  });

  it('queues a pending removal when confirmed, and drops it when cancelled (ST1.9)', async () => {
    const { store } = await ready({ [`${PUB}/58410A1F/000D0000/Z`]: header() }, { [`${GOD}/ONLY`]: header() });
    store.requestRemove(at('ONLY'));
    store.cancelPendingRemoval();
    expect(store.queue).toEqual([]);
    expect(store.pendingRemoval).toBeNull();
    store.requestRemove(at('ONLY'));
    store.confirmPendingRemoval();
    expect(store.queue).toEqual([{ op: 'remove', location: at('ONLY') }]);
    expect(store.pendingRemoval).toBeNull();
  });

  it('undoes one change (ST1.10)', async () => {
    const { store } = await ready({ [`${GOD}/A`]: header(), [`${GOD}/B`]: header() });
    store.toggleAdd(at('A'));
    store.toggleAdd(at('B'));
    store.undo({ op: 'add', location: at('A') });
    expect(store.queue).toEqual([{ op: 'add', location: at('B') }]);
  });

  it('saves the session on every queue change (ST1.11)', async () => {
    const session = await openSession(memoryTab(), memoryDb(), { fresh: false });
    const { store } = await ready({ [`${GOD}/A`]: header() }, {}, session);
    store.toggleAdd(at('A'));
    await vi.waitFor(async () => {
      expect((await session.load())?.queue).toEqual([{ op: 'add', location: at('A') }]);
    });
  });

  it('adds up the bytes queued to copy and remove (ST1.12)', async () => {
    const { store } = await ready(
      { [`${GOD}/A`]: header({ format: 1, dataFilesSize: 5000 }) },
      { [`${GOD}/X`]: header() },
    );
    store.toggleAdd(at('A'));
    store.requestRemove(at('X'));
    store.confirmPendingRemoval();
    expect(store.queuedAddBytes).toBe(0xb000 + 5000);
    expect(store.queuedRemoveBytes).toBe(0xb000);
  });
});

describe('applying', () => {
  it('does nothing with an empty queue, or while blocked (ST1.13, ST1.17)', async () => {
    const vault = pullable(vaultOf({ [`${GOD}/A`]: header() }).handle);
    const store = await newStore();
    await store.pick('vault', vault.handle);
    await store.pick('drive', folder().handle);
    await store.continue();
    await store.startApply();
    expect(store.apply).toBeNull();
    store.toggleAdd(at('A'));
    vault.pull();
    await store.checkFolders();
    expect(store.applyBlocked).toBe('The vault is disconnected.');
    await store.startApply();
    expect(store.apply).toBeNull();
    expect(store.queue).toHaveLength(1);
  });

  it('runs one apply at a time (ST1.13)', async () => {
    const { store, drive } = await ready({ [`${GOD}/A`]: header() });
    store.toggleAdd(at('A'));
    await Promise.all([store.startApply(), store.startApply()]);
    expect(store.errors).toEqual([]);
    expect(names(drive)).toEqual([`${GOD}/A`]);
  });

  it('empties the queue, rescans the drive and opens the report on success (ST1.14)', async () => {
    const { store, drive } = await ready(
      { [`${GOD}/A`]: header({ displayName: 'Halo 3' }) },
      { [`${GOD}/X`]: header() },
    );
    store.toggleAdd(at('A'));
    store.requestRemove(at('X'));
    store.confirmPendingRemoval();
    await store.startApply();
    expect(store.queue).toEqual([]);
    expect(store.apply).toBeNull();
    expect(names(drive)).toEqual([`${GOD}/A`]);
    expect(store.driveTitles[0]?.packages.map((p) => p.location.packageName)).toEqual(['A']);
    expect(store.report?.summary).toMatchObject({ changes: 2, added: { count: 1 }, removed: { count: 1 } });
    expect(store.report?.changes.map((c) => [c.op, c.package.name])).toEqual([
      ['remove', 'X'],
      ['add', 'Halo 3'],
    ]);
  });

  it('stops after the current change, keeping the rest queued (ST1.15)', async () => {
    const { store, drive } = await ready({ [`${GOD}/A`]: header(), [`${GOD}/B`]: header() });
    store.toggleAdd(at('A'));
    store.toggleAdd(at('B'));
    const running = store.startApply();
    store.stopApply();
    await running;
    expect(store.queue).toEqual([{ op: 'add', location: at('B') }]);
    expect(store.apply).toBeNull();
    expect(store.report).toBeNull();
    expect(store.toasts.map((t) => t.text)).toContain('Stopped. Applied 1 of 2 changes.');
    expect(store.driveTitles[0]?.packages).toHaveLength(1);
    expect(names(drive)).toEqual([`${GOD}/A`]);
  });

  it('keeps unapplied changes and shows the error after a failure (ST1.16)', async () => {
    const { store, vault } = await ready({ [`${GOD}/A`]: header(), [`${GOD}/B`]: header({ displayName: 'Map' }) });
    store.toggleAdd(at('A'));
    store.toggleAdd(at('B'));
    vault.remove(`${GOD}/B`);
    await store.startApply();
    expect(store.queue).toEqual([{ op: 'add', location: at('B') }]);
    expect(store.errors).toEqual([
      "Couldn't copy Map. The package has changed on the vault since it was scanned. Rescan and try again.",
    ]);
    expect(store.apply?.failed?.change).toEqual({ op: 'add', location: at('B') });
    expect(store.apply?.order).toEqual([
      { op: 'add', location: at('A') },
      { op: 'add', location: at('B') },
    ]);
    expect(store.driveTitles[0]?.packages.map((p) => p.location.packageName)).toEqual(['A']);
    store.dismissError();
    expect(store.apply).toBeNull();
    expect(store.errors).toEqual([]);
  });
});

describe('folder status', () => {
  it('emits a change only when a folder state changes (ST1.18)', async () => {
    const drive = pullable(folder().handle);
    const store = await newStore();
    await store.pick('vault', vaultOf({ [`${GOD}/A`]: header() }).handle);
    await store.pick('drive', drive.handle);
    await store.continue();
    const changes = vi.fn();
    store.addEventListener('change', changes);
    await store.checkFolders();
    expect(changes).not.toHaveBeenCalled();
    drive.pull();
    await store.checkFolders();
    expect(store.driveHealth).toMatchObject({ state: 'disconnected' });
    expect(changes).toHaveBeenCalledTimes(1);
    drive.plugIn();
    await store.checkFolders();
    expect(store.driveHealth).toEqual({ state: 'connected' });
  });

  it('skips folder checks while applying (ST1.19)', async () => {
    const vault = pullable(vaultOf({ [`${PUB}/58410A1F/000D0000/Z`]: header() }).handle);
    const store = await newStore();
    await store.pick('vault', vault.handle);
    await store.pick('drive', folder({ [`${GOD}/X`]: header() }).handle);
    await store.continue();
    store.requestRemove(at('X'));
    store.confirmPendingRemoval();
    expect(store.phase).toBe('ready');
    const running = store.startApply();
    expect(store.apply).not.toBeNull();
    vault.pull();
    await store.checkFolders();
    expect(store.vaultHealth).toEqual({ state: 'connected' });
    await running;
  });

  it('polls the folders on an interval while ready (ST1.18)', async () => {
    vi.useFakeTimers();
    try {
      const store = new LoadoutStore({ pollMs: 1000, toastMs: 10 });
      const check = vi.spyOn(store, 'checkFolders').mockResolvedValue();
      await store.start(await openSession(memoryTab(), memoryDb(), { fresh: false }));
      await store.pick('vault', vaultOf({ [`${GOD}/A`]: header() }).handle);
      await store.pick('drive', folder().handle);
      await store.continue();
      await vi.advanceTimersByTimeAsync(2500);
      expect(check).toHaveBeenCalledTimes(2);
      await store.reset();
      await vi.advanceTimersByTimeAsync(2500);
      expect(check).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('folder recovery and toasts', () => {
  it('rescans a folder that comes back, dropping changes that no longer apply (ST1.25)', async () => {
    const plain = folder();
    const drive = pullable(plain.handle);
    const store = await newStore();
    await store.pick('vault', vaultOf({ [`${GOD}/A`]: header() }).handle);
    await store.pick('drive', drive.handle);
    await store.continue();
    store.toggleAdd(at('A'));
    drive.pull();
    await store.checkFolders();
    expect(store.applyBlocked).toBe('The drive is disconnected.');
    // Copied there while it was away.
    const fresh = await (
      await (
        await (
          await plain.handle.getDirectoryHandle(PUB, { create: true })
        ).getDirectoryHandle('4D5307E6', { create: true })
      ).getDirectoryHandle('00007000', { create: true })
    ).getFileHandle('A', { create: true });
    const writable = await fresh.createWritable();
    await writable.write(header());
    await writable.close();
    drive.plugIn();
    await store.checkFolders();
    expect(store.driveHealth).toEqual({ state: 'connected' });
    expect(store.driveTitles.map((t) => t.titleId)).toEqual(['4D5307E6']);
    expect(store.queue).toEqual([]);
  });

  it('removes a toast after a while (ST1.26)', async () => {
    vi.useFakeTimers();
    try {
      const store = new LoadoutStore({ pollMs: null, toastMs: 1000 });
      store.toast('Hello');
      expect(store.toasts.map((t) => t.text)).toEqual(['Hello']);
      await vi.advanceTimersByTimeAsync(1000);
      expect(store.toasts).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('reset and reload', () => {
  it('drops the result of a Continue that a reset overtook (ST1.24)', async () => {
    const store = await newStore();
    await store.pick('vault', vaultOf({ [`${GOD}/G`]: header() }).handle);
    await store.pick('drive', folder().handle);
    const running = store.continue();
    await store.reset();
    await running;
    expect(store.phase).toBe('welcome');
    expect(store.vault).toBeNull();
    expect(store.vaultTitles).toEqual([]);
  });

  it('clears all state and the session on reset (ST1.20)', async () => {
    const session = await openSession(memoryTab(), memoryDb(), { fresh: false });
    const { store } = await ready({ [`${GOD}/A`]: header() }, {}, session);
    store.toggleAdd(at('A'));
    await store.reset();
    expect(store.phase).toBe('welcome');
    expect(store.vault).toBeNull();
    expect(store.queue).toEqual([]);
    expect(store.vaultTitles).toEqual([]);
    expect(store.toasts).toEqual([]);
    expect(store.apply).toBeNull();
    expect(store.report).toBeNull();
    expect(await session.load()).toBeNull();
  });

  it('shows Reconnect when a session was saved, else the welcome screen (ST1.21)', async () => {
    const tab = memoryTab();
    const db = memoryDb();
    expect((await newStore(await openSession(tab, db, { fresh: false }))).phase).toBe('welcome');
    const { store } = await ready({ [`${GOD}/A`]: header() }, {}, await openSession(tab, db, { fresh: false }));
    store.toggleAdd(at('A'));
    await vi.waitFor(async () => {
      expect((await (await openSession(tab, db, { fresh: false })).load())?.queue).toHaveLength(1);
    });
    const reloaded = await newStore(await openSession(tab, db, { fresh: false }));
    expect(reloaded.phase).toBe('reconnect');
    expect(reloaded.queue).toHaveLength(1);
    expect(reloaded.vault?.name).toBe('Vault');
  });

  it('reconnects with the saved queue, dropping changes that no longer apply (ST1.22a)', async () => {
    const tab = memoryTab();
    const db = memoryDb();
    const { store, vault, drive } = await ready(
      { [`${GOD}/A`]: header(), [`${GOD}/B`]: header() },
      { [`${GOD}/X`]: header() },
      await openSession(tab, db, { fresh: false }),
    );
    store.toggleAdd(at('A'));
    store.toggleAdd(at('B'));
    store.requestRemove(at('X'));
    store.confirmPendingRemoval();
    await vi.waitFor(async () => {
      expect((await (await openSession(tab, db, { fresh: false })).load())?.queue).toHaveLength(3);
    });
    vault.remove(`${GOD}/B`);
    drive.remove(`${GOD}/X`);
    const reloaded = await newStore(await openSession(tab, db, { fresh: false }));
    await reloaded.reconnect();
    expect(reloaded.phase).toBe('ready');
    expect(reloaded.queue).toEqual([{ op: 'add', location: at('A') }]);
    expect(reloaded.toasts.map((t) => t.text)).toContain('2 queued changes no longer apply, and were dropped.');
  });

  it('stays on Reconnect when a folder is no longer usable (ST1.22)', async () => {
    const tab = memoryTab();
    const db = memoryDb();
    const vault = pullable(vaultOf({ [`${GOD}/A`]: header() }).handle);
    const store = await newStore(await openSession(tab, db, { fresh: false }));
    await store.pick('vault', vault.handle);
    await store.pick('drive', folder().handle);
    await store.continue();
    vault.pull();
    const reloaded = await newStore(await openSession(tab, db, { fresh: false }));
    await reloaded.reconnect();
    expect(reloaded.phase).toBe('reconnect');
    expect(reloaded.vault).toMatchObject({
      status: 'invalid',
      message: "The folder can't be found. Is the drive plugged in?",
    });
  });

  it('rescans the drive, keeping the previous scan if that fails (ST1.23)', async () => {
    const drive = pullable(folder({ [`${GOD}/X`]: header() }).handle);
    const store = await newStore();
    await store.pick('vault', vaultOf({ [`${GOD}/A`]: header() }).handle);
    await store.pick('drive', drive.handle);
    await store.continue();
    drive.pull();
    await store.rescan();
    expect(store.driveTitles).toHaveLength(1);
    expect(store.driveHealth).toMatchObject({ state: 'disconnected' });
  });
});
