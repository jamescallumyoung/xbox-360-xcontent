// Tests for root.deletePackage.
// Function design doc, D1 `root.deletePackage`: statements D1.1-D1.20.

import { describe, expect, it } from 'vitest';
import { abortAfterCalls, abortOnOperation } from './helpers/abort.js';
import { recordCalls, stubReportError } from './helpers/callbacks.js';
import { appleDouble, fakeAppleDouble, swapFile } from './helpers/junk.js';
import {
  DEFAULT_AT,
  contentTypePath,
  dataOnly,
  headerOnly,
  locationOf,
  packagePath,
  stfsPackage,
  svodPackage,
} from './helpers/packages.js';
import { createTestDrive, type TestDrive, type TestDriveOptions } from './helpers/test-drive.js';
import { DIR } from './helpers/tree.js';
import { clean } from '../clean.js';
import type { DeleteProgress } from '../delete-package.js';
import { openContentRoot } from '../open-content-root.js';
import type { ContentRoot } from '../types.js';

const CT = contentTypePath();
const CT_PATH = [DEFAULT_AT.partition, DEFAULT_AT.titleId, DEFAULT_AT.contentType];

async function setup(options: TestDriveOptions): Promise<{ drive: TestDrive; root: ContentRoot }> {
  const drive = createTestDrive(options);
  const [ok, root] = await openContentRoot(drive.root, { mode: 'readwrite' });
  if (!ok) throw new Error(`setup: ${JSON.stringify(root)}`);
  return { drive, root };
}

/** The snapshot lines under the content-type directory, without its own line. */
function inContentType(drive: TestDrive): string[] {
  return drive.snapshot().filter((line) => line.startsWith(`${CT}/`) && line !== `${CT}/`);
}

/** Records the order of removals. */
function removals(drive: TestDrive): string[] {
  const removed: string[] = [];
  drive.onOperation(({ operation, path }) => {
    if (operation === 'remove') removed.push(path.slice(3).join('/'));
  });
  return removed;
}

