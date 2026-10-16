// Tests for clean's four internal functions and the deletion loop they share.
// Function design doc, J1 `clean`: statements J1.9-J1.19.

import { describe, expect, it } from 'vitest';
import { recordCalls } from '../../__tests__/helpers/callbacks.js';
import { appleDouble, fakeAppleDouble, swapFile, truncatedAppleDouble } from '../../__tests__/helpers/junk.js';
import {
  DEFAULT_AT,
  contentTypePath,
  dataOnly,
  locationOf,
  packagePath,
  stfsPackage,
  svodPackage,
} from '../../__tests__/helpers/packages.js';
import { createTestDrive, type TestDrive } from '../../__tests__/helpers/test-drive.js';
import { DIR, type TreeSpec } from '../../__tests__/helpers/tree.js';
import { deleteAppleDoubleFiles } from '../delete-apple-double-files.js';
import { deleteCrswapFiles } from '../delete-crswap-files.js';
import { deleteEntries, type StepProgress } from '../delete-entries.js';
import { deleteParentAppleDoubleFiles } from '../delete-parent-apple-double-files.js';
import { deleteSvodJunkFiles } from '../delete-svod-junk-files.js';
import { openLocationDirectories } from '../walk.js';

const CT_PATH = [DEFAULT_AT.partition, DEFAULT_AT.titleId, DEFAULT_AT.contentType];
const CT = contentTypePath();

async function contentTypeDir(drive: TestDrive): Promise<FileSystemDirectoryHandle> {
  const [ok, dirs] = await openLocationDirectories(drive.root, locationOf('ABC'));
  if (!ok) throw new Error(`setup: ${JSON.stringify(dirs)}`);
  return dirs[2];
}

/** The names of the entries directly in the content-type directory, files and directories. */
function besideHeader(drive: TestDrive): string[] {
  const names: string[] = [];
  for (const line of drive.snapshot()) {
    if (!line.startsWith(`${CT}/`)) continue;
    const entry = line.slice(CT.length + 1).split(' ')[0] ?? '';
    const name = entry.endsWith('/') ? entry.slice(0, -1) : entry;
    if (name !== '' && !name.includes('/')) names.push(name);
  }
  return names;
}

/** The snapshot lines of the files in `dir`, without the directory's own line. */
function filesIn(drive: TestDrive, dir: string): string[] {
  return drive.snapshot().filter((line) => line.startsWith(`${dir}/`) && line !== `${dir}/`);
}

describe('deleteEntries', () => {
  it('deletes each entry in order, reporting progress after each, and directories recursively', async () => {
    const drive = createTestDrive({ tree: { a: 1, b: 1, 'dir/x': 1 } });
    const progress = recordCalls<StepProgress>();
    const result = await deleteEntries(
      [
        { dir: drive.root, dirPath: [], name: 'b', kind: 'file' },
        { dir: drive.root, dirPath: [], name: 'dir', kind: 'directory' },
      ],
      { onProgress: progress.fn },
    );
    expect(result).toEqual([true]);
    expect(drive.snapshot()).toEqual([expect.stringMatching(/^a 1 /)]);
    expect(progress.calls).toEqual([
      { deletedFiles: 1, totalFiles: 2, fileName: 'b' },
      { deletedFiles: 2, totalFiles: 2, fileName: 'dir' },
    ]);
  });

  it('J1.19: checks the signal before each deletion, keeping what is already deleted', async () => {
    const drive = createTestDrive({ tree: { a: 1, b: 1 } });
    const controller = new AbortController();
    const result = await deleteEntries(
      [
        { dir: drive.root, dirPath: [], name: 'a', kind: 'file' },
        { dir: drive.root, dirPath: [], name: 'b', kind: 'file' },
      ],
      {
        signal: controller.signal,
        onProgress: () => {
          controller.abort('stop');
        },
      },
    );
    expect(result).toEqual([false, [{ kind: 'aborted', reason: 'stop' }]]);
    expect(drive.snapshot()).toEqual([expect.stringMatching(/^b 1 /)]);
  });

  it("rule 12: a removal that fails gives io-error with the entry's path, and stops", async () => {
    const drive = createTestDrive({ tree: { a: 1, b: 1 } });
    drive.fail({ operation: 'remove', path: ['a'], error: 'NoModificationAllowedError' });
    const result = await deleteEntries(
      [
        { dir: drive.root, dirPath: ['x'], name: 'a', kind: 'file' },
        { dir: drive.root, dirPath: ['x'], name: 'b', kind: 'file' },
      ],
      {},
    );
    expect(result).toMatchObject([
      false,
      [{ kind: 'io-error', operation: 'remove', path: ['x', 'a'], error: { name: 'NoModificationAllowedError' } }],
    ]);
    expect(drive.snapshot()).toHaveLength(2);
  });
});

