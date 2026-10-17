// Tests for the test drive. Where a behaviour copies Chromium's, the test names
// the real-drive probe result it reproduces (design record §2.4: T1, T2, T4).

import { describe, expect, it } from 'vitest';
import { APPLE_DOUBLE_MAGIC } from './junk.js';
import { createTestDrive } from './test-drive.js';
import { DIR } from './tree.js';

async function dir(root: FileSystemDirectoryHandle, ...names: string[]): Promise<FileSystemDirectoryHandle> {
  let handle = root;
  for (const name of names) handle = await handle.getDirectoryHandle(name);
  return handle;
}

async function list(handle: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const [name] of handle.entries()) names.push(name);
  return names;
}

async function readText(handle: FileSystemFileHandle): Promise<string> {
  return (await handle.getFile()).text();
}

describe('createTestDrive', () => {
  it('builds the tree it is given, under a root named Content by default', async () => {
    const drive = createTestDrive({ tree: { 'a/b.bin': 3, 'a/c': DIR } });
    expect(drive.root.name).toBe('Content');
    expect(drive.root.kind).toBe('directory');
    expect(await list(await dir(drive.root, 'a'))).toEqual(['b.bin', 'c']);
    expect(drive.snapshot()).toEqual(['a/', expect.stringMatching(/^a\/b\.bin 3 [0-9a-f]{12}$/), 'a/c/']);
  });

  it('takes another root name', () => {
    expect(createTestDrive({ name: 'Vault' }).root.name).toBe('Vault');
  });

  it('adds entries with write()', () => {
    const drive = createTestDrive();
    drive.write({ 'x/y': 1 });
    expect(drive.snapshot()).toEqual(['x/', expect.stringMatching(/^x\/y 1 /)]);
  });
});

describe('handles', () => {
  it('opens, reads and lists entries', async () => {
    const drive = createTestDrive({ tree: { 'a/file.txt': new TextEncoder().encode('hello') } });
    const a = await dir(drive.root, 'a');
    expect(await readText(await a.getFileHandle('file.txt'))).toBe('hello');
    const handles = [];
    for await (const handle of a.values()) handles.push(handle.kind);
    expect(handles).toEqual(['file']);
    const keys = [];
    for await (const key of a.keys()) keys.push(key);
    expect(keys).toEqual(['file.txt']);
  });

  it('throws NotFoundError for a missing entry, and TypeMismatchError for the wrong kind', async () => {
    const drive = createTestDrive({ tree: { 'a/file': 1 } });
    await expect(drive.root.getDirectoryHandle('missing')).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(drive.root.getFileHandle('a')).rejects.toMatchObject({ name: 'TypeMismatchError' });
    const a = await dir(drive.root, 'a');
    await expect(a.getDirectoryHandle('file')).rejects.toMatchObject({ name: 'TypeMismatchError' });
  });

  it('rejects names the API rejects', async () => {
    const drive = createTestDrive();
    for (const name of ['', '.', '..', 'a/b', 'a\\b']) {
      await expect(drive.root.getFileHandle(name, { create: true })).rejects.toBeInstanceOf(TypeError);
    }
  });

  it('T1: getFileHandle(create) creates an empty file at once', async () => {
    const drive = createTestDrive();
    await drive.root.getFileHandle('Data0000', { create: true });
    expect(drive.snapshot()).toEqual([expect.stringMatching(/^Data0000 0 /)]);
  });

  it('creates directories with getDirectoryHandle(create)', async () => {
    const drive = createTestDrive();
    await drive.root.getDirectoryHandle('new', { create: true });
    expect(drive.snapshot()).toEqual(['new/']);
  });

  it('removes files, empty directories, and full directories only with recursive', async () => {
    const drive = createTestDrive({ tree: { file: 1, empty: DIR, 'full/x': 1 } });
    await drive.root.removeEntry('file');
    await drive.root.removeEntry('empty');
    await expect(drive.root.removeEntry('full')).rejects.toMatchObject({ name: 'InvalidModificationError' });
    await drive.root.removeEntry('full', { recursive: true });
    await expect(drive.root.removeEntry('gone')).rejects.toMatchObject({ name: 'NotFoundError' });
    expect(drive.snapshot()).toEqual([]);
  });

  it('resolves descendants as arrays of names, and others as null', async () => {
    const drive = createTestDrive({ tree: { 'a/b/c': 1, other: DIR } });
    const b = await dir(drive.root, 'a', 'b');
    const c = await b.getFileHandle('c');
    expect(await drive.root.resolve(c)).toEqual(['a', 'b', 'c']);
    expect(await b.resolve(c)).toEqual(['c']);
    expect(await b.resolve(b)).toEqual([]);
    expect(await b.resolve(await dir(drive.root, 'other'))).toBeNull();
    expect(await drive.root.resolve(createTestDrive().root)).toBeNull();
  });

  it('compares entries with isSameEntry', async () => {
    const drive = createTestDrive({ tree: { a: DIR, b: DIR } });
    expect(await (await dir(drive.root, 'a')).isSameEntry(await dir(drive.root, 'a'))).toBe(true);
    expect(await (await dir(drive.root, 'a')).isSameEntry(await dir(drive.root, 'b'))).toBe(false);
    expect(await drive.root.isSameEntry(createTestDrive().root)).toBe(false);
  });
});