describe('root.deletePackage', () => {
  describe('input', () => {
    it('D1.1: an already-aborted signal gives `aborted` before anything is touched', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      const before = drive.snapshot();
      const operations: string[] = [];
      drive.onOperation(({ operation }) => operations.push(operation));
      const controller = new AbortController();
      controller.abort('stop');
      expect(await root.deletePackage(locationOf(''), { signal: controller.signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(operations).toEqual([]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('D1.2: checks the location, reporting every invalid field', async () => {
      const { root } = await setup({ tree: svodPackage('ABC') });
      const [ok, reasons] = await root.deletePackage({ ...locationOf('a\\b'), partition: '0' });
      expect(ok).toBe(false);
      expect(reasons).toEqual(
        expect.arrayContaining([
          { kind: 'invalid-location', field: 'partition', value: '0' },
          { kind: 'invalid-location', field: 'packageName', value: 'a\\b' },
        ]),
      );
      expect(reasons).toHaveLength(2);
    });

    it("rule 6: changing the caller's location during the delete has no effect", async () => {
      const { drive, root } = await setup({ tree: { ...svodPackage('ABC'), ...svodPackage('XYZ') } });
      const location = locationOf('ABC');
      drive.onOperation(() => {
        location.packageName = 'XYZ';
      });
      expect(await root.deletePackage(location)).toEqual([true]);
      expect(inContentType(drive).some((line) => line.includes('/XYZ'))).toBe(true);
      expect(inContentType(drive).some((line) => line.includes('/ABC'))).toBe(false);
    });

    it("D1.2: a name FATX wouldn't allow can still be deleted, if it exists", async () => {
      const name = `${'x'.repeat(60)}*?`;
      const { drive, root } = await setup({ tree: stfsPackage(name) });
      expect(await root.deletePackage(locationOf(name))).toEqual([true]);
      expect(inContentType(drive)).toEqual([]);
    });

    it('D1.3: needs readwrite permission, even on a root opened for reading', async () => {
      const drive = createTestDrive({ tree: svodPackage('ABC'), permissions: { readwrite: 'prompt' } });
      const [, root] = await openContentRoot(drive.root);
      if (!('handle' in root)) throw new Error('setup');
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'permission-denied', mode: 'readwrite', state: 'prompt' }],
      ]);
    });

    it('D1.4: a missing directory gives not-found', async () => {
      const { root } = await setup({ tree: { '0000000000000000': DIR } });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'not-found', path: ['0000000000000000', '4D5307E6'] }],
      ]);
    });

    it('D1.4: a directory in another case gives wrong-case, on FAT32 too', async () => {
      const { drive, root } = await setup({ fat32: true, tree: { '0000000000000000/4d5307e6/00007000/ABC': 1 } });
      const before = drive.snapshot();
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: ['0000000000000000', '4D5307E6'], found: '4d5307e6' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });
  });

  describe('what it deletes', () => {
    it('D1.5: deletes an STFS package', async () => {
      const { drive, root } = await setup({ tree: { ...stfsPackage('ABC'), ...stfsPackage('XYZ') } });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive)).toEqual([expect.stringMatching(new RegExp(`^${CT}/XYZ `))]);
    });

    it('D1.5: deletes an SVOD package: the header, every data file, and the data directory', async () => {
      const { drive, root } = await setup({ tree: { ...svodPackage('ABC', { dataFiles: 3 }), ...stfsPackage('XYZ') } });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive)).toEqual([expect.stringMatching(new RegExp(`^${CT}/XYZ `))]);
    });

    it('D1.5: deletes an orphan header', async () => {
      const { drive, root } = await setup({ tree: headerOnly('ABC') });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive)).toEqual([]);
    });

    it('D1.5: deletes an orphan data directory', async () => {
      const { drive, root } = await setup({ tree: dataOnly('ABC') });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive)).toEqual([]);
    });

    it('D1.5: deletes an empty data directory', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC', { dataFiles: 0 }) });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive)).toEqual([]);
    });

    it('D1.6: neither a header nor a data directory gives not-found', async () => {
      const { root } = await setup({ tree: { [CT]: DIR } });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'not-found', path: [...CT_PATH, 'ABC'] }],
      ]);
    });

    it('D1.7: a header in another case gives wrong-case, and nothing is deleted', async () => {
      const { drive, root } = await setup({ fat32: true, tree: stfsPackage('abc') });
      const before = drive.snapshot();
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: [...CT_PATH, 'ABC'], found: 'abc' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('D1.7: a data directory in another case gives wrong-case, and nothing is deleted', async () => {
      const { drive, root } = await setup({ tree: { ...headerOnly('ABC'), ...dataOnly('abc') } });
      const before = drive.snapshot();
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: [...CT_PATH, 'ABC.data'], found: 'abc.data' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('D1.8: a header that is a directory gives unexpected-entry-type, and nothing is deleted', async () => {
      const { drive, root } = await setup({ tree: { [packagePath('ABC/x')]: 1, ...dataOnly('ABC') } });
      const before = drive.snapshot();
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'unexpected-entry-type', path: [...CT_PATH, 'ABC'], expected: 'file' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('D1.8: a name.data that is a file gives unexpected-entry-type, and nothing is deleted', async () => {
      const { drive, root } = await setup({ tree: { ...stfsPackage('ABC'), ...stfsPackage('ABC.data') } });
      const before = drive.snapshot();
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'unexpected-entry-type', path: [...CT_PATH, 'ABC.data'], expected: 'directory' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it("D1.9: never reads the header: an empty one, or a file that isn't a package, is deleted", async () => {
      const { drive, root } = await setup({
        tree: { [packagePath('ABC')]: new Uint8Array(), ...stfsPackage('notes.txt') },
      });
      const operations: string[] = [];
      drive.onOperation(({ operation }) => operations.push(operation));
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(await root.deletePackage(locationOf('notes.txt'))).toEqual([true]);
      expect(operations).not.toContain('read');
      expect(inContentType(drive)).toEqual([]);
    });
  });

  describe('it assumes the package is clean', () => {
    it('D1.10: junk in name.data/ fails, one reason per entry, and nothing is deleted', async () => {
      const data = packagePath('ABC.data');
      const { drive, root } = await setup({
        tree: {
          ...svodPackage('ABC', { dataFiles: 2 }),
          [`${data}/Data0001.crswap`]: swapFile(),
          [`${data}/._Data0000`]: fakeAppleDouble(),
          [`${data}/sub`]: DIR,
        },
      });
      const before = drive.snapshot();
      const [ok, reasons] = await root.deletePackage(locationOf('ABC'));
      expect(ok).toBe(false);
      expect(reasons).toEqual(
        expect.arrayContaining([
          { kind: 'junk', path: [...CT_PATH, 'ABC.data', 'Data0001.crswap'] },
          { kind: 'junk', path: [...CT_PATH, 'ABC.data', '._Data0000'] },
          { kind: 'junk', path: [...CT_PATH, 'ABC.data', 'sub'] },
        ]),
      );
      expect(reasons).toHaveLength(3);
      expect(drive.snapshot()).toEqual(before);
    });

    it("D1.11: the package's swap and AppleDouble files beside the header fail, and nothing is deleted", async () => {
      const { drive, root } = await setup({
        tree: {
          ...svodPackage('ABC'),
          [`${CT}/ABC.crswap`]: swapFile(),
          [`${CT}/._ABC`]: appleDouble(),
        },
      });
      const before = drive.snapshot();
      const [ok, reasons] = await root.deletePackage(locationOf('ABC'));
      expect(ok).toBe(false);
      expect(reasons).toEqual(
        expect.arrayContaining([
          { kind: 'junk', path: [...CT_PATH, 'ABC.crswap'] },
          { kind: 'junk', path: [...CT_PATH, '._ABC'] },
        ]),
      );
      expect(reasons).toHaveLength(2);
      expect(drive.snapshot()).toEqual(before);
    });

    it('D1.10, D1.11: reports junk in both places together', async () => {
      const { root } = await setup({
        tree: { ...svodPackage('ABC'), [`${CT}/ABC.crswap`]: swapFile(), [`${CT}/ABC.data/x`]: 1 },
      });
      const [, reasons] = await root.deletePackage(locationOf('ABC'));
      expect(reasons).toHaveLength(2);
    });

    it.each([
      ['ABC.1.crswap', swapFile()],
      ['._ABC.1.crswap', appleDouble()],
      ['._ABC.data', appleDouble()],
      ['._ABC.crswap', appleDouble()],
    ])("D1.11: %j is the package's junk", async (name, bytes) => {
      const { root } = await setup({ tree: { ...svodPackage('ABC'), [`${CT}/${name}`]: bytes } });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'junk', path: [...CT_PATH, name] }],
      ]);
    });

    it.each([
      ['ABC.1.crswap', swapFile()],
      ['._ABC.1.crswap', appleDouble()],
    ])("D1.11, J1.15: %j isn't junk when a package ABC.1 exists, and is left alone", async (name, bytes) => {
      const { drive, root } = await setup({
        tree: { ...svodPackage('ABC'), ...stfsPackage('ABC.1'), [`${CT}/${name}`]: bytes },
      });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive).map((line) => line.split(' ')[0])).toEqual([`${CT}/ABC.1`, `${CT}/${name}`].sort());
    });

    it("D1.11, J1.16: ._ABC.crswap without the magic isn't junk", async () => {
      const { root } = await setup({ tree: { ...svodPackage('ABC'), [`${CT}/._ABC.crswap`]: fakeAppleDouble() } });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
    });

    it.each([
      ['Data0001', DIR],
      ['data0000', 1],
      ['Data00000', 1],
    ] as const)('D1.10: %j in name.data/ is junk', async (name, value) => {
      const { drive, root } = await setup({
        tree: { ...svodPackage('ABC', { dataFiles: 1 }), [`${CT}/ABC.data/${name}`]: value },
      });
      const before = drive.snapshot();
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'junk', path: [...CT_PATH, 'ABC.data', name] }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('D1.10: a name.data/ holding only junk directories, and no header, is refused', async () => {
      const { drive, root } = await setup({ tree: { [`${CT}/ABC.data/a/b`]: 1, [`${CT}/ABC.data/c`]: DIR } });
      const before = drive.snapshot();
      const [ok, reasons] = await root.deletePackage(locationOf('ABC'));
      expect(ok).toBe(false);
      expect(reasons).toHaveLength(2);
      expect(drive.snapshot()).toEqual(before);
    });

    it("D1.11: by clean's rules: another package's junk, and a look-alike without magic, don't count", async () => {
      const { drive, root } = await setup({
        tree: {
          ...stfsPackage('ABC'),
          ...stfsPackage('ABCD'),
          [`${CT}/ABCD.crswap`]: swapFile(),
          [`${CT}/._ABCD`]: appleDouble(),
          [`${CT}/._ABC`]: fakeAppleDouble(),
        },
      });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive).map((line) => line.split(' ')[0])).toEqual([
        `${CT}/._ABC`,
        `${CT}/._ABCD`,
        `${CT}/ABCD`,
        `${CT}/ABCD.crswap`,
      ]);
    });

    it('D1.12: after clean, a package with junk can be deleted', async () => {
      const { drive, root } = await setup({
        tree: { ...svodPackage('ABC'), [`${CT}/ABC.crswap`]: swapFile(), [`${CT}/ABC.data/._Data0000`]: appleDouble() },
      });
      expect(await clean(root, locationOf('ABC'))).toEqual([true]);
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive)).toEqual([]);
    });
  });

  describe('order', () => {
    it('D1.13, D1.14: deletes the header first, then data files upwards, then the data directory', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC', { dataFiles: [2, 0, 10, 1] }) });
      const removed = removals(drive);
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(removed).toEqual([
        'ABC',
        'ABC.data/Data0000',
        'ABC.data/Data0001',
        'ABC.data/Data0002',
        'ABC.data/Data0010',
        'ABC.data',
      ]);
    });

    it('D1.15: removes the data directory without recursive: something appearing in it fails, and stays', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC', { dataFiles: 1 }) });
      drive.onOperation(({ operation, path }) => {
        if (operation === 'remove' && path.at(-1) === 'Data0000') {
          drive.write({ [`${CT}/ABC.data/late`]: 1 });
        }
      });
      expect(await root.deletePackage(locationOf('ABC'))).toMatchObject([
        false,
        [
          {
            kind: 'io-error',
            operation: 'remove',
            path: [...CT_PATH, 'ABC.data'],
            error: { name: 'InvalidModificationError' },
          },
        ],
      ]);
      expect(inContentType(drive)).toEqual([`${CT}/ABC.data/`, expect.stringMatching(/ABC\.data\/late 1 /)]);
    });

    it('D1.16, rule 12: a failure part-way leaves no header and the highest data files', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC', { dataFiles: 4 }) });
      drive.fail({ operation: 'remove', path: [...CT_PATH, 'ABC.data', 'Data0002'], error: 'NotReadableError' });
      expect(await root.deletePackage(locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'io-error', operation: 'remove', path: [...CT_PATH, 'ABC.data', 'Data0002'] }],
      ]);
      expect(inContentType(drive).map((line) => line.split(' ')[0])).toEqual([
        `${CT}/ABC.data/`,
        `${CT}/ABC.data/Data0002`,
        `${CT}/ABC.data/Data0003`,
      ]);
    });

    it('D1.17: leaves empty parent directories in place', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual(['0000000000000000/', '0000000000000000/4D5307E6/', `${CT}/`]);
    });

    it("D1.18: on macOS, an AppleDouble file that isn't junk goes with its file, and that is fine", async () => {
      // `._ABC` without the magic isn't junk (D1.11), so the delete goes ahead; macOS then
      // removes it along with ABC.
      const { drive, root } = await setup({
        macos: true,
        tree: { ...svodPackage('ABC', { dataFiles: 1 }), [`${CT}/._ABC`]: fakeAppleDouble() },
      });
      const removed = removals(drive);
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(removed).toEqual(['ABC', 'ABC.data/Data0000', 'ABC.data']);
      expect(inContentType(drive)).toEqual([]);
    });

    it('D1.20: a data file that vanishes during the delete counts as deleted', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC', { dataFiles: 2 }) });
      drive.onOperation(({ operation, path }) => {
        if (operation === 'remove' && path.at(-1) === 'Data0000')
          drive.fs.unlinkSync(`${drive.base}/${CT}/ABC.data/Data0001`);
      });
      const progress = recordCalls<DeleteProgress>();
      expect(await root.deletePackage(locationOf('ABC'), { onProgress: progress.fn })).toEqual([true]);
      expect(progress.calls.at(-1)).toEqual({ deletedFiles: 3, totalFiles: 3, fileName: 'Data0001' });
      expect(inContentType(drive)).toEqual([]);
    });

    it('D1.12: a package created on macOS can be deleted after clean', async () => {
      const { drive, root } = await setup({ macos: true, tree: { [CT]: DIR } });
      // Created through the handles, so macOS adds AppleDouble files; then cleaned, as D1.12 asks.
      const dir = await (
        await (await drive.root.getDirectoryHandle('0000000000000000')).getDirectoryHandle('4D5307E6')
      ).getDirectoryHandle('00007000');
      await dir.getFileHandle('ABC', { create: true });
      const data = await dir.getDirectoryHandle('ABC.data', { create: true });
      await data.getFileHandle('Data0000', { create: true });
      expect(await clean(root, locationOf('ABC'), { includeParents: false })).toEqual([true]);
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive)).toEqual([]);
    });

    it('rule 13: deletes the package as it is now, not as it was', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC', { dataFiles: 1 }) });
      drive.write({ [`${CT}/ABC.data/Data0001`]: 1 });
      expect(await root.deletePackage(locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive)).toEqual([]);
    });
  });

  describe('cancelling and progress', () => {
    it('D1.19: an abort part-way stops before the next deletion, leaving the state in D1.16', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC', { dataFiles: 3 }) });
      const abort = abortAfterCalls<DeleteProgress>(2, 'stop');
      expect(await root.deletePackage(locationOf('ABC'), { signal: abort.signal, onProgress: abort.fn })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(inContentType(drive).map((line) => line.split(' ')[0])).toEqual([
        `${CT}/ABC.data/`,
        `${CT}/ABC.data/Data0001`,
        `${CT}/ABC.data/Data0002`,
      ]);
    });

    it('rule 10: an abort during the checks is reported as aborted, not as junk', async () => {
      const { drive, root } = await setup({ tree: { ...svodPackage('ABC'), [`${CT}/ABC.crswap`]: swapFile() } });
      const signal = abortOnOperation(drive, { operation: 'list', path: [...CT_PATH, 'ABC.data'] }, 'stop');
      expect(await root.deletePackage(locationOf('ABC'), { signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
    });

    it('rule 10: a listing that fails after an abort is reported as aborted, not io-error', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      const signal = abortOnOperation(drive, { operation: 'list', path: [...CT_PATH, 'ABC.data'] }, 'stop');
      drive.fail({ operation: 'list', path: [...CT_PATH, 'ABC.data'] });
      expect(await root.deletePackage(locationOf('ABC'), { signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
    });

    it('D1.19: an abort during the checks, before any deletion, deletes nothing', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      const before = drive.snapshot();
      const signal = abortOnOperation(drive, { operation: 'list', path: [...CT_PATH, 'ABC.data'] }, 'stop');
      expect(await root.deletePackage(locationOf('ABC'), { signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('D1.19: an abort after the last file stops before the data directory is removed', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC', { dataFiles: 1 }) });
      const abort = abortAfterCalls<DeleteProgress>(2, 'stop');
      expect(await root.deletePackage(locationOf('ABC'), { signal: abort.signal, onProgress: abort.fn })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(inContentType(drive)).toEqual([`${CT}/ABC.data/`]);
    });

    it('D1.20: counts files, the header plus every data file, and not the data directory', async () => {
      const { root } = await setup({ tree: svodPackage('ABC', { dataFiles: 2 }) });
      const progress = recordCalls<DeleteProgress>();
      await root.deletePackage(locationOf('ABC'), { onProgress: progress.fn });
      expect(progress.calls).toEqual([
        { deletedFiles: 1, totalFiles: 3, fileName: 'ABC' },
        { deletedFiles: 2, totalFiles: 3, fileName: 'Data0000' },
        { deletedFiles: 3, totalFiles: 3, fileName: 'Data0001' },
      ]);
    });

    it('D1.20: an orphan data directory counts only its data files', async () => {
      const { root } = await setup({ tree: dataOnly('ABC', { dataFiles: 1 }) });
      const progress = recordCalls<DeleteProgress>();
      await root.deletePackage(locationOf('ABC'), { onProgress: progress.fn });
      expect(progress.calls).toEqual([{ deletedFiles: 1, totalFiles: 1, fileName: 'Data0000' }]);
    });

    it("rule 11: a progress callback that throws doesn't stop the delete", async () => {
      const reported = stubReportError();
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      const [ok] = await root.deletePackage(locationOf('ABC'), {
        onProgress: () => {
          throw new Error('progress UI bug');
        },
      });
      expect(ok).toBe(true);
      expect(reported).toHaveLength(4);
      expect(inContentType(drive)).toEqual([]);
    });

    it('rule 12: a pulled drive gives io-error', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      drive.pull();
      expect(await root.deletePackage(locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'io-error', error: { name: 'NotFoundError' } }],
      ]);
    });
  });
});