describe('deleteEntries, when the disk changes under it', () => {
  it('counts an entry that has already gone as deleted, as macOS removes AppleDouble files itself', async () => {
    const drive = createTestDrive({ macos: true, tree: { '-foo': 1, '._-foo': appleDouble(), b: 1 } });
    const progress = recordCalls<StepProgress>();
    const result = await deleteEntries(
      ['-foo', '._-foo', 'b'].map((name) => ({ dir: drive.root, dirPath: [], name, kind: 'file' as const })),
      { onProgress: progress.fn },
    );
    expect(result).toEqual([true]);
    expect(drive.snapshot()).toEqual([]);
    expect(progress.calls.map(({ deletedFiles }) => deletedFiles)).toEqual([1, 2, 3]);
  });

  it('never deletes recursively an entry listed as a file but replaced by a directory', async () => {
    const drive = createTestDrive({ tree: { a: 1 } });
    drive.fs.unlinkSync(`${drive.base}/a`);
    drive.fs.mkdirSync(`${drive.base}/a`);
    drive.fs.writeFileSync(`${drive.base}/a/keep`, 'x');
    const result = await deleteEntries([{ dir: drive.root, dirPath: [], name: 'a', kind: 'file' }], {});
    expect(result).toMatchObject([
      false,
      [{ kind: 'io-error', operation: 'remove', error: { name: 'InvalidModificationError' } }],
    ]);
    expect(drive.snapshot()).toContainEqual(expect.stringMatching(/^a\/keep /));
  });
});

describe('deleteSvodJunkFiles', () => {
  it('J1.10, J1.11: deletes everything in name.data/ but data files, subdirectories recursively', async () => {
    const data = packagePath('ABC.data');
    const junk: TreeSpec = {
      [`${data}/data0000`]: 1,
      [`${data}/Data000`]: 1,
      [`${data}/Data00000`]: 1,
      [`${data}/Data0000.crswap`]: swapFile(),
      [`${data}/._Data0000`]: appleDouble(),
      [`${data}/COPYING`]: 1,
      [`${data}/sub/file`]: 1,
      [`${data}/empty`]: DIR,
    };
    const drive = createTestDrive({ tree: { ...svodPackage('ABC', { dataFiles: 4 }), ...junk } });
    expect(await deleteSvodJunkFiles(await contentTypeDir(drive), CT_PATH, 'ABC', {})).toEqual([true]);
    expect(filesIn(drive, data)).toEqual([
      expect.stringMatching(/Data0000 1024 /),
      expect.stringMatching(/Data0001 1040 /),
      expect.stringMatching(/Data0002 1056 /),
      expect.stringMatching(/Data0003 1072 /),
    ]);
  });

  it('J1.12: deletes AppleDouble-named files in name.data/ without checking their magic', async () => {
    const data = packagePath('ABC.data');
    const drive = createTestDrive({
      tree: { ...svodPackage('ABC', { dataFiles: 1 }), [`${data}/._x`]: fakeAppleDouble() },
    });
    await deleteSvodJunkFiles(await contentTypeDir(drive), CT_PATH, 'ABC', {});
    expect(drive.snapshot().some((line) => line.includes('._x'))).toBe(false);
  });

  it('J1.10: a directory named DataNNNN is junk too', async () => {
    const data = packagePath('ABC.data');
    const drive = createTestDrive({ tree: { [`${data}/Data0000/x`]: 1 } });
    await deleteSvodJunkFiles(await contentTypeDir(drive), CT_PATH, 'ABC', {});
    expect(filesIn(drive, data)).toEqual([]);
  });

  it('J1.4: does nothing without name.data/, or when name.data is a file', async () => {
    const drive = createTestDrive({ tree: { ...stfsPackage('ABC'), [packagePath('XYZ.data')]: 1 } });
    const before = drive.snapshot();
    const dir = await contentTypeDir(drive);
    expect(await deleteSvodJunkFiles(dir, CT_PATH, 'ABC', {})).toEqual([true]);
    expect(await deleteSvodJunkFiles(dir, CT_PATH, 'XYZ', {})).toEqual([true]);
    expect(drive.snapshot()).toEqual(before);
  });

  it('rule 8: a name.data/ in another case gives wrong-case', async () => {
    const drive = createTestDrive({ tree: dataOnly('abc') });
    expect(await deleteSvodJunkFiles(await contentTypeDir(drive), CT_PATH, 'ABC', {})).toEqual([
      false,
      [{ kind: 'wrong-case', path: [...CT_PATH, 'ABC.data'], found: 'abc.data' }],
    ]);
  });

  it("J1.9: reports progress per entry deleted, with the step's total", async () => {
    const data = packagePath('ABC.data');
    const drive = createTestDrive({ tree: { [`${data}/a`]: 1, [`${data}/b`]: 1, [`${data}/Data0000`]: 1 } });
    const progress = recordCalls<StepProgress>();
    await deleteSvodJunkFiles(await contentTypeDir(drive), CT_PATH, 'ABC', { onProgress: progress.fn });
    expect(progress.calls).toEqual([
      { deletedFiles: 1, totalFiles: 2, fileName: 'a' },
      { deletedFiles: 2, totalFiles: 2, fileName: 'b' },
    ]);
  });
});

