// Tests for root.locatePackage.
// Function design doc, L1 `root.locatePackage`: statements L1.1-L1.11.

import { describe, expect, it } from 'vitest';
import { appleDouble, fakeAppleDouble, swapFile } from './helpers/junk.js';
import { DEFAULT_AT, dataOnly, locationOf, packagePath, stfsPackage, svodPackage } from './helpers/packages.js';
import { createTestDrive, type TestDrive, type TestDriveOptions } from './helpers/test-drive.js';
import { DIR } from './helpers/tree.js';
import { openContentRoot } from '../open-content-root.js';
import type { ContentRoot } from '../types.js';

const CT_PATH = [DEFAULT_AT.partition, DEFAULT_AT.titleId, DEFAULT_AT.contentType];

async function setup(options: TestDriveOptions): Promise<{ drive: TestDrive; root: ContentRoot }> {
  const drive = createTestDrive(options);
  const [ok, root] = await openContentRoot(drive.root);
  if (!ok) throw new Error(`setup: ${JSON.stringify(root)}`);
  return { drive, root };
}

/** Gets a handle by walking `names` down from the drive's root, as a page would. */
async function handleAt(drive: TestDrive, names: string[], kind: 'file' | 'directory'): Promise<FileSystemHandle> {
  let dir = drive.root;
  for (const name of names.slice(0, -1)) dir = await dir.getDirectoryHandle(name);
  const last = names.at(-1);
  if (last === undefined) return dir;
  return kind === 'file' ? dir.getFileHandle(last) : dir.getDirectoryHandle(last);
}

