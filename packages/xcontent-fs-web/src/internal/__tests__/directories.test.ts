// Tests for listing directories, exact-case lookup, walking a location's
// directories, and inspecting a package's entries.
// Function design doc: package-wide rules 8 and 12; C1.14 and C1.17 (target
// lookups); D1.5-D1.8, D1.10, D1.11 and H1.3-H1.5 (what inspection reports).

import { describe, expect, it } from 'vitest';
import { appleDouble, fakeAppleDouble, swapFile } from '../../__tests__/helpers/junk.js';
import {
  DEFAULT_AT,
  contentTypePath,
  dataOnly,
  headerOnly,
  locationOf,
  packagePath,
  stfsPackage,
  svodPackage,
} from '../../__tests__/helpers/packages.js';
import { createTestDrive } from '../../__tests__/helpers/test-drive.js';
import { DIR } from '../../__tests__/helpers/tree.js';
import { inspectPackage } from '../inspect.js';
import { findIgnoringCase, listDirectory, lookupExact } from '../lookup.js';
import { openContentTypeDirectory, openLocationDirectories } from '../walk.js';

const CT_PATH = [DEFAULT_AT.partition, DEFAULT_AT.titleId, DEFAULT_AT.contentType];

async function contentTypeDir(drive: ReturnType<typeof createTestDrive>): Promise<FileSystemDirectoryHandle> {
  const [ok, dir] = await openContentTypeDirectory(drive.root, locationOf('ABC'));
  if (!ok) throw new Error(`setup: ${JSON.stringify(dir)}`);
  return dir;
}

describe('listDirectory and lookups', () => {
  it('lists every entry by its name on disk', async () => {
    const drive = createTestDrive({ tree: { a: 1, B: DIR } });
    const [ok, listing] = await listDirectory(drive.root, []);
    expect(ok).toBe(true);
    if (!ok) return;
    expect([...listing.keys()]).toEqual(['B', 'a']);
    expect(listing.get('B')?.kind).toBe('directory');
  });

  it("rule 12: a listing that fails gives io-error with the directory's path", async () => {
    const drive = createTestDrive({ tree: { a: DIR } });
    drive.fail({ operation: 'list', error: 'NotReadableError' });
    expect(await listDirectory(drive.root, ['x'])).toMatchObject([
      false,
      [{ kind: 'io-error', operation: 'list', path: ['x'], error: { name: 'NotReadableError' } }],
    ]);
  });

  it('rule 8: finds an entry by its exact name', async () => {
    const drive = createTestDrive({ fat32: true, tree: { ABC: 1 } });
    const [, listing] = await listDirectory(drive.root, []);
    if (!(listing instanceof Map)) throw new Error('setup');
    const [ok, handle] = lookupExact(listing, 'ABC', []);
    expect(ok).toBe(true);
    expect(handle).toMatchObject({ kind: 'file', name: 'ABC' });
  });

  it('rule 8: reports wrong-case for an entry that exists only in another case, even on FAT32', async () => {
    const drive = createTestDrive({ fat32: true, tree: { abc: 1 } });
    const [, listing] = await listDirectory(drive.root, ['dir']);
    if (!(listing instanceof Map)) throw new Error('setup');
    expect(lookupExact(listing, 'ABC', ['dir'])).toEqual([
      false,
      [{ kind: 'wrong-case', path: ['dir', 'ABC'], found: 'abc' }],
    ]);
  });

  it('rule 8: prefers the exact name when both cases exist (a case-sensitive drive)', async () => {
    const drive = createTestDrive({ tree: { abc: 1, ABC: 2 } });
    const [, listing] = await listDirectory(drive.root, []);
    if (!(listing instanceof Map)) throw new Error('setup');
    expect(lookupExact(listing, 'ABC', [])[0]).toBe(true);
  });

  it('gives undefined for an entry missing in every case', async () => {
    const drive = createTestDrive();
    const [, listing] = await listDirectory(drive.root, []);
    if (!(listing instanceof Map)) throw new Error('setup');
    expect(lookupExact(listing, 'ABC', [])).toEqual([true, undefined]);
  });

  it('C1.14: findIgnoringCase finds an entry in any case, preferring the exact name', async () => {
    const drive = createTestDrive({ tree: { abc: 1, 'ABC.data': DIR, 'abc.data': DIR } });
    const [, listing] = await listDirectory(drive.root, []);
    if (!(listing instanceof Map)) throw new Error('setup');
    expect(findIgnoringCase(listing, 'ABC')).toBe('abc');
    expect(findIgnoringCase(listing, 'ABC.data')).toBe('ABC.data');
    expect(findIgnoringCase(listing, 'XYZ')).toBeUndefined();
  });
});