describe('case behaviour', () => {
  it('is case-sensitive by default', async () => {
    const drive = createTestDrive({ tree: { '4d5307e6': DIR } });
    await expect(drive.root.getDirectoryHandle('4D5307E6')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('T4: on FAT32, finds entries in any case, but reports the spelling asked for', async () => {
    const drive = createTestDrive({ fat32: true, tree: { '4d5307e6': DIR, pkgname: 1 } });
    const upper = await drive.root.getDirectoryHandle('4D5307E6');
    expect(upper.name).toBe('4D5307E6');
    expect(await drive.root.resolve(upper)).toEqual(['4D5307E6']);
    expect((await drive.root.getFileHandle('PKGNAME')).name).toBe('PKGNAME');
    // Listing shows the spelling on disk.
    expect(await list(drive.root)).toEqual(['4d5307e6', 'pkgname']);
  });

  it('T4: on FAT32, isSameEntry is false for one directory reached by two spellings', async () => {
    const drive = createTestDrive({ fat32: true, tree: { '4d5307e6': DIR } });
    const upper = await drive.root.getDirectoryHandle('4D5307E6');
    const lower = await drive.root.getDirectoryHandle('4d5307e6');
    expect(await upper.isSameEntry(lower)).toBe(false);
  });

  it('T4: on FAT32, create in another case reuses the existing entry', async () => {
    const drive = createTestDrive({ fat32: true, tree: { '4d5307e6': DIR } });
    const handle = await drive.root.getDirectoryHandle('4D5307E6', { create: true });
    expect(handle.name).toBe('4D5307E6');
    expect(drive.snapshot()).toEqual(['4d5307e6/']);
  });

  it('on FAT32, removes an entry named in another case', async () => {
    const drive = createTestDrive({ fat32: true, tree: { abc: 1 } });
    await drive.root.removeEntry('ABC');
    expect(drive.snapshot()).toEqual([]);
  });
});

describe('writing, with Chromium swap files', () => {
  it('T1: writes go to name.crswap, which close() turns into the file', async () => {
    const drive = createTestDrive();
    const file = await drive.root.getFileHandle('Data0000', { create: true });
    const writable = await file.createWritable();
    expect(drive.snapshot()).toEqual([
      expect.stringMatching(/^Data0000 0 /),
      expect.stringMatching(/^Data0000.crswap 0 /),
    ]);
    await writable.write(new Uint8Array(10).fill(1));
    expect(drive.snapshot()).toEqual([
      expect.stringMatching(/^Data0000 0 /),
      expect.stringMatching(/^Data0000.crswap 10 /),
    ]);
    await writable.close();
    expect(drive.snapshot()).toEqual([expect.stringMatching(/^Data0000 10 /)]);
  });

  it('T1: abort() deletes the swap file and leaves the empty target', async () => {
    const drive = createTestDrive();
    const file = await drive.root.getFileHandle('Data0001', { create: true });
    const writable = await file.createWritable();
    await writable.write(new Uint8Array(10));
    await writable.abort();
    expect(drive.snapshot()).toEqual([expect.stringMatching(/^Data0001 0 /)]);
  });

  it('T2: with a stale name.crswap, uses name.1.crswap', async () => {
    const drive = createTestDrive({ tree: { 'Data0000.crswap': 3 } });
    const file = await drive.root.getFileHandle('Data0000', { create: true });
    const writable = await file.createWritable();
    expect(drive.snapshot()).toEqual([
      expect.stringMatching(/^Data0000 0 /),
      expect.stringMatching(/^Data0000.1.crswap 0 /),
      expect.stringMatching(/^Data0000.crswap 3 /),
    ]);
    await writable.close();
    expect(drive.snapshot()).toEqual([
      expect.stringMatching(/^Data0000 0 /),
      expect.stringMatching(/^Data0000.crswap 3 /),
    ]);
  });

  it('accepts a piped stream, as copying a file does', async () => {
    const drive = createTestDrive();
    const file = await drive.root.getFileHandle('copy', { create: true });
    await new File([new Uint8Array(100).fill(7)], 'source').stream().pipeTo(await file.createWritable());
    expect((await file.getFile()).size).toBe(100);
  });
});

describe('permissions', () => {
  it('answers queryPermission per mode, granted by default', async () => {
    const drive = createTestDrive({ permissions: { readwrite: 'prompt' } });
    expect(await drive.root.queryPermission({ mode: 'read' })).toBe('granted');
    expect(await drive.root.queryPermission({ mode: 'readwrite' })).toBe('prompt');
    expect(await drive.root.queryPermission()).toBe('granted');
    drive.setPermission('read', 'denied');
    expect(await drive.root.queryPermission({ mode: 'read' })).toBe('denied');
  });

  it('treats a readwrite grant as covering reads', async () => {
    const drive = createTestDrive({ permissions: { read: 'denied', readwrite: 'granted' } });
    expect(await drive.root.queryPermission({ mode: 'read' })).toBe('granted');
  });

  it('refuses writes without readwrite, and reads without read', async () => {
    const drive = createTestDrive({ tree: { file: 1 }, permissions: { readwrite: 'denied' } });
    await expect(drive.root.getFileHandle('new', { create: true })).rejects.toMatchObject({ name: 'NotAllowedError' });
    await expect(drive.root.removeEntry('file')).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect((await (await drive.root.getFileHandle('file')).getFile()).size).toBe(1);
    drive.setPermission('read', 'prompt');
    await expect(drive.root.getFileHandle('file')).rejects.toMatchObject({ name: 'NotAllowedError' });
  });

  it('counts requestPermission calls', async () => {
    const drive = createTestDrive();
    expect(drive.requestPermissionCalls).toBe(0);
    const handle = drive.root as FileSystemDirectoryHandle & { requestPermission(): Promise<PermissionState> };
    await handle.requestPermission();
    expect(drive.requestPermissionCalls).toBe(1);
  });
});

describe('faults', () => {
  it('throws the injected error on a matching operation, once by default', async () => {
    const drive = createTestDrive({ tree: { a: 1, b: 1 } });
    drive.fail({ operation: 'remove', path: ['b'], error: 'NoModificationAllowedError' });
    await drive.root.removeEntry('a');
    await expect(drive.root.removeEntry('b')).rejects.toMatchObject({ name: 'NoModificationAllowedError' });
    await drive.root.removeEntry('b');
    expect(drive.snapshot()).toEqual([]);
  });

  it('lets `after` operations through first, then fails `times` times', async () => {
    const drive = createTestDrive({ tree: { a: DIR } });
    drive.fail({ operation: 'list', after: 1, times: 2 });
    await list(drive.root);
    await expect(list(drive.root)).rejects.toMatchObject({ name: 'NotReadableError' });
    await expect(list(drive.root)).rejects.toMatchObject({ name: 'NotReadableError' });
    expect(await list(drive.root)).toEqual(['a']);
  });

  it('throws a given DOMException as it is', async () => {
    const drive = createTestDrive({ tree: { a: 1 } });
    const error = new DOMException('Disk full.', 'QuotaExceededError');
    drive.fail({ operation: 'read', error });
    await expect((await drive.root.getFileHandle('a')).getFile()).rejects.toBe(error);
  });

  it('fails each kind of operation: open, create, write, close', async () => {
    const drive = createTestDrive({ tree: { a: 1 } });
    drive.fail({ operation: 'open', path: ['a'] });
    await expect(drive.root.getFileHandle('a')).rejects.toMatchObject({ name: 'NotReadableError' });
    drive.fail({ operation: 'create', path: ['b'] });
    await expect(drive.root.getFileHandle('b', { create: true })).rejects.toMatchObject({ name: 'NotReadableError' });
    const c = await drive.root.getFileHandle('c', { create: true });
    drive.fail({ operation: 'write', path: ['c'], after: 1 });
    const writable = await c.createWritable();
    await expect(writable.write(new Uint8Array(1))).rejects.toMatchObject({ name: 'NotReadableError' });
    const d = await drive.root.getFileHandle('d', { create: true });
    drive.fail({ operation: 'close', path: ['d'] });
    await expect((await d.createWritable()).close()).rejects.toMatchObject({ name: 'NotReadableError' });
  });

  it('abandons a write that fails, deleting its swap file', async () => {
    const drive = createTestDrive();
    const file = await drive.root.getFileHandle('Data0000', { create: true });
    // createWritable() is the first `write`; the first chunk is the second.
    drive.fail({ operation: 'write', after: 1 });
    await expect(
      new File([new Uint8Array(10)], 'source').stream().pipeTo(await file.createWritable()),
    ).rejects.toMatchObject({ name: 'NotReadableError' });
    expect(drive.snapshot()).toEqual([expect.stringMatching(/^Data0000 0 /)]);
  });

  it('a pulled drive fails everything with NotFoundError, and leaves its swap file', async () => {
    const drive = createTestDrive({ tree: { a: 1 } });
    const file = await drive.root.getFileHandle('Data0000', { create: true });
    const writable = await file.createWritable();
    drive.pull();
    await expect(writable.write(new Uint8Array(1))).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(drive.root.getFileHandle('a')).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(list(drive.root)).rejects.toMatchObject({ name: 'NotFoundError' });
    expect(drive.snapshot()).toContainEqual(expect.stringMatching(/^Data0000.crswap /));
  });
});

describe('stream faults', () => {
  it("fails a file's stream part-way, after the data before the fault", async () => {
    const drive = createTestDrive({ tree: { a: new Uint8Array(200_000).fill(1) } });
    drive.fail({ operation: 'stream', path: ['a'], after: 1 });
    const file = await (await drive.root.getFileHandle('a')).getFile();
    const reader = file.stream().getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    await expect(reader.read()).rejects.toMatchObject({ name: 'NotReadableError' });
  });

  it('gives the file in 64 KiB chunks, as Chromium does', async () => {
    const drive = createTestDrive({ tree: { a: new Uint8Array(200_000).fill(1) } });
    const reader = (await (await drive.root.getFileHandle('a')).getFile()).stream().getReader();
    const sizes: number[] = [];
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) sizes.push(chunk.value.length);
    expect(sizes).toEqual([65536, 65536, 65536, 3392]);
  });

  it('reads the whole file without a fault', async () => {
    const drive = createTestDrive({ tree: { a: new Uint8Array(200_000).fill(1) } });
    const file = await (await drive.root.getFileHandle('a')).getFile();
    expect((await new Response(file.stream()).arrayBuffer()).byteLength).toBe(200_000);
  });
});

describe('onOperation', () => {
  it('reports each operation with its path, until stopped', async () => {
    const drive = createTestDrive({ tree: { a: DIR } });
    const events: string[] = [];
    const stop = drive.onOperation(({ operation, path }) => events.push(`${operation} ${path.join('/')}`));
    const a = await drive.root.getDirectoryHandle('a');
    await a.getFileHandle('f', { create: true });
    await list(a);
    stop();
    await list(a);
    expect(events).toEqual(['open a', 'create a/f', 'list a']);
  });
});

describe('macOS AppleDouble files', () => {
  it('are created beside new files and directories', async () => {
    const drive = createTestDrive({ macos: true });
    const dirHandle = await drive.root.getDirectoryHandle('00007000', { create: true });
    await dirHandle.getFileHandle('ABC', { create: true });
    const snapshot = drive.snapshot();
    expect(snapshot).toContainEqual(expect.stringMatching(/^\._00007000 4096 /));
    expect(snapshot).toContainEqual(expect.stringMatching(/^00007000\/\._ABC 4096 /));
    const bytes = drive.fs.readFileSync(`${drive.base}/00007000/._ABC`) as Uint8Array;
    expect(new Uint8Array(bytes.subarray(0, 4))).toEqual(APPLE_DOUBLE_MAGIC);
  });

  it('are removed with their entry', async () => {
    const drive = createTestDrive({ macos: true });
    await drive.root.getFileHandle('ABC', { create: true });
    await drive.root.removeEntry('ABC');
    expect(drive.snapshot()).toEqual([]);
  });

  it('are not created without the option', async () => {
    const drive = createTestDrive();
    await drive.root.getFileHandle('ABC', { create: true });
    expect(drive.snapshot()).toEqual([expect.stringMatching(/^ABC 0 /)]);
  });
});