describe('root.locatePackage', () => {
  describe('which handles', () => {
    it('L1.1: a handle from outside the root gives not-in-root', async () => {
      const { root } = await setup({ tree: stfsPackage('ABC') });
      const other = createTestDrive({ tree: stfsPackage('ABC') });
      const handle = await handleAt(other, [...CT_PATH, 'ABC'], 'file');
      expect(await root.locatePackage(handle)).toEqual([false, [{ kind: 'not-in-root' }]]);
    });

    it.each([
      [[], 'directory'],
      [['0000000000000000'], 'directory'],
      [['0000000000000000', '4D5307E6'], 'directory'],
      [CT_PATH, 'directory'],
      [[...CT_PATH, 'ABC.data', 'Data0000'], 'file'],
      [[...CT_PATH, 'ABC.data', 'sub', 'file'], 'file'],
    ] as const)('L1.2: a handle at %j gives not-a-package-path', async (names, kind) => {
      const { drive, root } = await setup({ tree: { ...svodPackage('ABC'), [packagePath('ABC.data/sub/file')]: 1 } });
      const handle = await handleAt(drive, [...names], kind);
      expect(await root.locatePackage(handle)).toEqual([false, [{ kind: 'not-a-package-path', path: [...names] }]]);
    });

    it("L1.3.1: a header file gives its package's location", async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      const handle = await handleAt(drive, [...CT_PATH, 'ABC'], 'file');
      expect(await root.locatePackage(handle)).toEqual([true, locationOf('ABC')]);
    });

    it('L1.3.1: a file named X.data is a header named X.data', async () => {
      const { drive, root } = await setup({ tree: stfsPackage('X.data') });
      const handle = await handleAt(drive, [...CT_PATH, 'X.data'], 'file');
      expect(await root.locatePackage(handle)).toEqual([true, locationOf('X.data')]);
    });

    it("L1.3.2: a data directory gives its package's location", async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      const handle = await handleAt(drive, [...CT_PATH, 'ABC.data'], 'directory');
      expect(await root.locatePackage(handle)).toEqual([true, locationOf('ABC')]);
    });

    it('L1.3.2, L1.10: an orphan data directory still gives a location', async () => {
      const { drive, root } = await setup({ tree: dataOnly('ABC') });
      const handle = await handleAt(drive, [...CT_PATH, 'ABC.data'], 'directory');
      expect(await root.locatePackage(handle)).toEqual([true, locationOf('ABC')]);
    });

    it('L1.3.1: works for a profile partition', async () => {
      const at = { partition: 'E812CECF9EA2AF5F', titleId: '584E07D2', contentType: '000E0000' };
      const { drive, root } = await setup({ tree: stfsPackage('save', { at }) });
      const handle = await handleAt(drive, ['E812CECF9EA2AF5F', '584E07D2', '000E0000', 'save'], 'file');
      expect(await root.locatePackage(handle)).toEqual([true, locationOf('save', at)]);
    });

    it.each(['ABC', 'ABC.DATA', 'BACKUP'])(
      'L1.4: another directory at depth 4, %j, gives not-a-package-path',
      async (name) => {
        const { drive, root } = await setup({ tree: { [packagePath(name)]: DIR } });
        const handle = await handleAt(drive, [...CT_PATH, name], 'directory');
        expect(await root.locatePackage(handle)).toEqual([
          false,
          [{ kind: 'not-a-package-path', path: [...CT_PATH, name] }],
        ]);
      },
    );
  });

  describe('checks', () => {
    it('L1.5: needs read permission', async () => {
      const { drive, root } = await setup({ tree: stfsPackage('ABC') });
      const handle = await handleAt(drive, [...CT_PATH, 'ABC'], 'file');
      drive.setPermission('read', 'denied');
      drive.setPermission('readwrite', 'denied');
      expect(await root.locatePackage(handle)).toEqual([
        false,
        [{ kind: 'permission-denied', mode: 'read', state: 'denied' }],
      ]);
    });

    it('L1.6: the directory names must pass the location checks, all reported together', async () => {
      const { drive, root } = await setup({ tree: { 'Partition/4d5307e6/7000/ABC': 1 } });
      const handle = await handleAt(drive, ['Partition', '4d5307e6', '7000', 'ABC'], 'file');
      const [ok, reasons] = await root.locatePackage(handle);
      expect(ok).toBe(false);
      expect(reasons).toEqual(
        expect.arrayContaining([
          { kind: 'invalid-location', field: 'partition', value: 'Partition' },
          { kind: 'invalid-location', field: 'titleId', value: '4d5307e6' },
          { kind: 'invalid-location', field: 'contentType', value: '7000' },
        ]),
      );
      expect(reasons).toHaveLength(3);
    });

    it('L1.7: a handle obtained with another spelling gives wrong-case (FAT32)', async () => {
      const { drive, root } = await setup({ fat32: true, tree: stfsPackage('abc') });
      // On FAT32, getFileHandle('ABC') finds `abc`, and resolve() repeats `ABC`.
      const handle = await handleAt(drive, [...CT_PATH, 'ABC'], 'file');
      expect(await root.locatePackage(handle)).toEqual([
        false,
        [{ kind: 'wrong-case', path: [...CT_PATH, 'ABC'], found: 'abc' }],
      ]);
    });

    it('L1.7: a directory obtained with another spelling gives wrong-case (FAT32)', async () => {
      const { drive, root } = await setup({
        fat32: true,
        tree: { 'e812cecf9ea2af5f/584E07D2/000E0000/save': 1 },
      });
      const handle = await handleAt(drive, ['E812CECF9EA2AF5F', '584E07D2', '000E0000', 'save'], 'file');
      expect(await root.locatePackage(handle)).toEqual([
        false,
        [{ kind: 'wrong-case', path: ['E812CECF9EA2AF5F'], found: 'e812cecf9ea2af5f' }],
      ]);
    });

    it('L1.8: a header and data directory differing in case give wrong-case, from either handle', async () => {
      const { drive, root } = await setup({ tree: { ...stfsPackage('abc'), ...dataOnly('ABC') } });
      const header = await handleAt(drive, [...CT_PATH, 'abc'], 'file');
      expect(await root.locatePackage(header)).toEqual([
        false,
        [{ kind: 'wrong-case', path: [...CT_PATH, 'abc.data'], found: 'ABC.data' }],
      ]);
      const data = await handleAt(drive, [...CT_PATH, 'ABC.data'], 'directory');
      expect(await root.locatePackage(data)).toEqual([
        false,
        [{ kind: 'wrong-case', path: [...CT_PATH, 'ABC'], found: 'abc' }],
      ]);
    });

    it.each([
      ['._ABC', appleDouble()],
      ['._ABC.data', appleDouble()],
      ['ABC.crswap', swapFile()],
      ['ABC.1.crswap', swapFile()],
      ['XYZ.crswap', swapFile()],
    ])('L1.9: a junk file, %j, gives junk', async (name, bytes) => {
      const { drive, root } = await setup({ tree: { ...stfsPackage('ABC'), [packagePath(name)]: bytes } });
      const handle = await handleAt(drive, [...CT_PATH, name], 'file');
      expect(await root.locatePackage(handle)).toEqual([false, [{ kind: 'junk', path: [...CT_PATH, name] }]]);
    });

    it('L1.9: a file named like an AppleDouble file but without its magic is a header', async () => {
      const { drive, root } = await setup({ tree: { [packagePath('._ABC')]: fakeAppleDouble() } });
      const handle = await handleAt(drive, [...CT_PATH, '._ABC'], 'file');
      expect(await root.locatePackage(handle)).toEqual([true, locationOf('._ABC')]);
    });

    it('L1.10: never reads the header', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      const handle = await handleAt(drive, [...CT_PATH, 'ABC'], 'file');
      const operations: string[] = [];
      drive.onOperation(({ operation }) => operations.push(operation));
      await root.locatePackage(handle);
      expect(operations).not.toContain('read');
    });

    it('an entry removed since its handle was obtained gives not-found', async () => {
      const { drive, root } = await setup({ tree: stfsPackage('ABC') });
      const handle = await handleAt(drive, [...CT_PATH, 'ABC'], 'file');
      drive.fs.unlinkSync(`${drive.base}/${packagePath('ABC')}`);
      expect(await root.locatePackage(handle)).toEqual([false, [{ kind: 'not-found', path: [...CT_PATH, 'ABC'] }]]);
    });

    it('a header replaced by a directory gives unexpected-entry-type', async () => {
      const { drive, root } = await setup({ tree: stfsPackage('ABC') });
      const handle = await handleAt(drive, [...CT_PATH, 'ABC'], 'file');
      drive.fs.unlinkSync(`${drive.base}/${packagePath('ABC')}`);
      drive.fs.mkdirSync(`${drive.base}/${packagePath('ABC')}`);
      expect(await root.locatePackage(handle)).toEqual([
        false,
        [{ kind: 'unexpected-entry-type', path: [...CT_PATH, 'ABC'], expected: 'file' }],
      ]);
    });

    it('rule 12: a listing that fails gives io-error', async () => {
      const { drive, root } = await setup({ tree: stfsPackage('ABC') });
      const handle = await handleAt(drive, [...CT_PATH, 'ABC'], 'file');
      drive.fail({ operation: 'list', path: CT_PATH, error: 'NotReadableError' });
      expect(await root.locatePackage(handle)).toMatchObject([
        false,
        [{ kind: 'io-error', operation: 'list', path: CT_PATH, error: { name: 'NotReadableError' } }],
      ]);
    });

    it('rule 12: a magic check that fails to read gives io-error', async () => {
      const { drive, root } = await setup({ tree: { [packagePath('._ABC')]: appleDouble() } });
      const handle = await handleAt(drive, [...CT_PATH, '._ABC'], 'file');
      drive.fail({ operation: 'read' });
      expect(await root.locatePackage(handle)).toMatchObject([
        false,
        [{ kind: 'io-error', operation: 'read', path: [...CT_PATH, '._ABC'] }],
      ]);
    });

    it('returns a new location each time, unrelated to the handle', async () => {
      const { drive, root } = await setup({ tree: stfsPackage('ABC') });
      const handle = await handleAt(drive, [...CT_PATH, 'ABC'], 'file');
      const [, first] = await root.locatePackage(handle);
      const [, second] = await root.locatePackage(handle);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });

    // L1.11 (no signal and no onProgress) is a property of the signature, which
    // the type checker enforces; there's nothing to observe at run time.
  });
});
