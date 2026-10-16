// Tests for root.copyTo.
// Function design doc, C1 `root.copyTo`: statements C1.1-C1.28. The interruption
// tests follow the table in design record §5.2.

import { describe, expect, it } from 'vitest';
import { abortAfterCalls, abortOnOperation } from './helpers/abort.js';
import { recordCalls, stubReportError } from './helpers/callbacks.js';
import { appleDouble, swapFile } from './helpers/junk.js';
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
import { DIR, type TreeSpec } from './helpers/tree.js';
import type { CopyProgress } from '../copy-to.js';
import { openContentRoot } from '../open-content-root.js';
import type { ContentRoot } from '../types.js';

const CT = contentTypePath();
const CT_PATH = [DEFAULT_AT.partition, DEFAULT_AT.titleId, DEFAULT_AT.contentType];

interface Setup {
  vault: TestDrive;
  drive: TestDrive;
  source: ContentRoot;
  target: ContentRoot;
}

/** A read-only vault (the source) and a writable drive (the target). */
async function setup(vaultOptions: TestDriveOptions, driveOptions: TestDriveOptions = {}): Promise<Setup> {
  const vault = createTestDrive({ name: 'Vault', ...vaultOptions });
  const drive = createTestDrive({ name: 'Drive', ...driveOptions });
  const [sourceOk, source] = await openContentRoot(vault.root);
  const [targetOk, target] = await openContentRoot(drive.root, { mode: 'readwrite' });
  if (!sourceOk || !targetOk) throw new Error('setup');
  return { vault, drive, source, target };
}

/** The snapshot lines under a content-type directory, without its own line. */
function inContentType(drive: TestDrive): string[] {
  return drive.snapshot().filter((line) => line.startsWith(`${CT}/`) && line !== `${CT}/`);
}

/** The order in which files are created on a drive (by their name). */
function creations(drive: TestDrive): string[] {
  const created: string[] = [];
  drive.onOperation(({ operation, path }) => {
    if (operation === 'create') created.push(path.slice(3).join('/'));
  });
  return created;
}