describe('deleteCrswapFiles and deleteAppleDoubleFiles: the "Tests required" table', () => {
  // Neighbours beside package ABC (J1, "Tests required").
  const neighbours: TreeSpec = {
    ...svodPackage('ABC'),
    ...stfsPackage('ABCD'),
    ...stfsPackage('XABC'),
    ...stfsPackage('AB'),
  };

  async function cleanBeside(tree: TreeSpec, name = 'ABC'): Promise<TestDrive> {
    const drive = createTestDrive({ tree: { ...neighbours, ...tree } });
    const dir = await contentTypeDir(drive);
    expect(await deleteCrswapFiles(dir, CT_PATH, name, {})).toEqual([true]);
    expect(await deleteAppleDoubleFiles(dir, CT_PATH, name, {})).toEqual([true]);
    return drive;
  }

  it.each(['ABC.crswap', 'ABC.1.crswap', 'ABC.12.crswap'])('J1.13: deletes %j', async (entry) => {
    const drive = await cleanBeside({ [`${CT}/${entry}`]: swapFile() });
    expect(besideHeader(drive)).not.toContain(entry);
  });

  it('J1.15: keeps ABC.1.crswap when an entry ABC.1 exists', async () => {
    const drive = await cleanBeside({ ...stfsPackage('ABC.1'), [`${CT}/ABC.1.crswap`]: swapFile() });
    expect(besideHeader(drive)).toContain('ABC.1.crswap');
  });

  it.each(['._ABC', '._ABC.data', '._ABC.crswap', '._ABC.1.crswap'])(
    'J1.14: deletes %j with valid magic',
    async (entry) => {
      const drive = await cleanBeside({ [`${CT}/${entry}`]: appleDouble() });
      expect(besideHeader(drive)).not.toContain(entry);
    },
  );

  it('J1.15: keeps ._ABC.1.crswap when an entry ABC.1 exists', async () => {
    const drive = await cleanBeside({ ...stfsPackage('ABC.1'), [`${CT}/._ABC.1.crswap`]: appleDouble() });
    expect(besideHeader(drive)).toContain('._ABC.1.crswap');
  });

  it.each([
    ['without valid magic', fakeAppleDouble()],
    ['shorter than 4 bytes', truncatedAppleDouble()],
  ])('J1.14: keeps ._ABC %s', async (_label, bytes) => {
    const drive = await cleanBeside({ [`${CT}/._ABC`]: bytes });
    expect(besideHeader(drive)).toContain('._ABC');
  });

  it('J1.13, J1.14: keeps the package itself, its neighbours and their junk, wrong case and near misses', async () => {
    const kept = [
      'ABCD.crswap',
      '._ABCD',
      'XABC.crswap',
      '._XABC',
      'AB.crswap',
      'abc.crswap',
      '._abc',
      'ABC.crswap.crswap',
      'ABC.x.crswap',
      'ABC.1.2.crswap',
    ];
    const tree: TreeSpec = Object.fromEntries(
      kept.map((entry) => [`${CT}/${entry}`, entry.startsWith('._') ? appleDouble() : swapFile()]),
    );
    const drive = await cleanBeside(tree);
    expect(besideHeader(drive).sort()).toEqual([...kept, 'ABC', 'ABC.data', 'ABCD', 'XABC', 'AB'].sort());
    expect(filesIn(drive, `${CT}/ABC.data`)).toHaveLength(3);
  });

  it.each([
    ['a.b', 'aXb'],
    ['a+', 'aaa'],
    ['(x)', 'x'],
    ['a.b(c)[d]^$', 'a.b(c)d^$'],
  ])(
    'J1.13: %j is escaped, so the swap and AppleDouble files of %j, which a raw pattern would match, are kept',
    async (name, neighbour) => {
      const drive = createTestDrive({
        tree: {
          ...stfsPackage(name),
          ...stfsPackage(neighbour),
          [`${CT}/${name}.crswap`]: swapFile(),
          [`${CT}/._${name}`]: appleDouble(),
          [`${CT}/${neighbour}.crswap`]: swapFile(),
          [`${CT}/._${neighbour}`]: appleDouble(),
        },
      });
      const dir = await contentTypeDir(drive);
      await deleteCrswapFiles(dir, CT_PATH, name, {});
      await deleteAppleDoubleFiles(dir, CT_PATH, name, {});
      expect(besideHeader(drive).sort()).toEqual([name, neighbour, `${neighbour}.crswap`, `._${neighbour}`].sort());
    },
  );

  it("J1.15: keeps ._ABC.data when ABC.data is a file: another package's header", async () => {
    // Its own drive: the shared neighbours give ABC a data directory named ABC.data.
    const drive = createTestDrive({
      tree: { ...stfsPackage('ABC'), ...stfsPackage('ABC.data'), [`${CT}/._ABC.data`]: appleDouble() },
    });
    const dir = await contentTypeDir(drive);
    expect(await deleteAppleDoubleFiles(dir, CT_PATH, 'ABC', {})).toEqual([true]);
    expect(besideHeader(drive)).toContain('._ABC.data');
  });

  it('J1.16: keeps ._ABC.crswap without valid magic', async () => {
    const drive = await cleanBeside({ [`${CT}/._ABC.crswap`]: fakeAppleDouble() });
    expect(besideHeader(drive)).toContain('._ABC.crswap');
  });

  it('J1.13: only files are deleted: a directory named like a swap file is kept', async () => {
    const drive = await cleanBeside({ [`${CT}/ABC.crswap`]: DIR, [`${CT}/._ABC`]: DIR });
    expect(besideHeader(drive).sort()).toEqual(['._ABC', 'AB', 'ABC', 'ABC.crswap', 'ABC.data', 'ABCD', 'XABC'].sort());
  });

  it('J1.9: each reports its own progress', async () => {
    const drive = createTestDrive({
      tree: { ...stfsPackage('ABC'), [`${CT}/ABC.crswap`]: swapFile(), [`${CT}/ABC.1.crswap`]: swapFile() },
    });
    const progress = recordCalls<StepProgress>();
    await deleteCrswapFiles(await contentTypeDir(drive), CT_PATH, 'ABC', { onProgress: progress.fn });
    expect(progress.calls).toEqual([
      { deletedFiles: 1, totalFiles: 2, fileName: 'ABC.1.crswap' },
      { deletedFiles: 2, totalFiles: 2, fileName: 'ABC.crswap' },
    ]);
  });

  it('rule 12: a magic check that fails to read gives io-error, and deletes nothing', async () => {
    const drive = createTestDrive({ tree: { ...stfsPackage('ABC'), [`${CT}/._ABC`]: appleDouble() } });
    const dir = await contentTypeDir(drive);
    drive.fail({ operation: 'read' });
    expect(await deleteAppleDoubleFiles(dir, CT_PATH, 'ABC', {})).toMatchObject([
      false,
      [{ kind: 'io-error', operation: 'read', path: [...CT_PATH, '._ABC'] }],
    ]);
    expect(besideHeader(drive)).toContain('._ABC');
  });
});

