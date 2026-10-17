// Tests for clean, exported from xcontent-fs-web/extended.
// Function design doc, J1 `clean`: statements J1.1-J1.19, and its "Tests
// required" table as real deletions. The rules themselves are also tested
// directly in internal/__tests__/junk.test.ts and clean-steps.test.ts.

import { describe, expect, it } from 'vitest';
import { abortAfterCalls, abortOnOperation } from './helpers/abort.js';
import { recordCalls, stubReportError } from './helpers/callbacks.js';
import { appleDouble, fakeAppleDouble, swapFile, truncatedAppleDouble } from './helpers/junk.js';
import { DEFAULT_AT, contentTypePath, locationOf, packagePath, stfsPackage, svodPackage } from './helpers/packages.js';
import { createTestDrive, type TestDrive, type TestDriveOptions } from './helpers/test-drive.js';
import { DIR, type TreeSpec } from './helpers/tree.js';
import { clean, type CleanProgress } from '../clean.js';
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

/** `before`, without the snapshot lines of the given paths. */
function without(before: string[], ...paths: string[]): string[] {
  return before.filter(
    (line) => !paths.some((path) => line === `${path}/` || line.startsWith(`${path} `) || line.startsWith(`${path}/`)),
  );
}

describe('clean', () => {
  describe('input', () => {
    it('J1.1: an already-aborted signal gives `aborted` before anything is touched', async () => {
      const { drive, root } = await setup({ tree: { ...stfsPackage('ABC'), [`${CT}/ABC.crswap`]: swapFile() } });
      const before = drive.snapshot();
      const operations: string[] = [];
      drive.onOperation(({ operation }) => operations.push(operation));
      const controller = new AbortController();
      controller.abort('stop');
      expect(await clean(root, locationOf(''), { signal: controller.signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(operations).toEqual([]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('J1.2: checks the location, reporting every invalid field', async () => {
      const { root } = await setup({ tree: stfsPackage('ABC') });
      const [ok, reasons] = await clean(root, { ...locationOf('..'), contentType: '7000' });
      expect(ok).toBe(false);
      expect(reasons).toHaveLength(2);
    });

    it('J1.2: needs readwrite permission, even on a root opened for reading', async () => {
      const drive = createTestDrive({ tree: stfsPackage('ABC'), permissions: { readwrite: 'denied' } });
      const [, root] = await openContentRoot(drive.root);
      if (!('handle' in root)) throw new Error('setup');
      expect(await clean(root, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'permission-denied', mode: 'readwrite', state: 'denied' }],
      ]);
    });

    it('J1.3: a missing directory gives not-found', async () => {
      const { root } = await setup({ tree: { '0000000000000000': DIR } });
      expect(await clean(root, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'not-found', path: ['0000000000000000', '4D5307E6'] }],
      ]);
    });

    it('J1.3: a directory in another case gives wrong-case, and nothing is deleted', async () => {
      const { drive, root } = await setup({
        fat32: true,
        tree: { '0000000000000000/4d5307e6/00007000/ABC.crswap': swapFile() },
      });
      const before = drive.snapshot();
      expect(await clean(root, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: ['0000000000000000', '4D5307E6'], found: '4d5307e6' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('J1.3, rule 8: a header in another case gives wrong-case, and nothing is deleted', async () => {
      const { drive, root } = await setup({
        fat32: true,
        tree: { ...stfsPackage('abc'), [`${CT}/abc.crswap`]: swapFile() },
      });
      const before = drive.snapshot();
      expect(await clean(root, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: [...CT_PATH, 'ABC'], found: 'abc' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('J1.3, rule 8: a data directory in another case gives wrong-case, and nothing is deleted', async () => {
      const { drive, root } = await setup({ tree: { [`${CT}/abc.data/junk`]: 1, [`${CT}/ABC.crswap`]: swapFile() } });
      const before = drive.snapshot();
      expect(await clean(root, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: [...CT_PATH, 'ABC.data'], found: 'abc.data' }],
      ]);
      expect(drive.snapshot()).toEqual(before);
    });

    it('rule 12: NotAllowedError while removing gives permission-denied', async () => {
      const { drive, root } = await setup({ tree: { ...stfsPackage('ABC'), [`${CT}/ABC.crswap`]: swapFile() } });
      drive.fail({ operation: 'remove', error: 'NotAllowedError' });
      expect(await clean(root, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'permission-denied', mode: 'readwrite', state: 'denied' }],
      ]);
    });

    it('a file where a directory belongs gives unexpected-entry-type', async () => {
      const { root } = await setup({ tree: { '0000000000000000/4D5307E6': 1 } });
      expect(await clean(root, locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'unexpected-entry-type', path: ['0000000000000000', '4D5307E6'], expected: 'directory' }],
      ]);
    });

    it('J1.4: cleans a package whose header and data directory are both missing', async () => {
      const { drive, root } = await setup({
        tree: { [`${CT}/ABC.crswap`]: swapFile(), [`${CT}/._ABC`]: appleDouble(), ...stfsPackage('XYZ') },
      });
      expect(await clean(root, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual([
        '0000000000000000/',
        '0000000000000000/4D5307E6/',
        `${CT}/`,
        expect.stringMatching(new RegExp(`^${CT}/XYZ `)),
      ]);
    });

    it('J1.4: cleans an interrupted copy: a .data/ with swap files and an empty data file, and no header', async () => {
      const data = packagePath('ABC.data');
      const { drive, root } = await setup({
        tree: {
          [`${data}/Data0002`]: 10,
          [`${data}/Data0001`]: new Uint8Array(),
          [`${data}/Data0001.crswap`]: swapFile(),
          [`${data}/._Data0002`]: appleDouble(),
          [`${CT}/._ABC.data`]: appleDouble(),
        },
      });
      expect(await clean(root, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot().filter((line) => line.startsWith(`${CT}/`) && line !== `${CT}/`)).toEqual([
        `${data}/`,
        expect.stringMatching(new RegExp(`^${data}/Data0001 0 `)),
        expect.stringMatching(new RegExp(`^${data}/Data0002 10 `)),
      ]);
    });
  });

  describe('steps and progress', () => {
    const everyKind: TreeSpec = {
      ...svodPackage('ABC', { dataFiles: 1 }),
      [`${CT}/ABC.data/junk`]: 1,
      [`${CT}/ABC.crswap`]: swapFile(),
      [`${CT}/._ABC`]: appleDouble(),
      '0000000000000000/4D5307E6/._00007000': appleDouble(),
    };

    it('J1.5-J1.9: runs the four steps in order, each reporting its own progress', async () => {
      const { root } = await setup({ tree: everyKind });
      const progress = recordCalls<CleanProgress>();
      expect(await clean(root, locationOf('ABC'), { onProgress: progress.fn })).toEqual([true]);
      expect(progress.calls).toEqual([
        { step: 'svod-junk', deletedFiles: 1, totalFiles: 1, fileName: 'junk' },
        { step: 'crswap', deletedFiles: 1, totalFiles: 1, fileName: 'ABC.crswap' },
        { step: 'apple-double', deletedFiles: 1, totalFiles: 1, fileName: '._ABC' },
        { step: 'parent-apple-double', deletedFiles: 1, totalFiles: 1, fileName: '._00007000' },
      ]);
    });

    it('J1.8: includeParents is true by default', async () => {
      const { drive, root } = await setup({ tree: everyKind });
      await clean(root, locationOf('ABC'));
      expect(drive.snapshot().some((line) => line.includes('._00007000'))).toBe(false);
    });

    it("J1.8: without includeParents, parent directories' AppleDouble files are kept", async () => {
      const { drive, root } = await setup({ tree: everyKind });
      const progress = recordCalls<CleanProgress>();
      await clean(root, locationOf('ABC'), { includeParents: false, onProgress: progress.fn });
      expect(drive.snapshot().some((line) => line.includes('._00007000'))).toBe(true);
      expect(progress.calls.map(({ step }) => step)).not.toContain('parent-apple-double');
    });

    it('J1.4: a package with no junk is left exactly as it was', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      const before = drive.snapshot();
      const progress = recordCalls<CleanProgress>();
      expect(await clean(root, locationOf('ABC'), { onProgress: progress.fn })).toEqual([true]);
      expect(drive.snapshot()).toEqual(before);
      expect(progress.calls).toEqual([]);
    });

    it('J1.19: an abort between deletions within a step stops at once', async () => {
      const data = packagePath('ABC.data');
      const { drive, root } = await setup({ tree: { [`${data}/junk1`]: 1, [`${data}/junk2`]: 1 } });
      const abort = abortAfterCalls<CleanProgress>(1, 'stop');
      expect(await clean(root, locationOf('ABC'), { signal: abort.signal, onProgress: abort.fn })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(drive.snapshot()).toContainEqual(expect.stringMatching(/ABC\.data\/junk2 /));
      expect(drive.snapshot().some((line) => line.includes('junk1'))).toBe(false);
    });

    it('J1.19: an abort during the last step is reported, even with nothing left to delete', async () => {
      const { drive, root } = await setup({ tree: stfsPackage('ABC') });
      // The root is listed twice: walking to the package, then in the last step.
      const signal = abortOnOperation(drive, { operation: 'list', path: [], after: 1 }, 'stop');
      expect(await clean(root, locationOf('ABC'), { signal })).toEqual([false, [{ kind: 'aborted', reason: 'stop' }]]);
    });

    it('J1.19: an abort between steps gives `aborted`, and what is already deleted stays deleted', async () => {
      const { drive, root } = await setup({ tree: everyKind });
      const abort = abortAfterCalls<CleanProgress>(2, 'stop');
      expect(await clean(root, locationOf('ABC'), { signal: abort.signal, onProgress: abort.fn })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      const snapshot = drive.snapshot();
      expect(snapshot.some((line) => line.includes('ABC.data/junk'))).toBe(false);
      expect(snapshot.some((line) => line.includes('ABC.crswap'))).toBe(false);
      expect(snapshot.some((line) => line.includes(`${CT}/._ABC `))).toBe(true);
    });

    it("rule 11: a progress callback that throws doesn't stop the clean", async () => {
      const reported = stubReportError();
      const { drive, root } = await setup({ tree: everyKind });
      const [ok] = await clean(root, locationOf('ABC'), {
        onProgress: () => {
          throw new Error('progress UI bug');
        },
      });
      expect(ok).toBe(true);
      expect(reported).toHaveLength(4);
      expect(drive.snapshot().some((line) => line.includes('._'))).toBe(false);
    });

    it('rule 12: a removal that fails gives io-error, and stops', async () => {
      const { drive, root } = await setup({ tree: everyKind });
      drive.fail({ operation: 'remove', path: [...CT_PATH, 'ABC.crswap'], error: 'NoModificationAllowedError' });
      expect(await clean(root, locationOf('ABC'))).toMatchObject([
        false,
        [
          {
            kind: 'io-error',
            operation: 'remove',
            path: [...CT_PATH, 'ABC.crswap'],
            error: { name: 'NoModificationAllowedError' },
          },
        ],
      ]);
      expect(drive.snapshot().some((line) => line.includes(`${CT}/._ABC `))).toBe(true);
    });
  });

  describe('"Tests required": never touches another package\'s files', () => {
    it("deletes exactly the package's junk from a crowded content-type directory", async () => {
      const deleted: TreeSpec = {
        [`${CT}/ABC.crswap`]: swapFile(),
        [`${CT}/ABC.1.crswap`]: swapFile(),
        [`${CT}/ABC.12.crswap`]: swapFile(),
        [`${CT}/._ABC`]: appleDouble(),
        [`${CT}/._ABC.data`]: appleDouble(),
        [`${CT}/._ABC.crswap`]: appleDouble(),
        [`${CT}/._ABC.1.crswap`]: appleDouble(),
      };
      const kept: TreeSpec = {
        ...svodPackage('ABC'),
        ...stfsPackage('ABCD'),
        ...stfsPackage('XABC'),
        ...stfsPackage('AB'),
        [`${CT}/ABCD.crswap`]: swapFile(),
        [`${CT}/._ABCD`]: appleDouble(),
        [`${CT}/XABC.crswap`]: swapFile(),
        [`${CT}/._XABC`]: appleDouble(),
        [`${CT}/AB.crswap`]: swapFile(),
        [`${CT}/abc.crswap`]: swapFile(),
        [`${CT}/ABC.crswap.crswap`]: swapFile(),
        [`${CT}/ABC.x.crswap`]: swapFile(),
        [`${CT}/ABC.1.2.crswap`]: swapFile(),
      };
      const { drive, root } = await setup({ tree: { ...kept, ...deleted } });
      const before = drive.snapshot();
      expect(await clean(root, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual(without(before, ...Object.keys(deleted)));
    });

    it('keeps ._abc in another case, and AppleDouble look-alikes', async () => {
      // `._abc` and `._ABC` can't both exist on a case-insensitive drive, so each is its own case.
      for (const [name, bytes] of [
        ['._abc', appleDouble()],
        ['._ABC', fakeAppleDouble()],
        ['._ABC', truncatedAppleDouble()],
      ] as const) {
        const { drive, root } = await setup({ tree: { ...stfsPackage('ABC'), [`${CT}/${name}`]: bytes } });
        const before = drive.snapshot();
        expect(await clean(root, locationOf('ABC'))).toEqual([true]);
        expect(drive.snapshot()).toEqual(before);
      }
    });

    it('keeps ABC.1.crswap and ._ABC.1.crswap when an entry ABC.1 exists', async () => {
      const { drive, root } = await setup({
        tree: {
          ...stfsPackage('ABC'),
          ...stfsPackage('ABC.1'),
          [`${CT}/ABC.1.crswap`]: swapFile(),
          [`${CT}/._ABC.1.crswap`]: appleDouble(),
        },
      });
      const before = drive.snapshot();
      expect(await clean(root, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual(before);
    });

    it.each([
      ['a.b', 'aXb'],
      ['a+', 'aaa'],
    ])(
      "escapes regex characters in %j, keeping %j's junk, which a raw pattern would match",
      async (name, neighbour) => {
        const { drive, root } = await setup({
          tree: {
            ...stfsPackage(name),
            ...stfsPackage(neighbour),
            [`${CT}/${name}.crswap`]: swapFile(),
            [`${CT}/${neighbour}.crswap`]: swapFile(),
            [`${CT}/._${neighbour}`]: appleDouble(),
          },
        });
        const before = drive.snapshot();
        expect(await clean(root, locationOf(name))).toEqual([true]);
        expect(drive.snapshot()).toEqual(without(before, `${CT}/${name}.crswap`));
      },
    );

    it("keeps ._ABC.data when ABC.data is another package's header, and ._ABC.crswap without magic", async () => {
      const { drive, root } = await setup({
        tree: {
          ...stfsPackage('ABC'),
          ...stfsPackage('ABC.data'),
          [`${CT}/._ABC.data`]: appleDouble(),
          [`${CT}/._ABC.crswap`]: fakeAppleDouble(),
        },
      });
      const before = drive.snapshot();
      expect(await clean(root, locationOf('ABC'))).toEqual([true]);
      expect(drive.snapshot()).toEqual(before);
    });

    it("cleans a package copied from a Mac, keeping a neighbour's and sibling directories' AppleDouble files", async () => {
      const { drive, root } = await setup({
        tree: {
          ...svodPackage('ABC', { dataFiles: 2 }),
          ...stfsPackage('XYZ'),
          [`${CT}/._ABC`]: appleDouble(),
          [`${CT}/._ABC.data`]: appleDouble(),
          [`${CT}/ABC.data/._Data0000`]: appleDouble(),
          [`${CT}/ABC.data/._Data0001`]: appleDouble(),
          [`${CT}/._XYZ`]: appleDouble(),
          '._0000000000000000': appleDouble(),
          '0000000000000000/._4D5307E6': appleDouble(),
          '0000000000000000/4D5307E6/._00007000': appleDouble(),
          '0000000000000000/4D5307E6/._00004000': appleDouble(),
          '0000000000000000/4D5307E6/00004000': DIR,
        },
      });
      expect(await clean(root, locationOf('ABC'))).toEqual([true]);
      expect(
        drive
          .snapshot()
          .filter((line) => line.includes('._'))
          .map((line) => line.split(' ')[0]),
      ).toEqual(['0000000000000000/4D5307E6/._00004000', `${CT}/._XYZ`]);
    });
  });
});