describe('root.copyTo', () => {
  describe('input', () => {
    it('C1.1: an already-aborted signal gives `aborted` before anything is touched', async () => {
      const { vault, drive, source, target } = await setup({ tree: svodPackage('ABC') });
      const operations: string[] = [];
      vault.onOperation(({ operation }) => operations.push(operation));
      drive.onOperation(({ operation }) => operations.push(operation));
      const controller = new AbortController();
      controller.abort('stop');
      expect(await source.copyTo(target, locationOf(''), { signal: controller.signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(operations).toEqual([]);
    });

    it('C1.2: checks the location, reporting every invalid field', async () => {
      const { source, target } = await setup({ tree: svodPackage('ABC') });
      const [ok, reasons] = await source.copyTo(target, { ...locationOf('..'), titleId: 'x' });
      expect(ok).toBe(false);
      expect(reasons).toEqual(
        expect.arrayContaining([
          { kind: 'invalid-location', field: 'titleId', value: 'x' },
          { kind: 'invalid-location', field: 'packageName', value: '..' },
        ]),
      );
    });

    it('C1.3: a name of up to 248 characters is copied', async () => {
      const name = 'n'.repeat(248);
      const { drive, source, target } = await setup({ tree: stfsPackage(name) });
      expect(await source.copyTo(target, locationOf(name))).toEqual([true]);
      expect(inContentType(drive)).toHaveLength(1);
    });

    it('C1.3: a longer name fails with name-too-long, before anything is written', async () => {
      const name = 'n'.repeat(249);
      const { drive, source, target } = await setup({ tree: stfsPackage(name) });
      expect(await source.copyTo(target, locationOf(name))).toEqual([
        false,
        [{ kind: 'name-too-long', length: 249, max: 248 }],
      ]);
      expect(drive.snapshot()).toEqual([]);
    });

    it('C1.4: copying to the same root fails with same-root', async () => {
      const vault = createTestDrive({ tree: svodPackage('ABC') });
      const [, first] = await openContentRoot(vault.root, { mode: 'readwrite' });
      const [, second] = await openContentRoot(vault.root, { mode: 'readwrite' });
      if (!('handle' in first) || !('handle' in second)) throw new Error('setup');
      expect(await first.copyTo(first, locationOf('ABC'))).toEqual([false, [{ kind: 'same-root' }]]);
      expect(await first.copyTo(second, locationOf('ABC'))).toEqual([false, [{ kind: 'same-root' }]]);
    });

    it('C1.5: the source needs read permission', async () => {
      const { vault, source, target } = await setup({ tree: svodPackage('ABC') });
      vault.setPermission('read', 'denied');
      vault.setPermission('readwrite', 'denied');
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'permission-denied', mode: 'read', state: 'denied', root: 'source' }],
      ]);
    });

    it('C1.5: the target needs readwrite permission', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC') });
      drive.setPermission('readwrite', 'prompt');
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'permission-denied', mode: 'readwrite', state: 'prompt', root: 'target' }],
      ]);
    });

    it("C1.5: a target opened only for reading still fails if readwrite isn't granted", async () => {
      const vault = createTestDrive({ tree: svodPackage('ABC') });
      const drive = createTestDrive({ permissions: { readwrite: 'denied' } });
      const [, source] = await openContentRoot(vault.root);
      const [, target] = await openContentRoot(drive.root);
      if (!('handle' in source) || !('handle' in target)) throw new Error('setup');
      expect(await source.copyTo(target, locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'permission-denied', root: 'target' }],
      ]);
    });
  });

  describe('the source', () => {
    it('C1.6: a missing directory gives not-found, for the source', async () => {
      const { source, target } = await setup({ tree: { '0000000000000000': DIR } });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'not-found', path: ['0000000000000000', '4D5307E6'], root: 'source' }],
      ]);
    });

    it('C1.6: a directory in another case gives wrong-case, for the source', async () => {
      const { source, target } = await setup({ fat32: true, tree: { '0000000000000000/4d5307e6/00007000/ABC': 1 } });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: ['0000000000000000', '4D5307E6'], found: '4d5307e6', root: 'source' }],
      ]);
    });

    it('C1.6: a header in another case gives wrong-case', async () => {
      const { source, target } = await setup({ fat32: true, tree: stfsPackage('abc') });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: [...CT_PATH, 'ABC'], found: 'abc', root: 'source' }],
      ]);
    });

    it('C1.7: a data directory without its header gives orphaned-data', async () => {
      const { drive, source, target } = await setup({ tree: dataOnly('ABC') });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'orphaned-data', path: [...CT_PATH, 'ABC.data'], root: 'source' }],
      ]);
      expect(drive.snapshot()).toEqual([]);
    });

    it('C1.7: neither gives not-found', async () => {
      const { source, target } = await setup({ tree: { [CT]: DIR } });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'not-found', path: [...CT_PATH, 'ABC'], root: 'source' }],
      ]);
    });

    it('C1.8: a header that is a directory, or a name.data that is a file, gives unexpected-entry-type', async () => {
      const first = await setup({ tree: { [packagePath('ABC')]: DIR } });
      expect(await first.source.copyTo(first.target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'unexpected-entry-type', path: [...CT_PATH, 'ABC'], expected: 'file', root: 'source' }],
      ]);
      const second = await setup({ tree: { ...stfsPackage('ABC'), ...stfsPackage('ABC.data') } });
      expect(await second.source.copyTo(second.target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'unexpected-entry-type', path: [...CT_PATH, 'ABC.data'], expected: 'directory', root: 'source' }],
      ]);
    });

    it('C1.9, C1.10: copies an STFS package: the header alone', async () => {
      const { vault, drive, source, target } = await setup({ tree: stfsPackage('ABC') });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual(vault.snapshot());
    });

    it('C1.9, C1.10: copies an SVOD package exactly: the header, name.data/ and every data file', async () => {
      const { vault, drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 4 }) });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual(vault.snapshot());
    });

    it('C1.9: copies a broken package as it is: gaps in the data files', async () => {
      const { vault, drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: [0, 1, 3] }) });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual(vault.snapshot());
    });

    it('C1.9: copies an SVOD header without its .data/ as just the header', async () => {
      const { vault, drive, source, target } = await setup({ tree: headerOnly('ABC') });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual(vault.snapshot());
    });

    it('C1.9: copies an empty name.data/ as an empty directory', async () => {
      const { vault, drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 0 }) });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual(vault.snapshot());
    });

    it("C1.9: never reads the header's contents to judge it: anything is copied", async () => {
      const bytes = new TextEncoder().encode('not a package');
      const { drive, source, target } = await setup({ tree: { [packagePath('ABC')]: bytes } });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(drive.fs.readFileSync(`${drive.base}/${packagePath('ABC')}`, 'utf8')).toBe('not a package');
    });

    it('C1.10: copies nothing but the header, name.data/ and DataNNNN files', async () => {
      const data = packagePath('ABC.data');
      const { drive, source, target } = await setup({
        tree: {
          ...svodPackage('ABC', { dataFiles: 2 }),
          ...stfsPackage('XYZ'),
          [`${data}/junk`]: 1,
          [`${data}/sub/x`]: 1,
          [`${data}/Data0002.crswap`]: swapFile(),
          [`${CT}/ABC.crswap`]: swapFile(),
          [`${CT}/._ABC`]: appleDouble(),
        },
      });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive).map((line) => line.split(' ')[0])).toEqual([
        `${CT}/ABC`,
        `${CT}/ABC.data/`,
        `${CT}/ABC.data/Data0000`,
        `${CT}/ABC.data/Data0001`,
      ]);
    });
  });

  describe('junk in the source', () => {
    const junkyTree: TreeSpec = {
      ...svodPackage('ABC', { dataFiles: 1 }),
      [`${CT}/ABC.data/junk`]: 1,
      [`${CT}/ABC.data/sub`]: DIR,
      [`${CT}/ABC.crswap`]: swapFile(),
      [`${CT}/._ABC`]: appleDouble(),
    };

    it('C1.11: by default, junk is ignored: not copied, and not a reason to fail', async () => {
      const { drive, source, target } = await setup({ tree: junkyTree });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive)).toHaveLength(3);
    });

    it('C1.12: with failOnJunk, junk fails the copy with one reason per entry, and nothing is written', async () => {
      const { drive, source, target } = await setup({ tree: junkyTree });
      const [ok, reasons] = await source.copyTo(target, locationOf('ABC'), { failOnJunk: true });
      expect(ok).toBe(false);
      expect(reasons).toEqual(
        expect.arrayContaining([
          { kind: 'junk', path: [...CT_PATH, 'ABC.data', 'junk'], root: 'source' },
          { kind: 'junk', path: [...CT_PATH, 'ABC.data', 'sub'], root: 'source' },
          { kind: 'junk', path: [...CT_PATH, 'ABC.crswap'], root: 'source' },
          { kind: 'junk', path: [...CT_PATH, '._ABC'], root: 'source' },
        ]),
      );
      expect(reasons).toHaveLength(4);
      expect(drive.snapshot()).toEqual([]);
    });

    it.each([
      ['ABC.1.crswap', swapFile()],
      ['._ABC.data', appleDouble()],
      ['._ABC.crswap', appleDouble()],
    ])('C1.12.2: with failOnJunk, %j counts as junk', async (name, bytes) => {
      const { source, target } = await setup({ tree: { ...svodPackage('ABC'), [`${CT}/${name}`]: bytes } });
      expect(await source.copyTo(target, locationOf('ABC'), { failOnJunk: true })).toEqual([
        false,
        [{ kind: 'junk', path: [...CT_PATH, name], root: 'source' }],
      ]);
    });

    it("C1.12.2: with failOnJunk, junk is judged by clean's rules", async () => {
      const { source, target } = await setup({
        tree: {
          ...stfsPackage('ABC'),
          ...stfsPackage('ABC.1'),
          ...stfsPackage('ABCD'),
          [`${CT}/ABC.1.crswap`]: swapFile(),
          [`${CT}/ABCD.crswap`]: swapFile(),
          [`${CT}/._ABC`]: new Uint8Array(8),
        },
      });
      expect(await source.copyTo(target, locationOf('ABC'), { failOnJunk: true })).toEqual([true]);
    });
  });

  describe('the target', () => {
    it('C1.13: an existing directory in another case gives wrong-case, for the target', async () => {
      const { drive, source, target } = await setup(
        { tree: svodPackage('ABC') },
        { fat32: true, tree: { '0000000000000000/4d5307e6': DIR } },
      );
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: ['0000000000000000', '4D5307E6'], found: '4d5307e6', root: 'target' }],
      ]);
      expect(drive.snapshot()).toEqual(['0000000000000000/', '0000000000000000/4d5307e6/']);
    });

    it('C1.13: a file where a target directory belongs gives unexpected-entry-type', async () => {
      const { source, target } = await setup({ tree: svodPackage('ABC') }, { tree: { '0000000000000000': 1 } });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'unexpected-entry-type', path: ['0000000000000000'], expected: 'directory', root: 'target' }],
      ]);
    });

    it.each([
      ['ABC', stfsPackage('ABC')],
      ['abc', stfsPackage('abc')],
      ['ABC.data', dataOnly('ABC')],
      ['abc.DATA', { [packagePath('abc.DATA')]: DIR }],
    ] as const)('C1.14: an existing %j at the target, in any case, gives target-exists', async (found, tree) => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC') }, { tree });
      const before = drive.snapshot();
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'target-exists', path: [...CT_PATH, found], root: 'target' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it("C1.15: junk already at the target doesn't stop the copy, and cleanOutput removes it", async () => {
      const { drive, source, target } = await setup(
        { tree: svodPackage('ABC', { dataFiles: 1 }) },
        { tree: { [`${CT}/._ABC`]: appleDouble(), [`${CT}/ABC.crswap`]: swapFile() } },
      );
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive).map((line) => line.split(' ')[0])).toEqual([
        `${CT}/ABC`,
        `${CT}/ABC.data/`,
        `${CT}/ABC.data/Data0000`,
      ]);
    });

    it('C1.16: a full drive gives io-error part-way', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 2 }) });
      drive.fail({ operation: 'write', after: 2, error: 'QuotaExceededError' });
      expect(await source.copyTo(target, locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'io-error', operation: 'write', error: { name: 'QuotaExceededError' }, root: 'target' }],
      ]);
    });
  });

  describe('writing', () => {
    it("C1.17: creates missing directories in the location's uppercase spelling", async () => {
      const { drive, source, target } = await setup({ tree: stfsPackage('ABC') });
      await source.copyTo(target, locationOf('ABC'));
      expect(drive.snapshot().slice(0, 3)).toEqual(['0000000000000000/', '0000000000000000/4D5307E6/', `${CT}/`]);
    });

    it('C1.17: reuses existing directories', async () => {
      const { drive, source, target } = await setup({ tree: stfsPackage('ABC') }, { tree: stfsPackage('XYZ') });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(inContentType(drive)).toHaveLength(2);
    });

    it('C1.18: creates name.data/, writes data files from the highest number down, then the header', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: [0, 2, 1, 10] }) });
      const created = creations(drive);
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(created.filter((path) => path !== '')).toEqual([
        'ABC.data',
        'ABC.data/Data0010',
        'ABC.data/Data0002',
        'ABC.data/Data0001',
        'ABC.data/Data0000',
        'ABC',
      ]);
    });

    it('C1.19: writes each file in one session, through a swap file', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 2 }) });
      const sessions: string[] = [];
      drive.onOperation(({ operation, path }) => {
        if (operation === 'close') sessions.push(path.slice(3).join('/'));
      });
      await source.copyTo(target, locationOf('ABC'));
      expect(sessions).toEqual(['ABC.data/Data0001', 'ABC.data/Data0000', 'ABC']);
    });

    it('C1.20: a copy whose size differs from the source gives io-error with verify-size', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 1 }) });
      drive.onOperation(({ operation, path }) => {
        // Corrupt the swap file just before it becomes Data0000.
        if (operation === 'close' && path.at(-1) === 'Data0000') {
          drive.fs.appendFileSync(`${drive.base}/${CT}/ABC.data/Data0000.crswap`, 'extra');
        }
      });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [
          {
            kind: 'io-error',
            operation: 'verify-size',
            path: [...CT_PATH, 'ABC.data', 'Data0000'],
            error: { name: 'SizeMismatchError', message: 'Expected 1024 bytes, but the copy has 1029.' },
            root: 'target',
          },
        ],
      ]);
    });
  });

  describe('interruption (record §5.2)', () => {
    it('C1.21: an abort during a data file abandons it: an empty file, no swap file, nothing after it', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 3 }) });
      const signal = abortOnOperation(
        drive,
        { operation: 'write', path: [...CT_PATH, 'ABC.data', 'Data0001'], after: 1 },
        'stop',
      );
      expect(await source.copyTo(target, locationOf('ABC'), { signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(inContentType(drive).map((line) => line.split(' ').slice(0, 2).join(' '))).toEqual([
        `${CT}/ABC.data/`,
        `${CT}/ABC.data/Data0001 0`,
        `${CT}/ABC.data/Data0002 1056`,
      ]);
    });

    it('C1.22: a write that fails leaves the files already written and the empty file being written', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 2 }) });
      drive.fail({ operation: 'write', path: [...CT_PATH, 'ABC.data', 'Data0000'], after: 1 });
      expect(await source.copyTo(target, locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'io-error', operation: 'write', path: [...CT_PATH, 'ABC.data', 'Data0000'], root: 'target' }],
      ]);
      expect(inContentType(drive).map((line) => line.split(' ').slice(0, 2).join(' '))).toEqual([
        `${CT}/ABC.data/`,
        `${CT}/ABC.data/Data0000 0`,
        `${CT}/ABC.data/Data0001 1040`,
      ]);
    });

    it('C1.23: a hard stop during a data file leaves its swap file and an empty file', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 2 }) });
      // Pulled as Data0001's data is written (its second `write`, after createWritable),
      // so the data reaches the swap file but the close that follows finds the drive gone.
      let writes = 0;
      drive.onOperation(({ operation, path }) => {
        if (operation === 'write' && path.at(-1) === 'Data0001' && ++writes === 2) drive.pull();
      });
      const [ok] = await source.copyTo(target, locationOf('ABC'));
      expect(ok).toBe(false);
      const files = inContentType(drive).map((line) => line.split(' ').slice(0, 2).join(' '));
      expect(files).toContain(`${CT}/ABC.data/Data0001 0`);
      expect(files).toContain(`${CT}/ABC.data/Data0001.crswap 1040`);
    });

    it('C1.23: an abort between data files leaves a .data/ without Data0000, and no header', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 3 }) });
      // Calls per file: one as data is written, one after close. The 2nd call is Data0002's close.
      const abort = abortAfterCalls<CopyProgress>(2, 'stop');
      await source.copyTo(target, locationOf('ABC'), { signal: abort.signal, onProgress: abort.fn });
      expect(inContentType(drive).map((line) => line.split(' ')[0])).toEqual([
        `${CT}/ABC.data/`,
        `${CT}/ABC.data/Data0002`,
      ]);
    });

    it('C1.23: an abort after Data0000 leaves a complete .data/ without its header', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 2 }) });
      const abort = abortAfterCalls<CopyProgress>(4, 'stop');
      expect(await source.copyTo(target, locationOf('ABC'), { signal: abort.signal, onProgress: abort.fn })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(inContentType(drive).map((line) => line.split(' ')[0])).toEqual([
        `${CT}/ABC.data/`,
        `${CT}/ABC.data/Data0000`,
        `${CT}/ABC.data/Data0001`,
      ]);
    });

    it('C1.23: an abort during the header leaves an empty header', async () => {
      const { drive, source, target } = await setup({ tree: stfsPackage('ABC') });
      const signal = abortOnOperation(drive, { operation: 'write', path: [...CT_PATH, 'ABC'], after: 1 }, 'stop');
      expect(await source.copyTo(target, locationOf('ABC'), { signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(inContentType(drive).map((line) => line.split(' ').slice(0, 2).join(' '))).toEqual([`${CT}/ABC 0`]);
    });

    it("C1.22: a source file that can't be read gives io-error for the source", async () => {
      const { vault, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 1 }) });
      vault.fail({ operation: 'read', path: [...CT_PATH, 'ABC.data', 'Data0000'] });
      expect(await source.copyTo(target, locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'io-error', operation: 'read', path: [...CT_PATH, 'ABC.data', 'Data0000'], root: 'source' }],
      ]);
    });
  });

  describe('cleaning the output', () => {
    it('C1.24: removes the AppleDouble files macOS adds to the target', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 2 }) }, { macos: true });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot().filter((line) => line.includes('._'))).toEqual([]);
    });

    it('C1.24: with cleanOutput: false, they stay', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 2 }) }, { macos: true });
      expect(await source.copyTo(target, locationOf('ABC'), { cleanOutput: false })).toEqual([true]);
      expect(drive.snapshot().filter((line) => line.includes('._')).length).toBeGreaterThan(0);
    });

    it('C1.25, C1.28: a clean that fails still gives [true]', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 1 }) }, { macos: true });
      drive.fail({ operation: 'remove', times: 100 });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
    });

    it("C1.25: an abort during the clean still gives [true], and its progress isn't reported", async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 1 }) }, { macos: true });
      const signal = abortOnOperation(drive, { operation: 'remove' }, 'stop');
      const progress = recordCalls<CopyProgress>();
      expect(await source.copyTo(target, locationOf('ABC'), { signal, onProgress: progress.fn })).toEqual([true]);
      expect(signal.aborted).toBe(true);
      // Two calls per file (one as data is written, one after close), and none from clean.
      expect(progress.calls).toHaveLength(4);
    });

    it('C1.24: passes the signal to clean: an abort after the header stops the clean', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 1 }) }, { macos: true });
      // The 4th progress call comes after the header's close: the copy is complete.
      const abort = abortAfterCalls<CopyProgress>(4, 'stop');
      expect(await source.copyTo(target, locationOf('ABC'), { signal: abort.signal, onProgress: abort.fn })).toEqual([
        true,
      ]);
      // clean saw the abort, so the AppleDouble files macOS added stay.
      expect(drive.snapshot().filter((line) => line.includes('._')).length).toBeGreaterThan(0);
    });
  });

  describe('order of checks (C1, "Order of checks")', () => {
    it('the name length comes before the roots and permission', async () => {
      const name = 'n'.repeat(249);
      const { drive, source, target } = await setup({ tree: stfsPackage(name) });
      drive.setPermission('readwrite', 'denied');
      expect(await source.copyTo(target, locationOf(name))).toMatchObject([false, [{ kind: 'name-too-long' }]]);
    });

    it('the same-root check comes before permission', async () => {
      const vault = createTestDrive({ tree: svodPackage('ABC') });
      const [, root] = await openContentRoot(vault.root);
      if (!('handle' in root)) throw new Error('setup');
      vault.setPermission('read', 'denied');
      expect(await root.copyTo(root, locationOf('ABC'))).toEqual([false, [{ kind: 'same-root' }]]);
    });

    it("the source's permission comes before the target's", async () => {
      const { vault, drive, source, target } = await setup({ tree: svodPackage('ABC') });
      // A readwrite grant covers reads, so the source loses both.
      vault.setPermission('read', 'denied');
      vault.setPermission('readwrite', 'denied');
      drive.setPermission('readwrite', 'denied');
      expect(await source.copyTo(target, locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'permission-denied', root: 'source' }],
      ]);
    });

    it('the source comes before the target', async () => {
      const { source, target } = await setup({ tree: { [CT]: DIR } }, { tree: stfsPackage('ABC') });
      expect(await source.copyTo(target, locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'not-found', root: 'source' }],
      ]);
    });

    it('junk in the source comes before the target', async () => {
      const { source, target } = await setup(
        { tree: { ...stfsPackage('ABC'), [`${CT}/ABC.crswap`]: swapFile() } },
        { tree: stfsPackage('ABC') },
      );
      expect(await source.copyTo(target, locationOf('ABC'), { failOnJunk: true })).toMatchObject([
        false,
        [{ kind: 'junk', root: 'source' }],
      ]);
    });

    it('rule 5, rule 10: an abort during the checks writes nothing at all', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC') }, { tree: stfsPackage('XYZ') });
      const before = drive.snapshot();
      const signal = abortOnOperation(drive, { operation: 'list', path: CT_PATH }, 'stop');
      expect(await source.copyTo(target, locationOf('ABC'), { signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('rule 12: a failing target listing gives io-error for the target', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC') }, { tree: stfsPackage('XYZ') });
      drive.fail({ operation: 'list', path: CT_PATH });
      expect(await source.copyTo(target, locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'io-error', operation: 'list', path: CT_PATH, root: 'target' }],
      ]);
    });

    it('rule 12: an isSameEntry that throws gives io-error, not an exception', async () => {
      const { source, target } = await setup({ tree: svodPackage('ABC') });
      const broken = {
        ...source,
        handle: { isSameEntry: () => Promise.reject(new DOMException('gone', 'NotFoundError')) },
      };
      const [ok, reasons] = await (
        await import('../copy-to.js')
      ).copyTo(broken as unknown as ContentRoot, target, locationOf('XYZ'));
      expect(ok).toBe(false);
      expect(reasons).toMatchObject([{ kind: 'io-error', operation: 'open', root: 'source' }]);
    });
  });

  describe('a target entry that appears during the copy', () => {
    it('C1.14: an entry that appears after the check is still not written into', async () => {
      const { vault, drive, source, target } = await setup(
        { tree: svodPackage('ABC', { dataFiles: 1 }) },
        { tree: { [CT]: DIR } },
      );
      // The source files are read after the target is checked and before anything is written.
      let appeared = false;
      vault.onOperation(({ operation }) => {
        if (operation === 'read' && !appeared) {
          appeared = true;
          drive.write({ [packagePath('ABC')]: new TextEncoder().encode('someone else') });
        }
      });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'target-exists', path: [...CT_PATH, 'ABC'], root: 'target' }],
      ]);
      expect(drive.fs.readFileSync(`${drive.base}/${packagePath('ABC')}`, 'utf8')).toBe('someone else');
    });

    it('C1.14: a header that appears while the data files are copied is not overwritten', async () => {
      const { drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 1 }) });
      drive.onOperation(({ operation, path }) => {
        if (operation === 'close' && path.at(-1) === 'Data0000') {
          drive.write({ [packagePath('abc')]: new TextEncoder().encode('someone else') });
        }
      });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'target-exists', path: [...CT_PATH, 'abc'], root: 'target' }],
      ]);
      expect(drive.fs.readFileSync(`${drive.base}/${packagePath('abc')}`, 'utf8')).toBe('someone else');
    });
  });

  describe('large files, in several chunks', () => {
    const BIG = 300_000;

    it('C1.27: copies every byte, reporting progress for each chunk, never going down', async () => {
      const { vault, drive, source, target } = await setup({ tree: stfsPackage('ABC', { headerSize: BIG }) });
      const progress = recordCalls<CopyProgress>();
      expect(await source.copyTo(target, locationOf('ABC'), { onProgress: progress.fn })).toEqual([true]);
      expect(drive.snapshot()).toEqual(vault.snapshot());
      expect(progress.calls.length).toBeGreaterThan(2);
      for (const [index, call] of progress.calls.entries()) {
        if (index > 0) expect(call.copiedBytes).toBeGreaterThanOrEqual(progress.calls[index - 1]?.copiedBytes ?? 0);
      }
      expect(progress.calls.at(-1)).toMatchObject({ copiedBytes: BIG, totalBytes: BIG, copiedFiles: 1 });
    });

    it('C1.21: an abort between chunks of one file abandons it: an empty file and no swap file', async () => {
      const { drive, source, target } = await setup({ tree: stfsPackage('ABC', { headerSize: BIG }) });
      const abort = abortAfterCalls<CopyProgress>(1, 'stop');
      expect(await source.copyTo(target, locationOf('ABC'), { signal: abort.signal, onProgress: abort.fn })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(abort.calls[0]?.copiedBytes).toBeLessThan(BIG);
      expect(inContentType(drive).map((line) => line.split(' ').slice(0, 2).join(' '))).toEqual([`${CT}/ABC 0`]);
    });

    it('C1.22: a source that fails part-way gives io-error for the source, leaving an empty file and no swap file', async () => {
      const { vault, drive, source, target } = await setup({ tree: stfsPackage('ABC', { headerSize: BIG }) });
      vault.fail({ operation: 'stream', path: [...CT_PATH, 'ABC'], after: 1 });
      expect(await source.copyTo(target, locationOf('ABC'))).toMatchObject([
        false,
        [
          {
            kind: 'io-error',
            operation: 'read',
            path: [...CT_PATH, 'ABC'],
            error: { name: 'NotReadableError' },
            root: 'source',
          },
        ],
      ]);
      expect(inContentType(drive).map((line) => line.split(' ').slice(0, 2).join(' '))).toEqual([`${CT}/ABC 0`]);
    });
  });

  describe('progress', () => {
    it('C1.26, C1.27: totals come from the source; the last call has every byte and file copied', async () => {
      const { source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 2, headerSize: 100 }) });
      const progress = recordCalls<CopyProgress>();
      await source.copyTo(target, locationOf('ABC'), { onProgress: progress.fn });
      const totalBytes = 100 + 1024 + 1040;
      expect(progress.calls.every((call) => call.totalBytes === totalBytes && call.totalFiles === 3)).toBe(true);
      expect(progress.calls.at(-1)).toEqual({
        copiedBytes: totalBytes,
        totalBytes,
        copiedFiles: 3,
        totalFiles: 3,
        fileName: 'ABC',
      });
    });

    it('C1.27: is called as data is written and after each close, in order', async () => {
      const { source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 1, headerSize: 100 }) });
      const progress = recordCalls<CopyProgress>();
      await source.copyTo(target, locationOf('ABC'), { onProgress: progress.fn });
      expect(progress.calls).toEqual([
        { copiedBytes: 1024, totalBytes: 1124, copiedFiles: 0, totalFiles: 2, fileName: 'Data0000' },
        { copiedBytes: 1024, totalBytes: 1124, copiedFiles: 1, totalFiles: 2, fileName: 'Data0000' },
        { copiedBytes: 1124, totalBytes: 1124, copiedFiles: 1, totalFiles: 2, fileName: 'ABC' },
        { copiedBytes: 1124, totalBytes: 1124, copiedFiles: 2, totalFiles: 2, fileName: 'ABC' },
      ]);
    });

    it("rule 11: a progress callback that throws doesn't stop the copy", async () => {
      const reported = stubReportError();
      const { vault, drive, source, target } = await setup({ tree: svodPackage('ABC', { dataFiles: 1 }) });
      const [ok] = await source.copyTo(target, locationOf('ABC'), {
        onProgress: () => {
          throw new Error('progress UI bug');
        },
      });
      expect(ok).toBe(true);
      expect(reported.length).toBeGreaterThan(0);
      expect(drive.snapshot()).toEqual(vault.snapshot());
    });
  });

  describe('result', () => {
    it('C1.28: gives [true] once the header is copied', async () => {
      const { vault, drive, source, target } = await setup({ tree: svodPackage('ABC') });
      expect(await source.copyTo(target, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual(vault.snapshot());
    });

    it("rule 6: changing the caller's location during the copy has no effect", async () => {
      const { vault, drive, source, target } = await setup({ tree: { ...svodPackage('ABC'), ...stfsPackage('XYZ') } });
      const location = locationOf('ABC');
      vault.onOperation(() => {
        location.packageName = 'XYZ';
      });
      expect(await source.copyTo(target, location)).toEqual([true]);
      expect(inContentType(drive).some((line) => line.includes('/ABC'))).toBe(true);
      expect(inContentType(drive).some((line) => line.includes('/XYZ'))).toBe(false);
    });

    it('copies between profile partitions too', async () => {
      const at = { partition: 'E812CECF9EA2AF5F', titleId: '584E07D2', contentType: '000E0000' };
      const { vault, drive, source, target } = await setup({ tree: stfsPackage('save', { at }) });
      expect(await source.copyTo(target, locationOf('save', at))).toEqual([true]);
      expect(drive.snapshot()).toEqual(vault.snapshot());
    });
  });
});