describe('openContentTypeDirectory', () => {
  it('opens the content-type directory of a location', async () => {
    const drive = createTestDrive({ tree: stfsPackage('ABC') });
    const [ok, dir] = await openContentTypeDirectory(drive.root, locationOf('ABC'));
    expect(ok).toBe(true);
    expect(dir).toMatchObject({ kind: 'directory', name: '00007000' });
  });

  it('gives not-found with the path down to the first missing directory', async () => {
    const drive = createTestDrive({ tree: { '0000000000000000': DIR } });
    expect(await openContentTypeDirectory(drive.root, locationOf('ABC'))).toEqual([
      false,
      [{ kind: 'not-found', path: ['0000000000000000', '4D5307E6'] }],
    ]);
  });

  it('rule 8: gives wrong-case for a directory in another case, on FAT32 too', async () => {
    const drive = createTestDrive({ fat32: true, tree: { '0000000000000000/4d5307e6/00007000': DIR } });
    expect(await openContentTypeDirectory(drive.root, locationOf('ABC'))).toEqual([
      false,
      [{ kind: 'wrong-case', path: ['0000000000000000', '4D5307E6'], found: '4d5307e6' }],
    ]);
  });

  it('gives unexpected-entry-type for a file where a directory belongs', async () => {
    const drive = createTestDrive({ tree: { '0000000000000000/4D5307E6': 1 } });
    expect(await openContentTypeDirectory(drive.root, locationOf('ABC'))).toEqual([
      false,
      [{ kind: 'unexpected-entry-type', path: ['0000000000000000', '4D5307E6'], expected: 'directory' }],
    ]);
  });

  it("C1.17: with create, makes missing directories in the location's spelling", async () => {
    const drive = createTestDrive({ tree: { '0000000000000000': DIR } });
    const [ok] = await openContentTypeDirectory(drive.root, locationOf('ABC'), { create: true });
    expect(ok).toBe(true);
    expect(drive.snapshot()).toEqual(['0000000000000000/', '0000000000000000/4D5307E6/', `${contentTypePath()}/`]);
  });

  it('C1.13: with create, still refuses an existing directory in another case', async () => {
    const drive = createTestDrive({ fat32: true, tree: { '0000000000000000/4d5307e6': DIR } });
    const [ok, reasons] = await openContentTypeDirectory(drive.root, locationOf('ABC'), { create: true });
    expect(ok).toBe(false);
    expect(reasons).toEqual([{ kind: 'wrong-case', path: ['0000000000000000', '4D5307E6'], found: '4d5307e6' }]);
    expect(drive.snapshot()).toEqual(['0000000000000000/', '0000000000000000/4d5307e6/']);
  });

  it('rule 12: an error while creating gives a reason for the directory being created', async () => {
    const drive = createTestDrive();
    drive.fail({ operation: 'create', path: ['0000000000000000'], error: 'QuotaExceededError' });
    expect(await openContentTypeDirectory(drive.root, locationOf('ABC'), { create: true })).toMatchObject([
      false,
      [{ kind: 'io-error', operation: 'create', path: ['0000000000000000'], error: { name: 'QuotaExceededError' } }],
    ]);
  });
});