describe('deleteParentAppleDoubleFiles', () => {
  async function run(tree: TreeSpec): Promise<TestDrive> {
    const drive = createTestDrive({ tree: { ...stfsPackage('ABC'), ...tree } });
    const [ok, dirs] = await openLocationDirectories(drive.root, locationOf('ABC'));
    if (!ok) throw new Error('setup');
    expect(await deleteParentAppleDoubleFiles(drive.root, dirs, locationOf('ABC'), {})).toEqual([true]);
    return drive;
  }

  it('J1.17: deletes the AppleDouble file of each parent directory', async () => {
    const drive = await run({
      '._0000000000000000': appleDouble(),
      '0000000000000000/._4D5307E6': appleDouble(),
      '0000000000000000/4D5307E6/._00007000': appleDouble(),
    });
    expect(drive.snapshot().filter((line) => line.includes('._'))).toEqual([]);
  });

  it('J1.17: keeps one without valid magic, and those of sibling directories', async () => {
    const drive = await run({
      '._0000000000000000': fakeAppleDouble(),
      '._E812CECF9EA2AF5F': appleDouble(),
      '0000000000000000/4D5307E6/._00004000': appleDouble(),
      '0000000000000000/4D5307E6/00004000': DIR,
      '0000000000000000/4D5307E6/._00007000': appleDouble(),
    });
    expect(
      drive
        .snapshot()
        .filter((line) => line.includes('._'))
        .map((line) => line.split(' ')[0]),
    ).toEqual(['._0000000000000000', '._E812CECF9EA2AF5F', '0000000000000000/4D5307E6/._00004000']);
  });

  it('J1.17: the names must match exactly: another case is kept', async () => {
    const drive = await run({ '0000000000000000/._4d5307e6': appleDouble() });
    expect(drive.snapshot()).toContainEqual(expect.stringMatching(/^0000000000000000\/\._4d5307e6 /));
  });

  it('J1.17: skips a ._<child> that is a directory', async () => {
    const drive = await run({ '0000000000000000/._4D5307E6': DIR });
    expect(drive.snapshot()).toContain('0000000000000000/._4D5307E6/');
  });

  it('rule 12: a magic check that fails to read gives io-error', async () => {
    const drive = createTestDrive({ tree: { ...stfsPackage('ABC'), '._0000000000000000': appleDouble() } });
    const [ok, dirs] = await openLocationDirectories(drive.root, locationOf('ABC'));
    if (!ok) throw new Error('setup');
    drive.fail({ operation: 'read', path: ['._0000000000000000'] });
    expect(await deleteParentAppleDoubleFiles(drive.root, dirs, locationOf('ABC'), {})).toMatchObject([
      false,
      [{ kind: 'io-error', operation: 'read', path: ['._0000000000000000'] }],
    ]);
  });

  it('rule 12: a listing that fails gives io-error, even for the root', async () => {
    const drive = createTestDrive({ tree: stfsPackage('ABC') });
    const [ok, dirs] = await openLocationDirectories(drive.root, locationOf('ABC'));
    if (!ok) throw new Error('setup');
    drive.fail({ operation: 'list', path: [] });
    expect(await deleteParentAppleDoubleFiles(drive.root, dirs, locationOf('ABC'), {})).toMatchObject([
      false,
      [{ kind: 'io-error', operation: 'list', path: [] }],
    ]);
  });

  it('J1.9: reports progress, deepest directory first', async () => {
    const drive = createTestDrive({
      tree: {
        ...stfsPackage('ABC'),
        '._0000000000000000': appleDouble(),
        '0000000000000000/4D5307E6/._00007000': appleDouble(),
      },
    });
    const [ok, dirs] = await openLocationDirectories(drive.root, locationOf('ABC'));
    if (!ok) throw new Error('setup');
    const progress = recordCalls<StepProgress>();
    await deleteParentAppleDoubleFiles(drive.root, dirs, locationOf('ABC'), { onProgress: progress.fn });
    expect(progress.calls).toEqual([
      { deletedFiles: 1, totalFiles: 2, fileName: '._00007000' },
      { deletedFiles: 2, totalFiles: 2, fileName: '._0000000000000000' },
    ]);
  });
});