describe('inspectPackage', () => {
  it('finds an STFS package: a header, no data directory', async () => {
    const drive = createTestDrive({ tree: stfsPackage('ABC') });
    const [ok, entries] = await inspectPackage(await contentTypeDir(drive), CT_PATH, 'ABC');
    expect(ok).toBe(true);
    if (!ok) return;
    expect(entries.header?.name).toBe('ABC');
    expect(entries.dataDirectory).toBeUndefined();
    expect(entries.dataFiles).toEqual([]);
  });

  it('finds an SVOD package, with its data files in ascending order, gaps and all', async () => {
    const drive = createTestDrive({ tree: svodPackage('ABC', { dataFiles: [3, 0, 10, 1] }) });
    const [ok, entries] = await inspectPackage(await contentTypeDir(drive), CT_PATH, 'ABC', { dataContents: true });
    expect(ok).toBe(true);
    if (!ok) return;
    expect(entries.dataDirectory?.name).toBe('ABC.data');
    expect(entries.dataFiles.map(({ name, index }) => [name, index])).toEqual([
      ['Data0000', 0],
      ['Data0001', 1],
      ['Data0003', 3],
      ['Data0010', 10],
    ]);
  });

  it('finds orphans: a header alone, a data directory alone, or nothing', async () => {
    const drive = createTestDrive({
      tree: { ...headerOnly('HEADER'), ...dataOnly('DATA'), [contentTypePath()]: DIR },
    });
    const dir = await contentTypeDir(drive);
    const [, header] = await inspectPackage(dir, CT_PATH, 'HEADER');
    expect(header).toMatchObject({ dataDirectory: undefined });
    const [, data] = await inspectPackage(dir, CT_PATH, 'DATA');
    expect(data).toMatchObject({ header: undefined, dataDirectory: { name: 'DATA.data' } });
    const [, none] = await inspectPackage(dir, CT_PATH, 'NONE');
    expect(none).toMatchObject({ header: undefined, dataDirectory: undefined });
  });

  it('H1.8: leaves name.data/ unread unless asked', async () => {
    const drive = createTestDrive({ tree: svodPackage('ABC') });
    const dir = await contentTypeDir(drive);
    drive.fail({ operation: 'list', path: [...CT_PATH, 'ABC.data'] });
    const [ok, entries] = await inspectPackage(dir, CT_PATH, 'ABC');
    expect(ok).toBe(true);
    expect(entries).toMatchObject({ dataFiles: [] });
  });

  it('D1.7: gives wrong-case for a header or data directory in another case', async () => {
    const drive = createTestDrive({ fat32: true, tree: { ...stfsPackage('abc'), ...dataOnly('XYZ') } });
    const dir = await contentTypeDir(drive);
    expect(await inspectPackage(dir, CT_PATH, 'ABC')).toEqual([
      false,
      [{ kind: 'wrong-case', path: [...CT_PATH, 'ABC'], found: 'abc' }],
    ]);
    expect(await inspectPackage(dir, CT_PATH, 'xyz')).toEqual([
      false,
      [{ kind: 'wrong-case', path: [...CT_PATH, 'xyz.data'], found: 'XYZ.data' }],
    ]);
  });

  it('D1.8, H1.5: gives unexpected-entry-type for a header that is a directory, or a data directory that is a file', async () => {
    const drive = createTestDrive({ tree: { [packagePath('ABC')]: DIR, [packagePath('XYZ.data')]: 1 } });
    const dir = await contentTypeDir(drive);
    expect(await inspectPackage(dir, CT_PATH, 'ABC')).toEqual([
      false,
      [{ kind: 'unexpected-entry-type', path: [...CT_PATH, 'ABC'], expected: 'file' }],
    ]);
    expect(await inspectPackage(dir, CT_PATH, 'XYZ')).toEqual([
      false,
      [{ kind: 'unexpected-entry-type', path: [...CT_PATH, 'XYZ.data'], expected: 'directory' }],
    ]);
  });

  it("D1.10: reports every entry in name.data/ that isn't a data file, including directories", async () => {
    const data = packagePath('ABC.data');
    const drive = createTestDrive({
      tree: {
        ...svodPackage('ABC', { dataFiles: 2 }),
        [`${data}/Data0001.crswap`]: swapFile(),
        [`${data}/._Data0000`]: appleDouble(),
        [`${data}/sub/file`]: 1,
      },
    });
    const [ok, entries] = await inspectPackage(await contentTypeDir(drive), CT_PATH, 'ABC', { dataContents: true });
    expect(ok).toBe(true);
    if (!ok) return;
    expect(entries.dataFiles.map(({ name }) => name)).toEqual(['Data0000', 'Data0001']);
    expect(entries.dataJunk).toEqual(['._Data0000', 'Data0001.crswap', 'sub']);
  });

  it("D1.11: with besideHeaderJunk, reports the package's own swap and AppleDouble files only", async () => {
    const ct = contentTypePath();
    const drive = createTestDrive({
      tree: {
        ...svodPackage('ABC'),
        ...stfsPackage('ABCD'),
        ...stfsPackage('ABC.1'),
        [`${ct}/ABC.crswap`]: swapFile(),
        [`${ct}/ABC.1.crswap`]: swapFile(),
        [`${ct}/ABC.2.crswap`]: swapFile(),
        [`${ct}/._ABC`]: appleDouble(),
        [`${ct}/._ABC.data`]: fakeAppleDouble(),
        [`${ct}/._ABCD`]: appleDouble(),
        [`${ct}/ABCD.crswap`]: swapFile(),
      },
    });
    const [ok, entries] = await inspectPackage(await contentTypeDir(drive), CT_PATH, 'ABC', { besideHeaderJunk: true });
    expect(ok).toBe(true);
    if (!ok) return;
    expect(entries.junkBesideHeader).toEqual(['._ABC', 'ABC.2.crswap', 'ABC.crswap']);
  });

  it('rule 12: a magic check that fails to read gives io-error', async () => {
    const drive = createTestDrive({ tree: { ...stfsPackage('ABC'), [`${contentTypePath()}/._ABC`]: appleDouble() } });
    const dir = await contentTypeDir(drive);
    drive.fail({ operation: 'read', path: [...CT_PATH, '._ABC'] });
    const [ok, reasons] = await inspectPackage(dir, CT_PATH, 'ABC', { besideHeaderJunk: true });
    expect(ok).toBe(false);
    expect(reasons).toEqual([
      expect.objectContaining({ kind: 'io-error', operation: 'read', path: [...CT_PATH, '._ABC'] }),
    ]);
  });
});

describe('openLocationDirectories', () => {
  it('J1.17: opens every directory on the path, from the partition down', async () => {
    const drive = createTestDrive({ tree: stfsPackage('ABC') });
    const [ok, dirs] = await openLocationDirectories(drive.root, locationOf('ABC'));
    expect(ok).toBe(true);
    if (!ok) return;
    expect(dirs.map((dir) => dir.name)).toEqual(['0000000000000000', '4D5307E6', '00007000']);
  });

  it('rule 8: fails as openContentTypeDirectory does', async () => {
    const drive = createTestDrive({ fat32: true, tree: { '0000000000000000/4d5307e6/00007000': DIR } });
    expect(await openLocationDirectories(drive.root, locationOf('ABC'))).toEqual([
      false,
      [{ kind: 'wrong-case', path: ['0000000000000000', '4D5307E6'], found: '4d5307e6' }],
    ]);
  });
});
